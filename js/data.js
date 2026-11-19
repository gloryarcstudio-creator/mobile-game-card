/* Фитиль — данные: карты, враги, талисманы, события. */
(function () {
  /* Карта: {name, cost, upCost?, type, rarity, art, exhaust?, retain?, desc(g, u, c), play(g, u, c)}
     type: atk (атака) | skill (навык) | charm (чары: действуют до конца боя) | status (помеха от врагов)
     rarity: start | common | uncommon | rare | epic | legendary | status | token (Пряник: только создаётся в бою)
     price(u) — Цена: сколько HP стоит розыгрыш (знахарка)
       (обычная, необычная, редкая, эпическая, легендарная; легендарную можно взять в колоду только одну)
     cls — карта героя: выпадает в наградах и лавке только этому герою (см. CLASSES)
     u — карта улучшена у костра (цифры в описании и розыгрыше берутся через u ? улучшено : обычно)
     c — экземпляр карты в бою (для карт, которые растут, пока лежат в колоде)
     g — интерфейс боя из game.js: attack(n, hits), block(n), flame(n), draw(n), heal(n), burn(n),
         weak(n), vuln(n), energy(n), resolve(n), rush(n), thorns(n), chill(n), stun(), deliver(fn),
         gold(n), burstNow(), exhaustHand(pred), charm(id, n), doubleBlock(), maxHp(n), consumeFlame(),
         copyLast(), recall(n), autoplay(n), ginger(n), glaze(), sharpen(n), upCount(c), dog(n), bite(),
         played, blockNow, enemyDead, lastCard, state, dmgText(n) */
  const CARDS = {
    // ---------- стартовые ----------
    strike: {
      name: 'Удар фонарём', cost: 1, type: 'atk', rarity: 'start', art: 'strike',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 9 : 6)} урона.`,
      play: async (g, u) => g.attack(u ? 9 : 6),
    },
    guard: {
      name: 'Ставень', cost: 1, type: 'skill', rarity: 'start', art: 'guard',
      desc: (g, u) => `Получить ${g.blkText(u ? 8 : 5)} защиты.`,
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
      desc: (g, u) => `Получить ${g.blkText(u ? 11 : 8)} защиты.`,
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
      desc: (g, u) => `Получить ${g.blkText(u ? 8 : 5)} защиты. +1 Огонёк.`,
      play: async (g, u) => { g.block(u ? 8 : 5); await g.flame(1); },
    },
    heavy: {
      name: 'Размах', cost: 2, type: 'atk', rarity: 'common', art: 'heavy',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 18 : 13)} урона.`,
      play: async (g, u) => g.attack(u ? 18 : 13),
    },
    wax: {
      name: 'Капля воска', cost: 1, type: 'skill', rarity: 'common', art: 'wax',
      desc: (g, u) => `Получить ${g.blkText(u ? 8 : 6)} защиты. Враг Ослаблен на ${u ? 2 : 1} ход${u ? 'а' : ''}.`,
      play: async (g, u) => { g.block(u ? 8 : 6); g.weak(u ? 2 : 1); },
    },
    ember: {
      name: 'Уголёк', cost: 1, type: 'atk', rarity: 'common', art: 'ember',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 7 : 5)} урона. Поджог ${u ? 4 : 3}.`,
      play: async (g, u) => { await g.attack(u ? 7 : 5); g.burn(u ? 4 : 3); },
    },
    snowkick: {
      name: 'Пинок сугроба', cost: 1, type: 'atk', rarity: 'common', art: 'snowkick',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 7 : 5)} урона. Получить ${g.blkText(u ? 7 : 5)} защиты.`,
      play: async (g, u) => { await g.attack(u ? 7 : 5); g.block(u ? 7 : 5); },
    },
    payback: {
      name: 'Ответный удар', cost: 1, upCost: 0, type: 'atk', rarity: 'uncommon', art: 'payback',
      desc: (g) => `Нанести урон, равный вашей защите${g.state ? ` (${g.dmgText(g.blockNow)})` : ''}.`,
      play: async (g) => g.attack(g.blockNow),
    },
    luckycoin: {
      name: 'Счастливая монетка', cost: 0, type: 'atk', rarity: 'common', art: 'luckycoin', exhaust: true,
      desc: (g, u) => `Нанести ${g.dmgText(u ? 6 : 4)} урона. +${u ? 8 : 5} монет.`,
      play: async (g, u) => { await g.attack(u ? 6 : 4); g.gold(u ? 8 : 5); },
    },
    snowball: {
      name: 'Снежный ком', cost: 1, type: 'atk', rarity: 'uncommon', art: 'snowball',
      desc: (g, u, c) => `Нанести ${g.dmgText((u ? 7 : 5) + ((c && c.grow) || 0))} урона. В этом бою урон растёт на ${u ? 4 : 3}.`,
      play: async (g, u, c) => { await g.attack((u ? 7 : 5) + (c.grow || 0)); c.grow = (c.grow || 0) + (u ? 4 : 3); },
    },
    flurry: {
      name: 'Вьюга', cost: 1, type: 'atk', rarity: 'uncommon', art: 'flurry',
      desc: (g, u) => `Серия: ${g.dmgText(3 + (u ? 4 : 3) * g.played)} урона, +${u ? 4 : 3} за каждую карту до неё в этот ход.`,
      play: async (g, u) => g.attack(3 + (u ? 4 : 3) * g.played),
    },

    icethrow: {
      name: 'Сосулька', cost: 1, type: 'atk', rarity: 'common', art: 'icethrow',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 9 : 6)} урона. Враг теряет 1 Силы.`,
      play: async (g, u) => { await g.attack(u ? 9 : 6); if (!g.enemyDead) g.chill(1); },
    },
    heavybag: {
      name: 'Тяжёлая сумка', cost: 2, type: 'atk', rarity: 'common', art: 'heavybag',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 13 : 10)} урона. Получить ${g.blkText(u ? 8 : 6)} защиты.`,
      play: async (g, u) => { await g.attack(u ? 13 : 10); g.block(u ? 8 : 6); },
    },
    sbiten: {
      name: 'Глоток сбитня', cost: 0, type: 'skill', rarity: 'common', art: 'sbiten', exhaust: true,
      desc: (g, u) => `Восстановить ${u ? 5 : 3} HP. Взять 1 карту.`,
      play: async (g, u) => { g.heal(u ? 5 : 3); g.draw(1); },
    },
    sledram: {
      name: 'Санный разгон', cost: 1, type: 'atk', rarity: 'common', art: 'sledram',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 8 : 5)} урона. Доставка: +1 энергия.`,
      play: async (g, u) => { await g.attack(u ? 8 : 5); g.deliver('Сани', async (d) => d.energy(1)); },
    },
    hornblow: {
      name: 'Сигнал рожка', cost: 1, type: 'skill', rarity: 'common', art: 'hornblow',
      desc: (g, u) => `Получить ${g.blkText(u ? 7 : 5)} защиты. +${u ? 3 : 2} Решимость до конца хода.`,
      play: async (g, u) => { g.block(u ? 7 : 5); g.rush(u ? 3 : 2); },
    },
    patch: {
      name: 'Заплатка', cost: 1, type: 'skill', rarity: 'common', art: 'patch',
      desc: (g, u) => `Получить ${g.blkText(u ? 9 : 6)} защиты. Сжечь помехи в руке.`,
      play: async (g, u) => { g.block(u ? 9 : 6); g.exhaustHand((c) => c.type === 'status'); },
    },

    // ---------- необычные ----------
    snowstorm: {
      name: 'Снежная буря', cost: 2, type: 'atk', rarity: 'uncommon', art: 'snowstorm',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 3 : 2)} урона 5 раз. Враг Ослаблен на 1 ход.`,
      play: async (g, u) => { await g.attack(u ? 3 : 2, 5); if (!g.enemyDead) g.weak(1); },
    },
    icelantern: {
      name: 'Ледяной фонарь', cost: 1, type: 'skill', rarity: 'uncommon', art: 'icelantern',
      desc: (g, u) => `Враг Уязвим ${u ? 2 : 1}. Взять 1 карту. +1 Огонёк.`,
      play: async (g, u) => { g.vuln(u ? 2 : 1); g.draw(1); await g.flame(1); },
    },
    cancel: {
      name: 'Гашение марки', cost: 1, type: 'atk', rarity: 'uncommon', art: 'cancel',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 8 : 6)} урона. По Уязвимому врагу дважды.`,
      play: async (g, u) => g.attack(u ? 8 : 6, g.state.enemy.vuln > 0 ? 2 : 1),
    },
    carbon: {
      name: 'Копирка', cost: 1, upCost: 0, type: 'skill', rarity: 'uncommon', art: 'carbon',
      desc: (g) => `Повторить предыдущую карту этого хода${g.state ? ` (${g.lastCard || 'пока нечего'})` : ''}.`,
      play: async (g) => g.copyLast(),
    },
    nightshift: {
      name: 'Ночная смена', cost: 1, type: 'charm', rarity: 'uncommon', art: 'nightshift',
      desc: (g, u) => `В конце хода ${u ? 4 : 3} защиты за каждую неистраченную энергию.`,
      play: async (g, u) => g.charm('nightshift', u ? 4 : 3),
    },
    kindling: {
      name: 'Растопка', cost: 1, type: 'skill', rarity: 'uncommon', art: 'kindling',
      desc: (g, u) => `Поджог ${u ? 6 : 4}. Взять 1 карту.`,
      play: async (g, u) => { g.burn(u ? 6 : 4); g.draw(1); },
    },

    // ---------- обычные: новые механики ----------
    stamp: {
      name: 'Штемпель', cost: 1, type: 'atk', rarity: 'common', art: 'stamp',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 8 : 6)} урона. Враг Уязвим ${u ? 2 : 1}.`,
      play: async (g, u) => { await g.attack(u ? 8 : 6); g.vuln(u ? 2 : 1); },
    },
    redseal: {
      name: 'Красная печать', cost: 1, type: 'skill', rarity: 'uncommon', art: 'redseal',
      desc: (g, u) => `Враг Уязвим ${u ? 3 : 2}. Взять 1 карту.`,
      play: async (g, u) => { g.vuln(u ? 3 : 2); g.draw(1); },
    },
    whistle: {
      name: 'Свисток', cost: 0, type: 'skill', rarity: 'uncommon', art: 'whistle', exhaust: true,
      desc: (g, u) => `+${u ? 2 : 1} Решимость до конца боя.`,
      play: async (g, u) => g.resolve(u ? 2 : 1),
    },
    cocoa: {
      name: 'Какао с перцем', cost: 0, type: 'skill', rarity: 'common', art: 'cocoa',
      desc: (g, u) => `+${u ? 3 : 2} Решимость до конца хода.`,
      play: async (g, u) => g.rush(u ? 3 : 2),
    },
    prickly: {
      name: 'Колючий шарф', cost: 1, type: 'skill', rarity: 'uncommon', art: 'prickly',
      desc: (g, u) => `Получить ${g.blkText(u ? 6 : 4)} защиты. Шипы ${u ? 3 : 2}.`,
      play: async (g, u) => { g.block(u ? 6 : 4); g.thorns(u ? 3 : 2); },
    },
    frostlace: {
      name: 'Морозный узор', cost: 1, type: 'skill', rarity: 'uncommon', art: 'frostlace',
      desc: (g, u) => `Враг теряет ${u ? 3 : 2} Силы. Получить ${g.blkText(u ? 6 : 4)} защиты.`,
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
      name: 'Бандероль с сюрпризом', cost: 1, type: 'atk', rarity: 'uncommon', art: 'surprise',
      desc: (g, u) => `Доставка: нанести ${g.dmgText(u ? 20 : 14)} урона.`,
      play: async (g, u) => g.deliver('Бандероль', async (d) => d.attack(u ? 20 : 14)),
    },
    umbrella: {
      name: 'Зонтик', cost: 1, type: 'skill', rarity: 'common', art: 'umbrella', retain: true,
      desc: (g, u) => `Получить ${g.blkText(u ? 10 : 7)} защиты.`,
      play: async (g, u) => g.block(u ? 10 : 7),
    },
    blotter: {
      name: 'Промокашка', cost: 0, type: 'skill', rarity: 'common', art: 'blotter',
      desc: (g, u) => `Взять ${u ? 2 : 1} карт${u ? 'ы' : 'у'}. Сжечь помехи в руке, за каждую ещё 1 карта.`,
      play: async (g, u) => { const n = g.exhaustHand((c) => c.type === 'status'); g.draw((u ? 2 : 1) + n); },
    },
    mittens: {
      name: 'Варежки', cost: 1, type: 'charm', rarity: 'uncommon', art: 'mittens',
      desc: (g, u) => `В начале каждого хода ${u ? 5 : 3} защиты.`,
      play: async (g, u) => g.charm('mittens', u ? 5 : 3),
    },
    inkpen: {
      name: 'Перо и чернила', cost: 1, type: 'charm', rarity: 'uncommon', art: 'inkpen',
      desc: (g, u) => `Каждый ваш Навык наносит врагу ${u ? 3 : 2} урона.`,
      play: async (g, u) => g.charm('inkpen', u ? 3 : 2),
    },

    // ---------- редкие ----------
    palm: {
      name: 'Жар-ладонь', cost: 1, type: 'atk', rarity: 'rare', art: 'palm',
      desc: (g, u) => `Потратить все Огоньки. ${u ? 9 : 7} урона за каждый${g.state ? ` (${g.state.flame ? g.dmgText((u ? 9 : 7) * g.state.flame, true) : 0})` : ''}.`,
      play: async (g, u) => { const n = g.consumeFlame(); if (n > 0) await g.attack((u ? 9 : 7) * n); },
    },
    shadow: {
      name: 'Тень-хитрость', cost: 1, type: 'skill', rarity: 'uncommon', art: 'shadow',
      desc: (g, u) => `Враг Ослаблен на ${u ? 3 : 2} хода. Взять ${u ? 2 : 1} карт${u ? 'ы' : 'у'}.`,
      play: async (g, u) => { g.weak(u ? 3 : 2); g.draw(u ? 2 : 1); },
    },
    blaze: {
      name: 'Пожар', cost: 2, type: 'skill', rarity: 'uncommon', art: 'blaze',
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
      name: 'Тайное письмо', cost: 1, type: 'atk', rarity: 'uncommon', art: 'secret', retain: true,
      desc: (g, u, c) => `Нанести ${g.dmgText((u ? 11 : 8) + ((c && c.grow) || 0))} урона. Каждый ход в руке: +${u ? 5 : 4} урона.`,
      play: async (g, u, c) => g.attack((u ? 11 : 8) + (c.grow || 0)),
      onRetain: (c, u) => { c.grow = (c.grow || 0) + (u ? 5 : 4); },
    },
    finale: {
      name: 'Финальный аккорд', cost: 2, type: 'atk', rarity: 'epic', art: 'finale',
      desc: (g, u) => `${g.dmgText(u ? 5 : 4)} урона за каждую карту этого хода, считая эту${g.state ? ` (×${g.played + 1})` : ''}.`,
      play: async (g, u) => g.attack(u ? 5 : 4, g.played + 1),
    },
    flashpoint: {
      name: 'Подкрутить фитиль', cost: 0, type: 'skill', rarity: 'rare', art: 'flashpoint', exhaust: true,
      desc: (g, u) => `Вспышка лампы, Огоньки не тратятся.${u ? ' +1 Огонёк.' : ''}`,
      play: async (g, u) => { await g.burstNow(); if (u) await g.flame(1); },
    },
    drift: {
      name: 'Сугроб', cost: 1, upCost: 0, type: 'skill', rarity: 'uncommon', art: 'drift',
      desc: (g) => `Удвоить защиту${g.state ? ` (${g.blockNow} → ${g.blockNow + g.blkNum(g.blockNow)})` : ''}.`,
      play: async (g) => g.doubleBlock(),
    },
    pockethog: {
      name: 'Ёжик в кармане', cost: 1, type: 'skill', rarity: 'uncommon', art: 'pockethog', exhaust: true,
      desc: (g, u) => `Шипы ${u ? 7 : 5} до конца боя.`,
      play: async (g, u) => g.thorns(u ? 7 : 5),
    },
    drafts: {
      name: 'Сжечь черновики', cost: 1, upCost: 0, type: 'skill', rarity: 'rare', art: 'drafts',
      desc: () => 'Сжечь остальные карты в руке. +1 Огонёк за каждую.',
      play: async (g) => { const n = g.exhaustHand(() => true); if (n) await g.flame(n); },
    },
    eveninglamp: {
      name: 'Вечерняя лампа', cost: 2, upCost: 1, type: 'charm', rarity: 'epic', art: 'eveninglamp',
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
      name: 'Ритм шагов', cost: 1, upCost: 0, type: 'charm', rarity: 'uncommon', art: 'rhythm',
      desc: () => 'Каждая третья карта за ход: +1 Огонёк.',
      play: async (g) => g.charm('rhythm', 1),
    },

    avalanche: {
      name: 'Лавина', cost: 2, type: 'atk', rarity: 'epic', art: 'avalanche',
      desc: (g, u) => `Нанести по ${u ? 3 : 2} урона за каждую карту в сбросе${g.state ? ` (${g.dmgText((u ? 3 : 2) * g.state.disc.length)})` : ''}.`,
      play: async (g, u) => g.attack((u ? 3 : 2) * g.state.disc.length),
    },
    moneyorder: {
      name: 'Денежный перевод', cost: 0, type: 'skill', rarity: 'rare', art: 'moneyorder', exhaust: true,
      desc: (g, u) => `Доставка: +1 энергия, 2 карты и ${u ? 25 : 15} монет.`,
      play: async (g, u) => g.deliver('Перевод', async (d) => { d.energy(1); d.draw(2); d.gold(u ? 25 : 15); }),
    },
    aurora: {
      name: 'Северное сияние', cost: 3, upCost: 2, type: 'charm', rarity: 'epic', art: 'aurora',
      desc: () => 'В начале каждого хода +1 энергия.',
      play: async (g) => g.charm('aurora', 1),
    },
    returnaddr: {
      name: 'Обратный адрес', cost: 1, type: 'skill', rarity: 'rare', art: 'returnaddr',
      desc: (g, u) => `Вернуть в руку ${u ? 3 : 2} последние карты из сброса.`,
      play: async (g, u) => g.recall(u ? 3 : 2),
    },
    frostbite: {
      name: 'Обморожение', cost: 1, upCost: 0, type: 'skill', rarity: 'rare', art: 'frostbite', exhaust: true,
      desc: () => 'Враг Уязвим 2, Ослаблен на 2 хода и теряет 2 Силы.',
      play: async (g) => { g.vuln(2); g.weak(2); g.chill(2); },
    },
    poste: {
      name: 'До востребования', cost: 1, type: 'skill', rarity: 'epic', art: 'poste',
      desc: (g, u) => `Доставка: бесплатно разыграть ${u ? 3 : 2} верхние карты колоды.`,
      play: async (g, u) => g.deliver('До востребования', async (d) => d.autoplay(u ? 3 : 2)),
    },

    // ---------- эпические ----------
    starfall: {
      name: 'Звездопад', cost: 2, type: 'atk', rarity: 'epic', art: 'starfall',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 5 : 4)} урона 3 раза. После каждого удара +1 Огонёк.`,
      play: async (g, u) => { for (let k = 0; k < 3 && !g.enemyDead; k++) { await g.attack(u ? 5 : 4); if (!g.enemyDead) await g.flame(1); } },
    },
    iceprison: {
      name: 'Ледяная темница', cost: 2, type: 'skill', rarity: 'epic', art: 'iceprison', exhaust: true,
      desc: (g, u) => `Получить ${g.blkText(u ? 14 : 10)} защиты. Враг теряет 4 Силы и Ослаблен на 3 хода.`,
      play: async (g, u) => { g.block(u ? 14 : 10); g.chill(4); g.weak(3); },
    },
    bonfire: {
      name: 'Масленичный костёр', cost: 2, type: 'skill', rarity: 'epic', art: 'bonfire',
      desc: (g, u) => `Поджог ${u ? 14 : 10}. Восстановить ${u ? 6 : 4} HP.`,
      play: async (g, u) => { g.burn(u ? 14 : 10); g.heal(u ? 6 : 4); },
    },
    registered: {
      name: 'Заказное письмо', cost: 1, type: 'atk', rarity: 'epic', art: 'registered', retain: true,
      desc: (g, u, c) => `Нанести ${g.dmgText((u ? 9 : 6) * ((c && c.mult) || 1))} урона. Каждый ход в руке урон удваивается (до ×8).`,
      play: async (g, u, c) => { const m = c.mult || 1; c.mult = 1; await g.attack((u ? 9 : 6) * m); },
      onRetain: (c) => { c.mult = Math.min(8, (c.mult || 1) * 2); },
    },

    // ---------- легендарные: в колоде может быть только одна такая ----------
    chimes: {
      name: 'Бой курантов', cost: 3, upCost: 2, type: 'skill', rarity: 'legendary', art: 'chimes', exhaust: true,
      desc: () => 'До конца хода все карты стоят 0. Взять 2 карты.',
      play: async (g) => { g.freeTurn(); g.draw(2); },
    },
    lastlight: {
      name: 'Последний луч', cost: 3, upCost: 2, type: 'atk', rarity: 'legendary', art: 'lastlight', exhaust: true,
      desc: (g) => `Нанести ${g.dmgText(30)} урона и вызвать Вспышку лампы.`,
      play: async (g) => { await g.attack(30); if (!g.enemyDead) await g.burstNow(); },
    },
    firebird: {
      name: 'Перо Жар-птицы', cost: 3, upCost: 2, type: 'charm', rarity: 'legendary', art: 'firebird',
      desc: () => 'В начале каждого хода +2 Огонька и Поджог 3.',
      play: async (g) => g.charm('firebird', 1),
    },
    eternalwinter: {
      name: 'Вечная зима', cost: 3, upCost: 2, type: 'charm', rarity: 'legendary', art: 'eternalwinter',
      desc: () => 'В начале каждого хода враг теряет 2 Силы, а вы получаете 8 защиты.',
      play: async (g) => g.charm('eternalwinter', 1),
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
      desc: (g, u) => `Получить ${u ? 5 : 3} защиты и ещё ${u ? 3 : 2} за каждый Огонёк${g.state ? ` (${g.blkText((u ? 5 : 3) + (u ? 3 : 2) * g.state.flame)})` : ''}.`,
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
      desc: (g, u) => `Получить ${g.blkText(u ? 7 : 4)} защиты. Доставка: +1 энергия и 2 карты.`,
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
      desc: (g, u) => `Получить ${g.blkText(u ? 17 : 13)} защиты. Враг теряет ${u ? 2 : 1} Силы.`,
      play: async (g, u) => { g.block(u ? 17 : 13); g.chill(u ? 2 : 1); },
    },
    hedge: {
      name: 'Колючая изгородь', cost: 1, type: 'skill', rarity: 'common', art: 'hedge', cls: 'guard',
      desc: (g, u) => `Шипы ${u ? 3 : 2}. Получить защиту, равную двойным Шипам${g.state ? ` (${g.blkText((g.state.thorns + g.thornsGain(u ? 3 : 2)) * 2)})` : ''}.`,
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

    // Груня, пряничница: Пряники прямо в бою
    gingerbread: {
      name: 'Пряник', cost: 0, type: 'skill', rarity: 'token', art: 'gingerbread', cls: 'baker', exhaust: true,
      desc: (g, u) => `Нанести ${g.dmgText(u ? 5 : 3)} урона. Получить ${g.blkText(u ? 5 : 3)} защиты.`,
      play: async (g, u) => { await g.attack(u ? 5 : 3); g.block(u ? 5 : 3); },
    },
    dough: {
      name: 'Замесить тесто', cost: 1, type: 'skill', rarity: 'common', art: 'dough', cls: 'baker',
      desc: (g, u) => `Положить в руку ${u ? 3 : 2} Пряника.`,
      play: async (g, u) => g.ginger(u ? 3 : 2),
    },
    rollingpin: {
      name: 'Скалка', cost: 1, type: 'atk', rarity: 'common', art: 'rollingpin', cls: 'baker',
      desc: (g, u) => `Нанести ${g.dmgText(u ? 9 : 6)} урона. Положить в руку Пряник.`,
      play: async (g, u) => { await g.attack(u ? 9 : 6); g.ginger(1); },
    },
    glaze: {
      name: 'Сахарная глазурь', cost: 1, type: 'skill', rarity: 'uncommon', art: 'glaze', cls: 'baker',
      desc: (g, u) => `Получить ${g.blkText(u ? 9 : 6)} защиты. До конца боя все Пряники улучшены.`,
      play: async (g, u) => { g.block(u ? 9 : 6); g.glaze(); },
    },
    gingerhouse: {
      name: 'Пряничный терем', cost: 2, upCost: 1, type: 'charm', rarity: 'rare', art: 'gingerhouse', cls: 'baker',
      desc: () => 'Каждый сыгранный Пряник наносит врагу ещё 4 урона.',
      play: async (g) => g.charm('gingerhouse', 1),
    },
    fair: {
      name: 'Ярмарка', cost: 2, type: 'atk', rarity: 'epic', art: 'fair', cls: 'baker',
      desc: (g, u) => (g.state ? `Нанести ${g.dmgText((u ? 4 : 3) * g.state.ginger)} урона: по ${u ? 4 : 3} за каждый Пряник, съеденный в этом бою.`
        : `Нанести по ${u ? 4 : 3} урона за каждый Пряник, съеденный в этом бою.`),
      play: async (g, u) => g.attack((u ? 4 : 3) * g.state.ginger),
    },
    // Савва, точильщик: Заточка карт прямо в бою
    hone: {
      name: 'Править лезвие', cost: 1, type: 'skill', rarity: 'common', art: 'hone', cls: 'grinder',
      desc: (g, u) => `Получить ${g.blkText(u ? 7 : 5)} защиты. Заточить ${u ? 2 : 1} карт${u ? 'ы' : 'у'} в руке.`,
      play: async (g, u) => { g.block(u ? 7 : 5); g.sharpen(u ? 2 : 1); },
    },
    gritsparks: {
      name: 'Искры из-под круга', cost: 1, type: 'atk', rarity: 'common', art: 'gritsparks', cls: 'grinder',
      desc: (g, u, c) => {
        const n = g.state ? g.state.hand.filter((x) => x.up && x !== c).length : 0;
        return `Нанести ${g.dmgText((u ? 6 : 4) + (u ? 3 : 2) * n)} урона, +${u ? 3 : 2} за каждую улучшенную карту в руке.`;
      },
      play: async (g, u) => g.attack((u ? 6 : 4) + (u ? 3 : 2) * g.state.hand.filter((x) => x.up).length),
    },
    oselok: {
      name: 'Оселок', cost: 0, type: 'skill', rarity: 'uncommon', art: 'oselok', cls: 'grinder', exhaust: true,
      desc: (g, u) => (u ? 'Взять 1 карту. Заточить все карты в руке.' : 'Заточить все карты в руке.'),
      play: async (g, u) => { if (u) g.draw(1); g.sharpen(99); },
    },
    apprentice: {
      name: 'Подмастерье', cost: 1, upCost: 0, type: 'charm', rarity: 'rare', art: 'apprentice', cls: 'grinder',
      desc: () => 'В начале каждого хода заточить ещё 2 карты в руке.',
      play: async (g) => g.charm('apprentice', 1),
    },
    steelring: {
      name: 'Звон стали', cost: 2, type: 'atk', rarity: 'epic', art: 'steelring', cls: 'grinder',
      desc: (g, u, c) => {
        if (!g.state) return `Нанести по ${u ? 4 : 3} урона за каждую улучшенную карту в колоде, руке и сбросе.`;
        const n = g.upCount(c);
        return `Нанести ${g.dmgText((u ? 4 : 3) * n)} урона: по ${u ? 4 : 3} за каждую улучшенную карту в колоде, руке и сбросе.`;
      },
      play: async (g, u, c) => g.attack((u ? 4 : 3) * g.upCount(c)),
    },
    // Луша, пастушка: пёс Дружок и команды
    sic: {
      name: 'Взять!', cost: 1, type: 'skill', rarity: 'common', art: 'sic', cls: 'shepherd',
      desc: (g, u) => `Злость Дружка +${u ? 2 : 1}. Дружок сразу кусает.`,
      play: async (g, u) => { g.dog(u ? 2 : 1); await g.bite(); },
    },
    heel: {
      name: 'Рядом!', cost: 1, type: 'skill', rarity: 'common', art: 'heel', cls: 'shepherd',
      desc: (g, u) => `Получить ${u ? 6 : 4} защиты и ещё столько, сколько Злости у Дружка${g.state ? ` (${g.blkText((u ? 6 : 4) + g.state.dog)})` : ''}.`,
      play: async (g, u) => g.block((u ? 6 : 4) + g.state.dog),
    },
    bone: {
      name: 'Сахарная косточка', cost: 0, type: 'skill', rarity: 'uncommon', art: 'bone', cls: 'shepherd', exhaust: true,
      desc: (g, u) => `Злость Дружка +${u ? 4 : 3}.`,
      play: async (g, u) => g.dog(u ? 4 : 3),
    },
    wolfhound: {
      name: 'Волкодав', cost: 2, upCost: 1, type: 'charm', rarity: 'rare', art: 'wolfhound', cls: 'shepherd',
      desc: () => 'В конце каждого хода Дружок кусает ещё раз.',
      play: async (g) => g.charm('wolfhound', 1),
    },
    howl: {
      name: 'Вой на луну', cost: 1, upCost: 0, type: 'skill', rarity: 'epic', art: 'howl', cls: 'shepherd', exhaust: true,
      desc: (g) => `Удвоить Злость Дружка${g.state ? ` (${g.state.dog} → ${g.state.dog * 2})` : ''}. Он сразу кусает.`,
      play: async (g) => { g.dog(g.state.dog); await g.bite(); },
    },
    // Ульяна, знахарка: Цена здоровьем и травы
    bitterroot: {
      name: 'Горький корень', cost: 1, type: 'atk', rarity: 'common', art: 'bitterroot', cls: 'herbalist', price: () => 2,
      desc: (g, u) => `Цена 2. Нанести ${g.dmgText(u ? 15 : 11)} урона.`,
      play: async (g, u) => g.attack(u ? 15 : 11),
    },
    chamomile: {
      name: 'Ромашковый отвар', cost: 1, type: 'skill', rarity: 'common', art: 'chamomile', cls: 'herbalist',
      desc: (g, u) => `Получить ${g.blkText(u ? 7 : 5)} защиты. Восстановить ${u ? 4 : 3} HP.`,
      play: async (g, u) => { g.block(u ? 7 : 5); g.heal(u ? 4 : 3); },
    },
    wormwood: {
      name: 'Полынь', cost: 0, type: 'skill', rarity: 'uncommon', art: 'wormwood', cls: 'herbalist', price: (u) => (u ? 2 : 3),
      desc: (g, u) => `Цена ${u ? 2 : 3}. +2 энергии.`,
      play: async (g) => g.energy(2),
    },
    sleepgrass: {
      name: 'Сон-трава', cost: 1, type: 'skill', rarity: 'rare', art: 'sleepgrass', cls: 'herbalist', exhaust: true, price: (u) => (u ? 2 : 4),
      desc: (g, u) => `Цена ${u ? 2 : 4}. Враг засыпает и пропускает свой следующий ход.`,
      play: async (g) => g.stun(),
    },
    livingwater: {
      name: 'Живая вода', cost: 1, upCost: 0, type: 'skill', rarity: 'epic', art: 'livingwater', cls: 'herbalist', exhaust: true,
      desc: (g) => `Восстановить столько HP, сколько вы заплатили Ценой в этом бою${g.state ? ` (${g.state.paid})` : ''}.`,
      play: async (g) => g.heal(g.state.paid),
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
    // помехи мрачных героев в финале
    ash: {
      name: 'Зола', cost: null, type: 'status', rarity: 'status', art: 'ash',
      desc: () => 'Нельзя разыграть. В конце хода в руке: −3 HP.',
    },
    stale: {
      name: 'Чёрствый пряник', cost: 2, type: 'status', rarity: 'status', art: 'stale', exhaust: true,
      desc: () => 'Ничего не делает.',
      play: async () => {},
    },
  };

  /* Враги: шаблон намерений повторяется по кругу.
     intent: {k:'attack', v, hits} | {k:'block', v} | {k:'buff', v} (сила)
             {k:'debuff', v} (Слабость игроку) | {k:'snuff', v} (гасит Огоньки + атака)
             {k:'curse', card, n} (подкинуть помехи в колоду) | {k:'steal', v, gold} (атака + кража монет)
             {k:'heal', v} | {k:'spikes', v} (враг получает Шипы)
             {k:'sap', v} (−v энергии в ваш следующий ход) | {k:'mist', v} (туман: до следующего хода врага удары по нему не больше v)
             {k:'boom', v} (взрыв: удар на v, после него враг исчезает) | {k:'bury', v} (в следующий ход на v карт меньше)
             {k:'frail', v} (Хрупкость на v ходов: ваша защита слабее на 25%)
             у атаки leech: true — враг лечится на весь прошедший урон
     Особые приёмы (пассивно, весь бой):
     thorns: N — колючий: каждый удар по нему ранит вас на N
     nest: N — матрёшка: N раз раскрывается и выпускает новую, поменьше
     boil: true — кипит: каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5)
     tally: N — кукушка: каждая N-я карта за ход бьёт вас на 3
     plating: true — латы: защита врага не сгорает в начале его хода
     alarm: N — колотушка: каждый ваш Навык даёт врагу N защиты */
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
    // ---- новые: город ----
    matryoshka: {
      name: 'Матрёшка-Шкатулка', hp: 18, tier: 'normal', nest: 2,
      line: 'Внутри одной сердитой матрёшки прячется ещё одна. И ещё.',
      pattern: [{ k: 'attack', v: 5 }, { k: 'block', v: 5, then: { k: 'attack', v: 3 } }, { k: 'attack', v: 2, hits: 3 }],
    },
    samovar: {
      name: 'Самовар-Кипяток', hp: 26, tier: 'normal', boil: true,
      line: 'Чем сильнее его стукнешь, тем сильнее он кипит.',
      pattern: [{ k: 'attack', v: 6 }, { k: 'attack', v: 3, hits: 2 }, { k: 'block', v: 8, then: { k: 'heal', v: 4 } }],
    },
    cuckoo: {
      name: 'Кукушка из ходиков', hp: 20, tier: 'normal', tally: 4,
      line: 'Считает каждое ваше движение и кукует невпопад.',
      pattern: [{ k: 'attack', v: 5 }, { k: 'sap', v: 1, then: { k: 'attack', v: 3 } }, { k: 'attack', v: 2, hits: 3 }],
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
    // ---- новые: окраина ----
    mist: {
      name: 'Туманница', hp: 24, tier: 'normal',
      line: 'Кутается в туман, и удары вязнут в нём, как в вате.',
      pattern: [{ k: 'mist', v: 5, then: { k: 'block', v: 5 } }, { k: 'attack', v: 7 }, { k: 'debuff', v: 1, then: { k: 'attack', v: 4 } }, { k: 'attack', v: 3, hits: 2 }],
    },
    ghoul: {
      name: 'Ледяной Упырь', hp: 28, tier: 'normal',
      line: 'Пьёт чужое тепло и от этого только крепнет.',
      pattern: [{ k: 'attack', v: 7, leech: true }, { k: 'block', v: 7, then: { k: 'buff', v: 1 } }, { k: 'attack', v: 4, hits: 2, leech: true }],
    },
    firecracker: {
      name: 'Шутиха', hp: 22, tier: 'normal',
      line: 'Сбежавший праздничный фейерверк. Фитиль уже шипит.',
      pattern: [{ k: 'attack', v: 3, hits: 2 }, { k: 'block', v: 6, then: { k: 'attack', v: 3 } }, { k: 'boom', v: 16 }],
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
    iceknight: {
      name: 'Ледяной Рыцарь', hp: 44, tier: 'elite', plating: true,
      line: 'Его латы намерзали всю зиму, слой за слоем.',
      pattern: [{ k: 'block', v: 9 }, { k: 'attack', v: 10 }, { k: 'block', v: 7, then: { k: 'attack', v: 5 } }, { k: 'attack', v: 4, hits: 2 }],
    },
    blizzard: {
      name: 'Метелица', hp: 50, tier: 'elite',
      line: 'Заметает дороги, руки и мысли.',
      pattern: [{ k: 'attack', v: 5, hits: 2 }, { k: 'bury', v: 2, then: { k: 'curse', card: 'icy', n: 2 } }, { k: 'attack', v: 12 }, { k: 'frail', v: 2, then: { k: 'block', v: 10 } }],
    },
    watchman: {
      name: 'Сторож с колотушкой', hp: 52, tier: 'elite', alarm: 3,
      line: 'Стучит в колотушку на каждый шорох. Хитрости он не любит.',
      pattern: [{ k: 'attack', v: 11 }, { k: 'debuff', v: 2, then: { k: 'attack', v: 5 } }, { k: 'buff', v: 2, then: { k: 'block', v: 10 } }, { k: 'attack', v: 4, hits: 3 }],
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
      pattern: [{ k: 'attack', v: 14 }, { k: 'sap', v: 1, then: { k: 'block', v: 16 } }, { k: 'snuff', v: 9 }, { k: 'attack', v: 4, hits: 4 }, { k: 'buff', v: 3, then: { k: 'attack', v: 6 } }],
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
      pattern: [{ k: 'attack', v: 7, hits: 2 }, { k: 'buff', v: 2, then: { k: 'attack', v: 5 } }, { k: 'attack', v: 18 }, { k: 'snuff', v: 8 }, { k: 'frail', v: 2, then: { k: 'attack', v: 4, hits: 3 } }],
    },
    troll: {
      name: 'Мостовой Тролль', hp: 160, tier: 'boss',
      line: 'Берёт плату за мост. Больше всего любит чужие письма.',
      pattern: [{ k: 'block', v: 18, then: { k: 'attack', v: 6 } }, { k: 'steal', v: 16, gold: 20 }, { k: 'debuff', v: 2, then: { k: 'attack', v: 8 } }, { k: 'attack', v: 6, hits: 2 }, { k: 'block', v: 12, then: { k: 'buff', v: 3 } }],
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
    // ---- мрачные версии героев: финальный босс, если героя обидели в пути (js/lore.js) ----
    dk_lamp: {
      name: 'Погасшая Ива', hp: 185, tier: 'boss', dark: 'lamp',
      line: 'Решила, что без света не будет и страха.',
      pattern: [{ k: 'snuff', v: 10 }, { k: 'attack', v: 4, hits: 4 }, { k: 'curse', card: 'dread', n: 2, then: { k: 'block', v: 14 } }, { k: 'buff', v: 3, then: { k: 'attack', v: 9 } }],
    },
    dk_courier: {
      name: 'Тиша Без Адреса', hp: 170, tier: 'boss', dark: 'courier',
      line: 'Бежит без дороги и без адреса.',
      pattern: [{ k: 'attack', v: 3, hits: 5 }, { k: 'steal', v: 10, gold: 20 }, { k: 'sap', v: 1, then: { k: 'attack', v: 6, hits: 2 } }, { k: 'debuff', v: 2, then: { k: 'attack', v: 12 } }],
    },
    dk_guard: {
      name: 'Запертая Марфа', hp: 200, tier: 'boss', dark: 'guard', plating: true,
      line: 'Закрыла мост навсегда и для всех.',
      pattern: [{ k: 'block', v: 16 }, { k: 'attack', v: 12 }, { k: 'spikes', v: 3, then: { k: 'block', v: 8 } }, { k: 'frail', v: 2, then: { k: 'attack', v: 7, hits: 2 } }],
    },
    dk_stoker: {
      name: 'Пепельный Фома', hp: 190, tier: 'boss', dark: 'stoker', boil: true,
      line: 'Его огонь больше никого не греет.',
      pattern: [{ k: 'attack', v: 4, hits: 3 }, { k: 'curse', card: 'ash', n: 2, then: { k: 'attack', v: 6 } }, { k: 'attack', v: 14 }, { k: 'buff', v: 2, then: { k: 'block', v: 12 } }],
    },
    dk_baker: {
      name: 'Чёрствая Груня', hp: 200, tier: 'boss', dark: 'baker',
      line: 'Больше никого не кормит.',
      pattern: [{ k: 'block', v: 14, then: { k: 'heal', v: 10 } }, { k: 'curse', card: 'stale', n: 3, then: { k: 'attack', v: 6 } }, { k: 'attack', v: 13 }, { k: 'buff', v: 2, then: { k: 'attack', v: 4, hits: 3 } }],
    },
    dk_grinder: {
      name: 'Зазубренный Савва', hp: 190, tier: 'boss', dark: 'grinder',
      line: 'Перестал чинить и стал резать.',
      pattern: [{ k: 'buff', v: 4, then: { k: 'block', v: 10 } }, { k: 'attack', v: 20 }, { k: 'frail', v: 2, then: { k: 'attack', v: 5, hits: 2 } }, { k: 'buff', v: 2, then: { k: 'attack', v: 9 } }],
    },
    dk_shepherd: {
      name: 'Волчья Луша', hp: 185, tier: 'boss', dark: 'shepherd',
      line: 'Её пёс стал тенью и кусает всё злее.',
      pattern: [{ k: 'attack', v: 4, hits: 2, then: { k: 'buff', v: 1 } }, { k: 'debuff', v: 2, then: { k: 'attack', v: 8 } }, { k: 'attack', v: 3, hits: 4 }, { k: 'block', v: 10, then: { k: 'buff', v: 2 } }],
    },
    dk_herbalist: {
      name: 'Горькая Ульяна', hp: 210, tier: 'boss', dark: 'herbalist',
      line: 'Лечит теперь только себя.',
      pattern: [{ k: 'attack', v: 9, leech: true }, { k: 'debuff', v: 2, then: { k: 'heal', v: 12 } }, { k: 'attack', v: 5, hits: 3, leech: true }, { k: 'curse', card: 'dread', n: 1, then: { k: 'block', v: 12 } }, { k: 'buff', v: 3, then: { k: 'attack', v: 10, leech: true } }],
    },
  };

  /* Талисманы. tier: common | uncommon | rare | epic | legendary | boss | class
     (обычный, необычный, редкий, эпический, легендарный, трофей босса, особенность героя).
     class — особенность героя: есть у него с начала забега и больше нигде не выпадает.
     Обычные, необычные и редкие дают элиты, сундуки, события и лавка (редкие реже); талисманы босса выбираются
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
    mug: { tier: 'common', name: 'Глиняная кружка', art: 'mug', desc: 'В начале боя восстановить 3 HP.' },
    pencil: { tier: 'common', name: 'Огрызок карандаша', art: 'pencil', desc: 'Первая атака каждого хода: +3 урона каждому удару.' },
    bookmark: { tier: 'common', name: 'Закладка с кисточкой', art: 'bookmark', desc: 'В начале боя одна случайная карта колоды улучшается до конца боя.' },
    cocoatin: { tier: 'common', name: 'Жестянка какао', art: 'cocoatin', desc: 'Отдых у костра также даёт +2 к максимуму HP.' },
    stamppad: { tier: 'common', name: 'Штемпельная подушка', art: 'stamppad', desc: 'Ваша Уязвимость держится на 1 ход дольше.' },
    snowglobe: { tier: 'uncommon', name: 'Снежный шар', art: 'snowglobe', desc: 'Каждая Вспышка лампы Ослабляет врага на 1 ход.' },
    oilcan: { tier: 'uncommon', name: 'Маслёнка', art: 'oilcan', desc: 'Каждая Доставка даёт 4 защиты.' },
    candybox: { tier: 'uncommon', name: 'Коробка леденцов', art: 'candybox', desc: 'После победы над элитой восстановить 10 HP.' },
    vanefeather: { tier: 'uncommon', name: 'Перо флюгера', art: 'vanefeather', desc: 'Если в конце хода рука пуста, в следующий ход +1 энергия.' },
    stokerglove: { tier: 'uncommon', name: 'Рукавица истопника', art: 'stokerglove', desc: 'Каждый раз, когда Поджог ранит врага, получить 2 защиты.' },
    luckystamp: { tier: 'uncommon', name: 'Счастливая марка', art: 'luckystamp', desc: 'Монет за победы на 20% больше.' },
    magnifier: { tier: 'uncommon', name: 'Лупа', art: 'magnifier', desc: 'Первая атака в бою делает врага Уязвимым на 2 хода.' },
    kettle: { tier: 'uncommon', name: 'Походный чайник', art: 'kettle', desc: 'Отдых у костра лечит на 10 HP больше.' },
    whetstone: { tier: 'common', name: 'Точильный камень', art: 'whetstone', desc: 'Сразу улучшает 2 случайные карты колоды.' },
    inkwell: { tier: 'uncommon', name: 'Чернильница', art: 'inkwell', desc: 'В начале боя враг Ослаблен на 2 хода.' },
    pinecone: { tier: 'common', name: 'Еловая шишка', art: 'pinecone', desc: 'В начале боя Шипы 3.' },
    coupon: { tier: 'common', name: 'Купон Игольника', art: 'coupon', desc: 'В лавке всё на 25% дешевле.' },
    stub: { tier: 'common', name: 'Огарок', art: 'stub', desc: 'Каждая Вспышка лампы лечит 2 HP.' },
    sled: { tier: 'uncommon', name: 'Санки', art: 'sled', desc: 'В первый ход боя взять 2 лишние карты.' },
    piggy: { tier: 'uncommon', name: 'Копилка', art: 'piggy', desc: 'Победа без потери HP: +15 монет.' },
    frostglass: { tier: 'uncommon', name: 'Морозное стекло', art: 'frostglass', desc: 'Враги начинают бой с −2 Силы.' },
    matchbox: { tier: 'common', name: 'Коробок спичек', art: 'matchbox', desc: 'Каждый ваш Поджог на 2 сильнее.' },
    mirrorshard: { tier: 'epic', name: 'Осколок зеркала', art: 'mirrorshard', desc: 'Первая карта каждого хода срабатывает дважды.' },
    eternaloil: { tier: 'rare', name: 'Неугасимое масло', art: 'eternaloil', desc: 'Враги не могут гасить ваши Огоньки. В начале боя +1 Огонёк.' },
    medal: { tier: 'rare', name: 'Медаль почтальона', art: 'medal', desc: 'Если за прошлый ход сыграно 6 карт или больше, +1 энергия.' },
    thermos: { tier: 'rare', name: 'Термос', art: 'thermos', desc: 'После боя, если HP меньше половины, восстановить 12 HP.' },
    northstar: { tier: 'epic', name: 'Полярная звезда', art: 'northstar', desc: 'В первый ход боя +2 энергии и 2 лишние карты.' },
    stampbook: { tier: 'rare', name: 'Альбом марок', art: 'stampbook', desc: 'Каждая шестая карта, сыгранная в бою, даёт +1 энергию.' },
    hotstone: { tier: 'rare', name: 'Горячий камень', art: 'hotstone', desc: 'В начале хода до 6 защиты не сгорает.' },
    clover: { tier: 'rare', name: 'Сушёный клевер', art: 'clover', desc: 'После боя на выбор на одну карту больше.' },
    horseshoe: { tier: 'rare', name: 'Подкова', art: 'horseshoe', desc: 'Первый пропущенный удар в каждом бою ранит только на 1.' },
    brazier: { tier: 'rare', name: 'Жаровня', art: 'brazier', desc: 'Когда карта сгорает, получить 3 защиты.' },
    musicbox: { tier: 'epic', name: 'Музыкальная шкатулка', art: 'musicbox', desc: 'Каждый третий ход +2 энергии.' },
    ribbon: { tier: 'epic', name: 'Лента для писем', art: 'ribbon', desc: 'В конце хода самая дорогая карта остаётся в руке.' },
    horn: { tier: 'epic', name: 'Почтовый рожок', art: 'horn', desc: 'Каждая Доставка срабатывает дважды.' },
    frostring: { tier: 'epic', name: 'Морозное кольцо', art: 'frostring', desc: 'В начале боя враг Уязвим 2 и Ослаблен на 2 хода.' },
    buckle: { tier: 'epic', name: 'Латунная пряжка', art: 'buckle', desc: 'Каждый ваш Навык даёт 3 защиты.' },
    wreath: { tier: 'epic', name: 'Еловый венок', art: 'wreath', desc: 'Все ваши Шипы вдвое сильнее.' },
    sunstone: { tier: 'legendary', name: 'Солнечный камень', art: 'sunstone', desc: '+1 энергия и +1 карта каждый ход.' },
    lastcandle: { tier: 'legendary', name: 'Последняя свеча', art: 'lastcandle', desc: 'Один раз за забег, когда HP падает до 0, восстановить половину HP.' },
    magicbag: { tier: 'legendary', name: 'Заговорённая сумка', art: 'magicbag', desc: 'Карты в конце хода остаются в руке. Каждый ход +1 карта.' },
    // особенности героев
    ivalamp: { tier: 'class', name: 'Фонарь Ивы', art: 'lantern', desc: 'После каждой Вспышки в лампе остаётся 1 Огонёк.' },
    wingboots: { tier: 'class', name: 'Крылатые ботинки', art: 'wingboots', desc: 'Каждая четвёртая карта за ход: +1 энергия и 1 карта.' },
    ironshutter: { tier: 'class', name: 'Окованный ставень', art: 'ironshutter', desc: 'Когда защита целиком принимает удар врага, он получает 4 урона.' },
    sootbroom: { tier: 'class', name: 'Закопчённая метла', art: 'sootbroom', desc: 'Каждый удар ваших атак добавляет врагу Поджог 1.' },
    // талисманы героя: выпадают только своему герою (cls)
    wickcutter: { tier: 'uncommon', cls: 'lamp', name: 'Щипцы для фитиля', art: 'wickcutter', desc: 'Каждая Вспышка лампы даёт 4 защиты.' },
    milestone: { tier: 'uncommon', cls: 'courier', name: 'Верстовой столб', art: 'milestone', desc: 'Каждая пятая карта за ход наносит врагу 8 урона.' },
    bridgerail: { tier: 'uncommon', cls: 'guard', name: 'Перила моста', art: 'bridgerail', desc: 'В начале каждого хода Шипы +1.' },
    chimneycap: { tier: 'uncommon', cls: 'stoker', name: 'Колпак на трубу', art: 'chimneycap', desc: 'В начале боя враг получает Поджог 6.' },
    honeypot: { tier: 'uncommon', cls: 'baker', name: 'Горшочек мёда', art: 'honeypot', desc: 'В начале боя в руку ложатся 2 Пряника.' },
    leatherstrop: { tier: 'rare', cls: 'grinder', name: 'Ремень для правки', art: 'leatherstrop', desc: 'После победы одна карта, заточенная в бою, остаётся улучшенной навсегда.' },
    collar: { tier: 'uncommon', cls: 'shepherd', name: 'Ошейник с бубенцом', art: 'collar', desc: 'Каждый укус Дружка даёт вам 2 защиты.' },
    herbbag: { tier: 'uncommon', cls: 'herbalist', name: 'Мешочек трав', art: 'herbbag', desc: 'После боя восстановить половину HP, заплаченных Ценой.' },
    moldform: { tier: 'class', name: 'Расписная формочка', art: 'moldform', desc: 'В начале каждого хода в руку ложится Пряник.' },
    grindwheel: { tier: 'class', name: 'Точильный круг', art: 'grindwheel', desc: 'В начале каждого хода две карты в руке затачиваются: улучшаются до конца боя.' },
    dogfriend: { tier: 'class', name: 'Пёс Дружок', art: 'dogfriend', desc: 'В конце каждого хода Дружок кусает врага на свою Злость. В начале боя Злость 3.' },
    mortar: { tier: 'class', name: 'Ступка знахарки', art: 'mortar', desc: 'Когда вы платите Цену, враг получает столько же урона.' },
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
        { text: 'Загадать желание', hint: '+20 HP и +15 монет', ad: true, act: (r, a) => { a.heal(20); r.gold += 15; return 'Колодец звякнул, вода засияла, и на сруб выкатились монетки.'; } },
        { text: 'Бросить 15 монет', hint: '−15 монет, +10 HP', can: (r) => r.gold >= 15, act: (r, a) => { r.gold -= 15; a.heal(10); return 'Вода засветилась тёплым светом. Тебе стало легче.'; } },
        { text: 'Заглянуть внутрь', hint: '50%: карта / −5 HP', act: (r, a) => { if (Math.random() < 0.5) { a.giveRandomCard('common'); return 'На дне блеснула карта. Ты {f|выловила|выловил} её ведром.'; } a.damage(5); return 'Из колодца вылетела стая летучих мышей!'; } },
        { text: 'Пройти мимо', hint: 'Ничего', act: () => 'Ты {f|пошла|пошёл} дальше. Колодец обиженно булькнул.' },
      ],
    },
    {
      id: 'puppet', title: 'Бродячий кукольник', art: 'puppet',
      text: 'Кукольник без лица протягивает тебе нитку: «Сыграй со мной — получишь редкость».',
      options: [
        { text: 'Сыграть', hint: '−6 HP, редкая карта', act: (r, a) => { a.damage(6); a.giveRandomCard('rare'); return 'Нитка больно дёрнула палец, но в руке осталась редкая карта.'; } },
        { text: 'Досмотреть спектакль', hint: 'Редкая карта без потери HP', ad: true, act: (r, a) => { a.giveRandomCard('rare'); return 'Куклы раскланялись, и кукольник вручил тебе редкую карту.'; } },
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
        { text: 'Посветить фонарём', hint: '+60 монет, без боя', ad: true, act: (r) => { r.gold += 60; return 'В свете фонаря нашлись все монетки до одной, а хозяин так и не пришёл.'; } },
        { text: 'Оставить', hint: 'Ничего', act: () => 'Чужого не надо.' },
      ],
    },
    {
      id: 'smith', title: 'Кузнец-Снегирь', art: 'whetstone',
      text: 'У горна греется снегирь в кожаном фартуке. «Наточу что угодно, хоть письмо!»',
      options: [
        { text: 'Наточить карту', hint: 'Улучшить карту на выбор', act: (r, a) => { a.upgradePrompt(); return null; } },
        { text: 'Заказать большую работу', hint: 'Улучшить 3 случайные карты', ad: true, act: (r, a) => { const n = a.upgradeRandom(3); return n ? 'Снегирь трудился без отдыха, и три карты заблестели.' : 'Точить оказалось нечего.'; } },
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
    {
      id: 'showbooth', title: 'Балаган на площади', art: 'showbooth',
      text: 'Под пёстрым шатром крутят волшебный фонарь: на простыне сменяются картинки, а зрителям после представления раздают подарки.',
      options: [
        { text: 'Посмотреть представление', hint: 'Талисман и +20 монет', ad: true, act: (r, a) => { a.giveRelic(); r.gold += 20; return 'Картинки погасли, зрители захлопали, а балаганщик сунул тебе в руку подарок.'; } },
        { text: 'Пройти мимо', hint: 'Ничего', act: () => 'Из шатра доносились смех и музыка, но письмо не ждёт.' },
      ],
    },
  ];

  /* Герои. Каждый начинает со своей колодой и особенностью (талисман tier: 'class').
     favored — общие карты под его билд: в наградах и лавке они выпадают чаще.
     f — героиня (для окончаний в тексте), who/whom — как назвать героя в сюжете.
     paid — герой открывается покупкой в магазине (js/store.js). */
  const CLASSES = {
    lamp: {
      name: 'Ива', role: 'Фонарщица', f: true, who: 'фонарщица Ива', whom: 'фонарщице Иве', look: 'lamp',
      hp: 44, gold: 20, relic: 'ivalamp', build: 'Огоньки и Вспышки',
      about: 'Копит Огоньки и чаще всех зажигает Вспышки лампы.',
      deck: ['strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'kindle', 'spark', 'spark', 'firefly', 'lampglass'],
      favored: ['kindle', 'spark', 'oil', 'mirror', 'cloak', 'mittens', 'palm', 'flashpoint', 'drafts', 'eveninglamp', 'rhythm', 'sparks', 'icelantern', 'snowstorm', 'starfall', 'lastlight', 'firebird'],
    },
    courier: {
      name: 'Тиша', role: 'Скороход', f: false, who: 'скороход Тиша', whom: 'скороходу Тише', look: 'courier',
      hp: 35, gold: 35, relic: 'wingboots', build: 'Доставка и серии',
      about: 'Играет много дешёвых карт за ход и шлёт Доставки на следующий.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'urgent', 'telegram', 'wind'],
      favored: ['wind', 'parcel', 'telegram', 'surprise', 'flurry', 'finale', 'breath', 'compass', 'inkpen', 'blotter', 'spark', 'cocoa', 'sledram', 'carbon', 'poste', 'moneyorder', 'avalanche', 'registered', 'chimes'],
    },
    guard: {
      name: 'Марфа', role: 'Сторожиха моста', f: true, who: 'сторожиха моста Марфа', whom: 'сторожихе моста Марфе', look: 'guard',
      hp: 40, gold: 15, relic: 'ironshutter', build: 'Защита, Шипы и мороз',
      about: 'Держит удар за ударом и отвечает врагу его же силой.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'guard', 'snowkick'],
      favored: ['cloak', 'wax', 'snowkick', 'payback', 'prickly', 'frostlace', 'umbrella', 'mittens', 'drift', 'pockethog', 'lullaby', 'icethrow', 'heavybag', 'patch', 'nightshift', 'frostbite', 'iceprison', 'eternalwinter'],
    },
    stoker: {
      name: 'Фома', role: 'Трубочист', f: false, who: 'трубочист Фома', whom: 'трубочисту Фоме', look: 'stoker',
      hp: 42, gold: 20, relic: 'sootbroom', build: 'Поджог и частые удары',
      about: 'Разжигает врага каждым ударом и даёт огню сделать остальное.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'ember', 'poker', 'flue'],
      favored: ['ember', 'blaze', 'hearth', 'sparks', 'flurry', 'whistle', 'cocoa', 'stubborn', 'stamp', 'redseal', 'kindling', 'snowstorm', 'hornblow', 'wax', 'mittens', 'cancel', 'bonfire', 'firebird'],
    },
    baker: {
      name: 'Груня', role: 'Пряничница', f: true, who: 'пряничница Груня', whom: 'пряничнице Груне', look: 'baker',
      hp: 42, gold: 25, relic: 'moldform', build: 'Пряники и быстрые ходы',
      about: 'Печёт Пряники прямо в бою. Они ничего не стоят, бьют и защищают.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'dough', 'rollingpin'],
      favored: ['wind', 'cocoa', 'flurry', 'finale', 'inkpen', 'rhythm', 'carbon', 'sbiten', 'compass', 'breath', 'drafts', 'mittens', 'wax', 'chimes'],
    },
    grinder: {
      name: 'Савва', role: 'Точильщик', f: false, who: 'точильщик Савва', whom: 'точильщику Савве', look: 'grinder', paid: true,
      hp: 44, gold: 20, relic: 'grindwheel', build: 'Заточка и Решимость',
      about: 'Точит карты прямо в бою: заточенная карта до конца боя работает как улучшенная.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'hone', 'gritsparks', 'oselok'],
      favored: ['heavy', 'heavybag', 'snowball', 'whistle', 'cocoa', 'hornblow', 'umbrella', 'cloak', 'stubborn', 'secret', 'lastword', 'carbon', 'returnaddr', 'snowkick', 'registered', 'lastlight'],
    },
    shepherd: {
      name: 'Луша', role: 'Пастушка', f: true, who: 'пастушка Луша', whom: 'пастушке Луше', look: 'shepherd', paid: true,
      hp: 36, gold: 20, relic: 'dogfriend', build: 'Верный пёс и команды',
      about: 'Ходит с псом Дружком. Он кусает врага каждый ход, а команды делают его злее.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'sic', 'heel'],
      favored: ['stamp', 'redseal', 'cancel', 'wax', 'shadow', 'cloak', 'umbrella', 'mittens', 'lullaby', 'frostbite', 'nightshift', 'icelantern', 'iceprison', 'eternalwinter'],
    },
    herbalist: {
      name: 'Ульяна', role: 'Знахарка', f: true, who: 'знахарка Ульяна', whom: 'знахарке Ульяне', look: 'herbalist', paid: true,
      hp: 46, gold: 15, relic: 'mortar', build: 'Цена здоровья и травы',
      about: 'Платит за сильные карты своим здоровьем, а потом лечится травами.',
      deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'bitterroot', 'chamomile', 'chamomile'],
      favored: ['tea', 'sbiten', 'heavy', 'lastword', 'cocoa', 'whistle', 'stubborn', 'snowkick', 'cloak', 'payback', 'bonfire', 'breath', 'lullaby', 'returnaddr'],
    },
  };

  /* Уровни сложности. hp и dmg — множители здоровья и урона врагов, heroHp — сколько HP прибавить герою,
     gold — множитель монет за бои, rest — доля HP, которую лечит костёр, bossHeal — доля после босса стадии,
     curses — помехи в колоде с самого начала забега. */
  const DIFFICULTIES = [
    { name: 'Прогулка', hp: 0.75, dmg: 0.8, heroHp: 12, gold: 1.25, rest: 0.5, bossHeal: 0.7, curses: [],
      hint: 'Враги слабее на четверть, у героя +12 HP, больше монет и лечения.' },
    { name: 'Обычный маршрут', hp: 1, dmg: 1, heroHp: 0, gold: 1, rest: 0.4, bossHeal: 0.5, curses: [],
      hint: 'Задуманный баланс игры.' },
    { name: 'Ранние сумерки', hp: 1.15, dmg: 1.1, heroHp: 0, gold: 1, rest: 0.35, bossHeal: 0.4, curses: [],
      hint: 'Враги крепче на 15% и бьют на 10% сильнее. После босса меньше лечения.' },
    { name: 'Метель', hp: 1.25, dmg: 1.15, heroHp: -4, gold: 0.85, rest: 0.3, bossHeal: 0.35, curses: ['blot'],
      hint: 'Враги крепче на 25%, бьют на 15% сильнее. Меньше HP, монет и отдыха. В колоде Клякса.' },
    { name: 'Полярная ночь', hp: 1.35, dmg: 1.2, heroHp: -6, gold: 0.75, rest: 0.25, bossHeal: 0.25, curses: ['blot', 'dread'],
      hint: 'Враги крепче на 35%, бьют на 20% сильнее. Ещё меньше HP, монет и отдыха. В колоде Клякса и Недоставленное письмо.' },
  ];

  // перевод на язык игры: поля подменяются переведёнными (js/i18n.js, js/lang/*.js)
  I18N.patch('cards', CARDS);
  I18N.patch('enemies', ENEMIES);
  I18N.patch('relics', RELICS);
  I18N.patch('events', EVENTS);
  I18N.patch('classes', CLASSES);
  I18N.patch('diff', DIFFICULTIES);

  window.Data = { CARDS, ENEMIES, RELICS, EVENTS, CLASSES, DIFFICULTIES };
})();
