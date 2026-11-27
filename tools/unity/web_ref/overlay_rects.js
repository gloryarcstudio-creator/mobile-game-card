const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { try { localStorage.setItem('lastray.cinema', '1'); } catch (e) {} });
  await p.goto('http://localhost:8791/index.html?lang=ru');
  await p.waitForTimeout(2500);
  const want = process.argv[2]; const depth = +(process.argv[3] || 4);
  const idx = { ach: 0, codex: 1, stats: 2, store: 3 }[want];
  if (idx != null) await p.locator('.achbtn').nth(idx).click();
  else await p.getByText(want === 'gloss' ? 'Справочник' : 'Настройки', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  const out = await p.evaluate((depth) => {
    const res = []; let n = 0;
    const walk = (el, d, pre) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.top > 900) return;
      if (n++ > 90) return;
      const cs = getComputedStyle(el);
      const txt = el.children.length === 0 ? (el.textContent || '').trim().slice(0, 22) : '';
      res.push(`${pre}${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] fs${parseFloat(cs.fontSize)}${txt ? ' "' + txt + '"' : ''}`);
      if (d < depth) for (const c of el.children) walk(c, d + 1, pre + '  ');
    };
    const ov = document.querySelector('#overlay');
    const root = ov && ov.getBoundingClientRect().width > 2 && ov.children.length ? ov : document.querySelector('#screen');
    walk(root, 0, '');
    return res.join('\n');
  }, depth);
  console.log('=== ' + want + '\n' + out);
  await b.close();
})();
