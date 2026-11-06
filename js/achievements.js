/* Достижения: список и цели. Прогресс считает js/game.js и хранит в браузере.
   src — откуда берётся прогресс:
     stat — счётчик общей статистики (STATS), c — свой счётчик или флаг достижений,
     s — сколько разных предметов собрано в наборе, has — есть ли предмет item в наборе.
   desc: {p} заменяется на «прогресс/цель».
   art: 'h' — Ива, 'e:<id>' — противник, 'i:<id>' — иконка. */
(function () {
  const { CARDS, RELICS, EVENTS } = window.Data;
  const STORY = window.Story.story;

  // сколько разных противников встречается в текущем сюжете
  const foes = new Set();
  STORY.stages.forEach((g) => [...g.boss, ...g.early, ...g.normals, ...g.elites].forEach((id) => foes.add(id)));
  const playable = Object.keys(CARDS).filter((k) => CARDS[k].rarity !== 'status').length;
  const relics = Object.keys(RELICS).length;
  const trophies = Object.keys(RELICS).filter((k) => RELICS[k].tier === 'boss').length;

  const CATS = [
    ['path', 'Путь'],
    ['fight', 'Мастерство'],
    ['collect', 'Коллекция'],
  ];

  const L = [];
  const add = (cat, id, name, desc, src, key, goal, art, item, stars = 0) => L.push({ cat, id, name, stars, desc, src, key, goal, art, item });
  // ступени одного достижения: ★, ★★, ★★★
  const tiers = (cat, id, name, desc, src, key, goals, arts) => goals.forEach((g, i) => add(cat, `${id}${i + 1}`, name, desc, src, key, g, arts[i], null, i + 1));

  /* ---------- Путь ---------- */
  add('path', 'first', 'Первый шаг', 'Отправиться в первый путь.', 'stat', 'runs', 1, 'h');
  add('path', 'runs10', 'Снова на маршрут', 'Начать {p} забегов.', 'stat', 'runs', 10, 'i:lantern');
  tiers('path', 'road', 'Долгая дорога', 'Пройти {p} уровней.', 'c', 'steps', [100, 400, 1000], ['i:rhythm', 'i:compass', 'i:sled']);
  tiers('path', 'win', 'Письмо доставлено', 'Доставить письмо {p} раз.', 'stat', 'wins', [1, 3, 10], ['i:lastword', 'i:parcel', 'i:redseal']);
  add('path', 'events', 'Любопытная', 'Побывать во всех событиях пути: {p}.', 's', 'events', EVENTS.length, 'i:well');
  tiers('path', 'chest', 'Будильник', 'Разбудить {p} сундуков-сонь.', 'c', 'chests', [10, 40], ['i:chest', 'i:bell']);
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
  tiers('fight', 'foes', 'Гроза сугробов', 'Победить {p} противников.', 'stat', 'fights', [25, 100, 300], ['e:snowimp', 'e:frostfox', 'e:snowbrute']);
  tiers('fight', 'elite', 'Не робкого десятка', 'Победить {p} элит.', 'stat', 'elites', [5, 20, 50], ['e:owl', 'e:icebear', 'e:lampghost']);
  tiers('fight', 'burst', 'Фонарщица', 'Устроить {p} Вспышек.', 'c', 'bursts', [10, 50, 200], ['i:spark', 'i:eveninglamp', 'i:flashpoint']);
  tiers('fight', 'cards', 'Ловкие руки', 'Сыграть {p} карт.', 'stat', 'cards', [100, 500, 2000], ['i:strike', 'i:drafts', 'i:flurry']);
  tiers('fight', 'hit', 'Тяжёлая рука', 'Нанести {p} урона одним ударом.', 'c', 'maxhit', [20, 35, 60], ['i:heavy', 'i:payback', 'i:blaze']);
  add('fight', 'flawless', 'Ни царапины', 'Победить противника, не потеряв ни одного HP.', 'c', 'flawless', 1, 'i:guard');
  add('fight', 'flawlesselite', 'Чистая работа', 'Победить элиту, не потеряв ни одного HP.', 'c', 'flawlesselite', 1, 'i:cloak');
  add('fight', 'oneturn', 'С порога', 'Победить противника за один ход.', 'c', 'oneturn', 1, 'i:whistle');
  add('fight', 'combo', 'Почтовый вихрь', 'Сыграть 8 карт за один ход.', 'c', 'combo', 1, 'i:wind');
  add('fight', 'dblburst', 'Двойная вспышка', 'Устроить две Вспышки за один ход.', 'c', 'dblburst', 1, 'i:sparks');
  add('fight', 'burnkill', 'Догорело', 'Добить противника Поджогом.', 'c', 'burnkill', 1, 'i:ember');
  add('fight', 'thornskill', 'Сам напросился', 'Добить противника Шипами.', 'c', 'thornskill', 1, 'i:pinecone');
  add('fight', 'stunboss', 'Колыбельная', 'Усыпить босса.', 'c', 'stunboss', 1, 'i:lullaby');
  add('fight', 'charms3', 'Заколдованный вечер', 'Наложить трое разных Чар в одном бою.', 'c', 'charms3', 1, 'i:hearth');

  /* ---------- Коллекция ---------- */
  tiers('collect', 'spend', 'Звонкая монета', 'Потратить {p} монет.', 'c', 'spent', [300, 1000, 2500], ['i:coin', 'i:luckycoin', 'e:hedgehog']);
  tiers('collect', 'buy', 'Постоянная покупательница', 'Купить в лавке {p} карт.', 'c', 'bought', [10, 30], ['i:coupon', 'i:pockethog']);
  tiers('collect', 'up', 'Точильщица', 'Улучшить {p} карт.', 'c', 'upgrades', [10, 40, 100], ['i:whetstone', 'i:stamp', 'i:goldquill']);
  tiers('collect', 'relic', 'Шкатулка с секретами', 'Найти {p} разных талисманов.', 's', 'relics', [10, 20, relics], ['i:jar', 'i:musicbox', 'i:moonstone']);
  tiers('collect', 'card', 'Полная сумка', 'Сыграть {p} разных карт.', 's', 'played', [15, 30, playable], ['i:envelope', 'i:secret', 'i:stampbook']);
  tiers('collect', 'foe', 'Знаток окрестностей', 'Победить {p} разных противников.', 's', 'beaten', [10, 20, foes.size], ['e:pigeon', 'e:raven', 'e:wisp']);
  tiers('collect', 'trophy', 'Трофеи', 'Взять {p} разных талисманов босса.', 's', 'trophies', [3, trophies], ['i:hourglass', 'i:crown']);
  add('collect', 'rich', 'Копилка полна', 'Накопить {p} монет за один забег.', 'c', 'maxgold', 300, 'i:piggy');
  add('collect', 'hp', 'Крепкое здоровье', 'Поднять максимум HP до {p}.', 'c', 'maxhp', 50, 'i:heart');
  add('collect', 'updeck', 'Мастерица', 'Собрать колоду, в которой {p} улучшенных карт.', 'c', 'updeck', 15, 'i:mittens');
  add('collect', 'light', 'Налегке', 'Доставить письмо с колодой не больше 15 карт.', 'c', 'light', 1, 'i:feather');

  window.Achievements = { CATS, LIST: L };
})();
