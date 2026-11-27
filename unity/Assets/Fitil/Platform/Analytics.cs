// Аналитика и атрибуция: общий вход для Firebase и Tenjin. Сами SDK подключаются отдельными файлами
// (Platform/Firebase, Assets/FitilSdk) и добавляют себя в список, когда их пакет есть в проекте.
// Без SDK вызовы ничего не делают.
//
// Согласие: в Европе игрок отвечает в окне Google (его показывает AdMob). Ответ лежит в настройках устройства
// по стандарту IAB TCF; до ответа и без согласия рекламный идентификатор и хранилища аналитики не используются.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Fitil.Platform
{
    /// <summary>Показ рекламы с доходом (AdMob отдаёт сумму в микроединицах валюты аккаунта).</summary>
    public struct AdImpression
    {
        public string Network, AdUnit, Format, Placement, Currency, ResponseId, AdapterClass, Precision;
        public long ValueMicros;
        public double Value => ValueMicros / 1e6;
    }

    public interface IAnalyticsSink
    {
        void Init();
        void SetConsent(bool analytics, bool ads);
        void Event(string name, Dictionary<string, object> p);
        /// <summary>Покупка: receipt — чек площадки как его отдал Unity IAP (может быть пустым).</summary>
        void Purchase(string productId, double price, string currency, string receipt);
        void AdRevenue(AdImpression imp);
    }

    public static class Analytics
    {
        static readonly List<IAnalyticsSink> sinks = new List<IAnalyticsSink>();
        static bool started;

        /// <summary>За что игрок смотрит рекламу сейчас (ответ события, возвращение после поражения).</summary>
        public static string Placement = "";

        public static void Add(IAnalyticsSink sink)
        {
            if (sink == null || sinks.Contains(sink)) return;
            sinks.Add(sink);
            if (started) Safe(sink.Init);
        }

        public static bool Any => sinks.Count > 0;

        /// <summary>Запуск при старте игры. Там, где нет окна согласия (нет рекламного плагина), согласие читается сразу.</summary>
        public static void Start(bool consentComesFromAds)
        {
            if (started) return;
            started = true;
            foreach (var s in sinks.ToArray()) Safe(s.Init);
            if (!consentComesFromAds) ApplyConsent();
        }

        /// <summary>Игрок ответил в окне согласия или поменял ответ.</summary>
        public static void ApplyConsent()
        {
            var c = Consent.Read();
            foreach (var s in sinks.ToArray()) Safe(() => s.SetConsent(c.Analytics, c.Ads));
        }

        public static void Event(string name, params (string key, object value)[] p)
        {
            if (sinks.Count == 0) return;
            Dictionary<string, object> d = null;
            if (p != null && p.Length > 0)
            {
                d = new Dictionary<string, object>();
                foreach (var (k, v) in p) d[k] = v;
            }
            foreach (var s in sinks.ToArray()) Safe(() => s.Event(name, d));
        }

        public static void Purchase(string productId, double price, string currency, string receipt)
        {
            foreach (var s in sinks.ToArray()) Safe(() => s.Purchase(productId, price, currency, receipt));
        }

        public static void AdRevenue(AdImpression imp)
        {
            foreach (var s in sinks.ToArray()) Safe(() => s.AdRevenue(imp));
        }

        static void Safe(Action a)
        {
            try { a(); } catch (Exception e) { Debug.LogWarning("Аналитика: " + e.Message); }
        }
    }

    /// <summary>Согласие по стандарту IAB TCF v2: его пишет окно согласия Google (UMP).</summary>
    public struct Consent
    {
        public bool GdprApplies, Analytics, Ads;

        public static Consent Read()
        {
            var applies = ReadInt("IABTCF_gdprApplies", 0);
            var purposes = ReadString("IABTCF_PurposeConsents", "");
            if (applies != 1) return new Consent { GdprApplies = false, Analytics = true, Ads = true };
            bool P(int n) => purposes.Length >= n && purposes[n - 1] == '1';
            // 1 — хранение на устройстве, 7 — измерение рекламы, 8 и 9 — измерение содержимого и аудитории
            return new Consent { GdprApplies = true, Ads = P(1) && P(7), Analytics = P(1) && (P(8) || P(9)) };
        }

#if UNITY_ANDROID && !UNITY_EDITOR && !FITIL_REFCHECK
        static AndroidJavaObject Prefs()
        {
            using (var up = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
            using (var act = up.GetStatic<AndroidJavaObject>("currentActivity"))
            using (var pm = new AndroidJavaClass("android.preference.PreferenceManager"))
                return pm.CallStatic<AndroidJavaObject>("getDefaultSharedPreferences", act);
        }
        static int ReadInt(string k, int def) { try { using (var p = Prefs()) return p.Call<int>("getInt", k, def); } catch { return def; } }
        static string ReadString(string k, string def) { try { using (var p = Prefs()) return p.Call<string>("getString", k, def) ?? def; } catch { return def; } }
#else
        // на iOS окно согласия пишет в NSUserDefaults — это те же PlayerPrefs
        static int ReadInt(string k, int def) => PlayerPrefs.GetInt(k, def);
        static string ReadString(string k, string def) => PlayerPrefs.GetString(k, def);
#endif
    }
}
