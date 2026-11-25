// Снимки всех экранов одной клавишей (F9 в редакторе Unity и в Development Build).
// Игра сама проходит по экранам и кладёт картинки в папку Screens рядом с Assets: их удобно сверять с веб-версией.
// Обход идёт настоящими экранами, поэтому в статистику редактора попадут пробный забег, победа и поражение.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Fitil.Game
{
    public static class Tour
    {
        static bool running;

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

            IEnumerator Shot(string name, Action show, float wait = 1.8f)
            {
                Menus.Close();
                Tip.Close();
                // окна прошлого шага (колода, выбор карты) закрываются: иначе они остались бы поверх следующего экрана
                for (var i = boot.Top.childCount - 1; i >= 0; i--)
                {
                    var c = boot.Top.GetChild(i);
                    if (c.name == "overlay" || c.name == "moment") UnityEngine.Object.Destroy(c.gameObject);
                }
                yield return null;
                Mark(name);
                try { show(); }
                catch (Exception e) { log.Add(name + ": " + e); Debug.LogError("Tour " + name + ": " + e); }
                yield return new WaitForSecondsRealtime(wait);
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
                    yield return Shot(name, show, name.Contains("fight") || name.Contains("defeat") ? 3.2f : 1.8f);

            Menus.Close();
            try { boot.ShowTitle(); } catch (Exception e) { log.Add("title: " + e); }
            File.WriteAllLines(Path.Combine(dir, "log.txt"), log.Count > 0 ? log.ToArray() : new[] { "ok" });
            Hud.Toast("Снимки готовы: папка Screens");
            running = false;
            if (Wanted) { Application.Quit(); yield break; }
            Application.OpenURL("file://" + dir.Replace('\\', '/'));
        }
    }
}
