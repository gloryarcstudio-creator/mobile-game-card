using System;
using System.Collections.Generic;
using System.Globalization;
using Fitil.Core;

namespace Fitil.Tests
{
    public static class LocTests
    {
        /// <summary>tr() на C# даёт ровно то же, что веб-версия, на всех ключах с подстановками.</summary>
        public static void TestTrMatchesWeb()
        {
            var cases = Json.Arr(Json.Parse(Program.Fixture("tr.json")));
            var dicts = new Dictionary<string, Dictionary<string, string>>
            {
                ["ru"] = null,
                ["en"] = Loc.ParseStrings(Program.Data("strings.en.json")),
                ["uk"] = Loc.ParseStrings(Program.Data("strings.uk.json")),
            };
            int n = 0, bad = 0;
            string first = null;
            string cur = null;
            foreach (var x in cases)
            {
                var c = Json.Obj(x);
                var lang = Json.Str(c["lang"]);
                if (lang != cur) { Loc.Use(lang, dicts[lang]); cur = lang; }
                var fem = Json.Bool(c["fem"]);
                Loc.Gender = () => fem;
                var vars = new List<(string, object)>();
                foreach (var kv in Json.Obj(c["vars"])) vars.Add((kv.Key, kv.Value));
                var got = Loc.Tr(Json.Str(c["key"]), vars.ToArray());
                var want = Json.Str(c["out"]);
                n++;
                if (got != want) { bad++; first ??= $"[{lang}] {c["key"]} -> «{got}» вместо «{want}»"; }
            }
            Assert.True(bad == 0, $"{bad} из {n} расходятся, первый: {first}");
        }

        public static void TestPluralRu()
        {
            Loc.Use("ru", null);
            string f(int k) => Loc.Tr("{n} {n|монета|монеты|монет}", ("n", k));
            Assert.Equal("1 монета", f(1), "1");
            Assert.Equal("3 монеты", f(3), "3");
            Assert.Equal("11 монет", f(11), "11");
            Assert.Equal("21 монета", f(21), "21");
            Assert.Equal("112 монет", f(112), "112");
        }

        public static void TestContextKey()
        {
            Loc.Use("ru", null);
            Assert.Equal("Заточка", Loc.Tr("лавка::Заточка"), "ctx");
        }

        public static void TestDetect()
        {
            Assert.Equal("uk", Loc.Detect(null, "uk"), "телефон uk");
            Assert.Equal("en", Loc.Detect(null, "de"), "чужой язык");
            Assert.Equal("ru", Loc.Detect("ru", "en"), "сохранённый");
        }
    }

    public static class RngTests
    {
        public static void TestMulberryMatchesJs()
        {
            foreach (var x in Json.Arr(Json.Parse(Program.Fixture("rng.json"))))
            {
                var o = Json.Obj(x);
                var r = new Rng((uint)Json.Num(o["seed"]));
                var i = 0;
                foreach (var v in Json.Arr(o["values"]))
                {
                    var got = r.Next();
                    Assert.True(Math.Abs(got - (double)v) < 1e-15, $"зерно {o["seed"]}, число {i}: {got} вместо {v}");
                    i++;
                }
            }
        }
    }

    public static class DataTests
    {
        public static void TestAllLanguagesLoad()
        {
            foreach (var lang in Loc.Langs)
            {
                var g = GameData.Parse(lang, Program.Data($"data.{lang}.json"));
                Assert.Equal(8, g.Classes.Count, lang + " герои");
                Assert.Equal(5, g.Difficulties.Count, lang + " сложности");
                Assert.Equal(113, g.Cards.Count, lang + " карты");
                Assert.Equal(46, g.Enemies.Count, lang + " враги");
                Assert.Equal(71, g.Relics.Count, lang + " талисманы");
                foreach (var h in g.Classes.Values)
                    foreach (var c in h.Deck) Assert.True(g.Cards.ContainsKey(c), $"{lang}: у {h.Id} в колоде нет карты {c}");
            }
        }

        public static void TestSameNumbersInAllLanguages()
        {
            var ru = GameData.Parse("ru", Program.Data("data.ru.json"));
            foreach (var lang in new[] { "en", "uk" })
            {
                var g = GameData.Parse(lang, Program.Data($"data.{lang}.json"));
                foreach (var id in ru.Classes.Keys)
                {
                    Assert.Equal(ru.Classes[id].Hp, g.Classes[id].Hp, $"{lang} {id} hp");
                    Assert.Equal(string.Join(",", ru.Classes[id].Deck), string.Join(",", g.Classes[id].Deck), $"{lang} {id} колода");
                }
                for (var i = 0; i < ru.Difficulties.Count; i++)
                    Assert.Equal(ru.Difficulties[i].Hp, g.Difficulties[i].Hp, $"{lang} сложность {i}");
            }
        }

        public static void TestJsonRoundTrip()
        {
            var raw = Json.Parse(Program.Data("data.uk.json"));
            var again = Json.Parse(Json.Write(raw));
            Assert.Equal(Json.Write(raw), Json.Write(again), "запись и чтение");
        }
    }
}

namespace Fitil.Tests
{
    using System.Collections.Generic;
    using Fitil.Core;

    public static class CardTextTests
    {
        /// <summary>Шаблоны описаний дают вне боя ровно тот текст, что рисует веб-версия (все 113 карт, обе версии, 3 языка).</summary>
        public static void TestStaticDescMatchesWeb()
        {
            var byLang = new Dictionary<string, Dictionary<string, CardTextEntry>>();
            foreach (var l in Loc.Langs) byLang[l] = CardText.Parse(Program.Data($"cardtext.{l}.json"));
            int n = 0, bad = 0;
            string first = null;
            foreach (var x in Json.Arr(Json.Parse(Program.Fixture("carddesc.json"))))
            {
                var c = Json.Obj(x);
                var e = byLang[Json.Str(c["lang"])][Json.Str(c["id"])];
                var got = CardText.Render(Json.Bool(c["up"]) ? e.Up : e.Base, CardText.Static);
                n++;
                if (got != Json.Str(c["out"])) { bad++; first ??= $"[{c["lang"]}] {c["id"]}: «{got}» вместо «{c["out"]}»"; }
            }
            Assert.True(n == 678 && bad == 0, $"{bad} из {n} расходятся, первый: {first}");
        }

        public static void TestRenderWithBonus()
        {
            var s = CardText.Render("Deal ⟦dmg:6⟧ damage.", (k, b, sp) => new CardNumber(b + 2, b), v => v.Up ? $"<up>{v.Value}</up>" : v.Value.ToString());
            Assert.Equal("Deal <up>8</up> damage.", s, "урон с бонусом");
        }
    }
}
