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
                // невыбранный герой приглушён, закрытый почти серый; цветной фон остаётся (.clscard .cp svg: grayscale и brightness)
                if (!on && face.transform.Find("face") is Transform ft && ft.GetComponent<Image>() is Image fi)
                {
                    fi.sprite = Ui.Gray(fi.sprite, owned ? 0.55f : 0.9f);
                    var br = owned ? 0.8f : 0.55f;
                    fi.color = new Color(br, br, br, 1);
                }
                if (!owned)
                {
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
                // значок в круге с золотой каймой (.clsrelic > svg)
                var ring = Ui.Img("ring", row.transform, Ui.Circle, new Color32(0x44, 0x38, 0x54, 0xFF)).Outline(Ui.Gold, 1.2f);
                ring.rectTransform.Box(13, 23, 46, 46);
                var ic = Ui.Img("ic", ring.transform, "r2/" + h.Relic);
                ic.preserveAspect = true;
                ic.rectTransform.Fill();
                ic.rectTransform.offsetMin = new Vector2(6, 6);
                ic.rectTransform.offsetMax = new Vector2(-6, -6);
                var cap = Ui.Label("cap", row.transform, Loc.Tr("Особенность").ToUpperInvariant(), 12, Ui.GoldHi, TextAnchor.MiddleLeft);
                cap.rectTransform.Box(69, 9, 292, 15);
                var rn = Ui.Label("name", row.transform, r.Name, 17, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleLeft, true).Shadow(1f);
                rn.rectTransform.Box(69, 24, 292, 22);
                var t = Ui.Label("t", row.transform, r.Desc, 15, new Color32(0xD8, 0xD0, 0xE4, 0xFF), TextAnchor.UpperLeft);
                t.rectTransform.Box(69, 46, 292, 40);
                t.Fit(10);
            }
            // карты героя
            var own = defs.Cards.Values.Where(c => c.Cls == id).ToList();
            // плитка «Карты героя»: кружки первых карт, название, список и стрелка (.clscards)
            var cardsRow = Ui.Round("cards", info, new Color32(0x14, 0x11, 0x1E, 0xEB));
            cardsRow.rectTransform.Box(0, 283, 372, 60);
            cardsRow.Dark();
            var shown = Math.Min(4, own.Count);
            for (var i = 0; i < shown; i++)
            {
                var disc = Ui.Img("mini", cardsRow.transform, Ui.Circle, new Color32(0x4A, 0x58, 0x7A, 0xFF)).Outline(Ui.Gold, 1.2f);
                disc.rectTransform.Box(13 + i * 26, 12, 36, 36);
                var pic = Ui.CircleArt("pic", disc.transform, Ui.Art("c/" + own[i].Id));
                pic.rectTransform.Fill();
                pic.rectTransform.offsetMin = new Vector2(3, 3);
                pic.rectTransform.offsetMax = new Vector2(-3, -3);
            }
            var tx = shown > 0 ? 13 + (shown - 1) * 26 + 36 + 18 : 13;
            var ct = Ui.Label("title", cardsRow.transform, Loc.Tr("Карты героя"), 17, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f);
            ct.rectTransform.Box(tx, 7, 330 - tx, 20);
            var cs = Ui.Label("list", cardsRow.transform, string.Join(", ", own.Select(c => c.Name)), 13, new Color32(0xD8, 0xD0, 0xE4, 0xFF), TextAnchor.UpperLeft);
            cs.rectTransform.Box(tx, 27, 330 - tx, 30);
            cs.lineSpacing = 0.95f;
            cs.verticalOverflow = VerticalWrapMode.Truncate;
            var go2 = Ui.Label("go", cardsRow.transform, "›", 28, Ui.GoldHi, TextAnchor.MiddleCenter, true);
            go2.rectTransform.Box(336, 12, 26, 34);
            var cardsHit = Ui.Hit("hit", cardsRow.transform, () => { Sound.Sfx("click"); ShowCards(id); });
            ((RectTransform)cardsHit.transform).Fill();

            Difficulty();
            Buttons(owned);
        }

        static readonly Color32[] PipTints =
        {
            new Color32(0x7A, 0xD0, 0x7A, 0xFF), new Color32(0xE6, 0xC4, 0x5A, 0xFF), new Color32(0xE8, 0x90, 0x2A, 0xFF),
            new Color32(0xD8, 0x50, 0x3A, 0xFF), new Color32(0x9A, 0x3A, 0xD8, 0xFF),
        };

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
            var head = Ui.Label("head", box.transform, "<size=12><color=#FFE08A>" + Loc.Tr("Сложность {a} из {b}", ("a", diff + 1), ("b", n)).ToUpperInvariant() + "</color></size>\n" + d.Name + (won ? " <color=#9FE08A>✓</color>" : ""), 21, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleCenter, true).Shadow(1f);
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
                var bar = Ui.Round("bar", pip.transform, i <= diff ? (Color)PipTints[Mathf.Min(i, PipTints.Length - 1)] : new Color32(0x2A, 0x23, 0x33, 0xFF));
                bar.rectTransform.Box(0, 4, pipW, 8);
                if (Progress.Has("winsDiff", (double)i)) bar.Outline(new Color32(0x9F, 0xE0, 0x8A, 0xFF), 1.2f);
            }
            var hint = Ui.Label("hint", box.transform, d.Hint, 14, new Color(1, 1, 1, 0.78f));
            hint.rectTransform.Box(13, 74, 346, 40);
            hint.Fit(9);
        }

        void Arrow(RectTransform box, string text, float x, bool on, Action act)
        {
            // .darrow 40×40: синеватая плашка с золотой каймой, выключенная — прозрачнее
            var plate = Ui.Round("arrow", box, new Color32(0x30, 0x39, 0x54, 0xFF)).Radius(8).Outline(Ui.Gold, 1.2f);
            plate.rectTransform.Box(x, 13, 40, 40);
            plate.raycastTarget = true;
            var b = plate.gameObject.AddComponent<Button>();
            b.targetGraphic = plate;
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => { if (on) { Sound.Sfx("click"); act(); } });
            var t = Ui.Label("t", plate.transform, text, 34, Ui.GoldHi, TextAnchor.MiddleCenter, true);
            t.rectTransform.Fill();
            t.rectTransform.offsetMin = new Vector2(0, 4);
            if (!on) plate.gameObject.AddComponent<CanvasGroup>().alpha = 0.3f;
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
        internal void TourCards(string id) => ShowCards(id);

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
                // .grid в окне: по три маленькие карты в ряд, ряд по центру
                const float w = 92, gap = 10;
                for (var i = 0; i < cards.Count; i += 3)
                {
                    var line = Ui.Node("line", list);
                    line.Line(gap, TextAnchor.MiddleCenter);
                    line.Pref(356, w * CardView.Ratio);
                    foreach (var c in cards.Skip(i).Take(3))
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
                // .rrow в оформлении skin: плитка с окошком для значка, за названием цветная метка редкости
                var rt = Ui.Node("rrow", list);
                rt.Line(14, TextAnchor.MiddleLeft, 34, 28, 10, 8);
                rt.Pref(356, -1, 78);
                var frame = Ui.Frame(rt, "ui2/tile", 0.5205f, 9.4f, 15.6f, 6.2f, 8.8f);
                if (!frame.sprite) frame.color = new Color32(0x26, 0x2D, 0x45, 0xEE);
                var ic = Ui.Img("icon", rt, "r2/" + rid);
                ic.preserveAspect = true;
                ic.Pref(52, 52);
                var text = Ui.Node("text", rt);
                text.Column(2, TextAnchor.MiddleLeft);
                text.Pref(228);
                var nm = Ui.Label("name", text, r.Name, 17, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f);
                nm.horizontalOverflow = HorizontalWrapMode.Overflow;
                nm.Pref(228, 21);
                Hud.TierTag(nm, 228, r.Tier, rid == h.Relic ? Loc.Tr("Особенность") : Hud.TierLabel(r.Tier));
                var d = Ui.Label("desc", text, r.Desc, 14, Ui.Paper, TextAnchor.MiddleLeft);
                d.lineSpacing = 0.95f;
                d.Pref(228);
            }
            Hint(Loc.Tr("Стартовая колода") + " · " + h.Deck.Count);
            Cards(h.Deck.Select(k => new CardInst { Id = k }).ToList());
            Ui.Push(col, Loc.Tr("Закрыть"), () => { Sound.Sfx("click"); Menus.Close(); }, true, 18, 170, 48);
        }
    }
}
