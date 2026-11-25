// Выбор героя и сложности перед забегом (goClassSelect в game.js): восемь героев плиткой, выбранный герой
// в полный рост с HP, монетами, стилем игры и историей, его особенность (талисман), его карты, сложность
// стрелками и точками. Платный герой без покупки открывается здесь же или в магазине.
using System;
using System.Linq;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class HeroSelect : MonoBehaviour
    {
        RectTransform root, back, info, bottom;
        GameData data;
        Defs defs;
        Action<string, int> go;
        Action cancel;
        string current;
        int diff;
        RectTransform grid;

        public static HeroSelect Show(GameData data, Defs defs, string cls, int diff, Action<string, int> go, Action cancel)
        {
            var o = new GameObject("HeroSelect");
            o.transform.SetParent(Boot.Instance.transform, false);
            var s = o.AddComponent<HeroSelect>();
            s.data = data;
            s.defs = defs;
            s.go = go;
            s.cancel = cancel;
            s.diff = Mathf.Clamp(diff, 0, data.Difficulties.Count - 1);
            s.Build(data.Classes.ContainsKey(cls ?? "") ? cls : "lamp");
            return s;
        }

        void OnEnable() => Store.Changed += Refresh;
        void OnDisable() => Store.Changed -= Refresh;

        // герой открылся (покупка здесь, в магазине или дошла отложенная): замок снять, кнопка «В путь»
        void Refresh()
        {
            if (this && root && current != null) Pick(current);
        }

        void OnDestroy()
        {
            if (root) Destroy(root.gameObject);
            if (back) Destroy(back.gameObject);
        }

        void Build(string first)
        {
            back = Ui.Node("heroes back", Boot.Instance.Back).Fill();
            Boot.Background(back, "bg/bg_title");
            var dim = Ui.Img("dim", back, null, new Color(0.04f, 0.05f, 0.1f, 0.6f));
            dim.rectTransform.Fill();

            root = Ui.Node("heroes", Boot.Instance.Safe).Fill();
            var title = Ui.Label("title", root, Loc.Tr("Кто понесёт письмо?"), 27, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            title.rectTransform.Box(0, 10, 400, 36);
            var sub = Ui.Label("sub", root, Loc.Tr("У каждого героя свой путь к победе"), 14, new Color(1, 1, 1, 0.75f)).Shadow(1f);
            sub.rectTransform.Box(0, 44, 400, 20);

            // размеры и места — как у .clsrow, .clsinfo, .clsrelic, .clscards, .diffbox и .clsbtns в веб-версии
            grid = Ui.Node("grid", root).Box(11, 75, 378, 205);
            info = Ui.Node("info", root).Box(14, 282, 372, 358);
            bottom = Ui.Node("bottom", root).Box(0, 860 - 214, 400, 214, 0);   // сложность и кнопки — у нижнего края
            Pick(first);
        }

        void Tiles()
        {
            Ui.Clear(grid);
            var i = 0;
            foreach (var kv in data.Classes)
            {
                var h = kv.Value;
                var owned = Store.HeroOwned(data, h.Id);
                var on = h.Id == current;
                var tile = Ui.Hit("hero " + h.Id, grid, () => { Sound.Sfx("click"); Pick(h.Id); });
                var rt = (RectTransform)tile.transform;
                rt.Box((i % 4) * 96, (i / 4) * 103, 90, 97);
                var plate = Ui.Round("plate", rt, on ? (Color)new Color32(0x5A, 0x40, 0x22, 0xEE) : new Color32(20, 24, 38, 200));
                plate.rectTransform.Fill();
                if (on) plate.Outline(Ui.Gold, 1.5f);
                // портрет на цветном фоне героя (.clscard .cp: во всю ширину плитки, высота 60)
                var face = Ui.Portrait("face", rt, h.Id, 78, 58);
                face.rectTransform.Box(6, 5, 78, 58);
                if (!owned)
                {
                    foreach (var g in face.GetComponentsInChildren<Image>()) if (g != face) g.color = new Color(0.45f, 0.45f, 0.5f);
                    var lockIc = Ui.Img("lock", rt, "i/lock");
                    lockIc.preserveAspect = true;
                    lockIc.rectTransform.Box(58, 36, 26, 26);
                }
                var name = Ui.Label("name", rt, h.Name, 16, on ? Ui.GoldHi : owned ? (Color)new Color32(0xD8, 0xD0, 0xE4, 0xFF) : new Color(0.75f, 0.75f, 0.8f), TextAnchor.MiddleCenter, true).Shadow().Fit(9);
                name.rectTransform.Box(2, 68, 86, 24);
                i++;
            }
        }

        void Pick(string id)
        {
            current = id;
            Tiles();
            Ui.Clear(info);
            Ui.Clear(bottom);
            var h = data.Classes[id];
            var owned = Store.HeroOwned(data, id);
            var d = data.Difficulties[diff];

            // рамка с героем слева и рассказом о нём справа (.clsinfo 372×180)
            var card = Ui.Round("card", info, new Color32(0x24, 0x1E, 0x36, 0xF5));
            card.rectTransform.Box(0, 0, 372, 180);
            card.Dark();
            var big = Ui.Round("big", info, new Color32(0x4A, 0x3F, 0x7A, 0xFF));
            big.rectTransform.Box(12, 10, 128, 160);
            big.Outline(Ui.Gold, 1.5f);
            var grad = Ui.Img("grad", big.transform, Ui.HeroBg(id), Color.white);
            grad.rectTransform.Fill();
            grad.rectTransform.offsetMin = new Vector2(2, 2);
            grad.rectTransform.offsetMax = new Vector2(-2, -2);
            var body = Ui.Img("body", big.transform, "h/" + id);
            body.preserveAspect = true;
            body.rectTransform.Fill();
            body.rectTransform.offsetMin = new Vector2(4, 4);
            body.rectTransform.offsetMax = new Vector2(-4, -4);
            var name = Ui.Label("name", info, h.Name, 26, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(2f);
            name.rectTransform.Box(152, 8, 208, 30);
            var role = Ui.Label("role", info, h.Role, 15, new Color32(0xE8, 0xDC, 0xC0, 0xFF), TextAnchor.MiddleLeft);
            role.rectTransform.Box(152, 37, 208, 18);
            // HP с поправкой сложности, как в забеге (v157)
            Stat(info, "i/heart", (h.Hp + d.HeroHp) + " HP", 152, 60);
            Stat(info, "i/coin", h.Gold.ToString(), 240, 60);
            // чем силён герой: красная плашка (.clsbuild)
            var tag = Ui.Round("build", info, new Color32(0x8A, 0x2A, 0x24, 0xFF));
            tag.Outline(Ui.Ink, 1f);
            var build = Ui.Label("t", tag.transform, h.Build, 15, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleCenter, true);
            var tw = Mathf.Min(208, build.preferredWidth + 20);
            tag.rectTransform.Box(152, 92, tw, 26);
            build.rectTransform.Fill();
            build.Fit(10);
            var about = Ui.Label("about", info, h.About ?? h.Who ?? "", 15, Ui.Paper, TextAnchor.UpperLeft).Shadow(1f);
            about.rectTransform.Box(152, 124, 208, 50);
            about.Fit(10);

            // особенность героя: его талисман (.clsrelic 372×92)
            if (h.Relic != null && defs.Relics.TryGetValue(h.Relic, out var r))
            {
                var row = Ui.Round("relic", info, new Color32(0x14, 0x11, 0x1E, 0xEB));
                row.rectTransform.Box(0, 186, 372, 92);
                row.Dark();
                var ic = Ui.Img("ic", row.transform, "r2/" + h.Relic);
                ic.preserveAspect = true;
                ic.rectTransform.Box(13, 23, 46, 46);
                var t = Ui.Label("t", row.transform, "<size=12><color=#C9C0D8>" + Loc.Tr("Особенность").ToUpperInvariant() + "</color></size>\n<b><size=17>" + r.Name + "</size></b>\n" + r.Desc, 15, Ui.Paper, TextAnchor.MiddleLeft);
                t.rectTransform.Box(69, 6, 292, 80);
                t.Fit(10);
            }
            // карты героя
            var own = defs.Cards.Values.Where(c => c.Cls == id).ToList();
            var cardsBtn = Ui.Push(info, "", () => { Sound.Sfx("click"); ShowCards(id); }, true, 17, 372, 74);
            ((RectTransform)cardsBtn.transform).Box(0, 284, 372, 74);
            var cl = cardsBtn.GetComponentInChildren<Text>();
            Ui.TwoLines(cl, Loc.Tr("Карты героя") + "  ›", string.Join(", ", own.Select(c => c.Name)), 20, 13);

            Difficulty();
            Buttons(owned);
        }

        static void Stat(RectTransform parent, string icon, string text, float x, float y)
        {
            var ic = Ui.Img("ic", parent, icon);
            ic.preserveAspect = true;
            ic.rectTransform.Box(x, y + 2, 22, 22);
            Ui.Label("v", parent, text, 17, Ui.Paper, TextAnchor.MiddleLeft, true).Shadow(1f).rectTransform.Box(x + 26, y, 70, 26);
        }

        /// <summary>Сложность: стрелки, «Сложность a из b», название (✓ — уже побеждена), точки и подсказка.</summary>
        void Difficulty()
        {
            var n = data.Difficulties.Count;
            var d = data.Difficulties[diff];
            var box = Ui.Round("diffbox", bottom, new Color32(0x14, 0x14, 0x22, 0xDC));
            box.rectTransform.Box(14, 0, 372, 119);
            box.Dark();
            var won = Progress.Has("winsDiff", (double)diff);
            var head = Ui.Label("head", box.transform, "<size=12><color=#C9C0D8>" + Loc.Tr("Сложность {a} из {b}", ("a", diff + 1), ("b", n)) + "</color></size>\n" + d.Name + (won ? " <color=#9FE08A>✓</color>" : ""), 21, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(1f);
            head.rectTransform.Box(56, 8, 260, 50);
            Arrow(box.rectTransform, "‹", 13, diff > 0, () => SetDiff(diff - 1));
            Arrow(box.rectTransform, "›", 319, diff < n - 1, () => SetDiff(diff + 1));
            var pipW = 44f;
            var x0 = 186 - (n * pipW + (n - 1) * 8) / 2;
            for (var i = 0; i < n; i++)
            {
                var k = i;
                var pip = Ui.Hit("pip", box.transform, () => SetDiff(k));
                ((RectTransform)pip.transform).Box(x0 + i * (pipW + 8), 57, pipW, 16);
                var bar = Ui.Round("bar", pip.transform, i <= diff ? (Color)new Color32(0xD9, 0xA8, 0x4A, 0xFF) : new Color32(0x3A, 0x36, 0x4C, 0xFF));
                bar.rectTransform.Box(0, 4, pipW, 8);
                if (Progress.Has("winsDiff", (double)i)) bar.Outline(new Color32(0x9F, 0xE0, 0x8A, 0xFF), 1.2f);
            }
            var hint = Ui.Label("hint", box.transform, d.Hint, 14, new Color(1, 1, 1, 0.78f));
            hint.rectTransform.Box(13, 74, 346, 40);
            hint.Fit(9);
        }

        void Arrow(RectTransform box, string text, float x, bool on, Action act)
        {
            var b = Ui.Btn("arrow", box, text, () => { if (on) { Sound.Sfx("click"); act(); } }, 26);
            ((RectTransform)b.transform).Box(x, 15, 40, 40);
            b.interactable = on;
        }

        void SetDiff(int d)
        {
            diff = Mathf.Clamp(d, 0, data.Difficulties.Count - 1);
            Pick(current);
        }

        void Buttons(bool owned)
        {
            var row = Ui.Node("btns", bottom).Box(0, 142, 400, 62);
            row.Line(10, TextAnchor.MiddleCenter);
            Ui.Push(row, Loc.Tr("Назад"), () => { Sound.Sfx("click"); cancel?.Invoke(); }, true, 18, 110, 50);
            if (owned)
            {
                Ui.Push(row, Loc.Tr("В путь"), () => { Sound.Sfx("click"); go?.Invoke(current, diff); }, false, 28, 164, 62);
                return;
            }
            var price = Store.PriceOf("hero_" + current);
            var cls = current;
            Ui.Push(row, Loc.Tr("герой::Открыть") + "\n<size=13>" + price + "</size>", () => StoreScreen.Buy("hero_" + cls, () => { if (this) Pick(cls); }), false, 19, 140, 58);
            Ui.Push(row, Loc.Tr("Магазин"), () =>
            {
                Sound.Sfx("click");
                StoreScreen.Show(() => { Menus.Close(); if (this) Pick(cls); });
            }, true, 17, 110, 50);
        }

        /// <summary>Свои карты героя, его талисманы и стартовая колода (showClassCards).</summary>
        void ShowCards(string id)
        {
            var h = data.Classes[id];
            Menus.Window(out var layer);
            var col = Ui.Node("cards", layer);
            col.anchorMin = Vector2.zero;
            col.anchorMax = Vector2.one;
            col.offsetMin = new Vector2(0, 12);
            col.offsetMax = new Vector2(0, -16);
            col.Column(8, TextAnchor.UpperCenter, 14, 14, 0, 0);
            Ui.Label("h2", col, h.Name + " · " + h.Role, 24, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f).Pref(372, 36);
            var list = Menus.ScrollList(col, 372);
            void Hint(string t) => Ui.Label("hint", list, t, 14, new Color(1, 1, 1, 0.75f)).Pref(356, 36);
            void Cards(System.Collections.Generic.List<CardInst> cards)
            {
                const float w = 84, gap = 6;
                for (var i = 0; i < cards.Count; i += 4)
                {
                    var line = Ui.Node("line", list);
                    line.Line(gap, TextAnchor.MiddleLeft);
                    line.Pref(356, w * CardView.Ratio);
                    foreach (var c in cards.Skip(i).Take(4))
                    {
                        var slot = Ui.Node("slot", line);
                        slot.Pref(w, w * CardView.Ratio);
                        var v = CardView.Make(slot, c, defs, null, w);
                        var vr = v.Rect;
                        vr.anchorMin = vr.anchorMax = new Vector2(0.5f, 0.5f);
                        vr.anchoredPosition = Vector2.zero;
                    }
                }
            }
            Hint(Loc.Tr("Свои карты: выпадают в наградах и лавке только этому герою"));
            Cards(defs.Cards.Values.Where(c => c.Cls == id).Select(c => new CardInst { Id = c.Id }).ToList());
            Hint(Loc.Tr("Особенность и свой талисман: он выпадает только этому герою"));
            var relics = new[] { h.Relic }.Concat(defs.Relics.Values.Where(r => r.Cls == id).Select(r => r.Id)).Where(r => r != null && defs.Relics.ContainsKey(r));
            foreach (var rid in relics)
            {
                var r = defs.Relics[rid];
                var row = Ui.Round("rrow", list, new Color32(0x26, 0x2D, 0x45, 0xEE));
                var rt = row.rectTransform;
                rt.Line(10, TextAnchor.MiddleLeft, 8, 10, 6, 6);
                rt.Pref(356, -1, 54);
                var ic = Ui.Img("icon", rt, "r2/" + rid);
                ic.preserveAspect = true;
                ic.Pref(42, 42);
                var tag = rid == h.Relic ? Loc.Tr("Особенность") : Loc.Tr("Особенность героя");
                Ui.Label("text", rt, "<b>" + r.Name + "</b>  <size=11><color=#C9C0D8>" + tag + "</color></size>\n<size=13>" + r.Desc + "</size>", 16, Ui.Paper, TextAnchor.MiddleLeft).Pref(286);
            }
            Hint(Loc.Tr("Стартовая колода") + " · " + h.Deck.Count);
            Cards(h.Deck.Select(k => new CardInst { Id = k }).ToList());
            Ui.Push(col, Loc.Tr("Закрыть"), () => { Sound.Sfx("click"); Menus.Close(); }, true, 18, 170, 48);
        }
    }
}
