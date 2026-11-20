/* Музыка и звуки на Web Audio API.
   Музыка: готовые треки из assets/m<N>/ (список в window.ASSETS.music). Если файла нет или он
   не загрузился, играет синтезированная пьеса: шкатулка, пэд, бас и лёгкие барабаны, мелодия
   с фиксированным зерном, поэтому каждая пьеса узнаваема.
   Звуки синтезируются прямо в браузере, без файлов.
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
  const FILE_GAIN = 0.7; // громкость треков из файлов относительно синтезированных пьес
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* хранилище недоступно */ } };

  let ctx = null, master, musicBus, fileBus, sfxBus, reverbIn, noiseBuf;
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
    fileBus = ctx.createGain(); fileBus.gain.value = FILE_GAIN; fileBus.connect(musicBus);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_GAIN * prefs.sfxVol; sfxBus.connect(master);
    // реверберация из сгенерированного импульса: «зимний воздух»
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      // огибающая меняется плавно: считаем её раз в 64 отсчёта, иначе первое касание на слабом телефоне заметно замирает
      let env = 1;
      for (let i = 0; i < len; i++) { if ((i & 63) === 0) env = Math.pow(1 - i / len, 2.6); d[i] = (Math.random() * 2 - 1) * env; }
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

  // current: имя дорожки, которую просит игра; synth: пьеса, которую сейчас играет синтезатор
  let current = null, synth = null, step = 0, nextT = 0, timer = null;

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
    if (!ctx || !synth) return;
    const tr = synth;
    const spb = 60 / tr.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) {
      scheduleStep(tr, step, nextT);
      nextT += spb; step++;
    }
  }

  // у синтезатора нет своих пьес для второго боевого трека и финального босса
  const SYNTH_OF = { battle2: 'battle', final: 'boss' };
  function startSynth(name) {
    synth = TRACKS[SYNTH_OF[name] || name] || null;
    if (!synth) return;
    step = 0; nextT = ctx.currentTime + 0.08;
    if (!timer) timer = setInterval(tick, 30);
  }

  /* ---------- Музыка из файлов ----------
     Файл дорожки: вступление, потом петля. Границы петли в секундах лежат в ASSETS.music.tracks
     (их считает tools/audio/build_music.py). Дорожка играет с начала и дальше крутит петлю.
     В памяти лежат сжатые файлы и одна-две раскодированные дорожки: раскодированная минута
     стерео занимает около 23 МБ. */
  const MF = (window.ASSETS && window.ASSETS.music) || null;
  const hasFile = (name) => !!(MF && MF.tracks && MF.tracks[name]);
  const fileUrl = (name) => `${window.ASSETS.base || 'assets/'}${MF.dir}/${name}.mp3`;
  // темы меню и дороги после боя продолжаются с того же места, бой каждый раз начинается сначала
  const RESUME = new Set(['title', 'stage1', 'stage2', 'night']);
  // что понадобится следом: эти файлы скачиваются заранее, пока играет текущая дорожка
  const NEXT = { title: ['stage1'], stage1: ['battle', 'battle2', 'boss'], stage2: ['battle', 'battle2', 'boss'], night: ['final'], battle: ['battle2'], battle2: ['battle'], boss: ['stage2', 'night'], final: ['title'] };
  // сколько раскодированных дорожек держать: две на телефонах с памятью от 4 ГБ, иначе одну
  const KEEP = (navigator.deviceMemory || 2) >= 4 ? 2 : 1;
  const packed = {}, decoded = new Map(), pos = {};
  let voice = null, seq = 0;

  // Музыка весит по полтора мегабайта на дорожку: её файл ждёт, пока придут картинки экрана (Art.quiet),
  // иначе на телефонной сети она занимала канал, и экран дорисовывался с опозданием. Дорожка, которая должна
  // звучать сейчас, ждёт недолго (wait мс), запас наперёд ждёт дольше и качается по одному файлу.
  const quietNet = (wait) => (window.Art && window.Art.quiet ? window.Art.quiet(wait) : Promise.resolve());
  // v133. Загрузку дорожки можно прервать (dropOthers): на медленной сети музыка титула (1,4 МБ) докачивалась,
  // когда игрок уже был в бою, и делила канал с анимациями врага и музыкой боя. Теперь, если новой дорожке
  // самой ещё предстоит скачаться, недокачанные чужие бросаются; понадобятся снова, скачаются заново.
  // Если новая дорожка уже скачана, чужие не трогаем: канал свободен, пусть доходят.
  const loading = {}; // имя -> AbortController, пока файл ждёт сеть или качается
  const have = new Set(); // дорожки, чей файл уже пришёл
  function fetchTrack(name, wait = 4000) {
    if (!packed[name]) {
      const ac = window.AbortController ? new AbortController() : null;
      if (ac) loading[name] = ac;
      const mine = packed[name] = quietNet(wait)
        .then(() => { if (ac && ac.signal.aborted) throw new Error('не нужна'); return fetch(fileUrl(name), ac ? { priority: 'low', signal: ac.signal } : { priority: 'low' }); })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then((bytes) => { if (loading[name] === ac) delete loading[name]; have.add(name); return bytes; })
        .catch((e) => { if (loading[name] === ac) delete loading[name]; if (packed[name] === mine) delete packed[name]; throw e; });
    }
    return packed[name];
  }
  function dropOthers(name) {
    Object.keys(loading).forEach((n) => {
      if (n === name) return;
      const ac = loading[n];
      delete loading[n]; delete packed[n];
      ac.abort();
    });
  }
  function loadTrack(name) {
    if (decoded.has(name)) { const b = decoded.get(name); decoded.delete(name); decoded.set(name, b); return Promise.resolve(b); }
    return fetchTrack(name)
      .then((bytes) => new Promise((ok, bad) => {
        // старые Safari понимают только вызов с функциями; новые браузеры вдобавок возвращают обещание
        const pr = ctx.decodeAudioData(bytes.slice(0), ok, bad);
        if (pr && pr.catch) pr.catch(() => {});
      }))
      .then((buf) => {
        decoded.set(name, buf);
        while (decoded.size > KEEP) decoded.delete(decoded.keys().next().value);
        return buf;
      });
  }
  // место в файле, где дорожка звучит в момент t
  function where(v, t) {
    const p = v.off + Math.max(0, t - v.t0);
    return p < v.b ? p : v.a + ((p - v.a) % (v.b - v.a));
  }
  function stopFile(fade) {
    seq++;
    if (!voice) return;
    const v = voice, t = ctx.currentTime;
    voice = null;
    if (RESUME.has(v.name)) pos[v.name] = where(v, t);
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(0, t + fade);
    try { v.src.stop(t + fade + 0.05); } catch (e) { /* уже остановлена */ }
  }
  function playFile(name) {
    const my = seq;
    loadTrack(name).then((buf) => {
      if (my !== seq || current !== name) return;
      let [a, b] = MF.tracks[name];
      b = Math.min(b, buf.duration);
      if (!(a < b)) { a = 0; b = buf.duration; }
      const src = ctx.createBufferSource(); src.buffer = buf;
      src.loop = true; src.loopStart = a; src.loopEnd = b;
      const g = ctx.createGain(); src.connect(g); g.connect(fileBus);
      const off = RESUME.has(name) && pos[name] < b ? pos[name] : 0;
      const t = ctx.currentTime + 0.03;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + (off ? 0.8 : 0.04));
      src.start(t, off);
      voice = { name, src, g, t0: t, off, a, b };
      (NEXT[name] || []).filter(hasFile).reduce((q, n) => q.then(() => (current === name ? fetchTrack(n, 9000) : null)).catch(() => {}), Promise.resolve());
    }).catch(() => { if (my === seq && current === name) startSynth(name); });
  }

  let wanted = null;
  function music(name) {
    if (name !== wanted && name && hasFile(name) && !have.has(name)) dropOthers(name);
    wanted = name;
    if (!ctx) { if (name && hasFile(name)) fetchTrack(name).catch(() => {}); return; }
    if (name === current) return;
    current = name;
    synth = null; // расписанные ноты доиграют сами: они стоят не дальше 0,15 с вперёд
    stopFile(name ? 0.6 : 1.2);
    if (!name) return;
    if (hasFile(name)) playFile(name); else startSynth(name);
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
    // шаги по снегу при переходе на следующий уровень: были на 13 дБ тише музыки и не слышны (замер v131), подняты на 9 дБ
    step(t) { noise(t, 0.08, 0.5, sfxBus, { type: 'lowpass', f: 900 }); noise(t + 0.16, 0.08, 0.42, sfxBus, { type: 'lowpass', f: 800 }); },
    /* звуки карт и талисманов: у каждого приёма свой */
    bonk(t, v = 1) { osc('sine', 230, t, 0.14, 0.6 * v, sfxBus, { f2: 70 }); noise(t, 0.08, 0.4 * v, sfxBus, { f: 1200, q: 1.2 }); osc('triangle', 660, t, 0.05, 0.07, sfxBus, { f2: 300 }); },
    lantern(t) { SFX.bonk(t); osc('sine', mtof(86), t + 0.02, 0.5, 0.08, sfxBus, { rev: 0.6 }); osc('sine', mtof(93), t + 0.05, 0.4, 0.05, sfxBus, { rev: 0.6 }); },
    thud(t) { osc('sine', 120, t, 0.3, 0.9, sfxBus, { f2: 36 }); noise(t, 0.18, 0.55, sfxBus, { type: 'lowpass', f: 1200, f2: 180 }); },
    slash(t) { noise(t, 0.16, 0.5, sfxBus, { type: 'highpass', f: 1500, f2: 6500, a: 0.01 }); noise(t + 0.1, 0.14, 0.38, sfxBus, { f: 5200, f2: 2000, q: 2 }); osc('sine', 1400, t + 0.02, 0.12, 0.04, sfxBus, { f2: 2600 }); },
    sparks(t) { for (let i = 0; i < 8; i++) noise(t + i * 0.035 + Math.random() * 0.02, 0.025, 0.28, sfxBus, { type: 'highpass', f: 5000 + Math.random() * 3000 }); osc('square', 1900, t, 0.05, 0.03, sfxBus, { f2: 3200 }); },
    fire(t) { noise(t, 0.6, 0.38, sfxBus, { type: 'lowpass', f: 300, f2: 1800, a: 0.06 }); for (let i = 0; i < 10; i++) noise(t + 0.04 + Math.random() * 0.5, 0.02, 0.24, sfxBus, { type: 'highpass', f: 2500 + Math.random() * 3000 }); osc('sine', 90, t, 0.4, 0.15, sfxBus, { f2: 60 }); },
    snow(t) { noise(t, 0.2, 0.5, sfxBus, { type: 'lowpass', f: 1600, f2: 300 }); noise(t + 0.02, 0.1, 0.2, sfxBus, { type: 'highpass', f: 3500 }); osc('sine', 160, t, 0.12, 0.3, sfxBus, { f2: 70 }); },
    ice(t) { [96, 101, 103, 108].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.03, 0.25, 0.06, sfxBus, { rev: 0.5 })); noise(t, 0.12, 0.4, sfxBus, { type: 'highpass', f: 4000, f2: 9000 }); },
    stamp(t) { osc('sine', 110, t, 0.16, 0.75, sfxBus, { f2: 45 }); noise(t, 0.09, 0.5, sfxBus, { type: 'lowpass', f: 900 }); noise(t + 0.06, 0.12, 0.15, sfxBus, { f: 2500, q: 0.8 }); },
    paper(t) { noise(t, 0.22, 0.32, sfxBus, { f: 1800, f2: 4500, q: 0.7, a: 0.02 }); },
    star(t) { [91, 95, 98, 103].forEach((m, i) => osc('sine', mtof(m), t + i * 0.05, 0.45, 0.07, sfxBus, { rev: 0.7 })); osc('sine', 140, t + 0.38, 0.2, 0.45, sfxBus, { f2: 50 }); },
    beam(t) { osc('sawtooth', 220, t, 0.6, 0.05, sfxBus, { f2: 880, a: 0.15, rev: 0.6 }); osc('sine', mtof(84), t + 0.1, 0.7, 0.1, sfxBus, { rev: 0.8 }); noise(t + 0.26, 0.35, 0.35, sfxBus, { type: 'lowpass', f: 3000, f2: 300 }); },
    root(t) { osc('sawtooth', 90, t, 0.35, 0.12, sfxBus, { f2: 60 }); noise(t, 0.3, 0.3, sfxBus, { f: 600, f2: 1600, q: 3 }); noise(t + 0.26, 0.08, 0.45, sfxBus, { type: 'highpass', f: 2500 }); },
    fair(t) { [76, 79, 84].forEach((m, i) => osc('square', mtof(m), t + i * 0.06, 0.12, 0.05, sfxBus, { rev: 0.4 })); },
    crunch(t) { for (let i = 0; i < 6; i++) noise(t + i * 0.03, 0.04, 0.32, sfxBus, { f: 1500 + Math.random() * 1500, q: 2 }); },
    splat(t) { noise(t, 0.14, 0.45, sfxBus, { type: 'lowpass', f: 700, f2: 200 }); osc('sine', 300, t, 0.1, 0.2, sfxBus, { f2: 110 }); },
    thorns(t) { noise(t, 0.06, 0.3, sfxBus, { type: 'highpass', f: 3000 }); osc('triangle', 1200, t, 0.08, 0.06, sfxBus, { f2: 2400 }); osc('triangle', 900, t + 0.05, 0.08, 0.05, sfxBus, { f2: 1800 }); },
    weak(t) { osc('triangle', 440, t, 0.5, 0.12, sfxBus, { f2: 150, rev: 0.4 }); osc('triangle', 455, t + 0.05, 0.5, 0.08, sfxBus, { f2: 140 }); noise(t, 0.4, 0.08, sfxBus, { type: 'lowpass', f: 600 }); },
    crack(t) { noise(t, 0.05, 0.55, sfxBus, { type: 'highpass', f: 2000 }); noise(t + 0.06, 0.08, 0.35, sfxBus, { f: 900, q: 2 }); osc('square', 180, t, 0.08, 0.06, sfxBus, { f2: 90 }); },
    frost(t) { [100, 104, 107, 112].forEach((m, i) => osc('sine', mtof(m), t + i * 0.06, 0.6, 0.05, sfxBus, { rev: 0.9 })); noise(t, 0.5, 0.15, sfxBus, { type: 'highpass', f: 6000, a: 0.1 }); },
    sleep(t) { [79, 76, 72, 67].forEach((m, i) => osc('sine', mtof(m), t + i * 0.18, 0.4, 0.1, sfxBus, { rev: 0.7 })); },
    zap(t) { osc('square', 300, t, 0.12, 0.06, sfxBus, { f2: 1500 }); osc('sine', mtof(88), t + 0.08, 0.3, 0.08, sfxBus, { rev: 0.5 }); },
    aura(t) { osc('sawtooth', 110, t, 0.5, 0.1, sfxBus, { f2: 330, a: 0.1, rev: 0.4 }); osc('sawtooth', 165, t, 0.5, 0.06, sfxBus, { f2: 495, a: 0.1 }); noise(t, 0.4, 0.15, sfxBus, { f: 400, f2: 2000, a: 0.1 }); },
    sigil(t) { [74, 81, 86].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.07, 0.9, 0.08, sfxBus, { rev: 0.8 })); osc('sine', 55, t, 0.6, 0.2, sfxBus); },
    chime(t) { [84, 79, 76, 72].forEach((m, i) => osc('sine', mtof(m), t + i * 0.22, 1.1, 0.12, sfxBus, { rev: 0.8 })); },
    mirror(t) { osc('sine', mtof(96), t, 0.6, 0.06, sfxBus, { f2: mtof(103), rev: 0.8 }); osc('sine', mtof(91), t + 0.05, 0.6, 0.05, sfxBus, { rev: 0.8 }); },
    oven(t) { osc('sine', mtof(93), t, 0.6, 0.1, sfxBus, { rev: 0.6 }); osc('sine', mtof(100), t + 0.01, 0.5, 0.04, sfxBus); },
    sugar(t) { for (let i = 0; i < 6; i++) osc('sine', mtof(96 + (i * 5) % 12), t + i * 0.04, 0.2, 0.04, sfxBus, { rev: 0.6 }); },
    grind(t) { noise(t, 0.4, 0.32, sfxBus, { f: 3000, f2: 6500, q: 6 }); osc('sawtooth', 1800, t, 0.35, 0.025, sfxBus, { f2: 2700 }); },
    growl(t) { osc('sawtooth', 92, t, 0.5, 0.13, sfxBus, { f2: 72, a: 0.05 }); osc('sawtooth', 95, t, 0.5, 0.1, sfxBus, { f2: 76, a: 0.05, detune: 30 }); noise(t, 0.45, 0.16, sfxBus, { f: 420, q: 4, a: 0.05 }); },
    bark(t) { osc('sawtooth', 560, t, 0.09, 0.16, sfxBus, { f2: 280 }); noise(t, 0.08, 0.3, sfxBus, { f: 1100, q: 2 }); osc('sawtooth', 470, t + 0.13, 0.1, 0.13, sfxBus, { f2: 240 }); },
    bite(t) { noise(t, 0.03, 0.7, sfxBus, { type: 'highpass', f: 2500 }); osc('sine', 210, t, 0.08, 0.35, sfxBus, { f2: 80 }); noise(t + 0.05, 0.12, 0.25, sfxBus, { type: 'lowpass', f: 900 }); },
    heartbeat(t) { osc('sine', 70, t, 0.14, 0.75, sfxBus, { f2: 45 }); osc('sine', 65, t + 0.2, 0.16, 0.6, sfxBus, { f2: 40 }); },
    proc(t) { osc('triangle', mtof(88), t, 0.25, 0.08, sfxBus, { rev: 0.6 }); osc('triangle', mtof(95), t + 0.07, 0.35, 0.07, sfxBus, { rev: 0.7 }); },
    whistle(t) { osc('sine', 2000, t, 0.32, 0.09, sfxBus, { f2: 2350, a: 0.02 }); osc('sine', 2350, t + 0.36, 0.28, 0.09, sfxBus, { f2: 1900 }); noise(t, 0.6, 0.04, sfxBus, { f: 2100, q: 8 }); },
    horn(t) { [55, 62, 67].forEach((m) => osc('sawtooth', mtof(m), t, 0.7, 0.05, sfxBus, { a: 0.06, rev: 0.6 })); osc('sawtooth', mtof(74), t + 0.3, 0.5, 0.04, sfxBus, { a: 0.04, rev: 0.6 }); },
    howl(t) { osc('sine', 300, t, 0.5, 0.12, sfxBus, { f2: 640, a: 0.1, rev: 0.7 }); osc('sine', 640, t + 0.5, 0.8, 0.1, sfxBus, { f2: 380, rev: 0.8 }); osc('triangle', 600, t + 0.1, 0.9, 0.03, sfxBus, { f2: 760, rev: 0.6 }); },
    sip(t) { noise(t, 0.25, 0.15, sfxBus, { f: 700, f2: 1500, q: 3, a: 0.05 }); osc('sine', 500, t + 0.1, 0.2, 0.05, sfxBus, { f2: 700 }); },
    wind(t) { noise(t, 0.6, 0.32, sfxBus, { f: 500, f2: 2200, q: 1.5, a: 0.15 }); },
    // достижение: глухой удар штемпеля и звон колокольчиков
    achieve(t) {
      noise(t, 0.08, 0.35, sfxBus, { type: 'lowpass', f: 600 }); osc('sine', 120, t, 0.14, 0.3, sfxBus, { f2: 55 });
      [84, 88, 91, 96].forEach((m, i) => osc('triangle', mtof(m), t + 0.12 + i * 0.07, 0.6, 0.1, sfxBus, { rev: 0.7 }));
    },
    win(t) { [67, 72, 76, 79].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.08, 0.5, 0.14, sfxBus, { rev: 0.5 })); },
    victory(t) {
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.1, 0.9, 0.12, sfxBus, { rev: 0.6 }));
      [72, 76, 79].forEach((m) => osc('sine', mtof(m), t + 0.8, 2.2, 0.08, sfxBus, { rev: 0.9 }));
    },
    defeat(t) { [69, 65, 62, 57].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.32, 0.8, 0.13, sfxBus, { rev: 0.7 })); },
  };

  function sfx(name, v) {
    // в свёрнутой игре звук стоит на паузе: всё заказанное за это время грянуло бы разом при возвращении
    if (!ctx || !prefs.sfxVol || !SFX[name] || document.hidden) return;
    SFX[name](ctx.currentTime + 0.005, v);
  }

  // игра свёрнута или вкладка спрятана: звук встаёт на паузу и продолжается с того же места
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

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
  window.Sound = { unlock, music, sfx, setVolume, get prefs() { return publicPrefs(); }, _probe: () => ctx && { ctx, master, musicBus, voice, synth, pos, decoded: [...decoded.keys()] } };
})();
