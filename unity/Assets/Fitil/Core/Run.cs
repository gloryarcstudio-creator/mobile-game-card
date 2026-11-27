// Выбор врага для развилки (pickEnemy в game.js). Сам забег — RunGame.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public static class Runs
    {
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
    }
}
