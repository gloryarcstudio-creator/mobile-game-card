/* Игровая логика и отрисовка экранов. */
(function () {
  const { CARDS, ENEMIES, RELICS, EVENTS } = window.Data;
  const STORY = window.Story.story;
  const SKY = window.Story.sky;
  document.title = STORY.title;
  // Путь делится на стадии, последний уровень каждой стадии — её босс
  const STAGES = STORY.stages;
  const MAX_STEPS = STAGES.reduce((a, g) => a + g.len, 0);
  let acc = 0;
  STAGES.forEach((g) => { g.start = acc; acc += g.len; g.end = acc - 1; });
  const stageOf = (step) => STAGES.findIndex((g) => step <= g.end);
  const isFinalStep = (step) => step === MAX_STEPS - 1;
  const HAND_SIZE = 5;
  const MAX_ENERGY = 3;
  const FLAME_BONUS = 2;    // +урон атак за каждый Огонёк
  const FLAME_MAX = 3;      // при стольких Огоньках лампа вспыхивает
  const BURST_DMG = 8;

  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const screen = $('#screen');
  const overlay = $('#overlay');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  let uidSeq = 1;
  const mk = (id) => ({ uid: uidSeq++, id });

  /* ---------- Масштабирование под экран телефона ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 400, window.innerHeight / 860);
    app.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- Снег ---------- */
  (function snow() {
    const cv = $('#snow'); const ctx = cv.getContext('2d');
    cv.width = 400; cv.height = 860;
    const flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * 400, y: Math.random() * 860, r: 0.8 + Math.random() * 2.2, v: 0.3 + Math.random() * 0.9, d: Math.random() * 6 }));
    (function tick(t) {
      ctx.clearRect(0, 0, 400, 860);
      ctx.fillStyle = 'rgba(235,242,255,0.85)';
      for (const f of flakes) {
        f.y += f.v; f.x += Math.sin(t / 1400 + f.d) * 0.35;
        if (f.y > 870) { f.y = -10; f.x = Math.random() * 400; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      }
      requestAnimationFrame(tick);
    })(0);
  })();

  /* Фон меняется после каждого уровня: палитра неба смешивается по ключевым кадрам,
     а сцена (город или окраина) задаётся стадией */
  function setBg() {
    const step = run ? run.step : 0;
    const t = MAX_STEPS > 1 ? Math.min(1, step / (MAX_STEPS - 1)) : 0;
    const g = STAGES[stageOf(step)] || STAGES[0];
    const lamps = run && STORY.lamps ? STORY.lamps(run) : 0;
    const approach = g.len > 1 ? (step - g.start) / (g.len - 1) : 1;
    const p = Art.sampleSky(SKY, t);
    $('#bg').innerHTML = Art.background(p, lamps, g.scene, approach);
    app.style.setProperty('--sky-top', p.skyTop);
    app.style.setProperty('--sky-mid', p.skyMid);
    app.style.setProperty('--sky-bot', p.skyBot);
  }

  /* ---------- Состояние забега ---------- */
  let run = null;   // прогресс забега
  let C = null;     // текущий бой
  let busy = false; // блокировка ввода на время анимаций
  let selected = -1;

  function newRun() {
    run = {
      hp: 36, maxHp: 36, gold: 20, step: 0, lit: 0, relics: [], fights: 0,
      deck: [...Array(4).fill('strike'), ...Array(4).fill('guard'), 'kindle', 'spark'].map(mk),
      choices: null,
    };
    setBg();
    goMap();
  }
  const hasRelic = (id) => run.relics.includes(id);

  /* ---------- Общие куски интерфейса ---------- */
  function cardHTML(id, extra = '', attrs = '') {
    const c = CARDS[id];
    const g = C ? api : apiStatic;
    const typeLabel = c.type === 'atk' ? 'Атака' : 'Навык';
    return `<div class="card ${c.type} r-${c.rarity} ${extra}" ${attrs}>
      <div class="cost"><span>${c.cost}</span></div>
      <div class="ctitle"><span>${c.name}</span></div>
      <div class="cart">${Art.icon(c.art)}</div>
      <div class="cdesc">${c.desc(g)}</div>
      <div class="ctype">${typeLabel}</div>
    </div>`;
  }

  function topBar() {
    const si = stageOf(run.step);
    const g = STAGES[si];
    const left = g.end - run.step;
    const pct = g.len > 1 ? Math.max(0, left / (g.len - 1)) * 100 : 0;
    return `<div class="topbar">
      <div class="gold">${Art.icon('coin')}<b>${run.gold}</b></div>
      <div class="chapter"><div class="ch-title">${g.name}</div>
        <div class="candle"><div class="wax" style="width:${pct}%"></div><div class="wick" style="left:${pct}%">${Art.flame(0.9)}</div></div>
        <div class="ch-sub">${STORY.countdown({ left, level: run.step + 1, total: MAX_STEPS, stage: si, final: isFinalStep(run.step) })}</div>
      </div>
      <div class="relics">${run.relics.map((r) => `<button class="relic" data-relic="${r}">${Art.icon(RELICS[r].art)}</button>`).join('')}</div>
    </div>`;
  }

  function heroBar(inCombat) {
    const hpPct = (run.hp / run.maxHp) * 100;
    const flame = inCombat ? C.flame : 0;
    return `<div class="herobar">
      <div class="portrait" id="heroPortrait">${Art.hero()}</div>
      <div class="hb-mid">
        <div class="hpbar"><div class="fill" style="width:${hpPct}%"></div><span>${run.hp}/${run.maxHp}</span>
          ${inCombat && C.block > 0 ? `<div class="hblk">${Art.intentIcon('block')}<b>${C.block}</b></div>` : ''}</div>
        <div class="hb-row">
          ${inCombat ? `<div class="lamp" title="Огоньки">${[0, 1, 2].map((i) => `<i class="pip ${i < flame ? 'on' : ''}">${Art.flame(1)}</i>`).join('')}</div>
            ${C.pWeak > 0 ? `<div class="status weak">Слабость ${C.pWeak}</div>` : ''}` : `<div class="hero-name">${STORY.heroName}</div>`}
        </div>
      </div>
      ${inCombat ? `<div class="energy"><b>${C.energy}</b><small>/${MAX_ENERGY}</small></div>
        <div class="piles"><button class="pile" data-act="pile-draw">Колода<b>${C.draw.length}</b></button><button class="pile" data-act="pile-disc">Сброс<b>${C.disc.length}</b></button></div>
        <button class="btn end" data-act="end">Конец<br>хода</button>`
        : `<button class="btn deckbtn" data-act="deck">Колода<b>${run.deck.length}</b></button>`}
    </div>`;
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    app.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }

  function showOverlay(html, onClick) {
    overlay.innerHTML = `<div class="ov-inner">${html}</div>`;
    overlay.classList.add('show');
    overlay.onclick = (e) => onClick && onClick(e);
  }
  function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; overlay.onclick = null; }

  function showDeck(list, title, onPick) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    showOverlay(`<h2>${title}</h2><div class="grid">${sorted.map((c) => cardHTML(c.id, 'mini', `data-uid="${c.uid}"`)).join('') || '<p class="muted">Пусто</p>'}</div>
      <button class="btn" data-act="close">${onPick ? 'Отмена' : 'Закрыть'}</button>`, (e) => {
      const cardEl = e.target.closest('.card');
      if (onPick && cardEl) { onPick(+cardEl.dataset.uid); return; }
      if (e.target.closest('[data-act="close"]') || !onPick) { hideOverlay(); if (onPick) onPick(null); }
    });
  }

  /* ---------- Титульный экран ---------- */
  function goTitle() {
    run = null; C = null; setBg();
    screen.className = 'scr-title';
    screen.innerHTML = `
      <div class="book">
        <div class="page">
          <div class="book-art">${Art.hero()}</div>
          <h1>${STORY.title}</h1>
          <p class="story">${STORY.intro}</p>
          <ul class="howto">
            <li><b>Огонёк.</b> Каждый даёт атакам +${FLAME_BONUS} урона.</li>
            <li><b>Вспышка.</b> На ${FLAME_MAX} Огоньках лампа бьёт врага на ${BURST_DMG}.</li>
            <li>${STORY.pathRule(MAX_STEPS)}</li>
          </ul>
        </div>
      </div>
      <button class="btn big" data-act="start">Начать</button>`;
  }

  /* ---------- Путь: выбор из трёх карт-встреч ---------- */
  function genChoices() {
    const s = run.step;
    const si = stageOf(s);
    const g = STAGES[si];
    if (s === g.end) return [{ t: 'boss', enemy: g.boss }];
    const k = s - g.start; // номер уровня внутри стадии
    const normals = si === 0
      ? (k < 8 ? ['inkcat', 'laundress'] : ['inkcat', 'laundress', 'golem', 'golem'])
      : ['inkcat', 'laundress', 'golem', 'golem', 'laundress'];
    const eliteOk = si > 0 || k >= 6;
    const fight = () => ({ t: 'fight', enemy: pick(normals) });
    if (s === 0) return [fight(), fight(), { t: 'event', ev: pick(EVENTS).id }];
    if (s === g.end - 1) return [{ t: 'rest' }, { t: 'shop' }, eliteOk ? { t: 'elite', enemy: 'owl' } : fight()];
    const pool = [];
    const weights = [['fight', 40], ['event', 18], ['shop', 10], ['chest', 10], ['rest', 12], ['elite', eliteOk ? (si > 0 ? 16 : 10) : 0]];
    const total = weights.reduce((a, w) => a + w[1], 0);
    while (pool.length < 3) {
      let r = Math.random() * total; let t = 'fight';
      for (const [key, w] of weights) { if ((r -= w) < 0) { t = key; break; } }
      if (t !== 'fight' && t !== 'event' && pool.some((p) => p.t === t)) continue;
      if (t === 'fight') pool.push(fight());
      else if (t === 'elite') pool.push({ t: 'elite', enemy: 'owl' });
      else if (t === 'event') { const ev = pick(EVENTS.filter((e) => !pool.some((p) => p.ev === e.id))).id; pool.push({ t: 'event', ev }); }
      else pool.push({ t });
    }
    if (!pool.some((p) => p.t === 'fight' || p.t === 'elite')) pool[rnd(0, 2)] = fight();
    return pool;
  }

  function encHTML(o, i) {
    let title, art, text, tag;
    if (o.t === 'fight' || o.t === 'elite' || o.t === 'boss') {
      const e = ENEMIES[o.enemy];
      title = e.name; art = `<div class="enc-char">${Art.enemy(o.enemy)}</div>`; text = e.line;
      tag = o.t === 'boss' ? (isFinalStep(run.step) ? 'Финальный босс' : 'Босс стадии') : o.t === 'elite' ? 'Элита' : 'Бой';
    } else if (o.t === 'event') {
      const ev = EVENTS.find((e) => e.id === o.ev);
      title = ev.title; art = Art.icon(ev.art); text = 'Что-то происходит впереди…'; tag = 'Событие';
    } else if (o.t === 'shop') {
      title = 'Лавка Игольника'; art = `<div class="enc-char">${Art.enemy('hedgehog')}</div>`; text = 'Ёж торгует всем, что нашёл в сугробах.'; tag = 'Лавка';
    } else if (o.t === 'chest') {
      title = 'Сундук-соня'; art = Art.icon('chest'); text = 'Сундук храпит. Внутри что-то звенит.'; tag = 'Сундук';
    } else if (o.t === 'rest') {
      title = 'Костёр'; art = Art.icon('fire'); text = 'Тёплый огонь. Можно передохнуть.'; tag = 'Привал';
    }
    return `<button class="enc t-${o.t}" data-act="choose" data-i="${i}" style="--d:${i * 90}ms">
      <div class="enc-title">${title}</div>
      <div class="enc-art">${art}</div>
      <div class="enc-text">${text}</div>
      <div class="enc-tag">${tag}</div>
    </button>`;
  }

  function goMap() {
    C = null; busy = false;
    setBg();
    if (!run.choices) run.choices = genChoices();
    screen.className = 'scr-map';
    screen.innerHTML = `${topBar()}
      <div class="map-hint">${mapHint()}</div>
      <div class="encs n${run.choices.length}">${run.choices.map(encHTML).join('')}</div>
      ${heroBar(false)}`;
  }

  function mapHint() {
    const si = stageOf(run.step);
    const g = STAGES[si];
    if (run.step === g.start && STORY.stageIntro) return `<b>${g.name}</b><small>${STORY.stageIntro[si] || ''}</small>`;
    if (run.step === 0) return 'Выбери, куда идти';
    return `Уровень ${run.step + 1}`;
  }

  function chooseEncounter(i) {
    const o = run.choices[i];
    run.choices = null;
    if (o.t === 'fight' || o.t === 'elite' || o.t === 'boss') startCombat(o.enemy, o.t);
    else if (o.t === 'event') goEvent(EVENTS.find((e) => e.id === o.ev));
    else if (o.t === 'shop') goShop();
    else if (o.t === 'chest') goChest();
    else if (o.t === 'rest') goRest();
  }

  function advance() { run.step++; goMap(); }

  /* ---------- API для событий ---------- */
  const evApi = {
    heal: (n) => { run.hp = Math.min(run.maxHp, run.hp + n); },
    damage: (n) => { run.hp = Math.max(1, run.hp - n); },
    giveCard: (id) => run.deck.push(mk(id)),
    giveRandomCard: (rarity) => { const id = pick(Object.keys(CARDS).filter((k) => CARDS[k].rarity === rarity)); run.deck.push(mk(id)); toast(`Новая карта: ${CARDS[id].name}`); },
    giveRelic: () => {
      const free = Object.keys(RELICS).filter((r) => !hasRelic(r));
      if (!free.length) { run.gold += 40; toast('+40 монет'); return; }
      addRelic(pick(free));
    },
    removeCardPrompt: () => removeCardFlow(() => advance()),
    startFight: null,
  };

  function addRelic(id) {
    run.relics.push(id);
    if (id === 'jar') { run.maxHp += 8; run.hp += 8; }
    toast(`Талисман: ${RELICS[id].name}`);
  }

  function removeCardFlow(done) {
    showDeck(run.deck, 'Выбери карту, которую убрать', (uid) => {
      hideOverlay();
      if (uid != null) { const c = run.deck.find((d) => d.uid === uid); run.deck = run.deck.filter((d) => d.uid !== uid); toast(`Убрана: ${CARDS[c.id].name}`); }
      done(uid != null);
    });
  }

  /* ---------- Событие ---------- */
  function goEvent(ev) {
    screen.className = 'scr-event';
    screen.innerHTML = `${topBar()}
      <div class="ev-art">${Art.icon(ev.art)}</div>
      <div class="ev-box"><h2>${ev.title}</h2><p>${ev.text}</p></div>
      <div class="scrolls">${ev.options.map((o, i) => {
        const ok = !o.can || o.can(run);
        return `<button class="scroll ${ok ? '' : 'off'}" data-act="evopt" data-i="${i}" ${ok ? '' : 'disabled'}>${o.text}<small>${o.hint}</small></button>`;
      }).join('')}</div>
      ${heroBar(false)}`;
    screen.dataset.ev = ev.id;
  }

  function eventOption(i) {
    const ev = EVENTS.find((e) => e.id === screen.dataset.ev);
    let fought = false;
    evApi.startFight = (id) => { fought = id; };
    const res = ev.options[i].act(run, evApi);
    if (res === null) return; // опция сама ведёт дальше (например, удаление карты)
    if (fought) { toast(res); setTimeout(() => startCombat(fought, 'fight'), 600); return; }
    $('.scrolls').innerHTML = `<button class="scroll" data-act="next">Дальше</button>`;
    $('.ev-box p').textContent = res;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Лавка ---------- */
  function goShop() {
    const commons = Object.keys(CARDS).filter((k) => CARDS[k].rarity === 'common');
    const rares = Object.keys(CARDS).filter((k) => CARDS[k].rarity === 'rare');
    const cards = shuffle([...commons]).slice(0, 2).concat([pick(rares)]).map((id) => ({ id, price: CARDS[id].rarity === 'rare' ? 70 : 38 + rnd(-4, 6), sold: false }));
    const freeRelics = Object.keys(RELICS).filter((r) => !hasRelic(r));
    const shop = { cards, relic: freeRelics.length ? { id: pick(freeRelics), price: 90, sold: false } : null, tea: { price: 22, sold: false }, remove: { price: 50, sold: false } };
    screen.className = 'scr-shop';
    const render = () => {
      screen.innerHTML = `${topBar()}
        <div class="shopkeeper">${Art.enemy('hedgehog')}<div class="bubble">Всё по-честному! Почти.</div></div>
        <div class="shop-cards">${shop.cards.map((c, i) => `<div class="ware ${c.sold ? 'sold' : ''}">${cardHTML(c.id, 'shopcard', `data-act="buy" data-i="${i}"`)}<div class="price ${run.gold < c.price ? 'poor' : ''}">${Art.icon('coin')}${c.price}</div></div>`).join('')}</div>
        <div class="shop-services">
          ${shop.relic ? `<button class="svc ${shop.relic.sold ? 'sold' : ''}" data-act="buyrelic">${Art.icon(RELICS[shop.relic.id].art)}<span><b>${RELICS[shop.relic.id].name}</b><small>${RELICS[shop.relic.id].desc}</small></span><i class="${run.gold < shop.relic.price ? 'poor' : ''}">${shop.relic.price}</i></button>` : ''}
          <button class="svc ${shop.tea.sold ? 'sold' : ''}" data-act="buytea">${Art.icon('tea')}<span><b>Горячий сбитень</b><small>Восстановить 12 HP</small></span><i class="${run.gold < shop.tea.price ? 'poor' : ''}">${shop.tea.price}</i></button>
          <button class="svc ${shop.remove.sold ? 'sold' : ''}" data-act="buyremove">${Art.icon('scissors')}<span><b>Распустить карту</b><small>Убрать карту из колоды</small></span><i class="${run.gold < shop.remove.price ? 'poor' : ''}">${shop.remove.price}</i></button>
        </div>
        <button class="btn leave" data-act="next">Уйти</button>
        ${heroBar(false)}`;
    };
    const pay = (item) => {
      if (item.sold) return false;
      if (run.gold < item.price) { toast('Не хватает монет'); return false; }
      run.gold -= item.price; item.sold = true; return true;
    };
    screen.onShop = (act, i) => {
      if (act === 'buy' && pay(shop.cards[i])) { run.deck.push(mk(shop.cards[i].id)); toast(`Куплено: ${CARDS[shop.cards[i].id].name}`); }
      if (act === 'buyrelic' && shop.relic && pay(shop.relic)) addRelic(shop.relic.id);
      if (act === 'buytea' && pay(shop.tea)) evApi.heal(12);
      if (act === 'buyremove' && !shop.remove.sold) {
        if (run.gold < shop.remove.price) { toast('Не хватает монет'); return; }
        removeCardFlow((ok) => { if (ok) { run.gold -= shop.remove.price; shop.remove.sold = true; } render(); });
        return;
      }
      render();
    };
    render();
  }

  /* ---------- Сундук ---------- */
  function goChest() {
    screen.className = 'scr-chest';
    screen.innerHTML = `${topBar()}
      <div class="chest-wrap"><div class="chest">${Art.icon('chest')}</div><p>Сундук-соня сладко храпит.</p></div>
      <div class="row2"><button class="btn" data-act="openchest">Открыть</button><button class="btn ghost" data-act="next">Не будить</button></div>
      ${heroBar(false)}`;
  }
  function openChest() {
    const free = Object.keys(RELICS).filter((r) => !hasRelic(r));
    let msg;
    if (free.length && Math.random() < 0.5) { const id = pick(free); addRelic(id); msg = `Внутри: ${RELICS[id].name}. ${RELICS[id].desc}`; }
    else { const g = rnd(28, 45); run.gold += g; msg = `Внутри ${g} монет.`; }
    $('.chest').classList.add('open');
    $('.chest-wrap p').textContent = msg;
    $('.row2').innerHTML = `<button class="btn" data-act="next">Дальше</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Привал ---------- */
  function goRest() {
    const heal = Math.round(run.maxHp * 0.3);
    screen.className = 'scr-rest';
    screen.innerHTML = `${topBar()}
      <div class="fire-wrap">${Art.icon('fire')}<p>Костёр потрескивает. Снег вокруг тает.</p></div>
      <div class="scrolls">
        <button class="scroll" data-act="rest-heal">Отдохнуть<small>+${heal} HP</small></button>
        <button class="scroll" data-act="rest-burn">Сжечь карту<small>Убрать карту из колоды</small></button>
      </div>
      ${heroBar(false)}`;
  }

  /* ================= БОЙ ================= */
  const apiStatic = { state: null, dmgText: (n) => `${n}` };
  const api = {
    get state() { return C; },
    dmgText(base) {
      const v = calcDmg(base);
      return v > base ? `<b class="up">${v}</b>` : v < base ? `<b class="down">${v}</b>` : `${v}`;
    },
    async attack(base, hits = 1, raw = false) {
      for (let h = 0; h < hits; h++) {
        if (C.enemy.hp <= 0) break;
        heroLunge();
        await hitEnemy(raw ? base : calcDmg(base));
        if (hits > 1) await sleep(140);
      }
    },
    block(n) { C.block += n; floatText($('.hero-fx'), `+${n}`, 'blockf'); },
    async flame(n) {
      C.flame += n;
      renderCombat();
      while (C.flame >= FLAME_MAX && C.enemy.hp > 0) {
        C.flame -= FLAME_MAX;
        await burst();
      }
    },
    draw(n) { drawCards(n); },
    heal(n) { const before = run.hp; run.hp = Math.min(run.maxHp, run.hp + n); floatText($('.hero-fx'), `+${run.hp - before}`, 'healf'); },
    burn(n) { C.enemy.burn += n; floatText($('.enemy-fx'), `Поджог ${n}`, 'burnf'); },
    weak(n) { C.enemy.weak += n; floatText($('.enemy-fx'), 'Ослаблен', 'weakf'); },
    energy(n) { C.energy += n; },
    consumeFlame() { const n = C.flame; C.flame = 0; return n; },
  };

  function calcDmg(base) {
    if (!C) return base;
    let v = base + FLAME_BONUS * C.flame;
    if (C.pWeak > 0) v = Math.floor(v * 0.75);
    return v;
  }
  function enemyDmg(v) {
    let d = v + C.enemy.str;
    if (C.enemy.weak > 0) d = Math.floor(d * 0.75);
    return Math.max(0, d);
  }

  function startCombat(enemyId, tier) {
    const e = ENEMIES[enemyId];
    const scale = tier === 'boss' ? 1 : 1 + run.step * (MAX_STEPS > 20 ? 0.035 : 0.08);
    const hp = Math.round(e.hp * scale);
    C = {
      tier, id: enemyId,
      enemy: { hp, max: hp, block: 0, str: tier === 'boss' ? 0 : Math.floor(run.step / (MAX_STEPS > 20 ? 8 : 3)), weak: 0, burn: 0, pi: 0 },
      draw: shuffle(run.deck.map((c) => ({ ...c }))), hand: [], disc: [], exh: [],
      energy: MAX_ENERGY, block: 0, flame: hasRelic('feather') ? 1 : 0, pWeak: 0, turn: 0,
    };
    selected = -1;
    screen.className = 'scr-combat';
    screen.innerHTML = `
      <div class="topbar slim">${run.relics.map((r) => `<button class="relic" data-relic="${r}">${Art.icon(RELICS[r].art)}</button>`).join('')}<div class="spacer"></div><div class="stepl">${tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс стадии') : `Уровень ${run.step + 1}/${MAX_STEPS}`}</div></div>
      <div class="enemy-zone">
        <div class="intent"></div>
        <div class="enemy ${e.tier}" id="enemy">${Art.enemy(enemyId)}<div class="enemy-fx"></div></div>
        <div class="nameplate"><div class="ename">${e.name}${e.tier !== 'normal' ? `<i>${e.tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс') : 'Элита'}</i>` : ''}</div>
          <div class="ehp"><div class="fill"></div><span></span><div class="eblk"></div></div>
          <div class="estatus"></div>
        </div>
      </div>
      <div class="hero-fx"></div>
      <div class="hand"></div>
      <div class="hb-slot"></div>`;
    startPlayerTurn();
  }

  function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (!C.draw.length) {
        if (!C.disc.length) break;
        C.draw = shuffle(C.disc); C.disc = [];
      }
      if (C.hand.length >= 8) break;
      C.hand.push(C.draw.pop());
    }
  }

  function startPlayerTurn() {
    C.turn++;
    C.block = 0;
    if (C.turn === 1 && hasRelic('bell')) C.block += 6;
    if (hasRelic('thimble')) C.block += 2;
    C.energy = MAX_ENERGY + (C.turn === 1 && hasRelic('scarf') ? 1 : 0);
    drawCards(HAND_SIZE);
    busy = false;
    renderCombat(true);
  }

  function currentIntents() {
    const p = ENEMIES[C.id].pattern[C.enemy.pi % ENEMIES[C.id].pattern.length];
    return p.then ? [p, p.then] : [p];
  }

  function intentHTML(it) {
    if (it.k === 'attack') return `<div class="it atk">${Art.intentIcon('attack')}<b>${enemyDmg(it.v)}${it.hits ? `×${it.hits}` : ''}</b></div>`;
    if (it.k === 'block') return `<div class="it blk">${Art.intentIcon('block')}<b>${it.v}</b></div>`;
    if (it.k === 'buff') return `<div class="it buf">${Art.intentIcon('buff')}<b>+${it.v}</b></div>`;
    if (it.k === 'debuff') return `<div class="it deb">${Art.intentIcon('debuff')}</div>`;
    if (it.k === 'snuff') return `<div class="it snf">${Art.intentIcon('snuff')}<b>${enemyDmg(it.v)}</b></div>`;
    return '';
  }

  function renderCombat(dealAnim = false) {
    if (!C) return;
    const e = C.enemy;
    $('.intent').innerHTML = e.hp > 0 ? currentIntents().map(intentHTML).join('') : '';
    $('.ehp .fill').style.width = `${(Math.max(0, e.hp) / e.max) * 100}%`;
    $('.ehp span').textContent = `${Math.max(0, e.hp)}/${e.max}`;
    $('.eblk').innerHTML = e.block > 0 ? `${Art.intentIcon('block')}<b>${e.block}</b>` : '';
    const st = [];
    if (e.str) st.push(`<i class="s-str">Сила ${e.str}</i>`);
    if (e.weak) st.push(`<i class="s-weak">Ослаблен ${e.weak}</i>`);
    if (e.burn) st.push(`<i class="s-burn">Поджог ${e.burn}</i>`);
    $('.estatus').innerHTML = st.join('');
    $('.hb-slot').innerHTML = heroBar(true);
    renderHand(dealAnim);
  }

  function renderHand(dealAnim) {
    const n = C.hand.length;
    const W = 104; const avail = 384;
    const step = n > 1 ? Math.min(W + 4, (avail - W) / (n - 1)) : 0;
    const total = W + step * (n - 1);
    const x0 = (400 - total) / 2;
    $('.hand').innerHTML = C.hand.map((c, i) => {
      const cd = CARDS[c.id];
      const rot = (i - (n - 1) / 2) * 3.5;
      const lift = Math.abs(i - (n - 1) / 2) * 5;
      const can = cd.cost <= C.energy;
      let left = x0 + i * step;
      if (i === selected) left = Math.max(26, Math.min(400 - W - 26, left));
      return cardHTML(c.id, `inhand ${can ? '' : 'nope'} ${i === selected ? 'sel' : ''} ${dealAnim ? 'deal' : ''}`,
        `data-hi="${i}" style="left:${left}px; --rot:${rot}deg; --lift:${lift}px; --d:${i * 60}ms; z-index:${i === selected ? 50 : i + 1}"`);
    }).join('');
  }

  async function playCard(i) {
    const c = C.hand[i];
    const cd = CARDS[c.id];
    if (cd.cost > C.energy) { toast('Не хватает энергии'); return; }
    busy = true; selected = -1;
    const el = $(`.hand [data-hi="${i}"]`);
    if (el) { el.classList.add('fly'); await sleep(220); }
    C.energy -= cd.cost;
    C.hand.splice(i, 1);
    renderCombat();
    await cd.play(api);
    (cd.exhaust ? C.exh : C.disc).push(c);
    if (C.enemy.hp <= 0) { await winCombat(); return; }
    renderCombat();
    busy = false;
  }

  function floatText(host, text, cls) {
    if (!host) return;
    const f = document.createElement('div');
    f.className = `float ${cls}`; f.textContent = text;
    f.style.left = `${40 + Math.random() * 20}%`;
    host.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  function heroLunge() {
    const p = $('#heroPortrait'); if (!p) return;
    p.classList.remove('lunge'); void p.offsetWidth; p.classList.add('lunge');
  }

  async function hitEnemy(dmg) {
    const e = C.enemy;
    const absorbed = Math.min(e.block, dmg);
    e.block -= absorbed;
    const real = dmg - absorbed;
    e.hp -= real;
    const el = $('#enemy');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    floatText($('.enemy-fx'), real > 0 ? `-${real}` : 'Блок', real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(260);
  }

  async function burst() {
    const fx = document.createElement('div');
    fx.className = 'burst'; fx.innerHTML = `${Art.flame(1.4)}<span>Вспышка!</span>`;
    $('.enemy-zone').appendChild(fx);
    await sleep(380);
    await hitEnemy(BURST_DMG + (hasRelic('flint') ? 5 : 0));
    setTimeout(() => fx.remove(), 500);
    renderCombat();
  }

  async function hitHero(dmg) {
    const absorbed = Math.min(C.block, dmg);
    C.block -= absorbed;
    const real = dmg - absorbed;
    run.hp = Math.max(0, run.hp - real);
    const p = $('#heroPortrait');
    if (p) { p.classList.remove('hurt'); void p.offsetWidth; p.classList.add('hurt'); }
    if (real > 0) { app.classList.remove('redflash'); void app.offsetWidth; app.classList.add('redflash'); }
    floatText($('.hero-fx'), real > 0 ? `-${real}` : 'Блок', real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(300);
  }

  async function endTurn() {
    busy = true; selected = -1;
    C.disc.push(...C.hand); C.hand = [];
    if (C.pWeak > 0) C.pWeak--;
    renderCombat();
    await sleep(250);
    const e = C.enemy;
    e.block = 0;
    if (e.burn > 0) {
      e.hp -= e.burn;
      floatText($('.enemy-fx'), `-${e.burn}`, 'burnf');
      $('#enemy').classList.add('hit');
      e.burn--;
      renderCombat();
      await sleep(400);
      if (e.hp <= 0) { await winCombat(); return; }
    }
    const el = $('#enemy');
    for (const it of currentIntents()) {
      if (it.k === 'attack' || it.k === 'snuff') {
        if (it.k === 'snuff') { C.flame = 0; floatText($('.hero-fx'), 'Огоньки погасли', 'weakf'); }
        for (let h = 0; h < (it.hits || 1); h++) {
          el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
          await sleep(180);
          await hitHero(enemyDmg(it.v));
          if (run.hp <= 0) break;
        }
      } else if (it.k === 'block') { e.block += it.v; floatText($('.enemy-fx'), `+${it.v}`, 'blockf'); }
      else if (it.k === 'buff') { e.str += it.v; floatText($('.enemy-fx'), `Сила +${it.v}`, 'burnf'); }
      else if (it.k === 'debuff') { C.pWeak += it.v; floatText($('.hero-fx'), 'Слабость', 'weakf'); }
      renderCombat();
      await sleep(300);
      if (run.hp <= 0) break;
    }
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
    if (e.weak > 0) e.weak--;
    e.pi++;
    startPlayerTurn();
  }

  async function winCombat() {
    busy = true;
    const el = $('#enemy');
    if (el) el.classList.add('dying');
    await sleep(800);
    const tier = C.tier;
    C = null;
    run.fights++; run.lit++;
    setBg();
    if (hasRelic('snowman')) evApi.heal(4);
    if (tier === 'boss' && isFinalStep(run.step)) { goVictory(); return; }
    goReward(tier);
  }

  /* ---------- Награда ---------- */
  function goReward(tier) {
    const boss = tier === 'boss';
    const gold = (boss ? rnd(50, 60) : tier === 'elite' ? rnd(30, 40) : rnd(12, 20)) + (hasRelic('envelope') ? 8 : 0);
    run.gold += gold;
    if (tier === 'elite' || boss) evApi.giveRelic();
    // после босса стадии Ива переводит дух
    const healed = boss ? Math.min(run.maxHp - run.hp, Math.round(run.maxHp * 0.5)) : 0;
    run.hp += healed;
    const rareChance = boss ? 0.7 : tier === 'elite' ? 0.5 : 0.2;
    const ids = [];
    while (ids.length < 3) {
      const r = Math.random() < rareChance ? 'rare' : 'common';
      const id = pick(Object.keys(CARDS).filter((k) => CARDS[k].rarity === r));
      if (!ids.includes(id)) ids.push(id);
    }
    screen.className = 'scr-reward';
    screen.innerHTML = `${topBar()}
      <div class="ribbon">${boss ? 'Босс повержен!' : 'Победа!'}</div>
      <div class="loot">${Art.icon('coin')} +${gold} монет${healed ? ` · +${healed} HP` : ''}</div>
      <p class="pickhint">Возьми одну карту в колоду</p>
      <div class="reward-cards">${ids.map((id, i) => cardHTML(id, 'reward', `data-act="takecard" data-id="${id}" style="--d:${i * 120}ms"`)).join('')}</div>
      <button class="btn ghost" data-act="next">Пропустить</button>
      ${heroBar(false)}`;
  }

  /* ---------- Финалы ---------- */
  function goVictory() {
    screen.className = 'scr-end win';
    screen.innerHTML = `<div class="ribbon">${STORY.winRibbon}</div>
      <div class="book"><div class="page">
        <div class="book-art moon">${Art.hero()}</div>
        <h1>${STORY.winTitle}</h1>
        <p class="story">${STORY.winText}</p>
        <p class="stats">Побед: ${run.fights} · Карт в колоде: ${run.deck.length} · Талисманов: ${run.relics.length}</p>
      </div></div>
      <button class="btn big" data-act="title">Новая история</button>`;
  }
  function goDefeat() {
    C = null;
    screen.className = 'scr-end lose';
    screen.innerHTML = `<div class="book"><div class="page">
        <div class="book-art dim">${Art.hero()}</div>
        <h1>${STORY.loseTitle}</h1>
        <p class="story">${STORY.loseText}</p>
        <p class="stats">Пройдено уровней: ${run.step + 1} из ${MAX_STEPS} · Побед: ${run.fights}</p>
      </div></div>
      <button class="btn big" data-act="start">Попробовать снова</button>`;
  }

  /* ---------- Обработка нажатий ---------- */
  app.addEventListener('click', (e) => {
    if (overlay.contains(e.target)) return;
    const relic = e.target.closest('[data-relic]');
    if (relic) { const r = RELICS[relic.dataset.relic]; toast(`${r.name}: ${r.desc}`); return; }
    const t = e.target.closest('[data-act], [data-hi]');

    if (screen.className === 'scr-combat') {
      if (busy) return;
      if (t && t.dataset.hi != null) {
        const i = +t.dataset.hi;
        if (selected === i) playCard(i);
        else { selected = i; renderHand(false); }
        return;
      }
      if (e.target.closest('#enemy') && selected >= 0) { playCard(selected); return; }
      if (!t) { if (selected >= 0) { selected = -1; renderHand(false); } return; }
    }
    if (!t) return;
    const act = t.dataset.act;
    switch (act) {
      case 'start': newRun(); break;
      case 'title': goTitle(); break;
      case 'choose': chooseEncounter(+t.dataset.i); break;
      case 'next': advance(); break;
      case 'deck': showDeck(run.deck, `Колода · ${run.deck.length}`); break;
      case 'pile-draw': showDeck(C.draw, 'Осталось в колоде'); break;
      case 'pile-disc': showDeck(C.disc, 'Сброс'); break;
      case 'end': endTurn(); break;
      case 'evopt': eventOption(+t.dataset.i); break;
      case 'openchest': openChest(); break;
      case 'rest-heal': evApi.heal(Math.round(run.maxHp * 0.3)); advance(); break;
      case 'rest-burn': removeCardFlow((ok) => { if (ok) advance(); }); break;
      case 'takecard': run.deck.push(mk(t.dataset.id)); toast(`В колоду: ${CARDS[t.dataset.id].name}`); advance(); break;
      case 'buy': case 'buyrelic': case 'buytea': case 'buyremove': screen.onShop(act, +t.dataset.i); break;
    }
  });

  // Для отладки и автотестов
  window.Game = { get run() { return run; }, get combat() { return C; }, newRun, goMap: () => goMap(), startCombat: (id, t = 'fight') => startCombat(id, t) };

  goTitle();
})();
