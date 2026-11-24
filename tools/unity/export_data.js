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

// GLOSS_RU живёт в game.js вместе с числами, на которые ссылается: берём список и эти числа как есть
function glossRu() {
  const game = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
  const a = game.indexOf('const GLOSS_RU = [');
  const b = game.indexOf('\n  ];', a) + 5;
  const body = game.slice(a, b);
  const names = [...new Set([...body.matchAll(/\b([A-Z][A-Z_]{2,})\b/g)].map((m) => m[1]))].filter((n) => n !== 'GLOSS_RU');
  const consts = names.map((n) => {
    const m = game.match(new RegExp(`const ${n} = ([^;]+);`));
    if (!m) throw new Error(`справочник: нет числа ${n} в game.js`);
    return `const ${n} = ${m[1]};`;
  }).join('\n');
  return vm.runInNewContext(`${consts}\n${body}\nGLOSS_RU`, {});
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
  // тексты сюжета, которые зависят от героя (intro, winText, loseText — функции от героя): готовый текст для каждого героя
  data.storyHero = {};
  for (const [sid, st] of Object.entries(w.Story.STORIES)) {
    const out = {};
    for (const f of ['intro', 'winText', 'loseText']) {
      if (typeof st[f] !== 'function') continue;
      out[f] = Object.fromEntries(Object.keys(D.CLASSES).map((cls) => [cls, st[f]({ ...D.CLASSES[cls], id: cls })]));
    }
    data.storyHero[sid] = out;
  }
  // строка под названием стадии на карте пути (countdown — функция): три шаблона с {left}, {level}, {total}
  data.storyText = {};
  for (const [sid, st] of Object.entries(w.Story.STORIES)) {
    if (typeof st.countdown !== 'function') continue;
    const fill = (s) => String(s).replace(/9001/g, '{left}').replace(/9002/g, '{level}').replace(/9003/g, '{total}');
    data.storyText[sid] = {
      countdownLeft: fill(st.countdown({ left: 9001, level: 9002, total: 9003, stage: 0, final: false })),
      countdownBoss: fill(st.countdown({ left: 0, level: 9002, total: 9003, stage: 0, final: false })),
      countdownFinal: fill(st.countdown({ left: 0, level: 9002, total: 9003, stage: 2, final: true })),
    };
    // правило пути на странице вступления (pathRule — функция от числа уровней)
    if (typeof st.pathRule === 'function') data.storyText[sid].pathRule = fill(st.pathRule(9003));
  }
  // справочник (GLOSS_RU в game.js): термин и пояснение на языке игры
  data.gloss = glossRu().map(([k, v, vars]) => [w.tr(k), w.tr(v, vars)]);
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
