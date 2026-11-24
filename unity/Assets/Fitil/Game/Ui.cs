// Вёрстка кодом: маленькие помощники для uGUI. Размеры в логических точках веб-версии
// (экран 400 точек в ширину, как в css/style.css), CanvasScaler сам переводит их в пиксели телефона.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static class Ui
    {
        // Шрифты веб-версии (Google Fonts, лицензия OFL — файлы рядом): Neucha для текста, Kurale для заголовков и чисел.
        // В Neucha нет знаков −, × и ≤: Unity берёт их из системного шрифта.
        static Font body, title;
        public static Font Font => body ? body : (body = Resources.Load<Font>("Fonts/Neucha") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));
        public static Font TitleFont => title ? title : (title = Resources.Load<Font>("Fonts/Kurale") ?? Font);

        public static readonly Color Gold = new Color32(0xF2, 0xD2, 0x8A, 0xFF);
        public static readonly Color GoldHi = new Color32(0xFF, 0xE0, 0x8A, 0xFF);
        public static readonly Color Night = new Color32(0x14, 0x17, 0x2A, 0xFF);
        public static readonly Color Ink = new Color32(0x1C, 0x14, 0x10, 0xFF);
        public static readonly Color Paper = new Color32(0xF1, 0xEA, 0xD8, 0xFF);
        public static readonly Color Red = new Color32(0xE0, 0x4A, 0x3E, 0xFF);
        public static readonly Color Blue = new Color32(0x9F, 0xC3, 0xFF, 0xFF);
        public static readonly Color Green = new Color32(0x8D, 0xFF, 0x9A, 0xFF);
        public static readonly Color Orange = new Color32(0xFF, 0xB0, 0x80, 0xFF);
        public static readonly Color Violet = new Color32(0xD6, 0xB0, 0xFF, 0xFF);

        public static RectTransform Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = LayerMask.NameToLayer("UI");
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        /// <summary>Растянуть на всего родителя.</summary>
        public static RectTransform Fill(this RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            return rt;
        }

        /// <summary>Положить по якорю (0..1) с размером в точках.</summary>
        public static RectTransform At(this RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        /// <summary>Положить как в вёрстке веб-версии: левый верхний угол (x, y) и размер в точках,
        /// считая от верхнего края (anchorY = 1) или от нижнего (anchorY = 0, y — от низа экрана 860).</summary>
        public static RectTransform Box(this RectTransform rt, float x, float y, float w, float h, float anchorY = 1)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0, anchorY);
            rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = anchorY >= 1 ? new Vector2(x, -y) : new Vector2(x, 860 - y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }

        /// <summary>Положить в долях родителя (как left/top/width/height в процентах).</summary>
        public static RectTransform Frac(this RectTransform rt, float l, float t, float w, float h)
        {
            rt.anchorMin = new Vector2(l, 1 - t - h);
            rt.anchorMax = new Vector2(l + w, 1 - t);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            return rt;
        }

        public static Image Img(string name, Transform parent, Sprite sprite, Color color)
        {
            var img = Node(name, parent).gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        public static Image Img(string name, Transform parent, string art) => Img(name, parent, Art(art), Color.white);

        public static Text Label(string name, Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter, bool titleFont = false)
        {
            var t = Node(name, parent).gameObject.AddComponent<Text>();
            t.font = titleFont ? TitleFont : Font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        /// <summary>Текст сам уменьшается, чтобы влезть в рамку (как ступени long/xlong в веб-версии).</summary>
        public static Text Fit(this Text t, int min)
        {
            t.resizeTextForBestFit = true;
            t.resizeTextMaxSize = t.fontSize;
            t.resizeTextMinSize = min;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            return t;
        }

        /// <summary>Тень под текстом, как text-shadow в веб-версии.</summary>
        public static T Shadow<T>(this T g, float d = 1.5f, float a = 0.85f) where T : Graphic
        {
            var s = g.gameObject.AddComponent<Shadow>();
            s.effectColor = new Color(0, 0, 0, a);
            s.effectDistance = new Vector2(0, -d);
            return g;
        }

        public static T Outline<T>(this T g, Color c, float d = 1.2f) where T : Graphic
        {
            var s = g.gameObject.AddComponent<Outline>();
            s.effectColor = c;
            s.effectDistance = new Vector2(d, -d);
            return g;
        }

        /// <summary>Прямоугольник с закруглёнными углами заданного цвета (фон плашек, полосок и кнопок).</summary>
        public static Image Round(string name, Transform parent, Color color)
        {
            var img = Img(name, parent, RoundSprite, color);
            img.type = Image.Type.Sliced;
            img.pixelsPerUnitMultiplier = 2f;
            return img;
        }

        public static Button Btn(string name, Transform parent, string text, Action onClick, int size = 22)
        {
            var rt = Node(name, parent);
            var bg = rt.gameObject.AddComponent<Image>();
            var dark = Art("ui2/btn_dark");
            if (dark)
            {
                bg.sprite = dark;
                bg.type = Image.Type.Sliced;
                bg.pixelsPerUnitMultiplier = 1.8f;   // края картинки 88 точек в высоту — на кнопке около 15
                bg.color = Color.white;
            }
            else { bg.sprite = RoundSprite; bg.type = Image.Type.Sliced; bg.color = new Color32(0x2A, 0x2F, 0x4A, 0xF0); }
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = bg;
            b.onClick.AddListener(() => onClick?.Invoke());
            var label = Label("label", rt, text, size, GoldHi, TextAnchor.MiddleCenter, true).Shadow();
            label.rectTransform.Fill();
            label.rectTransform.offsetMin = new Vector2(8, 2);
            label.rectTransform.offsetMax = new Vector2(-8, -2);
            label.Fit(10);
            return b;
        }

        /// <summary>Невидимая область нажатия.</summary>
        public static Button Hit(string name, Transform parent, Action onClick)
        {
            var rt = Node(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0);
            var b = rt.gameObject.AddComponent<Button>();
            b.transition = Selectable.Transition.None;
            b.targetGraphic = img;
            b.onClick.AddListener(() => onClick?.Invoke());
            return b;
        }

        static readonly Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();

        /// <summary>Картинка из Resources/Art (её собирает tools/unity/export_assets.py). Нет картинки — null.
        /// Картинки рамок и кнопок (ui2) режутся на девять частей, как border-image в веб-версии.</summary>
        public static Sprite Art(string path)
        {
            if (sprites.TryGetValue(path, out var s)) return s;
            var tex = Resources.Load<Texture2D>("Art/" + path);
            if (tex)
            {
                tex.wrapMode = TextureWrapMode.Clamp;
                var border = path.StartsWith("ui2/btn") ? new Vector4(tex.width * 0.18f, tex.height * 0.3f, tex.width * 0.18f, tex.height * 0.3f)
                    : path == "ui2/topbar" ? new Vector4(tex.width * 0.2f, tex.height * 0.35f, tex.width * 0.2f, tex.height * 0.35f)
                    : Vector4.zero;
                s = Sprite.Create(tex, new UnityEngine.Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, border);
            }
            sprites[path] = s;
            return s;
        }

        static Sprite round, circle;

        /// <summary>Белый скруглённый квадрат 32×32 с углами 10: основа для плашек (тянется без искажения углов).</summary>
        public static Sprite RoundSprite => round ? round : (round = MakeRound(32, 10, true));

        /// <summary>Белый круг: маска для круглых картинок карт и портретов.</summary>
        public static Sprite Circle => circle ? circle : (circle = MakeRound(128, 64, false));

        static Sprite MakeRound(int size, int r, bool sliced)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                // расстояние до ближайшего угла скругления
                float cx = Mathf.Clamp(x + 0.5f, r, size - r), cy = Mathf.Clamp(y + 0.5f, r, size - r);
                var d = Mathf.Sqrt((x + 0.5f - cx) * (x + 0.5f - cx) + (y + 0.5f - cy) * (y + 0.5f - cy));
                var a = Mathf.Clamp01(r - d + 0.5f);
                px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            var border = sliced ? new Vector4(r, r, r, r) : Vector4.zero;
            return Sprite.Create(tex, new UnityEngine.Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, border);
        }

        /// <summary>Картинка внутри круга (картинка карты, портрет).</summary>
        public static Image CircleArt(string name, Transform parent, Sprite sprite)
        {
            var maskImg = Img(name, parent, Circle, Color.white);
            maskImg.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            var art = Img("art", maskImg.transform, sprite, sprite ? Color.white : new Color(0.3f, 0.25f, 0.3f));
            art.rectTransform.Fill();
            art.preserveAspect = true;
            return maskImg;
        }

        public static void Clear(Transform t)
        {
            for (var i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }

        public static string Hex(Color c) => ColorUtility.ToHtmlStringRGB(c);
        public static string Paint(string text, Color c) => $"<color=#{Hex(c)}>{text}</color>";
    }
}
