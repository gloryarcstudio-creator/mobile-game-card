// Случайный бот: в отличие от бота из CombatTests, он выбирает ответы и карты наугад, играет на всех сложностях
// и после каждого действия проверяет, что числа забега и боя остаются в разумных границах.
// Число забегов задаёт переменная FUZZ_RUNS (по умолчанию немного, чтобы тесты шли быстро).
using System;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;

namespace Fitil.Tests
{
    public static class FuzzTests
    {
        static Defs defs;
        static Defs D => defs ??= Defs.From(GameData.Parse("ru", Program.Data("data.ru.json")));

        public static void TestRandomBotKeepsInvariants()
        {
            Loc.Use("ru", null);
            var runs = int.TryParse(Environment.GetEnvironmentVariable("FUZZ_RUNS"), out var n) ? n : 40;
            var classes = D.Data.Classes.Keys.ToList();
            int wins = 0, fights = 0;
            for (var i = 0; i < runs; i++)
            {
                var cls = classes[i % classes.Count];
                var diff = i % D.Data.Difficulties.Count;
                var seed = (uint)(i * 2654435761u + 17);
                try { var r = Run(cls, diff, seed, i % 2 == 1, ref fights); if (r) wins++; }
                catch (Exception e) when (!(e is AssertException))
                {
                    throw new AssertException($"{cls} сложность {diff} зерно {seed}: {e.GetType().Name}: {e.Message} @ {e.StackTrace?.Split('\n').FirstOrDefault()?.Trim()}");
                }
            }
            Console.WriteLine($"   забегов: {runs}, побед: {wins}, боёв: {fights}");
        }

        static bool Run(string cls, int diff, uint seed, bool sturdy, ref int fights)
        {
            var rnd = new Random((int)seed);
            var g = RunGame.New(D, cls, diff, seed);
            var tag = $"{cls} сложность {diff} зерно {seed}";
            // случайный бот редко доходит далеко: каждому второму забегу дан запас здоровья, чтобы проверить поздние стадии и финал
            if (sturdy) { g.Run.MaxHp += 400; g.Run.Hp = g.Run.MaxHp; }
            void CheckRun(string after)
            {
                var r = g.Run;
                Assert.True(r.MaxHp > 0, $"{tag}: MaxHp {r.MaxHp} после {after}");
                Assert.True(r.Hp > 0 && r.Hp <= r.MaxHp, $"{tag}: HP {r.Hp}/{r.MaxHp} после {after}");
                Assert.True(r.Gold >= 0, $"{tag}: монеты {r.Gold} после {after}");
                Assert.True(r.Deck.Count > 0, $"{tag}: пустая колода после {after}");
                Assert.True(r.Deck.Select(c => c.Uid).Distinct().Count() == r.Deck.Count, $"{tag}: одинаковые номера карт после {after}");
                Assert.True(r.Relics.Distinct().Count() == r.Relics.Count, $"{tag}: талисман дважды после {after}");
                foreach (var c in r.Deck) Assert.True(D.Cards.ContainsKey(c.Id), $"{tag}: неизвестная карта {c.Id}");
                // сохранение не теряет и не меняет забег
                var snap = RunSave.Snap(r);
                Assert.Equal(snap, RunSave.Snap(RunSave.FromSnap(D, snap)), $"{tag}: снимок после {after}");
            }
            bool Fight(string id, string tier, ref int count)
            {
                count++;
                var c = new Combat(D, g.Run);
                c.Start(id, tier, g.SetupFor(id, tier));
                for (var k = 0; k < 3000 && c.End == CombatEnd.None; k++)
                {
                    var can = Enumerable.Range(0, c.Hand.Count).Where(x => c.CantPlay(c.Hand[x]) == null).ToList();
                    if (can.Count > 0 && rnd.Next(100) < 88)
                    {
                        var i = can[rnd.Next(can.Count)];
                        var name = c.Hand[i].Id;
                        Assert.True(c.PlayCard(i), $"{tag}: карта {name} не сыграна, хотя можно");
                    }
                    else c.EndTurn();
                    var w = $"{tag}: бой с {id}, ход {c.Turn}";
                    Assert.True(c.EnergyNow >= 0, $"{w}: энергия {c.EnergyNow}");
                    Assert.True(c.BlockNow >= 0, $"{w}: защита {c.BlockNow}");
                    // ровно до порога доходит Фонарь Ивы после вспышки от карты, как в веб-версии
                    Assert.True(c.FlameNow >= 0 && (c.End != CombatEnd.None || c.FlameNow <= Math.Max(c.FlameMaxNow, Balance.FlameMax)), $"{w}: огоньки {c.FlameNow}");
                    Assert.True(c.Enemy.Block >= 0, $"{w}: защита врага {c.Enemy.Block}");
                    Assert.True(g.Run.Hp <= g.Run.MaxHp, $"{w}: HP {g.Run.Hp}/{g.Run.MaxHp}");
                    Assert.True(c.Hand.Count <= 10, $"{w}: в руке {c.Hand.Count}");
                    var all = c.Draw.Concat(c.Hand).Concat(c.Disc).Concat(c.Exh).ToList();
                    Assert.True(all.Distinct().Count() == all.Count, $"{w}: одна карта в двух стопках");
                    if (c.End == CombatEnd.None) Assert.True(g.Run.Hp > 0 && c.Enemy.Hp > 0, $"{w}: бой идёт при HP {g.Run.Hp} и HP врага {c.Enemy.Hp}");
                }
                Assert.True(c.End != CombatEnd.None, $"{tag}: бой с {id} не закончился");
                if (c.End == CombatEnd.Defeat) return false;
                Assert.True(g.Run.Hp > 0, $"{tag}: победа над {id} при HP {g.Run.Hp}");
                switch (g.Win(c))
                {
                    case AfterWin.Victory: return true;
                    case AfterWin.Plea:
                        g.AfterChoose(id, tier, rnd.Next(2) == 0);
                        if (tier == "boss") BossRelic(); else Take(g.MakeReward(tier));
                        break;
                    case AfterWin.BossRelic: BossRelic(); break;
                    default: Take(g.MakeReward(tier)); break;
                }
                return true;
            }
            void BossRelic() { var o = g.BossRelicOptions(); if (o.Count > 0 && rnd.Next(4) > 0) g.AddRelic(o[rnd.Next(o.Count)]); Take(g.MakeReward("boss")); }
            void Take(Reward r)
            {
                Assert.True(r.Ids.Count >= 2, tag + ": карт в награде " + r.Ids.Count);
                Assert.True(r.Ids.Distinct().Count() == r.Ids.Count, tag + ": одинаковые карты в награде");
                if (rnd.Next(5) > 0) g.TakeCard(r.Ids[rnd.Next(r.Ids.Count)]);
            }
            void Prompt(DeckPrompt p, int cost)
            {
                if (p == DeckPrompt.None) return;
                var l = g.PromptList(p);
                if (l.Count > 0 && rnd.Next(5) > 0) g.ApplyPrompt(p, l[rnd.Next(l.Count)], cost);
            }
            for (var guard = 0; guard < 400; guard++)
            {
                var ch = g.Choices();
                Assert.True(ch.Count > 0, tag + ": пустая развилка");
                var o = g.Choose(rnd.Next(ch.Count), out var talk);
                var final = o.T == "boss" && D.IsFinalStep(g.Run.Step);
                switch (o.T)
                {
                    case "fight": case "elite": case "boss":
                    {
                        var id = o.Enemy; var tier = o.T;
                        if (talk)
                        {
                            var ops = g.TalkOptions(id, tier).Where(x => x.Can).ToList();
                            Assert.True(ops.Count > 0, $"{tag}: в разговоре с {id} нет доступных ответов");
                            var res = g.TalkChoose(id, tier, ops[rnd.Next(ops.Count)].K, out _);
                            if (res.Next == "next") break;
                            if (res.Next == "bossrelic") { BossRelic(); break; }
                            id = res.Fight;
                        }
                        if (!Fight(id, tier, ref fights)) return false;
                        if (final) return true;
                        break;
                    }
                    case "event":
                    {
                        var ops = g.EventOptions(o.Ev);
                        var can = Enumerable.Range(0, ops.Count).Where(x => ops[x].Can).ToList();
                        Assert.True(can.Count > 0, $"{tag}: в событии {o.Ev} нет доступных ответов");
                        var res = g.EventAct(o.Ev, can[rnd.Next(can.Count)]);
                        Prompt(res.Prompt, res.PromptCost);
                        if (res.Fight != null && !Fight(res.Fight, "fight", ref fights)) return false;
                        break;
                    }
                    case "shop":
                    {
                        var s = g.NewShop();
                        for (var k = 0; k < 6; k++)
                            switch (rnd.Next(6))
                            {
                                case 0: g.BuyCard(s, rnd.Next(s.Cards.Count)); break;
                                case 1: g.BuyRelic(s); break;
                                case 2: g.BuyTea(s); break;
                                case 3: g.Reroll(s); break;
                                case 4: if (s.Remove != null && !s.Remove.Sold && g.CanAfford(s.Remove)) { var l = g.PromptList(DeckPrompt.Remove); if (l.Count > 0) { g.PayService(s.Remove); g.ApplyPrompt(DeckPrompt.Remove, l[rnd.Next(l.Count)]); } } break;
                                default: if (s.Up != null && !s.Up.Sold && g.CanAfford(s.Up)) { var l = g.PromptList(DeckPrompt.Upgrade); if (l.Count > 0) { g.PayService(s.Up); g.ApplyPrompt(DeckPrompt.Upgrade, l[rnd.Next(l.Count)]); } } break;
                            }
                        break;
                    }
                    case "rest":
                        switch (rnd.Next(3))
                        {
                            case 0: if (g.CanRestHeal) g.Rest(); break;
                            case 1: Prompt(DeckPrompt.Upgrade, 0); break;
                            default: Prompt(DeckPrompt.Remove, 0); break;
                        }
                        break;
                    case "chest": if (rnd.Next(4) > 0) g.OpenChest(out _); break;
                    case "meet":
                    {
                        var ops = g.MeetOptions(o.Hero).Where(x => x.Can).ToList();
                        Assert.True(ops.Count > 0, $"{tag}: во встрече с {o.Hero} нет доступных ответов");
                        var op = ops[rnd.Next(ops.Count)];
                        if (g.MeetNeedsUpgrade(op)) { var l = g.PromptList(DeckPrompt.Upgrade); g.UpgradeCard(l[rnd.Next(l.Count)]); }
                        Assert.True(g.MeetChoose(o.Hero, op) != null, tag + ": итог встречи");
                        break;
                    }
                }
                CheckRun(o.T + (o.Ev != null ? " " + o.Ev : "") + (o.Hero != null ? " " + o.Hero : ""));
                g.Advance();
                g.Notes.Clear();
            }
            throw new AssertException(tag + ": забег не закончился за 400 шагов");
        }
    }
}
