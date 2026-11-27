// Розыгрыш карт: перенос play из js/data.js один в один, имена методов боя с большой буквы.
// Сгенерировано из веб-версии и проверено компилятором; при изменении карты в data.js поправьте и здесь.
// Описания карт — шаблоны в cardtext.<lang>.json (CardText.cs), числа там и здесь должны совпадать.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public static class Cards
    {
        /// <summary>play(g, u, c): g — бой, u — карта улучшена, c — экземпляр карты.</summary>
        public static readonly Dictionary<string, Action<Combat, bool, CardInst>> Plays = new Dictionary<string, Action<Combat, bool, CardInst>>
        {
            ["strike"] = (g, u, c) => g.Attack(u ? 9 : 6),
            ["guard"] = (g, u, c) => g.Block(u ? 8 : 5),
            ["kindle"] = (g, u, c) => { g.Flame(1); g.DrawN(u ? 2 : 1); },
            ["spark"] = (g, u, c) => { g.Attack(u ? 5 : 3); g.Flame(1); },
            ["sparks"] = (g, u, c) => g.Attack(u ? 4 : 3, 3),
            ["cloak"] = (g, u, c) => g.Block(u ? 11 : 8),
            ["tea"] = (g, u, c) => g.Heal(u ? 9 : 6),
            ["wind"] = (g, u, c) => g.DrawN(u ? 3 : 2),
            ["oil"] = (g, u, c) => g.Flame(2),
            ["mirror"] = (g, u, c) => { g.Block(u ? 8 : 5); g.Flame(1); },
            ["heavy"] = (g, u, c) => g.Attack(u ? 18 : 13),
            ["wax"] = (g, u, c) => { g.Block(u ? 8 : 6); g.Weak(u ? 2 : 1); },
            ["ember"] = (g, u, c) => { g.Attack(u ? 7 : 5); g.Burn(u ? 4 : 3); },
            ["snowkick"] = (g, u, c) => { g.Attack(u ? 7 : 5); g.Block(u ? 7 : 5); },
            ["payback"] = (g, u, c) => g.Attack(g.BlockNow),
            ["luckycoin"] = (g, u, c) => { g.Attack(u ? 6 : 4); g.Gold(u ? 8 : 5); },
            ["snowball"] = (g, u, c) => { g.Attack((u ? 7 : 5) + c.Grow); c.Grow = c.Grow + (u ? 4 : 3); },
            ["flurry"] = (g, u, c) => g.Attack(3 + (u ? 4 : 3) * g.Played),
            ["icethrow"] = (g, u, c) => { g.Attack(u ? 9 : 6); if (!g.EnemyDead) g.Chill(1); },
            ["heavybag"] = (g, u, c) => { g.Attack(u ? 13 : 10); g.Block(u ? 8 : 6); },
            ["sbiten"] = (g, u, c) => { g.Heal(u ? 5 : 3); g.DrawN(1); },
            ["sledram"] = (g, u, c) => { g.Attack(u ? 8 : 5); g.Deliver("Сани", d => d.Energy(1)); },
            ["hornblow"] = (g, u, c) => { g.Block(u ? 7 : 5); g.Rush(u ? 3 : 2); },
            ["patch"] = (g, u, c) => { g.Block(u ? 9 : 6); g.ExhaustHand(cd => cd.IsStatus); },
            ["snowstorm"] = (g, u, c) => { g.Attack(u ? 3 : 2, 5); if (!g.EnemyDead) g.Weak(1); },
            ["icelantern"] = (g, u, c) => { g.Vuln(u ? 2 : 1); g.DrawN(1); g.Flame(1); },
            ["cancel"] = (g, u, c) => g.Attack(u ? 8 : 6, g.Enemy.Vuln > 0 ? 2 : 1),
            ["carbon"] = (g, u, c) => g.CopyLast(),
            ["nightshift"] = (g, u, c) => g.Charm("nightshift", u ? 4 : 3),
            ["kindling"] = (g, u, c) => { g.Burn(u ? 6 : 4); g.DrawN(1); },
            ["stamp"] = (g, u, c) => { g.Attack(u ? 8 : 6); g.Vuln(u ? 2 : 1); },
            ["redseal"] = (g, u, c) => { g.Vuln(u ? 3 : 2); g.DrawN(1); },
            ["whistle"] = (g, u, c) => g.Resolve(u ? 2 : 1),
            ["cocoa"] = (g, u, c) => g.Rush(u ? 3 : 2),
            ["prickly"] = (g, u, c) => { g.Block(u ? 6 : 4); g.Thorns(u ? 3 : 2); },
            ["frostlace"] = (g, u, c) => { g.Chill(u ? 3 : 2); g.Block(u ? 6 : 4); },
            ["parcel"] = (g, u, c) => g.Deliver("Посылка", d => { d.Energy(2); if (u) d.DrawN(1); }),
            ["telegram"] = (g, u, c) => g.Deliver("Телеграмма", d => d.DrawN(u ? 3 : 2)),
            ["surprise"] = (g, u, c) => g.Deliver("Бандероль", d => d.Attack(u ? 20 : 14)),
            ["umbrella"] = (g, u, c) => g.Block(u ? 10 : 7),
            ["blotter"] = (g, u, c) => { var n = g.ExhaustHand(cd => cd.IsStatus); g.DrawN((u ? 2 : 1) + n); },
            ["mittens"] = (g, u, c) => g.Charm("mittens", u ? 5 : 3),
            ["inkpen"] = (g, u, c) => g.Charm("inkpen", u ? 3 : 2),
            ["palm"] = (g, u, c) => { var n = g.ConsumeFlame(); if (n > 0) g.Attack((u ? 9 : 7) * n); },
            ["shadow"] = (g, u, c) => { g.Weak(u ? 3 : 2); g.DrawN(u ? 2 : 1); },
            ["blaze"] = (g, u, c) => { g.Burn(u ? 11 : 8); g.Flame(1); },
            ["breath"] = (g, u, c) => { g.Energy(2); if (u) g.DrawN(1); },
            ["lullaby"] = (g, u, c) => g.Stun(),
            ["lastword"] = (g, u, c) => { g.Attack(u ? 14 : 10); if (g.EnemyDead) g.MaxHp(u ? 4 : 3); },
            ["secret"] = (g, u, c) => g.Attack((u ? 11 : 8) + c.Grow),
            ["finale"] = (g, u, c) => g.Attack(u ? 5 : 4, g.Played + 1),
            ["flashpoint"] = (g, u, c) => { g.BurstNow(); if (u) g.Flame(1); },
            ["drift"] = (g, u, c) => g.DoubleBlock(),
            ["pockethog"] = (g, u, c) => g.Thorns(u ? 7 : 5),
            ["drafts"] = (g, u, c) => { var n = g.ExhaustHand(cd => true); if (n != 0) g.Flame(n); },
            ["eveninglamp"] = (g, u, c) => g.Charm("eveninglamp", 1),
            ["stubborn"] = (g, u, c) => g.Charm("stubborn", 1),
            ["compass"] = (g, u, c) => g.Charm("compass", 1),
            ["hearth"] = (g, u, c) => g.Charm("hearth", u ? 4 : 3),
            ["rhythm"] = (g, u, c) => g.Charm("rhythm", 1),
            ["avalanche"] = (g, u, c) => g.Attack((u ? 3 : 2) * g.Disc.Count),
            ["moneyorder"] = (g, u, c) => g.Deliver("Перевод", d => { d.Energy(1); d.DrawN(2); d.Gold(u ? 25 : 15); }),
            ["aurora"] = (g, u, c) => g.Charm("aurora", 1),
            ["returnaddr"] = (g, u, c) => g.Recall(u ? 3 : 2),
            ["frostbite"] = (g, u, c) => { g.Vuln(2); g.Weak(2); g.Chill(2); },
            ["poste"] = (g, u, c) => g.Deliver("До востребования", d => d.Autoplay(u ? 3 : 2)),
            ["starfall"] = (g, u, c) => { for (var k = 0; k < 3 && !g.EnemyDead; k++) { g.Attack(u ? 5 : 4); if (!g.EnemyDead) g.Flame(1); } },
            ["iceprison"] = (g, u, c) => { g.Block(u ? 14 : 10); g.Chill(4); g.Weak(3); },
            ["bonfire"] = (g, u, c) => { g.Burn(u ? 14 : 10); g.Heal(u ? 6 : 4); },
            ["registered"] = (g, u, c) => { var m = c.Mult == 0 ? 1 : c.Mult; c.Mult = 1; g.Attack((u ? 9 : 6) * m); },
            ["chimes"] = (g, u, c) => { g.FreeTurn(); g.DrawN(2); },
            ["lastlight"] = (g, u, c) => { g.Attack(30); if (!g.EnemyDead) g.BurstNow(); },
            ["firebird"] = (g, u, c) => g.Charm("firebird", 1),
            ["eternalwinter"] = (g, u, c) => g.Charm("eternalwinter", 1),
            ["firefly"] = (g, u, c) => { g.Flame(1); if (u) g.DrawN(1); },
            ["lampglass"] = (g, u, c) => g.Block((u ? 5 : 3) + (u ? 3 : 2) * g.FlameNow),
            ["beam"] = (g, u, c) => { g.Attack(u ? 14 : 10); if (!g.EnemyDead) g.BurstNow(); },
            ["urgent"] = (g, u, c) => { g.Attack(u ? 5 : 3); g.DrawN(1); },
            ["express"] = (g, u, c) => { g.Block(u ? 7 : 4); g.Deliver("Экспресс", d => { d.Energy(1); d.DrawN(2); }); },
            ["rushmail"] = (g, u, c) => { var n = g.Played / 2; if (n != 0) g.Energy(n); g.DrawN(u ? 3 : 2); },
            ["icewall"] = (g, u, c) => { g.Block(u ? 17 : 13); g.Chill(u ? 2 : 1); },
            ["hedge"] = (g, u, c) => { g.Thorns(u ? 3 : 2); g.Block(g.ThornsNow * 2); },
            ["standfast"] = (g, u, c) => g.Charm("standfast", 1),
            ["flue"] = (g, u, c) => { g.Burn(u ? 5 : 3); g.Block(g.Enemy.Burn); },
            ["poker"] = (g, u, c) => g.Attack(u ? 8 : 6, g.Enemy.Burn > 0 ? 2 : 1),
            ["fan"] = (g, u, c) => { if (g.Enemy.Burn > 0) g.Burn(g.Enemy.Burn); },
            ["gingerbread"] = (g, u, c) => { g.Attack(u ? 5 : 3); g.Block(u ? 5 : 3); },
            ["dough"] = (g, u, c) => g.Ginger(u ? 3 : 2),
            ["rollingpin"] = (g, u, c) => { g.Attack(u ? 9 : 6); g.Ginger(1); },
            ["glaze"] = (g, u, c) => { g.Block(u ? 9 : 6); g.Glaze(); },
            ["gingerhouse"] = (g, u, c) => g.Charm("gingerhouse", 1),
            ["fair"] = (g, u, c) => g.Attack((u ? 4 : 3) * g.GingerCount),
            ["hone"] = (g, u, c) => { g.Block(u ? 7 : 5); g.Sharpen(u ? 2 : 1); },
            ["gritsparks"] = (g, u, c) => g.Attack((u ? 6 : 4) + (u ? 3 : 2) * g.Hand.Count(x => x.Up)),
            ["oselok"] = (g, u, c) => { if (u) g.DrawN(1); g.Sharpen(99); },
            ["apprentice"] = (g, u, c) => g.Charm("apprentice", 1),
            ["steelring"] = (g, u, c) => g.Attack((u ? 4 : 3) * g.UpCount(c)),
            ["sic"] = (g, u, c) => { g.Dog(u ? 2 : 1); g.Bite(); },
            ["heel"] = (g, u, c) => g.Block((u ? 6 : 4) + g.DogNow),
            ["bone"] = (g, u, c) => g.Dog(u ? 4 : 3),
            ["wolfhound"] = (g, u, c) => g.Charm("wolfhound", 1),
            ["howl"] = (g, u, c) => { g.Dog(g.DogNow); g.Bite(); },
            ["bitterroot"] = (g, u, c) => g.Attack(u ? 15 : 11),
            ["chamomile"] = (g, u, c) => { g.Block(u ? 7 : 5); g.Heal(u ? 4 : 3); },
            ["wormwood"] = (g, u, c) => g.Energy(2),
            ["sleepgrass"] = (g, u, c) => g.Stun(),
            ["livingwater"] = (g, u, c) => g.Heal(g.Paid),
            ["blot"] = (g, u, c) => { },
            ["stale"] = (g, u, c) => { },
        };

        /// <summary>Цена здоровьем (знахарка): сколько HP стоит розыгрыш.</summary>
        public static int PriceOf(CardInst c)
        {
            switch (c.Id)
            {
                case "bitterroot": return 2;
                case "wormwood": return c.Up ? 2 : 3;
                case "sleepgrass": return c.Up ? 2 : 4;
                default: return 0;
            }
        }

        /// <summary>Что карта делает, пока её удерживают в руке в конце хода (onRetain).</summary>
        public static void OnRetain(CardInst c)
        {
            if (c.Id == "secret") c.Grow = c.Grow + (c.Up ? 5 : 4);
            else if (c.Id == "registered") c.Mult = Math.Min(8, (c.Mult == 0 ? 1 : c.Mult) * 2);
        }

        public static void Play(Combat g, CardInst c)
        {
            if (Plays.TryGetValue(c.Id, out var p)) p(g, c.Up, c);
        }

        // Анимация удара у каждой атаки своя (ATK_FX в game.js); у остальных атак — обычный удар
        static readonly Dictionary<string, string> ATK_FX = new Dictionary<string, string>
        {
            ["strike"] = "lantern",
            ["spark"] = "sparks",
            ["sparks"] = "sparks",
            ["heavy"] = "heavy",
            ["ember"] = "fire",
            ["snowkick"] = "snow",
            ["payback"] = "heavy",
            ["luckycoin"] = "coin",
            ["snowball"] = "snowball",
            ["flurry"] = "blizzard",
            ["icethrow"] = "icicle",
            ["heavybag"] = "heavy",
            ["sledram"] = "heavy",
            ["snowstorm"] = "blizzard",
            ["cancel"] = "stamp",
            ["stamp"] = "stamp",
            ["registered"] = "stamp",
            ["surprise"] = "letter",
            ["palm"] = "fire",
            ["lastword"] = "letter",
            ["secret"] = "letter",
            ["urgent"] = "letter",
            ["finale"] = "starfall",
            ["starfall"] = "starfall",
            ["avalanche"] = "avalanche",
            ["lastlight"] = "beam",
            ["beam"] = "beam",
            ["poker"] = "sparks",
            ["rollingpin"] = "flour",
            ["fair"] = "confetti",
            ["gritsparks"] = "sparks",
            ["steelring"] = "slash",
            ["bitterroot"] = "roots",
            ["gingerbread"] = "crumbs",
        };

        // при нескольких ударах подряд следующие удары короче
        static readonly Dictionary<string, string> ATK_FX_NEXT = new Dictionary<string, string>
        {
            ["avalanche"] = "snow",
            ["blizzard"] = "snow",
            ["snowball"] = "snow",
            ["icicle"] = "shatter",
            ["coin"] = "bonk",
            ["letter"] = "bonk",
            ["starfall"] = "sparks",
            ["beam"] = "lantern",
            ["flour"] = "heavy",
            ["confetti"] = "bonk",
        };

        // сопровождение розыгрыша навыков: [эффект, цель]
        static readonly Dictionary<string, string[]> CAST_FX = new Dictionary<string, string[]>
        {
            ["tea"] = new[] { "steam" },
            ["sbiten"] = new[] { "steam" },
            ["cocoa"] = new[] { "steam" },
            ["chamomile"] = new[] { "steam" },
            ["livingwater"] = new[] { "steam" },
            ["wind"] = new[] { "wind" },
            ["breath"] = new[] { "wind" },
            ["express"] = new[] { "wind" },
            ["rushmail"] = new[] { "wind" },
            ["whistle"] = new[] { "notes", "whistle" },
            ["hornblow"] = new[] { "notes", "horn" },
            ["howl"] = new[] { "notes", "howl" },
            ["lullaby"] = new[] { "notes" },
            ["sleepgrass"] = new[] { "notes" },
            ["parcel"] = new[] { "parcel" },
            ["poste"] = new[] { "parcel" },
            ["moneyorder"] = new[] { "parcel" },
        };

        public static string AtkFx(string id) => ATK_FX.TryGetValue(id, out var v) ? v : null;
        public static string AtkFxNext(string kind) => ATK_FX_NEXT.TryGetValue(kind, out var v) ? v : null;
        public static string[] CastFx(string id) => CAST_FX.TryGetValue(id, out var v) ? v : null;
    }
}
