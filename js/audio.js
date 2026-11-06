/* Музыка и звуки. Всё синтезируется Web Audio API прямо в браузере, без звуковых файлов.
   Музыка: зацикленные пьесы из музыкальной шкатулки, пэда, баса и лёгких барабанов.
   Мелодии генерируются один раз с фиксированным зерном, поэтому каждая пьеса узнаваема.
   Звук включается после первого касания экрана (так требуют браузеры). */
(function () {
  const KEY = 'last-ray-audio';
  // громкость музыки и звуков 0..1; ноль значит «выключено»
  let prefs = { musicVol: 1, sfxVol: 1 };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    prefs.musicVol = typeof s.musicVol === 'number' ? s.musicVol : s.music === false ? 0 : 1;
    prefs.sfxVol = typeof s.sfxVol === 'number' ? s.sfxVol : s.sfx === false ? 0 : 1;
  } catch (e) { /* хранилище недоступно */ }
  const MUSIC_GAIN = 0.5, SFX_GAIN = 0.55;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* хранилище недоступно */ } };

  let ctx = null, master, musicBus, sfxBus, reverbIn, noiseBuf;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_GAIN * prefs.musicVol; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_GAIN * prefs.sfxVol; sfxBus.connect(master);
    // реверберация из сгенерированного импульса: «зимний воздух»
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = imp;
    const rg = ctx.createGain(); rg.gain.value = 0.32;
    conv.connect(rg); rg.connect(master);
    reverbIn = conv;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }

  /* ---------- Базовые голоса ---------- */
  function env(g, t, a, peak, dec, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + dec);
  }
  function osc(type, f, t, dur, peak, bus, { a = 0.005, rev = 0, f2 = null, detune = 0 } = {}) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, a, peak, dur);
    o.connect(g); g.connect(bus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(reverbIn); }
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  function noise(t, dur, peak, bus, { type = 'bandpass', f = 1000, f2 = null, q = 1, a = 0.003, rev = 0 } = {}) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    n.connect(fl); fl.connect(g); g.connect(bus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(reverbIn); }
    n.start(t, Math.random() * 0.5); n.stop(t + a + dur + 0.05);
  }

  /* Инструменты музыки */
  const inst = {
    box(m, t, dur, v = 1) { // музыкальная шкатулка
      const f = mtof(m);
      osc('sine', f, t, Math.max(0.6, dur * 2.2), 0.22 * v, musicBus, { rev: 0.6 });
      osc('sine', f * 3.01, t, 0.25, 0.04 * v, musicBus, { rev: 0.4 });
    },
    bell(m, t, dur, v = 1) {
      const f = mtof(m);
      osc('sine', f, t, Math.max(1, dur * 3), 0.16 * v, musicBus, { rev: 0.8 });
      osc('sine', f * 2.76, t, 0.6, 0.05 * v, musicBus, { rev: 0.6 });
      osc('triangle', f * 5.4, t, 0.18, 0.02 * v, musicBus, { rev: 0.5 });
    },
    pluck(m, t, dur, v = 1) {
      osc('triangle', mtof(m), t, Math.max(0.2, dur), 0.12 * v, musicBus, { rev: 0.25 });
    },
    bass(m, t, dur, v = 1) {
      osc('triangle', mtof(m), t, dur * 0.9, 0.3 * v, musicBus, { a: 0.01 });
      osc('sine', mtof(m - 12), t, dur * 0.9, 0.18 * v, musicBus, { a: 0.01 });
    },
    pad(ms, t, dur, v = 1) {
      for (const m of ms) {
        for (const dt of [-7, 7]) {
          const o = ctx.createOscillator(); const g = ctx.createGain(); const fl = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
          fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.4;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.022 * v, t + dur * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(fl); fl.connect(g); g.connect(musicBus);
          const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(reverbIn);
          o.start(t); o.stop(t + dur + 0.05);
        }
      }
    },
    kick(t, v = 1) { osc('sine', 130, t, 0.22, 0.55 * v, musicBus, { f2: 42 }); },
    snare(t, v = 1) { noise(t, 0.14, 0.18 * v, musicBus, { type: 'highpass', f: 1400, rev: 0.25 }); osc('triangle', 190, t, 0.08, 0.12 * v, musicBus); },
    hat(t, v = 1) { noise(t, 0.04, 0.07 * v, musicBus, { type: 'highpass', f: 7000 }); },
    shaker(t, v = 1) { noise(t, 0.06, 0.04 * v, musicBus, { type: 'bandpass', f: 5000, q: 2 }); },
  };

  /* ---------- Пьесы ---------- */
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TRI = { M: [0, 4, 7], m: [0, 3, 7] };

  /* Мелодия на 16 шестнадцатых в такте: опорные доли берут звук аккорда, остальное — шаги по ладу */
  function makeMelody(def) {
    const r = rng(def.seed);
    const notes = [];
    let cur = def.key + 12 + def.scale[2];
    const scaleNotes = [];
    for (let o = 0; o < 3; o++) for (const s of def.scale) scaleNotes.push(def.key + o * 12 + s);
    const lo = def.key + 7, hi = def.key + 26;
    def.chords.forEach(([root, q]) => {
      for (let i = 0; i < 16; i++) {
        const onGrid = i % (def.melodyGrid || 2) === 0;
        const strong = i % 8 === 0;
        if (!onGrid || (!strong && r() > def.density)) { notes.push(null); continue; }
        if (strong) {
          const tones = TRI[q].map((x) => root + x + 12);
          const cands = [];
          for (const tn of tones) for (const o of [0, 12, -12]) if (tn + o >= lo && tn + o <= hi) cands.push(tn + o);
          cands.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
          cur = cands[Math.floor(r() * Math.min(2, cands.length))];
        } else {
          let idx = scaleNotes.indexOf(cur);
          if (idx < 0) idx = scaleNotes.findIndex((n) => n >= cur);
          idx += Math.floor(r() * 5) - 2;
          idx = Math.max(0, Math.min(scaleNotes.length - 1, idx));
          cur = Math.max(lo, Math.min(hi, scaleNotes[idx]));
        }
        notes.push(cur);
      }
    });
    return notes;
  }

  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], HMIN = [0, 2, 3, 5, 7, 8, 11];
  const TRACKS = {
    // меню: медленная шкатулка, ре минор
    title: { bpm: 72, key: 62, scale: MIN, seed: 11, density: 0.45, lead: 'box', pad: true,
      chords: [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M']], bass: 'whole' },
    // стадия I: уютный соль мажор, шкатулка и щипки
    stage1: { bpm: 96, key: 67, scale: MAJ, seed: 21, density: 0.55, lead: 'box', pad: true, arp: 'pluck', hat: 'off',
      chords: [[55, 'M'], [52, 'm'], [48, 'M'], [50, 'M'], [55, 'M'], [52, 'm'], [48, 'M'], [50, 'M']], bass: 'half' },
    // стадия II: сумерки, ми минор, колокольчики
    stage2: { bpm: 78, key: 64, scale: MIN, seed: 37, density: 0.4, lead: 'bell', pad: true,
      chords: [[52, 'm'], [48, 'M'], [45, 'm'], [47, 'M']], bass: 'half', shaker: true },
    // финальная ночь: та же окраина, но тише и медленнее
    night: { bpm: 66, key: 62, scale: HMIN, seed: 43, density: 0.35, lead: 'bell', pad: true,
      chords: [[50, 'm'], [46, 'M'], [43, 'm'], [45, 'M']], bass: 'whole' },
    // обычный бой: ля минор, бас восьмыми и барабаны
    battle: { bpm: 132, key: 69, scale: MIN, seed: 53, density: 0.5, lead: 'pluck', pad: true, arp: 'box', drums: 'rock', hat: 'eighth',
      chords: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'M']], bass: 'eighth' },
    // босс: ре гармонический минор, плотнее и громче
    boss: { bpm: 142, key: 62, scale: HMIN, seed: 67, density: 0.6, lead: 'bell', pad: true, arp: 'pluck', drums: 'four', hat: 'eighth',
      chords: [[50, 'm'], [46, 'M'], [43, 'm'], [45, 'M'], [50, 'm'], [46, 'M'], [48, 'M'], [45, 'M']], bass: 'octave' },
  };
  for (const t of Object.values(TRACKS)) t.melody = makeMelody(t);

  let current = null, step = 0, nextT = 0, timer = null;

  function scheduleStep(tr, i, t) {
    const spb = 60 / tr.bpm / 4; // длительность шестнадцатой
    const bar = Math.floor(i / 16) % tr.chords.length;
    const pos = i % 16;
    const [root, q] = tr.chords[bar];
    const tones = TRI[q].map((x) => root + x);
    if (pos === 0 && tr.pad) inst.pad(tones.map((n) => n + 12), t, spb * 16 * 1.05, tr.drums ? 0.7 : 1);
    // бас
    if (tr.bass === 'whole' && pos === 0) inst.bass(root - 12, t, spb * 16);
    if (tr.bass === 'half' && pos % 8 === 0) inst.bass(pos === 0 ? root - 12 : root - 12 + 7, t, spb * 8);
    if (tr.bass === 'eighth' && pos % 2 === 0) inst.bass(root - 12, t, spb * 1.8, pos % 4 === 0 ? 1 : 0.7);
    if (tr.bass === 'octave' && pos % 2 === 0) inst.bass(root - 12 + (pos % 4 === 2 ? 12 : 0), t, spb * 1.8, pos % 4 === 0 ? 1 : 0.75);
    // арпеджио
    if (tr.arp && pos % 2 === 0) {
      const n = tones[(pos / 2) % 3] + 12 + (pos >= 8 ? 12 : 0);
      inst[tr.arp](n, t, spb * 2, tr.drums ? 0.45 : 0.55);
    }
    // мелодия
    const m = tr.melody[i % tr.melody.length];
    if (m != null) {
      let len = 1;
      while (len < 6 && tr.melody[(i + len) % tr.melody.length] == null) len++;
      inst[tr.lead](m, t, spb * len, 0.9);
    }
    // ударные
    if (tr.drums === 'rock') { if (pos === 0 || pos === 8 || pos === 10) inst.kick(t); if (pos === 4 || pos === 12) inst.snare(t); }
    if (tr.drums === 'four') { if (pos % 4 === 0) inst.kick(t, 0.9); if (pos === 4 || pos === 12) inst.snare(t, 1.1); }
    if (tr.hat === 'eighth' && pos % 2 === 0) inst.hat(t, pos % 4 === 2 ? 1 : 0.6);
    if (tr.hat === 'off' && pos % 4 === 2) inst.hat(t, 0.7);
    if (tr.shaker && pos % 2 === 1) inst.shaker(t, 0.8);
  }

  function tick() {
    if (!ctx || !current) return;
    const tr = TRACKS[current];
    const spb = 60 / tr.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) {
      scheduleStep(tr, step, nextT);
      nextT += spb; step++;
    }
  }

  let wanted = null;
  function music(name) {
    wanted = name;
    if (!ctx || name === current) return;
    current = name;
    if (!name) return;
    step = 0; nextT = ctx.currentTime + 0.08;
    if (!timer) timer = setInterval(tick, 30);
  }

  /* ---------- Звуковые эффекты ---------- */
  const SFX = {
    click(t) { osc('sine', 880, t, 0.05, 0.2, sfxBus, { f2: 620 }); },
    card(t) { noise(t, 0.14, 0.35, sfxBus, { f: 900, f2: 3200, q: 1.5 }); osc('triangle', 520, t + 0.02, 0.06, 0.08, sfxBus); },
    draw(t) { noise(t, 0.03, 0.12, sfxBus, { type: 'highpass', f: 4000 }); },
    hit(t, v = 1) { osc('sine', 170, t, 0.18, 0.7 * v, sfxBus, { f2: 48 }); noise(t, 0.12, 0.45 * v, sfxBus, { type: 'lowpass', f: 2200, f2: 400 }); },
    clank(t) { osc('square', 620, t, 0.12, 0.08, sfxBus, { rev: 0.3 }); osc('square', 931, t, 0.1, 0.06, sfxBus); noise(t, 0.05, 0.15, sfxBus, { f: 3000, q: 3 }); },
    block(t) { osc('triangle', 440, t, 0.18, 0.18, sfxBus, { f2: 660, rev: 0.4 }); osc('sine', 880, t + 0.05, 0.2, 0.08, sfxBus, { rev: 0.4 }); },
    hurt(t) { osc('sawtooth', 220, t, 0.25, 0.18, sfxBus, { f2: 90 }); noise(t, 0.15, 0.3, sfxBus, { type: 'lowpass', f: 1200 }); },
    flame(t) { noise(t, 0.35, 0.25, sfxBus, { type: 'lowpass', f: 400, f2: 2600, a: 0.05 }); osc('sine', 320, t, 0.3, 0.1, sfxBus, { f2: 640, rev: 0.3 }); },
    burst(t) {
      noise(t, 0.7, 0.6, sfxBus, { type: 'lowpass', f: 4000, f2: 200, rev: 0.6 });
      osc('sine', 110, t, 0.5, 0.7, sfxBus, { f2: 40 });
      for (const m of [72, 76, 79, 84]) osc('triangle', mtof(m), t + 0.02, 0.6, 0.06, sfxBus, { rev: 0.7 });
    },
    heal(t) { [72, 76, 79, 84].forEach((m, i) => osc('sine', mtof(m), t + i * 0.06, 0.35, 0.14, sfxBus, { rev: 0.6 })); },
    coin(t) { osc('square', mtof(88), t, 0.07, 0.07, sfxBus); osc('square', mtof(93), t + 0.07, 0.2, 0.07, sfxBus, { rev: 0.3 }); },
    relic(t) { [79, 83, 86, 91].forEach((m, i) => osc('sine', mtof(m), t + i * 0.09, 0.8, 0.12, sfxBus, { rev: 0.8 })); },
    deny(t) { osc('square', 140, t, 0.08, 0.08, sfxBus); osc('square', 120, t + 0.11, 0.1, 0.08, sfxBus); },
    enemy(t) { noise(t, 0.22, 0.35, sfxBus, { f: 300, f2: 1800, q: 2 }); osc('sawtooth', 160, t, 0.2, 0.08, sfxBus, { f2: 60 }); },
    buff(t) { osc('sawtooth', 180, t, 0.4, 0.1, sfxBus, { f2: 420, rev: 0.4 }); },
    debuff(t) { osc('triangle', 520, t, 0.45, 0.14, sfxBus, { f2: 180, rev: 0.5 }); osc('triangle', 535, t, 0.45, 0.1, sfxBus, { f2: 170 }); },
    snuff(t) { noise(t, 0.3, 0.35, sfxBus, { type: 'lowpass', f: 2000, f2: 150 }); osc('sine', 600, t, 0.4, 0.12, sfxBus, { f2: 120 }); },
    turn(t) { osc('sine', mtof(81), t, 0.5, 0.08, sfxBus, { rev: 0.7 }); },
    step(t) { noise(t, 0.08, 0.18, sfxBus, { type: 'lowpass', f: 900 }); noise(t + 0.16, 0.08, 0.15, sfxBus, { type: 'lowpass', f: 800 }); },
    win(t) { [67, 72, 76, 79].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.08, 0.5, 0.14, sfxBus, { rev: 0.5 })); },
    victory(t) {
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.1, 0.9, 0.12, sfxBus, { rev: 0.6 }));
      [72, 76, 79].forEach((m) => osc('sine', mtof(m), t + 0.8, 2.2, 0.08, sfxBus, { rev: 0.9 }));
    },
    defeat(t) { [69, 65, 62, 57].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.32, 0.8, 0.13, sfxBus, { rev: 0.7 })); },
  };

  function sfx(name, v) {
    if (!ctx || !prefs.sfxVol || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.005, v);
  }

  function unlock() {
    if (!ensure()) return;
    if (wanted && wanted !== current) music(wanted);
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(MUSIC_GAIN * prefs.musicVol, t, 0.1);
    sfxBus.gain.setTargetAtTime(SFX_GAIN * prefs.sfxVol, t, 0.05);
  }

  /* Громкость из настроек: kind — 'music' или 'sfx', v — от 0 до 1 */
  function setVolume(kind, v) {
    prefs[kind === 'music' ? 'musicVol' : 'sfxVol'] = Math.max(0, Math.min(1, v));
    save(); apply();
  }

  const publicPrefs = () => ({ ...prefs, music: prefs.musicVol > 0, sfx: prefs.sfxVol > 0 });
  window.Sound = { unlock, music, sfx, setVolume, get prefs() { return publicPrefs(); }, _probe: () => ctx && { ctx, master } };
})();
