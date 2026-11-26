// Tenjin: откуда пришли установки и сколько они принесли. Плагин Tenjin ставится файлом .unitypackage и лежит
// без своей сборки, поэтому этот файл тоже лежит вне сборок Fitil (папка Assets/FitilSdk). Включается условием
// FITIL_TENJIN: его ставит редактор, когда плагин есть в проекте (Fitil.EditorTools.SdkDefines).
// Ключ SDK берётся из секретов сборки (SdkIds.TenjinKey); без ключа Tenjin не запускается.
// Connect вызывается только после ответа в окне согласия: без согласия рекламный идентификатор не передаётся.
// Доход с показов AdMob уходит через AdMobImpressionFromJSON (нужен Tenjin 1.15.9 и новее и включённый
// «Impression-level ad revenue» в AdMob → Settings → Account).
#if FITIL_TENJIN
using System;
using System.Collections.Generic;
using Fitil.Core;
using Fitil.Platform;
using UnityEngine;

namespace Fitil.Sdk
{
    public sealed class TenjinSink : IAnalyticsSink
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Register()
        {
            if (Application.isEditor || SdkIds.TenjinKey == null) return;
            if (Application.platform != RuntimePlatform.Android && Application.platform != RuntimePlatform.IPhonePlayer) return;
            Analytics.Add(new TenjinSink());
        }

        BaseTenjin tj;
        bool connected;

        public void Init() { }

        public void SetConsent(bool analytics, bool ads)
        {
            tj = tj ?? Tenjin.getInstance(SdkIds.TenjinKey);
#if UNITY_ANDROID
            tj.SetAppStoreType(AppStoreType.googleplay);
#endif
            if (ads) tj.OptIn(); else tj.OptOut();
            if (connected) return;
            connected = true;
            tj.Connect();
            // Tenjin просит вызывать Connect при каждом возврате в игру
            Application.focusChanged += focused => { if (focused) try { tj.Connect(); } catch (Exception e) { Debug.LogWarning("Tenjin: " + e.Message); } };
        }

        // Tenjin хранит только ключевые события, по которым оценивают кампании
        static readonly HashSet<string> Key = new HashSet<string> { "first_fight_won", "first_boss_won", "run_won", "ad_reward" };

        public void Event(string name, Dictionary<string, object> p)
        {
            if (!connected) return;
            if (Key.Contains(name)) tj.SendEvent(name);
            else if (name == "level_reached" && p != null && p.TryGetValue("level", out var l) && l is IConvertible c)
            {
                var n = c.ToInt32(null);
                if (n == 5 || n == 10 || n == 25 || n == 50) tj.SendEvent("level_" + n);
            }
        }

        public void Purchase(string productId, double price, string currency, string receipt)
        {
            if (!connected) return;
            string tx = null, payload = null, signature = null;
            try
            {
                var r = Json.Obj(Json.Parse(string.IsNullOrEmpty(receipt) ? "{}" : receipt));
                tx = Json.Str(Json.Get(r, "TransactionID"));
                var pl = Json.Str(Json.Get(r, "Payload"));
#if UNITY_ANDROID
                var g = Json.Obj(Json.Parse(string.IsNullOrEmpty(pl) ? "{}" : pl));
                payload = Json.Str(Json.Get(g, "json"));
                signature = Json.Str(Json.Get(g, "signature"));
#else
                payload = pl;
#endif
            }
            catch (Exception e) { Debug.LogWarning("Tenjin, чек покупки: " + e.Message); }
#if UNITY_ANDROID
            tx = null; // для Google Play Tenjin проверяет покупку по чеку и подписи
#endif
            tj.Transaction(productId, currency, 1, price, tx, payload, signature);
        }

        [Serializable]
        sealed class AdMobImpression
        {
            public string ad_unit_id, currency_code, response_id;
            public double value_micros;
            public string mediation_adapter_class_name, precision_type;
        }

        public void AdRevenue(AdImpression imp)
        {
            if (!connected) return;
            double micros = imp.ValueMicros;
#if UNITY_IOS
            micros /= 1000000; // так в примере Tenjin: на iOS сумма передаётся в единицах валюты
#endif
            tj.AdMobImpressionFromJSON(JsonUtility.ToJson(new AdMobImpression
            {
                ad_unit_id = imp.AdUnit, currency_code = imp.Currency, response_id = imp.ResponseId ?? "", value_micros = micros,
                mediation_adapter_class_name = imp.AdapterClass ?? "", precision_type = imp.Precision ?? "",
            }));
        }
    }
}
#endif
