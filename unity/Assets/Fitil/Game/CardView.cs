// Карта на экране (cardHTML в game.js): нарисованная рамка своего типа, камень цены, название,
// круглая картинка, описание и подпись типа. Места частей — доли рамки из css/style.css (#app.skin .card.*),
// их считает tools/art/build_ui.py для веб-версии.
using System.Collections.Generic;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class CardView : MonoBehaviour
    {
        public const float W = 104f;          // ширина карты в руке, как --w в веб-версии
        public const float Ratio = 1.4f;       // высота = ширина × 1.4 (нарисованные рамки)

        struct Layout
        {
            public float[] F, G, T, A, D; // рамка, камень цены, название, картинка, описание: left, top, width, height (доли)
            public float YL, YT;          // центр подписи типа
        }

        static readonly Dictionary<string, Layout> Layouts = new Dictionary<string, Layout>
        {
            ["atk"] = new Layout { F = new[] { -0.0026f, -0.0092f, 1.0051f, 1.0101f }, G = new[] { 0.0359f, 0f, 0.1897f, 0.1359f }, T = new[] { 0.2410f, 0.0386f, 0.5872f, 0.1561f }, A = new[] { 0.2564f, 0.2268f, 0.4872f, 0.3489f }, D = new[] { 0.0641f, 0.6152f, 0.8718f, 0.2755f }, YL = 0.5006f, YT = 0.9458f },
            ["skill"] = new Layout { F = new[] { -0.0481f, -0.0093f, 1.0747f, 1.0677f }, G = new[] { 0.0089f, 0f, 0.1975f, 0.1447f }, T = new[] { 0.2241f, 0.0445f, 0.7139f, 0.1113f }, A = new[] { 0.2241f, 0.1874f, 0.5772f, 0.4230f }, D = new[] { 0.1582f, 0.6735f, 0.7595f, 0.2542f }, YL = 0.5f, YT = 0.9722f },
            ["charm"] = new Layout { F = new[] { -0.0024f, 0f, 1.0049f, 1.0036f }, G = new[] { 0.0378f, 0.0416f, 0.1561f, 0.1158f }, T = new[] { 0.2341f, 0.0588f, 0.5341f, 0.0860f }, A = new[] { 0.2463f, 0.2054f, 0.5073f, 0.3765f }, D = new[] { 0.1463f, 0.6190f, 0.7341f, 0.2281f }, YL = 0.5f, YT = 0.9367f },
            ["status"] = new Layout { F = new[] { -0.0961f, -0.0360f, 1.1006f, 1.0658f }, G = new[] { -0.0691f, -0.0288f, 0.2342f, 0.1605f }, T = new[] { 0.1952f, 0.0360f, 0.7432f, 0.1492f }, A = new[] { 0.1682f, 0.2212f, 0.6607f, 0.4527f }, D = new[] { 0.265f, 0.688f, 0.66f, 0.23f }, YL = 0.4955f, YT = 0.9568f },
        };

        static readonly Dictionary<string, string> TypeLabel = new Dictionary<string, string>
        {
            ["atk"] = "Атака", ["skill"] = "Навык", ["charm"] = "Чары", ["status"] = "Помеха",
        };

        // свечение по редкости (box-shadow в веб-версии)
        static readonly Dictionary<string, Color> Glow = new Dictionary<string, Color>
        {
            ["uncommon"] = new Color(0.43f, 0.86f, 0.55f, 0.55f),
            ["rare"] = new Color(0.43f, 0.7f, 1f, 0.7f),
            ["epic"] = new Color(0.75f, 0.5f, 1f, 0.8f),
            ["legendary"] = new Color(1f, 0.63f, 0.2f, 0.9f),
        };

        // камешек редкости перед подписью типа (.gem.g-*)
        static readonly Dictionary<string, Color> Gems = new Dictionary<string, Color>
        {
            ["common"] = new Color32(0xD0, 0xCB, 0xC0, 0xFF),
            ["uncommon"] = new Color32(0x6E, 0xD8, 0x82, 0xFF),
            ["rare"] = new Color32(0x6E, 0xB4, 0xF0, 0xFF),
            ["epic"] = new Color32(0xC0, 0x82, 0xF0, 0xFF),
            ["legendary"] = new Color32(0xFF, 0xB8, 0x50, 0xFF),
        };

        public CardInst Card { get; private set; }
        public RectTransform Rect => (RectTransform)transform;
        Text cost, desc;
        Image glow;

        /// <summary>Описания карт текущего языка (cardtext.&lt;lang&gt;.json).</summary>
        public static Dictionary<string, CardTextEntry> Texts;

        public static CardView Make(Transform parent, CardInst card, Defs defs, Combat combat, float width = W)
        {
            var rt = Ui.Node("card " + card.Id, parent);
            rt.sizeDelta = new Vector2(width, width * Ratio);
            var v = rt.gameObject.AddComponent<CardView>();
            v.Build(card, defs, combat, width);
            if (RunFlow.Current != null) Progress.Codex("c", card.Id);   // карта попалась на глаза в забеге — открыта в базе знаний
            return v;
        }

        const int Super = 3;
        float descEm;

        Text SuperLabel(string name, float[] box, float width, float height, float padX, string text, float size, Color color, bool titleFont)
        {
            var holder = Ui.Node(name, transform);
            holder.Frac(box[0], box[1], box[2], box[3]);
            var t = Ui.Label("t", holder, text, Mathf.RoundToInt(size * Super), color, TextAnchor.MiddleCenter, titleFont).Shadow(Super).Fit(5 * Super);
            var rt = t.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2((box[2] * width - padX * 2) * Super, box[3] * height * Super);
            rt.localScale = Vector3.one / Super;
            return t;
        }

        void Build(CardInst card, Defs defs, Combat combat, float width)
        {
            Card = card;
            var cd = defs.Cards[card.Id];
            var type = Layouts.ContainsKey(cd.Type) ? cd.Type : "skill";
            var L = Layouts[type];
            var em = width / 10f;

            // свечение редкости под картой
            if (Glow.TryGetValue(cd.Rarity ?? "", out var gc))
            {
                // размытое свечение вокруг карты (box-shadow 0 0 1em), а не плашка с резким краем
                glow = Ui.Img("glow", transform, Ui.Soft, gc);
                glow.type = Image.Type.Sliced;
                glow.pixelsPerUnitMultiplier = 16f / em;
                glow.rectTransform.Fill();
                glow.rectTransform.offsetMin = new Vector2(-em * 0.9f, -em * 0.9f);
                glow.rectTransform.offsetMax = new Vector2(em * 0.9f, em * 0.9f);
            }

            var art = Ui.CircleArt("art", transform, Ui.Art("c/" + card.Id));
            art.rectTransform.Frac(L.A[0], L.A[1], L.A[2], L.A[3]);

            var frameSprite = Ui.Art("ui2/f_" + type);
            var frame = Ui.Img("frame", transform, frameSprite, frameSprite ? Color.white : new Color(0.17f, 0.14f, 0.2f));
            frame.rectTransform.Frac(L.F[0], L.F[1], L.F[2], L.F[3]);
            art.transform.SetAsLastSibling();   // окошко рамки закрашено: картинка карты лежит поверх рамки, как в веб-версии

            var name = cd.Name + (card.Up ? "+" : "");
            // Надписи карты набраны втрое крупнее и уменьшены: кегль получается дробным, как в веб-версии (8.6 точки
            // на маленькой карте), а не округлённым до целого. Иначе на картах в окне колоды строки переносились раньше.
            var hgt = width * Ratio;
            var title = SuperLabel("title", L.T, width, hgt, em * 0.25f, name, em * (name.Length > 12 ? 0.84f : 0.98f), card.Up ? new Color32(0xE4, 0xFF, 0xD8, 0xFF) : new Color32(0xFB, 0xEF, 0xD2, 0xFF), true);

            // Название как .ctitle в веб-версии: кегль .98em (длинное .84em), строки вплотную (line-height 1). На вторую строку
            // оно уходит, только когда две строки помещаются в плашку названия (атаки и помехи); на низкой плашке навыков
            // и чар название остаётся в одну строку и мельчает, пока не войдёт в ширину. Иначе текст вылезал за рамку.
            title.resizeTextForBestFit = false;
            title.verticalOverflow = VerticalWrapMode.Overflow;
            title.LineHeight(1.04f);
            var titleW = title.rectTransform.sizeDelta.x;
            var titleH = title.rectTransform.sizeDelta.y;
            var steps = name.Length > 12 ? new[] { 0.84f, 0.75f, 0.66f, 0.58f, 0.5f } : new[] { 0.98f, 0.84f, 0.75f, 0.66f, 0.58f, 0.5f };
            var words = name.Split(' ');
            title.horizontalOverflow = HorizontalWrapMode.Overflow;
            foreach (var st in steps)
            {
                title.fontSize = Mathf.RoundToInt(em * st * Super);
                var gs = title.GetGenerationSettings(Vector2.zero);
                float W(string x) => title.cachedTextGeneratorForLayout.GetPreferredWidth(x, gs) / title.pixelsPerUnit;
                if (W(name) <= titleW) break;                                  // вся строка входит
                if (words.Length < 2 || title.fontSize * 2 * 1.04f > titleH * 1.06f) continue;   // две строки в плашку не входят
                // делим на две строки там, где они ровнее всего, и проверяем обе
                var best = 0; var bestW = float.MaxValue;
                for (var i = 1; i < words.Length; i++)
                {
                    var w2 = Mathf.Max(W(string.Join(" ", words, 0, i)), W(string.Join(" ", words, i, words.Length - i)));
                    if (w2 < bestW) { bestW = w2; best = i; }
                }
                if (bestW <= titleW) { title.text = string.Join(" ", words, 0, best) + "\n" + string.Join(" ", words, best, words.Length - best); break; }
            }

            cost = Ui.Label("cost", transform, "", Mathf.RoundToInt(em * 1.55f), Color.white, TextAnchor.MiddleCenter, true).Shadow(1.5f, 1f);
            cost.rectTransform.Frac(L.G[0], L.G[1], L.G[2], L.G[3]);

            descEm = em;
            desc = SuperLabel("desc", L.D, width, hgt, 0, "", em, Ui.Paper, false);
            desc.lineSpacing = 0.95f;

            // подпись типа (.ctype): у атаки — прямо на нарисованной ленте, у остальных — тёмная плашка с золотой каймой.
            // Перед словом камешек редкости (.gem): ромб своего цвета.
            var label = Loc.Tr(TypeLabel.TryGetValue(cd.Type, out var tl) ? tl : "Навык");
            var hasGem = Gems.TryGetValue(cd.Rarity ?? "", out var gemColor);
            var fs = Mathf.Max(1, Mathf.RoundToInt(em * 0.78f));
            var gemW = hasGem ? em * 0.95f : 0;
            var ty = Ui.Label("type", transform, label, fs, type == "atk" ? new Color32(0x3A, 0x24, 0x18, 0xFF) : new Color32(0xF1, 0xE4, 0xC4, 0xFF));
            ty.horizontalOverflow = HorizontalWrapMode.Overflow;
            var textW = ty.preferredWidth;
            var plateW = textW + gemW + em * 1.3f;
            ty.rectTransform.anchorMin = ty.rectTransform.anchorMax = new Vector2(L.YL, 1 - L.YT);
            ty.rectTransform.sizeDelta = new Vector2(textW + 2, em * 1.2f);
            ty.rectTransform.anchoredPosition = new Vector2(gemW / 2, 0);
            if (type != "atk")
            {
                var plate = Ui.Round("plate", transform, new Color32(18, 14, 26, 230)).Radius(em * 0.6f).Outline(new Color32(0xB8, 0x89, 0x3A, 0xFF), Mathf.Max(0.6f, em * 0.1f));
                plate.rectTransform.anchorMin = plate.rectTransform.anchorMax = ty.rectTransform.anchorMin;
                plate.rectTransform.sizeDelta = new Vector2(plateW, em * 1.2f);
                plate.transform.SetSiblingIndex(ty.transform.GetSiblingIndex());
            }
            if (hasGem)
            {
                var gem = Ui.Img("gem", transform, null, gemColor).Outline(Ui.Ink, Mathf.Max(0.5f, em * 0.08f));
                gem.rectTransform.anchorMin = gem.rectTransform.anchorMax = ty.rectTransform.anchorMin;
                gem.rectTransform.sizeDelta = new Vector2(em * 0.56f, em * 0.56f);
                gem.rectTransform.anchoredPosition = new Vector2(-(textW + gemW) / 2 + em * 0.4f, 0);
                gem.rectTransform.localEulerAngles = new Vector3(0, 0, 45);
            }

            Refresh(defs, combat);
        }

        /// <summary>Цена и описание зависят от боя (энергия, Огоньки, талисманы): обновляются при каждой отрисовке руки.</summary>
        public void Refresh(Defs defs, Combat combat)
        {
            var cd = defs.Cards[Card.Id];
            var c = combat != null ? combat.PlayCost(Card) : cd.CostOf(Card.Up);
            cost.text = c == null ? "✕" : c.Value.ToString();
            desc.text = Describe(Card, defs, combat);
            // длинное описание сразу мельче (.cdesc.long и .xlong), дальше текст сам ужимается до рамки
            var plain = System.Text.RegularExpressions.Regex.Replace(desc.text, "<[^>]+>", "").Length;
            desc.resizeTextMaxSize = desc.fontSize = Mathf.RoundToInt(descEm * Super * (plain > 64 ? 0.84f : plain > 48 ? 0.92f : 1f));
        }

        public static string Describe(CardInst card, Defs defs, Combat combat)
        {
            var cd = defs.Cards[card.Id];
            string text = null;
            if (Texts != null && Texts.TryGetValue(card.Id, out var e))
            {
                var tpl = card.Up && e.Up != null ? e.Up : e.Base;
                var atk = cd.Type == "atk";
                text = CardText.Render(tpl,
                    combat != null ? (k, n, spent) => combat.Num(k, n, spent, atk) : CardText.Static,
                    v => v.Up ? Ui.Paint(v.Value.ToString(), Ui.Green) : v.Down ? Ui.Paint(v.Value.ToString(), new Color32(0xFF, 0x8A, 0x7A, 0xFF)) : v.Value.ToString());
                // Секрет и Снежный ком растут в бою: прибавка видна прямо на карте
                if (card.Grow > 0) text += " " + Ui.Paint("+" + card.Grow, Ui.Green);
            }
            text ??= "";
            if (cd.Retain) text += " " + Loc.Tr("Удержание.");
            if (cd.Exhaust && cd.Type != "status") text += " " + Loc.Tr("Сгорает.");
            return text.Trim();
        }

        /// <summary>Карту нельзя разыграть: темнее и серее (класс nope).</summary>
        public void SetPlayable(bool can)
        {
            foreach (var g in GetComponentsInChildren<Graphic>(true))
            {
                if (g == glow || g.name == "plate" || g.name == "gem") continue;   // плашка типа карты тёмная: её цвет не трогаем
                var keep = g.color.a;
                if (g is Text) continue;
                g.color = can ? new Color(1, 1, 1, keep) : new Color(0.62f, 0.6f, 0.64f, keep);
            }
            cost.color = can ? Color.white : new Color(1f, 0.55f, 0.5f);
        }
    }
}
