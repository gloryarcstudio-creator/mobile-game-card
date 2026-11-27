// Сборка из командной строки (GitHub Actions):
// unity-editor -batchmode -quit -projectPath unity -buildTarget Android -executeMethod Fitil.EditorTools.CiBuild.Build
// Куда класть результат, задаёт переменная окружения CI_BUILD_PATH.
using System;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Fitil.EditorTools
{
    public static class CiBuild
    {
        /// <summary>Сборка для Google Play на своём компьютере: AAB с набором ресурсов, подписанный ключом из
        /// Player Settings → Publishing Settings. Результат: Builds/LastRay.aab рядом с папкой Assets.</summary>
        [MenuItem("Fitil/Сборка/AAB для Google Play")]
        public static void BuildPlayAab()
        {
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
            {
                EditorUtility.DisplayDialog("Последний луч", "В редакторе нет модуля Android Build Support. Его ставит Unity Hub: Installs → шестерёнка у версии → Add modules.", "Понятно");
                return;
            }
            if (!PlayerSettings.Android.useCustomKeystore || string.IsNullOrEmpty(PlayerSettings.Android.keystoreName)
                || string.IsNullOrEmpty(PlayerSettings.Android.keystorePass) || string.IsNullOrEmpty(PlayerSettings.Android.keyaliasPass))
            {
                EditorUtility.DisplayDialog("Последний луч", "Не задан ключ подписи. Edit → Project Settings → Player → Android → Publishing Settings: "
                    + "включить Custom Keystore, выбрать или создать файл ключа, выбрать alias и ввести оба пароля. Пароли Unity не запоминает: их вводят после каждого запуска редактора. "
                    + "Без своего ключа Google Play пакет не примет.", "Понятно");
                return;
            }
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android
                && !EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android))
            {
                EditorUtility.DisplayDialog("Последний луч", "Не удалось переключить проект на Android.", "Понятно");
                return;
            }
            ProjectSetup.Apply();
            SdkSetup.Apply();
            const string scenePath = "Assets/Fitil/CiBoot.unity";
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, scenePath);
            const string outPath = "Builds/LastRay.aab";
            System.IO.Directory.CreateDirectory("Builds");
            var wasBundle = EditorUserBuildSettings.buildAppBundle;
            var wasSplit = PlayerSettings.Android.splitApplicationBinary;
            EditorUserBuildSettings.buildAppBundle = true;
            PlayerSettings.Android.splitApplicationBinary = true;
            BundleSymbols(true);
            try
            {
                var s = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { scenePath },
                    locationPathName = outPath,
                    target = BuildTarget.Android,
                    options = BuildOptions.None,
                }).summary;
                var ok = s.result == BuildResult.Succeeded;
                Debug.Log("Сборка AAB: " + s.result + ", ошибок " + s.totalErrors + ", код версии " + PlayerSettings.Android.bundleVersionCode);
                EditorUtility.DisplayDialog("Последний луч", ok
                    ? "Готово: " + System.IO.Path.GetFullPath(outPath) + "\nВерсия " + PlayerSettings.bundleVersion + ", код версии " + PlayerSettings.Android.bundleVersionCode
                      + ". Для следующей загрузки в Google Play код версии нужно увеличить на 1 (Player → Other Settings → Bundle Version Code)."
                    : "Сборка не прошла, ошибок " + s.totalErrors + ". Подробности в окне Console.", "Понятно");
                if (ok) EditorUtility.RevealInFinder(outPath);
            }
            finally
            {
                BundleSymbols(false);
                EditorUserBuildSettings.buildAppBundle = wasBundle;
                PlayerSettings.Android.splitApplicationBinary = wasSplit;
            }
        }

        // Подпись для Google Play: файл ключа и пароли приходят из секретов репозитория. Без них сборка подписана
        // отладочным ключом (годится для проверки на телефоне, Google Play её не примет). Значения в журнал не идут.
        static void Signing()
        {
            var store = Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PATH");
            var storePass = Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PASS");
            var alias = Environment.GetEnvironmentVariable("ANDROID_KEY_ALIAS");
            var keyPass = Environment.GetEnvironmentVariable("ANDROID_KEY_PASS");
            if (string.IsNullOrEmpty(keyPass)) keyPass = storePass;
            var own = !string.IsNullOrEmpty(store) && System.IO.File.Exists(store) && !string.IsNullOrEmpty(storePass) && !string.IsNullOrEmpty(alias);
            PlayerSettings.Android.useCustomKeystore = own;
            if (own)
            {
                PlayerSettings.Android.keystoreName = store;
                PlayerSettings.Android.keystorePass = storePass;
                PlayerSettings.Android.keyaliasName = alias.Trim();
                PlayerSettings.Android.keyaliasPass = keyPass;
            }
            // код версии: Google Play принимает только больший, чем у прошлой загрузки
            if (int.TryParse(Environment.GetEnvironmentVariable("CI_VERSION_CODE"), out var code) && code > 0)
                PlayerSettings.Android.bundleVersionCode = code;
            Debug.Log("CiBuild: подпись " + (own ? "своим ключом" : "отладочная") + ", код версии " + PlayerSettings.Android.bundleVersionCode);
        }

        // Отладочные символы нативного кода внутри AAB: с ними Google Play показывает понятные места сбоев и не
        // предупреждает при загрузке. Игрокам они не скачиваются. Настройка появилась в Unity 6, поэтому ставится
        // через отражение: в редакторе без неё сборка идёт как раньше.
        static void BundleSymbols(bool on)
        {
            try
            {
                Type settings = null, level = null, format = null;
                foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
                {
                    settings = settings ?? a.GetType("UnityEditor.Android.UserBuildSettings+DebugSymbols", false);
                    level = level ?? a.GetType("Unity.Android.Types.DebugSymbolLevel", false);
                    format = format ?? a.GetType("Unity.Android.Types.DebugSymbolFormat", false);
                }
                if (settings == null || level == null || format == null) { Debug.Log("CiBuild: настройки символов не найдены, AAB без символов"); return; }
                // свойства названы со строчной буквы (level, format); на случай смены имён ищем без учёта регистра
                const System.Reflection.BindingFlags any = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.IgnoreCase;
                var pLevel = settings.GetProperty("level", any);
                var pFormat = settings.GetProperty("format", any);
                if (pLevel == null || pFormat == null)
                {
                    var have = new System.Collections.Generic.List<string>();
                    foreach (var m in settings.GetMembers(any)) have.Add(m.Name);
                    Debug.Log("CiBuild: у настроек символов другие имена: " + string.Join(", ", have));
                    return;
                }
                pLevel.SetValue(null, Enum.Parse(level, on ? "SymbolTable" : "None"));
                if (on) pFormat.SetValue(null, Enum.Parse(format, "IncludeInBundle"));
                Debug.Log("CiBuild: символы в AAB " + (on ? "включены" : "выключены"));
            }
            catch (Exception e) { Debug.Log("CiBuild: символы в AAB не настроены: " + e.Message); }
        }

        public static void Build()
        {
            ProjectSetup.Apply();
            var target = EditorUserBuildSettings.activeBuildTarget;
            // Платформу задаёт переменная TARGET: ключ -buildTarget редактор может молча не принять,
            // и тогда вместо Android или iOS собралась бы игра для Linux
            var want = Environment.GetEnvironmentVariable("TARGET");
            if (!string.IsNullOrEmpty(want))
            {
                if (!Enum.TryParse(want, out BuildTarget asked))
                {
                    Debug.LogError("CiBuild: неизвестная платформа " + want);
                    EditorApplication.Exit(1);
                    return;
                }
                var group = BuildPipeline.GetBuildTargetGroup(asked);
                if (!BuildPipeline.IsBuildTargetSupported(group, asked))
                {
                    var engines = System.IO.Path.Combine(EditorApplication.applicationContentsPath, "PlaybackEngines");
                    var have = System.IO.Directory.Exists(engines) ? string.Join(", ", System.IO.Directory.GetDirectories(engines)) : "папки нет";
                    Debug.LogError("CiBuild: в редакторе нет модуля для " + asked + ". Стоит " + target + ". Модули в " + engines + ": " + have
                        + ". Ключи: " + string.Join(" ", Environment.GetCommandLineArgs()).Replace(Environment.GetEnvironmentVariable("UNITY_PASSWORD") ?? "\n", "***").Replace(Environment.GetEnvironmentVariable("UNITY_EMAIL") ?? "\n", "***"));
                    EditorApplication.Exit(1);
                    return;
                }
                if (target != asked && !EditorUserBuildSettings.SwitchActiveBuildTarget(group, asked))
                {
                    Debug.LogError("CiBuild: не удалось переключиться на " + asked + ", стоит " + target);
                    EditorApplication.Exit(1);
                    return;
                }
                Debug.Log("CiBuild: платформа " + asked + ", была " + target);
                target = asked;
            }
            SdkSetup.Apply();   // идентификаторы SDK из секретов сборки (или пробные)
            if (target == BuildTarget.Android) Signing();
            var path = Environment.GetEnvironmentVariable("CI_BUILD_PATH");
            if (string.IsNullOrEmpty(path))
                path = target == BuildTarget.Android ? "build/Android/LastRay.apk" : "build/" + target;
            // Сборка для Linux нужна только для снимков экранов в GitHub (ключ -tour)
            var linux = target == BuildTarget.StandaloneLinux64;
            if (linux) PlayerSettings.runInBackground = true; // на сервере у окна нет фокуса

            // В журнал: в каком виде картинки попадут в сборку (от этого зависит вес приложения)
            foreach (var art in new[] { "ea/bat_idle", "bg/bg_stage1_town_day", "ui2/row2" })
            {
                var tex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Fitil/Resources/Art/" + art + ".png");
                Debug.Log("CiBuild: " + art + " " + (tex ? tex.width + "x" + tex.height + " " + tex.format : "нет файла"));
            }

            // Сцен в проекте нет: игра строится кодом. Несохранённую сцену собрать нельзя,
            // поэтому на время сборки создаётся сцена с камерой по умолчанию
            const string scenePath = "Assets/Fitil/CiBoot.unity";
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, scenePath);
            var options = new BuildPlayerOptions
            {
                scenes = new[] { scenePath },
                locationPathName = path,
                target = target,
                options = BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(options);
            var s = report.summary;
            Debug.Log("CiBuild: " + s.result + ", ошибок " + s.totalErrors + ", размер " + s.totalSize);
            if (s.result != BuildResult.Succeeded) { EditorApplication.Exit(1); return; }

            // Для Google Play: пакет AAB, где картинки и звук вынесены в набор ресурсов (Play Asset Delivery,
            // ставится вместе с игрой). Основная часть остаётся далеко под лимитом 200 МБ, качество то же.
            // APK выше нужен для проверки на телефоне. Путь задаёт CI_AAB_PATH; без него AAB не собирается.
            var aab = Environment.GetEnvironmentVariable("CI_AAB_PATH");
            if (target != BuildTarget.Android || string.IsNullOrEmpty(aab)) return;
            EditorUserBuildSettings.buildAppBundle = true;
            PlayerSettings.Android.splitApplicationBinary = true;
            BundleSymbols(true);
            try
            {
                options.locationPathName = aab;
                var r2 = BuildPipeline.BuildPlayer(options).summary;
                Debug.Log("CiBuild: AAB " + r2.result + ", ошибок " + r2.totalErrors + ", размер " + r2.totalSize);
                if (r2.result != BuildResult.Succeeded) EditorApplication.Exit(1);
            }
            finally
            {
                BundleSymbols(false);
                EditorUserBuildSettings.buildAppBundle = false;
                PlayerSettings.Android.splitApplicationBinary = false;
            }
        }
    }
}
