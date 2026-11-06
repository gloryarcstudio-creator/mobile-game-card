/* Игровая логика и отрисовка экранов. */
(function () {
  const { CARDS, ENEMIES, RELICS, EVENTS, CLASSES, DIFFICULTIES } = window.Data;
  const STORY = window.Story.story;
  const SKY = window.Story.sky;
  document.title = STORY.title;
  // Путь делится на стадии, последний уровень каждой стадии — её босс
  const STAGES = STORY.stages;
  const SND = window.Sound;
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
  const HAND_MAX = 10;
  // талисманы босса меняют базовые правила боя
  const maxEnergy = () => MAX_ENERGY + ['hourglass', 'bottomless', 'crown'].filter((r) => hasRelic(r)).length;
  const handSize = () => HAND_SIZE - (hasRelic('hourglass') ? 1 : 0) + (hasRelic('moonstone') ? 2 : 0);
  const flameMax = () => (hasRelic('bellows') ? 2 : FLAME_MAX);
  const flameBonus = () => (hasRelic('bellows') ? 0 : FLAME_BONUS);

  /* Пояснения к ключевым словам: показываются в справочнике и по нажатию на статус */
  const GLOSS = [
    ['Огонёк', `Каждый Огонёк даёт атакам +${FLAME_BONUS} урона. На ${FLAME_MAX} Огоньках лампа вспыхивает и бьёт врага на ${BURST_DMG}.`],
    ['Решимость', 'Каждое очко добавляет +1 урона каждой атаке. Бывает до конца боя или до конца хода.'],
    ['Уязвим', 'Враг получает на 50% больше урона от атак и Вспышек. Число — сколько ходов это продлится.'],
    ['Ослаблен', 'Враг наносит на 25% меньше урона.'],
    ['Поджог', 'В конце вашего хода враг теряет столько HP, а Поджог слабеет на 1.'],
    ['Шипы', 'Когда враг бьёт вас, он сам получает столько урона. Колючие враги так же ранят вас за каждый удар по ним.'],
    ['Хрупкость', 'Карты и талисманы дают вам на 25% меньше защиты. Число — сколько ходов это продлится.'],
    ['Сила врага', 'Каждое очко добавляет врагу +1 урона. Её можно отнять морозом.'],
    ['Спит', 'Враг пропускает свой следующий ход.'],
    ['Доставка', 'Эффект карты сработает в начале вашего следующего хода.'],
    ['Серия', 'Карта сильнее за каждую карту, сыгранную до неё в этот ход.'],
    ['Удержание', 'Карта не сбрасывается в конце хода и остаётся в руке.'],
    ['Сгорает', 'После розыгрыша карта уходит до конца боя.'],
    ['Чары', 'Разыгрываются один раз и действуют до конца боя. Активные чары видны над рукой.'],
    ['Помехи', 'Враги подкидывают в колоду Кляксы, Ледышки, Сургуч и Недоставленные письма. Они исчезают после боя.'],
    ['Кража', 'Некоторые враги крадут монеты. Если победить вора, монеты вернутся.'],
    ['Улучшение', 'У костра, у кузнеца и в лавке карту можно улучшить. Улучшенная карта отмечена плюсом.'],
    ['Талисманы босса', 'После босса стадии можно выбрать один из трёх сильных талисманов. У многих есть цена.'],
    ['Редкость', 'Карты и талисманы бывают обычными (серый камень), необычными (синий) и редкими (фиолетовый). Чем сильнее противник, тем чаще после него выпадают необычные и редкие.'],
    ['Приёмы врагов', 'У многих врагов есть свои хитрости: матрёшки раскрываются, самовар закипает, туман глушит удары, шутиха взрывается. Приёмы видны значками под именем врага, нажмите на значок, чтобы прочитать.'],
    ['Герои', 'У каждого героя своя колода, особенность и карты, которые выпадают только ему. Общие карты под его билд в наградах и лавке встречаются чаще.'],
  ];
  const CHARM_TIP = {
    mittens: (n) => `Варежки: в начале хода ${n} защиты`,
    inkpen: (n) => `Перо и чернила: каждый Навык наносит ${n} урона`,
    eveninglamp: (n) => `Вечерняя лампа: в начале хода +${n} Огонёк`,
    stubborn: (n) => `Упрямство: в начале хода +${n} Решимость`,
    compass: (n) => `Компас: каждый ход +${n} карта`,
    hearth: (n) => `Сердце костра: в начале хода Поджог ${n}`,
    rhythm: (n) => `Ритм шагов: каждая третья карта за ход даёт +${n} Огонёк`,
    standfast: () => 'Стоять до утра: защита не сгорает в начале хода',
    nightshift: (n) => `Ночная смена: в конце хода ${n} защиты за каждую неистраченную энергию`,
    aurora: (n) => `Северное сияние: в начале хода +${n} энергия`,
  };

  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const screen = $('#screen');
  const overlay = $('#overlay');
  /* ---------- Настройки и статистика (хранятся в браузере) ---------- */
  const VERSION = '0.8';
  const SETTINGS_KEY = 'lastray.settings';
  const STATS_KEY = 'lastray.stats';
  const loadJSON = (k, def) => { try { return { ...def, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (e) { return { ...def }; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } };
  // skipIntro — сразу в путь без вступления, fast — быстрые анимации,
  // snow — снегопад (выключение экономит заряд), oneTap — карта разыгрывается с одного касания
  // cls — последний выбранный герой
  // diff — последний выбранный уровень сложности (0..4, по умолчанию «Обычный маршрут»)
  const SETTINGS = loadJSON(SETTINGS_KEY, { skipIntro: false, fast: false, snow: true, oneTap: false, cls: 'lamp', diff: 1 });
  if (!CLASSES[SETTINGS.cls]) SETTINGS.cls = 'lamp';
  if (!DIFFICULTIES[SETTINGS.diff]) SETTINGS.diff = 1;
  const STATS_DEF = { runs: 0, wins: 0, losses: 0, best: 0, fights: 0, elites: 0, bosses: 0, cards: 0 };
  const STATS = loadJSON(STATS_KEY, STATS_DEF);
  const saveStats = () => { saveJSON(STATS_KEY, STATS); achCheck(); };

  /* ---------- Достижения ---------- */
  // c — счётчики и флаги, s — наборы (разные карты, талисманы, противники), got — когда получено,
  // seenAt — когда панель открывали в последний раз (для пометки «новое»)
  const ACH_KEY = 'lastray.ach';
  const ACH_DEF = { c: {}, s: {}, got: {}, seenAt: 0 };
  const ACH = loadJSON(ACH_KEY, ACH_DEF);
  const ACH_LIST = window.Achievements.LIST;
  const achProgress = (a) => {
    if (a.src === 'stat') return STATS[a.key] || 0;
    if (a.src === 's') return (ACH.s[a.key] || []).length;
    if (a.src === 'has') return (ACH.s[a.key] || []).includes(a.item) ? 1 : 0;
    return ACH.c[a.key] || 0;
  };
  const achDone = (a) => !!ACH.got[a.id];
  const achQueue = [];
  let achShowing = false;
  // проверить цели, отметить выполненные и показать всплывашку (silent — без неё)
  function achCheck(silent) {
    for (const a of ACH_LIST) {
      if (achDone(a) || achProgress(a) < a.goal) continue;
      ACH.got[a.id] = Date.now();
      if (!silent) achQueue.push(a);
    }
    saveJSON(ACH_KEY, ACH);
    if (achQueue.length && !achShowing) achNextToast();
  }
  const ach = {
    add(k, n = 1) { if (n > 0) { ACH.c[k] = (ACH.c[k] || 0) + n; achCheck(); } },
    max(k, v) { if (v > (ACH.c[k] || 0)) { ACH.c[k] = v; achCheck(); } },
    flag(k) { if (!ACH.c[k]) { ACH.c[k] = 1; achCheck(); } },
    put(k, item) { const s = ACH.s[k] || (ACH.s[k] = []); if (!s.includes(item)) { s.push(item); achCheck(); } },
  };
  const achArt = (a) => (a.art === 'h' ? Art.hero() : a.art.startsWith('c:') ? Art.hero(CLASSES[a.art.slice(2)].look)
    : a.art.startsWith('e:') ? Art.enemy(a.art.slice(2)) : Art.icon(a.art.slice(2)));
  const achStars = (a) => (a.stars ? ` <i class="astars">${'★'.repeat(a.stars)}</i>` : '');
  function achNextToast() {
    if (!achQueue.length) { achShowing = false; return; }
    achShowing = true;
    // если открылось сразу много, показываем два и общий итог по остальным
    if (achQueue.length > 3) { const rest = achQueue.splice(2); achQueue.push({ summary: rest.length }); }
    const a = achQueue.shift();
    const t = document.createElement('div');
    t.className = 'achtoast';
    t.innerHTML = a.summary
      ? `<span class="aport collect">${ICO.medal}</span><span><small>Достижения получены</small><b>И ещё ${a.summary}</b></span>`
      : `<span class="aport ${a.cat}">${achArt(a)}</span><span><small>Достижение получено</small><b>${a.name}${achStars(a)}</b></span>`;
    app.appendChild(t);
    SND.sfx('achieve');
    setTimeout(() => { t.remove(); achNextToast(); }, SETTINGS.fast ? 1700 : 2600);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, SETTINGS.fast ? ms * 0.5 : ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  let uidSeq = 1;
  const mk = (id, up = false) => ({ uid: uidSeq++, id, up });
  // стоимость с учётом улучшения; null — карту нельзя разыграть
  const costOf = (c) => { const d = CARDS[c.id]; return c.up && d.upCost != null ? d.upCost : d.cost; };
  const canUpgrade = (c) => !c.up && CARDS[c.id].rarity !== 'status';
  const cardName = (c) => `${CARDS[c.id].name}${c.up ? '+' : ''}`;
  /* Герой забега (или последний выбранный, пока забега нет) */
  const heroId = () => (run && CLASSES[run.cls] ? run.cls : SETTINGS.cls);
  const hero = () => CLASSES[heroId()];
  const heroArt = (cls = heroId()) => Art.hero(CLASSES[cls].look);
  const txt = (v) => (typeof v === 'function' ? v(hero()) : v);
  // сложность забега; у сохранений до её появления — «Обычный маршрут»
  const diffOf = (r) => (r && DIFFICULTIES[r.diff] ? r.diff : 1);
  const DIFF = () => DIFFICULTIES[diffOf(run)];
  // карты, которые могут выпасть этому герою: общие и его собственные
  const cardPool = (rarity) => Object.keys(CARDS).filter((k) => CARDS[k].rarity === rarity && (!CARDS[k].cls || CARDS[k].cls === heroId()));
  // случайная карта с перевесом в сторону билда героя
  function pickCard(rarity, exclude = []) {
    const h = hero();
    const list = cardPool(rarity).filter((k) => !exclude.includes(k));
    const w = list.map((k) => (CARDS[k].cls || h.favored.includes(k) ? 3 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }

  /* ---------- Масштабирование под экран телефона ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 400, window.innerHeight / 860);
    app.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- Снег ---------- */
  // снегопад можно выключить в настройках: тогда анимация останавливается совсем
  const snow = (function () {
    const cv = $('#snow'); const ctx = cv.getContext('2d');
    cv.width = 400; cv.height = 860;
    const flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * 400, y: Math.random() * 860, r: 0.8 + Math.random() * 2.2, v: 0.3 + Math.random() * 0.9, d: Math.random() * 6 }));
    let running = false;
    function tick(t) {
      ctx.clearRect(0, 0, 400, 860);
      if (!SETTINGS.snow) { running = false; return; }
      ctx.fillStyle = 'rgba(235,242,255,0.85)';
      for (const f of flakes) {
        f.y += f.v; f.x += Math.sin(t / 1400 + f.d) * 0.35;
        if (f.y > 870) { f.y = -10; f.x = Math.random() * 400; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    const start = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
    if (SETTINGS.snow) start();
    return { start };
  })();

  /* Фон меняется после каждого уровня: палитра неба смешивается по ключевым кадрам,
     а сцена (город или окраина) задаётся стадией */
  function setBg(titleT) {
    const step = run ? run.step : 0;
    const t = titleT != null ? titleT : MAX_STEPS > 1 ? Math.min(1, step / (MAX_STEPS - 1)) : 0;
    const g = STAGES[stageOf(step)] || STAGES[0];
    const lamps = titleT != null ? 2 : run && STORY.lamps ? STORY.lamps(run) : 0;
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

  function newRun(cls = SETTINGS.cls, diff = SETTINGS.diff) {
    STATS.runs++; saveStats();
    const h = CLASSES[cls] || CLASSES.lamp;
    const d = DIFFICULTIES[diff] || DIFFICULTIES[1];
    run = {
      cls, diff: DIFFICULTIES.indexOf(d), hp: h.hp + d.heroHp, maxHp: h.hp + d.heroHp, gold: h.gold, step: 0, lit: 0, relics: [h.relic], fights: 0,
      deck: [...h.deck, ...d.curses].map((id) => mk(id)),
      choices: null,
      // боссы стадий выбираются случайно в начале забега
      bosses: STAGES.map((g) => pick(g.boss)),
      // учёт встреч, чтобы враги не повторялись
      seen: {}, offered: {}, recent: [], lastOffered: [],
    };
    setBg();
    goMap();
  }
  const hasRelic = (id) => run.relics.includes(id);

  /* ---------- Сохранение ----------
     Забег сохраняется в браузере после каждого шага. pending — где игрок остановился
     внутри шага: бой, событие, лавка, награда... Бой при продолжении начинается заново. */
  const STORY_ID = Object.keys(window.Story.STORIES).find((k) => window.Story.STORIES[k] === STORY) || 'main';
  const SAVE_KEY = `lastray.save.${STORY_ID}`;
  function save(pending = null) {
    if (!run) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, run, pending, at: Date.now() })); } catch (e) { /* хранилище недоступно */ }
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 && s.run && Array.isArray(s.run.deck) ? s : null; } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* пусто */ } }

  function continueRun() {
    const s = loadSave();
    if (!s) { goTitle(); return; }
    run = s.run; C = null;
    // сохранения до появления героев — это забег Ивы
    if (!run.cls) { run.cls = 'lamp'; if (!run.relics.includes('ivalamp')) run.relics.unshift('ivalamp'); }
    uidSeq = Math.max(uidSeq, ...run.deck.map((c) => c.uid + 1));
    setBg();
    SND.music(mapTrack());
    const p = s.pending;
    const ev = p && p.t === 'event' && EVENTS.find((e) => e.id === p.ev);
    if (!p) goMap();
    else if (p.t === 'fight' || p.t === 'elite' || p.t === 'boss') startCombat(p.enemy, p.t);
    else if (ev) goEvent(ev);
    else if (p.t === 'shop') goShop(p.shop);
    else if (p.t === 'chest') goChest();
    else if (p.t === 'rest') goRest();
    else if (p.t === 'next') advance();
    else if (p.t === 'reward') renderReward(p.r);
    else if (p.t === 'bossrelic') goBossRelic(p.opts);
    else goMap();
  }

  /* ---------- Общие куски интерфейса ---------- */
  const TYPE_LABEL = { atk: 'Атака', skill: 'Навык', charm: 'Чары', status: 'Помеха' };
  // камень редкости на карте и подписи редкости талисманов
  const RARITY_GEM = { common: 'Обычная', uncommon: 'Необычная', rare: 'Редкая' };
  const TIER_LABEL = { common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', boss: 'Трофей босса', class: 'Особенность героя' };
  /* Карта: принимает экземпляр {id, up, grow} или просто id */
  function cardHTML(card, extra = '', attrs = '') {
    const inst = typeof card === 'string' ? { id: card, up: false } : card;
    const c = CARDS[inst.id];
    const g = C ? api : apiStatic;
    const cost = costOf(inst);
    let desc = c.desc(g, inst.up, inst);
    if (c.retain) desc += ' Удержание.';
    if (c.exhaust && c.type !== 'status') desc += ' Сгорает.';
    const plain = desc.replace(/<[^>]+>/g, '');
    return `<div class="card ${c.type} r-${c.rarity} ${inst.up ? 'up' : ''} ${extra}" ${attrs}>
      <div class="cost ${cost == null ? 'none' : ''}"><span>${cost == null ? '✕' : cost}</span></div>
      <div class="ctitle"><span>${c.name}${inst.up ? '<i>+</i>' : ''}</span></div>
      <div class="cart">${Art.icon(c.art)}</div>
      <div class="cdesc ${plain.length > 64 ? 'xlong' : plain.length > 48 ? 'long' : ''}"><span>${desc}</span></div>
      <div class="ctype">${RARITY_GEM[c.rarity] ? `<i class="gem g-${c.rarity}"></i>` : ''}${TYPE_LABEL[c.type]}</div>
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
      <div class="relics">${relicIcons(2)}</div>
    </div>`;
  }

  /* Значки талисманов: последние max штук и кнопка со списком остальных */
  function relicIcons(max) {
    const list = run.relics;
    const shown = list.length > max ? list.slice(-(max - 1)) : list;
    const more = list.length - shown.length;
    return shown.map((r) => `<button class="relic rt-${RELICS[r].tier}" data-relic="${r}">${Art.icon(RELICS[r].art)}</button>`).join('')
      + (more > 0 ? `<button class="relic more" data-act="relics">+${more}</button>` : '');
  }

  function showRelics() {
    showOverlay(`<h2>Талисманы · ${run.relics.length}</h2><div class="rlist">${run.relics.map((r) => `<div class="rrow ${RELICS[r].tier}">${Art.icon(RELICS[r].art)}<span><b>${RELICS[r].name}<em class="rtier ${RELICS[r].tier}">${TIER_LABEL[RELICS[r].tier]}</em></b><small>${RELICS[r].desc}</small></span></div>`).join('')}</div>
      <button class="btn" data-act="close">Закрыть</button>`, (e) => { if (e.target.closest('[data-act="close"]')) hideOverlay(); });
  }

  function heroBar(inCombat) {
    const hpPct = (run.hp / run.maxHp) * 100;
    const flame = inCombat ? C.flame : 0;
    return `<div class="herobar">
      <div class="portrait" id="heroPortrait">${heroArt()}</div>
      <div class="hb-mid">
        <div class="hpbar"><div class="fill" style="width:${hpPct}%"></div><span>${run.hp}/${run.maxHp}</span>
          ${inCombat && C.block > 0 ? `<div class="hblk">${Art.intentIcon('block')}<b>${C.block}</b></div>` : ''}</div>
        <div class="hb-row">
          ${inCombat ? `<div class="lamp" data-tip="${GLOSS[0][1]}">${Array.from({ length: flameMax() }, (_, i) => `<i class="pip ${i < flame ? 'on' : ''}">${Art.flame(1)}</i>`).join('')}</div>` : `<div class="hero-name">${hero().name}</div>`}
        </div>
      </div>
      ${inCombat ? `<div class="energy"><b>${C.energy}</b><small>/${maxEnergy()}</small></div>
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

  function showDeck(list, title, onPick, preview) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id) || (a.up ? 1 : 0) - (b.up ? 1 : 0));
    const view = (c) => (preview === 'up' ? { ...c, up: true } : c);
    showOverlay(`<h2>${title}</h2>${preview === 'up' ? '<p class="ovhint">Так карты будут выглядеть после улучшения</p>' : ''}<div class="grid">${sorted.map((c) => cardHTML(view(c), 'mini', `data-uid="${c.uid}"`)).join('') || '<p class="muted">Пусто</p>'}</div>
      <button class="btn" data-act="close">${onPick ? 'Отмена' : 'Закрыть'}</button>`, (e) => {
      const cardEl = e.target.closest('.card');
      if (onPick && cardEl) { onPick(+cardEl.dataset.uid); return; }
      if (e.target.closest('[data-act="close"]') || !onPick) { hideOverlay(); if (onPick) onPick(null); }
    });
  }

  /* ---------- Титульный экран ---------- */
  // какая пьеса звучит на пути: город, окраина или финальная ночь
  const mapTrack = () => ['stage1', 'stage2', 'night'][Math.min(2, run ? stageOf(run.step) : 0)];

  function showGlossary(back) {
    showOverlay(`<h2>Справочник</h2><dl class="gloss">${GLOSS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <button class="btn" data-act="close">${back ? 'Назад' : 'Закрыть'}</button>`, (e) => { if (e.target.closest('[data-act="close"]')) { if (back) back(); else hideOverlay(); } });
  }

  /* ---------- Главное меню ---------- */
  function goTitle() {
    run = null; C = null; busy = false; setBg(0.45);
    hideOverlay();
    SND.music('title');
    const s = loadSave();
    const info = s && `${CLASSES[s.run.cls || 'lamp'].name} · ${DIFFICULTIES[diffOf(s.run)].name} · ур. ${s.run.step + 1} · ${s.run.hp}/${s.run.maxHp} HP`;
    screen.className = 'scr-title';
    screen.innerHTML = `
      <div class="logo"><small>почтовая сказка</small><h1>${STORY.title}</h1></div>
      <div class="title-hero">${heroArt(s ? (s.run.cls || 'lamp') : SETTINGS.cls)}</div>
      <div class="menu">
        ${s ? `<button class="btn big" data-act="continue">Продолжить<small>${info}</small></button>` : ''}
        <button class="btn ${s ? 'ghost' : 'big'}" data-act="newgame">Новая игра</button>
        <button class="btn ghost achbtn" data-act="ach">${ICO.medal}<span>Достижения<small>${achCount()} из ${ACH_LIST.length}</small></span>${achHasNew() ? '<i class="newdot"></i>' : ''}</button>
        <div class="menu-row"><button class="btn ghost" data-act="gloss">Справочник</button><button class="btn ghost" data-act="settings">Настройки</button></div>
      </div>
      <p class="savehint">${s ? 'Прогресс сохраняется после каждого уровня' : ''}</p>`;
  }

  function askNewGame() {
    const s = loadSave();
    const begin = () => goClassSelect();
    if (!s) { begin(); return; }
    showOverlay(`<div class="pause"><h2>Начать заново?</h2>
      <p class="ovhint">Сохранённый забег на уровне ${s.run.step + 1} из ${MAX_STEPS} будет потерян.</p>
      <button class="btn" data-act="c-yes">Начать заново</button>
      <button class="btn ghost" data-act="c-no">Отмена</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      hideOverlay();
      if (b.dataset.act === 'c-yes') { clearSave(); begin(); }
    });
  }

  /* Пауза во время забега: справочник и выход в главное меню */
  function showPause() {
    showOverlay(`<div class="pause"><h2>Пауза</h2>
      <p class="ovhint">${hero().name} · ${DIFF().name}</p>
      <p class="ovhint">${C ? 'Прогресс сохранён до начала этого боя. Если выйти, бой начнётся заново.' : 'Прогресс сохранён. Можно выйти и вернуться позже.'}</p>
      <button class="btn" data-act="p-resume">Вернуться в игру</button>
      <button class="btn ghost" data-act="p-gloss">Справочник</button>
      <button class="btn ghost" data-act="p-settings">Настройки</button>
      <button class="btn ghost" data-act="p-title">Главное меню</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'p-resume') hideOverlay();
      if (b.dataset.act === 'p-gloss') showGlossary();
      if (b.dataset.act === 'p-settings') showSettings();
      if (b.dataset.act === 'p-title') {
        if (C && busy) { toast('Дождись конца хода'); return; }
        goTitle();
      }
    });
  }

  /* ---------- Настройки ---------- */
  const ICO = {
    gear: '<svg viewBox="0 0 40 40"><path d="M17 4 h6 l1 5 l4 2 l4 -3 l4 4 l-3 4 l2 4 l5 1 v6 l-5 1 l-2 4 l3 4 l-4 4 l-4 -3 l-4 2 l-1 5 h-6 l-1 -5 l-4 -2 l-4 3 l-4 -4 l3 -4 l-2 -4 l-5 -1 v-6 l5 -1 l2 -4 l-3 -4 l4 -4 l4 3 l4 -2z" fill="#f3d27c" stroke="#17121f" stroke-width="2" stroke-linejoin="round" transform="translate(20 20) scale(.82) translate(-20 -20)"/><circle cx="20" cy="20" r="5.5" fill="#262d45" stroke="#17121f" stroke-width="2"/></svg>',
    note: '<svg viewBox="0 0 40 40"><path d="M15 29 V9 l16 -4 v20" fill="none" stroke="#f3d27c" stroke-width="3"/><ellipse cx="11" cy="29" rx="5.5" ry="4.5" fill="#f3d27c"/><ellipse cx="27" cy="25" rx="5.5" ry="4.5" fill="#f3d27c"/></svg>',
    stats: '<svg viewBox="0 0 40 40"><path d="M8 32 h26" stroke="#17121f" stroke-width="3" stroke-linecap="round"/><rect x="10" y="18" width="5" height="13" fill="#f3d27c" stroke="#17121f" stroke-width="2"/><rect x="18" y="10" width="5" height="21" fill="#f3d27c" stroke="#17121f" stroke-width="2"/><rect x="26" y="22" width="5" height="9" fill="#f3d27c" stroke="#17121f" stroke-width="2"/></svg>',
    book: '<svg viewBox="0 0 40 40"><path d="M6 10 q7 -3 14 1 v22 q-7 -4 -14 -1z M34 10 q-7 -3 -14 1 v22 q7 -4 14 -1z" fill="#f3d27c" stroke="#17121f" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 16 h6 M10 21 h6 M24 16 h6 M24 21 h6" stroke="#8a6a2a" stroke-width="1.8"/></svg>',
    medal: '<svg viewBox="0 0 40 40"><path d="M11 3 h7 l5 13 h-7z" fill="#c8423a" stroke="#17121f" stroke-width="2" stroke-linejoin="round"/><path d="M29 3 h-7 l-5 13 h7z" fill="#8a2a24" stroke="#17121f" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="25" r="11" fill="#f3d27c" stroke="#17121f" stroke-width="2.2"/><circle cx="20" cy="25" r="7.5" fill="none" stroke="#b08a2a" stroke-width="1.5"/><path d="M14.5 21.5 h11 v7.5 h-11z" fill="#fff4d6" stroke="#17121f" stroke-width="1.4"/><path d="M14.5 21.5 l5.5 4 l5.5 -4" fill="none" stroke="#17121f" stroke-width="1.4"/></svg>',
    reset: '<svg viewBox="0 0 40 40"><path d="M31 20 a11 11 0 1 1 -4 -8.5" fill="none" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round"/><path d="M28 5 l1 8 l-8 1" fill="none" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const TOGGLES = [
    ['skipIntro', 'Вступление', 'Показывать', 'Пропускать', false],
    ['fast', 'Анимации', 'Обычные', 'Быстрые', false],
    ['snow', 'Снегопад', 'Идёт', 'Нет', true],
    ['oneTap', 'Розыгрыш карты', 'В 2 касания', 'В 1 касание', false],
  ];

  function settingsHTML() {
    const p = SND.prefs;
    const slider = (kind, label, icon, v) => `<div class="srow"><span class="sico">${icon}</span><label for="vol-${kind}">${label}</label>
      <input type="range" id="vol-${kind}" data-vol="${kind}" min="0" max="100" step="5" value="${Math.round(v * 100)}" style="--p:${Math.round(v * 100)}%"><b class="sval">${Math.round(v * 100)}</b></div>`;
    // переключатель: первый вариант — значение, при котором настройка «выключена» (или включена для snow)
    const toggle = ([key, label, a, b, onIsFirst]) => {
      const first = onIsFirst ? SETTINGS[key] : !SETTINGS[key];
      return `<div class="trow"><span class="tlabel">${label}</span>
        <button class="radio ${first ? 'on' : ''}" data-set="${key}" data-val="${onIsFirst ? 1 : 0}"><i></i>${a}</button>
        <button class="radio ${first ? '' : 'on'}" data-set="${key}" data-val="${onIsFirst ? 0 : 1}"><i></i>${b}</button></div>`;
    };
    return `<div class="settings">
      <div class="sribbon">Настройки</div>
      <button class="sclose" data-act="s-close" aria-label="Закрыть">✕</button>
      <div class="sicons">
        <button data-act="s-ach"><span>${ICO.medal}</span>Достижения</button>
        <button data-act="s-gloss"><span>${ICO.book}</span>Справочник</button>
        <button data-act="s-stats"><span>${ICO.stats}</span>Статистика</button>
        <button data-act="s-reset"><span>${ICO.reset}</span>Сбросить</button>
      </div>
      <div class="sline"></div>
      ${slider('sfx', 'Звуки', Art.soundIcon('all'), p.sfxVol)}
      ${slider('music', 'Музыка', ICO.note, p.musicVol)}
      <div class="sline"></div>
      ${TOGGLES.map(toggle).join('')}
      <div class="sline"></div>
      <p class="sfoot"><span>Версия ${VERSION}</span><span>Сохранение в этом браузере</span></p>
    </div>`;
  }

  function showSettings() {
    const render = () => {
      showOverlay(settingsHTML(), onClick);
      overlay.querySelectorAll('input[data-vol]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const v = +inp.value / 100;
          inp.style.setProperty('--p', `${inp.value}%`);
          inp.nextElementSibling.textContent = inp.value;
          SND.setVolume(inp.dataset.vol, v);
        });
        // звук-образец, чтобы услышать громкость
        inp.addEventListener('change', () => { if (inp.dataset.vol === 'sfx') SND.sfx('coin'); });
      });
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-act], [data-set]');
      if (!b) return;
      if (b.dataset.set) {
        SETTINGS[b.dataset.set] = b.dataset.val === '1';
        saveJSON(SETTINGS_KEY, SETTINGS);
        if (b.dataset.set === 'snow' && SETTINGS.snow) snow.start();
        app.classList.toggle('fast', SETTINGS.fast);
        render();
        return;
      }
      const act = b.dataset.act;
      if (act === 's-close') hideOverlay();
      if (act === 's-gloss') showGlossary(showSettings);
      if (act === 's-ach') showAchievements(showSettings);
      if (act === 's-stats') showStats();
      if (act === 's-reset') askReset();
    };
    render();
  }

  /* ---------- Панель достижений ---------- */
  const achCount = (cat) => ACH_LIST.filter((a) => (!cat || a.cat === cat) && achDone(a)).length;
  const achHasNew = () => ACH_LIST.some((a) => ACH.got[a.id] > ACH.seenAt);
  const fmt = (n) => n.toLocaleString('ru-RU');
  // почтовый штемпель «Получено» с датой
  function achStamp(ts) {
    const d = new Date(ts);
    const dd = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `<svg class="astamp" viewBox="0 0 92 80"><g fill="none" stroke="currentColor">
      <path d="M2 30 q5 -4 10 0 t10 0 t10 0 M2 40 q5 -4 10 0 t10 0 t10 0 M2 50 q5 -4 10 0 t10 0 t10 0" stroke-width="2"/>
      <circle cx="54" cy="40" r="34" stroke-width="3"/><circle cx="54" cy="40" r="23" stroke-width="1.6"/></g>
      <text font-size="10.5" letter-spacing="1"><textPath href="#ach-arc" startOffset="50%" text-anchor="middle">ПОЛУЧЕНО</textPath></text>
      <text x="54" y="42" font-size="13" text-anchor="middle">${dd}</text>
      <text x="54" y="53" font-size="8" text-anchor="middle">${d.getFullYear()}</text>
      <text x="54" y="69" font-size="8" text-anchor="middle">★ ★ ★</text></svg>`;
  }
  function achRow(a, since) {
    const done = achDone(a);
    const p = Math.min(achProgress(a), a.goal);
    const desc = a.desc.replace('{p}', `<b>${fmt(p)}/${fmt(a.goal)}</b>`);
    const fresh = done && ACH.got[a.id] > since;
    return `<div class="arow ${done ? 'done' : 'locked'}">
      <div class="aport ${a.cat}">${achArt(a)}${fresh ? '<em class="anew">новое</em>' : ''}</div>
      <div class="atext"><h3>${a.name}${achStars(a)}</h3><p>${desc}</p>
        ${!done && a.goal > 1 ? `<div class="abar"><i style="width:${(p / a.goal) * 100}%"></i></div>` : ''}</div>
      ${done ? achStamp(ACH.got[a.id]) : '<span class="aslot"></span>'}
    </div>`;
  }
  function showAchievements(back) {
    const since = ACH.seenAt;
    ACH.seenAt = Date.now(); saveJSON(ACH_KEY, ACH);
    let tab = 'path';
    const total = ACH_LIST.length;
    const got = achCount();
    const close = () => { if (back) back(); else { hideOverlay(); if (screen.className === 'scr-title') goTitle(); } };
    showOverlay(`<div class="achp">
      <svg style="position:absolute;width:0;height:0"><defs><path id="ach-arc" d="M28.5 40 a25.5 25.5 0 0 1 51 0"/></defs></svg>
      <div class="achhead">
        <span class="achtag">${ICO.medal}Достижения</span>
        <button class="sclose" data-act="a-close" aria-label="Закрыть">✕</button>
        <div class="achbar"><i style="width:${(got / total) * 100}%"></i><b>${got}/${total}</b></div>
      </div>
      <div class="achlist"></div>
      <div class="achtabs">${window.Achievements.CATS.map(([id, name]) => `<button data-tab="${id}"><span>${name}</span><small>${achCount(id)}/${ACH_LIST.filter((a) => a.cat === id).length}</small></button>`).join('')}</div>
    </div>`, (e) => {
      const b = e.target.closest('[data-act], [data-tab]');
      if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; renderList(); return; }
      if (b.dataset.act === 'a-close') close();
    });
    const renderList = () => {
      const list = overlay.querySelector('.achlist');
      list.innerHTML = ACH_LIST.filter((a) => a.cat === tab).map((a) => achRow(a, since)).join('');
      list.scrollTop = 0;
      overlay.querySelectorAll('.achtabs button').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    };
    renderList();
  }

  function showStats() {
    const rows = [
      ['Забегов начато', STATS.runs], ['Писем доставлено', STATS.wins], ['Поражений', STATS.losses],
      ['Лучший уровень', STATS.best ? `${STATS.best} из ${MAX_STEPS}` : '—'], ['Побед в боях', STATS.fights],
      ['Побеждено элит', STATS.elites], ['Побеждено боссов', STATS.bosses], ['Сыграно карт', STATS.cards],
    ];
    showOverlay(`<div class="settings small"><div class="sribbon">Статистика</div>
      <dl class="statlist">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <button class="btn" data-act="back">Назад</button></div>`, (e) => { if (e.target.closest('[data-act="back"]')) showSettings(); });
  }

  function askReset() {
    showOverlay(`<div class="pause"><h2>Сбросить прогресс?</h2>
      <p class="ovhint">Сохранённый забег, статистика и достижения будут удалены. Настройки останутся.</p>
      <button class="btn" data-act="r-yes">Сбросить</button>
      <button class="btn ghost" data-act="r-no">Отмена</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'r-no') { showSettings(); return; }
      clearSave();
      Object.assign(ACH, { c: {}, s: {}, got: {}, seenAt: 0 });
      Object.assign(STATS, STATS_DEF); saveStats();
      hideOverlay();
      toast('Прогресс сброшен');
      goTitle();
    });
  }

  /* ---------- Выбор героя перед забегом ---------- */
  const heroCards = (id) => Object.keys(CARDS).filter((k) => CARDS[k].cls === id);
  function goClassSelect(sel = SETTINGS.cls, diff = SETTINGS.diff) {
    run = null; C = null; busy = false; setBg(0.45);
    hideOverlay();
    SND.music('title');
    const h = CLASSES[sel];
    const r = RELICS[h.relic];
    const own = heroCards(sel);
    screen.className = 'scr-class';
    screen.dataset.cls = sel;
    screen.dataset.diff = diff;
    const d = DIFFICULTIES[diff];
    const won = ACH.s.winsDiff || [];
    screen.innerHTML = `
      <div class="clshead"><h2>Кто понесёт письмо?</h2><p>У каждого героя свой путь к победе</p></div>
      <div class="clsrow">${Object.entries(CLASSES).map(([id, c]) => `<button class="clscard ${id === sel ? 'on' : ''}" data-act="pickcls" data-cls="${id}">
        <span class="cp ${id}">${heroArt(id)}</span><b>${c.name}</b><small>${c.role}</small></button>`).join('')}</div>
      <div class="clsinfo">
        <div class="clsbig ${sel}">${heroArt(sel)}</div>
        <div class="clstext">
          <h3>${h.name}<small>${h.role}</small></h3>
          <div class="clsstats"><span>${Art.icon('heart')}${h.hp} HP</span><span>${Art.icon('coin')}${h.gold}</span></div>
          <p class="clsbuild">${h.build}</p>
          <p class="clsabout">${h.about}</p>
        </div>
      </div>
      <div class="clsrelic">${Art.icon(r.art)}<span><small>Особенность</small><b>${r.name}</b>${r.desc}</span></div>
      <button class="clscards" data-act="clscards"><span class="mini3">${own.map((k) => Art.icon(CARDS[k].art)).join('')}</span><span><b>Карты героя</b><small>${own.map((k) => CARDS[k].name).join(', ')}</small></span><i>›</i></button>
      <div class="diffbox">
        <div class="diffhead"><button class="darrow" data-act="diffset" data-d="${Math.max(0, diff - 1)}" ${diff ? '' : 'disabled'}>‹</button>
          <span><small>Сложность ${diff + 1} из ${DIFFICULTIES.length}</small><b>${d.name}${won.includes(diff) ? ' <i class="dwon">✓</i>' : ''}</b></span>
          <button class="darrow" data-act="diffset" data-d="${Math.min(DIFFICULTIES.length - 1, diff + 1)}" ${diff < DIFFICULTIES.length - 1 ? '' : 'disabled'}>›</button></div>
        <div class="dpips">${DIFFICULTIES.map((x, i) => `<button class="dpip d${i} ${i <= diff ? 'on' : ''} ${won.includes(i) ? 'won' : ''}" data-act="diffset" data-d="${i}" aria-label="${x.name}"></button>`).join('')}</div>
        <p class="diffhint">${d.hint}</p>
      </div>
      <div class="clsbtns"><button class="btn ghost" data-act="title">Назад</button><button class="btn big" data-act="clsgo">В путь</button></div>`;
  }
  // стартовая колода и собственные карты героя
  function showClassCards(id) {
    const h = CLASSES[id];
    const start = h.deck.map((k) => mk(k));
    showOverlay(`<h2>${h.name} · ${h.role}</h2>
      <p class="ovhint">Свои карты: выпадают в наградах и лавке только этому герою</p>
      <div class="grid">${heroCards(id).map((k) => cardHTML(k, 'mini')).join('')}</div>
      <p class="ovhint">Стартовая колода · ${start.length}</p>
      <div class="grid">${start.map((c) => cardHTML(c, 'mini')).join('')}</div>
      <button class="btn" data-act="close">Закрыть</button>`, (e) => { if (e.target.closest('[data-act="close"]')) hideOverlay(); });
  }

  /* ---------- Вступление перед новым забегом ---------- */
  function goIntro() {
    run = null; C = null; setBg();
    screen.className = 'scr-intro';
    screen.innerHTML = `
      <div class="book">
        <div class="page">
          <div class="book-art">${heroArt()}</div>
          <h1>${STORY.title}</h1>
          <p class="story">${txt(STORY.intro)}</p>
          <ul class="howto">
            <li><b>Огонёк.</b> Каждый даёт атакам +${FLAME_BONUS} урона. На ${FLAME_MAX} Огоньках лампа бьёт врага на ${BURST_DMG}.</li>
            <li><b>Меню</b> в углу: пауза, справочник и выход. Прогресс сохраняется сам.</li>
            <li>${STORY.pathRule(MAX_STEPS)}</li>
          </ul>
        </div>
      </div>
      <button class="btn big" data-act="start">В путь</button>`;
  }

  /* ---------- Путь: выбор из трёх карт-встреч ---------- */
  function genChoices() {
    const s = run.step;
    const si = stageOf(s);
    const g = STAGES[si];
    if (s === g.end) return [{ t: 'boss', enemy: run.bosses[si] }];
    const k = s - g.start; // номер уровня внутри стадии
    const normals = k < 8 && g.early.length ? g.early : g.normals;
    const eliteOk = si > 0 || k >= 6;
    const used = [];
    const fight = () => { const enemy = pickEnemy(normals, used); used.push(enemy); return { t: 'fight', enemy }; };
    const elite = () => { const enemy = pickEnemy(g.elites, used); used.push(enemy); return { t: 'elite', enemy }; };
    const done = (list) => { run.lastOffered = [...used]; used.forEach((id) => { run.offered[id] = (run.offered[id] || 0) + 1; }); return list; };
    if (s === 0) return done([fight(), fight(), { t: 'event', ev: pick(EVENTS).id }]);
    if (s === g.end - 1) return done([{ t: 'rest' }, { t: 'shop' }, eliteOk ? elite() : fight()]);
    const pool = [];
    const weights = [['fight', 40], ['event', 18], ['shop', 10], ['chest', 10], ['rest', 12], ['elite', eliteOk ? (si > 0 ? 16 : 10) : 0]];
    const total = weights.reduce((a, w) => a + w[1], 0);
    while (pool.length < 3) {
      let r = Math.random() * total; let t = 'fight';
      for (const [key, w] of weights) { if ((r -= w) < 0) { t = key; break; } }
      if (t !== 'fight' && t !== 'event' && pool.some((p) => p.t === t)) continue;
      if (t === 'fight') pool.push(fight());
      else if (t === 'elite') pool.push(elite());
      else if (t === 'event') { const ev = pick(EVENTS.filter((e) => !pool.some((p) => p.ev === e.id))).id; pool.push({ t: 'event', ev }); }
      else pool.push({ t });
    }
    if (!pool.some((p) => p.t === 'fight' || p.t === 'elite')) pool[rnd(0, 2)] = fight();
    return done(pool);
  }

  /* Выбор врага без надоедливых повторов: недавние бои, враги с прошлого шага и уже
     выложенные на этом шаге пропускаются, а остальные выпадают тем реже,
     чем чаще уже встречались в этом забеге */
  function pickEnemy(list, used) {
    const avoid = [...run.recent, ...run.lastOffered];
    let cands = list.filter((id) => !used.includes(id) && !avoid.includes(id));
    if (!cands.length) cands = list.filter((id) => !used.includes(id) && !run.recent.includes(id));
    if (!cands.length) cands = list.filter((id) => !used.includes(id));
    if (!cands.length) cands = list;
    const w = cands.map((id) => 1 / (1 + (run.seen[id] || 0) + 0.3 * (run.offered[id] || 0)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cands.length; i++) if ((r -= w[i]) < 0) return cands[i];
    return cands[cands.length - 1];
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
    SND.music(mapTrack());
    if (!run.choices) run.choices = genChoices();
    save();
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
    save(o);
    if (o.t === 'fight' || o.t === 'elite' || o.t === 'boss') startCombat(o.enemy, o.t);
    else if (o.t === 'event') goEvent(EVENTS.find((e) => e.id === o.ev));
    else if (o.t === 'shop') goShop();
    else if (o.t === 'chest') goChest();
    else if (o.t === 'rest') goRest();
  }

  function advance() {
    run.step++; STATS.best = Math.max(STATS.best, run.step + 1); saveStats();
    ach.add('steps'); ach.max('maxgold', run.gold); ach.max('maxhp', run.maxHp);
    SND.sfx('step'); goMap();
  }

  /* ---------- API для событий ---------- */
  const evApi = {
    heal: (n) => { run.hp = Math.min(run.maxHp, run.hp + n); },
    damage: (n) => { run.hp = Math.max(1, run.hp - n); },
    giveCard: (id) => run.deck.push(mk(id)),
    giveRandomCard: (rarity) => { const id = pickCard(rarity); run.deck.push(mk(id)); toast(`Новая карта: ${CARDS[id].name}`); return id; },
    giveRelic: () => {
      const free = freeRelics();
      if (!free.length) { run.gold += 40; toast('+40 монет'); return; }
      addRelic(pickRelic(free));
    },
    removeCardPrompt: () => removeCardFlow(() => advance()),
    upgradePrompt: () => upgradeFlow(() => advance()),
    upgradeRandom: (n) => upgradeRandom(n),
    duplicatePrompt: () => {
      showDeck(run.deck.filter((c) => CARDS[c.id].rarity !== 'status'), 'Выбери карту для копии', (uid) => {
        hideOverlay();
        const c = uid != null && run.deck.find((d) => d.uid === uid);
        if (c) { run.deck.push(mk(c.id, c.up)); SND.sfx('card'); toast(`Копия: ${cardName(c)}`); }
        advance();
      });
    },
    transformPrompt: () => {
      showDeck(run.deck, 'Какую карту отдать?', (uid) => {
        hideOverlay();
        if (uid != null) {
          const c = run.deck.find((d) => d.uid === uid);
          run.deck = run.deck.filter((d) => d.uid !== uid);
          const id = pickCard('rare');
          run.deck.push(mk(id));
          SND.sfx('relic');
          toast(`${cardName(c)} → ${CARDS[id].name}`);
        }
        advance();
      });
    },
    startFight: null,
  };

  // обычные и редкие талисманы, которых ещё нет
  const RELIC_WEIGHT = { common: 55, uncommon: 30, rare: 15 };
  const freeRelics = () => Object.keys(RELICS).filter((r) => RELIC_WEIGHT[RELICS[r].tier] && !hasRelic(r));
  // случайный талисман: обычные выпадают чаще необычных, необычные чаще редких
  function pickRelic(list = freeRelics()) {
    if (!list.length) return null;
    const w = list.map((r) => RELIC_WEIGHT[RELICS[r].tier]);
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((x -= w[i]) < 0) return list[i];
    return list[list.length - 1];
  }

  function addRelic(id) {
    run.relics.push(id);
    ach.put('relics', id);
    if (RELICS[id].tier === 'boss') ach.put('trophies', id);
    if (id === 'jar') { run.maxHp += 8; run.hp += 8; }
    if (id === 'moonstone') { run.maxHp -= 8; run.hp = Math.min(run.hp, run.maxHp); }
    if (id === 'whetstone') upgradeRandom(2, true);
    if (id === 'goldquill') { const list = run.deck.filter(canUpgrade); list.forEach((c) => { c.up = true; }); achUpgraded(list.length); }
    SND.sfx('relic');
    toast(`Талисман: ${RELICS[id].name}`);
  }

  // счётчик улучшений и число улучшенных карт в колоде — для достижений
  function achUpgraded(n) { ach.add('upgrades', n); ach.max('updeck', run.deck.filter((c) => c.up).length); }

  function upgradeRandom(n, quiet) {
    const list = shuffle(run.deck.filter(canUpgrade)).slice(0, n);
    list.forEach((c) => { c.up = true; });
    achUpgraded(list.length);
    if (list.length && !quiet) toast(`Улучшены: ${list.map(cardName).join(', ')}`);
    return list.length;
  }

  function upgradeFlow(done) {
    const list = run.deck.filter(canUpgrade);
    if (!list.length) { toast('Все карты уже улучшены'); done(false); return; }
    showDeck(list, 'Выбери карту для улучшения', (uid) => {
      hideOverlay();
      const c = uid != null && run.deck.find((d) => d.uid === uid);
      if (c) { c.up = true; achUpgraded(1); SND.sfx('relic'); toast(`Улучшена: ${cardName(c)}`); }
      done(!!c);
    }, 'up');
  }

  function removeCardFlow(done) {
    showDeck(run.deck, 'Выбери карту, которую убрать', (uid) => {
      hideOverlay();
      if (uid != null) { const c = run.deck.find((d) => d.uid === uid); run.deck = run.deck.filter((d) => d.uid !== uid); toast(`Убрана: ${cardName(c)}`); }
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
    ach.put('events', ev.id);
  }

  function eventOption(i) {
    const ev = EVENTS.find((e) => e.id === screen.dataset.ev);
    let fought = false;
    evApi.startFight = (id) => { fought = id; };
    const gold0 = run.gold;
    const res = ev.options[i].act(run, evApi);
    ach.add('spent', gold0 - run.gold);
    if (res === null) return; // опция сама ведёт дальше (например, удаление карты)
    if (fought) { save({ t: 'fight', enemy: fought }); toast(res); setTimeout(() => startCombat(fought, 'fight'), 600); return; }
    save({ t: 'next' });
    $('.scrolls').innerHTML = `<button class="scroll" data-act="next">Дальше</button>`;
    $('.ev-box p').textContent = res;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Лавка ---------- */
  function goShop(saved) {
    const disc = (n) => Math.round(n * (hasRelic('coupon') ? 0.75 : 1));
    // на прилавке по карте каждой редкости
    const base = { common: 38, uncommon: 54, rare: 72 };
    const cards = ['common', 'uncommon', 'rare'].map((r) => pickCard(r)).map((id) => ({ id, price: disc(base[CARDS[id].rarity] + rnd(-4, 6)), sold: false }));
    const rid = pickRelic();
    const shop = saved || { cards, relic: rid ? { id: rid, price: disc({ common: 90, uncommon: 108, rare: 125 }[RELICS[rid].tier]), sold: false } : null, tea: { price: disc(22), sold: false }, remove: { price: disc(50), sold: false }, up: { price: disc(55), sold: false } };
    screen.className = 'scr-shop';
    const render = () => {
      save({ t: 'shop', shop });
      screen.innerHTML = `${topBar()}
        <div class="shopkeeper">${Art.enemy('hedgehog')}<div class="bubble">Всё по-честному! Почти.</div></div>
        <div class="shop-cards">${shop.cards.map((c, i) => `<div class="ware ${c.sold ? 'sold' : ''}">${cardHTML(c.id, 'shopcard', `data-act="buy" data-i="${i}"`)}<div class="price ${run.gold < c.price ? 'poor' : ''}">${Art.icon('coin')}${c.price}</div></div>`).join('')}</div>
        <div class="shop-services">
          ${shop.relic ? `<button class="svc ${shop.relic.sold ? 'sold' : ''}" data-act="buyrelic">${Art.icon(RELICS[shop.relic.id].art)}<span><b>${RELICS[shop.relic.id].name}<em class="rtier ${RELICS[shop.relic.id].tier}">${TIER_LABEL[RELICS[shop.relic.id].tier]}</em></b><small>${RELICS[shop.relic.id].desc}</small></span><i class="${run.gold < shop.relic.price ? 'poor' : ''}">${shop.relic.price}</i></button>` : ''}
          <button class="svc ${shop.tea.sold ? 'sold' : ''}" data-act="buytea">${Art.icon('tea')}<span><b>Горячий сбитень</b><small>Восстановить 12 HP</small></span><i class="${run.gold < shop.tea.price ? 'poor' : ''}">${shop.tea.price}</i></button>
          <button class="svc ${shop.up.sold ? 'sold' : ''}" data-act="buyup">${Art.icon('whetstone')}<span><b>Заточка</b><small>Улучшить карту</small></span><i class="${run.gold < shop.up.price ? 'poor' : ''}">${shop.up.price}</i></button>
          <button class="svc ${shop.remove.sold ? 'sold' : ''}" data-act="buyremove">${Art.icon('scissors')}<span><b>Распустить карту</b><small>Убрать карту из колоды</small></span><i class="${run.gold < shop.remove.price ? 'poor' : ''}">${shop.remove.price}</i></button>
        </div>
        <button class="btn leave" data-act="next">Уйти</button>
        ${heroBar(false)}`;
    };
    const pay = (item) => {
      if (item.sold) return false;
      if (run.gold < item.price) { SND.sfx('deny'); toast('Не хватает монет'); return false; }
      run.gold -= item.price; item.sold = true; ach.add('spent', item.price); SND.sfx('coin'); return true;
    };
    screen.onShop = (act, i) => {
      if (act === 'buy' && pay(shop.cards[i])) { ach.add('bought'); run.deck.push(mk(shop.cards[i].id)); toast(`Куплено: ${CARDS[shop.cards[i].id].name}`); }
      if (act === 'buyrelic' && shop.relic && pay(shop.relic)) addRelic(shop.relic.id);
      if (act === 'buytea' && pay(shop.tea)) { evApi.heal(12); SND.sfx('heal'); }
      if (act === 'buyup' && !shop.up.sold) {
        if (run.gold < shop.up.price) { SND.sfx('deny'); toast('Не хватает монет'); return; }
        upgradeFlow((ok) => { if (ok) { run.gold -= shop.up.price; shop.up.sold = true; ach.add('spent', shop.up.price); } render(); });
        return;
      }
      if (act === 'buyremove' && !shop.remove.sold) {
        if (run.gold < shop.remove.price) { SND.sfx('deny'); toast('Не хватает монет'); return; }
        removeCardFlow((ok) => { if (ok) { run.gold -= shop.remove.price; shop.remove.sold = true; ach.add('spent', shop.remove.price); } render(); });
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
    ach.add('chests');
    const free = freeRelics();
    let msg;
    if (free.length && Math.random() < 0.5) { const id = pickRelic(free); addRelic(id); msg = `Внутри: ${RELICS[id].name}. ${RELICS[id].desc}`; }
    else { const g = rnd(28, 45); run.gold += g; SND.sfx('coin'); msg = `Внутри ${g} монет.`; }
    save({ t: 'next' });
    $('.chest').classList.add('open');
    $('.chest-wrap p').textContent = msg;
    $('.row2').innerHTML = `<button class="btn" data-act="next">Дальше</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Привал ---------- */
  const restHeal = () => Math.round(run.maxHp * DIFF().rest) + (hasRelic('kettle') ? 10 : 0);
  function goRest() {
    const noHeal = hasRelic('bottomless');
    screen.className = 'scr-rest';
    screen.innerHTML = `${topBar()}
      <div class="fire-wrap">${Art.icon('fire')}<p>Костёр потрескивает. Снег вокруг тает.</p></div>
      <div class="scrolls">
        <button class="scroll ${noHeal ? 'off' : ''}" data-act="rest-heal" ${noHeal ? 'disabled' : ''}>Отдохнуть<small>${noHeal ? 'Бездонная сумка не даёт присесть' : `+${restHeal()} HP${hasRelic('cocoatin') ? ', +2 макс.' : ''}`}</small></button>
        <button class="scroll" data-act="rest-up">Наточить карту<small>Улучшить карту</small></button>
        <button class="scroll" data-act="rest-burn">Сжечь карту<small>Убрать карту из колоды</small></button>
      </div>
      ${heroBar(false)}`;
  }

  /* ================= БОЙ ================= */
  const apiStatic = { state: null, played: 0, blockNow: 0, dmgText: (n) => `${n}` };
  const api = {
    get state() { return C; },
    get played() { return C ? C.playedTurn : 0; },
    get blockNow() { return C ? C.block : 0; },
    get enemyDead() { return C.enemy.hp <= 0; },
    // название предыдущей карты хода для Копирки
    get lastCard() { return C && C.last && C.last.id !== 'carbon' ? cardName(C.last) : null; },
    dmgText(base) {
      const v = calcDmg(base);
      return v > base ? `<b class="up">${v}</b>` : v < base ? `<b class="down">${v}</b>` : `${v}`;
    },
    async attack(base, hits = 1) {
      for (let h = 0; h < hits; h++) {
        if (C.enemy.hp <= 0 || run.hp <= 0) break;
        heroLunge();
        await hitEnemy(calcDmg(base));
        // метла трубочиста: каждый удар подкидывает искру
        if (hasRelic('sootbroom') && C.enemy.hp > 0) { C.enemy.burn += 1; floatText($('.enemy-fx'), 'Поджог +1', 'burnf'); }
        // колючий враг ранит в ответ на каждый удар
        if (C.enemy.thorns > 0 && C.enemy.hp > 0) await hitHero(C.enemy.thorns);
        if (hits > 1) await sleep(140);
      }
    },
    block(n) {
      if (C.frail > 0) n = Math.floor(n * 0.75);
      C.block += n; SND.sfx('block'); floatText($('.hero-fx'), `+${n}`, 'blockf');
    },
    async flame(n) {
      C.flame += n;
      SND.sfx('flame');
      renderCombat();
      while (C.flame >= flameMax() && C.enemy.hp > 0) {
        C.flame -= flameMax();
        await burst();
      }
    },
    draw(n) { drawCards(n); },
    heal(n) { SND.sfx('heal'); const before = run.hp; run.hp = Math.min(run.maxHp, run.hp + n); floatText($('.hero-fx'), `+${run.hp - before}`, 'healf'); },
    burn(n) { const v = n + (hasRelic('matchbox') ? 2 : 0); SND.sfx('flame'); C.enemy.burn += v; floatText($('.enemy-fx'), `Поджог ${v}`, 'burnf'); },
    weak(n) { SND.sfx('debuff'); C.enemy.weak += n; floatText($('.enemy-fx'), 'Ослаблен', 'weakf'); },
    vuln(n) { SND.sfx('debuff'); C.enemy.vuln += n + (hasRelic('stamppad') ? 1 : 0); floatText($('.enemy-fx'), 'Уязвим', 'weakf'); },
    chill(n) { SND.sfx('debuff'); C.enemy.str -= n; floatText($('.enemy-fx'), `Сила −${n}`, 'blockf'); },
    stun() { SND.sfx('debuff'); C.enemy.stun = 1; floatText($('.enemy-fx'), 'Засыпает…', 'weakf'); if (C.tier === 'boss') ach.flag('stunboss'); },
    energy(n) { C.energy += n; floatText($('.hero-fx'), `+${n} энергии`, 'blockf'); },
    resolve(n) { C.str += n; SND.sfx('buff'); floatText($('.hero-fx'), `Решимость +${n}`, 'burnf'); },
    rush(n) { C.tmpStr += n; SND.sfx('buff'); floatText($('.hero-fx'), `Решимость +${n}`, 'burnf'); },
    thorns(n) { C.thorns += n; SND.sfx('block'); floatText($('.hero-fx'), `Шипы +${n}`, 'blockf'); },
    gold(n) { run.gold += n; SND.sfx('coin'); floatText($('.hero-fx'), `+${n} монет`, 'burnf'); },
    maxHp(n) { run.maxHp += n; run.hp += n; SND.sfx('heal'); floatText($('.hero-fx'), `+${n} к макс. HP`, 'healf'); },
    doubleBlock() { if (C.block > 0) api.block(C.block); },
    async burstNow() { await burst(); },
    consumeFlame() { const n = C.flame; C.flame = 0; return n; },
    deliver(name, fn) { C.deliveries.push({ name, fn }); SND.sfx('card'); floatText($('.hero-fx'), `${name} в пути`, 'weakf'); },
    charm(id, n) {
      C.charms[id] = (C.charms[id] || 0) + n; SND.sfx('relic'); floatText($('.hero-fx'), CARDS[id].name, 'weakf');
      if (Object.keys(C.charms).length >= 3) ach.flag('charms3');
    },
    // Копирка: повторить предыдущую карту хода
    async copyLast() {
      const l = C.last;
      if (!l || l.id === 'carbon') { floatText($('.hero-fx'), 'Нечего копировать', 'weakf'); return; }
      floatText($('.hero-fx'), `Копия: ${CARDS[l.id].name}`, 'weakf');
      await CARDS[l.id].play(api, l.up, l);
    },
    // Обратный адрес: вернуть в руку последние карты из сброса (кроме помех)
    recall(n) {
      let got = 0;
      for (let i = C.disc.length - 1; i >= 0 && got < n && C.hand.length < HAND_MAX; i--) {
        if (CARDS[C.disc[i].id].type === 'status') continue;
        C.hand.push(C.disc.splice(i, 1)[0]); got++;
      }
      SND.sfx('draw'); floatText($('.hero-fx'), got ? `Вернулось карт: ${got}` : 'Сброс пуст', 'weakf');
    },
    // До востребования: бесплатно разыграть верхние карты колоды, помехи сгорают
    async autoplay(n) {
      for (let k = 0; k < n; k++) {
        if (C.enemy.hp <= 0 || run.hp <= 0) break;
        if (!C.draw.length) { if (!C.disc.length) break; C.draw = shuffle(C.disc); C.disc = []; }
        const c = C.draw.pop();
        const cd = CARDS[c.id];
        toast(`Из колоды: ${cardName(c)}`);
        if (cd.type === 'status') { exhaustCard(c); continue; }
        await cd.play(api, c.up, c);
        if (cd.type === 'charm') C.exh.push(c);
        else if (cd.exhaust) exhaustCard(c);
        else C.disc.push(c);
        renderCombat();
        await sleep(250);
      }
    },
    // сжечь карты из руки по условию, вернуть их количество
    exhaustHand(pred) {
      const out = C.hand.filter((c) => pred(CARDS[c.id]));
      C.hand = C.hand.filter((c) => !out.includes(c));
      out.forEach(exhaustCard);
      return out.length;
    },
  };

  function calcDmg(base) {
    if (!C) return base;
    let v = base + flameBonus() * C.flame + C.str + C.tmpStr + (hasRelic('pencil') && !C.atkTurn ? 3 : 0);
    if (C.pWeak > 0) v = Math.floor(v * 0.75);
    if (C.enemy.vuln > 0) v = Math.floor(v * 1.5);
    return Math.max(0, v);
  }
  function enemyDmg(v) {
    let d = Math.round((v + C.enemy.str + C.enemy.boil) * DIFF().dmg);
    if (C.enemy.weak > 0) d = Math.floor(d * 0.75);
    return Math.max(0, d);
  }

  function exhaustCard(c) {
    C.exh.push(c);
    if (hasRelic('brazier')) { C.block += 3; floatText($('.hero-fx'), '+3', 'blockf'); }
  }

  function startCombat(enemyId, tier) {
    const e = ENEMIES[enemyId];
    run.seen[enemyId] = (run.seen[enemyId] || 0) + 1;
    run.recent = [...run.recent, enemyId].slice(-4);
    const scale = tier === 'boss' ? 1 : 1 + run.step * (MAX_STEPS > 20 ? 0.035 : 0.08);
    const hp = Math.round(e.hp * scale * DIFF().hp);
    const str = (tier === 'boss' ? 0 : Math.floor(run.step / (MAX_STEPS > 20 ? 8 : 3))) - (hasRelic('frostglass') ? 2 : 0);
    C = {
      tier, id: enemyId,
      enemy: { hp, max: hp, block: 0, str, weak: hasRelic('inkwell') ? 2 : 0, vuln: 0, burn: 0, thorns: e.thorns || 0, stun: 0, pi: 0, nest: e.nest || 0, layer: 0, boil: 0, mist: 0 },
      draw: shuffle(run.deck.map((c) => ({ ...c }))), hand: [], disc: [], exh: [],
      energy: maxEnergy(), block: 0, flame: (hasRelic('feather') ? 1 : 0) + (hasRelic('eternaloil') ? 1 : 0), pWeak: 0, turn: 0,
      str: 0, tmpStr: 0, thorns: hasRelic('pinecone') ? 3 : 0,
      charms: {}, deliveries: [], playedTurn: 0, playedTotal: 0,
      firstAtk: false, shoe: false, hpLost: false, stolen: 0, burstsTurn: 0,
      last: null, atkTurn: false, frail: 0, sap: 0, bury: 0, vane: false, medal: false, boomed: false,
    };
    // Закладка: одна случайная карта улучшена до конца боя
    if (hasRelic('bookmark')) { const list = C.draw.filter(canUpgrade); if (list.length) pick(list).up = true; }
    selected = -1;
    SND.music(tier === 'boss' ? 'boss' : 'battle');
    screen.className = 'scr-combat';
    screen.innerHTML = `
      <div class="topbar slim">${relicIcons(6)}<div class="spacer"></div><div class="stepl">${tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс стадии') : `Уровень ${run.step + 1}/${MAX_STEPS}`}</div></div>
      <div class="enemy-zone">
        <div class="intent"></div>
        <div class="enemy ${e.tier}" id="enemy">${Art.enemy(enemyId)}<div class="enemy-fx"></div></div>
        <div class="nameplate"><div class="ename">${e.name}${e.tier !== 'normal' ? `<i>${e.tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс') : 'Элита'}</i>` : ''}</div>
          <div class="ehp"><div class="fill"></div><span></span><div class="eblk"></div></div>
          <div class="estatus"></div>
        </div>
      </div>
      <div class="hstatus"></div>
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
      if (C.hand.length >= HAND_MAX) break;
      C.hand.push(C.draw.pop());
    }
  }

  async function startPlayerTurn() {
    busy = true;
    C.turn++;
    C.playedTurn = 0; C.burstsTurn = 0; C.last = null; C.atkTurn = false;
    // защита сгорает, но Горячий камень сохраняет её часть
    if (!C.charms.standfast) C.block = hasRelic('hotstone') ? Math.min(C.block, 6) : 0;
    if (C.turn === 1 && hasRelic('bell')) C.block += 6;
    if (hasRelic('thimble')) C.block += 2;
    if (C.charms.mittens) C.block += C.charms.mittens;
    const first = C.turn === 1;
    C.energy = maxEnergy() + (first && hasRelic('scarf') ? 1 : 0) + (C.turn % 3 === 0 && hasRelic('musicbox') ? 2 : 0)
      + (first && hasRelic('northstar') ? 2 : 0) + (C.charms.aurora || 0) + (C.vane ? 1 : 0) + (C.medal ? 1 : 0);
    if (C.sap) { C.energy = Math.max(0, C.energy - C.sap); toast(`Кукушка сбила с ритма: −${C.sap} энергии`); }
    C.sap = 0; C.vane = false; C.medal = false;
    let n = handSize() + (C.charms.compass || 0) + (first && hasRelic('sled') ? 2 : 0) + (first && hasRelic('northstar') ? 2 : 0);
    if (C.bury) { n = Math.max(1, n - C.bury); toast(`Метелица замела: −${C.bury} карты`); C.bury = 0; }
    drawCards(n);
    if (first && hasRelic('mug')) { run.hp = Math.min(run.maxHp, run.hp + 3); }
    SND.sfx(C.turn === 1 ? 'draw' : 'turn');
    renderCombat(true);
    // Доставки с прошлого хода и чары
    const dels = C.deliveries; C.deliveries = [];
    for (const d of dels) {
      for (let k = 0; k < (hasRelic('horn') ? 2 : 1); k++) {
        if (C.enemy.hp <= 0) break;
        toast(`Доставка: ${d.name}`);
        await sleep(250);
        await d.fn(api);
        renderCombat();
      }
      if (hasRelic('oilcan') && C.enemy.hp > 0) api.block(4);
    }
    if (C.charms.stubborn) C.str += C.charms.stubborn;
    if (C.charms.hearth && C.enemy.hp > 0) api.burn(C.charms.hearth);
    if (C.charms.eveninglamp && C.enemy.hp > 0) await api.flame(C.charms.eveninglamp);
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
    if (C.enemy.hp <= 0) { await winCombat(); return; }
    busy = false;
    renderCombat();
  }

  function currentIntents() {
    if (C.enemy.stun > 0) return [{ k: 'sleep' }];
    const p = ENEMIES[C.id].pattern[C.enemy.pi % ENEMIES[C.id].pattern.length];
    return p.then ? [p, p.then] : [p];
  }

  function intentHTML(it) {
    const tip = (t) => `data-tip="${t}"`;
    if (it.k === 'attack') return `<div class="it atk" ${tip(`Атака: ${enemyDmg(it.v)} урона${it.hits ? ` ${it.hits} раза` : ''}${it.leech ? '. Враг вылечится на весь урон, который пройдёт сквозь защиту' : ''}`)}>${Art.intentIcon(it.leech ? 'leech' : 'attack')}<b>${enemyDmg(it.v)}${it.hits ? `×${it.hits}` : ''}</b></div>`;
    if (it.k === 'sap') return `<div class="it deb" ${tip(`Собьёт с ритма: в ваш следующий ход −${it.v} энергии`)}>${Art.intentIcon('sap')}<b>−${it.v}</b></div>`;
    if (it.k === 'mist') return `<div class="it blk" ${tip(`Напустит туман: до её следующего хода любой удар по ней наносит не больше ${it.v} урона. Поджог проходит`)}>${Art.intentIcon('mist')}<b>≤${it.v}</b></div>`;
    if (it.k === 'boom') return `<div class="it atk boom" ${tip(`Взорвётся: ${enemyDmg(it.v)} урона, и после этого исчезнет`)}>${Art.intentIcon('boom')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'bury') return `<div class="it deb" ${tip(`Заметёт руку: в следующий ход на ${it.v} карты меньше`)}>${Art.intentIcon('bury')}<b>−${it.v}</b></div>`;
    if (it.k === 'frail') return `<div class="it deb" ${tip(`Хрупкость на ${it.v} хода: ваша защита слабее на 25%`)}>${Art.intentIcon('frail')}<b>${it.v}</b></div>`;
    if (it.k === 'block') return `<div class="it blk" ${tip(`Защита ${it.v}`)}>${Art.intentIcon('block')}<b>${it.v}</b></div>`;
    if (it.k === 'buff') return `<div class="it buf" ${tip(`Враг станет сильнее: Сила +${it.v}`)}>${Art.intentIcon('buff')}<b>+${it.v}</b></div>`;
    if (it.k === 'debuff') return `<div class="it deb" ${tip(`Слабость на ${it.v} хода: ваши атаки слабее на 25%`)}>${Art.intentIcon('debuff')}</div>`;
    if (it.k === 'snuff') return `<div class="it snf" ${tip(`Погасит все Огоньки и ударит на ${enemyDmg(it.v)}`)}>${Art.intentIcon('snuff')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'curse') return `<div class="it cur" ${tip(`Подкинет в колоду: ${CARDS[it.card].name} ×${it.n}`)}>${Art.intentIcon('curse')}<b>×${it.n}</b></div>`;
    if (it.k === 'steal') return `<div class="it atk" ${tip(`Ударит на ${enemyDmg(it.v)} и украдёт до ${it.gold} монет`)}>${Art.intentIcon('steal')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'heal') return `<div class="it hea" ${tip(`Восстановит ${it.v} HP`)}>${Art.intentIcon('heal')}<b>+${it.v}</b></div>`;
    if (it.k === 'spikes') return `<div class="it blk" ${tip(`Отрастит Шипы ${it.v}: каждый ваш удар по нему будет ранить вас`)}>${Art.intentIcon('spikes')}<b>+${it.v}</b></div>`;
    if (it.k === 'sleep') return `<div class="it slp" ${tip('Враг спит и пропустит ход')}>${Art.intentIcon('sleep')}<b>Спит</b></div>`;
    return '';
  }

  function chip(cls, text, tipText, ico = '') {
    return `<i class="${cls}" data-tip="${tipText}">${ico}${text}</i>`;
  }

  function renderCombat(dealAnim = false) {
    if (!C) return;
    const e = C.enemy;
    $('.intent').innerHTML = e.hp > 0 ? currentIntents().map(intentHTML).join('') : '';
    $('.ehp .fill').style.width = `${(Math.max(0, e.hp) / e.max) * 100}%`;
    $('.ehp span').textContent = `${Math.max(0, e.hp)}/${e.max}`;
    $('.eblk').innerHTML = e.block > 0 ? `${Art.intentIcon('block')}<b>${e.block}</b>` : '';
    const g = (name) => GLOSS.find((x) => x[0] === name)[1];
    const st = [];
    if (e.str) st.push(chip('s-str', `Сила ${e.str}`, g('Сила врага')));
    if (e.weak) st.push(chip('s-weak', `Ослаблен ${e.weak}`, g('Ослаблен')));
    if (e.vuln) st.push(chip('s-vuln', `Уязвим ${e.vuln}`, g('Уязвим')));
    if (e.burn) st.push(chip('s-burn', `Поджог ${e.burn}`, g('Поджог')));
    if (e.thorns) st.push(chip('s-thorns', `Колючки ${e.thorns}`, `Каждый ваш удар по врагу ранит вас на ${e.thorns}`));
    // особые приёмы врага
    const ed = ENEMIES[C.id];
    if (e.nest) st.push(chip('s-trait', `Матрёшка ×${e.nest}`, `Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: ${e.nest}.`));
    if (ed.boil) st.push(chip(e.boil ? 's-burn' : 's-trait', `Кипит +${e.boil}`, 'Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После его хода кипяток остывает. Поджог его не злит.'));
    if (ed.tally) st.push(chip('s-trait', `Ку-ку ${C.playedTurn % ed.tally}/${ed.tally}`, `Каждая ${ed.tally}-я карта за ход: кукушка кукует и бьёт вас на 3.`));
    if (ed.plating) st.push(chip('s-trait', 'Латы', 'Защита Ледяного Рыцаря не сгорает: она копится от хода к ходу. Поджог бьёт прямо по HP.'));
    if (ed.alarm) st.push(chip('s-trait', `Колотушка +${ed.alarm}`, `Каждый ваш Навык даёт сторожу ${ed.alarm} защиты до конца вашего хода. Бейте до хитростей.`));
    if (e.mist) st.push(chip('s-weak', `Туман ≤${e.mist}`, `Пока туман, любой удар по ней наносит не больше ${e.mist} урона. Поджог проходит. Туман рассеется, когда она снова сходит.`));
    const bi = ed.pattern.findIndex((p) => p.k === 'boom');
    if (bi >= 0) { const L = ed.pattern.length; const left = ((bi - (e.pi % L)) + L) % L + 1; st.push(chip('s-burn', `Фитиль ${left}`, `Через ${left} ${left === 1 ? 'ход' : 'хода'} шутиха взорвётся: сильно ударит и исчезнет. Победите её раньше, если успеете.`)); }
    if (e.stun) st.push(chip('s-weak', 'Спит', g('Спит')));
    if (C.stolen) st.push(chip('s-gold', `Украдено ${C.stolen}`, g('Кража')));
    $('.estatus').innerHTML = st.join('');
    // статусы Ивы и активные чары
    const hs = [];
    const res = C.str + C.tmpStr;
    if (res) hs.push(chip('h-res', `Решимость ${res}`, `${g('Решимость')}${C.tmpStr ? ` До конца хода: ${C.tmpStr}.` : ''}`));
    if (C.thorns) hs.push(chip('h-thorns', `Шипы ${C.thorns}`, g('Шипы')));
    if (C.pWeak) hs.push(chip('h-weak', `Слабость ${C.pWeak}`, 'Слабость: ваши атаки наносят на 25% меньше урона.'));
    if (C.frail) hs.push(chip('h-weak', `Хрупкость ${C.frail}`, g('Хрупкость')));
    if (C.deliveries.length) hs.push(chip('h-del', `Доставка ${C.deliveries.length}`, `${g('Доставка')} В пути: ${C.deliveries.map((d) => d.name).join(', ')}.`));
    for (const [id, n] of Object.entries(C.charms)) hs.push(chip('h-charm', `${n}`, CHARM_TIP[id](n), Art.icon(CARDS[id].art)));
    $('.hstatus').innerHTML = hs.join('');
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
      const rot = (i - (n - 1) / 2) * 3.5;
      const lift = Math.abs(i - (n - 1) / 2) * 5;
      const cost = costOf(c);
      const can = cost != null && cost <= C.energy;
      let left = x0 + i * step;
      if (i === selected) left = Math.max(26, Math.min(400 - W - 26, left));
      return cardHTML(c, `inhand ${can ? '' : 'nope'} ${i === selected ? 'sel' : ''} ${dealAnim ? 'deal' : ''}`,
        `data-hi="${i}" style="left:${left}px; --rot:${rot}deg; --lift:${lift}px; --d:${i * 60}ms; z-index:${i === selected ? 50 : i + 1}"`);
    }).join('');
  }

  async function playCard(i) {
    const c = C.hand[i];
    const cd = CARDS[c.id];
    const cost = costOf(c);
    if (cost == null) { SND.sfx('deny'); toast('Эту карту нельзя разыграть'); return; }
    if (cost > C.energy) { SND.sfx('deny'); toast('Не хватает энергии'); return; }
    busy = true; selected = -1;
    const el = $(`.hand [data-hi="${i}"]`);
    SND.sfx('card');
    if (el) { el.classList.add('fly'); await sleep(220); }
    C.energy -= cost;
    C.hand.splice(i, 1);
    renderCombat();
    if (cd.type === 'atk' && !C.firstAtk) {
      C.firstAtk = true;
      if (hasRelic('magnifier')) api.vuln(2);
    }
    await cd.play(api, c.up, c);
    // Осколок зеркала: первая карта хода срабатывает ещё раз
    if (hasRelic('mirrorshard') && C.playedTurn === 0 && cd.type !== 'status' && C.enemy.hp > 0 && run.hp > 0) {
      floatText($('.hero-fx'), 'Отражение!', 'weakf'); await sleep(200);
      await cd.play(api, c.up, c);
    }
    if (cd.type === 'atk') C.atkTurn = true;
    if (cd.type !== 'status') C.last = c;
    if (cd.type === 'charm') C.exh.push(c);
    else if (cd.exhaust) exhaustCard(c);
    else C.disc.push(c);
    C.playedTurn++; C.playedTotal++; STATS.cards++;
    if (cd.rarity !== 'status') ach.put('played', c.id);
    if (cd.rarity === 'rare') ach.put('rareplayed', c.id);
    if (C.playedTurn >= 8) ach.flag('combo');
    achCheck();
    // отклики чар и талисманов на розыгрыш
    if (cd.type === 'skill' && C.charms.inkpen && C.enemy.hp > 0) await hitEnemy(C.charms.inkpen);
    if (C.charms.rhythm && C.playedTurn % 3 === 0 && C.enemy.hp > 0) await api.flame(C.charms.rhythm);
    if (hasRelic('stampbook') && C.playedTotal % 6 === 0) api.energy(1);
    if (hasRelic('wingboots') && C.playedTurn % 4 === 0) { api.energy(1); drawCards(1); }
    // приёмы врага в ответ на ваши карты
    const ed = ENEMIES[C.id];
    if (ed.alarm && cd.type === 'skill' && C.enemy.hp > 0) { C.enemy.block += ed.alarm; SND.sfx('clank'); floatText($('.enemy-fx'), `Тук-тук! +${ed.alarm}`, 'blockf'); }
    if (ed.tally && C.playedTurn % ed.tally === 0 && C.enemy.hp > 0 && run.hp > 0) { floatText($('.enemy-fx'), 'Ку-ку!', 'weakf'); await hitHero(3); }
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
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
    if (e.mist > 0 && dmg > e.mist) dmg = e.mist; // туман глушит сильные удары
    const absorbed = Math.min(e.block, dmg);
    e.block -= absorbed;
    const real = dmg - absorbed;
    e.hp -= real;
    ach.max('maxhit', dmg);
    if (real > 0 && ENEMIES[C.id].boil && e.hp > 0 && e.boil < 5) e.boil++;
    nestCheck();
    const el = $('#enemy');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    SND.sfx(real > 0 ? 'hit' : 'clank', Math.min(1.4, 0.6 + real / 15));
    floatText($('.enemy-fx'), real > 0 ? `-${real}` : 'Блок', real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(260);
  }

  // Матрёшка: вместо гибели раскрывается, внутри новая, поменьше
  function nestCheck() {
    const e = C.enemy;
    if (e.hp > 0 || e.nest <= 0) return false;
    e.nest--; e.layer++;
    e.max = Math.max(5, Math.round(e.max * 0.6)); e.hp = e.max; e.block = 0;
    const el = $('#enemy');
    if (el) el.style.setProperty('--nest', `${1 - 0.15 * e.layer}`);
    SND.sfx('clank');
    floatText($('.enemy-fx'), 'Внутри ещё одна!', 'weakf');
    return true;
  }

  async function burst() {
    const fx = document.createElement('div');
    fx.className = 'burst'; fx.innerHTML = `${Art.flame(1.4)}<span>Вспышка!</span>`;
    $('.enemy-zone').appendChild(fx);
    SND.sfx('burst');
    await sleep(380);
    ach.add('bursts');
    if (++C.burstsTurn >= 2) ach.flag('dblburst');
    let dmg = BURST_DMG + (hasRelic('flint') ? 5 : 0);
    if (C.enemy.vuln > 0) dmg = Math.floor(dmg * 1.5);
    await hitEnemy(dmg);
    if (hasRelic('stub')) api.heal(2);
    if (hasRelic('snowglobe') && C.enemy.hp > 0) api.weak(1);
    if (hasRelic('ivalamp')) C.flame += 1;
    setTimeout(() => fx.remove(), 500);
    renderCombat();
  }

  async function hitHero(dmg) {
    const absorbed = Math.min(C.block, dmg);
    C.block -= absorbed;
    let real = dmg - absorbed;
    // Подкова смягчает первый пропущенный удар в бою
    if (real > 1 && hasRelic('horseshoe') && !C.shoe) { C.shoe = true; real = 1; floatText($('.hero-fx'), 'Подкова!', 'blockf'); }
    loseHp(real);
    const p = $('#heroPortrait');
    if (p) { p.classList.remove('hurt'); void p.offsetWidth; p.classList.add('hurt'); }
    SND.sfx(real > 0 ? 'hurt' : 'clank');
    floatText($('.hero-fx'), real > 0 ? `-${real}` : 'Блок', real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(300);
    // окованный ставень: удар целиком в защиту — враг получает в ответ
    if (hasRelic('ironshutter') && dmg > 0 && real === 0 && absorbed > 0 && C.enemy.hp > 0) await hitEnemy(4);
    return real;
  }

  function loseHp(n) {
    if (n <= 0) return;
    run.hp = Math.max(0, run.hp - n);
    C.hpLost = true;
    app.classList.remove('redflash'); void app.offsetWidth; app.classList.add('redflash');
  }

  async function endTurn() {
    busy = true; selected = -1;
    // конец хода: Удержание, тающие Ледышки, Недоставленные письма
    const keep = [];
    let ribbon = null;
    if (hasRelic('ribbon')) {
      const cands = C.hand.filter((c) => !CARDS[c.id].retain && CARDS[c.id].type !== 'status');
      if (cands.length) ribbon = cands.reduce((a, b) => ((costOf(b) || 0) > (costOf(a) || 0) ? b : a));
    }
    let dread = 0;
    C.vane = hasRelic('vanefeather') && C.hand.length === 0;
    C.medal = hasRelic('medal') && C.playedTurn >= 6;
    if (C.charms.nightshift && C.energy > 0) api.block(C.charms.nightshift * C.energy);
    for (const c of C.hand) {
      const cd = CARDS[c.id];
      if (c.id === 'dread') dread += 2;
      if (cd.ethereal) exhaustCard(c);
      else if (cd.retain || c === ribbon) { keep.push(c); if (cd.onRetain) cd.onRetain(c, c.up); }
      else C.disc.push(c);
    }
    C.hand = keep;
    C.tmpStr = 0;
    if (C.pWeak > 0) C.pWeak--;
    if (C.frail > 0) C.frail--;
    if (dread) { loseHp(dread); SND.sfx('hurt'); floatText($('.hero-fx'), `-${dread}`, 'dmgf'); }
    renderCombat();
    await sleep(250);
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
    const e = C.enemy;
    if (!ENEMIES[C.id].plating) e.block = 0; // у Ледяного Рыцаря латы
    e.mist = 0; // туман рассеивается, когда враг снова ходит
    if (e.burn > 0) {
      e.hp -= e.burn;
      floatText($('.enemy-fx'), `-${e.burn}`, 'burnf');
      $('#enemy').classList.add('hit');
      e.burn--;
      if (hasRelic('stokerglove') && e.hp > 0) api.block(2);
      nestCheck();
      renderCombat();
      await sleep(400);
      if (e.hp <= 0) { ach.flag('burnkill'); await winCombat(); return; }
    }
    const el = $('#enemy');
    if (e.stun > 0) {
      e.stun = 0;
      floatText($('.enemy-fx'), 'Спит…', 'weakf');
      await sleep(500);
    } else {
      for (const it of currentIntents()) {
        if (it.k === 'attack' || it.k === 'snuff' || it.k === 'steal') {
          if (it.k === 'snuff') {
            if (hasRelic('eternaloil')) floatText($('.hero-fx'), 'Огоньки не гаснут', 'blockf');
            else { C.flame = 0; SND.sfx('snuff'); floatText($('.hero-fx'), 'Огоньки погасли', 'weakf'); }
          }
          for (let h = 0; h < (it.hits || 1); h++) {
            el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
            SND.sfx('enemy');
            await sleep(180);
            const real = await hitHero(enemyDmg(it.v));
            // Упырь пьёт тепло: лечится на прошедший урон
            if (it.leech && real > 0 && e.hp > 0) { const b = e.hp; e.hp = Math.min(e.max, e.hp + real); if (e.hp > b) { SND.sfx('heal'); floatText($('.enemy-fx'), `+${e.hp - b}`, 'healf'); } }
            if (run.hp <= 0 || e.hp <= 0) break;
            // Шипы героя ранят врага за каждый удар
            if (C.thorns > 0) { await hitEnemy(C.thorns); if (e.hp <= 0) { ach.flag('thornskill'); break; } }
          }
          if (it.k === 'steal' && run.hp > 0) {
            const g = Math.min(run.gold, it.gold);
            if (g > 0) { run.gold -= g; C.stolen += g; SND.sfx('coin'); floatText($('.hero-fx'), `-${g} монет`, 'weakf'); }
          }
        } else if (it.k === 'boom') {
          el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
          SND.sfx('burst');
          floatText($('.enemy-fx'), 'Бабах!', 'burnf');
          await sleep(200);
          await hitHero(enemyDmg(it.v));
          e.hp = 0; C.boomed = true;
        } else if (it.k === 'sap') { C.sap += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), `−${it.v} энергии`, 'weakf'); }
        else if (it.k === 'mist') { e.mist = it.v; SND.sfx('debuff'); floatText($('.enemy-fx'), 'Туман', 'weakf'); }
        else if (it.k === 'bury') { C.bury += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), `Замело: −${it.v} карты`, 'weakf'); }
        else if (it.k === 'frail') { C.frail += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), 'Хрупкость', 'weakf'); }
        else if (it.k === 'block') { e.block += it.v; floatText($('.enemy-fx'), `+${it.v}`, 'blockf'); }
        else if (it.k === 'buff') { e.str += it.v; SND.sfx('buff'); floatText($('.enemy-fx'), `Сила +${it.v}`, 'burnf'); }
        else if (it.k === 'debuff') { C.pWeak += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), 'Слабость', 'weakf'); }
        else if (it.k === 'heal') { const b = e.hp; e.hp = Math.min(e.max, e.hp + it.v); SND.sfx('heal'); floatText($('.enemy-fx'), `+${e.hp - b}`, 'healf'); }
        else if (it.k === 'spikes') { e.thorns += it.v; SND.sfx('buff'); floatText($('.enemy-fx'), `Колючки +${it.v}`, 'burnf'); }
        else if (it.k === 'curse') {
          for (let k = 0; k < it.n; k++) C.draw.splice(rnd(0, C.draw.length), 0, mk(it.card));
          SND.sfx('debuff'); floatText($('.hero-fx'), `${CARDS[it.card].name} ×${it.n}`, 'weakf');
        }
        renderCombat();
        await sleep(300);
        if (run.hp <= 0 || e.hp <= 0) break;
      }
    }
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
    if (e.hp <= 0) { await winCombat(); return; }
    if (e.weak > 0) e.weak--;
    if (e.vuln > 0) e.vuln--;
    e.boil = 0; // кипяток остывает
    e.pi++;
    startPlayerTurn();
  }

  async function winCombat() {
    busy = true;
    const el = $('#enemy');
    if (el) el.classList.add('dying');
    await sleep(800);
    const { tier, stolen, hpLost, id, turn, boomed } = C;
    C = null;
    STATS.fights++;
    if (tier === 'elite') STATS.elites++;
    if (tier === 'boss') STATS.bosses++;
    ach.put('beaten', id);
    if (tier === 'boss') ach.put('bosses', id);
    if (!hpLost) ach.flag('flawless');
    if (!hpLost && tier === 'elite') ach.flag('flawlesselite');
    if (turn === 1) ach.flag('oneturn');
    if (id === 'firecracker' && !boomed) ach.flag('defuse');
    saveStats();
    run.fights++; run.lit++;
    if (stolen) { run.gold += stolen; toast(`Монеты возвращены: +${stolen}`); }
    if (hasRelic('piggy') && !hpLost) { run.gold += 15; toast('Копилка: +15 монет'); }
    setBg();
    if (hasRelic('snowman')) evApi.heal(4);
    if (hasRelic('candybox') && tier === 'elite') { evApi.heal(10); toast('Коробка леденцов: +10 HP'); }
    if (hasRelic('thermos') && run.hp < run.maxHp / 2) { evApi.heal(12); toast('Термос: +12 HP'); }
    if (tier === 'boss' && isFinalStep(run.step)) { goVictory(); return; }
    if (tier === 'boss') { goBossRelic(); return; }
    goReward(tier);
  }

  /* ---------- Трофей босса: один из трёх талисманов босса ---------- */
  function goBossRelic(saved) {
    if (!saved) { SND.sfx('win'); SND.music(mapTrack()); }
    const opts = saved || shuffle(Object.keys(RELICS).filter((r) => RELICS[r].tier === 'boss' && !hasRelic(r))).slice(0, 3);
    if (!opts.length) { goReward('boss'); return; }
    save({ t: 'bossrelic', opts });
    screen.className = 'scr-bossrelic';
    screen.innerHTML = `${topBar()}
      <div class="ribbon">Трофей босса</div>
      <p class="pickhint">Выбери один талисман</p>
      <div class="brelics">${opts.map((id, i) => `<button class="brelic" data-act="bossrelic" data-id="${id}" style="--d:${i * 120}ms">${Art.icon(RELICS[id].art)}<span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></span></button>`).join('')}</div>
      <button class="btn ghost" data-act="bossrelic-skip">Не брать</button>
      ${heroBar(false)}`;
  }

  /* ---------- Награда ---------- */
  function goReward(tier) {
    const boss = tier === 'boss';
    const gold = Math.round((boss ? rnd(50, 60) : tier === 'elite' ? rnd(30, 40) : rnd(12, 20)) * DIFF().gold * (hasRelic('luckystamp') ? 1.2 : 1)) + (hasRelic('envelope') ? 8 : 0);
    run.gold += gold;
    if (!boss) { SND.sfx('win'); SND.music(mapTrack()); }
    if (tier === 'elite') evApi.giveRelic();
    // после босса стадии Ива переводит дух
    const healed = boss ? Math.min(run.maxHp - run.hp, Math.round(run.maxHp * DIFF().bossHeal)) : 0;
    run.hp += healed;
    // шансы [редкая, редкая + необычная]: после элит и боссов редкие выпадают чаще
    const odds = boss ? [0.6, 1] : tier === 'elite' ? [0.25, 0.7] : [0.08, 0.4];
    const count = Math.max(2, 3 + (hasRelic('clover') ? 1 : 0) - (hasRelic('crown') ? 1 : 0));
    const ids = [];
    while (ids.length < count) {
      const x = Math.random();
      const id = pickCard(x < odds[0] ? 'rare' : x < odds[1] ? 'uncommon' : 'common', ids);
      if (id && !ids.includes(id)) ids.push(id);
    }
    const rw = { boss, gold, healed, ids };
    save({ t: 'reward', r: rw });
    renderReward(rw);
  }

  function renderReward({ boss, gold, healed, ids }) {
    const count = ids.length;
    screen.className = 'scr-reward';
    screen.innerHTML = `${topBar()}
      <div class="ribbon">${boss ? 'Босс повержен!' : 'Победа!'}</div>
      <div class="loot">${Art.icon('coin')} +${gold} монет${healed ? ` · +${healed} HP` : ''}</div>
      <p class="pickhint">Возьми одну карту в колоду</p>
      <div class="reward-cards n${count}">${ids.map((id, i) => cardHTML(id, 'reward', `data-act="takecard" data-id="${id}" style="--d:${i * 120}ms"`)).join('')}</div>
      <button class="btn ghost" data-act="next">Пропустить</button>
      ${heroBar(false)}`;
  }

  /* ---------- Финалы ---------- */
  function goVictory() {
    clearSave();
    STATS.wins++; STATS.best = MAX_STEPS;
    if (run.deck.length <= 15) ach.flag('light');
    ach.put('winsCls', run.cls);
    ach.put('winsDiff', diffOf(run));
    saveStats();
    SND.music('title'); SND.sfx('victory');
    screen.className = 'scr-end win';
    screen.innerHTML = `<div class="ribbon">${STORY.winRibbon}</div>
      <div class="book"><div class="page">
        <div class="book-art moon">${heroArt()}</div>
        <h1>${STORY.winTitle}</h1>
        <p class="story">${txt(STORY.winText)}</p>
        <p class="stats">${DIFF().name} · Побед: ${run.fights} · Карт в колоде: ${run.deck.length} · Талисманов: ${run.relics.length}</p>
      </div></div>
      <button class="btn big" data-act="title">В главное меню</button>`;
  }
  function goDefeat() {
    C = null;
    clearSave();
    STATS.losses++; saveStats();
    SND.music(null); SND.sfx('defeat');
    screen.className = 'scr-end lose';
    screen.innerHTML = `<div class="book"><div class="page">
        <div class="book-art dim">${heroArt()}</div>
        <h1>${STORY.loseTitle}</h1>
        <p class="story">${txt(STORY.loseText)}</p>
        <p class="stats">${DIFF().name} · Пройдено уровней: ${run.step + 1} из ${MAX_STEPS} · Побед: ${run.fights}</p>
      </div></div>
      <div class="endbtns"><button class="btn big" data-act="retry">Попробовать снова</button><button class="btn ghost" data-act="title">Главное меню</button></div>`;
  }

  /* ---------- Обработка нажатий ---------- */
  /* Звук включается по первому касанию; шестерёнка в углу открывает настройки */
  window.addEventListener('pointerdown', () => SND.unlock(), { capture: true });
  app.classList.toggle('fast', SETTINGS.fast);
  const gearBtn = $('#gear');
  gearBtn.innerHTML = ICO.gear;
  gearBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); showSettings(); });

  const menuBtn = $('#menu');
  menuBtn.innerHTML = '<svg viewBox="0 0 40 40"><path d="M10 12 h20 M10 20 h20 M10 28 h20" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round"/></svg>';
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); if (run) showPause(); else showGlossary(); });

  app.addEventListener('click', (e) => {
    SND.unlock();
    if (overlay.contains(e.target)) { if (!e.target.matches('input')) SND.sfx('click'); return; }
    const relic = e.target.closest('[data-relic]');
    if (relic) { const r = RELICS[relic.dataset.relic]; toast(`${r.name}: ${r.desc}`); return; }
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl) { toast(tipEl.dataset.tip); return; }
    const t = e.target.closest('[data-act], [data-hi]');

    if (screen.className === 'scr-combat') {
      if (busy) return;
      if (t && t.dataset.hi != null) {
        const i = +t.dataset.hi;
        if (selected === i || SETTINGS.oneTap) playCard(i);
        else { selected = i; SND.sfx('draw'); renderHand(false); }
        return;
      }
      if (e.target.closest('#enemy') && selected >= 0) { playCard(selected); return; }
      if (!t) { if (selected >= 0) { selected = -1; renderHand(false); } return; }
    }
    if (!t) return;
    const act = t.dataset.act;
    if (!['buy', 'buyrelic', 'buytea', 'buyremove', 'buyup', 'takecard', 'bossrelic'].includes(act)) SND.sfx('click');
    switch (act) {
      case 'start': newRun(); break;
      case 'retry': goClassSelect(); break;
      case 'pickcls': goClassSelect(t.dataset.cls, +screen.dataset.diff); break;
      case 'diffset': goClassSelect(screen.dataset.cls, +t.dataset.d); break;
      case 'clsgo': SETTINGS.cls = screen.dataset.cls; SETTINGS.diff = +screen.dataset.diff; saveJSON(SETTINGS_KEY, SETTINGS); if (SETTINGS.skipIntro) newRun(); else goIntro(); break;
      case 'clscards': showClassCards(screen.dataset.cls); break;
      case 'title': goTitle(); break;
      case 'continue': continueRun(); break;
      case 'newgame': askNewGame(); break;
      case 'gloss': showGlossary(); break;
      case 'settings': showSettings(); break;
      case 'ach': showAchievements(); break;
      case 'choose': chooseEncounter(+t.dataset.i); break;
      case 'next': advance(); break;
      case 'deck': showDeck(run.deck, `Колода · ${run.deck.length}`); break;
      case 'relics': showRelics(); break;
      case 'pile-draw': showDeck(C.draw, 'Осталось в колоде'); break;
      case 'pile-disc': showDeck(C.disc, 'Сброс'); break;
      case 'end': endTurn(); break;
      case 'evopt': eventOption(+t.dataset.i); break;
      case 'openchest': openChest(); break;
      case 'rest-heal': evApi.heal(restHeal()); if (hasRelic('cocoatin')) { run.maxHp += 2; run.hp += 2; toast('Жестянка какао: +2 к макс. HP'); } advance(); break;
      case 'rest-up': upgradeFlow((ok) => { if (ok) advance(); }); break;
      case 'rest-burn': removeCardFlow((ok) => { if (ok) advance(); }); break;
      case 'takecard': SND.sfx('card'); run.deck.push(mk(t.dataset.id)); toast(`В колоду: ${CARDS[t.dataset.id].name}`); advance(); break;
      case 'bossrelic': addRelic(t.dataset.id); goReward('boss'); break;
      case 'bossrelic-skip': goReward('boss'); break;
      case 'buy': case 'buyrelic': case 'buytea': case 'buyremove': case 'buyup': screen.onShop(act, +t.dataset.i); break;
    }
  });

  // Для отладки и автотестов
  window.Game = { get run() { return run; }, get combat() { return C; }, newRun, pickCard: (r) => pickCard(r), goMap: () => goMap(), startCombat: (id, t = 'fight') => startCombat(id, t), costOf, addRelic: (id) => addRelic(id), mk, render: () => renderCombat() };

  achCheck(true);
  goTitle();
})();
