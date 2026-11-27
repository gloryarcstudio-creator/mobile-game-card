// После создания проекта Gradle для Android:
// 1) режим согласия Firebase по умолчанию «запрещено». Firebase Analytics стартует вместе с приложением, раньше
//    кода игры: без этих отметок первые события ушли бы до ответа игрока в окне согласия. После ответа
//    FirebaseSink.SetConsent открывает то, что игрок разрешил (вне Европы — всё);
// 2) правила для R8 (сжатие кода): классы, которые SDK ищут по имени. Список из описания Tenjin.
// Для iOS то же делает IosPostprocess.cs.
#if UNITY_ANDROID
using System.IO;
using System.Xml;
using UnityEditor.Android;
using UnityEngine;

namespace Fitil.EditorTools
{
    public sealed class AndroidPostprocess : IPostGenerateGradleAndroidProject
    {
        const string AndroidNs = "http://schemas.android.com/apk/res/android";

        static readonly string[] ConsentDefaults =
        {
            "google_analytics_default_allow_analytics_storage",
            "google_analytics_default_allow_ad_storage",
            "google_analytics_default_allow_ad_user_data",
            "google_analytics_default_allow_ad_personalization_signals",
        };

        public int callbackOrder => 900;

        public void OnPostGenerateGradleAndroidProject(string path)
        {
            var manifest = Path.Combine(path, "src", "main", "AndroidManifest.xml");
            try
            {
                if (!File.Exists(manifest)) { Debug.LogWarning("AndroidPostprocess: нет файла " + manifest); return; }
                var doc = new XmlDocument();
                doc.Load(manifest);
                var app = doc.SelectSingleNode("/manifest/application") as XmlElement;
                if (app == null) { Debug.LogWarning("AndroidPostprocess: в манифесте нет <application>"); return; }
                foreach (var name in ConsentDefaults)
                {
                    XmlElement meta = null;
                    foreach (XmlNode n in app.ChildNodes)
                        if (n is XmlElement e && e.Name == "meta-data" && e.GetAttribute("name", AndroidNs) == name) meta = e;
                    if (meta == null)
                    {
                        meta = doc.CreateElement("meta-data");
                        app.AppendChild(meta);
                        Attr(doc, meta, "name", name);
                    }
                    Attr(doc, meta, "value", "false");
                }
                doc.Save(manifest);
            }
            catch (System.Exception e)
            {
                // сборку не ломаем: без отметок игра работает, только первые события уйдут до ответа в окне согласия
                Debug.LogWarning("AndroidPostprocess: отметки согласия не записаны: " + e.Message);
            }
            KeepRules(path);
        }

        static void Attr(XmlDocument doc, XmlElement e, string local, string value)
        {
            var a = e.GetAttributeNode(local, AndroidNs);
            if (a == null) { a = doc.CreateAttribute("android", local, AndroidNs); e.Attributes.Append(a); }
            a.Value = value;
        }

        const string KeepMarker = "# Fitil: SDK keep rules";

        static void KeepRules(string path)
        {
            var file = Path.Combine(path, "proguard-unity.txt");
            try
            {
                if (!File.Exists(file) || File.ReadAllText(file).Contains(KeepMarker)) return;
                File.AppendAllText(file, "\n" + KeepMarker + "\n"
                    + "-keep class com.tenjin.** { *; }\n"
                    + "-keep public class com.google.android.gms.ads.identifier.** { *; }\n"
                    + "-keep public class com.google.android.gms.common.** { *; }\n"
                    + "-keep public class com.android.installreferrer.** { *; }\n"
                    + "-keep class * extends java.util.ListResourceBundle { protected java.lang.Object[][] getContents(); }\n"
                    + "-keepattributes *Annotation*\n");
            }
            catch (System.Exception e) { Debug.LogWarning("AndroidPostprocess: правила R8 не дописаны: " + e.Message); }
        }
    }
}
#endif
