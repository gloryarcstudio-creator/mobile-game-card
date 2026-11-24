// Лавка, сундук и костёр (goShop, goChest, goRest в game.js).
using System;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed partial class RunFlow
    {
        // ================= лавка =================
        void Shop(bool last) => ShopScreen(G.NewShop(), last);

        void ShopScreen(ShopState shop, bool last, bool happy = false)
        {
            Save(new Pending { T = "shop", Shop = shop, Last = last });
            if (shop.Relic != null) Progress.Codex("r", shop.Relic.Id);
            var p = Open("shop");
            Bars(p);
            var root = p.Root;

            // ёж за прилавком и его слова
            var keeperBox = Ui.Node("keeper", root).Box(20, 60, 140, 130);
            var keeper = Ui.Img("hedgehog", keeperBox, "e/hedgehog");
            EnemyAnim.Stand(keeper, "hedgehog", 130);
            p.Bg.StandOn(keeperBox);
            var keeperLive = EnemyAnim.Make(keeperBox, "hedgehog");
            if (keeperLive)
            {
                keeper.enabled = false;
                if (happy) keeperLive.Play("happy");   // ёж радуется покупке
            }
            var bubble = Ui.Node("bubble", root).Box(166, 84, 208, 66);
            bubble.Column(0, TextAnchor.MiddleCenter, 18, 18, 9, 8);
            Ui.Frame(bubble, "ui2/bubble", 0.3f);
            var say = Ui.Label("say", bubble, Loc.Tr(shop.Rerolls > 0 ? "Свежий товар! Только что с саней." : last ? "Последняя лавка перед дверью! Бери, не стесняйся." : "Всё по-честному! Почти."), 16, Ui.Ink);
            say.Pref(174);

            // три карты на прилавке
            const float cw = 108;
            for (var i = 0; i < shop.Cards.Count; i++)
            {
                var item = shop.Cards[i];
                var k = i;
                var x = 200 - (shop.Cards.Count * cw + (shop.Cards.Count - 1) * 12) / 2 + i * (cw + 12);
                var v = CardView.Make(root, new CardInst { Id = item.Id }, defs, null, cw);
                var rt = v.Rect;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.anchoredPosition = new Vector2(x + cw / 2, -(196 + cw * CardView.Ratio / 2));
                var cg = v.gameObject.AddComponent<CanvasGroup>();
                if (item.Sold) { cg.alpha = 0.25f; cg.blocksRaycasts = false; }
                var catcher = v.gameObject.AddComponent<Image>();
                catcher.color = new Color(0, 0, 0, 0);
                var b = v.gameObject.AddComponent<Button>();
                b.transition = Selectable.Transition.None;
                b.onClick.AddListener(() => ShopAct(shop, last, () => G.BuyCard(shop, k)));
                Price(root, item, x + cw / 2, 210 + cw * CardView.Ratio);
            }

            // талисман и услуги
            var list = Ui.Node("services", root).Box(18, 393, 364, 300);
            list.Column(8, TextAnchor.UpperCenter);
            if (shop.Relic != null)
            {
                var r = defs.Relics[shop.Relic.Id];
                Service(list, "r2/" + r.Id, r.Name, r.Desc, shop.Relic, () => ShopAct(shop, last, () => G.BuyRelic(shop)));
            }
            var tea = Math.Min(12, Run.MaxHp - Run.Hp);
            Service(list, "r2/thermos", Loc.Tr("Горячий сбитень"), Loc.Tr("Восстановить {n} HP", ("n", tea > 0 ? tea : 12)), shop.Tea, () => ShopAct(shop, last, () => G.BuyTea(shop) >= 0));
            Service(list, "r2/whetstone", Loc.Tr("лавка::Заточка"), Loc.Tr("Улучшить карту"), shop.Up, () =>
            {
                if (!G.CanAfford(shop.Up)) { Sound.Sfx("deny"); Hud.Flush(G); return; }
                Prompt(DeckPrompt.Upgrade, 0, ok => { if (ok) G.PayService(shop.Up); ShopScreen(shop, last, ok); });
            });
            Service(list, "i/scissors", Loc.Tr("Распустить карту"), Loc.Tr("Убрать карту из колоды"), shop.Remove, () =>
            {
                if (!G.CanAfford(shop.Remove)) { Sound.Sfx("deny"); Hud.Flush(G); return; }
                Prompt(DeckPrompt.Remove, 0, ok => { if (ok) G.PayService(shop.Remove); ShopScreen(shop, last, ok); });
            });

            var reroll = Ui.Push(root, Loc.Tr("Обновить товар") + "  " + Coin(G.RerollPrice(shop)), () => ShopAct(shop, last, () => G.Reroll(shop)), true, 16, 190, 46);
            ((RectTransform)reroll.transform).Box(20, 714, 196, 42);
            var leave = Ui.Push(root, Loc.Tr("Уйти"), Next, false, 17, 130, 46);
            ((RectTransform)leave.transform).Box(262, 712, 104, 44);
        }

        static string Coin(int n) => "<color=#FFE08A>" + n + "</color>";

        void Price(RectTransform root, ShopItem item, float cx, float y)
        {
            var plate = Ui.Round("price", root, new Color(0.08f, 0.09f, 0.15f, 0.62f));
            plate.rectTransform.At(new Vector2(0, 1), new Vector2(cx, -(y + 13)), new Vector2(66, 26));
            var coin = Ui.Img("coin", plate.transform, "i/coin");
            coin.preserveAspect = true;
            coin.rectTransform.Box(6, 2, 22, 22);
            var t = Ui.Label("n", plate.transform, item.Price.ToString(), 18, Run.Gold < item.Price ? Ui.Red : Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f);
            t.rectTransform.Box(30, 0, 36, 26);
            if (item.Sold) plate.gameObject.SetActive(false);
        }

        void Service(RectTransform list, string icon, string title, string desc, ShopItem item, Action buy)
        {
            var row = Ui.Node("svc", list);
            row.Line(10, TextAnchor.MiddleLeft, 12, 12, 5, 5);
            row.Pref(364, -1, 60);
            Ui.Frame(row, "ui2/row2", 0.3f);
            var ic = Ui.Img("icon", row, icon);
            ic.preserveAspect = true;
            ic.Pref(38, 38);
            var t = Ui.Label("text", row, "<color=#" + Ui.Hex(Ui.GoldHi) + ">" + title + "</color>\n<size=13>" + desc + "</size>", 15, Ui.Paper, TextAnchor.MiddleLeft).Shadow(1f);
            t.lineSpacing = 0.95f;
            t.Pref(234);
            var price = Ui.Label("price", row, item.Price.ToString(), 18, Run.Gold < item.Price ? Ui.Red : Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(1f);
            price.Pref(40);
            var hit = row.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            var b = row.gameObject.AddComponent<Button>();
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => buy());
            if (item.Sold) { var cg = row.gameObject.AddComponent<CanvasGroup>(); cg.alpha = 0.3f; cg.blocksRaycasts = false; }
        }

        /// <summary>Покупка: logic — действие лавки (false — не вышло, сообщение уже в Notes), потом экран заново.</summary>
        void ShopAct(ShopState shop, bool last, Func<bool> logic)
        {
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            var ok = logic();
            if (!ok) { Sound.Sfx("deny"); Hud.Flush(G); return; }
            Sound.Sfx(Run.Hp > hp0 ? "heal" : "coin");
            ShopScreen(shop, last, Run.Gold < gold0);
            Hud.Gain(page.Bar, Run.Hp - hp0, 0);
            Hud.Flush(G);
        }

        // ================= сундук =================
        void Chest()
        {
            var p = Open();
            Bars(p);
            var chest = Ui.Img("chest", p.Root, "i/chest2");
            chest.preserveAspect = true;
            chest.rectTransform.Box(115, 428, 170, 170);   // .chest-wrap { padding-top: 428px }: сундук стоит на снегу перед домами
            p.Bg.StandOn(chest.rectTransform);
            var msg = Plate(p.Root, Loc.Tr("Сундук-соня сладко храпит."), 612);
            var row = Ui.Node("row", p.Root).Box(0, 650, 400, 56);
            row.Line(14, TextAnchor.MiddleCenter);
            Ui.Push(row, Loc.Tr("Открыть"), () =>
            {
                var gold0 = Run.Gold;
                var found = G.OpenChest(out var text);
                Save(P("next"));
                // из сундука вылетает то, что в нём лежало: горка монет или звёзды находки
                Hud.FxOn(p.Root).PlayAt(found != null ? "find" : "loot", 200, 507, 170, 170, 513 + 170 * 0.3f);
                msg.text = text;
                Ui.Clear(row);
                if (found != null)
                {
                    var r = Ui.Img("relic", p.Root, "r2/" + found);
                    r.preserveAspect = true;
                    r.rectTransform.Box(154, 248, 92, 92);
                }
                chest.color = new Color(1, 0.95f, 0.8f);
                After(p, Run.Hp, gold0);
                Ui.Push(row, Loc.Tr("Дальше"), Next, false, 20, 160, 50);
            }, false, 20, 150, 50);
            Ui.Push(row, Loc.Tr("Не будить"), Next, true, 18, 150, 50);
        }

        /// <summary>Строка текста на тёмной плашке посреди экрана (.chest-wrap p, .fire-wrap p).</summary>
        static Text Plate(RectTransform root, string text, float y)
        {
            var box = Ui.Node("say", root).Box(20, y, 360, 60);
            box.Column(0, TextAnchor.UpperCenter);
            var plate = Ui.Node("plate", box);
            plate.Column(0, TextAnchor.MiddleCenter, 14, 14, 3, 4);
            var bg = Ui.Round("bg", plate, new Color(0.08f, 0.09f, 0.15f, 0.6f));
            bg.rectTransform.Fill();
            bg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var t = Ui.Label("text", plate, text, 19, Ui.Paper).Shadow(2f);
            t.Pref(320);
            return t;
        }

        // ================= костёр =================
        void Rest(bool last)
        {
            var p = Open("rest");
            Bars(p);
            var final = defs.IsFinalStep(Run.Step) && G.MainStory;
            var talk = Loc.Tr("Костёр потрескивает. Снег вокруг тает.");
            if (final)
            {
                var fr = G.FriendsOf();
                var fb = G.FinalBoss();
                talk = fr.Count > 0
                    ? Loc.Tr("К костру подсели друзья:") + "\n" + string.Join("\n", fr.Select(h => "<i>" + Loc.Tr(Json.Str(Json.Get(G.Lore.Friend(h), "line"))) + "</i> <size=14>" + Loc.Tr(Json.Str(Json.Get(G.Lore.Friend(h), "bonus"))) + "</size>"))
                    : Loc.Tr("У костра тихо. Только ты и последний огонь перед дверью.");
                var dark = fb.StartsWith("dk_") ? defs.Enemies[fb].Dark : null;
                if (dark != null) talk += "\n" + Loc.Tr("За деревьями мелькнула знакомая фигура: {name}. Но тень на ней гуще ночи.", ("name", defs.Data.Classes[dark].Name));
            }
            var msg = Plate(p.Root, talk, final ? 150 : 218);
            msg.fontSize = final ? 17 : 19;
            var col = Ui.Node("scrolls", p.Root).Box(0, final ? 470 : 280, 400, 470);
            col.Column(13, TextAnchor.UpperCenter);
            var noHeal = !G.CanRestHeal;
            Ui.Scroll(col, Loc.Tr("Отдохнуть"), noHeal ? Loc.Tr("Бездонная сумка не даёт присесть") : G.RestText(), () =>
            {
                var hp0 = Run.Hp;
                G.Rest();
                Save(P("next"));
                After(p, hp0, Run.Gold);
                Ui.Clear(col);
                Delay(0.8f, Next);
            }, noHeal);
            Ui.Scroll(col, Loc.Tr("Наточить карту"), Loc.Tr("Улучшить карту"), () => Prompt(DeckPrompt.Upgrade, 0, ok => { if (ok) { Save(P("next")); AfterPrompt(DeckPrompt.Upgrade, Next); } }));
            Ui.Scroll(col, Loc.Tr("Сжечь карту"), Loc.Tr("Убрать карту из колоды"), () => Prompt(DeckPrompt.Remove, 0, ok => { if (ok) { Save(P("next")); AfterPrompt(DeckPrompt.Remove, Next); } }));
        }
    }
}
