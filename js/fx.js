/* Анимации розыгрыша карт и срабатывания талисманов.
   Всё рисуется в слое .fxlayer поверх боя и само исчезает.
   FX.play(kind, target) — эффект и его звук; target: 'enemy', 'hero', 'energy', 'lamp', 'hand' или {x, y}.
   Возвращает обещание, которое выполняется в момент удара (для снарядов — когда снаряд долетел). */
(function () {
  const O = '#17121f';
  const $ = (s) => document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fast = () => document.getElementById('app').classList.contains('fast');
  const wait = (ms) => new Promise((r) => setTimeout(r, fast() ? ms * 0.5 : ms));
  const sfx = (n, v) => window.Sound && window.Sound.sfx(n, v);
  const svg = (vb, body, w, h = w) => `<svg viewBox="${vb}" style="width:${w}px;height:${h}px">${body}</svg>`;

  /* ---------- координаты в логическом экране 400×860 ---------- */
  function box(el) {
    const a = document.getElementById('app').getBoundingClientRect();
    const k = a.width / 400 || 1;
    const b = el.getBoundingClientRect();
    return { x: (b.left + b.width / 2 - a.left) / k, y: (b.top + b.height / 2 - a.top) / k, w: b.width / k, h: b.height / k };
  }
  function anchor(t) {
    if (t && typeof t === 'object') return { w: 80, h: 80, ...t };
    const pick = { enemy: '#enemy', hero: '#heroPortrait', energy: '.herobar .energy', lamp: '.herobar .lamp' }[t];
    const el = pick && $(pick);
    if (el) {
      const b = box(el);
      if (t === 'enemy') { b.y += 6; b.foot = b.y + b.h / 2 - 16; }
      return b;
    }
    if (t === 'hand') return { x: 200, y: 640, w: 300, h: 120 };
    if (t === 'enemy') return { x: 200, y: 260, w: 240, h: 240, foot: 370 };
    return { x: 200, y: 470, w: 200, h: 200 };
  }

  /* ---------- базовые детали ---------- */
  function spawn(x, y, html, cls, life) {
    const host = $('#screen .fxlayer');
    if (!host) return null;
    const d = document.createElement('div');
    d.className = `fx ${cls || ''}`;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.innerHTML = html;
    host.appendChild(d);
    setTimeout(() => d.remove(), life);
    return d;
  }
  const vars = (d, o) => { if (d) for (const k in o) d.style.setProperty(`--${k}`, o[k]); return d; };

  // разлёт частиц: ang — сектор в градусах (0 — вправо, 90 — вниз), dist — дальность, up — подброс, grav — падение
  function particles(at, n, o) {
    for (let i = 0; i < n; i++) {
      const a = rnd(...(o.ang || [0, 360])) * Math.PI / 180;
      const dist = rnd(...(o.dist || [30, 80]));
      const dx = Math.cos(a) * dist; const dy = Math.sin(a) * dist;
      const html = typeof o.html === 'function' ? o.html(i) : o.html;
      const dl = (o.delay || 0) + (o.stagger ? i * o.stagger : rnd(0, o.jitter || 0));
      const d = spawn(at.x + rnd(-(o.jx || 0), o.jx || 0), at.y + rnd(-(o.jy || 0), o.jy || 0), html, `pt ${o.cls || ''}`, (o.dur + dl) * 1000 + 120);
      vars(d, {
        dx: `${dx}px`, dy: `${dy + (o.grav || 0)}px`, mx: `${dx * 0.6}px`, my: `${dy * 0.6 - (o.up || 0)}px`,
        r: `${o.spin ? rnd(-o.spin, o.spin) : 0}deg`, t: `${o.dur}s`, dl: `${dl}s`, sz: (o.size ? rnd(...o.size) : 1).toFixed(2),
      });
    }
  }
  // снаряд от одной точки к другой; arc — высота дуги, spin — поворот за полёт
  function fly(html, from, to, ms, o = {}) {
    const a = anchor(from); const b = anchor(to);
    const tx = b.x + (o.ox || 0); const ty = b.y + (o.oy || 0);
    const d = spawn(a.x, a.y, html, `proj ${o.cls || ''}`, ms + 160);
    // aim: снаряд смотрит остриём в цель
    const ang = o.aim ? Math.atan2(ty - a.y, tx - a.x) * 180 / Math.PI : 0;
    vars(d, { dx: `${tx - a.x}px`, dy: `${ty - a.y}px`, arc: `${o.arc || 0}px`, r: `${o.aim ? ang : o.spin || 0}deg`, r0: `${o.aim ? ang : o.r0 || 0}deg`, t: `${ms / 1000}s` });
    return wait(ms);
  }
  // одиночная картинка с анимацией из CSS (класс cls задаёт движение)
  const pop = (at, html, cls, life = 800, dx = 0, dy = 0) => spawn(at.x + dx, at.y + dy, html, cls, life);
  // встряска экрана
  function shake(power = 1) {
    const s = $('#screen .enemy-zone'); if (!s) return;
    s.style.setProperty('--shk', `${6 * power}px`);
    s.classList.remove('shk'); void s.offsetWidth; s.classList.add('shk');
    setTimeout(() => s.classList.remove('shk'), 360);
  }
  // окраска врага (мороз, яд, огонь) на время
  function tint(cls, ms = 900) {
    const e = $('#enemy'); if (!e) return;
    e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls);
    setTimeout(() => e.classList.remove(cls), ms);
  }

  /* ---------- рисунки ---------- */
  const sized = (html, w) => html.replace('class="icon"', `class="icon" style="width:${w}px;height:${w}px"`);
  const flame = (k = 1) => sized(window.Art.flame(k), 44 * k);
  const star = (r, fill = '#ffe38a') => svg('-12 -12 24 24', `<path d="M0 -10 L2.6 -2.6 L10 0 L2.6 2.6 L0 10 L-2.6 2.6 L-10 0 L-2.6 -2.6z" fill="${fill}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`, r * 2);
  const dot = (r, fill, stroke = O) => svg('-10 -10 20 20', `<circle r="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`, r * 2);
  const shard = (w, fill) => svg('-10 -10 20 20', `<path d="M0 -9 L4 0 L0 9 L-4 0z" fill="${fill}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`, w, w);
  const starburst = (r, fill = '#fff3c4', rays = 10) => {
    let d = '';
    for (let i = 0; i < rays * 2; i++) { const a = (i / (rays * 2)) * Math.PI * 2; const rr = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)} `; }
    return svg(`${-r - 4} ${-r - 4} ${2 * r + 8} ${2 * r + 8}`, `<path d="${d}z" fill="${fill}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`, 2 * r + 8);
  };
  const glow = (r, c) => `<i class="glow" style="width:${r * 2}px;height:${r * 2}px;background:radial-gradient(closest-side, ${c}, transparent)"></i>`;
  const snowflake = (r, c = '#e8f4ff') => svg('-12 -12 24 24', `<g stroke="${O}" stroke-width="4" stroke-linecap="round"><path d="M0 -10 V10 M-8.7 -5 L8.7 5 M-8.7 5 L8.7 -5"/></g><g stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M0 -10 V10 M-8.7 -5 L8.7 5 M-8.7 5 L8.7 -5 M-3 -8 L0 -5 L3 -8 M-3 8 L0 5 L3 8"/></g>`, r * 2);
  const envelope = (w) => svg('0 0 60 42', `<rect x="2" y="2" width="56" height="38" rx="4" fill="#f2e6c9" stroke="${O}" stroke-width="3"/><path d="M3 4 L30 24 L57 4" fill="none" stroke="${O}" stroke-width="3"/><circle cx="30" cy="25" r="6" fill="#c8423a" stroke="${O}" stroke-width="2"/>`, w, w * 0.7);
  const leaf = (w, c = '#6aa84f') => svg('-10 -10 20 20', `<path d="M0 -9 Q8 -2 0 9 Q-8 -2 0 -9z" fill="${c}" stroke="${O}" stroke-width="1.8"/><path d="M0 -6 V7" stroke="#3d6b2c" stroke-width="1.2"/>`, w);
  const drop = (w, c) => svg('-10 -12 20 24', `<path d="M0 -10 Q8 2 6 6 A6 6 0 0 1 -6 6 Q-8 2 0 -10z" fill="${c}" stroke="${O}" stroke-width="2"/><path d="M-2 0 q-2 3 0 6" stroke="#fff" stroke-width="1.5" fill="none" opacity=".7"/>`, w, w * 1.2);
  const note = (w, c = '#f3d27c') => svg('-10 -14 20 26', `<path d="M3 -12 V6" stroke="${O}" stroke-width="4"/><path d="M3 -12 q6 2 7 8" fill="none" stroke="${O}" stroke-width="4"/><ellipse cx="-1" cy="7" rx="5" ry="4" fill="${c}" stroke="${O}" stroke-width="2.2"/><path d="M3 -12 V6 M3 -12 q6 2 7 8" fill="none" stroke="${c}" stroke-width="1.6"/>`, w, w * 1.3);
  const coin = (w) => svg('-12 -12 24 24', `<circle r="10" fill="#e6c45a" stroke="${O}" stroke-width="2.5"/><circle r="5.5" fill="none" stroke="#b08a2a" stroke-width="2"/><path d="M-4 -6 q3 -2 6 -1" stroke="#fff6c8" stroke-width="2" fill="none" stroke-linecap="round"/>`, w);
  const heart = (w, c = '#e8505a') => svg('-12 -12 24 24', `<path d="M0 9 Q-11 1 -10 -4 Q-9 -10 -4 -9 Q-1 -8 0 -5 Q1 -8 4 -9 Q9 -10 10 -4 Q11 1 0 9z" fill="${c}" stroke="${O}" stroke-width="2.2"/><path d="M-6 -5 q1 -2 3 -2" stroke="#ffd0d4" stroke-width="2" fill="none" stroke-linecap="round"/>`, w);
  const plus = (w, c = '#7fe08a') => svg('-10 -10 20 20', `<path d="M-3 -9 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6z" fill="${c}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`, w);
  const zzz = (w) => `<b class="zz" style="font-size:${w}px">z</b>`;
  const crumb = (w, c) => svg('-10 -10 20 20', `<path d="M-6 -4 L2 -7 L7 0 L3 6 L-5 5z" fill="${c}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`, w);
  const icon = (name, w) => sized(window.Art.icon(name), w);

  /* ---------- эффекты ---------- */
  const K = {
    // удар фонарём: тёплая вспышка и звёздочка удара
    async lantern(t) {
      const a = anchor(t);
      pop(a, glow(90, 'rgba(255,200,110,.85)'), 'fade-out', 500);
      pop(a, starburst(36, '#ffe38a'), 'boom', 420, rnd(-10, 10), rnd(-20, 10));
      particles(a, 6, { html: () => dot(rnd(3, 5), '#ffd27a'), dist: [40, 80], dur: 0.45 });
      sfx('lantern'); shake(0.6);
    },
    // обычный тупой удар
    async bonk(t) {
      const a = anchor(t);
      pop(a, starburst(32), 'boom', 420, rnd(-14, 14), rnd(-24, 10));
      particles(a, 5, { html: () => dot(rnd(2.5, 4), '#e6edf8'), dist: [36, 70], dur: 0.4 });
      sfx('bonk'); shake(0.5);
    },
    // тяжёлый удар: сумка, сани, размах
    async heavy(t) {
      const a = anchor(t);
      pop(a, starburst(52, '#fff3c4', 12), 'boom big', 520, 0, -10);
      particles(a, 9, { html: () => dot(rnd(3, 6), pick(['#e6edf8', '#c9b48a', '#9fb0cc'])), dist: [50, 110], dur: 0.55, grav: 40 });
      sfx('thud'); shake(1.4);
    },
    // клинок, нож, сталь: две перекрещенные дуги
    async slash(t) {
      const a = anchor(t);
      const arc = (flip, dl) => pop(a, svg('0 0 240 240', `<path d="M24 206 Q70 70 216 30" fill="none" stroke="${O}" stroke-width="15" stroke-linecap="round"/><path d="M24 206 Q70 70 216 30" fill="none" stroke="#f6fbff" stroke-width="8" stroke-linecap="round"/><path d="M60 160 Q100 80 190 46" fill="none" stroke="#9fd0ff" stroke-width="3" stroke-linecap="round"/>`, 220), `slash ${flip ? 'flip' : ''}`, 520).style.setProperty('--dl', `${dl}s`);
      arc(false, 0); arc(true, 0.1);
      sfx('slash');
      await wait(120);
      shake(0.5);
    },
    // искры: Искра, Сноп искр, Кочерга, точильный круг
    async sparks(t) {
      const a = anchor(t);
      pop(a, glow(60, 'rgba(255,190,80,.9)'), 'fade-out', 380);
      particles(a, 16, { html: (i) => (i % 3 ? dot(rnd(2, 3.5), i % 2 ? '#ffe38a' : '#ffb23e', '#7a3a10') : star(rnd(5, 8))), dist: [40, 120], dur: 0.6, grav: 50 });
      sfx('sparks'); shake(0.4);
    },
    // огонь: языки пламени поднимаются по врагу
    async fire(t) {
      const a = anchor(t); const foot = a.foot || a.y + 40;
      tint('burning', 900);
      pop({ x: a.x, y: foot - 30 }, glow(110, 'rgba(255,140,50,.75)'), 'fade-out', 900);
      particles({ x: a.x, y: foot - 10 }, 10, { html: () => flame(rnd(0.9, 1.5)), ang: [255, 285], dist: [80, 170], jx: a.w * 0.32, dur: 0.85, stagger: 0.045, cls: 'flick' });
      particles({ x: a.x, y: foot - 20 }, 8, { html: () => dot(rnd(1.5, 3), '#ffd27a', '#a0401a'), ang: [240, 300], dist: [90, 170], jx: a.w * 0.35, dur: 1, jitter: 0.3 });
      sfx('fire');
    },
    // снег: облако снежной пыли
    async snow(t) {
      const a = anchor(t);
      pop(a, glow(80, 'rgba(240,248,255,.95)'), 'fade-out', 450);
      particles(a, 12, { html: () => dot(rnd(4, 9), '#f4f9ff', '#8aa0c4'), dist: [30, 90], dur: 0.6, grav: 30, size: [0.8, 1.3] });
      particles(a, 5, { html: () => snowflake(rnd(5, 8)), dist: [50, 100], dur: 0.8, spin: 180 });
      sfx('snow'); shake(0.5);
    },
    // снежок из руки героя
    async snowball(t) {
      await fly(svg('-12 -12 24 24', `<circle r="10" fill="#f4f9ff" stroke="${O}" stroke-width="2.5"/><path d="M-5 -4 q3 -3 7 -2" stroke="#c9d8ee" stroke-width="2" fill="none"/>`, 30), 'hero', t, 300, { arc: 90, spin: 360 });
      return K.snow(t);
    },
    // метель: косые полосы снега через врага
    async blizzard(t) {
      const a = anchor(t);
      for (let i = 0; i < 7; i++) pop({ x: a.x - 160, y: a.y - 90 + i * 28 }, '<i class="streak"></i>', 'wind', 700).style.setProperty('--dl', `${i * 0.04}s`);
      await wait(200);
      return K.snow(t);
    },
    // лавина: снег рушится сверху
    async avalanche(t) {
      const a = anchor(t);
      particles({ x: a.x, y: a.y - 200 }, 14, { html: () => dot(rnd(8, 16), '#f4f9ff', '#8aa0c4'), ang: [80, 100], dist: [180, 240], jx: 110, dur: 0.5, stagger: 0.025 });
      await wait(380);
      shake(1.6);
      return K.snow(t);
    },
    // сосулька летит и разбивается
    async icicle(t) {
      await fly(svg('-30 -8 60 16', `<path d="M-28 0 L24 -6 Q30 0 24 6z" fill="#cfe6ff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><path d="M-10 -1 L18 -3" stroke="#fff" stroke-width="2"/>`, 70, 20), 'hero', t, 240, { aim: true });
      return K.shatter(t);
    },
    async shatter(t) {
      const a = anchor(t);
      tint('frosty', 700);
      particles(a, 10, { html: () => shard(rnd(10, 18), pick(['#cfe6ff', '#9fd0ff', '#ffffff'])), dist: [40, 110], dur: 0.55, spin: 300, grav: 40 });
      pop(a, starburst(28, '#e8f4ff'), 'boom', 380);
      sfx('ice'); shake(0.5);
    },
    // штемпель: круглый оттиск с волнами гашения
    async stamp(t) {
      const a = anchor(t);
      pop(a, svg('-60 -60 120 120', `<circle r="46" fill="rgba(255,240,230,.25)" stroke="#b8322c" stroke-width="7"/><circle r="34" fill="none" stroke="#b8322c" stroke-width="3" stroke-dasharray="6 5"/><path d="M-56 -8 q14 -10 28 0 t28 0 t28 0 t28 0 M-56 8 q14 -10 28 0 t28 0 t28 0 t28 0" fill="none" stroke="#b8322c" stroke-width="5"/><text y="6" text-anchor="middle" font-size="18" font-family="Kurale, serif" fill="#b8322c">${tr('ПОЧТА')}</text>`, 130), 'stamp', 900, rnd(-10, 10), rnd(-20, 0));
      await wait(150);
      sfx('stamp'); shake(1);
      particles(a, 6, { html: () => dot(rnd(2, 4), '#b8322c'), dist: [50, 80], dur: 0.4 });
    },
    // письмо: конверт летит и бьёт
    async letter(t, from = 'hero') {
      sfx('paper');
      await fly(envelope(44), from, t, 320, { arc: 60, spin: 540 });
      const a = anchor(t);
      pop(a, starburst(26), 'boom', 380);
      particles(a, 7, { html: () => svg('-6 -4 12 8', `<rect x="-5" y="-3" width="10" height="6" fill="#f2e6c9" stroke="${O}" stroke-width="1.5"/>`, 14, 10), dist: [40, 90], dur: 0.6, spin: 360, grav: 50 });
      sfx('bonk', 0.7); shake(0.4);
    },
    // звездопад: звёзды падают на врага
    async starfall(t) {
      const a = anchor(t);
      for (let i = 0; i < 5; i++) {
        const sx = a.x + rnd(-120, 120);
        const d = spawn(sx, a.y - 260, `<div class="trail">${star(rnd(10, 15))}</div>`, 'proj', 600);
        vars(d, { dx: `${a.x + rnd(-40, 40) - sx}px`, dy: `${260 + rnd(-30, 20)}px`, arc: '0px', r: '360deg', r0: '0deg', t: '.38s' });
        if (d) d.firstChild.style.animationDelay = `${i * 0.07}s`;
      }
      sfx('star');
      await wait(400);
      pop(a, glow(100, 'rgba(255,230,140,.9)'), 'fade-out', 500);
      particles(a, 10, { html: () => star(rnd(4, 7)), dist: [40, 110], dur: 0.6, spin: 200 });
      shake(0.8);
    },
    // луч: столб света сверху
    async beam(t) {
      const a = anchor(t);
      pop({ x: a.x, y: a.y - 120 }, '<i class="beamcol"></i>', 'beam', 800);
      sfx('beam');
      await wait(260);
      pop(a, glow(110, 'rgba(255,240,170,.95)'), 'fade-out', 600);
      particles(a, 8, { html: () => star(rnd(4, 7), '#fff6cf'), dist: [50, 110], dur: 0.6 });
      shake(0.8);
    },
    // корни и травы знахарки
    async roots(t) {
      const a = anchor(t); const foot = a.foot || a.y + 60;
      const vine = (x, h, flip) => pop({ x, y: foot - h / 2 }, svg(`0 0 40 ${h}`, `<path d="M20 ${h} C${flip ? 0 : 40} ${h * 0.7} ${flip ? 40 : 0} ${h * 0.35} 20 4" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M20 ${h} C${flip ? 0 : 40} ${h * 0.7} ${flip ? 40 : 0} ${h * 0.35} 20 4" fill="none" stroke="#6b8a3a" stroke-width="5" stroke-linecap="round"/>`, 40, h), 'vine', 900);
      vine(a.x - 60, 150, false); vine(a.x + 55, 130, true); vine(a.x - 5, 170, true);
      sfx('root');
      await wait(260);
      particles({ x: a.x, y: a.y }, 8, { html: () => leaf(rnd(12, 18)), dist: [40, 100], dur: 0.8, spin: 260, grav: 60 });
      shake(0.5);
    },
    // счастливая монетка летит в цель
    async coin(t) {
      sfx('coin');
      await fly(`<div><i class="flip">${coin(30)}</i></div>`, 'hero', t, 300, { arc: 110 });
      return K.bonk(t);
    },
    // скалка и мука
    async flour(t) {
      const a = anchor(t);
      particles(a, 10, { html: () => dot(rnd(5, 10), '#fbf6ea', '#c9b89a'), dist: [30, 80], dur: 0.7, up: 20, size: [0.8, 1.4] });
      return K.heavy(t);
    },
    // ярмарка: конфетти
    async confetti(t) {
      const a = anchor(t);
      const cs = ['#e8505a', '#ffd27a', '#6ac0e8', '#7fe08a', '#d6b0ff'];
      particles(a, 18, { html: (i) => svg('-4 -2 8 4', `<rect x="-4" y="-2" width="8" height="4" fill="${cs[i % 5]}" stroke="${O}" stroke-width="1"/>`, 12, 6), dist: [50, 130], dur: 0.9, spin: 720, up: 40, grav: 90 });
      sfx('fair');
      return K.bonk(t);
    },
    // пряник: крошки
    async crumbs(t) {
      const a = anchor(t);
      particles(a, 10, { html: () => crumb(rnd(8, 14), pick(['#c9873e', '#a86a2a', '#e0a860'])), dist: [40, 90], dur: 0.6, spin: 300, grav: 60 });
      sfx('crunch');
      return K.bonk(t);
    },
    // чернила: брызги кляксы
    async ink(t) {
      const a = anchor(t);
      particles(a, 9, { html: () => dot(rnd(3, 7), '#2a2f5a', '#0d0b18'), dist: [30, 80], dur: 0.5, grav: 40 });
      pop(a, svg('-30 -30 60 60', `<path d="M0 -20 q8 6 14 -2 q2 10 12 10 q-8 6 -2 14 q-10 0 -10 10 q-6 -8 -14 -2 q0 -10 -12 -10 q8 -6 2 -14 q10 2 10 -6z" fill="#2a2f5a" stroke="${O}" stroke-width="2.5"/>`, 70), 'boom', 450);
      sfx('splat');
    },
    // колючки в ответ
    async spikes(t) {
      const a = anchor(t);
      particles(a, 8, { html: () => svg('-6 -10 12 20', `<path d="M0 -9 L5 8 H-5z" fill="#8a6a4a" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`, 12, 20), dist: [30, 60], dur: 0.4 });
      sfx('thorns');
      return K.bonk(t);
    },
    // Вспышка Огоньков (вызывается из burst в игре — свой огненный круг)
    async flash(t) {
      const a = anchor(t);
      pop(a, '<i class="ring"></i>', 'ringout', 600);
      particles(a, 10, { html: () => flame(rnd(0.5, 0.8)), dist: [60, 130], dur: 0.6, cls: 'flick' });
      shake(1.2);
    },

    /* ---------- состояния и усиления ---------- */
    async shield() {
      const a = anchor('hero');
      pop(a, svg('-30 -34 60 68', `<path d="M0 -30 L26 -20 V2 Q26 22 0 32 Q-26 22 -26 2 V-20z" fill="#5b8fd0" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M0 -22 L18 -15 V2 Q18 16 0 24 Q-18 16 -18 2 V-15z" fill="none" stroke="#cfe2ff" stroke-width="3"/><path d="M-12 -12 q8 -4 14 -4" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`, 70, 80), 'shieldpop', 800, 0, -50);
      pop(a, glow(60, 'rgba(140,190,255,.7)'), 'fade-out', 500, 0, -50);
    },
    async heal(t = 'hero') {
      const a = anchor(t);
      pop(a, glow(60, 'rgba(120,230,140,.7)'), 'fade-out', 600, 0, -20);
      particles({ x: a.x + 10, y: a.y - 10 }, 10, { html: (i) => (i % 2 ? plus(rnd(18, 26)) : star(rnd(6, 9), '#d8ffd0')), ang: [245, 295], dist: [80, 150], jx: 34, dur: 1, stagger: 0.05 });
    },
    async heart() {
      const a = anchor('hero');
      pop(a, heart(46), 'riseup', 1000, 0, -40);
      K.heal();
    },
    // Огонёк перелетает к лампе героя
    async flamelet() {
      const lamp = anchor('lamp');
      await fly(flame(0.7), { x: 200, y: 520 }, lamp, 300, { arc: 40, cls: 'flick' });
      pop(lamp, glow(40, 'rgba(255,190,80,.9)'), 'fade-out', 400);
    },
    async burnApply(t = 'enemy') { return K.fire(t); },
    async weak(t = 'enemy') {
      const a = anchor(t);
      tint('withered', 900);
      pop({ x: a.x, y: a.y - 60 }, svg('-30 -30 60 60', `<path d="M0 -4 a6 6 0 1 1 6 6 a12 12 0 1 1 -12 -12 a18 18 0 1 1 18 18" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M0 -4 a6 6 0 1 1 6 6 a12 12 0 1 1 -12 -12 a18 18 0 1 1 18 18" fill="none" stroke="#b08ae0" stroke-width="3" stroke-linecap="round"/>`, 60), 'spin', 900);
      particles({ x: a.x, y: a.y - 40 }, 6, { html: () => drop(rnd(10, 14), '#9a6ad0'), ang: [80, 100], dist: [80, 130], jx: 50, dur: 0.8, stagger: 0.06 });
      sfx('weak');
    },
    async vuln(t = 'enemy') {
      const a = anchor(t);
      pop(a, svg('-60 -60 120 120', `<path d="M-6 -50 L4 -22 L-10 -4 L8 14 L-2 48 M4 -22 L26 -30 M-10 -4 L-34 4 M8 14 L32 22" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 -50 L4 -22 L-10 -4 L8 14 L-2 48 M4 -22 L26 -30 M-10 -4 L-34 4 M8 14 L32 22" fill="none" stroke="#ffd0c0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`, 130), 'crack', 900);
      particles(a, 6, { html: () => shard(rnd(8, 12), '#ffd0c0'), dist: [40, 80], dur: 0.5 });
      sfx('crack');
    },
    async frost(t = 'enemy') {
      const a = anchor(t);
      tint('frosty', 1000);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        pop({ x: a.x + Math.cos(ang) * 70, y: a.y + Math.sin(ang) * 80 }, snowflake(rnd(10, 15)), 'flakepop', 900).style.setProperty('--dl', `${i * 0.05}s`);
      }
      pop(a, glow(100, 'rgba(170,215,255,.6)'), 'fade-out', 700);
      sfx('frost');
    },
    async sleep(t = 'enemy') {
      const a = anchor(t);
      for (let i = 0; i < 3; i++) pop({ x: a.x + 30 + i * 14, y: a.y - 70 - i * 6 }, zzz(22 + i * 8), 'zrise', 1200).style.setProperty('--dl', `${i * 0.2}s`);
      particles({ x: a.x, y: a.y - 70 }, 5, { html: () => star(rnd(5, 7), '#fff6cf'), dist: [40, 60], dur: 1, spin: 180 });
      sfx('sleep');
    },
    async energy() {
      const a = anchor('energy');
      pop(a, '<i class="ring teal"></i>', 'ringout', 500);
      particles(a, 8, { html: () => svg('-6 -10 12 20', `<path d="M2 -9 L-4 1 H1 L-2 9 L5 -2 H0z" fill="#ffe38a" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>`, 14, 22), dist: [30, 60], dur: 0.5 });
      sfx('zap');
    },
    async aura() {
      const a = anchor('hero');
      pop(a, glow(70, 'rgba(255,120,60,.75)'), 'fade-out', 700, 0, -20);
      particles({ x: a.x, y: a.y + 20 }, 9, { html: () => '<i class="flare"></i>', ang: [265, 275], dist: [70, 120], jx: 34, dur: 0.7, stagger: 0.04 });
      sfx('aura');
    },
    async thorns() {
      const a = anchor('hero');
      pop(a, svg('-50 -50 100 100', Array.from({ length: 12 }, (_, i) => `<path d="M0 -44 L6 -28 H-6z" transform="rotate(${i * 30})" fill="#8a6a4a" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`).join(''), 110), 'spikering', 800, 0, -6);
      sfx('thorns');
    },
    async gold(t = 'hero') {
      const a = anchor(t);
      particles({ x: a.x + 10, y: a.y - 20 }, 8, { html: () => `<div><i class="flip">${coin(rnd(24, 32))}</i></div>`, ang: [235, 305], dist: [70, 120], up: 70, grav: 90, dur: 0.9, stagger: 0.04 });
      sfx('coin');
    },
    async deliver() {
      sfx('paper');
      await fly(envelope(40), 'hero', { x: 430, y: 330 }, 520, { arc: 80, spin: 30 });
    },
    // Доставка прибыла: конверт прилетает из-за края экрана
    async arrive(t) { return K.letter(t, { x: 430, y: 300 }); },
    async sigil(art) {
      const a = anchor('hero');
      pop({ x: a.x + 40, y: a.y - 110 }, `<div class="sigil"><i class="ring gold"></i>${art ? icon(art, 46) : ''}</div>`, 'sigilpop', 1000);
      sfx('sigil');
    },
    async clock() {
      const a = { x: 200, y: 480 };
      pop(a, svg('-40 -40 80 80', `<circle r="34" fill="#f2e6c9" stroke="${O}" stroke-width="4"/><circle r="27" fill="none" stroke="#c9a46a" stroke-width="2" stroke-dasharray="2 5.07"/><path d="M0 0 V-22" stroke="${O}" stroke-width="4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".5s" repeatCount="indefinite"/></path><path d="M0 0 H14" stroke="${O}" stroke-width="4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></path><circle r="3.5" fill="#c8423a"/>`, 96), 'clockpop', 1100);
      sfx('chime');
    },
    async mirror() {
      pop({ x: 200, y: 480 }, '<i class="sheen"></i>', 'sheenpass', 700);
      sfx('mirror');
    },
    async cards() {
      particles({ x: 340, y: 800 }, 4, { html: () => svg('0 0 20 28', `<rect x="1" y="1" width="18" height="26" rx="3" fill="#2a3150" stroke="${O}" stroke-width="2"/><rect x="4" y="4" width="12" height="20" rx="2" fill="none" stroke="#e6c45a" stroke-width="1.5"/>`, 22, 30), ang: [200, 250], dist: [100, 160], dur: 0.5, stagger: 0.06 });
      sfx('paper');
    },
    async ginger() {
      particles({ x: 200, y: 520 }, 3, { html: () => icon('gingerbread', 40), ang: [70, 110], dist: [60, 110], dur: 0.6, stagger: 0.08, spin: 40 });
      sfx('oven');
    },
    async sugar() {
      particles({ x: 200, y: 640 }, 16, { html: () => star(rnd(6, 10), '#ffffff'), dist: [40, 150], jx: 130, jy: 40, dur: 0.9, jitter: 0.3, spin: 180 });
      sfx('sugar');
    },
    async grind() {
      const a = { x: 200, y: 600 };
      pop(a, `<div class="wheel">${icon('grindwheel', 54)}</div>`, 'wheelpop', 800, 0, -20);
      particles(a, 14, { html: () => dot(rnd(1.6, 3), '#ffe38a', '#a0501a'), ang: [190, 350], dist: [60, 140], dur: 0.6, grav: 70 });
      sfx('grind');
    },
    async growl() {
      const a = anchor('hero');
      pop(a, `<div class="growl">${sized(window.Art.dog({ bark: true }), 64)}${svg('-20 -20 40 40', `<path d="M-14 -6 L-4 -2 M-6 -14 L-2 -4 M6 -14 L2 -4 M14 -6 L4 -2" stroke="#e8505a" stroke-width="4" stroke-linecap="round"/>`, 34)}</div>`, 'growlpop', 900, 26, -90);
      sfx('growl');
    },
    // Дружок прыгает на врага и кусает
    async bite(t = 'enemy') {
      sfx('bark');
      await fly(sized(window.Art.dog({ bark: true }), 70), 'hero', t, 330, { arc: 120, spin: 20, r0: -20 });
      const a = anchor(t);
      const teeth = (top) => `<svg viewBox="0 0 120 30" style="width:130px;height:32px" class="${top ? 'jtop' : 'jbot'}"><path d="${top ? 'M0 0 H120 V6 L110 24 L100 6 L90 24 L80 6 L70 24 L60 6 L50 24 L40 6 L30 24 L20 6 L10 24 L0 6z' : 'M0 30 H120 V24 L110 6 L100 24 L90 6 L80 24 L70 6 L60 24 L50 6 L40 24 L30 6 L20 24 L10 6 L0 24z'}" fill="#ffffff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`;
      pop(a, `<div class="jaws">${teeth(true)}${teeth(false)}</div>`, 'jawpop', 600);
      await wait(150);
      sfx('bite'); shake(0.9);
      pop(a, svg('-40 -20 80 40', `<path d="M-30 -6 q30 18 60 0 M-26 8 q26 14 52 0" fill="none" stroke="#c8423a" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 6"/>`, 90, 45), 'fade-out slow', 900, 0, 10);
    },
    // Цена знахарки: капли крови уходят в травы
    async price() {
      const a = anchor('hero');
      particles({ x: a.x, y: a.y - 20 }, 6, { html: () => drop(rnd(10, 14), '#c8323a'), ang: [250, 290], dist: [60, 100], jx: 20, dur: 0.7, stagger: 0.05 });
      pop(a, glow(60, 'rgba(220,40,60,.55)'), 'fade-out', 600);
      sfx('heartbeat');
    },
    // по герою попали: следы когтей
    async claw() {
      const a = anchor('hero');
      pop(a, svg('-40 -40 80 80', `<path d="M-24 -26 L14 22 M-10 -32 L26 14 M4 -34 L34 4" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M-24 -26 L14 22 M-10 -32 L26 14 M4 -34 L34 4" stroke="#ffe0dc" stroke-width="4" stroke-linecap="round"/>`, 90), 'clawmark', 500);
    },
    // ноты: свисток, рожок, колыбельная, вой
    async notes(snd) {
      const a = anchor('hero');
      particles({ x: a.x + 20, y: a.y - 40 }, 6, { html: (i) => note(rnd(16, 24), i % 2 ? '#f3d27c' : '#cfe6ff'), ang: [270, 330], dist: [80, 150], dur: 1, stagger: 0.08, spin: 30 });
      pop({ x: a.x + 20, y: a.y - 30 }, '<i class="ring wave"></i>', 'ringout', 700);
      if (snd) sfx(snd);
    },
    // пар от горячего напитка
    async steam() {
      const a = anchor('hero');
      for (let i = 0; i < 3; i++) pop({ x: a.x - 18 + i * 22, y: a.y - 60 }, svg('0 0 20 60', `<path d="M10 58 q-10 -12 0 -24 q10 -12 0 -26" fill="none" stroke="${O}" stroke-width="8" stroke-linecap="round" opacity=".35"/><path d="M10 58 q-10 -12 0 -24 q10 -12 0 -26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`, 30, 90), 'steamrise', 1100).style.setProperty('--dl', `${i * 0.12}s`);
      pop(a, glow(60, 'rgba(255,220,170,.6)'), 'fade-out', 700, 0, -30);
      sfx('sip');
    },
    // ветер в спину: полосы ветра
    async wind() {
      for (let i = 0; i < 5; i++) pop({ x: -40, y: 520 + i * 40 }, '<i class="streak wide"></i>', 'wind', 700).style.setProperty('--dl', `${i * 0.05}s`);
      sfx('wind');
    },
    async parcel() {
      sfx('paper');
      await fly(icon('parcel', 44), 'hero', { x: 430, y: 330 }, 520, { arc: 90, spin: 40 });
    },
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* Талисман сработал: его значок всплывает над героем или врагом. Очередь, чтобы не налезали друг на друга. */
  const relicQ = [];
  let relicBusy = false;
  function relic(art, name, where = 'hero') {
    relicQ.push({ art, name, where });
    if (!relicBusy) nextRelic();
  }
  function nextRelic() {
    const r = relicQ.shift();
    if (!r) { relicBusy = false; return; }
    relicBusy = true;
    const a = r.where === 'enemy' ? anchor('enemy') : anchor('hero');
    const at = r.where === 'enemy' ? { x: a.x + 90, y: a.y - 80 } : { x: a.x + 60, y: a.y - 120 };
    pop(at, `<div class="relicpop"><i class="rays"></i><span>${icon(r.art, 44)}</span><b>${r.name}</b></div>`, 'relicup', 1100);
    sfx('proc');
    setTimeout(nextRelic, fast() ? 180 : 330);
  }

  async function play(kind, target) {
    const f = K[kind];
    if (!f || !$('#screen .fxlayer')) return;
    try { await f(target); } catch (e) { /* анимация не должна ломать бой */ }
  }

  window.FX = { play, relic, shake, kinds: Object.keys(K) };
})();
