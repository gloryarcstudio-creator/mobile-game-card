// Заставка при первом запуске (goCinema в game.js): чёрный экран, в полосе посередине медленно едет картинка,
// под ней по одной проступают строки. Касание листает сцену, «Пропустить» закрывает. Пересмотреть — в настройках.
// Сцены — STORY.cinema: фон, откуда и куда едет кадр ([x, y, увеличение]), строки, тени врагов.
using System;
using System.Collections;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class Cinema : MonoBehaviour
    {
        const string Key = "lastray.cinema";
        const float BW = 400, BH = 236, BandTop = 196;

        RectTransform root, band, cap;
        CanvasGroup fade;
        List<object> scenes;
        Action done;
        int i = -1;
        bool over;
        Coroutine timer;

        public static bool Seen => SaveStore.Read(Key) == "1";

        public static bool Has(Defs defs)
        {
            var list = Json.Arr(Json.Get(defs.Story, "cinema"));
            if (list == null || list.Count == 0) return false;
            foreach (var s in list) if (!Ui.Art("bg/" + Json.Str(Json.Get(Json.Obj(s), "bg")))) return false;
            return true;
        }

        public static Cinema Play(Defs defs, Action done)
        {
            var go = new GameObject("Cinema");
            go.transform.SetParent(Boot.Instance.transform, false);
            var c = go.AddComponent<Cinema>();
            c.scenes = Json.Arr(Json.Get(defs.Story, "cinema")) ?? new List<object>();
            c.done = done;
            c.Build();
            return c;
        }

        void OnDestroy()
        {
            if (root) Destroy(root.gameObject);
        }

        void Build()
        {
            Sound.Music("title");
            // во весь экран, под вырезом камеры тоже
            root = Ui.Node("cinema", Boot.Instance.Top).Fill();
            root.offsetMin = new Vector2(-400, -400);
            root.offsetMax = new Vector2(400, 400);
            var bg = Ui.Img("black", root, null, new Color32(0x05, 0x06, 0x0B, 0xFF));
            bg.rectTransform.Fill();
            bg.raycastTarget = true;
            fade = root.gameObject.AddComponent<CanvasGroup>();
            var tap = root.gameObject.AddComponent<Button>();
            tap.transition = Selectable.Transition.None;
            tap.targetGraphic = bg;
            tap.onClick.AddListener(() => { if (!over) Show(); });

            var inner = Ui.Node("inner", root).Fill();
            inner.offsetMin = new Vector2(400, 400);
            inner.offsetMax = new Vector2(-400, -400);
            var frame = Ui.Node("frame", inner).Box(0, 0, 400, 860);
            frame.anchorMin = frame.anchorMax = new Vector2(0.5f, 0.5f);
            frame.pivot = new Vector2(0.5f, 0.5f);
            frame.anchoredPosition = Vector2.zero;
            Rule(frame, BandTop - 8);
            Rule(frame, BandTop + BH + 8);
            band = Ui.Node("band", frame).Box(0, BandTop, BW, BH);
            band.gameObject.AddComponent<RectMask2D>();
            cap = Ui.Node("cap", frame).Box(26, 470, 348, 240);
            var skip = Ui.Push(inner, Loc.Tr("Пропустить"), Finish, true, 16, 160, 40);
            ((RectTransform)skip.transform).At(new Vector2(0.5f, 0), new Vector2(0, 64), new Vector2(160, 40));
            StartCoroutine(FadeIn());
            Show();
        }

        static void Rule(RectTransform frame, float y)
        {
            var l = Ui.Img("rule", frame, null, new Color(0.85f, 0.66f, 0.29f, 0.6f));
            l.rectTransform.Box(24, y, 352, 1);
        }

        IEnumerator FadeIn()
        {
            for (float t = 0; t < 0.6f; t += Time.unscaledDeltaTime) { fade.alpha = t / 0.6f; yield return null; }
            fade.alpha = 1;
        }

        void Show()
        {
            if (over) return;
            if (timer != null) StopCoroutine(timer);
            i++;
            if (i >= scenes.Count) { Finish(); return; }
            var sc = Json.Obj(scenes[i]);
            var lines = Json.Arr(Json.Get(sc, "lines")) ?? new List<object>();
            var dur = lines.Count > 1 ? 6.4f : 4.6f;
            var sprite = Ui.Art("bg/" + Json.Str(Json.Get(sc, "bg")));
            var h = sprite ? BW * sprite.texture.height / sprite.texture.width : 715;
            var old = new List<GameObject>();
            foreach (Transform c in band) old.Add(c.gameObject);
            var layer = Ui.Node("layer", band).Fill();
            var cg = layer.gameObject.AddComponent<CanvasGroup>();
            cg.alpha = 0;
            var img = Ui.Img("img", layer, sprite, Color.white);
            var rt = img.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.sizeDelta = new Vector2(BW, h);
            var shadows = Json.Arr(Json.Get(sc, "shadows"));
            var shades = new List<(RectTransform rt, Image img, float delay)>();
            if (shadows != null)
                for (var k = 0; k < shadows.Count && k < 3; k++)
                {
                    var s = Ui.Img("shadow", layer, "e/" + Json.Str(shadows[k]));
                    s.preserveAspect = true;
                    // как .cine-shadow.s0..s2: слева, посередине (крупнее) и справа (отражённая)
                    var sh = k == 1 ? 168f : 124f;
                    var cx = k == 0 ? 20 + sh / 2 : k == 1 ? 116 + sh / 2 : BW - 20 - sh / 2;
                    s.rectTransform.anchorMin = s.rectTransform.anchorMax = new Vector2(0, 0);
                    s.rectTransform.pivot = new Vector2(0.5f, 0);
                    s.rectTransform.sizeDelta = new Vector2(sh, sh);
                    s.rectTransform.anchoredPosition = new Vector2(cx, -30);
                    if (k == 2) s.rectTransform.localScale = new Vector3(-1, 1, 1);
                    s.color = new Color(0.5f, 0.45f, 0.6f, 0);
                    shades.Add((s.rectTransform, s, k == 0 ? 0.9f : k == 1 ? 1.9f : 2.8f));
                }
            StartCoroutine(Run(layer, cg, rt, h, Vec(Json.Get(sc, "from")), Vec(Json.Get(sc, "to")), dur + 1.2f, shades, old));

            Ui.Clear(cap);
            for (var k = 0; k < lines.Count; k++)
            {
                var t = Ui.Label("line", cap, Loc.Tr(Json.Str(lines[k]) ?? ""), 21, new Color32(0xF4, 0xEA, 0xD2, 0xFF));
                t.rectTransform.Box(0, k * 62, 348, 58);
                t.color = new Color(t.color.r, t.color.g, t.color.b, 0);
                StartCoroutine(Line(t, 0.5f + k * 2.3f));
            }
            timer = StartCoroutine(Next(dur));
        }

        static Vector3 Vec(object v)
        {
            var a = Json.Arr(v);
            return a != null && a.Count >= 3 ? new Vector3((float)Json.Num(a[0]), (float)Json.Num(a[1]), (float)Json.Num(a[2])) : new Vector3(0.5f, 0.5f, 1);
        }

        /// <summary>Где стоит картинка, чтобы точка (fx, fy) оказалась в середине кадра при увеличении k.</summary>
        static Vector2 Place(Vector3 p, float h)
        {
            var k = p.z;
            var x = Mathf.Min(0, Mathf.Max(BW - BW * k, BW / 2 - p.x * BW * k));
            var y = Mathf.Min(0, Mathf.Max(BH - h * k, BH / 2 - p.y * h * k));
            return new Vector2(x, y);
        }

        IEnumerator Run(RectTransform layer, CanvasGroup cg, RectTransform img, float h, Vector3 from, Vector3 to, float dur,
            List<(RectTransform rt, Image img, float delay)> shades, List<GameObject> old)
        {
            var p0 = Place(from, h);
            var p1 = Place(to, h);
            for (float t = 0; layer && t < dur; t += Time.unscaledDeltaTime)
            {
                var k = t / dur;
                var pos = Vector2.Lerp(p0, p1, k);
                var sc = Mathf.Lerp(from.z, to.z, k);
                img.localScale = new Vector3(sc, sc, 1);
                img.anchoredPosition = new Vector2(pos.x, -pos.y);
                cg.alpha = Mathf.Min(1, t / 1f);
                if (t >= 1f) foreach (var o in old) if (o) Destroy(o);
                foreach (var s in shades)
                {
                    var q = Mathf.Clamp01((t - s.delay) / 2.4f);
                    var e = 1 - (1 - q) * (1 - q);
                    s.img.color = new Color(0.5f, 0.45f, 0.6f, e);
                    s.rt.anchoredPosition = new Vector2(s.rt.anchoredPosition.x, -30 + 30 * e);
                }
                yield return null;
            }
        }

        static IEnumerator Line(Text t, float delay)
        {
            yield return new WaitForSecondsRealtime(delay);
            var y0 = t.rectTransform.anchoredPosition.y;
            for (float k = 0; t && k < 1.1f; k += Time.unscaledDeltaTime)
            {
                var q = 1 - Mathf.Pow(1 - k / 1.1f, 2);
                t.color = new Color(t.color.r, t.color.g, t.color.b, q);
                t.rectTransform.anchoredPosition = new Vector2(t.rectTransform.anchoredPosition.x, y0 - 6 * (1 - q));
                yield return null;
            }
            if (t) t.color = new Color(t.color.r, t.color.g, t.color.b, 1);
        }

        IEnumerator Next(float dur)
        {
            yield return new WaitForSecondsRealtime(dur);
            Show();
        }

        void Finish()
        {
            if (over) return;
            over = true;
            if (timer != null) StopCoroutine(timer);
            SaveStore.Write(Key, "1");
            StartCoroutine(Out());
        }

        IEnumerator Out()
        {
            for (float t = 0; t < 0.55f; t += Time.unscaledDeltaTime) { fade.alpha = 1 - t / 0.55f; yield return null; }
            var d = done;
            Destroy(gameObject);
            d?.Invoke();
        }
    }
}
