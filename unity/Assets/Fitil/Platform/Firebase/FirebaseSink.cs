// Firebase: Analytics (события), Crashlytics (падения) и Remote Config. Подключается сам, когда в проекте есть пакеты
// Firebase (условие FITIL_FIREBASE ставит Unity по пакету com.google.firebase.analytics, см. asmdef рядом).
// Файлы настроек google-services.json и GoogleService-Info.plist при сборке в GitHub берутся из секретов.
// Режим согласия: пока игрок в Европе не ответил в окне согласия, хранилища выключены.
#if FITIL_FIREBASE
using System;
using System.Collections.Generic;
using Firebase;
using Firebase.Analytics;
using Firebase.Extensions;
using UnityEngine;

namespace Fitil.Platform.Firebase
{
    public sealed class FirebaseSink : IAnalyticsSink
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Register()
        {
            if (Application.isEditor) return;
            if (Application.platform != RuntimePlatform.Android && Application.platform != RuntimePlatform.IPhonePlayer) return;
            Analytics.Add(new FirebaseSink());
        }

        public static bool Ready { get; private set; }
        static event Action OnReady;
        public static void WhenReady(Action a) { if (Ready) a(); else OnReady += a; }

        readonly List<KeyValuePair<string, Parameter[]>> queue = new List<KeyValuePair<string, Parameter[]>>();
        bool? consentAnalytics, consentAds;

        public void Init()
        {
            FirebaseApp.CheckAndFixDependenciesAsync().ContinueWithOnMainThread(t =>
            {
                if (t.IsFaulted || t.Result != DependencyStatus.Available) { Debug.LogWarning("Firebase не запустился: " + (t.IsFaulted ? "ошибка" : t.Result.ToString())); return; }
                // до ответа игрока в окне согласия всё запрещено; потом SetConsent откроет то, что он разрешил
                if (consentAnalytics == null) Apply(false, false);
                else Apply(consentAnalytics.Value, consentAds.Value);
#if FITIL_CRASHLYTICS
                global::Firebase.Crashlytics.Crashlytics.ReportUncaughtExceptionsAsFatal = true;
#endif
                Ready = true;
                foreach (var e in queue) FirebaseAnalytics.LogEvent(e.Key, e.Value);
                queue.Clear();
                OnReady?.Invoke();
                OnReady = null;
#if FITIL_FIREBASE_RC
                RemoteConfig.Fetch();
#endif
            });
        }

        public void SetConsent(bool analytics, bool ads)
        {
            consentAnalytics = analytics;
            consentAds = ads;
            if (Ready) Apply(analytics, ads);
        }

        static void Apply(bool analytics, bool ads)
        {
            FirebaseAnalytics.SetConsent(new Dictionary<ConsentType, ConsentStatus>
            {
                [ConsentType.AnalyticsStorage] = analytics ? ConsentStatus.Granted : ConsentStatus.Denied,
                [ConsentType.AdStorage] = ads ? ConsentStatus.Granted : ConsentStatus.Denied,
                [ConsentType.AdUserData] = ads ? ConsentStatus.Granted : ConsentStatus.Denied,
                [ConsentType.AdPersonalization] = ads ? ConsentStatus.Granted : ConsentStatus.Denied,
            });
        }

        public void Event(string name, Dictionary<string, object> p)
        {
            var ps = new List<Parameter>();
            if (p != null)
                foreach (var kv in p)
                {
                    var v = kv.Value;
                    if (v is int || v is long) ps.Add(new Parameter(kv.Key, Convert.ToInt64(v)));
                    else if (v is double || v is float) ps.Add(new Parameter(kv.Key, Convert.ToDouble(v)));
                    else if (v is bool b) ps.Add(new Parameter(kv.Key, b ? 1L : 0L));
                    else ps.Add(new Parameter(kv.Key, Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) ?? ""));
                }
            Log(name, ps.ToArray());
        }

        void Log(string name, Parameter[] ps)
        {
            if (Ready) FirebaseAnalytics.LogEvent(name, ps);
            else if (queue.Count < 100) queue.Add(new KeyValuePair<string, Parameter[]>(name, ps));
        }

        // покупки Firebase собирает сам (in_app_purchase): своё событие идёт без суммы, чтобы не задвоить доход
        public void Purchase(string productId, double price, string currency, string receipt) =>
            Log("iap_purchase", new[] { new Parameter("product_id", productId ?? ""), new Parameter("currency", currency ?? "") });

        // Доход с показов AdMob SDK Google пишет в Firebase сам (ad_impression), когда приложение AdMob связано
        // с проектом Firebase: своё событие задвоило бы доход.
        public void AdRevenue(AdImpression imp) { }
    }

#if FITIL_FIREBASE_RC
    /// <summary>Значения из Remote Config: пока не пришли, отдаётся значение по умолчанию.</summary>
    public static class RemoteConfig
    {
        static bool fetched;

        internal static void Fetch()
        {
            var rc = global::Firebase.RemoteConfig.FirebaseRemoteConfig.DefaultInstance;
            rc.FetchAndActivateAsync().ContinueWithOnMainThread(t => { fetched = !t.IsFaulted; });
        }

        public static double Number(string key, double def)
        {
            if (!fetched) return def;
            var v = global::Firebase.RemoteConfig.FirebaseRemoteConfig.DefaultInstance.GetValue(key);
            return v.Source == global::Firebase.RemoteConfig.ValueSource.StaticValue ? def : v.DoubleValue;
        }
    }
#endif
}
#endif
