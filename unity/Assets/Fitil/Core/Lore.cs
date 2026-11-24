// Доступ к лору (js/lore.js в data.<lang>.json → lore): отношения врагов к героям, реплики,
// тайны героев, встречи, мрачные герои, друзья финала, связи врагов. Тексты — русские ключи перевода.
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public sealed class Lore
    {
        readonly Dictionary<string, object> raw;
        public Lore(GameData g) { raw = g.Lore; }

        Dictionary<string, object> Obj(string k) => Json.Obj(Json.Get(raw, k));

        /// <summary>Отношение врага к герою: like | fear | hate или null (ATT).</summary>
        public string Att(string enemy, string cls)
        {
            var a = Json.Obj(Json.Get(Obj("ATT"), enemy));
            if (a == null) return null;
            foreach (var k in new[] { "like", "fear", "hate" }) if (Json.Str(Json.Get(a, k)) == cls) return k;
            return null;
        }

        public bool HasSay(string enemy) => Json.Get(Obj("SAY"), enemy) != null;

        /// <summary>Реплика врага: строка или список вариантов (выбор — у вызывающего).</summary>
        public object Say(string enemy, string key) => Json.Get(Json.Obj(Json.Get(Obj("SAY"), enemy)), key);

        public Dictionary<string, object> Secret(string cls) => Json.Obj(Json.Get(Obj("SECRET"), cls));
        public Dictionary<string, object> Meet(string hero) => Json.Obj(Json.Get(Obj("MEET"), hero));
        public IEnumerable<string> MeetHeroes => Obj("MEET").Keys;
        public Dictionary<string, object> Dark(string cls) => Json.Obj(Json.Get(Obj("DARK"), cls));
        public Dictionary<string, object> Forgive => Obj("FORGIVE");
        public Dictionary<string, object> Friend(string cls) => Json.Obj(Json.Get(Obj("FRIEND"), cls));
        public string Grudge => Json.Str(Json.Get(raw, "GRUDGE"));
        public string Challenge => Json.Str(Json.Get(raw, "CHALLENGE"));
        public List<string> Taunted => Strs(Json.Get(raw, "TAUNTED"));
        public object TieSay(string k) => Json.Get(Obj("TIE_SAY"), k);

        /// <summary>Связи врагов: [a, b, kin|rival, текст].</summary>
        public List<(string a, string b, string k, string text)> Ties
        {
            get
            {
                var l = new List<(string, string, string, string)>();
                foreach (var x in Json.Arr(Json.Get(raw, "ETIES")) ?? new List<object>())
                {
                    var t = Json.Arr(x);
                    l.Add(((string)t[0], (string)t[1], (string)t[2], t.Count > 3 ? (string)t[3] : ""));
                }
                return l;
            }
        }

        public static List<string> Strs(object v)
        {
            var a = Json.Arr(v);
            return a == null ? (v is string s ? new List<string> { s } : new List<string>()) : a.OfType<string>().ToList();
        }
    }
}
