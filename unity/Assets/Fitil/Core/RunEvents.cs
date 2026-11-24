// События на пути (EVENTS в js/data.js): что делает каждый ответ. Тексты ответов и подсказки — в данных,
// а действия (act) и условия (can) в данных были функциями, поэтому перенесены сюда по одному.
// Итоги — русские тексты, они же ключи перевода, как в веб-версии.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fitil.Core
{
    public sealed partial class RunGame
    {
        public Dictionary<string, object> EventData(string id) => Data.Events.Select(Json.Obj).First(e => Json.Str(Json.Get(e, "id")) == id);

        bool CanUpAny => Run.Deck.Any(CanUp);

        public List<Option> EventOptions(string id)
        {
            var ev = EventData(id);
            var list = new List<Option>();
            var i = 0;
            foreach (var x in Json.Arr(Json.Get(ev, "options")))
            {
                var o = Json.Obj(x);
                var op = new Option
                {
                    K = i.ToString(), Text = Json.Str(Json.Get(o, "text")), Hint = Json.Str(Json.Get(o, "hint")),
                    Ad = Json.Bool(Json.Get(o, "ad")), Why = Json.Str(Json.Get(o, "why")),
                };
                op.Can = EventCan(id, i);
                list.Add(op);
                i++;
            }
            return list;
        }

        bool EventCan(string id, int i)
        {
            switch (id + ":" + i)
            {
                case "well:1": return Run.Gold >= 15;
                case "puppet:2": return Run.Gold >= 30;
                case "smith:1": case "smith:2": return CanUpAny;
                case "postoffice:2": return Run.Gold >= 35;
                default: return true;
            }
        }

        /// <summary>Ответ события. Text == null — ответ ведёт к выбору карты (Prompt); Fight — после ответа бой.</summary>
        public Outcome EventAct(string id, int i)
        {
            var r = Run;
            var o = new Outcome();
            string T(string s) => Loc.Tr(s);
            switch (id + ":" + i)
            {
                case "well:0": Heal(20); r.Gold += 15; o.Text = T("Колодец звякнул, вода засияла, и на сруб выкатились монетки."); break;
                case "well:1": r.Gold -= 15; Heal(10); o.Text = T("Вода засветилась тёплым светом. Тебе стало легче."); break;
                case "well:2":
                    if (R.Next() < 0.5) { GiveRandomCard("common"); o.Text = T("На дне блеснула карта. Ты {f|выловила|выловил} её ведром."); }
                    else { Damage(5); o.Text = T("Из колодца вылетела стая летучих мышей!"); }
                    break;
                case "well:3": o.Text = T("Ты {f|пошла|пошёл} дальше. Колодец обиженно булькнул."); break;

                case "puppet:0": Damage(6); GiveRandomCard("rare"); o.Text = T("Нитка больно дёрнула палец, но в руке осталась редкая карта."); break;
                case "puppet:1": GiveRandomCard("rare"); o.Text = T("Куклы раскланялись, и кукольник вручил тебе редкую карту."); break;
                case "puppet:2": r.Gold -= 30; GiveRelic(); o.Text = T("Кукла подмигнула и превратилась в талисман."); break;
                case "puppet:3": o.Text = T("Кукольник растворился в снегопаде."); break;

                case "lantern:0": Damage(4); GiveRelic(); o.Text = T("Пальцы замёрзли, но фонарь вспыхнул и подарил тебе талисман."); break;
                case "lantern:1": r.Deck.Add(r.Mk("spark")); o.Text = T("Огонёк запрыгнул в твою лампу."); break;

                case "snowman:0": Heal(12); o.Text = T("Вы болтали о звёздах. На душе потеплело."); break;
                case "snowman:1": o.Prompt = DeckPrompt.Remove; break;
                case "snowman:2": r.Gold += 25; r.MaxHp -= 1; r.Hp = Math.Min(r.Hp, r.MaxHp); o.Text = T("Снеговик отвернулся. Из-под него выкатились монетки."); break;

                case "coins:0":
                    r.Gold += 30;
                    if (R.Next() < 0.4) { o.Fight = "inkcat"; o.Text = T("Хозяин кошелька вернулся!"); }
                    else o.Text = T("Повезло: никто не заметил.");
                    break;
                case "coins:1": r.Gold += 60; o.Text = T("В свете фонаря нашлись все монетки до одной, а хозяин так и не пришёл."); break;
                case "coins:2": o.Text = T("Чужого не надо."); break;

                case "smith:0": o.Prompt = DeckPrompt.Upgrade; break;
                case "smith:1":
                {
                    var n = UpgradeRandom(3);
                    o.Text = T(n >= 3 ? "Снегирь трудился без отдыха, и три карты заблестели." : n > 0 ? "Снегирь наточил всё, что ещё не было наточено." : "Точить оказалось нечего.");
                    break;
                }
                case "smith:2":
                {
                    Damage(6);
                    var n = UpgradeRandom(2);
                    o.Text = T(n >= 2 ? "Руки в саже, зато две карты стали острее." : n > 0 ? "Снегирь наточил всё, что ещё не было наточено." : "Точить оказалось нечего.");
                    break;
                }
                case "smith:3": o.Text = T("Снегирь пожал плечами и снова раздул мехи."); break;

                case "postoffice:0": o.Prompt = DeckPrompt.Transform; break;
                case "postoffice:1":
                {
                    var ids = new[] { "parcel", "telegram", "surprise" };
                    r.Deck.Add(r.Mk(ids[(int)Math.Floor(R.Next() * 3)]));
                    o.Text = T("На посылке было твоё имя. Странно, но приятно.");
                    break;
                }
                case "postoffice:2": r.Gold -= 35; GiveRelic(); o.Text = T("Сова продала тебе марку. Она оказалась непростой."); break;

                case "icemirror:0": o.Prompt = DeckPrompt.Duplicate; o.PromptCost = 7; break;
                case "icemirror:1": r.Gold += 20; o.Text = T("Лёд треснул, и из него посыпались монетки."); break;
                case "icemirror:2": o.Text = T("Отражение помахало вслед."); break;

                case "showbooth:0": GiveRelic(); r.Gold += 20; o.Text = T("Картинки погасли, зрители захлопали, а балаганщик сунул тебе в руку подарок."); break;
                case "showbooth:1": o.Text = T("Из шатра доносились смех и музыка, но письмо не ждёт."); break;

                default: o.Text = ""; break;
            }
            if (o.Fight != null) o.Next = "fight";
            return o;
        }
    }
}
