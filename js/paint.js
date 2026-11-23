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
    // Рамки стоят фоном в CSS, а фон, который не пришёл из-за сбоя сети, браузер сам не перезапрашивает:
    // кнопки и строки оставались без рамок до перезапуска. Поэтому каждую рамку по очереди загружаем сами
    // (заодно они готовы до первого показа); не пришла, пробуем снова, а получив, подставляем адрес заново.
    // по порядку первого показа: титул, выбор героя, вступление, карта пути, бой
    const FIRST = ['btn_red', 'btn_dark', 'round', 'panel', 'tile', 'back', 'parch', 'topbar', 'herobar', 'mapcard', 'scroll', 'row2', 'bubble'];
    const names = [...UI].filter((n) => !/^logo_/.test(n) || n === `logo_${(window.I18N && window.I18N.lang) || 'ru'}`)
      .sort((x, y) => (/^logo_/.test(y) - /^logo_/.test(x)) || ((FIRST.indexOf(x) + 99) % 99) - ((FIRST.indexOf(y) + 99) % 99));
    const check = (i, tries = 0) => {
      const n = names[i];
      if (!n) return;
      const u = new URL(url(`${A.uid || 'ui'}/${n}`), document.baseURI).href;
      const im = new Image();
      im.onload = () => { if (tries) app.style.setProperty(`--ui-${n}`, `url("${u}#${tries}")`); setTimeout(() => check(i + 1), 30); };
      im.onerror = () => { if (tries < 3) setTimeout(() => check(i, tries + 1), 1500 * (tries + 1)); else check(i + 1); };
      im.src = u;
    };
    setTimeout(() => check(0), 1500);
  }

  /* ---------- Значки ---------- */
  // значки без своей картинки берут нарисованный талисман или карту с тем же смыслом
  // chest: картинка сундука пересобрана крупнее и без розового ореола (tools/art/build_big_icon.py); имя файла новое, потому что страница помнит картинки по пути
  const ICON_ALIAS = { dogfriend: 'buddy', lantern: 'r:ivalamp', chest: 'chest2' };
  Art.relic = (id) => {
    // r2: талисманы пересобраны с верным цветом свечения (tools/art/build_relics.py); папка новая, потому что страница помнит картинки по пути
    if (S.relic.has(id)) return pic(`r2/${id}`, '0 0 100 100', 'icon');
    const r = (D().RELICS || {})[id];
    return orig.icon(r ? r.art : id);
  };
  Art.card = (id) => {
    if (S.card.has(id)) return pic(`c/${id}`, '0 0 100 100', 'icon card-pic', 'xMidYMid slice');
    const c = (D().CARDS || {})[id];
    return orig.icon(c ? c.art : id);
  };
  // есть ли нарисованная картинка с таким именем (значок, талисман или карта)
  Art.hasIcon = (k) => S.icon.has(ICON_ALIAS[k] || k) || S.icon.has(k) || S.relic.has(k) || S.card.has(k);
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
  // bg_title (v177): было 700, это линия забора. Герой заставки стоял в одном ряду с забором, а столбы фонарей уходили ниже его ног
  // (низ картинки под линией растягивается), и с телефона казалось, что он висит. 726 — открытый снег перед забором и фонарями.
  const FEET = {
    bg_stage1_town_day: 690, bg_stage1_town_mid: 690, bg_stage1_town_sunset: 690,
    bg_stage2_outskirts_start: 660, bg_stage2_outskirts_mid: 670, bg_stage2_outskirts_night: 685,
    bg_final_house: 650, bg_title: 726, scene_talk: 700, scene_meet: 715, scene_shop: 515,
    scene_campfire: 700, scene_chest: 690,
  };
  // Картинка лежит двумя кусками: всё выше линии снега и передний план ниже неё. Когда камера поднимает
  // картинку к ногам персонажа, передний план растягивается вниз (Art.groundCam), и снег доходит до низа
  // экрана. Раньше под картинкой оставалась ровная пустая полоса.
  // Живой свет: мягкие ореолы поверх нарисованных фонарей и окон, они медленно «дышат» (стиль .bg-lights).
  // [x, y, радиус, вид] на экране 400×860 без сдвига камеры; вид: 'w' окно (спокойнее), 'f' костёр (живее)
  // [x, y, радиус, вид]: без вида — фонарь, 'w' — окно, 'f' — костёр, 's' — солнце с лучами, 'm' — луна (ореол)
  const LIGHTS = {
    bg_stage1_town_day: [[362, 592, 22, 'w'], [10, 572, 20, 'w'], [104, 125, 84, 's']],
    bg_stage1_town_mid: [[58, 467, 40], [355, 598, 22, 'w'], [8, 575, 18, 'w'], [116, 191, 104, 's']],
    bg_stage1_town_sunset: [[41, 432, 38], [181, 425, 36], [303, 432, 36], [360, 585, 24, 'w'], [390, 492, 20], [249, 432, 96, 's']],
    bg_stage2_outskirts_start: [[120, 467, 40], [290, 493, 28], [348, 537, 22, 'w'], [58, 455, 20, 'w']],
    bg_stage2_outskirts_mid: [[83, 470, 34], [312, 478, 30], [179, 480, 30, 'w']],
    bg_stage2_outskirts_night: [[70, 492, 40], [332, 515, 40], [163, 515, 36, 'w']],
    bg_final_house: [[107, 507, 34], [297, 497, 34], [177, 492, 40, 'w']],
    bg_title: [[82, 545, 36], [278, 572, 34], [30, 515, 22, 'w'], [338, 637, 22, 'w'], [380, 637, 22, 'w'], [153, 449, 104, 's']],
    scene_campfire: [[210, 585, 95, 'f'], [290, 248, 46], [22, 345, 34, 'w'], [392, 340, 30, 'w'], [91, 117, 70, 'm']],
    scene_meet: [[243, 268, 46], [335, 318, 30, 'w'], [40, 478, 26, 'w'], [107, 148, 64, 'm']],
    scene_shop: [[66, 205, 44], [392, 165, 20]],
  };
  // Ореолы включаются, когда сама картинка фона загружена: иначе на медленной сети они горели бы над пустым местом
  const bgSeen = new Set();
  Art.lightsOn = (root) => {
    const L = root && root.querySelector('.bg-lights:not(.on)');
    if (!L) return;
    const k = L.dataset.k; const probe = new Image();
    const on = () => { bgSeen.add(k); root.querySelectorAll(`.bg-lights[data-k="${k}"]`).forEach((x) => x.classList.add('on')); };
    probe.onload = on; probe.src = url(`bg/${k}`);
    if (probe.complete && probe.naturalWidth) on();
  };
  // Искры над костром (v102): восемь точек со своим ходом, взлетают из пламени и гаснут. Сила — ручка --embers на #app.
  function embersHTML(x, y, r) {
    let h = '';
    for (let i = 0; i < 8; i++) {
      const sx = ((i * 37) % 29) - 14; const dx = ((i * 53) % 41) - 20; const up = 96 + ((i * 47) % 60);
      h += `<b style="--x:${sx}px;--dx:${dx}px;--h:${up}px;--t:${(2.6 + ((i * 0.83) % 1.9)).toFixed(2)}s;--d:-${((i * 1.31) % 4.3).toFixed(2)}s"></b>`;
    }
    return `<span class="embers" style="left:${x}px;top:${Math.round(y - r * 0.42)}px">${h}</span>`;
  }
  function lightsHTML(k) {
    const L = LIGHTS[k];
    if (!L) return '';
    return `<div class="bg-lights${bgSeen.has(k) ? ' on' : ''}" data-k="${k}">${L.map(([x, y, r, kind], i) => `<i${kind ? ` class="${kind}"` : ''} style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;${kind === 's' || kind === 'm' ? '' : `animation-duration:${(kind === 'f' ? 1.5 : 3.7 + ((i * 1.37) % 2.1)).toFixed(2)}s;animation-delay:-${((i * 1.9) % 5).toFixed(2)}s`}"></i>${kind === 'f' ? embersHTML(x, y, r) : ''}`).join('')}</div>`;
  }
  function paintBg(a, b, mix) {
    const c = (A.bgc || {})[mix > 0.5 && b ? b : a] || '#2a3350';
    const fa = FEET[a] || 690; const feet = b && mix > 0.001 ? fa + ((FEET[b] || 690) - fa) * mix : fa;
    const f = +feet.toFixed(0);
    const pics = `${layer(a)}${b && mix > 0.001 ? layer(b, mix) : ''}`;
    return `<svg class="bg-svg painted" viewBox="0 0 400 860" data-feet="${f}" data-k="${a}" ${NS}>
      <defs><linearGradient id="bgFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}"/></linearGradient>
        <clipPath id="bgTop"><rect x="-50" y="-300" width="500" height="${f + 301}"/></clipPath>
        <clipPath id="bgLow"><rect x="-50" y="${f}" width="500" height="${BH - f + 2}"/></clipPath></defs>
      <g class="bg-cam">
        <rect y="-300" width="400" height="1600" fill="${c}"/>
        <g clip-path="url(#bgTop)">${pics}</g>
        <g class="bg-low"><g clip-path="url(#bgLow)">${pics}<rect class="bg-fade" y="${BH - 90}" width="400" height="91" fill="url(#bgFade)"/></g></g>
      </g></svg>${b && mix > 0.001 ? '' : lightsHTML(a)}`;
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
  const LOW_MAX = 2.2; // сильнее передний план не тянем: мазки снега становятся полосами. Остаток уходит в туман под картами
  Art.groundCam = (root, y) => {
    const sv = root && root.querySelector('svg.bg-svg.painted');
    const g = sv && sv.querySelector('.bg-cam');
    if (!g) return false;
    const feet = +sv.dataset.feet || 690;
    const ty = y == null ? 0 : Math.min(0, y - feet);
    g.style.transform = ty ? `translateY(${ty.toFixed(1)}px)` : '';
    const lights = root.querySelector('.bg-lights');
    if (lights) lights.style.transform = g.style.transform; // ореолы едут вместе с картинкой
    const low = g.querySelector('.bg-low');
    if (low) {
      // во сколько раз растянуть снег ниже линии ног, чтобы низ картинки снова лёг на низ экрана
      const need = ty ? (860 - y) / (860 - feet) : 1; const k = Math.min(LOW_MAX, need);
      if (k > 1.001) low.setAttribute('transform', `translate(0 ${feet}) scale(1 ${k.toFixed(3)}) translate(0 ${-feet})`); else low.removeAttribute('transform');
      const fade = low.querySelector('.bg-fade');
      if (fade) fade.style.display = ty && need <= LOW_MAX ? 'none' : ''; // картинка дошла до низа экрана: туман у её края не нужен
    }
    return true;
  };

  /* ---------- Живые враги: раскадровки из роликов ---------- */
  // Кадры рисуются на <canvas>: холст хранит последний кадр, поэтому враг не мигает
  // и не пропадает, пока браузер готовит картинку. Атласы грузятся заранее.
  const AN = A.anim || {};
  const imgs = {}; // url -> Image (готова, когда .ok)
  function load(u, low) {
    if (imgs[u]) return imgs[u];
    const im = new Image();
    imgs[u] = im;
    im.ok = false; im.u = u; im.low = low;
    begin(im);
    return im;
  }
  function begin(im) {
    const u = im.u;
    const done = () => { im.ok = true; };
    const plain = () => {
      im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); };
      // файл не пришёл: пробуем ещё дважды; если и это не помогло, картинку позже поднимет heal()
      im.onerror = () => { im.tries = (im.tries || 0) + 1; if (im.tries <= 2) setTimeout(() => { if (imgs[u] === im) im.src = u; }, 1500 * im.tries); };
      im.src = u;
    };
    // Атлас берём готовой растровой копией: файл расшифровывается в фоне, а не в кадре.
    // Обычную картинку браузер расшифровывал при первом показе каждого атласа, и на слабом телефоне
    // бой замирал на четверть секунды в начале и на первом ударе.
    if (window.createImageBitmap && window.fetch && u.includes(`/${A.ea || 'ea'}/`)) {
      fetch(u, im.low ? { priority: 'low' } : undefined).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('нет файла')))).then((b) => createImageBitmap(b)).then((bmp) => {
        if (imgs[u] === im) im.bmp = bmp; else if (bmp.close) bmp.close(); // пока готовили, атлас уже выгрузили
        done();
      }, plain);
    } else plain();
  }
  /* v135. Сеть пропала и вернулась. Раньше картинка врага после трёх неудач бросалась насовсем: если связь
     пропадала на 10–20 секунд в начале боя, враг оставался невидимым до конца боя, а фон пустым до смены экрана.
     heal() пробует снова: по событию «сеть вернулась» и раз в 8 секунд, пока есть что чинить (после пяти
     неудач подряд одна и та же картинка пробуется раз в 32 секунды).
     broken — картинки экрана (<img> и <image>), у которых случилась ошибка загрузки. */
  const broken = new Set(); const heals = new WeakMap(); let healTick = 0;
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'image') && t.closest && t.closest('#app')) broken.add(t);
  }, true);
  function heal(force) {
    if (document.hidden) return;
    healTick++;
    const due = (o) => { const n = (heals.get(o) || 0) + 1; heals.set(o, n); return force === true || n <= 5 || healTick % 4 === 0; };
    for (const im of Object.values(imgs)) if (!im.ok && (im.tries || 0) > 2 && due(im)) { im.tries = 0; begin(im); }
    if (!broken.size) return;
    const all = [...broken].filter((el) => el.isConnected);
    const list = all.filter(due);
    broken.clear();
    all.forEach((el) => { if (!list.includes(el)) broken.add(el); });
    for (const el of list) {
      if (el.tagName === 'IMG') { const v = el.getAttribute('src'); if (v) el.src = v; continue; }
      const h = el.getAttribute('href');
      if (h) { el.removeAttribute('href'); el.setAttribute('href', h); }
    }
    // фон под картинкой задан стилем: его запрос браузер сам не повторяет
    if (list.length) {
      document.querySelectorAll('#app [style*="background-image"]').forEach((el) => {
        const v = el.style.backgroundImage;
        if (!v || !v.includes('url(')) return;
        el.style.backgroundImage = 'none'; void el.offsetWidth; el.style.backgroundImage = v;
      });
    }
  }
  window.addEventListener('online', () => setTimeout(() => heal(true), 300));
  setInterval(heal, 8000);
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

  /* ---------- Файл не пришёл ----------
     Сеть моргнула, и картинка не загрузилась: браузер рисовал на её месте значок «битая картинка», растянутый
     во весь размер (у фона это бело-зелёное пятно на весь экран). Такую картинку прячем и дважды пробуем снова. */
  window.addEventListener('error', (e) => {
    const el = e.target;
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    if (tag !== 'image' && tag !== 'img') return;
    const attr = tag === 'img' ? 'src' : 'href';
    const u = el.getAttribute(attr) || '';
    if (!u || /^(data|blob):/.test(u)) return;
    el.style.visibility = 'hidden';
    const n = +(el.dataset.retry || 0);
    if (n >= 2) return;
    el.dataset.retry = n + 1;
    setTimeout(() => {
      if (!el.isConnected) return;
      el.addEventListener('load', () => { el.style.visibility = ''; }, { once: true });
      el.removeAttribute(attr); el.setAttribute(attr, u);
    }, 1200 * (n + 1));
  }, true);

  /* ---------- Загрузка наперёд ----------
     Пока игрок читает экран, тихо скачиваем то, что покажет следующий: при первом входе в бой по мобильной
     сети враг, рамки и рисунки карт появлялись с опозданием. Файлы только ложатся в кэш браузера, по одному
     и после картинок самого экрана; в память ничего не раскодируется. В режиме экономии трафика не качаем. */
  const warmed = new Set(); const warmQ = []; let warming = false;
  function warmNext() {
    const u = warmQ.shift();
    if (!u) { warming = false; return; }
    fetch(u, { priority: 'low' }).then((r) => r.blob()).catch(() => { warmed.delete(u); }).then(() => setTimeout(warmNext, 20));
  }
  /* Тихая сеть: обещание выполняется, когда картинки текущего экрана пришли и очередь загрузки наперёд пуста
     (или вышло время wait). Тяжёлые фоновые загрузки (музыка, пакеты роликов эффектов) ждут его перед каждым
     файлом: на телефонной сети они занимали канал, и фон, рисунки карт и враг появлялись с опозданием. */
  const seenPic = new Set(); const probing = new Set();
  function picsPending() {
    if (warming || warmQ.length) return true;
    if ([...document.querySelectorAll('#app img')].some((im) => !im.complete)) return true;
    let wait = false;
    document.querySelectorAll('#app image').forEach((el) => {
      const u = el.getAttribute('href');
      if (!u || seenPic.has(u)) return;
      wait = true;
      if (probing.has(u)) return;
      probing.add(u);
      const im = new Image();
      im.onload = im.onerror = () => { probing.delete(u); seenPic.add(u); };
      im.src = u;
    });
    return wait || Object.values(imgs).some((im) => im && !im.ok && (im.tries || 0) < 3);
  }
  Art.quiet = (wait = 8000) => new Promise((res) => {
    const t0 = performance.now(); let calm = 0;
    const tick = () => {
      calm = picsPending() ? 0 : calm + 1;
      if (calm >= 2 || performance.now() - t0 > wait) res(); else setTimeout(tick, 350);
    };
    setTimeout(tick, 60);
  });
  /* w: { enemies: [id], places: ['shop'|'rest'|…], scene: 'town'|…, ui: [имя], cards: [id], intents: true,
     faces: [герой], heroes: [герой], pics: [картинка книги или события] } */
  Art.warm = (w = {}) => {
    if (!window.fetch || (navigator.connection && navigator.connection.saveData)) return;
    const live = (w.enemies || []).filter((id) => AN[id] && AN[id].idle && S.enemy.has(id));
    const list = [
      ...(w.ui || []).filter((n) => UI.has(n)).map((n) => url(`${A.uid || 'ui'}/${n}`)),
      ...live.map((id) => atlasUrl(id, AN[id].idle.f || 'idle')),
      ...(w.places || []).map((pl) => SCENE[pl]).filter((k) => k && S.bg.has(k)).map((k) => url(`bg/${k}`)),
      ...(w.scene ? (KEYS[w.scene] || KEYS.town).filter((k) => S.bg.has(k)).slice(0, 1).map((k) => url(`bg/${k}`)) : []),
      ...[...new Set(w.cards || [])].filter((id) => S.card.has(id)).map((id) => url(`c/${id}`)),
      ...(w.intents ? [...S.intent].map((k) => url(`it/${k}`)) : []),
      ...(w.faces || []).filter((k) => S.face.has(k)).map((k) => url(`h/${k}_face`)),
      ...(w.heroes || []).filter((k) => S.hero.has(k)).map((k) => url(`h/${k}`)),
      ...(w.pics || []).filter((k) => S.pic.has(k)).map((k) => url(`pic/${k}`)),
      ...live.flatMap((id) => parts(AN[id]).map((pt) => atlasUrl(id, pt))),
    ];
    list.forEach((u) => { if (!warmed.has(u) && !imgs[u]) { warmed.add(u); warmQ.push(u); } });
    if (!warming && warmQ.length) { warming = true; setTimeout(warmNext, 350); }
  };
  // Неподвижная картинка для тех мест, где фигура стоит на земле (после боя, враг без своих клипов):
  // в высокой рамке она прижата к низу, как и живая фигура. Раньше вставала по центру и висела над своей тенью.
  Art.enemyStand = (id) => Art.enemy(id).replace('<svg ', '<svg preserveAspectRatio="xMidYMax meet" ');
  // выполнить fn, когда картинка dep готова (или вышло время ожидания); если её успели выгрузить, не выполнять
  function after(dep, ms, fn, t0 = performance.now()) {
    if (imgs[dep.u] !== dep) return;
    if (dep.ok || performance.now() - t0 > ms) fn(); else setTimeout(() => after(dep, ms, fn, t0), 80);
  }
  Art.enemyLive = (id) => {
    const m = AN[id];
    if (!m || !m.idle || !S.enemy.has(id)) return Art.enemyStand(id);
    keepOnly([id, ...[...document.querySelectorAll('canvas.live')].map((c) => c.dataset.live)]);
    // Порядок загрузки (v133). Раньше неподвижная фигура (25 КБ), покой и все движения (до 1,7 МБ) качались разом,
    // и на медленной сети враг и рисунки карт появлялись через 7 секунд: мелкие файлы ждали за атласами.
    // Теперь сначала фигура, за ней покой, и только потом движения (тихим приоритетом: их догонит запрос по требованию).
    const still = load(url(`e/${id}`));
    const idleU = atlasUrl(id, m.idle.f || 'idle');
    after(still, 4000, () => after(load(idleU), 15000, () => { if (imgs[idleU]) parts(m).forEach((p) => load(atlasUrl(id, p), true)); }));
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
    // Замах иногда выходит за свой квадратный кадр, и рисунок там обрезан по линейке. У таких кадров (метка e из
    // описи: 1 верх, 2 право, 4 низ, 8 лево) край растворяется. Низ трогаем только у вспышки во весь кадр: ногам нужна опора
    const side = [0, 0, 0, 0];
    for (const l of layers) {
      if (!l.e) continue;
      const burst = (l.e & 1 ? 1 : 0) + (l.e & 2 ? 1 : 0) + (l.e & 8 ? 1 : 0) >= 3;
      for (let k = 0; k < 4; k++) if (l.e & (1 << k) && (k !== 2 || burst)) side[k] += (mix ? l.w * (1 - old) : 1);
    }
    if (side[0] || side[1] || side[2] || side[3]) {
      const x0 = (W - d) / 2; const F = d * EDGE_FADE;
      ctx.globalCompositeOperation = 'destination-out';
      const band = (k, gx0, gy0, gx1, gy1, x, y, w, h) => {
        if (side[k] < 0.02) return;
        const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.3, 'rgba(0,0,0,.78)'); g.addColorStop(0.7, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(1, side[k]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      };
      band(0, 0, fy, 0, fy + F, x0, fy, d, F);
      band(1, x0 + d, 0, x0 + d - F, 0, x0 + d - F, fy, F, d);
      band(2, 0, fy + d, 0, fy + d - F, x0, fy + d - F, d, F);
      band(3, x0, 0, x0 + F, 0, x0, fy, F, d);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const EDGE_FADE = 0.13; // ширина растворения у края, доля кадра
  const edgeOf = (e, i) => (e ? parseInt(e[i], 16) || 0 : 0);
  const frameOf = (m, im, i, w = 1, e = 0) => ({ im, sx: (i % m.cols) * m.fs, sy: Math.floor(i / m.cols) * m.fs, s: m.fs, w, e });
  // два соседних кадра с долями (1 − f) и f; e — метки краёв этих кадров, o — с какого кадра атласа они считаются
  const blend = (m, im, i, j, f, e, o = 0) => (f > 0 && i !== j ? [frameOf(m, im, i, 1 - f, edgeOf(e, i - o)), frameOf(m, im, j, f, edgeOf(e, j - o))] : [frameOf(m, im, i, 1, edgeOf(e, i - o))]);
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
          paint(cv, st, now, i < T - 1 ? blend(m, act, fr(i), fr(i + 1), p - i, a.e, a.o) : [frameOf(m, act, fr(i), 1, edgeOf(a.e, fr(i) - a.o))]);
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
        paint(cv, st, now, blend(m, idle, i % n, (i + 1) % n, p - i, m.idle.e));
      } else if (still && still.ok) {
        paint(cv, st, now, [{ im: still, sx: 0, sy: 0, s: still.naturalWidth, w: 1 }]);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
