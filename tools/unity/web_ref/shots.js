const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 860 } });
  await p.addInitScript(() => { try { localStorage.setItem('lastray.cinema', '1'); } catch (e) {} });
  await p.goto('http://localhost:8791/index.html?lang=ru');
  await p.waitForTimeout(2500);
  const shot = async (n, w = 900) => { await p.waitForTimeout(w); await p.screenshot({ path: n + '.png' }); console.log(n, await p.evaluate(() => document.querySelector('#screen').className)); };
  await shot('00_first');
  // пропустить заставку, если идёт
  for (let i = 0; i < 3; i++) { const s = await p.$('.cine-skip, .skip'); if (s) { await s.click().catch(() => {}); await p.waitForTimeout(900); } }
  await shot('01_title');
  const click = async (t) => { const el = p.getByText(t, { exact: false }).first(); await el.click({ timeout: 3000 }).catch((e) => console.log('no', t)); };
  await click('Новая игра'); await shot('02_heroes');
  await click('В путь'); await shot('03_intro');
  await click('В путь'); await shot('04_map', 1500);
  const G = (code) => p.evaluate(code);
  await G(() => Game.startCombat('scarfsnake')); await shot('05_combat', 2500);
  await p.locator('.hand .card').first().click().catch(() => console.log('nocard')); await shot('06_combat_sel', 600);
  await G(() => Game.goTalk('scarfsnake')); await shot('07_talk', 1500);
  await G(() => Game.goShop()); await shot('08_shop', 1500);
  await G(() => Game.goRest()); await shot('09_rest', 1500);
  await G(() => Game.goChest()); await shot('10_chest', 1500);
  await G(() => Game.goMeet('courier')); await shot('11_meet', 1500);
  await G(() => Game.goAfter('fight', 'scarfsnake')); await shot('12_after', 1500);
  await G(() => Game.goMap()); await shot('13_map2', 1500);
  await p.click('#gear').catch(() => console.log('nogear')); await shot('14_settings');
  await b.close();
})();
