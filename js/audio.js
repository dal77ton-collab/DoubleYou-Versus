(function (g) {
  let ctx, muted = false, musicGain, sfxGain, musicOsc = [];

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.gain.value = 0.06;
      sfxGain.gain.value = 0.18;
      musicGain.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(freq, dur, type, vol) {
    if (muted) return;
    const c = ac();
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    gn.gain.setValueAtTime((vol || 0.2) * sfxGain.gain.value * 4, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(gn);
    gn.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function hit() { beep(180, 0.08, "sawtooth", 0.25); beep(90, 0.1, "triangle", 0.15); }
  function punch() { beep(220, 0.05, "square", 0.2); }
  function whoosh() { beep(420, 0.12, "sine", 0.12); }
  function fire() {
    if (muted) return;
    const c = ac();
    const n = c.createBuffer(1, c.sampleRate * 0.28, c.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.55 + 0.45 * Math.sin(i * 0.03));
    }
    const src = c.createBufferSource();
    src.buffer = n;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 780;
    bp.Q.value = 0.7;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.22, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
    src.connect(bp); bp.connect(gn); gn.connect(c.destination);
    src.start();
    beep(140, 0.16, "sawtooth", 0.16);
    beep(90, 0.2, "triangle", 0.1);
  }
  function fireSizzle() {
    if (muted) return;
    const c = ac();
    const n = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = n;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.16, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    src.connect(hp); hp.connect(gn); gn.connect(c.destination);
    src.start();
    beep(210, 0.08, "sawtooth", 0.1);
  }
  function fireBurst() {
    fire();
    setTimeout(() => { if (!muted) fireSizzle(); }, 70);
    setTimeout(() => { if (!muted) fire(); }, 140);
  }
  function ultraVoice(id) {
    try {
      const a = new Audio("assets/audio/ultra/" + id + ".m4a");
      a.volume = 1;
      a.play().catch(function () {});
    } catch (e) {}
  }
  function ult() {
    beep(110, 0.4, "sawtooth", 0.3);
    setTimeout(() => beep(220, 0.3, "square", 0.25), 80);
    setTimeout(() => beep(440, 0.25, "triangle", 0.2), 160);
  }
  function ui() { beep(660, 0.06, "square", 0.12); }
  function win() { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 120); setTimeout(() => beep(784, 0.3), 240); }
  function coin() { beep(880, 0.08, "sine"); setTimeout(() => beep(1320, 0.1, "sine"), 70); }
  function announce() { beep(300, 0.12, "triangle"); }
  function logoSting() {
    if (muted) return;
    const c = ac();
    const now = c.currentTime;
    const notes = [196, 247, 311, 392, 494];
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      const gn = c.createGain();
      o.type = i % 2 ? "triangle" : "sawtooth";
      o.frequency.setValueAtTime(f, now);
      gn.gain.setValueAtTime(0.0001, now);
      gn.gain.exponentialRampToValueAtTime(0.09 - i * 0.01, now + 0.03 + i * 0.04);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 + i * 0.05);
      o.connect(gn); gn.connect(c.destination);
      o.start(now);
      o.stop(now + 0.7 + i * 0.04);
    });
    beep(88, 0.28, "sine", 0.22);
    setTimeout(() => beep(1320, 0.08, "sine", 0.08), 180);
  }

  let musicOn = false;
  function startMusic(mode) {
    stopMusic();
    if (muted) return;
    const c = ac();
    musicOn = true;
    const base = mode === "fight" ? [55, 82, 110] : [98, 147, 196];
    base.forEach((f, i) => {
      const o = c.createOscillator();
      const gn = c.createGain();
      o.type = i === 0 ? "sawtooth" : "sine";
      o.frequency.value = f;
      gn.gain.value = 0.015 + i * 0.006;
      o.connect(gn); gn.connect(musicGain);
      o.start();
      musicOsc.push(o);
    });
  }
  function stopMusic() {
    musicOsc.forEach((o) => { try { o.stop(); } catch (e) {} });
    musicOsc = [];
    musicOn = false;
  }
  function setMuted(v) { muted = v; if (v) stopMusic(); }
  function isMuted() { return muted; }

  g.DV = g.DV || {};
  g.DV.audio = { hit, punch, whoosh, fire, fireSizzle, fireBurst, ult, ultraVoice, ui, win, coin, announce, logoSting, startMusic, stopMusic, setMuted, isMuted, unlock: ac };
})(window);
