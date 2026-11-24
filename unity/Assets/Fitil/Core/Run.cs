// Начало забега и выбор врагов (newRun и pickEnemy в game.js).
// Карта пути с развилками, лавкой, костром и событиями переносится следующим этапом;
// пока забег — цепочка боёв: обычные враги, раз в несколько шагов сильный, в конце стадии босс.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public static class Runs
    {
        public static RunState New(Defs d, string cls, int diff, uint seed)
        {
            var g = d.Data;
            var h = g.Classes.TryGetValue(cls, out var hc) ? hc : g.Classes["lamp"];
            var dd = g.Difficulties[Math.Max(0, Math.Min(g.Difficulties.Count - 1, diff))];
            var run = new RunState
            {
                Cls = h.Id, Diff = dd.Index, Hp = h.Hp + dd.HeroHp, MaxHp = h.Hp + dd.HeroHp, Gold = h.Gold, Step = 0,
                Rng = new Rng(seed),
            };
            run.Relics.Add(h.Relic);
            foreach (var id in h.Deck.Concat(dd.Curses)) run.Deck.Add(run.Mk(id));
            foreach (var s in d.Stages) run.Bosses.Add(s.Boss.Count > 0 ? run.Rng.Pick(s.Boss) : null);
            return run;
        }

        /// <summary>Враг из списка: реже те, кого уже встречали, и не те, кто был только что.</summary>
        public static string PickEnemy(RunState run, List<string> list, List<string> used)
        {
            var avoid = run.Recent.Concat(run.LastOffered).ToList();
            var cands = list.Where(id => !used.Contains(id) && !avoid.Contains(id)).ToList();
            if (cands.Count == 0) cands = list.Where(id => !used.Contains(id) && !run.Recent.Contains(id)).ToList();
            if (cands.Count == 0) cands = list.Where(id => !used.Contains(id)).ToList();
            if (cands.Count == 0) cands = list.ToList();
            var w = cands.Select(id => 1.0 / (1 + Get(run.Seen, id) + 0.3 * Get(run.Offered, id))).ToList();
            var r = run.Rng.Next() * w.Sum();
            for (var i = 0; i < cands.Count; i++) if ((r -= w[i]) < 0) return cands[i];
            return cands[cands.Count - 1];
        }

        static int Get(Dictionary<string, int> d, string k) => d.TryGetValue(k, out var v) ? v : 0;

        /// <summary>Следующий бой цепочки (временная замена карты пути).</summary>
        public static (string id, string tier) NextFight(Defs d, RunState run)
        {
            var si = Math.Max(0, d.StageOf(run.Step));
            var st = d.Stages[si];
            if (run.Step == st.End && si < run.Bosses.Count && run.Bosses[si] != null) return (run.Bosses[si], "boss");
            var k = run.Step - st.Start;
            if (k > 0 && k % 6 == 5 && st.Elites.Count > 0) return (PickEnemy(run, st.Elites, new List<string>()), "elite");
            var pool = k < 5 && st.Early.Count > 0 ? st.Early : st.Normals;
            return (PickEnemy(run, pool, new List<string>()), "fight");
        }
    }
}
