// Верхняя панель и панель героя вне боя (topBar и heroBar(false) в game.js), всплывающие сообщения (toast)
// и числа у портрета (showGain). Места частей — как в веб-версии с нарисованным оформлением (#app.skin).
using System;
using System.Collections;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static class Hud
    {
        static readonly Color Coin = new Color32(0xFF, 0xB8, 0x45, 0xFF);

        // ================= верхняя панель =================
        /// <summary>Монеты, название стадии со свечой пути и последний талисман (нажатие — список всех).</summary>
        public static RectTransform Top(RectTransform parent, RunGame g)
        {
            var d = g.Defs;
            var run = g.Run;
            var bar = Ui.Node("topbar", parent).Box(0, 0, 400, 80);
            var art = Ui.Img("bg", bar, "ui2/topbar");
            art.rectTransform.Fill();
            if (!art.sprite) art.color = new Color32(20, 24, 38, 230);

            var gold = Ui.Node("gold", bar).Box(41, 31, 38, 38);
            var coin = Ui.Img("coin", gold, "i/coin");
            coin.preserveAspect = true;
            coin.rectTransform.Box(10.5f, 3, 17, 17);
            var gt = Ui.Label("n", gold, run.Gold.ToString(), 14, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(1f);
            gt.rectTransform.Box(-6, 19, 50, 17);

            var si = Math.Max(0, d.StageOf(run.Step));
            var st = d.Stages[si];
            var left = st.End - run.Step;
            var pct = st.Len > 1 ? Mathf.Max(0, (float)left / (st.Len - 1)) : 0;
            var title = Ui.Label("stage", bar, st.Name, 14, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(1f);
            title.rectTransform.Box(83, 25, 188, 17);
            title.horizontalOverflow = HorizontalWrapMode.Overflow;
            var candle = Ui.Round("candle", bar, new Color32(0x0E, 0x12, 0x20, 0xFF));
            candle.rectTransform.Box(103, 46, 148, 8);
            candle.Outline(new Color32(0x8A, 0x6A, 0x2E, 0xFF), 1.2f);
            var wax = Ui.Round("wax", candle.transform, new Color32(0xF4, 0xE6, 0xC4, 0xFF));
            wax.rectTransform.anchorMin = Vector2.zero;
            wax.rectTransform.anchorMax = new Vector2(pct, 1);
            wax.rectTransform.offsetMin = wax.rectTransform.offsetMax = Vector2.zero;
            wax.gameObject.SetActive(pct > 0.001f);
            var sub = Ui.Label("sub", bar, d.Countdown(run.Step), 11, new Color(0.95f, 0.92f, 0.85f, 0.85f)).Shadow(1f);
            sub.rectTransform.Box(83, 57, 188, 14);
            sub.horizontalOverflow = HorizontalWrapMode.Overflow;

            if (run.Relics.Count > 0)
            {
                var last = run.Relics[run.Relics.Count - 1];
                var r = Ui.Img("relic", bar, "r2/" + last);
                r.preserveAspect = true;
                r.rectTransform.Box(339, 35, 29, 29);
                var hit = Ui.Hit("relics", bar, () => ShowRelics(g));
                ((RectTransform)hit.transform).Box(326, 22, 60, 56);
                var more = run.Relics.Count - 1;
                if (more > 0)
                {
                    var m = Ui.Round("more", bar, new Color32(0x1A, 0x15, 0x24, 0xFF));
                    m.rectTransform.Box(359, 53, 23, 23);
                    m.Outline(new Color32(0xD8, 0xA9, 0x4A, 0xFF), 1.2f);
                    var mt = Ui.Label("n", m.transform, "+" + more, 11, Ui.Paper, TextAnchor.MiddleCenter, true);
                    mt.rectTransform.Fill();
                }
            }
            return bar;
        }

        /// <summary>Список талисманов: картинка, название, редкость и что делает.</summary>
        public static void ShowRelics(RunGame g)
        {
            var layer = Overlay.Open(out var root);
            var col = Ui.Node("list", root).Box(16, 40, 368, 760);
            col.Column(8, TextAnchor.UpperCenter);
            var head = Ui.Label("title", col, Loc.Tr("Талисманы") + " · " + g.Run.Relics.Count, 26, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            head.Pref(368, 40);
            foreach (var id in g.Run.Relics)
            {
                var r = g.Defs.Relics[id];
                var row = Ui.Round("row", col, new Color32(0x26, 0x2D, 0x45, 0xEE));
                var rt = row.rectTransform;
                rt.Line(10, TextAnchor.MiddleLeft, 8, 10, 6, 6);
                rt.Pref(368, -1, 54);
                var ic = Ui.Img("icon", rt, "r2/" + id);
                ic.preserveAspect = true;
                ic.Pref(42, 42);
                var txt = Ui.Label("text", rt, $"<b>{r.Name}</b>\n<size=13>{r.Desc}</size>", 16, Ui.Paper, TextAnchor.MiddleLeft);
                txt.Pref(296);
            }
            var close = Ui.Push(col, Loc.Tr("Закрыть"), () => UnityEngine.Object.Destroy(layer), true, 18, 160, 46);
        }

        // ================= панель героя =================
        /// <summary>Портрет, здоровье, имя, энергия и кнопка «Колода» с числом карт.</summary>
        public static RectTransform Hero(RectTransform parent, RunGame g, Action onDeck)
        {
            var run = g.Run;
            var bar = Ui.Node("herobar", parent).Box(0, 768, 400, 92, 0);
            var bg = Ui.Img("bg", bar, "ui2/herobar");
            bg.rectTransform.Fill();
            if (!bg.sprite) bg.color = new Color32(20, 24, 38, 235);

            var face = Ui.CircleArt("face", bar, Ui.Art("h/" + run.Cls + "_face"));
            face.rectTransform.Box(9, 20, 65, 65);

            var name = Ui.Label("name", bar, g.Hero.Name, 17, Ui.Paper, TextAnchor.LowerLeft).Shadow(2f, 1f);
            name.rectTransform.Box(86, 8, 200, 24);

            var bed = Ui.Round("hp", bar, new Color32(0x2A, 0x1A, 0x20, 0xFF));
            bed.rectTransform.Box(108, 50, 110, 19);
            var pct = run.MaxHp > 0 ? Mathf.Clamp01((float)run.Hp / run.MaxHp) : 0;
            var fill = Ui.Round("fill", bed.transform, new Color32(0xD8, 0x3C, 0x34, 0xFF));
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = new Vector2(pct, 1);
            fill.rectTransform.offsetMin = fill.rectTransform.offsetMax = Vector2.zero;
            var hp = Ui.Label("n", bed.transform, run.Hp + "/" + run.MaxHp, 14, Color.white, TextAnchor.MiddleCenter, true).Shadow(1f, 1f);
            hp.rectTransform.Fill();

            var orb = Ui.Img("energy", bar, "ui2/round");
            orb.preserveAspect = true;
            orb.rectTransform.Box(235, 34, 50, 54);
            if (!orb.sprite) { orb.sprite = Ui.Circle; orb.color = new Color32(0x1F, 0x8D, 0x88, 0xFF); }
            var en = Ui.Label("n", orb.transform, MaxEnergy(run).ToString(), 23, new Color(1, 1, 1, 0.9f), TextAnchor.MiddleCenter, true).Shadow(2f, 1f);
            en.rectTransform.Fill();

            var deck = Ui.Btn("deck", bar, Loc.Tr("Колода") + "\n<size=16>" + run.Deck.Count + "</size>", () => onDeck?.Invoke(), 13);
            ((RectTransform)deck.transform).Box(296, 38, 80, 44);
            deck.GetComponentInChildren<Text>().color = new Color32(0xE8, 0xDC, 0xC0, 0xFF);
            return bar;
        }

        static int MaxEnergy(RunState run) => Balance.MaxEnergy + new[] { "hourglass", "bottomless", "crown", "sunstone" }.Count(run.HasRelic);

        // ================= сообщения =================
        static int stack;

        /// <summary>Сообщение посреди экрана: висит дольше, если длинное; несколько встают столбиком.</summary>
        public static void Toast(string text)
        {
            if (string.IsNullOrEmpty(text) || !Boot.Instance) return;
            var plate = Ui.Round("toast", Boot.Instance.Safe, new Color32(15, 18, 30, 245));
            plate.Outline(Ui.Gold, 1.5f);
            var rt = plate.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1);
            rt.pivot = new Vector2(0.5f, 1);
            var t = Ui.Label("text", rt, text, 16, Ui.Paper);
            var w = Mathf.Min(312, t.preferredWidth + 2);
            rt.Column(0, TextAnchor.MiddleCenter, 14, 14, 7, 8);
            t.Pref(w);
            var fit = plate.gameObject.AddComponent<ContentSizeFitter>();
            fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            const float h = 40;
            rt.anchoredPosition = new Vector2(0, -(470 + stack * 6) - Math.Min(stack, 4) * (h - 6));
            stack++;
            var life = Mathf.Min(6.5f, 1.5f + Mathf.Max(0, text.Length - 22) * 0.05f) + Mathf.Min(4, stack - 1) * 0.5f;
            Boot.Instance.StartCoroutine(Fade(plate.gameObject, life));
        }

        static IEnumerator Fade(GameObject go, float life)
        {
            var cg = go.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            for (float t = 0; t < 0.15f && go; t += Time.deltaTime) { cg.alpha = t / 0.15f; yield return null; }
            if (go) cg.alpha = 1;
            yield return new WaitForSeconds(Mathf.Max(0.3f, life - 0.45f));
            for (float t = 0; t < 0.3f && go; t += Time.deltaTime) { cg.alpha = 1 - t / 0.3f; yield return null; }
            if (go) UnityEngine.Object.Destroy(go);
            stack = Math.Max(0, stack - 1);
        }

        /// <summary>Сообщения, которые накопила логика забега (талисманы, покупки, новые друзья).</summary>
        public static void Flush(RunGame g)
        {
            foreach (var n in g.Notes) Toast(n);
            g.Notes.Clear();
        }

        /// <summary>Что изменилось у героя вне боя: число здоровья и монет у портрета (showGain).</summary>
        public static void Gain(RectTransform bar, int dHp, int dGold)
        {
            if (!bar) return;
            if (dHp > 0) Sound.Sfx("heal");
            if (dHp < 0) Sound.Sfx("hurt");
            if (dGold > 0) Sound.Sfx("coin");
            var y = 0f;
            if (dHp != 0) { Float(bar, dHp > 0 ? "+" + dHp : "−" + (-dHp), dHp > 0 ? Ui.Green : Ui.Red, y); y += 26; }
            if (dGold != 0) Float(bar, dGold > 0 ? RunGame.Coins(dGold) : "−" + (-dGold), Coin, y);
        }

        static void Float(RectTransform bar, string text, Color color, float dy)
        {
            var t = Ui.Label("float", bar, text, 22, color, TextAnchor.MiddleCenter, true).Outline(Ui.Ink, 1.5f);
            t.rectTransform.Box(-20, -40 - dy, 150, 30);
            Boot.Instance.StartCoroutine(Rise(t));
        }

        static IEnumerator Rise(Text t)
        {
            var rt = t.rectTransform;
            var from = rt.anchoredPosition;
            for (float k = 0; k < 1.2f && t; k += Time.deltaTime)
            {
                rt.anchoredPosition = from + new Vector2(0, 40 * Mathf.Min(1, k / 0.8f));
                var c = t.color; c.a = k < 0.8f ? 1 : 1 - (k - 0.8f) / 0.4f; t.color = c;
                yield return null;
            }
            if (t) UnityEngine.Object.Destroy(t.gameObject);
        }
    }

    /// <summary>Тёмное окно поверх экрана (showOverlay): список талисманов, выбор карты, колода.</summary>
    public static class Overlay
    {
        public static GameObject Open(out RectTransform root)
        {
            var shade = Ui.Img("overlay", Boot.Instance.Safe, null, new Color(0.03f, 0.04f, 0.08f, 0.9f));
            shade.raycastTarget = true;
            // подложка шире безопасной зоны: закрывает и вырез камеры
            shade.rectTransform.Fill();
            shade.rectTransform.offsetMin = new Vector2(-400, -400);
            shade.rectTransform.offsetMax = new Vector2(400, 400);
            root = Ui.Node("inner", shade.transform).Fill();
            root.offsetMin = new Vector2(400, 400);
            root.offsetMax = new Vector2(-400, -400);
            return shade.gameObject;
        }
    }
}
