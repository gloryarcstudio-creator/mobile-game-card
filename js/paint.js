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
  const AN = A.anim || {};
  const ready = {}; // url -> true, когда атлас загружен и расшифрован
  function preload(u) {
    if (ready[u] !== undefined) return;
    ready[u] = false;
    const im = new Image();
    im.src = u;
    const done = () => { ready[u] = true; };
    if (im.decode) im.decode().then(done, () => { im.onload = done; if (im.complete) done(); });
    else im.onload = done;
  }
  function frameLayer(cls, u, w, h) {
    return `<svg class="${cls}" x="0" y="0" width="100" height="100" viewBox="0 0 320 320" style="visibility:hidden"><image href="${u}" width="${w}" height="${h}"/></svg>`;
  }
  Art.hasLive = (id) => !!(AN[id] && AN[id].idle);
  Art.enemyLive = (id) => {
    const m = AN[id];
    if (!m || !m.idle || !S.enemy.has(id)) return Art.enemy(id);
    const iu = url(`ea/${id}_idle`);
    const au = m.act ? url(`ea/${id}_act`) : '';
    preload(iu);
    if (au) preload(au);
    return `<svg class="foe painted live" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" ${NS} data-live="${id}">
      <image class="still" href="${url(`e/${id}`)}" width="100" height="100"/>
      ${frameLayer('fi', iu, m.iw, m.ih)}${au ? frameLayer('fa', au, m.aw, m.ah) : ''}</svg>`;
  };
  // разыграть движение у живого врага внутри el: attack | hurt | death | happy
  Art.act = (el, kind) => {
    const sv = el && (el.matches && el.matches('svg.live') ? el : el.querySelector && el.querySelector('svg.live'));
    if (!sv) return 0;
    const m = AN[sv.dataset.live];
    const a = m && m.act && m.act[kind];
    if (!a || !ready[url(`ea/${sv.dataset.live}_act`)]) return 0;
    const st = sv._sp || (sv._sp = {});
    if (st.dead) return 0;
    st.act = kind; st.t0 = performance.now(); st.fade = 0;
    if (kind === 'death') st.dead = true;
    return (a.n / a.fps) * 1000;
  };
  function setFrame(layerEl, m, i) {
    const col = i % m.cols; const row = Math.floor(i / m.cols);
    const vb = `${col * m.fs} ${row * m.fs} ${m.fs} ${m.fs}`;
    if (layerEl._vb !== vb) { layerEl.setAttribute('viewBox', vb); layerEl._vb = vb; }
  }
  const show = (e, on) => { const v = on ? 'visible' : 'hidden'; if (e && e.style.visibility !== v) e.style.visibility = v; };
  const FADE = 180;
  function tick(now) {
    const list = document.querySelectorAll('svg.live');
    for (const sv of list) {
      const id = sv.dataset.live; const m = AN[id];
      const st = sv._sp || (sv._sp = { t: now });
      const fi = sv.querySelector('.fi'); const fa = sv.querySelector('.fa'); const still = sv.querySelector('.still');
      const idleOk = ready[url(`ea/${id}_idle`)];
      if (st.act && fa) {
        const a = m.act[st.act];
        const k = Math.floor(((now - st.t0) / 1000) * a.fps);
        if (k < a.n) {
          setFrame(fa, m, a.o + k); show(fa, true); fa.style.opacity = 1; show(fi, false); show(still, false);
          continue;
        }
        if (st.dead) { setFrame(fa, m, a.o + a.n - 1); show(fa, true); show(fi, false); show(still, false); continue; }
        // конец движения: короткий переход обратно к покою
        const f = (now - st.t0 - (a.n / a.fps) * 1000) / FADE;
        if (f < 1) { setFrame(fa, m, a.o + a.n - 1); show(fa, true); fa.style.opacity = (1 - f).toFixed(2); }
        else { show(fa, false); fa.style.opacity = 1; st.act = null; }
      }
      if (idleOk && fi) {
        const k = Math.floor((((now - (st.t || 0)) / 1000) * m.idle.fps)) % m.idle.n;
        setFrame(fi, m, k); show(fi, true); show(still, false);
      } else show(still, true);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
