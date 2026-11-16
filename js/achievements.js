/* Достижения: список и цели. Прогресс считает js/game.js и хранит в браузере.
   src — откуда берётся прогресс:
     stat — счётчик общей статистики (STATS), c — свой счётчик или флаг достижений,
     s — сколько разных предметов собрано в наборе, has — есть ли предмет item в наборе.
   desc: {p} заменяется на «прогресс/цель».
   art: 'h' — Ива, 'c:<герой>' — герой из CLASSES, 'e:<id>' — противник, 'i:<id>' — иконка. */
(function () {
  const { CARDS, RELICS, EVENTS } = window.Data;
  const STORY = window.Story.story;

  // сколько разных противников встречается в текущем сюжете
  const foes = new Set();
  STORY.stages.forEach((g) => [...g.boss, ...g.early, ...g.normals, ...g.elites].forEach((id) => foes.add(id)));
  // карты и талисманы платных героев не нужны для «собрать всё»: цели достижимы без покупок
  const CLS = window.Data.CLASSES;
  const paidItem = (x) => x.cls && CLS[x.cls] && CLS[x.cls].paid;
  const playable = Object.keys(CARDS).filter((k) => CARDS[k].rarity !== 'status' && !paidItem(CARDS[k])).length;
  const relics = Object.keys(RELICS).filter((k) => RELICS[k].tier !== 'class' && !paidItem(RELICS[k])).length;
  const freeHeroes = Object.keys(CLS).filter((k) => !CLS[k].paid).length;
  const trophies = Object.keys(RELICS).filter((k) => RELICS[k].tier === 'boss').length;

  // База знаний: что в ней есть и в каком порядке (противники — по стадиям основного сюжета, потом мрачные герои)
  const MAIN = window.Story.STORIES.sunset.stages;
  const codexFoes = [];
  MAIN.forEach((g) => [...g.normals, ...g.early, ...g.elites, ...g.boss].forEach((id) => { if (!codexFoes.includes(id)) codexFoes.push(id); }));
  Object.keys(window.Data.ENEMIES).filter((id) => window.Data.ENEMIES[id].dark).forEach((id) => codexFoes.push(id));
  const classRelic = (k) => Object.keys(CLS).find((h) => CLS[h].relic === k);
  const CODEX = {
    h: Object.keys(CLS),
    e: codexFoes,
    c: Object.keys(CARDS),
    r: Object.keys(RELICS),
    // для достижений «собрать всё» — без карт и талисманов платных героев
    freeC: Object.keys(CARDS).filter((k) => !paidItem(CARDS[k])),
    freeR: Object.keys(RELICS).filter((k) => !paidItem(RELICS[k]) && !(classRelic(k) && CLS[classRelic(k)].paid)),
    classRelic,
  };
  // разные особые ответы на встречах, доступные без покупок: бесплатные герои × остальные семь
  const freeTies = freeHeroes * (Object.keys(CLS).length - 1);

  const CATS = [
    ['path', 'Путь'],
    ['fight', 'Мастерство'],
    ['collect', 'Коллекция'],
    ['story', 'Истории'],
  ].map(([id, name]) => [id, tr(name)]);

  /* Цели рассчитаны на долгую игру. Средний забег даёт примерно 30 уровней, 12–20 побед, 2–3 элиты,
     150–250 сыгранных карт и 350–600 потраченных монет. Первая ступень ★ берётся за первые несколько забегов,
     ★★ за две–четыре недели игры (около 30 забегов), ★★★ за пару месяцев (больше сотни забегов).
     Достижения-открытия (впервые сделать что-то) остаются разовыми. */
  const L = [];
  const add = (cat, id, name, desc, src, key, goal, art, item, stars = 0) => L.push({ cat, id, name, stars, desc, src, key, goal, art, item });
  // ступени одного достижения: ★, ★★, ★★★
  const tiers = (cat, id, name, desc, src, key, goals, arts) => goals.forEach((g, i) => add(cat, `${id}${i + 1}`, name, desc, src, key, g, arts[i], null, i + 1));

  /* ---------- Путь ---------- */
  add('path', 'first', 'Первый шаг', 'Отправиться в первый путь.', 'stat', 'runs', 1, 'h');
  add('path', 'runs10', 'Снова на маршрут', 'Начать {p} забегов.', 'stat', 'runs', 10, 'i:lantern');
  tiers('path', 'road', 'Долгая дорога', 'Пройти {p} уровней.', 'c', 'steps', [150, 1000, 4000], ['i:rhythm', 'i:compass', 'i:sled']);
  tiers('path', 'win', 'Письмо доставлено', 'Доставить письмо {p} раз.', 'stat', 'wins', [1, 10, 40], ['i:lastword', 'i:parcel', 'i:redseal']);
  const hero = (id, name, desc) => add('path', `hero-${id}`, name, desc, 'has', 'winsCls', 1, `c:${id}`, id);
  hero('lamp', 'Свет до порога', 'Доставить письмо за фонарщицу Иву.');
  hero('courier', 'Быстрее заката', 'Доставить письмо за скорохода Тишу.');
  hero('guard', 'Несокрушимая', 'Доставить письмо за сторожиху Марфу.');
  hero('stoker', 'С огоньком', 'Доставить письмо за трубочиста Фому.');
  hero('baker', 'Сладкая дорога', 'Доставить письмо за пряничницу Груню.');
  hero('grinder', 'Острый глаз', 'Доставить письмо за точильщика Савву.');
  hero('shepherd', 'Вдвоём не страшно', 'Доставить письмо за пастушку Лушу.');
  hero('herbalist', 'Горькое лекарство', 'Доставить письмо за знахарку Ульяну.');
  add('path', 'allheroes', 'Вся почта Горки', 'Доставить письмо разными героями: {p}.', 's', 'winsCls', freeHeroes, 'i:horn');
  // победа на каждом уровне сложности
  const diff = (i, name, art) => add('path', `diff-${i}`, name, `Доставить письмо на сложности «${window.Data.DIFFICULTIES[i].name}».`, 'has', 'winsDiff', 1, art, i);
  diff(0, 'Лёгкой походкой', 'i:tea');
  diff(1, 'По расписанию', 'i:envelope');
  diff(2, 'Наперегонки с сумерками', 'i:lantern');
  diff(3, 'Сквозь метель', 'i:frostlace');
  diff(4, 'Свет в полярной ночи', 'i:lullaby');
  add('path', 'events', 'Любопытная', 'Побывать во всех событиях пути: {p}.', 's', 'events', EVENTS.length, 'i:well');
  tiers('path', 'chest', 'Будильник', 'Разбудить {p} сундуков-сонь.', 'c', 'chests', [10, 60, 250], ['i:chest', 'i:bell', 'i:candybox']);
  const boss = (id, name, desc) => add('path', `boss-${id}`, name, desc, 'has', 'bosses', 1, `e:${id}`, id);
  boss('magpie', 'Перехват перехвачен', 'Победить Сороку-Перехватчицу.');
  boss('waxgiant', 'Сургуч растаял', 'Победить Сургучного Великана.');
  boss('vane', 'Куда ветер дует', 'Победить Флюгера-Петуха.');
  boss('clockmaker', 'Время вышло', 'Победить Сумеречного Часовщика.');
  boss('wolf', 'Волк сыт, письмо цело', 'Победить Сумеречного Волка.');
  boss('troll', 'Мост свободен', 'Победить Мостового Тролля.');
  boss('hollowpost', 'Смена окончена', 'Победить Пустого Почтальона.');
  boss('skywhale', 'Небо без китов', 'Победить Ночного Кита.');
  boss('shadowking', 'Корона в снегу', 'Победить Короля Теней.');

  /* ---------- Мастерство ---------- */
  tiers('fight', 'foes', 'Гроза сугробов', 'Победить {p} противников.', 'stat', 'fights', [50, 500, 2000], ['e:snowimp', 'e:frostfox', 'e:snowbrute']);
  tiers('fight', 'elite', 'Не робкого десятка', 'Победить {p} элит.', 'stat', 'elites', [10, 75, 300], ['e:owl', 'e:icebear', 'e:lampghost']);
  tiers('fight', 'burst', 'Фонарщица', 'Устроить {p} Вспышек.', 'c', 'bursts', [25, 300, 1500], ['i:spark', 'i:eveninglamp', 'i:flashpoint']);
  tiers('fight', 'cards', 'Ловкие руки', 'Сыграть {p} карт.', 'stat', 'cards', [500, 5000, 25000], ['i:strike', 'i:drafts', 'i:flurry']);
  tiers('fight', 'hit', 'Тяжёлая рука', 'Нанести {p} урона одним ударом.', 'c', 'maxhit', [25, 50, 100], ['i:heavy', 'i:payback', 'i:blaze']);
  tiers('fight', 'flawless', 'Ни царапины', 'Победить противников без потери HP: {p}.', 'c', 'flawless', [1, 40, 250], ['i:guard', 'i:umbrella', 'i:icewall']);
  add('fight', 'flawlesselite', 'Чистая работа', 'Победить элиту, не потеряв ни одного HP.', 'c', 'flawlesselite', 1, 'i:cloak');
  tiers('fight', 'oneturn', 'С порога', 'Победить противников за один ход: {p}.', 'c', 'oneturn', [1, 25, 150], ['i:whistle', 'i:urgent', 'i:avalanche']);
  add('fight', 'combo', 'Почтовый вихрь', 'Сыграть 8 карт за один ход.', 'c', 'combo', 1, 'i:wind');
  add('fight', 'dblburst', 'Двойная вспышка', 'Устроить две Вспышки за один ход.', 'c', 'dblburst', 1, 'i:sparks');
  add('fight', 'burnkill', 'Догорело', 'Добить противника Поджогом.', 'c', 'burnkill', 1, 'i:ember');
  add('fight', 'thornskill', 'Сам напросился', 'Добить противника Шипами.', 'c', 'thornskill', 1, 'i:pinecone');
  add('fight', 'stunboss', 'Колыбельная', 'Усыпить босса.', 'c', 'stunboss', 1, 'i:lullaby');
  add('fight', 'charms3', 'Заколдованный вечер', 'Наложить трое разных Чар в одном бою.', 'c', 'charms3', 1, 'i:hearth');
  add('fight', 'defuse', 'Фитиль потушен', 'Победить Шутиху, пока она не взорвалась.', 'c', 'defuse', 1, 'e:firecracker');
  tiers('fight', 'ginger', 'Пекарня в дороге', 'Съесть {p} Пряников.', 'c', 'ginger', [100, 1000, 5000], ['i:gingerbread', 'i:glaze', 'i:gingerhouse']);
  add('fight', 'sharp', 'Всё наточено', 'Заточить {p} карт за один бой.', 'c', 'sharpfight', 20, 'i:grindwheel');
  add('fight', 'dogmad', 'Злая собака', 'Разозлить Дружка до {p} Злости.', 'c', 'dogmax', 25, 'i:dogfriend');
  add('fight', 'price', 'Горькая цена', 'Заплатить Ценой {p} HP за один бой.', 'c', 'pricefight', 25, 'i:mortar');

  /* ---------- Коллекция ---------- */
  tiers('collect', 'spend', 'Звонкая монета', 'Потратить {p} монет.', 'c', 'spent', [1000, 15000, 60000], ['i:coin', 'i:luckycoin', 'e:hedgehog']);
  tiers('collect', 'buy', 'Постоянная покупательница', 'Купить в лавке {p} карт.', 'c', 'bought', [10, 60, 200], ['i:coupon', 'i:pockethog', 'i:magicbag']);
  tiers('collect', 'up', 'Точильщица', 'Улучшить {p} карт.', 'c', 'upgrades', [15, 150, 600], ['i:whetstone', 'i:stamp', 'i:goldquill']);
  tiers('collect', 'relic', 'Шкатулка с секретами', 'Найти {p} разных талисманов.', 's', 'relics', [10, 20, relics], ['i:jar', 'i:musicbox', 'i:moonstone']);
  tiers('collect', 'card', 'Полная сумка', 'Сыграть {p} разных карт.', 's', 'played', [25, 60, playable], ['i:envelope', 'i:secret', 'i:stampbook']);
  tiers('collect', 'foe', 'Знаток окрестностей', 'Победить {p} разных противников.', 's', 'beaten', [10, 25, foes.size], ['e:pigeon', 'e:raven', 'e:wisp']);
  tiers('collect', 'trophy', 'Трофеи', 'Взять {p} разных талисманов босса.', 's', 'trophies', [3, trophies], ['i:hourglass', 'i:crown']);
  const rares = Object.keys(CARDS).filter((k) => CARDS[k].rarity === 'rare' && !CARDS[k].cls).length;
  tiers('collect', 'rare', 'Редкая находка', 'Сыграть {p} разных редких карт.', 's', 'rareplayed', [5, rares], ['i:aurora', 'i:avalanche']);
  add('collect', 'legendcard', 'Легенда почты', 'Сыграть легендарную карту.', 'c', 'legendcard', 1, 'i:lastlight');
  add('collect', 'legendrelic', 'Сокровище Горки', 'Найти легендарный талисман.', 'c', 'legendrelic', 1, 'i:sunstone');
  add('collect', 'rich', 'Копилка полна', 'Накопить {p} монет за один забег.', 'c', 'maxgold', 400, 'i:piggy');
  add('collect', 'hp', 'Крепкое здоровье', 'Поднять максимум HP до {p}.', 'c', 'maxhp', 60, 'i:heart');
  add('collect', 'updeck', 'Мастерица', 'Собрать колоду, в которой {p} улучшенных карт.', 'c', 'updeck', 15, 'i:mittens');
  add('collect', 'light', 'Налегке', 'Доставить письмо с колодой не больше 15 карт.', 'c', 'light', 1, 'i:feather');
  // база знаний в главном меню
  tiers('collect', 'codex', 'Летописец', 'Открыть записей в базе знаний: {p}.', 'c', 'cxall', [30, 100, 200], ['i:inkpen', 'i:stampbook', 'i:goldquill']);
  add('collect', 'codexheroes', 'Лица Горки', 'Открыть в базе знаний всех героев: {p}.', 's', 'cxh', CODEX.h.length, 'c:herbalist');
  add('collect', 'codexfoes', 'Бестиарий', 'Открыть в базе знаний всех противников: {p}.', 'c', 'cxe', CODEX.e.length, 'e:troll');
  add('collect', 'codexcards', 'Картотека', 'Открыть в базе знаний все карты: {p}.', 'c', 'cxc', CODEX.freeC.length, 'i:telegram');
  add('collect', 'codexrelics', 'Шкатулка талисманов', 'Открыть в базе знаний все талисманы: {p}.', 'c', 'cxr', CODEX.freeR.length, 'i:musicbox');

  /* ---------- Истории: разговоры, встречи, тайны и мрачные версии героев (js/lore.js) ---------- */
  tiers('story', 'talk', 'Разговорчивая', 'Поговорить с противниками {p} раз.', 'c', 'talks', [10, 150, 600], ['e:pigeon', 'e:raven', 'e:owl']);
  tiers('story', 'peace', 'Миром', 'Решить дело миром {p} раз.', 'c', 'peace', [1, 30, 150], ['e:samovar', 'e:matryoshka', 'e:icebear']);
  tiers('story', 'taunt', 'Задира', 'Разозлить противников {p} раз.', 'c', 'taunts', [3, 40, 200], ['e:snowimp', 'e:firecracker', 'e:snowbrute']);
  tiers('story', 'spare', 'Великодушие', 'Пощадить {p} побеждённых противников.', 'c', 'spares', [3, 40, 200], ['e:sootmouse', 'e:magpie', 'e:wolf']);
  add('story', 'scare', 'Пугало', 'Прогнать {p} испуганных противников.', 'c', 'scares', 25, 'e:bat');
  add('story', 'lines', 'Слушательница', 'Услышать {p} реплик противников.', 'c', 'lines', 1000, 'e:cuckoo');
  tiers('story', 'help', 'Друг в беде', 'Помочь героям в пути {p} раз.', 'c', 'helps', [1, 25, 100], ['c:baker', 'c:guard', 'c:herbalist']);
  add('story', 'metall', 'Все свои', 'Встретить в пути каждого героя: {p}.', 's', 'met', Object.keys(CLS).length, 'i:horn');
  add('story', 'friends3', 'Всей Горкой', 'Выйти на финальный бой с тремя друзьями.', 'c', 'friends3', 1, 'i:fire');
  add('story', 'allhelp', 'Ни одной обиды', 'Доставить письмо, помогая всем встреченным героям (не меньше четырёх).', 'c', 'allhelp', 1, 'i:mittens');
  add('story', 'betray', 'Тёмная сторона', 'Обидеть героя так, что его забрала Тень.', 'c', 'betray', 1, 'i:dread');
  add('story', 'forgive', 'Прости меня', 'Попросить прощения у героя, ушедшего в Тень.', 'c', 'forgive', 1, 'i:lullaby');
  const dark = (cls, name) => add('story', `dark-${cls}`, name, `Победить мрачную версию героя: ${CLS[cls].name}.`, 'has', 'darkbeaten', 1, `e:dk_${cls}`, cls);
  dark('lamp', 'Свет вернулся');
  dark('courier', 'Адрес найден');
  dark('guard', 'Мост открыт');
  dark('stoker', 'Пепел остыл');
  dark('baker', 'Свежий хлеб');
  dark('grinder', 'Тупой клинок');
  dark('shepherd', 'Свой пёс');
  dark('herbalist', 'Сладкое после горького');
  add('story', 'alldark', 'Ни одной тени', 'Победить мрачные версии всех героев: {p}.', 's', 'darkbeaten', Object.keys(CLS).length, 'e:shadowking');
  const secret = (cls, name, desc) => add('story', `secret-${cls}`, name, desc, 'has', 'secrets', 1, `c:${cls}`, cls);
  secret('lamp', 'Незажжённый фонарь', 'За Иву зажечь Фонарного Призрака.');
  secret('courier', 'Прадед', 'За Тишу назвать Пустого Почтальона по имени.');
  secret('guard', 'Мост на двоих', 'За Марфу поделить мост с Мостовым Троллем.');
  secret('stoker', 'Правда на ветру', 'За Фому признаться Флюгеру-Петуху про Груню.');
  secret('baker', 'Морковка мира', 'За Груню помириться со Снеговиком-Громилой.');
  secret('grinder', 'Вернуть час', 'За Савву затупить стрелки Сумеречного Часовщика.');
  secret('shepherd', 'Брат Дружка', 'За Лушу помирить Дружка с Сумеречным Волком.');
  secret('herbalist', 'Счёт закрыт', 'За Ульяну выкупить свои годы у Ворона-Счетовода.');
  add('story', 'allsecrets', 'Все тайны Горки', 'Узнать все тайны героев: {p}.', 's', 'secrets', Object.keys(CLS).length, 'i:secret');
  add('story', 'finalbuy', 'Последняя покупка', 'Купить что-нибудь в лавке у последней двери.', 'c', 'finalbuy', 1, 'e:hedgehog');
  // связи: герои между собой и враги между собой
  tiers('story', 'herotie', 'Старые знакомые', 'Выбрать разные особые ответы на встречах с героями: {p}.', 's', 'ties', [5, 15, freeTies], ['c:courier', 'c:stoker', 'c:grinder']);
  add('story', 'befriend', 'Друг всей Горки', 'Подружиться с каждым героем: {p}.', 's', 'friends', CODEX.h.length, 'i:hearth');
  add('story', 'letters', 'Письма сестре', 'За Тишу передать Марфе письма Саввы.', 'c', 'letters', 1, 'i:envelope');
  tiers('story', 'regards', 'Добрая молва', 'Передать привет от пощажённых врагов: {p}.', 'c', 'regards', [5, 40, 150], ['e:wisp', 'e:mist', 'e:samovar']);
  add('story', 'avenged', 'За своих', 'Победить врагов, которые мстили за своих: {p}.', 'c', 'avenged', 25, 'e:snowbrute');
  add('story', 'rivals', 'Враг моего врага', 'Победить соперников уже побеждённых врагов: {p}.', 'c', 'rivals', 25, 'e:vane');

  I18N.patchAch(L); // названия и описания на языке игры
  window.Achievements = { CATS, LIST: L, CODEX };
})();
