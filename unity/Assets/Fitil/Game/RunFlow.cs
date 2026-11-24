// Забег на экране: карта пути и всё, куда она ведёт (game.js: goMap, chooseEncounter, advance, startCombat,
// winCombat, goReward, goBossRelic, goVictory, goDefeat). Правила забега — в Fitil.Core.RunGame,
// здесь только экраны и переходы между ними. Экраны разнесены по файлам RunFlow.*.cs.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace Fitil.Game
{
    /// <summary>Экран забега: фон, слой содержимого, верхняя панель и панель героя.</summary>
    public sealed class Page
    {
        public RectTransform Back, Root, Top, Bar;
        public Image Bg;

        public void Close()
        {
            if (Back) Object.Destroy(Back.gameObject);
            if (Root) Object.Destroy(Root.gameObject);
        }
    }

    public sealed partial class RunFlow
    {
        readonly Defs defs;
        public readonly RunGame G;
        RunState Run => G.Run;
        Page page;
        CombatScreen combat;

        /// <summary>Забег, который сейчас на экране (пауза, смена языка), или null.</summary>
        public static RunFlow Current { get; private set; }

        public RunFlow(Defs defs, string cls, int diff = 1)
        {
            this.defs = defs;
            G = RunGame.New(defs, cls, diff, Rng.NewSeed());
            G.OnTrack = Progress.Track;
            Loc.Gender = () => G.Hero.Female;
            Current = this;
            Progress.NewRun(G.Run);
        }

        RunFlow(Defs defs, SaveFile s)
        {
            this.defs = defs;
            G = new RunGame(defs, s.Run);
            G.OnTrack = Progress.Track;
            snapStep = s.Back;
            Loc.Gender = () => G.Hero.Female;
            Current = this;
        }

        public HeroClass Hero => G.Hero;
        /// <summary>Идёт бой (выход из него начнёт бой заново).</summary>
        public bool InFight => combat;
        /// <summary>Бой проигрывает ход: выходить нельзя, пока он не закончится.</summary>
        public bool FightBusy => combat && combat.Busy;

        /// <summary>Выйти из забега (он уже сохранён); toTitle — сразу в главное меню.</summary>
        public void Quit(bool toTitle = true)
        {
            Close();
            if (Current == this) Current = null;
            if (toTitle) Boot.Instance.ShowTitle();
        }

        /// <summary>Главное меню открылось: забега на экране больше нет.</summary>
        public static void Drop() => Current = null;

        public void Start() => Map();

        // ================= сохранение =================
        string snapStep;                     // забег на развилке перед боем (вторая попытка «Вернуться до боя»)
        string snapFight;                    // забег в начале боя (вторая попытка «Начать бой заново»)
        Pending lastP;                       // экран, на котором забег сохранён последний раз
        bool ended;                          // забег закончен: сохранения больше нет
        string lastFoe;                      // враг последнего боя (итоги проигранного забега)

        public static string SaveKey(Defs d) => "lastray.save." + d.StoryId;

        /// <summary>Сохранение, с которого можно продолжить, или null.</summary>
        public static SaveFile LoadSave(Defs d)
        {
            var json = SaveStore.Read(SaveKey(d));
            return json == null ? null : RunSave.Read(d, json);
        }

        public static void ClearSave(Defs d) => SaveStore.Remove(SaveKey(d));

        /// <summary>Записать забег и экран, на котором он сейчас (save в game.js).</summary>
        void Save(Pending p = null)
        {
            Progress.Tick(Run);
            lastP = p;
            var back = p != null && snapStep != null ? snapStep : null;
            SaveStore.Write(SaveKey(defs), RunSave.Write(new SaveFile { Run = Run, P = p, Back = back, At = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }));
        }

        /// <summary>Игра свернулась или закрывается: дописать время в пути (вне боя — бой и так начнётся заново).</summary>
        public void SaveNow()
        {
            if (ended || combat) return;
            Save(lastP);
        }

        Pending P(string t, string enemy = null, string tier = null) => new Pending { T = t, Enemy = enemy, Tier = tier };

        /// <summary>Продолжить сохранённый забег с того экрана, на котором из него вышли (continueRun).</summary>
        public static void Continue(Defs defs, SaveFile s)
        {
            var f = new RunFlow(defs, s);
            try { f.Resume(s.P); }
            catch (Exception e)
            {
                // последняя страховка: экран из сохранения не открылся — к выбору дороги на том же уровне
                Debug.LogException(e);
                f.Close();
                Object.Destroy(GameObject.Find("overlay"));
                if (f.Run.Hp <= 0) { f.EndRun(); return; }
                f.Run.Choices = null;
                f.Map();
            }
        }

        void Resume(Pending p)
        {
            if (p == null) { Map(); return; }
            switch (p.T)
            {
                case "defeat":
                    if (p.Fight == null) { EndRun(); return; }
                    snapFight = p.Fight;
                    Defeat(p.Enemy, p.Tier);
                    return;
                case "fight": case "elite": case "boss": Fight(p.Enemy, p.T); return;
                case "event": Event(p.Ev); return;
                case "shop": ShopScreen(p.Shop ?? G.NewShop(), p.Last); return;
                case "chest": Chest(); return;
                case "rest": Rest(p.Last); return;
                case "next": Next(); return;
                case "reward": RenderReward(p.Reward); return;
                case "bossrelic": BossRelic(p.Opts); return;
                case "meet": Meet(p.Hero); return;
                case "talk": Talk(p.Enemy, p.Tier); return;
                case "after": Plea(p.Enemy, p.Tier); return;
                case "afterdone": if (p.Tier == "boss") BossRelic(); else Reward(p.Tier); return;
                default: Map(); return;
            }
        }

        // ================= экраны =================
        /// <summary>Новый экран на месте прежнего. place — нарисованная сцена (shop, rest, meet), иначе фон пути.</summary>
        Page Open(string place = null)
        {
            Close();
            var boot = Boot.Instance;
            page = new Page
            {
                Back = Ui.Node("run back", boot.Back).Fill(),
                Root = Ui.Node("run", boot.Safe).Fill(),
            };
            var art = place == "shop" ? "bg/scene_shop" : place == "rest" ? "bg/scene_campfire" : place == "meet" ? "bg/scene_meet" : Boot.BgFor(defs, Run.Step);
            page.Bg = Boot.Background(page.Back, art);
            boot.Corner("run");
            return page;
        }

        void Close()
        {
            page?.Close();
            page = null;
            if (combat) Object.Destroy(combat.gameObject);
            combat = null;
        }

        /// <summary>Верхняя панель и панель героя (перерисовываются после покупок и ответов).</summary>
        void Bars(Page p)
        {
            if (p.Top) Object.Destroy(p.Top.gameObject);
            if (p.Bar) Object.Destroy(p.Bar.gameObject);
            p.Top = Hud.Top(p.Root, G);
            p.Bar = Hud.Hero(p.Root, G, () => ShowDeck(Run.Deck, Loc.Tr("Колода") + " · " + Run.Deck.Count, null));
        }

        /// <summary>Перерисовать панели и показать, что изменилось у героя (showGain) и что сказала логика (toast).</summary>
        void After(Page p, int hp0, int gold0)
        {
            Bars(p);
            Hud.Gain(p.Bar, Run.Hp - hp0, Run.Gold - gold0);
            Hud.Flush(G);
        }

        static IEnumerator Later(float s, Action fn)
        {
            yield return new WaitForSeconds(s);
            fn();
        }

        void Delay(float s, Action fn) => Boot.Instance.StartCoroutine(Later(s, fn));

        // ================= путь =================
        void Next()
        {
            G.Advance();
            Sound.Sfx("step");
            Map();
        }

        void Choose(int i)
        {
            var o = G.Choose(i, out var talk);
            Save(Pending.Of(o));
            switch (o.T)
            {
                case "fight": case "elite": case "boss":
                    if (talk) Talk(o.Enemy, o.T); else Fight(o.Enemy, o.T);
                    break;
                case "meet": Meet(o.Hero); break;
                case "event": Event(o.Ev); break;
                case "shop": Shop(o.Last); break;
                case "chest": Chest(); break;
                case "rest": Rest(o.Last); break;
                default: Next(); break;
            }
        }

        // ================= бой =================
        void Fight(string id, string tier)
        {
            Close();
            snapFight = RunSave.Snap(Run);
            Save(P(tier, id));
            lastFoe = id;
            Progress.Codex("e", id);
            // бой: у боссов своя музыка, обычные бои чередуют две пьесы после каждой победы
            Sound.Music(tier == "boss" ? (defs.IsFinalStep(Run.Step) ? "final" : "boss") : Run.Fights % 2 == 1 ? "battle2" : "battle");
            var setup = G.SetupFor(id, tier);
            combat = CombatScreen.Show(defs, Run, id, tier, setup, end => AfterFight(end));
            Boot.Instance.Corner("combat");
        }

        void AfterFight(CombatEnd end)
        {
            if (!combat) return;
            var c = combat.C;
            if (end != CombatEnd.Win) { Defeat(c.Id, c.Tier); return; }
            var next = G.Win(c);
            Hud.Flush(G);
            switch (next)
            {
                case AfterWin.Victory: Victory(); break;
                case AfterWin.Plea: Plea(c.Id, c.Tier); break;
                case AfterWin.BossRelic: BossRelic(); break;
                default: Reward(c.Tier); break;
            }
            snapFight = null;
        }

        // ================= колода =================
        /// <summary>Колода или выбор карты из неё (showDeck): карты по названию, улучшенные после обычных.
        /// onPick == null — только посмотреть; иначе нажатие на карту выбирает её, «Отмена» отдаёт null.</summary>
        void ShowDeck(List<CardInst> list, string title, Action<CardInst> onPick, bool previewUp = false, string note = null)
        {
            var sorted = list.OrderBy(c => c.Id, StringComparer.Ordinal).ThenBy(c => c.Up ? 1 : 0).ToList();
            var layer = Overlay.Open(out var root);
            var head = Ui.Label("title", root, title, 24, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            head.rectTransform.Box(10, 24, 380, 34);
            var hint = previewUp ? Loc.Tr("Так карты будут выглядеть после улучшения") : note;
            var top = 62f;
            if (!string.IsNullOrEmpty(hint))
            {
                var h = Ui.Label("hint", root, hint, 15, new Color(0.9f, 0.88f, 0.8f, 0.85f)).Shadow();
                h.rectTransform.Box(20, 60, 360, 22);
                top = 86;
            }
            // прокручиваемая сетка: по четыре карты в ряд
            var view = Ui.Node("view", root).Box(8, top, 384, 860 - top - 90);
            view.gameObject.AddComponent<RectMask2D>();
            var hitImg = view.gameObject.AddComponent<Image>();
            hitImg.color = new Color(0, 0, 0, 0);
            var content = Ui.Node("content", view);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            const float w = 88, gap = 8;
            var hgt = w * CardView.Ratio;
            var rows = (sorted.Count + 3) / 4;
            content.sizeDelta = new Vector2(0, Mathf.Max(1, rows) * (hgt + gap) + 8);
            content.anchoredPosition = Vector2.zero;
            var scroll = view.gameObject.AddComponent<ScrollRect>();
            scroll.content = content;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 30;
            for (var i = 0; i < sorted.Count; i++)
            {
                var inst = sorted[i];
                var shown = previewUp ? new CardInst { Uid = inst.Uid, Id = inst.Id, Up = true } : inst;
                var v = CardView.Make(content, shown, defs, null, w);
                var rt = v.Rect;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.anchoredPosition = new Vector2(6 + w / 2 + (i % 4) * (w + gap), -(8 + hgt / 2 + (i / 4) * (hgt + gap)));
                if (onPick != null)
                {
                    var catcher = v.gameObject.AddComponent<Image>();
                    catcher.color = new Color(0, 0, 0, 0);
                    var b = v.gameObject.AddComponent<Button>();
                    b.transition = Selectable.Transition.None;
                    b.onClick.AddListener(() => { Object.Destroy(layer); onPick(inst); });
                }
            }
            if (sorted.Count == 0)
            {
                var empty = Ui.Label("empty", content, Loc.Tr("Пусто"), 18, Ui.Paper);
                empty.rectTransform.Box(0, 20, 384, 30);
            }
            var close = Ui.Push(root, onPick != null ? Loc.Tr("Отмена") : Loc.Tr("Закрыть"), () => { Object.Destroy(layer); onPick?.Invoke(null); }, true, 18, 170, 48);
            ((RectTransform)close.transform).Box(115, 790, 170, 48);
        }

        /// <summary>Выбор карты для улучшения, удаления, копии или обмена (подсказки Prompt у событий и встреч).</summary>
        void Prompt(DeckPrompt p, int cost, Action<bool> done)
        {
            var list = G.PromptList(p);
            if (p == DeckPrompt.Upgrade && list.Count == 0) { Hud.Toast(Loc.Tr("Все карты уже улучшены")); done(false); return; }
            string title, note = null;
            switch (p)
            {
                case DeckPrompt.Upgrade: title = Loc.Tr("Выбери карту для улучшения"); break;
                case DeckPrompt.Remove: title = Loc.Tr("Выбери карту, которую убрать"); break;
                case DeckPrompt.Duplicate:
                    title = Loc.Tr("Выбери карту для копии");
                    if (list.Count < Run.Deck.Count(c => defs.Cards[c.Id].Rarity != "status")) note = Loc.Tr("Легендарные карты зеркало не повторяет");
                    break;
                default: title = Loc.Tr("Какую карту отдать?"); break;
            }
            ShowDeck(list, title, c =>
            {
                if (c == null) { done(false); return; }
                var name = G.CardName(c);
                G.ApplyPrompt(p, c, cost);
                Sound.Sfx(p == DeckPrompt.Remove ? "snuff" : "relic");
                if (p == DeckPrompt.Upgrade) Hud.Toast(Loc.Tr("Улучшена: {name}", ("name", G.CardName(c))));
                if (p == DeckPrompt.Remove) Hud.Toast(Loc.Tr("Убрана: {name}", ("name", name)));
                Hud.Flush(G);
                done(true);
            }, p == DeckPrompt.Upgrade, note);
        }
    }
}
