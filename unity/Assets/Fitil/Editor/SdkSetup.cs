// Настройка SDK перед сборкой. Репозиторий открытый, поэтому идентификаторов в нём нет: в GitHub они лежат
// в секретах репозитория и приходят сюда переменными окружения.
//   ADMOB_APP_ID_ANDROID, ADMOB_APP_ID_IOS        — id приложения AdMob (вид ca-app-pub-…~…)
//   ADMOB_REWARDED_ANDROID, ADMOB_REWARDED_IOS    — рекламные блоки «с вознаграждением» (вид ca-app-pub-…/…)
//   TENJIN_SDK_KEY                                — ключ SDK из кабинета Tenjin
// Без переменных ставятся пробные id Google: сборка проходит, реклама пробная.
// Id приложения пишутся в настройки плагина Google Mobile Ads, остальное — в Resources/sdk_ids.json (в git не попадает).
using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Fitil.EditorTools
{
    public sealed class SdkSetup : IPreprocessBuildWithReport
    {
        // пробные id приложения из документации Google
        const string TestAndroidAppId = "ca-app-pub-3940256099942544~3347511713";
        const string TestIosAppId = "ca-app-pub-3940256099942544~1458002511";

        /// <summary>Текст системного запроса на отслеживание в iOS (NSUserTrackingUsageDescription).</summary>
        const string AttText = "This lets us show you ads that are more relevant. The game stays free either way.";

        const string IdsPath = "Assets/Fitil/Resources/sdk_ids.json";

        public int callbackOrder => -100;
        public void OnPreprocessBuild(BuildReport report) => Apply();

        static string Env(string key)
        {
            var v = Environment.GetEnvironmentVariable(key);
            return string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        }

        [MenuItem("Fitil/SDK/Apply ids from environment")]
        public static void Apply()
        {
            WriteIds();
            AdMobSettings();
        }

        [Serializable]
        sealed class Ids
        {
            public string admobRewardedAndroid = "";
            public string admobRewardedIos = "";
            public string tenjinKey = "";
        }

        static void WriteIds()
        {
            var ids = new Ids
            {
                admobRewardedAndroid = Env("ADMOB_REWARDED_ANDROID") ?? "",
                admobRewardedIos = Env("ADMOB_REWARDED_IOS") ?? "",
                tenjinKey = Env("TENJIN_SDK_KEY") ?? "",
            };
            var any = ids.admobRewardedAndroid.Length + ids.admobRewardedIos.Length + ids.tenjinKey.Length > 0;
            // без переменных файл не трогаем: на своём компьютере его можно заполнить руками
            if (!any && File.Exists(IdsPath)) return;
            Directory.CreateDirectory(Path.GetDirectoryName(IdsPath));
            File.WriteAllText(IdsPath, JsonUtility.ToJson(ids, true));
            AssetDatabase.ImportAsset(IdsPath);
            // в журнал — только то, что заданы; сами значения не печатаются
            Debug.Log("SdkSetup: рекламный блок Android " + (ids.admobRewardedAndroid.Length > 0 ? "свой" : "пробный")
                + ", iOS " + (ids.admobRewardedIos.Length > 0 ? "свой" : "пробный") + ", ключ Tenjin " + (ids.tenjinKey.Length > 0 ? "задан" : "не задан"));
        }

        static void AdMobSettings()
        {
            Type type = null;
            foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
            {
                try { type = a.GetType("GoogleMobileAds.Editor.GoogleMobileAdsSettings", false); } catch { }
                if (type != null) break;
            }
            if (type == null) { Debug.Log("SdkSetup: плагина Google Mobile Ads нет, реклама тестовая"); return; }
            var load = type.GetMethod("LoadInstance", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            var inst = load?.Invoke(null, null) as ScriptableObject;
            if (inst == null) { Debug.LogWarning("SdkSetup: настройки Google Mobile Ads не найдены"); return; }
            var so = new SerializedObject(inst);
            var changed = SetAppId(so, "adMobAndroidAppId", Env("ADMOB_APP_ID_ANDROID"), TestAndroidAppId);
            changed |= SetAppId(so, "adMobIOSAppId", Env("ADMOB_APP_ID_IOS"), TestIosAppId);
            var att = so.FindProperty("userTrackingUsageDescription");
            if (att != null && string.IsNullOrWhiteSpace(att.stringValue)) { att.stringValue = AttText; changed = true; }
            if (changed)
            {
                so.ApplyModifiedPropertiesWithoutUndo();
                EditorUtility.SetDirty(inst);
                AssetDatabase.SaveAssets();
            }
            Debug.Log("SdkSetup: id приложения AdMob Android " + (Env("ADMOB_APP_ID_ANDROID") != null ? "свой" : "пробный")
                + ", iOS " + (Env("ADMOB_APP_ID_IOS") != null ? "свой" : "пробный"));
        }

        // свой id из переменной ставится всегда; без неё остаётся введённый руками, а пустое место занимает пробный
        static bool SetAppId(SerializedObject so, string field, string own, string test)
        {
            var p = so.FindProperty(field);
            if (p == null) return false;
            var cur = (p.stringValue ?? "").Trim();
            var want = own ?? (cur.Length > 0 ? cur : test);
            if (cur == want) return false;
            p.stringValue = want;
            return true;
        }
    }
}
