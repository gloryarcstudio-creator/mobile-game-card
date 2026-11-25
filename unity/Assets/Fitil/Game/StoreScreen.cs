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
            var list = Menus.ScrollList(col, 378);
            var data = Boot.Instance.Data;
            void Again() => Show(back);
            var paid = Store.PaidHeroes;
            foreach (var id in paid)
            {
                var h = data.Classes[id];
                var relic = Boot.Instance.Defs.Relics.TryGetValue(h.Relic ?? "", out var r) ? r.Desc : "";
                var row = Item(list, out var text);
                // портрет на цветном фоне героя (.sitem .cp 64×76)
                Ui.Portrait("face", row, id, 64, 76).Pref(64, 76);
                text.SetAsLastSibling();
                var head = Ui.Node("head", text);
                head.Line(6, TextAnchor.LowerLeft);
                Ui.Label("name", head, h.Name, 20, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(1f);
                Ui.Label("role", head, h.Role, 14, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.LowerLeft);
                // чем силён герой: красная плашка (.stext em)
                var tag = Ui.Round("build", text, new Color32(0x8A, 0x2A, 0x24, 0xFF)).Outline(Ui.Ink, 1f);
                tag.rectTransform.Line(0, TextAnchor.MiddleCenter, 7, 7, 1, 2);
                Ui.Label("t", tag.transform, h.Build, 13, new Color32(0xFF, 0xF4, 0xD6, 0xFF));
                Desc(text, relic);
                PriceOrOwned(row, "hero_" + id, Store.HeroOwned(data, id), Again);
            }
            var allHeroes = paid.TrueForAll(id => Store.HeroOwned(data, id));
            var pack = Item(list, out var packText);
            var faces = Ui.Node("faces", pack);
            faces.Pref(64, 38);
            for (var i = 0; i < paid.Count && i < 3; i++)
                Ui.Portrait("f", faces, paid[i], 30, 38).rectTransform.Box(i * 22 - (Math.Min(paid.Count, 3) * 22 + 8 - 64) / 2f, 0, 30, 38);
            packText.SetAsLastSibling();
            Ui.Label("name", packText, Loc.Tr("Все три героя"), 19, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(1f);
            Desc(packText, Loc.Tr("Выгоднее, чем по одному"));
            PriceOrOwned(pack, "heroes", allHeroes, Again);
            var noads = Item(list, out var adText);
            var ad = Ui.Img("ad", noads, "i/ad");
            ad.preserveAspect = true;
            ad.Pref(64, 54);
            adText.SetAsLastSibling();
            Ui.Label("name", adText, Loc.Tr("Без рекламы"), 20, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(1f);
            Desc(adText, Loc.Tr("Бонусы событий и возрождение после поражения сразу, без роликов"));
            PriceOrOwned(noads, "noads", Store.NoAds, Again);
            if (Store.Test) Ui.Label("note", list, Loc.Tr("Тестовая версия: покупки не настоящие, деньги не списываются."), 13, Soft).Pref(366, 40);

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

        const float TextW = 174;

        /// <summary>Плитка товара (.sitem): слева картинка, столбик текста, справа цена. Возвращает плитку и столбик.</summary>
        static RectTransform Item(RectTransform list, out RectTransform text)
        {
            var bg = Ui.Round("sitem", list, ItemBg);
            bg.Dark();
            var rt = bg.rectTransform;
            rt.Line(10, TextAnchor.MiddleLeft, 12, 12, 12, 13);
            rt.Pref(366, -1, 79);
            text = Ui.Node("text", rt);
            text.Column(4, TextAnchor.MiddleLeft);
            text.Pref(TextW);
            return rt;
        }

        static void Desc(RectTransform text, string words)
        {
            var t = Ui.Label("desc", text, words, 13, new Color32(0xD8, 0xD0, 0xE4, 0xFF), TextAnchor.UpperLeft);
            t.lineSpacing = 1.05f;
            t.Pref(TextW);
        }

        static void PriceOrOwned(RectTransform row, string id, bool owned, Action after)
        {
            if (owned)
            {
                Ui.Label("owned", row, Loc.Tr("Куплено") + " ✓", 16, new Color32(0x8D, 0xE0, 0x8F, 0xFF), TextAnchor.MiddleCenter, true).Pref(84);
                return;
            }
            // зелёная кнопка цены (.btn.price). Цена площадки бывает длинной («4 990,00 ₸»): шрифт меньше, чтобы влезла
            var price = Store.PriceOf(id);
            var bg = Ui.Round("price", row, new Color32(0x3F, 0x82, 0x45, 0xFF)).Outline(Ui.Ink, 1.5f);
            bg.Pref(84, 44);
            bg.raycastTarget = true;
            var shine = Ui.Round("shine", bg.transform, new Color(1, 1, 1, 0.12f));
            shine.rectTransform.Fill();
            shine.rectTransform.offsetMin = new Vector2(2, 22);
            shine.rectTransform.offsetMax = new Vector2(-2, -2);
            var b = bg.gameObject.AddComponent<Button>();
            b.targetGraphic = bg;
            b.onClick.AddListener(() => Buy(id, after));
            var t = Ui.Label("label", bg.transform, price, price.Length > 9 ? 12 : price.Length > 6 ? 14 : 19, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow();
            t.rectTransform.Fill();
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
