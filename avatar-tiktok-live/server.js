// Avatar da live: cada presente do TikTok faz o boneco dançar na tela (overlay).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const DANCAS = ['jamal', 'giro', 'pulo', 'aura'];

// Aura de cada pessoa na live, salva em arquivo. O primeiro presente sorteia a aura;
// cada presente a mais aumenta (assim compensa mandar mais).
const AURA_POR_PRESENTE = config.auraPorPresente ?? 0.3;

// "Localizador" de brincadeira: quem manda rosa ganha uma cidade SORTEADA (não é a localização real).
const CIDADES = [
  ['São Paulo', 'SP', -23.55, -46.63], ['Rio de Janeiro', 'RJ', -22.91, -43.17], ['Belo Horizonte', 'MG', -19.92, -43.94],
  ['Salvador', 'BA', -12.97, -38.50], ['Feira de Santana', 'BA', -12.27, -38.97], ['Vitória da Conquista', 'BA', -14.86, -40.84],
  ['Fortaleza', 'CE', -3.73, -38.52], ['Juazeiro do Norte', 'CE', -7.21, -39.31], ['Recife', 'PE', -8.05, -34.88],
  ['Caruaru', 'PE', -8.28, -35.98], ['Petrolina', 'PE', -9.39, -40.50], ['João Pessoa', 'PB', -7.12, -34.86],
  ['Campina Grande', 'PB', -7.23, -35.88], ['Natal', 'RN', -5.79, -35.21], ['Mossoró', 'RN', -5.19, -37.34],
  ['Maceió', 'AL', -9.67, -35.74], ['Aracaju', 'SE', -10.91, -37.07], ['Teresina', 'PI', -5.09, -42.80],
  ['São Luís', 'MA', -2.53, -44.30], ['Imperatriz', 'MA', -5.53, -47.49], ['Belém', 'PA', -1.46, -48.49],
  ['Santarém', 'PA', -2.44, -54.71], ['Marabá', 'PA', -5.37, -49.12], ['Manaus', 'AM', -3.12, -60.02],
  ['Parintins', 'AM', -2.63, -56.74], ['Macapá', 'AP', 0.03, -51.07], ['Boa Vista', 'RR', 2.82, -60.67],
  ['Rio Branco', 'AC', -9.97, -67.81], ['Porto Velho', 'RO', -8.76, -63.90], ['Palmas', 'TO', -10.18, -48.33],
  ['Brasília', 'DF', -15.79, -47.88], ['Goiânia', 'GO', -16.69, -49.26], ['Anápolis', 'GO', -16.33, -48.95],
  ['Cuiabá', 'MT', -15.60, -56.10], ['Sinop', 'MT', -11.86, -55.50], ['Campo Grande', 'MS', -20.47, -54.62],
  ['Dourados', 'MS', -22.22, -54.81], ['Curitiba', 'PR', -25.43, -49.27], ['Londrina', 'PR', -23.31, -51.16],
  ['Foz do Iguaçu', 'PR', -25.54, -54.59], ['Florianópolis', 'SC', -27.60, -48.55], ['Joinville', 'SC', -26.30, -48.85],
  ['Chapecó', 'SC', -27.10, -52.62], ['Porto Alegre', 'RS', -30.03, -51.23], ['Caxias do Sul', 'RS', -29.17, -51.18],
  ['Pelotas', 'RS', -31.77, -52.34], ['Santa Maria', 'RS', -29.69, -53.81], ['Campinas', 'SP', -22.91, -47.06],
  ['Ribeirão Preto', 'SP', -21.18, -47.81], ['Santos', 'SP', -23.96, -46.33], ['Sorocaba', 'SP', -23.50, -47.46],
  ['São José do Rio Preto', 'SP', -20.82, -49.38], ['Uberlândia', 'MG', -18.92, -48.28], ['Juiz de Fora', 'MG', -21.76, -43.35],
  ['Montes Claros', 'MG', -16.73, -43.86], ['Vitória', 'ES', -20.32, -40.34], ['Niterói', 'RJ', -22.88, -43.10],
  ['Campos dos Goytacazes', 'RJ', -21.75, -41.32], ['Ilhéus', 'BA', -14.79, -39.05], ['Barreiras', 'BA', -12.15, -45.00],
].map(([nome, uf, lat, lon]) => ({ nome, uf, lat, lon }));
const sortearCidade = () => CIDADES[Math.floor(Math.random() * CIDADES.length)];
const ehRosa = (giftId, nome) => String(giftId) === '5655' || /^(rose|rosa)$/i.test(String(nome || '').trim());
const ARQUIVO_RANKING = path.join(__dirname, 'ranking.json');
let ranking = {};
try { ranking = JSON.parse(fs.readFileSync(ARQUIVO_RANKING, 'utf8')); } catch {}
const salvar = () => fs.writeFileSync(ARQUIVO_RANKING, JSON.stringify(ranking));
const top = () => Object.values(ranking).sort((a, b) => b.aura - a.aura).slice(0, 3);
const arred = n => Math.round(n * 10) / 10;

function info() {
  return {
    tipo: 'info',
    marca: config.marca || '',
    contato: config.contato || '',
    volume: config.volume ?? 30,
    segundosPorPresente: config.segundosPorPresente ?? 4,
    maxSegundos: config.maxSegundos ?? 60,
    auraPorPresente: AURA_POR_PRESENTE,
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
    const rosa = url.searchParams.get('rosa') !== '0';
    receberPresente(nome, url.searchParams.get('arroba') || nome.toLowerCase().replace(/\s+/g, ''), 'teste:' + nome,
      Number(url.searchParams.get('qtd') || 1), '', DANCAS.includes(danca) ? danca : qualDanca(url.searchParams.get('id')),
      rosa ? 'Rosa' : 'Presente', rosa);
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

function receberPresente(nome, arroba, usuario, qtd, foto, danca, presente, rosa) {
  if (qtd <= 0) return;
  const novo = !ranking[usuario];
  const r = ranking[usuario] || (ranking[usuario] = { nome, qtd: 0, foto, aura: arred(Math.random() * 6) });
  const auraAntes = r.aura;
  if (!novo) r.aura = Math.min(10, arred(r.aura + AURA_POR_PRESENTE * qtd));
  else if (qtd > 1) r.aura = Math.min(10, arred(r.aura + AURA_POR_PRESENTE * (qtd - 1)));
  if (rosa && !r.cidade) r.cidade = sortearCidade(); // a mesma pessoa cai sempre na mesma cidade
  r.qtd += qtd;
  r.nome = nome;
  if (foto) r.foto = foto;
  salvar();
  console.log(`✨ ${nome} mandou ${presente || 'presente'} x${qtd} → aura ${r.aura}`
    + (rosa ? ` · 📍 ${r.cidade.nome} - ${r.cidade.uf} (sorteada)` : ''));
  enviar({ tipo: 'presente', id: usuario, nome, arroba, qtd, foto, danca, presente, novo,
    aura: r.aura, auraAntes: novo ? null : auraAntes, cidade: rosa ? r.cidade : null });
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
    receberPresente(user.nickname || user.displayId || user.uniqueId, user.displayId || user.uniqueId || '',
      usuarioId, qtd, foto, danca, giftName, ehRosa(data.giftId, giftName));
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
