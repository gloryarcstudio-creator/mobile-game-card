// Интерфейс боя для карт: то, что в game.js лежит в объекте api и приходит в play(g, u, c) как g.
// Имена те же, что в веб-версии, только с большой буквы: g.attack -> g.Attack.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public sealed partial class Combat
    {
        // ---------- то, что карты читают ----------
        public int Played => PlayedTurn;
        public bool EnemyDead => Enemy.Hp <= 0;
        /// <summary>Название предыдущей карты хода для Копирки.</summary>
        public string LastCard => Last != null && Last.Id != "carbon" ? CardName(Last) : null;
        public string CardName(CardInst c) => Defs.Cards[c.Id].Name + (c.Up ? "+" : "");

        // ---------- то, что карты делают ----------
        public void Attack(int @base, int hits = 1)
        {
            var kind = FxKind ?? "bonk";
            for (var h = 0; h < hits; h++)
            {
                if (Enemy.Hp <= 0 || Run.Hp <= 0) break;
                E(Ev.HeroMove, "lunge");
                // первый удар карты — полная анимация, следующие короче
                Strike(CalcDmg(@base), FxHits++ > 0 ? Cards.AtkFxNext(kind) ?? kind : kind);
                // метла трубочиста: каждый удар подкидывает искру
                if (Enemy.Hp > 0 && Proc("sootbroom", "enemy")) { Enemy.Burn += 1; Fx("sparks", "enemy"); FloatEnemy(Loc.Tr("Поджог +{n}", ("n", 1)), "burnf"); }
                // колючий враг ранит в ответ на каждый удар
                if (Enemy.Thorns > 0 && Enemy.Hp > 0) { Fx("thorns"); HitHero(Enemy.Thorns); }
                if (hits > 1) Wait(140);
            }
        }

        public void Block(int n)
        {
            n = Frailed(n);
            BlockNow += n; Sfx("block"); Fx("shield"); FloatHero("+" + n, "blockf");
        }

        public void Flame(int n)
        {
            FlameNow += n;
            Sfx("flame"); Fx("flamelet");
            Render();
            while (FlameNow >= FlameMaxNow && Enemy.Hp > 0)
            {
                FlameNow -= FlameMaxNow;
                DoBurst();
            }
        }

        /// <summary>Карта добора, которой нечего брать, говорит об этом (v172).</summary>
        public void DrawN(int n)
        {
            var was = Hand.Count;
            DrawCards(n);
            if (n > 0 && Hand.Count == was && was < Balance.HandMax) FloatHero(Loc.Tr("Брать нечего"), "weakf");
        }

        public void Heal(int n)
        {
            Sfx("heal"); Fx("heal");
            var before = Run.Hp;
            Run.Hp = Math.Min(Run.MaxHp, Run.Hp + n);
            StAdd("healed", Run.Hp - before);
            FloatHero("+" + (Run.Hp - before), "healf");
        }

        public void Burn(int n)
        {
            var v = n + (Proc("matchbox", "enemy") ? 2 : 0);
            Fx("burnApply", "enemy"); Enemy.Burn += v; FloatEnemy(Loc.Tr("Поджог {n}", ("n", v)), "burnf");
        }

        public void Weak(int n) { Fx("weak", "enemy"); Enemy.Weak += n; FloatEnemy(Loc.Tr("Ослаблен"), "weakf"); }
        public void Vuln(int n) { Fx("vuln", "enemy"); Enemy.Vuln += n + (Proc("stamppad", "enemy") ? 1 : 0); FloatEnemy(Loc.Tr("Уязвим"), "weakf"); }
        public void Chill(int n) { Fx("frost", "enemy"); Enemy.Str -= n; FloatEnemy(Loc.Tr("Сила −{n}", ("n", n)), "blockf"); }

        public void Stun()
        {
            Fx("sleep", "enemy"); Enemy.Stun = 1; FloatEnemy(Loc.Tr("Засыпает…"), "weakf");
            if (Tier == "boss") Track("ach.flag", "stunboss");
        }

        public void Energy(int n) { EnergyNow += n; Fx("energy"); FloatHero(Loc.Tr("+{n} {n|энергия|энергии|энергии}", ("n", n)), "blockf"); }
        public void Resolve(int n) { Str += n; Fx("aura"); FloatHero(Loc.Tr("Решимость +{n}", ("n", n)), "burnf"); }
        public void Rush(int n) { TmpStr += n; Fx("aura"); FloatHero(Loc.Tr("Решимость +{n}", ("n", n)), "burnf"); }

        public void Thorns(int n)
        {
            if (Proc("wreath")) n *= 2;
            ThornsNow += n; Fx("thorns"); FloatHero(Loc.Tr("Шипы +{n}", ("n", n)), "blockf");
        }

        public void Gold(int n)
        {
            Run.Gold += n;
            if (n > 0) StAdd("gold", n); else StAdd("spent", -n);
            Fx("gold");
            FloatHero(Loc.Tr("+{n} {n|монета|монеты|монет}", ("n", n)), "burnf");
        }

        public void MaxHp(int n)
        {
            Run.MaxHp += n; Run.Hp += n; Sfx("heal"); Fx("heart");
            FloatHero(Loc.Tr("+{n} к макс. HP", ("n", n)), "healf");
        }

        public void DoubleBlock() { if (BlockNow > 0) Block(BlockNow); }
        public void BurstNow() => DoBurst();
        public int ConsumeFlame() { var n = FlameNow; FlameNow = 0; return n; }

        public void Deliver(string name, Action<Combat> fn)
        {
            name = Loc.Tr(name);
            Deliveries.Add(new Delivery { Name = name, Fn = fn });
            Fx("deliver");
            FloatHero(Loc.Tr("{name} в пути", ("name", name)), "weakf");
        }

        public void Charm(string id, int n)
        {
            Charms[id] = Charm0(id) + n;
            Fx("sigil", "c:" + id);
            FloatHero(Defs.Cards[id].Name, "weakf");
            if (Charms.Count >= 3) Track("ach.flag", "charms3");
        }

        public void FreeTurn() { Free = true; Fx("clock"); FloatHero(Loc.Tr("Все карты бесплатно!"), "burnf"); }

        /// <summary>Копирка: повторить предыдущую карту хода.</summary>
        public void CopyLast()
        {
            var l = Last;
            if (l == null || l.Id == "carbon") { FloatHero(Loc.Tr("Нечего копировать"), "weakf"); return; }
            FloatHero(Loc.Tr("Копия: {name}", ("name", Defs.Cards[l.Id].Name)), "weakf");
            Fx("mirror");
            var was = FxKind;
            FxKind = Cards.AtkFx(l.Id); FxHits = 0;
            Cards.Play(this, l);
            FxKind = was;
        }

        /// <summary>Обратный адрес: вернуть в руку последние карты из сброса (кроме помех).</summary>
        public void Recall(int n)
        {
            var got = 0;
            for (var i = Disc.Count - 1; i >= 0 && got < n && Hand.Count < Balance.HandMax; i--)
            {
                if (Defs.Cards[Disc[i].Id].Type == "status") continue;
                Hand.Add(Disc[i]); Disc.RemoveAt(i); got++;
            }
            if (got < n && Hand.Count >= Balance.HandMax && Disc.Any(c => Defs.Cards[c.Id].Type != "status")) HandFull();
            Fx("cards");
            FloatHero(got > 0 ? Loc.Tr("Вернулось карт: {n}", ("n", got)) : Loc.Tr("Сброс пуст"), "weakf");
        }

        /// <summary>До востребования: бесплатно разыграть верхние карты колоды, помехи сгорают.</summary>
        public void Autoplay(int n)
        {
            for (var k = 0; k < n; k++)
            {
                if (Enemy.Hp <= 0 || Run.Hp <= 0) break;
                if (Draw.Count == 0)
                {
                    if (Disc.Count == 0) break;
                    Draw = Disc; Run.Rng.Shuffle(Draw); Disc = new List<CardInst>();
                }
                var c = Pop(Draw);
                var cd = Defs.Cards[c.Id];
                Toast(Loc.Tr("Из колоды: {name}", ("name", CardName(c))));
                if (cd.Type == "status") { ExhaustCard(c); continue; }
                FxKind = Cards.AtkFx(c.Id); FxHits = 0;
                Cards.Play(this, c);
                if (cd.Type == "charm") Exh.Add(c);
                else if (cd.Exhaust) ExhaustCard(c);
                else Disc.Add(c);
                Render();
                Wait(250);
            }
        }

        /// <summary>Пряничница: положить Пряники в руку (с Глазурью — улучшенные).</summary>
        public void Ginger(int n)
        {
            var got = 0;
            for (var k = 0; k < n && Hand.Count < Balance.HandMax; k++) { Hand.Add(Run.Mk("gingerbread", Glazed)); got++; }
            if (got > 0) { Fx("ginger"); FloatHero(Loc.Tr("Пряник +{n}", ("n", got)), "burnf"); }
            if (got < n) HandFull();
        }

        public void Glaze()
        {
            Glazed = true;
            foreach (var c in Hand.Concat(Draw).Concat(Disc)) if (c.Id == "gingerbread") c.Up = true;
            Fx("sugar");
            FloatHero(Loc.Tr("Глазурь!"), "weakf");
        }

        /// <summary>Точильщик: заточить карты в руке — улучшить до конца боя.</summary>
        public int Sharpen(int n, bool quiet = false)
        {
            var keen = Hand.Count(c => c.Up);
            var cand = Hand.Where(CanUpgrade).ToList();
            Run.Rng.Shuffle(cand);
            var list = cand.Take(n).ToList();
            foreach (var c in list) { c.Up = true; c.Sharp = true; }
            Sharpened += list.Count;
            // заточка, которой досталась уже улучшенная карта, даёт защиту (v128)
            var spare = Balance.HoneBlock != 0 ? Math.Min(n - list.Count, keen) : 0;
            if (spare > 0) Block(Balance.HoneBlock * spare);
            if (list.Count > 0)
            {
                Track("ach.max", "sharpfight", Sharpened);
                Fx("grind");
                FloatHero(list.Count == 1 ? Loc.Tr("Заточено: {name}", ("name", Defs.Cards[list[0].Id].Name)) : Loc.Tr("Заточено карт: {n}", ("n", list.Count)), "blockf");
            }
            else if (!quiet && spare <= 0) FloatHero(Loc.Tr("Нечего точить"), "weakf");
            return list.Count;
        }

        /// <summary>Сколько улучшенных карт в колоде, руке и сбросе (кроме самой карты).</summary>
        public int UpCount(CardInst self) => Draw.Concat(Hand).Concat(Disc).Count(c => c.Up && c != self);

        /// <summary>Пастушка: Злость Дружка.</summary>
        public void Dog(int n) { DogNow += n; Fx("growl"); FloatHero(Loc.Tr("Злость +{n}", ("n", n)), "burnf"); Track("ach.max", "dogmax", DogNow); }

        public void Bite()
        {
            if (DogNow <= 0 || Enemy.Hp <= 0) return;
            E(Ev.HeroMove, "bite");
            Fx("bite", "enemy");
            FloatEnemy(Loc.Tr("Гав!"), "weakf");
            HitEnemy(DogDmg, true);
            if (Proc("collar")) Block(2);
        }

        /// <summary>Знахарка: заплатить Цену здоровьем.</summary>
        public void Price(int n)
        {
            LoseHp(n); Paid += n; Track("ach.max", "pricefight", Paid);
            Fx("price"); FloatHero(Loc.Tr("Цена −{n} HP", ("n", n)), "dmgf small");
            Render();
            if (Enemy.Hp > 0 && Proc("mortar", "enemy")) { Wait(120); Strike(n, "roots"); }
        }

        /// <summary>Сжечь карты из руки по условию, вернуть их количество.</summary>
        public int ExhaustHand(Func<CardDef, bool> pred)
        {
            var outList = Hand.Where(c => pred(Defs.Cards[c.Id])).ToList();
            Hand = Hand.Where(c => !outList.Contains(c)).ToList();
            foreach (var c in outList) ExhaustCard(c);
            return outList.Count;
        }
    }
}
