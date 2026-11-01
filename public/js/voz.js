// AURA — voz: mesh WebRTC só de áudio, sinalização pelo socket.io.
(function () {
  'use strict';
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  let sock = null, local = null, canalId = null, mudo = false, surdo = false, falando = false;
  let ctx = null, timer = null, aoMudar = () => {};
  const pares = new Map(); // usuarioId → {pc, audio, pend}
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
      audio.srcObject = e.streams[0];
      if (espacial && ctx) { // Sala 3D: o som sai pelo PannerNode; o <audio> fica mudo (exigência do Chrome)
        audio.muted = true;
        const pan = ctx.createPanner();
        pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 1; pan.rolloffFactor = 1.5;
        const ganho = ctx.createGain();
        ganho.gain.value = surdo ? 0 : 1;
        ctx.createMediaStreamSource(e.streams[0]).connect(pan).connect(ganho).connect(ctx.destination);
        Object.assign(par, { pan, ganho });
        posicionar(uid);
      }
      audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => { if (e.candidate) sock.emit('voz:sinal', { para: uid, dados: { candidato: e.candidate } }); };
    const par = { pc, audio, pend: [] };
    pares.set(uid, par);
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
          prm.encodings = [{ ...(prm.encodings && prm.encodings[0]), maxBitrate: 6_000_000, maxFramerate: 60 }];
          p.telaSender.setParameters(prm).catch(() => {});
        }
      })
      .catch(() => {});
  }
  function pararTela() {
    if (!tela) return;
    tela.getTracks().forEach((t) => t.stop());
    tela = null;
    pares.forEach((p, uid) => { if (p.telaSender) { try { p.pc.removeTrack(p.telaSender); } catch (e) {} p.telaSender = null; renegociar(uid); } });
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
    get estado() { return { canalId, mudo, surdo, falando, espacial, compartilhando: !!tela }; },
    get telas() { return telas; },
    get minhaTela() { return tela; },
    async alternarTela() {
      if (tela) return pararTela();
      if (!canalId) throw new Error('Entra numa call pra compartilhar a tela.');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Seu navegador não compartilha tela.');
      try {
        tela = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } }, audio: false });
      } catch (e) { tela = null; return; } // cancelou a escolha
      const v = tela.getVideoTracks()[0];
      v.contentHint = 'motion';
      v.onended = pararTela; // botão "parar" do próprio navegador
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
      local.getAudioTracks().forEach((t) => { t.enabled = !mudo; });
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
      if (!mudo && surdo) { surdo = false; pares.forEach((p) => { if (p.ganho) p.ganho.gain.value = 1; else p.audio.muted = false; }); }
      if (local) local.getAudioTracks().forEach((t) => { t.enabled = !mudo; });
      if (mudo) falando = false;
      emitirEstado(); aoMudar();
    },
    alternarSurdo() {
      surdo = !surdo;
      mudo = surdo ? true : mudo;
      pares.forEach((p) => { if (p.ganho) p.ganho.gain.value = surdo ? 0 : 1; else p.audio.muted = surdo; });
      if (local) local.getAudioTracks().forEach((t) => { t.enabled = !mudo; });
      if (mudo) falando = false;
      emitirEstado(); aoMudar();
    },
  };
})();
