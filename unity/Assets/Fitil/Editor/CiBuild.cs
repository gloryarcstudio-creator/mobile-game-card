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
            var path = Environment.GetEnvironmentVariable("CI_BUILD_PATH");
            if (string.IsNullOrEmpty(path))
                path = target == BuildTarget.Android ? "build/Android/LastRay.apk" : "build/" + target;
            // Сборка для Linux нужна только для снимков экранов в GitHub: пробная, с клавишей F9 и ключом -tour
            var linux = target == BuildTarget.StandaloneLinux64;
            if (linux) PlayerSettings.runInBackground = true; // на сервере у окна нет фокуса

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
                options = linux ? BuildOptions.Development : BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(options);
            var s = report.summary;
            Debug.Log("CiBuild: " + s.result + ", ошибок " + s.totalErrors + ", размер " + s.totalSize);
            if (s.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }
    }
}
