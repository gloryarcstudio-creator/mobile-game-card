// Описания карт. Шаблоны из cardtext.<lang>.json (tools/unity/export_card_text.js):
// "Deal ⟦dmg:6⟧ damage." — в метку подставляется число с поправками боя и талисманов,
// как это делают g.dmgText, g.blkText, g.thornsText и g.burnText в game.js.
using System;
using System.Collections.Generic;
using System.Text;

namespace Fitil.Core
{
    /// <summary>Число на карте: как оно выглядит и выросло ли оно (для подсветки, как &lt;b class="up"&gt;).</summary>
    public readonly struct CardNumber
    {
        public readonly int Value;
        public readonly int Base;
        public CardNumber(int value, int @base) { Value = value; Base = @base; }
        public bool Up => Value > Base;
        public bool Down => Value < Base;
    }

    public sealed class CardTextEntry
    {
        public string Base, Up;
        public int[] Price;          // Цена здоровьем: [обычная, улучшенная] или null
        public List<string> Dynamic; // текст зависит от хода боя: боевой вариант пишется на C#
    }

    public static class CardText
    {
        public const char Open = '⟦', Close = '⟧';

        public static Dictionary<string, CardTextEntry> Parse(string json)
        {
            var d = new Dictionary<string, CardTextEntry>();
            foreach (var kv in Json.Obj(Json.Parse(json)))
            {
                var o = Json.Obj(kv.Value);
                var e = new CardTextEntry { Base = Json.Str(Json.Get(o, "base")), Up = Json.Str(Json.Get(o, "up")) };
                var p = Json.Arr(Json.Get(o, "price"));
                if (p != null && p.Count == 2) e.Price = new[] { Json.Int(p[0]), Json.Int(p[1]) };
                var dyn = Json.Arr(Json.Get(o, "dynamic"));
                if (dyn != null) { e.Dynamic = new List<string>(); foreach (var x in dyn) e.Dynamic.Add((string)x); }
                d[kv.Key] = e;
            }
            return d;
        }

        /// <summary>Вне боя: числа как есть (apiStatic в game.js).</summary>
        public static readonly Func<string, int, bool, CardNumber> Static = (kind, n, spent) => new CardNumber(n, n);

        /// <summary>Собрать текст. number(kind, base, spent) даёт число для метки; kind: dmg, blk, thorns, burn.
        /// wrap(текст числа, число) оформляет его (подсветка в UI); по умолчанию просто число.</summary>
        public static string Render(string template, Func<string, int, bool, CardNumber> number, Func<CardNumber, string> wrap = null)
        {
            if (template == null) return null;
            if (template.IndexOf(Open) < 0) return template;
            var sb = new StringBuilder(template.Length);
            var i = 0;
            while (i < template.Length)
            {
                var a = template.IndexOf(Open, i);
                if (a < 0) { sb.Append(template, i, template.Length - i); break; }
                var b = template.IndexOf(Close, a + 1);
                if (b < 0) throw new FormatException("CardText: незакрытая метка в «" + template + "»");
                sb.Append(template, i, a - i);
                var parts = template.Substring(a + 1, b - a - 1).Split(':');
                var n = int.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture);
                var v = number(parts[0], n, parts.Length > 2 && parts[2] == "spent");
                sb.Append(wrap != null ? wrap(v) : v.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));
                i = b + 1;
            }
            return sb.ToString();
        }
    }
}
