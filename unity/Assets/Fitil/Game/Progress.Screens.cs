// Экраны прогресса: достижения, статистика, база знаний и карточка итогов забега
// (showAchievements, showStats, showCodex, summaryHTML в game.js). Окно во весь экран: заголовок, список, вкладки внизу.
using System;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static partial class Progress
    {
        static readonly Color RowBg = new Color32(0x24, 0x22, 0x36, 0xEE);
        static readonly Color RowDone = new Color32(0x33, 0x2A, 0x22, 0xF2);
        static readonly Color Soft = new Color(1, 1, 1, 0.7f);
        static readonly Color Brown = new Color32(0x5A, 0x2A, 0x26, 0xFF);

        sealed class Sheet
        {
            public RectTransform List, Tabs;
            public ScrollRect Scroll;
        }

        /// <summary>Окно .achp: значок и заголовок, крестик, полоса прогресса (got ≥ 0), список и строка вкладок.</summary>
        static Sheet MakeSheet(string title, string icon, Action close, int got = -1, int total = 0)
        {
            Menus.Window(out var layer);
            // фон окна (.achp): фиолетовое свечение сверху, книзу темнее. Картинка выше экрана, чтобы центр перехода был у верхнего края.
            var glow = Ui.Img("bg", layer, Ui.HeroBg("sheet"), Color.white);
            glow.rectTransform.Fill();
            glow.rectTransform.offsetMin = new Vector2(-200, 0);
            glow.rectTransform.offsetMax = new Vector2(200, 460);
            var col = Ui.Node("sheet", layer);
            col.anchorMin = Vector2.zero;
            col.anchorMax = Vector2.one;
            col.offsetMin = new Vector2(0, 12);
            col.offsetMax = new Vector2(0, -14);
            col.Column(8, TextAnchor.UpperCenter, 14, 14, 0, 0);
            var head = Ui.Node("head", col);
            head.Pref(372, 42);
            var ic = Ui.Img("icon", head, "r2/" + icon);
            ic.preserveAspect = true;
            ic.rectTransform.Box(10, 5, 32, 32);
            var t = Ui.Label("title", head, title, 19, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(2f);
            // заголовок на тёмной плашке по ширине названия (.achtag)
            var tag = Ui.Round("tag", head, new Color32(0x1C, 0x19, 0x2B, 0xF2)).Dark();
            tag.rectTransform.Box(0, 4, Mathf.Min(300, t.preferredWidth + 68), 34);
            tag.transform.SetAsFirstSibling();
            t.rectTransform.Box(48, 4, 250, 34);
            t.Fit(13);
            var x = Ui.CloseBtn(head, () => { Sound.Sfx("click"); close(); }, 44);
            ((RectTransform)x.transform).Box(328, -1, 44, 44);
            if (got >= 0) Bar(col, got, total, 372, 24, true);
            var list = Menus.ScrollList(col, 372);
            var tabs = Ui.Node("tabs", col);
            tabs.Line(0, TextAnchor.MiddleCenter, 14, 14, 0, 0);
            tabs.Pref(382, 66);
            // вкладки стоят на общей тёмной плашке (.achtabs 382×66)
            var tabsBg = Ui.Round("bg", tabs, new Color32(0x1C, 0x19, 0x2B, 0xF2)).Dark();
            tabsBg.rectTransform.Fill();
            tabsBg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            return new Sheet { List = list, Tabs = tabs, Scroll = list.parent.GetComponent<ScrollRect>() };
        }

        static void Bar(Transform parent, int got, int total, float w, float h, bool number)
        {
            var bar = Ui.Round("bar", parent, number ? (Color)new Color32(0x24, 0x1D, 0x2E, 0xFF) : new Color32(0x12, 0x0F, 0x19, 0xFF));
            bar.Pref(w, h);
            var k = total > 0 ? Mathf.Clamp01((float)got / total) : 0;
            if (k > 0)
            {
                // большая полоса с числом — красная со светлой кромкой (.achbar i), малая под достижением — золотая (.abar i)
                var fill = Ui.Round("fill", bar.transform, number ? (Color)new Color32(0xBC, 0x44, 0x3A, 0xFF) : new Color32(0xD9, 0xA8, 0x4A, 0xFF));
                if (number)
                {
                    var cap = Ui.Img("cap", fill.transform, (Sprite)null, new Color32(0xFF, 0xF4, 0xD6, 0xFF));
                    cap.rectTransform.anchorMin = new Vector2(1, 0);
                    cap.rectTransform.anchorMax = new Vector2(1, 1);
                    cap.rectTransform.pivot = new Vector2(1, 0.5f);
                    cap.rectTransform.sizeDelta = new Vector2(2.5f, 0);
                    cap.rectTransform.anchoredPosition = Vector2.zero;
                }
                var r = fill.rectTransform;
                r.anchorMin = Vector2.zero;
                r.anchorMax = new Vector2(k, 1);
                r.offsetMin = r.offsetMax = Vector2.zero;
            }
            if (number) Ui.Label("n", bar.transform, got + "/" + total, 17, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleCenter, true).Shadow(1f).rectTransform.Fill();
        }

        static void Tab(RectTransform tabs, string name, string sub, bool on, float w, Action pick)
        {
            // выбранная вкладка светится тёплым пятном, остальные без подложки
            var bg = Ui.Round("tab", tabs, new Color(0, 0, 0, 0));
            bg.Pref(w, 54);
            if (on)
            {
                // выбранная вкладка: тёплое свечение снизу, а не плашка
                var glow = Ui.Img("glow", bg.transform, Ui.Soft, new Color(1f, 0.78f, 0.42f, 0.28f));
                glow.type = Image.Type.Sliced;
                glow.rectTransform.Fill();
                glow.rectTransform.offsetMin = new Vector2(2, -6);
                glow.rectTransform.offsetMax = new Vector2(-2, -26);
            }
            var t = Ui.Label("name", bg.transform, name, 14, on ? Ui.GoldHi : (Color)new Color32(0xC9, 0xC0, 0xD8, 0xFF), TextAnchor.LowerCenter, true);
            t.rectTransform.Box(3, 6, w - 6, 22);
            t.Fit(10);
            var st = Ui.Label("sub", bg.transform, sub, 13, on ? Ui.GoldHi : (Color)new Color32(0x9A, 0x90, 0xAC, 0xFF), TextAnchor.UpperCenter);
            st.rectTransform.Box(3, 28, w - 6, 20);
            st.Fit(9);
            bg.raycastTarget = true;
            var b = bg.gameObject.AddComponent<Button>();
            b.targetGraphic = bg;
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => { Sound.Sfx("click"); pick(); });
        }

        static void Top(Sheet s)
        {
            Canvas.ForceUpdateCanvases();
            if (s.Scroll) s.Scroll.verticalNormalizedPosition = 1;
        }

        static void Close(Action back)
        {
            if (back != null) back();
            else Menus.Close();
        }

        // ================= достижения =================
        /// <summary>Достижения по вкладкам: Путь, Мастерство, Коллекция, Истории. Новые с прошлого раза помечены.</summary>
        public static void ShowAchievements(Action back = null, string startTab = null)
        {
            var since = Num(A, "seenAt");
            A["seenAt"] = (double)Now;
            SaveAch();
            var all = List;
            var cats = Cats;
            var tab = startTab ?? (cats.Count > 0 ? cats[0].id : "path");
            Sheet s = null;
            void Render()
            {
                s = MakeSheet(Loc.Tr("Достижения"), "medal", () => Close(back), all.Count(Done), all.Count);
                var lg = s.List.GetComponent<VerticalLayoutGroup>();
                lg.spacing = 16;                       // рамки плиток выступают за строку: без зазора они ложились бы друг на друга
                lg.padding = new RectOffset(6, 6, 16, 16);
                foreach (var a in all.Where(a => Json.Str(Json.Get(a, "cat")) == tab)) AchRow(s.List, a, since);
                var w = 354f / Math.Max(1, cats.Count);
                foreach (var (id, name) in cats)
                {
                    var n = all.Count(a => Json.Str(Json.Get(a, "cat")) == id);
                    var g = all.Count(a => Json.Str(Json.Get(a, "cat")) == id && Done(a));
                    Tab(s.Tabs, name, g + "/" + n, id == tab, w, () => { tab = id; Render(); });
                }
                Top(s);
            }
            Render();
        }

        /// <summary>Почтовый штемпель (achStamp в game.js): два кольца, слово по дуге, число и месяц, волнистые линии гашения.</summary>
        static void Stamp(RectTransform host, double ts, Vector2 at)
        {
            var ink = new Color(216 / 255f, 169 / 255f, 74 / 255f, 0.85f);
            var body = Ui.Node("ink", host);
            body.anchorMin = body.anchorMax = body.pivot = new Vector2(0.5f, 0.5f);
            body.sizeDelta = new Vector2(52, 52);
            body.localScale = Vector3.one * 1.15f;
            body.anchoredPosition = at;
            body.localEulerAngles = new Vector3(0, 0, 14);
            var outer = Ui.Img("ring", body, Ui.Ring(0.09f), ink);
            outer.rectTransform.Fill();
            var inner = Ui.Img("ring2", body, Ui.Ring(0.07f), ink);
            inner.rectTransform.anchorMin = inner.rectTransform.anchorMax = inner.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            inner.rectTransform.sizeDelta = new Vector2(35, 35);
            inner.rectTransform.anchoredPosition = Vector2.zero;
            // слово по верхней дуге между кольцами
            var word = Loc.Tr("ПОЛУЧЕНО");
            const float r = 21.2f;
            var step = Mathf.Min(17f, 150f / Mathf.Max(1, word.Length));
            for (var i = 0; i < word.Length; i++)
            {
                var ang = (i - (word.Length - 1) / 2f) * step;   // градусы от вершины, по часовой
                var l = Ui.Label("c", body, word[i].ToString(), 8, ink, TextAnchor.MiddleCenter, true);
                l.horizontalOverflow = HorizontalWrapMode.Overflow;
                var lr = l.rectTransform;
                lr.anchorMin = lr.anchorMax = lr.pivot = new Vector2(0.5f, 0.5f);
                lr.sizeDelta = new Vector2(12, 12);
                var rad = ang * Mathf.Deg2Rad;
                lr.anchoredPosition = new Vector2(Mathf.Sin(rad) * r, Mathf.Cos(rad) * r);
                lr.localEulerAngles = new Vector3(0, 0, -ang);
            }
            var d = DateTimeOffset.FromUnixTimeMilliseconds((long)ts).ToLocalTime().DateTime;
            var date = Ui.Label("date", body, d.ToString(Loc.Lang == "en" ? "MM'/'dd" : "dd'.'MM", System.Globalization.CultureInfo.InvariantCulture), 10, ink, TextAnchor.MiddleCenter, true);
            date.horizontalOverflow = HorizontalWrapMode.Overflow;
            date.rectTransform.Fill();
            var waves = Ui.Label("waves", body, "~~~\n~~~\n~~~", 11, ink, TextAnchor.MiddleCenter);
            waves.lineSpacing = 0.55f;
            waves.horizontalOverflow = HorizontalWrapMode.Overflow;
            var wr = waves.rectTransform;
            wr.anchorMin = wr.anchorMax = wr.pivot = new Vector2(0.5f, 0.5f);
            wr.sizeDelta = new Vector2(24, 30);
            wr.anchoredPosition = new Vector2(-34, 0);
        }

        static void AchRow(RectTransform list, Dictionary<string, object> a, double since)
        {
            var done = Done(a);
            var goal = Goal(a);
            var p = Math.Min(ProgressOf(a), goal);
            // плитка с окошком для значка (.arow в веб-версии: рамка ui2/tile, окошко 71×71 слева, строка 93)
            var rt = Ui.Node("arow", list);
            rt.Line(12, TextAnchor.MiddleLeft, 34, 10, 12, 10);
            rt.Pref(360, -1, 93);
            var frame = Ui.Frame(rt, "ui2/tile", 0.5205f, 9.4f, 15.6f, 6.2f, 8.8f);
            if (!frame.sprite) frame.color = done ? RowDone : RowBg;

            var port = Ui.Node("port", rt);
            port.Pref(71, 71);
            // подложка по разделу достижения; неполученное — потемневшая картинка (grayscale + brightness .55)
            var plate = Ui.Img("bg", port, Ui.HeroBg(Json.Str(Json.Get(a, "cat")) ?? "path"), done ? Color.white : new Color(0.86f, 0.84f, 0.88f, 1));
            plate.rectTransform.Fill();
            var art = ArtOf(a);
            // неполученное: серая потемневшая картинка (filter: grayscale(1) brightness(.55))
            var pic = Ui.Img("art", port, done ? art : Ui.Gray(art), done ? Color.white : new Color(0.55f, 0.55f, 0.55f, 1));
            pic.preserveAspect = true;
            pic.rectTransform.Fill();
            pic.rectTransform.offsetMin = new Vector2(4, 4);
            pic.rectTransform.offsetMax = new Vector2(-4, -4);
            var stars = Json.Int(Json.Get(a, "stars"));
            if (stars > 0)
            {
                var st = Ui.Label("stars", port, new string('★', stars), 12, Ui.Gold).Shadow(1f);
                st.rectTransform.Box(0, 54, 71, 16);
            }
            if (done && Num(Got, Id(a)) > since)
            {
                var nw = Ui.Round("new", port, Ui.Red);
                nw.rectTransform.Box(-4, -4, 42, 16);
                Ui.Label("t", nw.transform, Loc.Tr("новое"), 11, Color.white).rectTransform.Fill();
            }

            var text = Ui.Node("text", rt);
            text.Column(3, TextAnchor.MiddleLeft);
            text.Pref(done ? 179 : 233);
            Ui.Label("name", text, Json.Str(Json.Get(a, "name")), 17, done ? Ui.GoldHi : Ui.Paper, TextAnchor.MiddleLeft, true).Pref(done ? 179 : 233);
            var desc = (Json.Str(Json.Get(a, "desc")) ?? "").Replace("{p}", "<color=#F3D27C>" + Fmt(p) + "/" + Fmt(goal) + "</color>");
            var d = Ui.Label("desc", text, desc, 14, new Color32(0xD8, 0xD0, 0xE4, 0xFF), TextAnchor.MiddleLeft);
            d.lineSpacing = 0.95f;
            d.Pref(done ? 179 : 233);
            if (!done && goal > 1) Bar(text, p, goal, 233, 6, false);

            if (done)
            {
                // штемпель «Получено» с датой, как в списке веб-версии
                var stamp = Ui.Node("stamp", rt);
                stamp.Pref(42, 50);
                Stamp(stamp, Num(Got, Id(a)), new Vector2(-12, 0));
            }
        }

        // ================= статистика =================
        /// <summary>Статистика: «Итоги» — всё время и рекорды, «Забеги» — прошлые забеги с подробными итогами.</summary>
        public static void ShowStats(Action back = null, string startTab = "sum", int startOpen = -1)
        {
            var tab = startTab;
            var open = startOpen;
            var list = Runs.Select(Json.Obj).Where(r => r != null).ToList();
            var maxSteps = Boot.Instance.Defs.MaxSteps;
            double Best(string k) => list.Aggregate(0.0, (m, r) => Math.Max(m, Num(r, k)));
            void Render()
            {
                var s = MakeSheet(Loc.Tr("Статистика"), "hourglass", () => Close(back));
                if (tab == "sum")
                {
                    Group(s.List, Loc.Tr("Всего"));
                    Dl(s.List, new[]
                    {
                        ("Забегов начато", Fmt(Num(St, "runs"))), ("Писем доставлено", Fmt(Num(St, "wins"))), ("Поражений", Fmt(Num(St, "losses"))),
                        ("Лучший уровень", Num(St, "best") > 0 ? Loc.Tr("{a} из {b}", ("a", (int)Num(St, "best")), ("b", maxSteps)) : "—"),
                        ("Побед в боях", Fmt(Num(St, "fights"))), ("Побеждено элит", Fmt(Num(St, "elites"))), ("Побеждено боссов", Fmt(Num(St, "bosses"))),
                        ("Сыграно карт", Fmt(Num(St, "cards"))), ("Урон врагам", Fmt(Num(St, "dmg"))), ("Монет собрано", Fmt(Num(St, "gold"))),
                        ("Время в пути", Num(St, "ms") > 0 ? FmtTime(Num(St, "ms")) : "—"),
                    });
                    Group(s.List, Loc.Tr("Рекорды"));
                    Dl(s.List, new[]
                    {
                        ("Самая быстрая доставка", Num(St, "fast") > 0 ? FmtTime(Num(St, "fast")) : "—"),
                        ("Сильнейший удар", Fmt(Math.Max(Num(C, "maxhit"), Best("hit")))),
                        ("Больше всего урона за забег", Fmt(Math.Max(Num(St, "runDmg"), Best("dmg")))),
                        ("Больше всего побед за забег", Fmt(Best("fights"))),
                    });
                }
                else if (open >= 0 && open < list.Count)
                {
                    Ui.Push(s.List, "← " + Loc.Tr("Все забеги"), () => { open = -1; Render(); }, true, 16, 180, 40);
                    SummaryCard(s.List, list[open], Boot.Instance.Defs);
                }
                else if (list.Count == 0)
                    Ui.Label("empty", s.List, Loc.Tr("Здесь появятся итоги законченных забегов."), 16, Soft).Pref(360, 80);
                else
                {
                    var lg = s.List.GetComponent<VerticalLayoutGroup>();
                    lg.spacing = 14;                   // рамки плиток выступают за строку
                    lg.padding = new RectOffset(6, 6, 14, 14);
                    for (var i = 0; i < list.Count; i++) { var k = i; RunRow(s.List, list[i], maxSteps, () => { open = k; Render(); }); }
                }
                var sub = list.Count > 1 ? Loc.Tr("последние {n}", ("n", list.Count)) : list.Count == 1 ? Loc.Tr("последний") : Loc.Tr("пока нет");
                Tab(s.Tabs, Loc.Tr("Итоги"), Loc.Tr("всё время"), tab == "sum", 177, () => { tab = "sum"; open = -1; Render(); });
                Tab(s.Tabs, Loc.Tr("Забеги"), sub, tab == "runs", 177, () => { tab = "runs"; open = -1; Render(); });
                Top(s);
            }
            Render();
        }

        static void Group(RectTransform list, string title)
        {
            // название раздела с тонкой золотой чертой под ним (.cxgroup: отступ сверху 12, черта 1.5)
            var g = Ui.Node("group", list);
            g.Pref(364, 40);
            var t = Ui.Label("t", g, title, 17, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(1f);
            t.rectTransform.Fill();
            t.rectTransform.offsetMin = new Vector2(0, 6);
            var rule = Ui.Img("rule", g, (Sprite)null, new Color(216 / 255f, 169 / 255f, 74 / 255f, 0.3f));
            rule.rectTransform.anchorMin = new Vector2(0, 0);
            rule.rectTransform.anchorMax = new Vector2(1, 0);
            rule.rectTransform.pivot = new Vector2(0.5f, 0);
            rule.rectTransform.sizeDelta = new Vector2(0, 1.5f);
            rule.rectTransform.anchoredPosition = new Vector2(0, 2);
        }

        static void Dl(RectTransform list, IEnumerable<(string k, string v)> rows)
        {
            // строки в общей тёмной рамке, между ними тонкие черты (.statlist: строка 36, название 16, число 17)
            var box = Ui.Node("statlist", list);
            box.Column(0, TextAnchor.UpperCenter, 16, 16, 10, 10);
            box.Pref(360);
            var bg = Ui.Round("bg", box, new Color32(0x1C, 0x19, 0x2B, 0xF2)).Dark();
            bg.rectTransform.Fill();
            bg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var first = true;
            foreach (var (k, v) in rows)
            {
                if (!first) Ui.Img("rule", box, null, new Color(1, 1, 1, 0.1f)).Pref(328, 1);
                first = false;
                var row = Ui.Node("dl", box);
                row.Line(8, TextAnchor.MiddleLeft, 0, 0, 2, 2);
                row.Pref(328, -1, 35);
                Ui.Label("dt", row, Loc.Tr(k), 16, Ui.Paper, TextAnchor.MiddleLeft).Pref(216);
                Ui.Label("dd", row, v, 17, Ui.GoldHi, TextAnchor.MiddleRight, true).Pref(104);
            }
        }

        static void RunRow(RectTransform list, Dictionary<string, object> r, int maxSteps, Action open)
        {
            var data = Boot.Instance.Data;
            var cls = Json.Str(Json.Get(r, "cls"));
            if (cls == null || !data.Classes.ContainsKey(cls)) cls = "lamp";
            var win = Json.Bool(Json.Get(r, "win"));
            var diff = data.Difficulties[Mathf.Clamp(Json.Int(Json.Get(r, "diff"), 1), 0, data.Difficulties.Count - 1)];
            // плитка как у достижений (.runrow в оформлении skin): рамка ui2/tile, слева окошко с лицом героя
            var rt = Ui.Node("runrow", list);
            rt.Line(10, TextAnchor.MiddleLeft, 34, 30, 9, 7);
            rt.Pref(360, -1, 72);
            var frame = Ui.Frame(rt, "ui2/tile", 0.5205f, 9.4f, 15.6f, 6.2f, 8.8f);
            if (!frame.sprite) frame.color = win ? RowDone : RowBg;
            var port = Ui.Node("port", rt);
            port.Pref(56, 56);
            Ui.Img("bg", port, Ui.HeroBg(cls), win ? Color.white : new Color(0.8f, 0.8f, 0.8f, 1)).rectTransform.Fill();
            var faceArt = Ui.Art("h/" + cls + "_face");
            // проигранный забег: лицо приглушено (filter: grayscale(.6) brightness(.85))
            var face = Ui.Img("face", port, win ? faceArt : Ui.Gray(faceArt, 0.6f), win ? Color.white : new Color(0.85f, 0.85f, 0.85f, 1));
            face.preserveAspect = true;
            face.rectTransform.Fill();

            var text = Ui.Node("text", rt);
            text.Column(1, TextAnchor.MiddleLeft);
            text.Pref(142);
            var nm = Ui.Label("name", text, data.Classes[cls].Name, 18, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleLeft, true);
            nm.Pref(142);
            var small = new Color32(0xC9, 0xC0, 0xD8, 0xFF);
            var lvl = Loc.Tr("Уровень {a} из {b}", ("a", Json.Int(Json.Get(r, "lvl"))), ("b", maxSteps)) + " · " + FmtTime(Num(r, "ms"));
            Ui.Label("diff", text, diff.Name, 13, small, TextAnchor.MiddleLeft).Pref(142);
            var lv = Ui.Label("lvl", text, lvl, 13, small, TextAnchor.MiddleLeft);
            lv.horizontalOverflow = HorizontalWrapMode.Overflow;
            lv.Pref(142);

            var res = Ui.Node("res", rt);
            res.Column(3, TextAnchor.MiddleRight);
            res.Pref(88);
            var pill = Ui.Round("em", res, win ? new Color32(0xDE, 0xB6, 0x5B, 0xFF) : new Color32(0x46, 0x2E, 0x37, 0xFF)).Radius(5);
            pill.rectTransform.Pref(88, 23);
            Ui.Label("t", pill.transform, win ? Loc.Tr("Доставлено") : Loc.Tr("Поражение"), 13,
                win ? new Color32(0x2A, 0x1C, 0x0C, 0xFF) : new Color32(0xF1, 0xD8, 0xD4, 0xFF), TextAnchor.MiddleCenter, true).rectTransform.Fill();
            Ui.Label("date", res, FmtDate(Num(r, "at")), 13, new Color32(0xA8, 0x9C, 0xBC, 0xFF), TextAnchor.MiddleRight).Pref(88);

            var hit = Ui.Img("hit", rt, (Sprite)null, new Color(0, 0, 0, 0));
            hit.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            hit.rectTransform.Fill();
            hit.raycastTarget = true;
            var b = hit.gameObject.AddComponent<Button>();
            b.targetGraphic = hit;
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => { Sound.Sfx("click"); open(); });
        }

        /// <summary>Карточка итогов забега (summaryHTML): герой и исход, восемь плиток с числами, талисманы.</summary>
        public static RectTransform SummaryCard(RectTransform parent, Dictionary<string, object> rec, Defs defs)
        {
            var data = defs.Data;
            var cls = Json.Str(Json.Get(rec, "cls"));
            if (cls == null || !data.Classes.ContainsKey(cls)) cls = "lamp";
            var win = Json.Bool(Json.Get(rec, "win"));
            var diff = data.Difficulties[Mathf.Clamp(Json.Int(Json.Get(rec, "diff"), 1), 0, data.Difficulties.Count - 1)];
            // .sumcard 360: тёмная рамка с золотой каймой (ui2/btn_dark), поля 17, внутри 326
            var cardBg = Ui.Round("sumcard", parent, new Color32(0x1C, 0x19, 0x2B, 0xF2)).Dark();
            var card = cardBg.rectTransform;
            card.Column(8, TextAnchor.UpperLeft, 17, 17, 17, 15);
            card.Pref(360);

            var head = Ui.Node("head", card);
            head.Line(10, TextAnchor.MiddleLeft);
            head.Pref(326, 64);
            Ui.Portrait("face", head, cls, 64, 64).Pref(64, 64);
            var who = Ui.Node("who", head);
            who.Column(0, TextAnchor.MiddleLeft);
            who.Pref(130);
            Ui.Label("name", who, data.Classes[cls].Name, 22, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleLeft, true).Shadow(1f).Pref(130, 26);
            Ui.Label("diff", who, diff.Name, 14, new Color32(0xC9, 0xC0, 0xD8, 0xFF), TextAnchor.MiddleLeft).Pref(130, 16);
            Ui.Label("date", who, FmtDate(Num(rec, "at")), 14, new Color32(0xC9, 0xC0, 0xD8, 0xFF), TextAnchor.MiddleLeft).Pref(130, 16);
            // исход забега: наклонённая плашка (.sumres), золотая у победы и тёмно-красная у поражения
            var res = Ui.Round("res", head, win ? (Color)new Color32(0xDE, 0xB6, 0x5B, 0xFF) : new Color32(0x46, 0x2E, 0x37, 0xFF)).Outline(win ? Ui.Ink : (Color)new Color32(0xA0, 0x5A, 0x5A, 0xFF), 1.2f);
            res.Pref(112, 48);
            var rl = Ui.Label("t", res.transform, win ? Loc.Tr("Письмо доставлено") : Loc.Tr("Тени настигли"), 15, win ? (Color)new Color32(0x2A, 0x1C, 0x0C, 0xFF) : new Color32(0xF1, 0xD8, 0xD4, 0xFF), TextAnchor.MiddleCenter, true);
            rl.rectTransform.Fill();
            rl.rectTransform.offsetMin = new Vector2(8, 4);
            rl.rectTransform.offsetMax = new Vector2(-8, -4);
            rl.lineSpacing = 0.9f;
            res.gameObject.AddComponent<Tilt>().Angle = 4;

            string Foe(string k) { var id = Json.Str(Json.Get(rec, k)); return id != null && defs.Enemies.TryGetValue(id, out var e) ? e.Name : null; }
            var last = win ? (Foe("fin") is string f ? Loc.Tr("Финальный бой: {name}", ("name", f)) : null) : (Foe("by") is string b ? Loc.Tr("Последний бой: {name}", ("name", b)) : null);
            if (last != null) Ui.Label("last", card, last, 14, Soft, TextAnchor.MiddleLeft).Pref(326);

            var maxSteps = defs.MaxSteps;
            int N(string k) => Json.Int(Json.Get(rec, k));
            var tiles = new[]
            {
                (Loc.Tr("Уровень"), Loc.Tr("{a} из {b}", ("a", N("lvl")), ("b", maxSteps)), (string)null),
                (Loc.Tr("Время в пути"), FmtTime(Num(rec, "ms")), null),
                (Loc.Tr("Побед в боях"), Fmt(N("fights")), Loc.Tr("элит: {a} · боссов: {b}", ("a", N("elites")), ("b", N("bosses")))),
                (Loc.Tr("Сыграно карт"), Fmt(N("cards")), null),
                (Loc.Tr("Урон врагам"), Fmt(N("dmg")), Loc.Tr("сильнейший удар: {n}", ("n", Fmt(N("hit"))))),
                (Loc.Tr("Потеряно HP"), Fmt(N("taken")), Loc.Tr("вылечено: {n}", ("n", Fmt(N("healed"))))),
                (Loc.Tr("Монет собрано"), Fmt(N("gold")), Loc.Tr("потрачено: {n}", ("n", Fmt(N("spent"))))),
                (Loc.Tr("Колода"), Loc.Tr("{n} {n|карта|карты|карт}", ("n", N("deck"))), Loc.Tr("улучшено: {n}", ("n", N("ups")))),
            };
            var gold34 = new Color(0.85f, 0.66f, 0.29f, 0.34f);
            for (var i = 0; i < tiles.Length; i += 2)
            {
                var line = Ui.Node("tiles", card);
                line.Line(6, TextAnchor.UpperLeft);
                line.Pref(326);
                var tall = tiles[i].Item3 != null || tiles[i + 1].Item3 != null;
                for (var j = i; j < i + 2; j++)
                {
                    var (label, value, sub) = tiles[j];
                    // плитка .sumtile: всё прижато влево, число крупное шрифтом заголовков
                    // кайма — отдельная плашка под тёмной серединой: Outline на полупрозрачной плашке красил бы её целиком
                    var t = Ui.Round("tile", line, gold34).Radius(4);
                    var tr = t.rectTransform;
                    var mid = Ui.Round("mid", tr, new Color32(0x12, 0x10, 0x1C, 0xF4)).Radius(3);
                    mid.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
                    mid.rectTransform.Fill();
                    mid.rectTransform.offsetMin = new Vector2(1.2f, 1.2f);
                    mid.rectTransform.offsetMax = new Vector2(-1.2f, -1.2f);
                    tr.Column(0, TextAnchor.UpperLeft, 8, 8, 5, 6);
                    tr.Pref(160, -1, tall ? 70 : 55);
                    Ui.Label("k", tr, label, 14, new Color32(0xB8, 0xAE, 0xCB, 0xFF), TextAnchor.MiddleLeft).Pref(142, 15);
                    Ui.Label("v", tr, value, 23, Ui.GoldHi, TextAnchor.MiddleLeft, true).Pref(142, 26);
                    if (sub != null) Ui.Label("s", tr, sub, 13, new Color32(0xC9, 0xC0, 0xD8, 0xFF), TextAnchor.MiddleLeft).Fit(9).Pref(142, 15);
                }
            }

            var relics = (Json.Arr(Json.Get(rec, "relics")) ?? new List<object>()).Select(x => Json.Str(x)).Where(r => r != null && defs.Relics.ContainsKey(r)).ToList();
            Ui.Label("rt", card, Loc.Tr("Талисманы") + " · " + relics.Count, 14, new Color32(0xB8, 0xAE, 0xCB, 0xFF), TextAnchor.MiddleLeft).Pref(326);
            // значки мельче, когда их больше трёх рядов (v170)
            var size = relics.Count <= 24 ? 34f : relics.Count <= 40 ? 28 : relics.Count <= 60 ? 22 : 18;
            var perRow = Mathf.Max(1, (int)((326 + 4) / (size + 4)));
            var pad = size >= 34 ? 4 : 2;
            for (var i = 0; i < relics.Count; i += perRow)
            {
                var line = Ui.Node("relics", card);
                line.Line(4, TextAnchor.MiddleLeft);
                line.Pref(326, size);
                foreach (var r in relics.Skip(i).Take(perRow))
                {
                    // кружок .sumr: тёмная подложка с золотой каймой, внутри значок
                    var chip = Ui.Img("r", line, Ui.Circle, new Color32(0x2E, 0x27, 0x44, 0xFF)).Outline(new Color(0.85f, 0.66f, 0.29f, 0.6f), 1f);
                    chip.Pref(size, size);
                    var ic = Ui.Img("ic", chip.transform, "r2/" + r);
                    ic.preserveAspect = true;
                    ic.rectTransform.Fill();
                    ic.rectTransform.offsetMin = new Vector2(pad, pad);
                    ic.rectTransform.offsetMax = new Vector2(-pad, -pad);
                }
            }
            var notes = new[]
            {
                N("met") > 0 ? Loc.Tr("Встречено героев: {n}", ("n", N("met"))) : null,
                N("fallen") > 0 ? Loc.Tr("Ушли в Тень: {n}", ("n", N("fallen"))) : null,
                N("revives") > 0 ? Loc.Tr("Повторных боёв: {n}", ("n", N("revives"))) : null,
            }.Where(x => x != null).ToList();
            if (notes.Count > 0) Ui.Label("note", card, string.Join(" · ", notes), 14, new Color32(0xB8, 0xAE, 0xCB, 0xFF), TextAnchor.MiddleLeft).Pref(326);
            return card;
        }

        // ================= база знаний =================
        static readonly (string k, string name)[] CxTabs = { ("h", "Герои"), ("e", "Враги"), ("c", "Карты"), ("r", "Талисманы") };

        /// <summary>База знаний: герои, враги, карты и талисманы, которые уже встречались в игре.</summary>
        public static void ShowCodex(Action back = null, string startTab = "h", string startOpen = null)
        {
            var tab = startTab;
            var open = startOpen;
            var defs = Boot.Instance.Defs;
            void Render()
            {
                var s = MakeSheet(Loc.Tr("База знаний"), "bookmark", () => Close(back), CodexCount, CodexTotal);
                if (open != null) Detail(s.List, tab, open, defs, () => { open = null; Render(); });
                else Grid(s.List, tab, defs, id => { open = id; Render(); });
                foreach (var (k, name) in CxTabs)
                {
                    var l = CodexList(k);
                    Tab(s.Tabs, Loc.Tr(name), l.Count(id => CxHas(k, id)) + "/" + l.Count, k == tab, 88.5f, () => { tab = k; open = null; Render(); });
                }
                Top(s);
            }
            Render();
        }

        static string CxName(string kind, string id, Defs d) =>
            kind == "h" ? (d.Data.Classes.TryGetValue(id, out var h) ? h.Name : id)
            : kind == "e" ? (d.Enemies.TryGetValue(id, out var e) ? e.Name : id)
            : kind == "c" ? (d.Cards.TryGetValue(id, out var c) ? c.Name : id)
            : d.Relics.TryGetValue(id, out var r) ? r.Name : id;

        static Sprite CxArt(string kind, string id) =>
            kind == "h" ? Ui.Art("h/" + id + "_face") : kind == "e" ? Ui.Art("e/" + id) : kind == "r" ? Ui.Art("r2/" + id) : Ui.Art("c/" + id);

        static void Grid(RectTransform list, string kind, Defs defs, Action<string> open)
        {
            var ids = CodexList(kind);
            void Tiles(string title, List<string> part)
            {
                if (part.Count == 0) return;
                if (title != null) Group(list, title);
                const int per = 4;
                for (var i = 0; i < part.Count; i += per)
                {
                    var line = Ui.Node("cxrow", list);
                    line.Line(kind == "c" ? 5 : 7, TextAnchor.UpperLeft, kind == "c" ? 4 : 0, 0, 0, 7);
                    line.Pref(372);
                    foreach (var id in part.Skip(i).Take(per)) Tile(line, kind, id, defs, open);
                }
            }
            // у героев нет названия раздела: сетка начинается с отступа списка (.achlist padding-top 14)
            Ui.Node("gap", list).Pref(356, kind == "h" ? 12 : 18);
            if (kind == "h") { Tiles(null, ids); return; }
            if (kind == "e")
            {
                // враг, который встречается в двух стадиях, стоит один раз: там, где встречается впервые
                var shown = new HashSet<string>();
                foreach (var g in defs.Stages)
                {
                    var foes = ids.Where(id => !shown.Contains(id) && (g.Normals.Contains(id) || g.Early.Contains(id) || g.Elites.Contains(id) || g.Boss.Contains(id))).ToList();
                    foreach (var id in foes) shown.Add(id);
                    Tiles(g.Name, foes);
                }
                Tiles(Loc.Tr("Мрачные герои"), ids.Where(id => !shown.Contains(id) && defs.Enemies.TryGetValue(id, out var e) && e.Dark != null).ToList());
                Tiles(null, ids.Where(id => !shown.Contains(id) && !(defs.Enemies.TryGetValue(id, out var e) && e.Dark != null)).ToList());
                return;
            }
            if (kind == "c")
            {
                bool Status(string id) => defs.Cards.TryGetValue(id, out var c) && c.Rarity == "status";
                string Cls(string id) => defs.Cards.TryGetValue(id, out var c) ? c.Cls : null;
                Tiles(Loc.Tr("Общие карты"), ids.Where(id => Cls(id) == null && !Status(id)).ToList());
                foreach (var h in CodexList("h")) Tiles(CxName("h", h, defs), ids.Where(id => Cls(id) == h).ToList());
                Tiles(Loc.Tr("Помехи"), ids.Where(Status).ToList());
                return;
            }
            var heroRelic = defs.Data.Classes.Values.ToDictionary(h => h.Relic ?? "", h => h.Id);
            string Owner(string id) => defs.Relics.TryGetValue(id, out var r) && r.Cls != null ? r.Cls : heroRelic.TryGetValue(id, out var h) ? h : null;
            bool Boss(string id) => defs.Relics.TryGetValue(id, out var r) && r.Tier == "boss";
            Tiles(Loc.Tr("Талисманы"), ids.Where(id => Owner(id) == null && !Boss(id)).ToList());
            Tiles(Loc.Tr("Трофеи боссов"), ids.Where(Boss).ToList());
            foreach (var h in CodexList("h")) Tiles(CxName("h", h, defs), ids.Where(id => Owner(id) == h).ToList());
        }

        static readonly Color32 RingElite = new Color32(0xC5, 0x8C, 0xFF, 0xFF), RingBoss = new Color32(0xE0, 0x5A, 0x4A, 0xFF), RingOff = new Color32(0x5A, 0x50, 0x70, 0xFF);

        static Color RelicRing(string tier) =>
            tier == "uncommon" ? new Color32(0x7A, 0xD0, 0x8A, 0xFF) : tier == "rare" ? new Color32(0x6F, 0xB8, 0xFF, 0xFF) : tier == "epic" ? RingElite
            : tier == "legendary" ? new Color32(0xFF, 0x9A, 0x3A, 0xFF) : tier == "boss" ? RingBoss : (Color32)Ui.Gold;

        /// <summary>Картинка записи в окошке (.cxpic, .cxport, .cxmini): у героя и врага квадрат с каймой, у талисмана круг с кольцом редкости.</summary>
        static void CxPic(RectTransform slotRt, string kind, string id, Defs defs, bool on, float pad)
        {
            var art = CxArt(kind, id);
            Image pic;
            if (kind == "r")
            {
                var disc = Ui.Img("bg", slotRt, Ui.Circle, new Color32(0x2B, 0x25, 0x3D, 0xFF));
                disc.rectTransform.Fill();
                var ring = Ui.Img("ring", slotRt, Ui.Ring(0.085f), on ? RelicRing(defs.Relics.TryGetValue(id, out var rr) ? rr.Tier : null) : (Color)RingOff);
                ring.rectTransform.Fill();
                pic = Ui.Img("pic", slotRt, art, Color.white);
            }
            else
            {
                var tier = kind == "e" && defs.Enemies.TryGetValue(id, out var en) ? en.Tier : null;
                var edge = !on ? RingOff : tier == "elite" ? RingElite : tier == "boss" ? RingBoss : (Color32)Ui.Gold;
                // кайма — отдельная подложка: Outline на самой картинке обрезала бы её же маска
                Ui.Img("edge", slotRt, (Sprite)null, edge).rectTransform.Fill();
                var slot = Ui.Img("bg", slotRt, Ui.HeroBg(kind == "h" ? "cxhero" : "cx"), Color.white);
                slot.rectTransform.Fill();
                slot.rectTransform.offsetMin = new Vector2(1.6f, 1.6f);
                slot.rectTransform.offsetMax = new Vector2(-1.6f, -1.6f);
                slot.gameObject.AddComponent<RectMask2D>();
                pic = Ui.Img("pic", slot.transform, art, Color.white);
            }
            pic.preserveAspect = true;
            pic.rectTransform.Fill();
            pic.rectTransform.offsetMin = new Vector2(pad, kind == "h" ? 0 : pad);
            pic.rectTransform.offsetMax = new Vector2(-pad, -pad);
            if (!art) pic.color = new Color(0, 0, 0, 0);
            else if (!on) pic.color = new Color(0, 0, 0, 0.55f);   // силуэт: brightness(0) opacity(.55)
        }

        static void Tile(RectTransform line, string kind, string id, Defs defs, Action<string> open)
        {
            var on = CxHas(kind, id);
            Image box;
            if (kind == "c")
            {
                // карты стоят без плитки, четыре в ряд (.cxtile.t-c: карта 84, отступы 10 и 12)
                box = Ui.Img("cxtile", line, (Sprite)null, new Color(0, 0, 0, 0));
                var rt = box.rectTransform;
                rt.Pref(88, 140);
                if (on && defs.Cards.ContainsKey(id))
                {
                    var v = CardView.Make(rt, new CardInst { Id = id }, defs, null, 84);
                    var vr = v.Rect;
                    vr.anchorMin = vr.anchorMax = vr.pivot = new Vector2(0.5f, 0.5f);
                    vr.anchoredPosition = new Vector2(0, 1);
                }
                else
                {
                    // неоткрытая карта лежит рубашкой вверх (.cxcardback)
                    var back = Ui.Img("back", rt, Ui.Art("ui2/back"), Color.white);
                    back.rectTransform.anchorMin = back.rectTransform.anchorMax = back.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                    back.rectTransform.sizeDelta = new Vector2(84, 84 * CardView.Ratio);
                    back.rectTransform.anchoredPosition = new Vector2(0, 1);
                    if (!back.sprite) { back.color = new Color32(0x24, 0x1D, 0x30, 0xFF); Ui.Label("q", rt, "?", 34, new Color(1, 1, 1, 0.3f), TextAnchor.MiddleCenter, true).rectTransform.Fill(); }
                }
            }
            else
            {
                // плитка .cxtile: окошко 68 (у талисмана круг 58), под ним название до двух строк
                box = Ui.Round("cxtile", line, on ? RowBg : new Color32(0x16, 0x16, 0x22, 0xE6)).Dark();
                var rt = box.rectTransform;
                rt.Pref(87.75f, kind == "h" ? 104 : 118);
                var slot = Ui.Node("slot", rt);
                if (kind == "r") slot.Box(14.9f, 16, 58, 58); else slot.Box(9.9f, 11, 68, 68);
                CxPic(slot, kind, id, defs, on, kind == "r" ? 8 : 3);
                var n = Ui.Label("name", rt, on ? CxName(kind, id, defs) : "???", 12, on ? (Color)new Color32(0xF1, 0xEA, 0xD8, 0xFF) : new Color32(0x8A, 0x80, 0x98, 0xFF), TextAnchor.UpperCenter);
                n.lineSpacing = 0.9f;
                n.rectTransform.Box(3, 82, 81.75f, kind == "h" ? 16 : 30);
                // длинное название через дефис переносится после него, как в веб-версии (overflow-wrap)
                if (on && n.preferredWidth > 81 && n.text.Contains("-") && !n.text.Contains(" ")) n.text = n.text.Replace("-", "-\n");
                n.Fit(10);
            }
            box.raycastTarget = true;
            var b = box.gameObject.AddComponent<Button>();
            b.targetGraphic = box;
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() =>
            {
                if (!CxHas(kind, id)) { Hud.Toast(Loc.Tr("Ещё не встречалось в игре")); return; }
                Sound.Sfx("click");
                open(id);
            });
        }

        static readonly Color32 CxText = new Color32(0xE4, 0xDC, 0xEE, 0xFF), CxName2 = new Color32(0xFF, 0xF4, 0xD6, 0xFF), ChipBg = new Color32(0x24, 0x1D, 0x2E, 0xFF);

        static void H4(RectTransform list, string title) => Ui.Label("h4", list, title, 18, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(1f).Pref(364, 36);
        static Text P(RectTransform list, string text, Color? c = null, int size = 15, TextAnchor align = TextAnchor.UpperLeft)
        {
            var t = Ui.Label("p", list, text, size, c ?? CxText, align);
            t.lineSpacing = 1.08f;
            t.Pref(364);
            return t;
        }

        /// <summary>Тёмные плашки в ряд с переносом (.cxstats, .cxmoves): надпись и, если есть, значок слева.</summary>
        static void Chips(RectTransform list, IEnumerable<(string icon, string text)> items, float size = 14)
        {
            RectTransform row = null;
            var used = 0f;
            foreach (var (icon, text) in items)
            {
                var probe = Ui.Label("t", list, text, Mathf.RoundToInt(size), CxName2);
                probe.horizontalOverflow = HorizontalWrapMode.Overflow;
                var w = probe.preferredWidth + (icon != null ? 38 : 22);
                if (row == null || used + w > 364)
                {
                    row = Ui.Node("chips", list);
                    row.Line(7, TextAnchor.MiddleLeft);
                    row.Pref(364, 28);
                    used = 0;
                }
                used += w + 7;
                var chip = Ui.Round("chip", row, ChipBg).Radius(11).Outline(new Color32(0x0C, 0x0A, 0x12, 0xFF), 1f);
                chip.Pref(w, 25);
                if (icon != null)
                {
                    var ic = Ui.Img("ic", chip.transform, icon);
                    ic.preserveAspect = true;
                    ic.rectTransform.Box(4, 1.5f, 22, 22);
                }
                probe.transform.SetParent(chip.transform, false);
                probe.alignment = TextAnchor.MiddleLeft;
                probe.rectTransform.Fill();
                probe.rectTransform.offsetMin = new Vector2(icon != null ? 29 : 11, 0);
            }
        }

        /// <summary>Строка-связь (.cxrow): плитка с окошком, имя, необязательная метка и текст; незнакомый — силуэт и подсказка.</summary>
        static void CxRow(RectTransform list, string kind, string id, Defs defs, string text, string label = null)
        {
            var on = CxHas(kind, id);
            var row = Ui.Node("cxrow", list);
            row.Line(12, TextAnchor.MiddleLeft, 20, 22, 6, 6);
            row.Pref(364, -1, 68);
            Ui.Frame(row, "ui2/row2", 0.41f, 7.4f, 12.3f, 4.9f, 7f);
            var slot = Ui.Node("slot", row);
            slot.Pref(54, 50);
            CxPic(slot, kind, id, defs, on, 2);
            var col = Ui.Node("text", row);
            col.Column(1, TextAnchor.MiddleLeft);
            col.Pref(256);
            var nm = Ui.Label("name", col, on ? CxName(kind, id, defs) : "???", 16, CxName2, TextAnchor.MiddleLeft, true).Shadow(1f);
            nm.horizontalOverflow = HorizontalWrapMode.Overflow;
            nm.Pref(256, 20);
            if (!string.IsNullOrEmpty(label))
            {
                // метка «Свои» / «Соперники»: золотая надпись в тонкой рамке сразу за именем
                var tag = Ui.Round("tag", nm.transform, new Color(0, 0, 0, 0)).Radius(8).Outline(new Color(216 / 255f, 169 / 255f, 74 / 255f, 0.6f), 0.8f);
                var tl = Ui.Label("t", tag.transform, label, 12, Ui.GoldHi);
                tl.horizontalOverflow = HorizontalWrapMode.Overflow;
                tl.rectTransform.Fill();
                var tr = tag.rectTransform;
                tr.anchorMin = tr.anchorMax = tr.pivot = new Vector2(0, 0.5f);
                tr.sizeDelta = new Vector2(tl.preferredWidth + 14, 16);
                tr.anchoredPosition = new Vector2(nm.preferredWidth + 7, 0);
            }
            var p = Ui.Label("p", col, on ? text : Loc.Tr(kind == "h" ? "Встреть этого героя, чтобы узнать больше" : "Встреть этого врага, чтобы узнать больше"), 14, on ? (Color)CxText : new Color32(0x9A, 0x90, 0xB0, 0xFF), TextAnchor.UpperLeft);
            p.lineSpacing = 1.02f;
            p.Pref(256);
        }

        static void Detail(RectTransform list, string kind, string id, Defs defs, Action back)
        {
            // «‹ Назад» — небольшая кнопка слева (.cxback)
            Ui.Node("gap", list).Pref(356, 18);
            var backRow = Ui.Node("backrow", list);
            backRow.Line(0, TextAnchor.MiddleLeft, 2);
            backRow.Pref(364, 44);
            Ui.Push(backRow, "‹ " + Loc.Tr("Назад"), back, true, 16, 96, 34);
            var data = defs.Data;
            var lore = data.Lore;
            if (kind == "c")
            {
                var cards = Ui.Node("cards", list);
                cards.Line(18, TextAnchor.MiddleCenter);
                cards.Pref(364, 206);
                var up = defs.Cards[id].Rarity != "status";
                foreach (var u in up ? new[] { false, true } : new[] { false })
                {
                    var slot = Ui.Node("slot", cards);
                    slot.Pref(130, 182);
                    var v = CardView.Make(slot, new CardInst { Id = id, Up = u }, defs, null, 130);
                    var vr = v.Rect;
                    vr.anchorMin = vr.anchorMax = new Vector2(0.5f, 0.5f);
                    vr.anchoredPosition = Vector2.zero;
                }
                if (up) P(list, Loc.Tr("Слева обычная, справа улучшенная"), Ui.GoldHi, 14, TextAnchor.UpperCenter);
                var cd = defs.Cards[id];
                var info = Loc.Tr(Rarity(cd.Rarity));
                if (cd.Cls != null && data.Classes.TryGetValue(cd.Cls, out var ch)) info += " · " + Loc.Tr("Карта героя: {name}", ("name", ch.Name));
                P(list, info, null, 15, TextAnchor.UpperCenter);
                var from = CodexList("e").Where(eid => defs.Enemies.TryGetValue(eid, out var e) && e.Pattern.Any(it => (it.K == "curse" && it.Card == id) || (it.Then != null && it.Then.K == "curse" && it.Then.Card == id))).ToList();
                if (from.Count > 0) P(list, Loc.Tr("Подкидывают: {list}", ("list", string.Join(", ", from.Select(x => CxHas("e", x) ? defs.Enemies[x].Name : "???")))), null, 15, TextAnchor.UpperCenter);
                return;
            }
            var head = Ui.Node("cxhead", list);
            head.Line(12, TextAnchor.UpperLeft);
            head.Pref(364);
            // портрет записи: окошко 112 в тёмной рамке, у талисмана круг 92 с кольцом редкости (.cxport)
            var portBox = Ui.Node("port", head);
            var side = kind == "r" ? 92f : 112f;
            portBox.Pref(side, side);
            if (kind != "r")
            {
                var inner = Ui.Node("in", portBox);
                inner.Fill();
                inner.offsetMin = new Vector2(7, 7);
                inner.offsetMax = new Vector2(-7, -7);
                CxPic(inner, kind, id, defs, true, 2);
                Ui.Frame(portBox, "ui2/btn_dark", 13f / 24f, 0, 0, 0, 0).transform.SetAsFirstSibling();
            }
            else CxPic(portBox, kind, id, defs, true, 14);
            var tw = 364 - 12 - side;
            var txt = Ui.Node("txt", head);
            txt.Column(3, TextAnchor.UpperLeft);
            txt.Pref(tw);
            Ui.Label("name", txt, CxName(kind, id, defs), 24, CxName2, TextAnchor.MiddleLeft, true).Shadow(1f).Pref(tw);

            if (kind == "h")
            {
                var c = data.Classes[id];
                Ui.Label("sub", txt, c.Role + " · " + c.Build, 14, Ui.GoldHi, TextAnchor.UpperLeft).Pref(tw);
                Ui.Label("about", txt, c.About, 15, CxText, TextAnchor.UpperLeft).Pref(tw);
                var bio = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "BIO")), id));
                H4(list, Loc.Tr("О герое")); P(list, Loc.Tr(Json.Str(Json.Get(bio, "who")) ?? ""));
                H4(list, Loc.Tr("Зачем в пути")); P(list, Loc.Tr(Json.Str(Json.Get(bio, "why")) ?? ""));
                H4(list, Loc.Tr("Тайна"));
                if (Has("secrets", id)) P(list, Loc.Tr(Json.Str(Json.Get(bio, "secret")) ?? ""));
                else P(list, "<i>" + Loc.Tr("Откроется после тайного разговора за этого героя") + "</i>", new Color32(0x9A, 0x90, 0xB0, 0xFF));
                var pairs = Json.Obj(Json.Get(lore, "PAIRS"));
                H4(list, Loc.Tr("Связи с героями"));
                foreach (var o in CodexList("h").Where(o => o != id))
                {
                    var key = string.CompareOrdinal(id, o) < 0 ? id + "+" + o : o + "+" + id;
                    CxRow(list, "h", o, defs, Loc.Tr(Json.Str(Json.Get(pairs, key)) ?? ""));
                }
                var att = new List<string>();
                foreach (var (k, label) in new[] { ("like", "Любят"), ("fear", "Боятся"), ("hate", "Не терпят") })
                {
                    var foes = CodexList("e").Where(eid => Json.Str(Json.Get(Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "ATT")), eid)), k)) == id).ToList();
                    if (foes.Count > 0) att.Add("<color=#" + (k == "like" ? "8DE0A0" : k == "fear" ? "9AD4FF" : "FF9A8A") + ">" + Loc.Tr(label) + ":</color> " + string.Join(", ", foes.Select(x => CxHas("e", x) ? defs.Enemies[x].Name : "???")));
                }
                if (att.Count > 0) { H4(list, Loc.Tr("Отношение врагов")); foreach (var a in att) P(list, a); }
                var friend = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "FRIEND")), id));
                if (friend != null) { H4(list, Loc.Tr("Друг в финале")); P(list, Loc.Tr(Json.Str(Json.Get(friend, "bonus")) ?? "")); }
                var dk = "dk_" + id;
                if (CxHas("e", dk))
                {
                    var dark = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "DARK")), id));
                    H4(list, Loc.Tr("Мрачная версия"));
                    P(list, "<b>" + CxName("e", dk, defs) + "</b>  «" + Loc.Tr(Json.Str(Json.Get(dark, "intro")) ?? "") + "»", null, 14);
                }
                return;
            }
            if (kind == "e")
            {
                var e = defs.Enemies[id];
                var stage = defs.Stages.FirstOrDefault(g => g.Normals.Contains(id) || g.Early.Contains(id) || g.Elites.Contains(id) || g.Boss.Contains(id));
                var final = e.Dark != null || (defs.Stages.Count > 0 && defs.Stages[defs.Stages.Count - 1].Boss.Contains(id));
                var tierName = Loc.Tr(final ? "Финал" : e.Tier == "boss" ? "Босс" : e.Tier == "elite" ? "Элита" : "Противник");
                Ui.Label("sub", txt, tierName + (stage != null && e.Dark == null ? " · " + stage.Name : ""), 14, Ui.GoldHi, TextAnchor.UpperLeft).Pref(tw);
                Ui.Label("about", txt, e.Line, 15, CxText, TextAnchor.UpperLeft).Pref(tw);
                // в длинном сюжете босс крепче своей записи, начинает с Силой и впадает в Ярость (Balance)
                var bsi = defs.Long && e.Tier == "boss" ? (final ? 2 : Math.Max(0, defs.Stages.IndexOf(stage))) : -1;
                // обычные враги и элиты крепнут с каждым уровнем: показываем, сколько HP у врага бывает там, где он встречается
                // (обычная сложность, те же правила, что при выборе дороги и в начале боя)
                int hpLo = int.MaxValue, hpHi = 0;
                if (defs.Long && bsi < 0)
                    for (var si = 0; si < defs.Stages.Count; si++)
                    {
                        var g = defs.Stages[si];
                        for (var st = g.Start; st < g.End; st++)
                        {
                            var k = st - g.Start;
                            var muls = new List<double>();
                            if ((k < 8 && g.Early.Count > 0 ? g.Early : g.Normals).Contains(id)) muls.Add(1);
                            if (g.Elites.Contains(id) && (si > 0 || k >= 6)) muls.Add(Balance.EliteHp[Math.Min(1, si)]);
                            foreach (var m in muls)
                            {
                                var v = (int)Math.Floor(e.Hp * (1 + st * Balance.HpStep) * m + 0.5);
                                hpLo = Math.Min(hpLo, v);
                                hpHi = Math.Max(hpHi, v);
                            }
                        }
                    }
                var hpShown = bsi >= 0 ? ((int)Math.Floor(e.Hp * Balance.BossHp[bsi] + 0.5)).ToString()
                    : hpHi > hpLo ? hpLo + "–" + hpHi : (hpHi > 0 ? hpHi : e.Hp).ToString();
                Ui.Node("gap", list).Pref(364, 4);
                Chips(list, new[] { ((string)null, hpShown + " HP"), ((string)null, Loc.Tr("Побед над этим врагом: {n}", ("n", Kills(id)))) });
                var say = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "SAY")), id));
                var start = Json.Get(say, "start");
                var said = start is List<object> l && l.Count > 0 ? Json.Str(l[0]) : Json.Str(start);
                if (!string.IsNullOrEmpty(said)) P(list, "<i>«" + Loc.Tr(said) + "»</i>", new Color32(0xF3, 0xD9, 0xA8, 0xFF));
                var moves = new List<string>();
                foreach (var p in e.Pattern)
                    foreach (var it in new[] { p, p.Then })
                    {
                        if (it == null) continue;
                        var k = it.K == "attack" ? (it.Leech ? "leech" : it.Hits > 0 ? "hits" : "attack") : it.K;
                        if (MoveLabel.ContainsKey(k) && !moves.Contains(k)) moves.Add(k);
                    }
                if (moves.Count > 0)
                {
                    H4(list, Loc.Tr("Приёмы"));
                    Chips(list, moves.Select(k => ("it/" + (k == "hits" ? "attack" : k), Loc.Tr(MoveLabel[k]))), 13.5f);
                }
                var traits = new[]
                {
                    bsi >= 0 && Balance.BossStr[bsi] > 0 ? Loc.Tr("Начинает бой с Силой {n}.", ("n", Balance.BossStr[bsi])) : null,
                    bsi >= 0 ? Loc.Tr("Ярость: на половине HP получает Силу +{n} и {b} защиты.", ("n", Balance.RageStr[bsi]), ("b", Balance.RageBlock[bsi])) : null,
                    e.Thorns > 0 ? Loc.Tr("Каждый ваш удар по врагу ранит вас на {n}", ("n", e.Thorns)) : null,
                    e.Nest > 0 ? Loc.Tr("Когда её HP кончится, она раскроется и выпустит новую, поменьше. Осталось внутри: {n}.", ("n", e.Nest)) : null,
                    e.Boil > 0 ? Loc.Tr("Каждый пропущенный удар добавляет +1 урона его следующей атаке (до +5). После своего хода он остывает. Поджог его не злит.") : null,
                    e.Tally > 0 ? Loc.Tr("Каждая {n}-я карта за ход: кукушка кукует и бьёт вас на 3.", ("n", e.Tally)) : null,
                    e.Plating ? Loc.Tr("Латы: защита не сгорает, а копится от хода к ходу. Поджог бьёт прямо по HP.") : null,
                    e.Alarm > 0 ? Loc.Tr("Каждый ваш Навык даёт сторожу {n} защиты до конца вашего хода. Бейте до хитростей.", ("n", e.Alarm)) : null,
                }.Where(x => x != null).ToList();
                if (traits.Count > 0) { H4(list, Loc.Tr("Особенности")); foreach (var t in traits) P(list, t); }
                var attE = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "ATT")), id));
                var rows = new List<string>();
                foreach (var (k, label) in new[] { ("like", "Любит"), ("fear", "Боится"), ("hate", "Не терпит") })
                {
                    var h = Json.Str(Json.Get(attE, k));
                    if (h != null) rows.Add("<color=#" + (k == "like" ? "8DE0A0" : k == "fear" ? "9AD4FF" : "FF9A8A") + ">" + Loc.Tr(label) + ":</color> " + (CxHas("h", h) ? CxName("h", h, defs) : "???"));
                }
                if (rows.Count > 0) { H4(list, Loc.Tr("Отношение к героям")); foreach (var r in rows) P(list, r); }
                var ties = new Fitil.Core.Lore(data).Ties.Where(t => t.a == id || t.b == id).ToList();
                if (ties.Count > 0)
                {
                    H4(list, Loc.Tr("Связи с врагами"));
                    foreach (var t in ties)
                    {
                        var other = t.a == id ? t.b : t.a;
                        CxRow(list, "e", other, defs, Loc.Tr(t.text), Loc.Tr(t.k == "kin" ? "Свои" : "Соперники"));
                    }
                }
                return;
            }
            // талисман
            var rd = defs.Relics[id];
            var heroOf = rd.Cls ?? data.Classes.Values.FirstOrDefault(h => h.Relic == id)?.Id;
            Ui.Label("sub", txt, Loc.Tr(TierLabel(rd.Tier)) + (heroOf != null && data.Classes.TryGetValue(heroOf, out var oh) ? " · " + oh.Name : ""), 14, Ui.GoldHi, TextAnchor.UpperLeft).Pref(tw);
            Ui.Label("about", txt, rd.Desc, 15, CxText, TextAnchor.UpperLeft).Pref(tw);
        }

        static readonly Dictionary<string, string> MoveLabel = new Dictionary<string, string>
        {
            ["attack"] = "приём::Атака", ["hits"] = "приём::Серия ударов", ["leech"] = "приём::Пьёт здоровье", ["block"] = "приём::Защита", ["buff"] = "приём::Усиление",
            ["debuff"] = "приём::Слабость", ["curse"] = "приём::Помехи", ["steal"] = "приём::Кража монет", ["sap"] = "приём::Сбивает ритм", ["snuff"] = "приём::Гасит Огоньки",
            ["mist"] = "приём::Туман", ["boom"] = "приём::Взрыв", ["bury"] = "приём::Заметает руку", ["frail"] = "приём::Хрупкость", ["spikes"] = "приём::Шипы", ["heal"] = "приём::Лечение",
        };

        static string Rarity(string r) =>
            r == "start" ? "Стартовая" : r == "uncommon" ? "Необычная" : r == "rare" ? "Редкая" : r == "epic" ? "Эпическая" : r == "legendary" ? "Легендарная"
            : r == "token" ? "Создаётся в бою" : r == "status" ? "Помеха" : "Обычная";

        static string TierLabel(string t) =>
            t == "uncommon" ? "Необычный" : t == "rare" ? "Редкий" : t == "epic" ? "Эпический" : t == "legendary" ? "Легендарный"
            : t == "boss" ? "Трофей босса" : t == "class" ? "Особенность героя" : "Обычный";
    }
}
