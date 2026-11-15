/* Игровая логика и отрисовка экранов. */
(function () {
  const { CARDS, ENEMIES, RELICS, EVENTS, CLASSES, DIFFICULTIES } = window.Data;
  const STORY = window.Story.story;
  const LORE = window.Lore;
  const SKY = window.Story.sky;
  document.title = STORY.title;
  // Путь делится на стадии, последний уровень каждой стадии — её босс
  const STAGES = STORY.stages;
  const SND = window.Sound;
  const FX = window.FX;
  // Анимация удара у каждой атаки своя (js/fx.js); у остальных атак — обычный удар
  const ATK_FX = {
    strike: 'lantern', spark: 'sparks', sparks: 'sparks', heavy: 'heavy', ember: 'fire', snowkick: 'snow', payback: 'heavy',
    luckycoin: 'coin', snowball: 'snowball', flurry: 'blizzard', icethrow: 'icicle', heavybag: 'heavy', sledram: 'heavy',
    snowstorm: 'blizzard', cancel: 'stamp', stamp: 'stamp', registered: 'stamp', surprise: 'letter', palm: 'fire', lastword: 'letter',
    secret: 'letter', urgent: 'letter', finale: 'starfall', starfall: 'starfall', avalanche: 'avalanche', lastlight: 'beam', beam: 'beam',
    poker: 'sparks', rollingpin: 'flour', fair: 'confetti', gritsparks: 'sparks', steelring: 'slash', bitterroot: 'roots', gingerbread: 'crumbs',
  };
  // при нескольких ударах подряд следующие удары короче
  const ATK_FX_NEXT = { avalanche: 'snow', blizzard: 'snow', snowball: 'snow', icicle: 'shatter', coin: 'bonk', letter: 'bonk', starfall: 'sparks', beam: 'lantern', flour: 'heavy', confetti: 'bonk' };
  // сопровождение розыгрыша навыков: пар от чая, ветер, свисток, рожок, вой
  const CAST_FX = {
    tea: ['steam'], sbiten: ['steam'], cocoa: ['steam'], chamomile: ['steam'], livingwater: ['steam'],
    wind: ['wind'], breath: ['wind'], express: ['wind'], rushmail: ['wind'],
    whistle: ['notes', 'whistle'], hornblow: ['notes', 'horn'], howl: ['notes', 'howl'], lullaby: ['notes'], sleepgrass: ['notes'],
    parcel: ['parcel'], poste: ['parcel'], moneyorder: ['parcel'],
  };
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
  const maxEnergy = () => MAX_ENERGY + ['hourglass', 'bottomless', 'crown', 'sunstone'].filter((r) => hasRelic(r)).length;
  const handSize = () => HAND_SIZE - (hasRelic('hourglass') ? 1 : 0) + (hasRelic('moonstone') ? 2 : 0)
    + (hasRelic('sunstone') ? 1 : 0) + (hasRelic('magicbag') ? 1 : 0);
  const flameMax = () => (hasRelic('bellows') ? 2 : FLAME_MAX);
  const flameBonus = () => (hasRelic('bellows') ? 0 : FLAME_BONUS);

  /* Пояснения к ключевым словам: показываются в справочнике и по нажатию на статус */
  const GLOSS_RU = [
    ['Огонёк', 'Каждый Огонёк даёт атакам +{b} урона. На {m} Огоньках лампа вспыхивает и бьёт врага на {d}.', { b: FLAME_BONUS, m: FLAME_MAX, d: BURST_DMG }],
    ['Решимость', 'Каждое очко добавляет +1 урона каждой атаке. Бывает до конца боя или до конца хода.'],
    ['Уязвим', 'Враг получает на 50% больше урона от атак, Вспышек и укусов Дружка. Число — сколько ходов это продлится.'],
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
    ['Пряник', 'Пряничница печёт их прямо в бою. Пряник стоит 0, бьёт и даёт защиту, а после розыгрыша сгорает. После боя Пряники исчезают.'],
    ['Заточка', 'Карта улучшается до конца боя, как у костра. После боя она снова обычная.'],
    ['Дружок', 'Пёс пастушки. В конце вашего хода он кусает врага на свою Злость. Команды делают его злее или заставляют кусать сразу.'],
    ['Цена', 'Чтобы сыграть карту, нужно отдать столько HP. Защита не помогает. Последние HP отдать нельзя.'],
    ['Помехи', 'Враги подкидывают в колоду Кляксы, Ледышки, Сургуч и Недоставленные письма. Они исчезают после боя.'],
    ['Кража', 'Некоторые враги крадут монеты. Если победить вора, монеты вернутся.'],
    ['Улучшение', 'У костра, у кузнеца и в лавке карту можно улучшить. Улучшенная карта отмечена плюсом.'],
    ['Талисманы босса', 'После босса стадии можно выбрать один из трёх сильных талисманов. У многих есть цена.'],
    ['Редкость', 'Карты и талисманы бывают пяти редкостей: обычные (серый камень), необычные (зелёный), редкие (синий), эпические (фиолетовый) и легендарные (золотой). Чем сильнее противник, тем чаще после него выпадают редкие. Легендарную карту можно взять в колоду только одну.'],
    ['Приёмы врагов', 'У многих врагов есть свои хитрости: матрёшки раскрываются, самовар закипает, туман глушит удары, шутиха взрывается. Приёмы видны значками под именем врага, нажмите на значок, чтобы прочитать.'],
    ['Разговоры', 'Некоторые враги заговаривают с героем до боя: кого-то можно уговорить, прогнать или разозлить, а побеждённые иногда просят пощады. В пути встречаются другие герои. Друзья помогут в финале, а обиженный герой может уйти в Тень и стать финальным боссом.'],
    ['Герои', 'У каждого героя своя колода, особенность, карты и талисманы, которые выпадают только ему. Общие карты под его билд в наградах и лавке встречаются чаще.'],
  ];
  // пояснение по русскому термину (GL) и список для справочника (GLOSS) — на языке игры
  const GL = {};
  const GLOSS = GLOSS_RU.map(([k, v, vars]) => { GL[k] = tr(v, vars); return [tr(k), GL[k]]; });
  // что делают активные чары (перед текстом ставится название карты)
  const CHARM_TIP = {
    mittens: (n) => tr('в начале хода {n} защиты', { n }),
    inkpen: (n) => tr('каждый Навык наносит {n} урона', { n }),
    eveninglamp: (n) => tr('в начале хода +{n} {n|Огонёк|Огонька|Огоньков}', { n }),
    stubborn: (n) => tr('в начале хода +{n} Решимость', { n }),
    compass: (n) => tr('каждый ход +{n} {n|карта|карты|карт}', { n }),
    hearth: (n) => tr('в начале хода Поджог {n}', { n }),
    rhythm: (n) => tr('каждая третья карта за ход даёт +{n} {n|Огонёк|Огонька|Огоньков}', { n }),
    standfast: () => tr('защита не сгорает в начале хода'),
    firebird: (n) => tr('в начале хода +{a} {a|Огонёк|Огонька|Огоньков} и Поджог {b}', { a: 2 * n, b: 3 * n }),
    eternalwinter: (n) => tr('в начале хода враг теряет {a} Силы, а вы получаете {b} защиты', { a: 2 * n, b: 8 * n }),
    nightshift: (n) => tr('в конце хода {n} защиты за каждую неистраченную энергию', { n }),
    aurora: (n) => tr('в начале хода +{n} {n|энергия|энергии|энергии}', { n }),
    gingerhouse: (n) => tr('каждый Пряник наносит ещё {n} урона', { n: 4 * n }),
    apprentice: (n) => tr('в начале хода заточить {n} {n|карту|карты|карт}', { n: 2 * n }),
    wolfhound: (n) => tr('Дружок кусает в конце хода {n} {n|раз|раза|раз}', { n: 1 + n }),
  };

  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const screen = $('#screen');
  // в бою фон опускается к земле: класс ground на #app.
  // На нарисованном фоне камера подстраивается под того, кто стоит на экране:
  // снег с картинки встаёт ему под ноги (враг в бою, собеседник, сундук, ёж в лавке)
  const STANDS = '.enemy, .talk-art, .chest, .shopkeeper, .ev-art';
  function groundCam() {
    if (!Art.groundCam) return;
    const el = screen.querySelector(STANDS);
    let y = null;
    if (el && el.offsetHeight) {
      y = el.offsetHeight;
      for (let n = el; n && n !== app; n = n.offsetParent) y += n.offsetTop;
    }
    Art.groundCam($('#bg'), y);
  }
  new MutationObserver(() => { app.classList.toggle('ground', screen.className === 'scr-combat'); groundCam(); })
    .observe(screen, { attributes: true, attributeFilter: ['class'], childList: true });
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
  const SETTINGS = loadJSON(SETTINGS_KEY, { skipIntro: false, fast: false, snow: true, oneTap: false, lines: true, cls: 'lamp', diff: 1 });
  if (!CLASSES[SETTINGS.cls]) SETTINGS.cls = 'lamp';
  if (!DIFFICULTIES[SETTINGS.diff]) SETTINGS.diff = 1;
  const STATS_DEF = { runs: 0, wins: 0, losses: 0, best: 0, fights: 0, elites: 0, bosses: 0, cards: 0 };
  const STATS = loadJSON(STATS_KEY, STATS_DEF);
  const saveStats = () => { saveJSON(STATS_KEY, STATS); achCheck(); };
  // итоги законченных забегов, новые сверху (экран «Статистика»)
  const RUNS_KEY = 'lastray.runs';
  const RUNS_MAX = 30;
  const RUNS = loadJSON(RUNS_KEY, { list: [] });
  if (!Array.isArray(RUNS.list)) RUNS.list = [];

  /* ---------- Достижения ---------- */
  // c — счётчики и флаги, s — наборы (разные карты, талисманы, противники), got — когда получено,
  // seenAt — когда панель открывали в последний раз (для пометки «новое»)
  const ACH_KEY = 'lastray.ach';
  // k — сколько раз побеждён каждый противник (для базы знаний)
  const ACH_DEF = { c: {}, s: {}, got: {}, seenAt: 0, k: {} };
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
  /* База знаний: открытые герои, противники, карты и талисманы хранятся вместе с достижениями */
  const CODEX = window.Achievements.CODEX;
  const CX_SET = { h: 'cxh', e: 'cxe', c: 'cxc', r: 'cxr' };
  const cxHas = (kind, id) => (ACH.s[CX_SET[kind]] || []).includes(id);
  function codexSync(silent) {
    const n = (kind, list) => list.filter((id) => cxHas(kind, id)).length;
    ACH.c.cxe = n('e', CODEX.e); ACH.c.cxc = n('c', CODEX.freeC); ACH.c.cxr = n('r', CODEX.freeR);
    ACH.c.cxall = n('h', CODEX.h) + n('e', CODEX.e) + n('c', CODEX.c) + n('r', CODEX.r);
    achCheck(silent);
  }
  let cxPending = false;
  function codexMark(kind, id) {
    if (!id || cxHas(kind, id)) return;
    (ACH.s[CX_SET[kind]] || (ACH.s[CX_SET[kind]] = [])).push(id);
    if (!cxPending) { cxPending = true; setTimeout(() => { cxPending = false; codexSync(); }, 0); }
  }
  const codexCount = () => ACH.c.cxall || 0;
  const codexTotal = CODEX.h.length + CODEX.e.length + CODEX.c.length + CODEX.r.length;
  const achArt = (a) => (a.art === 'h' ? heroFace() : a.art.startsWith('c:') ? heroFace(a.art.slice(2))
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
      ? `<span class="aport collect">${ICO.medal}</span><span><small>${tr('Достижения получены')}</small><b>${tr('И ещё {n}', { n: a.summary })}</b></span>`
      : `<span class="aport ${a.cat}">${achArt(a)}</span><span><small>${tr('Достижение получено')}</small><b>${a.name}${achStars(a)}</b></span>`;
    app.appendChild(t);
    SND.sfx('achieve');
    setTimeout(() => { t.remove(); achNextToast(); }, SETTINGS.fast ? 1700 : 2600);
  }

  // «+15 монет» с нужной формой слова
  const coins = (n) => tr('+{n} {n|монета|монеты|монет}', { n });
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
  const heroFace = (cls = heroId()) => (Art.face ? Art.face(CLASSES[cls].look) : heroArt(cls));
  I18N.gender = () => !!hero().f; // {f|она|он} в текстах — по герою забега
  const txt = (v) => (typeof v === 'function' ? v(hero()) : v);
  // сложность забега; у сохранений до её появления — «Обычный маршрут»
  const diffOf = (r) => (r && DIFFICULTIES[r.diff] ? r.diff : 1);
  const DIFF = () => DIFFICULTIES[diffOf(run)];
  // карты, которые могут выпасть этому герою: общие и его собственные
  const cardPool = (rarity) => Object.keys(CARDS).filter((k) => CARDS[k].rarity === rarity && (!CARDS[k].cls || CARDS[k].cls === heroId()));
  // случайная карта с перевесом в сторону билда героя
  function pickCard(rarity, exclude = []) {
    const h = hero();
    // легендарную карту можно взять в колоду только одну
    const list = cardPool(rarity).filter((k) => !exclude.includes(k) && !(rarity === 'legendary' && run && run.deck.some((c) => c.id === k)));
    if (!list.length) return rarity === 'legendary' ? pickCard('epic', exclude) : undefined;
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
  // place: rest | shop | chest | talk | meet — нарисованная сцена вместо пути
  function setBg(titleT, place) {
    const step = run ? run.step : 0;
    const t = titleT != null ? titleT : MAX_STEPS > 1 ? Math.min(1, step / (MAX_STEPS - 1)) : 0;
    const g = STAGES[stageOf(step)] || STAGES[0];
    const lamps = titleT != null ? 2 : run && STORY.lamps ? STORY.lamps(run) : 0;
    const approach = g.len > 1 ? (step - g.start) / (g.len - 1) : 1;
    const p = Art.sampleSky(SKY, t);
    let painted = null;
    if (Art.paintedBg) {
      if (place) painted = Art.paintedBg({ place });
      else if (titleT != null) painted = Art.paintedBg({ place: 'title' });
      else if (run && isFinalStep(step) && STAGES.length > 1) painted = Art.paintedBg({ place: 'final' });
      else painted = Art.paintedBg({ scene: STORY.sky === 'night' ? 'night' : g.scene, t: approach });
    }
    app.classList.toggle('painted-bg', !!painted);
    $('#bg').innerHTML = painted || Art.background(p, lamps, g.scene, approach);
    if (painted) groundCam();
    app.style.setProperty('--sky-top', p.skyTop);
    app.style.setProperty('--sky-mid', p.skyMid);
    app.style.setProperty('--sky-bot', p.skyBot);
  }

  /* ---------- Состояние забега ---------- */
  let run = null;   // прогресс забега
  let C = null;     // текущий бой
  let busy = false; // блокировка ввода на время анимаций
  let selected = -1;

  /* ---------- Итоги забега: счётчики текущего забега (run.st) ----------
     ms — время в пути (пауза больше 2 минут считается за 2), dmg — урон врагам, hit — сильнейший удар,
     taken — потеряно HP, healed — вылечено, cards — сыграно карт, gold и spent — монеты собраны и потрачены,
     by — кто остановил героя, revives — сколько раз бой начинали заново */
  const stNew = () => ({ ms: 0, last: Date.now(), dmg: 0, hit: 0, taken: 0, healed: 0, cards: 0, gold: 0, spent: 0, elites: 0, bosses: 0, revives: 0 });
  const stAdd = (k, n = 1) => { if (run && run.st && n > 0) run.st[k] = (run.st[k] || 0) + n; };
  function stTick() {
    const s = run && run.st;
    if (!s) return;
    const now = Date.now();
    s.ms += Math.max(0, Math.min(now - (s.last || now), 120000));
    s.last = now;
  }
  const gain = (n) => { run.gold += n; if (n > 0) stAdd('gold', n); else stAdd('spent', -n); };
  const spend = (n) => { run.gold -= n; stAdd('spent', n); };
  // монеты, которые событие поменяло само (в data.js: r.gold -= 15), без уже учтённых gain и spend
  const stMark = () => ({ g: run.gold, a: run.st ? run.st.gold : 0, b: run.st ? run.st.spent : 0 });
  function stGoldSince(m) {
    if (!run || !run.st) return;
    const rest = (run.gold - m.g) - ((run.st.gold - m.a) - (run.st.spent - m.b));
    if (rest > 0) stAdd('gold', rest); else stAdd('spent', -rest);
  }
  // после «Начать бой заново» забег возвращается к снимку, но время, урон и сыгранные карты остаются
  function keepSt(prev) {
    if (!prev) return;
    const s = run.st || (run.st = stNew());
    ['ms', 'dmg', 'hit', 'taken', 'healed', 'cards'].forEach((k) => { s[k] = Math.max(s[k] || 0, prev[k] || 0); });
    s.revives = (prev.revives || 0) + 1;
    s.last = Date.now();
    delete s.by;
  }

  function newRun(cls = SETTINGS.cls, diff = SETTINGS.diff) {
    snapFight = null; snapStep = null;
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
      // встречи и отношения (js/lore.js): rel — отношение героев, fallen — ушедшие в Тень,
      // tone — сколько раз решили миром, разозлили врага и прошли мимо чужой беды
      rel: {}, fallen: [], met: [], meetLog: [], secrets: [], grudge: {}, tone: { peace: 0, anger: 0, pass: 0 },
      meetPlan: planMeetings(cls),
      // враги, которых победили, и те, с кем обошлись по-доброму (связи врагов, js/lore.js ETIES)
      killed: [], kind: [],
      st: stNew(),
    };
    codexMark('h', cls);
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
    stTick();
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
    if (!run.st) run.st = stNew();
    run.st.last = Date.now();
    // сохранения до появления героев — это забег Ивы
    if (!run.cls) { run.cls = 'lamp'; if (!run.relics.includes('ivalamp')) run.relics.unshift('ivalamp'); }
    uidSeq = Math.max(uidSeq, ...run.deck.map((c) => c.uid + 1));
    ensureLore();
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
    else if (p.t === 'meet') goMeet(p.hero);
    else if (p.t === 'talk') goTalk(p.enemy, p.tier);
    else if (p.t === 'after') goAfter(p.tier, p.enemy);
    else if (p.t === 'afterdone') afterNext(p.tier);
    else goMap();
  }

  /* ---------- Общие куски интерфейса ---------- */
  const TYPE_LABEL = { atk: tr('Атака'), skill: tr('Навык'), charm: tr('Чары'), status: tr('Помеха') };
  // камень редкости на карте и подписи редкости талисманов
  const RARITY_GEM = { common: 'Обычная', uncommon: 'Необычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' };
  const TIER_LABEL = { common: tr('Обычный'), uncommon: tr('Необычный'), rare: tr('Редкий'), epic: tr('Эпический'), legendary: tr('Легендарный'), boss: tr('Трофей босса'), class: tr('Особенность героя') };
  // случайная редкость по порогам [легендарная, эпическая, редкая, необычная], остальное — обычная
  const rollRarity = (t) => { const x = Math.random(); return x < t[0] ? 'legendary' : x < t[1] ? 'epic' : x < t[2] ? 'rare' : x < t[3] ? 'uncommon' : 'common'; };
  // стоимость в бою: Бой курантов делает все карты бесплатными до конца хода
  const playCost = (c) => { const v = costOf(c); return v != null && C && C.free ? 0 : v; };
  /* Карта: принимает экземпляр {id, up, grow} или просто id */
  function cardHTML(card, extra = '', attrs = '') {
    const inst = typeof card === 'string' ? { id: card, up: false } : card;
    const c = CARDS[inst.id];
    if (run) codexMark('c', inst.id); // карта попалась на глаза в забеге — открыта в базе знаний
    const g = C ? api : apiStatic;
    const cost = extra.includes('inhand') ? playCost(inst) : costOf(inst);
    let desc = c.desc(g, inst.up, inst);
    if (c.retain) desc += ` ${tr('Удержание.')}`;
    if (c.exhaust && c.type !== 'status') desc += ` ${tr('Сгорает.')}`;
    const plain = desc.replace(/<[^>]+>/g, '');
    return `<div class="card ${c.type} r-${c.rarity} ${inst.up ? 'up' : ''} ${inst.sharp ? 'sharp' : ''} ${extra}" ${attrs}>
      <div class="cost ${cost == null ? 'none' : ''}"><span>${cost == null ? '✕' : cost}</span></div>
      <div class="ctitle"><span>${c.name}${inst.up ? '<i>+</i>' : ''}</span></div>
      <div class="cart">${Art.card(inst.id)}</div>
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
    list.forEach((r) => codexMark('r', r));
    const shown = list.length > max ? list.slice(-(max - 1)) : list;
    const more = list.length - shown.length;
    return shown.map((r) => `<button class="relic rt-${RELICS[r].tier}" data-relic="${r}">${Art.relic(r)}</button>`).join('')
      + (more > 0 ? `<button class="relic more" data-act="relics">+${more}</button>` : '');
  }

  function showRelics() {
    showOverlay(`<h2>${tr('Талисманы')} · ${run.relics.length}</h2><div class="rlist">${run.relics.map((r) => `<div class="rrow ${RELICS[r].tier}">${Art.relic(r)}<span><b>${RELICS[r].name}<em class="rtier ${RELICS[r].tier}">${TIER_LABEL[RELICS[r].tier]}${RELICS[r].cls ? ` · ${CLASSES[RELICS[r].cls].name}` : ''}</em></b><small>${RELICS[r].desc}</small></span></div>`).join('')}</div>
      <button class="btn" data-act="close">${tr('Закрыть')}</button>`, (e) => { if (e.target.closest('[data-act="close"]')) hideOverlay(); });
  }

  function heroBar(inCombat) {
    const hpPct = (run.hp / run.maxHp) * 100;
    const flame = inCombat ? C.flame : 0;
    return `<div class="herobar">
      <div class="portrait" id="heroPortrait">${heroFace()}</div>
      <div class="hb-mid">
        <div class="hpbar"><div class="fill" style="width:${hpPct}%"></div><span>${run.hp}/${run.maxHp}</span>
          ${inCombat && C.block > 0 ? `<div class="hblk">${Art.intentIcon('block')}<b>${C.block}</b></div>` : ''}</div>
        <div class="hb-row">
          ${inCombat ? `<div class="lamp" data-tip="${GLOSS[0][1]}">${Array.from({ length: flameMax() }, (_, i) => `<i class="pip ${i < flame ? 'on' : ''}">${Art.flame(1)}</i>`).join('')}</div>` : `<div class="hero-name">${hero().name}</div>`}
        </div>
      </div>
      ${inCombat ? `<div class="energy"><b>${C.energy}</b><small>/${maxEnergy()}</small></div>
        <div class="piles"><button class="pile" data-act="pile-draw">${tr('Колода')}<b>${C.draw.length}</b></button><button class="pile" data-act="pile-disc">${tr('Сброс')}<b>${C.disc.length}</b></button></div>
        <button class="btn end" data-act="end">${tr('Конец<br>хода')}</button>`
        : `<button class="btn deckbtn" data-act="deck">${tr('Колода')}<b>${run.deck.length}</b></button>`}
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
    showOverlay(`<h2>${title}</h2>${preview === 'up' ? `<p class="ovhint">${tr('Так карты будут выглядеть после улучшения')}</p>` : ''}<div class="grid">${sorted.map((c) => cardHTML(view(c), 'mini', `data-uid="${c.uid}"`)).join('') || `<p class="muted">${tr('Пусто')}</p>`}</div>
      <button class="btn" data-act="close">${onPick ? tr('Отмена') : tr('Закрыть')}</button>`, (e) => {
      const cardEl = e.target.closest('.card');
      if (onPick && cardEl) { onPick(+cardEl.dataset.uid); return; }
      if (e.target.closest('[data-act="close"]') || !onPick) { hideOverlay(); if (onPick) onPick(null); }
    });
  }

  /* ---------- Титульный экран ---------- */
  // какая пьеса звучит на пути: город, окраина или финальная ночь
  const mapTrack = () => ['stage1', 'stage2', 'night'][Math.min(2, run ? stageOf(run.step) : 0)];

  function showGlossary(back) {
    showOverlay(`<h2>${tr('Справочник')}</h2><dl class="gloss">${GLOSS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <button class="btn" data-act="close">${back ? tr('Назад') : tr('Закрыть')}</button>`, (e) => { if (e.target.closest('[data-act="close"]')) { if (back) back(); else hideOverlay(); } });
  }

  /* ---------- Главное меню ---------- */
  function goTitle() {
    run = null; C = null; busy = false; setBg(0.45);
    hideOverlay();
    SND.music('title');
    const s = loadSave();
    const info = s && `${CLASSES[s.run.cls || 'lamp'].name} · ${DIFFICULTIES[diffOf(s.run)].name} · ${tr('ур. {n}', { n: s.run.step + 1 })} · ${s.run.hp}/${s.run.maxHp} HP`;
    screen.className = 'scr-title';
    screen.innerHTML = `
      <div class="logo"><small>${tr('почтовая сказка')}</small><h1${STORY.title.length > 14 ? ' class="long"' : ''}>${STORY.title}</h1></div>
      <div class="title-hero${s ? ' small' : ''}">${heroArt(s ? (s.run.cls || 'lamp') : SETTINGS.cls)}</div>
      <div class="menu">
        ${s ? `<button class="btn big" data-act="continue">${tr('Продолжить')}<small>${info}</small></button>` : ''}
        <button class="btn ${s ? 'ghost' : 'big'}" data-act="newgame">${tr('Новая игра')}</button>
        <button class="btn ghost achbtn" data-act="ach">${ICO.medal}<span>${tr('Достижения')}<small>${tr('{a} из {b}', { a: achCount(), b: ACH_LIST.length })}</small></span>${achHasNew() ? '<i class="newdot"></i>' : ''}</button>
        <button class="btn ghost achbtn" data-act="codex">${ICO.book}<span>${tr('База знаний')}<small>${tr('{a} из {b}', { a: codexCount(), b: codexTotal })}</small></span></button>
        <button class="btn ghost achbtn" data-act="stats">${ICO.stats}<span>${tr('Статистика')}<small>${RUNS.list.length ? tr('Забегов: {a} · доставлено писем: {b}', { a: STATS.runs, b: STATS.wins }) : tr('Итоги твоих забегов')}</small></span></button>
        <button class="btn ghost achbtn storebtn" data-act="store">${ICO.gift}<span>${tr('Магазин')}<small>${tr('Герои и режим без рекламы')}</small></span></button>
        <div class="menu-row"><button class="btn ghost" data-act="gloss">${tr('Справочник')}</button><button class="btn ghost" data-act="settings">${tr('Настройки')}</button></div>
      </div>
      <p class="savehint">${s ? tr('Прогресс сохраняется после каждого уровня') : ''}</p>`;
  }

  function askNewGame() {
    const s = loadSave();
    const begin = () => goClassSelect();
    if (!s) { begin(); return; }
    showOverlay(`<div class="pause"><h2>${tr('Начать заново?')}</h2>
      <p class="ovhint">${tr('Сохранённый забег на уровне {n} из {total} будет потерян.', { n: s.run.step + 1, total: MAX_STEPS })}</p>
      <button class="btn" data-act="c-yes">${tr('Начать заново')}</button>
      <button class="btn ghost" data-act="c-no">${tr('Отмена')}</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      hideOverlay();
      if (b.dataset.act === 'c-yes') { clearSave(); begin(); }
    });
  }

  /* Пауза во время забега: справочник и выход в главное меню */
  function showPause() {
    showOverlay(`<div class="pause"><h2>${tr('Пауза')}</h2>
      <p class="ovhint">${hero().name} · ${DIFF().name}</p>
      <p class="ovhint">${C ? tr('Прогресс сохранён до начала этого боя. Если выйти, бой начнётся заново.') : tr('Прогресс сохранён. Можно выйти и вернуться позже.')}</p>
      <button class="btn" data-act="p-resume">${tr('Вернуться в игру')}</button>
      <button class="btn ghost" data-act="p-gloss">${tr('Справочник')}</button>
      <button class="btn ghost" data-act="p-settings">${tr('Настройки')}</button>
      <button class="btn ghost" data-act="p-title">${tr('Главное меню')}</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'p-resume') hideOverlay();
      if (b.dataset.act === 'p-gloss') showGlossary();
      if (b.dataset.act === 'p-settings') showSettings();
      if (b.dataset.act === 'p-title') {
        if (C && busy) { toast(tr('Дождись конца хода')); return; }
        goTitle();
      }
    });
  }

  /* ---------- Настройки ---------- */
  const ICO = {
    gift: '<svg viewBox="0 0 40 40"><rect x="7" y="16" width="26" height="19" rx="2" fill="#c8423a" stroke="#17121f" stroke-width="2.2"/><rect x="5" y="11" width="30" height="7" rx="2" fill="#e05a4a" stroke="#17121f" stroke-width="2.2"/><path d="M20 11 v24" stroke="#f3d27c" stroke-width="4"/><path d="M20 11 q-9 -9 -11 -2 q0 4 11 2 q9 -9 11 -2 q0 4 -11 2" fill="#f3d27c" stroke="#17121f" stroke-width="2" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 40 40"><path d="M13 18 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke="#17121f" stroke-width="6"/><path d="M13 18 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke="#c9ccd8" stroke-width="3"/><rect x="9" y="17" width="22" height="17" rx="3" fill="#f3d27c" stroke="#17121f" stroke-width="2.4"/><circle cx="20" cy="24" r="2.6" fill="#17121f"/><path d="M20 25 v4" stroke="#17121f" stroke-width="2.4"/></svg>',
    ad: '<svg viewBox="0 0 40 40"><rect x="4" y="9" width="32" height="22" rx="5" fill="#f3d27c" stroke="#17121f" stroke-width="2.4"/><path d="M16 14 l10 6 l-10 6z" fill="#c8423a" stroke="#17121f" stroke-width="2" stroke-linejoin="round"/></svg>',
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
    ['lines', 'Реплики врагов', 'Показывать', 'Скрывать', true],
  ].map(([key, ...words]) => [key, ...words.slice(0, 3).map((w) => tr(w)), words[3]]);

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
    // язык: названия языков пишутся на них самих
    const langRow = `<div class="trow langrow"><span class="tlabel">${tr('Язык')}</span>
      ${Object.entries(I18N.LANGS).map(([k, name]) => `<button class="radio ${k === I18N.lang ? 'on' : ''}" data-lang="${k}" lang="${k}"><i></i>${name}</button>`).join('')}</div>`;
    return `<div class="settings">
      <div class="sribbon">${tr('Настройки')}</div>
      <button class="sclose" data-act="s-close" aria-label="${tr('Закрыть')}">✕</button>
      <div class="sicons">
        <button data-act="s-ach"><span>${ICO.medal}</span>${tr('Достижения')}</button>
        <button data-act="s-gloss"><span>${ICO.book}</span>${tr('Справочник')}</button>
        <button data-act="s-stats"><span>${ICO.stats}</span>${tr('Статистика')}</button>
        <button data-act="s-reset"><span>${ICO.reset}</span>${tr('Сбросить')}</button>
      </div>
      <div class="sline"></div>
      ${slider('sfx', tr('Звуки'), Art.soundIcon('all'), p.sfxVol)}
      ${slider('music', tr('Музыка'), ICO.note, p.musicVol)}
      <div class="sline"></div>
      ${langRow}
      ${TOGGLES.map(toggle).join('')}
      <div class="sline"></div>
      <p class="sfoot"><span>${tr('Версия {v}', { v: VERSION })}</span><span>${tr('Сохранение в этом браузере')}</span></p>
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
      const b = e.target.closest('[data-act], [data-set], [data-lang]');
      if (!b) return;
      // смена языка: тексты переводятся при загрузке, поэтому игра перезапускается
      // (забег сохранён; после перезапуска снова откроются настройки)
      if (b.dataset.lang) {
        if (b.dataset.lang === I18N.lang) return;
        SETTINGS.lang = b.dataset.lang;
        saveJSON(SETTINGS_KEY, SETTINGS);
        try { sessionStorage.setItem('lastray.reopen', 'settings'); } catch (err) { /* недоступно */ }
        location.reload();
        return;
      }
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
      if (act === 's-stats') showStats(showSettings);
      if (act === 's-reset') askReset();
    };
    render();
  }

  /* ---------- Панель достижений ---------- */
  const achCount = (cat) => ACH_LIST.filter((a) => (!cat || a.cat === cat) && achDone(a)).length;
  const achHasNew = () => ACH_LIST.some((a) => ACH.got[a.id] > ACH.seenAt);
  const fmt = (n) => I18N.num(n);
  // почтовый штемпель «Получено» с датой
  function achStamp(ts) {
    const d = new Date(ts);
    const dd = d.toLocaleDateString(I18N.locale, { day: '2-digit', month: '2-digit' });
    return `<svg class="astamp" viewBox="0 0 92 80"><g fill="none" stroke="currentColor">
      <path d="M2 30 q5 -4 10 0 t10 0 t10 0 M2 40 q5 -4 10 0 t10 0 t10 0 M2 50 q5 -4 10 0 t10 0 t10 0" stroke-width="2"/>
      <circle cx="54" cy="40" r="34" stroke-width="3"/><circle cx="54" cy="40" r="23" stroke-width="1.6"/></g>
      <text font-size="10.5" letter-spacing="1"><textPath href="#ach-arc" startOffset="50%" text-anchor="middle">${tr('ПОЛУЧЕНО')}</textPath></text>
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
      <div class="aport ${a.cat}">${achArt(a)}${fresh ? `<em class="anew">${tr('новое')}</em>` : ''}</div>
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
        <span class="achtag">${ICO.medal}${tr('Достижения')}</span>
        <button class="sclose" data-act="a-close" aria-label="${tr('Закрыть')}">✕</button>
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

  /* ---------- База знаний: герои, противники, карты и талисманы, которые уже встречались в игре ---------- */
  // перенести в базу знаний то, что игрок видел до её появления (по наборам достижений)
  function codexSeed() {
    const s = (k) => ACH.s[k] || [];
    const add = (kind, id) => { const set = ACH.s[CX_SET[kind]] || (ACH.s[CX_SET[kind]] = []); if (!set.includes(id)) set.push(id); };
    s('played').filter((id) => CARDS[id]).forEach((id) => add('c', id));
    s('relics').filter((id) => RELICS[id]).forEach((id) => add('r', id));
    [...s('beaten'), ...s('bosses')].filter((id) => ENEMIES[id]).forEach((id) => add('e', id));
    s('darkbeaten').filter((h) => ENEMIES[`dk_${h}`]).forEach((h) => add('e', `dk_${h}`));
    [...s('met'), ...s('winsCls')].filter((h) => CLASSES[h]).forEach((h) => add('h', h));
    codexSync(true);
  }
  const CX_TABS = [['h', 'Герои'], ['e', 'Враги'], ['c', 'Карты'], ['r', 'Талисманы']];
  const ATT_FOE = { like: 'Любит', fear: 'Боится', hate: 'Не терпит' }; // как враг относится к герою
  const ATT_HERO = { like: 'Любят', fear: 'Боятся', hate: 'Не терпят' }; // какие враги так относятся к герою
  const MOVE_LABEL = {
    attack: 'приём::Атака', hits: 'приём::Серия ударов', leech: 'приём::Пьёт здоровье', block: 'приём::Защита', buff: 'приём::Усиление',
    debuff: 'приём::Слабость', curse: 'приём::Помехи', steal: 'приём::Кража монет', sap: 'приём::Сбивает ритм', snuff: 'приём::Гасит Огоньки',
    mist: 'приём::Туман', boom: 'приём::Взрыв', bury: 'приём::Заметает руку', frail: 'приём::Хрупкость', spikes: 'приём::Шипы', heal: 'приём::Лечение',
  };
  const CARD_RARITY = { start: 'Стартовая', common: 'Обычная', uncommon: 'Необычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная', token: 'Создаётся в бою', status: 'Помеха' };
  const MAIN_STAGES = window.Story.STORIES.sunset.stages;
  const stageFoes = (g) => CODEX.e.filter((id) => [...g.normals, ...g.early, ...g.elites, ...g.boss].includes(id));
  const cxName = (kind, id) => (kind === 'h' ? CLASSES[id].name : kind === 'e' ? ENEMIES[id].name : kind === 'c' ? CARDS[id].name : RELICS[id].name);
  const cxBack = () => `<button class="cxback" data-act="x-back">‹ ${tr('Назад')}</button>`;
  const cxGroup = (title, html) => `<h4 class="cxgroup">${title}</h4><div class="cxgrid">${html}</div>`;

  function cxTile(kind, id) {
    const on = cxHas(kind, id);
    if (kind === 'c') return `<button class="cxtile t-c ${on ? '' : 'locked'}" data-cx="${id}">${on ? cardHTML(id, 'mini') : '<div class="card mini cxcardback"><b>?</b></div>'}</button>`;
    const pic = kind === 'h' ? `<span class="cxpic hero">${heroFace(id)}</span>`
      : kind === 'e' ? `<span class="cxpic foe f-${ENEMIES[id].tier}">${Art.enemy(id)}</span>`
        : `<span class="cxpic relic rt-${RELICS[id].tier}">${Art.relic(id)}</span>`;
    return `<button class="cxtile t-${kind} ${on ? '' : 'locked'}" data-cx="${id}">${pic}<span class="cxname">${on ? cxName(kind, id) : '???'}</span></button>`;
  }
  function cxGrid(kind) {
    const tiles = (ids) => ids.map((id) => cxTile(kind, id)).join('');
    if (kind === 'h') return `<div class="cxgrid">${tiles(CODEX.h)}</div>`;
    if (kind === 'e') {
      return MAIN_STAGES.map((g) => cxGroup(g.name, tiles(stageFoes(g)))).join('')
        + cxGroup(tr('Мрачные герои'), tiles(CODEX.e.filter((id) => ENEMIES[id].dark)));
    }
    if (kind === 'c') {
      const common = CODEX.c.filter((id) => !CARDS[id].cls && CARDS[id].rarity !== 'status');
      return cxGroup(tr('Общие карты'), tiles(common))
        + CODEX.h.map((h) => cxGroup(CLASSES[h].name, tiles(CODEX.c.filter((id) => CARDS[id].cls === h)))).join('')
        + cxGroup(tr('Помехи'), tiles(CODEX.c.filter((id) => CARDS[id].rarity === 'status')));
    }
    const owner = (id) => RELICS[id].cls || CODEX.classRelic(id);
    return cxGroup(tr('Талисманы'), tiles(CODEX.r.filter((id) => !owner(id) && RELICS[id].tier !== 'boss')))
      + cxGroup(tr('Трофеи боссов'), tiles(CODEX.r.filter((id) => RELICS[id].tier === 'boss')))
      + CODEX.h.map((h) => cxGroup(CLASSES[h].name, tiles([CLASSES[h].relic, ...CODEX.r.filter((id) => RELICS[id].cls === h)]))).join('');
  }
  // строка-связь: картинка, имя и текст; если второго ещё не встречали — силуэт и подсказка
  function cxRow(kind, id, text, label = '') {
    const on = cxHas(kind, id);
    const pic = kind === 'h' ? heroFace(id) : Art.enemy(id);
    return `<div class="cxrow ${on ? '' : 'locked'}"><span class="cxmini ${kind === 'h' ? 'hero' : 'foe'}">${pic}</span>
      <p><b>${on ? cxName(kind, id) : '???'}${label ? ` <em>${label}</em>` : ''}</b>${on ? text : tr(kind === 'h' ? 'Встреть этого героя, чтобы узнать больше' : 'Встреть этого врага, чтобы узнать больше')}</p></div>`;
  }
  function cxHero(h) {
    const c = CLASSES[h]; const bio = LORE.BIO[h];
    const known = (ACH.s.secrets || []).includes(h);
    const att = ['like', 'fear', 'hate'].map((k) => {
      const ids = CODEX.e.filter((id) => (LORE.ATT[id] || {})[k] === h);
      return ids.length ? `<p class="cxatt a-${k}"><b>${tr(ATT_HERO[k])}:</b> ${ids.map((id) => (cxHas('e', id) ? ENEMIES[id].name : '???')).join(', ')}</p>` : '';
    }).join('');
    const dk = `dk_${h}`;
    return `${cxBack()}
      <div class="cxhead"><span class="cxport hero">${heroFace(h)}</span><div><h3>${c.name}</h3><p class="cxsub">${c.role} · ${c.build}</p><p>${c.about}</p></div></div>
      <h4>${tr('О герое')}</h4><p>${tr(bio.who)}</p>
      <h4>${tr('Зачем в пути')}</h4><p>${tr(bio.why)}</p>
      <h4>${tr('Тайна')}</h4><p>${known ? tr(bio.secret) : `<i class="cxlock">${tr('Откроется после тайного разговора за этого героя')}</i>`}</p>
      <h4>${tr('Связи с героями')}</h4>${CODEX.h.filter((o) => o !== h).map((o) => cxRow('h', o, tr(LORE.PAIRS[LORE.pairKey(h, o)]))).join('')}
      ${att ? `<h4>${tr('Отношение врагов')}</h4>${att}` : ''}
      <h4>${tr('Друг в финале')}</h4><p>${tr(LORE.FRIEND[h].bonus)}</p>
      ${cxHas('e', dk) ? `<h4>${tr('Мрачная версия')}</h4>${cxRow('e', dk, quote(LORE.DARK[h].intro))}` : ''}`;
  }
  function cxFoe(id) {
    const e = ENEMIES[id];
    const final = e.dark || MAIN_STAGES[MAIN_STAGES.length - 1].boss.includes(id);
    const stage = MAIN_STAGES.find((g) => stageFoes(g).includes(id));
    const tierName = tr(final ? 'Финал' : e.tier === 'boss' ? 'Босс' : e.tier === 'elite' ? 'Элита' : 'Противник');
    const moves = [];
    e.pattern.forEach((p) => [p, p.then].filter(Boolean).forEach((it) => {
      const k = it.k === 'attack' ? (it.leech ? 'leech' : it.hits ? 'hits' : 'attack') : it.k;
      if (MOVE_LABEL[k] && !moves.includes(k)) moves.push(k);
    }));
    const traits = [
      e.thorns && tr('Каждый ваш удар по врагу ранит вас на {n}', { n: e.thorns }),
      e.nest && tr('Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: {n}.', { n: e.nest }),
      e.boil && tr('Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После его хода кипяток остывает. Поджог его не злит.'),
      e.tally && tr('Каждая {n}-я карта за ход: кукушка кукует и бьёт вас на 3.', { n: e.tally }),
      e.plating && tr('Защита Ледяного Рыцаря не сгорает: она копится от хода к ходу. Поджог бьёт прямо по HP.'),
      e.alarm && tr('Каждый ваш Навык даёт сторожу {n} защиты до конца вашего хода. Бейте до хитростей.', { n: e.alarm }),
    ].filter(Boolean);
    const att = ['like', 'fear', 'hate'].map((k) => { const h = (LORE.ATT[id] || {})[k]; return h ? `<p class="cxatt a-${k}"><b>${tr(ATT_FOE[k])}:</b> ${cxHas('h', h) ? CLASSES[h].name : '???'}</p>` : ''; }).join('');
    const ties = LORE.ETIES.filter(([a, b]) => a === id || b === id)
      .map(([a, b, k, text]) => cxRow('e', a === id ? b : a, tr(text), tr(k === 'kin' ? 'Свои' : 'Соперники'))).join('');
    const said = SAY[id] && (Array.isArray(SAY[id].start) ? SAY[id].start[0] : SAY[id].start);
    return `${cxBack()}
      <div class="cxhead"><span class="cxport foe f-${e.tier}">${Art.enemy(id)}</span><div><h3>${e.name}</h3><p class="cxsub">${tierName}${stage && !e.dark ? ` · ${stage.name}` : ''}</p><p>${e.line}</p></div></div>
      <div class="cxstats"><span>${e.hp} HP</span><span>${tr('Побед над этим врагом: {n}', { n: ACH.k[id] || 0 })}</span></div>
      ${said ? `<p class="cxquote">${quote(said)}</p>` : ''}
      <h4>${tr('Приёмы')}</h4><div class="cxmoves">${moves.map((k) => `<span>${Art.intentIcon(k === 'hits' ? 'attack' : k)}${tr(MOVE_LABEL[k])}</span>`).join('')}</div>
      ${traits.length ? `<h4>${tr('Особенности')}</h4>${traits.map((t) => `<p>${t}</p>`).join('')}` : ''}
      ${att ? `<h4>${tr('Отношение к героям')}</h4>${att}` : ''}
      ${ties ? `<h4>${tr('Связи с врагами')}</h4>${ties}` : ''}`;
  }
  function cxCard(id) {
    const c = CARDS[id];
    const up = c.rarity !== 'status';
    const from = CODEX.e.filter((eid) => ENEMIES[eid].pattern.some((p) => [p, p.then].some((it) => it && it.k === 'curse' && it.card === id)));
    const info = [tr(CARD_RARITY[c.rarity] || 'Обычная'), c.cls && tr('Карта героя: {name}', { name: CLASSES[c.cls].name })].filter(Boolean).join(' · ');
    return `${cxBack()}
      <div class="cxcards">${cardHTML(id)}${up ? cardHTML({ id, up: true }) : ''}</div>
      ${up ? `<p class="cxsub center">${tr('Слева обычная, справа улучшенная')}</p>` : ''}
      <p class="center">${info}</p>
      ${from.length ? `<p class="center">${tr('Подкидывают: {list}', { list: from.map((x) => (cxHas('e', x) ? ENEMIES[x].name : '???')).join(', ') })}</p>` : ''}`;
  }
  function cxRelic(id) {
    const r = RELICS[id]; const owner = r.cls || CODEX.classRelic(id);
    return `${cxBack()}
      <div class="cxhead"><span class="cxport relic rt-${r.tier}">${Art.relic(id)}</span><div><h3>${r.name}</h3><p class="cxsub">${TIER_LABEL[r.tier]}${owner ? ` · ${CLASSES[owner].name}` : ''}</p><p>${r.desc}</p></div></div>`;
  }
  function showCodex(back) {
    let tab = 'h'; let open = null; let keep = 0;
    const got = codexCount();
    const close = () => { if (back) back(); else { hideOverlay(); if (screen.className === 'scr-title') goTitle(); } };
    showOverlay(`<div class="achp cxp">
      <div class="achhead">
        <span class="achtag">${ICO.book}${tr('База знаний')}</span>
        <button class="sclose" data-act="x-close" aria-label="${tr('Закрыть')}">✕</button>
        <div class="achbar"><i style="width:${(got / codexTotal) * 100}%"></i><b>${got}/${codexTotal}</b></div>
      </div>
      <div class="achlist cxlist"></div>
      <div class="achtabs">${CX_TABS.map(([k, name]) => `<button data-tab="${k}"><span>${tr(name)}</span><small>${CODEX[k].filter((id) => cxHas(k, id)).length}/${CODEX[k].length}</small></button>`).join('')}</div>
    </div>`, (e) => {
      const b = e.target.closest('[data-act], [data-tab], [data-cx]');
      if (!b) return;
      const list = overlay.querySelector('.cxlist');
      if (b.dataset.tab) { tab = b.dataset.tab; open = null; render(0); return; }
      if (b.dataset.cx) {
        if (b.classList.contains('locked')) { toast(tr('Ещё не встречалось в игре')); return; }
        keep = list.scrollTop; open = b.dataset.cx; render(0); return;
      }
      if (b.dataset.act === 'x-back') { open = null; render(keep); return; }
      if (b.dataset.act === 'x-close') close();
    });
    const render = (top) => {
      const list = overlay.querySelector('.cxlist');
      const view = { h: cxHero, e: cxFoe, c: cxCard, r: cxRelic };
      list.innerHTML = open ? `<div class="cxdetail">${view[tab](open)}</div>` : cxGrid(tab);
      list.scrollTop = top;
      overlay.querySelectorAll('.achtabs button').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    };
    render(0);
  }

  /* Статистика: общие итоги и рекорды, а во второй вкладке — прошлые забеги с подробными итогами */
  function showStats(back) {
    let tab = 'sum';
    let open = -1;
    const close = () => { if (back) back(); else { hideOverlay(); if (screen.className === 'scr-title') goTitle(); } };
    const list = RUNS.list;
    const best = (k) => list.reduce((m, r) => Math.max(m, r[k] || 0), 0);
    const totals = () => {
      const rows = [
        ['Забегов начато', fmt(STATS.runs)], ['Писем доставлено', fmt(STATS.wins)], ['Поражений', fmt(STATS.losses)],
        ['Лучший уровень', STATS.best ? tr('{a} из {b}', { a: STATS.best, b: MAX_STEPS }) : '—'], ['Побед в боях', fmt(STATS.fights)],
        ['Побеждено элит', fmt(STATS.elites)], ['Побеждено боссов', fmt(STATS.bosses)], ['Сыграно карт', fmt(STATS.cards)],
        ['Урон врагам', fmt(STATS.dmg || 0)], ['Монет собрано', fmt(STATS.gold || 0)], ['Время в пути', STATS.ms ? fmtTime(STATS.ms) : '—'],
      ];
      const recs = [
        ['Самая быстрая доставка', STATS.fast ? fmtTime(STATS.fast) : '—'],
        ['Сильнейший удар', fmt(Math.max(ACH.c.maxhit || 0, best('hit')))],
        ['Больше всего урона за забег', fmt(Math.max(STATS.runDmg || 0, best('dmg')))],
        ['Больше всего побед за забег', fmt(best('fights'))],
      ];
      const dl = (r) => `<dl class="statlist">${r.map(([k, v]) => `<dt>${tr(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
      return `<h4 class="cxgroup">${tr('Всего')}</h4>${dl(rows)}<h4 class="cxgroup">${tr('Рекорды')}</h4>${dl(recs)}`;
    };
    const runRow = (r, i) => {
      const cls = CLASSES[r.cls] ? r.cls : 'lamp';
      const d = DIFFICULTIES[r.diff] || DIFFICULTIES[1];
      return `<button class="runrow ${r.win ? 'win' : 'lose'}" data-run="${i}" style="--d:${Math.min(i, 8) * 40}ms">
        <span class="runface">${heroFace(cls)}</span>
        <span class="runtext"><b>${CLASSES[cls].name}</b><small>${d.name}</small><small>${tr('Уровень {a} из {b}', { a: r.lvl, b: MAX_STEPS })} · ${fmtTime(r.ms)}</small></span>
        <span class="runres"><em>${r.win ? tr('Доставлено') : tr('Поражение')}</em><small>${fmtDate(r.at)}</small></span>
      </button>`;
    };
    const runs = () => (open >= 0 && list[open]
      ? `<button class="cxback" data-act="st-back">← ${tr('Все забеги')}</button>${summaryHTML(list[open])}`
      : list.length ? list.map(runRow).join('') : `<p class="stempty">${tr('Здесь появятся итоги законченных забегов.')}</p>`);
    showOverlay(`<div class="achp statp">
      <div class="achhead">
        <span class="achtag">${ICO.stats}${tr('Статистика')}</span>
        <button class="sclose" data-act="st-close" aria-label="${tr('Закрыть')}">✕</button>
      </div>
      <div class="achlist"></div>
      <div class="achtabs">
        <button data-tab="sum"><span>${tr('Итоги')}</span><small>${tr('всё время')}</small></button>
        <button data-tab="runs"><span>${tr('Забеги')}</span><small>${tr('последние {n}', { n: list.length })}</small></button>
      </div>
    </div>`, (e) => {
      const b = e.target.closest('[data-act], [data-tab], [data-run]');
      if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; open = -1; render(); return; }
      if (b.dataset.run) { open = +b.dataset.run; render(); return; }
      if (b.dataset.act === 'st-back') { open = -1; render(); return; }
      if (b.dataset.act === 'st-close') close();
    });
    const render = () => {
      const el = overlay.querySelector('.achlist');
      el.innerHTML = tab === 'sum' ? totals() : runs();
      el.scrollTop = 0;
      overlay.querySelectorAll('.achtabs button').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    };
    render();
  }

  function askReset() {
    showOverlay(`<div class="pause"><h2>${tr('Сбросить прогресс?')}</h2>
      <p class="ovhint">${tr('Сохранённый забег, статистика и достижения будут удалены. Настройки и покупки останутся.')}</p>
      <button class="btn" data-act="r-yes">${tr('Сбросить')}</button>
      <button class="btn ghost" data-act="r-no">${tr('Отмена')}</button></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'r-no') { showSettings(); return; }
      clearSave();
      Object.assign(ACH, { c: {}, s: {}, got: {}, seenAt: 0, k: {} });
      Object.keys(STATS).forEach((k) => { if (!(k in STATS_DEF)) delete STATS[k]; });
      Object.assign(STATS, STATS_DEF); saveStats();
      RUNS.list = []; saveJSON(RUNS_KEY, RUNS);
      hideOverlay();
      toast(tr('Прогресс сброшен'));
      goTitle();
    });
  }

  /* ---------- Магазин: платные герои и режим без рекламы (js/store.js) ---------- */
  const adTag = () => (Store.noAds() ? `<i class="adtag free">${tr('Бонус')}</i>` : `<i class="adtag">${ICO.ad}${tr('Реклама')}</i>`);
  let storeBackCls = null; // какой герой был выбран, если в магазин пришли с экрана героя
  function goStore(back = 'title') {
    C = null; busy = false; setBg(0.45);
    if (back === 'cls' && screen.className === 'scr-class') storeBackCls = [screen.dataset.cls, +screen.dataset.diff];
    hideOverlay();
    screen.className = 'scr-store';
    screen.dataset.back = back;
    const P = Store.PRODUCTS;
    const allHeroes = Store.paidHeroes.every((id) => Store.heroOwned(id));
    const owned = `<span class="owned">${tr('Куплено')} ✓</span>`;
    const priceBtn = (id, label) => (Store.owns(id) ? owned
      : `<button class="btn price" data-act="sbuy" data-p="${id}">${label || P[id].price}</button>`);
    screen.innerHTML = `
      <div class="clshead"><h2>${tr('Магазин')}</h2><p>${tr('Поддержите почту Медовой Горки')}</p></div>
      <div class="storelist">
        ${Store.paidHeroes.map((id) => { const h = CLASSES[id]; return `<div class="sitem">
          <span class="cp ${id}">${heroFace(id)}</span>
          <span class="stext"><b>${h.name}<small>${h.role}</small></b><em>${h.build}</em><small>${RELICS[h.relic].desc}</small></span>
          ${Store.heroOwned(id) ? owned : `<button class="btn price" data-act="sbuy" data-p="hero_${id}">${P[`hero_${id}`].price}</button>`}</div>`; }).join('')}
        <div class="sitem pack ${allHeroes ? 'done' : ''}">
          <span class="sico">${Store.paidHeroes.map((id) => `<i class="cp ${id}">${heroFace(id)}</i>`).join('')}</span>
          <span class="stext"><b>${tr('Все три героя')}</b><small>${tr('Выгоднее, чем по одному')}</small></span>
          ${allHeroes ? owned : priceBtn('heroes')}</div>
        <div class="sitem noads">
          <span class="sico big">${ICO.ad}</span>
          <span class="stext"><b>${tr('Без рекламы')}</b><small>${tr('Бонусы событий и возрождение после поражения сразу, без роликов')}</small></span>
          ${priceBtn('noads')}</div>
      </div>
      <p class="storenote">${tr('Тестовая версия: покупки не настоящие, деньги не списываются.')}</p>
      <div class="clsbtns"><button class="btn ghost" data-act="sback">${tr('Назад')}</button><button class="btn ghost" data-act="srestore">${tr('Восстановить покупки')}</button></div>
      <button class="sreset" data-act="sreset">${tr('Сбросить тестовые покупки')}</button>`;
  }
  async function storeBuy(id, after) {
    SND.sfx('click');
    const ok = await Store.buy(id);
    if (ok) { SND.sfx('relic'); toast(tr('Куплено: {name}', { name: Store.PRODUCTS[id].name })); }
    after();
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
      <div class="clshead"><h2>${tr('Кто понесёт письмо?')}</h2><p>${tr('У каждого героя свой путь к победе')}</p></div>
      <div class="clsrow">${Object.entries(CLASSES).map(([id, c]) => `<button class="clscard ${id === sel ? 'on' : ''} ${Store.heroOwned(id) ? '' : 'locked'}" data-act="pickcls" data-cls="${id}">
        <span class="cp ${id}">${heroFace(id)}${Store.heroOwned(id) ? '' : `<i class="lockico">${ICO.lock}</i>`}</span><b>${c.name}</b><small>${c.role}</small></button>`).join('')}</div>
      <div class="clsinfo">
        <div class="clsbig ${sel}">${heroArt(sel)}</div>
        <div class="clstext">
          <h3>${h.name}<small>${h.role}</small></h3>
          <div class="clsstats"><span>${Art.icon('heart')}${h.hp} HP</span><span>${Art.icon('coin')}${h.gold}</span></div>
          <p class="clsbuild">${h.build}</p>
          <p class="clsabout">${h.about}</p>
        </div>
      </div>
      <div class="clsrelic">${Art.relic(h.relic)}<span><small>${tr('Особенность')}</small><b>${r.name}</b>${r.desc}</span></div>
      <button class="clscards" data-act="clscards"><span class="mini3">${own.slice(0, 4).map((k) => Art.card(k)).join('')}</span><span><b>${tr('Карты героя')}</b><small>${own.map((k) => CARDS[k].name).join(', ')}</small></span><i>›</i></button>
      <div class="diffbox">
        <div class="diffhead"><button class="darrow" data-act="diffset" data-d="${Math.max(0, diff - 1)}" ${diff ? '' : 'disabled'}>‹</button>
          <span><small>${tr('Сложность {a} из {b}', { a: diff + 1, b: DIFFICULTIES.length })}</small><b>${d.name}${won.includes(diff) ? ' <i class="dwon">✓</i>' : ''}</b></span>
          <button class="darrow" data-act="diffset" data-d="${Math.min(DIFFICULTIES.length - 1, diff + 1)}" ${diff < DIFFICULTIES.length - 1 ? '' : 'disabled'}>›</button></div>
        <div class="dpips">${DIFFICULTIES.map((x, i) => `<button class="dpip d${i} ${i <= diff ? 'on' : ''} ${won.includes(i) ? 'won' : ''}" data-act="diffset" data-d="${i}" aria-label="${x.name}"></button>`).join('')}</div>
        <p class="diffhint">${d.hint}</p>
      </div>
      ${Store.heroOwned(sel) ? `<div class="clsbtns"><button class="btn ghost" data-act="title">${tr('Назад')}</button><button class="btn big" data-act="clsgo">${tr('В путь')}</button></div>`
        : `<div class="clsbtns locked"><button class="btn ghost" data-act="title">${tr('Назад')}</button><button class="btn big buyhero" data-act="sbuy" data-p="hero_${sel}">${ICO.lock}<span>${tr('герой::Открыть')}<small>${Store.PRODUCTS[`hero_${sel}`].price}</small></span></button><button class="btn ghost" data-act="store" data-back="cls">${tr('Магазин')}</button></div>`}`;
  }
  // стартовая колода и собственные карты героя
  function showClassCards(id) {
    const h = CLASSES[id];
    const start = h.deck.map((k) => mk(k));
    showOverlay(`<h2>${h.name} · ${h.role}</h2>
      <p class="ovhint">${tr('Свои карты: выпадают в наградах и лавке только этому герою')}</p>
      <div class="grid">${heroCards(id).map((k) => cardHTML(k, 'mini')).join('')}</div>
      <p class="ovhint">${tr('Особенность и свой талисман: он выпадает только этому герою')}</p>
      <div class="rlist">${[h.relic, ...Object.keys(RELICS).filter((r) => RELICS[r].cls === id)].map((r) => `<div class="rrow ${RELICS[r].tier}">${Art.relic(r)}<span><b>${RELICS[r].name}<em class="rtier ${RELICS[r].tier}">${r === h.relic ? tr('Особенность') : TIER_LABEL[RELICS[r].tier]}</em></b><small>${RELICS[r].desc}</small></span></div>`).join('')}</div>
      <p class="ovhint">${tr('Стартовая колода')} · ${start.length}</p>
      <div class="grid">${start.map((c) => cardHTML(c, 'mini')).join('')}</div>
      <button class="btn" data-act="close">${tr('Закрыть')}</button>`, (e) => { if (e.target.closest('[data-act="close"]')) hideOverlay(); });
  }

  /* Иллюстрации книги и событий. На многих нарисована Ива, поэтому другим героям
     достаются только картинки без неё, а вместо остальных остаётся сам герой */
  const NO_IVA = ['ending_hollowpost', 'ev_coins', 'ev_lantern', 'ev_puppet', 'ev_smith', 'ev_snowman'];
  const picFits = (key) => !!(Art.hasPic && Art.hasPic(key) && (hero().look === 'lamp' || NO_IVA.includes(key)));
  function bookArt(key, cls = '') {
    return picFits(key) ? `<div class="book-art pic">${Art.storyPic(key)}</div>` : `<div class="book-art ${cls}">${heroArt()}</div>`;
  }
  const EV_PIC = { well: 'ev_well', puppet: 'ev_puppet', lantern: 'ev_lantern', snowman: 'ev_snowman', coin: 'ev_coins', whetstone: 'ev_smith', stampbook: 'ev_postoffice', frostglass: 'ev_icemirror', showbooth: 'ev_showbooth' };
  const evArt = (ev) => (picFits(EV_PIC[ev.art]) ? `<div class="ev-pic-wrap">${Art.storyPic(EV_PIC[ev.art])}</div>` : `<div class="ev-art">${Art.icon(ev.art)}</div>`);

  /* ---------- Вступление перед новым забегом ---------- */
  function goIntro() {
    run = null; C = null; setBg();
    screen.className = 'scr-intro';
    screen.innerHTML = `
      <div class="book">
        <div class="page">
          ${bookArt('story_intro')}
          <h1${STORY.title.length > 14 ? ' class="long"' : ''}>${STORY.title}</h1>
          <p class="story">${txt(STORY.intro)}</p>
          <ul class="howto">
            <li>${tr('<b>Огонёк.</b> Каждый даёт атакам +{b} урона. На {m} Огоньках лампа бьёт врага на {d}.', { b: FLAME_BONUS, m: FLAME_MAX, d: BURST_DMG })}</li>
            <li>${tr('<b>Меню</b> в углу: пауза, справочник и выход. Прогресс сохраняется сам.')}</li>
            <li>${STORY.pathRule(MAX_STEPS)}</li>
          </ul>
        </div>
      </div>
      <button class="btn big" data-act="start">${tr('В путь')}</button>`;
    fitBook();
  }

  /* Текст на другом языке бывает длиннее: если книжка с кнопками не помещается на экран,
     картинка в ней становится ниже (но не меньше 110px) */
  function fitBook() {
    const art = screen.querySelector('.book-art');
    if (!art) return;
    art.style.height = '';
    const over = screen.scrollHeight - screen.clientHeight;
    if (over > 0) art.style.height = `${Math.max(110, art.offsetHeight - over - 8)}px`;
  }

  /* ---------- Путь: выбор из трёх карт-встреч ---------- */
  function genChoices() {
    const s = run.step;
    const si = stageOf(s);
    const g = STAGES[si];
    // перед финальным боссом обязательно лавка, потом костёр (run.finalPrep: shop → rest → done)
    if (isFinalStep(s)) {
      const fp = run.finalPrep || 'shop';
      if (fp === 'shop') return [{ t: 'shop', last: true }];
      if (fp === 'rest') return [{ t: 'rest', last: true }];
      return [{ t: 'boss', enemy: finalBoss() }];
    }
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
    // встреча с другим героем занимает место события, лавки или привала (если их нет — последнего боя)
    const mh = run.meetPlan && run.meetPlan[s];
    if (mh && !(run.met || []).includes(mh)) {
      let i = pool.findIndex((p) => p.t !== 'fight' && p.t !== 'elite');
      if (i < 0) i = pool.length - 1;
      pool[i] = { t: 'meet', hero: mh };
    }
    return done(pool);
  }

  /* Встречи с другими героями (js/lore.js): по две на стадию, на случайных уровнях,
     но не в начале стадии и не на развилке перед боссом. Себя герой не встречает. */
  function planMeetings(cls) {
    const plan = {};
    if (STAGES.length < 3) return plan; // только в основном сюжете
    [0, 1].forEach((si) => {
      const g = STAGES[si];
      const heroes = shuffle(Object.keys(LORE.MEET).filter((h) => h !== cls && LORE.MEET[h].stage === si)).slice(0, 2);
      const part = Math.floor((g.len - 6) / 2);
      heroes.forEach((h, i) => { const a = g.start + 3 + i * part; plan[rnd(a, a + part - 2)] = h; });
    });
    return plan;
  }

  /* Финальный босс зависит от пути (подробно — в js/lore.js и документе с лором):
     обиженный герой выходит мрачной версией себя; кто дважды прошёл мимо чужой беды,
     встретит Пустого Почтальона; кто чаще решал миром, чем злил, — Ночного Кита; иначе — Король Теней */
  function finalBoss() {
    if (run.final) return run.final;
    let id = run.bosses[STAGES.length - 1];
    if (STAGES.length > 2) {
      const fallen = (run.fallen || []).filter((h) => h !== run.cls && ENEMIES[`dk_${h}`]);
      const t = run.tone || {};
      if (fallen.length) id = `dk_${fallen[fallen.length - 1]}`;
      else if ((t.pass || 0) >= 2) id = 'hollowpost';
      else if ((t.peace || 0) >= 3 && t.peace > (t.anger || 0)) id = 'skywhale';
      else id = 'shadowking';
    }
    run.final = id;
    return id;
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
      tag = tr(o.t === 'boss' ? (isFinalStep(run.step) ? 'Финальный босс' : 'Босс стадии') : o.t === 'elite' ? 'Элита' : 'Бой');
    } else if (o.t === 'event') {
      const ev = EVENTS.find((e) => e.id === o.ev);
      title = ev.title; art = Art.icon(ev.art); text = tr('Что-то происходит впереди…'); tag = tr('Событие');
    } else if (o.t === 'meet') {
      const h = CLASSES[o.hero];
      title = tr(LORE.MEET[o.hero].title); art = `<div class="enc-char">${heroArt(o.hero)}</div>`; text = h.who.charAt(0).toUpperCase() + h.who.slice(1); tag = tr('Встреча');
    } else if (o.t === 'shop') {
      title = tr(o.last ? 'Лавка у последней двери' : 'Лавка Игольника'); art = `<div class="enc-char">${Art.enemy('hedgehog')}</div>`;
      text = tr(o.last ? 'Ёж Игольник догнал тебя со своим прилавком.' : 'Ёж торгует всем, что нашёл в сугробах.'); tag = tr('Лавка');
    } else if (o.t === 'chest') {
      title = tr('Сундук-соня'); art = Art.icon('chest'); text = tr('Сундук храпит. Внутри что-то звенит.'); tag = tr('Сундук');
    } else if (o.t === 'rest') {
      title = tr(o.last ? 'Последний костёр' : 'Костёр'); art = Art.icon('fire');
      text = tr(o.last ? 'Последний привал перед дверью адресата.' : 'Тёплый огонь. Можно передохнуть.'); tag = tr('Привал');
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
    run.fmod = null; // уговоры и дразнилки из разговора действуют только на один бой
    setBg();
    SND.music(mapTrack());
    if (!run.choices) run.choices = genChoices();
    save();
    snapStep = JSON.stringify(run); // для возрождения «до боя»
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
    if (run.step === 0) return tr('Выбери, куда идти');
    return tr('Уровень {n}', { n: run.step + 1 });
  }

  function chooseEncounter(i) {
    const o = run.choices[i];
    run.choices = null;
    save(o);
    if (o.t === 'fight' || o.t === 'elite' || o.t === 'boss') { if (!preFight(o)) startCombat(o.enemy, o.t); }
    else if (o.t === 'meet') goMeet(o.hero);
    else if (o.t === 'event') goEvent(EVENTS.find((e) => e.id === o.ev));
    else if (o.t === 'shop') goShop();
    else if (o.t === 'chest') goChest();
    else if (o.t === 'rest') goRest();
  }

  function advance() {
    // на последнем уровне сначала лавка, потом костёр, и только потом финальный босс
    if (isFinalStep(run.step) && run.finalPrep !== 'done') {
      run.finalPrep = (run.finalPrep || 'shop') === 'shop' ? 'rest' : 'done';
      run.choices = null;
      SND.sfx('step'); goMap();
      return;
    }
    run.step++; STATS.best = Math.max(STATS.best, run.step + 1); saveStats();
    ach.add('steps'); ach.max('maxgold', run.gold); ach.max('maxhp', run.maxHp);
    SND.sfx('step'); goMap();
  }

  /* ---------- API для событий ---------- */
  const evApi = {
    heal: (n) => { const b = run.hp; run.hp = Math.min(run.maxHp, run.hp + n); stAdd('healed', run.hp - b); },
    damage: (n) => { const b = run.hp; run.hp = Math.max(1, run.hp - n); stAdd('taken', b - run.hp); },
    giveCard: (id) => run.deck.push(mk(id)),
    giveRandomCard: (rarity) => { const id = pickCard(rarity); run.deck.push(mk(id)); toast(tr('Новая карта: {name}', { name: CARDS[id].name })); return id; },
    giveRelic: () => {
      const free = freeRelics();
      if (!free.length) { gain(40); toast(coins(40)); return; }
      addRelic(pickRelic(free));
    },
    removeCardPrompt: () => removeCardFlow(() => advance()),
    upgradePrompt: () => upgradeFlow(() => advance()),
    upgradeRandom: (n) => upgradeRandom(n),
    duplicatePrompt: () => {
      showDeck(run.deck.filter((c) => CARDS[c.id].rarity !== 'status'), tr('Выбери карту для копии'), (uid) => {
        hideOverlay();
        const c = uid != null && run.deck.find((d) => d.uid === uid);
        if (c) { run.deck.push(mk(c.id, c.up)); SND.sfx('card'); toast(tr('Копия: {name}', { name: cardName(c) })); }
        advance();
      });
    },
    transformPrompt: () => {
      showDeck(run.deck, tr('Какую карту отдать?'), (uid) => {
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
  const RELIC_WEIGHT = { common: 55, uncommon: 30, rare: 15, epic: 6, legendary: 2 };
  const freeRelics = () => Object.keys(RELICS).filter((r) => RELIC_WEIGHT[RELICS[r].tier] && !hasRelic(r) && (!RELICS[r].cls || RELICS[r].cls === run.cls));
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
    codexMark('r', id);
    ach.put('relics', id);
    if (RELICS[id].tier === 'boss') ach.put('trophies', id);
    if (RELICS[id].tier === 'legendary') ach.flag('legendrelic');
    if (id === 'jar') { run.maxHp += 8; run.hp += 8; }
    if (id === 'moonstone') { run.maxHp -= 8; run.hp = Math.min(run.hp, run.maxHp); }
    if (id === 'whetstone') upgradeRandom(2, true);
    if (id === 'goldquill') { const list = run.deck.filter(canUpgrade); list.forEach((c) => { c.up = true; }); achUpgraded(list.length); }
    SND.sfx('relic');
    toast(tr('Талисман: {name}', { name: RELICS[id].name }));
  }

  // счётчик улучшений и число улучшенных карт в колоде — для достижений
  function achUpgraded(n) { ach.add('upgrades', n); ach.max('updeck', run.deck.filter((c) => c.up).length); }

  function upgradeRandom(n, quiet) {
    const list = shuffle(run.deck.filter(canUpgrade)).slice(0, n);
    list.forEach((c) => { c.up = true; });
    achUpgraded(list.length);
    if (list.length && !quiet) toast(tr('Улучшены: {list}', { list: list.map(cardName).join(', ') }));
    return list.length;
  }

  function upgradeFlow(done) {
    const list = run.deck.filter(canUpgrade);
    if (!list.length) { toast(tr('Все карты уже улучшены')); done(false); return; }
    showDeck(list, tr('Выбери карту для улучшения'), (uid) => {
      hideOverlay();
      const c = uid != null && run.deck.find((d) => d.uid === uid);
      if (c) { c.up = true; achUpgraded(1); SND.sfx('relic'); toast(tr('Улучшена: {name}', { name: cardName(c) })); }
      done(!!c);
    }, 'up');
  }

  function removeCardFlow(done) {
    showDeck(run.deck, tr('Выбери карту, которую убрать'), (uid) => {
      hideOverlay();
      if (uid != null) { const c = run.deck.find((d) => d.uid === uid); run.deck = run.deck.filter((d) => d.uid !== uid); toast(tr('Убрана: {name}', { name: cardName(c) })); }
      done(uid != null);
    });
  }

  /* ---------- Событие ---------- */
  function goEvent(ev) {
    setBg();
    screen.className = 'scr-event';
    screen.innerHTML = `${topBar()}
      ${evArt(ev)}
      <div class="ev-box"><h2>${ev.title}</h2><p>${ev.text}</p></div>
      <div class="scrolls">${ev.options.map((o, i) => {
        const ok = !o.can || o.can(run);
        return `<button class="scroll ${ok ? '' : 'off'} ${o.ad ? 'adopt' : ''}" data-act="evopt" data-i="${i}" ${ok ? '' : 'disabled'}>${o.ad ? adTag() : ''}${o.text}<small>${o.hint}</small></button>`;
      }).join('')}</div>
      ${heroBar(false)}`;
    screen.dataset.ev = ev.id;
    ach.put('events', ev.id);
  }

  async function eventOption(i) {
    const ev = EVENTS.find((e) => e.id === screen.dataset.ev);
    // награда за рекламу: без рекламы (покупка) она выдаётся сразу
    if (ev.options[i].ad) {
      busy = true;
      const seen = await Store.ad(ev.options[i].hint);
      busy = false;
      if (!seen) { toast(tr('Реклама не досмотрена, награды нет')); return; }
      STATS.ads = (STATS.ads || 0) + 1; saveStats();
    }
    let fought = false;
    evApi.startFight = (id) => { fought = id; };
    const gold0 = run.gold;
    const mark = stMark();
    const res = tr(ev.options[i].act(run, evApi)); // итог события — русский текст, он же ключ перевода
    stGoldSince(mark);
    ach.add('spent', gold0 - run.gold);
    if (res === null) return; // опция сама ведёт дальше (например, удаление карты)
    if (fought) { save({ t: 'fight', enemy: fought }); toast(res); setTimeout(() => startCombat(fought, 'fight'), 600); return; }
    save({ t: 'next' });
    $('.scrolls').innerHTML = `<button class="scroll" data-act="next">${tr('Дальше')}</button>`;
    $('.ev-box p').textContent = res;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Разговоры, встречи и пощада (тексты и отношения — js/lore.js) ---------- */
  const SAY = LORE.SAY;
  const mainStory = () => STAGES.length > 2;
  // поля лора у старых сохранений
  function ensureLore() {
    run.rel = run.rel || {}; run.fallen = run.fallen || []; run.met = run.met || []; run.meetLog = run.meetLog || [];
    run.secrets = run.secrets || []; run.grudge = run.grudge || {}; run.tone = run.tone || { peace: 0, anger: 0, pass: 0 };
    run.meetPlan = run.meetPlan || {};
    run.killed = run.killed || []; run.kind = run.kind || [];
  }
  // отношение врага к герою забега: like / fear / hate; обида за «забрать всё» — grudge
  function attOf(id) {
    if (!mainStory()) return null;
    const a = LORE.ATT[id] || {};
    const k = ['like', 'fear', 'hate'].find((x) => a[x] === run.cls) || null;
    return k || (run.grudge && run.grudge[id] ? 'grudge' : null);
  }
  const secretOf = (id) => { const sc = LORE.SECRET[run.cls]; return sc && sc.enemy === id && !(run.secrets || []).includes(id) ? sc : null; };
  const lineOf = (id, key) => { const v = SAY[id] && SAY[id][key]; return Array.isArray(v) ? pick(v) : v || null; };
  const quote = (t) => tr('«{t}»', { t: tr(t) });
  const calmPrice = (tier) => (tier === 'boss' ? 40 : tier === 'elite' ? 25 : 15);
  const bribePrice = () => 12 + Math.floor(run.step / 2);
  // монеты за победу (без множителей разговора)
  const goldFor = (tier) => Math.round((tier === 'boss' ? rnd(50, 60) : tier === 'elite' ? rnd(30, 40) : rnd(12, 20)) * DIFF().gold * (hasRelic('luckystamp') ? 1.2 : 1)) + (hasRelic('envelope') ? 8 : 0);
  // друзья забега: герои, которым помогли, и те, кто вернулся из Тени
  const friendsOf = () => Object.keys(run.rel || {}).filter((h) => h !== run.cls && run.rel[h] >= 2 && !(run.fallen || []).includes(h) && LORE.FRIEND[h]);
  // связи врагов между собой (js/lore.js, ETIES): avenge — ты победил(а) его своих, thanks — пощадил(а) их,
  // rival — победил(а) его соперника
  function tieOf(id) {
    if (!mainStory() || !run.killed) return null;
    const ties = LORE.ETIES.filter(([a, b]) => a === id || b === id).map(([a, b, k, text]) => ({ other: a === id ? b : a, k, text }));
    const kin = ties.filter((t) => t.k === 'kin');
    let t = kin.find((x) => run.killed.includes(x.other));
    if (t) return { ...t, kind: 'avenge' };
    t = kin.find((x) => run.kind.includes(x.other));
    if (t) return { ...t, kind: 'thanks' };
    t = ties.find((x) => x.k === 'rival' && run.killed.includes(x.other));
    return t ? { ...t, kind: 'rival' } : null;
  }
  const beKind = (id) => { if (!run.kind.includes(id)) run.kind.push(id); };

  // заговорит ли враг до боя: тайна, финал и обида — всегда, отношение к герою — часто, остальные — изредка
  function preFight(o) {
    if (!mainStory() || !SAY[o.enemy]) return false;
    const att = attOf(o.enemy);
    const tie = tieOf(o.enemy);
    const show = (o.t === 'boss' && isFinalStep(run.step)) || secretOf(o.enemy)
      || (tie && (tie.kind !== 'rival' || Math.random() < 0.6))
      || (att && Math.random() < (o.t === 'boss' || att === 'grudge' ? 1 : 0.6))
      || (!att && o.t === 'fight' && Math.random() < 0.15);
    if (!show) return false;
    goTalk(o.enemy, o.t);
    return true;
  }

  function talkOptions(id, tier, att) {
    const e = ENEMIES[id];
    const tie = tieOf(id);
    const ops = [{ k: 'fight', text: 'В бой', hint: tr(tie && tie.kind === 'avenge' ? 'Сила врага +1' : tie && tie.kind === 'rival' ? 'Враг Ослаблен на 2 хода' : 'Обычный бой') }];
    if (tie && tie.kind === 'thanks') ops.push({ k: 'regards', text: 'Передать привет', hint: tr(tier === 'boss' ? 'Босс Ослаблен на 2 хода' : 'Без боя, монеты и +6 HP'), secret: true });
    const sc = secretOf(id);
    if (sc) ops.push({ k: 'secret', text: sc.text, hint: tr(sc.hint), can: !(sc.effect.gold < 0) || run.gold >= -sc.effect.gold, secret: true });
    if (e.dark) ops.push({ k: 'forgive', text: LORE.FORGIVE.text, hint: tr(LORE.FORGIVE.hint), can: run.maxHp > 12 });
    if (att === 'like') ops.push(tier === 'boss' ? { k: 'heart', text: 'Поговорить по душам', hint: tr('Босс Ослаблен на 2 хода') }
      : { k: 'peace', text: 'Договориться миром', hint: tr(tier === 'elite' ? 'Без боя, талисман' : 'Без боя, монеты и +6 HP') });
    if (att === 'fear' && tier !== 'boss') ops.push({ k: 'scare', text: 'Прогнать', hint: tr('Без боя, половина монет') });
    if (att === 'hate' || att === 'grudge' || (tie && tie.kind === 'avenge')) {
      ops.push({ k: 'calm', text: 'Успокоить', hint: tr('−{n} монет, враг не злится', { n: calmPrice(tier) }), can: run.gold >= calmPrice(tier) });
      ops.push({ k: 'sass', text: 'Ответить дерзко', hint: tr('Сила врага +3, монет вдвое больше') });
    } else ops.push({ k: 'taunt', text: 'Подразнить', hint: tr('Сила врага +2, монет в полтора раза больше') });
    if (!att && !sc && tier === 'fight') ops.push({ k: 'bribe', text: 'Откупиться', hint: tr('−{n} монет, без боя', { n: bribePrice() }), can: run.gold >= bribePrice() });
    return ops;
  }

  // разговор до боя: враг говорит, герой выбирает ответ
  function goTalk(id, tier) {
    ensureLore();
    setBg(null, 'talk');
    save({ t: 'talk', enemy: id, tier });
    codexMark('e', id);
    const e = ENEMIES[id];
    const att = attOf(id);
    const tie = !e.dark && tieOf(id);
    const line = e.dark ? LORE.DARK[e.dark].intro : tie ? pick(LORE.TIE_SAY[tie.kind]) : att && att !== 'grudge' ? lineOf(id, att) : att === 'grudge' ? LORE.GRUDGE : (lineOf(id, 'start') || LORE.CHALLENGE);
    const opts = talkOptions(id, tier, att);
    screen.className = 'scr-talk';
    screen.dataset.enemy = id; screen.dataset.tier = tier;
    screen.innerHTML = `${topBar()}
      <div class="talk-art tk-${e.tier}">${(Art.enemyLive || Art.enemy)(id)}</div>
      <div class="ev-box talk-box"><h2>${e.name}</h2><p>${quote(line)}</p>${tie ? `<small class="tienote">${tr(tie.text)}</small>` : ''}</div>
      <div class="scrolls">${opts.map((op) => `<button class="scroll ${op.can === false ? 'off' : ''} ${op.secret ? 'secret' : ''}" data-act="talkopt" data-k="${op.k}" ${op.can === false ? 'disabled' : ''}>${tr(op.text)}<small>${op.hint}</small></button>`).join('')}</div>
      ${heroBar(false)}`;
  }

  // ответ в разговоре; mod — как разговор изменит бой (действует до награды за него)
  function talkChoose(k) {
    const id = screen.dataset.enemy; const tier = screen.dataset.tier;
    const e = ENEMIES[id];
    const mod = { str: 0, weak: 0, goldMul: 1, hpMul: 1, stun: 0, talked: true };
    let reply = null; let narr = null; let next = 'fight'; let fightId = id;
    if (k !== 'fight') ach.add('talks');
    if (k === 'taunt' || k === 'sass') {
      mod.str = k === 'sass' ? 3 : 2; mod.goldMul = k === 'sass' ? 2 : 1.5;
      reply = pick(LORE.TAUNTED); run.tone.anger++; ach.add('taunts');
    } else if (k === 'calm') {
      spend(calmPrice(tier)); mod.calm = true; if (run.grudge) delete run.grudge[id]; reply = 'Ладно, ладно. Уже не злюсь.';
    } else if (k === 'heart') {
      mod.weak = 2; reply = lineOf(id, 'peace') || 'Ладно… только ради тебя.'; run.tone.peace++;
    } else if (k === 'regards') {
      ach.add('regards'); run.tone.peace++;
      if (tier === 'boss') { mod.weak = 2; reply = LORE.TIE_SAY.regardsBoss; } else {
        next = 'peace'; beKind(id); ach.add('peace'); reply = pick(LORE.TIE_SAY.regards);
        const g = goldFor('fight'); gain(g); evApi.heal(6); toast(`${coins(g)} · +6 HP`);
      }
    } else if (k === 'peace') {
      next = 'peace'; beKind(id); reply = lineOf(id, 'peace') || 'Ладно, иди с миром.'; run.tone.peace++; ach.add('peace');
      if (tier === 'elite') evApi.giveRelic(); else { const g = goldFor('fight'); gain(g); evApi.heal(6); toast(`${coins(g)} · +6 HP`); }
    } else if (k === 'scare') {
      next = 'peace'; ach.add('scares'); const g = Math.ceil(goldFor(tier) / 2); gain(g);
      narr = tr('{name} убегает, бросив {n} {n|монету|монеты|монет}.', { name: e.name, n: g });
    } else if (k === 'bribe') {
      spend(bribePrice()); next = 'peace'; narr = tr('Монеты звякнули, и {name} уступает дорогу.', { name: e.name });
    } else if (k === 'secret') {
      const sc = secretOf(id); const fx = sc.effect;
      run.secrets.push(id); ach.put('secrets', run.cls); ach.add('peace'); run.tone.peace++;
      narr = tr(sc.res);
      if (fx.gold) gain(fx.gold);
      if (fx.maxHp) { run.maxHp += fx.maxHp; run.hp += fx.maxHp; }
      if (fx.heal) evApi.heal(fx.heal);
      if (fx.peace) { next = tier === 'boss' ? 'bosspeace' : 'peace'; beKind(id); if (tier === 'elite') evApi.giveRelic(); }
      else { mod.hpMul = fx.hp || 1; mod.weak = fx.weak || 0; mod.stun = fx.stun || 0; }
    } else if (k === 'forgive') {
      run.maxHp -= 10; run.hp = Math.min(run.hp, run.maxHp);
      run.rel[e.dark] = 2; run.fallen = run.fallen.filter((h) => h !== e.dark); run.forgiven = e.dark; ach.put('friends', e.dark);
      run.final = 'shadowking'; fightId = 'shadowking';
      ach.flag('forgive'); narr = tr(LORE.FORGIVE.res);
    }
    if (next === 'fight') {
      run.fmod = mod;
      save({ t: tier, enemy: fightId }); // выход посреди боя вернёт в этот бой, а не к выбору ответа
      if (!reply && !narr) { startCombat(fightId, tier); return; }
      screen.dataset.fight = fightId;
    } else save({ t: 'next' });
    if (next === 'bosspeace') save({ t: 'bossrelic', opts: null });
    $('.talk-box p').innerHTML = reply ? quote(reply) : narr;
    const note = $('.tienote'); if (note) note.remove();
    if (fightId !== id) { $('.talk-box h2').textContent = ENEMIES[fightId].name; $('.talk-art').innerHTML = (Art.enemyLive || Art.enemy)(fightId); }
    const act = next === 'fight' ? 'talkgo' : next === 'bosspeace' ? 'talkboss' : 'next';
    $('.scrolls').innerHTML = `<button class="scroll" data-act="${act}">${tr(next === 'fight' ? 'В бой' : 'Дальше')}</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* После боя побеждённый враг иногда просит пощады: подарок или больше монет, но обида на весь забег */
  const wantsPlea = (id, tier) => mainStory() && SAY[id] && SAY[id].plea && (tier === 'boss' || Math.random() < 0.4);
  function goAfter(tier, id) {
    save({ t: 'after', tier, enemy: id });
    setBg(null, 'talk');
    const e = ENEMIES[id];
    screen.className = 'scr-talk';
    screen.dataset.enemy = id; screen.dataset.tier = tier;
    screen.innerHTML = `${topBar()}
      <div class="talk-art beaten tk-${e.tier}">${Art.enemy(id)}</div>
      <div class="ev-box talk-box"><h2>${e.name}</h2><p>${quote(SAY[id].plea)}</p></div>
      <div class="scrolls">
        <button class="scroll" data-act="spare">${tr('Пощадить')}<small>${tr(tier === 'boss' ? 'Враг отдаст талисман' : 'Враг оставит подарок')}</small></button>
        <button class="scroll" data-act="takeall">${tr('Забрать всё')}<small>${tr('Монет в полтора раза больше, но враг запомнит обиду')}</small></button>
      </div>
      ${heroBar(false)}`;
  }
  function afterChoose(spare) {
    const id = screen.dataset.enemy; const tier = screen.dataset.tier;
    let msg;
    if (spare) {
      run.tone.peace++; ach.add('spares');
      run.killed = run.killed.filter((x) => x !== id); beKind(id);
      if (tier === 'boss') evApi.giveRelic();
      else {
        const gift = rnd(0, 2);
        if (gift === 0) { evApi.heal(8); toast('+8 HP'); } else if (gift === 1 && upgradeRandom(1)) { /* всплывашка уже показана */ } else { gain(15); toast(coins(15)); }
      }
      SND.sfx('heal');
      msg = tr('Ты {f|отпустила|отпустил} врага, и на прощание он оставил тебе подарок.');
    } else {
      run.tone.anger++; run.grudge[id] = 1;
      run.fmod = { ...(run.fmod || {}), goldMul: ((run.fmod && run.fmod.goldMul) || 1) * 1.5 };
      SND.sfx('coin');
      msg = tr('Ты {f|забрала|забрал} всё до последней монетки. Враг это запомнит.');
    }
    save({ t: 'afterdone', tier });
    $('.talk-box p').textContent = msg;
    $('.scrolls').innerHTML = `<button class="scroll" data-act="afternext">${tr('Дальше')}</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }
  const afterNext = (tier) => (tier === 'boss' ? goBossRelic() : goReward(tier));

  /* Встреча с другим героем: помочь, пройти мимо или обидеть; у связанных героев есть свой ответ */
  function meetOptions(h) {
    const m = LORE.MEET[h];
    const ops = [];
    const tie = m.ties && m.ties[run.cls];
    if (tie) ops.push({ k: 'tie', ...tie, secret: true });
    ops.push({ k: 'help', ...m.help });
    ops.push({ k: 'pass', text: 'Пройти мимо', hint: tr('{name} немного обидится', { name: CLASSES[h].name }), fx: { rel: -1 }, ...m.pass });
    ops.push({ k: 'hurt', ...m.hurt });
    for (const o of ops) {
      const fx = o.fx || {};
      o.can = !(fx.gold < 0 && run.gold < -fx.gold) && !(fx.hp && run.hp <= fx.hp) && !(fx.maxHp < 0 && run.maxHp <= 12);
      if (o.k !== 'pass') o.hint = tr(o.hint);
    }
    return ops;
  }
  function goMeet(h) {
    ensureLore();
    setBg(null, 'meet');
    const m = LORE.MEET[h];
    if (!run.met.includes(h)) run.met.push(h);
    ach.put('met', h); codexMark('h', h);
    screen.className = 'scr-meet';
    screen.dataset.hero = h;
    screen.innerHTML = `${topBar()}
      <div class="talk-art hero">${heroArt(h)}</div>
      <div class="ev-box talk-box"><h2>${tr(m.title)}</h2><p>${tr(m.text)}</p></div>
      <div class="scrolls">${meetOptions(h).map((o) => `<button class="scroll ${o.can ? '' : 'off'} ${o.secret ? 'secret' : ''}" data-act="meetopt" data-k="${o.k}" ${o.can ? '' : 'disabled'}>${tr(o.text)}<small>${o.hint}</small></button>`).join('')}</div>
      ${heroBar(false)}`;
  }
  function relChange(h, d) {
    run.rel[h] = (run.rel[h] || 0) + d;
    const name = CLASSES[h].name;
    if (run.rel[h] <= -2 && !run.fallen.includes(h)) { run.fallen.push(h); ach.flag('betray'); SND.sfx('snuff'); toast(tr('Тень коснулась героя: {name}', { name })); }
    else if (d > 0 && run.rel[h] >= 2) { SND.sfx('relic'); toast(tr('Новый друг: {name}', { name })); ach.put('friends', h); }
  }
  function meetChoose(k) {
    const h = screen.dataset.hero;
    const m = LORE.MEET[h];
    const o = meetOptions(h).find((x) => x.k === k);
    if (!o || !o.can) return;
    const fx = o.fx || {};
    if (fx.gold) gain(fx.gold);
    if (fx.hp) evApi.damage(fx.hp);
    if (fx.heal) evApi.heal(fx.heal);
    if (fx.maxHp) { run.maxHp += fx.maxHp; run.hp = Math.min(run.hp, run.maxHp); }
    if (fx.relic) evApi.giveRelic();
    if (fx.upRandom) upgradeRandom(fx.upRandom);
    if (k === 'pass') run.tone.pass++;
    if (k === 'help' || k === 'tie') ach.add('helps');
    if (k === 'tie') ach.put('ties', `${run.cls}>${h}`);
    if (fx.letters) ach.flag('letters');
    run.meetLog.push(k);
    relChange(h, fx.rel || 0);
    const finish = () => {
      save({ t: 'next' });
      screen.innerHTML = `${topBar()}
        <div class="talk-art hero">${heroArt(h)}</div>
        <div class="ev-box talk-box"><h2>${tr(m.title)}</h2><p>${tr(o.res)}</p></div>
        <div class="scrolls"><button class="scroll" data-act="next">${tr('Дальше')}</button></div>
        ${heroBar(false)}`;
    };
    if (fx.up) upgradeFlow(() => finish()); else finish();
  }

  /* Реплика врага в бою: облачко над головой (выключается в настройках) */
  function say(text, ms = 2600) {
    if (!text || SETTINGS.lines === false || !C) return;
    const z = $('.enemy-zone');
    if (!z) return;
    z.querySelectorAll('.saybub').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'saybub';
    b.textContent = tr(text);
    z.appendChild(b);
    ach.add('lines');
    setTimeout(() => b.remove(), SETTINGS.fast ? ms * 0.7 : ms);
  }

  /* Друзья помогают в начале финального боя (js/lore.js, FRIEND) */
  async function friendHelp() {
    const fr = C.friends;
    if (!fr.length) return;
    toast(tr('Друзья рядом: {list}', { list: fr.map((h) => CLASSES[h].name).join(', ') }));
    if (fr.length >= 3) ach.flag('friends3');
    if (fr.includes('guard')) api.block(12);
    if (fr.includes('baker')) { evApi.heal(10); FX.play('heal'); }
    if (fr.includes('stoker')) { C.enemy.burn += 6; FX.play('fire', 'enemy'); }
    if (fr.includes('herbalist')) { C.enemy.weak += 3; FX.play('weak', 'enemy'); }
    if (fr.includes('shepherd')) { C.dog = Math.max(C.dog, 3); FX.play('growl'); }
    if (fr.includes('grinder')) api.sharpen(2, true);
    renderCombat();
    if (fr.includes('lamp')) await api.flame(2);
  }

  /* ---------- Лавка ---------- */
  function goShop(saved) {
    setBg(null, 'shop');
    const disc = (n) => Math.round(n * (hasRelic('coupon') ? 0.75 : 1));
    // на прилавке по карте каждой редкости
    // третья карта иногда эпическая или легендарная
    const base = { common: 38, uncommon: 54, rare: 72, epic: 95, legendary: 130 };
    const cards = ['common', 'uncommon', rollRarity([0.05, 0.25, 1, 1])].map((r) => pickCard(r)).map((id) => ({ id, price: disc(base[CARDS[id].rarity] + rnd(-4, 6)), sold: false }));
    const rid = pickRelic();
    const shop = saved || { cards, relic: rid ? { id: rid, price: disc({ common: 90, uncommon: 108, rare: 125, epic: 150, legendary: 190 }[RELICS[rid].tier]), sold: false } : null, tea: { price: disc(22), sold: false }, remove: { price: disc(50), sold: false }, up: { price: disc(55), sold: false } };
    screen.className = 'scr-shop';
    if (shop.relic) codexMark('r', shop.relic.id);
    const last = isFinalStep(run.step); // лавка у последней двери
    const bought = () => { if (last) ach.flag('finalbuy'); };
    const render = () => {
      save({ t: 'shop', shop });
      screen.innerHTML = `${topBar()}
        <div class="shopkeeper">${(Art.enemyLive || Art.enemy)('hedgehog')}<div class="bubble">${tr(last ? 'Последняя лавка перед дверью! Бери, не стесняйся.' : 'Всё по-честному! Почти.')}</div></div>
        <div class="shop-cards">${shop.cards.map((c, i) => `<div class="ware ${c.sold ? 'sold' : ''}">${cardHTML(c.id, 'shopcard', `data-act="buy" data-i="${i}"`)}<div class="price ${run.gold < c.price ? 'poor' : ''}">${Art.icon('coin')}${c.price}</div></div>`).join('')}</div>
        <div class="shop-services">
          ${shop.relic ? `<button class="svc ${shop.relic.sold ? 'sold' : ''}" data-act="buyrelic">${Art.relic(shop.relic.id)}<span><b>${RELICS[shop.relic.id].name}<em class="rtier ${RELICS[shop.relic.id].tier}">${TIER_LABEL[RELICS[shop.relic.id].tier]}</em></b><small>${RELICS[shop.relic.id].desc}</small></span><i class="${run.gold < shop.relic.price ? 'poor' : ''}">${shop.relic.price}</i></button>` : ''}
          <button class="svc ${shop.tea.sold ? 'sold' : ''}" data-act="buytea">${Art.icon('tea')}<span><b>${tr('Горячий сбитень')}</b><small>${tr('Восстановить {n} HP', { n: 12 })}</small></span><i class="${run.gold < shop.tea.price ? 'poor' : ''}">${shop.tea.price}</i></button>
          <button class="svc ${shop.up.sold ? 'sold' : ''}" data-act="buyup">${Art.icon('whetstone')}<span><b>${tr('лавка::Заточка')}</b><small>${tr('Улучшить карту')}</small></span><i class="${run.gold < shop.up.price ? 'poor' : ''}">${shop.up.price}</i></button>
          <button class="svc ${shop.remove.sold ? 'sold' : ''}" data-act="buyremove">${Art.icon('scissors')}<span><b>${tr('Распустить карту')}</b><small>${tr('Убрать карту из колоды')}</small></span><i class="${run.gold < shop.remove.price ? 'poor' : ''}">${shop.remove.price}</i></button>
        </div>
        <button class="btn leave" data-act="next">${tr('Уйти')}</button>
        ${heroBar(false)}`;
    };
    const pay = (item) => {
      if (item.sold) return false;
      if (run.gold < item.price) { SND.sfx('deny'); toast(tr('Не хватает монет')); return false; }
      spend(item.price); item.sold = true; ach.add('spent', item.price); SND.sfx('coin'); bought(); return true;
    };
    screen.onShop = (act, i) => {
      const g0 = run.gold;
      if (act === 'buy' && pay(shop.cards[i])) { ach.add('bought'); run.deck.push(mk(shop.cards[i].id)); toast(tr('Куплено: {name}', { name: CARDS[shop.cards[i].id].name })); }
      if (act === 'buyrelic' && shop.relic && pay(shop.relic)) addRelic(shop.relic.id);
      if (act === 'buytea' && pay(shop.tea)) { evApi.heal(12); SND.sfx('heal'); }
      if (act === 'buyup' && !shop.up.sold) {
        if (run.gold < shop.up.price) { SND.sfx('deny'); toast(tr('Не хватает монет')); return; }
        upgradeFlow((ok) => { if (ok) { spend(shop.up.price); shop.up.sold = true; ach.add('spent', shop.up.price); bought(); } render(); });
        return;
      }
      if (act === 'buyremove' && !shop.remove.sold) {
        if (run.gold < shop.remove.price) { SND.sfx('deny'); toast(tr('Не хватает монет')); return; }
        removeCardFlow((ok) => { if (ok) { spend(shop.remove.price); shop.remove.sold = true; ach.add('spent', shop.remove.price); bought(); } render(); });
        return;
      }
      render();
      if (run.gold < g0 && Art.act) Art.act($('.shopkeeper'), 'happy'); // ёж радуется покупке
    };
    render();
  }

  /* ---------- Сундук ---------- */
  function goChest() {
    setBg(); // на нарисованной сцене сундука уже есть свой сундук, поэтому фон пути
    screen.className = 'scr-chest';
    screen.innerHTML = `${topBar()}
      <div class="chest-wrap"><div class="chest">${Art.icon('chest')}</div><p>${tr('Сундук-соня сладко храпит.')}</p></div>
      <div class="row2"><button class="btn" data-act="openchest">${tr('Открыть')}</button><button class="btn ghost" data-act="next">${tr('Не будить')}</button></div>
      ${heroBar(false)}`;
  }
  function openChest() {
    ach.add('chests');
    const free = freeRelics();
    let msg;
    if (free.length && Math.random() < 0.5) { const id = pickRelic(free); addRelic(id); msg = tr('Внутри: {name}. {desc}', { name: RELICS[id].name, desc: RELICS[id].desc }); }
    else { const g = rnd(28, 45); gain(g); SND.sfx('coin'); msg = tr('Внутри {n} {n|монета|монеты|монет}.', { n: g }); }
    save({ t: 'next' });
    $('.chest').classList.add('open');
    $('.chest-wrap p').textContent = msg;
    $('.row2').innerHTML = `<button class="btn" data-act="next">${tr('Дальше')}</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Привал ---------- */
  const restHeal = () => Math.round(run.maxHp * DIFF().rest) + (hasRelic('kettle') ? 10 : 0);
  function goRest() {
    setBg(null, 'rest');
    const noHeal = hasRelic('bottomless');
    // у последнего костра собираются друзья, а обиженный герой мелькает в темноте
    const last = isFinalStep(run.step) && mainStory();
    let talk = tr('Костёр потрескивает. Снег вокруг тает.');
    if (last) {
      const fr = friendsOf();
      const shade = finalBoss().startsWith('dk_') ? CLASSES[ENEMIES[finalBoss()].dark] : null;
      talk = fr.length ? `${tr('К костру подсели друзья:')}<span class="friends">${fr.map((h) => `<span class="frow"><span class="fport">${heroFace(h)}</span><span>${tr(LORE.FRIEND[h].line)}<small>${tr(LORE.FRIEND[h].bonus)}</small></span></span>`).join('')}</span>`
        : tr('У костра тихо. Только ты и последний огонь перед дверью.');
      if (shade) talk += ` <span class="shade">${tr('За деревьями мелькнула знакомая фигура: {name}. Но тень на ней гуще ночи.', { name: shade.name })}</span>`;
    }
    screen.className = 'scr-rest';
    screen.innerHTML = `${topBar()}
      <div class="fire-wrap ${last ? 'last' : ''}">${Art.icon('fire')}<p>${talk}</p></div>
      <div class="scrolls">
        <button class="scroll ${noHeal ? 'off' : ''}" data-act="rest-heal" ${noHeal ? 'disabled' : ''}>${tr('Отдохнуть')}<small>${noHeal ? tr('Бездонная сумка не даёт присесть') : `+${restHeal()} HP${hasRelic('cocoatin') ? `, ${tr('+{n} макс.', { n: 2 })}` : ''}`}</small></button>
        <button class="scroll" data-act="rest-up">${tr('Наточить карту')}<small>${tr('Улучшить карту')}</small></button>
        <button class="scroll" data-act="rest-burn">${tr('Сжечь карту')}<small>${tr('Убрать карту из колоды')}</small></button>
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
      const kind = C.fx || 'bonk';
      for (let h = 0; h < hits; h++) {
        if (C.enemy.hp <= 0 || run.hp <= 0) break;
        heroLunge();
        // первый удар карты — полная анимация, следующие короче
        await strike(calcDmg(base), C.fxHits++ ? ATK_FX_NEXT[kind] || kind : kind);
        // метла трубочиста: каждый удар подкидывает искру
        if (C.enemy.hp > 0 && proc('sootbroom', 'enemy')) { C.enemy.burn += 1; FX.play('sparks', 'enemy'); floatText($('.enemy-fx'), tr('Поджог +{n}', { n: 1 }), 'burnf'); }
        // колючий враг ранит в ответ на каждый удар
        if (C.enemy.thorns > 0 && C.enemy.hp > 0) { FX.play('thorns'); await hitHero(C.enemy.thorns); }
        if (hits > 1) await sleep(140);
      }
    },
    block(n) {
      if (C.frail > 0) n = Math.floor(n * 0.75);
      C.block += n; SND.sfx('block'); FX.play('shield'); floatText($('.hero-fx'), `+${n}`, 'blockf');
    },
    async flame(n) {
      C.flame += n;
      SND.sfx('flame'); FX.play('flamelet');
      renderCombat();
      while (C.flame >= flameMax() && C.enemy.hp > 0) {
        C.flame -= flameMax();
        await burst();
      }
    },
    draw(n) { drawCards(n); },
    heal(n) { SND.sfx('heal'); FX.play('heal'); const before = run.hp; run.hp = Math.min(run.maxHp, run.hp + n); stAdd('healed', run.hp - before); floatText($('.hero-fx'), `+${run.hp - before}`, 'healf'); },
    burn(n) { const v = n + (proc('matchbox', 'enemy') ? 2 : 0); FX.play('fire', 'enemy'); C.enemy.burn += v; floatText($('.enemy-fx'), tr('Поджог {n}', { n: v }), 'burnf'); },
    weak(n) { FX.play('weak', 'enemy'); C.enemy.weak += n; floatText($('.enemy-fx'), tr('Ослаблен'), 'weakf'); },
    vuln(n) { FX.play('vuln', 'enemy'); C.enemy.vuln += n + (proc('stamppad', 'enemy') ? 1 : 0); floatText($('.enemy-fx'), tr('Уязвим'), 'weakf'); },
    chill(n) { FX.play('frost', 'enemy'); C.enemy.str -= n; floatText($('.enemy-fx'), tr('Сила −{n}', { n }), 'blockf'); },
    stun() { FX.play('sleep', 'enemy'); C.enemy.stun = 1; floatText($('.enemy-fx'), tr('Засыпает…'), 'weakf'); if (C.tier === 'boss') ach.flag('stunboss'); },
    energy(n) { C.energy += n; FX.play('energy'); floatText($('.hero-fx'), tr('+{n} {n|энергия|энергии|энергии}', { n }), 'blockf'); },
    resolve(n) { C.str += n; FX.play('aura'); floatText($('.hero-fx'), tr('Решимость +{n}', { n }), 'burnf'); },
    rush(n) { C.tmpStr += n; FX.play('aura'); floatText($('.hero-fx'), tr('Решимость +{n}', { n }), 'burnf'); },
    thorns(n) { if (proc('wreath')) n *= 2; C.thorns += n; FX.play('thorns'); floatText($('.hero-fx'), tr('Шипы +{n}', { n }), 'blockf'); },
    gold(n) { gain(n); FX.play('gold'); floatText($('.hero-fx'), coins(n), 'burnf'); },
    maxHp(n) { run.maxHp += n; run.hp += n; SND.sfx('heal'); FX.play('heart'); floatText($('.hero-fx'), tr('+{n} к макс. HP', { n }), 'healf'); },
    doubleBlock() { if (C.block > 0) api.block(C.block); },
    async burstNow() { await burst(); },
    consumeFlame() { const n = C.flame; C.flame = 0; return n; },
    deliver(name, fn) { name = tr(name); C.deliveries.push({ name, fn }); FX.play('deliver'); floatText($('.hero-fx'), tr('{name} в пути', { name }), 'weakf'); },
    charm(id, n) {
      C.charms[id] = (C.charms[id] || 0) + n; FX.play('sigil', `c:${id}`); floatText($('.hero-fx'), CARDS[id].name, 'weakf');
      if (Object.keys(C.charms).length >= 3) ach.flag('charms3');
    },
    freeTurn() { C.free = true; FX.play('clock'); floatText($('.hero-fx'), tr('Все карты бесплатно!'), 'burnf'); },
    // Копирка: повторить предыдущую карту хода
    async copyLast() {
      const l = C.last;
      if (!l || l.id === 'carbon') { floatText($('.hero-fx'), tr('Нечего копировать'), 'weakf'); return; }
      floatText($('.hero-fx'), tr('Копия: {name}', { name: CARDS[l.id].name }), 'weakf');
      FX.play('mirror');
      const was = C.fx; C.fx = ATK_FX[l.id]; C.fxHits = 0;
      await CARDS[l.id].play(api, l.up, l);
      C.fx = was;
    },
    // Обратный адрес: вернуть в руку последние карты из сброса (кроме помех)
    recall(n) {
      let got = 0;
      for (let i = C.disc.length - 1; i >= 0 && got < n && C.hand.length < HAND_MAX; i--) {
        if (CARDS[C.disc[i].id].type === 'status') continue;
        C.hand.push(C.disc.splice(i, 1)[0]); got++;
      }
      FX.play('cards'); floatText($('.hero-fx'), got ? tr('Вернулось карт: {n}', { n: got }) : tr('Сброс пуст'), 'weakf');
    },
    // До востребования: бесплатно разыграть верхние карты колоды, помехи сгорают
    async autoplay(n) {
      for (let k = 0; k < n; k++) {
        if (C.enemy.hp <= 0 || run.hp <= 0) break;
        if (!C.draw.length) { if (!C.disc.length) break; C.draw = shuffle(C.disc); C.disc = []; }
        const c = C.draw.pop();
        const cd = CARDS[c.id];
        toast(tr('Из колоды: {name}', { name: cardName(c) }));
        if (cd.type === 'status') { exhaustCard(c); continue; }
        C.fx = ATK_FX[c.id]; C.fxHits = 0;
        await cd.play(api, c.up, c);
        if (cd.type === 'charm') C.exh.push(c);
        else if (cd.exhaust) exhaustCard(c);
        else C.disc.push(c);
        renderCombat();
        await sleep(250);
      }
    },
    // Пряничница: положить Пряники в руку (с Глазурью — улучшенные)
    ginger(n) {
      let got = 0;
      for (let k = 0; k < n && C.hand.length < HAND_MAX; k++) { C.hand.push(mk('gingerbread', C.glaze)); got++; }
      if (got) { FX.play('ginger'); floatText($('.hero-fx'), tr('Пряник +{n}', { n: got }), 'burnf'); }
    },
    glaze() {
      C.glaze = true;
      [...C.hand, ...C.draw, ...C.disc].forEach((c) => { if (c.id === 'gingerbread') c.up = true; });
      FX.play('sugar');
      floatText($('.hero-fx'), tr('Глазурь!'), 'weakf');
    },
    // Точильщик: заточить карты в руке — улучшить до конца боя
    sharpen(n, quiet) {
      const list = shuffle(C.hand.filter(canUpgrade)).slice(0, n);
      list.forEach((c) => { c.up = true; c.sharp = true; });
      C.sharpened += list.length;
      if (list.length) { ach.max('sharpfight', C.sharpened); FX.play('grind'); floatText($('.hero-fx'), list.length === 1 ? tr('Заточено: {name}', { name: CARDS[list[0].id].name }) : tr('Заточено карт: {n}', { n: list.length }), 'blockf'); }
      else if (!quiet) floatText($('.hero-fx'), tr('Нечего точить'), 'weakf');
      return list.length;
    },
    // сколько улучшенных карт в колоде, руке и сбросе (кроме самой карты)
    upCount(self) { return C ? [...C.draw, ...C.hand, ...C.disc].filter((c) => c.up && c !== self).length : 0; },
    // Пастушка: Злость Дружка и укус
    dog(n) { C.dog += n; FX.play('growl'); floatText($('.hero-fx'), tr('Злость +{n}', { n }), 'burnf'); ach.max('dogmax', C.dog); },
    async bite() {
      if (C.dog <= 0 || C.enemy.hp <= 0) return;
      const pt = $('#heroPortrait');
      if (pt) { pt.classList.remove('bite'); void pt.offsetWidth; pt.classList.add('bite'); }
      await FX.play('bite', 'enemy');
      floatText($('.enemy-fx'), tr('Гав!'), 'weakf');
      await hitEnemy(dogDmg(), true);
      if (proc('collar')) api.block(2);
    },
    // Знахарка: заплатить Цену здоровьем
    async price(n) {
      loseHp(n); C.paid += n; ach.max('pricefight', C.paid);
      FX.play('price'); floatText($('.hero-fx'), tr('Цена −{n} HP', { n }), 'dmgf');
      renderCombat();
      if (C.enemy.hp > 0 && proc('mortar', 'enemy')) { await sleep(120); await strike(n, 'roots'); }
    },
    // сжечь карты из руки по условию, вернуть их количество
    exhaustHand(pred) {
      const out = C.hand.filter((c) => pred(CARDS[c.id]));
      C.hand = C.hand.filter((c) => !out.includes(c));
      out.forEach(exhaustCard);
      return out.length;
    },
  };

  // удар по врагу со своей анимацией: сначала эффект (снаряд долетает), потом урон
  async function strike(dmg, kind = 'bonk') {
    await FX.play(kind, 'enemy');
    return hitEnemy(dmg, true);
  }
  // талисман сработал: его значок всплывает над героем (или врагом)
  function proc(id, where) {
    if (!hasRelic(id)) return false;
    if (screen.className === 'scr-combat') FX.relic(`r:${id}`, RELICS[id].name, where);
    return true;
  }

  function calcDmg(base) {
    if (!C) return base;
    let v = base + flameBonus() * C.flame + C.str + C.tmpStr + (hasRelic('pencil') && !C.atkTurn ? 3 : 0);
    if (C.pWeak > 0) v = Math.floor(v * 0.75);
    if (C.enemy.vuln > 0) v = Math.floor(v * 1.5);
    return Math.max(0, v);
  }
  const dogDmg = () => (C.enemy.vuln > 0 ? Math.floor(C.dog * 1.5) : C.dog);
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
    setBg();
    snapFight = { run: JSON.stringify(run), enemyId, tier }; // для «начать бой заново»
    const e = ENEMIES[enemyId];
    run.seen[enemyId] = (run.seen[enemyId] || 0) + 1;
    run.recent = [...run.recent, enemyId].slice(-4);
    const scale = tier === 'boss' ? 1 : 1 + run.step * (MAX_STEPS > 20 ? 0.035 : 0.08);
    const hp = Math.round(e.hp * scale * DIFF().hp);
    // отношение к герою и разговор до боя (js/lore.js): кто не терпит — злее, кто боится — слабее
    const mod = run.fmod || {};
    const att = attOf(enemyId);
    const tie = !e.dark && run.killed ? tieOf(enemyId) : null;
    codexMark('e', enemyId);
    const angry = ((att === 'hate' || att === 'grudge') && !mod.calm ? 2 : 0) + (tie && tie.kind === 'avenge' && !mod.calm ? 1 : 0);
    const str = (tier === 'boss' ? 0 : Math.floor(run.step / (MAX_STEPS > 20 ? 8 : 3))) - (hasRelic('frostglass') ? 2 : 0) + angry + (mod.str || 0);
    const weak = (hasRelic('inkwell') ? 2 : 0) + (hasRelic('frostring') ? 2 : 0) + (att === 'fear' ? 2 : 0) + (tie && tie.kind === 'rival' ? 2 : 0) + (mod.weak || 0);
    const final = tier === 'boss' && isFinalStep(run.step);
    C = {
      tier, id: enemyId, att, tie: tie && tie.kind, saidHurt: false, friends: final && mainStory() ? friendsOf() : [],
      enemy: { hp: Math.round(hp * (mod.hpMul || 1)), max: hp, block: 0, str, weak, vuln: hasRelic('frostring') ? 2 : 0, burn: 0, thorns: e.thorns || 0, stun: mod.stun || 0, pi: 0, nest: e.nest || 0, layer: 0, boil: 0, mist: 0 },
      draw: shuffle(run.deck.map((c) => ({ ...c }))), hand: [], disc: [], exh: [],
      energy: maxEnergy(), block: 0, flame: (hasRelic('feather') ? 1 : 0) + (hasRelic('eternaloil') ? 1 : 0), pWeak: 0, turn: 0,
      str: 0, tmpStr: 0, thorns: hasRelic('pinecone') ? (hasRelic('wreath') ? 6 : 3) : 0,
      charms: {}, deliveries: [], playedTurn: 0, playedTotal: 0,
      firstAtk: false, shoe: false, hpLost: false, stolen: 0, burstsTurn: 0,
      last: null, atkTurn: false, frail: 0, sap: 0, bury: 0, vane: false, medal: false, boomed: false,
      ginger: 0, glaze: false, sharpened: 0, dog: hasRelic('dogfriend') ? 3 : 0, paid: 0,
    };
    if (hasRelic('chimneycap')) C.enemy.burn += 6;
    // Закладка: одна случайная карта улучшена до конца боя
    if (hasRelic('bookmark')) { const list = C.draw.filter(canUpgrade); if (list.length) pick(list).up = true; }
    selected = -1;
    SND.music(tier === 'boss' ? 'boss' : 'battle');
    screen.className = 'scr-combat';
    screen.innerHTML = `
      <div class="topbar slim">${relicIcons(6)}<div class="spacer"></div><div class="stepl">${tier === 'boss' ? tr(isFinalStep(run.step) ? 'Финал' : 'Босс стадии') : tr('Уровень {a}/{b}', { a: run.step + 1, b: MAX_STEPS })}</div></div>
      <div class="enemy-zone">
        <div class="intent"></div>
        <div class="enemy ${e.tier}" id="enemy">${(Art.enemyLive || Art.enemy)(enemyId)}<div class="enemy-fx"></div></div>
        <div class="nameplate"><div class="ename">${e.name}${e.tier !== 'normal' ? `<i>${tr(e.tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс') : 'Элита')}</i>` : ''}</div>
          <div class="ehp"><div class="fill"></div><span></span><div class="eblk"></div></div>
          <div class="estatus"></div>
        </div>
      </div>
      <div class="hstatus"></div>
      <div class="hero-fx"></div>
      <div class="hand"></div>
      <div class="hb-slot"></div>
      <div class="fxlayer"></div>`;
    startPlayerTurn();
    // первая реплика: к герою лично, если враг его знает (и ещё не сказал этого в разговоре)
    const first = mod.talked ? lineOf(enemyId, 'start') : tie ? pick(LORE.TIE_SAY[tie.kind]) : att === 'grudge' ? LORE.GRUDGE : (att && lineOf(enemyId, att)) || lineOf(enemyId, 'start');
    setTimeout(() => say(first), SETTINGS.fast ? 300 : 700);
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
    C.playedTurn = 0; C.burstsTurn = 0; C.last = null; C.atkTurn = false; C.free = false;
    // защита сгорает, но Горячий камень сохраняет её часть
    if (!C.charms.standfast) C.block = C.block > 0 && proc('hotstone') ? Math.min(C.block, 6) : 0;
    const first = C.turn === 1;
    if (first) startProcs();
    if (first && proc('bell')) { C.block += 6; FX.play('shield'); }
    if (proc('thimble')) C.block += 2;
    if (C.charms.mittens) C.block += C.charms.mittens;
    C.energy = maxEnergy() + (C.charms.aurora || 0) + (C.vane ? 1 : 0) + (C.medal ? 1 : 0);
    if (first && proc('scarf')) C.energy += 1;
    if (C.turn % 3 === 0 && proc('musicbox')) C.energy += 2;
    if (first && proc('northstar')) C.energy += 2;
    if (C.sap) { C.energy = Math.max(0, C.energy - C.sap); toast(tr('Кукушка сбила с ритма: −{n} {n|энергия|энергии|энергии}', { n: C.sap })); }
    C.sap = 0; C.vane = false; C.medal = false;
    let n = handSize() + (C.charms.compass || 0) + (first && proc('sled') ? 2 : 0) + (first && hasRelic('northstar') ? 2 : 0)
      + (first && C.friends.includes('courier') ? 2 : 0);
    if (C.bury) { n = Math.max(1, n - C.bury); toast(tr('Метелица замела: −{n} {n|карта|карты|карт}', { n: C.bury })); C.bury = 0; }
    drawCards(n);
    if (first && proc('mug')) { evApi.heal(3); FX.play('heal'); }
    SND.sfx(C.turn === 1 ? 'draw' : 'turn');
    renderCombat(true);
    // особенности героев в начале хода
    if (first && proc('honeypot')) api.ginger(2);
    if (proc('moldform')) api.ginger(1);
    if (proc('grindwheel')) api.sharpen(1, true);
    if (C.charms.apprentice) api.sharpen(2 * C.charms.apprentice, true);
    if (first) await friendHelp();
    if (proc('bridgerail')) { C.thorns += hasRelic('wreath') ? 2 : 1; FX.play('thorns'); }
    renderCombat();
    // Доставки с прошлого хода и чары
    const dels = C.deliveries; C.deliveries = [];
    for (const d of dels) {
      for (let k = 0; k < (hasRelic('horn') ? 2 : 1); k++) {
        if (C.enemy.hp <= 0) break;
        if (k === 1) proc('horn');
        toast(tr('Доставка: {name}', { name: d.name }));
        await sleep(250);
        C.fx = 'arrive'; C.fxHits = 0;
        await d.fn(api);
        renderCombat();
      }
      if (C.enemy.hp > 0 && proc('oilcan')) api.block(4);
    }
    if (C.charms.stubborn) C.str += C.charms.stubborn;
    if (C.charms.hearth && C.enemy.hp > 0) api.burn(C.charms.hearth);
    if (C.charms.eveninglamp && C.enemy.hp > 0) await api.flame(C.charms.eveninglamp);
    if (C.charms.eternalwinter && C.enemy.hp > 0) { api.chill(2 * C.charms.eternalwinter); api.block(8 * C.charms.eternalwinter); }
    if (C.charms.firebird && C.enemy.hp > 0) { api.burn(3 * C.charms.firebird); await api.flame(2 * C.charms.firebird); }
    if (run.hp <= 0) { await sleep(400); goDefeat(); return; }
    if (C.enemy.hp <= 0) { await winCombat(); return; }
    busy = false;
    renderCombat();
  }

  // талисманы, которые сработали в начале боя
  function startProcs() {
    const at = { inkwell: 'enemy', frostring: 'enemy', frostglass: 'enemy', chimneycap: 'enemy' };
    ['feather', 'eternaloil', 'pinecone', 'dogfriend', 'bookmark', 'inkwell', 'frostring', 'frostglass', 'chimneycap'].forEach((id) => proc(id, at[id]));
    if (hasRelic('chimneycap')) FX.play('fire', 'enemy');
    if (hasRelic('frostring') || hasRelic('frostglass')) FX.play('frost', 'enemy');
    if (hasRelic('inkwell')) FX.play('weak', 'enemy');
    if (hasRelic('dogfriend')) FX.play('growl');
    if (hasRelic('pinecone')) FX.play('thorns');
  }

  function currentIntents() {
    if (C.enemy.stun > 0) return [{ k: 'sleep' }];
    const p = ENEMIES[C.id].pattern[C.enemy.pi % ENEMIES[C.id].pattern.length];
    return p.then ? [p, p.then] : [p];
  }

  function intentHTML(it) {
    const tip = (t) => `data-tip="${t}"`;
    if (it.k === 'attack') return `<div class="it atk" ${tip(`${tr('Атака: {d} урона', { d: enemyDmg(it.v) })}${it.hits ? ` ${tr('{n} {n|раз|раза|раз}', { n: it.hits })}` : ''}${it.leech ? `. ${tr('Враг вылечится на весь урон, который пройдёт сквозь защиту')}` : ''}`)}>${Art.intentIcon(it.leech ? 'leech' : 'attack')}<b>${enemyDmg(it.v)}${it.hits ? `×${it.hits}` : ''}</b></div>`;
    if (it.k === 'sap') return `<div class="it deb" ${tip(tr('Собьёт с ритма: в ваш следующий ход −{n} {n|энергия|энергии|энергии}', { n: it.v }))}>${Art.intentIcon('sap')}<b>−${it.v}</b></div>`;
    if (it.k === 'mist') return `<div class="it blk" ${tip(tr('Напустит туман: до её следующего хода любой удар по ней наносит не больше {n} урона. Поджог проходит', { n: it.v }))}>${Art.intentIcon('mist')}<b>≤${it.v}</b></div>`;
    if (it.k === 'boom') return `<div class="it atk boom" ${tip(tr('Взорвётся: {d} урона, и после этого исчезнет', { d: enemyDmg(it.v) }))}>${Art.intentIcon('boom')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'bury') return `<div class="it deb" ${tip(tr('Заметёт руку: в следующий ход на {n} {n|карту|карты|карт} меньше', { n: it.v }))}>${Art.intentIcon('bury')}<b>−${it.v}</b></div>`;
    if (it.k === 'frail') return `<div class="it deb" ${tip(tr('Хрупкость на {n} {n|ход|хода|ходов}: ваша защита слабее на 25%', { n: it.v }))}>${Art.intentIcon('frail')}<b>${it.v}</b></div>`;
    if (it.k === 'block') return `<div class="it blk" ${tip(tr('Защита {n}', { n: it.v }))}>${Art.intentIcon('block')}<b>${it.v}</b></div>`;
    if (it.k === 'buff') return `<div class="it buf" ${tip(tr('Враг станет сильнее: Сила +{n}', { n: it.v }))}>${Art.intentIcon('buff')}<b>+${it.v}</b></div>`;
    if (it.k === 'debuff') return `<div class="it deb" ${tip(tr('Слабость на {n} {n|ход|хода|ходов}: ваши атаки слабее на 25%', { n: it.v }))}>${Art.intentIcon('debuff')}</div>`;
    if (it.k === 'snuff') return `<div class="it snf" ${tip(tr('Погасит все Огоньки и ударит на {d}', { d: enemyDmg(it.v) }))}>${Art.intentIcon('snuff')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'curse') return `<div class="it cur" ${tip(tr('Подкинет в колоду: {name} ×{n}', { name: CARDS[it.card].name, n: it.n }))}>${Art.intentIcon('curse')}<b>×${it.n}</b></div>`;
    if (it.k === 'steal') return `<div class="it atk" ${tip(tr('Ударит на {d} и украдёт до {g} {g|монеты|монет|монет}', { d: enemyDmg(it.v), g: it.gold }))}>${Art.intentIcon('steal')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'heal') return `<div class="it hea" ${tip(tr('Восстановит {n} HP', { n: it.v }))}>${Art.intentIcon('heal')}<b>+${it.v}</b></div>`;
    if (it.k === 'spikes') return `<div class="it blk" ${tip(tr('Отрастит Шипы {n}: каждый ваш удар по нему будет ранить вас', { n: it.v }))}>${Art.intentIcon('spikes')}<b>+${it.v}</b></div>`;
    if (it.k === 'sleep') return `<div class="it slp" ${tip(tr('Враг спит и пропустит ход'))}>${Art.intentIcon('sleep')}<b>${tr('Спит')}</b></div>`;
    return '';
  }

  const sti = (k) => (Art.status ? Art.status(k) : '');
  function chip(cls, text, tipText, ico = '') {
    return `<i class="${cls}" data-tip="${tipText}">${ico}${text}</i>`;
  }

  function renderCombat(dealAnim = false) {
    if (!C) return;
    const e = C.enemy;
    if (!C.saidHurt && e.hp > 0 && e.hp <= e.max / 2) { C.saidHurt = true; say(lineOf(C.id, 'hurt')); }
    $('.intent').innerHTML = e.hp > 0 ? currentIntents().map(intentHTML).join('') : '';
    $('.ehp .fill').style.width = `${(Math.max(0, e.hp) / e.max) * 100}%`;
    $('.ehp span').textContent = `${Math.max(0, e.hp)}/${e.max}`;
    $('.eblk').innerHTML = e.block > 0 ? `${Art.intentIcon('block')}<b>${e.block}</b>` : '';
    const g = (name) => GL[name];
    const st = [];
    if (e.str) st.push(chip('s-str', tr('Сила {n}', { n: e.str }), g('Сила врага'), sti('enemy_strength')));
    if (e.weak) st.push(chip('s-weak', tr('Ослаблен {n}', { n: e.weak }), g('Ослаблен'), sti('weak')));
    if (e.vuln) st.push(chip('s-vuln', tr('Уязвим {n}', { n: e.vuln }), g('Уязвим'), sti('vulnerable')));
    if (e.burn) st.push(chip('s-burn', tr('Поджог {n}', { n: e.burn }), g('Поджог'), sti('burn')));
    if (e.thorns) st.push(chip('s-thorns', tr('Колючки {n}', { n: e.thorns }), tr('Каждый ваш удар по врагу ранит вас на {n}', { n: e.thorns }), sti('thorns')));
    // особые приёмы врага
    const ed = ENEMIES[C.id];
    if (e.nest) st.push(chip('s-trait', tr('Матрёшка ×{n}', { n: e.nest }), tr('Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: {n}.', { n: e.nest })));
    if (ed.boil) st.push(chip(e.boil ? 's-burn' : 's-trait', tr('Кипит +{n}', { n: e.boil }), tr('Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После его хода кипяток остывает. Поджог его не злит.')));
    if (ed.tally) st.push(chip('s-trait', tr('Ку-ку {a}/{b}', { a: C.playedTurn % ed.tally, b: ed.tally }), tr('Каждая {n}-я карта за ход: кукушка кукует и бьёт вас на 3.', { n: ed.tally })));
    if (ed.plating) st.push(chip('s-trait', tr('Латы'), tr('Защита Ледяного Рыцаря не сгорает: она копится от хода к ходу. Поджог бьёт прямо по HP.')));
    if (ed.alarm) st.push(chip('s-trait', tr('Колотушка +{n}', { n: ed.alarm }), tr('Каждый ваш Навык даёт сторожу {n} защиты до конца вашего хода. Бейте до хитростей.', { n: ed.alarm })));
    if (e.mist) st.push(chip('s-weak', tr('Туман ≤{n}', { n: e.mist }), tr('Пока туман, любой удар по ней наносит не больше {n} урона. Поджог проходит. Туман рассеется, когда она снова сходит.', { n: e.mist })));
    const bi = ed.pattern.findIndex((p) => p.k === 'boom');
    if (bi >= 0) { const L = ed.pattern.length; const left = ((bi - (e.pi % L)) + L) % L + 1; st.push(chip('s-burn', tr('Фитиль {n}', { n: left }), tr('Через {n} {n|ход|хода|ходов} шутиха взорвётся: сильно ударит и исчезнет. Победите её раньше, если успеете.', { n: left }))); }
    if (e.stun) st.push(chip('s-weak', tr('Спит'), g('Спит'), sti('asleep')));
    if (C.stolen) st.push(chip('s-gold', tr('Украдено {n}', { n: C.stolen }), g('Кража'), sti('steal')));
    $('.estatus').innerHTML = st.join('');
    // статусы Ивы и активные чары
    const hs = [];
    const res = C.str + C.tmpStr;
    if (res) hs.push(chip('h-res', tr('Решимость {n}', { n: res }), `${g('Решимость')}${C.tmpStr ? ` ${tr('До конца хода: {n}.', { n: C.tmpStr })}` : ''}`, sti('resolve')));
    if (C.thorns) hs.push(chip('h-thorns', tr('Шипы {n}', { n: C.thorns }), g('Шипы'), sti('thorns')));
    if (C.dog > 0) hs.push(chip('h-dog', `${C.dog}`, `${g('Дружок')} ${tr('Злость {n}: укус на {d}', { n: C.dog, d: dogDmg() })}${C.charms.wolfhound ? `, ${tr('{n} {n|раз|раза|раз} за ход', { n: 1 + C.charms.wolfhound })}` : ''}.`, Art.icon('dogfriend')));
    if (C.glaze) hs.push(chip('h-charm', '', `${CARDS.glaze.name}: ${tr('до конца боя все Пряники улучшены')}`, Art.icon('glaze')));
    if (C.paid) hs.push(chip('h-paid', tr('Цена {n}', { n: C.paid }), `${g('Цена')} ${tr('В этом бою уже отдано {n} HP.', { n: C.paid })}`, sti('price')));
    if (C.pWeak) hs.push(chip('h-weak', tr('Слабость {n}', { n: C.pWeak }), tr('Слабость: ваши атаки наносят на 25% меньше урона.'), sti('weak')));
    if (C.frail) hs.push(chip('h-weak', tr('Хрупкость {n}', { n: C.frail }), g('Хрупкость'), sti('frail')));
    if (C.deliveries.length) hs.push(chip('h-del', tr('Доставка {n}', { n: C.deliveries.length }), `${g('Доставка')} ${tr('В пути: {list}.', { list: C.deliveries.map((d) => d.name).join(', ') })}`, sti('delivery')));
    for (const [id, n] of Object.entries(C.charms)) hs.push(chip('h-charm', `${n}`, `${CARDS[id].name}: ${CHARM_TIP[id](n)}`, Art.card(id)));
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
      const cost = playCost(c);
      const can = cost != null && cost <= C.energy;
      let left = x0 + i * step;
      if (i === selected) left = Math.max(26, Math.min(400 - W - 26, left));
      return cardHTML(c, `inhand ${can ? '' : 'nope'} ${i === selected ? 'sel' : ''} ${dealAnim ? 'deal' : ''}`,
        `data-hi="${i}" style="left:${left}px; --rot:${rot}deg; --lift:${lift}px; --d:${i * 60}ms; z-index:${i === selected ? 50 : i + 1}"`);
    }).join('');
  }

  // почему карту сейчас нельзя разыграть (null — можно)
  function cantPlay(c) {
    const cost = playCost(c);
    if (cost == null) return tr('Эту карту нельзя разыграть');
    if (cost > C.energy) return tr('Не хватает энергии');
    const price = CARDS[c.id].price ? CARDS[c.id].price(c.up) : 0;
    if (price && price >= run.hp) return tr('Не хватит здоровья, чтобы заплатить Цену');
    return null;
  }

  // dragEl — карта, которую вытянули из руки: она улетает с того места, где её отпустили
  async function playCard(i, dragEl) {
    const c = C.hand[i];
    const cd = CARDS[c.id];
    const why = cantPlay(c);
    if (why) { SND.sfx('deny'); toast(why); return; }
    const cost = playCost(c);
    const price = cd.price ? cd.price(c.up) : 0;
    busy = true; selected = -1;
    const el = dragEl || $(`.hand [data-hi="${i}"]`);
    SND.sfx('card');
    if (el) { el.classList.add('fly'); await sleep(220); }
    C.energy -= cost;
    C.hand.splice(i, 1);
    renderCombat();
    if (price) await api.price(price);
    if (cd.type === 'atk' && !C.firstAtk) {
      C.firstAtk = true;
      if (proc('magnifier', 'enemy')) api.vuln(2);
    }
    C.fx = ATK_FX[c.id]; C.fxHits = 0;
    if (CAST_FX[c.id]) FX.play(...CAST_FX[c.id]);
    await cd.play(api, c.up, c);
    // Осколок зеркала: первая карта хода срабатывает ещё раз
    if (C.playedTurn === 0 && cd.type !== 'status' && C.enemy.hp > 0 && run.hp > 0 && proc('mirrorshard')) {
      floatText($('.hero-fx'), tr('Отражение!'), 'weakf'); await sleep(200);
      await cd.play(api, c.up, c);
    }
    if (cd.type === 'atk') C.atkTurn = true;
    if (cd.type !== 'status') C.last = c;
    if (cd.type === 'charm') C.exh.push(c);
    else if (cd.exhaust) exhaustCard(c);
    else C.disc.push(c);
    C.playedTurn++; C.playedTotal++; STATS.cards++; stAdd('cards');
    if (cd.rarity !== 'status') ach.put('played', c.id);
    if (cd.rarity === 'rare') ach.put('rareplayed', c.id);
    if (cd.rarity === 'legendary') ach.flag('legendcard');
    if (C.playedTurn >= 8) ach.flag('combo');
    achCheck();
    // отклики чар и талисманов на розыгрыш
    if (cd.type === 'skill' && C.charms.inkpen && C.enemy.hp > 0) await strike(C.charms.inkpen, 'ink');
    if (cd.type === 'skill' && proc('buckle')) api.block(3);
    if (c.id === 'gingerbread') {
      C.ginger++; ach.add('ginger');
      if (C.charms.gingerhouse && C.enemy.hp > 0) await strike(4 * C.charms.gingerhouse, 'crumbs');
    }
    if (C.playedTurn % 5 === 0 && C.enemy.hp > 0 && proc('milestone', 'enemy')) { floatText($('.enemy-fx'), tr('Верста!'), 'weakf'); await strike(8, 'heavy'); }
    if (C.charms.rhythm && C.playedTurn % 3 === 0 && C.enemy.hp > 0) await api.flame(C.charms.rhythm);
    if (C.playedTotal % 6 === 0 && proc('stampbook')) api.energy(1);
    if (C.playedTurn % 4 === 0 && proc('wingboots')) { api.energy(1); drawCards(1); }
    // приёмы врага в ответ на ваши карты
    const ed = ENEMIES[C.id];
    if (ed.alarm && cd.type === 'skill' && C.enemy.hp > 0) { C.enemy.block += ed.alarm; SND.sfx('clank'); floatText($('.enemy-fx'), tr('Тук-тук! +{n}', { n: ed.alarm }), 'blockf'); }
    if (ed.tally && C.playedTurn % ed.tally === 0 && C.enemy.hp > 0 && run.hp > 0) { floatText($('.enemy-fx'), tr('Ку-ку!'), 'weakf'); await hitHero(3); }
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

  // кадры нарисованного врага: attack | hurt | death (если есть раскадровка)
  const eAct = (k) => (Art.act ? Art.act($('#enemy'), k, SETTINGS.fast ? 2 : 1) : 0);

  function heroLunge() {
    const p = $('#heroPortrait'); if (!p) return;
    p.classList.remove('lunge'); void p.offsetWidth; p.classList.add('lunge');
  }

  // quiet: звук удара уже сыграла анимация приёма
  async function hitEnemy(dmg, quiet) {
    const e = C.enemy;
    if (e.mist > 0 && dmg > e.mist) dmg = e.mist; // туман глушит сильные удары
    const absorbed = Math.min(e.block, dmg);
    e.block -= absorbed;
    const real = dmg - absorbed;
    e.hp -= real;
    ach.max('maxhit', dmg);
    stAdd('dmg', real); if (run.st && dmg > run.st.hit) run.st.hit = dmg;
    if (real > 0 && ENEMIES[C.id].boil && e.hp > 0 && e.boil < 5) e.boil++;
    nestCheck();
    const el = $('#enemy');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    eAct('hurt');
    if (real <= 0) SND.sfx('clank');
    else if (!quiet) SND.sfx('hit', Math.min(1.4, 0.6 + real / 15));
    floatText($('.enemy-fx'), real > 0 ? `-${real}` : tr('Блок'), real > 0 ? 'dmgf' : 'blockf');
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
    floatText($('.enemy-fx'), tr('Внутри ещё одна!'), 'weakf');
    return true;
  }

  async function burst() {
    const fx = document.createElement('div');
    fx.className = 'burst'; fx.innerHTML = `${Art.flame(1.4)}<span>${tr('Вспышка!')}</span>`;
    $('.enemy-zone').appendChild(fx);
    SND.sfx('burst');
    await sleep(380);
    ach.add('bursts');
    if (++C.burstsTurn >= 2) ach.flag('dblburst');
    let dmg = BURST_DMG + (proc('flint') ? 5 : 0);
    if (C.enemy.vuln > 0) dmg = Math.floor(dmg * 1.5);
    FX.play('flash', 'enemy');
    await hitEnemy(dmg, true);
    if (proc('stub')) api.heal(2);
    if (C.enemy.hp > 0 && proc('snowglobe', 'enemy')) api.weak(1);
    if (proc('ivalamp')) C.flame += 1;
    if (proc('wickcutter')) api.block(4);
    setTimeout(() => fx.remove(), 500);
    renderCombat();
  }

  async function hitHero(dmg) {
    const absorbed = Math.min(C.block, dmg);
    C.block -= absorbed;
    let real = dmg - absorbed;
    // Подкова смягчает первый пропущенный удар в бою
    if (real > 1 && !C.shoe && proc('horseshoe')) { C.shoe = true; real = 1; floatText($('.hero-fx'), tr('Подкова!'), 'blockf'); }
    loseHp(real);
    if (real > 0) FX.play('claw'); else FX.play('shield');
    const p = $('#heroPortrait');
    if (p) { p.classList.remove('hurt'); void p.offsetWidth; p.classList.add('hurt'); }
    SND.sfx(real > 0 ? 'hurt' : 'clank');
    floatText($('.hero-fx'), real > 0 ? `-${real}` : tr('Блок'), real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(300);
    // окованный ставень: удар целиком в защиту — враг получает в ответ
    if (dmg > 0 && real === 0 && absorbed > 0 && C.enemy.hp > 0 && proc('ironshutter', 'enemy')) await strike(4, 'heavy');
    return real;
  }

  function loseHp(n) {
    if (n <= 0) return;
    stAdd('taken', Math.min(n, run.hp));
    run.hp = Math.max(0, run.hp - n);
    // Последняя свеча: один раз за забег спасает от гибели
    if (run.hp <= 0 && !run.candle && proc('lastcandle')) {
      run.candle = true; run.hp = Math.ceil(run.maxHp / 2);
      SND.sfx('heal'); FX.play('heal'); toast(tr('Последняя свеча вспыхнула: половина HP'));
    }
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
      if (cands.length) { ribbon = cands.reduce((a, b) => ((costOf(b) || 0) > (costOf(a) || 0) ? b : a)); proc('ribbon'); }
    }
    let dread = 0;
    C.vane = C.hand.length === 0 && proc('vanefeather');
    C.medal = C.playedTurn >= 6 && proc('medal');
    if (C.charms.nightshift && C.energy > 0) api.block(C.charms.nightshift * C.energy);
    for (const c of C.hand) {
      const cd = CARDS[c.id];
      if (c.id === 'dread') dread += 2;
      if (c.id === 'ash') dread += 3;
      if (cd.ethereal) exhaustCard(c);
      else if (cd.retain || c === ribbon || (hasRelic('magicbag') && cd.type !== 'status')) { keep.push(c); if (cd.onRetain) cd.onRetain(c, c.up); }
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
    // пёс пастушки кусает в конце хода
    if (C.dog > 0 && C.enemy.hp > 0) {
      for (let k = 0; k < 1 + (C.charms.wolfhound || 0) && C.enemy.hp > 0; k++) await api.bite();
      if (C.enemy.hp <= 0) { await winCombat(); return; }
    }
    const e = C.enemy;
    if (!ENEMIES[C.id].plating) e.block = 0; // у Ледяного Рыцаря латы
    e.mist = 0; // туман рассеивается, когда враг снова ходит
    if (e.burn > 0) {
      FX.play('fire', 'enemy');
      e.hp -= e.burn; stAdd('dmg', e.burn);
      floatText($('.enemy-fx'), `-${e.burn}`, 'burnf');
      $('#enemy').classList.add('hit');
      eAct('hurt');
      e.burn--;
      if (e.hp > 0 && proc('stokerglove')) api.block(2);
      nestCheck();
      renderCombat();
      await sleep(400);
      if (e.hp <= 0) { ach.flag('burnkill'); await winCombat(); return; }
    }
    const el = $('#enemy');
    if (e.stun > 0) {
      e.stun--;
      floatText($('.enemy-fx'), tr('Спит…'), 'weakf');
      await sleep(500);
    } else {
      for (const it of currentIntents()) {
        if (it.k === 'attack' || it.k === 'snuff' || it.k === 'steal') {
          if (it.k === 'snuff') {
            if (proc('eternaloil')) floatText($('.hero-fx'), tr('Огоньки не гаснут'), 'blockf');
            else { C.flame = 0; SND.sfx('snuff'); floatText($('.hero-fx'), tr('Огоньки погасли'), 'weakf'); }
          }
          for (let h = 0; h < (it.hits || 1); h++) {
            el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
            const strikeMs = eAct('attack'); // урон приходит в момент нарисованного удара
            SND.sfx('enemy');
            await sleep(Math.min(560, Math.max(180, strikeMs)));
            const real = await hitHero(enemyDmg(it.v));
            // Упырь пьёт тепло: лечится на прошедший урон
            if (it.leech && real > 0 && e.hp > 0) { const b = e.hp; e.hp = Math.min(e.max, e.hp + real); if (e.hp > b) { SND.sfx('heal'); floatText($('.enemy-fx'), `+${e.hp - b}`, 'healf'); } }
            if (run.hp <= 0 || e.hp <= 0) break;
            // Шипы героя ранят врага за каждый удар
            if (C.thorns > 0) { await strike(C.thorns, 'spikes'); if (e.hp <= 0) { ach.flag('thornskill'); break; } }
          }
          if (it.k === 'steal' && run.hp > 0) {
            const g = Math.min(run.gold, it.gold);
            if (g > 0) { run.gold -= g; C.stolen += g; SND.sfx('coin'); floatText($('.hero-fx'), tr('−{n} {n|монета|монеты|монет}', { n: g }), 'weakf'); }
          }
        } else if (it.k === 'boom') {
          el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
          const boomMs = eAct('attack');
          SND.sfx('burst');
          floatText($('.enemy-fx'), tr('Бабах!'), 'burnf');
          await sleep(Math.min(560, Math.max(200, boomMs)));
          await hitHero(enemyDmg(it.v));
          e.hp = 0; C.boomed = true;
        } else if (it.k === 'sap') { C.sap += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), tr('−{n} {n|энергия|энергии|энергии}', { n: it.v }), 'weakf'); }
        else if (it.k === 'mist') { e.mist = it.v; SND.sfx('debuff'); floatText($('.enemy-fx'), tr('Туман'), 'weakf'); }
        else if (it.k === 'bury') { C.bury += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), tr('Замело: −{n} {n|карта|карты|карт}', { n: it.v }), 'weakf'); }
        else if (it.k === 'frail') { C.frail += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), tr('Хрупкость'), 'weakf'); }
        else if (it.k === 'block') { e.block += it.v; floatText($('.enemy-fx'), `+${it.v}`, 'blockf'); }
        else if (it.k === 'buff') { e.str += it.v; SND.sfx('buff'); floatText($('.enemy-fx'), tr('Сила +{n}', { n: it.v }), 'burnf'); }
        else if (it.k === 'debuff') { C.pWeak += it.v; SND.sfx('debuff'); floatText($('.hero-fx'), tr('Слабость'), 'weakf'); }
        else if (it.k === 'heal') { const b = e.hp; e.hp = Math.min(e.max, e.hp + it.v); SND.sfx('heal'); floatText($('.enemy-fx'), `+${e.hp - b}`, 'healf'); }
        else if (it.k === 'spikes') { e.thorns += it.v; SND.sfx('buff'); floatText($('.enemy-fx'), tr('Колючки +{n}', { n: it.v }), 'burnf'); }
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
    const dl = !C.boomed && lineOf(C.id, 'death');
    if (dl && SETTINGS.lines !== false) { say(dl, 1600); await sleep(800); }
    // нарисованная гибель играет до конца (останки сами тают), иначе прежнее растворение
    const sp = SETTINGS.fast ? 2 : 1;
    const dur = el && Art.actDur ? Art.actDur(el, 'death', sp) : 0;
    if (el && dur) { el.style.setProperty('--dd', `${dur}ms`); el.classList.add('dying', 'drawn'); eAct('death'); await sleep(dur + 200); }
    else { if (el) el.classList.add('dying'); await sleep(800); }
    const { tier, stolen, hpLost, id, turn, boomed, paid, tie } = C;
    // Ремень для правки: одна заточенная карта остаётся улучшенной
    const sharp = [...C.draw, ...C.hand, ...C.disc, ...C.exh].filter((c) => c.sharp).map((c) => c.uid);
    C = null;
    if (hasRelic('leatherstrop')) {
      const cand = run.deck.filter((c) => sharp.includes(c.uid) && canUpgrade(c));
      if (cand.length) { const c = pick(cand); c.up = true; achUpgraded(1); toast(`${RELICS.leatherstrop.name}: ${tr('{card} навсегда', { card: cardName(c) })}`); }
    }
    if (hasRelic('herbbag') && paid > 1) { evApi.heal(Math.floor(paid / 2)); toast(`${RELICS.herbbag.name}: +${Math.floor(paid / 2)} HP`); }
    STATS.fights++;
    if (tier === 'elite') { STATS.elites++; stAdd('elites'); }
    if (tier === 'boss') { STATS.bosses++; stAdd('bosses'); }
    ACH.k[id] = (ACH.k[id] || 0) + 1; // для базы знаний
    if (run.killed && !run.killed.includes(id)) run.killed.push(id);
    if (tie === 'avenge') ach.add('avenged');
    if (tie === 'rival') ach.add('rivals');
    ach.put('beaten', id);
    if (tier === 'boss') ach.put('bosses', id);
    if (!hpLost) ach.flag('flawless');
    if (!hpLost && tier === 'elite') ach.flag('flawlesselite');
    if (turn === 1) ach.flag('oneturn');
    if (id === 'firecracker' && !boomed) ach.flag('defuse');
    saveStats();
    run.fights++; run.lit++;
    if (stolen) { run.gold += stolen; toast(tr('Монеты возвращены: +{n}', { n: stolen })); }
    if (hasRelic('piggy') && !hpLost) { gain(15); toast(`${RELICS.piggy.name}: ${coins(15)}`); }
    setBg();
    if (hasRelic('snowman')) evApi.heal(4);
    if (hasRelic('candybox') && tier === 'elite') { evApi.heal(10); toast(`${RELICS.candybox.name}: +10 HP`); }
    if (hasRelic('thermos') && run.hp < run.maxHp / 2) { evApi.heal(12); toast(`${RELICS.thermos.name}: +12 HP`); }
    if (tier === 'boss' && isFinalStep(run.step)) {
      if (ENEMIES[id].dark) { ach.put('darkbeaten', ENEMIES[id].dark); run.finalDark = ENEMIES[id].dark; }
      goVictory(); return;
    }
    if (wantsPlea(id, tier)) { goAfter(tier, id); return; }
    if (tier === 'boss') { goBossRelic(); return; }
    goReward(tier);
  }

  /* ---------- Трофей босса: один из трёх талисманов босса ---------- */
  function goBossRelic(saved) {
    if (!saved) { SND.sfx('win'); SND.music(mapTrack()); }
    const opts = saved || shuffle(Object.keys(RELICS).filter((r) => RELICS[r].tier === 'boss' && !hasRelic(r))).slice(0, 3);
    if (!opts.length) { goReward('boss'); return; }
    save({ t: 'bossrelic', opts });
    opts.forEach((r) => codexMark('r', r));
    screen.className = 'scr-bossrelic';
    screen.innerHTML = `${topBar()}
      <div class="ribbon">${tr('Трофей босса')}</div>
      <p class="pickhint">${tr('Выбери один талисман')}</p>
      <div class="brelics">${opts.map((id, i) => `<button class="brelic" data-act="bossrelic" data-id="${id}" style="--d:${i * 120}ms">${Art.relic(id)}<span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></span></button>`).join('')}</div>
      <button class="btn ghost" data-act="bossrelic-skip">${tr('Не брать')}</button>
      ${heroBar(false)}`;
  }

  /* ---------- Награда ---------- */
  function goReward(tier) {
    setBg();
    const boss = tier === 'boss';
    const gold = Math.round(goldFor(tier) * ((run.fmod && run.fmod.goldMul) || 1));
    run.fmod = null;
    gain(gold);
    if (!boss) { SND.sfx('win'); SND.music(mapTrack()); }
    if (tier === 'elite') evApi.giveRelic();
    // после босса стадии Ива переводит дух
    const healed = boss ? Math.min(run.maxHp - run.hp, Math.round(run.maxHp * DIFF().bossHeal)) : 0;
    run.hp += healed; stAdd('healed', healed);
    // пороги [легендарная, эпическая, редкая, необычная]: после элит и боссов редкие выпадают чаще
    const odds = boss ? [0.1, 0.4, 1, 1] : tier === 'elite' ? [0.02, 0.12, 0.35, 0.75] : [0, 0.03, 0.11, 0.43];
    const count = Math.max(2, 3 + (hasRelic('clover') ? 1 : 0) - (hasRelic('crown') ? 1 : 0));
    const ids = [];
    while (ids.length < count) {
      const id = pickCard(rollRarity(odds), ids);
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
      <div class="ribbon">${boss ? tr('Босс повержен!') : tr('Победа!')}</div>
      <div class="loot">${Art.icon('coin')} ${coins(gold)}${healed ? ` · +${healed} HP` : ''}</div>
      <p class="pickhint">${tr('Возьми одну карту в колоду')}</p>
      <div class="reward-cards n${count}">${ids.map((id, i) => cardHTML(id, 'reward', `data-act="takecard" data-id="${id}" style="--d:${i * 120}ms"`)).join('')}</div>
      <button class="btn ghost" data-act="next">${tr('Пропустить')}</button>
      ${heroBar(false)}`;
  }

  /* ---------- Финалы ---------- */
  // картинка финала: какой финальный босс был побеждён
  function endingKey() {
    const f = run && run.final;
    const k = !f ? '' : f.startsWith('dk_') ? 'ending_darkhero' : `ending_${f}`;
    return picFits(k) ? k : 'story_win';
  }
  function goVictory() {
    clearSave();
    STATS.wins++; STATS.best = MAX_STEPS;
    if (run.deck.length <= 15) ach.flag('light');
    const log = run.meetLog || [];
    if (log.length >= 4 && log.every((k) => k === 'help' || k === 'tie')) ach.flag('allhelp');
    const saved = run.finalDark || run.forgiven;
    ach.put('winsCls', run.cls);
    ach.put('winsDiff', diffOf(run));
    finishRun(true);
    saveStats();
    SND.music('title'); SND.sfx('victory');
    screen.className = 'scr-end win';
    screen.innerHTML = `<div class="ribbon">${STORY.winRibbon}</div>
      <div class="book"><div class="page">
        ${bookArt(endingKey(), 'moon')}
        <h1>${STORY.winTitle}</h1>
        <p class="story">${txt(STORY.winText)}${saved && LORE.DARK[saved] ? ` ${tr(LORE.DARK[saved].saved)}` : ''}</p>
        <p class="stats">${DIFF().name} · ${tr('Побед: {n}', { n: run.fights })} · ${tr('Карт в колоде: {n}', { n: run.deck.length })} · ${tr('Талисманов: {n}', { n: run.relics.length })}</p>
      </div></div>
      <div class="endbtns"><button class="btn big" data-act="summary">${tr('Итоги забега')}</button><button class="btn ghost" data-act="title">${tr('Главное меню')}</button></div>`;
    fitBook();
  }
  /* После поражения можно начать бой заново или вернуться на развилку перед боем:
     за просмотр рекламы, а в режиме без рекламы сразу. Или закончить забег. */
  let snapStep = null;
  let snapFight = null;
  function goDefeat() {
    if (!snapFight) { endRun(); return; }
    if (C && run.st) run.st.by = C.id;
    C = null; busy = false;
    clearSave();
    SND.music(null); SND.sfx('defeat');
    const tag = Store.noAds() ? '' : `<i class="adtag">${ICO.ad}${tr('Реклама')}</i>`;
    screen.className = 'scr-end lose revive';
    screen.innerHTML = `<div class="book"><div class="page">
        ${bookArt('story_lose', 'dim')}
        <h1>${tr('Тени настигли')}</h1>
        <p class="story">${tr('Но письмо ещё можно спасти. Попробуйте этот бой снова или вернитесь на развилку перед ним и выберите другой путь.')}</p>
      </div></div>
      <div class="endbtns">
        <button class="btn big rv" data-act="revive-fight">${tag}${tr('Начать бой заново')}<small>${tr('с теми же HP и колодой, что перед боем')}</small></button>
        ${snapStep ? `<button class="btn rv" data-act="revive-step">${tag}${tr('Вернуться до боя')}<small>${tr('снова на развилке перед этим боем')}</small></button>` : ''}
        <button class="btn ghost" data-act="giveup">${tr('Закончить забег')}</button></div>`;
    fitBook();
  }
  async function revive(kind) {
    if (busy) return;
    busy = true;
    const seen = await Store.ad(tr(kind === 'fight' ? 'Бой начнётся заново' : 'Вернуться на развилку перед боем'));
    busy = false;
    if (!seen) { toast(tr('Реклама не досмотрена')); return; }
    if (!Store.noAds()) { STATS.ads = (STATS.ads || 0) + 1; }
    STATS.revives = (STATS.revives || 0) + 1; saveStats();
    SND.sfx('heal');
    const prevSt = run.st;
    if (kind === 'fight') {
      const f = snapFight;
      run = JSON.parse(f.run);
      keepSt(prevSt);
      save({ t: f.tier, enemy: f.enemyId });
      setBg();
      startCombat(f.enemyId, f.tier);
    } else {
      run = JSON.parse(snapStep);
      keepSt(prevSt);
      goMap();
    }
    toast(tr('Ещё одна попытка!'));
  }
  function endRun() {
    snapFight = null; snapStep = null;
    if (C && run.st) run.st.by = C.id;
    C = null;
    clearSave();
    STATS.losses++;
    finishRun(false);
    saveStats();
    SND.music(null); SND.sfx('defeat');
    screen.className = 'scr-end lose';
    screen.innerHTML = `<div class="book"><div class="page">
        ${bookArt('story_lose', 'dim')}
        <h1>${STORY.loseTitle}</h1>
        <p class="story">${txt(STORY.loseText)}</p>
        <p class="stats">${DIFF().name} · ${tr('Пройдено уровней: {a} из {b}', { a: run.step + 1, b: MAX_STEPS })} · ${tr('Побед: {n}', { n: run.fights })}</p>
      </div></div>
      <div class="endbtns"><button class="btn big" data-act="summary">${tr('Итоги забега')}</button><button class="btn ghost" data-act="title">${tr('Главное меню')}</button></div>`;
    fitBook();
  }

  /* ---------- Итоги забега: запись в историю и экран итогов ---------- */
  let lastRec = null;
  function finishRun(win) {
    if (run.done) return lastRec;
    run.done = true;
    stTick();
    const s = run.st || stNew();
    const rec = {
      at: Date.now(), win, cls: run.cls || 'lamp', diff: diffOf(run), lvl: win ? MAX_STEPS : Math.min(MAX_STEPS, run.step + 1),
      ms: s.ms, fights: run.fights, elites: s.elites || 0, bosses: s.bosses || 0, dmg: s.dmg, hit: s.hit, taken: s.taken, healed: s.healed,
      cards: s.cards, gold: s.gold, spent: s.spent, deck: run.deck.length, ups: run.deck.filter((c) => c.up).length,
      relics: run.relics.slice(), by: win ? null : s.by || null, fin: win ? run.final || null : null,
      met: (run.met || []).length, fallen: (run.fallen || []).length, revives: s.revives || 0,
    };
    RUNS.list.unshift(rec);
    if (RUNS.list.length > RUNS_MAX) RUNS.list.length = RUNS_MAX;
    saveJSON(RUNS_KEY, RUNS);
    STATS.dmg = (STATS.dmg || 0) + rec.dmg;
    STATS.ms = (STATS.ms || 0) + rec.ms;
    STATS.gold = (STATS.gold || 0) + rec.gold;
    STATS.runDmg = Math.max(STATS.runDmg || 0, rec.dmg);
    if (win) STATS.fast = STATS.fast ? Math.min(STATS.fast, rec.ms) : rec.ms;
    lastRec = rec;
    return rec;
  }
  // время в пути: минуты, а с часа — часы и минуты
  const fmtTime = (ms) => {
    const m = Math.max(1, Math.round((ms || 0) / 60000));
    return m < 60 ? tr('{n} мин', { n: m }) : tr('{h} ч {m} мин', { h: Math.floor(m / 60), m: m % 60 });
  };
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(I18N.locale, { day: 'numeric', month: 'long' });
  const foeName = (id) => (id && ENEMIES[id] ? ENEMIES[id].name : '');
  function summaryHTML(rec) {
    const cls = CLASSES[rec.cls] ? rec.cls : 'lamp';
    const d = DIFFICULTIES[rec.diff] || DIFFICULTIES[1];
    const last = rec.win ? (foeName(rec.fin) && tr('Финальный бой: {name}', { name: foeName(rec.fin) }))
      : (foeName(rec.by) && tr('Последний бой: {name}', { name: foeName(rec.by) }));
    const tile = (label, value, sub) => `<div class="sumtile"><small>${label}</small><b>${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    const relics = rec.relics.filter((r) => RELICS[r]);
    const notes = [
      rec.met ? tr('Встречено героев: {n}', { n: rec.met }) : '',
      rec.fallen ? tr('Ушли в Тень: {n}', { n: rec.fallen }) : '',
      rec.revives ? tr('Повторных боёв: {n}', { n: rec.revives }) : '',
    ].filter(Boolean);
    return `<div class="sumcard ${rec.win ? 'win' : 'lose'}">
      <div class="sumhead">
        <span class="sumface">${heroFace(cls)}</span>
        <span class="sumwho"><b>${CLASSES[cls].name}</b><small>${d.name}</small><small>${fmtDate(rec.at)}</small></span>
        <span class="sumres">${rec.win ? tr('Письмо доставлено') : tr('Тени настигли')}</span>
      </div>
      ${last ? `<p class="sumlast">${last}</p>` : ''}
      <div class="sumgrid">
        ${tile(tr('Уровень'), tr('{a} из {b}', { a: rec.lvl, b: MAX_STEPS }))}
        ${tile(tr('Время в пути'), fmtTime(rec.ms))}
        ${tile(tr('Побед в боях'), fmt(rec.fights), tr('элит: {a} · боссов: {b}', { a: rec.elites, b: rec.bosses }))}
        ${tile(tr('Сыграно карт'), fmt(rec.cards))}
        ${tile(tr('Урон врагам'), fmt(rec.dmg), tr('сильнейший удар: {n}', { n: fmt(rec.hit) }))}
        ${tile(tr('Потеряно HP'), fmt(rec.taken), tr('вылечено: {n}', { n: fmt(rec.healed) }))}
        ${tile(tr('Монет собрано'), fmt(rec.gold), tr('потрачено: {n}', { n: fmt(rec.spent) }))}
        ${tile(tr('Колода'), tr('{n} {n|карта|карты|карт}', { n: rec.deck }), tr('улучшено: {n}', { n: rec.ups }))}
      </div>
      <div class="sumrel"><small>${tr('Талисманы')} · ${relics.length}</small><div>${relics.map((r) => `<span class="sumr" title="${RELICS[r].name}">${Art.relic(r)}</span>`).join('')}</div></div>
      ${notes.length ? `<p class="sumnote">${notes.join(' · ')}</p>` : ''}
    </div>`;
  }
  function goSummary(rec = lastRec) {
    if (!rec) { goTitle(); return; }
    C = null; busy = false;
    hideOverlay();
    screen.className = 'scr-summary';
    screen.innerHTML = `<div class="ribbon">${tr('Итоги забега')}</div>
      ${summaryHTML(rec)}
      <div class="endbtns"><button class="btn big" data-act="retry">${tr('Новый забег')}</button><button class="btn ghost" data-act="title">${tr('Главное меню')}</button></div>`;
  }

  /* ---------- Обработка нажатий ---------- */
  /* Звук включается по первому касанию; шестерёнка в углу открывает настройки */
  window.addEventListener('pointerdown', () => SND.unlock(), { capture: true });
  app.classList.toggle('fast', SETTINGS.fast);
  const gearBtn = $('#gear');
  gearBtn.innerHTML = ICO.gear;
  gearBtn.setAttribute('aria-label', tr('Настройки'));
  gearBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); showSettings(); });

  const menuBtn = $('#menu');
  menuBtn.setAttribute('aria-label', tr('Меню'));
  menuBtn.innerHTML = '<svg viewBox="0 0 40 40"><path d="M10 12 h20 M10 20 h20 M10 28 h20" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round"/></svg>';
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); if (run) showPause(); else showGlossary(); });

  /* ---------- Карту можно вытянуть из руки: отпущенная выше руки, она разыгрывается ---------- */
  const PLAY_Y = 540; // выше этой линии (чуть над рукой) карта сыграет
  let drag = null; let dragEndAt = 0;
  const toLocal = (e) => { const r = app.getBoundingClientRect(); const k = r.width / 400; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
  app.addEventListener('pointerdown', (e) => {
    if (screen.className !== 'scr-combat' || busy || !C || drag || e.button > 0) return;
    const el = e.target.closest('.hand [data-hi]');
    if (!el) return;
    const p = toLocal(e);
    drag = { i: +el.dataset.hi, el, x0: p.x, y0: p.y, on: false, ready: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toLocal(e);
    const dx = p.x - drag.x0; const dy = p.y - drag.y0;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 12 || busy) return;
      drag.on = true;
      if (selected >= 0) { selected = -1; renderHand(false); drag.el = $(`.hand [data-hi="${drag.i}"]`); }
      if (!drag.el) { drag = null; return; }
      drag.el.classList.add('drag'); SND.sfx('draw');
    }
    drag.el.style.setProperty('--dx', `${dx}px`); drag.el.style.setProperty('--dy', `${dy}px`);
    const ready = p.y < PLAY_Y && dy < -50;
    if (ready !== drag.ready) {
      drag.ready = ready; drag.el.classList.toggle('ready', ready);
      app.classList.toggle('aim', ready && CARDS[C.hand[drag.i].id].type === 'atk');
      if (ready) SND.sfx('click');
    }
  });
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    app.classList.remove('aim');
    if (!d.on) return; // простое касание: дальше сработает click
    dragEndAt = performance.now();
    if (!cancel && d.ready && !busy && C && C.hand[d.i]) {
      const why = cantPlay(C.hand[d.i]);
      if (!why) { playCard(d.i, d.el); return; }
      SND.sfx('deny'); toast(why);
    }
    d.el.classList.remove('drag', 'ready'); // карта возвращается в руку
  }
  window.addEventListener('pointerup', (e) => endDrag(e));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));

  app.addEventListener('click', (e) => {
    SND.unlock();
    if (overlay.contains(e.target)) { if (!e.target.matches('input')) SND.sfx('click'); return; }
    const relic = e.target.closest('[data-relic]');
    if (relic) { const r = RELICS[relic.dataset.relic]; toast(`${r.name}: ${r.desc}`); return; }
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl) { toast(tipEl.dataset.tip); return; }
    const t = e.target.closest('[data-act], [data-hi]');

    if (screen.className === 'scr-combat') {
      if (busy || performance.now() - dragEndAt < 350) return;
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
      case 'store': goStore(t.dataset.back || 'title'); break;
      case 'sback': if (screen.dataset.back === 'cls' && storeBackCls) goClassSelect(...storeBackCls); else goTitle(); break;
      case 'sbuy': storeBuy(t.dataset.p, () => (screen.className === 'scr-class' ? goClassSelect(screen.dataset.cls, +screen.dataset.diff) : goStore(screen.dataset.back))); break;
      case 'srestore': Store.restore().then((n) => toast(n ? tr('Покупки восстановлены: {n}', { n }) : tr('Покупок пока нет'))); break;
      case 'sreset': Store.resetTest(); toast(tr('Тестовые покупки сброшены')); goStore(screen.dataset.back); break;
      case 'revive-fight': revive('fight'); break;
      case 'revive-step': revive('step'); break;
      case 'giveup': endRun(); break;
      case 'clsgo': if (!Store.heroOwned(screen.dataset.cls)) break; SETTINGS.cls = screen.dataset.cls; SETTINGS.diff = +screen.dataset.diff; saveJSON(SETTINGS_KEY, SETTINGS); if (SETTINGS.skipIntro) newRun(); else goIntro(); break;
      case 'clscards': showClassCards(screen.dataset.cls); break;
      case 'title': goTitle(); break;
      case 'summary': goSummary(); break;
      case 'stats': showStats(); break;
      case 'continue': continueRun(); break;
      case 'newgame': askNewGame(); break;
      case 'gloss': showGlossary(); break;
      case 'settings': showSettings(); break;
      case 'ach': showAchievements(); break;
      case 'codex': showCodex(); break;
      case 'choose': chooseEncounter(+t.dataset.i); break;
      case 'next': advance(); break;
      case 'deck': showDeck(run.deck, `${tr('Колода')} · ${run.deck.length}`); break;
      case 'relics': showRelics(); break;
      case 'pile-draw': showDeck(C.draw, tr('Осталось в колоде')); break;
      case 'pile-disc': showDeck(C.disc, tr('Сброс')); break;
      case 'end': endTurn(); break;
      case 'evopt': eventOption(+t.dataset.i); break;
      case 'talkopt': talkChoose(t.dataset.k); break;
      case 'talkgo': startCombat(screen.dataset.fight || screen.dataset.enemy, screen.dataset.tier); break;
      case 'talkboss': goBossRelic(); break;
      case 'spare': afterChoose(true); break;
      case 'takeall': afterChoose(false); break;
      case 'afternext': afterNext(screen.dataset.tier); break;
      case 'meetopt': meetChoose(t.dataset.k); break;
      case 'openchest': openChest(); break;
      case 'rest-heal': evApi.heal(restHeal()); if (hasRelic('cocoatin')) { run.maxHp += 2; run.hp += 2; toast(`${RELICS.cocoatin.name}: ${tr('+{n} к макс. HP', { n: 2 })}`); } advance(); break;
      case 'rest-up': upgradeFlow((ok) => { if (ok) advance(); }); break;
      case 'rest-burn': removeCardFlow((ok) => { if (ok) advance(); }); break;
      case 'takecard': SND.sfx('card'); run.deck.push(mk(t.dataset.id)); toast(tr('В колоду: {name}', { name: CARDS[t.dataset.id].name })); advance(); break;
      case 'bossrelic': addRelic(t.dataset.id); goReward('boss'); break;
      case 'bossrelic-skip': goReward('boss'); break;
      case 'buy': case 'buyrelic': case 'buytea': case 'buyremove': case 'buyup': screen.onShop(act, +t.dataset.i); break;
    }
  });

  // Для отладки и автотестов
  window.Game = { get run() { return run; }, get combat() { return C; }, newRun, pickCard: (r) => pickCard(r), goMap: () => goMap(), startCombat: (id, t = 'fight') => startCombat(id, t), costOf, addRelic: (id) => addRelic(id), mk, render: () => renderCombat(), freeRelics: () => freeRelics(), goEvent: (id) => goEvent(EVENTS.find((e) => e.id === id)), goTalk: (id, t = 'fight') => goTalk(id, t), goMeet: (h) => goMeet(h), goAfter: (t, id) => goAfter(t, id), goShop: () => goShop(), goRest: () => goRest(), goChest: () => goChest(), goVictory: () => goVictory(), endRun: () => endRun(), finalBoss: () => finalBoss(), showCodex: () => showCodex(), tieOf: (id) => tieOf(id) };

  achCheck(true);
  codexSeed();
  goTitle();
  try {
    if (sessionStorage.getItem('lastray.reopen') === 'settings') { sessionStorage.removeItem('lastray.reopen'); showSettings(); }
  } catch (e) { /* недоступно */ }
})();
