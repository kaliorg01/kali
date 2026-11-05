// Bot de exemplo da KALI. Como rodar:
//   npm install socket.io-client
//   KALI_URL=https://seu-kali.com KALI_TOKEN=<token do bot> node scripts/bot-exemplo.js
// (no Windows PowerShell: $env:KALI_URL="..."; $env:KALI_TOKEN="..."; node scripts/bot-exemplo.js)
//
// O token sai em: menu do servidor → 🤖 Bots e comandos / → Criar bot.
// Pra criar seus comandos: adicione na lista COMANDOS e trate em responder().
import { io } from 'socket.io-client';

const URL = (process.env.KALI_URL || 'http://localhost:3333').replace(/\/$/, '');
const TOKEN = process.env.KALI_TOKEN;
if (!TOKEN) { console.error('Faltou KALI_TOKEN (o token do bot).'); process.exit(1); }

const COMANDOS = [
  { nome: 'ping', descricao: '🏓 Vê se o bot tá vivo' },
  { nome: 'dado', descricao: '🎲 Rola um dado (ex: /dado 20)' },
  { nome: 'moeda', descricao: '🪙 Cara ou coroa' },
  { nome: 'escolhe', descricao: '🤔 Escolhe entre opções: /escolhe pizza, lanche, açaí' },
  { nome: '8ball', descricao: '🎱 Responde sua pergunta de sim ou não' },
];

function responder(cmd) {
  const a = cmd.args;
  switch (cmd.comando) {
    case 'ping': return `🏓 Pong, ${cmd.usuario.nome}!`;
    case 'dado': { const lados = Math.min(1000, Math.max(2, parseInt(a, 10) || 6)); return `🎲 ${cmd.usuario.nome} rolou um d${lados}: **${1 + Math.floor(Math.random() * lados)}**`; }
    case 'moeda': return Math.random() < 0.5 ? '🪙 Deu **cara**!' : '🪙 Deu **coroa**!';
    case 'escolhe': { const op = a.split(/,|\bou\b/).map((x) => x.trim()).filter(Boolean); return op.length < 2 ? 'Manda pelo menos 2 opções: /escolhe pizza, lanche' : `🤔 Eu escolho: **${op[Math.floor(Math.random() * op.length)]}**`; }
    case '8ball': { const r = ['Com certeza 😎', 'Sem chance 💀', 'Talvez... 🤔', 'Pergunta de novo mais tarde', 'Sim!', 'Melhor não 😬']; return a ? `🎱 ${r[Math.floor(Math.random() * r.length)]}` : '🎱 Faz uma pergunta: /8ball vou ganhar hoje?'; }
    default: return null;
  }
}

async function registrar() {
  const r = await fetch(URL + '/api/bot/comandos', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bot ' + TOKEN }, body: JSON.stringify({ comandos: COMANDOS }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'falhou ao registrar comandos (' + r.status + ')');
  console.log('✅ Comandos registrados:', COMANDOS.map((c) => '/' + c.nome).join(' '));
}

const sock = io(URL, { auth: { botToken: TOKEN }, transports: ['websocket'] });
sock.on('connect', () => console.log('🤖 Bot conectado na KALI'));
sock.on('connect_error', (e) => console.error('Não conectou:', e.message, '(token certo? servidor no ar?)'));
sock.on('bot:comando', (cmd) => {
  const texto = responder(cmd);
  if (!texto) return;
  sock.emit('msg:enviar', { canalId: cmd.canalId, texto, respostaA: cmd.msgId }, (r) => { if (r && r.erro) console.error('Erro ao responder:', r.erro); });
});

registrar().catch((e) => { console.error(e.message); process.exit(1); });
