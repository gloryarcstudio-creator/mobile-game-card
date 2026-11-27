#!/usr/bin/env node
/* Эталонные бои для сверки боя на C# с веб-версией.
   node tools/unity/combat_fixtures.js [OUT]   (по умолчанию unity/Tests/Fixtures/combats.json)

   Настоящая игра (index.html) в Chromium с виртуальными часами, как в tools/sim/sim.js.
   Перед боем Math.random заменяется генератором mulberry32 с зерном (как Fitil.Core.Rng),
   но только для логики: эффекты, всплывающие надписи, снег и реплики врагов берут числа
   из своего генератора, потому что в Unity они живут отдельно от боя.
   Бот играет просто и однозначно: первую карту, которую можно разыграть, иначе конец хода.
   После каждого действия записывается состояние боя; тест C# повторяет те же действия
   с тем же зерном и сравнивает состояние. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Tests', 'Fixtures', 'combats.json'));
const URL = 'file://' + path.join(ROOT, 'index.html') + '?lang=ru';

const HEROES = ['lamp', 'courier', 'guard', 'stoker', 'baker', 'grinder', 'shepherd', 'herbalist'];
// враги с особыми приёмами и боссы: туман, матрёшка, шутиха, кипяток, кукушка, колотушка, латы, кража, упырь
const ENEMIES = [
  ['inkcat', 'fight', 3], ['matryoshka', 'fight', 4], ['samovar', 'fight', 6], ['cuckoo', 'fight', 8], ['mist', 'fight', 30],
  ['firecracker', 'fight', 32], ['ghoul', 'fight', 34], ['shadowthief', 'fight', 28], ['iceknight', 'elite', 15], ['watchman', 'elite', 40],
  ['owl', 'elite', 12], ['magpie', 'boss', 24], ['waxgiant', 'boss', 24], ['wolf', 'boss', 49], ['troll', 'boss', 49], ['shadowking', 'boss', 50],
];
// наборы талисманов, которые меняют правила боя
const RELIC_SETS = [
  [], ['bell', 'feather', 'thimble'], ['pencil', 'magnifier', 'mirrorshard'], ['frostring', 'stamppad', 'matchbox', 'wreath', 'pinecone'],
  ['bellows', 'flint', 'ivalamp', 'wickcutter', 'stub'], ['hourglass', 'moonstone', 'ribbon', 'magicbag'], ['horseshoe', 'lastcandle', 'ironshutter', 'hotstone'],
  ['chimneycap', 'stokerglove', 'sootbroom', 'brazier', 'milestone', 'stampbook'], ['bookmark', 'grindwheel', 'collar', 'mortar', 'dogfriend', 'horn', 'oilcan'],
];

async function main() {
  const allCards = JSON.parse(fs.readFileSync(path.join(ROOT, 'unity/Assets/Fitil/Resources/Data/data.ru.json'), 'utf8')).cards;
  const playable = Object.keys(allCards).filter((id) => !['start', 'status', 'token'].includes(allCards[id].rarity));
  const jobs = [];
  let seed = 1000;
  HEROES.forEach((cls, hi) => {
    ENEMIES.forEach(([enemy, tier, step], ei) => {
      const relics = RELIC_SETS[(hi + ei) % RELIC_SETS.length];
      // колода: стартовая героя + 6 карт по кругу из всех, часть улучшена
      const extra = Array.from({ length: 6 }, (_, k) => playable[(hi * 31 + ei * 7 + k * 13) % playable.length]);
      jobs.push({ cls, enemy, tier, step, relics, extra, upEvery: 3 + (ei % 3), seed: seed++ });
    });
  });

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
    localStorage.setItem('lastray.cinema', '1');
    localStorage.setItem('lastray.settings', JSON.stringify({ anim: 'fast', sfx: 0, music: 0, snow: false, lines: true, lang: 'ru' }));
    // генераторы: логика боя и всё остальное
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
  for (const job of jobs) {
    const r = await p.evaluate(async (job) => {
      const G = window.Game; const D = window.Data;
      const wait = () => new Promise((res) => window.__st(res, 0));
      const idle = async () => { for (let k = 0; k < 4000; k++) { await wait(); if (!G.combat || !G.busy) { for (let j = 0; j < 20; j++) await wait(); if (!G.combat || !G.busy) return; } } throw new Error('бой завис'); };
      window.__seed(null);
      G.newRun(job.cls, 1);
      const run = G.run;
      run.step = job.step;
      run.killed = [];
      for (const rid of job.relics) if (!run.relics.includes(rid)) run.relics.push(rid);
      job.extra.forEach((id) => run.deck.push(G.mk(id)));
      run.deck.forEach((c, i) => { c.up = i % job.upEvery === 0; });
      run.gold = 50;
      const deck = run.deck.map((c) => ({ id: c.id, up: c.up }));
      const start = { hp: run.hp, maxHp: run.maxHp, gold: run.gold, relics: [...run.relics], deck };
      const ids = (l) => l.map((c) => c.id + (c.up ? '+' : '') + (c.grow ? `~g${c.grow}` : '') + (c.mult > 1 ? `~m${c.mult}` : ''));
      const snap = (C, act) => ({
        act, hp: run.hp, maxHp: run.maxHp, gold: run.gold,
        energy: C.energy, block: C.block, flame: C.flame, str: C.str, tmpStr: C.tmpStr, thorns: C.thorns, pWeak: C.pWeak, frail: C.frail,
        dog: C.dog, paid: C.paid, turn: C.turn, played: C.playedTurn,
        e: { hp: C.enemy.hp, max: C.enemy.max, block: C.enemy.block, str: C.enemy.str, weak: C.enemy.weak, vuln: C.enemy.vuln, burn: C.enemy.burn, thorns: C.enemy.thorns, stun: C.enemy.stun, pi: C.enemy.pi, nest: C.enemy.nest, boil: C.enemy.boil, mist: C.enemy.mist },
        hand: ids(C.hand), draw: ids(C.draw), disc: ids(C.disc), exh: ids(C.exh),
        charms: { ...C.charms }, dels: C.deliveries.length,
      });
      window.__seed(job.seed);
      G.startCombat(job.enemy, job.tier);
      const C0 = G.combat;
      const meta = { att: C0.att || null, tie: C0.tie || null };
      await idle();
      const steps = [snap(C0, 'start')];
      let end = null;
      for (let n = 0; n < 80; n++) {
        const C = G.combat;
        if (!C) break;
        const i = C.hand.findIndex((c) => {
          const cost = G.playCost(c);
          if (cost == null || cost > C.energy) return false;
          const pr = D.CARDS[c.id].price ? D.CARDS[c.id].price(c.up) : 0;
          return !(pr && pr >= run.hp);
        });
        if (i >= 0) G.play(i); else G.endTurn();
        await idle();
        steps.push(snap(C, i >= 0 ? `play ${i}` : 'end'));
        if (!G.combat || G.combat !== C) { end = run.hp <= 0 || C.enemy.hp > 0 ? 'defeat' : 'win'; break; }
      }
      window.__seed(null);
      return { ...job, ...meta, start, steps, end };
    }, job);
    out.push(r);
    // поражение открывает экран итогов: возвращаемся на титул перед следующим боем
    await p.evaluate(() => { try { window.Game.endRun && 0; } catch (e) { /* пусто */ } });
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(out));
  const ends = out.reduce((a, r) => { a[r.end || 'open'] = (a[r.end || 'open'] || 0) + 1; return a; }, {});
  console.log(`боёв: ${out.length}, действий: ${out.reduce((a, r) => a + r.steps.length, 0)}, итоги: ${JSON.stringify(ends)}`);
  if (errs.length) console.log('ошибки страницы:', [...new Set(errs)].slice(0, 5));
}

main().catch((e) => { console.error(e); process.exit(1); });
