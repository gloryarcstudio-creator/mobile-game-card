// Верхняя панель и панель героя вне боя (topBar и heroBar(false) в game.js), всплывающие сообщения (toast)
// и числа у портрета (showGain). Места частей — как в веб-версии с нарисованным оформлением (#app.skin).
using System;
using System.Collections;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

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

            foreach (var id in run.Relics) Progress.Codex("r", id);
            if (run.Relics.Count > 0)
            {
                var last = run.Relics[run.Relics.Count - 1];
                var r = Ui.Img("relic", bar, "r2/" + last);
                r.preserveAspect = true;
                r.rectTransform.Box(339, 35, 29, 29);
                // нажатие на талисман говорит, что он делает; на «+N» — открывает весь список (relicIcons)
                var more = run.Relics.Count - 1;
                var def = g.Defs.Relics.TryGetValue(last, out var rd) ? rd : null;
                var hit = Ui.Hit("relic tip", bar, () =>
                {
                    Sound.Sfx("click");
                    if (def != null) Tip.Show(r.rectTransform, def.Desc, def.Name); else ShowRelics(g);
                });
                ((RectTransform)hit.transform).Box(326, 22, 60, 56);
                if (more > 0)
                {
                    var m = Ui.Round("more", bar, new Color32(0x1A, 0x15, 0x24, 0xFF));
                    m.rectTransform.Box(359, 53, 23, 23);
                    m.Outline(new Color32(0xD8, 0xA9, 0x4A, 0xFF), 1.2f);
                    var mt = Ui.Label("n", m.transform, "+" + more, 11, Ui.Paper, TextAnchor.MiddleCenter, true);
                    mt.rectTransform.Fill();
                    var list = Ui.Hit("relics", bar, () => ShowRelics(g));
                    ((RectTransform)list.transform).Box(352, 46, 38, 36);
                }
            }
            return bar;
        }

        /// <summary>Список талисманов: картинка, название, редкость и что делает.</summary>
        public static void ShowRelics(RunGame g)
        {
            var layer = Overlay.Open(out var root);
            var col = Ui.Node("list", root).Box(16, 40, 368, 780);
            col.Column(9, TextAnchor.UpperCenter);
            var head = Ui.Label("title", col, Loc.Tr("Талисманы") + " · " + g.Run.Relics.Count, 24, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            head.Pref(368, 44);
            foreach (var id in g.Run.Relics)
            {
                var r = g.Defs.Relics[id];
                // плитка с окошком для значка (.rrow): та же картинка и масштаб, что у услуг лавки, строка не ниже 68
                var rt = Ui.Node("row", col);
                rt.Line(10, TextAnchor.MiddleLeft, 20, 14, 5, 5);
                rt.Pref(356, -1, 68);
                Ui.Frame(rt, "ui2/row2", 0.41f, 7.4f, 12.3f, 4.9f, 7f);
                var slot = Ui.Node("slot", rt);
                slot.Pref(54, 42);
                var ic = Ui.Img("icon", slot, "r2/" + id);
                ic.preserveAspect = true;
                ic.rectTransform.Fill();
                ic.rectTransform.offsetMin = new Vector2(5, 0);
                ic.rectTransform.offsetMax = new Vector2(-5, 0);
                var text = Ui.Node("text", rt);
                text.Column(1, TextAnchor.MiddleLeft);
                text.Pref(248);
                var nm = Ui.Label("name", text, r.Name, 16, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1f);
                nm.Pref(248);
                TierTag(nm, 248, r.Tier, TierLabel(r.Tier) + (r.Cls != null && Boot.Instance.Defs.Data.Classes.TryGetValue(r.Cls, out var oc) ? " · " + oc.Name : ""));
                var d = Ui.Label("desc", text, r.Desc, 13, new Color(0.95f, 0.92f, 0.85f, 0.9f), TextAnchor.UpperLeft);
                d.lineSpacing = 0.95f;
                d.Pref(248);
            }
            Ui.Push(col, Loc.Tr("Закрыть"), () => UnityEngine.Object.Destroy(layer), false, 20, 130, 50);
        }

        // ================= панель героя =================
        /// <summary>Портрет, здоровье, имя, энергия и кнопка «Колода» с числом карт.</summary>
        public static RectTransform Hero(RectTransform parent, RunGame g, Action onDeck)
        {
            var run = g.Run;
            var bar = Ui.Node("herobar", parent).Box(0, 768, 400, 92, 0);
            var dim = Ui.Img("dim", bar, Ui.Fade, new Color32(14, 16, 28, 204));
            dim.rectTransform.Fill();
            var bg = Ui.Img("bg", bar, "ui2/herobar");
            bg.rectTransform.Fill();
            if (!bg.sprite) bg.color = new Color32(20, 24, 38, 235);

            var face = Ui.CircleArt("face", bar, Ui.Art("h/" + run.Cls + "_face"));
            face.rectTransform.Box(9, 20, 65, 65);

            var name = Ui.Label("name", bar, g.Hero.Name, 17, Ui.GoldHi, TextAnchor.LowerLeft, true).Shadow(2f, 1f);
            name.rectTransform.Box(86, 8, 200, 24);

            var bed = Ui.Round("hp", bar, new Color32(0x2A, 0x1A, 0x20, 0xFF)).Radius(9);
            bed.rectTransform.Box(108, 50, 110, 19);
            var pct = run.MaxHp > 0 ? Mathf.Clamp01((float)run.Hp / run.MaxHp) : 0;
            var fill = Ui.Round("fill", bed.transform, new Color32(0xD8, 0x3C, 0x34, 0xFF)).Radius(9);
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = new Vector2(pct, 1);
            fill.rectTransform.offsetMin = fill.rectTransform.offsetMax = Vector2.zero;
            var hp = Ui.Label("n", bed.transform, run.Hp + "/" + run.MaxHp, 14, Color.white).Shadow(1f, 1f);
            hp.rectTransform.Fill();

            // шар энергии нарисован на самой панели: поверх только число
            var orb = Ui.Img("energy", bar, bg.sprite ? null : Ui.Circle, bg.sprite ? new Color(0, 0, 0, 0) : (Color)new Color32(0x1F, 0x8D, 0x88, 0xFF));
            orb.rectTransform.Box(238, 38, 44, 44);
            var en = Ui.Label("n", orb.transform, MaxEnergy(run).ToString(), 23, new Color(1, 1, 1, 0.9f), TextAnchor.MiddleCenter, true).Shadow(2f, 1f);
            en.rectTransform.Fill();

            var deck = Ui.Btn("deck", bar, Loc.Tr("Колода") + "\n<size=16><b><color=#FFE08A>" + run.Deck.Count + "</color></b></size>", () => onDeck?.Invoke(), 13, bg.sprite);
            ((RectTransform)deck.transform).Box(297, 40, 76, 40);
            var deckText = deck.GetComponentInChildren<Text>();
            deckText.color = new Color32(0xE8, 0xDC, 0xC0, 0xFF);
            // .deckbtn: 12.5 и число 16, line-height 1. Подгонка под высоту кнопки уменьшала надпись почти вдвое
            deckText.resizeTextForBestFit = false;
            deckText.verticalOverflow = VerticalWrapMode.Overflow;
            deckText.horizontalOverflow = HorizontalWrapMode.Overflow;
            deckText.LineHeight(1.02f);
            return bar;
        }

        static int MaxEnergy(RunState run) => Balance.MaxEnergy + new[] { "hourglass", "bottomless", "crown", "sunstone" }.Count(run.HasRelic);

        // ================= редкость талисмана =================
        public static string TierLabel(string t) => Loc.Tr(
            t == "uncommon" ? "Необычный" : t == "rare" ? "Редкий" : t == "epic" ? "Эпический" : t == "legendary" ? "Легендарный"
            : t == "boss" ? "Трофей босса" : t == "class" ? "Особенность героя" : "Обычный");

        /// <summary>Цветная метка редкости сразу за названием талисмана (.rtier): name — надпись в одну строку шириной width.</summary>
        public static void TierTag(Text name, float width, string tier, string label)
        {
            var bg = tier == "uncommon" ? new Color32(0x8E, 0xE0, 0x9A, 0xFF) : tier == "rare" ? new Color32(0x7E, 0xC0, 0xFF, 0xFF)
                : tier == "epic" ? new Color32(0xD0, 0xA0, 0xFF, 0xFF) : tier == "legendary" ? new Color32(0xFF, 0xB6, 0x52, 0xFF)
                : tier == "boss" ? new Color32(0xF3, 0xD2, 0x7C, 0xFF) : tier == "class" ? new Color32(0x6F, 0xD8, 0xC8, 0xFF) : new Color32(0xB8, 0xB2, 0xA4, 0xFF);
            var pill = Ui.Round("rtier", name.transform, bg).Radius(6);
            var t = Ui.Label("t", pill.transform, label, 11, new Color32(0x1A, 0x15, 0x20, 0xFF));
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.rectTransform.Fill();
            float W(Text x) => x.cachedTextGeneratorForLayout.GetPreferredWidth(x.text, x.GetGenerationSettings(Vector2.zero)) / x.pixelsPerUnit;
            var pw = W(t) + 12;
            var rt = pill.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 0.5f);
            rt.sizeDelta = new Vector2(pw, 16);
            rt.anchoredPosition = new Vector2(Mathf.Min(W(name) + 6, Mathf.Max(0, width - pw)), 0);
        }

        // ================= сообщения =================
        static int stack;
        /// <summary>Где на экране встаёт сообщение (.toast top в style.css): 470, у событий и бесед 100, у награды 512, на титуле 430.</summary>
        public static float ToastTop = 470;
        // та же подсказка повторно (второе нажатие на недоступную карту) встаёт на своё место, а не второй строкой
        static readonly System.Collections.Generic.Dictionary<string, (GameObject go, int slot)> liveToasts = new System.Collections.Generic.Dictionary<string, (GameObject, int)>();
        static readonly System.Collections.Generic.HashSet<int> replaced = new System.Collections.Generic.HashSet<int>();

        /// <summary>Сообщение посреди экрана: висит дольше, если длинное; несколько встают столбиком.</summary>
        public static void Toast(string text)
        {
            if (string.IsNullOrEmpty(text) || !Boot.Instance) return;
            var plate = Ui.Round("toast", Boot.Instance.Top, new Color32(15, 18, 30, 245));
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
            var slot = stack;
            if (liveToasts.TryGetValue(text, out var old) && old.go)
            {
                slot = old.slot;
                replaced.Add(old.go.GetInstanceID());
                UnityEngine.Object.Destroy(old.go);
            }
            else stack++;
            liveToasts[text] = (plate.gameObject, slot);
            rt.anchoredPosition = new Vector2(0, -(ToastTop + slot * 6) - Math.Min(slot, 4) * (h - 6));
            var life = Mathf.Min(6.5f, 1.5f + Mathf.Max(0, text.Length - 22) * 0.05f) + Mathf.Min(4, stack - 1) * 0.5f;
            Boot.Instance.StartCoroutine(Fade(plate.gameObject, life));
        }

        // ================= крупный миг =================
        /// <summary>Сколько экран ждёт, пока идёт крупный показ карты (afterMoment).</summary>
        public static float MomentWait => Settings.Fast ? 0.52f : 1.1f;

        /// <summary>Новый талисман крупно посреди экрана, с лучами (moment, вид talis).</summary>
        public static void MomentRelic(Defs defs, string id)
        {
            if (!defs.Relics.TryGetValue(id, out var r)) return;
            Moment("talis", new Vector2(124, 124), body =>
            {
                var ring = Ui.Img("ring", body, Ui.Circle, new Color32(0xE6, 0xC4, 0x5A, 0xFF));
                ring.rectTransform.Fill();
                var disc = Ui.Img("disc", body, Ui.Circle, new Color32(0x2B, 0x25, 0x3D, 0xFF));
                disc.rectTransform.Fill();
                disc.rectTransform.offsetMin = new Vector2(4, 4);
                disc.rectTransform.offsetMax = new Vector2(-4, -4);
                var ic = Ui.Img("i", body, "r2/" + id);
                ic.preserveAspect = true;
                ic.rectTransform.At(new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(92, 92));
            }, Loc.Tr("Талисман: {name}", ("name", r.Name)));
        }

        /// <summary>Карта крупно посреди экрана: улучшена (с лучами) или убрана (темнеет и падает).</summary>
        public static void MomentCard(Defs defs, CardInst card, string label, bool gone)
        {
            const float w = 168;
            Moment(gone ? "gone" : "up", new Vector2(w, w * CardView.Ratio), body =>
            {
                var v = CardView.Make(body, card, defs, null, w);
                v.Rect.At(new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(w, w * CardView.Ratio));
            }, label);
        }

        /// <summary>Крупный миг (moment в game.js): живёт поверх экранов и сам исчезает, касаний не ловит.</summary>
        static void Moment(string kind, Vector2 size, Action<RectTransform> build, string label)
        {
            if (!Boot.Instance) return;
            var top = Boot.Instance.Top;
            var old = top.Find("moment");
            if (old) Object.Destroy(old.gameObject);
            var box = Ui.Node("moment", top);
            box.At(new Vector2(0.5f, 0.5f), new Vector2(0, 34), new Vector2(372, 320));
            var cg = box.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            cg.interactable = false;
            cg.alpha = 0;
            RectTransform rays = null;
            if (kind != "gone")
            {
                var r = Ui.Img("rays", box, Rays, new Color32(255, 220, 140, 255));
                rays = r.rectTransform;
                rays.At(new Vector2(0.5f, 0.5f), new Vector2(0, 26), new Vector2(380, 380));
            }
            var body = Ui.Node("body", box);
            body.At(new Vector2(0.5f, 0.5f), new Vector2(0, 26), size);
            build(body);
            var plate = Ui.Round("label", box, new Color32(15, 18, 30, 240));
            plate.Outline(Ui.Gold, 1.6f);
            var prt = plate.rectTransform;
            prt.anchorMin = prt.anchorMax = new Vector2(0.5f, 0.5f);
            prt.pivot = new Vector2(0.5f, 1);
            prt.anchoredPosition = new Vector2(0, 26 - size.y / 2 - 12);
            prt.Column(0, TextAnchor.MiddleCenter, 16, 16, 6, 7);
            var t = Ui.Label("b", prt, label, 18, new Color32(0xFF, 0xE9, 0xB0, 0xFF), TextAnchor.MiddleCenter, true);
            t.Pref(Mathf.Min(318, t.preferredWidth + 2));
            var fit = plate.gameObject.AddComponent<ContentSizeFitter>();
            fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            Boot.Instance.StartCoroutine(MomentLife(box.gameObject, cg, body, rays, kind == "gone"));
        }

        static IEnumerator MomentLife(GameObject box, CanvasGroup cg, RectTransform body, RectTransform rays, bool gone)
        {
            var dur = Settings.Fast ? 0.7f : 1.4f;
            var home = body.anchoredPosition;
            var bodyFade = gone ? body.gameObject.AddComponent<CanvasGroup>() : null;
            for (float age = 0; age < dur && box; age += Time.unscaledDeltaTime)
            {
                var k = age / dur;
                // mlife: проявиться, постоять, растаять
                cg.alpha = k < 0.1f ? k / 0.1f : k < 0.82f ? 1 : 1 - (k - 0.82f) / 0.18f;
                if (rays) rays.localRotation = Quaternion.Euler(0, 0, -72 * age);
                if (!gone)
                {
                    // mpop: вырасти с запасом и встать
                    var sc = k < 0.16f ? Mathf.Lerp(0.5f, 1.12f, k / 0.16f) : k < 0.28f ? Mathf.Lerp(1.12f, 1f, (k - 0.16f) / 0.12f) : 1f;
                    body.localScale = new Vector3(sc, sc, 1);
                }
                else if (k < 0.4f)
                {
                    var sc = k < 0.14f ? Mathf.Lerp(0.7f, 1f, k / 0.14f) : 1f;
                    body.localScale = new Vector3(sc, sc, 1);
                }
                else
                {
                    // mgone: карта темнеет, уменьшается и падает вбок
                    var q = (k - 0.4f) / 0.6f;
                    var sc = Mathf.Lerp(1f, 0.72f, q);
                    body.localScale = new Vector3(sc, sc, 1);
                    body.anchoredPosition = home + new Vector2(0, -46 * q);
                    body.localRotation = Quaternion.Euler(0, 0, -7 * q);
                    bodyFade.alpha = 1 - 0.6f * q;
                }
                yield return null;
            }
            if (box) Object.Destroy(box);
        }

        static Sprite rays;

        /// <summary>Лучи за находкой (.mrays): расходящиеся полосы, плотные в середине и тающие к краю.</summary>
        static Sprite Rays
        {
            get
            {
                if (rays) return rays;
                const int n = 256;
                var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
                var px = new Color32[n * n];
                for (var y = 0; y < n; y++)
                for (var x = 0; x < n; x++)
                {
                    float dx = x + 0.5f - n / 2f, dy = y + 0.5f - n / 2f;
                    var r = Mathf.Sqrt(dx * dx + dy * dy) / (n / 2f);
                    var deg = Mathf.Repeat(Mathf.Atan2(dy, dx) * Mathf.Rad2Deg, 22f);
                    // полоса 9° из каждых 22°, со сглаженными краями
                    var edge = deg <= 9f ? Mathf.Min(deg, 9f - deg) : -Mathf.Min(deg - 9f, 22f - deg);
                    var band = Mathf.Clamp01(edge * r * 2.2f + 0.5f);
                    var mask = Mathf.Clamp01((0.96f - r) / 0.68f);
                    px[y * n + x] = new Color32(255, 255, 255, (byte)(255 * 0.5f * band * mask));
                }
                tex.SetPixels32(px);
                tex.Apply();
                rays = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100);
                return rays;
            }
        }

        /// <summary>На время s секунд экран не принимает касаний (переход после крупного показа карты).</summary>
        public static void Block(float s)
        {
            if (!Boot.Instance || s <= 0) return;
            var img = Ui.Img("guard", Boot.Instance.Top, null, new Color(0, 0, 0, 0));
            img.rectTransform.Fill();
            img.raycastTarget = true;
            Object.Destroy(img.gameObject, s);
        }

        static IEnumerator Fade(GameObject go, float life)
        {
            var cg = go.AddComponent<CanvasGroup>();
            var key = go.GetInstanceID();
            cg.blocksRaycasts = false;
            for (float t = 0; t < 0.15f && go; t += Time.deltaTime) { cg.alpha = t / 0.15f; yield return null; }
            if (go) cg.alpha = 1;
            yield return new WaitForSeconds(Mathf.Max(0.3f, life - 0.45f));
            for (float t = 0; t < 0.3f && go; t += Time.deltaTime) { cg.alpha = 1 - t / 0.3f; yield return null; }
            if (go) UnityEngine.Object.Destroy(go);
            if (replaced.Remove(key)) yield break;   // место занял новый показ той же подсказки
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
            var fx = dHp > 0 || dGold > 0 ? FxOn((RectTransform)bar.parent) : null;
            if (dHp > 0) { Sound.Sfx("heal"); fx.Play("heal", "hero"); }
            if (dHp < 0) Sound.Sfx("hurt");
            var y = 0f;
            if (dHp != 0) { Float(bar, dHp > 0 ? "+" + dHp : "−" + (-dHp), dHp > 0 ? (Color)new Color32(0x8D, 0xFF, 0x9A, 0xFF) : new Color32(0xFF, 0x62, 0x50, 0xFF), y, dHp > 0 ? 34 : 24); y += 30; }
            if (dGold == 0) return;
            // монеты — следом за здоровьем, чтобы числа не легли одно на другое
            var gy = y;
            Boot.Instance.StartCoroutine(Later(dHp != 0 ? 0.64f : 0, () =>
            {
                if (!bar) return;
                if (dGold > 0) fx.Play("gold", "hero");   // звон монет звучит в самом эффекте
                Float(bar, dGold > 0 ? RunGame.Coins(dGold) : "−" + (-dGold), new Color32(0xFF, 0xB8, 0x45, 0xFF), gy, 24);
            }));
        }

        static IEnumerator Later(float s, Action a)
        {
            if (s > 0) yield return new WaitForSeconds(s);
            a();
        }

        /// <summary>Слой эффектов поверх экрана вне боя (лечение, монеты, находки): цель hero — портрет на панели героя.</summary>
        public static FxPlayer FxOn(RectTransform root)
        {
            var have = root.GetComponentInChildren<FxPlayer>();
            if (have) { have.transform.SetAsLastSibling(); return have; }
            var layer = Ui.Node("fx", root);
            layer.Fill();
            var fx = FxPlayer.On(layer);
            if (root.Find("herobar/face") is RectTransform face) fx.Targets["hero"] = face;
            return fx;
        }

        // Вне боя число героя всплывает правее его имени, над полоской здоровья (.float.hf, floatlow в style.css)
        static void Float(RectTransform bar, string text, Color color, float dy, int size)
        {
            var t = Ui.Label("float", bar, text, size, color, TextAnchor.MiddleCenter, true).Outline(Ui.Ink, 2f);
            t.fontStyle = FontStyle.Bold;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.rectTransform.Box(100, -4 - dy, 200, 36);
            Boot.Instance.StartCoroutine(Rise(t));
        }

        static IEnumerator Rise(Text t)
        {
            var rt = t.rectTransform;
            var from = rt.anchoredPosition;
            for (float k = 0; k < 1.2f && t; k += Time.deltaTime)
            {
                rt.anchoredPosition = from + new Vector2(0, 30 * Mathf.Min(1, k / 0.8f));
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
            // окно поверх экрана сплошное (#overlay #080a12, v141): надписи экрана под ним не проступают
            var shade = Ui.Img("overlay", Boot.Instance.Top, null, new Color32(0x08, 0x0A, 0x12, 0xFF));
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
