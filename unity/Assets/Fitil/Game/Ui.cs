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
        static readonly Dictionary<(Sprite, int), Sprite> grays = new Dictionary<(Sprite, int), Sprite>();

        /// <summary>Серая копия картинки (CSS filter: grayscale(amount)); считается один раз и хранится.</summary>
        public static Sprite Gray(Sprite src, float amount = 1)
        {
            if (!src || amount <= 0) return src;
            var key = (src, Mathf.RoundToInt(amount * 100));
            if (grays.TryGetValue(key, out var g) && g) return g;
            try { g = MakeGray(src, amount); } catch (System.Exception) { g = src; }
            grays[key] = g;
            return g;
        }

        static Sprite MakeGray(Sprite src, float amount)
        {
            var r = src.textureRect;
            int w = Mathf.RoundToInt(r.width), h = Mathf.RoundToInt(r.height);
            var rtex = RenderTexture.GetTemporary(src.texture.width, src.texture.height, 0, RenderTextureFormat.ARGB32);
            Graphics.Blit(src.texture, rtex);
            var prev = RenderTexture.active;
            RenderTexture.active = rtex;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(r.x, r.y, w, h), 0, 0);
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rtex);
            var px = tex.GetPixels32();
            for (var i = 0; i < px.Length; i++)
            {
                var y = (byte)((px[i].r * 54 + px[i].g * 183 + px[i].b * 19) >> 8);
                px[i] = new Color32((byte)(px[i].r + (y - px[i].r) * amount), (byte)(px[i].g + (y - px[i].g) * amount), (byte)(px[i].b + (y - px[i].b) * amount), px[i].a);
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), src.pixelsPerUnit);
        }

        /// <summary>Высота строки как line-height в CSS (в долях кегля): у шрифтов своя высота строки больше, строки расходились.</summary>
        public static Text LineHeight(this Text t, float css)
        {
            var f = t.font;
            if (f && f.lineHeight > 0 && f.fontSize > 0) t.lineSpacing = Mathf.Clamp(css * f.fontSize / f.lineHeight, 0.5f, 1.3f);
            return t;
        }

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

        /// <summary>Плашка с каймой: кайма — нижняя плашка, середина лежит на ней с отступом. Компонент Outline для этого
        /// не годится: на полупрозрачной плашке он рисует её четыре раза цветом каймы и красит всю середину.</summary>
        public static Image Bordered(string name, Transform parent, Color fill, Color border, float radius, float width = 1.2f)
        {
            var edge = Round(name, parent, border).Radius(radius);
            var mid = Round("mid", edge.transform, new Color(fill.r, fill.g, fill.b, 1)).Radius(Mathf.Max(1, radius - width));
            mid.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            mid.rectTransform.Fill();
            mid.rectTransform.offsetMin = new Vector2(width, width);
            mid.rectTransform.offsetMax = new Vector2(-width, -width);
            return edge;
        }

        /// <summary>Радиус скругления плашки в точках макета (по умолчанию у Round — 5).</summary>
        public static Image Radius(this Image img, float r)
        {
            img.pixelsPerUnitMultiplier = 10f / Mathf.Max(1f, r);
            return img;
        }

        public static Button Btn(string name, Transform parent, string text, Action onClick, int size = 22, bool bare = false)
        {
            var rt = Node(name, parent);
            var bg = rt.gameObject.AddComponent<Image>();
            var dark = Art("ui2/btn_dark");
            Graphic face = bg;
            if (bare) bg.color = new Color(0, 0, 0, 0);   // рамка уже нарисована на подложке (панель героя)
            else if (dark)
            {
                // Сама кнопка — прозрачная область нажатия, а рамка-картинка выступает за её края, как border-image
                // с outset в веб-версии (у картинки прозрачные поля: без выступа кнопка выходила ниже и уже, чем надо).
                // Срез 24 пикселя картинки — на кнопке 13 точек; выступ 7 сверху и снизу, 2 по бокам.
                bg.color = new Color(0, 0, 0, 0);
                face = Frame(rt, "ui2/btn_dark", 13f / 24f, 2, 7, 2, 7);
            }
            else { bg.sprite = RoundSprite; bg.type = Image.Type.Sliced; bg.color = new Color32(0x2A, 0x2F, 0x4A, 0xF0); }
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = face;
            b.onClick.AddListener(() => onClick?.Invoke());
            var label = Label("label", rt, text, size, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.MiddleCenter, true).Shadow();   // цвет текста всех кнопок (.btn)
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

        /// <summary>Система сообщила, что памяти мало: игра забывает картинки, которых сейчас нет на экране.
        /// Те, что на экране, остаются; остальные загрузятся снова, когда понадобятся.</summary>
        public static void TrimMemory()
        {
            sprites.Clear();
            FxPlayer.Forget();
            Resources.UnloadUnusedAssets();
        }

        // Срезы рамок (border-image в css/style.css), в пикселях картинки: слева, снизу, справа, сверху
        static readonly Dictionary<string, Vector4> Borders = new Dictionary<string, Vector4>
        {
            ["ui2/mapcard"] = new Vector4(58, 156, 58, 160),
            ["ui2/scroll"] = new Vector4(125, 30, 125, 35),
            ["ui2/parch"] = new Vector4(130, 145, 130, 150),
            ["ui2/bubble"] = new Vector4(80, 100, 80, 110),
            ["ui2/panel"] = new Vector4(90, 170, 90, 250),
            ["ui2/tile"] = new Vector4(215, 40, 70, 60),
            ["ui2/row2"] = new Vector4(215, 40, 70, 60),
            ["ui2/btn_red"] = new Vector4(75, 32, 62, 45),
            ["ui2/btn_dark"] = new Vector4(30, 24, 30, 24),
        };

        /// <summary>Картинка из Resources/Art (её собирает tools/unity/export_assets.py). Нет картинки — null.
        /// Картинки рамок и кнопок (ui2) режутся на девять частей, как border-image в веб-версии.</summary>
        public static Sprite Art(string path)
        {
            if (string.IsNullOrEmpty(path)) return null;
            if (sprites.TryGetValue(path, out var s)) return s;
            var tex = Resources.Load<Texture2D>("Art/" + path);
            if (tex)
            {
                tex.wrapMode = TextureWrapMode.Clamp;
                var border = Borders.TryGetValue(path, out var b) ? b
                    : path.StartsWith("ui2/btn") ? new Vector4(tex.width * 0.18f, tex.height * 0.3f, tex.width * 0.18f, tex.height * 0.3f)
                    : path == "ui2/topbar" ? new Vector4(tex.width * 0.2f, tex.height * 0.35f, tex.width * 0.2f, tex.height * 0.35f)
                    : Vector4.zero;
                s = Sprite.Create(tex, new UnityEngine.Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, border);
            }
            sprites[path] = s;
            return s;
        }

        /// <summary>Рамка-картинка за содержимым узла, как border-image: scale — масштаб срезов (--s в css),
        /// l, t, r, b — насколько рамка выступает за край узла (outset). В раскладке не участвует.</summary>
        public static Image Frame(RectTransform box, string art, float scale, float l = 0, float t = 0, float r = 0, float b = 0)
        {
            var img = Img("frame", box, art);
            if (img.sprite) { img.type = Image.Type.Sliced; img.pixelsPerUnitMultiplier = 1f / scale; }
            else img.color = new Color32(0xEA, 0xD9, 0xB6, 0xFF);
            img.rectTransform.Fill();
            img.rectTransform.offsetMin = new Vector2(-l, -b);
            img.rectTransform.offsetMax = new Vector2(r, t);
            img.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            img.transform.SetAsFirstSibling();
            return img;
        }

        /// <summary>Столбик: дети друг под другом, высота каждого — по его содержимому.</summary>
        public static VerticalLayoutGroup Column(this RectTransform rt, float spacing, TextAnchor align = TextAnchor.UpperCenter, int l = 0, int r = 0, int t = 0, int b = 0)
        {
            var v = rt.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = spacing;
            v.childAlignment = align;
            v.padding = new RectOffset(l, r, t, b);
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = false;
            v.childForceExpandHeight = false;
            return v;
        }

        /// <summary>Строка: дети слева направо.</summary>
        public static HorizontalLayoutGroup Line(this RectTransform rt, float spacing, TextAnchor align = TextAnchor.MiddleCenter, int l = 0, int r = 0, int t = 0, int b = 0)
        {
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = spacing;
            h.childAlignment = align;
            h.padding = new RectOffset(l, r, t, b);
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = false;
            return h;
        }

        /// <summary>Размер элемента в столбике или строке (-1 — не задавать).</summary>
        public static LayoutElement Pref(this Component c, float w = -1, float h = -1, float minH = -1)
        {
            var le = c.GetComponent<LayoutElement>();
            if (!le) le = c.gameObject.AddComponent<LayoutElement>();
            if (w >= 0) le.preferredWidth = w;
            if (h >= 0) le.preferredHeight = h;
            if (minH >= 0) le.minHeight = minH;
            return le;
        }

        /// <summary>Свиток-ответ (.scroll): название и пояснение мелким шрифтом. Погашенный ответ с причиной
        /// нажимается и говорит причину (why), без причины не нажимается.</summary>
        public static Button Scroll(Transform parent, string text, string hint, Action onClick, bool off = false, Action why = null, bool glow = false, float width = 320)
        {
            var rt = Node("scroll", parent);
            var hasHint = !string.IsNullOrEmpty(hint);
            // высота свитка с пояснением — 55, как в веб-версии: строки Unity выше, поэтому они сдвинуты друг к другу
            rt.Column(hasHint ? -3 : 1, TextAnchor.MiddleCenter, 40, 40, hasHint ? 6 : 8, hasHint ? 10 : 7);
            rt.Pref(width, -1, hasHint ? 57 : 43);   // свиток с пояснением в веб-версии занимает 57 по высоте (шаг 70 при зазоре 13)
            var frame = Frame(rt, "ui2/scroll", 0.5f, 20, 7.5f, 20, 6);
            frame.raycastTarget = true;
            if (glow) frame.Outline(new Color(1f, 0.82f, 0.43f, 0.75f), 2.5f);
            var t = Label("text", rt, text, 18, Ui.Ink, TextAnchor.MiddleCenter, true);
            t.lineSpacing = 0.9f;
            t.LineHeight(1.08f);   // .scroll: line-height 1.05
            // длинный ответ делится на две ровные строки (text-wrap: balance), а не оставляет одно слово на второй
            if (text != null && !text.Contains("\n") && !text.Contains("<") && t.preferredWidth > width - 80)
            {
                // Обычный перенос, как в веб-версии: первая строка берёт столько слов, сколько влезает.
                // Ровные строки нужны только тогда, когда на второй осталось бы одно короткое слово
                var greedy = -1;
                for (var i = text.IndexOf(' '); i >= 0; i = text.IndexOf(' ', i + 1))
                {
                    t.text = text.Substring(0, i);
                    if (t.preferredWidth <= width - 80) greedy = i; else break;
                }
                t.text = text;
                var rest = greedy > 0 ? text.Substring(greedy + 1) : "";
                if (greedy > 0 && rest.IndexOf(' ') < 0 && rest.Length <= 8)
                {
                    var best = -1;
                    for (var i = text.IndexOf(' '); i >= 0; i = text.IndexOf(' ', i + 1))
                        if (best < 0 || Mathf.Abs(i - text.Length / 2f) < Mathf.Abs(best - text.Length / 2f)) best = i;
                    if (best > 0) t.text = text.Substring(0, best) + "\n" + text.Substring(best + 1);
                }
            }
            if (hasHint)
            {
                var h = Label("hint", rt, hint, 13, new Color32(0x4A, 0x38, 0x2A, 0xFF));
                h.lineSpacing = 0.95f;
            }
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = frame;
            var cg = rt.gameObject.AddComponent<CanvasGroup>();
            if (off) cg.alpha = 0.45f;
            b.onClick.AddListener(() => { if (off) why?.Invoke(); else onClick?.Invoke(); });
            if (off && why == null) b.interactable = false;
            return b;
        }

        /// <summary>Лента-свиток с крупной надписью («Победа!», «Трофей босса»).</summary>
        public static RectTransform Ribbon(Transform parent, string text)
        {
            var rt = Node("ribbon", parent);
            rt.Column(0, TextAnchor.MiddleCenter, 46, 46, 15, 13);
            rt.Pref(-1, -1, 60);
            Frame(rt, "ui2/scroll", 0.5f, 20, 7.5f, 20, 6);
            var t = Label("text", rt, text, 27, new Color32(0x5A, 0x2A, 0x26, 0xFF), TextAnchor.MiddleCenter, true);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.Pref(-1, 30);   // строка 27 × 1.1, как в веб-версии: своя высота строки у шрифта больше и лента выходила выше
            return rt;
        }

        /// <summary>Кнопка-ящик для раскладки: красная (как .btn) или тёмная (.btn.ghost).</summary>
        public static Button Push(Transform parent, string text, Action onClick, bool ghost = false, int size = 20, float w = 170, float h = 50)
        {
            var b = Btn("btn", parent, text, onClick, size);
            var img = (Image)b.targetGraphic;
            if (!ghost)
            {
                var red = Art("ui2/btn_red");
                if (red)
                {
                    // красная кнопка: масштаб .44, у большой (.btn.big) .58; выступы рамки 45, 25, 50, 16 точек картинки
                    var k = size >= 24 ? 0.58f : 0.44f;
                    img.sprite = red;
                    img.pixelsPerUnitMultiplier = 1f / k;
                    img.rectTransform.offsetMin = new Vector2(-45 * k, -16 * k);
                    img.rectTransform.offsetMax = new Vector2(50 * k, 25 * k);
                }
                var label = b.GetComponentInChildren<Text>();
                label.color = new Color32(0xFF, 0xF4, 0xD6, 0xFF);
            }
            b.Pref(w, h);
            return b;
        }

        /// <summary>Тёмная рамка с золотой каймой, как у кнопок (ui2/btn_dark): в веб-версии ею обведены плашки выбора героя,
        /// товары магазина, заголовок и вкладки окон (#app.skin .clsinfo, .sitem, .achtag, .achtabs). Без картинки остаётся плашка.</summary>
        public static Image Dark(this Image img)
        {
            var dark = Art("ui2/btn_dark");
            if (!dark) return img;
            // рамка выступает на 3 точки за плашку (border-image … / 3px), сама плашка прозрачна
            img.sprite = null;
            img.color = new Color(0, 0, 0, 0);
            Frame(img.rectTransform, "ui2/btn_dark", 13f / 24f, 3, 3, 3, 3);
            return img;
        }

        /// <summary>Кнопка в две строки: название шрифтом заголовков сверху и пояснение мелким обычным шрифтом снизу.
        /// Каждая строка в своей половине кнопки: одна надпись с переносом вылезала за рамку (у шрифтов разная высота строки).</summary>
        public static void TwoLines(Text label, string title, string sub, float left, int subSize)
        {
            var box = (RectTransform)label.transform.parent;
            label.text = title;
            label.alignment = TextAnchor.LowerLeft;
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = label.rectTransform;
            rt.anchorMin = new Vector2(0, 0.5f);
            rt.anchorMax = new Vector2(1, 1);
            rt.offsetMin = new Vector2(left, -3);
            rt.offsetMax = new Vector2(-10, -3);
            var s = Label("sub", box, sub, subSize, new Color32(0xE8, 0xDC, 0xC0, 0xFF), TextAnchor.UpperLeft);
            s.horizontalOverflow = HorizontalWrapMode.Wrap;
            s.verticalOverflow = VerticalWrapMode.Truncate;
            s.resizeTextForBestFit = true;
            s.resizeTextMaxSize = subSize;
            s.resizeTextMinSize = 8;
            s.rectTransform.anchorMin = new Vector2(0, 0);
            s.rectTransform.anchorMax = new Vector2(1, 0.5f);
            s.rectTransform.offsetMin = new Vector2(left, 5);
            s.rectTransform.offsetMax = new Vector2(-10, -2);
        }

        static Sprite round, circle;

        /// <summary>Белый скруглённый квадрат 32×32 с углами 10: основа для плашек (тянется без искажения углов).</summary>
        public static Sprite RoundSprite => round ? round : (round = MakeRound(32, 10, true));

        /// <summary>Белый круг: маска для круглых картинок карт и портретов.</summary>
        public static Sprite Circle => circle ? circle : (circle = MakeRound(128, 64, false));

        static readonly Dictionary<int, Sprite> rings = new Dictionary<int, Sprite>();

        /// <summary>Белое кольцо: thick — толщина линии в долях радиуса (штемпель достижения).</summary>
        public static Sprite Ring(float thick)
        {
            var key = Mathf.RoundToInt(thick * 1000);
            if (rings.TryGetValue(key, out var have) && have) return have;
            const int size = 128;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            float R = size / 2f, inner = R * (1 - thick);
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var d = Mathf.Sqrt((x + 0.5f - R) * (x + 0.5f - R) + (y + 0.5f - R) * (y + 0.5f - R));
                var al = Mathf.Clamp01(R - d + 0.5f) * Mathf.Clamp01(d - inner + 0.5f);
                px[y * size + x] = new Color32(255, 255, 255, (byte)(al * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            return rings[key] = Sprite.Create(tex, new UnityEngine.Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

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

        // Фон портрета героя: круговой переход, как .cp.<герой> в веб-версии (центр на 35% высоты)
        static readonly Dictionary<string, Color32[]> HeroTints = new Dictionary<string, Color32[]>
        {
            ["lamp"] = new[] { new Color32(0xF7, 0xC9, 0x8A, 255), new Color32(0xE8, 0x83, 0x6A, 255), new Color32(0x4A, 0x3F, 0x7A, 255) },
            ["courier"] = new[] { new Color32(0xBC, 0xD8, 0xEC, 255), new Color32(0x6F, 0x8F, 0xC8, 255), new Color32(0x26, 0x30, 0x4E, 255) },
            ["guard"] = new[] { new Color32(0xD8, 0xE4, 0xC0, 255), new Color32(0x7A, 0x9A, 0x6A, 255), new Color32(0x2A, 0x3A, 0x26, 255) },
            ["stoker"] = new[] { new Color32(0xFF, 0xC8, 0x9A, 255), new Color32(0xC8, 0x60, 0x3A, 255), new Color32(0x3A, 0x24, 0x30, 255) },
            ["baker"] = new[] { new Color32(0xFF, 0xE4, 0xB0, 255), new Color32(0xD8, 0x92, 0x4A, 255), new Color32(0x4A, 0x2A, 0x20, 255) },
            ["grinder"] = new[] { new Color32(0xE4, 0xE8, 0xF0, 255), new Color32(0x8A, 0x94, 0xAC, 255), new Color32(0x2A, 0x2E, 0x3A, 255) },
            ["shepherd"] = new[] { new Color32(0xF8, 0xD8, 0xE4, 255), new Color32(0xB0, 0x7A, 0xA8, 255), new Color32(0x3A, 0x24, 0x40, 255) },
            // подложки картинок: достижения по разделам (.aport.path/.fight/.collect) и плитки базы знаний (.cxpic)
            ["path"] = new[] { new Color32(0xF7, 0xC9, 0x8A, 255), new Color32(0xE8, 0x83, 0x6A, 255), new Color32(0x4A, 0x3F, 0x7A, 255) },
            ["fight"] = new[] { new Color32(0x7A, 0x5A, 0xA0, 255), new Color32(0x3A, 0x2F, 0x55, 255), new Color32(0x14, 0x12, 0x26, 255) },
            ["collect"] = new[] { new Color32(0x6F, 0xB8, 0xA8, 255), new Color32(0x2F, 0x5D, 0x62, 255), new Color32(0x15, 0x2A, 0x2E, 255) },
            ["cx"] = new[] { new Color32(0x4A, 0x3F, 0x6A, 255), new Color32(0x2A, 0x23, 0x40, 255), new Color32(0x1A, 0x15, 0x28, 255) },
            ["cxhero"] = new[] { new Color32(0xF7, 0xC9, 0x8A, 255), new Color32(0xC8, 0x70, 0x5A, 255), new Color32(0x3A, 0x2F, 0x55, 255) },
            ["sheet"] = new[] { new Color32(0x2D, 0x25, 0x44, 255), new Color32(0x14, 0x11, 0x20, 255), new Color32(0x0F, 0x0D, 0x18, 255) },
            ["herbalist"] = new[] { new Color32(0xD0, 0xF4, 0xE4, 255), new Color32(0x4A, 0x9A, 0x84, 255), new Color32(0x1A, 0x34, 0x30, 255) },
        };
        static Sprite soft;
        /// <summary>Мягкое свечение (box-shadow с размытием): скруглённая плашка, гаснущая к краям за 16 точек картинки.</summary>
        public static Sprite Soft
        {
            get
            {
                if (soft) return soft;
                const int n = 64, m = 16, rad = 6;
                var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
                var px = new Color32[n * n];
                for (var y = 0; y < n; y++)
                    for (var x = 0; x < n; x++)
                    {
                        // расстояние до скруглённого прямоугольника, отступившего на m от краёв
                        var qx = Mathf.Abs(x + 0.5f - n / 2f) - (n / 2f - m - rad);
                        var qy = Mathf.Abs(y + 0.5f - n / 2f) - (n / 2f - m - rad);
                        var d = new Vector2(Mathf.Max(qx, 0), Mathf.Max(qy, 0)).magnitude + Mathf.Min(Mathf.Max(qx, qy), 0) - rad;
                        var a = Mathf.Clamp01(1 - d / m);
                        px[y * n + x] = new Color(1, 1, 1, a * a);
                    }
                tex.SetPixels32(px);
                tex.Apply();
                return soft = Sprite.Create(tex, new UnityEngine.Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, new Vector4(24, 24, 24, 24));
            }
        }

        static Sprite fade;
        /// <summary>Затемнение книзу: сверху прозрачно, с середины и до низа ровно (linear-gradient(0, a 50%) в веб-версии).</summary>
        public static Sprite Fade
        {
            get
            {
                if (fade) return fade;
                const int n = 32;
                var tex = new Texture2D(1, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
                var px = new Color32[n];
                for (var y = 0; y < n; y++)
                {
                    var t = 1 - (y + 0.5f) / n;   // 0 сверху
                    px[y] = new Color(1, 1, 1, Mathf.Clamp01(t / 0.5f));
                }
                tex.SetPixels32(px);
                tex.Apply();
                return fade = Sprite.Create(tex, new UnityEngine.Rect(0, 0, 1, n), new Vector2(0.5f, 0.5f), 100f);
            }
        }

        static readonly Dictionary<string, Sprite> heroBgs = new Dictionary<string, Sprite>();

        public static Sprite HeroBg(string cls)
        {
            if (cls == null || !HeroTints.TryGetValue(cls, out var c)) cls = "lamp";
            if (heroBgs.TryGetValue(cls, out var sp) && sp) return sp;
            c = HeroTints[cls];
            const int n = 64;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[n * n];
            var far = Mathf.Sqrt(0.5f * 0.5f + 0.65f * 0.65f); // до дальнего угла
            for (var y = 0; y < n; y++)
                for (var x = 0; x < n; x++)
                {
                    var dx = (x + 0.5f) / n - 0.5f;
                    var dy = (1 - (y + 0.5f) / n) - 0.35f; // y в текстуре идёт снизу
                    var t = Mathf.Sqrt(dx * dx + dy * dy) / far;
                    px[y * n + x] = t < 0.5f ? Color32.Lerp(c[0], c[1], t / 0.5f) : Color32.Lerp(c[1], c[2], (t - 0.5f) / 0.5f);
                }
            tex.SetPixels32(px);
            tex.Apply();
            sp = Sprite.Create(tex, new UnityEngine.Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100f);
            heroBgs[cls] = sp;
            return sp;
        }

        /// <summary>Портрет героя в рамке со скруглением: цветной фон героя и лицо, прижатое к верху (как .cp в веб-версии).</summary>
        public static Image Portrait(string name, Transform parent, string cls, float w, float h)
        {
            var box = Round(name, parent, Color.white);
            box.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            box.rectTransform.sizeDelta = new Vector2(w, h);
            Img("bg", box.transform, HeroBg(cls), Color.white).rectTransform.Fill();
            var side = Mathf.Max(w, h);
            var face = Img("face", box.transform, Art("h/" + cls + "_face"), Color.white);
            face.rectTransform.At(new Vector2(0.5f, 1), new Vector2(0, -side / 2), new Vector2(side, side));
            return box;
        }

        /// <summary>Круглый крестик закрытия на кнопке-шаре (.sclose: ui2/round).</summary>
        public static Button CloseBtn(Transform parent, Action onClick, float size = 42)
        {
            var rt = Node("close", parent);
            rt.sizeDelta = new Vector2(size, size);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.sprite = Art("ui2/round");
            bg.preserveAspect = true;
            if (!bg.sprite) { bg.sprite = Circle; bg.color = new Color32(0x2A, 0x2F, 0x4A, 0xF0); }
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = bg;
            b.onClick.AddListener(() => onClick?.Invoke());
            var x = Label("label", rt, "✕", Mathf.RoundToInt(size * 0.48f), Paper).Shadow();
            x.rectTransform.Fill();
            x.rectTransform.offsetMin = new Vector2(0, 2);
            return b;
        }

        public static void Clear(Transform t)
        {
            for (var i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }

        public static string Hex(Color c) => ColorUtility.ToHtmlStringRGB(c);
        public static string Paint(string text, Color c) => $"<color=#{Hex(c)}>{text}</color>";
    }

    /// <summary>Наклон плашки внутри строки вёрстки: раскладка сбрасывает поворот, поэтому он ставится каждый кадр после неё.</summary>
    public sealed class Tilt : MonoBehaviour
    {
        public float Angle;
        void LateUpdate() => transform.localEulerAngles = new Vector3(0, 0, Angle);
    }
}
