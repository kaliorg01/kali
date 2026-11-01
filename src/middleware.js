// Middleware avançado para o Aura:
// - Schema validation (estilo Joi/Zod leve)
// - Rate limiting por token bucket
// - Logging estruturado
// - Cadeia de responsabilidade (compose)
// - Error tipado

import { erro } from './db.js';

// ------------------------------------------------------------------ schema validation
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_URL = /^https?:\/\/.+/;

const regras = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  email: (v) => typeof v === 'string' && RE_EMAIL.test(v),
  url: (v) => typeof v === 'string' && RE_URL.test(v),
  array: (v) => Array.isArray(v),
  object: (v) => v != null && typeof v === 'object' && !Array.isArray(v),
};

export function schema(def) {
  const keys = Object.keys(def);
  return (dados) => {
    const erros = {};
    const valores = {};
    for (const k of keys) {
      const regra = def[k];
      const valor = dados[k];
      const obrigatorio = regra.required !== false;

      if (valor === undefined || valor === null) {
        if (obrigatorio) {
          erros[k] = 'Campo obrigatório.';
        }
        continue;
      }

      let tipoOk = false;
      if (Array.isArray(regra)) {
        tipoOk = regra.includes(valor);
      } else if (typeof regra === 'string') {
        tipoOk = regras[regra] ? regras[regra](valor) : true;
      } else if (typeof regra === 'function') {
        tipoOk = regra(valor);
      } else if (regra && typeof regra === 'object' && regra._schema) {
        const res = regra._schema(valor);
        if (res.erro) erros[k] = res.erro;
        else valores[k] = res.valor;
        continue;
      } else {
        tipoOk = true;
      }

      if (!tipoOk) {
        erros[k] = `Tipo inválido.`;
        continue;
      }

      // regras complementares
      if (regra.min !== undefined && typeof valor === 'string' && valor.length < regra.min) {
        erros[k] = `Mínimo ${regra.min} caracteres.`;
      }
      if (regra.max !== undefined && typeof valor === 'string' && valor.length > regra.max) {
        erros[k] = `Máximo ${regra.max} caracteres.`;
      }
      if (regra.min !== undefined && typeof valor === 'number' && valor < regra.min) {
        erros[k] = `Valor mínimo ${regra.min}.`;
      }
      if (regra.max !== undefined && typeof valor === 'number' && valor > regra.max) {
        erros[k] = `Valor máximo ${regra.max}.`;
      }

      valores[k] = valor;
    }

    if (Object.keys(erros).length) {
      const primeiro = Object.values(erros)[0];
      throw erro(400, primeiro);
    }
    return valores;
  };
}

export const s = {
  string: (opts = {}) => ({ _schema: true, type: 'string', ...opts }),
  number: (opts = {}) => ({ _schema: true, type: 'number', ...opts }),
  integer: (opts = {}) => ({ _schema: true, type: 'integer', ...opts }),
  boolean: (opts = {}) => ({ _schema: true, type: 'boolean', ...opts }),
  email: (opts = {}) => ({ _schema: true, type: 'email', ...opts }),
  url: (opts = {}) => ({ _schema: true, type: 'url', ...opts }),
  array: (opts = {}) => ({ _schema: true, type: 'array', ...opts }),
  object: (opts = {}) => ({ _schema: true, type: 'object', ...opts }),
  oneOf: (vals) => vals,
};

// ------------------------------------------------------------------ rate limiting (token bucket)
const buckets = new Map(); // chave → {tokens, ultimo}

export function rateLimit(chaveFn, { capacidade = 10, recargaPorSegundo = 2 } = {}) {
  return (req, res, next) => {
    const chave = chaveFn(req);
    const agora = Date.now();
    let b = buckets.get(chave);
    if (!b) b = { tokens: capacidade, ultimo: agora };

    const passou = (agora - b.ultimo) / 1000;
    b.tokens = Math.min(capacidade, b.tokens + passou * recargaPorSegundo);
    b.ultimo = agora;

    if (b.tokens < 1) {
      buckets.set(chave, b);
      res.set('Retry-After', Math.ceil((1 - b.tokens) / recargaPorSegundo));
      return res.status(429).json({ erro: 'Muitas requisições. Aguarde um pouco.' });
    }

    b.tokens -= 1;
    buckets.set(chave, b);
    next();
  };
}

export const rateLimitPorIP = rateLimit((req) => req.ip || req.socket.remoteAddress || 'desconhecido');
export const rateLimitPorUsuario = rateLimit((req) => req.usuario?.id || req.ip || 'anonimo', { capacidade: 30, recargaPorSegundo: 5 });

// ------------------------------------------------------------------ logging estruturado
const niveis = { erro: 0, warn: 1, info: 2, debug: 3 };
const nivelAtual = niveis[process.env.LOG_LEVEL || 'info'];

export function logger(nivel, mensagem, meta = {}) {
  if (niveis[nivel] > nivelAtual) return;
  const linha = JSON.stringify({
    ts: new Date().toISOString(),
    nivel,
    mensagem,
    ...meta,
  });
  if (nivel === 'erro') console.error(linha);
  else console.log(linha);
}

export function loggerMiddleware(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    const duracao = Date.now() - inicio;
    logger('info', `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      ip: req.ip,
      duracao: `${duracao}ms`,
      usuarioId: req.usuario?.id,
    });
  });
  next();
}

// ------------------------------------------------------------------ compose (cadeia de responsabilidade)
export function compose(middlewares) {
  return async (req, res, next) => {
    let indice = -1;
    const dispatch = (i) => {
      if (i <= indice) return Promise.reject(new Error('next() chamado múltiplas vezes.'));
      indice = i;
      const fn = middlewares[i];
      if (!fn) return Promise.resolve();
      try {
        const resultado = fn(req, res, (ctx) => {
          if (ctx instanceof Error) return Promise.reject(ctx);
          return dispatch(i + 1);
        });
        return Promise.resolve(resultado);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    try {
      await dispatch(0);
      next();
    } catch (e) {
      next(e);
    }
  };
}

// ------------------------------------------------------------------ wrapper async para rotas
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
