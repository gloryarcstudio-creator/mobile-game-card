// Сохранение забега (save, loadSave, fixSave в game.js): состояние забега, экран, на котором вышли (pending),
// и снимки для второй попытки после поражения (back — развилка перед боем, fight — начало боя).
// Сохранение могло остаться от прежней версии: незнакомые карты, талисманы и враги убираются, числа чинятся,
// а что не починить — считается отсутствием сохранения.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    /// <summary>Экран, на котором игрок вышел из забега.</summary>
    public sealed class Pending
    {
        /// <summary>fight | elite | boss | talk | event | shop | chest | rest | meet | next | reward | bossrelic | after | afterdone | defeat</summary>
        public string T;
        public string Enemy, Tier, Ev, Hero;
        public bool Last;
        public ShopState Shop;
        public Reward Reward;
        public List<string> Opts;
        public string Fight;   // снимок забега в начале боя (для экрана поражения)

        public static Pending Of(Encounter o) => new Pending { T = o.T, Enemy = o.Enemy, Ev = o.Ev, Hero = o.Hero, Last = o.Last };
    }

    public sealed class SaveFile
    {
        public RunState Run;
        public Pending P;
        public string Back;    // снимок забега на развилке перед боем
        public long At;
    }

    public static class RunSave
    {
        public const int Version = 1;
        static readonly string[] Tiers = { "fight", "elite", "boss" };
        static readonly string[] BackFrom = { "fight", "elite", "boss", "talk", "event", "defeat" };

        // ================= запись =================
        public static string Write(SaveFile s) => Json.Write(new Dictionary<string, object>
        {
            ["v"] = Version,
            ["run"] = RunObj(s.Run),
            ["pending"] = s.P == null ? null : PendingObj(s.P),
            ["back"] = s.P != null && BackFrom.Contains(s.P.T) ? s.Back : null,
            ["at"] = s.At,
        });

        /// <summary>Снимок забега строкой (для второй попытки).</summary>
        public static string Snap(RunState r) => Json.Write(RunObj(r));

        static Dictionary<string, object> RunObj(RunState r)
        {
            return new Dictionary<string, object>
            {
                ["cls"] = r.Cls, ["diff"] = r.Diff, ["step"] = r.Step, ["hp"] = r.Hp, ["maxHp"] = r.MaxHp, ["gold"] = r.Gold,
                ["deck"] = r.Deck.Select(c => (object)new Dictionary<string, object> { ["uid"] = c.Uid, ["id"] = c.Id, ["up"] = c.Up }).ToList(),
                ["relics"] = Strs(r.Relics), ["candle"] = r.Candle, ["fights"] = r.Fights, ["lit"] = r.Lit,
                ["killed"] = Strs(r.Killed), ["kind"] = Strs(r.Kind), ["seen"] = Ints(r.Seen), ["recent"] = Strs(r.Recent),
                ["offered"] = Ints(r.Offered), ["lastOffered"] = Strs(r.LastOffered), ["bosses"] = Strs(r.Bosses),
                ["rng"] = r.Rng.State, ["uidSeq"] = r.UidSeq,
                ["choices"] = r.Choices?.Select(o => (object)EncObj(o)).ToList(),
                ["prev"] = r.Prev, ["forced"] = r.Forced, ["evSeen"] = Ints(r.EvSeen), ["evLast"] = r.EvLast,
                ["finalPrep"] = r.FinalPrep, ["final"] = r.Final,
                ["fmod"] = r.Fmod == null ? null : new Dictionary<string, object>
                {
                    ["str"] = r.Fmod.Str, ["weak"] = r.Fmod.Weak, ["stun"] = r.Fmod.Stun, ["goldMul"] = r.Fmod.GoldMul,
                    ["hpMul"] = r.Fmod.HpMul, ["talked"] = r.Fmod.Talked, ["calm"] = r.Fmod.Calm,
                },
                ["rel"] = Ints(r.Rel), ["fallen"] = Strs(r.Fallen), ["met"] = Strs(r.Met), ["meetLog"] = Strs(r.MeetLog),
                ["secrets"] = Strs(r.Secrets), ["grudge"] = Ints(r.Grudge),
                ["tone"] = new Dictionary<string, object> { ["peace"] = r.Peace, ["anger"] = r.Anger, ["pass"] = r.Pass },
                ["meetPlan"] = r.MeetPlan.ToDictionary(kv => kv.Key.ToString(), kv => (object)kv.Value),
                ["forgiven"] = r.Forgiven, ["finalDark"] = r.FinalDark,
                ["st"] = r.St.ToDictionary(kv => kv.Key, kv => (object)kv.Value),
            };
        }

        static Dictionary<string, object> EncObj(Encounter o) => new Dictionary<string, object>
        {
            ["t"] = o.T, ["enemy"] = o.Enemy, ["ev"] = o.Ev, ["hero"] = o.Hero, ["last"] = o.Last,
        };

        static Dictionary<string, object> PendingObj(Pending p) => new Dictionary<string, object>
        {
            ["t"] = p.T, ["enemy"] = p.Enemy, ["tier"] = p.Tier, ["ev"] = p.Ev, ["hero"] = p.Hero, ["last"] = p.Last,
            ["shop"] = p.Shop == null ? null : new Dictionary<string, object>
            {
                ["cards"] = p.Shop.Cards.Select(c => (object)Item(c)).ToList(), ["relic"] = p.Shop.Relic == null ? null : Item(p.Shop.Relic),
                ["tea"] = Item(p.Shop.Tea), ["remove"] = Item(p.Shop.Remove), ["up"] = Item(p.Shop.Up), ["rerolls"] = p.Shop.Rerolls,
            },
            ["r"] = p.Reward == null ? null : new Dictionary<string, object>
            {
                ["boss"] = p.Reward.Boss, ["gold"] = p.Reward.Gold, ["healed"] = p.Reward.Healed, ["ids"] = Strs(p.Reward.Ids),
            },
            ["opts"] = p.Opts == null ? null : Strs(p.Opts),
            ["fight"] = p.Fight,
        };

        static Dictionary<string, object> Item(ShopItem i) => new Dictionary<string, object> { ["id"] = i.Id, ["price"] = i.Price, ["sold"] = i.Sold };
        static List<object> Strs(IEnumerable<string> l) => l.Select(x => (object)x).ToList();
        static Dictionary<string, object> Ints(Dictionary<string, int> d) => d.ToDictionary(kv => kv.Key, kv => (object)kv.Value);

        // ================= чтение =================
        /// <summary>Прочитать сохранение. null — сохранения нет или его не починить.</summary>
        public static SaveFile Read(Defs d, string json)
        {
            try
            {
                var o = Json.Obj(Json.Parse(json));
                if (o == null || Json.Int(Json.Get(o, "v")) != Version) return null;
                var run = RunFrom(d, Json.Obj(Json.Get(o, "run")), out var dead);
                if (run == null) return null;
                var s = new SaveFile { Run = run, At = (long)Json.Num(Json.Get(o, "at")) };
                s.P = PendingFrom(d, Json.Obj(Json.Get(o, "pending")));
                // герой без здоровья бывает только на экране поражения
                if (s.P?.T != "defeat") run.Hp = Math.Max(1, run.Hp);
                if (s.P != null && BackFrom.Contains(s.P.T)) s.Back = FixSnap(d, Json.Str(Json.Get(o, "back")));
                return s;
            }
            catch (Exception) { return null; }
        }

        /// <summary>Забег из снимка (Snap). null — снимок не годится.</summary>
        public static RunState FromSnap(Defs d, string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            try { return RunFrom(d, Json.Obj(Json.Parse(json)), out _); }
            catch (Exception) { return null; }
        }

        static string FixSnap(Defs d, string json)
        {
            var r = FromSnap(d, json);
            return r == null ? null : Snap(r);
        }

        static RunState RunFrom(Defs d, Dictionary<string, object> o, out bool dead)
        {
            dead = false;
            if (o == null || Json.Arr(Json.Get(o, "deck")) == null) return null;
            var g = d.Data;
            var cls = Json.Str(Json.Get(o, "cls"));
            if (cls == null || !g.Classes.ContainsKey(cls)) cls = "lamp";
            var h = g.Classes[cls];
            var r = new RunState
            {
                Cls = cls,
                Diff = Math.Max(0, Math.Min(g.Difficulties.Count - 1, Json.Int(Json.Get(o, "diff"), 1))),
                Step = Math.Max(0, Math.Min(d.MaxSteps - 1, Json.Int(Json.Get(o, "step")))),
                Rng = new Rng((uint)Json.Num(Json.Get(o, "rng"), Rng.NewSeed())),
            };
            r.MaxHp = Math.Max(1, Json.Int(Json.Get(o, "maxHp"), h.Hp));
            r.Hp = Math.Max(0, Math.Min(r.MaxHp, Json.Int(Json.Get(o, "hp"), r.MaxHp)));
            dead = r.Hp <= 0;
            r.Gold = Math.Max(0, Json.Int(Json.Get(o, "gold")));
            r.Fights = Json.Int(Json.Get(o, "fights"));
            r.Lit = Json.Int(Json.Get(o, "lit"));
            r.Candle = Json.Bool(Json.Get(o, "candle"));

            // карты: незнакомые убираем, номера у всех разные
            var taken = new HashSet<int>();
            var cards = new List<CardInst>();
            var pendingUid = new List<CardInst>();
            foreach (var x in Json.Arr(Json.Get(o, "deck")))
            {
                var c = Json.Obj(x);
                var id = Json.Str(Json.Get(c, "id"));
                if (id == null || !d.Cards.ContainsKey(id)) continue;
                var inst = new CardInst { Id = id, Up = Json.Bool(Json.Get(c, "up")), Uid = Json.Int(Json.Get(c, "uid"), -1) };
                if (inst.Uid < 0 || !taken.Add(inst.Uid)) pendingUid.Add(inst);
                cards.Add(inst);
            }
            if (cards.Count == 0) foreach (var id in h.Deck) { var c = new CardInst { Id = id }; cards.Add(c); pendingUid.Add(c); }
            var next = Math.Max(Json.Int(Json.Get(o, "uidSeq"), 1), taken.Count == 0 ? 1 : taken.Max() + 1);
            foreach (var c in pendingUid) c.Uid = next++;
            r.Deck = cards;
            r.UidSeq = next;

            r.Relics.AddRange(Strings(Json.Get(o, "relics")).Where(d.Relics.ContainsKey));
            r.Killed = Strings(Json.Get(o, "killed"));
            r.Kind.AddRange(Strings(Json.Get(o, "kind")));
            Fill(r.Seen, Json.Get(o, "seen"));
            r.Recent.AddRange(Strings(Json.Get(o, "recent")));
            Fill(r.Offered, Json.Get(o, "offered"));
            r.LastOffered = Strings(Json.Get(o, "lastOffered"));
            var bosses = Strings(Json.Get(o, "bosses"));
            for (var i = 0; i < d.Stages.Count; i++)
            {
                var b = i < bosses.Count ? bosses[i] : null;
                r.Bosses.Add(b != null && d.Enemies.ContainsKey(b) ? b : d.Stages[i].Boss.Count > 0 ? r.Rng.Pick(d.Stages[i].Boss) : null);
            }

            var ch = Json.Arr(Json.Get(o, "choices"));
            if (ch != null)
            {
                var list = ch.Select(x => Json.Obj(x)).Where(x => x != null).Select(x => new Encounter
                {
                    T = Json.Str(Json.Get(x, "t")), Enemy = Json.Str(Json.Get(x, "enemy")), Ev = Json.Str(Json.Get(x, "ev")),
                    Hero = Json.Str(Json.Get(x, "hero")), Last = Json.Bool(Json.Get(x, "last")),
                }).ToList();
                var lore = new Lore(g);
                var events = g.Events.Select(e => Json.Str(Json.Get(Json.Obj(e), "id"))).ToList();
                bool Ok(Encounter e) => e.T != null && (e.Enemy == null || d.Enemies.ContainsKey(e.Enemy))
                    && (e.T != "event" || events.Contains(e.Ev)) && (e.T != "meet" || (e.Hero != null && lore.Meet(e.Hero) != null));
                r.Choices = list.Count > 0 && list.All(Ok) ? list : null;
            }
            r.Prev = Json.Str(Json.Get(o, "prev"));
            r.Forced = Json.Bool(Json.Get(o, "forced"));
            Fill(r.EvSeen, Json.Get(o, "evSeen"));
            r.EvLast = Json.Str(Json.Get(o, "evLast"));
            r.FinalPrep = Json.Str(Json.Get(o, "finalPrep"));
            r.Final = Json.Str(Json.Get(o, "final"));
            if (r.Final != null && !d.Enemies.ContainsKey(r.Final)) r.Final = null;
            var fm = Json.Obj(Json.Get(o, "fmod"));
            if (fm != null)
                r.Fmod = new FightMod
                {
                    Str = Json.Int(Json.Get(fm, "str")), Weak = Json.Int(Json.Get(fm, "weak")), Stun = Json.Int(Json.Get(fm, "stun")),
                    GoldMul = Json.Num(Json.Get(fm, "goldMul"), 1), HpMul = Json.Num(Json.Get(fm, "hpMul"), 1),
                    Talked = Json.Bool(Json.Get(fm, "talked")), Calm = Json.Bool(Json.Get(fm, "calm")),
                };

            Fill(r.Rel, Json.Get(o, "rel"));
            r.Fallen.AddRange(Strings(Json.Get(o, "fallen")));
            r.Met.AddRange(Strings(Json.Get(o, "met")));
            r.MeetLog.AddRange(Strings(Json.Get(o, "meetLog")));
            r.Secrets.AddRange(Strings(Json.Get(o, "secrets")));
            Fill(r.Grudge, Json.Get(o, "grudge"));
            var tone = Json.Obj(Json.Get(o, "tone"));
            r.Peace = Json.Int(Json.Get(tone, "peace"));
            r.Anger = Json.Int(Json.Get(tone, "anger"));
            r.Pass = Json.Int(Json.Get(tone, "pass"));
            var mp = Json.Obj(Json.Get(o, "meetPlan"));
            if (mp != null) foreach (var kv in mp) if (int.TryParse(kv.Key, out var step) && kv.Value is string hero) r.MeetPlan[step] = hero;
            r.Forgiven = Json.Str(Json.Get(o, "forgiven"));
            r.FinalDark = Json.Str(Json.Get(o, "finalDark"));
            var st = Json.Obj(Json.Get(o, "st"));
            if (st != null) foreach (var kv in st) if (kv.Value is double v) r.St[kv.Key] = (long)v;
            return r;
        }

        static Pending PendingFrom(Defs d, Dictionary<string, object> o)
        {
            if (o == null) return null;
            var p = new Pending
            {
                T = Json.Str(Json.Get(o, "t")), Enemy = Json.Str(Json.Get(o, "enemy")), Tier = Json.Str(Json.Get(o, "tier")),
                Ev = Json.Str(Json.Get(o, "ev")), Hero = Json.Str(Json.Get(o, "hero")), Last = Json.Bool(Json.Get(o, "last")),
                Fight = Json.Str(Json.Get(o, "fight")),
            };
            var t = p.T;
            if (t == null) return null;
            bool Foe() => p.Enemy != null && d.Enemies.ContainsKey(p.Enemy);
            if ((Tiers.Contains(t) || t == "talk") && !Foe()) return null;
            if (t == "talk" && !Tiers.Contains(p.Tier)) return null;
            if (t == "meet" && (p.Hero == null || new Lore(d.Data).Meet(p.Hero) == null)) return null;
            if (t == "event" && !d.Data.Events.Any(e => Json.Str(Json.Get(Json.Obj(e), "id")) == p.Ev)) return null;
            if (t == "shop") p.Shop = ShopFrom(d, Json.Obj(Json.Get(o, "shop")));
            if (t == "reward")
            {
                var r = Json.Obj(Json.Get(o, "r"));
                var ids = Strings(Json.Get(r, "ids"));
                if (r == null || ids.Count == 0 || !ids.All(d.Cards.ContainsKey)) return new Pending { T = "next" };
                p.Reward = new Reward { Boss = Json.Bool(Json.Get(r, "boss")), Gold = Json.Int(Json.Get(r, "gold")), Healed = Json.Int(Json.Get(r, "healed")), Ids = ids };
            }
            if (t == "bossrelic")
            {
                var opts = Json.Arr(Json.Get(o, "opts"));
                if (opts != null) { var l = Strings(opts); p.Opts = l.All(d.Relics.ContainsKey) ? l : null; }
            }
            if ((t == "after" && !(Foe() && Tiers.Contains(p.Tier))) || (t == "afterdone" && !Tiers.Contains(p.Tier))) return new Pending { T = "next" };
            if (t == "defeat") p.Fight = Foe() && Tiers.Contains(p.Tier) ? FixSnap(d, p.Fight) : null;
            return p;
        }

        static ShopState ShopFrom(Defs d, Dictionary<string, object> o)
        {
            if (o == null) return null;
            ShopItem It(object x, bool card)
            {
                var i = Json.Obj(x);
                if (i == null) return null;
                var id = Json.Str(Json.Get(i, "id"));
                if (card && (id == null || !d.Cards.ContainsKey(id))) return null;
                return new ShopItem { Id = id, Price = Json.Int(Json.Get(i, "price")), Sold = Json.Bool(Json.Get(i, "sold")) };
            }
            var cards = (Json.Arr(Json.Get(o, "cards")) ?? new List<object>()).Select(x => It(x, true)).ToList();
            var s = new ShopState
            {
                Cards = cards, Tea = It(Json.Get(o, "tea"), false), Remove = It(Json.Get(o, "remove"), false), Up = It(Json.Get(o, "up"), false),
                Rerolls = Json.Int(Json.Get(o, "rerolls")),
            };
            var rel = Json.Obj(Json.Get(o, "relic"));
            if (rel != null)
            {
                s.Relic = It(rel, false);
                if (s.Relic.Id == null || !d.Relics.ContainsKey(s.Relic.Id)) return null;
            }
            if (cards.Count == 0 || cards.Any(c => c == null) || s.Tea == null || s.Remove == null || s.Up == null) return null;
            return s;
        }

        static List<string> Strings(object v) => (Json.Arr(v) ?? new List<object>()).OfType<string>().ToList();

        static void Fill(Dictionary<string, int> to, object v)
        {
            var o = Json.Obj(v);
            if (o == null) return;
            foreach (var kv in o) if (kv.Value is double n) to[kv.Key] = (int)n;
        }
    }
}
