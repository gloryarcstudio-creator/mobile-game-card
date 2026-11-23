// Вёрстка кодом: маленькие помощники для uGUI. Размеры в логических точках веб-версии
// (экран 400 точек в ширину, как в css/style.css), CanvasScaler сам переводит их в пиксели телефона.
using System;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static class Ui
    {
        static Font font;
        public static Font Font => font ? font : (font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

        public static readonly Color Gold = new Color32(0xF2, 0xD2, 0x8A, 0xFF);
        public static readonly Color Night = new Color32(0x14, 0x17, 0x2A, 0xFF);
        public static readonly Color Ink = new Color32(0x1C, 0x14, 0x10, 0xFF);

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

        public static Image Img(string name, Transform parent, Sprite sprite, Color color)
        {
            var img = Node(name, parent).gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        public static Text Label(string name, Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var t = Node(name, parent).gameObject.AddComponent<Text>();
            t.font = Font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        public static Button Btn(string name, Transform parent, string text, Action onClick)
        {
            var rt = Node(name, parent);
            var bg = rt.gameObject.AddComponent<Image>();
            bg.color = new Color32(0x2A, 0x2F, 0x4A, 0xF0);
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = bg;
            b.onClick.AddListener(() => onClick?.Invoke());
            var label = Label("label", rt, text, 22, Gold);
            label.rectTransform.Fill();
            return b;
        }

        /// <summary>Картинка из Resources/Art (её собирает tools/unity/export_assets.py). Нет картинки — null.</summary>
        public static Sprite Art(string path)
        {
            var tex = Resources.Load<Texture2D>("Art/" + path);
            if (!tex) return null;
            return Sprite.Create(tex, new UnityEngine.Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
        }
    }
}
