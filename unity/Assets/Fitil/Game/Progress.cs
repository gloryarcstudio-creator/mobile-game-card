// Достижения, статистика, база знаний и журнал забегов (ACH, STATS, RUNS, codexMark, finishRun в game.js).
// Хранятся там же и в том же виде, что в веб-версии: lastray.ach, lastray.stats, lastray.runs.
//   ach:   c — счётчики и флаги, s — наборы (разные карты, талисманы, враги), got — когда получено,
//          seenAt — когда список открывали в последний раз (пометка «новое»), k — сколько раз побеждён каждый враг;
//   stats: runs, wins, losses, best, fights, elites, bosses, cards и итоги: dmg, ms, gold, runDmg, fast, ads, revives;
//   runs:  { list } — итоги последних 30 забегов, новые сверху.
// Логика забега (Fitil.Core) сообщает об учёте через RunGame.OnTrack и событие боя Ev.Track, всё сходится в Track.
// Экраны (достижения, статистика, база знаний, итоги забега) — в Progress.Screens.cs.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace Fitil.Game
{
    public static partial class Progress
    {
        const string AchKey = "lastray.ach", StatsKey = "lastray.stats", RunsKey = "lastray.runs";
        const int RunsMax = 30;
        static readonly string[] StatsDef = { "runs", "wins", "losses", "best", "fights", "elites", "bosses", "cards" };
        static readonly Dictionary<string, string> CxSet = new Dictionary<string, string> { ["h"] = "cxh", ["e"] = "cxe", ["c"] = "cxc", ["r"] = "cxr" };

        static Dictionary<string, object> ach, stats;
        static List<object> runs;
        static bool achDirty, statsDirty, flushing;

        // ================= хранение =================
        static Dictionary<string, object> Load(string key)
        {
            Dictionary<string, object> o = null;
            try { o = Json.Obj(Json.Parse(SaveStore.Read(key) ?? "{}")); }
            catch (Exception) { o = null; }
            return o ?? new Dictionary<string, object>();
        }

        static Dictionary<string, object> Sub(Dictionary<string, object> o, string k)
        {
            if (Json.Get(o, k) is Dictionary<string, object> d) return d;
            d = new Dictionary<string, object>();
            o[k] = d;
            return d;
        }

        static Dictionary<string, object> A
        {
            get
            {
                if (ach != null) return ach;
                ach = Load(AchKey);
                foreach (var k in new[] { "c", "s", "got", "k" }) Sub(ach, k);
                if (!(Json.Get(ach, "seenAt") is double)) ach["seenAt"] = 0.0;
                return ach;
            }
        }

        static Dictionary<string, object> C => Sub(A, "c");
        static Dictionary<string, object> S => Sub(A, "s");
        static Dictionary<string, object> Got => Sub(A, "got");

        static Dictionary<string, object> St
        {
            get
            {
                if (stats != null) return stats;
                stats = Load(StatsKey);
                foreach (var k in StatsDef) if (!(Json.Get(stats, k) is double)) stats[k] = 0.0;
                return stats;
            }
        }

        static List<object> Runs => runs ?? (runs = Json.Arr(Json.Get(Load(RunsKey), "list")) ?? new List<object>());

        static double Num(Dictionary<string, object> o, string k) => Json.Num(Json.Get(o, k));
        public static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Запись на диск не на каждый удар: изменения копятся и пишутся в конце кадра (и при сворачивании игры)
        static void SaveAch() { achDirty = true; Later(); }
        static void SaveStats() { statsDirty = true; Later(); Check(); }
        static void SaveRuns() => SaveStore.Write(RunsKey, Json.Write(new Dictionary<string, object> { ["list"] = Runs }));

        static void Later()
        {
            if (flushing || !Boot.Instance) { if (!Boot.Instance) Flush(); return; }
            flushing = true;
            Boot.Instance.StartCoroutine(EndOfFrame());
        }

        static IEnumerator EndOfFrame()
        {
            yield return null;
            flushing = false;
            Flush();
        }

        /// <summary>Записать накопленное (игра свернулась или закрывается).</summary>
        public static void Flush()
        {
            if (achDirty && ach != null) SaveStore.Write(AchKey, Json.Write(ach));
            if (statsDirty && stats != null) SaveStore.Write(StatsKey, Json.Write(stats));
            achDirty = statsDirty = false;
        }

        /// <summary>Сброс прогресса из настроек: достижения, статистика и журнал забегов (настройки и покупки остаются).</summary>
        public static void Reset()
        {
            ach = null; stats = null; runs = null;
            queue.Clear();
            SaveStore.Remove(AchKey);
            SaveStore.Remove(StatsKey);
            SaveStore.Remove(RunsKey);
            achDirty = statsDirty = false;
            lastRec = null;
            finished = null;
        }

        // ================= учёт =================
        public static int Stat(string k) => (int)Num(St, k);
        public static void StatAdd(string k, double n = 1) { if (n <= 0) return; St[k] = Num(St, k) + n; SaveStats(); }
        public static void StatMax(string k, double v) { if (v > Num(St, k)) { St[k] = v; SaveStats(); } }

        public static int Count(string k) => (int)Num(C, k);
        public static void Add(string k, int n = 1) { if (n <= 0) return; C[k] = Num(C, k) + n; Check(); }
        public static void Max(string k, int v) { if (v > Num(C, k)) { C[k] = (double)v; Check(); } }
        public static void Flag(string k) { if (Num(C, k) == 0) { C[k] = 1.0; Check(); } }

        static List<object> Set(string k)
        {
            if (Json.Get(S, k) is List<object> l) return l;
            l = new List<object>();
            S[k] = l;
            return l;
        }

        // числа и строки сравниваются по записи: в веб-версии winsDiff хранит номера сложностей
        static string Key(object o) => o is double d ? d.ToString("R", CultureInfo.InvariantCulture) : o is int i ? i.ToString(CultureInfo.InvariantCulture) : o as string;
        public static bool Has(string set, object item)
        {
            var key = Key(item);
            return Json.Get(S, set) is List<object> l && l.Any(x => Key(x) == key);
        }
        public static int SetCount(string set) => Json.Get(S, set) is List<object> l ? l.Count : 0;
        public static void Put(string k, object item)
        {
            if (item == null || Has(k, item)) return;
            Set(k).Add(item is int i ? (double)i : item);
            Check();
        }

        /// <summary>Сколько раз побеждён враг (для базы знаний).</summary>
        public static int Kills(string id) => (int)Num(Sub(A, "k"), id);
        static void Kill(string id) { var k = Sub(A, "k"); k[id] = Num(k, id) + 1; SaveAch(); }

        /// <summary>Учёт из логики забега и боя (RunGame.OnTrack, Ev.Track).</summary>
        public static void Track(string kind, string key, int n)
        {
            string Head() => key.Substring(0, key.IndexOf(':'));
            string Tail() => key.Substring(key.IndexOf(':') + 1);
            switch (kind)
            {
                case "ach.add": Add(key, n); break;
                case "ach.max": Max(key, n); break;
                case "ach.flag": Flag(key); break;
                case "ach.put": if (key != null && key.IndexOf(':') > 0) Put(Head(), Tail()); break;
                case "codex": if (key != null && key.IndexOf(':') > 0) Codex(Head(), Tail()); break;
                case "stats": StatAdd(key, n); break;
                case "stats.max": StatMax(key, n); break;
                // сыгранная карта: счётчик растёт молча, на диск попадёт с концом боя
                case "stats.cards": St["cards"] = Num(St, "cards") + 1; statsDirty = true; break;
                case "kill": Kill(key); break;
            }
        }

        // ================= база знаний =================
        static Dictionary<string, object> AchData => Boot.Instance ? Boot.Instance.Data.Achievements : null;
        static Dictionary<string, object> CodexData => Json.Obj(Json.Get(AchData, "CODEX"));

        /// <summary>Списки базы знаний: h, e, c, r и freeC, freeR (без платного).</summary>
        public static List<string> CodexList(string k) => (Json.Arr(Json.Get(CodexData, k)) ?? new List<object>()).Select(x => Json.Str(x)).Where(x => x != null).ToList();
        public static bool CxHas(string kind, string id) => CxSet.TryGetValue(kind, out var set) && Has(set, id);
        public static int CodexCount => Count("cxall");
        public static int CodexTotal => CodexList("h").Count + CodexList("e").Count + CodexList("c").Count + CodexList("r").Count;

        static bool cxPending;

        /// <summary>Открыть запись в базе знаний: герой, враг, карта или талисман попались на глаза.</summary>
        public static void Codex(string kind, string id)
        {
            if (string.IsNullOrEmpty(id) || !CxSet.TryGetValue(kind, out var set) || Has(set, id)) return;
            Set(set).Add(id);
            achDirty = true;
            if (cxPending) return;
            cxPending = true;
            if (Boot.Instance) Boot.Instance.StartCoroutine(NextFrame(() => { cxPending = false; CodexSync(false); }));
            else { cxPending = false; CodexSync(false); }
        }

        static IEnumerator NextFrame(Action fn)
        {
            yield return null;
            fn();
        }

        static void CodexSync(bool silent)
        {
            int N(string kind, List<string> list) => list.Count(id => CxHas(kind, id));
            C["cxe"] = (double)N("e", CodexList("e"));
            C["cxc"] = (double)N("c", CodexList("freeC"));
            C["cxr"] = (double)N("r", CodexList("freeR"));
            C["cxall"] = (double)(N("h", CodexList("h")) + N("e", CodexList("e")) + N("c", CodexList("c")) + N("r", CodexList("r")));
            Check(silent);
        }

        // ================= достижения =================
        public static List<Dictionary<string, object>> List =>
            (Json.Arr(Json.Get(AchData, "LIST")) ?? new List<object>()).Select(Json.Obj).Where(a => a != null).ToList();

        public static List<(string id, string name)> Cats =>
            (Json.Arr(Json.Get(AchData, "CATS")) ?? new List<object>()).Select(Json.Arr).Where(p => p != null && p.Count >= 2)
                .Select(p => (Json.Str(p[0]), Json.Str(p[1]))).ToList();

        static string Id(Dictionary<string, object> a) => Json.Str(Json.Get(a, "id"));
        static int Goal(Dictionary<string, object> a) => Json.Int(Json.Get(a, "goal"), 1);

        static int ProgressOf(Dictionary<string, object> a)
        {
            var key = Json.Str(Json.Get(a, "key"));
            switch (Json.Str(Json.Get(a, "src")))
            {
                case "stat": return (int)Num(St, key);
                case "s": return SetCount(key);
                case "has": return Has(key, Json.Get(a, "item")) ? 1 : 0;
                default: return (int)Num(C, key);
            }
        }

        public static bool Done(Dictionary<string, object> a) => Got.ContainsKey(Id(a));
        public static int GotCount(string cat = null) => List.Count(a => (cat == null || Json.Str(Json.Get(a, "cat")) == cat) && Done(a));
        public static bool HasNew => List.Any(a => Done(a) && Num(Got, Id(a)) > Num(A, "seenAt"));

        static readonly List<Dictionary<string, object>> queue = new List<Dictionary<string, object>>();
        static bool showing;

        /// <summary>Проверить цели, отметить выполненные и показать плашку (silent — без неё).</summary>
        static void Check(bool silent = false)
        {
            if (AchData == null) return;
            foreach (var a in List)
            {
                if (Done(a) || ProgressOf(a) < Goal(a)) continue;
                Got[Id(a)] = (double)Now;
                if (!silent) queue.Add(a);
            }
            SaveAch();
            if (queue.Count > 0 && !showing && Boot.Instance) Boot.Instance.StartCoroutine(Toasts());
        }

        static bool OverlayOpen
        {
            get
            {
                var top = Boot.Instance ? Boot.Instance.Top : null;
                if (!top) return false;
                for (var i = 0; i < top.childCount; i++)
                    if (top.GetChild(i).name == "overlay" && top.GetChild(i).gameObject.activeSelf) return true;
                return false;
            }
        }

        /// <summary>Плашки «Достижение получено» по одной. Пока открыто окно (выбор карты, колода, пауза), плашка ждёт:
        /// она не должна закрывать заголовок окна (v153). Если открылось сразу много — две и общий итог.</summary>
        static IEnumerator Toasts()
        {
            showing = true;
            var heard = new HashSet<string>();
            while (queue.Count > 0)
            {
                while (OverlayOpen) yield return new WaitForSeconds(0.25f);
                if (queue.Count > 3)
                {
                    var rest = queue.Count - 2;
                    queue.RemoveRange(2, rest);
                    queue.Add(new Dictionary<string, object> { ["summary"] = (double)rest });
                }
                var a = queue[0];
                queue.RemoveAt(0);
                var plate = Plate(a);
                var id = Id(a) ?? "summary";
                if (heard.Add(id)) Sound.Sfx("achieve");
                var life = Settings.Fast ? 1.7f : 2.6f;
                for (float t = 0; t < life && plate; t += Time.unscaledDeltaTime)
                {
                    if (plate) plate.alpha = Mathf.Min(1, t / 0.2f, (life - t) / 0.3f);
                    // окно открылось поверх плашки: убираем её, а если не успели прочитать — покажется снова
                    if (OverlayOpen) { if (t < (Settings.Fast ? 1f : 1.5f)) queue.Insert(0, a); break; }
                    yield return null;
                }
                if (plate) UnityEngine.Object.Destroy(plate.gameObject);
            }
            showing = false;
        }

        static CanvasGroup Plate(Dictionary<string, object> a)
        {
            var box = Ui.Node("achtoast", Boot.Instance.Top).Box(22, 64, 356, 68);
            box.SetAsLastSibling();
            var cg = box.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            cg.alpha = 0;
            var bg = Ui.Round("bg", box, new Color32(0x1B, 0x16, 0x2A, 0xF2));
            bg.rectTransform.Fill();
            bg.Outline(new Color(0.85f, 0.66f, 0.29f, 0.9f), 1.5f);
            var summary = Json.Get(a, "summary") != null;
            var pic = Ui.CircleArt("art", box, summary ? Ui.Art("r2/medal") : ArtOf(a));
            pic.rectTransform.Box(10, 8, 52, 52);
            var ring = Ui.Img("ring", pic.transform.parent, Ui.Circle, new Color(0, 0, 0, 0));
            ring.rectTransform.Box(10, 8, 52, 52);
            ring.Outline(Ui.Gold, 1.5f);
            var small = summary ? Loc.Tr("Достижения получены") : Loc.Tr("Достижение получено");
            var name = summary ? Loc.Tr("И ещё {n}", ("n", Json.Int(Json.Get(a, "summary")))) : Json.Str(Json.Get(a, "name")) + Stars(a);
            Ui.Label("small", box, small, 13, new Color(1, 1, 1, 0.7f), TextAnchor.LowerLeft).rectTransform.Box(74, 8, 270, 20);
            var t = Ui.Label("name", box, name, 19, Ui.GoldHi, TextAnchor.UpperLeft, true).Shadow(1f);
            t.rectTransform.Box(74, 28, 274, 36);
            t.Fit(13);
            return cg;
        }

        static string Stars(Dictionary<string, object> a)
        {
            var n = Json.Int(Json.Get(a, "stars"));
            return n > 0 ? " <color=#" + Ui.Hex(Ui.Gold) + ">" + new string('★', n) + "</color>" : "";
        }

        /// <summary>Картинка достижения: h — герой забега, c:герой, e:враг, i:карта или талисман.</summary>
        public static Sprite ArtOf(Dictionary<string, object> a)
        {
            var art = Json.Str(Json.Get(a, "art")) ?? "";
            if (art == "h") return Ui.Art("h/" + HeroNow + "_face");
            if (art.StartsWith("c:")) return Ui.Art("h/" + art.Substring(2) + "_face");
            if (art.StartsWith("e:")) return Ui.Art("e/" + art.Substring(2));
            var id = art.Length > 2 ? art.Substring(2) : art;
            return Ui.Art("c/" + id) ?? Ui.Art("r2/" + id) ?? Ui.Art("i/" + id);
        }

        static string HeroNow => RunFlow.Current != null ? RunFlow.Current.Hero.Id : Settings.Cls;

        // ================= забег =================
        /// <summary>Новый забег: счётчик забегов и герой в базе знаний (newRun).</summary>
        public static void NewRun(RunState run)
        {
            StatAdd("runs");
            Codex("h", run.Cls);
            run.St["last"] = Now;
        }

        /// <summary>Время в пути: прибавить прошедшее с прошлой отметки, но не больше двух минут за раз
        /// (игра стояла свёрнутой — это не путь). stTick.</summary>
        public static void Tick(RunState run)
        {
            if (run == null) return;
            var now = Now;
            var last = run.St.TryGetValue("last", out var l) ? l : now;
            run.St["ms"] = (run.St.TryGetValue("ms", out var ms) ? ms : 0) + Math.Max(0, Math.Min(now - last, 120000));
            run.St["last"] = now;
        }

        /// <summary>После второй попытки забег возвращается к снимку, но время, урон и сыгранные карты остаются (keepSt).</summary>
        public static void KeepSt(RunState run, Dictionary<string, long> prev)
        {
            if (prev == null) return;
            foreach (var k in new[] { "ms", "dmg", "hit", "taken", "healed", "cards", "revives" })
            {
                var a = run.St.TryGetValue(k, out var x) ? x : 0;
                var b = prev.TryGetValue(k, out var y) ? y : 0;
                run.St[k] = Math.Max(a, b);
            }
            run.St["last"] = Now;
        }

        /// <summary>Вторая попытка после поражения (за рекламу или сразу без рекламы).</summary>
        public static void Revive(RunState run)
        {
            if (!Store.NoAds) StatAdd("ads");
            StatAdd("revives");
            run.St["revives"] = (run.St.TryGetValue("revives", out var v) ? v : 0) + 1;
        }

        /// <summary>Письмо доставлено (goVictory): победы, лёгкая колода, помощь всем встречным, герой и сложность.</summary>
        public static Dictionary<string, object> Victory(RunGame g, int maxSteps)
        {
            var run = g.Run;
            St["wins"] = Num(St, "wins") + 1;
            St["best"] = (double)maxSteps;
            if (run.Deck.Count <= 15) Flag("light");
            var log = run.MeetLog;
            if (log.Count >= 4 && log.All(k => k == "help" || k == "tie")) Flag("allhelp");
            Put("winsCls", run.Cls);
            Put("winsDiff", (double)run.Diff);
            var rec = Finish(g, true, null, maxSteps);
            SaveStats();
            return rec;
        }

        /// <summary>Забег окончен поражением (endRun). by — враг последнего боя.</summary>
        public static Dictionary<string, object> Loss(RunGame g, string by, int maxSteps)
        {
            if (finished == g.Run) return lastRec;
            St["losses"] = Num(St, "losses") + 1;
            var rec = Finish(g, false, by, maxSteps);
            SaveStats();
            return rec;
        }

        static RunState finished;
        static Dictionary<string, object> lastRec;
        /// <summary>Итоги последнего законченного забега (кнопка «Итоги забега»).</summary>
        public static Dictionary<string, object> LastRec => lastRec;

        /// <summary>Запись забега в журнал (finishRun): тот же вид, что в веб-версии.</summary>
        static Dictionary<string, object> Finish(RunGame g, bool win, string by, int maxSteps)
        {
            var run = g.Run;
            if (finished == run && lastRec != null) return lastRec;
            finished = run;
            Tick(run);
            long S0(string k) => run.St.TryGetValue(k, out var v) ? v : 0;
            var rec = new Dictionary<string, object>
            {
                ["at"] = (double)Now, ["win"] = win, ["cls"] = run.Cls ?? "lamp", ["diff"] = (double)run.Diff,
                ["lvl"] = (double)(win ? maxSteps : Math.Min(maxSteps, run.Step + 1)),
                ["ms"] = (double)S0("ms"), ["fights"] = (double)run.Fights, ["elites"] = (double)S0("elites"), ["bosses"] = (double)S0("bosses"),
                ["dmg"] = (double)S0("dmg"), ["hit"] = (double)S0("hit"), ["taken"] = (double)S0("taken"), ["healed"] = (double)S0("healed"),
                ["cards"] = (double)S0("cards"), ["gold"] = (double)S0("gold"), ["spent"] = (double)S0("spent"),
                ["deck"] = (double)run.Deck.Count, ["ups"] = (double)run.Deck.Count(c => c.Up),
                ["relics"] = run.Relics.Select(r => (object)r).ToList(),
                ["by"] = win ? null : by, ["fin"] = win ? run.Final : null,
                ["met"] = (double)run.Met.Count, ["fallen"] = (double)run.Fallen.Count, ["revives"] = (double)S0("revives"),
            };
            Runs.Insert(0, rec);
            if (Runs.Count > RunsMax) Runs.RemoveRange(RunsMax, Runs.Count - RunsMax);
            SaveRuns();
            St["dmg"] = Num(St, "dmg") + S0("dmg");
            St["ms"] = Num(St, "ms") + S0("ms");
            St["gold"] = Num(St, "gold") + S0("gold");
            St["runDmg"] = Math.Max(Num(St, "runDmg"), S0("dmg"));
            if (win) St["fast"] = Num(St, "fast") > 0 ? Math.Min(Num(St, "fast"), S0("ms")) : S0("ms");
            statsDirty = true;
            lastRec = rec;
            return rec;
        }

        // ================= числа и даты =================
        static CultureInfo Culture
        {
            get
            {
                try { return CultureInfo.GetCultureInfo(Loc.Lang == "uk" ? "uk-UA" : Loc.Lang == "en" ? "en-US" : "ru-RU"); }
                catch (Exception) { return CultureInfo.InvariantCulture; }
            }
        }

        /// <summary>Число с разрядами: 12 500.</summary>
        public static string Fmt(double n) => Math.Round(n).ToString("#,0", Culture).Replace(' ', ' ').Replace(' ', ' ');

        /// <summary>Время в пути: минуты, а с часа — часы и минуты.</summary>
        public static string FmtTime(double ms)
        {
            var m = Math.Max(1, (int)Math.Round(ms / 60000));
            return m < 60 ? Loc.Tr("{n} мин", ("n", m)) : Loc.Tr("{h} ч {m} мин", ("h", m / 60), ("m", m % 60));
        }

        public static string FmtDate(double ts)
        {
            var d = DateTimeOffset.FromUnixTimeMilliseconds((long)ts).ToLocalTime().DateTime;
            try { return d.ToString(Loc.Lang == "en" ? "MMMM d" : "d MMMM", Culture); }
            catch (Exception) { return d.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture); }
        }
    }
}
