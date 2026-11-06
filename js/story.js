/* Время суток и сюжет.
   SKIES: палитры неба. У каждой есть from (первый шаг пути) и to (последний шаг),
   игра плавно смешивает их по мере продвижения к боссу.
   STORIES: тексты сюжета. Активный сюжет выбирается в ACTIVE_STORY
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
    night: { from: night, to: night },
    sunset: { from: goldenHour, to: dusk },
    day: { from: day, to: day },
    dawn: { from: predawn, to: morning },
  };

  const STORIES = {
    night: {
      sky: 'night', title: 'Фитиль', chapter: 'Глава I · Сонный Брод', heroName: 'Ива', boss: 'moth', litLamps: true,
      intro: 'Однажды ночью Ночная Моль съела луну и погасила все фонари Сонного Брода. Ученица фонарщика Ива берёт старую лампу и отправляется в путь, пока не догорела последняя свеча.',
      countdownRule: (n) => `<b>Свеча.</b> Через ${n} шагов придёт Моль.`,
      countdown: (left) => (left > 0 ? `Свеча догорит через ${left}` : 'Свеча догорела'),
      winRibbon: 'Победа!', winTitle: 'Луна вернулась',
      winText: 'Ночная Моль выронила луну, и та покатилась по крышам обратно на небо. В Сонном Броде снова зажглись фонари, а Ива стала настоящей фонарщицей.',
      loseTitle: 'Фитиль погас…',
      loseText: 'Темнота оказалась сильнее. Но где-то в Сонном Броде ещё тлеет уголёк, а значит, история может начаться заново.',
    },
    sunset: {
      sky: 'sunset', title: 'Последний луч', chapter: 'Медовая Горка · закат', heroName: 'Ива', boss: 'shadowking', litLamps: false, heroBag: true,
      intro: 'В Медовой Горке письма разносят до заката. Когда садится солнце, из щелей выползают Тени и съедают недоставленные слова. Почтальонка Ива получила последнее письмо дня, а адрес на нём на самом краю города. Солнце уже касается крыш.',
      countdownRule: (n) => `<b>Солнце.</b> Через ${n} шагов стемнеет и придёт Король Теней.`,
      countdown: (left) => (left > 0 ? `Солнце сядет через ${left}` : 'Солнце село'),
      winRibbon: 'Доставлено!', winTitle: 'Письмо дошло',
      winText: 'Ива постучала в последнюю дверь, когда погас последний луч. Король Теней рассыпался пылью, а в письме оказалось одно слово: «Спасибо». Завтра солнце снова встанет над Медовой Горкой.',
      loseTitle: 'Солнце село…',
      loseText: 'Тени забрали письмо. Но завтра будет новый закат, и Ива снова выйдет на маршрут.',
    },
  };

  const ACTIVE_STORY = 'sunset';
  const fromHash = (location.hash || '').slice(1);
  const story = STORIES[fromHash] || STORIES[ACTIVE_STORY];
  const sky = SKIES[SKIES[fromHash] ? fromHash : story.sky];

  window.Story = { STORIES, SKIES, story, sky };
})();
