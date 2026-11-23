// Случайность забега. В веб-версии везде Math.random; в Unity один генератор с зерном,
// зерно и состояние лежат в сохранении: перезапуск не перетасовывает награды, ошибку можно повторить.
// Алгоритм mulberry32 — тот же легко повторить в JS для сверки (tools/sim).
using System;
using System.Collections.Generic;

namespace Fitil.Core
{
    public sealed class Rng
    {
        public uint State;

        public Rng(uint seed) { State = seed; }

        public static uint NewSeed() => (uint)Environment.TickCount ^ (uint)Guid.NewGuid().GetHashCode();

        /// <summary>Число в [0, 1), как Math.random().</summary>
        public double Next()
        {
            unchecked
            {
                State += 0x6D2B79F5;
                uint t = State;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                return ((t ^ (t >> 14)) >> 0) / 4294967296.0;
            }
        }

        /// <summary>Целое от a до b включительно (rnd в game.js).</summary>
        public int Range(int a, int b) => a + (int)Math.Floor(Next() * (b - a + 1));

        public bool Chance(double p) => Next() < p;

        public T Pick<T>(IList<T> list) => list[(int)Math.Floor(Next() * list.Count)];

        /// <summary>Перемешать на месте (shuffle в game.js: Фишер — Йетс с конца).</summary>
        public IList<T> Shuffle<T>(IList<T> list)
        {
            for (var i = list.Count - 1; i > 0; i--)
            {
                var j = (int)Math.Floor(Next() * (i + 1));
                (list[i], list[j]) = (list[j], list[i]);
            }
            return list;
        }

        /// <summary>Индекс по весам (weighted в game.js).</summary>
        public int Weighted(IList<double> weights)
        {
            double sum = 0;
            foreach (var w in weights) sum += w;
            var r = Next() * sum;
            for (var i = 0; i < weights.Count; i++)
            {
                r -= weights[i];
                if (r < 0) return i;
            }
            return weights.Count - 1;
        }
    }
}
