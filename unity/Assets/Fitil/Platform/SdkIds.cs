// Идентификаторы SDK. В репозитории их нет: репозиторий открытый, поэтому при сборке в GitHub они берутся
// из секретов репозитория (Fitil.EditorTools.SdkSetup) и кладутся в Resources/sdk_ids.json, которого нет в git.
// Без секретов остаются пробные рекламные блоки Google (показывают пробные ролики и денег не приносят),
// а Tenjin не запускается.
using System;
using UnityEngine;

namespace Fitil.Platform
{
    [Serializable]
    public sealed class SdkIdsData
    {
        public string admobRewardedAndroid = "";
        public string admobRewardedIos = "";
        public string tenjinKey = "";
    }

    public static class SdkIds
    {
        // пробные блоки Google «с вознаграждением»
        const string TestRewardedAndroid = "ca-app-pub-3940256099942544/5224354917";
        const string TestRewardedIos = "ca-app-pub-3940256099942544/1712485313";

        static SdkIdsData data;
        static SdkIdsData Data
        {
            get
            {
                if (data != null) return data;
                data = new SdkIdsData();
                try
                {
                    var file = Resources.Load<TextAsset>("sdk_ids");
                    if (file != null) JsonUtility.FromJsonOverwrite(file.text, data);
                }
                catch (Exception e) { Debug.LogWarning("sdk_ids: " + e.Message); }
                return data;
            }
        }

        static bool Ios => Application.platform == RuntimePlatform.IPhonePlayer;
        static bool Set(string id) => !string.IsNullOrWhiteSpace(id);

        /// <summary>Свои рекламные блоки вписаны: реклама настоящая. В пробной сборке (Development Build) всегда пробные блоки.</summary>
        public static bool OwnAds => !Debug.isDebugBuild && Set(Ios ? Data.admobRewardedIos : Data.admobRewardedAndroid);

        public static string AdMobRewarded => OwnAds ? (Ios ? Data.admobRewardedIos : Data.admobRewardedAndroid).Trim() : Ios ? TestRewardedIos : TestRewardedAndroid;

        public static string TenjinKey => Set(Data.tenjinKey) ? Data.tenjinKey.Trim() : null;
    }
}
