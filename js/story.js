/* Время суток и сюжет.
   SKIES: палитры неба как ключевые кадры [доля пути 0..1, палитра].
   После каждого уровня игра смешивает два соседних кадра, поэтому фон меняется понемногу.
   STORIES: тексты сюжета и стадии пути. Активный сюжет задаёт ACTIVE_STORY
   (для просмотра других можно открыть игру с #night, #sunset, #day или #dawn в адресе). */
(function () {
  const night = {
    skyTop: '#232a42', skyMid: '#3a4566', skyBot: '#4b5878',
    sun: '#ffd27a', sunX: 300, sunY: 120, sunR: 0, stars: 0, moonHole: true,
    hills: '#33405e', spires: '#2a3450', fog: '#9fb0d0',
    snowTop: '#7d8db0', snowBot: '#4c5a7c', snowEdge: '#a9b8d6',
    roof: '#c9d4ea', roofHi: '#e6edf8', wall: '#2b2733', wall2: '#252431', ink: '#141826',
    window: '#ff9d42', door: '#e07a2c', window2: '#1b1a24', fence: '#3b3640',
    lampOff: '#2a3044', lampGlow: 1, winGlow: 1,
  };

  const afternoon = {
    skyTop: '#6fa8dc', skyMid: '#bcd8ec', skyBot: '#f5e6c4',
    sun: '#fff3c4', sunX: 120, sunY: 150, sunR: 36, stars: 0, moonHole: false,
    hills: '#a8b8cc', spires: '#8a9ab4', fog: '#fff2d8',
    snowTop: '#fdf6ee', snowBot: '#c8cfe2', snowEdge: '#ffffff',
    roof: '#ffffff', roofHi: '#ffffff', wall: '#6a4a3a', wall2: '#5a5a72', ink: '#3a3040',
    window: '#e8d8b0', door: '#a8553a', window2: '#c8d0e0', fence: '#7a5a48',
    lampOff: '#6a6a7a', lampGlow: 0, winGlow: 0,
  };
  const sunsetTouch = {
    skyTop: '#3a3266', skyMid: '#d0625a', skyBot: '#f4a35a',
    sun: '#ff9a4a', sunX: 120, sunY: 500, sunR: 46, stars: 0.15, moonHole: false,
    hills: '#6a4466', spires: '#553858', fog: '#ffb080',
    snowTop: '#e8b0a8', snowBot: '#8a6a90', snowEdge: '#ffd6c8',
    roof: '#e8c0c0', roofHi: '#f8d8d0', wall: '#48303e', wall2: '#3e2a3a', ink: '#241626',
    window: '#ffb860', door: '#b0502e', window2: '#5a3a4a', fence: '#48303e',
    lampOff: '#4a3a50', lampGlow: 0.7, winGlow: 0.6,
  };
  const deepNight = {
    skyTop: '#0e1028', skyMid: '#22224a', skyBot: '#3a3060',
    sun: '#ff7a4a', sunX: 120, sunY: 620, sunR: 0, stars: 1, moonHole: false,
    hills: '#1e1c38', spires: '#18162e', fog: '#5a5a90',
    snowTop: '#4a5080', snowBot: '#252a48', snowEdge: '#7a80b0',
    roof: '#8a90b8', roofHi: '#a8acd0', wall: '#1c1a2c', wall2: '#181628', ink: '#100e20',
    window: '#ff9d42', door: '#c0602a', window2: '#ff9d42', fence: '#2a2840',
    lampOff: '#222238', lampGlow: 1, winGlow: 1,
  };
  const goldenHour = {
    skyTop: '#4a3f7a', skyMid: '#e8836a', skyBot: '#f7c98a',
    sun: '#ffe08a', sunX: 120, sunY: 420, sunR: 44, stars: 0, moonHole: false,
    hills: '#8a5c78', spires: '#6e4766', fog: '#ffd0a0',
    snowTop: '#f4cdb8', snowBot: '#b98aa6', snowEdge: '#ffe6d6',
    roof: '#f6d6c6', roofHi: '#fff0e6', wall: '#5a3a48', wall2: '#4e3444', ink: '#2a1a2a',
    window: '#c88a6a', door: '#a8553a', window2: '#8a6a7a', fence: '#5a3a48',
    lampOff: '#6a4a5a', lampGlow: 0.35, winGlow: 0.15,
  };
  const dusk = {
    skyTop: '#141634', skyMid: '#3a2f5e', skyBot: '#a24f6a',
    sun: '#ff7a4a', sunX: 120, sunY: 560, sunR: 40, stars: 0.9, moonHole: false,
    hills: '#2e2848', spires: '#241f3c', fog: '#7a6aa0',
    snowTop: '#6a6a9a', snowBot: '#33365a', snowEdge: '#9a9ac8',
    roof: '#a8a8cc', roofHi: '#c8c8e6', wall: '#262236', wall2: '#201c30', ink: '#141226',
    window: '#ff9d42', door: '#c0602a', window2: '#1b1a24', fence: '#33304a',
    lampOff: '#2a2a44', lampGlow: 1, winGlow: 1,
  };
  const day = {
    skyTop: '#5aa2e6', skyMid: '#a6d3f5', skyBot: '#e4f2fb',
    sun: '#fff6cf', sunX: 300, sunY: 110, sunR: 34, stars: 0, moonHole: false,
    hills: '#a9c2dc', spires: '#8fa9c6', fog: '#ffffff',
    snowTop: '#ffffff', snowBot: '#c8d9ec', snowEdge: '#ffffff',
    roof: '#ffffff', roofHi: '#ffffff', wall: '#7a4a32', wall2: '#5f6f8a', ink: '#3a3040',
    window: '#bfe0f5', door: '#b0482c', window2: '#bfe0f5', fence: '#8a6a4a',
    lampOff: '#5a6070', lampGlow: 0, winGlow: 0,
  };
  const morning = {
    ...day,
    skyTop: '#7ab0e0', skyMid: '#f5c0a0', skyBot: '#fde6c0',
    sun: '#fff0b0', sunX: 280, sunY: 360, sunR: 42,
    hills: '#c49aa8', spires: '#a87a90', fog: '#ffe0c0',
    snowTop: '#fff0e6', snowBot: '#d8b8c8', snowEdge: '#ffffff', roof: '#fff4ec', roofHi: '#ffffff',
  };
  const predawn = { ...dusk, sunX: 280, sunY: 580, sun: '#ff9a6a', stars: 0.6, skyBot: '#c07a8a' };

  const SKIES = {
    night: [[0, night]],
    // день → золотой час к боссу I стадии → солнце касается горизонта → сумерки → ночь к финалу
    sunset: [[0, afternoon], [24 / 50, goldenHour], [25 / 50, sunsetTouch], [49 / 50, dusk], [1, deepNight]],
    day: [[0, day]],
    dawn: [[0, predawn], [1, morning]],
  };

  const roman = ['I', 'II', 'III'];
  const STORIES = {
    night: {
      sky: 'night', title: 'Фитиль', heroName: 'Ива',
      stages: [{ name: 'Глава I · Сонный Брод', len: 12, boss: ['moth'], scene: 'town',
          early: ['inkcat', 'laundress', 'snowimp', 'sootmouse'], normals: ['inkcat', 'laundress', 'golem', 'icicle', 'scarfsnake', 'mailbox'], elites: ['owl', 'snowbrute'] }],
      lamps: (run) => Math.min(4, run.lit),
      intro: 'Однажды ночью Ночная Моль съела луну и погасила все фонари Сонного Брода. Ученица фонарщика Ива берёт старую лампу и отправляется в путь, пока не догорела последняя свеча.',
      pathRule: (total) => `<b>Свеча.</b> Через ${total} шагов придёт Моль.`,
      countdown: (c) => (c.left > 0 ? `Свеча догорит через ${c.left}` : 'Свеча догорела'),
      winRibbon: 'Победа!', winTitle: 'Луна вернулась',
      winText: 'Ночная Моль выронила луну, и та покатилась по крышам обратно на небо. В Сонном Броде снова зажглись фонари, а Ива стала настоящей фонарщицей.',
      loseTitle: 'Фитиль погас…',
      loseText: 'Темнота оказалась сильнее. Но где-то в Сонном Броде ещё тлеет уголёк, а значит, история может начаться заново.',
    },
    sunset: {
      sky: 'sunset', title: 'Последний луч', heroName: 'Ива', heroBag: true,
      stages: [
        { name: 'Стадия I · Медовая Горка', len: 25, boss: ['magpie', 'waxgiant', 'vane'], scene: 'town',
          // первые уровни стадии — враги попроще, дальше весь городской набор
          early: ['inkcat', 'snowimp', 'pigeon', 'sootmouse', 'scarfsnake', 'icicle', 'matryoshka', 'samovar'],
          normals: ['inkcat', 'snowimp', 'pigeon', 'sootmouse', 'scarfsnake', 'icicle', 'laundress', 'golem', 'mailbox', 'matryoshka', 'samovar', 'cuckoo'],
          elites: ['owl', 'snowbrute', 'iceknight'] },
        { name: 'Стадия II · Окраина', len: 25, boss: ['clockmaker', 'wolf', 'troll'], scene: 'outskirts',
          early: ['shadowthief', 'bat', 'wisp', 'frostfox', 'laundress', 'mist', 'ghoul'],
          normals: ['shadowthief', 'bat', 'stump', 'frostfox', 'wisp', 'raven', 'laundress', 'golem', 'mist', 'ghoul', 'firecracker'],
          elites: ['icebear', 'lampghost', 'owl', 'blizzard', 'watchman'] },
        { name: 'Финал · Последний дом', len: 1, boss: ['shadowking', 'hollowpost', 'skywhale'], scene: 'outskirts', early: [], normals: [], elites: [] },
      ],
      // фонари в городе зажигаются один за другим, пока солнце опускается к крышам
      lamps: (run) => Math.max(0, Math.min(4, Math.floor((run.step - 14) / 2))),
      // тексты, где упоминается герой, — функции от выбранного героя (h — запись из CLASSES)
      intro: (h) => `В Медовой Горке письма разносят до заката. Когда садится солнце, из щелей выползают Тени и съедают недоставленные слова. Почтальоны уже разошлись по домам, и последнее письмо дня досталось ${h.whom}. Адрес на нём за самой окраиной. Путь долгий, а солнце уже клонится к крышам.`,
      pathRule: (total) => `<b>Путь.</b> ${total} уровень: две стадии по 25, в конце каждой босс, а на последнем ждёт финальный. Боссы каждый раз разные.`,
      countdown: (c) => (c.final ? 'Солнце село. Финальный босс здесь' : c.left > 0 ? `Уровень ${c.level} из ${c.total} · босс через ${c.left}` : `Уровень ${c.level} · босс стадии`),
      stageIntro: ['Солнце ещё высоко. Пора в путь.', 'Солнце коснулось крыш. Дальше начинается окраина.', 'Стемнело. До двери адресата один шаг.'],
      winRibbon: 'Доставлено!', winTitle: 'Письмо дошло',
      winText: (h) => `${h.name} постучал${h.f ? 'а' : ''} в последнюю дверь, когда погас последний луч. Последняя Тень рассыпалась пылью, а в письме оказалось одно слово: «Спасибо». Завтра солнце снова встанет над Медовой Горкой.`,
      loseTitle: 'Солнце село…',
      loseText: (h) => `Тени забрали письмо. Но завтра будет новый закат, и ${h.name} снова выйдет на маршрут.`,
    },
  };
  for (const st of Object.values(STORIES)) st.stages.forEach((g, i) => { g.roman = roman[i]; });
  I18N.patch('story', STORIES); // тексты сюжета на языке игры

  const ACTIVE_STORY = 'sunset';
  const fromHash = (location.hash || '').slice(1);
  const story = STORIES[fromHash] || STORIES[ACTIVE_STORY];
  const sky = SKIES[SKIES[fromHash] ? fromHash : story.sky];

  window.Story = { STORIES, SKIES, story, sky };
})();
