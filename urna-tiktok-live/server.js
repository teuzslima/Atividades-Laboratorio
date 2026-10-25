// Urna da live: lê os presentes do TikTok e manda os votos para a tela (overlay).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const ARQUIVO_VOTOS = path.join(__dirname, 'votos.json');

// Placar salvo em arquivo, para não perder nada se o programa fechar.
const estadoVazio = () => ({ votos: { '13': 0, '22': 0 }, eleitores: {}, ultimo: {} });
let estado = estadoVazio();
try { estado = { ...estado, ...JSON.parse(fs.readFileSync(ARQUIVO_VOTOS, 'utf8')) }; } catch {}
const salvar = () => fs.writeFileSync(ARQUIVO_VOTOS, JSON.stringify(estado));

// Rodadas com tempo: quando o tempo acaba, mostra quem venceu e começa outra do zero.
// "rodadaMinutos": 0 no config.json desliga o tempo (votação contínua).
const RODADA_MS = (config.rodadaMinutos ?? 5) * 60 * 1000;
if (RODADA_MS && !(estado.fimRodada > Date.now())) estado.fimRodada = Date.now() + RODADA_MS;

function novaRodada() {
  estado = { ...estadoVazio(), fimRodada: RODADA_MS ? Date.now() + RODADA_MS : 0 };
  salvar();
  enviar(placar());
}

setInterval(() => {
  if (!RODADA_MS || Date.now() < estado.fimRodada) return;
  const { '13': v13, '22': v22 } = estado.votos;
  const vencedor = v13 === v22 ? null : (v13 > v22 ? '13' : '22');
  console.log(`🏁 Fim da rodada! 13: ${v13}  22: ${v22}  →  ${vencedor ? 'venceu ' + vencedor : 'empate'}`);
  enviar({ tipo: 'fimRodada', vencedor, votos: { ...estado.votos } });
  novaRodada();
}, 1000);

function topEleitores(numero) {
  return Object.values(estado.eleitores)
    .filter(e => e.numero === numero)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 3);
}

function placar() {
  return {
    tipo: 'placar',
    votos: estado.votos,
    nomes: { '13': config.candidatos['13'].nome, '22': config.candidatos['22'].nome },
    videoDebate: config.videoDebate || '',
    volumeBipe: config.volumeBipe ?? 30,
    marca: config.marca || '',
    contato: config.contato || '',
    top: { '13': topEleitores('13'), '22': topEleitores('22') },
    ultimo: estado.ultimo,
    fimRodada: RODADA_MS ? estado.fimRodada : 0,
    duracaoRodada: RODADA_MS,
    agora: Date.now(),
  };
}

// ---------- servidor da tela ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Teste sem precisar de presente: http://localhost:3000/teste?voto=13&nome=Maria&qtd=5
  if (url.pathname === '/teste') {
    const nome = url.searchParams.get('nome') || 'Teste';
    registrarVoto(url.searchParams.get('voto') || '13', nome, 'teste:' + nome, Number(url.searchParams.get('qtd') || 1), '');
    return res.end('ok');
  }
  if (url.pathname === '/zerar') {
    novaRodada();
    return res.end('placar zerado e rodada reiniciada');
  }

  const arquivo = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(path.join(__dirname, 'public'))) return res.writeHead(403).end();
  const tipo = TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
  if (tipo.startsWith('video/')) return enviarVideo(req, res, arquivo, tipo);
  fs.readFile(arquivo, (err, dados) => {
    if (err) return res.writeHead(404).end();
    // no-store: o LIVE Studio não guarda versão velha da tela
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
});

// Vídeos são enviados em pedaços, senão o navegador não consegue repetir/avançar.
function enviarVideo(req, res, arquivo, tipo) {
  fs.stat(arquivo, (err, info) => {
    if (err) return res.writeHead(404).end();
    const faixa = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (!faixa) {
      res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(arquivo).pipe(res);
    }
    const inicio = Number(faixa[1] || 0);
    const fim = faixa[2] ? Number(faixa[2]) : info.size - 1;
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Length': fim - inicio + 1, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${inicio}-${fim}/${info.size}` });
    fs.createReadStream(arquivo, { start: inicio, end: fim }).pipe(res);
  });
}

const wss = new WebSocketServer({ server });
const enviar = msg => wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(msg)));
wss.on('connection', ws => ws.send(JSON.stringify(placar())));

function registrarVoto(numero, nome, usuario, qtd, foto) {
  if (!estado.votos[numero] && estado.votos[numero] !== 0) return;
  if (qtd <= 0) return;
  estado.votos[numero] += qtd;
  const chave = `${usuario}:${numero}`;
  const e = estado.eleitores[chave] || (estado.eleitores[chave] = { nome, numero, qtd: 0, foto });
  e.qtd += qtd;
  e.nome = nome;
  if (foto) e.foto = foto;
  estado.ultimo[numero] = nome;
  salvar();
  console.log(`🗳️  ${nome} votou ${numero} x${qtd}  |  13: ${estado.votos['13']}  22: ${estado.votos['22']}`);
  enviar({ tipo: 'voto', numero, nome, qtd, foto });
  enviar(placar());
}

server.listen(config.porta, () => {
  console.log(`\nTela da urna: http://localhost:${config.porta}`);
  console.log(`Teste:        http://localhost:${config.porta}/teste?voto=13&nome=Maria&qtd=3\n`);
});

// ---------- conexão com a live ----------
function qualCandidato(giftId, giftName) {
  const nomeMin = (giftName || '').toLowerCase().trim();
  // Confere primeiro pelo número do presente, depois pelo nome exato.
  for (const [numero, c] of Object.entries(config.candidatos)) {
    if (c.presentesIds.some(id => String(id) === String(giftId))) return numero;
  }
  for (const [numero, c] of Object.entries(config.candidatos)) {
    if (c.presentesNomes.some(n => n.toLowerCase() === nomeMin)) return numero;
  }
  // Último recurso: qualquer presente com "rosa"/"rose" no nome. Branca vai pro 22, as outras pro 13.
  if (/ros[ae]/.test(nomeMin)) return /white|branc/.test(nomeMin) ? '22' : '13';
  return null;
}

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

  // Mostra os comentários: se eles aparecem aqui, a conexão com a live está funcionando.
  live.on(WebcastEvent.CHAT, data => console.log(`💬 ${data.user?.nickname}: ${data.content ?? data.comment}`));

  live.on(WebcastEvent.GIFT, data => {
    // O TikTok muda os nomes dos campos de vez em quando; aceitamos os dois formatos.
    const gift = data.gift || {};
    const giftName = gift.name || data.giftDetails?.giftName || '';
    const giftType = gift.type ?? data.giftDetails?.giftType;
    const numero = qualCandidato(data.giftId, giftName);
    const user = data.user || {};
    const usuarioId = user.id || user.userId || user.displayId || user.uniqueId;
    const foto = user.avatarThumb?.urlList?.[0] || user.profilePicture?.url?.[0] || '';
    console.log(`🎁 ${user.nickname} enviou "${giftName}" (id ${data.giftId}) x${data.repeatCount}`
      + (numero ? ` → voto ${numero}` : ' → não é voto (veja o LEIA-ME para configurar)'));
    if (!numero) return;

    // Soma só o que aumentou desde o último aviso do mesmo combo.
    const chave = `${usuarioId}:${data.giftId}:${data.groupId}`;
    const qtd = (data.repeatCount || 1) - (combos.get(chave) || 0);
    if (data.repeatEnd || (giftType !== undefined && giftType !== 1)) combos.delete(chave); else combos.set(chave, data.repeatCount || 1);
    registrarVoto(numero, user.nickname || user.displayId || user.uniqueId, usuarioId, qtd, foto);
  });

  live.on('disconnected', () => {
    console.log('Live desconectada. Tentando de novo em 10s...');
    reconectar(10);
  });

  live.connect()
    .then(s => console.log(`✅ Conectado na live de @${usuario} (sala ${s.roomId}). Pode mandar rosa!`))
    .catch(err => {
      console.log(`❌ Não conectou em @${usuario}: ${err.message}`);
      console.log('   Confira: a live está aberta NESSA conta? O usuário no config.json está certo? Tentando de novo em 15s...');
      reconectar(15);
    });
}

conectar();
