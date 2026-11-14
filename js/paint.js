/* Нарисованная графика (Higgsfield) поверх процедурной SVG.
   Список готовых картинок лежит в js/assets.js (window.ASSETS). Если картинки нет,
   остаётся прежний SVG-рисунок, поэтому игра работает и без папки assets/.
   Картинки вставляются как <image> внутри <svg>: так продолжают работать все
   CSS-правила и анимации, написанные для SVG (.enemy > svg, .cxpic svg и т. д.). */
(function () {
  const A = window.ASSETS;
  const Art = window.Art;
  if (!A || !Art) return;
  const base = A.base || 'assets/';
  const ver = A.v ? `?v=${A.v}` : '';
  const S = {};
  ['hero', 'face', 'enemy', 'relic', 'card', 'st', 'intent', 'icon', 'bg', 'pic'].forEach((k) => { S[k] = new Set(A[k] || []); });
  const url = (p) => `${base}${p}.webp${ver}`;
  const NS = 'xmlns="http://www.w3.org/2000/svg"';
  function pic(p, vb, cls, fit = 'xMidYMid meet', attrs = '') {
    const [, , w, h] = vb.split(' ');
    return `<svg class="${cls} painted" viewBox="${vb}" ${NS} ${attrs}><image href="${url(p)}" width="${w}" height="${h}" preserveAspectRatio="${fit}"/></svg>`;
  }
  const D = () => window.Data || {};
  const orig = { hero: Art.hero, enemy: Art.enemy, icon: Art.icon, intentIcon: Art.intentIcon, background: Art.background };

  /* ---------- Герои ---------- */
  // во весь рост: та же рамка 200×270, что у SVG-героя, ноги внизу
  Art.hero = (look = 'lamp') => (S.hero.has(look) ? pic(`h/${look}`, '0 0 200 270', 'hero', 'xMidYMax meet') : orig.hero(look));
  // портрет по плечи для маленьких окошек
  Art.face = (look = 'lamp') => (S.face.has(look) ? pic(`h/${look}_face`, '0 0 100 100', 'face', 'xMidYMin slice') : orig.hero(look));

  /* ---------- Враги ---------- */
  Art.enemy = (id) => (S.enemy.has(id) ? pic(`e/${id}`, '0 0 100 100', 'foe', 'xMidYMax meet') : orig.enemy(id));

  /* ---------- Значки ---------- */
  const ICON_ALIAS = { dogfriend: 'buddy' };
  Art.relic = (id) => {
    if (S.relic.has(id)) return pic(`r/${id}`, '0 0 100 100', 'icon');
    const r = (D().RELICS || {})[id];
    return orig.icon(r ? r.art : id);
  };
  Art.card = (id) => {
    if (S.card.has(id)) return pic(`c/${id}`, '0 0 100 100', 'icon card-pic', 'xMidYMid slice');
    const c = (D().CARDS || {})[id];
    return orig.icon(c ? c.art : id);
  };
  Art.icon = (name) => {
    if (typeof name === 'string') {
      if (name.startsWith('r:')) return Art.relic(name.slice(2));
      if (name.startsWith('c:')) return Art.card(name.slice(2));
      const k = ICON_ALIAS[name] || name;
      if (S.icon.has(k)) return pic(`i/${k}`, '0 0 100 100', 'icon');
    }
    return orig.icon(name);
  };
  Art.intentIcon = (kind) => (S.intent.has(kind) ? pic(`it/${kind}`, '0 0 40 40', 'intent-ico') : orig.intentIcon(kind));
  // значок статуса для фишек под врагом и героем; пустая строка, если картинки нет
  Art.status = (k) => (k && S.st.has(k) ? pic(`st/${k}`, '0 0 100 100', 'icon st-ico') : '');

  /* ---------- Иллюстрации: события, книга, концовки ---------- */
  const EVENT_PIC = { well: 'ev_well', puppet: 'ev_puppet', lantern: 'ev_lantern', snowman: 'ev_snowman', coin: 'ev_coins', whetstone: 'ev_smith', stampbook: 'ev_postoffice', frostglass: 'ev_icemirror', showbooth: 'ev_showbooth' };
  Art.eventPic = (art) => {
    const k = EVENT_PIC[art];
    return k && S.pic.has(k) ? `<img class="ev-pic" src="${url(`pic/${k}`)}" alt="">` : '';
  };
  Art.storyPic = (k) => (S.pic.has(k) ? `<img class="story-pic" src="${url(`pic/${k}`)}" alt="">` : '');
  Art.hasPic = (k) => S.pic.has(k);

  /* ---------- Фон ---------- */
  // ключевые кадры по стадиям; между соседними кадрами плавный переход
  const KEYS = {
    town: ['bg_stage1_town_day', 'bg_stage1_town_mid', 'bg_stage1_town_sunset'],
    outskirts: ['bg_stage2_outskirts_start', 'bg_stage2_outskirts_mid', 'bg_stage2_outskirts_night'],
    night: ['bg_stage2_outskirts_mid', 'bg_stage2_outskirts_night'],
  };
  const SCENE = { rest: 'scene_campfire', shop: 'scene_shop', chest: 'scene_chest', talk: 'scene_talk', meet: 'scene_meet', final: 'bg_final_house', title: 'bg_title' };
  // картинка 752×1344 растягивается по высоте экрана (400×860), бока срезаются
  const BW = 481; const BH = 860; const BX = (400 - BW) / 2;
  function layer(k, op = 1) {
    return `<image href="${url(`bg/${k}`)}" x="${BX}" y="0" width="${BW}" height="${BH}" preserveAspectRatio="xMidYMid slice"${op < 1 ? ` opacity="${op.toFixed(3)}"` : ''}/>`;
  }
  function paintBg(a, b, mix) {
    const c = (A.bgc || {})[mix > 0.5 && b ? b : a] || '#2a3350';
    return `<svg class="bg-svg painted" viewBox="0 0 400 860" ${NS}>
      <defs><linearGradient id="bgFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <g class="bg-cam">
        <rect y="-300" width="400" height="1600" fill="${c}"/>
        ${layer(a)}${b && mix > 0.001 ? layer(b, mix) : ''}
        <rect y="${BH - 90}" width="400" height="91" fill="url(#bgFade)"/>
      </g></svg>`;
  }
  /* opts: { scene: 'town'|'outskirts'|'night', t: 0..1 внутри стадии } или { place: 'rest'|'shop'|…|'final'|'title' } */
  Art.paintedBg = (opts = {}) => {
    if (opts.place) {
      const k = SCENE[opts.place];
      return k && S.bg.has(k) ? paintBg(k) : null;
    }
    const keys = (KEYS[opts.scene] || KEYS.town).filter((k) => S.bg.has(k));
    if (!keys.length) return null;
    if (keys.length === 1) return paintBg(keys[0]);
    const x = Math.max(0, Math.min(1, opts.t || 0)) * (keys.length - 1);
    const i = Math.min(keys.length - 2, Math.floor(x));
    return paintBg(keys[i], keys[i + 1], x - i);
  };

  /* ---------- Живые враги: раскадровки из роликов ---------- */
  // Кадры рисуются на <canvas>: холст хранит последний кадр, поэтому враг не мигает
  // и не пропадает, пока браузер готовит картинку. Атласы грузятся заранее.
  const AN = A.anim || {};
  const imgs = {}; // url -> Image (готова, когда .ok)
  function load(u) {
    if (imgs[u]) return imgs[u];
    const im = new Image();
    imgs[u] = im;
    im.ok = false;
    const done = () => { im.ok = true; };
    im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); };
    im.src = u;
    return im;
  }
  const atlasUrl = (id, part) => url(`${A.ea || 'ea'}/${id}_${part}`); // папка меняется при пересборке атласов
  Art.hasLive = (id) => !!(AN[id] && AN[id].idle);
  Art.enemyLive = (id) => {
    const m = AN[id];
    if (!m || !m.idle || !S.enemy.has(id)) return Art.enemy(id);
    load(url(`e/${id}`));
    load(atlasUrl(id, 'idle'));
    if (m.act) load(atlasUrl(id, 'act'));
    return `<canvas class="foe painted live" data-live="${id}"></canvas>`;
  };
  // разыграть движение: attack | hurt | death | happy; speed 2 — ускоренный режим.
  // Возвращает мс до самой сильной позы (удара) при обычной скорости
  Art.act = (el, kind, speed = 1) => {
    const cv = el && (el.matches && el.matches('canvas.live') ? el : el.querySelector && el.querySelector('canvas.live'));
    if (!cv) return 0;
    const id = cv.dataset.live; const m = AN[id];
    const a = m && m.act && m.act[kind];
    const st = cv._sp || (cv._sp = { t: performance.now() });
    if (st.dead) return 0;
    if (kind === 'death') st.dead = true; // после гибели покой больше не играем
    if (!a || !load(atlasUrl(id, 'act')).ok) return 0;
    st.act = kind; st.t0 = performance.now(); st.sp = speed;
    return Math.round(((a.hit || 0) / a.fps) * 1000);
  };
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const k = Math.min(2, (r.width / (cv.clientWidth || r.width)) * (window.devicePixelRatio || 1));
    const w = Math.round((cv.clientWidth || r.width) * k);
    const h = Math.round((cv.clientHeight || r.height) * k);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv._key = ''; }
    return true;
  }
  function paint(cv, layers) {
    // layers: [{im, sx, sy, s, alpha}] — кадр квадратный, вписан по ширине и прижат к низу
    const key = layers.map((l) => `${l.im.src}|${l.sx}|${l.sy}|${l.alpha}`).join(';');
    if (cv._key === key) return;
    cv._key = key;
    const W = cv.width; const H = cv.height; const d = Math.min(W, H);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    for (const l of layers) {
      ctx.globalAlpha = l.alpha == null ? 1 : l.alpha;
      ctx.drawImage(l.im, l.sx, l.sy, l.s, l.s, (W - d) / 2, H - d, d, d);
    }
    ctx.globalAlpha = 1;
  }
  const frameOf = (m, im, i) => ({ im, sx: (i % m.cols) * m.fs, sy: Math.floor(i / m.cols) * m.fs, s: m.fs });
  function tick(now) {
    const list = document.querySelectorAll('canvas.live');
    for (const cv of list) {
      if (!fitCanvas(cv)) continue;
      const id = cv.dataset.live; const m = AN[id];
      const st = cv._sp || (cv._sp = { t: now });
      const idle = imgs[atlasUrl(id, 'idle')]; const act = imgs[atlasUrl(id, 'act')];
      const still = imgs[url(`e/${id}`)];
      if (st.act && act && act.ok) {
        const a = m.act[st.act];
        const k = Math.floor(((now - st.t0) / 1000) * a.fps * (st.sp || 1));
        if (k < a.n || st.dead) { paint(cv, [frameOf(m, act, a.o + Math.min(k, a.n - 1))]); continue; }
        st.act = null;
      }
      if (st.dead) continue;
      if (idle && idle.ok) {
        const k = Math.floor(((now - st.t) / 1000) * m.idle.fps) % m.idle.n;
        paint(cv, [frameOf(m, idle, k)]);
      } else if (still && still.ok) {
        paint(cv, [{ im: still, sx: 0, sy: 0, s: still.naturalWidth }]);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
