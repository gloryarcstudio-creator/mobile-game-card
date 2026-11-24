const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { try { localStorage.setItem('lastray.cinema', '1'); } catch (e) {} });
  await p.goto('http://localhost:8791/index.html?lang=ru');
  await p.waitForTimeout(2500);
  const dump = async (n, depth = 3) => {
    await p.waitForTimeout(1600);
    const out = await p.evaluate((depth) => {
      const res = [];
      const walk = (el, d, pre) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const cs = getComputedStyle(el);
        const txt = el.children.length === 0 ? (el.textContent || '').trim().slice(0, 24) : '';
        res.push(`${pre}${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] fs${parseFloat(cs.fontSize)}${txt ? ' "' + txt + '"' : ''}`);
        if (d < depth) for (const c of el.children) walk(c, d + 1, pre + '  ');
      };
      walk(document.querySelector('#screen'), 0, '');
      for (const id of ['#gear', '#menu']) { const e = document.querySelector(id); if (e) { const r = e.getBoundingClientRect(); res.push(`${id} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] ${getComputedStyle(e).display}`); } }
      const sv = document.querySelector('#bg .bg-cam'); if (sv) res.push('cam ' + sv.style.transform + ' low ' + (sv.querySelector('.bg-low') || {getAttribute(){return ''}}).getAttribute('transform'));
      return res.join('\n');
    }, depth);
    console.log('=== ' + n + '\n' + out);
  };
  const click = async (t) => { await p.getByText(t, { exact: false }).first().click({ timeout: 3000 }).catch(() => console.log('no', t)); };
  const want = process.argv[2] || '';
  const G = (code) => p.evaluate(code);
  if (want === 'title') { await dump('title', 4); }
  await click('Новая игра'); if (want === 'heroes') await dump('heroes', 5);
  await click('В путь'); if (want === 'intro') await dump('intro', 4);
  await click('В путь'); if (want === 'map') await dump('map', 5);
  if (want === 'combat') { await G(() => Game.startCombat('scarfsnake')); await dump('combat', 4); }
  if (want === 'talk') { await G(() => Game.goTalk('scarfsnake')); await dump('talk', 4); }
  if (want === 'shop') { await G(() => Game.goShop()); await dump('shop', 4); }
  if (want === 'rest') { await G(() => Game.goRest()); await dump('rest', 4); }
  if (want === 'chest') { await G(() => Game.goChest()); await dump('chest', 4); }
  if (want === 'meet') { await G(() => Game.goMeet('courier')); await dump('meet', 4); }
  if (want === 'after') { await G(() => Game.goAfter('fight', 'scarfsnake')); await dump('after', 4); }
  if (want === 'boss') { await G(() => Game.startCombat(Object.keys(Game.combat ? {} : {}).length ? '' : 'x')).catch(()=>{}); }
  await b.close();
})();
