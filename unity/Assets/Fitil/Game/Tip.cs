// Подсказка к значку (showTip в game.js): нажатие на намерение врага, статус, чары или лампу показывает
// плашку с пояснением у самого значка. Висит столько, сколько нужно на чтение, и закрывается следующим касанием.
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class Tip : MonoBehaviour
    {
        static readonly Color Bg = new Color32(15, 18, 30, 255);
        static readonly Color Ink = new Color32(0xF1, 0xEA, 0xD8, 0xFF);
        static Tip open;

        CanvasGroup group;
        RectTransform target;
        float age, life;

        public static void Close()
        {
            if (open) Destroy(open.gameObject);
            open = null;
        }

        /// <summary>Показать подсказку у значка target. title — заголовок (название статуса), может быть пустым.</summary>
        public static void Show(RectTransform target, string text, string title = null)
        {
            Close();
            if (!target || string.IsNullOrEmpty(text) || !Boot.Instance) return;
            var top = Boot.Instance.Top;
            var box = Ui.Node("tip", top);
            box.anchorMin = box.anchorMax = new Vector2(0.5f, 0.5f);
            box.pivot = new Vector2(0, 1);

            var arrow = Ui.Img("arrow", box, null, Ui.Gold);
            var plate = Ui.Round("plate", box, Bg);
            plate.Outline(Ui.Gold, 1.6f);
            var rt = plate.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = Vector2.zero;
            rt.Column(3, TextAnchor.UpperLeft, 13, 13, 8, 9);
            Text head = null;
            if (!string.IsNullOrEmpty(title)) head = Ui.Label("b", rt, title, 17, Ui.GoldHi, TextAnchor.UpperLeft, true);
            var body = Ui.Label("t", rt, text, 15, Ink, TextAnchor.UpperLeft);
            body.lineSpacing = 1.05f;
            // ширина по тексту: от 94 до 274 (120–300 в веб-версии вместе с полями)
            var w = Mathf.Clamp(Mathf.Max(body.preferredWidth, head ? head.preferredWidth : 0) + 2, 94, 274);
            body.Pref(w);
            if (head) head.Pref(w);
            var fit = plate.gameObject.AddComponent<ContentSizeFitter>();
            fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            LayoutRebuilder.ForceRebuildLayoutImmediate(rt);
            var size = rt.rect.size;
            box.sizeDelta = size;

            // где значок — в координатах верхнего слоя
            var c = new Vector3[4];
            target.GetWorldCorners(c);
            Vector2 lo = top.InverseTransformPoint(c[0]);
            Vector2 hi = top.InverseTransformPoint(c[2]);
            var area = top.rect;
            var cx = (lo.x + hi.x) / 2;
            var left = Mathf.Max(area.xMin + 8, Mathf.Min(area.xMax - 8 - size.x, cx - size.x / 2));
            // под значком, если там хватает места и значок в верхней половине (или сверху места нет)
            var fitsBelow = lo.y - 10 - size.y > area.yMin + 8;
            var fitsAbove = hi.y + 10 + size.y < area.yMax - 8;
            var below = fitsBelow && ((lo.y + hi.y) / 2 > area.center.y || !fitsAbove);
            box.localPosition = new Vector3(left, below ? lo.y - 10 : hi.y + 10 + size.y, 0);

            // стрелка к значку: золотой ромб под плашкой и тёмный поверх её края
            var ax = Mathf.Clamp(cx - left, 16, size.x - 16);
            var ay = below ? 0 : -size.y;
            Diamond(arrow.rectTransform, ax, ay, 13);
            var inner = Ui.Img("arrow2", rt, null, Bg);
            inner.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            Diamond(inner.rectTransform, ax, ay + (below ? -1.6f : 1.6f), 11);

            open = box.gameObject.AddComponent<Tip>();
            open.group = box.gameObject.AddComponent<CanvasGroup>();
            open.group.blocksRaycasts = false;
            open.group.interactable = false;
            open.group.alpha = 0;
            open.life = Mathf.Min(7f, 2.2f + (text.Length + (title ?? "").Length) * 0.045f);
            open.target = target;
        }

        static void Diamond(RectTransform d, float x, float y, float size)
        {
            d.anchorMin = d.anchorMax = new Vector2(0, 1);
            d.pivot = new Vector2(0.5f, 0.5f);
            d.sizeDelta = new Vector2(size, size);
            d.anchoredPosition = new Vector2(x, y);
            d.localRotation = Quaternion.Euler(0, 0, 45);
        }

        void Update()
        {
            age += Time.unscaledDeltaTime;
            if (group) group.alpha = Mathf.Clamp01(age / 0.16f);
            // значок исчез (экран сменился, статус сняли) — подсказка над пустым местом не висит
            if (age > life || Input.GetMouseButtonDown(0) || !target || !target.gameObject.activeInHierarchy) Close();
        }

        void OnDestroy()
        {
            if (open == this) open = null;
        }
    }
}
