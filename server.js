import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { ErroKali, apagarSessoesExpiradas, fecharBanco } from './src/db.js';
import { criarRotas } from './src/rotas.js';
import { configurarTempoReal, origemPermitida } from './src/tempo-real.js';

const PASTA_PUBLICA = path.join(import.meta.dirname, 'public');
const HOST = process.env.HOST || '0.0.0.0';
const PORTA = Number(process.env.PORT) || 3333;

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  next();
});

app.use(express.json({ limit: '32kb' }));

app.use('/api', criarRotas());
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.get('/', (req, res, next) => {
  res.sendFile(path.join(PASTA_PUBLICA, 'index.html'), (erro) => {
    if (erro) next(erro);
  });
});
app.use(express.static(PASTA_PUBLICA, { index: false, extensions: ['html'] }));

// Tratador de erros final: sempre responde JSON em pt-BR.
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  if (erro instanceof ErroKali) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  if (erro?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (erro?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'O conteúdo enviado é grande demais.' });
  }
  const status = Number(erro?.status || erro?.statusCode);
  if (status === 404) {
    return res.status(404).json({ erro: 'Não encontrado.' });
  }
  if (status >= 400 && status < 500) {
    return res.status(status).json({ erro: 'Requisição inválida.' });
  }
  console.error('[http] erro inesperado:', erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const servidorHttp = http.createServer(app);
const io = new Server(servidorHttp, {
  maxHttpBufferSize: 100_000,
  allowRequest: (req, callback) => {
    callback(null, origemPermitida(req.headers.origin, req.headers.host));
  },
});
configurarTempoReal(io);

apagarSessoesExpiradas();
setInterval(apagarSessoesExpiradas, 60 * 60 * 1000).unref();

servidorHttp.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`A porta ${PORTA} já está em uso. Defina outra com PORT=xxxx.`);
  } else {
    console.error('[http] erro no servidor:', erro);
  }
  process.exit(1);
});

servidorHttp.listen(PORTA, HOST, () => {
  console.log(`KALI rodando em http://${HOST}:${PORTA}`);
});

let encerrando = false;
function encerrar() {
  if (encerrando) return;
  encerrando = true;
  io.close();
  servidorHttp.close();
  try {
    fecharBanco();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
