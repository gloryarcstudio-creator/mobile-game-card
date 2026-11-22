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
  /* Баланс длинного сюжета (подобран прогонами бота: tools/sim/sim.js): враги крепнут с каждым уровнем,
     боссы стадий намного крепче обычных врагов и на половине HP впадают в Ярость */
  const LONG = MAX_STEPS > 20;
  const BAL = {
    hpStep: 0.055,           // прирост HP обычных врагов и элит за уровень
    strEvery: [10, 5],        // +1 Силы врагам каждые столько уровней: в городе и на окраине
    eliteHp: [0.95, 1.2],    // множитель HP элит по стадиям
    eliteW: [10, 12],        // вес элиты на развилке по стадиям
    bossHp: [2.2, 2.3, 2.2],   // множители HP боссов: стадия I, стадия II, финал
    bossStr: [0, 4, 5],      // Сила боссов с начала боя
    rageStr: [2, 3, 4],      // Ярость босса: Сила на половине HP
    rageBlock: [8, 12, 16],  // и защита
    eliteAfterCalm: 0.3,     // шанс элиты среди боёв после мирной остановки
    chestRelic: 0.33,        // шанс талисмана в сундуке
    relicPrice: { common: 125, uncommon: 150, rare: 180, epic: 215, legendary: 270 },
    honeBlock: 2,            // точильщик: защита за заточку, которой досталась уже улучшенная карта (то же число в текстах «Заточка» и «Точильный круг» на трёх языках)
  };
  // Сила обычных врагов и элит по уровню: на окраине растёт быстрее
  const lvlStr = (s) => {
    if (!LONG) return Math.floor(s / 3);
    const a = STAGES[0].len;
    return s < a ? Math.floor(s / BAL.strEvery[0]) : Math.floor(a / BAL.strEvery[0]) + Math.floor((s - a) / BAL.strEvery[1]);
  };
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
    ['Слабость', 'Ваши атаки наносят на 25% меньше урона. Число — сколько ходов это продлится.'],
    ['Сила врага', 'Каждое очко добавляет врагу +1 урона. Её можно отнять морозом.'],
    ['Ярость босса', 'Когда у босса остаётся половина HP, он впадает в Ярость: получает Силу и защиту. Приберегите к этому сильный ход.'],
    ['Спит', 'Враг пропускает свой следующий ход.'],
    ['Доставка', 'Эффект карты сработает в начале вашего следующего хода.'],
    ['Серия', 'Карта сильнее за каждую карту, сыгранную до неё в этот ход.'],
    ['Удержание', 'Карта не сбрасывается в конце хода и остаётся в руке.'],
    ['Сгорает', 'После розыгрыша карта уходит до конца боя.'],
    ['Чары', 'Разыгрываются один раз и действуют до конца боя. Активные чары видны над рукой.'],
    ['Пряник', 'Пряничница печёт их прямо в бою. Пряник стоит 0, бьёт и даёт защиту, а после розыгрыша сгорает. После боя Пряники исчезают.'],
    ['Заточка', 'Карта улучшается до конца боя, как у костра. После боя она снова обычная. Заточка уже улучшенной карты даёт 2 защиты.'],
    ['Дружок', 'Пёс пастушки. В конце вашего хода он кусает врага на свою Злость. Команды делают его злее или заставляют кусать сразу.'],
    ['Цена', 'Чтобы сыграть карту, нужно отдать столько HP. Защита не помогает. Последние HP отдать нельзя.'],
    ['Помехи', 'Враги подкидывают в колоду Кляксы, Ледышки, Сургуч и Недоставленные письма. Они исчезают после боя.'],
    ['Кража', 'Некоторые враги крадут монеты. Если победить вора, монеты вернутся.'],
    ['Улучшение', 'У костра, у кузнеца и в лавке карту можно улучшить. Улучшенная карта отмечена плюсом.'],
    ['Талисманы босса', 'После босса стадии можно выбрать один из трёх сильных талисманов. У многих есть цена.'],
    ['Редкость', 'Карты и талисманы бывают пяти редкостей: обычные (серый камень), необычные (зелёный), редкие (синий), эпические (фиолетовый) и легендарные (золотой). Чем сильнее противник, тем чаще после него выпадают редкие. Каждую легендарную карту можно взять в колоду только один раз.'],
    ['Приёмы врагов', 'У многих врагов есть свои хитрости: матрёшки раскрываются, самовар закипает, туман глушит удары, шутиха взрывается. Приёмы видны значками под именем врага, нажмите на значок, чтобы прочитать.'],
    ['Передышка', 'После привала, лавки, сундука, события или встречи дорога ведёт только через бой: на следующей развилке одни противники.'],
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
  const STANDS = '.enemy, .talk-art, .chest, .shopkeeper, .ev-art, .title-hero';
  const MISTY = '.enemy, .talk-art, .chest, .title-hero';   // у кого за ногами стелется дымка
  // Прежний вид фона тает поверх нового: и когда сменилась сама картинка, и когда та же картинка встала иначе
  // (в бою она поднята к ногам врага, на награде и карте пути стоит целиком). Без этого сцена прыгала рывком.
  const camY = (s) => { const m = /translateY\((-?[\d.]+)px\)/.exec(s || ''); return m ? +m[1] : 0; };
  function bgGhost(html, cam) {
    app.querySelectorAll('.bg-ghost').forEach((x) => x.remove());
    const ghost = document.createElement('div');
    ghost.className = 'bg-ghost'; ghost.innerHTML = html;
    if (cam) {
      // снимок сделан уже с новой постановкой: возвращаем ему прежнюю
      const g = ghost.querySelector('.bg-cam'); const low = g && g.querySelector('.bg-low'); const fade = low && low.querySelector('.bg-fade'); const li = ghost.querySelector('.bg-lights');
      if (g) g.style.transform = cam.t;
      if (li) li.style.transform = cam.t;
      if (low) { if (cam.l) low.setAttribute('transform', cam.l); else low.removeAttribute('transform'); }
      if (fade) fade.style.display = cam.f;
    }
    if (SETTINGS.fast) ghost.style.animationDuration = '.2s';
    $('#bg').after(ghost);
    setTimeout(() => ghost.remove(), SETTINGS.fast ? 220 : 480);
  }
  function groundCam(quiet) {
    if (!Art.groundCam) return;
    const bgEl = $('#bg');
    const g = bgEl.querySelector('.bg-cam'); const low = g && g.querySelector('.bg-low'); const fade = low && low.querySelector('.bg-fade');
    const was = g ? { t: g.style.transform, l: low ? low.getAttribute('transform') : null, f: fade ? fade.style.display : '' } : null;
    const el = screen.querySelector(STANDS);
    let y = null;
    if (el && el.offsetHeight) {
      y = el.offsetHeight;
      for (let n = el; n && n !== app; n = n.offsetParent) y += n.offsetTop;
    }
    Art.groundCam(bgEl, y);
    // линия ног для дымки у земли (style.css, #bg::before): стоит фигура — дымка стелется за ней, иначе прячется
    if (y != null && el.matches(MISTY) && app.classList.contains('painted-bg')) { bgEl.style.setProperty('--feet', `${Math.round(y)}px`); bgEl.dataset.feet = '1'; } else delete bgEl.dataset.feet;
    if (was && !quiet && Math.abs(camY(was.t) - camY(g.style.transform)) > 24 && !app.querySelector('.bg-ghost')) bgGhost(bgEl.innerHTML, was);
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
  function achFit(t) {
    const nm = t.querySelector('b'); const rows = () => Math.round(nm.offsetHeight / (parseFloat(getComputedStyle(nm).lineHeight) || 18));
    nm.className = '';
    if (rows() > 1) { nm.className = 'long'; if (rows() > 1) { nm.className = 'xlong'; if (rows() > 1) { nm.className = 'long two'; if (rows() > 2) nm.className = 'xlong two'; } } }
  }
  let achNow = null;                 // плашка, которая сейчас на экране: { a, t, timer, at }
  const achHeard = new WeakSet();    // плашки, у которых звук уже прозвучал
  function achNextToast() {
    if (!achQueue.length) { achShowing = false; return; }
    // Пока поверх экрана открыто окно (выбор карты, колода, талисманы, справочник, пауза), плашка ждёт. Раньше она ложилась
    // на заголовок окна и закрывала, для чего выбирают карту: «убрать», «улучшить» или «скопировать» (v153)
    if (overlay.classList.contains('show')) { achShowing = false; return; }
    achShowing = true;
    // если открылось сразу много, показываем два и общий итог по остальным
    if (achQueue.length > 3) { const rest = achQueue.splice(2); achQueue.push({ summary: rest.length }); }
    const a = achQueue.shift();
    const t = document.createElement('div');
    t.className = 'achtoast';
    // на плитке есть место под штамп: в списке достижений там стоит штемпель «Получено», на плашке он ставится на глазах
    t.innerHTML = a.summary
      ? `<span class="aport collect">${pico('medal') || ICO.medal}</span><span><small>${tr('Достижения получены')}</small><b>${tr('И ещё {n}', { n: a.summary })}</b></span>${ACH_ARC}${achStamp(Date.now())}`
      : `<span class="aport ${a.cat}">${achArt(a)}</span><span><small>${tr('Достижение получено')}</small><b>${a.name}${achStars(a)}</b></span>${ACH_ARC}${achStamp(Date.now())}`;
    app.appendChild(t);
    // рядом со штемпелем строке названия тесно: длинное название мельчает на шаг или два и только потом переносится
    achFit(t);
    if (!achHeard.has(a)) { achHeard.add(a); SND.sfx('achieve'); }
    achNow = { a, t, at: performance.now(), timer: setTimeout(() => { achNow = null; t.remove(); achNextToast(); }, SETTINGS.fast ? 1700 : 2600) };
  }
  // Окно открылось поверх плашки: убираем её. Если её ещё не успели прочитать, она покажется заново, когда окно закроют
  function achHold() {
    if (!achNow) return;
    const { a, t, at, timer } = achNow;
    clearTimeout(timer); t.remove(); achNow = null; achShowing = false;
    if (performance.now() - at < (SETTINGS.fast ? 1000 : 1500)) achQueue.unshift(a);
  }
  // окно закрылось: показываем то, что ждало (чуть погодя, вдруг следом откроется другое окно)
  function achResume() {
    if (achQueue.length && !achShowing) setTimeout(() => { if (achQueue.length && !achShowing) achNextToast(); }, 250);
  }

  // «+15 монет» с нужной формой слова
  const coins = (n) => tr('+{n} {n|монета|монеты|монет}', { n });
  // игра свёрнута или экран погас: бой ждёт возвращения, чтобы ход врага не прошёл за глаза
  const seen = () => (document.hidden ? new Promise((r) => document.addEventListener('visibilitychange', r, { once: true })).then(seen) : undefined);
  const sleep = (ms) => new Promise((r) => setTimeout(r, SETTINGS.fast ? ms * 0.5 : ms)).then(seen);
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
  // Вокруг игры на экранах других пропорций (широкий телефон, планшет) не пустые тёмные поля,
  // а та же сцена, размытая и притемнённая. Слой неподвижен и включается, только если поля есть.
  const backdrop = document.createElement('div');
  backdrop.id = 'backdrop';
  document.body.insertBefore(backdrop, app);
  function fit() {
    // Размер берём у самой страницы, а не window.innerWidth: в мобильном браузере (не во вкладке приложения)
    // innerWidth растёт вместе с содержимым, которое шире экрана, игра подгоняла себя под это число,
    // становилась ещё шире и в итоге оказывалась увеличенной и обрезанной со всех сторон.
    const root = document.documentElement;
    const vw = root.clientWidth || window.innerWidth; const vh = root.clientHeight || window.innerHeight;
    const s = Math.min(vw / 400, vh / 860);
    app.style.transform = `translate(-50%, -50%) scale(${s})`;
    const bands = Math.max(vw - 400 * s, vh - 860 * s);
    backdrop.hidden = bands < 12;
    app.classList.toggle('framed', bands >= 12);
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- Переносы строк ---------- */
  // Короткий предлог или союз не остаётся висеть в конце строки, число не отрывается от своего слова («Нанести 8 | урона»),
  // тире не начинает строку: обычный пробел в этих местах заменяется неразрывным. Правится готовый текст на странице,
  // сразу после любой отрисовки и до показа кадра; сами строки игры и ключи переводов не меняются.
  // Наблюдатель создан раньше подгонки названий и карт (fitTitles, fitCards): они меряют уже исправленный текст.
  const NB = '\u00a0';
  const SHORT_WORDS = { ru: 'в|во|и|к|ко|с|со|у|о|об|а|на|но|не|ни|по|за|из|от|до', uk: 'в|у|і|й|з|із|зі|та|на|не|ні|по|за|до|від|а|о' }[I18N.lang];
  const reShort = SHORT_WORDS ? new RegExp(`(^|[\\s${NB}«(„"])(${SHORT_WORDS}) (?=\\S)`, 'gi') : null;
  const reNum = /(\d%?) (?=[A-Za-zА-Яа-яЁёІіЇїЄєҐґ])/g;
  const reDash = / (?=[—–](?:\s|$))/g;
  function glue(s, numOnly) {
    if (s.indexOf(' ') < 0) return s;
    let out = s.replace(reNum, `$1${NB}`);
    if (numOnly) return out;
    out = out.replace(reDash, NB);
    if (reShort) out = out.replace(reShort, `$1$2${NB}`).replace(reShort, `$1$2${NB}`); // дважды: в «и в доме» два коротких слова подряд
    return out;
  }
  const unglue = (s) => (s.indexOf(NB) < 0 ? s : s.split(NB).join(' ')); // для сравнения текста со страницы с исходной строкой
  // На карте строка короткая (около 13 букв), и каждая склейка стоит места: с предлогами текст 16 карт из 226 становился
  // мельче или длиннее на строку. Поэтому на картах склеивается только число со своим словом, а если и это не даёт тексту
  // встать в рамку прежним размером, подгонка карт (fitCards) снимает склейку и помечает карту data-ng: шрифт мельче не становится.
  function glueText(n) {
    if (n.data.indexOf(' ') < 0) return;
    const card = n.parentElement && n.parentElement.closest('.card');
    if (card && card.dataset.ng) return;
    const g = glue(n.data, !!card);
    if (g !== n.data) n.data = g;
  }
  function glueNode(root) {
    if (root.nodeType === 3) { glueText(root); return; }
    if (root.nodeType !== 1) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) glueText(n);
  }
  /* Защита от повторного нажатия (v150). Нетерпеливое второе касание в ту же точку приходит через 0,3–0,5 с и попадало
     в то, что только что появилось под пальцем: в окне «Сжечь карту» сгорала карта, оказавшаяся под пальцем, после
     «Продолжить» в паузе выбиралась дорога, после трофея босса бралась карта награды. Только что появившиеся кнопки
     пути, только что открытое окно и экран под только что закрытым окном первые TAP_LOCK мс нажатий не принимают.
     Касается только настоящих касаний (e.isTrusted). Бой не затронут. Убрать: TAP_LOCK = 0. */
  const TAP_LOCK = 400;
  const TAP_GUARD = new Set(['next', 'afternext', 'takecard', 'choose', 'evopt', 'talkopt', 'talkgo', 'talkboss', 'meetopt', 'spare', 'takeall',
    'bossrelic', 'bossrelic-skip', 'openchest', 'rest-heal', 'rest-up', 'rest-burn', 'buy', 'buyrelic', 'buytea', 'buyremove', 'buyup', 'reroll']);
  const born = new WeakMap();   // когда узел появился на экране
  let ovClosedAt = -1e9;        // когда закрылось окно поверх экрана
  let ovSrc = null;             // чьё окно сейчас открыто (его обработчик нажатий)
  const bornAt = (el) => { let at = -1e9; for (let n = el; n && n !== app; n = n.parentElement) { const b = born.get(n); if (b > at) at = b; } return at; };
  new MutationObserver((list) => {
    const now = performance.now();
    for (const m of list) for (const n of m.addedNodes) { glueNode(n); if (n.nodeType === 1) born.set(n, now); }
  }).observe(app, { childList: true, subtree: true });

  // новый экран проявляется мягко. Срабатывает только когда экран действительно сменился
  // (другой класс), а не при каждой перерисовке боя; только прозрачность, чтобы не сбивать замеры эффектов.
  // Класс экрану не добавляем: по точному имени класса игра узнаёт, какой экран открыт
  new MutationObserver((list) => {
    if (!list.some((m) => (m.oldValue || '') !== screen.className)) return;
    closeTip();   // подсказка к значку не остаётся висеть над новым экраном
    if (screen.animate) screen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SETTINGS.fast ? 120 : 260, easing: 'ease-out' });
  }).observe(screen, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  // Длинное название в рамке разговора или события не помещается в одну строку и налезает на фонарь рамки:
  // уменьшаем шрифт, пока строка не станет одной. Срабатывает на любую перерисовку экрана, до показа кадра.
  function fitTitles() {
    screen.querySelectorAll('.ev-box h2').forEach((h) => {
      if (h.dataset.fit === h.textContent) return;
      h.dataset.fit = h.textContent;
      h.classList.remove('long', 'xlong');
      const two = () => h.offsetHeight > parseFloat(getComputedStyle(h).fontSize) * 1.7;
      if (two()) { h.classList.add('long'); if (two()) h.classList.replace('long', 'xlong'); }
    });
  }
  new MutationObserver(fitTitles).observe(screen, { childList: true, subtree: true, characterData: true });

  // Текст карты подгоняется под её рамку (v114). Раньше размер шрифта выбирался только по числу букв, а поля у рамок разные:
  // у навыков и помех четыре строки налезали на ярлык вида карты, длинное название с «+» выходило на фонарь рамки.
  // Здесь текст уменьшается на ступень, пока не встанет между рисунком и ярлыком. Результат запоминается (cardFit),
  // и в следующий раз cardHTML сразу ставит нужную ступень: замер нужен один раз на каждый текст.
  const cardFit = new Map();
  const DSTEP = ['', 'long', 'xlong', 'xxlong', 'tiny']; const TSTEP = ['', 'long', 'xlong'];
  const stepOf = (el, steps) => { for (let i = steps.length - 1; i > 0; i--) if (el.classList.contains(steps[i])) return i; return 0; };
  const cardKind = (card) => ['atk', 'skill', 'charm', 'status'].find((t) => card.classList.contains(t)) || '';
  function fitCards() {
    if (!app.classList.contains('skin')) return;
    let todo = [];
    app.querySelectorAll('.card:not([data-fit])').forEach((card) => {
      const d = card.querySelector('.cdesc'); const ds = d && d.firstElementChild; const t = card.querySelector('.ctitle'); const ts = t && t.firstElementChild;
      const ty = card.querySelector('.ctype'); const art = card.querySelector('.cart');
      if (!ds || !ts || !ty || !art || !card.offsetHeight) return;   // скрытая карта: измерим, когда покажется
      const kind = cardKind(card);
      todo.push({ card, d, ds, t, ts, ty, art, di: stepOf(d, DSTEP), ti: stepOf(t, TSTEP), dk: `d|${kind}|${unglue(ds.textContent)}`, tk: `t|${kind}|${unglue(ts.textContent)}` });
    });
    const next = (el, steps, i) => { if (steps[i]) el.classList.remove(steps[i]); el.classList.add(steps[i + 1]); };
    for (let pass = 0; pass < 6 && todo.length; pass++) {
      // сначала все замеры, потом все правки: страница пересчитывается один раз за проход
      const seen = todo.map((q) => {
        const top = q.d.offsetTop + q.ds.offsetTop; const gapTop = top - (q.art.offsetTop + q.art.offsetHeight);
        const gapBot = (q.ty.offsetTop - q.ty.offsetHeight / 2) - (top + q.ds.offsetHeight);
        return { tight: gapBot < q.card.offsetHeight * 0.008 || gapTop < 0 || q.ds.scrollWidth > q.d.clientWidth + 1, wide: q.ts.offsetWidth > q.t.clientWidth + 1 };
      });
      const rest = [];
      todo.forEach((q, i) => {
        let again = false;
        if (seen[i].tight && !q.ng && q.ds.textContent.indexOf(NB) >= 0) {
          // тесно из-за неразрывных пробелов: сначала снимаем их, шрифт уменьшаем только если не помогло
          q.ng = true; q.card.dataset.ng = '1';
          const tw = document.createTreeWalker(q.ds, NodeFilter.SHOW_TEXT); let n;
          while ((n = tw.nextNode())) n.data = unglue(n.data);
          again = true;
        } else if (seen[i].tight && q.di < DSTEP.length - 1) { next(q.d, DSTEP, q.di++); again = true; }
        if (seen[i].wide && q.ti < TSTEP.length - 1) { next(q.t, TSTEP, q.ti++); again = true; }
        if (again) rest.push(q); else { q.card.dataset.fit = '1'; cardFit.set(q.dk, DSTEP[q.di]); cardFit.set(q.tk, TSTEP[q.ti]); if (q.ng) cardFit.set(`n${q.dk}`, 1); }
      });
      todo = rest;
    }
    todo.forEach((q) => { q.card.dataset.fit = '1'; });
  }
  new MutationObserver(fitCards).observe(app, { childList: true, subtree: true });

  /* ---------- Снег ---------- */
  // снегопад можно выключить в настройках: тогда анимация останавливается совсем
  const snow = (function () {
    const cv = $('#snow'); const ctx = cv.getContext('2d');
    cv.width = 400; cv.height = 860;
    // три слоя глубины: дальние снежинки мелкие, тусклые и медленные, ближние крупные и яркие;
    // всех сносит один и тот же ветер, который то усиливается, то стихает
    const flakes = Array.from({ length: 76 }, (_, i) => {
      const z = i < 34 ? 0 : i < 62 ? 1 : 2;
      return { z, x: Math.random() * 400, y: Math.random() * 860, r: [0.7, 1.3, 2.3][z] + Math.random() * [0.6, 0.9, 1.3][z], v: [0.22, 0.5, 0.95][z] + Math.random() * [0.2, 0.35, 0.5][z], d: Math.random() * 6 };
    });
    const ALPHA = [0.42, 0.7, 0.92];
    let running = false;
    let last = 0;
    function tick(t) {
      ctx.clearRect(0, 0, 400, 860);
      if (!SETTINGS.snow) { running = false; last = 0; return; }
      // скорости снежинок заданы в шагах на кадр при 60 кадрах в секунду: шаг растёт с прошедшим временем,
      // иначе на экранах 90 и 120 Гц снег падает в полтора-два раза быстрее, а на слабом телефоне медленнее
      const k = last ? Math.min(3, Math.max(0, (t - last) / (1000 / 60))) : 1;
      last = t;
      ctx.fillStyle = 'rgb(235,242,255)';
      const wind = Math.sin(t / 7300) * 0.22 + Math.sin(t / 2900 + 1.7) * 0.1;
      let layer = -1;
      for (const f of flakes) {
        if (f.z !== layer) { layer = f.z; ctx.globalAlpha = ALPHA[layer]; }
        f.y += f.v * k; f.x += (Math.sin(t / 1400 + f.d) * (0.2 + f.z * 0.12) + wind * (0.5 + f.z * 0.6)) * k;
        if (f.y > 870) { f.y = -10; f.x = Math.random() * 400; }
        if (f.x < -8) f.x += 416; else if (f.x > 408) f.x -= 416;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
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
    const bgEl = $('#bg');
    const was = bgEl.querySelector('image'); const wasHref = was && was.getAttribute('href'); const wasHTML = wasHref ? bgEl.innerHTML : '';
    const wasCam = bgEl.querySelector('.bg-cam'); const wasY = wasCam ? camY(wasCam.style.transform) : 0;
    bgEl.innerHTML = painted || Art.background(p, lamps, g.scene, approach);
    if (painted) { groundCam(true); Art.lightsOn(bgEl); }
    // свет сцены: по нему враги в бою слегка тонируются под закат или ночь (см. data-light в style.css)
    const bk = painted ? ($('#bg svg.painted') || {}).dataset.k || '' : '';
    app.dataset.light = /night|final/.test(bk) ? 'night' : /outskirts/.test(bk) ? 'dusk' : /sunset/.test(bk) ? 'sunset' : /town_mid/.test(bk) ? 'eve' : 'day';
    const pic = painted && $('#bg image');
    // сцена сменилась: прежняя картинка тает поверх новой, а не обрывается
    const nowCam = pic && bgEl.querySelector('.bg-cam');
    if (pic && wasHref && (wasHref !== pic.getAttribute('href') || (Math.abs(wasY - (nowCam ? camY(nowCam.style.transform) : 0)) > 24 && !app.querySelector('.bg-ghost')))) bgGhost(wasHTML);
    backdrop.style.backgroundImage = pic ? `url("${pic.getAttribute('href')}")` : '';
    backdrop.style.backgroundColor = p.skyMid || '';
    app.style.setProperty('--sky-top', p.skyTop);
    app.style.setProperty('--sky-mid', p.skyMid);
    app.style.setProperty('--sky-bot', p.skyBot);
  }

  /* ---------- Состояние забега ---------- */
  let run = null;   // прогресс забега
  let C = null;     // текущий бой
  let busy = false; // блокировка ввода на время анимаций
  let selected = -1;
  let playing = false;   // идёт розыгрыш карты (а не ход врага)
  let tapNext = '';      // uid карты, которую тронули во время розыгрыша предыдущей
  let flickNext = false; // эту карту не просто тронули, а выбросили вверх: её надо сыграть, а не выбрать

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
  // снимки забега для экрана поражения: развилка перед боем («Вернуться до боя») и начало боя («Начать бой заново»)
  let snapStep = null;
  let snapFight = null;
  const BACK_FROM = ['fight', 'elite', 'boss', 'talk', 'event', 'defeat'];   // экраны, с которых можно попасть на экран поражения
  function save(pending = null) {
    if (!run) return;
    stTick();
    // back: развилка перед боем. Без неё после перезагрузки посреди боя на экране поражения пропадала кнопка «Вернуться до боя» (v151)
    const back = pending && BACK_FROM.includes(pending.t) && snapStep ? snapStep : undefined;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, run, pending, back, at: Date.now() })); } catch (e) { /* хранилище недоступно */ }
  }
  /* Сохранение могло остаться от прежней версии игры: без полей, которых тогда не было, с картами, талисманами,
     врагами или героем, которых с тех пор переименовали или убрали. Раньше такое сохранение роняло «Продолжить»,
     а с незнакомым героем не открывался и главный экран. Чиним всё, что можно починить; что нельзя, считаем
     отсутствием сохранения. */
  function fixSnap(str) {
    try { const o = JSON.parse(str); return o && Array.isArray(o.deck) ? JSON.stringify(fixSave({ run: o, pending: null }).run) : null; } catch (e) { return null; }
  }
  function fixSave(s) {
    const r = s.run;
    const num = (v, d) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : d);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    if (r.cls && !CLASSES[r.cls]) r.cls = 'lamp';
    const h = CLASSES[r.cls || 'lamp'];
    r.step = Math.max(0, Math.min(MAX_STEPS - 1, Math.floor(num(r.step, 0))));
    r.maxHp = Math.max(1, Math.floor(num(r.maxHp, h.hp)));
    const dead = !!s.pending && s.pending.t === 'defeat';   // сохранён экран поражения: у героя 0 HP
    r.hp = Math.max(dead ? 0 : 1, Math.min(r.maxHp, Math.floor(num(r.hp, r.maxHp))));
    r.gold = Math.max(0, Math.floor(num(r.gold, 0)));
    r.lit = num(r.lit, 0); r.fights = num(r.fights, 0);
    r.relics = arr(r.relics).filter((id) => RELICS[id]);
    // карты: незнакомые убираем, номера (uid) должны быть у каждой и не повторяться
    r.deck = r.deck.filter((c) => c && CARDS[c.id]);
    if (!r.deck.length) r.deck = h.deck.map((id) => ({ id, up: false }));
    let uid = r.deck.reduce((a, c) => (Number.isFinite(c.uid) ? Math.max(a, c.uid + 1) : a), 0);
    const taken = new Set();
    r.deck.forEach((c) => { if (!Number.isFinite(c.uid) || taken.has(c.uid)) c.uid = uid++; taken.add(c.uid); });
    r.seen = obj(r.seen); r.offered = obj(r.offered); r.evSeen = obj(r.evSeen); r.recent = arr(r.recent); r.lastOffered = arr(r.lastOffered);
    r.bosses = STAGES.map((g, i) => (Array.isArray(r.bosses) && ENEMIES[r.bosses[i]] ? r.bosses[i] : pick(g.boss)));
    const okChoice = (o) => o && typeof o === 'object' && (!o.enemy || ENEMIES[o.enemy])
      && (o.t !== 'event' || EVENTS.some((e) => e.id === o.ev)) && (o.t !== 'meet' || LORE.MEET[o.hero]);
    if (r.choices && !(Array.isArray(r.choices) && r.choices.length && r.choices.every(okChoice))) r.choices = null;
    // экран, на котором вышли: незнакомый бой или встреча возвращают к выбору дороги, испорченная награда пропускается
    const p = s.pending;
    if (!p || typeof p !== 'object') s.pending = null;
    else {
      const t = p.t; const tiers = ['fight', 'elite', 'boss'];
      const shopOk = (sh) => sh && Array.isArray(sh.cards) && sh.cards.every((c) => c && CARDS[c.id]) && (!sh.relic || RELICS[sh.relic.id]) && sh.tea && sh.remove && sh.up;
      if ((tiers.includes(t) || t === 'talk') && !ENEMIES[p.enemy]) s.pending = null;
      else if (t === 'talk' && !tiers.includes(p.tier)) s.pending = null;
      else if (t === 'meet' && !LORE.MEET[p.hero]) s.pending = null;
      else if (t === 'shop' && p.shop && !shopOk(p.shop)) delete p.shop;
      else if (t === 'reward' && !(p.r && Array.isArray(p.r.ids) && p.r.ids.every((id) => CARDS[id]))) s.pending = { t: 'next' };
      else if (t === 'bossrelic' && p.opts && !(Array.isArray(p.opts) && p.opts.every((id) => RELICS[id]))) p.opts = null;
      else if (t === 'after' && !(ENEMIES[p.enemy] && tiers.includes(p.tier))) s.pending = { t: 'next' };
      else if (t === 'afterdone' && !tiers.includes(p.tier)) s.pending = { t: 'next' };
      // экран поражения: снимок начала боя чиним так же, как само сохранение; без годного снимка забег просто заканчивается
      else if (t === 'defeat') p.fight = ENEMIES[p.enemy] && tiers.includes(p.tier) ? fixSnap(p.fight) : null;
    }
    s.back = s.pending && BACK_FROM.includes(s.pending.t) ? fixSnap(s.back) : null;
    return s;
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 && s.run && Array.isArray(s.run.deck) ? fixSave(s) : null; } catch (e) { return null; }
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
    snapFight = null; snapStep = s.back || null;
    const ev = p && p.t === 'event' && EVENTS.find((e) => e.id === p.ev);
    const resume = () => {
      if (!p) return goMap();
      // игру закрыли на экране поражения: возвращаем его с теми же кнопками (раньше забег пропадал без следа, v151)
      if (p.t === 'defeat') {
        if (!p.fight) return endRun();
        snapFight = { run: p.fight, enemyId: p.enemy, tier: p.tier };
        return goDefeat();
      }
      if (p.t === 'fight' || p.t === 'elite' || p.t === 'boss') return startCombat(p.enemy, p.t);
      if (ev) return goEvent(ev);
      if (p.t === 'shop') return goShop(p.shop);
      if (p.t === 'chest') return goChest();
      if (p.t === 'rest') return goRest();
      if (p.t === 'next') return advance();
      if (p.t === 'reward') return renderReward(p.r);
      if (p.t === 'bossrelic') return goBossRelic(p.opts);
      if (p.t === 'meet') return goMeet(p.hero);
      if (p.t === 'talk') return goTalk(p.enemy, p.tier);
      if (p.t === 'after') return goAfter(p.tier, p.enemy);
      if (p.t === 'afterdone') return afterNext(p.tier);
      return goMap();
    };
    // последняя страховка: экран из сохранения не открылся, значит возвращаемся к выбору дороги на том же уровне
    const fallback = () => {
      try { C = null; busy = false; hideOverlay(); if (run.hp <= 0) { endRun(); return; } run.choices = null; goMap(); } catch (e) { clearSave(); goTitle(); toast(tr('Сохранение не открылось. Начни новый забег')); }
    };
    try { const out = resume(); if (out && out.catch) out.catch(fallback); } catch (e) { fallback(); }
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
    // размер текста: если карта с таким текстом уже подгонялась под рамку (fitCards), берём готовую ступень, иначе прикидка по длине
    const dKey = `d|${c.type}|${unglue(plain)}`; const tKey = `t|${c.type}|${unglue(c.name)}${inst.up ? '+' : ''}`;
    const fitted = cardFit.has(dKey) && cardFit.has(tKey);
    const dCls = fitted ? cardFit.get(dKey) : (plain.length > 64 ? 'xlong' : plain.length > 48 ? 'long' : '');
    const tCls = fitted ? cardFit.get(tKey) : (c.name.length > 12 ? 'long' : '');
    return `<div class="card ${c.type} r-${c.rarity} ${inst.up ? 'up' : ''} ${inst.sharp ? 'sharp' : ''} ${extra}" ${attrs}${fitted ? ' data-fit="1"' : ''}${cardFit.has(`n${dKey}`) ? ' data-ng="1"' : ''}>
      <div class="cost ${cost == null ? 'none' : ''}"><span>${cost == null ? '✕' : cost}</span></div>
      <div class="ctitle ${tCls}"><span>${c.name}${inst.up ? '<i>+</i>' : ''}</span></div>
      <div class="cart">${Art.card(inst.id)}</div>
      <div class="cdesc ${dCls}"><span>${desc}</span></div>
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
      <div class="relics">${relicIcons(app.classList.contains('skin') ? 1 : 2)}</div>
    </div>`;
  }

  /* Значки талисманов: последние max штук и кнопка со списком остальных */
  function relicIcons(max) {
    const list = run.relics;
    list.forEach((r) => codexMark('r', r));
    const shown = list.length > max ? list.slice(-Math.max(1, max - 1)) : list;
    const more = list.length - shown.length;
    return shown.map((r) => `<button class="relic rt-${RELICS[r].tier}" data-relic="${r}">${Art.relic(r)}</button>`).join('')
      + (more > 0 ? `<button class="relic more" data-act="relics">+${more}</button>` : '');
  }

  function showRelics() {
    showOverlay(`<h2>${tr('Талисманы')} · ${run.relics.length}</h2><div class="rlist">${run.relics.map((r) => `<div class="rrow ${RELICS[r].tier}">${Art.relic(r)}<span><b>${RELICS[r].name}<em class="rtier ${RELICS[r].tier}">${TIER_LABEL[RELICS[r].tier]}${RELICS[r].cls ? ` · ${CLASSES[RELICS[r].cls].name}` : ''}</em></b><small>${RELICS[r].desc}</small></span></div>`).join('')}</div>
      <button class="btn" data-act="close">${tr('Закрыть')}</button>`, (e) => { if (e.target.closest('[data-act="close"]')) hideOverlay(); });
  }

  // Полоска здоровья героя рисуется заново при каждой перерисовке, поэтому её движение помним здесь:
  // красная часть доезжает до нового значения, а за ней тает светлый след потерянного здоровья.
  // Повторная перерисовка посреди движения продолжает его с того же места (отрицательная задержка).
  let hpMove = { from: null, to: null, at: 0 };
  function hpAnim(pct) {
    const now = performance.now();
    if (hpMove.to == null) hpMove = { from: pct, to: pct, at: 0 };
    if (Math.abs(pct - hpMove.to) > 0.01) hpMove = { from: hpMove.to, to: pct, at: now };
    const el = Math.round(now - hpMove.at);
    if (el > 900 || hpMove.from === hpMove.to) return { fill: '', trail: '' };
    const k = SETTINGS.fast ? 0.5 : 1;
    return {
      fill: `--from:${hpMove.from}%;animation:hpmove ${280 * k}ms ${-el}ms backwards ease-out;`,
      trail: hpMove.from > hpMove.to ? `<div class="trail" style="width:${pct}%;--from:${hpMove.from}%;animation:hpmove ${520 * k}ms ${Math.round(260 * k) - el}ms backwards ease-out"></div>` : '',
    };
  }
  // Слои для эффектов и всплывающих чисел на экранах вне боя: без них лечение, монеты и находки
  // в событиях, у костра и в лавке происходили молча, менялись только цифры
  const FXH = '<div class="hero-fx"></div><div class="fxlayer"></div>';
  const warmPeace = () => FX.warm(['heal', 'gold', 'heart']);
  // Показать, что изменилось у героя вне боя: здоровье (сияние или встряска портрета и число) и монеты.
  // Вызывается после перерисовки панели героя; числа идут по очереди, чтобы не легли друг на друга.
  function showGain(hp0, gold0) {
    const host = $('.hero-fx'); if (!host) return;
    const dh = run.hp - hp0; const dg = run.gold - gold0;
    if (dh > 0) { SND.sfx('heal'); FX.play('heal'); floatText(host, `+${dh}`, 'healf'); }
    if (dh < 0) { SND.sfx('hurt'); heroMove('hurt'); floatText(host, `${dh}`.replace('-', '−'), 'dmgf small'); }
    if (dg) setTimeout(() => { if (!$('.hero-fx')) return; if (dg > 0) FX.play('gold'); floatText($('.hero-fx'), dg > 0 ? coins(dg) : `−${-dg}`, 'burnf'); }, dh ? (SETTINGS.fast ? 320 : 640) : 0);
  }
  let heroAct = { k: '', at: -1e9 };   // последнее движение портрета, см. heroMove
  function heroBar(inCombat) {
    const hpPct = (run.hp / run.maxHp) * 100;
    const mv = hpAnim(hpPct);
    const flame = inCombat ? C.flame : 0;
    // мало здоровья (четверть и меньше): полоска тревожно пульсирует; фаза общая, чтобы перерисовка не сбивала пульс
    const low = run.hp > 0 && run.hp / run.maxHp <= 0.25;
    const actAge = Math.round(performance.now() - heroAct.at);
    return `<div class="herobar${low ? ' low' : ''}"${low ? ` style="--ph:-${Math.round(performance.now() % 1800)}ms"` : ''}>
      <div class="portrait${actAge < 350 ? ` ${heroAct.k}" style="--ad:-${actAge}ms` : ''}" id="heroPortrait">${heroFace()}</div>
      <div class="hb-mid">
        <div class="hpbar">${mv.trail}<div class="fill" style="${mv.fill}width:${hpPct}%"></div><span>${run.hp}/${run.maxHp}</span>
          ${inCombat && C.block > 0 ? `<div class="hblk">${Art.intentIcon('block')}<b>${C.block}</b></div>` : ''}</div>
        <div class="hb-row">
          ${inCombat ? `<div class="lamp" data-tip="${GLOSS[0][1]}">${Array.from({ length: flameMax() }, (_, i) => `<i class="pip ${i < flame ? 'on' : ''}">${Art.flame(1)}</i>`).join('')}</div>` : `<div class="hero-name">${hero().name}</div>`}
        </div>
      </div>
      ${inCombat ? `<div class="energy"><b>${C.energy}</b><small>/${maxEnergy()}</small></div>
        <div class="piles"><button class="pile" data-act="pile-draw">${tr('Колода')}<b>${C.draw.length}</b></button><button class="pile" data-act="pile-disc">${tr('Сброс')}<b>${C.disc.length}</b></button></div>
        <button class="btn end" data-act="end">${tr('Конец<br>хода')}</button>`
        : `<div class="energy idle"><b>${maxEnergy()}</b></div><button class="btn deckbtn" data-act="deck">${tr('Колода')}<b>${run.deck.length}</b></button>`}
    </div>`;
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text;
    // длинную строку не успеть прочитать за полторы секунды: время растёт с длиной. С v154 растёт быстрее: раньше длинные
    // сообщения («Улучшены: три названия», «Друзья рядом: семь имён») надо было читать по 28 знаков в секунду, вдвое быстрее,
    // чем принято для субтитров; теперь около 20. Короткие (до 22 знаков) висят те же полторы секунды
    const ms = Math.min(6500, 1500 + Math.max(0, text.length - 22) * 50);
    t.style.animationDuration = `${ms}ms`;
    // Несколько подсказок разом (после победы сработали Копилка, Термос и Коробка леденцов) встают столбиком:
    // раньше они ложились одна на другую, и читалась только последняя. Та же подсказка повторно
    // (второе нажатие на недоступную кнопку) показывается заново на своём месте, а не второй строкой.
    const live = [...app.querySelectorAll('.toast')];
    const same = live.find((x) => unglue(x.textContent) === unglue(text));
    let off = 0;
    if (same) { off = parseFloat(same.style.marginTop) || 0; same.remove(); }
    else live.forEach((x) => { off = Math.max(off, (parseFloat(x.style.marginTop) || 0) + x.offsetHeight + 6); });
    if (off > 230) off = 0;
    if (off) t.style.marginTop = `${off}px`;
    // столбик читают сверху вниз: каждая следующая строка висит на полсекунды дольше
    const life = same ? ms : ms + Math.min(4, live.length) * 500;
    t.style.animationDuration = `${life}ms`;
    app.appendChild(t);
    setTimeout(() => t.remove(), life);
  }
  // строка итогов: части не рвутся посередине, перенос только между ними
  const statLine = (parts) => parts.map((x) => `<span>${x}</span>`).join('<i class="dot"> · </i>');
  // Строка итогов переносится: точка-разделитель не должна висеть в конце строки, на её месте просто перенос
  function tidyStats() {
    screen.querySelectorAll('.stats i.dot').forEach((d) => {
      d.classList.remove('brk');
      const a = d.previousElementSibling; const b = d.nextElementSibling;
      if (a && b && b.offsetTop > a.offsetTop + 4) d.classList.add('brk');
    });
  }

  // Подсказка к значку (статус, намерение врага, талисман): пузырь рядом с тем, на что нажали, а не поверх него.
  // Висит столько, сколько нужно на чтение, и закрывается следующим касанием.
  let tipTimer = 0;
  function closeTip() { clearTimeout(tipTimer); app.querySelectorAll('.tipb').forEach((x) => x.remove()); }
  function showTip(el, text, title) {
    closeTip();
    const s = app.getBoundingClientRect(); const k = 400 / (s.width || 400); const r = el.getBoundingClientRect();
    const box = { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k };
    const t = document.createElement('div');
    t.className = 'tipb';
    t.innerHTML = `${title ? `<b></b>` : ''}<span></span>`;
    if (title) t.querySelector('b').textContent = title;
    t.querySelector('span').textContent = text;
    app.appendChild(t);
    const w = t.offsetWidth; const h = t.offsetHeight; const cx = box.x + box.w / 2;
    const left = Math.max(8, Math.min(392 - w, cx - w / 2));
    const below = box.y + box.h + 10 + h < 852 && (box.y + box.h / 2 < 430 || box.y - 10 - h < 8);
    t.classList.add(below ? 'below' : 'above');
    t.style.left = `${left}px`;
    t.style.top = `${below ? box.y + box.h + 10 : box.y - 10 - h}px`;
    t.style.setProperty('--ax', `${Math.max(16, Math.min(w - 16, cx - left))}px`);
    tipTimer = setTimeout(closeTip, Math.min(7000, 2200 + (text.length + (title || '').length) * 45));
  }

  // Крупный миг посреди экрана: улучшенная карта, убранная карта, новый талисман.
  // Живёт поверх экранов и сам исчезает, поэтому игра идёт дальше, не дожидаясь его.
  function moment(html, label, kind) {
    app.querySelectorAll('.moment').forEach((x) => x.remove());
    const m = document.createElement('div');
    m.className = `moment ${kind}`;
    m.innerHTML = `<i class="mrays"></i><div class="mbody">${html}</div><b>${label}</b>`;
    if (SETTINGS.fast) m.style.setProperty('--ms', '.7s');
    app.appendChild(m);
    setTimeout(() => m.remove(), SETTINGS.fast ? 720 : 1430);
  }

  // Карту показывают крупно (улучшена, убрана): экран под ней ждёт, пока показ не кончится, и только потом сменяется.
  // Иначе карта висела уже поверх карты пути, вперемешку с её плашками. Кнопки экрана на это время не нажимаются
  function afterMoment(fn) {
    const r = run; const scr = screen.className;
    screen.style.pointerEvents = 'none';
    // за это время игрок мог выйти в меню или начать другой забег: тогда переходить уже некуда
    setTimeout(() => { screen.style.pointerEvents = ''; if (run === r && screen.className === scr) fn(); }, SETTINGS.fast ? 520 : 1100);
  }

  function showOverlay(html, onClick) {
    // окно, которое только что открылось или сменилось другим (а не перерисовалось, как настройки после переключателя),
    // первые мгновения не принимает касаний: см. TAP_LOCK
    const openedAt = overlay.classList.contains('show') && ovSrc === onClick ? -1e9 : performance.now();
    ovSrc = onClick;
    achHold();
    overlay.innerHTML = `<div class="ov-inner">${html}</div>`;
    overlay.classList.add('show');
    overlay.onclick = (e) => { if (e.isTrusted && performance.now() - openedAt < TAP_LOCK) return; if (onClick) onClick(e); };
  }
  function hideOverlay() { if (overlay.classList.contains('show')) ovClosedAt = performance.now(); ovSrc = null; overlay.classList.remove('show'); overlay.innerHTML = ''; overlay.onclick = null; achResume(); }

  function showDeck(list, title, onPick, preview, note) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id) || (a.up ? 1 : 0) - (b.up ? 1 : 0));
    const view = (c) => (preview === 'up' ? { ...c, up: true } : c);
    showOverlay(`<h2>${title}</h2>${preview === 'up' ? `<p class="ovhint">${tr('Так карты будут выглядеть после улучшения')}</p>` : note ? `<p class="ovhint">${note}</p>` : ''}<div class="grid">${sorted.map((c) => cardHTML(view(c), 'mini', `data-uid="${c.uid}"`)).join('') || `<p class="muted">${tr('Пусто')}</p>`}</div>
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
    // пока игрок на титуле, скачиваем экран выбора героя и страницу вступления: на медленной сети
    // портреты героев появлялись через секунду, а текст вступления стоял без пергамента под ним
    if (Art.warm) Art.warm({ ui: ['tile', 'panel', 'parch', 'back'], faces: Object.keys(CLASSES).map((k) => CLASSES[k].look), heroes: [CLASSES[SETTINGS.cls] ? CLASSES[SETTINGS.cls].look : 'lamp'], pics: ['story_intro'] });
    const titleCls = s ? (s.run.cls || 'lamp') : SETTINGS.cls; // data-h: по нему стиль зажигает фонарь в руке Ивы (v106)
    screen.className = 'scr-title';
    screen.innerHTML = `
      <div class="logo"><small>${tr('почтовая сказка')}</small><h1${STORY.title.length > 14 ? ' class="long"' : ''}>${STORY.title}</h1></div>
      <div class="title-hero${s ? ' small' : ''}" data-h="${(CLASSES[titleCls] || CLASSES.lamp).look}">${heroArt(titleCls)}</div>
      <div class="menu">
        ${s ? `<button class="btn big" data-act="continue">${tr('Продолжить')}<small>${info}</small></button>` : ''}
        <button class="btn ${s ? 'ghost' : 'big'}" data-act="newgame">${tr('Новая игра')}</button>
        <button class="btn ghost achbtn" data-act="ach">${menuIco('medal')}<span>${tr('Достижения')}<small>${tr('{a} из {b}', { a: achCount(), b: ACH_LIST.length })}</small></span>${achHasNew() ? '<i class="newdot"></i>' : ''}</button>
        <button class="btn ghost achbtn" data-act="codex">${menuIco('book')}<span>${tr('База знаний')}<small>${tr('{a} из {b}', { a: codexCount(), b: codexTotal })}</small></span></button>
        <button class="btn ghost achbtn" data-act="stats">${menuIco('stats')}<span>${tr('Статистика')}<small>${RUNS.list.length ? tr('Забегов: {a} · доставлено писем: {b}', { a: STATS.runs, b: STATS.wins }) : tr('Итоги твоих забегов')}</small></span></button>
        <button class="btn ghost achbtn storebtn" data-act="store">${menuIco('gift')}<span>${tr('Магазин')}<small>${tr('Герои и режим без рекламы')}</small></span></button>
        <div class="menu-row"><button class="btn ghost" data-act="gloss">${tr('Справочник')}</button><button class="btn ghost" data-act="settings">${tr('Настройки')}</button></div>
      </div>
      <p class="savehint">${s ? tr('Прогресс сохраняется после каждого уровня') : ''}</p>`;
    menuAlign();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(menuAlign);
  }
  // Значки четырёх строк меню стоят в одном столбце: раньше каждая строка центрировалась сама, и значок
  // уезжал вбок на длину подписи (в английском до 39 px). Всем подписям даём ширину самой длинной (v122).
  function menuAlign() {
    if (screen.className !== 'scr-title') return;
    const sp = [...screen.querySelectorAll('.menu .achbtn > span:not(.mico)')];
    sp.forEach((x) => { x.style.minWidth = ''; });
    const w = Math.ceil(Math.max(0, ...sp.map((x) => parseFloat(getComputedStyle(x).width) || x.offsetWidth)));
    sp.forEach((x) => { x.style.minWidth = w + 'px'; });
  }

  /* ---------- Заставка ----------
     Чёрный экран, в кадре медленно едет картинка, под ней по одной проступают строки. Касание листает сцену,
     «Пропустить» закрывает. Показывается при первом запуске, пересмотреть можно из настроек. */
  const CINE_KEY = 'lastray.cinema';
  const cinemaSeen = () => { try { return localStorage.getItem(CINE_KEY) === '1'; } catch (e) { return true; } };
  const hasCinema = () => !!(STORY.cinema && Art.bgUrl && STORY.cinema.every((sc) => Art.bgUrl(sc.bg)));
  function goCinema(done) {
    const scenes = STORY.cinema;
    run = null; C = null; busy = false;
    hideOverlay();
    SND.music('title');
    screen.className = 'scr-cinema';
    screen.innerHTML = `<div class="cine" data-act="cine-next"><div class="cine-band"></div><div class="cine-cap"></div>
      <button class="btn ghost cine-skip" data-act="cine-skip">${tr('Пропустить')}</button></div>`;
    const band = $('.cine-band'), cap = $('.cine-cap');
    const BW = 400, BH = band.clientHeight || 236;
    let i = -1, timer = 0, over = false;
    // экран сменился (например, игру открыли заново) — заставка молча останавливается
    const alive = () => !over && screen.className === 'scr-cinema';
    const finish = () => {
      if (over) return;
      over = true; clearTimeout(timer);
      try { localStorage.setItem(CINE_KEY, '1'); } catch (e) { /* недоступно */ }
      const c = $('.cine'); if (c) c.classList.add('out');
      setTimeout(() => { if (screen.className === 'scr-cinema') done(); }, 550);
    };
    // где стоит картинка, чтобы точка (fx, fy) оказалась в середине кадра при увеличении k
    const place = ([fx, fy, k], h) => {
      const x = Math.min(0, Math.max(BW - BW * k, BW / 2 - fx * BW * k));
      const y = Math.min(0, Math.max(BH - h * k, BH / 2 - fy * h * k));
      return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${k})`;
    };
    const show = () => {
      if (!alive()) return;
      clearTimeout(timer);
      i++;
      if (i >= scenes.length) { finish(); return; }
      const sc = scenes[i], n = i;
      const dur = sc.lines.length > 1 ? 6400 : 4600;
      const im = new Image();
      const start = () => {
        if (!alive() || n !== i || im._shown) return;
        im._shown = true;
        const h = im.naturalWidth ? (BW * im.naturalHeight) / im.naturalWidth : 715;
        const old = [...band.children];
        const layer = document.createElement('div');
        layer.className = 'cine-layer';
        layer.innerHTML = `<div class="cine-img" style="height:${h.toFixed(1)}px;background-image:url('${im.src}');--t0:${place(sc.from, h)};--t1:${place(sc.to, h)};animation-duration:${dur + 1200}ms"></div>
          ${(sc.shadows || []).map((id, k) => `<img class="cine-shadow s${k}" src="${Art.enemyUrl(id)}" alt="">`).join('')}`;
        band.appendChild(layer);
        setTimeout(() => old.forEach((o) => o.remove()), 1000);
        cap.innerHTML = sc.lines.map((l, k) => `<p style="animation-delay:${500 + k * 2300}ms">${tr(l)}</p>`).join('');
        timer = setTimeout(show, dur);
      };
      im.onload = start; im.onerror = start;
      im.src = Art.bgUrl(sc.bg);
      timer = setTimeout(start, 2500); // картинка не пришла вовремя — сцена всё равно идёт
      if (scenes[i + 1]) new Image().src = Art.bgUrl(scenes[i + 1].bg);
    };
    screen.onCine = (act) => { if (act === 'cine-skip') finish(); else if (alive()) show(); };
    show();
  }

  function askNewGame() {
    const s = loadSave();
    const begin = () => goClassSelect();
    if (!s) { begin(); return; }
    // вопрос стоит в той же нарисованной рамке, что и пауза (v126): раньше текст и кнопки висели на затемнённом экране
    showOverlay(`<div class="settings pausebox askbox"><button class="sclose" data-act="c-no" aria-label="${tr('Закрыть')}">✕</button><div class="sribbon">${tr('Начать заново?')}</div><div class="pause">
      <p class="ovhint">${tr('Сохранённый забег на уровне {n} из {total} будет потерян.', { n: s.run.step + 1, total: MAX_STEPS })}</p>
      <button class="btn" data-act="c-yes">${tr('Начать заново')}</button>
      <button class="btn ghost" data-act="c-no">${tr('Отмена')}</button></div></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      hideOverlay();
      if (b.dataset.act === 'c-yes') {
        // Брошенный забег в журнал не попадает, но его урон, монеты и время идут в общий счёт:
        // сыгранные карты и победы из него там уже есть, иначе строки «Всего» считались бы по разным забегам
        const st = s.run.st;
        if (st) {
          STATS.dmg = (STATS.dmg || 0) + (st.dmg || 0); STATS.ms = (STATS.ms || 0) + (st.ms || 0); STATS.gold = (STATS.gold || 0) + (st.gold || 0);
          STATS.runDmg = Math.max(STATS.runDmg || 0, st.dmg || 0); saveStats();
        }
        clearSave(); begin();
      }
    });
  }

  /* Пауза во время забега: справочник и выход в главное меню */
  function showPause() {
    showOverlay(`<div class="settings pausebox"><button class="sclose" data-act="p-resume" aria-label="${tr('Закрыть')}">✕</button><div class="sribbon">${tr('Пауза')}</div><div class="pause">
      <p class="ovhint">${hero().name} · ${DIFF().name}</p>
      <p class="ovhint">${C ? tr('Прогресс сохранён до начала этого боя. Если выйти, бой начнётся заново.') : tr('Прогресс сохранён. Можно выйти и вернуться позже.')}</p>
      <button class="btn" data-act="p-resume">${tr('Вернуться в игру')}</button>
      <button class="btn ghost" data-act="p-gloss">${tr('Справочник')}</button>
      <button class="btn ghost" data-act="p-settings">${tr('Настройки')}</button>
      <button class="btn ghost" data-act="p-title">${tr('Главное меню')}</button></div></div>`, (e) => {
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
    menu: '<svg viewBox="0 0 40 40"><path d="M10 12 h20 M10 20 h20 M10 28 h20" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round"/></svg>',
    reset: '<svg viewBox="0 0 40 40"><path d="M31 20 a11 11 0 1 1 -4 -8.5" fill="none" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round"/><path d="M28 5 l1 8 l-8 1" fill="none" stroke="#f3d27c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  // значки кнопок главного меню: нарисованные картинки из набора, без набора остаются векторные
  const MENU_PIC = { medal: 'medal', book: 'bookmark', stats: 'hourglass', gift: 'ribbon', gloss: 'magnifier', reset: 'sootbroom', sfx: 'horn', note: 'musicbox' };
  const pico = (k) => (Art.hasIcon && Art.hasIcon(MENU_PIC[k]) ? Art.relic(MENU_PIC[k]) : '');
  const menuIco = (k) => (pico(k) ? `<span class="mico">${pico(k)}</span>` : ICO[k]);
  // служебные значки (gear, menu, lock, ad): нарисованный файл assets/i/<имя>.webp, пока его нет, старый значок
  const uiIco = (k) => (Art.hasIcon && Art.hasIcon(k) ? Art.icon(k) : ICO[k]);
  // кружок в настройках: картинка занимает весь кружок, старый значок рисуется с полями
  const sIco = (k, old) => (pico(k) ? `<span class="pic">${pico(k)}</span>` : `<span>${old}</span>`);
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
        <button data-act="s-ach">${sIco('medal', ICO.medal)}${tr('Достижения')}</button>
        <button data-act="s-gloss">${sIco('gloss', ICO.book)}${tr('Справочник')}</button>
        <button data-act="s-stats">${sIco('stats', ICO.stats)}${tr('Статистика')}</button>
        <button data-act="s-reset">${sIco('reset', ICO.reset)}${tr('Сбросить')}</button>
      </div>
      <div class="sline"></div>
      ${slider('sfx', tr('Звуки'), pico('sfx') || Art.soundIcon('all'), p.sfxVol)}
      ${slider('music', tr('Музыка'), pico('note') || ICO.note, p.musicVol)}
      <div class="sline"></div>
      ${langRow}
      ${TOGGLES.map(toggle).join('')}
      ${!run && hasCinema() ? `<button class="slink" data-act="s-cinema">${tr('Посмотреть заставку')}</button>` : ''}
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
        try { sessionStorage.setItem('lastray.reopen', run ? 'settings+run' : 'settings'); } catch (err) { /* недоступно */ }
        location.reload();
        return;
      }
      if (b.dataset.set) {
        SETTINGS[b.dataset.set] = b.dataset.val === '1';
        saveJSON(SETTINGS_KEY, SETTINGS);
        if (b.dataset.set === 'snow' && SETTINGS.snow) snow.start();
        app.classList.toggle('fast', SETTINGS.fast);
        app.classList.toggle('calm', !SETTINGS.snow);
        render();
        return;
      }
      const act = b.dataset.act;
      if (act === 's-close') hideOverlay();
      if (act === 's-gloss') showGlossary(showSettings);
      if (act === 's-ach') showAchievements(showSettings);
      if (act === 's-stats') showStats(showSettings);
      if (act === 's-reset') askReset();
      if (act === 's-cinema') goCinema(() => goTitle());
    };
    render();
  }

  /* ---------- Панель достижений ---------- */
  const achCount = (cat) => ACH_LIST.filter((a) => (!cat || a.cat === cat) && achDone(a)).length;
  const achHasNew = () => ACH_LIST.some((a) => ACH.got[a.id] > ACH.seenAt);
  const fmt = (n) => I18N.num(n);
  // дуга, по которой на штемпеле идёт надпись: нужна и списку достижений, и плашке нового достижения
  const ACH_ARC = '<svg style="position:absolute;width:0;height:0"><defs><path id="ach-arc" d="M28.5 40 a25.5 25.5 0 0 1 51 0"/></defs></svg>';
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
    const tight = a.name.length > 20 && a.desc.length > 28 ? 'tight' : '';
    return `<div class="arow ${done ? 'done' : 'locked'} ${tight}">
      <div class="aport ${a.cat}">${achArt(a)}${fresh ? `<em class="anew">${tr('новое')}</em>` : ''}${a.stars ? `<i class="arank">${'★'.repeat(a.stars)}</i>` : ''}</div>
      <div class="atext"><h3>${a.name}</h3><p>${desc}</p>
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
      ${ACH_ARC}
      <div class="achhead">
        <span class="achtag">${pico('medal') || ICO.medal}${tr('Достижения')}</span>
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
      // враг, который встречается в двух стадиях, стоит один раз: там, где встречается впервые
      const shown = new Set();
      return MAIN_STAGES.map((g) => { const ids = stageFoes(g).filter((id) => !shown.has(id)); ids.forEach((id) => shown.add(id)); return cxGroup(g.name, tiles(ids)); }).join('')
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
    // в длинном сюжете босс крепче своей записи, начинает с Силой и впадает в Ярость (BAL)
    const bsi = LONG && e.tier === 'boss' ? (final ? 2 : Math.max(0, MAIN_STAGES.indexOf(stage))) : -1;
    // обычные враги и элиты крепнут с каждым уровнем (BAL.hpStep): запись в данных — это HP на самом первом уровне,
    // а на окраине у того же врага их втрое больше. Показываем, сколько HP бывает у врага на тех уровнях, где он встречается
    // (обычная сложность, те же правила, что в genChoices и startCombat)
    let hpLo = Infinity; let hpHi = 0;
    if (LONG && bsi < 0) MAIN_STAGES.forEach((g, si) => {
      for (let s = g.start; s < g.end; s++) {
        const k = s - g.start;
        const muls = [];
        if ((k < 8 && g.early.length ? g.early : g.normals).includes(id)) muls.push(1);
        if (g.elites.includes(id) && (si > 0 || k >= 6)) muls.push(BAL.eliteHp[Math.min(1, si)]);
        muls.forEach((m) => { const v = Math.round(e.hp * (1 + s * BAL.hpStep) * m); hpLo = Math.min(hpLo, v); hpHi = Math.max(hpHi, v); });
      }
    });
    const hpShown = bsi >= 0 ? Math.round(e.hp * BAL.bossHp[bsi]) : hpHi > hpLo ? `${hpLo}–${hpHi}` : hpHi || e.hp;
    const traits = [
      bsi >= 0 && BAL.bossStr[bsi] > 0 && tr('Начинает бой с Силой {n}.', { n: BAL.bossStr[bsi] }),
      bsi >= 0 && tr('Ярость: на половине HP получает Силу +{n} и {b} защиты.', { n: BAL.rageStr[bsi], b: BAL.rageBlock[bsi] }),
      e.thorns && tr('Каждый ваш удар по врагу ранит вас на {n}', { n: e.thorns }),
      e.nest && tr('Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: {n}.', { n: e.nest }),
      e.boil && tr('Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После своего хода он остывает. Поджог его не злит.'),
      e.tally && tr('Каждая {n}-я карта за ход: кукушка кукует и бьёт вас на 3.', { n: e.tally }),
      e.plating && tr('Латы: защита не сгорает, а копится от хода к ходу. Поджог бьёт прямо по HP.'),
      e.alarm && tr('Каждый ваш Навык даёт сторожу {n} защиты до конца вашего хода. Бейте до хитростей.', { n: e.alarm }),
    ].filter(Boolean);
    const att = ['like', 'fear', 'hate'].map((k) => { const h = (LORE.ATT[id] || {})[k]; return h ? `<p class="cxatt a-${k}"><b>${tr(ATT_FOE[k])}:</b> ${cxHas('h', h) ? CLASSES[h].name : '???'}</p>` : ''; }).join('');
    const ties = LORE.ETIES.filter(([a, b]) => a === id || b === id)
      .map(([a, b, k, text]) => cxRow('e', a === id ? b : a, tr(text), tr(k === 'kin' ? 'Свои' : 'Соперники'))).join('');
    const said = SAY[id] && (Array.isArray(SAY[id].start) ? SAY[id].start[0] : SAY[id].start);
    return `${cxBack()}
      <div class="cxhead"><span class="cxport foe f-${e.tier}">${Art.enemy(id)}</span><div><h3>${e.name}</h3><p class="cxsub">${tierName}${stage && !e.dark ? ` · ${stage.name}` : ''}</p><p>${e.line}</p></div></div>
      <div class="cxstats"><span>${hpShown} HP</span><span>${tr('Побед над этим врагом: {n}', { n: ACH.k[id] || 0 })}</span></div>
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
        <span class="achtag">${pico('book') || ICO.book}${tr('База знаний')}</span>
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
        <span class="achtag">${pico('stats') || ICO.stats}${tr('Статистика')}</span>
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
    showOverlay(`<div class="settings pausebox askbox"><button class="sclose" data-act="r-no" aria-label="${tr('Закрыть')}">✕</button><div class="sribbon">${tr('Сбросить прогресс?')}</div><div class="pause">
      <p class="ovhint">${tr('Сохранённый забег, статистика и достижения будут удалены. Настройки и покупки останутся.')}</p>
      <button class="btn" data-act="r-yes">${tr('Сбросить')}</button>
      <button class="btn ghost" data-act="r-no">${tr('Отмена')}</button></div></div>`, (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'r-no') { showSettings(); return; }
      if (C && busy) { toast(tr('Дождись конца хода')); return; }
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
  const adTag = () => (Store.noAds() ? `<i class="adtag free">${tr('Бонус')}</i>` : `<i class="adtag">${uiIco('ad')}${tr('Реклама')}</i>`);
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
          <span class="sico big">${uiIco('ad')}</span>
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
    // пока игрок выбирает героя, скачиваем первую улицу и рамки карты пути
    if (Art.warm) Art.warm({ pics: ['story_intro'], scene: STORY.sky === 'night' ? 'night' : STAGES[0].scene, ui: ['parch', 'topbar', 'mapcard', 'herobar', 'tile'], heroes: [CLASSES[sel].look] });
    const h = CLASSES[sel];
    const r = RELICS[h.relic];
    const own = heroCards(sel);
    // экран уже открыт (сменили героя или сложность): шапка не въезжает заново, оживает только то, что изменилось
    const again = screen.className === 'scr-class';
    const newHero = again && screen.dataset.cls !== sel;
    screen.className = 'scr-class';
    screen.dataset.cls = sel;
    screen.dataset.diff = diff;
    const d = DIFFICULTIES[diff];   // HP на плашке героя — с поправкой сложности, как в забеге (newRun): раньше «Прогулка» показывала 44, а забег начинался с 56 (v157)
    const won = ACH.s.winsDiff || [];
    screen.innerHTML = `
      <div class="clshead ${again ? 'still' : ''}"><h2>${tr('Кто понесёт письмо?')}</h2><p>${tr('У каждого героя свой путь к победе')}</p></div>
      <div class="clsrow">${Object.entries(CLASSES).map(([id, c]) => `<button class="clscard ${id === sel ? 'on' : ''} ${Store.heroOwned(id) ? '' : 'locked'}" data-act="pickcls" data-cls="${id}">
        <span class="cp ${id}">${heroFace(id)}${Store.heroOwned(id) ? '' : `<i class="lockico">${uiIco('lock')}</i>`}</span><b>${c.name}</b><small>${c.role}</small></button>`).join('')}</div>
      <div class="clsinfo ${newHero ? 'swap' : ''}">
        <div class="clsbig ${sel}">${heroArt(sel)}</div>
        <div class="clstext">
          <h3>${h.name}<small>${h.role}</small></h3>
          <div class="clsstats"><span>${Art.icon('heart')}${h.hp + d.heroHp} HP</span><span>${Art.icon('coin')}${h.gold}</span></div>
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
        : `<div class="clsbtns locked"><button class="btn ghost" data-act="title">${tr('Назад')}</button><button class="btn big buyhero" data-act="sbuy" data-p="hero_${sel}">${uiIco('lock')}<span>${tr('герой::Открыть')}<small>${Store.PRODUCTS[`hero_${sel}`].price}</small></span></button><button class="btn ghost" data-act="store" data-back="cls">${tr('Магазин')}</button></div>`}`;
    // Длинные описания (чаще в переводах) опускали рамку сложности под кнопки: тогда строки и отступы плотнее
    delete screen.dataset.tight;
    const db = $('.diffbox'); const cb = $('.clsbtns');
    if (db && cb && cb.offsetTop + Math.min(...[...cb.children].map((x) => x.offsetTop)) - (db.offsetTop + db.offsetHeight) < 4) screen.dataset.tight = '1';
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
  // лента-заголовок; длинная надпись пишется мельче, чтобы свиток не заходил под кнопки в углу
  const ribbon = (t) => `<div class="ribbon${t.length > 13 ? ' long' : ''}">${t}</div>`;
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
    tidyStats();
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
    if (s === 0) return done([fight(), fight(), { t: 'event', ev: pickEvent() }]);
    if (s === g.end - 1) return done([{ t: 'rest' }, { t: 'shop' }, eliteOk ? elite() : fight()]);
    const pool = [];
    // после привала, лавки, сундука, события или встречи дорога ведёт только через бой
    run.forced = LONG && ['event', 'shop', 'chest', 'rest', 'meet'].includes(run.prev);
    if (run.forced) { pool.push(fight(), fight(), eliteOk && Math.random() < BAL.eliteAfterCalm ? elite() : fight()); }
    const weights = [['fight', 40], ['event', 18], ['shop', 10], ['chest', 10], ['rest', 12], ['elite', eliteOk ? (LONG ? BAL.eliteW[Math.min(1, si)] : si > 0 ? 16 : 10) : 0]];
    const total = weights.reduce((a, w) => a + w[1], 0);
    while (pool.length < 3) {
      let r = Math.random() * total; let t = 'fight';
      for (const [key, w] of weights) { if ((r -= w) < 0) { t = key; break; } }
      if (t !== 'fight' && t !== 'event' && pool.some((p) => p.t === t)) continue;
      if (t === 'fight') pool.push(fight());
      else if (t === 'elite') pool.push(elite());
      else if (t === 'event') pool.push({ t: 'event', ev: pickEvent(pool.map((p) => p.ev)) });
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
  /* Событие для развилки. Событий всего девять, а брались они наугад: в трёх забегах из четырёх одно и то же событие
     попадалось дважды, в каждом втором два раза подряд (прогон 300 забегов). Теперь сначала предлагаются события,
     в которых герой в этом забеге бывал реже всего, и не то, из которого он только что вышел. Убрать: вернуть pick(EVENTS). */
  function pickEvent(skip = []) {
    const been = run.evSeen || {};
    let c = EVENTS.filter((e) => !skip.includes(e.id));
    const least = Math.min(...c.map((e) => been[e.id] || 0));
    c = c.filter((e) => (been[e.id] || 0) === least);
    if (c.length > 1) c = c.filter((e) => e.id !== run.evLast);
    return pick(c).id;
  }

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
    // пока игрок выбирает дорогу, тихо скачиваем картинки следующего экрана: врагов, сцены, рамки и рисунки карт
    if (Art.warm) {
      const ch = run.choices; const has = (t) => ch.some((o) => o.t === t);
      Art.warm({
        enemies: [...ch.filter((o) => o.enemy).map((o) => o.enemy), ...(has('shop') ? ['hedgehog'] : [])],
        places: [...['shop', 'rest', 'chest', 'meet'].filter(has), ...(ch.some((o) => o.enemy) ? ['talk'] : [])],
        ui: ['f_atk', 'f_skill', 'f_charm', 'f_status', 'bubble', 'scroll', 'row2', 'parch'],
        cards: run.deck.map((c) => c.id), intents: true,
        pics: ch.filter((o) => o.t === 'event').map((o) => { const ev = EVENTS.find((e) => e.id === o.ev); return ev && EV_PIC[ev.art]; }).filter((k) => k && picFits(k)),
      });
    }
  }

  function mapHint() {
    const si = stageOf(run.step);
    const g = STAGES[si];
    if (run.step === g.start && STORY.stageIntro) return `<b>${g.name}</b><small>${STORY.stageIntro[si] || ''}</small>`;
    if (run.step === 0) return tr('Выбери, куда идти');
    if (run.forced && run.choices && run.choices.every((o) => o.t === 'fight' || o.t === 'elite')) return `<b>${tr('Уровень {n}', { n: run.step + 1 })}</b><small>${tr('После передышки дорога ведёт через бой')}</small>`;
    return tr('Уровень {n}', { n: run.step + 1 });
  }

  let pickedEnc = false;   // карта пути уже выбрана и показывает это: второй тап не считается
  function chooseEncounter(i) {
    const o = run.choices[i];
    run.choices = null;
    run.prev = o.t;
    if (o.t === 'event') { run.evSeen = run.evSeen || {}; run.evSeen[o.ev] = (run.evSeen[o.ev] || 0) + 1; run.evLast = o.ev; }
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
      const id = pickRelic(free);
      addRelic(id);
      // Что делает подарок: показ называет только имя талисмана и гаснет через полторы секунды. После элиты, в событиях и разговорах
      // игрок получал талисман и не узнавал, что он делает, пока сам не открывал список (v156). Сундук, лавка и трофеи описание показывают сами
      toast(`${RELICS[id].name}. ${RELICS[id].desc}`);
    },
    // «Отмена» в окне выбора карты возвращает к событию с теми же ответами, как у костра и в лавке. Раньше отмена
    // заканчивала событие (ответы пропадали), а «Ледяное зеркало» ещё и забирало 7 HP ни за что (v159)
    removeCardPrompt: () => removeCardFlow((ok) => { if (ok) afterMoment(advance); }),
    upgradePrompt: () => upgradeFlow((ok) => { if (ok) afterMoment(advance); }),
    upgradeRandom: (n) => upgradeRandom(n),
    duplicatePrompt: (cost = 0) => {   // cost: HP за копию, снимаются только когда карта выбрана
      // легендарная карта в колоде одна (справочник, «Редкость»): зеркало её не повторяет. Раньше копия давала вторую (v152)
      const own = run.deck.filter((c) => CARDS[c.id].rarity !== 'status');
      const list = own.filter((c) => CARDS[c.id].rarity !== 'legendary');
      showDeck(list, tr('Выбери карту для копии'), (uid) => {
        hideOverlay();
        const c = uid != null && list.find((d) => d.uid === uid);
        if (!c) return;
        if (cost) evApi.damage(cost);
        run.deck.push(mk(c.id, c.up)); SND.sfx('card'); toast(tr('Копия: {name}', { name: cardName(c) }));
        advance();
      }, null, list.length < own.length ? tr('Легендарные карты зеркало не повторяет') : '');
    },
    transformPrompt: () => {
      showDeck(run.deck, tr('Какую карту отдать?'), (uid) => {
        hideOverlay();
        if (uid == null) return;
        const c = run.deck.find((d) => d.uid === uid);
        run.deck = run.deck.filter((d) => d.uid !== uid);
        const id = pickCard('rare');
        run.deck.push(mk(id));
        SND.sfx('relic');
        toast(`${cardName(c)} → ${CARDS[id].name}`);
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

  function addRelic(id, quiet) {
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
    // новый талисман показывается крупно, с лучами; quiet: экран сам показывает находку (сундук)
    if (!quiet) moment(`<div class="mrelic">${Art.relic(id)}</div>`, tr('Талисман: {name}', { name: RELICS[id].name }), 'talis');
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
      if (c) { c.up = true; achUpgraded(1); SND.sfx('relic'); moment(cardHTML(c), tr('Улучшена: {name}', { name: cardName(c) }), 'up'); }
      done(!!c);
    }, 'up');
  }

  function removeCardFlow(done) {
    showDeck(run.deck, tr('Выбери карту, которую убрать'), (uid) => {
      hideOverlay();
      if (uid != null) { const c = run.deck.find((d) => d.uid === uid); run.deck = run.deck.filter((d) => d.uid !== uid); moment(cardHTML(c), tr('Убрана: {name}', { name: cardName(c) }), 'gone'); }
      done(uid != null);
    });
  }

  /* ---------- Событие ---------- */
  function goEvent(ev) {
    setBg();
    screen.className = 'scr-event';
    screen.innerHTML = `${topBar()}
      ${evArt(ev)}
      <div class="ev-box"><h2>${ev.title}</h2><p>${I18N.fill(ev.text)}</p></div>
      <div class="scrolls">${ev.options.map((o, i) => {
        const ok = !o.can || o.can(run);
        return `<button class="scroll ${ok ? '' : 'off'} ${o.ad ? 'adopt' : ''}" data-act="evopt" data-i="${i}" ${ok ? '' : 'disabled'}>${o.ad ? adTag() : ''}${o.text}<small>${o.hint}</small></button>`;
      }).join('')}</div>
      ${heroBar(false)}${FXH}`;
    warmPeace();
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
    const gold0 = run.gold; const hp0 = run.hp;
    const mark = stMark();
    const res = tr(ev.options[i].act(run, evApi)); // итог события — русский текст, он же ключ перевода
    stGoldSince(mark);
    ach.add('spent', gold0 - run.gold);
    if (res === null) return; // опция сама ведёт дальше (например, удаление карты)
    if (fought) {
      save({ t: 'fight', enemy: fought }); toast(res);
      // бой начнётся через полсекунды: до него ответы больше не нажимаются. Раньше «Собрать» у рассыпанного кошелька
      // можно было успеть нажать ещё раз и получить монеты дважды (а бой запускался два раза подряд)
      screen.querySelectorAll('.scroll').forEach((x, k) => { x.disabled = true; if (k !== i) x.classList.add('off'); });
      const r = run;
      setTimeout(() => { if (run === r && screen.className === 'scr-event') startCombat(fought, 'fight'); }, 600);
      return;
    }
    save({ t: 'next' });
    $('.scrolls').innerHTML = `<button class="scroll" data-act="next">${tr('Дальше')}</button>`;
    $('.ev-box p').textContent = res;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
    showGain(hp0, gold0);
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
    // с чем враг выйдет на бой из-за отношения к герою (те же числа, что в startCombat). Раньше «В бой» у врага, который
    // не терпит героя, называлось «Обычный бой», хотя Сила была +2, а «Ответить дерзко» обещало +3 при настоящих +5
    const kin = e.dark ? null : tie && tie.kind;   // мрачные герои дерутся без счётов за своих
    const angry = (att === 'hate' || att === 'grudge' ? 2 : 0) + (kin === 'avenge' ? 1 : 0);
    const scared = (att === 'fear' ? 2 : 0) + (kin === 'rival' ? 2 : 0);
    const mood = angry && scared ? tr('Сила врага +{n}, враг Ослаблен на {w} хода', { n: angry, w: scared })
      : angry ? tr('Сила врага +{n}', { n: angry }) : scared ? tr('Враг Ослаблен на {n} хода', { n: scared }) : tr('Обычный бой');
    const ops = [{ k: 'fight', text: 'В бой', hint: mood }];
    if (tie && tie.kind === 'thanks') ops.push({ k: 'regards', text: 'Передать привет', hint: tr(tier === 'boss' ? 'Босс Ослаблен на 2 хода' : 'Без боя, монеты и +6 HP'), secret: true });
    const sc = secretOf(id);
    if (sc) ops.push({ k: 'secret', text: sc.text, hint: tr(sc.hint), can: !(sc.effect.gold < 0) || run.gold >= -sc.effect.gold, secret: true });
    if (e.dark) ops.push({ k: 'forgive', text: LORE.FORGIVE.text, hint: tr(LORE.FORGIVE.hint), can: run.maxHp > 12 });
    if (att === 'like') ops.push(tier === 'boss' ? { k: 'heart', text: 'Поговорить по душам', hint: tr('Босс Ослаблен на 2 хода') }
      : { k: 'peace', text: 'Договориться миром', hint: tr(tier === 'elite' ? 'Без боя, талисман' : 'Без боя, монеты и +6 HP') });
    if (att === 'fear' && tier !== 'boss') ops.push({ k: 'scare', text: 'Прогнать', hint: tr('Без боя, половина монет') });
    if (att === 'hate' || att === 'grudge' || (tie && tie.kind === 'avenge')) {
      ops.push({ k: 'calm', text: 'Успокоить', hint: tr('−{n} {n|монета|монеты|монет}, враг не злится', { n: calmPrice(tier) }), can: run.gold >= calmPrice(tier) });
      ops.push({ k: 'sass', text: 'Ответить дерзко', hint: tr('Сила врага +{n}, монет вдвое больше', { n: 3 + angry }) });
    } else ops.push({ k: 'taunt', text: 'Подразнить', hint: tr('Сила врага +2, монет в полтора раза больше') });
    if (!att && !sc && tier === 'fight') ops.push({ k: 'bribe', text: 'Откупиться', hint: tr('−{n} {n|монета|монеты|монет}, без боя', { n: bribePrice() }), can: run.gold >= bribePrice() });
    return ops;
  }

  // разговор до боя: враг говорит, герой выбирает ответ
  function goTalk(id, tier) {
    ensureLore();
    setBg(); // разговор идёт там же, где будет бой: тот же фон пути
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
      ${heroBar(false)}${FXH}`;
    warmPeace();
  }

  // ответ в разговоре; mod — как разговор изменит бой (действует до награды за него)
  // Ответ выбран, вариантов стало меньше: прижатая к низу вёрстка роняла собеседника вниз, а за ним прыгал и фон.
  // Собеседник остаётся стоять, где стоял: под единственной кнопкой оставляем столько же места, сколько занимали варианты
  function keepStand(fn) {
    const foot = () => { const a = screen.querySelector('.talk-art'); return a ? a.offsetTop + a.offsetHeight : null; };
    const y0 = foot(); fn(); const y1 = foot(); const sc = screen.querySelector('.scrolls');
    if (sc && y0 != null && y1 != null && y1 - y0 > 2) sc.style.paddingBottom = `${Math.round(y1 - y0)}px`;
  }
  function talkChoose(k) {
    const id = screen.dataset.enemy; const tier = screen.dataset.tier;
    const e = ENEMIES[id];
    const mod = { str: 0, weak: 0, goldMul: 1, hpMul: 1, stun: 0, talked: true };
    let reply = null; let narr = null; let next = 'fight'; let fightId = id;
    const hp0 = run.hp; const gold0 = run.gold;
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
        const g = goldFor('fight'); gain(g); evApi.heal(6);
      }
    } else if (k === 'peace') {
      next = 'peace'; beKind(id); reply = lineOf(id, 'peace') || 'Ладно, иди с миром.'; run.tone.peace++; ach.add('peace');
      if (tier === 'elite') evApi.giveRelic(); else { const g = goldFor('fight'); gain(g); evApi.heal(6); }
    } else if (k === 'scare') {
      next = 'peace'; ach.add('scares'); const g = Math.ceil(goldFor(tier) / 2); gain(g);
      narr = tr('{name} убегает, бросив {n} {n|монету|монеты|монет}.', { name: e.name, n: g });
    } else if (k === 'bribe') {
      spend(bribePrice()); next = 'peace'; narr = tr('Монеты звякнули, и {name} уступает дорогу.', { name: e.name });
    } else if (k === 'secret') {
      const sc = secretOf(id); const fx = sc.effect;
      run.secrets.push(id); ach.put('secrets', run.cls); if (fx.peace) ach.add('peace'); run.tone.peace++;   // «Миром» только там, где тайна обходится без боя
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
    keepStand(() => {
      $('.talk-box p').innerHTML = reply ? quote(reply) : narr;
      const note = $('.tienote'); if (note) note.remove();
      if (fightId !== id) { $('.talk-box h2').textContent = ENEMIES[fightId].name; $('.talk-art').innerHTML = (Art.enemyLive || Art.enemy)(fightId); }
      const act = next === 'fight' ? 'talkgo' : next === 'bosspeace' ? 'talkboss' : 'next';
      $('.scrolls').innerHTML = `<button class="scroll" data-act="${act}">${tr(next === 'fight' ? 'В бой' : 'Дальше')}</button>`;
    });
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
    ach.add('spent', gold0 - run.gold); // «Звонкая монета» считает и монеты, отданные в разговоре: успокоить, откупиться, выкупить
    showGain(hp0, gold0); // монеты и здоровье, полученные или отданные в разговоре, видны у портрета
  }

  /* После боя побеждённый враг иногда просит пощады: подарок или больше монет, но обида на весь забег */
  const wantsPlea = (id, tier) => mainStory() && SAY[id] && SAY[id].plea && (tier === 'boss' || Math.random() < 0.4);
  function goAfter(tier, id) {
    save({ t: 'after', tier, enemy: id });
    setBg(); // разговор идёт там же, где будет бой: тот же фон пути
    const e = ENEMIES[id];
    screen.className = 'scr-talk';
    screen.dataset.enemy = id; screen.dataset.tier = tier;
    screen.innerHTML = `${topBar()}
      <div class="talk-art beaten tk-${e.tier}">${(Art.enemyStand || Art.enemy)(id)}</div>
      <div class="ev-box talk-box"><h2>${e.name}</h2><p>${quote(SAY[id].plea)}</p></div>
      <div class="scrolls">
        <button class="scroll" data-act="spare">${tr('Пощадить')}<small>${tr(tier === 'boss' ? 'Враг отдаст талисман' : 'Враг оставит подарок')}</small></button>
        <button class="scroll" data-act="takeall">${tr('Забрать всё')}<small>${tr('Монет в полтора раза больше, но враг запомнит обиду')}</small></button>
      </div>
      ${heroBar(false)}${FXH}`;
    warmPeace();
  }
  function afterChoose(spare) {
    const id = screen.dataset.enemy; const tier = screen.dataset.tier;
    const hp0 = run.hp; const gold0 = run.gold;
    let msg;
    if (spare) {
      run.tone.peace++; ach.add('spares');
      run.killed = run.killed.filter((x) => x !== id); beKind(id);
      if (tier === 'boss') evApi.giveRelic();
      else {
        const gift = rnd(0, 2);
        if (gift === 0) evApi.heal(8); else if (gift === 1 && upgradeRandom(1)) { /* всплывашка уже показана */ } else gain(15);
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
    keepStand(() => {
      $('.talk-box p').textContent = msg;
      $('.scrolls').innerHTML = `<button class="scroll" data-act="afternext">${tr('Дальше')}</button>`;
    });
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
    showGain(hp0, gold0);
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
      ${heroBar(false)}${FXH}`;
    warmPeace();
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
    const hp0 = run.hp; const gold0 = run.gold;
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
    ach.add('spent', gold0 - run.gold); // и монеты, отданные героям на встречах
    run.meetLog.push(k);
    relChange(h, fx.rel || 0);
    const finish = () => {
      save({ t: 'next' });
      keepStand(() => {
        screen.innerHTML = `${topBar()}
          <div class="talk-art hero">${heroArt(h)}</div>
          <div class="ev-box talk-box"><h2>${tr(m.title)}</h2><p>${tr(o.res)}</p></div>
          <div class="scrolls"><button class="scroll" data-act="next">${tr('Дальше')}</button></div>
          ${heroBar(false)}${FXH}`;
      });
      showGain(hp0, gold0);
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
    // длинная реплика висит дольше: 50 мс на знак, как у коротких сообщений (v155). Раньше любая висела 2,6 с, и личные
    // реплики врагов (до 67 знаков, в английском до 85) надо было читать по 26–33 знака в секунду. Облачко ничего не закрывает
    const life = Math.min(5200, Math.max(ms, 600 + b.textContent.length * 50));
    setTimeout(() => b.remove(), SETTINGS.fast ? life * 0.7 : life);
  }

  /* Друзья помогают в начале финального боя (js/lore.js, FRIEND) */
  async function friendHelp() {
    const fr = C.friends;
    if (!fr.length) return;
    toast(tr('Друзья рядом: {list}', { list: fr.map((h) => CLASSES[h].name).join(', ') }));
    if (fr.length >= 3) ach.flag('friends3');
    if (fr.includes('guard')) api.block(12);
    if (fr.includes('baker')) { evApi.heal(10); FX.play('heal'); }
    if (fr.includes('stoker')) { C.enemy.burn += 6; FX.play('burnApply', 'enemy'); }
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
    // товар на прилавке: три карты и талисман. Его можно обновить за монеты, услуги при этом остаются как были
    const stock = (skip = []) => {
      const cards = ['common', 'uncommon', rollRarity([0.05, 0.25, 1, 1])].map((r) => pickCard(r)).map((id) => ({ id, price: disc(base[CARDS[id].rarity] + rnd(-4, 6)), sold: false }));
      let rid = pickRelic();
      for (let k = 0; k < 6 && rid && skip.includes(rid); k++) rid = pickRelic(); // не тот же талисман, что лежал
      return { cards, relic: rid ? { id: rid, price: disc((LONG ? BAL.relicPrice : { common: 90, uncommon: 108, rare: 125, epic: 150, legendary: 190 })[RELICS[rid].tier]), sold: false } : null };
    };
    const shop = saved || { ...stock(), tea: { price: disc(22), sold: false }, remove: { price: disc(50), sold: false }, up: { price: disc(55), sold: false }, rerolls: 0 };
    const rerollPrice = () => disc(20 + 12 * (shop.rerolls || 0)); // каждое обновление дороже
    screen.className = 'scr-shop';
    if (shop.relic) codexMark('r', shop.relic.id);
    const last = isFinalStep(run.step); // лавка у последней двери
    const bought = () => { if (last) ach.flag('finalbuy'); };
    const render = () => {
      save({ t: 'shop', shop });
      screen.innerHTML = `${topBar()}
        <div class="shopkeeper">${(Art.enemyLive || Art.enemy)('hedgehog')}<div class="bubble">${tr(shop.rerolls ? 'Свежий товар! Только что с саней.' : last ? 'Последняя лавка перед дверью! Бери, не стесняйся.' : 'Всё по-честному! Почти.')}</div></div>
        <div class="shop-cards">${shop.cards.map((c, i) => `<div class="ware ${c.sold ? 'sold' : ''}">${cardHTML(c.id, 'shopcard', `data-act="buy" data-i="${i}"`)}<div class="price ${run.gold < c.price ? 'poor' : ''}">${Art.icon('coin')}${c.price}</div></div>`).join('')}</div>
        <div class="shop-services">
          ${shop.relic ? `<button class="svc ${shop.relic.sold ? 'sold' : ''}" data-act="buyrelic">${Art.relic(shop.relic.id)}<span><b>${RELICS[shop.relic.id].name}<em class="rtier ${RELICS[shop.relic.id].tier}">${TIER_LABEL[RELICS[shop.relic.id].tier]}</em></b><small>${RELICS[shop.relic.id].desc}</small></span><i class="${run.gold < shop.relic.price ? 'poor' : ''}">${Art.icon('coin')}${shop.relic.price}</i></button>` : ''}
          <button class="svc ${shop.tea.sold ? 'sold' : ''}" data-act="buytea">${Art.icon('tea')}<span><b>${tr('Горячий сбитень')}</b><small>${tr('Восстановить {n} HP', { n: Math.min(12, run.maxHp - run.hp) || 12 })}</small></span><i class="${run.gold < shop.tea.price ? 'poor' : ''}">${Art.icon('coin')}${shop.tea.price}</i></button>
          <button class="svc ${shop.up.sold ? 'sold' : ''}" data-act="buyup">${Art.icon('whetstone')}<span><b>${tr('лавка::Заточка')}</b><small>${tr('Улучшить карту')}</small></span><i class="${run.gold < shop.up.price ? 'poor' : ''}">${Art.icon('coin')}${shop.up.price}</i></button>
          <button class="svc ${shop.remove.sold ? 'sold' : ''}" data-act="buyremove">${Art.icon('scissors')}<span><b>${tr('Распустить карту')}</b><small>${tr('Убрать карту из колоды')}</small></span><i class="${run.gold < shop.remove.price ? 'poor' : ''}">${Art.icon('coin')}${shop.remove.price}</i></button>
        </div>
        <button class="btn ghost reroll" data-act="reroll">${tr('Обновить товар')}<i class="${run.gold < rerollPrice() ? 'poor' : ''}">${Art.icon('coin')}${rerollPrice()}</i></button>
        <button class="btn leave" data-act="next">${tr('Уйти')}</button>
        ${heroBar(false)}${FXH}`;
    };
    const pay = (item) => {
      if (item.sold) return false;
      if (run.gold < item.price) { SND.sfx('deny'); toast(tr('Не хватает монет')); return false; }
      spend(item.price); item.sold = true; ach.add('spent', item.price); SND.sfx('coin'); bought(); return true;
    };
    screen.onShop = (act, i) => {
      const g0 = run.gold;
      if (act === 'buy' && pay(shop.cards[i])) { flyToDeck(screen.querySelectorAll('.shopcard')[i]); ach.add('bought'); run.deck.push(mk(shop.cards[i].id)); toast(tr('Куплено: {name}', { name: CARDS[shop.cards[i].id].name })); }
      if (act === 'buyrelic' && shop.relic && pay(shop.relic)) addRelic(shop.relic.id);
      let tea = 0;
      // сбитень при полном здоровье забирал монеты и показывал «+0»
      if (act === 'buytea' && !shop.tea.sold && run.hp >= run.maxHp) { SND.sfx('deny'); toast(tr('Здоровье и так полное')); return; }
      if (act === 'buytea' && pay(shop.tea)) { const before = run.hp; run.hp = Math.min(run.maxHp, run.hp + 12); tea = run.hp - before; stAdd('healed', tea); SND.sfx('heal'); }
      if (act === 'reroll') {
        const price = rerollPrice();
        if (run.gold < price) { SND.sfx('deny'); toast(tr('Не хватает монет')); return; }
        spend(price); ach.add('spent', price); SND.sfx('coin');
        Object.assign(shop, stock(shop.relic ? [shop.relic.id] : []));
        shop.rerolls = (shop.rerolls || 0) + 1;
        if (shop.relic) codexMark('r', shop.relic.id);
        toast(tr('Товар обновлён'));
      }
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
      if (act === 'buytea' && run.gold < g0) { FX.play('heal'); floatText($('.hero-fx'), `+${tea}`, 'healf'); }   // после перерисовки, иначе эффект стёрся бы вместе с экраном
      if (run.gold < g0 && Art.act) Art.act($('.shopkeeper'), 'happy'); // ёж радуется покупке
    };
    render();
  }

  // Место элемента в координатах игры (экран 400×860, как бы ни был растянут)
  function spot(el) {
    const s = app.getBoundingClientRect(); const k = 400 / (s.width || 400); const r = el.getBoundingClientRect();
    return { x: (r.left - s.left + r.width / 2) * k, y: (r.top - s.top + r.height / 2) * k, w: r.width * k, h: r.height * k };
  }
  // Купленная или взятая в награду карта улетает в колоду: копия карты едет к кнопке «Колода», счётчик подпрыгивает.
  // Копия живёт поверх экранов, поэтому переход на следующий экран её не обрывает.
  function flyToDeck(el) {
    const to = $('.deckbtn');
    if (!el || !to || !el.animate) return;
    const a = spot(el); const b = spot(to);
    const c = el.cloneNode(true);
    c.className = `${el.className.replace(/\b(shopcard|reward)\b/g, '')} flycard`;
    c.removeAttribute('data-act');
    c.style.cssText = `--w:${a.w}px; position:absolute; left:${a.x - a.w / 2}px; top:${a.y - a.h / 2}px; margin:0; z-index:30; pointer-events:none; animation:none;`;
    app.appendChild(c);
    const ms = SETTINGS.fast ? 240 : 460;
    c.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: 'brightness(1.4)' },
      { transform: `translate(${(b.x - a.x) * 0.35}px, ${(b.y - a.y) * 0.25 - 30}px) scale(.8)`, opacity: 1, filter: 'brightness(1.1)', offset: 0.4 },
      { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(.16)`, opacity: 0.2, filter: 'brightness(1)' },
    ], { duration: ms, easing: 'cubic-bezier(.4, 0, .7, .4)' }).onfinish = () => {
      c.remove();
      const d = $('.deckbtn');
      if (d && d.animate) d.animate([{ scale: 1 }, { scale: 1.22, filter: 'brightness(1.5)' }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
    };
  }

  /* ---------- Сундук ---------- */
  function goChest() {
    setBg(); // на нарисованной сцене сундука уже есть свой сундук, поэтому фон пути
    screen.className = 'scr-chest';
    screen.innerHTML = `${topBar()}
      <div class="chest-wrap"><div class="chest">${Art.icon('chest')}</div><p>${tr('Сундук-соня сладко храпит.')}</p></div>
      <div class="row2"><button class="btn" data-act="openchest">${tr('Открыть')}</button><button class="btn ghost" data-act="next">${tr('Не будить')}</button></div>
      ${heroBar(false)}${FXH}`;
    FX.warm(['loot', 'find']);
  }
  function openChest() {
    ach.add('chests');
    const free = freeRelics();
    let msg; let found = null;
    // из сундука вылетает то, что в нём лежало: горка монет или звёзды находки.
    // Подпись под сундуком уже называет талисман и что он делает, поэтому всплывашку с тем же именем поверх неё убираем
    const at = spot($('.chest'));
    const burst = { x: at.x, y: at.y - 6, w: at.w, h: at.h, foot: at.y + at.h * 0.3 };
    if (free.length && Math.random() < (LONG ? BAL.chestRelic : 0.5)) { const id = pickRelic(free); found = id; addRelic(id, true); FX.play('find', burst); msg = tr('Внутри: {name}. {desc}', { name: RELICS[id].name, desc: RELICS[id].desc }); }
    else { const g = rnd(28, 45); gain(g); SND.sfx('coin'); FX.play('loot', burst); msg = tr('Внутри {n} {n|монета|монеты|монет}.', { n: g }); }
    save({ t: 'next' });
    $('.chest').classList.add('open');
    // сундук нарисован только закрытым: найденный талисман показываем сам, он поднимается из сияния над крышкой
    if (found) $('.chest').insertAdjacentHTML('beforeend', `<div class="chest-find">${Art.relic(found)}</div>`);
    $('.chest-wrap p').textContent = msg;
    $('.row2').innerHTML = `<button class="btn" data-act="next">${tr('Дальше')}</button>`;
    $('.topbar').outerHTML = topBar();
    $('.herobar').outerHTML = heroBar(false);
  }

  /* ---------- Привал ---------- */
  const restHeal = () => Math.round(run.maxHp * DIFF().rest) + (hasRelic('kettle') ? 10 : 0);
  // Подпись «Отдохнуть» называет столько HP, сколько герой на самом деле получит: раньше стояло полное число отдыха,
  // и у почти здорового героя «+18 HP» означало +1, а у здорового ноль (v158)
  function restText() {
    const heal = Math.min(restHeal(), run.maxHp - run.hp);
    const cocoa = hasRelic('cocoatin') ? tr('+{n} макс.', { n: 2 }) : '';
    return `${heal > 0 ? `+${heal} HP` : tr('Здоровье и так полное')}${cocoa ? `, ${cocoa}` : ''}`;
  }
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
        <button class="scroll ${noHeal ? 'off' : ''}" data-act="rest-heal" ${noHeal ? 'disabled' : ''}>${tr('Отдохнуть')}<small>${noHeal ? tr('Бездонная сумка не даёт присесть') : restText()}</small></button>
        <button class="scroll" data-act="rest-up">${tr('Наточить карту')}<small>${tr('Улучшить карту')}</small></button>
        <button class="scroll" data-act="rest-burn">${tr('Сжечь карту')}<small>${tr('Убрать карту из колоды')}</small></button>
      </div>
      ${heroBar(false)}${FXH}`;
    warmPeace();
  }

  /* ================= БОЙ ================= */
  const apiStatic = { state: null, played: 0, blockNow: 0, dmgText: (n) => `${n}`, blkText: (n) => `${n}`, blkNum: (n) => n, thornsGain: (n) => n };
  const api = {
    get state() { return C; },
    get played() { return C ? C.playedTurn : 0; },
    get blockNow() { return C ? C.block : 0; },
    get enemyDead() { return C.enemy.hp <= 0; },
    // название предыдущей карты хода для Копирки
    get lastCard() { return C && C.last && C.last.id !== 'carbon' ? cardName(C.last) : null; },
    // spent: карта сначала тратит Огоньки, поэтому их прибавка к урону в расчёт не идёт
    dmgText(base, spent) {
      const v = calcDmg(spent ? base - flameBonus() * C.flame : base);
      return v > base ? `<b class="up">${v}</b>` : v < base ? `<b class="down">${v}</b>` : `${v}`;
    },
    // защита, которую карта даст на самом деле: под Хрупкостью число на карте меньше и подсвечено
    blkNum: (n) => frailed(n),
    blkText(n) { const v = frailed(n); return v < n ? `<b class="down">${v}</b>` : `${n}`; },
    // сколько Шипов прибавит карта (Еловый венок удваивает)
    thornsGain: (n) => (hasRelic('wreath') ? n * 2 : n),
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
      n = frailed(n);
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
    burn(n) { const v = n + (proc('matchbox', 'enemy') ? 2 : 0); FX.play('burnApply', 'enemy'); C.enemy.burn += v; floatText($('.enemy-fx'), tr('Поджог {n}', { n: v }), 'burnf'); },
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
      const keen = C.hand.filter((c) => c.up).length;
      const list = shuffle(C.hand.filter(canUpgrade)).slice(0, n);
      list.forEach((c) => { c.up = true; c.sharp = true; });
      C.sharpened += list.length;
      // правка: заточка, которой досталась уже улучшенная карта, даёт защиту. Без этого к концу забега,
      // когда почти вся колода улучшена, точильный круг и карты Саввы не делали ничего (прогон ботов, v128)
      const spare = BAL.honeBlock ? Math.min(n - list.length, keen) : 0;
      if (spare > 0) api.block(BAL.honeBlock * spare);
      if (list.length) { ach.max('sharpfight', C.sharpened); FX.play('grind'); floatText($('.hero-fx'), list.length === 1 ? tr('Заточено: {name}', { name: CARDS[list[0].id].name }) : tr('Заточено карт: {n}', { n: list.length }), 'blockf'); }
      else if (!quiet && !spare) floatText($('.hero-fx'), tr('Нечего точить'), 'weakf');
      return list.length;
    },
    // сколько улучшенных карт в колоде, руке и сбросе (кроме самой карты)
    upCount(self) { return C ? [...C.draw, ...C.hand, ...C.disc].filter((c) => c.up && c !== self).length : 0; },
    // Пастушка: Злость Дружка и укус
    dog(n) { C.dog += n; FX.play('growl'); floatText($('.hero-fx'), tr('Злость +{n}', { n }), 'burnf'); ach.max('dogmax', C.dog); },
    async bite() {
      if (C.dog <= 0 || C.enemy.hp <= 0) return;
      const pt = $('#heroPortrait');
      if (pt) heroMove('bite');
      await FX.play('bite', 'enemy');
      floatText($('.enemy-fx'), tr('Гав!'), 'weakf');
      await hitEnemy(dogDmg(), true);
      if (proc('collar')) api.block(2);
    },
    // Знахарка: заплатить Цену здоровьем
    async price(n) {
      loseHp(n); C.paid += n; ach.max('pricefight', C.paid);
      FX.play('price'); floatText($('.hero-fx'), tr('Цена −{n} HP', { n }), 'dmgf small');
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

  // Хрупкость режет любую защиту от карт, чар и талисманов, как сказано в справочнике
  const frailed = (n) => (C.frail > 0 ? Math.floor(n * 0.75) : n);
  function exhaustCard(c) {
    C.exh.push(c);
    if (hasRelic('brazier')) { const n = frailed(3); C.block += n; floatText($('.hero-fx'), `+${n}`, 'blockf'); }
  }

  function startCombat(enemyId, tier) {
    setBg();
    snapFight = { run: JSON.stringify(run), enemyId, tier }; // для «начать бой заново»
    const e = ENEMIES[enemyId];
    run.seen[enemyId] = (run.seen[enemyId] || 0) + 1;
    run.recent = [...run.recent, enemyId].slice(-4);
    const si = Math.min(2, stageOf(run.step));
    const scale = !LONG ? (tier === 'boss' ? 1 : 1 + run.step * 0.08)
      : tier === 'boss' ? BAL.bossHp[si] : (1 + run.step * BAL.hpStep) * (tier === 'elite' ? BAL.eliteHp[Math.min(1, si)] : 1);
    const hp = Math.round(e.hp * scale * DIFF().hp);
    // отношение к герою и разговор до боя (js/lore.js): кто не терпит — злее, кто боится — слабее
    const mod = run.fmod || {};
    const att = attOf(enemyId);
    const tie = !e.dark && run.killed ? tieOf(enemyId) : null;
    codexMark('e', enemyId);
    const angry = ((att === 'hate' || att === 'grudge') && !mod.calm ? 2 : 0) + (tie && tie.kind === 'avenge' && !mod.calm ? 1 : 0);
    const str = (tier === 'boss' ? (LONG ? BAL.bossStr[si] : 0) : lvlStr(run.step)) - (hasRelic('frostglass') ? 2 : 0) + angry + (mod.str || 0);
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
      last: null, atkTurn: false, frail: 0, sap: 0, bury: 0, vane: false, medal: false, boomed: false, blast: 0,
      ginger: 0, glaze: false, sharpened: 0, dog: hasRelic('dogfriend') ? 3 : 0, paid: 0,
    };
    if (hasRelic('chimneycap')) C.enemy.burn += 6;
    // Закладка: одна случайная карта улучшена до конца боя
    if (hasRelic('bookmark')) { const list = C.draw.filter(canUpgrade); if (list.length) pick(list).up = true; }
    selected = -1;
    // у финального босса своя тема; в обычных боях два трека идут по очереди, меняются после каждой победы
    SND.music(tier === 'boss' ? (final ? 'final' : 'boss') : run.fights % 2 ? 'battle2' : 'battle');
    screen.className = 'scr-combat';
    screen.innerHTML = `
      <div class="topbar slim">${relicIcons(6)}<div class="spacer"></div><div class="stepl">${tier === 'boss' ? tr(isFinalStep(run.step) ? 'Финал' : 'Босс стадии') : tr('Уровень {a}/{b}', { a: run.step + 1, b: MAX_STEPS })}</div></div>
      <div class="enemy-zone">
        <div class="intent"></div>
        <div class="enemy ${e.tier}" id="enemy">${(Art.enemyLive || Art.enemy)(enemyId)}<div class="enemy-fx"></div></div>
        <div class="nameplate"><div class="ename">${e.name}${e.tier !== 'normal' ? `<i>${tr(e.tier === 'boss' ? (isFinalStep(run.step) ? 'Финал' : 'Босс') : 'Элита')}</i>` : ''}</div>
          <div class="ehp"><div class="trail"></div><div class="fill"></div><span></span><div class="eblk"></div></div>
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
    // нарисованные эффекты карт в руке расшифровываются заранее, чтобы первый удар не ждал
    const kinds = [];
    C.hand.forEach((c) => {
      const k = ATK_FX[c.id];
      if (k) kinds.push(k, ATK_FX_NEXT[k]);
      if (CAST_FX[c.id]) kinds.push(CAST_FX[c.id][0]);
    });
    if (C.tier === 'boss' && !C.enemy.raged) kinds.push('rage');
    FX.warm(kinds.filter(Boolean));
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
    if (proc('thimble')) C.block += frailed(2);
    if (C.charms.mittens) C.block += frailed(C.charms.mittens);
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
    if (proc('grindwheel')) api.sharpen(2, true);
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
    if (run.hp <= 0) { await fall(); goDefeat(); return; }
    if (C.enemy.hp <= 0) { await winCombat(); return; }
    busy = false;
    renderCombat();
  }

  // талисманы, которые сработали в начале боя
  function startProcs() {
    const at = { inkwell: 'enemy', frostring: 'enemy', frostglass: 'enemy', chimneycap: 'enemy' };
    ['feather', 'eternaloil', 'pinecone', 'dogfriend', 'bookmark', 'inkwell', 'frostring', 'frostglass', 'chimneycap'].forEach((id) => proc(id, at[id]));
    if (hasRelic('chimneycap')) FX.play('burnApply', 'enemy');
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

  // add — Сила, которую враг наберёт этим же ходом до удара («Сила +3» и следом удар):
  // число над головой сразу показывает удар с ней, иначе герой ставит защиту под меньший урон
  function intentHTML(it, add = 0) {
    const tip = (t) => `data-tip="${t}"`;
    if (add && it.v != null && (it.k === 'attack' || it.k === 'boom' || it.k === 'snuff' || it.k === 'steal')) it = { ...it, v: it.v + add };
    if (it.k === 'attack') return `<div class="it atk" ${tip(`${tr('Атака: {d} урона', { d: enemyDmg(it.v) })}${it.hits ? ` ${tr('{n} {n|раз|раза|раз}', { n: it.hits })}` : ''}${it.leech ? `. ${tr('Враг вылечится на весь урон, который пройдёт сквозь защиту')}` : ''}`)}>${Art.intentIcon(it.leech ? 'leech' : 'attack')}<b>${enemyDmg(it.v)}${it.hits ? `×${it.hits}` : ''}</b></div>`;
    if (it.k === 'sap') return `<div class="it deb" ${tip(tr('Собьёт с ритма: в ваш следующий ход −{n} {n|энергия|энергии|энергии}', { n: it.v }))}>${Art.intentIcon('sap')}<b>−${it.v}</b></div>`;
    if (it.k === 'mist') return `<div class="it blk" ${tip(tr('Напустит туман: до её следующего хода любой удар по ней наносит не больше {n} урона. Поджог проходит', { n: it.v }))}>${Art.intentIcon('mist')}<b>≤${it.v}</b></div>`;
    if (it.k === 'boom') return `<div class="it atk boom" ${tip(tr('Взорвётся: {d} урона, и после этого исчезнет', { d: enemyDmg(it.v) }))}>${Art.intentIcon('boom')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'bury') return `<div class="it deb" ${tip(tr('Заметёт руку: в следующий ход на {n} {n|карту|карты|карт} меньше', { n: it.v }))}>${Art.intentIcon('bury')}<b>−${it.v}</b></div>`;
    if (it.k === 'frail') return `<div class="it deb" ${tip(tr('Хрупкость на {n} {n|ход|хода|ходов}: ваша защита слабее на 25%', { n: it.v }))}>${Art.intentIcon('frail')}<b>${it.v}</b></div>`;
    if (it.k === 'block') return `<div class="it blk" ${tip(tr('Защита {n}', { n: it.v }))}>${Art.intentIcon('block')}<b>${it.v}</b></div>`;
    if (it.k === 'buff') return `<div class="it buf" ${tip(tr('Враг станет сильнее: Сила +{n}', { n: it.v }))}>${Art.intentIcon('buff')}<b>+${it.v}</b></div>`;
    if (it.k === 'debuff') return `<div class="it deb" ${tip(tr('Слабость на {n} {n|ход|хода|ходов}: ваши атаки слабее на 25%', { n: it.v }))}>${Art.intentIcon('debuff')}<b>${it.v}</b></div>`;
    if (it.k === 'snuff') return `<div class="it snf" ${tip(tr('Погасит все Огоньки и ударит на {d}', { d: enemyDmg(it.v) }))}>${Art.intentIcon('snuff')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'curse') return `<div class="it cur" ${tip(tr('Подкинет в колоду: {name} ×{n}', { name: CARDS[it.card].name, n: it.n }))}>${Art.intentIcon('curse')}<b>×${it.n}</b></div>`;
    if (it.k === 'steal') return `<div class="it atk" ${tip(tr('Ударит на {d} и украдёт до {g} {g|монеты|монет|монет}', { d: enemyDmg(it.v), g: it.gold }))}>${Art.intentIcon('steal')}<b>${enemyDmg(it.v)}</b></div>`;
    if (it.k === 'heal') return `<div class="it hea" ${tip(tr('Восстановит {n} HP', { n: it.v }))}>${Art.intentIcon('heal')}<b>+${it.v}</b></div>`;
    if (it.k === 'spikes') return `<div class="it blk" ${tip(tr('Отрастит Шипы {n}: каждый ваш удар по нему будет ранить вас', { n: it.v }))}>${Art.intentIcon('spikes')}<b>+${it.v}</b></div>`;
    if (it.k === 'sleep') return `<div class="it slp" ${tip(tr('Враг спит и пропустит ход'))}>${Art.intentIcon('sleep')}<b>${tr('Спит')}</b></div>`;
    return '';
  }

  const sti = (k) => (Art.status ? Art.status(k) : '');
  // что изменилось с прошлой отрисовки (статус, намерение, энергия): короткий «подскок».
  // Отрисовка идёт часто и заново, поэтому помним время изменения и продолжаем анимацию с нужного места.
  const chgMem = new Map();
  function popChanged(root, sel, scope) {
    if (!root) return;
    const now = performance.now(); const seen = new Set();
    root.querySelectorAll(sel).forEach((el) => {
      const val = el.textContent;
      const key = `${scope}:${el.className}:${val.replace(/[\d−+×≤/\s-]+/g, '')}`;
      seen.add(key);
      let m = chgMem.get(key);
      if (!m || m.val !== val) { m = { val, at: now, up: !m || (parseInt(val.replace(/\D+/g, ''), 10) || 0) >= (parseInt(m.val.replace(/\D+/g, ''), 10) || 0) }; chgMem.set(key, m); }
      const age = now - m.at;
      if (age < 520) { el.classList.add('chg', m.up ? 'up' : 'down'); el.style.setProperty('--age', `${-Math.round(age)}ms`); }
    });
    for (const k of [...chgMem.keys()]) if (k.startsWith(`${scope}:`) && !seen.has(k)) chgMem.delete(k);
  }

  function chip(cls, text, tipText, ico = '') {
    return `<i class="${cls}" data-tip="${tipText}">${ico}${text}</i>`;
  }

  function renderCombat(dealAnim = false) {
    if (!C) return;
    const e = C.enemy;
    if (!C.saidHurt && e.hp > 0 && e.hp <= e.max / 2) { C.saidHurt = true; say(lineOf(C.id, 'hurt')); }
    let add = 0;
    $('.intent').innerHTML = e.hp > 0 ? currentIntents().map((it) => { const h = intentHTML(it, add); if (it.k === 'buff') add += it.v; return h; }).join('') : '';
    popChanged($('.intent'), '.it', 'intent');
    $('.ehp .fill').style.width = `${(Math.max(0, e.hp) / e.max) * 100}%`;
    $('.ehp .trail').style.width = `${(Math.max(0, e.hp) / e.max) * 100}%`;
    $('.ehp span').textContent = `${Math.max(0, e.hp)}/${e.max}`;
    const eb = $('.eblk'); eb.className = 'eblk';   // значок живёт между перерисовками: класс «подскока» снимаем сами
    eb.innerHTML = e.block > 0 ? `${Art.intentIcon('block')}<b>${e.block}</b>` : '';
    const g = (name) => GL[name];
    const st = [];
    if (e.str) st.push(chip('s-str', tr('Сила {n}', { n: e.str }), g('Сила врага'), sti('enemy_strength')));
    if (e.raged) st.push(chip('s-rage', tr('Ярость'), g('Ярость босса'), sti('enemy_strength')));
    $('#enemy').classList.toggle('rage', !!e.raged);
    if (e.weak) st.push(chip('s-weak', tr('Ослаблен {n}', { n: e.weak }), g('Ослаблен'), sti('weak')));
    if (e.vuln) st.push(chip('s-vuln', tr('Уязвим {n}', { n: e.vuln }), g('Уязвим'), sti('vulnerable')));
    if (e.burn) st.push(chip('s-burn', tr('Поджог {n}', { n: e.burn }), g('Поджог'), sti('burn')));
    if (e.thorns) st.push(chip('s-thorns', tr('Колючки {n}', { n: e.thorns }), tr('Каждый ваш удар по врагу ранит вас на {n}', { n: e.thorns }), sti('thorns')));
    // особые приёмы врага
    const ed = ENEMIES[C.id];
    if (e.nest) st.push(chip('s-trait', tr('Матрёшка ×{n}', { n: e.nest }), tr('Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: {n}.', { n: e.nest })));
    if (ed.boil) st.push(chip(e.boil ? 's-burn' : 's-trait', tr('Кипит +{n}', { n: e.boil }), tr('Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После своего хода он остывает. Поджог его не злит.')));
    if (ed.tally) st.push(chip('s-trait', tr('Ку-ку {a}/{b}', { a: C.playedTurn % ed.tally, b: ed.tally }), tr('Каждая {n}-я карта за ход: кукушка кукует и бьёт вас на 3.', { n: ed.tally })));
    if (ed.plating) st.push(chip('s-trait', tr('Латы'), tr('Латы: защита не сгорает, а копится от хода к ходу. Поджог бьёт прямо по HP.')));
    if (ed.alarm) st.push(chip('s-trait', tr('Колотушка +{n}', { n: ed.alarm }), tr('Каждый ваш Навык даёт сторожу {n} защиты до конца вашего хода. Бейте до хитростей.', { n: ed.alarm })));
    if (e.mist) st.push(chip('s-weak', tr('Туман ≤{n}', { n: e.mist }), tr('Пока туман, любой удар по ней наносит не больше {n} урона. Поджог проходит. Туман рассеется, когда она снова сходит.', { n: e.mist })));
    const bi = ed.pattern.findIndex((p) => p.k === 'boom');
    if (bi >= 0) { const L = ed.pattern.length; const left = ((bi - (e.pi % L)) + L) % L + 1; st.push(chip('s-burn', tr('Фитиль {n}', { n: left }), tr('Через {n} {n|ход|хода|ходов} шутиха взорвётся: сильно ударит и исчезнет. Победите её раньше, если успеете.', { n: left }))); }
    if (e.stun) st.push(chip('s-weak', tr('Спит'), g('Спит'), sti('asleep')));
    if (C.stolen) st.push(chip('s-gold', tr('Украдено {n}', { n: C.stolen }), g('Кража'), sti('steal')));
    $('.estatus').innerHTML = st.join('');
    popChanged($('.estatus'), 'i', 'est');
    // статусы Ивы и активные чары
    const hs = [];
    const res = C.str + C.tmpStr;
    if (res) hs.push(chip('h-res', tr('Решимость {n}', { n: res }), `${g('Решимость')}${C.tmpStr ? ` ${tr('До конца хода: {n}.', { n: C.tmpStr })}` : ''}`, sti('resolve')));
    if (C.thorns) hs.push(chip('h-thorns', tr('Шипы {n}', { n: C.thorns }), g('Шипы'), sti('thorns')));
    if (C.dog > 0) hs.push(chip('h-dog', `${C.dog}`, `${g('Дружок')} ${tr('Злость {n}: укус на {d}', { n: C.dog, d: dogDmg() })}${C.charms.wolfhound ? `, ${tr('{n} {n|раз|раза|раз} за ход', { n: 1 + C.charms.wolfhound })}` : ''}.`, Art.icon('dogfriend')));
    if (C.glaze) hs.push(chip('h-charm', '', `${CARDS.glaze.name}: ${tr('до конца боя все Пряники улучшены')}`, Art.icon('glaze')));
    if (C.paid) hs.push(chip('h-paid', tr('Цена {n}', { n: C.paid }), `${g('Цена')} ${tr('В этом бою уже отдано {n} HP.', { n: C.paid })}`, sti('price')));
    if (C.pWeak) hs.push(chip('h-weak', tr('Слабость {n}', { n: C.pWeak }), g('Слабость'), sti('weak')));
    if (C.frail) hs.push(chip('h-weak', tr('Хрупкость {n}', { n: C.frail }), g('Хрупкость'), sti('frail')));
    if (C.deliveries.length) hs.push(chip('h-del', tr('Доставка {n}', { n: C.deliveries.length }), `${g('Доставка')} ${tr('В пути: {list}.', { list: C.deliveries.map((d) => d.name).join(', ') })}`, sti('delivery')));
    for (const [id, n] of Object.entries(C.charms)) hs.push(chip('h-charm', `${n}`, `${CARDS[id].name}: ${CHARM_TIP[id](n)}`, Art.card(id)));
    $('.hstatus').innerHTML = hs.join('');
    popChanged($('.hstatus'), 'i', 'hst');
    // Статусы врага растут вниз, статусы героя вверх. В долгом бою их набирается столько, что ряды встречаются:
    // тогда значки становятся плотнее (style.css, data-dense)
    delete screen.dataset.dense;
    if (st.length && hs.length && st.length + hs.length > 5 && $('.estatus').getBoundingClientRect().bottom > $('.hstatus').getBoundingClientRect().top - 3) screen.dataset.dense = '1';
    $('.hb-slot').innerHTML = heroBar(true);
    popChanged($('.hb-slot'), '.energy b', 'energy');
    popChanged($('.hb-slot'), '.hblk', 'hblk');
    popChanged($('.ehp'), '.eblk', 'eblk');
    const orb = $('.hb-slot .energy');
    if (orb) { const eb = orb.querySelector('b'); orb.classList.toggle('empty', C.energy <= 0); if (eb.classList.contains('chg')) { orb.classList.add(eb.classList.contains('up') ? 'gain' : 'spend'); orb.style.setProperty('--age', eb.style.getPropertyValue('--age')); } }
    renderHand(dealAnim);
  }

  // Раздача доигрывает до конца, даже если руку перерисовали посреди неё (в начале хода экран рисуется
  // несколько раз подряд): класс «deal» держится всё время раздачи, а задержка уходит в минус на прошедшее время.
  let dealAt = -1e9;
  function renderHand(dealAnim) {
    const n = C.hand.length;
    const now = performance.now();
    if (dealAnim) dealAt = now;
    const dealAge = Math.round(now - dealAt);
    const dealing = dealAge < (SETTINGS.fast ? 180 : 350) + n * 60;
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
      return cardHTML(c, `inhand ${can ? '' : 'nope'} ${i === selected ? 'sel' : ''} ${dealing ? 'deal' : ''}`,
        `data-hi="${i}" data-cu="${c.uid}" style="left:${left}px; --rot:${rot}deg; --lift:${lift}px; --d:${i * 60 - dealAge}ms; z-index:${i === selected ? 50 : i + 1}"`);
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
  // Сыгранная карта летит к цели, а не просто вверх: атака во врага, навык и чары к герою.
  // Конечное положение считаем от того места, где карта сейчас (в руке, выбранная или под пальцем).
  function aimCard(el, type) {
    const to = type === 'atk' ? $('#enemy') : type === 'skill' || type === 'charm' ? $('#heroPortrait') : null;
    if (!to) return;
    const k = 400 / (app.getBoundingClientRect().width || 400);
    const a = el.getBoundingClientRect(); const b = to.getBoundingClientRect();
    const cs = getComputedStyle(el); const num = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const drag = el.classList.contains('drag');
    const tx = drag ? num('--dx') : 0; const ty = drag ? num('--dy') : el.classList.contains('sel') ? -70 : num('--lift');
    const dx = (b.left + b.width / 2 - a.left - a.width / 2) * k; const dy = (b.top + b.height / 2 - a.top - a.height / 2) * k;
    el.style.transform = `translate(${Math.round(tx + dx)}px, ${Math.round(ty + dy)}px) scale(${type === 'atk' ? 0.4 : 0.26})`;
  }

  async function playCard(i, dragEl) {
    const c = C.hand[i];
    const cd = CARDS[c.id];
    const why = cantPlay(c);
    if (why) { SND.sfx('deny'); toast(why); return; }
    const cost = playCost(c);
    const price = cd.price ? cd.price(c.up) : 0;
    busy = true; selected = -1; playing = true; tapNext = ''; flickNext = false;
    const el = dragEl || $(`.hand [data-hi="${i}"]`);
    SND.sfx('card');
    if (el) { aimCard(el, cd.type); el.classList.add('fly'); await sleep(220); }
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
    playing = false;
    if (run.hp <= 0) { await fall(); goDefeat(); return; }
    if (C.enemy.hp <= 0) { await winCombat(); return; }
    renderCombat();
    busy = false;
    // карту тронули, пока разыгрывалась эта: выбираем её сейчас (v130; раньше такое касание пропадало молча)
    if (tapNext) {
      const j = C.hand.findIndex((x) => String(x.uid) === tapNext); tapNext = '';
      const flick = flickNext; flickNext = false;
      if (j >= 0 && flick) playCard(j);
      else if (j >= 0) { selected = j; SND.sfx('draw'); renderHand(false); }
    }
    if (!busy) dragMove(); // следующую карту уже держат пальцем: она сразу идёт за ним
  }

  // всплывающее число или слово. Живёт в слое эффектов, поверх вспышек: урон виден сразу, а не из-под удара
  const floatRows = new Map();
  function floatText(host, text, cls) {
    if (!host) return;
    const f = document.createElement('div');
    f.className = `float ${cls}${host.classList.contains('hero-fx') ? ' hf' : ''}`; f.textContent = text;   // hf: число героя, вне боя оно всплывает ниже (style.css, v74)
    const layer = $('#screen .fxlayer');
    const at = 0.4 + Math.random() * 0.2;
    // Надписи, которые появились почти разом (укус и его урон, несколько чар в начале хода), встают лесенкой,
    // каждая на свою строку выше прежней: раньше они ложились одна на другую и не читались
    const now = performance.now(); const key = host.className;
    const live = (floatRows.get(key) || []).filter((x) => now - x.at < 420);
    let row = 0; let lift = 0;
    // у «Ярости» своё место над числами (style.css, .ragef): в лесенку она не встаёт, иначе уезжала на значки намерений
    if (!/ragef/.test(cls)) {
      while (row < 4 && live.some((x) => x.row === row)) row++;
      if (row === 4) row = live.reduce((a, b) => (a.at <= b.at ? a : b)).row;   // выше четырёх строк не растём: там намерения врага
      // большое число урона выше обычной строки: над соседней надписью ему нужно больше места, иначе оно ложилось на неё («−6» на «Внутри ещё одна!»)
      // а нижняя надпись к этому времени уже успела всплыть (до 24 px за 0,4 с): новая встаёт выше ещё на этот путь
      const under = live.find((x) => x.row === row - 1);
      const rose = under ? Math.min(24, Math.round((now - under.at) * 0.055)) : 0;
      lift = row ? Math.min(126, Math.max(row * 34, (under ? under.lift : 0) + (/dmgf/.test(cls) ? 46 : 34)) + rose) : 0;
      live.push({ at: now, row, lift }); floatRows.set(key, live);
    }
    if (layer) {
      const r = host.getBoundingClientRect(); const s = layer.getBoundingClientRect(); const k = 400 / (s.width || 400);
      f.style.top = `${Math.round((r.top - s.top + r.height * 0.4) * k) - lift}px`;
      layer.appendChild(f);
      const half = f.offsetWidth / 2 + 6;          // длинная надпись не уходит за край экрана
      f.style.left = `${Math.round(Math.max(half, Math.min(400 - half, (r.left - s.left + r.width * at) * k)))}px`;
    } else { f.style.left = `${at * 100}%`; if (lift) f.style.marginTop = `${-lift}px`; host.appendChild(f); }
    setTimeout(() => f.remove(), 1150);
  }

  // кадры нарисованного врага: attack | hurt | death (если есть раскадровка)
  const eAct = (k) => (Art.act ? Art.act($('#enemy'), k, SETTINGS.fast ? 2 : 1) : 0);

  // Последний удар: экран темнеет вокруг героя, портрет гаснет, и только потом открывается экран поражения
  async function fall() {
    screen.dataset.fallen = '1';
    await sleep(900);
    delete screen.dataset.fallen;
  }

  // Движение портрета героя: выпад (lunge), укус пса (bite), встряска от удара (hurt).
  // Панель героя перерисовывается почти сразу после удара, поэтому движение запоминаем,
  // и heroBar дорисовывает его с того места, где оно было (иначе оно не успевало показаться).
  function heroMove(k) {
    heroAct = { k, at: performance.now() };
    const p = $('#heroPortrait'); if (!p) return;
    p.classList.remove('lunge', 'bite', 'hurt', 'guard'); p.style.removeProperty('--ad'); void p.offsetWidth; p.classList.add(k);
  }
  const heroLunge = () => heroMove('lunge');

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
    rageCheck();
    const el = $('#enemy');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    eAct('hurt');
    if (real <= 0) SND.sfx('clank');
    else if (!quiet) SND.sfx('hit', Math.min(1.4, 0.6 + real / 15));
    floatText($('.enemy-fx'), real > 0 ? `-${real}` : absorbed > 0 ? tr('Блок −{n}', { n: absorbed }) : tr('Блок'), real > 0 ? 'dmgf' : 'blockf');
    renderCombat();
    await sleep(260);
  }

  // Ярость: босс, потерявший половину HP, получает Силу и защиту (один раз за бой)
  function rageCheck() {
    const e = C.enemy;
    if (!LONG || C.tier !== 'boss' || e.raged || e.hp <= 0 || e.hp > e.max / 2) return;
    e.raged = true;
    const si = Math.min(2, stageOf(run.step));
    e.str += BAL.rageStr[si]; e.block += BAL.rageBlock[si];
    SND.sfx('buff');
    FX.play('rage', 'enemy');
    // надпись выходит чуть позже числа урона и выше него: раньше они ложились друг на друга
    const text = tr('Ярость! Сила +{n}', { n: BAL.rageStr[si] });
    setTimeout(() => { if (C && C.enemy === e) floatText($('.enemy-fx'), text, 'burnf ragef'); }, SETTINGS.fast ? 160 : 380);
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
    if (p) heroMove(real > 0 ? 'hurt' : 'guard');   // удар целиком в защиту: портрет вздрагивает, но не краснеет, как от раны
    SND.sfx(real > 0 ? 'hurt' : 'clank');
    floatText($('.hero-fx'), real > 0 ? `-${real}` : absorbed > 0 ? tr('Блок −{n}', { n: absorbed }) : tr('Блок'), real > 0 ? 'dmgf' : 'blockf');
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
    // сброс: карты, которые не остаются в руке, улетают к стопке сброса, а не исчезают разом
    const gone = [...document.querySelectorAll('.hand .card.inhand')].filter((el) => !keep.includes(C.hand[+el.dataset.hi]));
    gone.forEach((el, k) => {
      el.style.setProperty('--tx', `${Math.round(352 - (parseFloat(el.style.left) || 0) - 52)}px`);
      el.style.setProperty('--d', `${k * 22}ms`);
      el.classList.remove('deal'); el.classList.add('toss');
    });
    if (gone.length) await sleep(200 + gone.length * 22);
    C.hand = keep;
    C.tmpStr = 0;
    if (C.pWeak > 0) C.pWeak--;
    if (C.frail > 0) C.frail--;
    if (dread) { loseHp(dread); SND.sfx('hurt'); floatText($('.hero-fx'), `-${dread}`, 'dmgf'); }
    renderCombat();
    await sleep(gone.length ? 110 : 250);
    if (run.hp <= 0) { await fall(); goDefeat(); return; }
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
      rageCheck();
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
            await sleep(Math.min(600, Math.max(180, strikeMs)));
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
          // замах с шипящим фитилём; сам взрыв — это гибель шутихи, «Бабах!» и удар по герою приходят в момент вспышки (winCombat).
          // Раньше надпись выходила до замаха, герой получал урон, шутиха полсекунды стояла целой и только потом взрывалась
          el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
          const boomMs = eAct('attack');
          SND.sfx('enemy');
          await sleep(Math.min(600, Math.max(200, boomMs)));
          e.hp = 0; C.boomed = true; C.blast = enemyDmg(it.v);
          break;
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
    if (run.hp <= 0) { await fall(); goDefeat(); return; }
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
    FX.warm([C.tier === 'boss' ? 'triumph' : 'loot']);   // ролики монет и праздника расшифровываются, пока враг падает
    const dl = !C.boomed && lineOf(C.id, 'death');
    if (dl && SETTINGS.lines !== false) { say(dl, 1600); await sleep(800); }
    // нарисованная гибель играет до конца (останки сами тают), иначе прежнее растворение
    const sp = SETTINGS.fast ? 2 : 1;
    const dur = el && Art.actDur ? Art.actDur(el, 'death', sp) : 0;
    // пока враг тает, из него сыплются монеты (над боссом ещё конфетти и звёзды): победа ощущается, а не просто сменяется экран
    const prize = C.tier === 'boss' ? 'triumph' : 'loot';
    const juice = Math.round(900 / sp);
    // шутиха взорвалась сама: «Бабах!» и удар по герою приходят в момент вспышки её гибели; true — герой взрыва не пережил
    const blastHero = async () => {
      const d = C.blast; C.blast = 0;
      SND.sfx('burst'); floatText($('.enemy-fx'), tr('Бабах!'), 'burnf');
      await hitHero(d);
      if (run.hp > 0) return false;
      await fall(); goDefeat(); return true;
    };
    if (el && dur) {
      el.style.setProperty('--dd', `${dur}ms`); el.classList.add('dying', 'drawn'); const flash = eAct('death');
      const lead = Math.round(dur * 0.4);
      let gone = 0;
      if (C.blast) { gone = Math.min(flash || lead, lead); await sleep(gone); if (await blastHero()) return; gone += 300; }
      await sleep(Math.max(0, lead - gone)); FX.play(prize, 'enemy');
      await sleep(Math.max(dur + 200 - Math.max(lead, gone), juice));
    } else { if (el) el.classList.add('dying'); await sleep(250); if (C.blast && await blastHero()) return; FX.play(prize, 'enemy'); await sleep(Math.max(550, juice)); }
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
    if (!hpLost) ach.add('flawless');
    if (!hpLost && tier === 'elite') ach.flag('flawlesselite');
    if (turn === 1) ach.add('oneturn');
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
      ${ribbon(tr('Трофей босса'))}
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
      ${ribbon(boss ? tr('Босс повержен!') : tr('Победа!'))}
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
    screen.innerHTML = `${ribbon(STORY.winRibbon)}
      <div class="book"><div class="page">
        ${bookArt(endingKey(), 'moon')}
        <h1>${STORY.winTitle}</h1>
        <p class="story">${txt(STORY.winText)}${saved && LORE.DARK[saved] ? ` ${tr(LORE.DARK[saved].saved)}` : ''}</p>
        <p class="stats">${statLine([DIFF().name, tr('Побед: {n}', { n: run.fights }), tr('Карт в колоде: {n}', { n: run.deck.length }), tr('Талисманов: {n}', { n: run.relics.length })])}</p>
      </div></div>
      <div class="endbtns"><button class="btn big" data-act="summary">${tr('Итоги забега')}</button><button class="btn ghost" data-act="title">${tr('Главное меню')}</button></div>
      <div class="fxlayer"></div>`;
    fitBook();
    // праздник: хлопушки у ленты и звёзды над книгой, когда экран уже проявился
    FX.warm(['fanfare']);
    setTimeout(() => { if (screen.className === 'scr-end win') FX.play('fanfare'); }, 520);
  }
  /* После поражения можно начать бой заново или вернуться на развилку перед боем:
     за просмотр рекламы, а в режиме без рекламы сразу. Или закончить забег. */
  function goDefeat() {
    if (!snapFight) { endRun(); return; }
    if (C && run.st) run.st.by = C.id;
    C = null; busy = false;
    // экран поражения сохраняется: раньше сохранение стиралось, и забег, закрытый на этом экране, пропадал без записи в журнале
    save({ t: 'defeat', enemy: snapFight.enemyId, tier: snapFight.tier, fight: snapFight.run });
    SND.music(null); SND.sfx('defeat');
    const tag = Store.noAds() ? '' : `<i class="adtag">${uiIco('ad')}${tr('Реклама')}</i>`;
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
        <p class="stats">${statLine([DIFF().name, tr('Пройдено уровней: {a} из {b}', { a: run.step + 1, b: MAX_STEPS }), tr('Побед: {n}', { n: run.fights })])}</p>
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
    screen.innerHTML = `${ribbon(tr('Итоги забега'))}
      ${summaryHTML(rec)}
      <div class="endbtns"><button class="btn big" data-act="retry">${tr('Новый забег')}</button><button class="btn ghost" data-act="title">${tr('Главное меню')}</button></div>`;
  }

  /* ---------- Обработка нажатий ---------- */
  /* Звук включается по первому касанию; шестерёнка в углу открывает настройки */
  window.addEventListener('pointerdown', () => SND.unlock(), { capture: true });
  app.classList.toggle('fast', SETTINGS.fast);
  app.classList.toggle('calm', !SETTINGS.snow); // без снегопада и свет фонарей стоит ровно
  const gearBtn = $('#gear');
  gearBtn.innerHTML = uiIco('gear');
  gearBtn.setAttribute('aria-label', tr('Настройки'));
  gearBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); showSettings(); });

  const menuBtn = $('#menu');
  menuBtn.setAttribute('aria-label', tr('Меню'));
  menuBtn.innerHTML = uiIco('menu');
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); SND.unlock(); SND.sfx('click'); if (run) showPause(); else showGlossary(); });

  /* ---------- Карту можно вытянуть из руки: отпущенная выше руки, она разыгрывается ---------- */
  const PLAY_Y = 540; // выше этой линии (чуть над рукой) карта сыграет
  let drag = null; let dragEndAt = 0;
  const toLocal = (e) => { const r = app.getBoundingClientRect(); const k = r.width / 400; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
  // карту в руке находим по её номеру uid: пока палец держит карту, рука могла перерисоваться, и место карты в ней могло сдвинуться
  const handEl = (cu) => $(`.hand [data-cu="${cu}"]`);
  app.addEventListener('pointerdown', (e) => {
    // пока разыгрывается предыдущая карта (около полсекунды), следующую уже можно схватить: она пойдёт за пальцем,
    // как только игра освободится (раньше такой жест пропадал молча). В ход врага рука по-прежнему закрыта
    if (screen.className !== 'scr-combat' || (busy && !playing) || !C || drag || e.button > 0) return;
    const el = e.target.closest('.hand [data-hi]');
    if (!el) return;
    const p = toLocal(e);
    drag = { i: +el.dataset.hi, cu: el.dataset.cu, el, x0: p.x, y0: p.y, on: false, ready: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.p = toLocal(e);
    dragMove();
  });
  // карта идёт за пальцем; вызывается на каждое движение и ещё раз, когда доигралась предыдущая карта, а палец уже держит следующую
  function dragMove() {
    if (!drag || !drag.p) return;
    if (screen.className !== 'scr-combat' || !C) { drag = null; app.classList.remove('aim'); return; }
    const p = drag.p;
    const dx = p.x - drag.x0; const dy = p.y - drag.y0;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 12 || busy) return;
      drag.on = true;
      if (selected >= 0) { selected = -1; renderHand(false); }
      drag.el = handEl(drag.cu);
      if (!drag.el) { drag = null; return; }
      drag.i = +drag.el.dataset.hi;
      drag.el.classList.add('drag'); SND.sfx('draw');
    } else if (!drag.el.isConnected) {
      // руку перерисовали под пальцем: берём ту же карту заново или отпускаем жест, если её в руке уже нет
      drag.el = handEl(drag.cu);
      if (!drag.el) { drag = null; app.classList.remove('aim'); return; }
      drag.i = +drag.el.dataset.hi; drag.ready = false;
      drag.el.classList.add('drag');
    }
    drag.el.style.setProperty('--dx', `${dx}px`); drag.el.style.setProperty('--dy', `${dy}px`);
    const ready = p.y < PLAY_Y && dy < -50;
    if (ready !== drag.ready) {
      drag.ready = ready; drag.el.classList.toggle('ready', ready);
      app.classList.toggle('aim', ready && CARDS[C.hand[drag.i].id].type === 'atk');
      if (ready) SND.sfx('click');
    }
  }
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    app.classList.remove('aim');
    if (!d.on) {
      // карту выбросили вверх одним быстрым движением, пока разыгрывалась предыдущая: она сыграет следом
      if (!cancel && busy && playing && C && screen.className === 'scr-combat') {
        const p = toLocal(e);
        if (p.y < PLAY_Y && p.y - d.y0 < -50) { tapNext = d.cu; flickNext = true; }
      }
      return; // простое касание: дальше сработает click
    }
    dragEndAt = performance.now();
    if (!cancel && d.ready && !busy && C && C.hand[d.i] && String(C.hand[d.i].uid) === d.cu) {
      const why = cantPlay(C.hand[d.i]);
      if (!why) { playCard(d.i, d.el); return; }
      SND.sfx('deny'); toast(why);
    }
    d.el.classList.remove('drag', 'ready'); // карта возвращается в руку
  }
  window.addEventListener('pointerup', (e) => endDrag(e));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));

  app.addEventListener('pointerdown', () => closeTip(), true);
  // долгое нажатие на телефоне: меню браузера («сохранить картинку», «копировать») игре не нужно
  window.addEventListener('contextmenu', (e) => { if (!(e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); });
  window.addEventListener('dragstart', (e) => e.preventDefault());
  /* Двойное касание: второй тап в ту же точку не должен нажать то, что успело появиться под пальцем
     (карта в открывшейся колоде, «Дальше» после выбора, дорожка на карте пути). Та же самая кнопка нажимается как раньше;
     в самом бою ввод и так закрыт на время анимаций, там касания не трогаем */
  let lastTap = null;
  const tapKey = (el) => {
    const c = el.closest && el.closest('[data-act], [data-hi], [data-uid], [data-set], [data-lang], [data-relic], button, .card');
    const where = overlay.contains(el) ? 'o' : 's';
    return c ? `${where}|${c.dataset.act || ''}|${c.dataset.i || c.dataset.hi || c.dataset.uid || c.dataset.set || c.dataset.lang || ''}|${c.textContent.trim().slice(0, 24)}` : `${where}|`;
  };
  window.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const now = performance.now();
    const key = tapKey(e.target);
    const inFight = screen.className === 'scr-combat' && !overlay.classList.contains('show');
    if (lastTap && !inFight && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 34 && key !== lastTap.key) {
      e.stopImmediatePropagation(); e.preventDefault();
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY, key };
  }, true);
  app.addEventListener('click', (e) => {
    SND.unlock();
    if (overlay.contains(e.target)) { if (!e.target.matches('input')) SND.sfx('click'); return; }
    const relic = e.target.closest('[data-relic]');
    if (relic) { const r = RELICS[relic.dataset.relic]; showTip(relic, r.desc, r.name); return; }
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl) { const own = tipEl.matches('.estatus i, .hstatus i') ? tipEl.textContent.trim() : ''; showTip(tipEl, tipEl.dataset.tip, /[^\d\s]/.test(own) ? own : ''); return; }
    const t = e.target.closest('[data-act], [data-hi]');

    if (screen.className === 'scr-combat') {
      if (busy || performance.now() - dragEndAt < 350) {
        // пока карта разыгрывается (0,25–0,5 с), касание следующей запоминается: она выберется, как только игра освободится
        if (busy && playing && C && t && t.dataset.cu) { tapNext = t.dataset.cu; flickNext = false; }
        return;
      }
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
    if (e.isTrusted && TAP_GUARD.has(act) && performance.now() - Math.max(bornAt(t), ovClosedAt) < TAP_LOCK) return;
    if (!['buy', 'buyrelic', 'buytea', 'buyremove', 'buyup', 'reroll', 'takecard', 'bossrelic', 'cine-next'].includes(act)) SND.sfx('click');
    switch (act) {
      case 'start': newRun(); break;
      case 'cine-next': case 'cine-skip': if (screen.onCine) screen.onCine(act); break;
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
      case 'choose': {
        // выбранная карта пути вспыхивает и подаётся вперёд, остальные гаснут; потом уже переход
        if (pickedEnc) break;
        pickedEnc = true;
        screen.querySelectorAll('.enc').forEach((x) => x.classList.add(x === t ? 'picked' : 'passed'));
        const i = +t.dataset.i;
        setTimeout(() => { pickedEnc = false; if (screen.className === 'scr-map' && run && run.choices) chooseEncounter(i); }, SETTINGS.fast ? 110 : 230);
        break;
      }
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
      case 'rest-heal': {
        // отдых виден: зелёное сияние у героя, число, полоска здоровья доезжает, и только потом дорога дальше
        if (screen.dataset.rested) break;
        screen.dataset.rested = '1';
        const hp0 = run.hp;
        evApi.heal(restHeal());
        if (hasRelic('cocoatin')) { run.maxHp += 2; run.hp += 2; toast(`${RELICS.cocoatin.name}: ${tr('+{n} к макс. HP', { n: 2 })}`); }
        screen.querySelectorAll('.scroll').forEach((x) => { if (x !== t) x.classList.add('off'); x.disabled = true; });
        $('.herobar').outerHTML = heroBar(false);
        showGain(hp0, run.gold);
        setTimeout(() => { delete screen.dataset.rested; if (screen.className === 'scr-rest') advance(); }, SETTINGS.fast ? 380 : 800);
        break;
      }
      case 'rest-up': upgradeFlow((ok) => { if (ok) afterMoment(advance); }); break;
      case 'rest-burn': removeCardFlow((ok) => { if (ok) afterMoment(advance); }); break;
      case 'takecard': SND.sfx('card'); flyToDeck(t); run.deck.push(mk(t.dataset.id)); toast(tr('В колоду: {name}', { name: CARDS[t.dataset.id].name })); advance(); break;
      case 'bossrelic': addRelic(t.dataset.id); goReward('boss'); break;
      case 'bossrelic-skip': goReward('boss'); break;
      case 'buy': case 'buyrelic': case 'buytea': case 'buyremove': case 'buyup': case 'reroll': screen.onShop(act, +t.dataset.i); break;
    }
  });

  // Для отладки и автотестов
  window.Game = { get run() { return run; }, get combat() { return C; }, get busy() { return busy; }, bal: BAL, play: (i) => playCard(i), endTurn: () => endTurn(), playCost: (c) => playCost(c), newRun, pickCard: (r) => pickCard(r), goMap: () => goMap(), startCombat: (id, t = 'fight') => startCombat(id, t), costOf, addRelic: (id) => addRelic(id), mk, render: () => renderCombat(), freeRelics: () => freeRelics(), goEvent: (id) => goEvent(EVENTS.find((e) => e.id === id)), goTalk: (id, t = 'fight') => goTalk(id, t), goMeet: (h) => goMeet(h), goAfter: (t, id) => goAfter(t, id), goShop: () => goShop(), goRest: () => goRest(), goChest: () => goChest(), goVictory: () => goVictory(), endRun: () => endRun(), finalBoss: () => finalBoss(), showCodex: () => showCodex(), tieOf: (id) => tieOf(id), cinema: () => goCinema(() => goTitle()), achFit: (t) => achFit(t) };

  achCheck(true);
  codexSeed();
  if (hasCinema() && !cinemaSeen()) goCinema(() => goTitle()); else goTitle();
  // Огонёк загрузки (#boot) гаснет, когда картинки первого экрана готовы, но не позже чем через 5 секунд
  (function bootDone() {
    const boot = $('#boot');
    if (!boot) return;
    const urls = new Set();
    app.querySelectorAll('#bg image').forEach((x) => urls.add(x.getAttribute('href')));
    screen.querySelectorAll('img').forEach((x) => urls.add(x.getAttribute('src')));
    screen.querySelectorAll('[style*="url("]').forEach((x) => { const m = /url\(["']?([^"')]+)/.exec(x.getAttribute('style')); if (m) urls.add(m[1]); });
    // и рамки интерфейса (кнопки, панели, пергамент): без них первые экраны стояли голым текстом на фоне
    for (const n of app.style) {
      if (!n.startsWith('--ui-') || (n.startsWith('--ui-logo_') && n !== `--ui-logo_${window.I18N ? window.I18N.lang : 'ru'}`)) continue;
      const m = /url\(["']?([^"')]+)/.exec(app.style.getPropertyValue(n)); if (m) urls.add(m[1]);
    }
    let left = 0; let gone = false;
    const out = () => { if (gone) return; gone = true; boot.classList.add('out'); setTimeout(() => boot.remove(), 500); };
    urls.forEach((u) => { if (!u) return; const im = new Image(); left++; im.onload = im.onerror = () => { if (--left <= 0) out(); }; im.src = u; });
    if (!left) out();
    setTimeout(out, 5000);
  })();
  try {
    // язык сменили посреди забега: после перезапуска возвращаемся туда же, а не на главный экран
    const reopen = sessionStorage.getItem('lastray.reopen');
    if (reopen) { sessionStorage.removeItem('lastray.reopen'); if (reopen === 'settings+run' && loadSave() && screen.className === 'scr-title') continueRun(); showSettings(); }
  } catch (e) { /* недоступно */ }
})();
