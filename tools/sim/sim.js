// Прогон забегов ботом для настройки баланса. Бот играет разумно: считает урон врага, закрывается, добивает,
// собирает колоду с оглядкой на защиту, отдыхает при малом здоровье. Поражение не переигрывает.
// Игра идёт настоящая (index.html), но без картинок и с виртуальными часами, поэтому забег занимает секунды.
//
// usage: node tools/sim/sim.js <забегов на героя> <сложность 0..4> <герои через запятую|all> [потоков] [адрес страницы]
//   OUT=файл.json   куда записать забеги (по умолчанию sim_d<сложность>.json в текущей папке)
//   BAL='{"hpStep":0.06}'   подменить числа Game.bal на время прогона
//   DIFFO='{"rest":0.5}'    подменить поля уровня сложности
//   LIMIT=25                сторож: секунд на забег, после которых поток считается зависшим
// Сводка печатается сразу; python3 tools/sim/heroes.py файл.json покажет потери HP по героям и стадиям.
const { chromium } = require('playwright');
const runsPer = +process.argv[2] || 4;
const diff = +(process.argv[3] || 1);
const ALL = ['lamp', 'courier', 'guard', 'stoker', 'baker', 'grinder', 'shepherd', 'herbalist'];
const classes = !process.argv[4] || process.argv[4] === 'all' ? ALL : process.argv[4].split(',');
const workers = +process.argv[5] || 4;
const url = process.argv[6] || 'file://' + require('path').resolve(__dirname, '../../index.html');

async function bot({ jobs, diff, bal, diffo, noDef }) {
  const process_noDef = !!noDef;
  const D = window.Data; const G = window.Game;
  if (bal && G.bal) Object.assign(G.bal, bal);
  if (diffo) Object.assign(D.DIFFICULTIES[diff], diffo);
  const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s); const qa = (s) => [...document.querySelectorAll(s)];
  const click = (e) => { if (typeof e === 'string') e = q(e); if (e) e.click(); return !!e; };
  const STATUS = ['blot', 'icy', 'sealwax', 'dread', 'ash', 'stale'];
  const RANK = { start: 0, common: 1, uncommon: 2, rare: 3.2, epic: 4.4, legendary: 5.5, token: 0, status: -5 };
  const has = (id) => G.run.relics.includes(id);
  const BYNAME = {}; for (const [id, c] of Object.entries(D.CARDS)) BYNAME[c.name] = id;

  // ---------- оценка карты: проигрываем её на «бумажном» бое ----------
  async function estimate(c, C) {
    const run = G.run; const cd = D.CARDS[c.id];
    const mk = () => ({ dmg: 0, hits: 0, blk: 0, draw: 0, energy: 0, flame: 0, heal: 0, weak: 0, vuln: 0, burn: 0, chill: 0, stun: 0, charm: 0, str: 0, tmp: 0, thorns: 0, gold: 0, price: 0, misc: 0 });
    let R = mk(); let flame = C.flame; const fb = has('bellows') ? 0 : 2; const fm = has('bellows') ? 2 : 3;
    const burstDmg = () => { let b = 8 + (has('flint') ? 5 : 0); if (C.enemy.vuln > 0 || R.vuln > 0) b = Math.floor(b * 1.5); return b; };
    const calc = (base) => {
      let v = base + fb * flame + C.str + C.tmpStr + R.tmp + R.str + (has('pencil') && !C.atkTurn ? 3 : 0);
      if (C.pWeak > 0) v = Math.floor(v * 0.75);
      if (C.enemy.vuln > 0 || R.vuln > 0) v = Math.floor(v * 1.5);
      return Math.max(0, v);
    };
    const g = {
      state: C, played: C.playedTurn, get blockNow() { return C.block + R.blk; }, enemyDead: false, lastCard: C.last ? 'x' : null,
      dmgText: (n) => `${n}`, blkText: (n) => `${n}`, blkNum: (n) => n, thornsGain: (n) => n,
      attack: async (base, hits = 1) => { for (let h = 0; h < hits; h++) { let d = calc(base); if (C.enemy.mist > 0 && d > C.enemy.mist) d = C.enemy.mist; R.dmg += d; R.hits++; if (has('sootbroom')) R.burn += 1; } },
      block: (n) => { if (C.frail > 0) n = Math.floor(n * 0.75); R.blk += n; },
      flame: async (n) => { R.flame += n; flame += n; let guard = 0; while (flame >= fm && guard++ < 20) { flame -= fm; R.dmg += burstDmg(); R.flame -= 1; if (has('ivalamp')) flame += 1; if (has('wickcutter')) R.blk += 4; if (has('stub')) R.heal += 2; } },
      draw: (n) => { R.draw += n; }, heal: (n) => { R.heal += n; }, burn: (n) => { R.burn += n + (has('matchbox') ? 2 : 0); },
      weak: (n) => { R.weak += n; }, vuln: (n) => { R.vuln += n; }, chill: (n) => { R.chill += n; }, stun: () => { R.stun++; },
      energy: (n) => { R.energy += n; }, resolve: (n) => { R.str += n; }, rush: (n) => { R.tmp += n; }, thorns: (n) => { R.thorns += n; },
      gold: (n) => { R.gold += n; }, maxHp: (n) => { R.misc += n * 1.5; },
      doubleBlock: () => { R.blk += C.block + R.blk; },
      burstNow: async () => { R.dmg += burstDmg(); },
      consumeFlame: () => { const n = flame; flame = 0; R.misc -= n * 1.5; return n; },
      deliver: (name, fn) => { R.deliver = fn; },
      charm: (id, n) => { R.charm += n; },
      freeTurn: () => { R.misc += 12; },
      copyLast: async () => { if (C.last && C.last.id !== 'carbon') await D.CARDS[C.last.id].play(g, C.last.up, { ...C.last }); },
      recall: (n) => { R.draw += Math.min(n, C.disc.length) * 1.2; },
      autoplay: async (n) => { R.misc += 7 * n; },
      ginger: (n) => { R.misc += 5 * n; }, glaze: () => { R.misc += 6; },
      sharpen: (n) => { R.misc += 2.5 * n; return n; },
      upCount: () => [...C.draw, ...C.hand, ...C.disc].filter((x) => x.up && x !== c).length,
      dog: (n) => { R.misc += n * 3.5; }, bite: async () => { R.dmg += C.enemy.vuln > 0 ? Math.floor(C.dog * 1.5) : C.dog; },
      price: async (n) => { R.price += n; },
      exhaustHand: (pred) => C.hand.filter((x) => x !== c && pred(D.CARDS[x.id])).length,
    };
    const safe = new Proxy(g, { get: (t, k) => (k in t ? t[k] : () => 0) });
    try {
      if (cd.price) R.price += cd.price(c.up);
      if (cd.play) await cd.play(safe, c.up, { ...c });
      if (R.deliver) { const fn = R.deliver; const main = R; R = mk(); await fn(safe); const del = R; R = main; for (const k of Object.keys(del)) if (typeof del[k] === 'number') R[k] += del[k] * 0.8; }
    } catch (e) { R.misc += 3; }
    return R;
  }

  function incomingOf(C) {
    const e = C.enemy; const ed = D.ENEMIES[C.id];
    if (e.stun > 0) return { dmg: 0, hits: 0 };
    const p = ed.pattern[e.pi % ed.pattern.length];
    const its = p.then ? [p, p.then] : [p];
    let dmg = 0; let hits = 0;
    for (const it of its) {
      if (it.k === 'attack' || it.k === 'snuff' || it.k === 'steal' || it.k === 'boom') {
        let d = Math.round((it.v + e.str + e.boil) * D.DIFFICULTIES[G.run.diff].dmg);
        if (e.weak > 0) d = Math.floor(d * 0.75);
        d = Math.max(0, d); dmg += d * (it.hits || 1); hits += it.hits || 1;
      }
    }
    return { dmg, hits };
  }

  function value(R, C, inc) {
    const run = G.run; const e = C.enemy;
    const need = Math.max(0, inc.dmg - C.block);
    const ehp = e.hp + e.block;
    let v = Math.min(R.dmg, ehp + 2);
    if (R.dmg >= ehp && !e.nest) v += 60;
    if (e.thorns > 0) v -= R.hits * e.thorns * 1.3;
    const useful = Math.min(R.blk, need); v += useful * 1.25 + (R.blk - useful) * 0.12;
    v += R.draw * 3.2 + R.energy * 5.5 + R.flame * 2.2;
    v += Math.min(R.heal, run.maxHp - run.hp) * 1.3;
    if (R.weak) v += need * 0.25 * 1.25 + 2 * R.weak;
    v += R.vuln * 4.5;
    v += R.burn * Math.min(4, Math.max(1, ehp / 12)) * 0.9;
    v += R.chill * 4;
    if (R.stun) v += need * 1.25 + 4;
    v += R.charm * (C.turn <= 2 ? 14 : C.turn <= 4 ? 9 : 5);
    const atkInHand = C.hand.filter((x) => D.CARDS[x.id].type === 'atk').length;
    v += R.str * 6 + R.tmp * 1.5 * atkInHand + R.thorns * 3.5 + R.gold * 0.25 + R.misc;
    v -= R.price * (run.hp < 15 ? 3 : 1.2);
    return v;
  }

  async function combatTurn() {
    for (let guard = 0; guard < 60; guard++) {
      while (G.busy) { await wait(15); if (!G.combat) return; }
      const C = G.combat; if (!C || q('#screen').className !== 'scr-combat') return;
      if (C.enemy.hp <= 0 || G.run.hp <= 0) return;
      const inc = incomingOf(C);
      let best = -1; let bestR = 0.45;
      for (let i = 0; i < C.hand.length; i++) {
        const c = C.hand[i]; const cost = G.playCost(c);
        if (cost == null || cost > C.energy) continue;
        const cd = D.CARDS[c.id];
        if (cd.price && cd.price(c.up) >= G.run.hp) continue;
        let v;
        if (cd.type === 'status') v = 0.2; // Клякса: только если энергию больше не на что тратить
        else v = value(await estimate(c, C), C, inc);
        const r = v / (cost + 0.6);
        if (v > 0.15 && r > bestR) { bestR = r; best = i; }
      }
      if (best < 0) break;
      await G.play(best);
      await wait(5);
    }
    while (G.busy) { await wait(15); if (!G.combat) return; }
    if (G.combat && q('#screen').className === 'scr-combat' && G.combat.enemy.hp > 0 && G.run.hp > 0) { const p = G.endTurn(); await p; }
  }

  // ---------- решения вне боя ----------
  // колода собирается с оглядкой на защиту: когда её мало, защитные карты ценнее, как у живого игрока
  const DEF = {}; for (const [id, cd] of Object.entries(D.CARDS)) { let d = ''; try { d = cd.desc({ dmgText: (n) => n, blkText: (n) => n, blkNum: (n) => n, thornsGain: (n) => n, state: null }, false, {}); } catch (e) {} DEF[id] = /защит/i.test(String(d)); }
  const defShare = () => { const d = G.run.deck; return d.filter((c) => DEF[c.id]).length / Math.max(1, d.length); };
  const cardScore = (id, draft) => {
    const h = D.CLASSES[G.run.cls]; const cd = D.CARDS[id];
    let s = (RANK[cd.rarity] || 0) + (cd.cls || h.favored.includes(id) ? 1.3 : 0) + (cd.type === 'charm' ? 0.4 : 0);
    if (draft && !process_noDef) { const sh = defShare(); s += DEF[id] ? (sh < 0.34 ? 1.6 : sh < 0.42 ? 0.6 : -0.3) : (sh > 0.55 ? 0.8 : 0); }
    return s;
  };
  const worstCard = () => {
    const d = G.run.deck; const pr = (c) => (STATUS.includes(c.id) ? 0 : c.id === 'strike' && !c.up ? 1 : c.id === 'guard' && !c.up ? 2 : c.id === 'strike' ? 3 : c.id === 'guard' ? 4 : 10 + cardScore(c.id));
    return [...d].sort((a, b) => pr(a) - pr(b))[0];
  };
  const bestUpgrade = () => {
    const d = G.run.deck.filter((c) => !c.up && !STATUS.includes(c.id));
    return d.sort((a, b) => cardScore(b.id) - cardScore(a.id))[0];
  };
  function mapChoice() {
    const R = G.run; const f = R.hp / R.maxHp; const ch = R.choices || [];
    const preBoss = ch.length === 3 && ch[0].t === 'rest' && ch[1].t === 'shop';
    const sc = (o) => {
      if (o.t === 'rest') return f < 0.5 ? 100 : f < 0.75 ? 48 : preBoss && f < 0.92 ? 70 : 30;
      if (o.t === 'elite') return preBoss ? 2 : f > 0.8 && R.step >= 8 ? 62 : f > 0.65 ? 24 : 4;
      if (o.t === 'shop') return R.gold >= 110 ? 58 : R.gold >= 65 ? 34 : 8;
      if (o.t === 'chest') return 52;
      if (o.t === 'event' || o.t === 'meet') return f < 0.35 ? 60 : 44;
      if (o.t === 'fight') return f < 0.3 ? 10 : 40;
      return 50;
    };
    let bi = 0; let bs = -1;
    ch.forEach((o, i) => { const s = sc(o) + Math.random() * 6; if (s > bs) { bs = s; bi = i; } });
    return bi;
  }

  const out = []; window.__out = out;
  for (const cls of jobs) {
    // новый забег
    for (let k = 0; k < 400 && q('#screen').className !== 'scr-title'; k++) { click('[data-act=cine-skip]'); await wait(50); }
    G.newRun(cls, diff);
    const rec = { cls, diff, win: false, step: 0, by: null, byTier: null, fights: [], hpAt: {}, deck: 0, relics: 0, turns: 0, kinds: {}, gold: 0 };
    let fight = null; let idle = 0; let lastSig = '';
    for (let it = 0; it < 60000; it++) {
      await wait(15);
      const scr = q('#screen').className; const R = G.run;
      const sig = scr + (R ? R.step + ':' + R.hp + ':' + R.gold + ':' + R.deck.length : '') + (G.combat ? G.combat.turn + ':' + G.combat.enemy.hp + ':' + G.combat.hand.length + ':' + G.combat.energy : '') + q('#overlay').className + q('#screen').innerHTML.length;
      if (sig === lastSig) { if (++idle > 3000) { rec.stuck = scr + ' ' + q('#screen').innerText.slice(0, 160).replace(/\n/g, ' / '); break; } } else { idle = 0; lastSig = sig; }
      if (R) { rec.step = Math.max(rec.step, R.step); if (R.st) rec.gold = R.st.gold || 0; rec.relics = R.relics.length; rec.deck = R.deck.length; }
      // бой закончился
      if (fight && scr !== 'scr-combat') { fight.hp1 = R ? R.hp : 0; fight.turns = fight.t; rec.fights.push(fight); fight = null; }
      if (q('#storelayer.show')) { click('[data-sl=close]') || click('[data-sl=done]'); continue; }
      if (q('#overlay.show')) {
        const title = (q('#overlay h2') || {}).textContent || '';
        const uidEl = (c) => c && q(`#overlay .card[data-uid="${c.uid}"]`);
        if (qa('#overlay .card[data-uid]').length && q('#overlay .ovhint')) { click(uidEl(bestUpgrade()) || '#overlay .card'); continue; }
        if (qa('#overlay .card[data-uid]').length && rec._pick === 'remove') { rec._pick = null; click(uidEl(worstCard()) || '#overlay .card'); continue; }
        if (qa('#overlay .card[data-uid]').length && rec._pick !== 'view') { click(uidEl(worstCard()) || '#overlay .card'); continue; }
        click('#overlay [data-act=close]') || click('#overlay .btn') || click('#overlay'); continue;
      }
      if (scr === 'scr-map') {
        if (!R.choices) continue;
        const i = mapChoice(); const o = R.choices[i];
        if (o.t === 'boss') rec.hpAt[R.step] = [R.hp, R.maxHp, R.deck.length, R.relics.length];
        rec.kinds[o.t] = (rec.kinds[o.t] || 0) + 1;
        click(qa('.enc')[i]); continue;
      }
      if (scr === 'scr-combat') {
        const C = G.combat; if (!C) continue;
        if (!fight) fight = { id: C.id, tier: C.tier, step: R.step, hp0: R.hp, max: R.maxHp, t: 0, ehp: C.enemy.max };
        if (G.busy) continue;
        fight.t = C.turn; rec.turns++;
        await combatTurn();
        continue;
      }
      if (scr === 'scr-reward') {
        const cards = qa('.card.reward').map((el) => ({ el, id: el.dataset.id, s: cardScore(el.dataset.id, true) })).sort((a, b) => b.s - a.s);
        const n = R.deck.length; const b = cards[0];
        const take = b && (b.s >= 3 || (n < 16 && b.s >= 1) || (n < 22 && b.s >= 2.2) || (n < 28 && b.s >= 2.6));
        if (take) click(b.el); else click('[data-act=next]');
        continue;
      }
      if (scr === 'scr-bossrelic') { const o = qa('.brelic'); click(o[Math.floor(Math.random() * o.length)]); continue; }
      if (scr === 'scr-event') {
        if (click('[data-act=next]')) continue;
        const o = qa('.scroll:not(.off):not(.adopt)');
        // при малом здоровье не берём варианты с потерей HP
        const okk = o.filter((el) => !(R.hp < R.maxHp * 0.4 && /[−-]\d+ HP/.test(el.textContent)));
        const list = okk.length ? okk : o;
        const pool = list.length > 1 ? list.slice(0, -1) : list; // последний вариант обычно «пройти мимо»
        click(pool[Math.floor(Math.random() * pool.length)]); continue;
      }
      if (scr === 'scr-talk' || scr === 'scr-meet' || scr === 'scr-after') {
        const o = qa('.scrolls .scroll:not(.off):not(.adopt)');
        if (o.length) click(o[Math.floor(Math.random() * o.length)]); else click('.btn') || click('[data-act]');
        continue;
      }
      if (scr === 'scr-shop') {
        const price = (el) => +((el.querySelector('i, .price') || {}).textContent || '').replace(/\D/g, '') || 999;
        const rm = q('.svc[data-act=buyremove]:not(.sold)');
        if (rm && price(rm) <= R.gold && R.deck.some((c) => STATUS.includes(c.id))) { rec._pick = 'remove'; click(rm); continue; }
        const rel = q('.svc[data-act=buyrelic]:not(.sold)');
        if (rel && price(rel) <= R.gold) { click(rel); continue; }
        if (rm && price(rm) <= R.gold && R.deck.some((c) => STATUS.includes(c.id) || ((c.id === 'strike' || c.id === 'guard') && !c.up)) && R.deck.length > 8) { rec._pick = 'remove'; click(rm); continue; }
        const wares = qa('.ware:not(.sold)').map((w) => ({ el: w.querySelector('.card'), p: price(w), s: cardScore(BYNAME[(w.querySelector('.ctitle span') || {}).textContent] || 'strike', true) }));
        const good = wares.filter((w) => w.p <= R.gold && w.s >= 3).sort((a, b) => b.s - a.s)[0];
        if (good) { click(good.el); continue; }
        const tea = q('.svc[data-act=buytea]:not(.sold)');
        if (tea && price(tea) <= R.gold && R.hp < R.maxHp * 0.6) { click(tea); continue; }
        const up = q('.svc[data-act=buyup]:not(.sold)');
        if (up && price(up) <= R.gold && bestUpgrade()) { click(up); continue; }
        click('[data-act=next]'); continue;
      }
      if (scr === 'scr-chest') { click('[data-act=openchest]') || click('[data-act=next]'); continue; }
      if (scr === 'scr-rest') {
        const canUp = !!bestUpgrade(); const f = R.hp / R.maxHp;
        // помеха в колоде (Клякса, Недоставленное письмо) дороже улучшения: сжигаем её, если здоровье терпит
        if (f >= 0.45 && R.deck.some((c) => STATUS.includes(c.id)) && q('[data-act=rest-burn]:not(.off)')) { rec._pick = 'remove'; click('[data-act=rest-burn]'); continue; }
        if ((f < 0.6 || !canUp) && click('[data-act=rest-heal]:not(.off)')) continue;
        if (canUp) { click('[data-act=rest-up]'); continue; }
        rec._pick = 'remove'; click('[data-act=rest-burn]'); continue;
      }
      if (scr.startsWith('scr-end')) {
        if (scr.includes('revive')) { rec.win = false; if (R && R.st) { rec.by = R.st.by; rec.byTier = D.ENEMIES[R.st.by] ? D.ENEMIES[R.st.by].tier : null; } rec.deck = R.deck.length; rec.relics = R.relics.length; rec.final = R.final || null; click('[data-act=giveup]'); continue; }
        if (scr.includes('win')) { rec.win = true; rec.step = 51; rec.deck = R.deck.length; rec.relics = R.relics.length; rec.final = R.final; rec.hpEnd = R.hp; }
        click('.btn.big') || click('.btn'); continue;
      }
      if (scr === 'scr-summary') { break; }
      if (scr === 'scr-intro') { click('[data-act=start]'); continue; }
    }
    delete rec._pick;
    out.push(rec);
    // назад в меню
    for (let k = 0; k < 300 && q('#screen').className !== 'scr-title'; k++) { click('.btn.big') || click('[data-act=title]') || click('.btn'); await wait(5); }
  }
  return out;
}

(async () => {
  const jobs = []; for (const c of classes) for (let i = 0; i < runsPer; i++) jobs.push(c);
  const parts = Array.from({ length: workers }, () => []); jobs.forEach((j, i) => parts[i % workers].push(j));
  const b = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const t0 = Date.now();
  const res = await Promise.all(parts.filter((p) => p.length).map(async (part) => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
    await p.route('**/*.webp', (r) => r.abort());
    await p.addInitScript(() => {
      // виртуальные часы: таймеры срабатывают по порядку своих сроков, но без настоящего ожидания
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
      try { localStorage.setItem('lastray.cinema', '1'); localStorage.setItem('lastray.settings', JSON.stringify({ anim: 'fast', sfx: 0, music: 0, snow: false, lines: false })); } catch (e) { /* пусто */ }
    });
    await p.goto(url + '?lang=ru'); await p.waitForTimeout(600);
    // рисование и эффекты для подсчёта не нужны: без них забег идёт в несколько раз быстрее
    await p.evaluate(() => {
      for (const k of Object.keys(window.Art)) { const f = window.Art[k]; if (typeof f === 'function' && !['bgUrl', 'enemyUrl', 'actDur', 'act', 'groundCam'].includes(k)) window.Art[k] = () => ''; }
      window.Art.enemyLive = null; window.Art.actDur = () => 0; window.Art.act = () => 0;
      window.FX.play = async () => {}; window.FX.relic = () => {};
    });
    // сторож: если страница зависла, забираем готовые забеги и пишем, где она стоит
    const limit = (+process.env.LIMIT || 25) * 1000 * part.length;
    let r = await Promise.race([
      p.evaluate(bot, { jobs: part, diff, bal: process.env.BAL ? JSON.parse(process.env.BAL) : null, diffo: process.env.DIFFO ? JSON.parse(process.env.DIFFO) : null }),
      new Promise((res) => setTimeout(() => res(null), limit)),
    ]);
    if (!r) {
      const dbg = await Promise.race([p.evaluate(() => ({ out: window.__out, scr: document.querySelector('#screen').className, busy: Game.busy, step: Game.run && Game.run.step, hp: Game.run && Game.run.hp, c: Game.combat && { id: Game.combat.id, turn: Game.combat.turn, e: Game.combat.enemy.hp, hand: Game.combat.hand.map((c) => c.id), en: Game.combat.energy }, ov: document.querySelector('#overlay').className, text: document.querySelector('#screen').innerText.slice(0, 200) })), new Promise((res) => setTimeout(() => res({ out: [], dead: true }), 5000))]);
      errs.push('HUNG ' + JSON.stringify({ ...dbg, out: (dbg.out || []).length }));
      r = dbg.out || [];
    }
    await ctx.close();
    return { r, errs };
  }));
  await b.close();
  const all = res.flatMap((x) => x.r); const errs = res.flatMap((x) => x.errs);
  require('fs').writeFileSync(process.env.OUT || `sim_d${diff}.json`, JSON.stringify(all));
  // сводка
  const byCls = {};
  for (const r of all) { const c = byCls[r.cls] = byCls[r.cls] || { n: 0, win: 0, steps: 0 }; c.n++; c.win += r.win ? 1 : 0; c.steps += r.step; }
  console.log(`diff ${diff}: runs ${all.length}, wins ${all.filter((r) => r.win).length}, ${(Date.now() - t0) / 1000 | 0}s, errors ${errs.length}`, errs.slice(0, 3));
  for (const [c, v] of Object.entries(byCls)) console.log(`  ${c.padEnd(10)} win ${v.win}/${v.n}  avg step ${(v.steps / v.n).toFixed(1)}`);
  const deaths = {}; all.filter((r) => !r.win).forEach((r) => { const k = `${r.by}(${r.byTier})@${Math.floor(r.step / 5) * 5}`; deaths[k] = (deaths[k] || 0) + 1; });
  console.log('  deaths:', Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}×${v}`).join(', '));
  const kinds = {}; all.forEach((r) => Object.entries(r.kinds).forEach(([k, v]) => { kinds[k] = (kinds[k] || 0) + v; }));
  console.log('  per run:', Object.entries(kinds).map(([k, v]) => `${k} ${(v / all.length).toFixed(1)}`).join(', '), '| gold', (all.reduce((a, r) => a + r.gold, 0) / all.length).toFixed(0), '| relics', (all.reduce((a, r) => a + r.relics, 0) / all.length).toFixed(1), '| turns', (all.reduce((a, r) => a + r.turns, 0) / all.length).toFixed(0));
  const stuck = all.filter((r) => r.stuck); if (stuck.length) console.log('  STUCK', stuck.length, stuck[0].stuck);
  // потери HP по типам боёв и отрезкам пути
  const seg = {};
  for (const r of all) for (const f of r.fights) { const k = `${f.tier}@${String(Math.floor(f.step / 10) * 10).padStart(2, '0')}`; const s = seg[k] = seg[k] || { n: 0, lost: 0, turns: 0, frac: 0 }; s.n++; s.lost += f.hp0 - f.hp1; s.turns += f.turns; s.frac += (f.hp0 - f.hp1) / f.max; }
  console.log('  fights:', Object.keys(seg).sort().map((k) => `${k}: n${seg[k].n} hp−${(seg[k].lost / seg[k].n).toFixed(1)} (${(100 * seg[k].frac / seg[k].n).toFixed(0)}%) t${(seg[k].turns / seg[k].n).toFixed(1)}`).join(' | '));
  const hpAt = {}; for (const r of all) for (const [s, v] of Object.entries(r.hpAt)) { const h = hpAt[s] = hpAt[s] || { n: 0, f: 0, deck: 0, rel: 0, max: 0 }; h.n++; h.f += v[0] / v[1]; h.deck += v[2]; h.rel += v[3]; h.max += v[1]; }
  console.log('  before bosses:', Object.entries(hpAt).map(([s, h]) => `step ${s}: n${h.n} hp ${(100 * h.f / h.n).toFixed(0)}% max ${(h.max / h.n).toFixed(0)} deck ${(h.deck / h.n).toFixed(1)} relics ${(h.rel / h.n).toFixed(1)}`).join(' | '));
})();
