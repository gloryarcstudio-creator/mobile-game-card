// Магазин (goStore в game.js) и окна тестовой покупки и тестового ролика (realBuy, realAd в js/store.js).
// Пока в проекте нет пакетов Unity IAP и рекламной сети, покупка открывается сразу, а вместо ролика идёт отсчёт:
// так же, как в тестовой веб-версии. Платформа (Fitil.Platform.Store) зовёт эти окна через TestBuyWindow и TestAdWindow.
// С пакетами покупки и ролики настоящие, а этот экран показывает цены площадки и её ответы.
using System;
using System.Collections;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace Fitil.Game
{
    public static class StoreScreen
    {
        static readonly Color Title = new Color32(0xFF, 0xE2, 0xA0, 0xFF);
        static readonly Color Soft = new Color(1, 1, 1, 0.72f);
        static readonly Color ItemBg = new Color32(0x24, 0x22, 0x36, 0xEE);

        /// <summary>Подключить окна тестовой покупки и ролика (один раз при запуске).</summary>
        public static void Install()
        {
            Store.TestBuyWindow = BuyWindow;
            Store.TestAdWindow = AdWindow;
            Store.Say = Hud.Toast;
            Store.Changed += () => { if (shown != null && shown.Item1) Show(shown.Item2); };
        }

        // открытый сейчас магазин: покупка, которая дошла позже (отложенная, восстановленная), перерисует его
        static Tuple<GameObject, Action> shown;

        // ================= магазин =================
        /// <summary>Магазин: платные герои по одному, все сразу и «Без рекламы». back — куда вернуться.</summary>
        public static void Show(Action back)
        {
            var win = Menus.Window(out var layer);
            shown = Tuple.Create(win, back);
            var col = Ui.Node("store", layer);
            col.anchorMin = Vector2.zero;
            col.anchorMax = Vector2.one;
            col.offsetMin = new Vector2(0, 12);
            col.offsetMax = new Vector2(0, -16);
            col.Column(8, TextAnchor.UpperCenter, 14, 14, 0, 0);
            Ui.Label("h2", col, Loc.Tr("Магазин"), 28, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f).Pref(372, 40);
            Ui.Label("sub", col, Loc.Tr("Поддержите почту Медовой Горки"), 15, Soft).Pref(372, 22);
            var list = Menus.ScrollList(col, 372);
            var data = Boot.Instance.Data;
            void Again() => Show(back);
            var paid = Store.PaidHeroes;
            foreach (var id in paid)
            {
                var h = data.Classes[id];
                var relic = Boot.Instance.Defs.Relics.TryGetValue(h.Relic ?? "", out var r) ? r.Desc : "";
                var row = Item(list, Head(h.Name) + "  <size=14><color=#FFF4D6>" + h.Role + "</color></size>\n<color=#FFD9A0>" + h.Build + "</color>\n" + relic);
                var face = Ui.CircleArt("face", row, Ui.Art("h/" + id + "_face"));
                face.Pref(64, 64);
                face.transform.SetAsFirstSibling();
                PriceOrOwned(row, "hero_" + id, Store.HeroOwned(data, id), Again);
            }
            var allHeroes = paid.TrueForAll(id => Store.HeroOwned(data, id));
            var pack = Item(list, Head(Loc.Tr("Все три героя")) + "\n" + Loc.Tr("Выгоднее, чем по одному"));
            var faces = Ui.Node("faces", pack);
            faces.Pref(64, 54);
            faces.SetAsFirstSibling();
            for (var i = 0; i < paid.Count && i < 3; i++)
            {
                var f = Ui.CircleArt("f", faces, Ui.Art("h/" + paid[i] + "_face"));
                f.rectTransform.Box(i * 16, 6 + (i % 2) * 8, 32, 32);
            }
            PriceOrOwned(pack, "heroes", allHeroes, Again);
            var noads = Item(list, Head(Loc.Tr("Без рекламы")) + "\n" + Loc.Tr("Бонусы событий и возрождение после поражения сразу, без роликов"));
            var ad = Ui.Img("ad", noads, "i/ad");
            ad.preserveAspect = true;
            ad.Pref(64, 54);
            ad.transform.SetAsFirstSibling();
            PriceOrOwned(noads, "noads", Store.NoAds, Again);
            if (Store.Test) Ui.Label("note", list, Loc.Tr("Тестовая версия: покупки не настоящие, деньги не списываются."), 13, Soft).Pref(356, 40);

            var btns = Ui.Node("btns", col);
            btns.Line(10, TextAnchor.MiddleCenter);
            btns.Pref(372, 52);
            Ui.Push(btns, Loc.Tr("Назад"), () => { Sound.Sfx("click"); back(); }, true, 18, 150, 48);
            Ui.Push(btns, Loc.Tr("Восстановить покупки"), () =>
            {
                Sound.Sfx("click");
                if (restoring) return;
                restoring = true;
                if (!Store.Test) Hud.Toast(Loc.Tr("Спрашиваем магазин…"));
                Store.Restore(n =>
                {
                    restoring = false;
                    Hud.Toast(n > 0 ? Loc.Tr("Покупки восстановлены: {n}", ("n", n)) : Loc.Tr("Покупок пока нет"));
                });
            }, true, 16, 210, 48);
            if (Store.Test)
            {
                var reset = Ui.Hit("reset", col, () => { Store.ResetTest(); Hud.Toast(Loc.Tr("Тестовые покупки сброшены")); Again(); });
                reset.Pref(372, 26);
                Ui.Label("t", reset.transform, Loc.Tr("Сбросить тестовые покупки"), 12, new Color(1, 1, 1, 0.45f)).rectTransform.Fill();
            }
        }

        static bool restoring, buyBusy;

        // название товара шрифтом заголовков (.stext b: 20, золотое)
        static string Head(string name) => "<size=20><color=#" + Ui.Hex(Ui.GoldHi) + "><b>" + name + "</b></color></size>";

        static RectTransform Item(RectTransform list, string text)
        {
            var bg = Ui.Round("sitem", list, ItemBg);
            bg.Dark();
            var rt = bg.rectTransform;
            rt.Line(10, TextAnchor.MiddleLeft, 12, 12, 12, 13);
            rt.Pref(360, -1, 79);
            var t = Ui.Label("text", rt, text, 13, new Color32(0xD8, 0xD0, 0xE4, 0xFF), TextAnchor.MiddleLeft);
            t.lineSpacing = 1.05f;
            t.Pref(168);
            return rt;
        }

        static void PriceOrOwned(RectTransform row, string id, bool owned, Action after)
        {
            if (owned)
            {
                Ui.Label("owned", row, Loc.Tr("Куплено") + " ✓", 15, new Color32(0x9F, 0xE0, 0x8A, 0xFF), TextAnchor.MiddleCenter, true).Pref(84);
                return;
            }
            // цена площадки бывает длинной («4 990,00 ₸»): шрифт меньше, чтобы влезла в кнопку
            var price = Store.PriceOf(id);
            Ui.Push(row, price, () => Buy(id, after), false, price.Length > 9 ? 12 : price.Length > 6 ? 14 : 19, 84, 50);
        }

        /// <summary>Купить товар (storeBuy): после покупки звук, сообщение и экран заново.</summary>
        public static void Buy(string id, Action after)
        {
            // пока окно площадки открыто, второе нажатие не начинает вторую покупку
            if (buyBusy) return;
            buyBusy = true;
            Sound.Sfx("click");
            Store.Buy(id, ok =>
            {
                buyBusy = false;
                if (ok)
                {
                    Sound.Sfx("relic");
                    Hud.Toast(Loc.Tr("Куплено: {name}", ("name", Store.Products.TryGetValue(id, out var p) ? p.Name : id)));
                }
                else if (Store.BuyNote != null) Hud.Toast(Store.BuyNote);
                after?.Invoke();
            });
        }

        // ================= тестовая покупка =================
        static void BuyWindow(Product p, Action<bool> done)
        {
            var layer = Overlay.Open(out var root);
            var col = Ui.Node("buy", root).Box(30, 250, 340, 300);
            col.Column(12, TextAnchor.MiddleCenter, 22, 22, 24, 24);
            col.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var frame = Ui.Frame(col, "ui2/panel", 0.494f, 2, 49, 2, 10);
            if (!frame.sprite) frame.color = new Color32(0x22, 0x1C, 0x30, 0xF5);
            Ui.Label("test", col, Loc.Tr("Тестовая покупка"), 13, Ui.Orange).Pref(290, 20);
            Ui.Label("name", col, p.Name, 22, Title, TextAnchor.MiddleCenter, true).Shadow(2f).Pref(290);
            Ui.Label("text", col, Loc.Tr("Цена {p}. Это тестовая версия: деньги не списываются, покупка просто откроется.", ("p", p.FallbackPrice)), 15, Ui.Paper).Pref(290);
            var answered = false;
            void Answer(bool ok)
            {
                if (answered) return;
                answered = true;
                Object.Destroy(layer);
                done?.Invoke(ok);
            }
            Ui.Push(col, Loc.Tr("Купить за {p}", ("p", p.FallbackPrice)), () => Answer(true), false, 20, 240, 52);
            Ui.Push(col, Loc.Tr("Отмена"), () => { Sound.Sfx("click"); Answer(false); }, true, 18, 160, 46);
        }

        // ================= тестовый ролик =================
        static void AdWindow(string reason, float seconds, Action<bool> done)
        {
            var layer = Overlay.Open(out var root);
            var col = Ui.Node("ad", root).Box(24, 190, 352, 420);
            col.Column(14, TextAnchor.UpperCenter, 20, 20, 22, 22);
            var bg = Ui.Round("bg", col, new Color32(0x10, 0x10, 0x18, 0xF8));
            bg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            bg.rectTransform.Fill();
            bg.Outline(new Color(1, 1, 1, 0.25f), 1.2f);
            Ui.Label("test", col, Loc.Tr("Реклама"), 14, Ui.Orange).Pref(300, 22);
            var screen = Ui.Round("screen", col, new Color32(0x2A, 0x2F, 0x4A, 0xFF));
            screen.Pref(312, 200);
            var t = Ui.Label("t", screen.transform, "<b>" + Loc.Tr("Здесь будет рекламный ролик") + "</b>\n\n<size=14>" + (reason ?? Loc.Tr("Награда после просмотра")) + "</size>", 18, Ui.Paper);
            t.rectTransform.Fill();
            t.rectTransform.offsetMin = new Vector2(16, 10);
            t.rectTransform.offsetMax = new Vector2(-16, -10);
            var foot = Ui.Node("foot", col);
            foot.Pref(300, 56);
            var answered = false;
            void Answer(bool ok)
            {
                if (answered) return;
                answered = true;
                Object.Destroy(layer);
                done?.Invoke(ok);
            }
            var x = Ui.Btn("close", col, "✕", () => { Sound.Sfx("click"); Answer(false); }, 20);
            x.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            ((RectTransform)x.transform).Box(304, 8, 40, 38);
            Boot.Instance.StartCoroutine(Countdown(foot, seconds, () => Answer(true)));
        }

        static IEnumerator Countdown(RectTransform foot, float seconds, Action take)
        {
            var left = Mathf.CeilToInt(seconds);
            var label = Ui.Label("timer", foot, "", 17, Ui.Paper);
            label.rectTransform.Fill();
            while (left > 0 && foot)
            {
                label.text = Loc.Tr("Награда через <b>{n}</b> с", ("n", left));
                yield return new WaitForSecondsRealtime(1);
                left--;
            }
            if (!foot) yield break;
            Object.Destroy(label.gameObject);
            var b = Ui.Push(foot, Loc.Tr("Забрать награду"), take, false, 20, 240, 52);
            ((RectTransform)b.transform).At(new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(240, 52));
        }
    }
}
