using System;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;

namespace Fitil.Tests
{
    /// <summary>Повтор боёв, записанных в браузере (tools/unity/combat_fixtures.js), на C#.</summary>
    public static class CombatTests
    {
        static Defs defs;
        static Defs D => defs ??= Defs.From(GameData.Parse("ru", Program.Data("data.ru.json")));

        static string Ids(IEnumerable<CardInst> l) => string.Join(",", l.Select(c => c.Id + (c.Up ? "+" : "") + (c.Grow != 0 ? "~g" + c.Grow : "") + (c.Mult > 1 ? "~m" + c.Mult : "")));
        static string JIds(object l) => string.Join(",", Json.Arr(l).Select(x => (string)x));
        static int I(object o) => (int)Json.Num(o);

        /// <summary>Отличия состояния C# от записанного, пустой список — совпало.</summary>
        static List<string> Diff(Combat g, Dictionary<string, object> s, bool last)
        {
            var d = new List<string>();
            void eq(string k, int want, int got) { if (want != got) d.Add($"{k}: {got} вместо {want}"); }
            void eqs(string k, string want, string got) { if (want != got) d.Add($"{k}: [{got}] вместо [{want}]"); }
            var r = g.Run;
            // после конца боя веб-версия уже раздаёт награды — сверяем только сам бой
            if (!last) { eq("hp", I(s["hp"]), r.Hp); eq("maxHp", I(s["maxHp"]), r.MaxHp); eq("gold", I(s["gold"]), r.Gold); }
            var e = Json.Obj(s["e"]);
            eq("e.hp", I(e["hp"]), Math.Max(g.Enemy.Hp, I(e["hp"]) <= 0 ? I(e["hp"]) : g.Enemy.Hp));
            if (last) return d;
            eq("energy", I(s["energy"]), g.EnergyNow); eq("block", I(s["block"]), g.BlockNow); eq("flame", I(s["flame"]), g.FlameNow);
            eq("str", I(s["str"]), g.Str); eq("tmpStr", I(s["tmpStr"]), g.TmpStr); eq("thorns", I(s["thorns"]), g.ThornsNow);
            eq("pWeak", I(s["pWeak"]), g.PWeak); eq("frail", I(s["frail"]), g.Frail); eq("dog", I(s["dog"]), g.DogNow);
            eq("paid", I(s["paid"]), g.Paid); eq("turn", I(s["turn"]), g.Turn); eq("played", I(s["played"]), g.PlayedTurn);
            eq("e.max", I(e["max"]), g.Enemy.Max); eq("e.block", I(e["block"]), g.Enemy.Block); eq("e.str", I(e["str"]), g.Enemy.Str);
            eq("e.weak", I(e["weak"]), g.Enemy.Weak); eq("e.vuln", I(e["vuln"]), g.Enemy.Vuln); eq("e.burn", I(e["burn"]), g.Enemy.Burn);
            eq("e.thorns", I(e["thorns"]), g.Enemy.Thorns); eq("e.stun", I(e["stun"]), g.Enemy.Stun); eq("e.pi", I(e["pi"]), g.Enemy.Pi);
            eq("e.nest", I(e["nest"]), g.Enemy.Nest); eq("e.boil", I(e["boil"]), g.Enemy.Boil); eq("e.mist", I(e["mist"]), g.Enemy.Mist);
            eqs("hand", JIds(s["hand"]), Ids(g.Hand)); eqs("draw", JIds(s["draw"]), Ids(g.Draw));
            eqs("disc", JIds(s["disc"]), Ids(g.Disc)); eqs("exh", JIds(s["exh"]), Ids(g.Exh));
            var ch = string.Join(",", Json.Obj(s["charms"]).OrderBy(k => k.Key, StringComparer.Ordinal).Select(k => k.Key + "=" + I(k.Value)));
            eqs("charms", ch, string.Join(",", g.Charms.Where(k => k.Value != 0 || true).OrderBy(k => k.Key, StringComparer.Ordinal).Select(k => k.Key + "=" + k.Value)));
            eq("dels", I(s["dels"]), g.Deliveries.Count);
            return d;
        }

        public static void TestCombatsMatchWeb()
        {
            Loc.Use("ru", null);
            var all = Json.Arr(Json.Parse(Program.Fixture("combats.json")));
            int n = 0, bad = 0, steps = 0;
            var fails = new List<string>();
            foreach (var x in all)
            {
                var f = Json.Obj(x);
                n++;
                var name = $"{f["cls"]}/{f["enemy"]}/{f["seed"]}";
                string err = null;
                try { err = Replay(f, ref steps); }
                catch (Exception ex) { err = "исключение: " + ex.GetType().Name + " " + ex.Message + " " + ex.StackTrace?.Split('\n').FirstOrDefault()?.Trim(); }
                if (err != null) { bad++; fails.Add(name + " " + err); }
            }
            if (fails.Count > 0)
            {
                var only = Environment.GetEnvironmentVariable("COMBAT_SHOW");
                foreach (var l in fails.Take(only != null ? int.Parse(only) : 8)) Console.WriteLine("   " + l);
            }
            Assert.True(bad == 0, $"{bad} из {n} боёв расходятся (сверено шагов: {steps})");
        }

        static string Replay(Dictionary<string, object> f, ref int steps)
        {
            var st = Json.Obj(f["start"]);
            var run = new RunState { Cls = (string)f["cls"], Diff = 1, Step = I(f["step"]), Hp = I(st["hp"]), MaxHp = I(st["maxHp"]), Gold = I(st["gold"]) };
            foreach (var r in Json.Arr(st["relics"])) run.Relics.Add((string)r);
            foreach (var c in Json.Arr(st["deck"])) { var o = Json.Obj(c); run.Deck.Add(run.Mk((string)o["id"], Json.Bool(o["up"]))); }
            run.Rng = new Rng((uint)I(f["seed"]));
            var g = new Combat(D, run);
            g.Start((string)f["enemy"], (string)f["tier"], new CombatSetup { Att = f["att"] as string, Tie = f["tie"] as string });
            var list = Json.Arr(f["steps"]);
            for (var k = 0; k < list.Count; k++)
            {
                var s = Json.Obj(list[k]);
                var act = (string)s["act"];
                if (act.StartsWith("play ")) g.PlayCard(int.Parse(act.Substring(5)));
                else if (act == "end") g.EndTurn();
                var last = k == list.Count - 1 && f["end"] != null;
                var d = Diff(g, s, last);
                steps++;
                if (d.Count > 0)
                {
                    var prev = k > 0 ? Json.Obj(list[k - 1]) : null;
                    return $"шаг {k} ({act}{(act.StartsWith("play ") && prev != null ? " " + Json.Arr(prev["hand"])[int.Parse(act.Substring(5))] : "")}): {string.Join("; ", d.Take(6))}";
                }
                if (last)
                {
                    var want = (string)f["end"] == "win" ? CombatEnd.Win : CombatEnd.Defeat;
                    if (g.End != want) return $"конец: {g.End} вместо {want}";
                }
            }
            return null;
        }

        /// <summary>Бот проходит целые забеги на C# за каждого героя: развилки, бои, разговоры, события,
        /// лавка, костёр, сундук, встречи, награды. Ловит исключения и зависания логики забега.</summary>
        public static void TestBotRunsWholeGame()
        {
            Loc.Use("ru", null);
            var report = new List<string>();
            foreach (var cls in D.Data.Classes.Keys)
            {
                for (var seed = 1u; seed <= 6; seed++)
                {
                    var (step, won, types) = BotRun(cls, seed * 7919);
                    report.Add($"{cls}/{seed}: {(won ? "победа" : "шаг " + (step + 1))} {types}");
                }
            }
            var wins = report.Count(x => x.Contains("победа"));
            Console.WriteLine($"   забегов: {report.Count}, побед: {wins}; " + string.Join(" | ", report.Take(3)));
        }

        /// <summary>Бот играет забег. reload — на каждой развилке забег сохраняется и читается заново (проверка сохранений).
        /// log — состояние забега на каждой развилке.</summary>
        internal static (int step, bool won, string types) BotRun(string cls, uint seed, bool reload = false, List<string> log = null)
        {
            var g = RunGame.New(D, cls, 1, seed);
            var seen = new HashSet<string>();
            bool Fight(string id, string tier)
            {
                var c = new Combat(D, g.Run);
                c.Start(id, tier, g.SetupFor(id, tier));
                for (var k = 0; k < 600 && c.End == CombatEnd.None; k++)
                {
                    var i = c.Hand.FindIndex(x => c.CantPlay(x) == null);
                    if (i >= 0) c.PlayCard(i); else c.EndTurn();
                }
                Assert.True(c.End != CombatEnd.None, $"{cls}: бой с {id} не закончился");
                if (c.End == CombatEnd.Defeat) return false;
                switch (g.Win(c))
                {
                    case AfterWin.Victory: return true;
                    case AfterWin.Plea:
                        Assert.True(g.PleaLine(id) != null, "реплика пощады " + id);
                        g.AfterChoose(id, tier, true);
                        if (tier == "boss") { BossRelic(); } else Take(g.MakeReward(tier));
                        break;
                    case AfterWin.BossRelic: BossRelic(); break;
                    default: Take(g.MakeReward(tier)); break;
                }
                return true;
            }
            void BossRelic() { var o = g.BossRelicOptions(); if (o.Count > 0) g.AddRelic(o[0]); Take(g.MakeReward("boss")); }
            void Take(Reward r) { Assert.True(r.Ids.Count >= 2, "карт в награде"); g.TakeCard(r.Ids[0]); }
            for (var guard = 0; guard < 400; guard++)
            {
                if (reload) g.Run = RunSave.FromSnap(D, RunSave.Snap(g.Run));
                var ch = g.Choices();
                log?.Add(RunSave.Snap(g.Run));
                Assert.True(ch.Count > 0, "пустая развилка");
                // бот выбирает по кругу, чтобы побывать везде
                var pickI = guard % ch.Count;
                var o = g.Choose(pickI, out var talk);
                seen.Add(o.T);
                var final = o.T == "boss" && D.IsFinalStep(g.Run.Step);
                switch (o.T)
                {
                    case "fight": case "elite": case "boss":
                    {
                        var id = o.Enemy; var tier = o.T;
                        if (talk)
                        {
                            Assert.True(g.TalkLine(id) != null, "реплика разговора " + id);
                            var ops = g.TalkOptions(id, tier);
                            var op = ops.Last(x => x.Can);
                            var res = g.TalkChoose(id, tier, op.K, out _);
                            seen.Add("talk:" + op.K);
                            if (res.Next == "next") break;
                            if (res.Next == "bossrelic") { BossRelic(); break; }
                            id = res.Fight;
                        }
                        if (!Fight(id, tier)) return (g.Run.Step, false, string.Join(",", seen.OrderBy(x => x)));
                        if (final) return (g.Run.Step, true, string.Join(",", seen.OrderBy(x => x)));
                        break;
                    }
                    case "event":
                    {
                        var ops = g.EventOptions(o.Ev);
                        var i = ops.FindIndex(x => x.Can);
                        var res = g.EventAct(o.Ev, i);
                        if (res.Prompt != DeckPrompt.None) { var l = g.PromptList(res.Prompt); if (l.Count > 0) g.ApplyPrompt(res.Prompt, l[0], res.PromptCost); }
                        if (res.Fight != null && !Fight(res.Fight, "fight")) return (g.Run.Step, false, string.Join(",", seen.OrderBy(x => x)));
                        break;
                    }
                    case "shop":
                    {
                        var s = g.NewShop();
                        g.BuyCard(s, 0); g.BuyTea(s); g.Reroll(s);
                        break;
                    }
                    case "rest": if (g.CanRestHeal) g.Rest(); else g.UpgradeRandom(1); break;
                    case "chest": g.OpenChest(out _); break;
                    case "meet":
                    {
                        var ops = g.MeetOptions(o.Hero);
                        var op = ops.First(x => x.Can);
                        if (g.MeetNeedsUpgrade(op)) g.UpgradeCard(g.PromptList(DeckPrompt.Upgrade)[0]);
                        Assert.True(g.MeetChoose(o.Hero, op) != null, "итог встречи");
                        break;
                    }
                }
                Assert.True(g.Run.Hp > 0 && g.Run.Hp <= g.Run.MaxHp, $"{cls}: HP {g.Run.Hp}/{g.Run.MaxHp} после {o.T}");
                g.Advance();
                g.Notes.Clear();
            }
            throw new AssertException(cls + ": забег не закончился за 400 шагов");
        }
    }
}
