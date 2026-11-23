#!/usr/bin/env node
/* Эталоны для тестов Fitil.Core: что выдаёт веб-версия на тех же входах.
   node tools/unity/parity_fixtures.js [OUT]   (по умолчанию unity/Tests/Fixtures)
   tr.json  — tr(ключ, переменные) для всех ключей с подстановками, на трёх языках, для обоих полов героя
   rng.json — первые числа mulberry32 для нескольких зёрен (тот же алгоритм, что в Rng.cs)
   carddesc.json — описания всех карт вне боя на трёх языках, как их рисует cardHTML с apiStatic */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Tests', 'Fixtures'));
fs.mkdirSync(OUT, { recursive: true });

function i18n(lang) {
  const store = { 'lastray.settings': JSON.stringify({ lang }) };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    navigator: { languages: [lang], language: lang }, location: { search: '' },
    document: { documentElement: {} }, URLSearchParams, console, Math,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of ['js/i18n.js', 'js/lang/en.js', 'js/lang/uk.js', 'js/data.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  win.I18N.CARDS = win.Data.CARDS;
  return win.I18N;
}

const keysOf = (I) => Object.keys(I.dict.en);
const NUMS = [0, 1, 2, 3, 5, 11, 12, 14, 21, 22, 25, 101, 111];
const cases = [];
for (const lang of ['ru', 'en', 'uk']) {
  const I = i18n(lang);
  for (const key of keysOf(I)) {
    const vars = [...new Set([...key.matchAll(/\{(\w+)[|}]/g)].map((m) => m[1]).filter((k) => k !== 'f'))];
    const gendered = key.includes('{f|') || (I.dict[lang] && String(I.dict[lang][key] || '').includes('{f|'));
    if (!vars.length && !gendered && !key.includes('::')) continue;
    for (const fem of gendered ? [true, false] : [true]) {
      I.gender = () => fem;
      const nums = vars.length ? NUMS : [0];
      for (const n of nums) {
        const v = {};
        vars.forEach((k, i) => { v[k] = n + i; });
        cases.push({ lang, key, vars: v, fem, out: I.tr(key, v) });
      }
    }
  }
}
fs.writeFileSync(path.join(OUT, 'tr.json'), JSON.stringify(cases));

// apiStatic из game.js: g вне боя
const apiStatic = { state: null, played: 0, blockNow: 0, dmgText: (n) => `${n}`, blkText: (n) => `${n}`, blkNum: (n) => n, thornsGain: (n) => n, thornsText: (n) => `${n}`, burnNum: (n) => n, burnText: (n) => `${n}`, vulnNum: (n) => n };
const desc = [];
for (const lang of ['ru', 'en', 'uk']) {
  const I = i18n(lang);
  for (const id of Object.keys(I.CARDS)) {
    for (const up of [false, true]) desc.push({ lang, id, up, out: I.CARDS[id].desc(apiStatic, up, { id, up }) });
  }
}
fs.writeFileSync(path.join(OUT, 'carddesc.json'), JSON.stringify(desc));

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = [1, 42, 123456789, 4294967295].map((seed) => {
  const r = mulberry32(seed);
  return { seed, values: Array.from({ length: 50 }, r) };
});
fs.writeFileSync(path.join(OUT, 'rng.json'), JSON.stringify(rng));
console.log(`tr: ${cases.length} случаев, описаний карт: ${desc.length}, rng: ${rng.length} зёрен`);
