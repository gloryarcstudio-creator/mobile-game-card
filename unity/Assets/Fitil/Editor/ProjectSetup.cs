// Настройки проекта задаются кодом, а не руками в редакторе: так их видно в git и CI.
// Срабатывает при каждом открытии проекта и перед сборкой (Fitil → Применить настройки).
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Fitil.EditorTools
{
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        public const string Company = "Glory Arc Studio";
        public const string Product = "Последний луч";
        public const string BundleId = "com.gloryarcstudio.lastray"; // после выхода в магазины менять нельзя

        // Google Play блокирует сборки на Unity с уязвимостью CVE-2025-59489. Для 6000.0 исправлено с 6000.0.58f2.
        public const string MinUnity = "6000.0.58f2";

        static ProjectSetup()
        {
            EditorApplication.delayCall += () =>
            {
                CheckUnityVersion();
                Apply();
            };
        }

        [MenuItem("Fitil/Применить настройки")]
        public static void Apply()
        {
            PlayerSettings.companyName = Company;
            PlayerSettings.productName = Product;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, BundleId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, BundleId);

            // Только вертикально, как веб-версия
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

            // Во весь экран, в том числе вокруг выреза камеры: фон заходит под вырез,
            // а кнопки и текст держит безопасная зона (Fitil.Game.SafeArea)
            PlayerSettings.Android.renderOutsideSafeArea = true;
            PlayerSettings.Android.startInFullscreen = true;
            PlayerSettings.statusBarHidden = true;

            // Android: 64 бита (требование Google Play), IL2CPP
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;

            // iOS
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);
            PlayerSettings.iOS.targetOSVersionString = "15.0";

            // Ровная анимация на телефонах с 90/120 Гц: частоту задаёт Boot
            QualitySettings.vSyncCount = 0;
        }

        static void CheckUnityVersion()
        {
            if (Compare(Application.unityVersion, MinUnity) < 0)
                Debug.LogError($"Unity {Application.unityVersion} уязвима к CVE-2025-59489, Google Play не примет такую сборку. Поставьте 6000.0 LTS не ниже {MinUnity} через Unity Hub.");
        }

        // Сравнение версий вида 6000.0.58f2
        public static int Compare(string a, string b)
        {
            var pa = Parts(a);
            var pb = Parts(b);
            for (var i = 0; i < pa.Length; i++)
                if (pa[i] != pb[i]) return pa[i].CompareTo(pb[i]);
            return 0;
        }

        static int[] Parts(string v)
        {
            var r = new int[5];
            var n = 0;
            var cur = 0;
            var any = false;
            foreach (var c in v)
            {
                if (char.IsDigit(c)) { cur = cur * 10 + (c - '0'); any = true; continue; }
                if (any && n < 5) r[n++] = cur;
                cur = 0;
                any = false;
                if (n < 5 && c != '.' && "abfp".IndexOf(c) >= 0) r[n++] = "abfp".IndexOf(c); // буква выпуска: a < b < f < p
            }
            if (any && n < 5) r[n] = cur;
            return r;
        }
    }
}
