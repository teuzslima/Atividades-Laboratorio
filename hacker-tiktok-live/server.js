// Rastreador da live (BRINCADEIRA): quem manda rosa é "localizado" numa cidade SORTEADA.
// Não existe nenhuma localização real aqui: a cidade é sorteada e fica igual para a mesma pessoa.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

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

// Cidade sorteada de cada pessoa (com um desvio pequeno para o zoom não cair sempre no mesmo ponto).
const ARQUIVO = path.join(__dirname, 'alvos.json');
let alvos = {};
try { alvos = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch {}
const salvar = () => fs.writeFileSync(ARQUIVO, JSON.stringify(alvos));
function sortearCidade() {
  const c = CIDADES[Math.floor(Math.random() * CIDADES.length)];
  const desvio = () => (Math.random() - .5) * .04; // ~2 km
  return { ...c, lat: c.lat + desvio(), lon: c.lon + desvio() };
}

const IDS_ROSA = (config.presentesQueLocalizam || [5655]).map(String);
const localiza = (giftId, nome) => config.qualquerPresenteLocaliza
  || IDS_ROSA.includes(String(giftId)) || /^(rose|rosa)$/i.test(String(nome || '').trim());

function info() {
  const lista = Object.values(alvos).sort((a, b) => b.quando - a.quando).slice(0, 3);
  return { tipo: 'info', marca: config.marca || '', contato: config.contato || '', volume: config.volume ?? 30,
    segundosNaTela: config.segundosNaTela ?? 6, ultimos: lista };
}

// ---------- servidor da tela ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm' };

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
  // Teste: http://localhost:3002/teste?nome=Maria&arroba=maria123
  if (url.pathname === '/teste') {
    const nome = url.searchParams.get('nome') || 'Teste';
    alvo(nome, url.searchParams.get('arroba') || nome.toLowerCase().replace(/\s+/g, ''), 'teste:' + nome, '',
      Number(url.searchParams.get('qtd') || 1));
    return res.end('ok');
  }
  if (url.pathname === '/zerar') {
    alvos = {};
    salvar();
    enviar(info());
    return res.end('alvos zerados');
  }
  // Casa 3D do scanner (three.js) também vem do node_modules
  if (url.pathname.startsWith('/three/')) {
    const base = path.join(__dirname, 'node_modules', 'three');
    return servirArquivo(res, path.join(base, decodeURIComponent(url.pathname.slice(7))), base);
  }
  // Biblioteca do mapa (Leaflet) vem do node_modules
  if (url.pathname.startsWith('/leaflet/')) {
    const base = path.join(__dirname, 'node_modules', 'leaflet', 'dist');
    return servirArquivo(res, path.join(base, decodeURIComponent(url.pathname.slice(9))), base);
  }
  const base = path.join(__dirname, 'public');
  servirArquivo(res, path.join(base, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)), base);
});

const wss = new WebSocketServer({ server });
const enviar = msg => wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(msg)));
wss.on('connection', ws => ws.send(JSON.stringify(info())));

function alvo(nome, arroba, usuario, foto, qtd) {
  if (qtd <= 0) return;
  const a = alvos[usuario] || (alvos[usuario] = { nome, arroba, foto, cidade: sortearCidade() });
  a.nome = nome;
  a.quando = Date.now();
  salvar();
  console.log(`📍 ${nome} (@${arroba}) → ${a.cidade.nome} - ${a.cidade.uf} (sorteada)`);
  enviar({ tipo: 'alvo', id: usuario, nome, arroba, foto, cidade: a.cidade });
  enviar(info());
}

server.listen(config.porta, () => {
  console.log(`\nTela do rastreador: http://localhost:${config.porta}`);
  console.log(`Teste:              http://localhost:${config.porta}/teste?nome=Maria&arroba=maria123\n`);
});

// ---------- conexão com a live ----------
// Presentes em sequência (combo) chegam várias vezes; só conta o que aumentou.
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
    const vale = localiza(data.giftId, giftName);
    console.log(`🎁 ${user.nickname} enviou "${giftName}" (id ${data.giftId}) x${data.repeatCount}` + (vale ? '' : ' → não localiza'));

    const chave = `${usuarioId}:${data.giftId}:${data.groupId}`;
    const qtd = (data.repeatCount || 1) - (combos.get(chave) || 0);
    if (data.repeatEnd || (giftType !== undefined && giftType !== 1)) combos.delete(chave); else combos.set(chave, data.repeatCount || 1);
    if (vale) alvo(user.nickname || user.displayId || user.uniqueId, user.displayId || user.uniqueId || '', usuarioId, foto, qtd);
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
