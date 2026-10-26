// Avatar da live: cada presente do TikTok faz o boneco dançar na tela (overlay).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const DANCAS = ['jamal', 'giro', 'pulo', 'aura'];

// Ranking da live (quem mais mandou presente), salvo em arquivo.
const ARQUIVO_RANKING = path.join(__dirname, 'ranking.json');
let ranking = {};
try { ranking = JSON.parse(fs.readFileSync(ARQUIVO_RANKING, 'utf8')); } catch {}
const salvar = () => fs.writeFileSync(ARQUIVO_RANKING, JSON.stringify(ranking));
const top = () => Object.values(ranking).sort((a, b) => b.qtd - a.qtd).slice(0, 3);

function info() {
  return {
    tipo: 'info',
    marca: config.marca || '',
    contato: config.contato || '',
    volume: config.volume ?? 30,
    segundosPorPresente: config.segundosPorPresente ?? 4,
    maxSegundos: config.maxSegundos ?? 60,
    top: top(),
  };
}

function qualDanca(giftId) {
  const d = config.dancas || {};
  const escolhida = d[String(giftId)] || d.padrao || 'jamal';
  return DANCAS.includes(escolhida) ? escolhida : 'jamal';
}

// ---------- servidor da tela ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };

function servirArquivo(res, arquivo, base) {
  if (!arquivo.startsWith(base)) return res.writeHead(403).end();
  fs.readFile(arquivo, (err, dados) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(dados);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Teste: http://localhost:3001/teste?nome=Maria&qtd=3&danca=jamal
  if (url.pathname === '/teste') {
    const nome = url.searchParams.get('nome') || 'Teste';
    const danca = url.searchParams.get('danca');
    receberPresente(nome, 'teste:' + nome, Number(url.searchParams.get('qtd') || 1), '',
      DANCAS.includes(danca) ? danca : qualDanca(url.searchParams.get('id')), 'Rosa');
    return res.end('ok');
  }
  if (url.pathname === '/zerar') {
    ranking = {};
    salvar();
    enviar(info());
    return res.end('ranking zerado');
  }
  // Biblioteca 3D (three.js) vem do node_modules, sem depender de internet.
  if (url.pathname.startsWith('/three/')) {
    const base = path.join(__dirname, 'node_modules', 'three');
    return servirArquivo(res, path.join(base, decodeURIComponent(url.pathname.slice(7))), base);
  }
  const base = path.join(__dirname, 'public');
  servirArquivo(res, path.join(base, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)), base);
});

const wss = new WebSocketServer({ server });
const enviar = msg => wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(msg)));
wss.on('connection', ws => ws.send(JSON.stringify(info())));

function receberPresente(nome, usuario, qtd, foto, danca, presente) {
  if (qtd <= 0) return;
  const r = ranking[usuario] || (ranking[usuario] = { nome, qtd: 0, foto });
  r.qtd += qtd;
  r.nome = nome;
  if (foto) r.foto = foto;
  salvar();
  console.log(`💃 ${nome} mandou ${presente || 'presente'} x${qtd} → dança "${danca}"`);
  enviar({ tipo: 'presente', nome, qtd, foto, danca, presente });
  enviar(info());
}

server.listen(config.porta, () => {
  console.log(`\nTela do avatar: http://localhost:${config.porta}`);
  console.log(`Teste:          http://localhost:${config.porta}/teste?nome=Maria&qtd=3\n`);
});

// ---------- conexão com a live ----------
// Presentes em sequência (combo x16, x100...) chegam várias vezes com a contagem
// subindo. Guardamos o último valor de cada combo e somamos só a diferença.
const combos = new Map();

let tentativa = null;
function reconectar(segundos) {
  if (tentativa) return;
  tentativa = setTimeout(() => { tentativa = null; conectar(); }, segundos * 1000);
}

function conectar() {
  const usuario = String(config.usuarioTikTok || '').trim().replace(/^@/, '');
  if (!usuario || usuario === 'SEU_USUARIO_AQUI') {
    console.log('⚠️  Coloque seu usuário do TikTok no config.json (sem o @). Por enquanto só o modo teste funciona.');
    return;
  }
  console.log(`⏳ Conectando na live de @${usuario}...`);
  // Sem enableExtendedGiftInfo: buscar a lista de presentes exige plano pago da Euler Stream.
  const opcoes = {};
  if (config.chaveEuler) opcoes.signApiKey = config.chaveEuler;
  const live = new TikTokLiveConnection(usuario, opcoes);

  live.on(WebcastEvent.CHAT, data => console.log(`💬 ${data.user?.nickname}: ${data.content ?? data.comment}`));

  live.on(WebcastEvent.GIFT, data => {
    // O TikTok muda os nomes dos campos de vez em quando; aceitamos os dois formatos.
    const gift = data.gift || {};
    const giftName = gift.name || data.giftDetails?.giftName || '';
    const giftType = gift.type ?? data.giftDetails?.giftType;
    const user = data.user || {};
    const usuarioId = user.id || user.userId || user.displayId || user.uniqueId;
    const foto = user.avatarThumb?.urlList?.[0] || user.profilePicture?.url?.[0] || '';
    const danca = qualDanca(data.giftId);
    console.log(`🎁 ${user.nickname} enviou "${giftName}" (id ${data.giftId}) x${data.repeatCount}`);

    // Soma só o que aumentou desde o último aviso do mesmo combo.
    const chave = `${usuarioId}:${data.giftId}:${data.groupId}`;
    const qtd = (data.repeatCount || 1) - (combos.get(chave) || 0);
    if (data.repeatEnd || (giftType !== undefined && giftType !== 1)) combos.delete(chave); else combos.set(chave, data.repeatCount || 1);
    receberPresente(user.nickname || user.displayId || user.uniqueId, usuarioId, qtd, foto, danca, giftName);
  });

  live.on('disconnected', () => {
    console.log('Live desconectada. Tentando de novo em 10s...');
    reconectar(10);
  });

  live.connect()
    .then(s => console.log(`✅ Conectado na live de @${usuario} (sala ${s.roomId}). Pode mandar presente!`))
    .catch(err => {
      console.log(`❌ Não conectou em @${usuario}: ${err.message}`);
      console.log('   Confira: a live está aberta NESSA conta? O usuário no config.json está certo? Tentando de novo em 15s...');
      reconectar(15);
    });
}

conectar();
