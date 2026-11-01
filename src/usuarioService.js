// Exemplo de serviço usando DI + decorador de rota.
// Este padrão separa: registro de rotas (declarativo) da lógica de negócio.

import { container, rota, obterRotas, aplicarRotas } from './container.js';
import { schema, s } from './middleware.js';

export class UsuarioService {
  constructor(db) {
    this.db = db;
  }

  @rota('/api/usuarios/perfil', 'GET', { exigirLogin: true, descricao: 'Perfil do usuário logado' })
  async perfil(req, res) {
    const { id } = req.usuario || {};
    const u = this.db.usuarioPorId(id);
    if (!u) throw new Error('Usuário não encontrado.');
    return { id: u.id, usuario: u.usuario, nome: u.nome, cor: u.cor };
  }

  @rota('/api/usuarios/perfil', 'PATCH', {
    exigirLogin: true,
    schema: schema({
      nome: s.string({ min: 1, max: 32 }),
      cor: s.string({ max: 7 }),
      statusTexto: s.string({ max: 80 }),
    }),
    descricao: 'Atualiza perfil do usuário.',
  })
  async atualizarPerfil(req, res) {
    const { id } = req.usuario || {};
    const dados = req.bodyValidado || {};
    this.db.atualizarPerfil(id, dados);
    return { ok: true };
  }

  @rota('/api/usuarios/ranking', 'GET', { exigirLogin: true, descricao: 'Ranking do servidor' })
  async ranking(req, res) {
    const { servidorId } = req.query;
    return this.db.ranking(Number(servidorId));
  }
}

// Registra no container (db é injetado)
container.registrar('UsuarioService', (db) => new UsuarioService(db), {
  dependencias: ['db'],
});

export { container, rota, obterRotas, aplicarRotas };
