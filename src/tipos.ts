// Tipos avançados do Kali (comunidade tipo Discord).
// Branded types, unions discriminadas, generics e type guards.

export type Snowflake = number & { readonly __brand: 'Snowflake' };
export type ISO8601 = string & { readonly __brand: 'ISO8601' };
export type HexColor = string & { readonly __brand: 'HexColor' };
export type Emoji = string & { readonly __brand: 'Emoji' };

export const makeSnowflake = (n: number): Snowflake => n as Snowflake;
export const makeHex = (c: string): HexColor => c as HexColor;

// ------------------------------------------------------------------ canais
export type CanalTipo = 'texto' | 'voz' | 'assistir' | 'dm';

export interface CanalBase {
  id: number;
  servidorId: number | null;
  nome: string;
  tipo: CanalTipo;
  posicao: number;
  espacial: boolean;
  privado: boolean;
  comSenha: boolean;
  ticket: number | null;
}

export interface CanalTexto extends CanalBase {
  tipo: 'texto';
}

export interface CanalVoz extends CanalBase {
  tipo: 'voz';
  espacial: boolean;
}

export interface CanalAssistir extends CanalBase {
  tipo: 'assistir';
}

export interface CanalDM extends CanalBase {
  tipo: 'dm';
}

export type Canal = CanalTexto | CanalVoz | CanalAssistir | CanalDM;

export const ehCanalTexto = (c: Canal): c is CanalTexto => c.tipo === 'texto';
export const ehCanalVoz = (c: Canal): c is CanalVoz => c.tipo === 'voz';
export const ehCanalAssistir = (c: Canal): c is CanalAssistir => c.tipo === 'assistir';
export const ehCanalDM = (c: Canal): c is CanalDM => c.tipo === 'dm';
export const podeTerMensagens = (c: Canal): c is CanalTexto | CanalAssistir | CanalDM =>
  c.tipo === 'texto' || c.tipo === 'assistir' || c.tipo === 'dm';

// ------------------------------------------------------------------ usuário / perfil
export interface UsuarioPublico {
  id: number;
  usuario: string;
  nome: string;
  cor: HexColor;
  status: 'online' | 'ausente' | 'ocupado' | 'foco' | 'offline';
  statusTexto: string;
  focoAte: number | null;
  vitrine: {
    bio: string;
    banner: string;
    links: string[];
    aniversario: string;
    jogos: string[];
  };
}

export interface MembroPublico extends UsuarioPublico {
  dono: boolean;
  nivel: number;
  cargo: 'dono' | 'adm' | 'mod' | 'membro';
}

export type CargoNivel = 4 | 3 | 2 | 1 | 0; // dono, adm, mod, membro, nao-e-membro
export const CARGOS: readonly CargoNivel[] = [4, 3, 2, 1, 0] as const;

// ------------------------------------------------------------------ servidor
export interface Servidor {
  id: number;
  nome: string;
  sigla: string;
  donoId: number;
  convite: string;
  canais: Canal[];
  naoLidos: Record<number, number>;
}

// ------------------------------------------------------------------ mensagem
export interface Reacao {
  emoji: Emoji;
  usuarios: number[];
}

export interface MensagemAudio {
  url: string;
  duracao: number;
}

export interface MensagemBase {
  id: number;
  canalId: number;
  autor: { id: number; usuario: string; nome: string; cor: HexColor } | null;
  texto: string;
  criadoEm: number;
  editadoEm: number | null;
  reacoes: Reacao[];
  sistema?: boolean;
}

export interface MensagemTexto extends MensagemBase {
  texto: string;
  editadoEm: number | null;
  expiraEm?: number;
}

export interface MensagemVoz extends MensagemBase {
  texto: '';
  audio: MensagemAudio;
  transcricao?: string;
  expiraEm?: number;
}

export type Mensagem = MensagemTexto | MensagemVoz;

export const ehMensagemVoz = (m: Mensagem): m is MensagemVoz => !!m.audio;

// ------------------------------------------------------------------ DM
export interface DM {
  canalId: number;
  outro: UsuarioPublico;
  ultima: Mensagem | null;
  naoLidos: number;
}

// ------------------------------------------------------------------ LFG
export type LFGTipo = 'duo' | 'squad';
export type LFGStatus = 'aberto' | 'cheio' | 'cancelado';

export interface LFG {
  id: number;
  servidorId: number;
  canalVozId: number | null;
  canalVozNome: string | null;
  autor: UsuarioPublico;
  jogo: string;
  rank: string | null;
  tipo: LFGTipo;
  vagas: number;
  ocupados: number;
  texto: string;
  status: LFGStatus;
  criadoEm: number;
  expiraEm: number | null;
}

// ------------------------------------------------------------------ denúncia
export type DenunciaEstado = 'aberta' | 'resolvida' | 'descartada';

export interface Denuncia {
  id: number;
  servidorId: number;
  estado: DenunciaEstado;
  motivo: string;
  texto: string | null;
  mensagemId: number | null;
  canalId: number | null;
  autor: { id: number; nome: string };
  alvo: { id: number; nome: string } | null;
  criadoEm: number;
}

// ------------------------------------------------------------------ missão / selo / xp
export interface Selo {
  chave: string;
  titulo: string;
  emoji: Emoji;
  ganhoEm: number;
}

export interface Missao {
  chave: string;
  titulo: string;
  meta: number;
  selo: Selo;
}

export interface ProgressoMissao {
  chave: string;
  valor: number;
  completa: boolean;
  selo: Selo | null;
}

export interface MissoesServidor {
  xp: number;
  nivel: number;
  nivelXp: number;
  proximoNivelXp: number;
  semana: string;
  bonus: number;
  missoes: (Missao & { valor: number; completa: boolean })[];
  selos: Selo[];
}

export interface RankingEntry {
  usuario: UsuarioPublico;
  xp: number;
  nivel: number;
}

// ------------------------------------------------------------------ presença
export interface Presenca {
  usuarioId: number;
  status: 'online' | 'ausente' | 'ocupado' | 'offline';
  focoAte: number | null;
  nome: string;
  cor: HexColor;
  statusTexto: string;
}

// ------------------------------------------------------------------ voz
export interface MembroVoz {
  usuarioId: number;
  nome: string;
  cor: HexColor;
  mudo: boolean;
  surdo: boolean;
  falando: boolean;
  x: number;
  y: number;
}

export interface EstadoVoz {
  canalId: number;
  membros: MembroVoz[];
}

// ------------------------------------------------------------------ Assistir Junto
export type AssistirTipo = 'youtube' | 'video';

export interface VideoAssistir {
  url: string;
  tipo: AssistirTipo;
  videoId: string | null;
  tocando: boolean;
  tempo: number;
  atualizadoEm: number;
  hostId: number | null;
  espectadores: UsuarioPublico[];
  agora: number;
}

// ------------------------------------------------------------------ eventos gateway (socket.io)
export type SocketEvento =
  | { ev: 'msg:nova'; dados: Mensagem }
  | { ev: 'msg:editada'; dados: Mensagem }
  | { ev: 'msg:apagada'; dados: { id: number; canalId: number } }
  | { ev: 'msg:reacoes'; dados: { id: number; canalId: number; reacoes: Reacao[] } }
  | { ev: 'digitando'; dados: { canalId: number; usuario: { id: number; nome: string } } }
  | { ev: 'presenca'; dados: Presenca }
  | { ev: 'voz:membros'; dados: EstadoVoz }
  | { ev: 'voz:par-saiu'; dados: { usuarioId: number } }
  | { ev: 'voz:sinal'; dados: { de: number; dados: unknown } }
  | { ev: 'assistir:estado'; dados: VideoAssistir }
  | { ev: 'canal:novo'; dados: Canal }
  | { ev: 'canal:apagado'; dados: { id: number; servidorId: number } }
  | { ev: 'servidor:atualizado'; dados: Servidor }
  | { ev: 'servidor:apagado'; dados: { id: number } }
  | { ev: 'membro:entrou'; dados: { servidorId: number; membro: MembroPublico } }
  | { ev: 'membro:atualizado'; dados: { servidorId: number; membro: MembroPublico } }
  | { ev: 'membro:saiu'; dados: { servidorId: number; usuarioId: number } }
  | { ev: 'xp:ganho'; dados: { servidorId: number; xp: number; nivel: number; subiuNivel: boolean; ganho: number; missaoCompleta?: Selo } }
  | { ev: 'lfg:nova'; dados: LFG }
  | { ev: 'lfg:atualizada'; dados: LFG }
  | { ev: 'lfg:removida'; dados: { id: number; servidorId: number } }
  | { ev: 'dm:nova'; dados: DM }
  | { ev: 'denuncia:nova'; dados: { servidorId: number; id: number } };

export type EventHandler<E extends SocketEvento> = (evento: E) => void | Promise<void>;

// ------------------------------------------------------------------ utilitários de tipo
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type RequiredDeep<T> = {
  [P in keyof T]-?: T[P] extends object ? RequiredDeep<T[P]> : T[P];
};

export type ApenasTexto<T> = T extends string ? T : never;
export type NonNullableDeep<T> = { [P in keyof T]-?: NonNullableDeep<T[P]> };

// ------------------------------------------------------------------ client options
export interface ClientOptions {
  token: string;
  baseURL?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}
