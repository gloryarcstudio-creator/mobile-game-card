// Разговоры до боя, пощада после боя и встречи с героями (js/game.js: attOf, tieOf, preFight,
// talkOptions, talkChoose, goAfter/afterChoose, meetOptions/meetChoose, relChange).
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public sealed partial class RunGame
    {
        /// <summary>Отношение врага к герою: like / fear / hate; обида за «забрать всё» — grudge.</summary>
        public string AttOf(string id)
        {
            if (!MainStory) return null;
            return Lore.Att(id, Run.Cls) ?? (Run.Grudge.ContainsKey(id) ? "grudge" : null);
        }

        public Dictionary<string, object> SecretOf(string id)
        {
            var sc = Lore.Secret(Run.Cls);
            return sc != null && Json.Str(Json.Get(sc, "enemy")) == id && !Run.Secrets.Contains(id) ? sc : null;
        }

        /// <summary>Реплика врага (lineOf): из списка — случайная, но не из генератора забега.</summary>
        public string LineOf(string id, string key)
        {
            var v = Lore.Say(id, key);
            if (v is string s) return s;
            var a = Lore.Strs(v);
            return a.Count > 0 ? a[UiRnd.Next(a.Count)] : null;
        }

        public static int CalmPrice(string tier) => tier == "boss" ? 40 : tier == "elite" ? 25 : 15;
        public int BribePrice => 12 + Run.Step / 2;

        /// <summary>Друзья забега: герои, которым помогли, и вернувшиеся из Тени.</summary>
        public List<string> FriendsOf() => Run.Rel.Where(kv => kv.Key != Run.Cls && kv.Value >= 2 && !Run.Fallen.Contains(kv.Key) && Lore.Friend(kv.Key) != null).Select(kv => kv.Key).ToList();

        /// <summary>Связь врага с уже встреченными: avenge (победили его своих), thanks (пощадили их), rival (победили соперника).</summary>
        public (string kind, string other, string text) TieOf(string id)
        {
            if (!MainStory) return default;
            var ties = Lore.Ties.Where(t => t.a == id || t.b == id).Select(t => (other: t.a == id ? t.b : t.a, t.k, t.text)).ToList();
            var kin = ties.Where(t => t.k == "kin").ToList();
            var x = kin.FirstOrDefault(t => Run.Killed.Contains(t.other));
            if (x.other != null) return ("avenge", x.other, x.text);
            x = kin.FirstOrDefault(t => Run.Kind.Contains(t.other));
            if (x.other != null) return ("thanks", x.other, x.text);
            x = ties.FirstOrDefault(t => t.k == "rival" && Run.Killed.Contains(t.other));
            return x.other != null ? ("rival", x.other, x.text) : default;
        }

        void BeKind(string id) { if (!Run.Kind.Contains(id)) Run.Kind.Add(id); }

        /// <summary>Заговорит ли враг до боя: тайна, финал и обида — всегда, отношение — часто, остальные — изредка.</summary>
        bool PreFight(Encounter o)
        {
            if (!MainStory || !Lore.HasSay(o.Enemy)) return false;
            var att = AttOf(o.Enemy);
            var tie = TieOf(o.Enemy);
            return (o.T == "boss" && Defs.IsFinalStep(Run.Step)) || SecretOf(o.Enemy) != null
                || (tie.kind != null && (tie.kind != "rival" || R.Next() < 0.6))
                || (att != null && R.Next() < (o.T == "boss" || att == "grudge" ? 1 : 0.6))
                || (att == null && o.T == "fight" && R.Next() < 0.15);
        }

        /// <summary>Первая реплика разговора (goTalk).</summary>
        public string TalkLine(string id)
        {
            var e = Defs.Enemies[id];
            var att = AttOf(id);
            var tie = e.Dark == null ? TieOf(id) : default;
            if (e.Dark != null) return Json.Str(Json.Get(Lore.Dark(e.Dark), "intro"));
            if (tie.kind != null) return Pick(Lore.Strs(Lore.TieSay(tie.kind)));
            if (att != null && att != "grudge") return LineOf(id, att);
            if (att == "grudge") return Lore.Grudge;
            return LineOf(id, "start") ?? Lore.Challenge;
        }

        /// <summary>Пояснение связи врагов под репликой (tienote).</summary>
        public string TieNote(string id) => Defs.Enemies[id].Dark == null ? TieOf(id).text : null;

        public List<Option> TalkOptions(string id, string tier)
        {
            var e = Defs.Enemies[id];
            var att = AttOf(id);
            var tie = TieOf(id);
            var kin = e.Dark != null ? null : tie.kind;
            var angry = (att == "hate" || att == "grudge" ? 2 : 0) + (kin == "avenge" ? 1 : 0);
            var scared = (att == "fear" ? 2 : 0) + (kin == "rival" ? 2 : 0);
            var mood = angry > 0 && scared > 0 ? Loc.Tr("Сила врага +{n}, враг Ослаблен на {w} хода", ("n", angry), ("w", scared))
                : angry > 0 ? Loc.Tr("Сила врага +{n}", ("n", angry)) : scared > 0 ? Loc.Tr("Враг Ослаблен на {n} хода", ("n", scared)) : Loc.Tr("Обычный бой");
            var ops = new List<Option> { new Option { K = "fight", Text = "В бой", Hint = mood } };
            if (tie.kind == "thanks") ops.Add(new Option { K = "regards", Text = "Передать привет", Hint = Loc.Tr(tier == "boss" ? "Босс Ослаблен на 2 хода" : "Без боя, монеты и +6 HP"), Secret = true });
            var sc = SecretOf(id);
            if (sc != null)
            {
                var fx = Json.Obj(Json.Get(sc, "effect"));
                var g = Json.Int(Json.Get(fx, "gold"));
                ops.Add(new Option { K = "secret", Text = Json.Str(Json.Get(sc, "text")), Hint = Loc.Tr(Json.Str(Json.Get(sc, "hint"))), Can = !(g < 0) || Run.Gold >= -g, Why = "Не хватает монет", Secret = true });
            }
            if (e.Dark != null) ops.Add(new Option { K = "forgive", Text = Json.Str(Json.Get(Lore.Forgive, "text")), Hint = Loc.Tr(Json.Str(Json.Get(Lore.Forgive, "hint"))), Can = Run.MaxHp > 12, Why = "Слишком мало здоровья" });
            if (att == "like") ops.Add(tier == "boss" ? new Option { K = "heart", Text = "Поговорить по душам", Hint = Loc.Tr("Босс Ослаблен на 2 хода") }
                : new Option { K = "peace", Text = "Договориться миром", Hint = Loc.Tr(tier == "elite" ? "Без боя, талисман" : "Без боя, монеты и +6 HP") });
            if (att == "fear" && tier != "boss") ops.Add(new Option { K = "scare", Text = "Прогнать", Hint = Loc.Tr("Без боя, половина монет") });
            if (att == "hate" || att == "grudge" || tie.kind == "avenge")
            {
                ops.Add(new Option { K = "calm", Text = "Успокоить", Hint = Loc.Tr("−{n} {n|монета|монеты|монет}, враг не злится", ("n", CalmPrice(tier))), Can = Run.Gold >= CalmPrice(tier), Why = "Не хватает монет" });
                ops.Add(new Option { K = "sass", Text = "Ответить дерзко", Hint = Loc.Tr("Сила врага +{n}, монет вдвое больше", ("n", 3 + angry)) });
            }
            else ops.Add(new Option { K = "taunt", Text = "Подразнить", Hint = Loc.Tr("Сила врага +2, монет в полтора раза больше") });
            if (att == null && sc == null && tier == "fight") ops.Add(new Option { K = "bribe", Text = "Откупиться", Hint = Loc.Tr("−{n} {n|монета|монеты|монет}, без боя", ("n", BribePrice)), Can = Run.Gold >= BribePrice, Why = "Не хватает монет" });
            return ops;
        }

        /// <summary>Ответ в разговоре. Text — реплика врага (в кавычках у экрана) или рассказ (Narr).
        /// Next: fight — бой с Fight, next — дальше по пути, bossrelic — трофей босса без боя.</summary>
        public Outcome TalkChoose(string id, string tier, string k, out bool quoteIt)
        {
            var e = Defs.Enemies[id];
            var mod = new FightMod { Talked = true };
            string reply = null, narr = null, next = "fight", fightId = id;
            if (k != "fight") Track("ach.add", "talks");
            if (k == "taunt" || k == "sass")
            {
                mod.Str = k == "sass" ? 3 : 2; mod.GoldMul = k == "sass" ? 2 : 1.5;
                reply = Pick(Lore.Taunted); Run.Anger++;
            }
            else if (k == "calm") { Spend(CalmPrice(tier)); mod.Calm = true; Run.Grudge.Remove(id); reply = "Ладно, ладно. Уже не злюсь."; }
            else if (k == "heart") { mod.Weak = 2; reply = LineOf(id, "peace") ?? "Ладно… только ради тебя."; Run.Peace++; }
            else if (k == "regards")
            {
                Run.Peace++;
                if (tier == "boss") { mod.Weak = 2; reply = Json.Str(Lore.TieSay("regardsBoss")); }
                else { next = "next"; BeKind(id); reply = Pick(Lore.Strs(Lore.TieSay("regards"))); Gain(GoldFor("fight")); Heal(6); }
            }
            else if (k == "peace")
            {
                next = "next"; BeKind(id); reply = LineOf(id, "peace") ?? "Ладно, иди с миром."; Run.Peace++;
                if (tier == "elite") GiveRelic(); else { Gain(GoldFor("fight")); Heal(6); }
            }
            else if (k == "scare")
            {
                next = "next"; var g = (int)Math.Ceiling(GoldFor(tier) / 2.0); Gain(g);
                narr = Loc.Tr("{name} убегает, бросив {n} {n|монету|монеты|монет}.", ("name", e.Name), ("n", g));
            }
            else if (k == "bribe") { Spend(BribePrice); next = "next"; narr = Loc.Tr("Монеты звякнули, и {name} уступает дорогу.", ("name", e.Name)); }
            else if (k == "secret")
            {
                var sc = SecretOf(id); var fx = Json.Obj(Json.Get(sc, "effect"));
                Run.Secrets.Add(id); Run.Peace++;
                narr = Loc.Tr(Json.Str(Json.Get(sc, "res")));
                var gold = Json.Int(Json.Get(fx, "gold")); if (gold != 0) Gain(gold);
                var mh = Json.Int(Json.Get(fx, "maxHp")); if (mh != 0) { Run.MaxHp += mh; Run.Hp += mh; }
                var heal = Json.Int(Json.Get(fx, "heal")); if (heal != 0) Heal(heal);
                if (Json.Bool(Json.Get(fx, "peace"))) { next = tier == "boss" ? "bossrelic" : "next"; BeKind(id); if (tier == "elite") GiveRelic(); }
                else { mod.HpMul = Json.Get(fx, "hp") is double hp && hp != 0 ? hp : 1; mod.Weak = Json.Int(Json.Get(fx, "weak")); mod.Stun = Json.Int(Json.Get(fx, "stun")); }
            }
            else if (k == "forgive")
            {
                Run.MaxHp -= 10; Run.Hp = Math.Min(Run.Hp, Run.MaxHp);
                Run.Rel[e.Dark] = 2; Run.Fallen.Remove(e.Dark); Run.Forgiven = e.Dark;
                Run.Final = "shadowking"; fightId = "shadowking";
                narr = Loc.Tr(Json.Str(Json.Get(Lore.Forgive, "res")));
            }
            if (next == "fight") Run.Fmod = mod;
            quoteIt = reply != null;
            return new Outcome { Text = reply != null ? Loc.Tr(reply) : narr, Fight = next == "fight" ? fightId : null, FightTier = tier, Next = next };
        }

        // ---------- пощада после боя ----------
        public string PleaLine(string id) => Json.Str(Lore.Say(id, "plea"));

        public string AfterChoose(string id, string tier, bool spare)
        {
            if (spare)
            {
                Run.Peace++;
                Run.Killed.Remove(id); BeKind(id);
                if (tier == "boss") GiveRelic();
                else
                {
                    var gift = Rnd(0, 2);
                    if (gift == 0 && Run.Hp < Run.MaxHp) Heal(8);
                    else if (gift == 1 && UpgradeRandom(1) > 0) { }
                    else Gain(15);
                }
                return Loc.Tr("Ты {f|отпустила|отпустил} врага, и на прощание он оставил тебе подарок.");
            }
            Run.Anger++; Run.Grudge[id] = 1;
            Run.Fmod ??= new FightMod();
            Run.Fmod.GoldMul *= 1.5;
            return Loc.Tr("Ты {f|забрала|забрал} всё до последней монетки. Враг это запомнит.");
        }

        // ---------- встречи с героями ----------
        public List<Option> MeetOptions(string h)
        {
            var m = Lore.Meet(h);
            var ops = new List<Option>();
            var tie = Json.Obj(Json.Get(Json.Obj(Json.Get(m, "ties")), Run.Cls));
            if (tie != null) ops.Add(FromLore("tie", tie, true));
            ops.Add(FromLore("help", Json.Obj(Json.Get(m, "help")), false));
            var pass = FromLore("pass", Json.Obj(Json.Get(m, "pass")), false);
            pass.Text ??= "Пройти мимо";
            if (pass.Hint == null) pass.Hint = Loc.Tr("{name} немного обидится", ("name", Data.Classes[h].Name));
            if (pass.Fx == null) pass.Fx = new Dictionary<string, object> { ["rel"] = -1.0 };
            ops.Add(pass);
            ops.Add(FromLore("hurt", Json.Obj(Json.Get(m, "hurt")), false));
            foreach (var o in ops)
            {
                var fx = o.Fx ?? new Dictionary<string, object>();
                int gold = Json.Int(Json.Get(fx, "gold")), hp = Json.Int(Json.Get(fx, "hp")), mh = Json.Int(Json.Get(fx, "maxHp"));
                o.Can = !(gold < 0 && Run.Gold < -gold) && !(hp != 0 && Run.Hp <= hp) && !(mh < 0 && Run.MaxHp <= 12);
                o.Why = gold < 0 && Run.Gold < -gold ? "Не хватает монет" : "Слишком мало здоровья";
            }
            return ops;
        }

        static Option FromLore(string k, Dictionary<string, object> o, bool secret)
        {
            var hint = Json.Str(Json.Get(o, "hint"));
            return new Option
            {
                K = k, Text = Json.Str(Json.Get(o, "text")), Hint = hint != null ? Loc.Tr(hint) : null, Secret = secret,
                Fx = Json.Obj(Json.Get(o, "fx")), Res = Json.Str(Json.Get(o, "res")),
            };
        }

        /// <summary>Нужно ли сначала выбрать карту для улучшения (fx.up).</summary>
        public bool MeetNeedsUpgrade(Option o) => Json.Bool(Json.Get(o.Fx, "up")) && Run.Deck.Any(CanUp);

        /// <summary>Ответ на встрече. picked — карта для улучшения уже выбрана (или улучшать нечего).</summary>
        public string MeetChoose(string h, Option o)
        {
            var fx = o.Fx ?? new Dictionary<string, object>();
            if (Json.Bool(Json.Get(fx, "up")) && !Run.Deck.Any(CanUp)) Note(Loc.Tr("Все карты уже улучшены"));
            int gold = Json.Int(Json.Get(fx, "gold")), hp = Json.Int(Json.Get(fx, "hp")), heal = Json.Int(Json.Get(fx, "heal")), mh = Json.Int(Json.Get(fx, "maxHp"));
            if (gold != 0) Gain(gold);
            if (hp != 0) Damage(hp);
            if (heal != 0) Heal(heal);
            if (mh != 0) { Run.MaxHp += mh; Run.Hp = Math.Min(Run.Hp, Run.MaxHp); }
            if (Json.Bool(Json.Get(fx, "relic"))) GiveRelic();
            var upr = Json.Int(Json.Get(fx, "upRandom")); if (upr != 0) UpgradeRandom(upr);
            if (o.K == "pass") Run.Pass++;
            Run.MeetLog.Add(o.K);
            RelChange(h, Json.Int(Json.Get(fx, "rel")));
            return Loc.Tr(o.Res ?? "");
        }

        void RelChange(string h, int d)
        {
            Run.Rel[h] = (Run.Rel.TryGetValue(h, out var v) ? v : 0) + d;
            var name = Data.Classes[h].Name;
            if (Run.Rel[h] <= -2 && !Run.Fallen.Contains(h)) { Run.Fallen.Add(h); Note(Loc.Tr("Тень коснулась героя: {name}", ("name", name))); }
            else if (d > 0 && Run.Rel[h] >= 2) Note(Loc.Tr("Новый друг: {name}", ("name", name)));
        }
    }
}
