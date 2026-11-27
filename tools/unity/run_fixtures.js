#!/usr/bin/env node
/* Эталонные забеги для сверки логики забега на C# (RunGame) с веб-версией.
   node tools/unity/run_fixtures.js [OUT]   (по умолчанию unity/Tests/Fixtures/runs.json)

   Настоящая игра в Chromium с виртуальными часами, как в combat_fixtures.js: Math.random для логики
   заменён генератором mulberry32 с зерном забега. Бот нажимает кнопки на экранах, как игрок:
   развилка — по кругу (n-я развилка забега → вариант n по модулю), бой — первая карта, которую можно
   разыграть, разговор — последний доступный ответ, событие и встреча — первый доступный ответ,
   выбор карты из колоды — первая в окне (окно сортирует по id), лавка — первая карта, сбитень,
   обновить товар, костёр — отдых (или заточка, или сжечь), сундук — открыть, пощада — пощадить,
   трофей босса и награда — первый вариант. Тест C# играет тем же ботом и сверяет состояние
   забега на каждой развилке. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Tests', 'Fixtures', 'runs.json'));
const URL = 'file://' + path.join(ROOT, 'index.html') + '?lang=ru';
const HEROES = ['lamp', 'courier', 'guard', 'stoker', 'baker', 'grinder', 'shepherd', 'herbalist'];
const SEEDS = [11, 222, 3333];

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*.webp', (r) => r.abort());
  await p.route('**/*.mp3', (r) => r.abort());
  await p.addInitScript(() => {
    const st = window.setTimeout; window.__st = st;
    const q = []; let now = 0; let seq = 0; let id = 0; const dead = new Set(); let pending = false;
    const ch = new MessageChannel();
    const kick = () => { if (!pending) { pending = true; ch.port2.postMessage(0); } };
    ch.port1.onmessage = () => {
      pending = false; if (!q.length) return;
      let bi = 0; for (let i = 1; i < q.length; i++) if (q[i].t < q[bi].t || (q[i].t === q[bi].t && q[i].s < q[bi].s)) bi = i;
      const it = q.splice(bi, 1)[0]; now = Math.max(now, it.t);
      if (!dead.delete(it.id)) { try { it.f(...it.a); } catch (e) { st(() => { throw e; }); } }
      if (q.length) kick();
    };
    window.setTimeout = (f, ms, ...a) => { const my = ++id; q.push({ t: now + (+ms || 0), s: seq++, f, a, id: my }); kick(); return my; };
    window.clearTimeout = (i) => { if (q.some((x) => x.id === i)) dead.add(i); };
    window.__qlen = () => q.length;
    const realNow = performance.now.bind(performance);
    performance.now = () => realNow() + now;
    localStorage.setItem('lastray.cinema', '1');
    localStorage.setItem('lastray.store', JSON.stringify({ owned: ['noads'] }));
    localStorage.setItem('lastray.settings', JSON.stringify({ anim: 'fast', sfx: 0, music: 0, snow: false, lines: true, lang: 'ru', skipIntro: true }));
    const mul = (a) => () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const orig = Math.random.bind(Math);
    let logic = null; const ui = mul(7);
    const UI = /floatText|lineOf|\bsay\b|snow|\/fx\.js|\/audio\.js|\/paint\.js|\/art\.js|achFit|toast/;
    Math.random = () => {
      if (!logic) return orig();
      const s = new Error().stack;
      return UI.test(s) ? ui() : logic();
    };
    window.__seed = (n) => { logic = n == null ? null : mul(n >>> 0); };
  });
  await p.goto(URL);
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    for (const k of Object.keys(window.Art)) { const f = window.Art[k]; if (typeof f === 'function' && !['bgUrl', 'enemyUrl', 'actDur', 'act', 'groundCam'].includes(k)) window.Art[k] = () => ''; }
    window.Art.enemyLive = null; window.Art.actDur = () => 0; window.Art.act = () => 0;
    window.Art.quiet = () => Promise.resolve(); if (window.Sound) window.Sound.music = () => {};
    window.FX.play = async () => {}; window.FX.relic = () => {}; window.FX.warm = () => {};
  });

  const out = [];
  for (const cls of HEROES) {
    for (const seed of SEEDS) {
      const r = await p.evaluate(async ({ cls, seed }) => {
        const G = window.Game; const D = window.Data;
        const $ = (s) => document.querySelector(s);
        const scr = () => document.getElementById('screen');
        const ov = () => document.getElementById('overlay');
        const wait = () => new Promise((res) => window.__st(res, 0));
        // ждём, пока очередь таймеров не опустеет или не останутся только долгие (снег, подсказки)
        const idle = async () => { for (let k = 0; k < 3000; k++) { await wait(); if ((!G.combat || !G.busy) && !(scr().style.pointerEvents === 'none')) { for (let j = 0; j < 30; j++) await wait(); if ((!G.combat || !G.busy) && scr().style.pointerEvents !== 'none') return; } } };
        const click = async (el) => { el.click(); await idle(); };
        const snap = () => {
          const run = G.run;
          return {
            step: run.step, hp: run.hp, maxHp: run.maxHp, gold: run.gold,
            deck: run.deck.map((c) => c.id + (c.up ? '+' : '')), relics: [...run.relics],
            choices: (run.choices || []).map((o) => [o.t, o.enemy || o.ev || o.hero || '', o.last ? 'last' : ''].join(':')),
          };
        };
        window.__seed(seed);
        G.newRun(cls, 1);
        await idle();
        const steps = [];
        let maps = 0; let end = 'open'; let shopStage = 0; let last = '';
        for (let n = 0; n < 6000; n++) {
          const cn = scr().className;
          if (ov().classList.contains('show')) {
            const card = ov().querySelector('.card[data-uid]');
            if (card) { await click(card); continue; }
            const close = ov().querySelector('[data-act="close"]'); if (close) { await click(close); continue; }
          }
          if (cn === 'scr-map') {
            if (!G.run.choices) { await idle(); continue; }
            steps.push(snap());
            const encs = [...scr().querySelectorAll('[data-act="choose"]')];
            const i = maps % encs.length; maps++;
            shopStage = 0;
            await click(encs[i]);
            continue;
          }
          if (cn === 'scr-combat') {
            const C = G.combat;
            if (!C) { await idle(); continue; }
            const i = C.hand.findIndex((c) => {
              const cost = G.playCost(c);
              if (cost == null || cost > C.energy) return false;
              const pr = D.CARDS[c.id].price ? D.CARDS[c.id].price(c.up) : 0;
              return !(pr && pr >= G.run.hp);
            });
            if (i >= 0) G.play(i); else G.endTurn();
            await idle();
            continue;
          }
          const btn = (sel) => [...scr().querySelectorAll(sel)].filter((x) => !x.classList.contains('off') && !x.disabled);
          if (cn === 'scr-talk') {
            const opts = btn('[data-act="talkopt"]');
            if (opts.length) { await click(opts[opts.length - 1]); continue; }
            const sp = btn('[data-act="spare"]'); if (sp.length) { await click(sp[0]); continue; }
            const go = btn('[data-act="talkgo"],[data-act="talkboss"],[data-act="afternext"],[data-act="next"]'); if (go.length) { await click(go[0]); continue; }
          }
          if (cn === 'scr-event' || cn === 'scr-meet') {
            const opts = btn('[data-act="evopt"],[data-act="meetopt"]');
            if (opts.length) { await click(opts[0]); continue; }
            const go = btn('[data-act="next"]'); if (go.length) { await click(go[0]); continue; }
          }
          if (cn === 'scr-shop') {
            const acts = ['[data-act="buy"][data-i="0"]', '[data-act="buytea"]', '[data-act="reroll"]', '[data-act="next"]'];
            const el = scr().querySelector(acts[Math.min(shopStage, 3)]); shopStage++;
            if (el) { await click(el); continue; }
          }
          if (cn === 'scr-rest') {
            const h = btn('[data-act="rest-heal"]');
            if (h.length) { await click(h[0]); continue; }
            const canUp = G.run.deck.some((c) => !c.up && D.CARDS[c.id].rarity !== 'status');
            await click(scr().querySelector(canUp ? '[data-act="rest-up"]' : '[data-act="rest-burn"]'));
            continue;
          }
          if (cn === 'scr-chest') { const o = btn('[data-act="openchest"]'); await click(o.length ? o[0] : scr().querySelector('[data-act="next"]')); continue; }
          if (cn === 'scr-reward') { await click(scr().querySelector('[data-act="takecard"]')); continue; }
          if (cn === 'scr-bossrelic') { const br = scr().querySelector('[data-act="bossrelic"]'); await click(br || scr().querySelector('[data-act="bossrelic-skip"]')); continue; }
          if (cn.startsWith('scr-end')) { end = cn.includes('win') ? 'win' : 'defeat'; break; }
          if (cn === last) await idle();
          last = cn;
          await idle();
        }
        const fin = snap();
        window.__seed(null);
        return { cls, seed, end, steps, fin };
      }, { cls, seed });
      out.push(r);
      process.stdout.write(`${cls}/${seed}: ${r.end} на шаге ${r.fin.step + 1}, развилок ${r.steps.length}\n`);
    }
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(out));
  if (errs.length) console.log('ошибки страницы:', [...new Set(errs)].slice(0, 5));
}

main().catch((e) => { console.error(e); process.exit(1); });
