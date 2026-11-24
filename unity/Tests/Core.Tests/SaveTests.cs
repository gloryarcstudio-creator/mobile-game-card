// Сохранение забега: снимок и чтение ничего не теряют (бот, который сохраняется и читается на каждой развилке,
// проходит тот же путь, что и без этого), экран выхода сохраняется, испорченное сохранение чинится.
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;

namespace Fitil.Tests
{
    public static class SaveTests
    {
        static Defs defs;
        static Defs D => defs ??= Defs.From(GameData.Parse("ru", Program.Data("data.ru.json")));

        public static void TestReloadEveryStepKeepsRun()
        {
            Loc.Use("ru", null);
            var n = 0;
            foreach (var cls in D.Data.Classes.Keys.Take(4))
            {
                for (var seed = 1u; seed <= 2; seed++)
                {
                    var a = new List<string>();
                    var b = new List<string>();
                    var ra = CombatTests.BotRun(cls, seed * 104729, false, a);
                    var rb = CombatTests.BotRun(cls, seed * 104729, true, b);
                    Assert.Equal(ra.step, rb.step, $"{cls}/{seed}: шаг конца");
                    Assert.Equal(ra.won, rb.won, $"{cls}/{seed}: итог");
                    Assert.Equal(a.Count, b.Count, $"{cls}/{seed}: число развилок");
                    for (var i = 0; i < a.Count; i++) Assert.Equal(a[i], b[i], $"{cls}/{seed}: развилка {i + 1}");
                    n += a.Count;
                }
            }
            System.Console.WriteLine($"   развилок сверено: {n}");
        }

        public static void TestPendingRoundTrip()
        {
            Loc.Use("ru", null);
            var g = RunGame.New(D, "courier", 1, 42);
            g.Choices();
            var shop = g.NewShop();
            g.Run.Gold = 999;
            Assert.True(g.BuyCard(shop, 1), "покупка");
            var save = new SaveFile
            {
                Run = g.Run, At = 123,
                P = new Pending { T = "shop", Shop = shop, Last = true },
            };
            var json = RunSave.Write(save);
            var back = RunSave.Read(D, json);
            Assert.True(back != null, "сохранение читается");
            Assert.Equal(json, RunSave.Write(back), "запись после чтения та же");
            Assert.True(back.P.Shop.Cards[1].Sold, "проданная карта осталась проданной");

            var rw = g.MakeReward("elite");
            var s2 = RunSave.Read(D, RunSave.Write(new SaveFile { Run = g.Run, P = new Pending { T = "reward", Reward = rw } }));
            Assert.Equal(string.Join(",", rw.Ids), string.Join(",", s2.P.Reward.Ids), "карты награды");

            var snap = RunSave.Snap(g.Run);
            var s3 = RunSave.Read(D, RunSave.Write(new SaveFile { Run = g.Run, P = new Pending { T = "defeat", Enemy = "inkcat", Tier = "fight", Fight = snap }, Back = snap }));
            Assert.Equal(snap, s3.P.Fight, "снимок начала боя");
            Assert.Equal(snap, s3.Back, "снимок развилки");
        }

        public static void TestBrokenSaveIsFixed()
        {
            Loc.Use("ru", null);
            Assert.True(RunSave.Read(D, "не json") == null, "мусор — нет сохранения");
            Assert.True(RunSave.Read(D, "{\"v\":1}") == null, "без забега — нет сохранения");
            var json = "{\"v\":1,\"run\":{\"cls\":\"nobody\",\"step\":999,\"hp\":500,\"maxHp\":40,\"gold\":-5,"
                + "\"deck\":[{\"id\":\"strike\",\"uid\":3},{\"id\":\"gone\",\"uid\":4},{\"id\":\"strike\",\"uid\":3}],"
                + "\"relics\":[\"ivalamp\",\"lost\"],\"choices\":[{\"t\":\"fight\",\"enemy\":\"nobody\"}]},"
                + "\"pending\":{\"t\":\"talk\",\"enemy\":\"nobody\",\"tier\":\"fight\"}}";
            var s = RunSave.Read(D, json);
            Assert.True(s != null, "починенное сохранение читается");
            Assert.Equal("lamp", s.Run.Cls, "незнакомый герой");
            Assert.Equal(D.MaxSteps - 1, s.Run.Step, "шаг в пределах пути");
            Assert.Equal(40, s.Run.Hp, "здоровье не больше максимума");
            Assert.Equal(0, s.Run.Gold, "монеты не меньше нуля");
            Assert.Equal(2, s.Run.Deck.Count, "незнакомая карта убрана");
            Assert.True(s.Run.Deck[0].Uid != s.Run.Deck[1].Uid, "номера карт разные");
            Assert.True(s.Run.Relics.SequenceEqual(new[] { "ivalamp" }), "незнакомый талисман убран");
            Assert.True(s.Run.Choices == null, "развилка с незнакомым врагом сброшена");
            Assert.True(s.P == null, "разговор с незнакомым врагом — к развилке");
            Assert.Equal(D.Stages.Count, s.Run.Bosses.Count, "боссы стадий");
        }
    }
}
