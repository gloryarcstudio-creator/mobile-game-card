// Описания карт, врагов и талисманов из data.<lang>.json в виде классов C#.
// Код розыгрыша карт (play) — в Cards.cs, правила боя — в Combat.cs.
using System;
using System.Collections.Generic;

namespace Fitil.Core
{
    public sealed class CardDef
    {
        public string Id, Name, Type, Rarity, Art, Cls;
        public int? Cost;     // null — карту нельзя разыграть (помехи)
        public int? UpCost;   // стоимость улучшенной, если отличается
        public bool Exhaust, Retain, Ethereal;

        public bool IsStatus => Type == "status";
        public int? CostOf(bool up) => up && UpCost.HasValue ? UpCost : Cost;
    }

    /// <summary>Экземпляр карты в колоде или в бою (mk в game.js).</summary>
    public sealed class CardInst
    {
        public int Uid;
        public string Id;
        public bool Up;
        public bool Sharp;   // заточена в этом бою (Точильщик)
        public int Grow;     // Снежный ком, Секрет: прибавка урона в этом бою
        public int Mult;     // Заказное письмо: множитель (0 — не задан, считается как 1)

        public CardInst Clone() => (CardInst)MemberwiseClone();
    }

    public sealed class IntentDef
    {
        public string K;       // attack, block, buff, debuff, curse, heal, spikes, snuff, steal, sap, mist, bury, frail, boom
        public int V, Hits, N, Gold;
        public bool HasV;
        public string Card;
        public bool Leech;
        public IntentDef Then;

        public IntentDef With(int addV)
        {
            var c = (IntentDef)MemberwiseClone();
            c.V += addV;
            return c;
        }

        public static IntentDef Parse(Dictionary<string, object> o)
        {
            if (o == null) return null;
            return new IntentDef
            {
                K = Json.Str(Json.Get(o, "k")),
                V = Json.Int(Json.Get(o, "v")),
                HasV = Json.Get(o, "v") != null,
                Hits = Json.Int(Json.Get(o, "hits")),
                N = Json.Int(Json.Get(o, "n")),
                Gold = Json.Int(Json.Get(o, "gold")),
                Card = Json.Str(Json.Get(o, "card")),
                Leech = Json.Bool(Json.Get(o, "leech")),
                Then = Parse(Json.Obj(Json.Get(o, "then"))),
            };
        }
    }

    public sealed class EnemyDef
    {
        public string Id, Name, Tier, Line, Dark;
        public int Hp, Thorns, Nest, Boil, Tally, Alarm;
        public bool Plating;
        public readonly List<IntentDef> Pattern = new List<IntentDef>();
    }

    public sealed class RelicDef
    {
        public string Id, Name, Tier, Art, Desc, Cls;
    }

    public sealed class Defs
    {
        public readonly Dictionary<string, CardDef> Cards = new Dictionary<string, CardDef>();
        public readonly Dictionary<string, EnemyDef> Enemies = new Dictionary<string, EnemyDef>();
        public readonly Dictionary<string, RelicDef> Relics = new Dictionary<string, RelicDef>();
        public readonly List<Stage> Stages = new List<Stage>();
        public GameData Data;

        public sealed class Stage
        {
            public string Name, Scene, Roman;
            public int Len, Start, End;
            public List<string> Boss = new List<string>(), Early = new List<string>(), Normals = new List<string>(), Elites = new List<string>();
        }

        public int MaxSteps => Stages.Count == 0 ? 0 : Stages[Stages.Count - 1].End + 1;
        public bool Long => MaxSteps > 20;
        public int StageOf(int step) { for (var i = 0; i < Stages.Count; i++) if (step <= Stages[i].End) return i; return -1; }
        public bool IsFinalStep(int step) => step == MaxSteps - 1;

        /// <summary>Сюжет забега (STORIES в js/story.js): заголовки, тексты финалов.</summary>
        public string StoryId;
        public Dictionary<string, object> Story => Json.Obj(Json.Get(Json.Obj(Data.Story["STORIES"]), StoryId));
        public string StoryStr(string key) => Json.Str(Json.Get(Story, key));

        /// <summary>Текст сюжета, зависящий от героя (intro, winText, loseText).</summary>
        public string StoryHero(string key, string cls) => Json.Str(Json.Get(Json.Obj(Json.Get(Json.Obj(Json.Get(Json.Obj(Json.Get(Data.Raw, "storyHero")), StoryId)), key)), cls));

        /// <summary>Строка под названием стадии на карте пути (STORY.countdown).</summary>
        public string Countdown(int step)
        {
            var t = Json.Obj(Json.Get(Json.Obj(Json.Get(Data.Raw, "storyText")), StoryId));
            var si = Math.Max(0, StageOf(step));
            var left = Stages[si].End - step;
            var key = IsFinalStep(step) ? "countdownFinal" : left > 0 ? "countdownLeft" : "countdownBoss";
            return (Json.Str(Json.Get(t, key)) ?? "").Replace("{left}", left.ToString()).Replace("{level}", (step + 1).ToString()).Replace("{total}", MaxSteps.ToString());
        }

        public static Defs From(GameData g, string story = "sunset")
        {
            var d = new Defs { Data = g, StoryId = story };
            foreach (var kv in g.Cards)
            {
                var o = Json.Obj(kv.Value);
                d.Cards[kv.Key] = new CardDef
                {
                    Id = kv.Key,
                    Name = Json.Str(Json.Get(o, "name")),
                    Type = Json.Str(Json.Get(o, "type")),
                    Rarity = Json.Str(Json.Get(o, "rarity")),
                    Art = Json.Str(Json.Get(o, "art")),
                    Cls = Json.Str(Json.Get(o, "cls")),
                    Cost = Json.Get(o, "cost") is double c ? (int?)(int)c : null,
                    UpCost = Json.Get(o, "upCost") is double uc ? (int?)(int)uc : null,
                    Exhaust = Json.Bool(Json.Get(o, "exhaust")),
                    Retain = Json.Bool(Json.Get(o, "retain")),
                    Ethereal = Json.Bool(Json.Get(o, "ethereal")),
                };
            }
            foreach (var kv in g.Enemies)
            {
                var o = Json.Obj(kv.Value);
                var e = new EnemyDef
                {
                    Id = kv.Key,
                    Name = Json.Str(Json.Get(o, "name")),
                    Tier = Json.Str(Json.Get(o, "tier")),
                    Line = Json.Str(Json.Get(o, "line")),
                    Dark = Json.Str(Json.Get(o, "dark")),
                    Hp = Json.Int(Json.Get(o, "hp")),
                    Thorns = Json.Int(Json.Get(o, "thorns")),
                    Nest = Json.Int(Json.Get(o, "nest")),
                    Boil = Json.Int(Json.Get(o, "boil")),
                    Tally = Json.Int(Json.Get(o, "tally")),
                    Alarm = Json.Int(Json.Get(o, "alarm")),
                    Plating = Json.Bool(Json.Get(o, "plating")),
                };
                foreach (var p in Json.Arr(Json.Get(o, "pattern"))) e.Pattern.Add(IntentDef.Parse(Json.Obj(p)));
                d.Enemies[kv.Key] = e;
            }
            foreach (var kv in g.Relics)
            {
                var o = Json.Obj(kv.Value);
                d.Relics[kv.Key] = new RelicDef
                {
                    Id = kv.Key,
                    Name = Json.Str(Json.Get(o, "name")),
                    Tier = Json.Str(Json.Get(o, "tier")),
                    Art = Json.Str(Json.Get(o, "art")),
                    Desc = Json.Str(Json.Get(o, "desc")),
                    Cls = Json.Str(Json.Get(o, "cls")),
                };
            }
            var st = Json.Obj(Json.Get(Json.Obj(g.Story["STORIES"]), story));
            var acc = 0;
            foreach (var x in Json.Arr(Json.Get(st, "stages")))
            {
                var o = Json.Obj(x);
                var s = new Stage
                {
                    Name = Json.Str(Json.Get(o, "name")),
                    Scene = Json.Str(Json.Get(o, "scene")),
                    Roman = Json.Str(Json.Get(o, "roman")),
                    Len = Json.Int(Json.Get(o, "len")),
                    Boss = Strs(Json.Get(o, "boss")),
                    Early = Strs(Json.Get(o, "early")),
                    Normals = Strs(Json.Get(o, "normals")),
                    Elites = Strs(Json.Get(o, "elites")),
                };
                s.Start = acc;
                acc += s.Len;
                s.End = acc - 1;
                d.Stages.Add(s);
            }
            return d;
        }

        static List<string> Strs(object v)
        {
            var l = new List<string>();
            var a = Json.Arr(v);
            if (a != null) foreach (var x in a) if (x is string s) l.Add(s);
            return l;
        }
    }
}
