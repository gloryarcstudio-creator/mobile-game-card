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
            if (s.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }
    }
}
