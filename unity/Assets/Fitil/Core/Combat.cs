// Бой: перенос боевой части js/game.js (startCombat … endTurn, api для карт) без графики.
// В веб-версии розыгрыш ждёт анимаций (async/await). Здесь всё считается сразу, а для экрана
// копится список событий Events в том же порядке (эффект, всплывающее число, звук, пауза),
// и экран проигрывает их по очереди. Числа, порядок действий и обращения к генератору
// случайности повторяют веб-версию, чтобы бои можно было сверять.
// Комментарии «v1xx» — версии веб-версии, где правило появилось.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public enum Ev
    {
        Fx,        // A — вид эффекта (js/fx.js), B — цель: enemy, hero, c:<карта>, r:<талисман> или null; N = 1 — бой ждёт удара
        Float,     // A — цель: hero | enemy, B — текст, C — класс (dmgf, blockf, burnf, healf, weakf…)
        Sfx,       // A — звук (js/audio.js), N — сила в сотых (0 — обычная)
        Toast,     // B — текст короткого сообщения
        Relic,     // A — id талисмана, B — где всплывает значок: hero | enemy
        Wait,      // N — пауза в мс
        Render,    // перерисовать бой
        EnemyAct,  // A — attack | hurt | death
        HeroMove,  // A — lunge | bite | hurt | guard
        Burst,     // вспышка лампы
        Say,       // A — вид реплики врага: start, hurt, death, …
        Track,     // A — ach.flag | ach.max | ach.put | ach.add | stats.cards, B — ключ, N — число
        Music,     // A — трек
    }

    public struct CombatEvent
    {
        public Ev Kind;
        public string A, B, C;
        public int N;
        public CombatSnap S;   // числа боя в момент события: экран показывает их по ходу анимации
        public override string ToString() => $"{Kind} {A} {B} {C} {N}".TrimEnd();
    }

    /// <summary>Главные числа боя на момент события. Бой считается сразу, а экран проигрывает события
    /// по очереди: полоски здоровья и защита берутся отсюда, чтобы меняться вместе с ударами.</summary>
    public struct CombatSnap
    {
        public int Hp, MaxHp, Block, Energy, Flame, Gold, EHp, EMax, EBlock;
    }

    public sealed class EnemyState
    {
        public int Hp, Max, Block, Str, Weak, Vuln, Burn, Thorns, Stun, Pi, Nest, Layer, Boil, Mist;
        public bool Raged;
    }

    public sealed class Delivery
    {
        public string Name;
        public Action<Combat> Fn;
    }

    /// <summary>Что забег сообщает бою перед началом (отношение врага к герою, разговор, друзья в финале).</summary>
    public sealed class CombatSetup
    {
        public string Att;            // hate | grudge | fear | … из лора
        public string Tie;            // avenge | rival | null
        public bool Calm;             // разговор успокоил врага (fmod.calm)
        public int ModStr, ModWeak, ModStun;
        public double HpMul = 1;      // fmod.hpMul
        public List<string> Friends = new List<string>();
        public bool Talked;
    }

    public enum CombatEnd { None, Win, Defeat }

    public sealed partial class Combat
    {
        public readonly Defs Defs;
        public readonly RunState Run;
        public readonly Difficulty Diff;
        public readonly List<CombatEvent> Events = new List<CombatEvent>();

        public string Tier, Id;
        public string Att, Tie;
        public bool SaidHurt;
        public List<string> Friends;
        public EnemyState Enemy;
        public List<CardInst> Draw, Hand = new List<CardInst>(), Disc = new List<CardInst>(), Exh = new List<CardInst>();
        public int EnergyNow, BlockNow, FlameNow, PWeak, Turn, Str, TmpStr, ThornsNow;
        public readonly Dictionary<string, int> Charms = new Dictionary<string, int>();
        public List<Delivery> Deliveries = new List<Delivery>();
        public int PlayedTurn, PlayedTotal;
        public bool FirstAtk, Shoe, HpLost, AtkTurn, Vane, Medal, Boomed, Glazed, Free;
        public int Stolen, BurstsTurn, Frail, Sap, Bury, Blast, GingerCount, Sharpened, DogNow, Paid;
        public CardInst Last;
        public CombatEnd End;

        // анимация удара для атак (ATK_FX в game.js): экран берёт её из этого поля
        public string FxKind;
        public int FxHits;

        EnemyDef ED => Defs.Enemies[Id];
        bool Has(string id) => Run.HasRelic(id);

        // ---------- события для экрана ----------
        void E(Ev k, string a = null, string b = null, string c = null, int n = 0) => Events.Add(new CombatEvent { Kind = k, A = a, B = b, C = c, N = n, S = Snap() });

        public CombatSnap Snap() => new CombatSnap
        {
            Hp = Run.Hp, MaxHp = Run.MaxHp, Block = BlockNow, Energy = EnergyNow, Flame = FlameNow, Gold = Run.Gold,
            EHp = Enemy?.Hp ?? 0, EMax = Enemy?.Max ?? 0, EBlock = Enemy?.Block ?? 0,
        };
        /// <summary>Эффект боя. hit — бой ждёт его удара (снаряд долетел), как await FX.play в веб-версии: N = 1.</summary>
        void Fx(string kind, string target = null, bool hit = false) => E(Ev.Fx, kind, target, null, hit ? 1 : 0);
        void FloatHero(string text, string cls) => E(Ev.Float, "hero", text, cls);
        void FloatEnemy(string text, string cls) => E(Ev.Float, "enemy", text, cls);
        void Sfx(string id, int power = 0) => E(Ev.Sfx, id, null, null, power);
        void Toast(string text) => E(Ev.Toast, null, text);
        void Wait(int ms) => E(Ev.Wait, null, null, null, ms);
        void Render() => E(Ev.Render);
        void Track(string kind, string key, int n = 1) => E(Ev.Track, kind, key, null, n);
        /// <summary>Итоги забега (run.st) копятся прямо в забеге: урон, лечение, карты, монеты.</summary>
        void StAdd(string key, int n = 1) => Run.StAdd(key, n);

        /// <summary>Талисман сработал: его значок всплывает над героем (или врагом). proc в game.js.</summary>
        bool Proc(string id, string where = "hero")
        {
            if (!Has(id)) return false;
            E(Ev.Relic, id, where);
            return true;
        }

        public Combat(Defs defs, RunState run)
        {
            Defs = defs;
            Run = run;
            Diff = defs.Data.Difficulties[Math.Max(0, Math.Min(defs.Data.Difficulties.Count - 1, run.Diff))];
        }

        // ---------- правила, зависящие от талисманов ----------
        public int MaxEnergy => Balance.MaxEnergy + new[] { "hourglass", "bottomless", "crown", "sunstone" }.Count(Has);
        public int HandSize => Balance.HandSize - (Has("hourglass") ? 1 : 0) + (Has("moonstone") ? 2 : 0) + (Has("sunstone") ? 1 : 0) + (Has("magicbag") ? 1 : 0);
        public int FlameMaxNow => Has("bellows") ? 2 : Balance.FlameMax;
        public int FlameBonusNow => Has("bellows") ? 0 : Balance.FlameBonus;

        public int LvlStr(int s)
        {
            if (!Defs.Long) return s / 3;
            var a = Defs.Stages[0].Len;
            return s < a ? s / Balance.StrEvery[0] : a / Balance.StrEvery[0] + (s - a) / Balance.StrEvery[1];
        }

        public int? CostOf(CardInst c) => Defs.Cards[c.Id].CostOf(c.Up);
        public int? PlayCost(CardInst c) { var v = CostOf(c); return v != null && Free ? 0 : v; }
        public bool CanUpgrade(CardInst c) => !c.Up && Defs.Cards[c.Id].Rarity != "status";

        /// <summary>Хрупкость режет любую защиту от карт, чар и талисманов.</summary>
        public int Frailed(int n) => Frail > 0 ? (int)Math.Floor(n * 0.75) : n;

        public int CalcDmg(int @base, bool vulnSoon = false)
        {
            var v = @base + FlameBonusNow * FlameNow + Str + TmpStr + (Has("pencil") && !AtkTurn ? 3 : 0);
            if (PWeak > 0) v = (int)Math.Floor(v * 0.75);
            if (Enemy.Vuln > 0 || vulnSoon) v = (int)Math.Floor(v * 1.5);
            return Math.Max(0, v);
        }

        public int DogDmg => Enemy.Vuln > 0 ? (int)Math.Floor(DogNow * 1.5) : DogNow;

        public int EnemyDmg(int v)
        {
            var d = JsRound((v + Enemy.Str + Enemy.Boil) * Diff.Dmg);
            if (Enemy.Weak > 0) d = (int)Math.Floor(d * 0.75);
            return Math.Max(0, d);
        }

        void ExhaustCard(CardInst c)
        {
            Exh.Add(c);
            if (Has("brazier")) { var n = Frailed(3); BlockNow += n; FloatHero("+" + n, "blockf"); }
        }

        // ---------- начало боя ----------
        public void Start(string enemyId, string tier, CombatSetup setup = null)
        {
            setup ??= new CombatSetup();
            var e = Defs.Enemies[enemyId];
            Run.Seen[enemyId] = (Run.Seen.TryGetValue(enemyId, out var seen) ? seen : 0) + 1;
            Run.Recent.Add(enemyId);
            while (Run.Recent.Count > 4) Run.Recent.RemoveAt(0);
            var si = Math.Min(2, Defs.StageOf(Run.Step));
            var scale = !Defs.Long ? (tier == "boss" ? 1 : 1 + Run.Step * 0.08)
                : tier == "boss" ? Balance.BossHp[si] : (1 + Run.Step * Balance.HpStep) * (tier == "elite" ? Balance.EliteHp[Math.Min(1, si)] : 1);
            var hp = JsRound(e.Hp * scale * Diff.Hp);
            Att = setup.Att;
            Tie = setup.Tie;
            var angry = ((Att == "hate" || Att == "grudge") && !setup.Calm ? 2 : 0) + (Tie == "avenge" && !setup.Calm ? 1 : 0);
            var str = (tier == "boss" ? (Defs.Long ? Balance.BossStr[si] : 0) : LvlStr(Run.Step)) - (Has("frostglass") ? 2 : 0) + angry + setup.ModStr;
            var weak = (Has("inkwell") ? 2 : 0) + (Has("frostring") ? 2 : 0) + (Att == "fear" ? 2 : 0) + (Tie == "rival" ? 2 : 0) + setup.ModWeak;
            Tier = tier;
            Id = enemyId;
            Friends = setup.Friends ?? new List<string>();
            Enemy = new EnemyState
            {
                Hp = JsRound(hp * setup.HpMul), Max = hp, Str = str, Weak = weak,
                Vuln = Has("frostring") ? 2 + (Has("stamppad") ? 1 : 0) : 0,
                Thorns = e.Thorns, Stun = setup.ModStun, Nest = e.Nest,
            };
            Draw = new List<CardInst>();
            foreach (var c in Run.Deck) Draw.Add(c.Clone());
            Run.Rng.Shuffle(Draw);
            EnergyNow = MaxEnergy;
            FlameNow = (Has("feather") ? 1 : 0) + (Has("eternaloil") ? 1 : 0);
            ThornsNow = Has("pinecone") ? (Has("wreath") ? 6 : 3) : 0;
            DogNow = Has("dogfriend") ? 3 : 0;
            if (Has("chimneycap")) Enemy.Burn += 6;
            // Закладка: одна случайная карта улучшена до конца боя
            if (Has("bookmark"))
            {
                var list = Draw.Where(CanUpgrade).ToList();
                if (list.Count > 0) Run.Rng.Pick(list).Up = true;
            }
            var final = tier == "boss" && Defs.IsFinalStep(Run.Step);
            E(Ev.Music, tier == "boss" ? (final ? "final" : "boss") : Run.Fights % 2 == 1 ? "battle2" : "battle");
            StartPlayerTurn();
            E(Ev.Say, setup.Talked ? "start" : Tie != null ? "tie:" + Tie : Att == "grudge" ? "grudge" : Att ?? "start");
        }

        /// <summary>Math.round из JS: половина округляется вверх (к +∞).</summary>
        public static int JsRound(double x) => (int)Math.Floor(x + 0.5);

        void HandFull() => Toast(Loc.Tr("Рука полна: больше {n} карт в неё не помещается", ("n", Balance.HandMax)));

        public void DrawCards(int n)
        {
            for (var i = 0; i < n; i++)
            {
                if (Draw.Count == 0)
                {
                    if (Disc.Count == 0) break;
                    Draw = Disc;
                    Run.Rng.Shuffle(Draw);
                    Disc = new List<CardInst>();
                }
                if (Hand.Count >= Balance.HandMax) { HandFull(); break; }
                Hand.Add(Pop(Draw));
            }
        }

        static T Pop<T>(List<T> l) { var x = l[l.Count - 1]; l.RemoveAt(l.Count - 1); return x; }

        void StartPlayerTurn()
        {
            Turn++;
            PlayedTurn = 0; BurstsTurn = 0; Last = null; AtkTurn = false; Free = false;
            // защита сгорает, но Горячий камень сохраняет её часть
            if (!Charms.ContainsKey("standfast")) BlockNow = BlockNow > 0 && Proc("hotstone") ? Math.Min(BlockNow, 6) : 0;
            var first = Turn == 1;
            if (first) StartProcs();
            if (first && Proc("bell")) { BlockNow += 6; Fx("shield"); }
            if (Proc("thimble")) BlockNow += Frailed(2);
            if (Charms.TryGetValue("mittens", out var mit)) BlockNow += Frailed(mit);
            EnergyNow = MaxEnergy + Charm0("aurora") + (Vane ? 1 : 0) + (Medal ? 1 : 0);
            if (first && Proc("scarf")) EnergyNow += 1;
            if (Turn % 3 == 0 && Proc("musicbox")) EnergyNow += 2;
            if (first && Proc("northstar")) EnergyNow += 2;
            if (Sap != 0) { EnergyNow = Math.Max(0, EnergyNow - Sap); Toast(Loc.Tr("Кукушка сбила с ритма: −{n} {n|энергия|энергии|энергии}", ("n", Sap))); }
            Sap = 0; Vane = false; Medal = false;
            var n = HandSize + Charm0("compass") + (first && Proc("sled") ? 2 : 0) + (first && Has("northstar") ? 2 : 0)
                + (first && Friends.Contains("courier") ? 2 : 0);
            if (Bury != 0) { n = Math.Max(1, n - Bury); Toast(Loc.Tr("Метелица замела: −{n} {n|карта|карты|карт}", ("n", Bury))); Bury = 0; }
            DrawCards(n);
            if (first && Proc("mug")) { RunHeal(3); Fx("heal"); }
            Sfx(Turn == 1 ? "draw" : "turn");
            Render();
            // особенности героев в начале хода
            if (first && Proc("honeypot")) Ginger(2);
            if (Proc("moldform")) Ginger(1);
            if (Proc("grindwheel")) Sharpen(2, true);
            if (Charms.TryGetValue("apprentice", out var ap)) Sharpen(2 * ap, true);
            if (first) FriendHelp();
            if (Proc("bridgerail")) { ThornsNow += Has("wreath") ? 2 : 1; Fx("thorns"); }
            Render();
            // Доставки с прошлого хода и чары
            var dels = Deliveries;
            Deliveries = new List<Delivery>();
            foreach (var d in dels)
            {
                for (var k = 0; k < (Has("horn") ? 2 : 1); k++)
                {
                    if (Enemy.Hp <= 0) break;
                    if (k == 1) Proc("horn");
                    Toast(Loc.Tr("Доставка: {name}", ("name", d.Name)));
                    Wait(250);
                    FxKind = "arrive"; FxHits = 0;
                    d.Fn(this);
                    Render();
                }
                if (Enemy.Hp > 0 && Proc("oilcan")) Block(4);
            }
            if (Charms.TryGetValue("stubborn", out var sb)) Str += sb;
            if (Charms.TryGetValue("hearth", out var he) && Enemy.Hp > 0) Burn(he);
            if (Charms.TryGetValue("eveninglamp", out var el) && Enemy.Hp > 0) Flame(el);
            if (Charms.TryGetValue("eternalwinter", out var ew) && Enemy.Hp > 0) { Chill(2 * ew); Block(8 * ew); }
            if (Charms.TryGetValue("firebird", out var fb) && Enemy.Hp > 0) { Burn(3 * fb); Flame(2 * fb); }
            if (Run.Hp <= 0) { End = CombatEnd.Defeat; return; }
            if (Enemy.Hp <= 0) { End = CombatEnd.Win; return; }
            Render();
        }

        int Charm0(string id) => Charms.TryGetValue(id, out var v) ? v : 0;

        // талисманы, которые сработали в начале боя
        void StartProcs()
        {
            foreach (var id in new[] { "feather", "eternaloil", "pinecone", "dogfriend", "bookmark", "inkwell", "frostring", "frostglass", "chimneycap" })
                Proc(id, id == "inkwell" || id == "frostring" || id == "frostglass" || id == "chimneycap" ? "enemy" : "hero");
            if (Has("frostring")) Proc("stamppad", "enemy");
            if (Has("chimneycap")) Fx("burnApply", "enemy");
            if (Has("frostring") || Has("frostglass")) Fx("frost", "enemy");
            if (Has("inkwell")) Fx("weak", "enemy");
            if (Has("dogfriend")) Fx("growl");
            if (Has("pinecone")) Fx("thorns");
        }

        void FriendHelp()
        {
            var fr = Friends;
            if (fr.Count == 0) return;
            Toast(Loc.Tr("Друзья рядом: {list}", ("list", string.Join(", ", fr.Select(h => Defs.Data.Classes[h].Name)))));
            if (fr.Count >= 3) Track("ach.flag", "friends3");
            if (fr.Contains("guard")) Block(12);
            if (fr.Contains("baker")) { RunHeal(10); Fx("heal"); }
            if (fr.Contains("stoker")) { Enemy.Burn += 6; Fx("burnApply", "enemy"); }
            if (fr.Contains("herbalist")) { Enemy.Weak += 3; Fx("weak", "enemy"); }
            if (fr.Contains("shepherd")) { DogNow = Math.Max(DogNow, 3); Fx("growl"); }
            if (fr.Contains("grinder")) Sharpen(2, true);
            Render();
            if (fr.Contains("lamp")) Flame(2);
        }

        /// <summary>Лечение вне правил боя (evApi.heal): без эффекта и надписи.</summary>
        void RunHeal(int n)
        {
            var b = Run.Hp;
            Run.Hp = Math.Min(Run.MaxHp, Run.Hp + n);
            StAdd("healed", Run.Hp - b);
        }

        // ---------- намерения врага ----------
        public List<IntentDef> CurrentIntents()
        {
            if (Enemy.Stun > 0) return new List<IntentDef> { new IntentDef { K = "sleep" } };
            var p = ED.Pattern[Enemy.Pi % ED.Pattern.Count];
            return p.Then != null ? new List<IntentDef> { p, p.Then } : new List<IntentDef> { p };
        }

        // ---------- розыгрыш ----------
        /// <summary>Почему карту сейчас нельзя разыграть (null — можно).</summary>
        public string CantPlay(CardInst c)
        {
            var cost = PlayCost(c);
            if (cost == null) return Loc.Tr("Эту карту нельзя разыграть");
            if (cost > EnergyNow) return Loc.Tr("Не хватает энергии");
            var price = Cards.PriceOf(c);
            if (price > 0 && price >= Run.Hp) return Loc.Tr("Не хватит здоровья, чтобы заплатить Цену");
            return null;
        }

        public bool PlayCard(int i)
        {
            if (End != CombatEnd.None || i < 0 || i >= Hand.Count) return false;
            var c = Hand[i];
            var cd = Defs.Cards[c.Id];
            var why = CantPlay(c);
            if (why != null) { Sfx("deny"); Toast(why); return false; }
            var cost = PlayCost(c).Value;
            var price = Cards.PriceOf(c);
            Sfx("card");
            Wait(220);
            EnergyNow -= cost;
            Hand.RemoveAt(i);
            Render();
            if (price > 0) Price(price);
            if (cd.Type == "atk" && !FirstAtk)
            {
                FirstAtk = true;
                if (Proc("magnifier", "enemy")) Vuln(2);
            }
            FxKind = Cards.AtkFx(c.Id); FxHits = 0;
            var cast = Cards.CastFx(c.Id);
            if (cast != null) Fx(cast[0], cast.Length > 1 ? cast[1] : null);
            Cards.Play(this, c);
            // Осколок зеркала: первая карта хода срабатывает ещё раз
            if (PlayedTurn == 0 && cd.Type != "status" && Enemy.Hp > 0 && Run.Hp > 0 && Proc("mirrorshard"))
            {
                FloatHero(Loc.Tr("Отражение!"), "weakf"); Wait(200);
                Cards.Play(this, c);
            }
            if (cd.Type == "atk") AtkTurn = true;
            if (cd.Type != "status") Last = c;
            if (cd.Type == "charm") Exh.Add(c);
            else if (cd.Exhaust) ExhaustCard(c);
            else Disc.Add(c);
            PlayedTurn++; PlayedTotal++;
            StAdd("cards");
            Track("stats.cards", null);
            if (cd.Rarity != "status") Track("ach.put", "played:" + c.Id);
            if (cd.Rarity == "rare") Track("ach.put", "rareplayed:" + c.Id);
            if (cd.Rarity == "legendary") Track("ach.flag", "legendcard");
            if (PlayedTurn >= 8) Track("ach.flag", "combo");
            // отклики чар и талисманов на розыгрыш
            if (cd.Type == "skill" && Charms.TryGetValue("inkpen", out var ink) && Enemy.Hp > 0) Strike(ink, "ink");
            if (cd.Type == "skill" && Proc("buckle")) Block(3);
            if (c.Id == "gingerbread")
            {
                GingerCount++; Track("ach.add", "ginger");
                if (Charms.TryGetValue("gingerhouse", out var gh) && Enemy.Hp > 0) Strike(4 * gh, "crumbs");
            }
            if (PlayedTurn % 5 == 0 && Enemy.Hp > 0 && Proc("milestone", "enemy")) { FloatEnemy(Loc.Tr("Верста!"), "weakf"); Strike(8, "heavy"); }
            if (Charms.TryGetValue("rhythm", out var rh) && PlayedTurn % 3 == 0 && Enemy.Hp > 0) Flame(rh);
            if (PlayedTotal % 6 == 0 && Proc("stampbook")) Energy(1);
            if (PlayedTurn % 4 == 0 && Proc("wingboots")) { Energy(1); DrawCards(1); }
            // приёмы врага в ответ на ваши карты
            var ed = ED;
            if (ed.Alarm > 0 && cd.Type == "skill" && Enemy.Hp > 0) { Enemy.Block += ed.Alarm; Sfx("clank"); FloatEnemy(Loc.Tr("Тук-тук! +{n}", ("n", ed.Alarm)), "blockf"); }
            if (ed.Tally > 0 && PlayedTurn % ed.Tally == 0 && Enemy.Hp > 0 && Run.Hp > 0) { FloatEnemy(Loc.Tr("Ку-ку!"), "weakf"); HitHero(3); }
            if (Run.Hp <= 0) { End = CombatEnd.Defeat; return true; }
            if (Enemy.Hp <= 0) { End = CombatEnd.Win; return true; }
            Render();
            return true;
        }

        // ---------- удары ----------
        /// <summary>Удар по врагу своей анимацией: сначала эффект, потом урон.</summary>
        void Strike(int dmg, string kind = "bonk")
        {
            Fx(kind, "enemy", true);
            HitEnemy(dmg, true);
        }

        void HitEnemy(int dmg, bool quiet = false)
        {
            var e = Enemy;
            if (e.Mist > 0 && dmg > e.Mist) dmg = e.Mist; // туман глушит сильные удары
            var absorbed = Math.Min(e.Block, dmg);
            e.Block -= absorbed;
            var real = dmg - absorbed;
            e.Hp -= real;
            Track("ach.max", "maxhit", dmg);
            StAdd("dmg", real);
            if (dmg > (Run.St.TryGetValue("hit", out var hit) ? hit : 0)) Run.St["hit"] = dmg;
            if (real > 0 && ED.Boil > 0 && e.Hp > 0 && e.Boil < 5) e.Boil++;
            NestCheck();
            RageCheck();
            E(Ev.EnemyAct, "hurt");
            if (real <= 0) Sfx("clank");
            else if (!quiet) Sfx("hit", (int)(Math.Min(1.4, 0.6 + real / 15.0) * 100));
            // удар на 0 урона по врагу без защиты пишет «0» (v172)
            FloatEnemy(real > 0 ? "-" + real : absorbed > 0 ? Loc.Tr("Блок −{n}", ("n", absorbed)) : "0", real > 0 ? "dmgf" : absorbed > 0 ? "blockf" : "weakf");
            Render();
            Wait(260);
        }

        /// <summary>Ярость: босс, потерявший половину HP, получает Силу и защиту (один раз за бой).</summary>
        void RageCheck()
        {
            var e = Enemy;
            if (!Defs.Long || Tier != "boss" || e.Raged || e.Hp <= 0 || e.Hp > e.Max / 2.0) return;
            e.Raged = true;
            var si = Math.Min(2, Defs.StageOf(Run.Step));
            e.Str += Balance.RageStr[si]; e.Block += Balance.RageBlock[si];
            Sfx("buff");
            Fx("rage", "enemy");
            FloatEnemy(Loc.Tr("Ярость! Сила +{n}", ("n", Balance.RageStr[si])), "burnf ragef");
        }

        /// <summary>Матрёшка: вместо гибели раскрывается, внутри новая, поменьше.</summary>
        bool NestCheck()
        {
            var e = Enemy;
            if (e.Hp > 0 || e.Nest <= 0) return false;
            e.Nest--; e.Layer++;
            e.Max = Math.Max(5, JsRound(e.Max * 0.6)); e.Hp = e.Max; e.Block = 0;
            Sfx("clank");
            FloatEnemy(Loc.Tr("Внутри ещё одна!"), "weakf");
            return true;
        }

        void DoBurst()
        {
            E(Ev.Burst);
            Sfx("burst");
            Wait(380);
            Track("ach.add", "bursts");
            if (++BurstsTurn >= 2) Track("ach.flag", "dblburst");
            var dmg = Balance.BurstDmg + (Proc("flint") ? 5 : 0);
            if (Enemy.Vuln > 0) dmg = (int)Math.Floor(dmg * 1.5);
            Fx("flash", "enemy");
            HitEnemy(dmg, true);
            if (Proc("stub")) Heal(2);
            if (Enemy.Hp > 0 && Proc("snowglobe", "enemy")) Weak(1);
            if (Proc("ivalamp")) FlameNow += 1;
            if (Proc("wickcutter")) Block(4);
            Render();
        }

        int HitHero(int dmg)
        {
            var absorbed = Math.Min(BlockNow, dmg);
            BlockNow -= absorbed;
            var real = dmg - absorbed;
            // Подкова смягчает первый пропущенный удар в бою
            if (real > 1 && !Shoe && Proc("horseshoe")) { Shoe = true; real = 1; FloatHero(Loc.Tr("Подкова!"), "blockf"); }
            LoseHp(real);
            Fx(real > 0 ? "claw" : "shield");
            E(Ev.HeroMove, real > 0 ? "hurt" : "guard");
            Sfx(real > 0 ? "hurt" : "clank");
            FloatHero(real > 0 ? "-" + real : absorbed > 0 ? Loc.Tr("Блок −{n}", ("n", absorbed)) : "0", real > 0 ? "dmgf" : absorbed > 0 ? "blockf" : "weakf");
            Render();
            Wait(300);
            // окованный ставень: удар целиком в защиту — враг получает в ответ
            if (dmg > 0 && real == 0 && absorbed > 0 && Enemy.Hp > 0 && Proc("ironshutter", "enemy")) Strike(4, "heavy");
            return real;
        }

        void LoseHp(int n)
        {
            if (n <= 0) return;
            StAdd("taken", Math.Min(n, Run.Hp));
            Run.Hp = Math.Max(0, Run.Hp - n);
            // Последняя свеча: один раз за забег спасает от гибели
            if (Run.Hp <= 0 && !Run.Candle && Proc("lastcandle"))
            {
                Run.Candle = true; Run.Hp = (int)Math.Ceiling(Run.MaxHp / 2.0);
                Sfx("heal"); Fx("heal"); Toast(Loc.Tr("Последняя свеча вспыхнула: половина HP"));
            }
            HpLost = true;
        }

        // ---------- конец хода и ход врага ----------
        public void EndTurn()
        {
            if (End != CombatEnd.None) return;
            var keep = new List<CardInst>();
            CardInst ribbon = null;
            if (Has("ribbon"))
            {
                var cands = Hand.Where(c => !Defs.Cards[c.Id].Retain && Defs.Cards[c.Id].Type != "status").ToList();
                if (cands.Count > 0) { ribbon = cands.Aggregate((a, b) => (CostOf(b) ?? 0) > (CostOf(a) ?? 0) ? b : a); Proc("ribbon"); }
            }
            var dread = 0;
            Vane = Hand.Count == 0 && Proc("vanefeather");
            Medal = PlayedTurn >= 6 && Proc("medal");
            if (Charms.TryGetValue("nightshift", out var ns) && EnergyNow > 0) Block(ns * EnergyNow);
            foreach (var c in Hand)
            {
                var cd = Defs.Cards[c.Id];
                if (c.Id == "dread") dread += 2;
                if (c.Id == "ash") dread += 3;
                if (cd.Ethereal) ExhaustCard(c);
                else if (cd.Retain || c == ribbon || (Has("magicbag") && cd.Type != "status")) { keep.Add(c); Cards.OnRetain(c); }
                else Disc.Add(c);
            }
            var gone = Hand.Count - keep.Count;
            if (gone > 0) Wait(200 + gone * 22);
            Hand = keep;
            TmpStr = 0;
            if (PWeak > 0) PWeak--;
            if (Frail > 0) Frail--;
            if (dread > 0) { LoseHp(dread); Sfx("hurt"); FloatHero("-" + dread, "dmgf"); }
            Render();
            Wait(gone > 0 ? 110 : 250);
            if (Run.Hp <= 0) { End = CombatEnd.Defeat; return; }
            // пёс пастушки кусает в конце хода
            if (DogNow > 0 && Enemy.Hp > 0)
            {
                for (var k = 0; k < 1 + Charm0("wolfhound") && Enemy.Hp > 0; k++) Bite();
                if (Enemy.Hp <= 0) { End = CombatEnd.Win; return; }
            }
            var e = Enemy;
            if (!ED.Plating) e.Block = 0; // у Ледяного Рыцаря латы
            e.Mist = 0; // туман рассеивается, когда враг снова ходит
            if (e.Burn > 0)
            {
                Fx("fire", "enemy");
                e.Hp -= e.Burn; StAdd("dmg", e.Burn);
                FloatEnemy("-" + e.Burn, "burnf");
                E(Ev.EnemyAct, "hurt");
                e.Burn--;
                if (e.Hp > 0 && Proc("stokerglove")) Block(2);
                NestCheck();
                RageCheck();
                Render();
                Wait(400);
                if (e.Hp <= 0) { Track("ach.flag", "burnkill"); End = CombatEnd.Win; return; }
            }
            if (e.Stun > 0)
            {
                e.Stun--;
                FloatEnemy(Loc.Tr("Спит…"), "weakf");
                Wait(500);
            }
            else EnemyActs(e);
            if (Run.Hp <= 0) { End = CombatEnd.Defeat; return; }
            if (e.Hp <= 0) { End = CombatEnd.Win; return; }
            if (e.Weak > 0) e.Weak--;
            if (e.Vuln > 0) e.Vuln--;
            e.Boil = 0; // кипяток остывает
            e.Pi++;
            StartPlayerTurn();
        }

        void EnemyActs(EnemyState e)
        {
            foreach (var it in CurrentIntents())
            {
                if (it.K == "attack" || it.K == "snuff" || it.K == "steal")
                {
                    if (it.K == "snuff")
                    {
                        if (Proc("eternaloil")) FloatHero(Loc.Tr("Огоньки не гаснут"), "blockf");
                        else { FlameNow = 0; Sfx("snuff"); FloatHero(Loc.Tr("Огоньки погасли"), "weakf"); }
                    }
                    for (var h = 0; h < Math.Max(1, it.Hits); h++)
                    {
                        E(Ev.EnemyAct, "attack");
                        Sfx("enemy");
                        var real = HitHero(EnemyDmg(it.V));
                        // Упырь пьёт тепло: лечится на прошедший урон
                        if (it.Leech && real > 0 && e.Hp > 0)
                        {
                            var b = e.Hp; e.Hp = Math.Min(e.Max, e.Hp + real);
                            if (e.Hp > b) { Sfx("heal"); FloatEnemy("+" + (e.Hp - b), "healf"); }
                        }
                        if (Run.Hp <= 0 || e.Hp <= 0) break;
                        // Шипы героя ранят врага за каждый удар
                        if (ThornsNow > 0) { Strike(ThornsNow, "spikes"); if (e.Hp <= 0) { Track("ach.flag", "thornskill"); break; } }
                    }
                    if (it.K == "steal" && Run.Hp > 0)
                    {
                        var g = Math.Min(Run.Gold, it.Gold);
                        if (g > 0) { Run.Gold -= g; Stolen += g; Sfx("coin"); FloatHero(Loc.Tr("−{n} {n|монета|монеты|монет}", ("n", g)), "weakf"); }
                    }
                }
                else if (it.K == "boom")
                {
                    // взрыв шутихи: удар по герою приходит при её гибели (Win)
                    E(Ev.EnemyAct, "attack");
                    Sfx("enemy");
                    e.Hp = 0; Boomed = true; Blast = EnemyDmg(it.V);
                    break;
                }
                else if (it.K == "sap") { Sap += it.V; Sfx("debuff"); FloatHero(Loc.Tr("−{n} {n|энергия|энергии|энергии}", ("n", it.V)), "weakf"); }
                else if (it.K == "mist") { e.Mist = it.V; Sfx("debuff"); FloatEnemy(Loc.Tr("Туман"), "weakf"); }
                else if (it.K == "bury") { Bury += it.V; Sfx("debuff"); FloatHero(Loc.Tr("Замело: −{n} {n|карта|карты|карт}", ("n", it.V)), "weakf"); }
                else if (it.K == "frail") { Frail += it.V; Sfx("debuff"); FloatHero(Loc.Tr("Хрупкость"), "weakf"); }
                else if (it.K == "block") { e.Block += it.V; FloatEnemy("+" + it.V, "blockf"); }
                else if (it.K == "buff") { e.Str += it.V; Sfx("buff"); FloatEnemy(Loc.Tr("Сила +{n}", ("n", it.V)), "burnf"); }
                else if (it.K == "debuff") { PWeak += it.V; Sfx("debuff"); FloatHero(Loc.Tr("Слабость"), "weakf"); }
                else if (it.K == "heal") { var b = e.Hp; e.Hp = Math.Min(e.Max, e.Hp + it.V); Sfx("heal"); FloatEnemy("+" + (e.Hp - b), "healf"); }
                else if (it.K == "spikes") { e.Thorns += it.V; Sfx("buff"); FloatEnemy(Loc.Tr("Колючки +{n}", ("n", it.V)), "burnf"); }
                else if (it.K == "curse")
                {
                    for (var k = 0; k < it.N; k++) Draw.Insert(Run.Rng.Range(0, Draw.Count), Run.Mk(it.Card));
                    Sfx("debuff"); FloatHero(Defs.Cards[it.Card].Name + " ×" + it.N, "weakf");
                }
                Render();
                Wait(300);
                if (Run.Hp <= 0 || e.Hp <= 0) break;
            }
        }

        /// <summary>Шутиха взорвалась сама: удар по герою в момент её гибели. true — герой не пережил взрыва.</summary>
        public bool BlastHero()
        {
            if (Blast <= 0) return false;
            var d = Blast; Blast = 0;
            Sfx("burst"); FloatEnemy(Loc.Tr("Бабах!"), "burnf");
            HitHero(d);
            if (Run.Hp > 0) return false;
            End = CombatEnd.Defeat;
            return true;
        }
    }
}
