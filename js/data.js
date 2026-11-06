/* Фитиль — данные: карты, враги, талисманы, события. */
(function () {
  /* Карта: {name, cost, upCost?, type, rarity, art, exhaust?, retain?, desc(g, u, c), play(g, u, c)}
     type: atk (атака) | skill (навык) | charm (чары: действуют до конца боя) | status (помеха от врагов)
     rarity: start | common | rare | status
     cls — карта героя: выпадает в наградах и лавке только этому герою (см. CLASSES)
     u — карта улучшена у костра (цифры в описании и розыгрыше берутся через u ? улучшено : обычно)
     c — экземпляр карты в бою (для карт, которые растут, пока лежат в колоде)
     g — интерфейс боя из game.js: attack(n, hits), block(n), flame(n), draw(n), heal(n), burn(n),
         weak(n), vuln(n), energy(n), resolve(n), rush(n), thorns(n), chill(n), stun(), deliver(fn),
         gold(n), burstNow(), exhaustHand(pred), charm(id, n), doubleBlock(), maxHp(n), consumeFlame(),
         played, blockNow, enemyDead, state, dmgText(n) */
  const CARDS = {
    // ---------- стартовые ----------
    strike: {
      name: 'Удар фонарём', cost: 1, type: 'atk', rarity: 'start', art: 'strike',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 9 : 6)} урона.`,
      play: async (g, u) => g.attack(u ? 9 : 6),
    },
    guard: {
      name: 'Ставень', cost: 1, type: 'skill', rarity: 'start', art: 'guard',
      desc: (g, u) => `Получить ${u ? 8 : 5} защиты.`,
      play: async (g, u) => g.block(u ? 8 : 5),
    },
    kindle: {
      name: 'Разжечь фитиль', cost: 1, type: 'skill', rarity: 'start', art: 'kindle',
      desc: (g, u) => `+1 Огонёк. Взять ${u ? 2 : 1} карт${u ? 'ы' : 'у'}.`,
      play: async (g, u) => { await g.flame(1); g.draw(u ? 2 : 1); },
    },

    // ---------- обычные: Огонёк, защита, атаки ----------
    spark: {
      name: 'Искра', cost: 0, type: 'atk', rarity: 'common', art: 'spark',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 5 : 3)} урона. +1 Огонёк.`,
      play: async (g, u) => { await g.attack(u ? 5 : 3); await g.flame(1); },
    },
    sparks: {
      name: 'Сноп искр', cost: 2, type: 'atk', rarity: 'common', art: 'sparks',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 4 : 3)} урона 3 раза.`,
      play: async (g, u) => g.attack(u ? 4 : 3, 3),
    },
    cloak: {
      name: 'Тёплый плащ', cost: 1, type: 'skill', rarity: 'common', art: 'cloak',
      desc: (g, u) => `Получить ${u ? 11 : 8} защиты.`,
      play: async (g, u) => g.block(u ? 11 : 8),
    },
    tea: {
      name: 'Чай с мёдом', cost: 1, type: 'skill', rarity: 'common', art: 'tea', exhaust: true,
      desc: (g, u) => `Восстановить ${u ? 9 : 6} HP.`,
      play: async (g, u) => g.heal(u ? 9 : 6),
    },
    wind: {
      name: 'Ветер в спину', cost: 0, type: 'skill', rarity: 'common', art: 'wind', exhaust: true,
      desc: (g, u) => `Взять ${u ? 3 : 2} карты.`,
      play: async (g, u) => g.draw(u ? 3 : 2),
    },
    oil: {
      name: 'Лампадное масло', cost: 1, upCost: 0, type: 'skill', rarity: 'common', art: 'oil',
      desc: () => '+2 Огонька.',
      play: async (g) => g.flame(2),
    },
    mirror: {
      name: 'Зеркальце', cost: 1, type: 'skill', rarity: 'common', art: 'mirror',
      desc: (g, u) => `Получить ${u ? 8 : 5} защиты. +1 Огонёк.`,
      play: async (g, u) => { g.block(u ? 8 : 5); await g.flame(1); },
    },
    heavy: {
      name: 'Размах', cost: 2, type: 'atk', rarity: 'common', art: 'heavy',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 18 : 13)} урона.`,
      play: async (g, u) => g.attack(u ? 18 : 13),
    },
    wax: {
      name: 'Капля воска', cost: 1, type: 'skill', rarity: 'common', art: 'wax',
      desc: (g, u) => `Получить ${u ? 8 : 6} защиты. Враг Ослаблен на ${u ? 2 : 1} ход${u ? 'а' : ''}.`,
      play: async (g, u) => { g.block(u ? 8 : 6); g.weak(u ? 2 : 1); },
    },
    ember: {
      name: 'Уголёк', cost: 1, type: 'atk', rarity: 'common', art: 'ember',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 7 : 5)} урона. Поджог ${u ? 4 : 3}.`,
      play: async (g, u) => { await g.attack(u ? 7 : 5); g.burn(u ? 4 : 3); },
    },
    snowkick: {
      name: 'Пинок сугроба', cost: 1, type: 'atk', rarity: 'common', art: 'snowkick',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 7 : 5)} урона. Получить ${u ? 7 : 5} защиты.`,
      play: async (g, u) => { await g.attack(u ? 7 : 5); g.block(u ? 7 : 5); },
    },
    payback: {
      name: 'Ответный удар', cost: 1, upCost: 0, type: 'atk', rarity: 'common', art: 'payback',
      desc: (g) => `Нанести урон, равный вашей защите${g.state ? ` (${g.dmgText(g.blockNow)})` : ''}.`,
      play: async (g) => g.attack(g.blockNow),
    },
    luckycoin: {
      name: 'Счастливая монетка', cost: 0, type: 'atk', rarity: 'common', art: 'luckycoin', exhaust: true,
      desc: (g, u) => `Нанести ${g.dmgText(u ? 6 : 4)} урона. +${u ? 8 : 5} монет.`,
      play: async (g, u) => { await g.attack(u ? 6 : 4); g.gold(u ? 8 : 5); },
    },
    snowball: {
      name: 'Снежный ком', cost: 1, type: 'atk', rarity: 'common', art: 'snowball',
      desc: (g, u, c) => `Нанести ${g.dmgText((u ? 7 : 5) + ((c && c.grow) || 0))} урона. В этом бою урон растёт на ${u ? 4 : 3}.`,
      play: async (g, u, c) => { await g.attack((u ? 7 : 5) + (c.grow || 0)); c.grow = (c.grow || 0) + (u ? 4 : 3); },
    },
    flurry: {
      name: 'Вьюга', cost: 1, type: 'atk', rarity: 'common', art: 'flurry',
      desc: (g, u) => `Серия: ${g.dmgText(3 + (u ? 4 : 3) * g.played)} урона, +${u ? 4 : 3} за каждую карту до неё в этот ход.`,
      play: async (g, u) => g.attack(3 + (u ? 4 : 3) * g.played),
    },

    // ---------- обычные: новые механики ----------
    stamp: {
      name: 'Штемпель', cost: 1, type: 'atk', rarity: 'common', art: 'stamp',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 8 : 6)} урона. Враг Уязвим ${u ? 2 : 1}.`,
      play: async (g, u) => { await g.attack(u ? 8 : 6); g.vuln(u ? 2 : 1); },
    },
    redseal: {
      name: 'Красная печать', cost: 1, type: 'skill', rarity: 'common', art: 'redseal',
      desc: (g, u) => `Враг Уязвим ${u ? 3 : 2}. Взять 1 карту.`,
      play: async (g, u) => { g.vuln(u ? 3 : 2); g.draw(1); },
    },
    whistle: {
      name: 'Свисток', cost: 0, type: 'skill', rarity: 'common', art: 'whistle', exhaust: true,
      desc: (g, u) => `+${u ? 2 : 1} Решимость до конца боя.`,
      play: async (g, u) => g.resolve(u ? 2 : 1),
    },
    cocoa: {
      name: 'Какао с перцем', cost: 0, type: 'skill', rarity: 'common', art: 'cocoa',
      desc: (g, u) => `+${u ? 3 : 2} Решимость до конца хода.`,
      play: async (g, u) => g.rush(u ? 3 : 2),
    },
    prickly: {
      name: 'Колючий шарф', cost: 1, type: 'skill', rarity: 'common', art: 'prickly',
      desc: (g, u) => `Получить ${u ? 6 : 4} защиты. Шипы ${u ? 3 : 2}.`,
      play: async (g, u) => { g.block(u ? 6 : 4); g.thorns(u ? 3 : 2); },
    },
    frostlace: {
      name: 'Морозный узор', cost: 1, type: 'skill', rarity: 'common', art: 'frostlace',
      desc: (g, u) => `Враг теряет ${u ? 3 : 2} Силы. Получить ${u ? 6 : 4} защиты.`,
      play: async (g, u) => { g.chill(u ? 3 : 2); g.block(u ? 6 : 4); },
    },
    parcel: {
      name: 'Посылка', cost: 1, type: 'skill', rarity: 'common', art: 'parcel',
      desc: (g, u) => `Доставка: +2 энергии${u ? ' и 1 карта' : ''}.`,
      play: async (g, u) => g.deliver('Посылка', async (d) => { d.energy(2); if (u) d.draw(1); }),
    },
    telegram: {
      name: 'Телеграмма', cost: 0, type: 'skill', rarity: 'common', art: 'telegram',
      desc: (g, u) => `Доставка: взять ${u ? 3 : 2} карты.`,
      play: async (g, u) => g.deliver('Телеграмма', async (d) => d.draw(u ? 3 : 2)),
    },
    surprise: {
      name: 'Бандероль с сюрпризом', cost: 1, type: 'atk', rarity: 'common', art: 'surprise',
      desc: (g, u) => `Доставка: нанести ${g.dmgText(u ? 20 : 14)} урона.`,
      play: async (g, u) => g.deliver('Бандероль', async (d) => d.attack(u ? 20 : 14)),
    },
    umbrella: {
      name: 'Зонтик', cost: 1, type: 'skill', rarity: 'common', art: 'umbrella', retain: true,
      desc: (g, u) => `Получить ${u ? 10 : 7} защиты.`,
      play: async (g, u) => g.block(u ? 10 : 7),
    },
    blotter: {
      name: 'Промокашка', cost: 0, type: 'skill', rarity: 'common', art: 'blotter',
      desc: (g, u) => `Взять ${u ? 2 : 1} карт${u ? 'ы' : 'у'}. Сжечь помехи в руке, за каждую ещё 1 карта.`,
      play: async (g, u) => { const n = g.exhaustHand((c) => c.type === 'status'); g.draw((u ? 2 : 1) + n); },
    },
    mittens: {
      name: 'Варежки', cost: 1, type: 'charm', rarity: 'common', art: 'mittens',
      desc: (g, u) => `В начале каждого хода ${u ? 5 : 3} защиты.`,
      play: async (g, u) => g.charm('mittens', u ? 5 : 3),
    },
    inkpen: {
      name: 'Перо и чернила', cost: 1, type: 'charm', rarity: 'common', art: 'inkpen',
      desc: (g, u) => `Каждый ваш Навык наносит врагу ${u ? 3 : 2} урона.`,
      play: async (g, u) => g.charm('inkpen', u ? 3 : 2),
    },

    // ---------- редкие ----------
    palm: {
      name: 'Жар-ладонь', cost: 1, type: 'atk', rarity: 'rare', art: 'palm',
      desc: (g, u) => `Потратить все Огоньки. ${u ? 9 : 7} урона за каждый${g.state ? ` (${(u ? 9 : 7) * g.state.flame})` : ''}.`,
      play: async (g, u) => { const n = g.consumeFlame(); if (n > 0) await g.attack((u ? 9 : 7) * n); },
    },
    shadow: {
      name: 'Тень-хитрость', cost: 1, type: 'skill', rarity: 'rare', art: 'shadow',
      desc: (g, u) => `Враг Ослаблен на ${u ? 3 : 2} хода. Взять ${u ? 2 : 1} карт${u ? 'ы' : 'у'}.`,
      play: async (g, u) => { g.weak(u ? 3 : 2); g.draw(u ? 2 : 1); },
    },
    blaze: {
      name: 'Пожар', cost: 2, type: 'skill', rarity: 'rare', art: 'blaze',
      desc: (g, u) => `Поджог ${u ? 11 : 8}. +1 Огонёк.`,
      play: async (g, u) => { g.burn(u ? 11 : 8); await g.flame(1); },
    },
    breath: {
      name: 'Глубокий вдох', cost: 0, type: 'skill', rarity: 'rare', art: 'breath', exhaust: true,
      desc: (g, u) => `+2 энергии${u ? '. Взять 1 карту' : ''}.`,
      play: async (g, u) => { g.energy(2); if (u) g.draw(1); },
    },
    lullaby: {
      name: 'Колыбельная', cost: 2, upCost: 1, type: 'skill', rarity: 'rare', art: 'lullaby', exhaust: true,
      desc: () => 'Враг засыпает и пропускает свой следующий ход.',
      play: async (g) => g.stun(),
    },
    lastword: {
      name: 'Последнее слово', cost: 1, type: 'atk', rarity: 'rare', art: 'lastword', exhaust: true,
      desc: (g, u) => `Нанести ${g.dmgText(u ? 14 : 10)} урона. Если враг повержен: +${u ? 4 : 3} к макс. HP.`,
      play: async (g, u) => { await g.attack(u ? 14 : 10); if (g.enemyDead) g.maxHp(u ? 4 : 3); },
    },
    secret: {
      name: 'Тайное письмо', cost: 1, type: 'atk', rarity: 'rare', art: 'secret', retain: true,
      desc: (g, u, c) => `Нанести ${g.dmgText((u ? 11 : 8) + ((c && c.grow) || 0))} урона. Каждый ход в руке: +${u ? 5 : 4} урона.`,
      play: async (g, u, c) => g.attack((u ? 11 : 8) + (c.grow || 0)),
      onRetain: (c, u) => { c.grow = (c.grow || 0) + (u ? 5 : 4); },
    },
    finale: {
      name: 'Финальный аккорд', cost: 2, type: 'atk', rarity: 'rare', art: 'finale',
      desc: (g, u) => `${g.dmgText(u ? 5 : 4)} урона за каждую карту этого хода, считая эту${g.state ? ` (×${g.played + 1})` : ''}.`,
      play: async (g, u) => g.attack(u ? 5 : 4, g.played + 1),
    },
    flashpoint: {
      name: 'Подкрутить фитиль', cost: 0, type: 'skill', rarity: 'rare', art: 'flashpoint', exhaust: true,
      desc: (g, u) => `Вспышка лампы, Огоньки не тратятся.${u ? ' +1 Огонёк.' : ''}`,
      play: async (g, u) => { await g.burstNow(); if (u) await g.flame(1); },
    },
    drift: {
      name: 'Сугроб', cost: 1, upCost: 0, type: 'skill', rarity: 'rare', art: 'drift',
      desc: (g) => `Удвоить защиту${g.state ? ` (${g.blockNow} → ${g.blockNow * 2})` : ''}.`,
      play: async (g) => g.doubleBlock(),
    },
    pockethog: {
      name: 'Ёжик в кармане', cost: 1, type: 'skill', rarity: 'rare', art: 'pockethog', exhaust: true,
      desc: (g, u) => `Шипы ${u ? 7 : 5} до конца боя.`,
      play: async (g, u) => g.thorns(u ? 7 : 5),
    },
    drafts: {
      name: 'Сжечь черновики', cost: 1, upCost: 0, type: 'skill', rarity: 'rare', art: 'drafts',
      desc: () => 'Сжечь остальные карты в руке. +1 Огонёк за каждую.',
      play: async (g) => { const n = g.exhaustHand(() => true); if (n) await g.flame(n); },
    },
    eveninglamp: {
      name: 'Вечерняя лампа', cost: 2, upCost: 1, type: 'charm', rarity: 'rare', art: 'eveninglamp',
      desc: () => 'В начале каждого хода +1 Огонёк.',
      play: async (g) => g.charm('eveninglamp', 1),
    },
    stubborn: {
      name: 'Упрямство', cost: 2, upCost: 1, type: 'charm', rarity: 'rare', art: 'stubborn',
      desc: () => 'В начале каждого хода +1 Решимость.',
      play: async (g) => g.charm('stubborn', 1),
    },
    compass: {
      name: 'Компас', cost: 1, upCost: 0, type: 'charm', rarity: 'rare', art: 'compass',
      desc: () => 'Каждый ход брать на 1 карту больше.',
      play: async (g) => g.charm('compass', 1),
    },
    hearth: {
      name: 'Сердце костра', cost: 1, type: 'charm', rarity: 'rare', art: 'hearth',
      desc: (g, u) => `В начале каждого хода Поджог ${u ? 4 : 3}.`,
      play: async (g, u) => g.charm('hearth', u ? 4 : 3),
    },
    rhythm: {
      name: 'Ритм шагов', cost: 1, upCost: 0, type: 'charm', rarity: 'rare', art: 'rhythm',
      desc: () => 'Каждая третья карта за ход: +1 Огонёк.',
      play: async (g) => g.charm('rhythm', 1),
    },

    // ---------- карты героев: выпадают только своему герою ----------
    // Ива, фонарщица: Огоньки и Вспышки
    firefly: {
      name: 'Светлячок', cost: 0, type: 'skill', rarity: 'common', art: 'firefly', cls: 'lamp', exhaust: true,
      desc: (g, u) => `+1 Огонёк.${u ? ' Взять 1 карту.' : ''}`,
      play: async (g, u) => { await g.flame(1); if (u) g.draw(1); },
    },
    lampglass: {
      name: 'Ламповое стекло', cost: 1, type: 'skill', rarity: 'common', art: 'lampglass', cls: 'lamp',
      desc: (g, u) => `Получить ${u ? 5 : 3} защиты и ещё ${u ? 3 : 2} за каждый Огонёк${g.state ? ` (${(u ? 5 : 3) + (u ? 3 : 2) * g.state.flame})` : ''}.`,
      play: async (g, u) => g.block((u ? 5 : 3) + (u ? 3 : 2) * g.state.flame),
    },
    beam: {
      name: 'Ослепительный луч', cost: 2, type: 'atk', rarity: 'rare', art: 'beam', cls: 'lamp',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 14 : 10)} урона. Вспышка лампы, Огоньки не тратятся.`,
      play: async (g, u) => { await g.attack(u ? 14 : 10); if (!g.enemyDead) await g.burstNow(); },
    },
    // Тиша, скороход: Доставка, Серия и длинные ходы
    urgent: {
      name: 'Срочно!', cost: 0, type: 'atk', rarity: 'common', art: 'urgent', cls: 'courier',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 5 : 3)} урона. Взять 1 карту.`,
      play: async (g, u) => { await g.attack(u ? 5 : 3); g.draw(1); },
    },
    express: {
      name: 'Экспресс', cost: 1, type: 'skill', rarity: 'common', art: 'express', cls: 'courier',
      desc: (g, u) => `Получить ${u ? 7 : 4} защиты. Доставка: +1 энергия и 2 карты.`,
      play: async (g, u) => { g.block(u ? 7 : 4); g.deliver('Экспресс', async (d) => { d.energy(1); d.draw(2); }); },
    },
    rushmail: {
      name: 'Срочная почта', cost: 1, type: 'skill', rarity: 'rare', art: 'rushmail', cls: 'courier',
      desc: (g, u) => `Серия: +1 энергия за каждые 2 карты до этой в этот ход${g.state ? ` (+${Math.floor(g.played / 2)})` : ''}. Взять ${u ? 3 : 2} карты.`,
      play: async (g, u) => { const n = Math.floor(g.played / 2); if (n) g.energy(n); g.draw(u ? 3 : 2); },
    },
    // Марфа, сторожиха моста: защита, Шипы и мороз
    icewall: {
      name: 'Ледяная стена', cost: 2, type: 'skill', rarity: 'common', art: 'icewall', cls: 'guard',
      desc: (g, u) => `Получить ${u ? 17 : 13} защиты. Враг теряет ${u ? 2 : 1} Силы.`,
      play: async (g, u) => { g.block(u ? 17 : 13); g.chill(u ? 2 : 1); },
    },
    hedge: {
      name: 'Колючая изгородь', cost: 1, type: 'skill', rarity: 'common', art: 'hedge', cls: 'guard',
      desc: (g, u) => `Шипы ${u ? 3 : 2}. Получить защиту, равную двойным Шипам${g.state ? ` (${(g.state.thorns + (u ? 3 : 2)) * 2})` : ''}.`,
      play: async (g, u) => { g.thorns(u ? 3 : 2); g.block(g.state.thorns * 2); },
    },
    standfast: {
      name: 'Стоять до утра', cost: 2, upCost: 1, type: 'charm', rarity: 'rare', art: 'standfast', cls: 'guard',
      desc: () => 'Защита больше не сгорает в начале хода.',
      play: async (g) => g.charm('standfast', 1),
    },
    // Фома, трубочист: Поджог
    flue: {
      name: 'Дымоход', cost: 1, type: 'skill', rarity: 'common', art: 'flue', cls: 'stoker',
      desc: (g, u) => `Поджог ${u ? 5 : 3}. Получить защиту, равную Поджогу врага.`,
      play: async (g, u) => { g.burn(u ? 5 : 3); g.block(g.state.enemy.burn); },
    },
    poker: {
      name: 'Кочерга', cost: 1, type: 'atk', rarity: 'common', art: 'poker', cls: 'stoker',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 8 : 6)} урона. По горящему врагу дважды.`,
      play: async (g, u) => g.attack(u ? 8 : 6, g.state.enemy.burn > 0 ? 2 : 1),
    },
    fan: {
      name: 'Раздуть угли', cost: 1, upCost: 0, type: 'skill', rarity: 'rare', art: 'fan', cls: 'stoker', exhaust: true,
      desc: (g) => `Удвоить Поджог врага${g.state ? ` (${g.state.enemy.burn} → ${g.state.enemy.burn * 2})` : ''}.`,
      play: async (g) => { if (g.state.enemy.burn > 0) g.burn(g.state.enemy.burn); },
    },

    // ---------- помехи: враги подкидывают их в колоду на время боя ----------
    blot: {
      name: 'Клякса', cost: 1, type: 'status', rarity: 'status', art: 'blot', exhaust: true,
      desc: () => 'Ничего не делает.',
      play: async () => {},
    },
    icy: {
      name: 'Ледышка', cost: null, type: 'status', rarity: 'status', art: 'icy', ethereal: true,
      desc: () => 'Нельзя разыграть. Тает в конце хода.',
    },
    sealwax: {
      name: 'Сургуч', cost: null, type: 'status', rarity: 'status', art: 'sealwax',
      desc: () => 'Нельзя разыграть. Запечатывает место в руке.',
    },
    dread: {
      name: 'Недоставленное письмо', cost: null, type: 'status', rarity: 'status', art: 'dread',
      desc: () => 'Нельзя разыграть. В конце хода в руке: −2 HP.',
    },
  };

  /* Враги: шаблон намерений повторяется по кругу.
     intent: {k:'attack', v, hits} | {k:'block', v} | {k:'buff', v} (сила)
             {k:'debuff', v} (Слабость игроку) | {k:'snuff', v} (гасит Огоньки + атака)
             {k:'curse', card, n} (подкинуть помехи в колоду) | {k:'steal', v, gold} (атака + кража монет)
             {k:'heal', v} | {k:'spikes', v} (враг получает Шипы)
     thorns: N — враг колючий с начала боя: каждый удар по нему ранит Иву на N */
  const ENEMIES = {
    inkcat: {
      name: 'Чернильный кот', hp: 20, tier: 'normal',
      line: 'Мурлычет кляксами и ворует письма.',
      pattern: [{ k: 'attack', v: 6 }, { k: 'curse', card: 'blot', n: 1, then: { k: 'attack', v: 4 } }, { k: 'attack', v: 3, hits: 2 }],
    },
    laundress: {
      name: 'Туманная прачка', hp: 26, tier: 'normal',
      line: 'Полощет в тумане чужие сны.',
      pattern: [{ k: 'debuff', v: 2 }, { k: 'attack', v: 8 }, { k: 'block', v: 7, then: { k: 'heal', v: 6 } }, { k: 'attack', v: 5 }],
    },
    golem: {
      name: 'Восковой голем', hp: 34, tier: 'normal',
      line: 'Слеплен из огарков погасших свечей.',
      pattern: [{ k: 'block', v: 10 }, { k: 'attack', v: 11 }, { k: 'curse', card: 'sealwax', n: 1, then: { k: 'attack', v: 5 } }],
    },
    // ---- город (стадия I) ----
    snowimp: {
      name: 'Снежок-Хулиган', hp: 16, tier: 'normal',
      line: 'Кидается снежками в каждого прохожего.',
      pattern: [{ k: 'attack', v: 3, hits: 2 }, { k: 'attack', v: 5 }, { k: 'block', v: 4, then: { k: 'attack', v: 3 } }],
    },
    icicle: {
      name: 'Сосулька-Ворчунья', hp: 22, tier: 'normal',
      line: 'Висит над дверью и ворчит на всех, кто под ней проходит.',
      pattern: [{ k: 'attack', v: 9 }, { k: 'curse', card: 'icy', n: 2 }, { k: 'attack', v: 4, then: { k: 'debuff', v: 1 } }],
    },
    pigeon: {
      name: 'Голубь-Сплетник', hp: 18, tier: 'normal',
      line: 'Знает, что написано в каждом письме. И всем рассказывает.',
      pattern: [{ k: 'debuff', v: 1, then: { k: 'attack', v: 3 } }, { k: 'attack', v: 2, hits: 3 }, { k: 'block', v: 5 }],
    },
    scarfsnake: {
      name: 'Шарфовый Змей', hp: 24, tier: 'normal',
      line: 'Сбежал с бельевой верёвки и душит не хуже удава.',
      pattern: [{ k: 'attack', v: 4, then: { k: 'debuff', v: 1 } }, { k: 'attack', v: 7 }, { k: 'block', v: 8 }],
    },
    sootmouse: {
      name: 'Печная Мышь', hp: 14, tier: 'normal',
      line: 'Живёт в трубе и таскает спички.',
      pattern: [{ k: 'attack', v: 2, hits: 3 }, { k: 'steal', v: 5, gold: 6 }, { k: 'buff', v: 1 }],
    },
    mailbox: {
      name: 'Ящик-Кусака', hp: 30, tier: 'normal',
      line: 'Почтовый ящик, который больше не хочет отдавать письма.',
      pattern: [{ k: 'block', v: 10 }, { k: 'attack', v: 12 }, { k: 'curse', card: 'dread', n: 1, then: { k: 'attack', v: 4, hits: 2 } }],
    },
    // ---- окраина (стадия II) ----
    shadowthief: {
      name: 'Тень-Воришка', hp: 20, tier: 'normal',
      line: 'Крадёт свет из фонарей и прячет в мешок.',
      pattern: [{ k: 'snuff', v: 5 }, { k: 'steal', v: 7, gold: 10 }, { k: 'block', v: 6, then: { k: 'attack', v: 4 } }],
    },
    bat: {
      name: 'Сумеречная Мышь', hp: 18, tier: 'normal',
      line: 'Просыпается, как только солнце коснётся крыш.',
      pattern: [{ k: 'attack', v: 3, hits: 3 }, { k: 'debuff', v: 1 }, { k: 'attack', v: 6 }],
    },
    stump: {
      name: 'Пень-Шатун', hp: 36, tier: 'normal', thorns: 2,
      line: 'Днём притворяется пнём. В сумерках выходит на дорогу.',
      pattern: [{ k: 'block', v: 12 }, { k: 'attack', v: 10 }, { k: 'buff', v: 2 }],
    },
    frostfox: {
      name: 'Морозная Лиса', hp: 24, tier: 'normal',
      line: 'Заметает следы и путает дорогу.',
      pattern: [{ k: 'attack', v: 5, hits: 2 }, { k: 'curse', card: 'icy', n: 2, then: { k: 'debuff', v: 1 } }, { k: 'attack', v: 9 }],
    },
    wisp: {
      name: 'Голубой Морок', hp: 16, tier: 'normal',
      line: 'Холодный огонь, который заманивает с дороги.',
      pattern: [{ k: 'snuff', v: 4 }, { k: 'buff', v: 2, then: { k: 'block', v: 6 } }, { k: 'attack', v: 8 }],
    },
    raven: {
      name: 'Ворон-Счетовод', hp: 26, tier: 'normal',
      line: 'Подсчитывает, сколько минут осталось до темноты.',
      pattern: [{ k: 'debuff', v: 2 }, { k: 'attack', v: 4, hits: 2 }, { k: 'curse', card: 'blot', n: 2, then: { k: 'block', v: 8 } }, { k: 'attack', v: 10 }],
    },
    // ---- элита ----
    snowbrute: {
      name: 'Снеговик-Громила', hp: 50, tier: 'elite',
      line: 'Его слепили дети, а он вырос и обиделся.',
      pattern: [{ k: 'attack', v: 12 }, { k: 'block', v: 10, then: { k: 'buff', v: 2 } }, { k: 'attack', v: 4, hits: 3 }],
    },
    icebear: {
      name: 'Ледяной Медведь', hp: 58, tier: 'elite',
      line: 'Спал в сугробе, пока его не разбудили Тени.',
      pattern: [{ k: 'attack', v: 14 }, { k: 'block', v: 14, then: { k: 'spikes', v: 3 } }, { k: 'attack', v: 6, hits: 2 }, { k: 'buff', v: 3 }],
    },
    lampghost: {
      name: 'Фонарный Призрак', hp: 46, tier: 'elite',
      line: 'Старый фонарь, который так и не зажгли.',
      pattern: [{ k: 'snuff', v: 8 }, { k: 'attack', v: 5, hits: 3 }, { k: 'debuff', v: 2, then: { k: 'block', v: 8 } }],
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
    magpie: {
      name: 'Сорока-Перехватчица', hp: 75, tier: 'boss',
      line: 'Ворует письма, блестяшки и чужие секреты.',
      pattern: [{ k: 'steal', v: 9, gold: 15 }, { k: 'debuff', v: 2, then: { k: 'attack', v: 5 } }, { k: 'attack', v: 3, hits: 4 }, { k: 'block', v: 12, then: { k: 'buff', v: 2 } }],
    },
    clockmaker: {
      name: 'Сумеречный Часовщик', hp: 140, tier: 'boss',
      line: 'Подводит часы, чтобы ночь наступила раньше.',
      pattern: [{ k: 'attack', v: 14 }, { k: 'block', v: 16 }, { k: 'snuff', v: 9 }, { k: 'attack', v: 4, hits: 4 }, { k: 'buff', v: 3, then: { k: 'block', v: 8 } }],
    },
    waxgiant: {
      name: 'Сургучный Великан', hp: 90, tier: 'boss',
      line: 'Слеплен из сургуча с тысячи писем и запечатывает всех навсегда.',
      pattern: [{ k: 'block', v: 14 }, { k: 'attack', v: 11 }, { k: 'curse', card: 'sealwax', n: 2, then: { k: 'attack', v: 6 } }, { k: 'buff', v: 2, then: { k: 'attack', v: 5 } }],
    },
    vane: {
      name: 'Флюгер-Петух', hp: 68, tier: 'boss',
      line: 'Крутится на крыше ратуши и сдувает почтальонов с пути.',
      pattern: [{ k: 'attack', v: 3, hits: 3 }, { k: 'debuff', v: 2 }, { k: 'attack', v: 4, hits: 3 }, { k: 'block', v: 8, then: { k: 'attack', v: 6 } }],
    },
    wolf: {
      name: 'Сумеречный Волк', hp: 130, tier: 'boss',
      line: 'В его шерсти застряли первые звёзды.',
      pattern: [{ k: 'attack', v: 7, hits: 2 }, { k: 'buff', v: 2 }, { k: 'attack', v: 18 }, { k: 'snuff', v: 8 }],
    },
    troll: {
      name: 'Мостовой Тролль', hp: 160, tier: 'boss',
      line: 'Берёт плату за мост. Больше всего любит чужие письма.',
      pattern: [{ k: 'block', v: 18 }, { k: 'steal', v: 16, gold: 20 }, { k: 'debuff', v: 2, then: { k: 'attack', v: 8 } }, { k: 'block', v: 12, then: { k: 'buff', v: 3 } }],
    },
    hollowpost: {
      name: 'Пустой Почтальон', hp: 175, tier: 'boss',
      line: 'Пальто почтальона, который так и не дошёл до адресата.',
      pattern: [{ k: 'curse', card: 'dread', n: 2, then: { k: 'attack', v: 8 } }, { k: 'attack', v: 5, hits: 4 }, { k: 'snuff', v: 12 }, { k: 'debuff', v: 2, then: { k: 'block', v: 16 } }, { k: 'buff', v: 3, then: { k: 'attack', v: 10 } }],
    },
    skywhale: {
      name: 'Ночной Кит', hp: 220, tier: 'boss',
      line: 'Плывёт по ночному небу и глотает звёзды.',
      pattern: [{ k: 'block', v: 20 }, { k: 'attack', v: 22 }, { k: 'attack', v: 6, hits: 3 }, { k: 'buff', v: 4, then: { k: 'heal', v: 15 } }],
    },
    shadowking: {
      name: 'Король Теней', hp: 190, tier: 'boss',
      line: 'Правит всем, что не успело до заката.',
      pattern: [{ k: 'attack', v: 16 }, { k: 'snuff', v: 10 }, { k: 'attack', v: 6, hits: 3 }, { k: 'curse', card: 'dread', n: 2, then: { k: 'block', v: 18 } }, { k: 'buff', v: 3, then: { k: 'attack', v: 8 } }],
    },
  };

  /* Талисманы. tier: common | rare | boss | class.
     class — особенность героя: есть у него с начала забега и больше нигде не выпадает.
     Обычные и редкие дают элиты, сундуки, события и лавка; талисманы босса выбираются
     один из трёх после победы над боссом стадии: они сильные, но у многих есть цена. */
  const RELICS = {
    bell: { tier: 'common', name: 'Медный колокольчик', art: 'bell', desc: 'В начале боя получить 6 защиты.' },
    feather: { tier: 'common', name: 'Совиное перо', art: 'feather', desc: 'Начинать бой с 1 Огоньком.' },
    jar: { tier: 'common', name: 'Банка светлячков', art: 'jar', desc: '+8 к максимуму HP.' },
    flint: { tier: 'common', name: 'Огниво', art: 'flint', desc: 'Вспышка лампы наносит +5 урона.' },
    snowman: { tier: 'common', name: 'Снеговик-талисман', art: 'snowman', desc: 'После победы восстановить 4 HP.' },
    scarf: { tier: 'common', name: 'Шарф с кисточками', art: 'cloak', desc: 'В первый ход боя +1 энергия.' },
    envelope: { tier: 'common', name: 'Конверт с маркой', art: 'envelope', desc: '+8 монет за каждую победу.' },
    thimble: { tier: 'common', name: 'Напёрсток', art: 'thimble', desc: 'В начале каждого хода 2 защиты.' },
    magnifier: { tier: 'common', name: 'Лупа', art: 'magnifier', desc: 'Первая атака в бою делает врага Уязвимым на 2 хода.' },
    kettle: { tier: 'common', name: 'Походный чайник', art: 'kettle', desc: 'Отдых у костра лечит на 10 HP больше.' },
    whetstone: { tier: 'common', name: 'Точильный камень', art: 'whetstone', desc: 'Сразу улучшает 2 случайные карты колоды.' },
    inkwell: { tier: 'common', name: 'Чернильница', art: 'inkwell', desc: 'В начале боя враг Ослаблен на 2 хода.' },
    pinecone: { tier: 'common', name: 'Еловая шишка', art: 'pinecone', desc: 'В начале боя Шипы 3.' },
    coupon: { tier: 'common', name: 'Купон Игольника', art: 'coupon', desc: 'В лавке всё на 25% дешевле.' },
    stub: { tier: 'common', name: 'Огарок', art: 'stub', desc: 'Каждая Вспышка лампы лечит 2 HP.' },
    sled: { tier: 'common', name: 'Санки', art: 'sled', desc: 'В первый ход боя взять 2 лишние карты.' },
    piggy: { tier: 'common', name: 'Копилка', art: 'piggy', desc: 'Победа без потери HP: +15 монет.' },
    frostglass: { tier: 'common', name: 'Морозное стекло', art: 'frostglass', desc: 'Враги начинают бой с −2 Силы.' },
    matchbox: { tier: 'common', name: 'Коробок спичек', art: 'matchbox', desc: 'Каждый ваш Поджог на 2 сильнее.' },
    stampbook: { tier: 'rare', name: 'Альбом марок', art: 'stampbook', desc: 'Каждая шестая карта, сыгранная в бою, даёт +1 энергию.' },
    hotstone: { tier: 'rare', name: 'Горячий камень', art: 'hotstone', desc: 'В начале хода до 6 защиты не сгорает.' },
    clover: { tier: 'rare', name: 'Сушёный клевер', art: 'clover', desc: 'После боя на выбор на одну карту больше.' },
    horseshoe: { tier: 'rare', name: 'Подкова', art: 'horseshoe', desc: 'Первый пропущенный удар в каждом бою ранит только на 1.' },
    brazier: { tier: 'rare', name: 'Жаровня', art: 'brazier', desc: 'Когда карта сгорает, получить 3 защиты.' },
    musicbox: { tier: 'rare', name: 'Музыкальная шкатулка', art: 'musicbox', desc: 'Каждый третий ход +2 энергии.' },
    ribbon: { tier: 'rare', name: 'Лента для писем', art: 'ribbon', desc: 'В конце хода самая дорогая карта остаётся в руке.' },
    horn: { tier: 'rare', name: 'Почтовый рожок', art: 'horn', desc: 'Каждая Доставка срабатывает дважды.' },
    // особенности героев
    ivalamp: { tier: 'class', name: 'Фонарь Ивы', art: 'lantern', desc: 'После каждой Вспышки в лампе остаётся 1 Огонёк.' },
    wingboots: { tier: 'class', name: 'Крылатые ботинки', art: 'wingboots', desc: 'Каждая четвёртая карта за ход: +1 энергия и 1 карта.' },
    ironshutter: { tier: 'class', name: 'Окованный ставень', art: 'ironshutter', desc: 'Когда защита целиком принимает удар врага, он получает 4 урона.' },
    sootbroom: { tier: 'class', name: 'Закопчённая метла', art: 'sootbroom', desc: 'Каждый удар ваших атак добавляет врагу Поджог 1.' },
    // талисманы босса
    hourglass: { tier: 'boss', name: 'Песочные часы', art: 'hourglass', desc: '+1 энергия каждый ход. В руку на 1 карту меньше.' },
    bottomless: { tier: 'boss', name: 'Бездонная сумка', art: 'bottomless', desc: '+1 энергия каждый ход. Костёр больше не лечит.' },
    crown: { tier: 'boss', name: 'Сорочья корона', art: 'crown', desc: '+1 энергия каждый ход. После боя на выбор на одну карту меньше.' },
    bellows: { tier: 'boss', name: 'Кузнечные мехи', art: 'bellows', desc: 'Лампа вспыхивает уже на 2 Огоньках, но Огоньки не усиливают атаки.' },
    moonstone: { tier: 'boss', name: 'Лунный камень', art: 'moonstone', desc: 'Каждый ход брать на 2 карты больше. −8 к максимуму HP.' },
    goldquill: { tier: 'boss', name: 'Золотое перо', art: 'goldquill', desc: 'Сразу улучшает все карты в колоде.' },
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
    {
      id: 'smith', title: 'Кузнец-Снегирь', art: 'whetstone',
      text: 'У горна греется снегирь в кожаном фартуке. «Наточу что угодно, хоть письмо!»',
      options: [
        { text: 'Наточить карту', hint: 'Улучшить карту на выбор', act: (r, a) => { a.upgradePrompt(); return null; } },
        { text: 'Помочь у горна', hint: '−6 HP, улучшить 2 случайные', act: (r, a) => { a.damage(6); const n = a.upgradeRandom(2); return n ? 'Руки в саже, зато две карты стали острее.' : 'Точить оказалось нечего.'; } },
        { text: 'Пройти мимо', hint: 'Ничего', act: () => 'Снегирь пожал плечами и снова раздул мехи.' },
      ],
    },
    {
      id: 'postoffice', title: 'Почтовое отделение', art: 'stampbook',
      text: 'Ночная смена: за окошком дремлет старая сова, а на полке лежат бесхозные посылки.',
      options: [
        { text: 'Обменять карту', hint: 'Отдать карту, получить редкую', act: (r, a) => { a.transformPrompt(); return null; } },
        { text: 'Забрать бесхозную посылку', hint: 'Карта с Доставкой', act: (r, a) => { const id = ['parcel', 'telegram', 'surprise'][Math.floor(Math.random() * 3)]; a.giveCard(id); return 'На посылке было твоё имя. Странно, но приятно.'; } },
        { text: 'Купить марки', hint: '−35 монет, талисман', can: (r) => r.gold >= 35, act: (r, a) => { r.gold -= 35; a.giveRelic(); return 'Сова продала тебе марку. Она оказалась непростой.'; } },
      ],
    },
    {
      id: 'icemirror', title: 'Ледяное зеркало', art: 'frostglass',
      text: 'В замёрзшей луже отражается не путник, а его колода карт. Отражение протягивает руку.',
      options: [
        { text: 'Коснуться отражения', hint: '−7 HP, копия карты', act: (r, a) => { a.damage(7); a.duplicatePrompt(); return null; } },
        { text: 'Разбить лёд', hint: '+20 монет', act: (r) => { r.gold += 20; return 'Лёд треснул, и из него посыпались монетки.'; } },
        { text: 'Уйти', hint: 'Ничего', act: () => 'Отражение помахало вслед.' },
      ],
    },
  ];

  /* Герои. Каждый начинает со своей колодой и особенностью (талисман tier: 'class').
     favored — общие карты под его билд: в наградах и лавке они выпадают чаще.
     f — героиня (для окончаний в тексте), who/whom — как назвать героя в сюжете. */
  const CLASSES = {
    lamp: {
      name: 'Ива', role: 'Фонарщица', f: true, who: 'фонарщица Ива', whom: 'фонарщице Иве', look: 'lamp',
      hp: 36, gold: 20, relic: 'ivalamp', build: 'Огоньки и Вспышки',
      about: 'Копит Огоньки и чаще всех зажигает Вспышки лампы.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'kindle', 'spark', 'firefly'],
      favored: ['kindle', 'spark', 'oil', 'mirror', 'palm', 'flashpoint', 'drafts', 'eveninglamp', 'rhythm', 'sparks'],
    },
    courier: {
      name: 'Тиша', role: 'Скороход', f: false, who: 'скороход Тиша', whom: 'скороходу Тише', look: 'courier',
      hp: 32, gold: 35, relic: 'wingboots', build: 'Доставка и длинные ходы',
      about: 'Играет много дешёвых карт за ход и шлёт Доставки на следующий.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'urgent', 'telegram', 'wind'],
      favored: ['wind', 'parcel', 'telegram', 'surprise', 'flurry', 'finale', 'breath', 'compass', 'inkpen', 'blotter', 'spark', 'cocoa'],
    },
    guard: {
      name: 'Марфа', role: 'Сторожиха моста', f: true, who: 'сторожиха моста Марфа', whom: 'сторожихе моста Марфе', look: 'guard',
      hp: 44, gold: 15, relic: 'ironshutter', build: 'Защита, Шипы и мороз',
      about: 'Держит удар за ударом и отвечает врагу его же силой.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'guard', 'snowkick'],
      favored: ['cloak', 'wax', 'snowkick', 'payback', 'prickly', 'frostlace', 'umbrella', 'mittens', 'drift', 'pockethog', 'lullaby'],
    },
    stoker: {
      name: 'Фома', role: 'Трубочист', f: false, who: 'трубочист Фома', whom: 'трубочисту Фоме', look: 'stoker',
      hp: 38, gold: 20, relic: 'sootbroom', build: 'Поджог и частые удары',
      about: 'Разжигает врага каждым ударом и даёт огню сделать остальное.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'ember', 'poker'],
      favored: ['ember', 'blaze', 'hearth', 'sparks', 'flurry', 'whistle', 'cocoa', 'stubborn', 'stamp', 'redseal'],
    },
  };

  window.Data = { CARDS, ENEMIES, RELICS, EVENTS, CLASSES };
})();
