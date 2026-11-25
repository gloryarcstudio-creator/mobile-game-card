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
                var fill = Ui.Round("fill", bar.transform, new Color32(0xD9, 0xA8, 0x4A, 0xFF));
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
        public static void ShowAchievements(Action back = null)
        {
            var since = Num(A, "seenAt");
            A["seenAt"] = (double)Now;
            SaveAch();
            var all = List;
            var cats = Cats;
            var tab = cats.Count > 0 ? cats[0].id : "path";
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
            var pic = Ui.Img("art", port, ArtOf(a), done ? Color.white : new Color(0.3f, 0.3f, 0.33f, 1));
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
            text.Pref(done ? 157 : 233);
            Ui.Label("name", text, Json.Str(Json.Get(a, "name")), 17, done ? Ui.GoldHi : Ui.Paper, TextAnchor.MiddleLeft, true).Pref(done ? 157 : 233);
            var desc = (Json.Str(Json.Get(a, "desc")) ?? "").Replace("{p}", "<b>" + Fmt(p) + "/" + Fmt(goal) + "</b>");
            var d = Ui.Label("desc", text, desc, 14, Soft, TextAnchor.MiddleLeft);
            d.lineSpacing = 0.95f;
            d.Pref(done ? 157 : 233);
            if (!done && goal > 1) Bar(text, p, goal, 233, 6, false);

            if (done)
            {
                // штемпель «Получено» с датой, как в списке веб-версии
                var stamp = Ui.Node("stamp", rt);
                stamp.Pref(64, 50);
                var sl = Ui.Label("t", stamp, Loc.Tr("Получено") + "\n<size=10>" + FmtDate(Num(Got, Id(a))) + "</size>", 12, new Color32(0xE0, 0x6A, 0x4E, 0xFF), TextAnchor.MiddleCenter, true);
                sl.rectTransform.Fill();
                sl.Outline(new Color(0.88f, 0.42f, 0.31f, 0.55f), 0.8f);
                sl.rectTransform.localEulerAngles = new Vector3(0, 0, 12);
            }
        }

        // ================= статистика =================
        /// <summary>Статистика: «Итоги» — всё время и рекорды, «Забеги» — прошлые забеги с подробными итогами.</summary>
        public static void ShowStats(Action back = null)
        {
            var tab = "sum";
            var open = -1;
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
                    for (var i = 0; i < list.Count; i++) { var k = i; RunRow(s.List, list[i], maxSteps, () => { open = k; Render(); }); }
                var sub = list.Count > 1 ? Loc.Tr("последние {n}", ("n", list.Count)) : list.Count == 1 ? Loc.Tr("последний") : Loc.Tr("пока нет");
                Tab(s.Tabs, Loc.Tr("Итоги"), Loc.Tr("всё время"), tab == "sum", 177, () => { tab = "sum"; open = -1; Render(); });
                Tab(s.Tabs, Loc.Tr("Забеги"), sub, tab == "runs", 177, () => { tab = "runs"; open = -1; Render(); });
                Top(s);
            }
            Render();
        }

        static void Group(RectTransform list, string title)
        {
            Ui.Label("group", list, title, 19, Ui.Gold, TextAnchor.LowerLeft, true).Shadow(1f).Pref(356, 32);
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
            var row = Ui.Round("runrow", list, win ? RowDone : RowBg);
            row.Dark();
            var rt = row.rectTransform;
            rt.Line(10, TextAnchor.MiddleLeft, 8, 10, 6, 6);
            rt.Pref(360, -1, 64);
            var face = Ui.CircleArt("face", rt, Ui.Art("h/" + cls + "_face"));
            face.Pref(50, 50);
            var lvl = Loc.Tr("Уровень {a} из {b}", ("a", Json.Int(Json.Get(r, "lvl"))), ("b", maxSteps)) + " · " + FmtTime(Num(r, "ms"));
            Ui.Label("text", rt, "<b>" + data.Classes[cls].Name + "</b>\n<size=12>" + diff.Name + "\n" + lvl + "</size>", 15, Ui.Paper, TextAnchor.MiddleLeft).Pref(186);
            Ui.Label("res", rt, (win ? Loc.Tr("Доставлено") : Loc.Tr("Поражение")) + "\n<size=11>" + FmtDate(Num(r, "at")) + "</size>", 14,
                win ? Ui.GoldHi : new Color32(0xE0, 0x8A, 0x7E, 0xFF), TextAnchor.MiddleRight, true).Pref(90);
            row.raycastTarget = true;
            var b = row.gameObject.AddComponent<Button>();
            b.targetGraphic = row;
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
                    var t = Ui.Round("tile", line, new Color32(8, 7, 14, 128)).Outline(gold34, 1f);
                    var tr = t.rectTransform;
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
        public static void ShowCodex(Action back = null)
        {
            var tab = "h";
            string open = null;
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
                    line.Line(6, TextAnchor.UpperLeft);
                    line.Pref(356);
                    foreach (var id in part.Skip(i).Take(per)) Tile(line, kind, id, defs, open);
                }
            }
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

        static void Tile(RectTransform line, string kind, string id, Defs defs, Action<string> open)
        {
            var on = CxHas(kind, id);
            var box = Ui.Round("cxtile", line, on ? RowBg : new Color32(0x16, 0x16, 0x22, 0xE6)).Dark();
            var rt = box.rectTransform;
            rt.Pref(84, kind == "c" ? 120 : 108);
            if (kind == "c" && on && defs.Cards.ContainsKey(id))
            {
                var v = CardView.Make(rt, new CardInst { Id = id }, defs, null, 76);
                var vr = v.Rect;
                vr.anchorMin = vr.anchorMax = new Vector2(0.5f, 0.5f);
                vr.pivot = new Vector2(0.5f, 0.5f);
                vr.anchoredPosition = Vector2.zero;
            }
            else
            {
                var art = kind == "c" ? null : CxArt(kind, id);
                Image pic;
                if (kind == "c")
                {
                    pic = Ui.Img("pic", rt, art, Color.white);
                    pic.rectTransform.Box(10, 6, 64, 90);
                }
                else
                {
                    // окошко .cxpic 68×68: подложка с переходом цвета, кайма (у закрытого — серая), картинка внутри
                    var slot = Ui.Img("slot", rt, Ui.HeroBg(kind == "h" ? "cxhero" : "cx"), Color.white).Outline(on ? Ui.Gold : (Color)new Color32(0x5A, 0x50, 0x70, 0xFF), 1.2f);
                    slot.rectTransform.Box(8, 9, 68, 68);
                    slot.gameObject.AddComponent<RectMask2D>();
                    pic = Ui.Img("pic", slot.transform, art, Color.white);
                    pic.preserveAspect = true;
                    pic.rectTransform.Fill();
                    var pad = kind == "r" ? 8 : 3;
                    pic.rectTransform.offsetMin = new Vector2(pad, kind == "h" ? 0 : pad);
                    pic.rectTransform.offsetMax = new Vector2(-pad, -pad);
                }
                if (!art) pic.color = new Color(0, 0, 0, 0);
                if (!on && art) pic.color = new Color(0, 0, 0, 0.55f);   // силуэт: brightness(0) opacity(.55)
                if (kind == "c" && !on) Ui.Label("q", rt, "?", 34, new Color(1, 1, 1, 0.3f), TextAnchor.MiddleCenter, true).rectTransform.Fill();
                if (kind != "c")
                {
                    var n = Ui.Label("name", rt, on ? CxName(kind, id, defs) : "???", 12, on ? Ui.Paper : Soft);
                    n.rectTransform.Box(2, 79, 80, 26);
                    n.Fit(9);
                }
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

        static void H4(RectTransform list, string title) => Ui.Label("h4", list, title, 17, Ui.Gold, TextAnchor.LowerLeft, true).Shadow(1f).Pref(352, 28);
        static void P(RectTransform list, string text, Color? c = null, int size = 15)
        {
            var t = Ui.Label("p", list, text, size, c ?? Ui.Paper, TextAnchor.UpperLeft);
            t.lineSpacing = 1.05f;
            t.Pref(352);
        }

        static void Detail(RectTransform list, string kind, string id, Defs defs, Action back)
        {
            Ui.Push(list, "‹ " + Loc.Tr("Назад"), back, true, 16, 140, 40);
            var data = defs.Data;
            var lore = data.Lore;
            if (kind == "c")
            {
                var cards = Ui.Node("cards", list);
                cards.Line(14, TextAnchor.MiddleCenter);
                cards.Pref(352, 170);
                var up = defs.Cards[id].Rarity != "status";
                foreach (var u in up ? new[] { false, true } : new[] { false })
                {
                    var slot = Ui.Node("slot", cards);
                    slot.Pref(118, 166);
                    var v = CardView.Make(slot, new CardInst { Id = id, Up = u }, defs, null, 118);
                    var vr = v.Rect;
                    vr.anchorMin = vr.anchorMax = new Vector2(0.5f, 0.5f);
                    vr.anchoredPosition = Vector2.zero;
                }
                if (up) P(list, Loc.Tr("Слева обычная, справа улучшенная"), Soft, 13);
                var cd = defs.Cards[id];
                var info = Loc.Tr(Rarity(cd.Rarity));
                if (cd.Cls != null && data.Classes.TryGetValue(cd.Cls, out var ch)) info += " · " + Loc.Tr("Карта героя: {name}", ("name", ch.Name));
                P(list, info);
                var from = CodexList("e").Where(eid => defs.Enemies.TryGetValue(eid, out var e) && e.Pattern.Any(it => (it.K == "curse" && it.Card == id) || (it.Then != null && it.Then.K == "curse" && it.Then.Card == id))).ToList();
                if (from.Count > 0) P(list, Loc.Tr("Подкидывают: {list}", ("list", string.Join(", ", from.Select(x => CxHas("e", x) ? defs.Enemies[x].Name : "???")))));
                return;
            }
            var head = Ui.Node("cxhead", list);
            head.Line(12, TextAnchor.UpperLeft);
            head.Pref(352);
            var portBox = Ui.Node("port", head);
            portBox.Pref(96, 96);
            if (kind == "h") Ui.CircleArt("art", portBox, CxArt(kind, id)).rectTransform.Fill();
            else { var im = Ui.Img("art", portBox, CxArt(kind, id), Color.white); im.preserveAspect = true; im.rectTransform.Fill(); }
            var txt = Ui.Node("txt", head);
            txt.Column(4, TextAnchor.UpperLeft);
            txt.Pref(244);
            Ui.Label("name", txt, CxName(kind, id, defs), 21, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f).Pref(244);

            if (kind == "h")
            {
                var c = data.Classes[id];
                Ui.Label("sub", txt, c.Role + " · " + c.Build, 13, Soft, TextAnchor.UpperLeft).Pref(244);
                Ui.Label("about", txt, c.About, 14, Ui.Paper, TextAnchor.UpperLeft).Pref(244);
                var bio = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "BIO")), id));
                H4(list, Loc.Tr("О герое")); P(list, Loc.Tr(Json.Str(Json.Get(bio, "who")) ?? ""));
                H4(list, Loc.Tr("Зачем в пути")); P(list, Loc.Tr(Json.Str(Json.Get(bio, "why")) ?? ""));
                H4(list, Loc.Tr("Тайна"));
                if (Has("secrets", id)) P(list, Loc.Tr(Json.Str(Json.Get(bio, "secret")) ?? ""));
                else P(list, Loc.Tr("Откроется после тайного разговора за этого героя"), Soft);
                var pairs = Json.Obj(Json.Get(lore, "PAIRS"));
                H4(list, Loc.Tr("Связи с героями"));
                foreach (var o in CodexList("h").Where(o => o != id))
                {
                    var key = string.CompareOrdinal(id, o) < 0 ? id + "+" + o : o + "+" + id;
                    var known = CxHas("h", o);
                    P(list, "<b>" + (known ? CxName("h", o, defs) : "???") + "</b>  " + (known ? Loc.Tr(Json.Str(Json.Get(pairs, key)) ?? "") : Loc.Tr("Встреть этого героя, чтобы узнать больше")), null, 14);
                }
                var att = new List<string>();
                foreach (var (k, label) in new[] { ("like", "Любят"), ("fear", "Боятся"), ("hate", "Не терпят") })
                {
                    var foes = CodexList("e").Where(eid => Json.Str(Json.Get(Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "ATT")), eid)), k)) == id).ToList();
                    if (foes.Count > 0) att.Add("<b>" + Loc.Tr(label) + ":</b> " + string.Join(", ", foes.Select(x => CxHas("e", x) ? defs.Enemies[x].Name : "???")));
                }
                if (att.Count > 0) { H4(list, Loc.Tr("Отношение врагов")); foreach (var a in att) P(list, a, null, 14); }
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
                Ui.Label("sub", txt, tierName + (stage != null && e.Dark == null ? " · " + stage.Name : ""), 13, Soft, TextAnchor.UpperLeft).Pref(244);
                Ui.Label("about", txt, e.Line, 14, Ui.Paper, TextAnchor.UpperLeft).Pref(244);
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
                P(list, hpShown + " HP  ·  " + Loc.Tr("Побед над этим врагом: {n}", ("n", Kills(id))), Ui.GoldHi);
                var say = Json.Obj(Json.Get(Json.Obj(Json.Get(lore, "SAY")), id));
                var start = Json.Get(say, "start");
                var said = start is List<object> l && l.Count > 0 ? Json.Str(l[0]) : Json.Str(start);
                if (!string.IsNullOrEmpty(said)) P(list, "<i>«" + Loc.Tr(said) + "»</i>", Soft);
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
                    foreach (var k in moves)
                    {
                        var row = Ui.Node("move", list);
                        row.Line(8, TextAnchor.MiddleLeft);
                        row.Pref(352, 28);
                        var ic = Ui.Img("ic", row, "it/" + (k == "hits" ? "attack" : k));
                        ic.preserveAspect = true;
                        ic.Pref(24, 24);
                        Ui.Label("t", row, Loc.Tr(MoveLabel[k]), 15, Ui.Paper, TextAnchor.MiddleLeft).Pref(310);
                    }
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
                    if (h != null) rows.Add("<b>" + Loc.Tr(label) + ":</b> " + (CxHas("h", h) ? CxName("h", h, defs) : "???"));
                }
                if (rows.Count > 0) { H4(list, Loc.Tr("Отношение к героям")); foreach (var r in rows) P(list, r, null, 14); }
                var ties = new Fitil.Core.Lore(data).Ties.Where(t => t.a == id || t.b == id).ToList();
                if (ties.Count > 0)
                {
                    H4(list, Loc.Tr("Связи с врагами"));
                    foreach (var t in ties)
                    {
                        var other = t.a == id ? t.b : t.a;
                        var known = CxHas("e", other);
                        var label = Loc.Tr(t.k == "kin" ? "Свои" : "Соперники");
                        P(list, "<b>" + (known ? CxName("e", other, defs) : "???") + "</b> <i>" + label + "</i>  " + (known ? Loc.Tr(t.text) : Loc.Tr("Встреть этого врага, чтобы узнать больше")), null, 14);
                    }
                }
                return;
            }
            // талисман
            var rd = defs.Relics[id];
            var heroOf = rd.Cls ?? data.Classes.Values.FirstOrDefault(h => h.Relic == id)?.Id;
            Ui.Label("sub", txt, Loc.Tr(TierLabel(rd.Tier)) + (heroOf != null && data.Classes.TryGetValue(heroOf, out var oh) ? " · " + oh.Name : ""), 13, Soft, TextAnchor.UpperLeft).Pref(244);
            Ui.Label("about", txt, rd.Desc, 14, Ui.Paper, TextAnchor.UpperLeft).Pref(244);
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
