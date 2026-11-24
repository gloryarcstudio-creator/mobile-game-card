// Забег на экране. Пока это цепочка боёв (Runs.NextFight): бой, награда картой, следующий бой.
// Карта пути, лавка, костёр, события и сохранение заменят её на этапе «Core: забег».
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public sealed class RunFlow
    {
        readonly Defs defs;
        public readonly RunState Run;
        CombatScreen combat;
        string enemy, tier;

        public RunFlow(Defs defs, string cls)
        {
            this.defs = defs;
            Run = Runs.New(defs, cls, 1, Rng.NewSeed());
        }

        public void Next()
        {
            var (id, t) = Runs.NextFight(defs, Run);
            enemy = id;
            tier = t;
            combat = CombatScreen.Show(defs, Run, id, t, OnEnd);
        }

        void OnEnd(CombatEnd end)
        {
            if (end == CombatEnd.Win)
            {
                Run.Fights++;
                Run.Killed.Add(enemy);
                if (defs.IsFinalStep(Run.Step)) { Finish(true); return; }
                Reward(tier == "boss");
            }
            else Finish(false);
        }

        // ---------- награда картой ----------
        static readonly string[] Rarities = { "common", "uncommon", "rare", "epic", "legendary" };
        static readonly double[] Weights = { 60, 25, 10, 4, 1 };

        List<string> RewardCards()
        {
            var pool = defs.Cards.Values.Where(c => Rarities.Contains(c.Rarity) && (c.Cls == null || c.Cls == Run.Cls)).ToList();
            var got = new List<string>();
            for (var k = 0; k < 30 && got.Count < 3; k++)
            {
                var r = Rarities[Run.Rng.Weighted(Weights)];
                var list = pool.Where(c => c.Rarity == r && !got.Contains(c.Id)).ToList();
                if (list.Count == 0) continue;
                got.Add(Run.Rng.Pick(list).Id);
            }
            return got;
        }

        void Reward(bool boss)
        {
            var layer = Overlay(out var root);
            var title = Ui.Label("title", root, boss ? Loc.Tr("Босс повержен!") : Loc.Tr("Победа!"), 34, Ui.GoldHi, TextAnchor.MiddleCenter, true).Shadow(2f);
            title.rectTransform.Box(0, 150, 400, 50);
            var sub = Ui.Label("sub", root, Loc.Tr("Возьми одну карту в колоду"), 18, Ui.Paper).Shadow();
            sub.rectTransform.Box(0, 205, 400, 30);
            var ids = RewardCards();
            for (var i = 0; i < ids.Count; i++)
            {
                var inst = Run.Mk(ids[i]);
                var v = CardView.Make(root, inst, defs, null, 118);
                var rt = v.Rect;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                rt.anchoredPosition = new Vector2(70 + i * 130, -(260 + 118 * CardView.Ratio / 2));
                var catcher = v.gameObject.AddComponent<Image>();
                catcher.color = new Color(0, 0, 0, 0);
                var b = v.gameObject.AddComponent<Button>();
                b.transition = Selectable.Transition.None;
                b.onClick.AddListener(() => { Run.Deck.Add(inst); Continue(layer); });
            }
            var skip = Ui.Btn("skip", root, Loc.Tr("Пропустить"), () => Continue(layer), 18);
            ((RectTransform)skip.transform).Box(120, 520, 160, 50);
        }

        void Continue(GameObject layer)
        {
            Object.Destroy(layer);
            if (combat) Object.Destroy(combat.gameObject);
            Run.Step++;
            Next();
        }

        void Finish(bool won)
        {
            var layer = Overlay(out var root);
            var title = Ui.Label("title", root, won ? Loc.Tr("Победа!") : Loc.Tr("Тени настигли"), 32, won ? Ui.GoldHi : Ui.Red, TextAnchor.MiddleCenter, true).Shadow(2f);
            title.rectTransform.Box(0, 260, 400, 50);
            var sub = Ui.Label("sub", root, Loc.Tr("Уровень {a}/{b}", ("a", Run.Step + 1), ("b", defs.MaxSteps)) + " · " + Loc.Tr("Побед: {n}", ("n", Run.Fights)), 18, Ui.Paper).Shadow();
            sub.rectTransform.Box(0, 320, 400, 30);
            var btn = Ui.Btn("menu", root, Loc.Tr("Главное меню"), () =>
            {
                Object.Destroy(layer);
                if (combat) Object.Destroy(combat.gameObject);
                Boot.Instance.ShowTitle();
            }, 20);
            ((RectTransform)btn.transform).Box(110, 400, 180, 56);
        }

        /// <summary>Тёмная подложка поверх боя для наград и итогов.</summary>
        static GameObject Overlay(out RectTransform root)
        {
            var shade = Ui.Img("shade", Boot.Instance.Safe, null, new Color(0.03f, 0.04f, 0.08f, 0.82f));
            shade.raycastTarget = true;
            // подложка шире безопасной зоны: закрывает и вырез камеры
            shade.rectTransform.Fill();
            shade.rectTransform.offsetMin = new Vector2(-400, -400);
            shade.rectTransform.offsetMax = new Vector2(400, 400);
            root = Ui.Node("overlay", shade.transform).Fill();
            root.offsetMin = new Vector2(400, 400);
            root.offsetMax = new Vector2(-400, -400);
            return shade.gameObject;
        }
    }
}
