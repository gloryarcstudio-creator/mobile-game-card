/* Языки игры: английский, русский, украинский.
   Тексты в коде написаны по-русски, и русский текст служит ключом перевода.
   Переводы лежат в js/lang/en.js и js/lang/uk.js.

   tr('Уровень {n}', { n: 5 }) — строка интерфейса на текущем языке.
   В строке можно писать:
     {n} — подставить значение n;
     {n|монета|монеты|монет} — слово в форме для числа n (в английском две формы: coin|coins);
     {f|пошла|пошёл} — по полу героя забега (I18N.gender задаёт game.js).
   Если одно русское слово в разных местах переводится по-разному, ключ пишется с пометкой:
   tr('лавка::Заточка') — по-русски покажется «Заточка», а переводы ищутся по всему ключу.
   Карты, талисманы, враги, события, герои, сложности и сюжет переводятся целиком по id:
   I18N.patch('cards', CARDS) подменяет их поля на переведённые (см. разделы в файлах языков).
   Язык выбирается в настройках и хранится в lastray.settings.lang. Если его там нет,
   берётся язык телефона (русский или украинский), иначе английский. */
(function () {
  const LANGS = { en: 'English', ru: 'Русский', uk: 'Українська' };
  const LOCALE = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };

  function detect() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (LANGS[q]) return q;
    } catch (e) { /* адрес недоступен */ }
    try {
      const s = JSON.parse(localStorage.getItem('lastray.settings') || '{}');
      if (LANGS[s.lang]) return s.lang;
    } catch (e) { /* хранилище недоступно */ }
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (const l of list) {
      const k = String(l).toLowerCase().slice(0, 2);
      if (LANGS[k]) return k;
    }
    return 'en';
  }
  const lang = detect();
  try { document.documentElement.lang = lang; } catch (e) { /* без документа */ }

  // форма слова для числа: one / few / many (в английском one / other)
  function plural(n, forms) {
    n = Math.abs(Math.trunc(+n || 0));
    if (lang === 'en') return forms[n === 1 ? 0 : 1] != null ? forms[n === 1 ? 0 : 1] : forms[0];
    const a = n % 10; const b = n % 100;
    const i = a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2;
    return forms[i] != null ? forms[i] : forms[forms.length - 1];
  }

  const api = {
    lang, LANGS, locale: LOCALE[lang],
    gender: () => true, // пол героя: true — героиня
    missing: new Set(),  // ключи без перевода (для проверки)
    dict: { en: {}, uk: {} },
    data: { en: {}, uk: {} },
  };

  // подстановка значений, форм слова по числу и по полу героя
  function fill(s, vars) {
    return s.replace(/\{(\w+)((?:\|[^|{}]*)+)?\}/g, (m, k, forms) => {
      if (forms) {
        const list = forms.slice(1).split('|');
        if (k === 'f') return list[api.gender() ? 0 : 1] != null ? list[api.gender() ? 0 : 1] : list[0];
        if (!vars || vars[k] == null) return m;
        return plural(vars[k], list);
      }
      return vars && vars[k] != null ? vars[k] : m;
    });
  }

  function tr(s, vars) {
    if (s == null) return s;
    const cut = s.indexOf('::');
    let out = cut >= 0 ? s.slice(cut + 2) : s;
    if (lang !== 'ru') {
      const d = api.dict[lang][s];
      if (d == null) api.missing.add(s); else out = d;
    }
    if (typeof out === 'function') out = out(vars || {});
    return out.indexOf('{') >= 0 ? fill(out, vars) : out;
  }

  // добавить переводы: strings — строки интерфейса, sections — данные по разделам
  api.add = (l, strings, sections) => {
    Object.assign(api.dict[l], strings || {});
    for (const k of Object.keys(sections || {})) api.data[l][k] = Object.assign(api.data[l][k] || {}, sections[k]);
  };

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  // наложить перевод на объект: вложенные объекты и массивы — по ключам и номерам
  function merge(dst, src) {
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (Array.isArray(v) && Array.isArray(dst[k])) {
        v.forEach((x, i) => {
          if (x == null) return;
          if (isObj(x) && isObj(dst[k][i])) merge(dst[k][i], x); else dst[k][i] = x;
        });
      } else if (isObj(v) && isObj(dst[k])) merge(dst[k], v);
      else dst[k] = v;
    }
  }

  // перевести раздел данных: obj — объект или массив записей, по ключу (или id записи)
  api.patch = (section, obj) => {
    if (lang === 'ru') return obj;
    const src = api.data[lang][section] || {};
    for (const key of Object.keys(obj)) {
      const item = obj[key];
      const id = Array.isArray(obj) && item && item.id != null ? item.id : key;
      const t = src[id];
      if (!t) { api.missing.add(`${section}.${id}`); continue; }
      merge(item, t);
    }
    return obj;
  };

  // достижения: перевод [название, описание] по id, у ступеней ★★★ — по общему id без номера
  api.patchAch = (list) => {
    if (lang === 'ru') return list;
    const src = api.data[lang].ach || {};
    for (const a of list) {
      const t = src[a.id] || (a.stars ? src[a.id.replace(/\d+$/, '')] : null);
      if (!t) { api.missing.add(`ach.${a.id}`); continue; }
      [a.name, a.desc] = t;
    }
    return list;
  };

  api.tr = tr;
  api.plural = plural;
  api.fill = fill;
  // число в записи текущего языка: 1,000 / 1 000
  api.num = (n) => Number(n).toLocaleString(LOCALE[lang]);

  window.I18N = api;
  window.tr = tr;
})();
