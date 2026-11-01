// Container de Injeção de Dependência (IoC) avançado.
// Suporte a singletons, factories, escopo por requisição e dependências circulares.

const registrados = new Map(); // nome → { tipo, factory, instancia, dependencias }
const resolvendo = new Set();  // detecção de ciclo

export const container = {
  registrar(nome, factory, { singleton = true, dependencias = [] } = {}) {
    registrados.set(nome, { tipo: 'factory', factory, singleton, dependencias, instancia: null });
  },

  registrarInstancia(nome, instancia) {
    registrados.set(nome, { tipo: 'instancia', instancia });
  },

  resolver(nome) {
    const reg = registrados.get(nome);
    if (!reg) throw new Error(`Serviço não registrado: ${nome}`);

    if (reg.tipo === 'instancia') return reg.instancia;
    if (reg.singleton && reg.instancia) return reg.instancia;

    if (resolvendo.has(nome)) throw new Error(`Dependência circular detectada: ${nome}`);
    resolvendo.add(nome);

    try {
      // resolve dependências primeiro
      const deps = reg.dependencias.map((d) => this.resolver(d));
      const instancia = reg.factory(...deps);
      if (reg.singleton) reg.instancia = instancia;
      return instancia;
    } finally {
      resolvendo.delete(nome);
    }
  },

  limpar() {
    registrados.clear();
    resolvendo.clear();
  },
};

// ------------------------------------------------------------------ decorador de rotas
// Permite definir rotas com metadados de validação, middleware e autenticação declarativamente.

const rotasRegistradas = [];

export function rota(caminho, metodo = 'GET', opcoes = {}) {
  return function (alvo, nomeDoMetodo, descritor) {
    rotasRegistradas.push({
      caminho,
      metodo,
      nomeDoMetodo,
      alvo: alvo.constructor,
      schema: opcoes.schema,
      middlewares: opcoes.middlewares || [],
      exigirLogin: opcoes.exigirLogin !== false,
      rateLimit: opcoes.rateLimit,
      descricao: opcoes.descricao,
    });
    return descritor;
  };
}

export function obterRotas() {
  return rotasRegistradas;
}

// ------------------------------------------------------------------ aplicador de rotas
// Percorre as rotas registradas e as aplica a um router do Express.

export function aplicarRotas(router, containerInstance = container) {
  for (const r of rotasRegistradas) {
    const servico = containerInstance.resolver(r.alvo.name);
    const fn = servico[r.nomeDoMetodo].bind(servico);

    const cadeia = [];

    if (r.exigirLogin) {
      cadeia.push((req, res, next) => {
        const token = (req.headers.cookie || '').split('; ').find((c) => c.startsWith('kali_sid='));
        if (!token) return res.status(401).json({ erro: 'Não autorizado.' });
        next();
      });
    }

    if (r.rateLimit) {
      cadeia.push(r.rateLimit);
    }

    if (r.schema) {
      cadeia.push((req, res, next) => {
        try {
          req.bodyValidado = r.schema(req.body || {});
          next();
        } catch (e) {
          next(e);
        }
      });
    }

    cadeia.push(...r.middlewares);

    cadeia.push(asyncHandler(async (req, res) => {
      const resultado = await fn({ ...req, bodyValidado: req.bodyValidado }, res);
      if (resultado !== undefined) res.json(resultado);
    }));

    router[r.metodo.toLowerCase()](r.caminho, ...cadeia);
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
