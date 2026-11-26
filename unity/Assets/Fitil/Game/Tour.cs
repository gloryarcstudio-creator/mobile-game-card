// Снимки всех экранов одной клавишей (F9 в редакторе Unity и в Development Build).
// Игра сама проходит по экранам и кладёт картинки в папку Screens рядом с Assets: их удобно сверять с веб-версией.
// Обход идёт настоящими экранами, поэтому в статистику редактора попадут пробный забег, победа и поражение.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using Fitil.Core;
using UnityEngine;

namespace Fitil.Game
{
    public static class Tour
    {
        static bool running;
        /// <summary>Идёт обход экранов: плашки достижений не показываются сами, чтобы не закрывать снимки.</summary>
        public static bool Running => running;

        // Ключи командной строки пробной сборки: -tour запускает обход сам, -tourDir <папка> задаёт, куда класть снимки
        public static bool Wanted => wanted ?? (wanted = (Debug.isDebugBuild || Application.platform == RuntimePlatform.LinuxPlayer)
            && !Application.isEditor && Array.IndexOf(Environment.GetCommandLineArgs(), "-tour") >= 0).Value;
        static bool? wanted;

        /// <summary>Язык снимков: ключ -tourLang ru|en|uk.</summary>
        public static string Lang => Arg("-tourLang");

        static string Arg(string key)
        {
            var a = Environment.GetCommandLineArgs();
            var i = Array.IndexOf(a, key);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
        }

        // Отметки в журнале при съёмке в GitHub: по ним видно, на каком шаге игра остановилась
        public static void Mark(string what)
        {
            if (!Wanted) return;
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            Application.SetStackTraceLogType(LogType.Warning, StackTraceLogType.None);
            Debug.Log("TOUR " + what + " t=" + Time.realtimeSinceStartup.ToString("0.0"));
        }

        static string ArgDir() => Arg("-tourDir");

        // Проверка надписей на экране: обрезанный текст (cut), текст шире или выше своей рамки (out) и текст за краем экрана (off).
        // Строка: шаг | вид | путь к надписи | насколько вышла | начало текста. Итог лежит в overflow.txt рядом со снимками.
        static readonly Vector3[] corners = new Vector3[4];
        static void Audit(string step, List<string> outp)
        {
            var canvas = Boot.Instance.GetComponentInParent<Canvas>() ?? UnityEngine.Object.FindFirstObjectByType<Canvas>();
            if (!canvas) return;
            var root = (RectTransform)canvas.transform;
            Rect In(RectTransform rt)
            {
                rt.GetWorldCorners(corners);
                var a = root.InverseTransformPoint(corners[0]);
                var b = root.InverseTransformPoint(corners[2]);
                return Rect.MinMaxRect(Mathf.Min(a.x, b.x), Mathf.Min(a.y, b.y), Mathf.Max(a.x, b.x), Mathf.Max(a.y, b.y));
            }
            var screen = In(root);
            foreach (var t in UnityEngine.Object.FindObjectsByType<UnityEngine.UI.Text>(FindObjectsSortMode.None))
            {
                if (!t.isActiveAndEnabled || string.IsNullOrEmpty(t.text) || t.color.a < 0.05f) continue;
                var hidden = false;
                foreach (var g in t.GetComponentsInParent<CanvasGroup>()) if (g.alpha < 0.05f) hidden = true;
                if (hidden) continue;
                var gen = t.cachedTextGenerator;
                var verts = gen.verts;
                if (verts.Count == 0) continue;
                float x0 = float.MaxValue, y0 = float.MaxValue, x1 = float.MinValue, y1 = float.MinValue;
                var any = false;
                for (var i = 0; i < verts.Count; i++)
                {
                    if (verts[i].color.a == 0) continue;
                    var w = root.InverseTransformPoint(t.rectTransform.TransformPoint(verts[i].position / t.pixelsPerUnit));
                    x0 = Mathf.Min(x0, w.x); x1 = Mathf.Max(x1, w.x); y0 = Mathf.Min(y0, w.y); y1 = Mathf.Max(y1, w.y);
                    any = true;
                }
                if (!any) continue;
                var plain = System.Text.RegularExpressions.Regex.Replace(t.text, "<[^>]+>", "");
                var kinds = new List<string>();
                // обрезанный текст: строкам не хватило высоты рамки
                if (t.verticalOverflow == VerticalWrapMode.Truncate)
                {
                    if (!t.resizeTextForBestFit) { var need = t.preferredHeight - t.rectTransform.rect.height; if (need > 2f) kinds.Add("cut " + need.ToString("0")); }
                    else if (t.text == plain && gen.characterCountVisible < plain.TrimEnd().Length - 1) kinds.Add("cut fit " + gen.characterCountVisible + "/" + plain.Length);
                    else if (gen.fontSizeUsedForBestFit > 0 && gen.fontSizeUsedForBestFit <= t.resizeTextMinSize && t.resizeTextMinSize < t.resizeTextMaxSize) kinds.Add("min " + gen.fontSizeUsedForBestFit);
                }
                // вышел за свою рамку: ближайший родитель с ненулевым размером
                RectTransform box = null;
                for (var p = t.rectTransform.parent as RectTransform; p != null && p != root; p = p.parent as RectTransform)
                    if (p.rect.width > 4 && p.rect.height > 4) { box = p; break; }
                if (box != null)
                {
                    var b = In(box);
                    var over = Mathf.Max(b.xMin - x0, x1 - b.xMax, b.yMin - y0, y1 - b.yMax);
                    if (over > 3f) kinds.Add("out " + over.ToString("0") + " of " + box.name + " " + b.width.ToString("0") + "x" + b.height.ToString("0"));
                }
                var off = Mathf.Max(screen.xMin - x0, x1 - screen.xMax, screen.yMin - y0, y1 - screen.yMax);
                if (off > 2f) kinds.Add("off " + off.ToString("0"));
                if (kinds.Count == 0) continue;
                var path = t.name;
                for (var p = t.transform.parent; p != null && p != root && path.Length < 90; p = p.parent) path = p.name + "/" + path;
                outp.Add(step + " | " + string.Join(", ", kinds) + " | " + path + " | " + plain.Replace("\n", " ").Substring(0, Mathf.Min(40, plain.Length)));
            }
        }

        public static void Start()
        {
            if (running || !Boot.Instance) return;
            Boot.Instance.StartCoroutine(Run());
        }

        static IEnumerator Run()
        {
            running = true;
            var dir = ArgDir() != null ? Path.GetFullPath(ArgDir()) : Application.isEditor ? Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Screens")) : Path.Combine(Application.persistentDataPath, "Screens");
            Directory.CreateDirectory(dir);
            foreach (var f in Directory.GetFiles(dir, "*.png")) File.Delete(f);
            var boot = Boot.Instance;
            var log = new List<string>();
            var audit = new List<string>();

            IEnumerator Shot(string name, Action show, float wait = 1.8f)
            {
                Menus.Close();
                Tip.Close();
                // окна прошлого шага (колода, выбор карты) закрываются: иначе они остались бы поверх следующего экрана
                for (var i = boot.Top.childCount - 1; i >= 0; i--)
                {
                    var c = boot.Top.GetChild(i);
                    if (c.name == "overlay" || c.name == "moment" || c.name == "achtoast") UnityEngine.Object.Destroy(c.gameObject);
                }
                yield return null;
                Mark(name);
                try { show(); }
                catch (Exception e) { log.Add(name + ": " + e); Debug.LogError("Tour " + name + ": " + e); }
                yield return new WaitForSecondsRealtime(wait);
                try { Audit(name, audit); } catch (Exception e) { log.Add("audit " + name + ": " + e.Message); }
                ScreenCapture.CaptureScreenshot(Path.Combine(dir, name + ".png"));
                yield return new WaitForSecondsRealtime(0.35f);
            }

            yield return Shot("00_title", boot.ShowTitle);
            yield return Shot("01_heroes", boot.ShowHeroes);
            yield return Shot("02_settings", () => { boot.ShowTitle(); Menus.ShowSettings(); });
            yield return Shot("03_glossary", () => Menus.ShowGlossary());
            yield return Shot("04_achievements", () => Progress.ShowAchievements());
            yield return Shot("05_codex", () => Progress.ShowCodex());
            yield return Shot("06_stats", () => Progress.ShowStats());
            yield return Shot("07_store", () => StoreScreen.Show(() => Menus.Close()));
            yield return Shot("08_intro", () => { Menus.Close(); boot.ShowIntro("lamp", () => { }); });

            // пробный забег первым героем на обычной сложности
            RunFlow flow = null;
            try
            {
                Menus.Close();
                boot.Clear(); // как при старте забега с экрана героев
                flow = new RunFlow(boot.Defs, "lamp", 1);
                flow.Start();
            }
            catch (Exception e) { log.Add("run: " + e); Debug.LogError("Tour run: " + e); }
            if (flow != null)
                foreach (var (name, show) in flow.TourSteps())
                    yield return Shot(name, show, name.Contains("quick") ? 0.45f : name.Contains("fight") || name.Contains("defeat") ? 3.2f : 1.8f);

            // база знаний с открытыми записями: вкладки и страницы записей
            Menus.Close();
            try { boot.ShowTitle(); Progress.TourOpenAll(); } catch (Exception e) { log.Add("codex: " + e); }
            yield return Shot("40_cx_heroes", () => Progress.ShowCodex());
            yield return Shot("41_cx_hero", () => Progress.ShowCodex(null, "h", "lamp"));
            yield return Shot("42_cx_enemies", () => Progress.ShowCodex(null, "e"));
            yield return Shot("43_cx_enemy", () => Progress.ShowCodex(null, "e", "scarfsnake"));
            yield return Shot("44_cx_cards", () => Progress.ShowCodex(null, "c"));
            yield return Shot("45_cx_card", () => Progress.ShowCodex(null, "c", "eveninglamp"));
            yield return Shot("46_cx_relics", () => Progress.ShowCodex(null, "r"));
            yield return Shot("47_cx_relic", () => Progress.ShowCodex(null, "r", "oilcan"));

            // достижения полученными, история забегов и карты героя
            Menus.Close();
            try { Progress.TourSeed(); } catch (Exception e) { log.Add("seed: " + e); }
            var cats = Progress.Cats;
            for (var i = 0; i < cats.Count; i++)
            {
                var id = cats[i].id;
                yield return Shot("5" + i + "_ach_" + id, () => Progress.ShowAchievements(null, id));
            }
            yield return Shot("55_stats_sum", () => Progress.ShowStats());
            yield return Shot("56_stats_runs", () => Progress.ShowStats(null, "runs"));
            yield return Shot("57_stats_run_win", () => Progress.ShowStats(null, "runs", 0));
            yield return Shot("58_stats_run_lose", () => Progress.ShowStats(null, "runs", 1));
            yield return Shot("59_hero_cards", () =>
            {
                Menus.Close();
                boot.ShowHeroes();
                var hs = UnityEngine.Object.FindFirstObjectByType<HeroSelect>();
                if (hs) hs.TourCards("lamp");
            });

            // все карты игры страницами (обычные и улучшенные): проверка надписей на каждой
            var all = new List<CardInst>();
            foreach (var c in boot.Defs.Cards.Values) { all.Add(new CardInst { Id = c.Id }); if (c.Type != "status") all.Add(new CardInst { Id = c.Id, Up = true }); }
            for (var page = 0; page * 20 < all.Count; page++)
            {
                var from = page * 20;
                yield return Shot("7" + page.ToString("00") + "_quick_cards", () =>
                {
                    Menus.Window(out var layer);
                    for (var i = from; i < Mathf.Min(from + 20, all.Count); i++)
                    {
                        var v = CardView.Make(layer, all[i], boot.Defs, null, 92);
                        v.Rect.anchorMin = v.Rect.anchorMax = new Vector2(0, 1);
                        v.Rect.pivot = new Vector2(0.5f, 0.5f);
                        v.Rect.anchoredPosition = new Vector2(8 + 46 + (i - from) % 4 * 97, -(60 + 66 + (i - from) / 4 * 150));
                    }
                });
            }

            Menus.Close();
            try { boot.ShowTitle(); } catch (Exception e) { log.Add("title: " + e); }
            File.WriteAllLines(Path.Combine(dir, "overflow.txt"), audit.ToArray());
            File.WriteAllLines(Path.Combine(dir, "log.txt"), log.Count > 0 ? log.ToArray() : new[] { "ok" });
            Hud.Toast("Снимки готовы: папка Screens");
            running = false;
            if (Wanted) { Application.Quit(); yield break; }
            Application.OpenURL("file://" + dir.Replace('\\', '/'));
        }
    }
}
