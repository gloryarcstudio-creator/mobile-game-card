// Перед сборкой для магазина: напомнить, если покупки или реклама в ней ещё не настоящие.
// Сборку не останавливает, только пишет предупреждения в консоль.
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Fitil.EditorTools
{
    public sealed class BuildCheck : IPreprocessBuildWithReport
    {
        public int callbackOrder => 0;

        public void OnPreprocessBuild(BuildReport report)
        {
            var target = report.summary.platform;
            if (target != BuildTarget.Android && target != BuildTarget.iOS) return;
            if ((report.summary.options & BuildOptions.Development) != 0) return;

            if (Find("UnityEngine.Purchasing.StoreController") == null)
                Debug.LogWarning("Последний луч: в проекте нет пакета Unity IAP 5, покупки в этой сборке тестовые и бесплатные. Для магазина верните com.unity.purchasing в Packages/manifest.json.");

            if (Find("GoogleMobileAds.Api.MobileAds") == null)
            {
                Debug.LogWarning("Последний луч: в проекте нет плагина Google Mobile Ads, вместо рекламы в этой сборке тестовый отсчёт. Как подключить — в unity/README.md.");
                return;
            }
            var ads = Find("Fitil.Platform.Ads.AdMobAds");
            var field = ads != null ? ads.GetField(target == BuildTarget.iOS ? "IosUnit" : "AndroidUnit") : null;
            var unit = field != null ? field.GetRawConstantValue() as string : null;
            if (unit != null && unit.Contains("3940256099942544"))
                Debug.LogWarning("Последний луч: реклама идёт через пробные блоки Google и денег не принесёт. Перед выпуском впишите свои блоки в Assets/Fitil/Platform/Ads/AdMobAds.cs.");
        }

        static Type Find(string name) =>
            AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType(name, false)).FirstOrDefault(t => t != null);
    }
}
