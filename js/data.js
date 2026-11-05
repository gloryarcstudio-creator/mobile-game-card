/* Фитиль — данные: карты, враги, талисманы, события. */
(function () {
  /* Карта: cost, type (atk|skill), rarity (start|common|rare), art, desc(s), play(g)
     g — интерфейс боя из game.js: attack(n, hits), block(n), flame(n), draw(n),
     heal(n), burn(n), weak(n), energy(n), consumeFlame(), state */
  const CARDS = {
    strike: {
      name: 'Удар фонарём', cost: 1, type: 'atk', rarity: 'start', art: 'strike',
      desc: (g) => `Нанести ${g.dmgText(6)} урона.`,
      play: async (g) => g.attack(6),
    },
    guard: {
      name: 'Ставень', cost: 1, type: 'skill', rarity: 'start', art: 'guard',
      desc: () => 'Получить 5 защиты.',
      play: async (g) => g.block(5),
    },
    kindle: {
      name: 'Разжечь фитиль', cost: 1, type: 'skill', rarity: 'start', art: 'kindle',
      desc: () => '+1 Огонёк. Взять 1 карту.',
      play: async (g) => { await g.flame(1); g.draw(1); },
    },
    spark: {
      name: 'Искра', cost: 0, type: 'atk', rarity: 'common', art: 'spark',
      desc: (g) => `Нанести ${g.dmgText(3)} урона. +1 Огонёк.`,
      play: async (g) => { await g.attack(3); await g.flame(1); },
    },
    sparks: {
      name: 'Сноп искр', cost: 2, type: 'atk', rarity: 'common', art: 'sparks',
      desc: (g) => `Нанести ${g.dmgText(3)} урона 3 раза.`,
      play: async (g) => g.attack(3, 3),
    },
    cloak: {
      name: 'Тёплый плащ', cost: 1, type: 'skill', rarity: 'common', art: 'cloak',
      desc: () => 'Получить 8 защиты.',
      play: async (g) => g.block(8),
    },
    tea: {
      name: 'Чай с мёдом', cost: 1, type: 'skill', rarity: 'common', art: 'tea', exhaust: true,
      desc: () => 'Восстановить 6 HP. Сгорает.',
      play: async (g) => g.heal(6),
    },
    wind: {
      name: 'Ветер в спину', cost: 0, type: 'skill', rarity: 'common', art: 'wind', exhaust: true,
      desc: () => 'Взять 2 карты. Сгорает.',
      play: async (g) => g.draw(2),
    },
    oil: {
      name: 'Лампадное масло', cost: 1, type: 'skill', rarity: 'common', art: 'oil',
      desc: () => '+2 Огонька.',
      play: async (g) => g.flame(2),
    },
    mirror: {
      name: 'Зеркальце', cost: 1, type: 'skill', rarity: 'common', art: 'mirror',
      desc: () => 'Получить 5 защиты. +1 Огонёк.',
      play: async (g) => { g.block(5); await g.flame(1); },
    },
    heavy: {
      name: 'Размах', cost: 2, type: 'atk', rarity: 'common', art: 'heavy',
      desc: (g) => `Нанести ${g.dmgText(13)} урона.`,
      play: async (g) => g.attack(13),
    },
    wax: {
      name: 'Капля воска', cost: 1, type: 'skill', rarity: 'common', art: 'wax',
      desc: () => 'Получить 6 защиты. Враг Ослаблен на 1 ход.',
      play: async (g) => { g.block(6); g.weak(1); },
    },
    ember: {
      name: 'Уголёк', cost: 1, type: 'atk', rarity: 'common', art: 'ember',
      desc: (g) => `Нанести ${g.dmgText(5)} урона. Поджог 3.`,
      play: async (g) => { await g.attack(5); g.burn(3); },
    },
    palm: {
      name: 'Жар-ладонь', cost: 1, type: 'atk', rarity: 'rare', art: 'palm',
      desc: (g) => `Потратить все Огоньки. Нанести 7 урона за каждый${g.state ? ` (${7 * g.state.flame})` : ''}.`,
      play: async (g) => { const n = g.consumeFlame(); if (n > 0) await g.attack(7 * n, 1, true); },
    },
    shadow: {
      name: 'Тень-хитрость', cost: 1, type: 'skill', rarity: 'rare', art: 'shadow',
      desc: () => 'Враг Ослаблен на 2 хода. Взять 1 карту.',
      play: async (g) => { g.weak(2); g.draw(1); },
    },
    blaze: {
      name: 'Пожар', cost: 2, type: 'skill', rarity: 'rare', art: 'blaze',
      desc: () => 'Поджог 8. +1 Огонёк.',
      play: async (g) => { g.burn(8); await g.flame(1); },
    },
    breath: {
      name: 'Глубокий вдох', cost: 0, type: 'skill', rarity: 'rare', art: 'breath', exhaust: true,
      desc: () => '+2 энергии. Сгорает.',
      play: async (g) => g.energy(2),
    },
  };

  /* Враги: шаблон намерений повторяется по кругу.
     intent: {k:'attack', v, hits} | {k:'block', v} | {k:'buff', v} (сила)
             {k:'debuff', v} (Слабость игроку) | {k:'snuff', v} (гасит Огоньки + атака) */
  const ENEMIES = {
    inkcat: {
      name: 'Чернильный кот', hp: 20, tier: 'normal',
      line: 'Мурлычет кляксами и ворует письма.',
      pattern: [{ k: 'attack', v: 6 }, { k: 'attack', v: 3, hits: 2 }, { k: 'block', v: 5, then: { k: 'attack', v: 4 } }],
    },
    laundress: {
      name: 'Туманная прачка', hp: 26, tier: 'normal',
      line: 'Полощет в тумане чужие сны.',
      pattern: [{ k: 'debuff', v: 2 }, { k: 'attack', v: 8 }, { k: 'block', v: 7 }, { k: 'attack', v: 5 }],
    },
    golem: {
      name: 'Восковой голем', hp: 34, tier: 'normal',
      line: 'Слеплен из огарков погасших свечей.',
      pattern: [{ k: 'block', v: 10 }, { k: 'attack', v: 11 }, { k: 'attack', v: 5 }],
    },
    owl: {
      name: 'Совиный сторож', hp: 48, tier: 'elite',
      line: 'Охраняет темноту. Никого не пропускает.',
      pattern: [{ k: 'attack', v: 8 }, { k: 'buff', v: 2 }, { k: 'attack', v: 3, hits: 3 }, { k: 'block', v: 8 }],
    },
    moth: {
      name: 'Ночная Моль', hp: 110, tier: 'boss',
      line: 'Съела луну и все фонари Сонного Брода.',
      pattern: [{ k: 'attack', v: 12 }, { k: 'snuff', v: 8 }, { k: 'attack', v: 5, hits: 3 }, { k: 'block', v: 15, then: { k: 'buff', v: 3 } }],
    },
  };

  const RELICS = {
    bell: { name: 'Медный колокольчик', art: 'bell', desc: 'В начале боя получить 6 защиты.' },
    feather: { name: 'Совиное перо', art: 'feather', desc: 'Начинать бой с 1 Огоньком.' },
    jar: { name: 'Банка светлячков', art: 'jar', desc: '+8 к максимуму HP.' },
    flint: { name: 'Огниво', art: 'flint', desc: 'Вспышка лампы наносит +5 урона.' },
    snowman: { name: 'Снеговик-талисман', art: 'snowman', desc: 'После победы восстановить 4 HP.' },
  };

  /* События: выбор как в книжке. Каждая опция — {text, hint, act(run, api)} */
  const EVENTS = [
    {
      id: 'well', title: 'Старый колодец', art: 'well',
      text: 'Из колодца доносится тихое «спасибо» на каждую упавшую монетку.',
      options: [
        { text: 'Бросить 15 монет', hint: '−15 монет, +10 HP', can: (r) => r.gold >= 15, act: (r, a) => { r.gold -= 15; a.heal(10); return 'Вода засветилась тёплым светом. Тебе стало легче.'; } },
        { text: 'Заглянуть внутрь', hint: '50%: карта / −5 HP', act: (r, a) => { if (Math.random() < 0.5) { a.giveRandomCard('common'); return 'На дне блеснула карта. Ты выловила её ведром.'; } a.damage(5); return 'Из колодца вылетела стая летучих мышей!'; } },
        { text: 'Пройти мимо', hint: 'Ничего', act: () => 'Ты пошла дальше. Колодец обиженно булькнул.' },
      ],
    },
    {
      id: 'puppet', title: 'Бродячий кукольник', art: 'puppet',
      text: 'Кукольник без лица протягивает тебе нитку: «Сыграй со мной — получишь редкость».',
      options: [
        { text: 'Сыграть', hint: '−6 HP, редкая карта', act: (r, a) => { a.damage(6); a.giveRandomCard('rare'); return 'Нитка больно дёрнула палец, но в руке осталась редкая карта.'; } },
        { text: 'Купить куклу', hint: '−30 монет, талисман', can: (r) => r.gold >= 30, act: (r, a) => { r.gold -= 30; a.giveRelic(); return 'Кукла подмигнула и превратилась в талисман.'; } },
        { text: 'Отказаться', hint: 'Ничего', act: () => 'Кукольник растворился в снегопаде.' },
      ],
    },
    {
      id: 'lantern', title: 'Замёрзший фонарь', art: 'lantern',
      text: 'Фонарь на перекрёстке покрыт инеем. Внутри ещё теплится крошечный огонёк.',
      options: [
        { text: 'Отогреть ладонями', hint: '−4 HP, талисман', act: (r, a) => { a.damage(4); a.giveRelic(); return 'Пальцы замёрзли, но фонарь вспыхнул и подарил тебе талисман.'; } },
        { text: 'Забрать огонёк', hint: 'Карта «Искра»', act: (r, a) => { a.giveCard('spark'); return 'Огонёк запрыгнул в твою лампу.'; } },
      ],
    },
    {
      id: 'snowman', title: 'Грустный снеговик', art: 'snowman',
      text: '«Мне не видно звёзд без фонарей», — вздыхает снеговик. — «Поговоришь со мной?»',
      options: [
        { text: 'Поговорить', hint: '+12 HP', act: (r, a) => { a.heal(12); return 'Вы болтали о звёздах. На душе потеплело.'; } },
        { text: 'Подарить шарф', hint: 'Убрать карту из колоды', act: (r, a) => { a.removeCardPrompt(); return null; } },
        { text: 'Посмеяться над ним', hint: '+25 монет, −1 к макс. HP', act: (r, a) => { r.gold += 25; r.maxHp -= 1; r.hp = Math.min(r.hp, r.maxHp); return 'Снеговик отвернулся. Из-под него выкатились монетки.'; } },
      ],
    },
    {
      id: 'coins', title: 'Рассыпанный кошелёк', art: 'coin',
      text: 'В сугробе блестят монеты. Рядом следы чернильных лап.',
      options: [
        { text: 'Собрать', hint: '+30 монет, бой?', act: (r, a) => { r.gold += 30; if (Math.random() < 0.4) { a.startFight('inkcat'); return 'Хозяин кошелька вернулся!'; } return 'Повезло: никто не заметил.'; } },
        { text: 'Оставить', hint: 'Ничего', act: () => 'Чужого не надо.' },
      ],
    },
  ];

  window.Data = { CARDS, ENEMIES, RELICS, EVENTS };
})();
