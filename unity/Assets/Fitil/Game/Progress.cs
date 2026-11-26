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
                case "stats":
                    StatAdd(key, n);
                    // первые победы для аналитики: по ним оценивают, дошёл ли новый игрок до игры
                    if (key == "fights" && Num(St, "fights") == 1) Analytics.Event("first_fight_won");
                    if (key == "bosses" && Num(St, "bosses") == 1) Analytics.Event("first_boss_won");
                    break;
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

        /// <summary>Для обхода экранов: вся база знаний открыта, без плашек достижений.</summary>
        internal static void TourOpenAll()
        {
            foreach (var k in new[] { "h", "e", "c", "r" })
                foreach (var id in CodexList(k))
                    if (!CxHas(k, id)) Set(CxSet[k]).Add(id);
            achDirty = true;
            CodexSync(true);
        }

        /// <summary>Для обхода экранов: все достижения получены, в истории три забега с известными числами.</summary>
        internal static void TourSeed()
        {
            var day = 86400000.0;
            var i = 0;
            foreach (var a in List) Got[Id(a)] = Now - day * (1 + i++ % 40);
            A["seenAt"] = (double)Now;
            Runs.Clear();
            Dictionary<string, object> Rec(bool win, string cls, int diff, int lvl, double ago, string by, string fin, params string[] relics) => new Dictionary<string, object>
            {
                ["at"] = Now - ago * day, ["win"] = win, ["cls"] = cls, ["diff"] = (double)diff, ["lvl"] = (double)lvl,
                ["ms"] = 1000.0 * 60 * (win ? 42 : 17), ["fights"] = (double)(win ? 14 : 6), ["elites"] = (double)(win ? 3 : 1), ["bosses"] = (double)(win ? 3 : 0),
                ["dmg"] = win ? 2140.0 : 618.0, ["hit"] = win ? 64.0 : 31.0, ["taken"] = win ? 233.0 : 97.0, ["healed"] = win ? 88.0 : 12.0,
                ["cards"] = win ? 412.0 : 151.0, ["gold"] = win ? 890.0 : 240.0, ["spent"] = win ? 640.0 : 120.0, ["deck"] = win ? 24.0 : 15.0, ["ups"] = win ? 9.0 : 2.0,
                ["relics"] = relics.Select(r => (object)r).ToList(), ["by"] = by, ["fin"] = fin,
                ["met"] = win ? 4.0 : 1.0, ["fallen"] = win ? 1.0 : 0.0, ["revives"] = 0.0,
            };
            Runs.Add(Rec(true, "lamp", 1, Boot.Instance.Defs.MaxSteps, 1, null, null, "oilcan", "snowman"));
            Runs.Add(Rec(false, "lamp", 2, 7, 3, "scarfsnake", null, "oilcan"));
            Runs.Add(Rec(false, "lamp", 0, 3, 9, "scarfsnake", null));
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
                if (!silent && !Tour.Running) queue.Add(a);   // во время обхода экранов плашки не закрывают снимки
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
                    StampIn((t - (Settings.Fast ? 0.34f : 0.5f)) / 0.32f);
                    // окно открылось поверх плашки: убираем её, а если не успели прочитать — покажется снова
                    if (OverlayOpen) { if (t < (Settings.Fast ? 1f : 1.5f)) queue.Insert(0, a); break; }
                    yield return null;
                }
                if (plate) UnityEngine.Object.Destroy(plate.gameObject);
            }
            showing = false;
        }

        /// <summary>Где показывать плашку: 0 — вверху, 1 — вверху низкая (бой, награда, трофей), 2 — внизу (конец забега), 3 — внизу низкая (итоги).</summary>
        static int ToastPlace()
        {
            var run = Boot.Instance.Safe.Find("run");
            if (run)
            {
                if (run.Find("summary")) return 3;
                if (run.Find("end")) return 2;
                if (run.Find("reward") || run.Find("trophy")) return 1;
            }
            return UnityEngine.Object.FindFirstObjectByType<CombatScreen>() ? 1 : 0;
        }

        /// <summary>Показать плашку первого достижения для снимка (обход экранов).</summary>
        internal static void TourToast()
        {
            var a = List.FirstOrDefault();
            if (a == null) return;
            Plate(a).alpha = 1;
            StampIn(1);
        }

        static CanvasGroup Plate(Dictionary<string, object> a)
        {
            // .achtoast: плитка ui2/tile с окошком для картинки (масштаб .452, рамка выступает за края).
            // Обычно у верхнего края; в бою, на награде и трофее босса — ниже ростом; на экранах конца забега — внизу,
            // чтобы не закрывать ленту и книгу.
            var place = ToastPlace();
            var low = place == 1 || place == 3;
            float th = low ? 52 : 76;
            var box = Ui.Node("achtoast", Boot.Instance.Top);
            if (place >= 2) box.Box(35, 860 - (place == 3 ? 5 : 16) - th, 330, th, 0);
            else box.Box(35, low ? 6 : 10, 330, th);
            box.SetAsLastSibling();
            var cg = box.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            cg.alpha = 0;
            var bg = Ui.Frame(box, "ui2/tile", 0.452f, 8.1f, 13.6f, 5.4f, 7.7f);
            if (!bg.sprite) { bg.sprite = Ui.RoundSprite; bg.type = Image.Type.Sliced; bg.color = new Color32(0x1B, 0x16, 0x2A, 0xF2); }
            var summary = Json.Get(a, "summary") != null;
            var port = Ui.Img("port", box, Ui.HeroBg(summary ? "collect" : Json.Str(Json.Get(a, "cat")) ?? "path"), Color.white);
            if (low) port.rectTransform.Box(30, 5, 46, 42); else port.rectTransform.Box(30, 10, 61, 56);
            var pic = Ui.Img("art", port.transform, summary ? Ui.Art("r2/medal") : ArtOf(a), Color.white);
            pic.preserveAspect = true;
            pic.rectTransform.Fill();
            pic.rectTransform.offsetMin = new Vector2(3, 3);
            pic.rectTransform.offsetMax = new Vector2(-3, -3);
            var small = summary ? Loc.Tr("Достижения получены") : Loc.Tr("Достижение получено");
            var name = summary ? Loc.Tr("И ещё {n}", ("n", Json.Int(Json.Get(a, "summary")))) : Json.Str(Json.Get(a, "name")) + Stars(a);
            float tx = low ? 86 : 101;
            // справа место под штемпель (padding-right 58, в низкой плашке 53): текст на него не заходит
            var tw = (low ? 266 : 261) - tx;
            Ui.Label("small", box, small, low ? 11 : 13, Ui.GoldHi, TextAnchor.LowerLeft).rectTransform.Box(tx, low ? 9 : 14, tw, low ? 14 : 20);
            var t = Ui.Label("name", box, name, low ? 16 : 18, new Color32(0xFF, 0xF4, 0xD6, 0xFF), TextAnchor.UpperLeft, true).Shadow(1f);
            t.rectTransform.Box(tx, low ? 23 : 35, tw, low ? 24 : 34);
            t.LineHeight(1.04f);
            t.Fit(11);
            // штемпель «Получено» с сегодняшней датой на нарисованном месте плитки (.achtoast .astamp): ставится на глазах
            var host = Ui.Node("stamp", box);
            host.anchorMin = host.anchorMax = host.pivot = new Vector2(0, 0.5f);
            host.sizeDelta = Vector2.zero;
            host.anchoredPosition = new Vector2(low ? 290 : 288.5f, low ? 0.5f : 2f);
            stampScale = low ? 0.75f : 0.93f;
            stamp = Stamp(host, Now, Vector2.zero, stampScale, false);
            stampCg = stamp.gameObject.AddComponent<CanvasGroup>();
            StampIn(0);
            return cg;
        }

        static RectTransform stamp;
        static CanvasGroup stampCg;
        static float stampScale;

        /// <summary>Удар штемпеля (@keyframes stampin): k от 0 до 1, из крупного и повёрнутого в своё место, с лёгким отскоком.</summary>
        static void StampIn(float k)
        {
            if (!stamp) return;
            k = Mathf.Clamp01(k);
            var e = 1 + 2.2f * Mathf.Pow(k - 1, 3) + 1.2f * Mathf.Pow(k - 1, 2);   // выход с перелётом, как cubic-bezier(.3, 1.5, .5, 1)
            if (k >= 1) e = 1;
            stamp.localScale = Vector3.one * stampScale * Mathf.LerpUnclamped(2.2f, 1f, e);
            stamp.localEulerAngles = new Vector3(0, 0, Mathf.LerpUnclamped(24f, 14f, e));
            stampCg.alpha = Mathf.Clamp01(k / 0.55f);
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
            // значки без своей картинки берут талисман или карту с тем же смыслом (ICON_ALIAS в js/paint.js)
            if (id == "lantern") return Ui.Art("r2/ivalamp");
            if (id == "chest") id = "chest2";
            if (id == "dogfriend") id = "buddy";
            return Ui.Art("i/" + id) ?? Ui.Art("r2/" + id) ?? Ui.Art("c/" + id);
        }

        static string HeroNow => RunFlow.Current != null ? RunFlow.Current.Hero.Id : Settings.Cls;

        // ================= забег =================
        /// <summary>Новый забег: счётчик забегов и герой в базе знаний (newRun).</summary>
        public static void NewRun(RunState run)
        {
            StatAdd("runs");
            Analytics.Event("run_start", ("hero", run.Cls ?? ""), ("difficulty", run.Diff), ("run_number", (int)Num(St, "runs")));
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
            Analytics.Event("run_won", ("hero", run.Cls ?? ""), ("difficulty", run.Diff));
            RunEnd(run, true, maxSteps, maxSteps);
            SaveStats();
            return rec;
        }

        /// <summary>Забег окончен поражением (endRun). by — враг последнего боя.</summary>
        public static Dictionary<string, object> Loss(RunGame g, string by, int maxSteps)
        {
            if (finished == g.Run) return lastRec;
            St["losses"] = Num(St, "losses") + 1;
            var rec = Finish(g, false, by, maxSteps);
            RunEnd(g.Run, false, Math.Min(maxSteps, g.Run.Step + 1), maxSteps);
            SaveStats();
            return rec;
        }

        // конец забега в аналитику: герой, сложность, до какого уровня дошли; лучший уровень — вехами 5, 10, 25, 50
        static void RunEnd(RunState run, bool win, int level, int maxSteps)
        {
            Analytics.Event("run_end", ("hero", run.Cls ?? ""), ("difficulty", run.Diff), ("win", win), ("level", level), ("fights", run.Fights));
            var best = (int)Num(C, "anBest");
            foreach (var mark in new[] { 5, 10, 25, 50 })
                if (level >= mark && best < mark) Analytics.Event("level_reached", ("level", mark));
            if (level > best) { C["anBest"] = (double)level; achDirty = true; }
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
