// Забег: перенос «пути» из js/game.js (genChoices, chooseEncounter, advance, награды, талисманы,
// разговоры до и после боя, встречи с героями, лавка, сундук, костёр, финалы) без экранов.
// Порядок обращений к генератору случайности повторяет веб-версию, чтобы забеги можно было сверять.
// Реплики врагов (lineOf) берут числа из отдельного генератора, как в бою: в веб-версии они идут
// мимо логики (см. tools/unity/combat_fixtures.js).
// Сообщения для игрока копятся в Notes (toast в веб-версии), учёт для достижений — в Tracks.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    /// <summary>Вариант ответа (событие, разговор, встреча): текст, подсказка, можно ли выбрать и почему нет.</summary>
    public sealed class Option
    {
        public string K, Text, Hint, Why;
        public bool Can = true, Ad, Secret;
        public Dictionary<string, object> Fx;
        public string Res;
    }

    /// <summary>Что выбор карты из колоды должен сделать (окно showDeck в веб-версии).</summary>
    public enum DeckPrompt { None, Upgrade, Remove, Duplicate, Transform }

    /// <summary>Итог ответа: текст, бой после него, окно выбора карты.</summary>
    public sealed class Outcome
    {
        public string Text;          // null — ответ сам ведёт дальше (выбор карты)
        public string Fight;         // начать бой с этим врагом
        public string FightTier = "fight";
        public DeckPrompt Prompt;
        public int PromptCost;       // HP за копию (Ледяное зеркало)
        public string Next = "next"; // next | fight | bossrelic
    }

    public sealed class Reward
    {
        public bool Boss;
        public int Gold, Healed;
        public List<string> Ids = new List<string>();
    }

    public sealed class ShopItem
    {
        public string Id;
        public int Price;
        public bool Sold;
    }

    public sealed class ShopState
    {
        public List<ShopItem> Cards = new List<ShopItem>();
        public ShopItem Relic;
        public ShopItem Tea, Remove, Up;
        public int Rerolls;
    }

    /// <summary>Куда игра идёт после победы.</summary>
    public enum AfterWin { Victory, Plea, BossRelic, Reward }

    public sealed partial class RunGame
    {
        public readonly Defs Defs;
        public readonly Lore Lore;
        public RunState Run;
        public readonly List<string> Notes = new List<string>();
        public readonly List<(string kind, string key, int n)> Tracks = new List<(string, string, int)>();
        /// <summary>Куда отдавать учёт для достижений сразу (экран игры); null — копить в Tracks.
        /// Виды: ach.add | ach.max | ach.flag | ach.put (ключ «набор:что»), codex (ключ «вид:id»), stats, stats.max, kill.</summary>
        public Action<string, string, int> OnTrack;
        /// <summary>Генератор для реплик и прочего, что не влияет на игру.</summary>
        public Random UiRnd = new Random();

        public RunGame(Defs defs, RunState run)
        {
            Defs = defs;
            Lore = new Lore(defs.Data);
            Run = run;
        }

        GameData Data => Defs.Data;
        public Difficulty Diff => Data.Difficulties[Math.Max(0, Math.Min(Data.Difficulties.Count - 1, Run.Diff))];
        public bool MainStory => Defs.Stages.Count > 2;
        public HeroClass Hero => Data.Classes.TryGetValue(Run.Cls, out var h) ? h : Data.Classes["lamp"];
        bool Has(string id) => Run.HasRelic(id);
        Rng R => Run.Rng;
        int Rnd(int a, int b) => R.Range(a, b);
        T Pick<T>(IList<T> l) => R.Pick(l);
        void Note(string s) => Notes.Add(s);
        void Track(string kind, string key, int n = 1)
        {
            if (OnTrack != null) OnTrack(kind, key, n);
            else Tracks.Add((kind, key, n));
        }
        long StOf(string k) => Run.St.TryGetValue(k, out var v) ? v : 0;
        /// <summary>Счётчик улучшений и число улучшенных карт в колоде — для достижений (achUpgraded).</summary>
        void Upgraded(int n) { Track("ach.add", "upgrades", n); Track("ach.max", "updeck", Run.Deck.Count(c => c.Up)); }
        static int Round(double x) => Combat.JsRound(x);
        public string CardName(CardInst c) => Defs.Cards[c.Id].Name + (c.Up ? "+" : "");
        public static bool CanUpgrade(Defs d, CardInst c) => !c.Up && d.Cards[c.Id].Rarity != "status";
        bool CanUp(CardInst c) => CanUpgrade(Defs, c);

        // ================= новый забег =================
        public static RunGame New(Defs d, string cls, int diff, uint seed)
        {
            var g = d.Data;
            var h = g.Classes.TryGetValue(cls, out var hc) ? hc : g.Classes["lamp"];
            var dd = g.Difficulties[Math.Max(0, Math.Min(g.Difficulties.Count - 1, diff))];
            var run = new RunState
            {
                Cls = h.Id, Diff = dd.Index, Hp = h.Hp + dd.HeroHp, MaxHp = h.Hp + dd.HeroHp, Gold = h.Gold, Step = 0,
                Rng = new Rng(seed),
            };
            run.Relics.Add(h.Relic);
            foreach (var id in h.Deck.Concat(dd.Curses)) run.Deck.Add(run.Mk(id));
            var game = new RunGame(d, run);
            foreach (var s in d.Stages) run.Bosses.Add(s.Boss.Count > 0 ? run.Rng.Pick(s.Boss) : null);
            game.PlanMeetings();
            return game;
        }

        /// <summary>Встречи с другими героями: по две на стадию, на случайных уровнях (planMeetings).</summary>
        void PlanMeetings()
        {
            if (Defs.Stages.Count < 3) return;
            for (var si = 0; si < 2; si++)
            {
                var g = Defs.Stages[si];
                var cand = Lore.MeetHeroes.Where(h => h != Run.Cls && Json.Int(Json.Get(Lore.Meet(h), "stage")) == si).ToList();
                R.Shuffle(cand);
                var heroes = cand.Take(2).ToList();
                var part = (int)Math.Floor((g.Len - 6) / 2.0);
                for (var i = 0; i < heroes.Count; i++)
                {
                    var a = g.Start + 3 + i * part;
                    Run.MeetPlan[Rnd(a, a + part - 2)] = heroes[i];
                }
            }
        }

        // ================= карты и талисманы =================
        static readonly Dictionary<string, int> RelicWeight = new Dictionary<string, int> { ["common"] = 55, ["uncommon"] = 30, ["rare"] = 15, ["epic"] = 6, ["legendary"] = 2 };

        List<string> CardPool(string rarity) => Defs.Cards.Values.Where(c => c.Rarity == rarity && (c.Cls == null || c.Cls == Run.Cls)).Select(c => c.Id).ToList();

        /// <summary>Случайная карта редкости с перевесом в сторону билда героя (pickCard).</summary>
        public string PickCard(string rarity, ICollection<string> exclude = null)
        {
            var list = CardPool(rarity).Where(k => (exclude == null || !exclude.Contains(k)) && !(rarity == "legendary" && Run.Deck.Any(c => c.Id == k))).ToList();
            if (list.Count == 0) return rarity == "legendary" ? PickCard("epic", exclude) : null;
            var fav = Hero.Favored;
            var w = list.Select(k => Defs.Cards[k].Cls != null || fav.Contains(k) ? 3.0 : 1.0).ToList();
            var r = R.Next() * w.Sum();
            for (var i = 0; i < list.Count; i++) { r -= w[i]; if (r < 0) return list[i]; }
            return list[list.Count - 1];
        }

        /// <summary>Случайная редкость по порогам [легендарная, эпическая, редкая, необычная].</summary>
        public string RollRarity(double[] t)
        {
            var x = R.Next();
            return x < t[0] ? "legendary" : x < t[1] ? "epic" : x < t[2] ? "rare" : x < t[3] ? "uncommon" : "common";
        }

        public List<string> FreeRelics() => Defs.Relics.Values.Where(r => RelicWeight.ContainsKey(r.Tier ?? "") && !Has(r.Id) && (r.Cls == null || r.Cls == Run.Cls)).Select(r => r.Id).ToList();

        public string PickRelic(List<string> list = null)
        {
            list ??= FreeRelics();
            if (list.Count == 0) return null;
            var w = list.Select(r => (double)RelicWeight[Defs.Relics[r].Tier]).ToList();
            var x = R.Next() * w.Sum();
            for (var i = 0; i < list.Count; i++) if ((x -= w[i]) < 0) return list[i];
            return list[list.Count - 1];
        }

        public void AddRelic(string id)
        {
            Run.Relics.Add(id);
            Track("codex", "r:" + id);
            Track("ach.put", "relics:" + id);
            var tier = Defs.Relics.TryGetValue(id, out var rd) ? rd.Tier : null;
            if (tier == "boss") Track("ach.put", "trophies:" + id);
            if (tier == "legendary") Track("ach.flag", "legendrelic");
            if (id == "jar") { Run.MaxHp += 8; Run.Hp += 8; }
            if (id == "moonstone") { Run.MaxHp -= 8; Run.Hp = Math.Min(Run.Hp, Run.MaxHp); }
            if (id == "whetstone") UpgradeRandom(2, true);
            if (id == "goldquill") { var l = Run.Deck.Where(CanUp).ToList(); foreach (var c in l) c.Up = true; Upgraded(l.Count); }
        }

        public int UpgradeRandom(int n, bool quiet = false)
        {
            var cand = Run.Deck.Where(CanUp).ToList();
            R.Shuffle(cand);
            var list = cand.Take(n).ToList();
            foreach (var c in list) c.Up = true;
            Upgraded(list.Count);
            if (list.Count > 0 && !quiet) Note(Loc.Tr("Улучшены: {list}", ("list", string.Join(", ", list.Select(CardName)))));
            return list.Count;
        }

        // ================= здоровье и монеты (evApi) =================
        public void Heal(int n) { var b = Run.Hp; Run.Hp = Math.Min(Run.MaxHp, Run.Hp + n); Run.StAdd("healed", Run.Hp - b); }
        public void Damage(int n) { var b = Run.Hp; Run.Hp = Math.Max(1, Run.Hp - n); Run.StAdd("taken", b - Run.Hp); }
        public void Gain(int n) { Run.Gold += n; if (n > 0) Run.StAdd("gold", n); else Run.StAdd("spent", -n); }
        public void Spend(int n) { Run.Gold -= n; Run.StAdd("spent", n); }

        public string GiveRandomCard(string rarity)
        {
            var id = PickCard(rarity);
            Run.Deck.Add(Run.Mk(id));
            Note(Loc.Tr("Новая карта: {name}", ("name", Defs.Cards[id].Name)));
            return id;
        }

        /// <summary>Подарок-талисман; если брать нечего — 40 монет. Сообщение называет, что талисман делает.</summary>
        public string GiveRelic()
        {
            var free = FreeRelics();
            if (free.Count == 0) { Gain(40); Note(Coins(40)); return null; }
            var id = PickRelic(free);
            AddRelic(id);
            Note(Defs.Relics[id].Name + ". " + Defs.Relics[id].Desc);
            return id;
        }

        public static string Coins(int n) => Loc.Tr("+{n} {n|монета|монеты|монет}", ("n", n));

        // ================= путь =================
        public List<Encounter> Choices() => Run.Choices ??= GenChoices();

        Encounter Fight(List<string> pool, List<string> used) { var e = Runs.PickEnemy(Run, pool, used); used.Add(e); return new Encounter { T = "fight", Enemy = e }; }
        Encounter Elite(List<string> pool, List<string> used) { var e = Runs.PickEnemy(Run, pool, used); used.Add(e); return new Encounter { T = "elite", Enemy = e }; }

        public List<Encounter> GenChoices()
        {
            var s = Run.Step;
            var si = Defs.StageOf(s);
            var g = Defs.Stages[si];
            if (Defs.IsFinalStep(s))
            {
                var fp = Run.FinalPrep ?? "shop";
                if (fp == "shop") return new List<Encounter> { new Encounter { T = "shop", Last = true } };
                if (fp == "rest") return new List<Encounter> { new Encounter { T = "rest", Last = true } };
                return new List<Encounter> { new Encounter { T = "boss", Enemy = FinalBoss() } };
            }
            if (s == g.End) return new List<Encounter> { new Encounter { T = "boss", Enemy = Run.Bosses[si] } };
            var k = s - g.Start;
            var normals = k < 8 && g.Early.Count > 0 ? g.Early : g.Normals;
            var eliteOk = si > 0 || k >= 6;
            var used = new List<string>();
            List<Encounter> Done(List<Encounter> list)
            {
                Run.LastOffered = used.ToList();
                foreach (var id in used) Run.Offered[id] = (Run.Offered.TryGetValue(id, out var v) ? v : 0) + 1;
                return list;
            }
            if (s == 0) { var a = Fight(normals, used); var b = Fight(normals, used); return Done(new List<Encounter> { a, b, new Encounter { T = "event", Ev = PickEvent() } }); }
            if (s == g.End - 1) return Done(new List<Encounter> { new Encounter { T = "rest" }, new Encounter { T = "shop" }, eliteOk ? Elite(g.Elites, used) : Fight(normals, used) });
            var pool = new List<Encounter>();
            Run.Forced = Defs.Long && new[] { "event", "shop", "chest", "rest", "meet" }.Contains(Run.Prev);
            if (Run.Forced)
            {
                pool.Add(Fight(normals, used));
                pool.Add(Fight(normals, used));
                pool.Add(eliteOk && R.Next() < Balance.EliteAfterCalm ? Elite(g.Elites, used) : Fight(normals, used));
            }
            var eliteW = eliteOk ? (Defs.Long ? Balance.EliteW[Math.Min(1, si)] : si > 0 ? 16 : 10) : 0;
            var weights = new (string t, int w)[] { ("fight", 40), ("event", 18), ("shop", 10), ("chest", 10), ("rest", 12), ("elite", eliteW) };
            var total = weights.Sum(x => x.w);
            while (pool.Count < 3)
            {
                var r = R.Next() * total;
                var t = "fight";
                foreach (var (key, w) in weights) if ((r -= w) < 0) { t = key; break; }
                if (t != "fight" && t != "event" && pool.Any(p => p.T == t)) continue;
                if (t == "fight") pool.Add(Fight(normals, used));
                else if (t == "elite") pool.Add(Elite(g.Elites, used));
                else if (t == "event") pool.Add(new Encounter { T = "event", Ev = PickEvent(pool.Where(p => p.Ev != null).Select(p => p.Ev).ToList()) });
                else pool.Add(new Encounter { T = t });
            }
            if (!pool.Any(p => p.T == "fight" || p.T == "elite")) { var i = Rnd(0, 2); pool[i] = Fight(normals, used); }
            // встреча с другим героем занимает место события, лавки или привала (если их нет — последнего боя)
            if (Run.MeetPlan.TryGetValue(s, out var mh) && !Run.Met.Contains(mh))
            {
                var i = pool.FindIndex(p => p.T != "fight" && p.T != "elite");
                if (i < 0) i = pool.Count - 1;
                pool[i] = new Encounter { T = "meet", Hero = mh };
            }
            return Done(pool);
        }

        /// <summary>Событие для развилки: те, где герой бывал реже, и не то, из которого он только что вышел.</summary>
        public string PickEvent(List<string> skip = null)
        {
            var all = Data.Events.Select(e => Json.Str(Json.Get(Json.Obj(e), "id"))).ToList();
            var c = all.Where(id => skip == null || !skip.Contains(id)).ToList();
            int Been(string id) => Run.EvSeen.TryGetValue(id, out var v) ? v : 0;
            var least = c.Min(Been);
            c = c.Where(id => Been(id) == least).ToList();
            if (c.Count > 1) c = c.Where(id => id != Run.EvLast).ToList();
            return Pick(c);
        }

        /// <summary>Финальный босс по пути: обиженный герой, Пустой Почтальон, Ночной Кит или Король Теней.</summary>
        public string FinalBoss()
        {
            if (Run.Final != null) return Run.Final;
            var id = Run.Bosses[Defs.Stages.Count - 1];
            if (Defs.Stages.Count > 2)
            {
                var fallen = Run.Fallen.Where(h => h != Run.Cls && Defs.Enemies.ContainsKey("dk_" + h)).ToList();
                if (fallen.Count > 0) id = "dk_" + fallen[fallen.Count - 1];
                else if (Run.Pass >= 2) id = "hollowpost";
                else if (Run.Peace >= 3 && Run.Peace > Run.Anger) id = "skywhale";
                else id = "shadowking";
            }
            Run.Final = id;
            return id;
        }

        /// <summary>Выбор на развилке. Для боя true в talk — враг сначала заговорит (preFight).</summary>
        public Encounter Choose(int i, out bool talk)
        {
            var o = Choices()[i];
            Run.Choices = null;
            Run.Prev = o.T;
            talk = false;
            if (o.T == "event") { Run.EvSeen[o.Ev] = (Run.EvSeen.TryGetValue(o.Ev, out var v) ? v : 0) + 1; Run.EvLast = o.Ev; }
            if (o.T == "fight" || o.T == "elite" || o.T == "boss") talk = PreFight(o);
            if (o.T == "meet" && !Run.Met.Contains(o.Hero)) Run.Met.Add(o.Hero);
            if (o.T == "meet") { Track("ach.put", "met:" + o.Hero); Track("codex", "h:" + o.Hero); }
            return o;
        }

        /// <summary>Следующий уровень (перед финальным боссом сначала лавка, потом костёр).</summary>
        public void Advance()
        {
            Run.Fmod = null;
            if (Defs.IsFinalStep(Run.Step) && Run.FinalPrep != "done")
            {
                Run.FinalPrep = (Run.FinalPrep ?? "shop") == "shop" ? "rest" : "done";
                Run.Choices = null;
                return;
            }
            Run.Step++;
            Run.Choices = null;
            Track("stats.max", "best", Run.Step + 1);
            Track("ach.add", "steps");
            Track("ach.max", "maxgold", Run.Gold);
            Track("ach.max", "maxhp", Run.MaxHp);
        }

        // ================= бой =================
        public CombatSetup SetupFor(string enemyId, string tier)
        {
            var e = Defs.Enemies[enemyId];
            var mod = Run.Fmod ?? new FightMod();
            var tie = e.Dark == null ? TieOf(enemyId) : default;
            var final = tier == "boss" && Defs.IsFinalStep(Run.Step);
            return new CombatSetup
            {
                Att = AttOf(enemyId), Tie = tie.kind, Calm = mod.Calm, ModStr = mod.Str, ModWeak = mod.Weak, ModStun = mod.Stun,
                HpMul = mod.HpMul, Talked = mod.Talked, Friends = final && MainStory ? FriendsOf() : new List<string>(),
            };
        }

        public int GoldFor(string tier)
        {
            var b = tier == "boss" ? Rnd(50, 60) : tier == "elite" ? Rnd(30, 40) : Rnd(12, 20);
            return Round(b * Diff.Gold * (Has("luckystamp") ? 1.2 : 1)) + (Has("envelope") ? 8 : 0);
        }

        /// <summary>После победы (winCombat): талисманы после боя, учёт, куда дальше.</summary>
        public AfterWin Win(Combat c)
        {
            var sharp = c.Draw.Concat(c.Hand).Concat(c.Disc).Concat(c.Exh).Where(x => x.Sharp).Select(x => x.Uid).ToList();
            if (Has("leatherstrop"))
            {
                var cand = Run.Deck.Where(x => sharp.Contains(x.Uid) && CanUp(x)).ToList();
                if (cand.Count > 0) { var x = Pick(cand); x.Up = true; Upgraded(1); Note(Defs.Relics["leatherstrop"].Name + ": " + Loc.Tr("{card} навсегда", ("card", CardName(x)))); }
            }
            var lowHp = Run.Hp < Run.MaxHp / 2.0;
            var lastWin = c.Tier == "boss" && Defs.IsFinalStep(Run.Step);
            void HealBy(string rid, int n) { var b = Run.Hp; Heal(n); if (Run.Hp > b && !lastWin) Note(Defs.Relics[rid].Name + ": +" + (Run.Hp - b) + " HP"); }
            if (Has("herbbag") && c.Paid > 1) HealBy("herbbag", c.Paid / 2);
            Track("stats", "fights");
            if (c.Tier == "elite") { Track("stats", "elites"); Run.StAdd("elites"); }
            if (c.Tier == "boss") { Track("stats", "bosses"); Run.StAdd("bosses"); }
            Track("kill", c.Id);   // для базы знаний: сколько раз побеждён этот враг
            if (!Run.Killed.Contains(c.Id)) Run.Killed.Add(c.Id);
            if (c.Tie == "avenge") Track("ach.add", "avenged");
            if (c.Tie == "rival") Track("ach.add", "rivals");
            Track("ach.put", "beaten:" + c.Id);
            if (c.Tier == "boss") Track("ach.put", "bosses:" + c.Id);
            if (!c.HpLost) Track("ach.add", "flawless");
            if (!c.HpLost && c.Tier == "elite") Track("ach.flag", "flawlesselite");
            if (c.Turn == 1) Track("ach.add", "oneturn");
            if (c.Id == "firecracker" && !c.Boomed) Track("ach.flag", "defuse");
            Run.Fights++; Run.Lit++;
            if (c.Stolen > 0) { Run.Gold += c.Stolen; Note(Loc.Tr("Монеты возвращены: +{n}", ("n", c.Stolen))); }
            if (Has("piggy") && !c.HpLost) { Gain(15); Note(Defs.Relics["piggy"].Name + ": " + Coins(15)); }
            if (Has("snowman")) HealBy("snowman", 4);
            if (Has("candybox") && c.Tier == "elite") HealBy("candybox", 10);
            if (Has("thermos") && lowHp) HealBy("thermos", 12);
            if (lastWin)
            {
                var dk = Defs.Enemies[c.Id].Dark;
                if (dk != null) { Track("ach.put", "darkbeaten:" + dk); Run.FinalDark = dk; }
                return AfterWin.Victory;
            }
            if (WantsPlea(c.Id, c.Tier)) return AfterWin.Plea;
            return c.Tier == "boss" ? AfterWin.BossRelic : AfterWin.Reward;
        }

        bool WantsPlea(string id, string tier) => MainStory && Lore.HasSay(id) && Lore.Say(id, "plea") != null && (tier == "boss" || R.Next() < 0.4);

        /// <summary>Трофей босса: до трёх талисманов босса, которых ещё нет.</summary>
        public List<string> BossRelicOptions()
        {
            var l = Defs.Relics.Values.Where(r => r.Tier == "boss" && !Has(r.Id)).Select(r => r.Id).ToList();
            R.Shuffle(l);
            return l.Take(3).ToList();
        }

        /// <summary>Награда за бой: монеты, талисман за элиту, лечение после босса, карты на выбор (goReward).</summary>
        public Reward MakeReward(string tier)
        {
            var boss = tier == "boss";
            var gold = Round(GoldFor(tier) * (Run.Fmod?.GoldMul ?? 1));
            Run.Fmod = null;
            Gain(gold);
            if (tier == "elite") GiveRelic();
            var healed = boss ? Math.Min(Run.MaxHp - Run.Hp, Round(Run.MaxHp * Diff.BossHeal)) : 0;
            Run.Hp += healed; Run.StAdd("healed", healed);
            var odds = boss ? new[] { 0.1, 0.4, 1, 1 } : tier == "elite" ? new[] { 0.02, 0.12, 0.35, 0.75 } : new[] { 0, 0.03, 0.11, 0.43 };
            var count = Math.Max(2, 3 + (Has("clover") ? 1 : 0) - (Has("crown") ? 1 : 0));
            var ids = new List<string>();
            for (var guard = 0; ids.Count < count && guard < 200; guard++)
            {
                var id = PickCard(RollRarity(odds), ids);
                if (id != null && !ids.Contains(id)) ids.Add(id);
            }
            return new Reward { Boss = boss, Gold = gold, Healed = healed, Ids = ids };
        }

        public void TakeCard(string id) { Run.Deck.Add(Run.Mk(id)); Note(Loc.Tr("В колоду: {name}", ("name", Defs.Cards[id].Name))); }

        // ================= сундук =================
        /// <summary>Открыть сундук: талисман (треть случаев) или монеты. Возвращает id талисмана или null.</summary>
        public string OpenChest(out string msg)
        {
            Track("ach.add", "chests");
            var free = FreeRelics();
            if (free.Count > 0 && R.Next() < (Defs.Long ? Balance.ChestRelic : 0.5))
            {
                var id = PickRelic(free);
                AddRelic(id);
                msg = Loc.Tr("Внутри: {name}. {desc}", ("name", Defs.Relics[id].Name), ("desc", Defs.Relics[id].Desc));
                return id;
            }
            var g = Rnd(28, 45);
            Gain(g);
            msg = Loc.Tr("Внутри {n} {n|монета|монеты|монет}.", ("n", g));
            return null;
        }

        // ================= костёр =================
        public int RestHeal() => Round(Run.MaxHp * Diff.Rest) + (Has("kettle") ? 10 : 0);

        public string RestText()
        {
            var heal = Math.Min(RestHeal(), Run.MaxHp - Run.Hp);
            var cocoa = Has("cocoatin") ? Loc.Tr("+{n} макс.", ("n", 2)) : "";
            return (heal > 0 ? "+" + heal + " HP" : Loc.Tr("Здоровье и так полное")) + (cocoa != "" ? ", " + cocoa : "");
        }

        public bool CanRestHeal => !Has("bottomless");

        public void Rest()
        {
            Heal(RestHeal());
            if (Has("cocoatin")) { Run.MaxHp += 2; Run.Hp += 2; Note(Defs.Relics["cocoatin"].Name + ": " + Loc.Tr("+{n} к макс. HP", ("n", 2))); }
        }

        // ================= лавка =================
        int Disc(int n) => Round(n * (Has("coupon") ? 0.75 : 1));
        static readonly Dictionary<string, int> CardBase = new Dictionary<string, int> { ["common"] = 38, ["uncommon"] = 54, ["rare"] = 72, ["epic"] = 95, ["legendary"] = 130 };
        static readonly Dictionary<string, int> RelicPrice = new Dictionary<string, int> { ["common"] = 125, ["uncommon"] = 150, ["rare"] = 180, ["epic"] = 215, ["legendary"] = 270 };
        static readonly Dictionary<string, int> RelicPriceShort = new Dictionary<string, int> { ["common"] = 90, ["uncommon"] = 108, ["rare"] = 125, ["epic"] = 150, ["legendary"] = 190 };

        void Stock(ShopState shop, List<string> skip)
        {
            var rar = new[] { "common", "uncommon", RollRarity(new[] { 0.05, 0.25, 1, 1 }) };
            var ids = rar.Select(r => PickCard(r)).ToList();
            shop.Cards = ids.Select(id => new ShopItem { Id = id, Price = Disc(CardBase[Defs.Cards[id].Rarity] + Rnd(-4, 6)) }).ToList();
            var rid = PickRelic();
            for (var k = 0; k < 6 && rid != null && skip.Contains(rid); k++) rid = PickRelic();
            shop.Relic = rid != null ? new ShopItem { Id = rid, Price = Disc((Defs.Long ? RelicPrice : RelicPriceShort)[Defs.Relics[rid].Tier]) } : null;
        }

        public ShopState NewShop()
        {
            var shop = new ShopState();
            Stock(shop, new List<string>());
            shop.Tea = new ShopItem { Price = Disc(22) };
            shop.Remove = new ShopItem { Price = Disc(50) };
            shop.Up = new ShopItem { Price = Disc(55) };
            return shop;
        }

        public int RerollPrice(ShopState s) => Disc(20 + 12 * s.Rerolls);

        /// <summary>Заплатить за товар. Не хватает монет — сообщение и false.</summary>
        public bool Pay(ShopItem item)
        {
            if (item.Sold) return false;
            if (Run.Gold < item.Price) { Note(Loc.Tr("Не хватает монет")); return false; }
            Spend(item.Price); item.Sold = true;
            Track("ach.add", "spent", item.Price);
            if (Defs.IsFinalStep(Run.Step)) Track("ach.flag", "finalbuy");
            return true;
        }

        public bool BuyCard(ShopState s, int i)
        {
            if (!Pay(s.Cards[i])) return false;
            Run.Deck.Add(Run.Mk(s.Cards[i].Id));
            Track("ach.add", "bought");
            Note(Loc.Tr("Куплено: {name}", ("name", Defs.Cards[s.Cards[i].Id].Name)));
            return true;
        }

        public bool BuyRelic(ShopState s)
        {
            if (s.Relic == null || !Pay(s.Relic)) return false;
            AddRelic(s.Relic.Id);
            return true;
        }

        /// <summary>Сбитень: +12 HP. При полном здоровье монеты не берутся.</summary>
        public int BuyTea(ShopState s)
        {
            if (!s.Tea.Sold && Run.Hp >= Run.MaxHp) { Note(Loc.Tr("Здоровье и так полное")); return -1; }
            if (!Pay(s.Tea)) return -1;
            var b = Run.Hp;
            Run.Hp = Math.Min(Run.MaxHp, Run.Hp + 12);
            Run.StAdd("healed", Run.Hp - b);
            return Run.Hp - b;
        }

        public bool Reroll(ShopState s)
        {
            var price = RerollPrice(s);
            if (Run.Gold < price) { Note(Loc.Tr("Не хватает монет")); return false; }
            Spend(price);
            Track("ach.add", "spent", price);
            Stock(s, s.Relic != null ? new List<string> { s.Relic.Id } : new List<string>());
            s.Rerolls++;
            Note(Loc.Tr("Товар обновлён"));
            return true;
        }

        /// <summary>Услуга лавки (заточка, распустить карту) оплачивается после выбора карты.</summary>
        public bool CanAfford(ShopItem item)
        {
            if (item.Sold) return false;
            if (Run.Gold < item.Price) { Note(Loc.Tr("Не хватает монет")); return false; }
            return true;
        }

        public void PayService(ShopItem item) { Spend(item.Price); item.Sold = true; Track("ach.add", "spent", item.Price); if (Defs.IsFinalStep(Run.Step)) Track("ach.flag", "finalbuy"); }

        // ================= выбор карты из колоды =================
        public List<CardInst> PromptList(DeckPrompt p)
        {
            switch (p)
            {
                case DeckPrompt.Upgrade: return Run.Deck.Where(CanUp).ToList();
                case DeckPrompt.Duplicate: return Run.Deck.Where(c => Defs.Cards[c.Id].Rarity != "status" && Defs.Cards[c.Id].Rarity != "legendary").ToList();
                default: return Run.Deck.ToList();
            }
        }

        public void UpgradeCard(CardInst c) { c.Up = true; Upgraded(1); }

        public void RemoveCard(CardInst c) => Run.Deck = Run.Deck.Where(d => d.Uid != c.Uid).ToList();

        public void DuplicateCard(CardInst c, int cost)
        {
            if (cost > 0) Damage(cost);
            Run.Deck.Add(Run.Mk(c.Id, c.Up));
            Note(Loc.Tr("Копия: {name}", ("name", CardName(c))));
        }

        public string TransformCard(CardInst c)
        {
            RemoveCard(c);
            var id = PickCard("rare");
            Run.Deck.Add(Run.Mk(id));
            Note(CardName(c) + " → " + Defs.Cards[id].Name);
            return id;
        }

        /// <summary>Выполнить выбор карты. false — выбор не годится (отмена).</summary>
        public bool ApplyPrompt(DeckPrompt p, CardInst c, int cost = 0)
        {
            if (c == null) return false;
            switch (p)
            {
                case DeckPrompt.Upgrade: UpgradeCard(c); return true;
                case DeckPrompt.Remove: RemoveCard(c); return true;
                case DeckPrompt.Duplicate: DuplicateCard(c, cost); return true;
                case DeckPrompt.Transform: TransformCard(c); return true;
            }
            return false;
        }
    }
}
