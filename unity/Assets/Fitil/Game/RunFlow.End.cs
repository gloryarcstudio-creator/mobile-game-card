// Награда за бой, трофей босса и финалы забега (goReward, goBossRelic, goVictory, endRun в game.js).
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace Fitil.Game
{
    public sealed partial class RunFlow
    {
        // ================= награда =================
        void Reward(string tier)
        {
            var hp0 = Run.Hp;
            var gold0 = Run.Gold;
            var rw = G.MakeReward(tier);
            Save(new Pending { T = "reward", Reward = rw });
            if (tier != "boss") { Sound.Sfx("win"); Sound.Music(MapTrack); }
            var p = RenderReward(rw);
            Hud.Gain(p.Bar, Run.Hp - hp0, Run.Gold - gold0);
            Hud.Flush(G);
        }

        Page RenderReward(Reward rw)
        {
            var p = Open();
            Bars(p);
            var col = Ui.Node("reward", p.Root).Box(0, 70, 400, 686);   // лента на 70, как .ribbon в веб-версии
            col.Column(13, TextAnchor.UpperCenter);
            Ui.Ribbon(col, rw.Boss ? Loc.Tr("Босс повержен!") : Loc.Tr("Победа!"));
            var loot = Ui.Node("loot", col);
            loot.Line(6, TextAnchor.MiddleCenter, 10, 16, 3, 3);
            var lootBg = Ui.Round("bg", loot, new Color(0.06f, 0.07f, 0.12f, 0.72f));
            lootBg.rectTransform.Fill();
            lootBg.Outline(new Color(0.85f, 0.66f, 0.29f, 0.55f), 1.2f);
            lootBg.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var coin = Ui.Img("coin", loot, "i/coin");
            coin.preserveAspect = true;
            coin.Pref(30, 30);
            Ui.Label("n", loot, RunGame.Coins(rw.Gold) + (rw.Healed > 0 ? " · +" + rw.Healed + " HP" : ""), 22, Ui.GoldHi, TextAnchor.MiddleLeft, true).Shadow(1.5f).Pref(-1, 32);

            var hint = Ui.Label("hint", col, Loc.Tr("Возьми одну карту в колоду"), 18, Ui.Paper, TextAnchor.MiddleCenter, true).Shadow(2f, 1f);
            hint.Pref(380, 30);

            var n = rw.Ids.Count;
            var w = n >= 4 ? 92f : 118f;
            var gap = n >= 4 ? 6f : 12f;
            var row = Ui.Node("cards", col);
            row.Pref(400, w * CardView.Ratio + 8);
            var x0 = 200 - (n * w + (n - 1) * gap) / 2;
            for (var i = 0; i < n; i++)
            {
                var id = rw.Ids[i];
                var v = CardView.Make(row, new CardInst { Id = id }, defs, null, w);
                var rt = v.Rect;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.anchoredPosition = new Vector2(x0 + w / 2 + i * (w + gap), -(4 + w * CardView.Ratio / 2));
                var catcher = v.gameObject.AddComponent<Image>();
                catcher.color = new Color(0, 0, 0, 0);
                var b = v.gameObject.AddComponent<Button>();
                b.transition = Selectable.Transition.None;
                b.onClick.AddListener(() => { Sound.Sfx("card"); G.TakeCard(id); Hud.Flush(G); Next(); });
            }
            Spacer(col, 14);
            Ui.Push(col, Loc.Tr("Пропустить"), Next, true, 20, 151, 50);
            return p;
        }

        // ================= трофей босса =================
        void BossRelic(List<string> saved = null)
        {
            var opts = saved ?? G.BossRelicOptions();
            if (saved == null) { Sound.Sfx("win"); Sound.Music(MapTrack); }
            if (opts.Count == 0) { Reward("boss"); return; }
            Save(new Pending { T = "bossrelic", Opts = opts });
            foreach (var r in opts) Progress.Codex("r", r);
            var p = Open();
            Bars(p);
            var col = Ui.Node("trophy", p.Root).Box(0, 96, 400, 660);
            col.Column(10, TextAnchor.UpperCenter);
            Ui.Ribbon(col, Loc.Tr("Трофей босса"));
            Ui.Label("hint", col, Loc.Tr("Выбери один талисман"), 18, Ui.Paper, TextAnchor.MiddleCenter, true).Shadow(2f, 1f).Pref(380, 36);
            foreach (var id in opts)
            {
                var r = defs.Relics[id];
                var rowBtn = Ui.Node("relic", col);
                rowBtn.Line(12, TextAnchor.MiddleLeft, 14, 14, 10, 10);
                rowBtn.Pref(356, -1, 86);
                var frame = Ui.Frame(rowBtn, "ui2/row2", 0.36f);
                frame.raycastTarget = true;
                frame.Outline(new Color(0.85f, 0.66f, 0.29f, 0.8f), 1.5f);
                var ic = Ui.Img("icon", rowBtn, "r2/" + id);
                ic.preserveAspect = true;
                ic.Pref(56, 56);
                var t = Ui.Label("text", rowBtn, "<color=#" + Ui.Hex(Ui.GoldHi) + ">" + r.Name + "</color>\n<size=15>" + r.Desc + "</size>", 19, Ui.Paper, TextAnchor.MiddleLeft, true).Shadow(1f);
                t.Pref(262);
                var b = rowBtn.gameObject.AddComponent<Button>();
                b.transition = Selectable.Transition.None;
                b.targetGraphic = frame;
                b.onClick.AddListener(() =>
                {
                    G.AddRelic(id);   // звук и крупный показ талисмана — в RunFlow.ShowRelic
                    Hud.Flush(G);
                    Reward("boss");
                });
            }
            Spacer(col, 6);
            Ui.Push(col, Loc.Tr("Не брать"), () => Reward("boss"), true, 18, 160, 46);
        }

        // ================= финалы =================
        /// <summary>Книга финала: картинка, заголовок, рассказ и строка итогов; под ней кнопка в главное меню.</summary>
        Page Book(string pic, string ribbon, string title, string story, string stats, bool dim, Dictionary<string, object> rec)
        {
            var p = Open();
            Boot.Instance.Corner("end");
            var col = Ui.Node("end", p.Root).Box(0, ribbon != null ? 40 : 78, 400, 800);   // книга на 144 с лентой и на 128 без неё, как в веб-версии
            col.Column(10, TextAnchor.UpperCenter);
            if (ribbon != null) Ui.Ribbon(col, ribbon);
            Spacer(col, 30);
            var page = Ui.Node("page", col);
            page.Column(9, TextAnchor.UpperCenter, 27, 27, 14, 17);
            page.Pref(372);
            Ui.Frame(page, "ui2/parch", 0.47f, 4.7f, 35.7f, 4.7f, 8.5f);
            Ui.Label("title", page, title, 30, new Color32(0x5A, 0x2A, 0x26, 0xFF), TextAnchor.MiddleCenter, true).Pref(250);
            BookPic(page, pic, 220, dim);
            Ui.Label("story", page, story, 17, Ui.Ink).Pref(318);
            Ui.Label("stats", page, stats, 15, new Color32(0x5A, 0x2A, 0x26, 0xFF)).Pref(318);
            Spacer(col, 14);
            if (rec != null) Ui.Push(col, Loc.Tr("Итоги забега"), () => Summary(rec), false, 30, 268, 68);
            Ui.Push(col, Loc.Tr("Главное меню"), () => { Close(); Boot.Instance.ShowTitle(); }, rec != null, rec != null ? 17 : 24, rec != null ? 152 : 240, rec != null ? 40 : 60);
            return p;
        }

        public string DiffName => G.Diff.Name;

        void Victory()
        {
            var fin = Run.Final;
            var pic = fin == null ? "story_win" : fin.StartsWith("dk_") ? "ending_darkhero" : "ending_" + fin;
            if (!Ui.Art("pic/" + pic)) pic = "story_win";
            var saved = Run.FinalDark ?? Run.Forgiven;
            var story = defs.StoryHero("winText", Run.Cls) ?? defs.StoryStr("winText") ?? "";
            if (saved != null)
            {
                var dark = G.Lore.Dark(saved);
                var s = Json.Str(Json.Get(dark, "saved"));
                if (!string.IsNullOrEmpty(s)) story += " " + Loc.Tr(s);
            }
            var stats = string.Join(" · ", new[] { DiffName, Loc.Tr("Побед: {n}", ("n", Run.Fights)), Loc.Tr("Карт в колоде: {n}", ("n", Run.Deck.Count)), Loc.Tr("Талисманов: {n}", ("n", Run.Relics.Count)) });
            ClearSave(defs);
            ended = true;
            var rec = Progress.Victory(G, defs.MaxSteps);
            Sound.Music("title");
            Sound.Sfx("victory");
            var page = Book(pic, defs.StoryStr("winRibbon"), defs.StoryStr("winTitle"), story, stats, false, rec);
            // праздник: хлопушки у ленты и звёзды над книгой, когда экран уже проявился
            Delay(0.52f, () => { if (page.Root) Hud.FxOn(page.Root).Play("fanfare", null); });
        }

        /// <summary>Поражение: можно начать бой заново или вернуться на развилку перед ним (за рекламу,
        /// с «Без рекламы» сразу), или закончить забег.</summary>
        void Defeat(string enemy, string tier)
        {
            if (snapFight == null) { EndRun(); return; }
            lastFoe = enemy;
            Save(new Pending { T = "defeat", Enemy = enemy, Tier = tier, Fight = snapFight });
            Sound.Music(null);
            Sound.Sfx("defeat");
            var p = Open();
            Boot.Instance.Corner("end");
            var col = Ui.Node("end", p.Root).Box(0, 104, 400, 750);
            col.Column(10, TextAnchor.UpperCenter);
            var page = Ui.Node("page", col);
            page.Column(9, TextAnchor.UpperCenter, 27, 27, 14, 17);
            page.Pref(372);
            Ui.Frame(page, "ui2/parch", 0.47f, 4.7f, 35.7f, 4.7f, 8.5f);
            Ui.Label("title", page, Loc.Tr("Тени настигли"), 30, new Color32(0x5A, 0x2A, 0x26, 0xFF), TextAnchor.MiddleCenter, true).Pref(250);
            BookPic(page, "story_lose", 170, true);
            Ui.Label("story", page, Loc.Tr("Но письмо ещё можно спасти. Попробуй этот бой снова или вернись на развилку перед ним и выбери другой путь."), 17, Ui.Ink).Pref(318);
            Spacer(col, 16);
            var ad = Store.NoAds ? "" : "▶ ";
            var fightSnap = snapFight;
            var stepSnap = snapStep;
            var busy = false;
            void Revive(string snap, bool fight)
            {
                if (busy) return;
                busy = true;
                Store.Ad(Boot.Instance, seen =>
                {
                    busy = false;
                    if (!seen) { Hud.Toast(Store.AdNote ?? Loc.Tr("Реклама не досмотрена")); return; }
                    var r = RunSave.FromSnap(defs, snap);
                    if (r == null) { EndRun(); return; }
                    var prevSt = new Dictionary<string, long>(Run.St);
                    G.Run = r;
                    Progress.KeepSt(r, prevSt);
                    Progress.Revive(r);
                    Sound.Sfx("heal");
                    if (fight) Fight(enemy, tier); else Map();
                    Hud.Toast(Loc.Tr("Ещё одна попытка!"));
                }, Loc.Tr(fight ? "Бой начнётся заново" : "Вернуться на развилку перед боем"));
            }
            var again = Ui.Push(col, ad + Loc.Tr("Начать бой заново") + "\n<size=13>" + Loc.Tr("с теми же HP и колодой, что перед боем") + "</size>", () => Revive(fightSnap, true), false, 24, 300, 82);
            if (stepSnap != null)
                Ui.Push(col, ad + Loc.Tr("Вернуться до боя") + "\n<size=13>" + Loc.Tr("снова на развилке перед этим боем") + "</size>", () => Revive(stepSnap, false), false, 20, 300, 81);
            Ui.Push(col, Loc.Tr("Закончить забег"), EndRun, true, 17, 169, 40);
        }

        /// <summary>Конец забега без второй попытки: книга поражения.</summary>
        void EndRun()
        {
            snapFight = null;
            snapStep = null;
            ClearSave(defs);
            ended = true;
            var rec = Progress.Loss(G, lastFoe, defs.MaxSteps);
            Sound.Music(null);
            Sound.Sfx("defeat");
            var story = defs.StoryHero("loseText", Run.Cls) ?? defs.StoryStr("loseText") ?? "";
            var stats = string.Join(" · ", new[] { DiffName, Loc.Tr("Уровень") + " " + Loc.Tr("{a} из {b}", ("a", Run.Step + 1), ("b", defs.MaxSteps)), Loc.Tr("Побед: {n}", ("n", Run.Fights)) });
            Book("story_lose", null, defs.StoryStr("loseTitle"), story, stats, true, rec);
        }

        /// <summary>Итоги забега (goSummary): карточка итогов, «Новый забег» и «Главное меню».</summary>
        void Summary(Dictionary<string, object> rec)
        {
            var p = Open();
            Boot.Instance.Corner("end");
            var col = Ui.Node("summary", p.Root).Box(0, 44, 400, 800);
            col.Column(12, TextAnchor.UpperCenter);
            Ui.Ribbon(col, Loc.Tr("Итоги забега"));
            Progress.SummaryCard(col, rec, defs);
            // кнопки одна под другой: большая «Новый забег» и малая «Главное меню» (.endbtns)
            Spacer(col, 4);
            Ui.Push(col, Loc.Tr("Новый забег"), () => { Close(); Boot.Instance.ShowHeroes(); }, false, 30, 265, 68);
            Ui.Push(col, Loc.Tr("Главное меню"), () => { Close(); Boot.Instance.ShowTitle(); }, true, 17, 152, 40);
        }

        static void BookPic(RectTransform page, string pic, float h, bool dim)
        {
            var art = Ui.Node("art", page);
            art.Pref(318, h);
            art.gameObject.AddComponent<RectMask2D>();
            var img = Ui.Img("pic", art, "pic/" + pic);
            img.rectTransform.Fill();
            if (img.sprite)
            {
                var fit = img.gameObject.AddComponent<AspectRatioFitter>();
                fit.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                fit.aspectRatio = (float)img.sprite.texture.width / img.sprite.texture.height;
                if (dim) img.color = new Color(0.62f, 0.62f, 0.66f);
            }
            else img.color = new Color32(0x1C, 0x27, 0x40, 0xFF);
        }
    }
}
