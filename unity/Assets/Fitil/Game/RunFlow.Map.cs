// Карта пути (goMap, encHTML, mapHint в game.js): подсказка уровня и две-три таблички на выбор.
using System;
using System.Collections;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed partial class RunFlow
    {
        bool picking;

        void Map()
        {
            var p = Open();
            picking = false;
            Run.Fmod = null;   // уговоры и дразнилки из разговора действуют только на один бой
            Sound.Music(MapTrack);
            var choices = G.Choices();
            Save();
            snapStep = RunSave.Snap(Run);   // для «Вернуться до боя»
            Bars(p);

            var hint = Ui.Label("hint", p.Root, MapHint(), 22, new Color32(0xE6, 0xED, 0xF8, 0xFF), TextAnchor.UpperCenter, true).Shadow(2f, 1f).Outline(new Color(0.03f, 0.05f, 0.12f, 0.6f), 1.5f);
            hint.rectTransform.Box(10, 102, 380, 56);

            var widths = new float[choices.Count];
            var total = 0f;
            for (var i = 0; i < choices.Count; i++) { widths[i] = choices[i].T == "boss" ? 200 : 124; total += widths[i]; }
            total += 8 * (choices.Count - 1);
            var x = (400 - total) / 2;
            for (var i = 0; i < choices.Count; i++)
            {
                var card = EncCard(p.Root, choices[i], i);
                var h = choices[i].T == "boss" ? 360 : 300;
                card.Box(x, 158, widths[i], h);
                // опора в середине: выбранная табличка растёт от центра
                card.pivot = new Vector2(0.5f, 0.5f);
                card.anchoredPosition += new Vector2(widths[i] / 2, -h / 2f);
                x += widths[i] + 8;
            }
        }

        /// <summary>Какая пьеса звучит на пути: город, окраина или финальная ночь.</summary>
        string MapTrack => new[] { "stage1", "stage2", "night" }[Math.Min(2, Math.Max(0, defs.StageOf(Run.Step)))];

        string MapHint()
        {
            var si = Math.Max(0, defs.StageOf(Run.Step));
            var g = defs.Stages[si];
            var intro = Json.Arr(Json.Get(defs.Story, "stageIntro"));
            if (Run.Step == g.Start && intro != null)
                return g.Name + "\n<size=15>" + (si < intro.Count ? Json.Str(intro[si]) : "") + "</size>";
            if (Run.Step == 0) return Loc.Tr("Выбери, куда идти");
            if (Run.Forced && Run.Choices != null && Run.Choices.TrueForAll(o => o.T == "fight" || o.T == "elite"))
                return Loc.Tr("Уровень {n}", ("n", Run.Step + 1)) + "\n<size=15>" + Loc.Tr("После передышки дорога ведёт через бой") + "</size>";
            return Loc.Tr("Уровень {n}", ("n", Run.Step + 1));
        }

        static readonly System.Collections.Generic.Dictionary<string, string> EvPic = new System.Collections.Generic.Dictionary<string, string>
        {
            ["well"] = "ev_well", ["puppet"] = "ev_puppet", ["lantern"] = "ev_lantern", ["snowman"] = "ev_snowman", ["coin"] = "ev_coins",
            ["whetstone"] = "ev_smith", ["stampbook"] = "ev_postoffice", ["frostglass"] = "ev_icemirror", ["showbooth"] = "ev_showbooth",
        };

        /// <summary>Картинка события: нарисованная сцена (pic) или значок.</summary>
        static string EventArt(string art, bool preferPic)
        {
            var pic = EvPic.TryGetValue(art ?? "", out var k) ? "pic/" + k : null;
            if (preferPic && pic != null && Ui.Art(pic)) return pic;
            if (Ui.Art("i/" + art)) return "i/" + art;
            return pic;
        }

        /// <summary>Табличка пути: рамка с окошком, сверху вид встречи, в окошке имя, картинка и текст.</summary>
        RectTransform EncCard(RectTransform parent, Encounter o, int i)
        {
            string title, art, text, tag;
            var boss = o.T == "boss";
            switch (o.T)
            {
                case "fight": case "elite": case "boss":
                {
                    var e = defs.Enemies[o.Enemy];
                    title = e.Name; art = "e/" + o.Enemy; text = e.Line;
                    tag = Loc.Tr(boss ? (defs.IsFinalStep(Run.Step) ? "Финальный босс" : "Босс стадии") : o.T == "elite" ? "Элита" : "Бой");
                    break;
                }
                case "event":
                {
                    var ev = G.EventData(o.Ev);
                    title = Json.Str(Json.Get(ev, "title")); art = EventArt(Json.Str(Json.Get(ev, "art")), false);
                    text = Loc.Tr("Что-то происходит впереди…"); tag = Loc.Tr("Событие");
                    break;
                }
                case "meet":
                {
                    var h = G.Defs.Data.Classes[o.Hero];
                    title = Loc.Tr(Json.Str(Json.Get(G.Lore.Meet(o.Hero), "title"))); art = "h/" + o.Hero;
                    text = string.IsNullOrEmpty(h.Who) ? "" : char.ToUpper(h.Who[0]) + h.Who.Substring(1); tag = Loc.Tr("Встреча");
                    break;
                }
                case "shop":
                    title = Loc.Tr(o.Last ? "Лавка у последней двери" : "Лавка Игольника"); art = "e/hedgehog";
                    text = Loc.Tr(o.Last ? "Ёж Игольник догнал тебя со своим прилавком." : "Ёж торгует всем, что нашёл в сугробах."); tag = Loc.Tr("Лавка");
                    break;
                case "chest":
                    title = Loc.Tr("Сундук-соня"); art = "i/chest2"; text = Loc.Tr("Сундук храпит. Внутри что-то звенит."); tag = Loc.Tr("Сундук");
                    break;
                default:
                    title = Loc.Tr(o.Last ? "Последний костёр" : "Костёр"); art = "i/fire";
                    text = Loc.Tr(o.Last ? "Последний привал перед дверью адресата." : "Тёплый огонь. Можно передохнуть."); tag = Loc.Tr("Привал");
                    break;
            }

            var s = boss ? 0.6667f : 0.4133f;
            var w = boss ? 200f : 124f;
            var h0 = boss ? 360f : 300f;
            var rt = Ui.Node("enc " + o.T, parent);
            rt.sizeDelta = new Vector2(w, h0);
            float padT = 128 * s, padS = 32 * s, padB = 126 * s;

            // окошко: тёмное ночное небо под рамкой
            var win = Ui.Img("window", rt, null, new Color32(0x26, 0x2C, 0x46, 0xFF));
            win.rectTransform.Box(padS, padT, w - 2 * padS, h0 - padT - padB);
            var frame = Ui.Img("frame", rt, "ui2/mapcard");
            frame.rectTransform.Fill();
            if (frame.sprite) { frame.type = Image.Type.Sliced; frame.fillCenter = false; frame.pixelsPerUnitMultiplier = 1f / s; }
            else frame.color = new Color32(0x26, 0x20, 0x36, 0xFF);
            frame.raycastTarget = true;
            if (o.T == "elite") frame.Outline(new Color(0.94f, 0.75f, 0.35f, 0.7f), 2f);
            if (boss) frame.Outline(new Color(0.7f, 0.47f, 0.94f, 0.75f), 3f);

            var tagT = Ui.Label("tag", rt, tag, boss ? 16 : 13, new Color32(0xFF, 0xF1, 0xCC, 0xFF), TextAnchor.MiddleCenter).Shadow(1.5f, 1f);
            tagT.rectTransform.Box(0, 91 * s - 11, w, 22);

            var cw = w - 2 * padS;
            var t = Ui.Label("title", rt, title, boss ? 18 : 14, new Color32(0xFF, 0xE2, 0xA0, 0xFF), TextAnchor.MiddleCenter, true).Shadow(2f, 1f);
            t.rectTransform.Box(padS, padT + 2, cw, 32);
            t.lineSpacing = 0.9f;
            t.Fit(10);

            var artH = boss ? 112f : 84f;
            var a = Ui.Img("art", rt, art);
            a.preserveAspect = true;
            a.rectTransform.Box(padS + 2, padT + 36, cw - 4, artH);
            if (!a.sprite) a.color = new Color(0, 0, 0, 0);

            var body = Ui.Label("text", rt, text, 13, Ui.Paper).Shadow(1f, 1f);
            body.lineSpacing = 0.92f;
            body.rectTransform.Box(padS + 2, padT + 38 + artH, cw - 4, h0 - padB - padT - 40 - artH);
            body.Fit(9);

            var btn = rt.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.targetGraphic = frame;
            btn.onClick.AddListener(() =>
            {
                if (picking) return;
                picking = true;
                Boot.Instance.StartCoroutine(Pick(rt, i));
            });
            return rt;
        }

        // выбранная табличка вспыхивает и чуть растёт, остальные гаснут, и только потом путь продолжается
        IEnumerator Pick(RectTransform card, int i)
        {
            foreach (Transform sib in card.parent)
                if (sib != card && sib.name.StartsWith("enc ")) sib.gameObject.AddComponent<CanvasGroup>().alpha = 0.35f;
            for (float t = 0; t < 0.2f && card; t += Time.deltaTime)
            {
                card.localScale = Vector3.one * (1 + 0.07f * Mathf.Sin(Mathf.Min(1, t / 0.12f) * Mathf.PI / 2));
                yield return null;
            }
            yield return new WaitForSeconds(0.05f);
            Choose(i);
        }
    }
}
