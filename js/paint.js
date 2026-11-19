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
  // Под ногами у нарисованных врагов бывает пустая полоска: картинку сдвигаем вниз на неё,
  // чтобы ноги стояли ровно на нижнем краю рамки (а рамка стоит на снегу).
  // Летающие и парящие враги остаются в воздухе, под ними только тень.
  const ALOFT = new Set(['bat', 'lampghost', 'mist', 'skywhale', 'wisp', 'icicle', 'laundress']);
  const footOf = (id) => (ALOFT.has(id) ? 1 : Math.min(1, (A.foot || {})[id] || 1));
  Art.aloft = (id) => ALOFT.has(id);
  Art.enemy = (id) => {
    if (!S.enemy.has(id)) return orig.enemy(id);
    const dy = ((1 - footOf(id)) * 100).toFixed(1);
    return `<svg class="foe painted${ALOFT.has(id) ? ' aloft' : ''}" viewBox="0 0 100 100" ${NS}><image href="${url(`e/${id}`)}" y="${dy}" width="100" height="100" preserveAspectRatio="xMidYMax meet"/></svg>`;
  };

  /* ---------- Нарисованный интерфейс (assets/ui) ----------
     Рамки карт, свитки ответов, кнопки и панели. CSS берёт картинки из переменных --ui-<имя>
     и включает их только при классе .skin на #app (раздел «Нарисованный интерфейс» в style.css). */
  const UI = new Set(A.ui || []);
  const app = document.getElementById('app');
  if (UI.size && app) {
    app.classList.add('skin');
    // полный адрес: относительный в переменной браузер считал бы от папки css/
    UI.forEach((n) => app.style.setProperty(`--ui-${n}`, `url("${new URL(url(`${A.uid || 'ui'}/${n}`), document.baseURI).href}")`));
  }

  /* ---------- Значки ---------- */
  // значки без своей картинки берут нарисованный талисман или карту с тем же смыслом
  const ICON_ALIAS = { dogfriend: 'buddy', lantern: 'r:ivalamp' };
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
  // есть ли нарисованная картинка с таким именем (значок, талисман или карта)
  Art.hasIcon = (k) => S.icon.has(k) || S.relic.has(k) || S.card.has(k);
  Art.icon = (name) => {
    if (typeof name === 'string') {
      if (name.startsWith('r:')) return Art.relic(name.slice(2));
      if (name.startsWith('c:')) return Art.card(name.slice(2));
      const k = ICON_ALIAS[name] || name;
      if (k !== name && /^[rc]:/.test(k)) return Art.icon(k);
      if (S.icon.has(k)) return pic(`i/${k}`, '0 0 100 100', 'icon');
      // значок с именем талисмана или карты (достижения, события, лавка): их нарисованная картинка
      if (S.relic.has(k)) return Art.relic(k);
      if (S.card.has(k)) return Art.card(k);
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
  // заставка сама раскладывает фон в кадре, ей нужен только адрес картинки
  Art.bgUrl = (n) => (S.bg.has(n) ? url(`bg/${n}`) : '');
  Art.enemyUrl = (id) => (S.enemy.has(id) ? url(`e/${id}`) : '');

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
  // Где на картинке снег перед домами, куда можно поставить персонажа (y на экране 400×860 без сдвига).
  // По этой линии «камера» опускается так, чтобы ноги героя или врага стояли на земле.
  const FEET = {
    bg_stage1_town_day: 690, bg_stage1_town_mid: 690, bg_stage1_town_sunset: 690,
    bg_stage2_outskirts_start: 660, bg_stage2_outskirts_mid: 670, bg_stage2_outskirts_night: 685,
    bg_final_house: 650, bg_title: 700, scene_talk: 700, scene_meet: 715, scene_shop: 515,
    scene_campfire: 700, scene_chest: 690,
  };
  function paintBg(a, b, mix) {
    const c = (A.bgc || {})[mix > 0.5 && b ? b : a] || '#2a3350';
    const fa = FEET[a] || 690; const feet = b && mix > 0.001 ? fa + ((FEET[b] || 690) - fa) * mix : fa;
    return `<svg class="bg-svg painted" viewBox="0 0 400 860" data-feet="${feet.toFixed(0)}" ${NS}>
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
    // Картинки стадии нарисованы с разных точек: наплыв одной на другую давал двойное изображение
    // (два ряда фонарей и домов сразу). Поэтому стадия делится на равные отрезки, в каждом своя картинка целиком.
    const i = Math.min(keys.length - 1, Math.floor(Math.max(0, Math.min(1, opts.t || 0)) * keys.length));
    return paintBg(keys[i]);
  };

  // Опустить камеру: снег с картинки встаёт под ноги персонажа на высоте y (экран 400×860).
  // y = null возвращает обычный вид. Вверх фон не сдвигаем, чтобы над ним не открылась пустота.
  Art.groundCam = (root, y) => {
    const sv = root && root.querySelector('svg.bg-svg.painted');
    const g = sv && sv.querySelector('.bg-cam');
    if (!g) return false;
    const ty = y == null ? 0 : Math.min(0, y - (+sv.dataset.feet || 690));
    g.style.transform = ty ? `translateY(${ty.toFixed(1)}px)` : '';
    return true;
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
    im.ok = false; im.u = u;
    const done = () => { im.ok = true; };
    const plain = () => { im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); }; im.src = u; };
    // Атлас берём готовой растровой копией: файл расшифровывается в фоне, а не в кадре.
    // Обычную картинку браузер расшифровывал при первом показе каждого атласа, и на слабом телефоне
    // бой замирал на четверть секунды в начале и на первом ударе.
    if (window.createImageBitmap && window.fetch && u.includes(`/${A.ea || 'ea'}/`)) {
      fetch(u).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('нет файла')))).then((b) => createImageBitmap(b)).then((bmp) => {
        if (imgs[u] === im) im.bmp = bmp; else if (bmp.close) bmp.close(); // пока готовили, атлас уже выгрузили
        done();
      }, plain);
    } else plain();
    return im;
  }
  const pix = (im) => im.bmp || im;
  const atlasUrl = (id, part) => url(`${A.ea || 'ea'}/${id}_${part}`); // папка меняется при пересборке атласов
  Art.hasLive = (id) => !!(AN[id] && AN[id].idle);
  // атласы прежних врагов выгружаем: каждый занимает в памяти десятки мегабайт
  function keepOnly(ids) {
    for (const u of Object.keys(imgs)) {
      if (u.includes(`/${A.ea || 'ea'}/`) && !ids.some((i) => u.includes(`/${i}_`))) {
        if (imgs[u].bmp && imgs[u].bmp.close) imgs[u].bmp.close();
        delete imgs[u];
      }
    }
  }
  const parts = (m) => [...new Set(Object.values(m.act || {}).map((a) => a.f || 'act'))];
  Art.enemyLive = (id) => {
    const m = AN[id];
    if (!m || !m.idle || !S.enemy.has(id)) return Art.enemy(id);
    keepOnly([id, ...[...document.querySelectorAll('canvas.live')].map((c) => c.dataset.live)]);
    load(url(`e/${id}`));
    load(atlasUrl(id, m.idle.f || 'idle'));
    parts(m).forEach((p) => load(atlasUrl(id, p)));
    return `<canvas class="foe painted live${ALOFT.has(id) ? ' aloft' : ''}" data-live="${id}"></canvas>`;
  };
  const liveOf = (el) => el && (el.matches && el.matches('canvas.live') ? el : el.querySelector && el.querySelector('canvas.live'));
  // длина движения в тиках: кадры идут по списку seq (вперёд к удару и обратно, у гибели кадр может держаться два тика)
  const ticks = (a) => (a.seq ? a.seq.length : a.n);
  // Плавность. Положение в раскадровке дробное: между соседними кадрами рисуется их смесь, поэтому покой
  // из 12 кадров в секунду и движения из 30–36 идут без ступенек на экране с любой частотой. При смене
  // движения прежняя картинка растворяется в новой: нет скачка из позы покоя в начало атаки и обратно.
  const FADE_IN = 80; const FADE_OUT = 160; // мс при обычной скорости
  function snapshot(cv, st, ms) {
    if (!cv._key || !cv.width || !cv.height) return; // на холсте ещё ничего нет
    const s = st.snap || (st.snap = document.createElement('canvas'));
    if (s.width !== cv.width || s.height !== cv.height) { s.width = cv.width; s.height = cv.height; }
    const c = s.getContext('2d');
    c.clearRect(0, 0, s.width, s.height);
    c.drawImage(cv, 0, 0);
    st.x0 = performance.now(); st.xd = ms;
  }
  // сколько мс займёт движение целиком; 0, если его нет или атлас ещё не загрузился
  Art.actDur = (el, kind, speed = 1) => {
    const cv = liveOf(el); const m = cv && AN[cv.dataset.live];
    const a = m && m.act && m.act[kind];
    if (!a || !load(atlasUrl(cv.dataset.live, a.f || 'act')).ok) return 0;
    return Math.round((ticks(a) / a.fps / speed) * 1000);
  };
  // разыграть движение: attack | hurt | death | happy; speed 2 — ускоренный режим.
  // Возвращает мс до самой сильной позы (удара) при обычной скорости
  Art.act = (el, kind, speed = 1) => {
    const cv = liveOf(el);
    if (!cv) return 0;
    const id = cv.dataset.live; const m = AN[id];
    const a = m && m.act && m.act[kind];
    const st = cv._sp || (cv._sp = { t: performance.now() });
    if (st.dead) return 0;
    if (kind === 'death') st.dead = true; // после гибели покой больше не играем
    if (!a || !load(atlasUrl(id, a.f || 'act')).ok) return 0;
    snapshot(cv, st, FADE_IN / speed);
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
  function paint(cv, st, now, layers) {
    // layers: [{im, sx, sy, s, w}] — кадр квадратный, вписан по ширине, ноги на нижнем краю; w — доля кадра в смеси
    let old = 0; // доля прежней картинки, пока идёт переход
    if (st.xd) {
      const u = (now - st.x0) / st.xd;
      if (u >= 1 || !st.snap) st.xd = 0; else old = 1 - u * u * (3 - 2 * u);
    }
    layers = layers.filter((l) => l.w > 0.004);
    const key = `${old.toFixed(3)};${layers.map((l) => `${l.im.u}|${l.sx}|${l.sy}|${l.w.toFixed(3)}`).join(';')}`;
    if (cv._key === key) return;
    cv._key = key;
    st.pt = now;
    const W = cv.width; const H = cv.height; const d = Math.min(W, H);
    const fy = H - d * footOf(cv.dataset.live);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // сложение с весами даёт честную смесь и цвета, и прозрачности (обычное наложение оставляло бы «призрак» старого кадра)
    const mix = old > 0 || layers.length > 1;
    if (mix) ctx.globalCompositeOperation = 'lighter';
    if (old > 0) { ctx.globalAlpha = old; ctx.drawImage(st.snap, 0, 0, W, H); }
    for (const l of layers) {
      ctx.globalAlpha = mix ? l.w * (1 - old) : 1;
      ctx.drawImage(pix(l.im), l.sx, l.sy, l.s, l.s, (W - d) / 2, fy, d, d);
    }
    ctx.globalAlpha = 1;
    if (mix) ctx.globalCompositeOperation = 'source-over';
  }
  const frameOf = (m, im, i, w = 1) => ({ im, sx: (i % m.cols) * m.fs, sy: Math.floor(i / m.cols) * m.fs, s: m.fs, w });
  // два соседних кадра с долями (1 − f) и f
  const blend = (m, im, i, j, f) => (f > 0 && i !== j ? [frameOf(m, im, i, 1 - f), frameOf(m, im, j, f)] : [frameOf(m, im, i)]);
  function tick(now) {
    const list = document.querySelectorAll('canvas.live');
    for (const cv of list) {
      if (!fitCanvas(cv)) continue;
      const id = cv.dataset.live; const m = AN[id];
      const st = cv._sp || (cv._sp = { t: now });
      const idle = imgs[atlasUrl(id, m.idle.f || 'idle')];
      const still = imgs[url(`e/${id}`)];
      const a = st.act && m.act[st.act];
      const act = a && imgs[atlasUrl(id, a.f || 'act')];
      if (act && act.ok) {
        const T = ticks(a);
        const p = Math.max(0, ((now - st.t0) / 1000) * a.fps * (st.sp || 1));
        if (p < T || st.dead) {
          const i = Math.min(Math.floor(p), T - 1);
          const fr = (j) => a.o + (a.seq ? a.seq[j] : j);
          paint(cv, st, now, i < T - 1 ? blend(m, act, fr(i), fr(i + 1), p - i) : [frameOf(m, act, fr(i))]);
          continue;
        }
        // движение кончилось: его последний кадр растворяется в покое, покой идёт с начала
        snapshot(cv, st, FADE_OUT / (st.sp || 1));
        st.act = null; st.t = now;
      } else if (st.act) st.act = null;
      if (st.dead) continue;
      if (idle && idle.ok) {
        // спокойному покою (12 кадров в секунду) хватает 30 обновлений в секунду, подвижный (24) рисуется каждый раз
        if (!st.xd && now - (st.pt || 0) < 360 / m.idle.fps) continue;
        const n = m.idle.n;
        const p = Math.max(0, ((now - st.t) / 1000) * m.idle.fps);
        const i = Math.floor(p);
        paint(cv, st, now, blend(m, idle, i % n, (i + 1) % n, p - i));
      } else if (still && still.ok) {
        paint(cv, st, now, [{ im: still, sx: 0, sy: 0, s: still.naturalWidth, w: 1 }]);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
