#!/usr/bin/env node
/* Описания карт для Unity.
   node tools/unity/export_card_text.js [OUT]   (по умолчанию unity/Assets/Fitil/Resources/Data)

   В веб-версии описание карты — функция desc(g, u, c) на каждом языке. Здесь каждая функция
   вызывается с «меченым» g: вместо чисел урона, защиты, Шипов, Поджога и Уязвимости она получает
   метки вида ⟦dmg:6⟧, и получается шаблон. C# (Fitil.Core.CardText) подставляет в метки числа
   с поправками боя и талисманов, как это делают g.dmgText и другие в game.js.
   Карты, текст которых зависит от хода боя (g.state, g.played, g.blockNow, g.lastCard, экземпляр c),
   получают шаблон вне боя и попадают в список dynamic: их боевой текст пишется на C# вручную.
   Пишет cardtext.<lang>.json: { id: { base, up, price?: [обычная, улучшенная], dynamic? } }. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Assets', 'Fitil', 'Resources', 'Data'));
const FILES = ['js/i18n.js', 'js/lang/en.js', 'js/lang/uk.js', 'js/data.js'];

function load(lang) {
  const store = { 'lastray.settings': JSON.stringify({ lang }) };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    navigator: { languages: [lang], language: lang }, location: { search: '' },
    document: { documentElement: {} }, URLSearchParams, console, Math,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return win;
}

// g вне боя, как apiStatic в game.js, но числа помечены
function marked(touched) {
  const mark = (kind) => (n, spent) => { touched.add(kind); return `⟦${kind}:${n}${spent ? ':spent' : ''}⟧`; };
  const g = {
    dmgText: mark('dmg'), blkText: mark('blk'), thornsText: mark('thorns'), burnText: mark('burn'),
    blkNum: (n) => { touched.add('blkNum'); return n; },
    thornsGain: (n) => { touched.add('thornsGain'); return n; },
    burnNum: (n) => { touched.add('burnNum'); return n; },
    vulnNum: (n) => { touched.add('vulnNum'); return n; },
  };
  for (const k of ['state', 'played', 'blockNow', 'lastCard', 'enemyDead']) {
    Object.defineProperty(g, k, { get() { touched.add(k); return k === 'state' || k === 'lastCard' ? null : 0; } });
  }
  return g;
}

function instProxy(id, up, touched) {
  return new Proxy({ id, up }, { get(t, k) { if (k !== 'id' && k !== 'up' && typeof k === 'string') touched.add(`c.${k}`); return t[k]; } });
}

const DYNAMIC = new Set(['state', 'played', 'blockNow', 'lastCard', 'enemyDead', 'blkNum', 'thornsGain', 'burnNum', 'vulnNum']);
const summary = {};
for (const lang of ['ru', 'en', 'uk']) {
  const { CARDS } = load(lang).Data;
  const out = {};
  const dyn = [];
  for (const id of Object.keys(CARDS)) {
    const c = CARDS[id];
    const touched = new Set();
    const e = {
      base: c.desc(marked(touched), false, instProxy(id, false, touched)),
      up: c.desc(marked(touched), true, instProxy(id, true, touched)),
    };
    if (typeof c.price === 'function') e.price = [c.price(false), c.price(true)];
    const why = [...touched].filter((k) => DYNAMIC.has(k) || k.startsWith('c.'));
    if (why.length) { e.dynamic = why.sort(); dyn.push(id); }
    out[id] = e;
  }
  fs.writeFileSync(path.join(OUT, `cardtext.${lang}.json`), JSON.stringify(out, null, 1));
  summary[lang] = { cards: Object.keys(out).length, dynamic: dyn.length };
}
console.log(JSON.stringify(summary));
