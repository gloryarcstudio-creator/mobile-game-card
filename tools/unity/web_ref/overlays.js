const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { try { localStorage.setItem('lastray.cinema', '1'); } catch (e) {} });
  await p.goto('http://localhost:8791/index.html?lang=ru');
  await p.waitForTimeout(2500);
  const click = async (t) => { await p.getByText(t, { exact: true }).first().click({ timeout: 3000 }).catch(() => console.log('no', t)); await p.waitForTimeout(1200); };
  const back = async () => { await p.reload(); await p.waitForTimeout(2000); };
  for (const [n, t] of [['settings', 'Настройки'], ['gloss', 'Справочник']]) { await click(t); await p.screenshot({ path: 'ov_' + n + '.png' }); await back(); }
  const names = ['ach', 'codex', 'stats', 'store'];
  for (let i = 0; i < 4; i++) { await p.locator('.achbtn').nth(i).click(); await p.waitForTimeout(1300); await p.screenshot({ path: 'ov_' + names[i] + '.png' }); await back(); }
  await b.close();
})();
