#!/usr/bin/env node
/* Выгрузка данных веб-версии для Unity.
   node tools/unity/export_data.js [OUT]   (по умолчанию unity/Assets/Fitil/Resources/Data)

   Загружает js-файлы игры в песочнице (без браузера) по одному разу на язык
   и пишет JSON, который читает Fitil.Core:
     data.<lang>.json  — карты, враги, талисманы, события, герои, сложности, сюжет, лор, достижения
                         с уже переведёнными полями (функции выброшены: их код переносится на C#)
     strings.<lang>.json — строки интерфейса: русский ключ -> перевод (en, uk)
     export_report.json — что не удалось выгрузить данными (функции-переводы и т. п.)
   Русская версия — источник ключей, поэтому strings.ru.json нет. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Assets', 'Fitil', 'Resources', 'Data'));
const FILES = ['js/i18n.js', 'js/lang/en.js', 'js/lang/uk.js', 'js/data.js', 'js/story.js', 'js/lore.js', 'js/achievements.js'];

function sandbox(lang) {
  const store = { 'lastray.settings': JSON.stringify({ lang }) };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { languages: [lang], language: lang },
    location: { search: '' },
    document: { documentElement: {}, getElementById: () => null, createElement: () => ({ style: {} }) },
    URLSearchParams,
    console,
    Math,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return win;
}

// функции и undefined уходят, остальное — как есть; отмечаем, какие поля были функциями
function plain(v, where, fnFields) {
  if (typeof v === 'function') { fnFields.add(where); return undefined; }
  if (Array.isArray(v)) return v.map((x, i) => plain(x, `${where}[]`, fnFields));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      const x = plain(v[k], `${where}.${k}`, fnFields);
      if (x !== undefined) o[k] = x;
    }
    return o;
  }
  return v;
}

fs.mkdirSync(OUT, { recursive: true });
const report = { functionFields: {}, functionStrings: {}, counts: {} };

for (const lang of ['ru', 'en', 'uk']) {
  const w = sandbox(lang);
  const D = w.Data;
  const fnFields = new Set();
  const data = {
    cards: plain(D.CARDS, 'cards.*', fnFields),
    enemies: plain(D.ENEMIES, 'enemies.*', fnFields),
    relics: plain(D.RELICS, 'relics.*', fnFields),
    events: plain(D.EVENTS, 'events', fnFields),
    classes: plain(D.CLASSES, 'classes.*', fnFields),
    difficulties: plain(D.DIFFICULTIES, 'difficulties', fnFields),
    story: plain(w.Story, 'story', fnFields),
    lore: plain(w.Lore, 'lore', fnFields),
    achievements: plain(w.Achievements, 'achievements', fnFields),
  };
  // ключи записей одинаковые во всех языках: '*' вместо id
  const norm = (s) => s;
  report.functionFields[lang] = [...fnFields].map(norm).sort();
  fs.writeFileSync(path.join(OUT, `data.${lang}.json`), JSON.stringify(data, null, 1));
  report.counts[lang] = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Object.keys(v).length]));

  if (lang !== 'ru') {
    const dict = w.I18N.dict[lang];
    const strings = {};
    const fns = [];
    for (const k of Object.keys(dict)) {
      if (typeof dict[k] === 'string') strings[k] = dict[k]; else fns.push(k);
    }
    report.functionStrings[lang] = fns;
    report.counts[lang].strings = Object.keys(strings).length;
    fs.writeFileSync(path.join(OUT, `strings.${lang}.json`), JSON.stringify(strings, null, 1));
  }
}

fs.writeFileSync(path.join(OUT, 'export_report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.counts));
for (const l of ['en', 'uk']) console.log(`${l}: строк-функций ${report.functionStrings[l].length}`);
console.log(`поля-функции (ru): ${report.functionFields.ru.length}`);
