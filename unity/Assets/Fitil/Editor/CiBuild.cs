// Сборка из командной строки (GitHub Actions):
// unity-editor -batchmode -quit -projectPath unity -buildTarget Android -executeMethod Fitil.EditorTools.CiBuild.Build
// Куда класть результат, задаёт переменная окружения CI_BUILD_PATH.
using System;
using UnityEditor;
using UnityEditor.Build.Reporting;
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

            // Сцен в проекте нет: игра строится кодом из пустой сцены
            var options = new BuildPlayerOptions
            {
                scenes = new string[0],
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
