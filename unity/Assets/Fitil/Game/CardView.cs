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
                glow = Ui.Round("glow", transform, gc);
                glow.rectTransform.Fill();
                glow.rectTransform.offsetMin = new Vector2(-em * 0.6f, -em * 0.6f);
                glow.rectTransform.offsetMax = new Vector2(em * 0.6f, em * 0.6f);
            }

            var art = Ui.CircleArt("art", transform, Ui.Art("c/" + card.Id));
            art.rectTransform.Frac(L.A[0], L.A[1], L.A[2], L.A[3]);

            var frameSprite = Ui.Art("ui2/f_" + type);
            var frame = Ui.Img("frame", transform, frameSprite, frameSprite ? Color.white : new Color(0.17f, 0.14f, 0.2f));
            frame.rectTransform.Frac(L.F[0], L.F[1], L.F[2], L.F[3]);
            art.transform.SetAsLastSibling();   // окошко рамки закрашено: картинка карты лежит поверх рамки, как в веб-версии

            var name = cd.Name + (card.Up ? "+" : "");
            var title = Ui.Label("title", transform, name, Mathf.RoundToInt(em * 0.98f), card.Up ? new Color32(0xE4, 0xFF, 0xD8, 0xFF) : new Color32(0xFB, 0xEF, 0xD2, 0xFF), TextAnchor.MiddleCenter, true).Shadow(1f).Fit(5);
            title.rectTransform.Frac(L.T[0], L.T[1], L.T[2], L.T[3]);
            title.rectTransform.offsetMin = new Vector2(em * 0.25f, 0);
            title.rectTransform.offsetMax = new Vector2(-em * 0.25f, 0);

            cost = Ui.Label("cost", transform, "", Mathf.RoundToInt(em * 1.55f), Color.white, TextAnchor.MiddleCenter, true).Shadow(1.5f, 1f);
            cost.rectTransform.Frac(L.G[0], L.G[1], L.G[2], L.G[3]);

            desc = Ui.Label("desc", transform, "", Mathf.RoundToInt(em * 1.0f), Ui.Paper).Shadow(1f).Fit(5);
            desc.lineSpacing = 0.95f;
            desc.rectTransform.Frac(L.D[0], L.D[1], L.D[2], L.D[3]);

            var label = Loc.Tr(TypeLabel.TryGetValue(cd.Type, out var tl) ? tl : "Навык");
            var ty = Ui.Label("type", transform, label, Mathf.RoundToInt(em * 0.78f), type == "atk" ? new Color32(0x3A, 0x24, 0x18, 0xFF) : new Color32(0xF1, 0xE4, 0xC4, 0xFF));
            ty.rectTransform.anchorMin = ty.rectTransform.anchorMax = new Vector2(L.YL, 1 - L.YT);
            ty.rectTransform.sizeDelta = new Vector2(width * 0.6f, em * 1.2f);
            ty.rectTransform.anchoredPosition = Vector2.zero;
            if (type != "atk")
            {
                var plate = Ui.Round("plate", transform, new Color32(18, 14, 26, 230));
                plate.rectTransform.anchorMin = plate.rectTransform.anchorMax = ty.rectTransform.anchorMin;
                plate.rectTransform.sizeDelta = new Vector2(Mathf.Min(width * 0.5f, label.Length * em * 0.5f + em * 1.2f), em * 1.25f);
                plate.transform.SetSiblingIndex(ty.transform.GetSiblingIndex());
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
                if (g == glow) continue;
                var keep = g.color.a;
                if (g is Text) continue;
                g.color = can ? new Color(1, 1, 1, keep) : new Color(0.62f, 0.6f, 0.64f, keep);
            }
            cost.color = can ? Color.white : new Color(1f, 0.55f, 0.5f);
        }
    }
}
