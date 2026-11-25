const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { try { localStorage.setItem('lastray.cinema', '1'); } catch (e) {} });
  await p.goto('http://localhost:8791/index.html?lang=ru');
  await p.waitForTimeout(2500);
  const click = async (t) => { await p.getByText(t, { exact: false }).first().click({ timeout: 3000, force: true }).catch(() => console.log('no', t)); };
  const dump = async (n, depth = 5) => {
    await p.waitForTimeout(1800); await p.screenshot({ path: 'end_' + n + '.png' });
    const out = await p.evaluate((depth) => {
      const res = []; let k = 0;
      const walk = (el, d, pre) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || k++ > 80) return;
        const cs = getComputedStyle(el);
        const txt = el.children.length === 0 ? (el.textContent || '').trim().slice(0, 22) : '';
        res.push(`${pre}${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] fs${parseFloat(cs.fontSize)}${txt ? ' "' + txt + '"' : ''}`);
        if (d < depth) for (const c of el.children) walk(c, d + 1, pre + '  ');
      };
      walk(document.querySelector('#screen'), 0, '');
      const g = document.querySelector('#gear').getBoundingClientRect(); res.push('gear ' + Math.round(g.top));
      return res.join('\n');
    }, depth);
    console.log('=== ' + n + '\n' + out);
  };
  await click('Новая игра'); await p.waitForTimeout(800); await click('В путь'); await p.waitForTimeout(800); await click('В путь'); await p.waitForTimeout(1200);
  const want = process.argv[2];
  if (want === 'lose') { await p.evaluate(() => Game.endRun()); await dump('lose'); await click('Итоги'); await dump('summary'); }
  if (want === 'win') { await p.evaluate(() => Game.goVictory()); await dump('win'); }
  await b.close();
})();
