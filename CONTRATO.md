# AURA — contrato v1

App de comunidade estilo Discord, 100% em português (BR). Visual = tema Nebulosa da ORYON (referência: `../layout.html`).

## Stack
- Node 24, ESM (`"type":"module"`). Dependências: só `express` e `socket.io` (+ `socket.io-client` em devDependencies para testes).
- Banco: `node:sqlite` (DatabaseSync), arquivo `dados/aura.db` (criar pasta se faltar). Sem ORM.
- Senha: `crypto.scrypt` com salt aleatório, comparação com `timingSafeEqual`.
- Sessão: token aleatório (32 bytes hex) na tabela `sessoes`, cookie `aura_sid` (httpOnly, sameSite=lax, path=/, 30 dias).
- Porta: `process.env.PORT || 3333`. `npm start` = `node server.js`. `npm test` = `node scripts/teste.js`.
- Frontend: HTML/CSS/JS puro em `public/`, sem build. Cliente socket em `/socket.io/socket.io.js`.

## Arquivos
```
server.js            bootstrap express + socket.io, serve public/
src/db.js            schema + funções de consulta
src/auth.js          hash, sessões, middleware exigirLogin, auth do socket (cookie do handshake)
src/rotas.js         REST /api
src/tempo-real.js    eventos socket.io, presença, voz (sinalização)
src/resumo.js        "O que eu perdi?" (heurístico, sem LLM)
public/entrar.html   login/cadastro
public/index.html    app
public/css/app.css
public/js/app.js     estado, render, REST, socket
public/js/voz.js     WebRTC mesh de áudio
scripts/teste.js     teste de integração (REST + socket.io-client)
```

## Regras
- Nomes de usuário: `^[a-z0-9_.]{3,20}$` (minúsculo), únicos. Senha ≥ 6. `nome` de exibição ≤ 32.
- Servidor: nome 2–40. Canal: nome `^[a-z0-9-]{1,30}$` para texto; voz aceita 1–30 qualquer caractere. Tipos: `texto` | `voz`.
- Ao criar servidor: canais `geral` (texto) e `Resenha` (voz); dono vira membro; convite = 8 chars [A-Za-z0-9] único.
- Mensagem: 1–2000 chars após trim. Só autor edita; autor ou dono do servidor apaga.
- Toda ação checa: logado + membro do servidor do canal (ou participante da DM). Dono-only: criar/apagar canal, renomear/apagar servidor.
- Limite: 5 mensagens / 3 s por usuário → `{erro:"Calma! Muitas mensagens."}`.
- Erros REST: status 4xx + `{erro:"texto em pt-BR"}`. Socket: ack `{erro}`.
- Cores de avatar: sorteada de uma paleta ao cadastrar (`#7c5cff #c056f5 #ff9a3c #3ee6a8 #1d4ed8 #c2410c #0e7490 #db2777`).
- XSS: o front NUNCA põe texto de usuário via innerHTML; usa textContent/createElement. Menções `@usuario` e links são montados em nós DOM.

## Objetos
```
Usuario  {id, usuario, nome, cor, status, statusTexto}       status: online|ausente|ocupado|offline
Canal    {id, servidorId|null, nome, tipo, posicao}
Servidor {id, nome, sigla, donoId, convite, canais:[Canal]}   sigla = iniciais (até 2)
Membro   Usuario + {dono:boolean}
Mensagem {id, canalId, autor:Usuario-sem-status, texto, criadoEm(ms), editadoEm|null,
          reacoes:[{emoji, usuarios:[id]}]}
DM       {canalId, outro:Usuario, ultima:Mensagem|null, naoLidos}
```
Presença `offline` = sem socket conectado; status escolhido (online/ausente/ocupado) persiste no usuário.

## REST (JSON, prefixo /api)
| método | rota | corpo → resposta |
|---|---|---|
| POST | /registrar | {usuario, senha, nome?} → Usuario (+cookie) |
| POST | /entrar | {usuario, senha} → Usuario (+cookie) |
| POST | /sair | → {ok:true} |
| GET | /eu | → Usuario (401 se não logado) |
| PATCH | /eu | {nome?, cor?, statusTexto?} → Usuario |
| GET | /servidores | → [Servidor & {naoLidos:{[canalId]:n}}] |
| POST | /servidores | {nome} → Servidor |
| PATCH | /servidores/:id | {nome} → Servidor (dono) |
| DELETE | /servidores/:id | → {ok} (dono) |
| POST | /convites/:codigo | → Servidor (entra) |
| POST | /servidores/:id/sair | → {ok} (dono não pode sair) |
| GET | /servidores/:id/membros | → [Membro] |
| POST | /servidores/:id/canais | {nome, tipo} → Canal (dono) |
| DELETE | /canais/:id | → {ok} (dono) |
| GET | /canais/:id/mensagens?antes=&limite= | → [Mensagem] ordem crescente, limite ≤ 100 (padrão 50) |
| POST | /canais/:id/lido | → {ok} marca última mensagem como lida |
| GET | /canais/:id/resumo | → Resumo |
| GET | /dms | → [DM] |
| POST | /dms | {usuario} → DM (cria ou reaproveita) |

Resumo (não lidas do canal desde `lido` do usuário; se 0, últimas 30):
`{total, participantes:[nome], destaques:[Mensagem] (até 3, mais reações/mais longas), perguntas:[Mensagem] (com "?", até 3), mencoes:[Mensagem] (com @meuusuario), frase:"texto curto em pt-BR"}`

## Socket.io
Auth pelo cookie `aura_sid` no handshake; sem sessão → `next(new Error("nao-autorizado"))`.
Ao conectar o servidor coloca o socket nas salas `u:<usuarioId>`, `s:<servidorId>` (cada servidor) e `c:<canalDmId>` (cada DM). Ao entrar/criar servidor via REST, sockets do usuário entram na sala nova.

Cliente → servidor (todos com ack `(resposta)`; erro = `{erro}`):
- `msg:enviar` {canalId, texto} → {ok, msg}
- `msg:editar` {id, texto} → {ok}
- `msg:apagar` {id} → {ok}
- `msg:reagir` {id, emoji} (alterna) → {ok}
- `digitando` {canalId}
- `presenca` {status} (online|ausente|ocupado)
- `voz:entrar` {canalId} → {ok, pares:[usuarioId]} (sai de outra voz antes)
- `voz:sair` {}
- `voz:sinal` {para, dados} (repassa SDP/ICE só se ambos no mesmo canal de voz)
- `voz:estado` {mudo, surdo, falando}

Servidor → cliente:
- `msg:nova` Mensagem · `msg:editada` Mensagem · `msg:apagada` {id, canalId} · `msg:reacoes` {id, canalId, reacoes}
  (canal de servidor → sala `s:<id>`; DM → `c:<canalId>`)
- `digitando` {canalId, usuario:{id, nome}}
- `presenca` {usuarioId, status}
- `membro:entrou` {servidorId, membro} · `membro:saiu` {servidorId, usuarioId}
- `canal:novo` Canal · `canal:apagado` {id, servidorId}
- `servidor:atualizado` Servidor · `servidor:apagado` {id}
- `dm:nova` DM (para o outro participante ao criar DM)
- `voz:membros` {canalId, membros:[{usuarioId, nome, cor, mudo, surdo, falando}]} (sala do servidor; também enviado a quem conecta para cada canal de voz ativo dos seus servidores)
- `voz:sinal` {de, dados}
- `voz:par-saiu` {usuarioId}

Desconectar o último socket do usuário → sai da voz e emite `presenca` offline.

## Voz (public/js/voz.js)
Mesh WebRTC só áudio, STUN `stun:stun.l.google.com:19302`. Quem entra recebe `pares` e cria offer para cada um; os outros respondem. `dados` = `{sdp}` ou `{candidato}`. Mudo = desliga track; surdo = muta todos os <audio> remotos (+ mudo). "Falando" = AnalyserNode com limiar, emite `voz:estado` só quando muda.

## UI (public/)
Layout de 4 colunas do `../layout.html`: trilho de servidores (logo ∞ = DMs, servidores com sigla, `+` criar/entrar por convite), barra de canais (texto/voz, usuários na voz com anel verde ao falar, rodapé com usuário + mic + fone + tema), chat (topo com # canal, botão "✦ O que eu perdi?", busca local, membros), painel de membros (online/ausente/offline agrupados).
Chat: mensagens agrupadas por autor (≤5 min), hora, editado, reações (clicar alterna; botão 😀 com 8 emojis rápidos), editar/apagar no hover, "X está digitando…", carregar mais ao rolar ao topo, divisória "Novas mensagens", menções em destaque, Enter envia / Shift+Enter quebra linha.
Badges de não lidos por canal e servidor. Modais (criar servidor, entrar por convite, criar canal, copiar convite, perfil/status) no estilo cartão Oryon. Toasts para erros. Tema escuro Nebulosa (padrão) e claro, salvo em localStorage com try/catch. Responsivo: <760px mostra uma coluna por vez.

## Novidades v1 (diferenciais — implementar depois do núcleo acima)
1. **O que eu perdi?** — já descrito (Resumo).
2. **Missões, XP e selos** — tabela `xp(usuario_id, servidor_id, xp, nivel)` e `progresso_missao(usuario_id, servidor_id, semana, chave, valor)`. Ganha XP: mensagem +5 (máx 1/10s), reação recebida +2, minuto em voz +3, entrar no Assistir Junto +10. Nível = floor(sqrt(xp/50))+1. Missões semanais fixas: `mensagens` (enviar 30), `voz` (30 min em voz), `reacoes` (receber 10), `assistir` (2 sessões). Completar → selo (`selos(usuario_id, servidor_id, chave, ganhoEm)`) + 250 XP. REST `GET /servidores/:id/missoes` → `{xp, nivel, proximoNivelXp, missoes:[{chave, titulo, meta, valor, completa}], selos:[{chave, titulo, emoji}]}`; `GET /servidores/:id/ranking` → top 10 `[{usuario, xp, nivel}]`. Evento `xp:ganho` {servidorId, xp, nivel, subiuNivel, missaoCompleta?} para `u:<id>`. UI: cartão "🏆 Missão da semana" no topo do painel de membros (barra de progresso com gradiente), nível ao lado do nome na lista de membros, modal "Ranking", toast/confete ao subir de nível.
3. **Modo foco** — status extra `foco` com `focoAte` (ms). `PATCH /eu {focoMinutos}` (15/30/60/120, 0 desliga). Em foco: sem toasts/sons, badges continuam; outros veem "⛔ modo foco até HH:MM" e um aviso ao mencionar. Expira sozinho (servidor checa ao ler; emite `presenca` quando expira).
4. **Assistir Junto** — tipo de canal `assistir`. Estado em memória por canal `{url, tocando, tempo, atualizadoEm, hostId, espectadores}`. Eventos: `assistir:entrar` {canalId} → {ok, estado}, `assistir:sair`, `assistir:definir` {canalId, url} (YouTube `youtube.com/watch?v=`/`youtu.be/` ou link direto .mp4/.webm; validar), `assistir:controle` {canalId, acao:'play'|'pause'|'seek', tempo}; servidor emite `assistir:estado` para a sala `a:<canalId>`. Cliente: YouTube via IFrame API (`https://www.youtube.com/iframe_api`, única exceção a "sem CDN"), vídeo direto via `<video>`; sincroniza (corrige se diferença > 1.5s). Chat do canal ao lado do player. Cartão no #geral avisando "X começou Assistir Junto" (mensagem de sistema: `autor` = null, `sistema:true`).
5. **Sala 3D (áudio espacial)** — canal de voz com `espacial=1` (checkbox ao criar canal de voz). UI: mapa 2D (canvas/divs) com avatares arrastáveis; posição via `voz:posicao` {x, y} (0–1) → repassada em `voz:membros` (campos `x, y`). Áudio remoto passa por `MediaStreamSource → PannerNode (HRTF, distanceModel 'inverse')` conforme a posição relativa; manter também um `<audio muted>` com o stream (exigência do Chrome).
6. **Mensagem de voz com transcrição** — botão 🎙 no compositor: grava com MediaRecorder (máx 60s) e, ao mesmo tempo, transcreve com Web Speech API (`webkitSpeechRecognition`, lang pt-BR, se existir). Upload `POST /canais/:id/audio` (corpo binário `audio/webm`, máx 2 MB, query `duracao`, `transcricao`) → salva em `dados/audios/<id>.webm`, cria mensagem com `audio:{url, duracao}` e `transcricao`. `GET /audios/:id` só para membros do canal. UI: player compacto + "🎙 transcrito pela IA" com o texto.
7. **Mensagens temporárias** — no compositor, ⏱ escolhe 1 min / 10 min / 1 h / 24 h; `msg:enviar` aceita `expiraEm` (segundos). Servidor apaga ao expirar (timer + varredura a cada 30 s e no boot) e emite `msg:apagada`. UI mostra ⏱ com contagem regressiva.

Campos novos em Mensagem: `sistema?:boolean`, `audio?:{url,duracao}`, `transcricao?:string`, `expiraEm?:ms`. Canal ganha `espacial?:boolean`; tipo aceita `assistir`. Usuario ganha `focoAte?:ms`.

### Para depois (não implementar agora)
Clipes automáticos, bots com IA sem código, loja de temas, criptografia ponta a ponta, app de celular.

### v2 — escolhidas pelo dono (NÃO implementar agora)
1. **Rádio da call** — música sincronizada na sala de voz; qualquer pessoa da call adiciona música na fila (sem votação), toca em ordem.
2. **Procurando grupo** — post "preciso de duo, Valorant, prata" com filtro por jogo/rank; quem topar entra direto na call.
3. **Perfil vitrine** — banner animado, jogos favoritos, selos, música que está ouvindo.
4. **Loja de cosméticos** — molduras de avatar e efeitos no nome; parte compra com XP, parte com assinatura **AURA+**.
5. **Moderação automática (IA)** — bloqueia golpe de link, spam e ofensa, nível ajustável por servidor.
6. **Busca perguntando (IA)** — "quando falaram do torneio?" acha a conversa.
7. **"Me lembra disso"** — lembrete a partir de qualquer mensagem.
8. **Tema por servidor** — cada servidor com sua cor, gradiente e fundo.
9. **Truco e minigames na call** — truco, quiz e "adivinha a música" dentro da call.
10. **Modo coach** — desenhar por cima da tela de quem está transmitindo.
11. **Apoio por Pix** — assinatura de servidor pra apoiar criadores.
12. **Pomodoro em grupo** — sala de estudo com timer compartilhado.
13. **Boas-vindas com IA** — apresenta o servidor e as regras pra quem acabou de chegar.
14. **Importar do Discord** — traz canais e cargos de um servidor com um clique.
15. **Integração Steam e Riot** — mostra rank e partida ao vivo, botão pra entrar no lobby.
16. **Modo internet fraca** — funciona liso em 4G ruim.
17. **Legenda ao vivo** — fala da call vira texto em tempo real (acessibilidade).
18. **Tira-ruído com IA** — corta teclado, ventilador, cachorro.
19. **Overlay no jogo** — mostra quem está falando por cima do jogo.
20. **Torneios automáticos** — inscrição, chaveamento, placar, prêmio em XP.
21. **Guerra de servidores** — desafio semanal servidor x servidor, ranking geral.
22. **Cargos por conquista** — cargo automático ao bater nível/selo.
23. **Selos lendários** — conquistas raras com animação especial.
24. **Aviso de live** — avisa quando streamer entra ao vivo (Twitch/YouTube/TikTok).
25. **Widget pra stream/site** — mostra quem está online no servidor.
26. **Stories** — status com foto/vídeo que some em 24 h.
27. **Mural "jogando agora"** — o que os amigos estão jogando, botão pra pedir pra entrar.
28. **Convite bonito** — cartão animado pra mandar no WhatsApp/Instagram.
29. **Comando de voz** — "AURA, toca tal música", "AURA, muta o Rafa".
30. **Assistente do servidor (IA)** — responde dúvidas usando regras e histórico do servidor.
31. **Tela 1080p 60fps grátis** — compartilhar tela em alta sem assinatura.
32. **Arquivos grandes grátis** — até 500 MB.
33. **Emojis do servidor em qualquer lugar** — sem assinatura.
34. **Call flutuante** — mini janela por cima de tudo (PC e celular).
35. **Anti-invasão** — proteção contra raid de bots + registro das ações dos moderadores.
36. **Canal do futebol** — placar ao vivo e aviso de gol (Brasileirão, Libertadores, Copa).
37. **Várias telas na call** — assistir 2+ transmissões ao mesmo tempo em grade.
38. **Controle remoto** — dar controle do PC a outra pessoa; uso principal: adm verificar se o jogador está usando xit/hack. Só com consentimento explícito, aviso visível o tempo todo, encerrar a qualquer momento e registro no log de moderação.
39. **Modo streamer** — esconde e-mail, convites e DMs enquanto está ao vivo.
40. **Selo de verificado** — selo oficial pra criadores, marcas e times.
41. **GIFs e memes BR** — busca de GIFs/memes direto no chat.
42. **Login por QR code** — entrar no PC escaneando com o celular.
43. **Denúncia com prova** — print/clipe anexado; cai numa fila pros adms analisarem.
44. **Lista de golpistas** — banido por golpe fica marcado em todos os servidores que aderirem.
45. **Conta verificada por celular** — opção do servidor pra barrar contas fake.
46. **Tickets de suporte** — canal privado jogador ↔ staff.
47. **Whitelist com formulário** — entrada no servidor só após formulário aprovado por adm.
48. **Ficha de personagem e dados virtuais** — pra RP.
49. **Ponte com jogos** — todos os jogos (FiveM, Minecraft e outros); o app identifica o jogo sozinho, mostra quem está online e liga o chat do jogo ao do app.
50. **Fila de atendimento** — opcional: o dono do servidor ativa se quiser; a pessoa espera a vez pra entrar na call de suporte.
51. **Ideias da comunidade com votação** — no lugar da loja de bots: usuários sugerem recursos (e o dono do app também solta ideias), a comunidade vota e a mais votada entra no app.
52. **Fecha o time** — "falta 2 pro 5x5"; quando completa, o app chama todo mundo.
53. **Ranking por jogo** — quem tem mais horas e melhor rank no servidor, por jogo.
54. **Desafio 1v1** — desafia um amigo; quem ganha leva XP.
55. **Tribunal da staff** — adms votam juntos antes de banir.
56. **Backup do servidor** — salva canais, cargos e configurações; restaura se der ruim.
57. **Modelos prontos** — criar servidor de RP, FPS, estudo ou amigos já montado.
58. **Indique e ganhe** — quem convida ganha cosméticos e XP.
59. **Parceria entre servidores** — um divulga o outro.
60. **Novidades do app** — página dentro do app com o que chegou, ligada às Ideias da comunidade (item 51).
61. **Mensagem com efeito** — confete, explosão, fogo.
62. **Cargo com cor animada** — gradiente brilhando no nome.
63. **Sons de aviso personalizados** — com opções BR.
64. **Feed de clipes curtos** — vídeos verticais da galera, estilo TikTok, dentro do servidor.
65. **Vinheta de entrada** — som curto toca quando você entra na call.
66. **Moderação de voz com IA** — detecta xingamento pesado e assédio na call.
67. **Wiki do servidor** — regras, história e lore editáveis pela staff.
68. **Mesa de RPG virtual** — mapa, fichas e peças pra jogar RPG na call.
69. **Metas coletivas** — o servidor inteiro ganha selo ao bater uma meta junto.
70. **Canal com senha** — área secreta dentro do servidor.
71. **Peneira** — times procurando jogador e jogadores procurando time.
72. **Cartão de jogador** — estatísticas reais do jogo no perfil (K/D, taxa de vitória, partidas).
73. **Passe de temporada** — recompensas por temporada desbloqueadas com XP.
74. **Filtro de imagem com IA** — bloqueia nudez e conteúdo violento antes de aparecer.
75. **Alerta geral** — aviso urgente da staff que notifica todo mundo.
76. **Editor de print** — recortar, desenhar e borrar dados pessoais antes de mandar.
77. **Avisa quando ficar online** — notifica quando um amigo específico entra.
78. **Áudio em 1,5x e 2x** — acelerar mensagem de voz, igual WhatsApp.
79. **Áudio HD grátis** — estéreo em alta qualidade na call, sem pagar.
80. **Palco DJ** — sala de baixa latência pra DJ e banda tocarem ao vivo.
81. **AFK inteligente** — percebe que saiu do PC, muda o status e muta o microfone.
82. **Aniversários** — parabéns automático no dia, com destaque no servidor.
83. **Atalhos globais** — mutar e sair da call por tecla, mesmo com o jogo em tela cheia.
84. **Links na bio** — redes sociais e link da live no perfil.
85. **Presentear** — dar cosmético ou AURA+ pra um amigo.
86. **Encaminhar mensagem** — pra outro canal, servidor ou DM.
87. **Postar clipe no TikTok e no Instagram** — direto do app.
88. **Layout personalizável** — mover painéis, modo compacto.
89. **Acessibilidade** — alto contraste, fonte grande, leitor de tela.
90. **Pasta compartilhada** — arquivos do servidor num lugar só.
