// "O que eu perdi?" — resumo heurístico (sem LLM) das mensagens de um canal.

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

function listarNomes(nomes) {
  if (nomes.length <= 1) return nomes[0] || '';
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  if (nomes.length === 3) return `${nomes[0]}, ${nomes[1]} e ${nomes[2]}`;
  return `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex que encontra "@usuario" como menção (não como parte de outra palavra/e-mail). */
export function regexMencao(usuario) {
  return new RegExp(`(^|[^a-z0-9_.@])@${escaparRegex(usuario)}(?![a-z0-9_]|\\.[a-z0-9_])`, 'i');
}

const textoDe = (m) => m.texto || m.transcricao || '';
const totalReacoes = (m) => (m.reacoes || []).reduce((s, r) => s + r.usuarios.length, 0);

/**
 * @param {object[]} mensagens  Mensagens serializadas, em ordem crescente.
 * @param {{id:number, usuario:string}} eu
 * @param {{recentes?:boolean}} opcoes  recentes = não havia não lidas, resumo das últimas.
 */
export function gerarResumo(mensagens, eu, { recentes = false } = {}) {
  const validas = mensagens.filter((m) => !m.sistema && textoDe(m).length > 0);
  const total = validas.length;

  const autores = new Map();
  validas.forEach((m, i) => {
    if (!m.autor) return;
    const a = autores.get(m.autor.id) || { nome: m.autor.nome, n: 0, primeiro: i };
    a.n++;
    autores.set(m.autor.id, a);
  });
  const participantes = [...autores.values()]
    .sort((a, b) => b.n - a.n || a.primeiro - b.primeiro)
    .map((a) => a.nome);

  const destaques = [...validas]
    .sort((a, b) => totalReacoes(b) - totalReacoes(a) || textoDe(b).length - textoDe(a).length || b.id - a.id)
    .slice(0, 3)
    .sort((a, b) => a.id - b.id);

  const todasPerguntas = validas.filter((m) => textoDe(m).includes('?'));
  const perguntas = todasPerguntas.slice(-3);

  const re = regexMencao(eu.usuario);
  const todasMencoes = validas.filter((m) => m.autor?.id !== eu.id && re.test(textoDe(m)));
  const mencoes = todasMencoes.slice(-10);

  let frase;
  if (total === 0) {
    frase = 'Nada por aqui ainda — o canal está em silêncio.';
  } else {
    const de = participantes.length ? ` de ${listarNomes(participantes)}` : '';
    const extras = [];
    if (todasPerguntas.length) extras.push(plural(todasPerguntas.length, 'pergunta', 'perguntas'));
    if (todasMencoes.length) extras.push(`${plural(todasMencoes.length, 'menção', 'menções')} a você`);
    const cauda = extras.length ? extras.join(' e ') : 'nenhuma pergunta nem menção a você';
    if (recentes) {
      const ultimas = total === 1 ? 'Última mensagem' : `Últimas ${total} mensagens`;
      frase = `Você está em dia! ${ultimas}${de} — ${cauda}`;
    } else {
      frase = `${plural(total, 'mensagem', 'mensagens')}${de} — ${cauda}`;
    }
  }

  return {
    total,
    participantes,
    destaques,
    perguntas,
    mencoes,
    frase,
    modo: recentes ? 'recentes' : 'nao-lidas',
  };
}
