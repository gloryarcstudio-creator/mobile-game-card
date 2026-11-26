// После сборки проекта Xcode: Info.plist для App Store Connect (шифрование только стандартное), текст запроса
// на отслеживание и режим согласия Firebase по умолчанию «запрещено» (см. AndroidPostprocess.cs).
// Сам запрос на отслеживание показывает окно согласия Google после пояснения (AdMob → Privacy & messaging → IDFA explainer).
#if UNITY_IOS
using System.IO;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEditor.iOS.Xcode;

namespace Fitil.EditorTools
{
    public static class IosPostprocess
    {
        [PostProcessBuild(900)]
        public static void OnPostprocessBuild(BuildTarget target, string path)
        {
            if (target != BuildTarget.iOS) return;
            var plistPath = Path.Combine(path, "Info.plist");
            var plist = new PlistDocument();
            plist.ReadFromFile(plistPath);
            var root = plist.root;
            root.SetBoolean("ITSAppUsesNonExemptEncryption", false);
            if (!root.values.ContainsKey("NSUserTrackingUsageDescription")) root.SetString("NSUserTrackingUsageDescription", SdkSetup.AttText);
            foreach (var k in new[] { "GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE", "GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE",
                                      "GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA", "GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS" })
                root.SetBoolean(k, false);
            File.WriteAllText(plistPath, plist.WriteToString());
        }
    }
}
#endif
