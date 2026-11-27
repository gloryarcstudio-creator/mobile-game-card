// Данные игры из data.<lang>.json (их пишет tools/unity/export_data.js из js/data.js, story.js, lore.js, achievements.js).
// Числа и тексты приходят данными; код карт (play), описаний (desc) и ответов событий (act) переносится на C# отдельно.
using System.Collections.Generic;

namespace Fitil.Core
{
    public sealed class HeroClass
    {
        public string Id, Name, Role, Who, Whom, Look, Relic, Build, About;
        public bool Female, Paid;
        public int Hp, Gold;
        public List<string> Deck = new List<string>();
        public List<string> Favored = new List<string>();
    }

    public sealed class Difficulty
    {
        public int Index;
        public string Name, Hint;
        public double Hp, Dmg, Gold, Rest, BossHeal;
        public int HeroHp;
        public List<string> Curses = new List<string>();
    }

    public sealed class GameData
    {
        public string Lang;
        public Dictionary<string, object> Raw;
        public readonly Dictionary<string, HeroClass> Classes = new Dictionary<string, HeroClass>();
        public readonly List<Difficulty> Difficulties = new List<Difficulty>();

        public Dictionary<string, object> Cards => Json.Obj(Raw["cards"]);
        public Dictionary<string, object> Enemies => Json.Obj(Raw["enemies"]);
        public Dictionary<string, object> Relics => Json.Obj(Raw["relics"]);
        public List<object> Events => Json.Arr(Raw["events"]);
        public Dictionary<string, object> Story => Json.Obj(Raw["story"]);
        public Dictionary<string, object> Lore => Json.Obj(Raw["lore"]);
        public Dictionary<string, object> Achievements => Json.Obj(Raw["achievements"]);

        public static GameData Parse(string lang, string json)
        {
            var g = new GameData { Lang = lang, Raw = Json.Obj(Json.Parse(json)) };
            foreach (var kv in Json.Obj(g.Raw["classes"]))
            {
                var o = Json.Obj(kv.Value);
                g.Classes[kv.Key] = new HeroClass
                {
                    Id = kv.Key,
                    Name = Json.Str(Json.Get(o, "name")),
                    Role = Json.Str(Json.Get(o, "role")),
                    Who = Json.Str(Json.Get(o, "who")),
                    Whom = Json.Str(Json.Get(o, "whom")),
                    Look = Json.Str(Json.Get(o, "look")),
                    Relic = Json.Str(Json.Get(o, "relic")),
                    Build = Json.Str(Json.Get(o, "build")),
                    About = Json.Str(Json.Get(o, "about")),
                    Female = Json.Bool(Json.Get(o, "f")),
                    Paid = Json.Bool(Json.Get(o, "paid")),
                    Hp = Json.Int(Json.Get(o, "hp")),
                    Gold = Json.Int(Json.Get(o, "gold")),
                    Deck = Strings(Json.Get(o, "deck")),
                    Favored = Strings(Json.Get(o, "favored")),
                };
            }
            var i = 0;
            foreach (var x in Json.Arr(g.Raw["difficulties"]))
            {
                var o = Json.Obj(x);
                g.Difficulties.Add(new Difficulty
                {
                    Index = i++,
                    Name = Json.Str(Json.Get(o, "name")),
                    Hint = Json.Str(Json.Get(o, "hint")),
                    Hp = Json.Num(Json.Get(o, "hp"), 1),
                    Dmg = Json.Num(Json.Get(o, "dmg"), 1),
                    HeroHp = Json.Int(Json.Get(o, "heroHp")),
                    Gold = Json.Num(Json.Get(o, "gold"), 1),
                    Rest = Json.Num(Json.Get(o, "rest")),
                    BossHeal = Json.Num(Json.Get(o, "bossHeal")),
                    Curses = Strings(Json.Get(o, "curses")),
                });
            }
            return g;
        }

        static List<string> Strings(object v)
        {
            var list = new List<string>();
            var a = Json.Arr(v);
            if (a != null) foreach (var x in a) if (x is string s) list.Add(s);
            return list;
        }
    }
}
