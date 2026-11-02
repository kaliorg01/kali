// KALI — voz: mesh WebRTC só de áudio, sinalização pelo socket.io.
(function () {
  'use strict';
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  let sock = null, local = null, canalId = null, mudo = false, surdo = false, falando = false;
  let ctx = null, timer = null, aoMudar = () => {};
  const pares = new Map(); // usuarioId → {pc, audio, pend}
  // Volume por pessoa (0–2, salvo neste navegador) e "apertar para falar".
  let volumes = {};
  try { volumes = JSON.parse(localStorage.getItem('kali-volumes') || '{}') || {}; } catch (e) {}
  const volDe = (uid) => (typeof volumes[uid] === 'number' ? volumes[uid] : 1);
  const REFORCO = 2; // ganho base: as vozes chegavam baixas
  function aplicarVolume(uid) {
    const p = pares.get(uid); if (!p) return;
    const v = volDe(uid);
    if (p.audioTela) p.audioTela.muted = surdo;
    if (p.ganho) p.ganho.gain.value = surdo ? 0 : v * REFORCO;
    else { p.audio.volume = Math.min(1, v); p.audio.muted = surdo || v === 0; }
  }
  let ptt = false, apertando = false;
  try { ptt = localStorage.getItem('kali-ptt') === '1'; } catch (e) {}
  const aplicarTrack = () => { if (local) local.getAudioTracks().forEach((t) => { t.enabled = !mudo && (!ptt || apertando); }); };
  // Áudio HD grátis: Opus estéreo com bitrate alto + correção de perda de pacote.
  const hd = (d) => ({ type: d.type, sdp: d.sdp.replace(/a=fmtp:111 ([^\r\n]*)/, 'a=fmtp:111 $1;stereo=1;sprop-stereo=1;maxaveragebitrate=256000;useinbandfec=1') });

  const pedir = (ev, dados) => new Promise((res) =>
    sock.timeout(8000).emit(ev, dados, (err, r) => res(err ? { erro: 'Sem resposta do servidor.' } : r || {})));

  function emitirEstado() { if (canalId) sock.emit('voz:estado', { mudo, surdo, falando }); }

  function criarPar(uid, iniciar) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = surdo;
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    pc.ontrack = (e) => {
      if (e.track.kind === 'video') { // tela compartilhada de alguém
        const st = e.streams[0] || new MediaStream([e.track]);
        telas.set(uid, st);
        const some = () => { if (telas.get(uid) === st) { telas.delete(uid); aoMudar(); } };
        e.track.onended = some;
        e.track.onmute = some;
        e.track.onunmute = () => { telas.set(uid, st); aoMudar(); };
        aoMudar();
        return;
      }
      const st0 = e.streams[0] || new MediaStream([e.track]);
      if (par.micId && st0.id !== par.micId) { // som do PC vindo junto com a tela compartilhada
        if (!par.audioTela) { par.audioTela = new Audio(); par.audioTela.autoplay = true; }
        par.audioTela.srcObject = st0;
        par.audioTela.muted = surdo;
        par.audioTela.play().catch(() => {});
        return;
      }
      par.micId = st0.id;
      audio.srcObject = e.streams[0];
      if (espacial && ctx) { // Sala 3D: o som sai pelo PannerNode; o <audio> fica mudo (exigência do Chrome)
        audio.muted = true;
        const pan = ctx.createPanner();
        pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1; pan.rolloffFactor = 1.5;
        const ganho = ctx.createGain();
        ganho.gain.value = surdo ? 0 : 1;
        ctx.createMediaStreamSource(e.streams[0]).connect(pan).connect(ganho).connect(ctx.destination);
        Object.assign(par, { pan, ganho });
        ganho.gain.value = surdo ? 0 : volDe(uid) * REFORCO;
        posicionar(uid);
      } else if (ctx) { // call normal: compressor + reforço de volume (voz mais alta e por igual, sem estourar)
        audio.muted = true;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -28; comp.knee.value = 20; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        const ganho = ctx.createGain();
        ctx.createMediaStreamSource(e.streams[0]).connect(comp).connect(ganho).connect(ctx.destination);
        Object.assign(par, { ganho });
        aplicarVolume(uid);
      }
      if (!par.ganho) aplicarVolume(uid);
      audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => { if (e.candidate) sock.emit('voz:sinal', { para: uid, dados: { candidato: e.candidate } }); };
    const par = { pc, audio, pend: [] };
    pares.set(uid, par);
    if (tela) {
      par.telaSender = pc.addTrack(tela.getVideoTracks()[0], tela);
      const aT = tela.getAudioTracks()[0];
      if (aT) par.telaAudioSender = pc.addTrack(aT, tela);
      if (!iniciar) setTimeout(() => renegociar(uid), 1500); // quem chegou depois também recebe a tela
    }
    if (iniciar) {
      pc.createOffer()
        .then((o) => pc.setLocalDescription(hd(o)))
        .then(() => sock.emit('voz:sinal', { para: uid, dados: { sdp: pc.localDescription } }))
        .catch(() => {});
    }
    return par;
  }

  // ---- compartilhar tela: 1080p/60fps grátis, vai como track de vídeo extra em cada conexão ----
  let tela = null;
  let tipoVideo = null; // 'tela' ou 'camera'
  const telas = new Map(); // usuarioId → MediaStream da tela dele
  function renegociar(uid) {
    const p = pares.get(uid);
    if (!p) return;
    p.pc.createOffer()
      .then((o) => p.pc.setLocalDescription(hd(o)))
      .then(() => {
        sock.emit('voz:sinal', { para: uid, dados: { sdp: p.pc.localDescription } });
        if (p.telaSender) {
          const prm = p.telaSender.getParameters();
          // tela: segura a resolução (1080p nítido) e corta FPS se a rede apertar; câmera: equilibrado
          if (tipoVideo === 'tela') prm.degradationPreference = 'maintain-resolution';
          prm.encodings = [{ ...(prm.encodings && prm.encodings[0]), maxBitrate: tipoVideo === 'tela' ? 10_000_000 : 3_000_000, maxFramerate: tipoVideo === 'tela' ? 60 : 30, scaleResolutionDownBy: 1, priority: 'high', networkPriority: 'high' }];
          p.telaSender.setParameters(prm).catch(() => {});
        }
      })
      .catch(() => {});
  }
  function pararTela() {
    if (!tela) return;
    tela.getTracks().forEach((t) => t.stop());
    tela = null;
    pares.forEach((p, uid) => {
      if (!p.telaSender) return;
      try { p.pc.removeTrack(p.telaSender); } catch (e) {}
      if (p.telaAudioSender) { try { p.pc.removeTrack(p.telaAudioSender); } catch (e) {} p.telaAudioSender = null; }
      p.telaSender = null; renegociar(uid);
    });
    aoMudar();
  }

  let espacial = false, euId = null;
  const posicoes = new Map(); // usuarioId → {x, y} (0–1)
  function posicionar(uid) {
    const p = pares.get(uid), o = posicoes.get(uid), eu = posicoes.get(euId) || { x: 0.5, y: 0.5 };
    if (!p || !p.pan || !o) return;
    p.pan.positionX.value = (o.x - eu.x) * 10;
    p.pan.positionZ.value = (o.y - eu.y) * 10;
  }

  function fecharPar(uid) {
    const p = pares.get(uid);
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    p.audio.srcObject = null;
    if (p.audioTela) p.audioTela.srcObject = null;
    pares.delete(uid);
    if (telas.delete(uid)) aoMudar();
  }

  async function aoSinal(msg) {
    try {
      if (!canalId || !msg || !msg.dados) return;
      const { de, dados } = msg;
      let p = pares.get(de);
      if (dados.sdp) {
        if (!p) p = criarPar(de, false);
        await p.pc.setRemoteDescription(dados.sdp);
        if (dados.sdp.type === 'offer') {
          await p.pc.setLocalDescription(hd(await p.pc.createAnswer()));
          sock.emit('voz:sinal', { para: de, dados: { sdp: p.pc.localDescription } });
          // chegou alguém enquanto eu compartilho a tela: manda a tela pra ele também
          if (tela && !p.telaSender) { p.telaSender = p.pc.addTrack(tela.getVideoTracks()[0], tela); renegociar(de); }
        }
        for (const c of p.pend) await p.pc.addIceCandidate(c).catch(() => {});
        p.pend = [];
      } else if (dados.candidato && p) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(dados.candidato).catch(() => {});
        else p.pend.push(dados.candidato);
      }
    } catch (e) { /* par com problema: ignora */ }
  }

  function detector() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(local).connect(an);
      const buf = new Uint8Array(an.fftSize);
      timer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += ((v - 128) / 128) ** 2;
        const agora = !mudo && Math.sqrt(s / buf.length) > 0.04;
        if (agora !== falando) { falando = agora; emitirEstado(); aoMudar(); }
      }, 150);
    } catch (e) {}
  }

  function limpar() {
    if (tela) { tela.getTracks().forEach((t) => t.stop()); tela = null; }
    telas.clear();
    for (const uid of [...pares.keys()]) fecharPar(uid);
    if (local) local.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
    clearInterval(timer);
    local = null; ctx = null; timer = null; canalId = null; falando = false;
    aoMudar();
  }

  window.Voz = {
    get estado() { return { canalId, mudo, surdo, falando, espacial, compartilhando: !!tela && tipoVideo === 'tela', camera: !!tela && tipoVideo === 'camera' }; },
    get telas() { return telas; },
    volumeDe: volDe,
    volume(uid, v) {
      volumes[uid] = Math.max(0, Math.min(2, Number(v) || 0));
      try { localStorage.setItem('kali-volumes', JSON.stringify(volumes)); } catch (e) {}
      aplicarVolume(uid);
    },
    get ptt() { return ptt; },
    definirPTT(on) { ptt = !!on; apertando = false; try { localStorage.setItem('kali-ptt', ptt ? '1' : ''); } catch (e) {} aplicarTrack(); aoMudar(); },
    apertar(b) { if (!ptt || apertando === !!b) return; apertando = !!b; aplicarTrack(); aoMudar(); },
    get minhaTela() { return tela; },
    async alternarTela() {
      if (tela) return pararTela();
      if (!canalId) throw new Error('Entra numa call pra compartilhar a tela.');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Seu navegador não compartilha tela.');
      try {
        // audio: som do PC/aba junto (o navegador mostra a caixinha "Compartilhar áudio")
        tela = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'include' });
      } catch (e) { tela = null; return; } // cancelou a escolha
      const v = tela.getVideoTracks()[0];
      v.contentHint = 'detail'; // prioriza nitidez (texto e jogo em 1080p) em vez de baixar a resolução
      v.onended = pararTela; // botão "parar" do próprio navegador
      tipoVideo = 'tela';
      const somPC = tela.getAudioTracks()[0];
      pares.forEach((p, uid) => {
        p.telaSender = p.pc.addTrack(v, tela);
        if (somPC) p.telaAudioSender = p.pc.addTrack(somPC, tela);
        renegociar(uid);
      });
      aoMudar();
    },
    // Câmera: usa o mesmo canal de vídeo da tela (um vídeo por pessoa: câmera OU tela).
    async alternarCamera() {
      if (tela && tipoVideo === 'camera') return pararTela();
      if (!canalId) throw new Error('Entra numa call pra ligar a câmera.');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Seu navegador não libera câmera.');
      if (tela) pararTela();
      try {
        tela = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      } catch (e) { tela = null; throw new Error('Não deu pra abrir a câmera (permissão negada ou sem câmera).'); }
      const v = tela.getVideoTracks()[0];
      v.contentHint = 'motion';
      v.onended = pararTela;
      tipoVideo = 'camera';
      pares.forEach((p, uid) => { p.telaSender = p.pc.addTrack(v, tela); renegociar(uid); });
      aoMudar();
    },
    posicoes(membros, eu) {
      euId = eu;
      for (const m of membros || []) if (typeof m.x === 'number') posicoes.set(m.usuarioId, { x: m.x, y: m.y });
      pares.forEach((_, uid) => posicionar(uid));
    },
    mover(x, y) {
      if (!canalId || !espacial) return;
      posicoes.set(euId, { x, y });
      pares.forEach((_, uid) => posicionar(uid));
      sock.emit('voz:posicao', { x, y });
    },
    init(s, cb) {
      sock = s;
      if (cb) aoMudar = cb;
      s.on('voz:sinal', aoSinal);
      s.on('voz:par-saiu', (d) => d && fecharPar(d.usuarioId));
      s.on('disconnect', () => { if (canalId) limpar(); });
    },
    async entrar(id, salaEspacial) {
      if (canalId === id) return;
      espacial = !!salaEspacial;
      posicoes.clear();
      if (canalId) this.sair();
      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 2, sampleRate: 48000 } });
      } catch (e) {
        throw new Error('Não consegui acessar seu microfone. Libera a permissão no navegador.');
      }
      const r = await pedir('voz:entrar', { canalId: id });
      if (r.erro) { local.getTracks().forEach((t) => t.stop()); local = null; throw new Error(r.erro); }
      canalId = id;
      aplicarTrack();
      detector();
      for (const uid of r.pares || []) criarPar(uid, true);
      emitirEstado();
      aoMudar();
    },
    sair() {
      if (!canalId) return;
      sock.emit('voz:sair', {});
      limpar();
    },
    alternarMudo() {
      mudo = !mudo;
      if (!mudo && surdo) { surdo = false; pares.forEach((p, uid) => aplicarVolume(uid)); }
      aplicarTrack();
      if (mudo) falando = false;
      emitirEstado(); aoMudar();
    },
    alternarSurdo() {
      surdo = !surdo;
      mudo = surdo ? true : mudo;
      pares.forEach((p, uid) => aplicarVolume(uid));
      if (local) local.getAudioTracks().forEach((t) => { t.enabled = !mudo; });
      if (mudo) falando = false;
      emitirEstado(); aoMudar();
    },
  };
})();
