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
            // пузырь .bubble: ширина 168, высота по тексту; рамка с фонарём и хвостиком выступает сверху и снизу
            var bubble = Ui.Node("bubble", root).Box(166, 90, 168, 53);
            bubble.Column(0, TextAnchor.MiddleCenter, 13, 13, 9, 8);
            bubble.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            Ui.Frame(bubble, "ui2/bubble", 0.323f, 0, 17.8f, 0, 20.3f);
            var say = Ui.Label("say", bubble, Loc.Tr(shop.Rerolls > 0 ? "Свежий товар! Только что с саней." : last ? "Последняя лавка перед дверью! Бери, не стесняйся." : "Всё по-честному! Почти."), 16, Ui.Ink);
            say.Pref(142);

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
            var list = Ui.Node("services", root).Box(21, 404, 358, 300);
            list.Column(8, TextAnchor.UpperCenter);
            if (shop.Relic != null)
            {
                var r = defs.Relics[shop.Relic.Id];
                Service(list, "r2/" + r.Id, r.Name, r.Desc, shop.Relic, () => ShopAct(shop, last, () => G.BuyRelic(shop)), r.Tier ?? "common");
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

            var price = G.RerollPrice(shop).ToString();
            var reroll = Ui.Push(root, Loc.Tr("Обновить товар") + "       " + Coin(G.RerollPrice(shop)), () => ShopAct(shop, last, () => G.Reroll(shop)), true, 16, 190, 46);
            ((RectTransform)reroll.transform).Box(20, 714, 196, 42);
            // монета перед ценой, как в веб-версии: место под неё оставлено пробелами
            var rl = reroll.GetComponentInChildren<Text>();
            if (rl)
            {
                var set = rl.GetGenerationSettings(Vector2.zero);
                float W(string x) => rl.cachedTextGeneratorForLayout.GetPreferredWidth(x, set) / rl.pixelsPerUnit;
                var coinR = Ui.Img("coin", rl.transform, "i/coin");
                coinR.preserveAspect = true;
                coinR.rectTransform.anchorMin = coinR.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                coinR.rectTransform.sizeDelta = new Vector2(16, 16);
                coinR.rectTransform.anchoredPosition = new Vector2(W(rl.text) / 2 - W(price) - 12, 0);
            }
            var leave = Ui.Push(root, Loc.Tr("Уйти"), Next, false, 17, 130, 46);
            ((RectTransform)leave.transform).Box(262, 712, 104, 44);
        }

        static readonly Color Poor = new Color32(0xFF, 0x7A, 0x6A, 0xFF);   // .poor в веб-версии

        static string Coin(int n) => "<color=#FFE08A>" + n + "</color>";

        void Price(RectTransform root, ShopItem item, float cx, float y)
        {
            var plate = Ui.Round("price", root, new Color(0.08f, 0.09f, 0.15f, 0.62f)).Radius(12);
            plate.rectTransform.At(new Vector2(0, 1), new Vector2(cx, -(y + 13)), new Vector2(66, 26));
            var coin = Ui.Img("coin", plate.transform, "i/coin");
            coin.preserveAspect = true;
            coin.rectTransform.Box(6, 2, 22, 22);
            var t = Ui.Label("n", plate.transform, item.Price.ToString(), 18, Run.Gold < item.Price ? Poor : Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f);
            t.rectTransform.Box(30, 0, 36, 26);
            if (item.Sold) plate.gameObject.SetActive(false);
        }

        void Service(RectTransform list, string icon, string title, string desc, ShopItem item, Action buy, string tier = null)
        {
            // Плитка с окошком для значка (.svc в веб-версии): масштаб картинки .41, рамка выступает за края плитки.
            var row = Ui.Node("svc", list);
            row.Line(10, TextAnchor.MiddleLeft, 20, 18, 4, 4);
            row.Pref(358, -1, 60);
            Ui.Frame(row, "ui2/row2", 0.41f, 7.4f, 12.3f, 4.9f, 7f);
            var slot = Ui.Node("slot", row);
            slot.Pref(54, 42);
            var ic = Ui.Img("icon", slot, icon);
            ic.preserveAspect = true;
            ic.rectTransform.Fill();
            ic.rectTransform.offsetMin = new Vector2(5, 0);
            ic.rectTransform.offsetMax = new Vector2(-5, 0);
            if (tier == null)
            {
                var t = Ui.Label("text", row, "<color=#" + Ui.Hex(Ui.GoldHi) + ">" + title + "</color>\n<size=13>" + desc + "</size>", 15, Ui.Paper, TextAnchor.MiddleLeft).Shadow(1f);
                t.lineSpacing = 0.95f;
                t.Pref(208);
            }
            else
            {
                // талисман: за названием цветная метка редкости (.rtier)
                var col = Ui.Node("text", row);
                col.Column(0, TextAnchor.MiddleLeft);
                col.Pref(208);
                var nm = Ui.Label("name", col, title, 15, Ui.GoldHi, TextAnchor.MiddleLeft).Shadow(1f);
                nm.horizontalOverflow = HorizontalWrapMode.Overflow;
                nm.Pref(208, 19);
                Hud.TierTag(nm, 208, tier, Hud.TierLabel(tier));
                var ds = Ui.Label("desc", col, desc, 13, Ui.Paper, TextAnchor.UpperLeft).Shadow(1f);
                ds.lineSpacing = 0.95f;
                ds.Pref(208);
            }
            // цена: монета над числом
            var cost = Ui.Node("price", row);
            cost.Column(1, TextAnchor.MiddleCenter);
            cost.Pref(34);
            var coin = Ui.Img("coin", cost, "i/coin");
            coin.preserveAspect = true;
            coin.Pref(18, 18);
            var price = Ui.Label("n", cost, item.Price.ToString(), 18, Run.Gold < item.Price ? Poor : Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(1f);
            price.Pref(34, 20);
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
            var snore = chest.gameObject.AddComponent<ChestSnore>();
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
                msg.GetComponent<LayoutElement>().preferredWidth = Mathf.Min(320, msg.preferredWidth + 2);
                Ui.Clear(row);
                if (found != null)
                {
                    var r = Ui.Img("relic", p.Root, "r2/" + found);
                    r.preserveAspect = true;
                    r.rectTransform.Box(154, 248, 92, 92);
                }
                snore.Stop();
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
            var bg = Ui.Round("bg", plate, new Color(0.08f, 0.09f, 0.15f, 0.6f)).Radius(12);
            bg.rectTransform.Fill();
            bg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            // плашка по ширине текста, как в веб-версии; длинный текст переносится в пределах 320
            var t = Ui.Label("text", plate, text, 19, Ui.Paper).Shadow(2f);
            t.Pref(Mathf.Min(320, t.preferredWidth + 2));
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

namespace Fitil.Game
{
    /// <summary>Спящий сундук: дышит (snore, 2 с) и на каждый вдох пускает букву «z» (zrise в css/style.css).</summary>
    public sealed class ChestSnore : MonoBehaviour
    {
        RectTransform rt, z;
        Text label;
        float age;

        void Start()
        {
            rt = (RectTransform)transform;
            label = Ui.Label("z", rt, "z", 32, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleCenter, true).Shadow(2f);
            label.raycastTarget = false;
            z = label.rectTransform;
            z.anchorMin = z.anchorMax = new Vector2(0, 1);
            z.pivot = new Vector2(0.5f, 0.5f);
            z.sizeDelta = new Vector2(40, 40);
            Apply(0);
        }

        void Update()
        {
            age += Time.unscaledDeltaTime;
            Apply(age % 2f / 2f);
        }

        void Apply(float t)
        {
            // snore: к середине вдоха сундук чуть шире и ниже
            var b = Mathf.Sin(t * Mathf.PI);
            b *= b;
            rt.localScale = new Vector3(1 + 0.04f * b, 1 - 0.03f * b, 1);
            // zrise: буква ждёт до 28%, потом всплывает вправо вверх, растёт и тает
            var k = Mathf.Clamp01((t - 0.28f) / 0.72f);
            var e = 1 - (1 - k) * (1 - k);
            var a = t < 0.28f ? 0 : t < 0.42f ? (t - 0.28f) / 0.14f : t < 0.8f ? 1 - 0.15f * (t - 0.42f) / 0.38f : 0.85f * (1 - (t - 0.8f) / 0.2f);
            // left: 70%, top: 6% рамки 170×170; буква 32 px
            z.anchoredPosition = new Vector2(119 + 9 + 24 * e, -(10 + 16) - 10 + 60 * e);
            z.localScale = Vector3.one * Mathf.Lerp(0.5f, 1.15f, e);
            z.localRotation = Quaternion.Euler(0, 0, -Mathf.Lerp(-8, 10, e));
            var c = label.color; c.a = a; label.color = c;
        }

        public void Stop()
        {
            if (rt) rt.localScale = Vector3.one;
            if (label) Destroy(label.gameObject);
            Destroy(this);
        }
    }
}

