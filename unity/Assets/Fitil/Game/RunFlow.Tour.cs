// Обход экранов забега для снимков (клавиша F9 в редакторе, см. Tour.cs): каждый шаг открывает один экран.
using System;
using System.Collections.Generic;
using System.Linq;
using Fitil.Core;
using Fitil.Platform;

namespace Fitil.Game
{
    public sealed partial class RunFlow
    {
        Dictionary<string, object> tourRec;

        /// <summary>Экраны забега по порядку: имя снимка и действие, которое его открывает.</summary>
        public List<(string name, Action show)> TourSteps()
        {
            var foe = defs.Enemies.ContainsKey("scarfsnake") ? "scarfsnake" : defs.Enemies.Keys.First();
            var boss = defs.Enemies.Values.FirstOrDefault(e => e.Tier == "boss")?.Id ?? foe;
            var friend = defs.Data.Classes.Keys.FirstOrDefault(k => k != Run.Cls) ?? Run.Cls;
            return new List<(string, Action)>
            {
                ("10_map", Map),
                ("09_map_toast", () => { Map(); Progress.TourToast(); }),
                ("11_fight", () => Fight(foe, "fight")),
                ("12_talk", () => Talk(foe, "fight")),
                ("13_plea", () => Plea(foe, "fight")),
                ("14_meet", () => Meet(friend)),
                ("15_event", () => Event("well")),
                ("16_shop", () => Shop(false)),
                ("17_rest", () => Rest(false)),
                ("18_chest", Chest),
                ("19_reward", () => Reward("fight")),
                ("20_boss_fight", () => Fight(boss, "boss")),
                ("21_boss_talk", () => Talk(boss, "boss")),
                ("22_boss_relic", () => BossRelic()),
                ("23_pause", Menus.ShowPause),
                ("24_deck", () => ShowDeck(Run.Deck, Loc.Tr("Колода") + " · " + Run.Deck.Count, null)),
                ("25_relics", () => { Map(); Hud.ShowRelics(G); }),
                ("26_fight_toast", () => { Fight(foe, "fight"); Progress.TourToast(); }),
                // бой в движении: выбранная карта, удар по врагу, ответный ход врага
                ("27_fight_select", () => { Fight(foe, "fight"); combat.StartCoroutine(combat.TourMoves(true, false)); }),
                ("28_fight_hit", () => { Fight(foe, "fight"); combat.StartCoroutine(combat.TourMoves(false, false)); }),
                ("29_fight_enemy_turn", () => { Fight(foe, "fight"); combat.StartCoroutine(combat.TourMoves(false, true)); }),
                ("30_defeat", () => { Fight(foe, "fight"); Defeat(foe, "fight"); }),
                ("31_victory", Victory),
                ("32_summary_win", () => { if (tourRec != null) { Summary(tourRec); Progress.TourToast(); } }),
                ("33_lose", EndRun),
                ("34_summary_lose", () => { if (tourRec != null) Summary(tourRec); }),
            };
        }
    }
}
