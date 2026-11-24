// События, разговор до боя, пощада после боя и встречи с героями (goEvent, goTalk, goAfter, goMeet в game.js):
// картинка или собеседник, пергамент с названием и текстом, под ним свитки-ответы.
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed partial class RunFlow
    {
        sealed class Scene
        {
            public RectTransform Col, Art, Box, Scrolls;
            public LayoutElement ArtSize;
            public float ArtH;
            public EnemyAnim Live;
            public Text Title, Text, Note;
        }

        /// <summary>Столбик экрана: картинка (pic — нарисованная сцена в рамке), пергамент, свитки.
        /// Если ответов много, картинка становится ниже, и все свитки остаются над панелью героя.</summary>
        Scene StoryScene(Page p, string art, bool pic, float top, float artW, float artH, string title, string text, string note = null, float gap = 16)
        {
            var sc = new Scene { ArtH = artH };
            sc.Col = Ui.Node("scene", p.Root).Box(0, top, 400, 768 - top);
            sc.Col.Column(0, TextAnchor.UpperCenter);

            sc.Art = Ui.Node("art", sc.Col);
            sc.ArtSize = sc.Art.Pref(pic ? 330 : artW, artH);
            if (pic)
            {
                var border = Ui.Round("border", sc.Art, new Color32(0x3A, 0x26, 0x16, 0xFF));
                border.rectTransform.Fill();
                border.rectTransform.offsetMin = new Vector2(-3, -3);
                border.rectTransform.offsetMax = new Vector2(3, 3);
                border.Outline(new Color32(0xB9, 0x8A, 0x4A, 0xFF), 1f);
                sc.Art.gameObject.AddComponent<RectMask2D>();
                var img = Ui.Img("pic", sc.Art, art);
                img.rectTransform.Fill();
                if (img.sprite)
                {
                    var fit = img.gameObject.AddComponent<AspectRatioFitter>();
                    fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                    fit.aspectRatio = (float)img.sprite.texture.width / img.sprite.texture.height;
                }
                else img.color = new Color32(0x1C, 0x27, 0x40, 0xFF);
            }
            else
            {
                var img = Ui.Img("img", sc.Art, art);
                img.preserveAspect = true;
                img.rectTransform.Fill();
                if (!img.sprite) img.color = new Color(0, 0, 0, 0);
                else p.Bg.StandOn(sc.Art);   // собеседник стоит на снегу, а не на фоне неба
                // собеседник-враг оживает (Art.enemyLive)
                if (art != null && art.StartsWith("e/")) LiveIn(sc, art.Substring(2));
            }

            Spacer(sc.Col, 34);
            sc.Box = Ui.Node("box", sc.Col);
            sc.Box.Column(5, TextAnchor.UpperCenter, 28, 28, 16, 15);
            sc.Box.Pref(348);
            Ui.Frame(sc.Box, "ui2/parch", 0.47f, 4.7f, 35.7f, 4.7f, 8.5f);
            sc.Title = Ui.Label("title", sc.Box, title, 24, new Color32(0x5A, 0x2A, 0x26, 0xFF), TextAnchor.MiddleCenter, true);
            sc.Title.lineSpacing = 0.95f;
            sc.Title.Pref(224);
            sc.Text = Ui.Label("text", sc.Box, text, 17, Ui.Ink);
            sc.Text.lineSpacing = 1.05f;
            sc.Text.Pref(292);
            if (!string.IsNullOrEmpty(note))
            {
                sc.Note = Ui.Label("note", sc.Box, "<i>" + note + "</i>", 14, new Color32(0x4A, 0x3A, 0x2A, 0xFF));
                sc.Note.Pref(292);
            }
            Spacer(sc.Col, gap);
            sc.Scrolls = Ui.Node("scrolls", sc.Col);
            sc.Scrolls.Column(13, TextAnchor.UpperCenter);
            sc.Scrolls.Pref(400);
            return sc;
        }

        // живой враг вместо неподвижной картинки; прежний живой (другой враг вступил в разговор) убирается
        static void LiveIn(Scene sc, string id)
        {
            if (sc.Live) UnityEngine.Object.Destroy(sc.Live.gameObject);
            sc.Live = EnemyAnim.Make(sc.Art, id);
            var img = sc.Art.GetComponentInChildren<Image>();
            if (img) img.enabled = !sc.Live;
        }

        static void Spacer(Transform parent, float h) => Ui.Node("gap", parent).Pref(1, h);

        /// <summary>Ответы на месте прежних. Картинка становится ниже, если свитки не помещаются.</summary>
        void Answers(Scene sc, IEnumerable<(string text, string hint, bool off, string why, bool glow, Action pick)> list)
        {
            Ui.Clear(sc.Scrolls);
            foreach (var a in list)
            {
                var why = a.why;
                Ui.Scroll(sc.Scrolls, a.text, a.hint, a.pick, a.off, why != null ? () => { Sound.Sfx("deny"); Hud.Toast(Loc.Tr(why)); } : (Action)null, a.glow);
            }
            Boot.Instance.StartCoroutine(FitScene(sc));
        }

        System.Collections.IEnumerator FitScene(Scene sc)
        {
            yield return null;   // уничтоженные свитки уходят из раскладки только к следующему кадру
            if (!sc.Col) yield break;
            sc.ArtSize.preferredHeight = sc.ArtH;
            LayoutRebuilder.ForceRebuildLayoutImmediate(sc.Col);
            var over = LayoutUtility.GetPreferredHeight(sc.Col) - sc.Col.rect.height;
            if (over > 0)
            {
                sc.ArtSize.preferredHeight = Mathf.Max(84, sc.ArtH - over);
                LayoutRebuilder.ForceRebuildLayoutImmediate(sc.Col);
            }
        }

        void One(Scene sc, string text, Action pick) => Answers(sc, new[] { (text, (string)null, false, (string)null, false, pick) });

        // ================= событие =================
        void Event(string id)
        {
            var p = Open();
            Bars(p);
            var ev = G.EventData(id);
            var art = EventArt(Json.Str(Json.Get(ev, "art")), true);
            var pic = art != null && art.StartsWith("pic/");
            var sc = StoryScene(p, art, pic, 86, 150, pic ? 248 : 150, Json.Str(Json.Get(ev, "title")), Loc.Fill(Json.Str(Json.Get(ev, "text"))));
            var opts = G.EventOptions(id);
            Progress.Put("events", id);
            var list = new List<(string, string, bool, string, bool, Action)>();
            for (var i = 0; i < opts.Count; i++)
            {
                var k = i;
                var o = opts[i];
                // ответ за рекламу помечен: «▶ Реклама», а с «Без рекламы» — «Бонус» (adTag)
                var text = o.Ad ? "<size=12><color=#" + Ui.Hex(Store.NoAds ? Ui.Green : Ui.Orange) + ">" + (Store.NoAds ? Loc.Tr("Бонус") : "▶ " + Loc.Tr("Реклама")) + "</color></size>\n" + o.Text : o.Text;
                list.Add((text, o.Hint, !o.Can, o.Why, o.Ad, () => EventPick(p, sc, id, k, o.Ad ? o.Hint : null)));
            }
            Answers(sc, list);
        }

        bool adBusy;

        /// <summary>Ответ события. adFor — ответ за рекламу: сначала ролик (без рекламы — сразу), не досмотрен — награды нет.</summary>
        void EventPick(Page p, Scene sc, string id, int i, string adFor = null)
        {
            if (adFor != null)
            {
                if (adBusy) return;
                adBusy = true;
                Store.Ad(Boot.Instance, seen =>
                {
                    adBusy = false;
                    if (!seen) { Hud.Toast(Store.AdNote ?? Loc.Tr("Реклама не досмотрена, награды нет")); return; }
                    if (!Store.NoAds) Progress.StatAdd("ads");
                    if (sc.Col) EventPick(p, sc, id, i);
                }, adFor);
                return;
            }
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            var res = G.EventAct(id, i);
            if (res.Prompt != DeckPrompt.None)
            {
                // выбор карты: отмена возвращает к тем же ответам, выбор ведёт дальше по пути
                Prompt(res.Prompt, res.PromptCost, ok => { if (ok) { Save(P("next")); AfterPrompt(res.Prompt, Next); } });
                return;
            }
            sc.Text.text = res.Text;
            After(p, hp0, gold0);
            if (res.Fight != null)
            {
                Save(P("fight", res.Fight));
                Ui.Clear(sc.Scrolls);
                Delay(0.6f, () => Fight(res.Fight, res.FightTier));
                return;
            }
            Save(P("next"));
            One(sc, Loc.Tr("Дальше"), Next);
        }

        // ================= разговор до боя =================
        void Talk(string id, string tier)
        {
            Save(P("talk", id, tier));
            Progress.Codex("e", id);
            var p = Open();
            Bars(p);
            var e = defs.Enemies[id];
            var boss = e.Tier == "boss";
            var sc = StoryScene(p, "e/" + id, false, boss ? 56 : 64, boss ? 210 : 170, boss ? 190 : 170, e.Name,
                Quote(G.TalkLine(id)), G.TieNote(id) is string n && n != "" ? Loc.Tr(n) : null, 14);
            var list = new List<(string, string, bool, string, bool, Action)>();
            foreach (var o in G.TalkOptions(id, tier))
            {
                var k = o.K;
                list.Add((Loc.Tr(o.Text), o.Hint, !o.Can, o.Why, o.Secret, () => TalkPick(p, sc, id, tier, k)));
            }
            Answers(sc, list);
        }

        static string Quote(string t) => Loc.Tr("«{t}»", ("t", Loc.Tr(t ?? "")));

        void TalkPick(Page p, Scene sc, string id, string tier, string k)
        {
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            var res = G.TalkChoose(id, tier, k, out var quoteIt);
            if (res.Fight != null && string.IsNullOrEmpty(res.Text)) { Fight(res.Fight, tier); return; }
            sc.Text.text = quoteIt ? Loc.Tr("«{t}»", ("t", res.Text)) : res.Text;
            if (sc.Note) sc.Note.gameObject.SetActive(false);
            if (res.Fight != null && res.Fight != id)
            {
                sc.Title.text = defs.Enemies[res.Fight].Name;
                var img = sc.Art.GetComponentInChildren<Image>(true);
                if (img) img.sprite = Ui.Art("e/" + res.Fight);
                LiveIn(sc, res.Fight);
            }
            After(p, hp0, gold0);
            if (res.Next == "fight") { Save(P(tier, res.Fight)); One(sc, Loc.Tr("В бой"), () => Fight(res.Fight, tier)); }
            else if (res.Next == "bossrelic") { Save(P("bossrelic")); One(sc, Loc.Tr("Дальше"), () => BossRelic()); }
            else { Save(P("next")); One(sc, Loc.Tr("Дальше"), Next); }
        }

        // ================= пощада после боя =================
        void Plea(string id, string tier)
        {
            Save(P("after", id, tier));
            var p = Open();
            Bars(p);
            var e = defs.Enemies[id];
            var boss = e.Tier == "boss";
            var sc = StoryScene(p, "e/" + id, false, boss ? 56 : 64, boss ? 210 : 170, boss ? 190 : 170, e.Name, Quote(G.PleaLine(id)), null, 14);
            // побеждённый враг стоит чуть накренившись (.talk-art.beaten)
            sc.Art.GetChild(0).localRotation = Quaternion.Euler(0, 0, 7);
            if (sc.Live)
            {
                sc.Live.transform.localRotation = Quaternion.Euler(0, 0, 5);
                sc.Live.transform.localScale = Vector3.one * 0.95f;
            }
            Answers(sc, new (string, string, bool, string, bool, Action)[]
            {
                (Loc.Tr("Пощадить"), Loc.Tr(tier == "boss" ? "Враг отдаст талисман" : "Враг оставит подарок"), false, null, false, () => PleaPick(p, sc, id, tier, true)),
                (Loc.Tr("Забрать всё"), Loc.Tr("Монет в полтора раза больше, но враг запомнит обиду"), false, null, false, () => PleaPick(p, sc, id, tier, false)),
            });
        }

        void PleaPick(Page p, Scene sc, string id, string tier, bool spare)
        {
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            sc.Text.text = G.AfterChoose(id, tier, spare);
            Save(P("afterdone", null, tier));
            After(p, hp0, gold0);
            One(sc, Loc.Tr("Дальше"), () => { if (tier == "boss") BossRelic(); else Reward(tier); });
        }

        // ================= встреча с героем =================
        void Meet(string h)
        {
            var p = Open("meet");
            Bars(p);
            var m = G.Lore.Meet(h);
            var sc = StoryScene(p, "h/" + h, false, 56, 150, 180, Loc.Tr(Json.Str(Json.Get(m, "title"))), Loc.Tr(Json.Str(Json.Get(m, "text"))), null, 14);
            MeetAnswers(p, sc, h);
        }

        void MeetAnswers(Page p, Scene sc, string h)
        {
            var list = new List<(string, string, bool, string, bool, Action)>();
            foreach (var o in G.MeetOptions(h))
            {
                var op = o;
                list.Add((Loc.Tr(o.Text), o.Hint, !o.Can, o.Why, o.Secret, () => MeetPick(p, sc, h, op, false)));
            }
            Answers(sc, list);
        }

        void MeetPick(Page p, Scene sc, string h, Option o, bool picked)
        {
            // карту для улучшения выбирают до платы: отмена возвращает к ответам
            if (!picked && G.MeetNeedsUpgrade(o))
            {
                Prompt(DeckPrompt.Upgrade, 0, ok => { if (ok) MeetPick(p, sc, h, o, true); });
                return;
            }
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            sc.Text.text = G.MeetChoose(h, o);
            Save(P("next"));
            After(p, hp0, gold0);
            One(sc, Loc.Tr("Дальше"), Next);
        }
    }
}
