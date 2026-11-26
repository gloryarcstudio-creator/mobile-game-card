// Настоящая реклама за награду: Google Mobile Ads (AdMob). Подключается сама, когда в проекте есть плагин
// Google Mobile Ads версии 9 и выше: условие FITIL_ADMOB ставит Unity (пакет com.google.ads.mobile, см. asmdef рядом)
// или редактор (Fitil.EditorTools.AdsDefine, если плагин поставлен файлом .unitypackage).
// Без плагина этот файл не собирается, и вместо роликов идёт тестовый отсчёт.
//
// Рекламный блок берётся из SdkIds: свой (секреты сборки в GitHub) или пробный блок Google, который показывает
// пробные ролики и денег не приносит. Id приложения (с «~») ставит Fitil.EditorTools.SdkSetup перед сборкой.
// Unity Ads подключён как сеть медиации AdMob (пакет com.google.ads.mobile.mediation.unity): кода для него нет,
// согласие он берёт из того же окна Google.
//
// В Европе перед рекламой игрока спрашивают о согласии (окно Google, настраивается в AdMob →
// Конфиденциальность и сообщения). Изменить ответ можно в настройках игры: «Согласие на рекламу».
// В редакторе Unity реклама остаётся тестовой.
#if FITIL_ADMOB
using System;
using System.Threading.Tasks;
using Fitil.Core;
using GoogleMobileAds.Api;
using GoogleMobileAds.Ump.Api;
using UnityEngine;

namespace Fitil.Platform.Ads
{
    public sealed class AdMobAds : IAds
    {
        // рекламный блок: свой из секретов сборки или пробный блок Google (SdkIds)
        static string Unit => SdkIds.AdMobRewarded;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Register()
        {
            if (Application.isEditor || Store.Ads != null) return;
            if (Application.platform != RuntimePlatform.Android && Application.platform != RuntimePlatform.IPhonePlayer) return;
            Store.Ads = new AdMobAds();
        }

        RewardedAd ad;
        bool started, ready, loading, busy;
        int fails;

        public void Start()
        {
            if (started) return;
            started = true;
            // Ответы плагина приходят не в главном потоке и ждут в очереди его объекта-исполнителя. Сам он создаётся только
            // при MobileAds.Initialize, а она вызывается после согласия: без этой строки ответ о согласии при первом
            // запуске оставался в очереди, и окно согласия не открывалось.
            GoogleMobileAds.Common.MobileAdsEventExecutor.Initialize();
            MobileAds.RaiseAdEventsOnUnityMainThread = true;
            MobileAds.SetiOSAppPauseOnBackground(true);
            // сначала согласие (нужно только там, где его требует закон), потом сама реклама
            ConsentInformation.Update(new ConsentRequestParameters(), error =>
            {
                if (error != null) Debug.LogWarning("Согласие на рекламу не узналось: " + error.Message);
                ConsentForm.LoadAndShowConsentFormIfRequired(formError =>
                {
                    if (formError != null) Debug.LogWarning("Окно согласия не показалось: " + formError.Message);
                    Init();
                    Analytics.ApplyConsent();   // аналитика и Tenjin узнают ответ игрока
                });
            });
            // согласие с прошлого запуска уже есть: не ждать ответа сети
            Init();
        }

        void Init()
        {
            if (ready || !ConsentInformation.CanRequestAds()) return;
            ready = true;
            MobileAds.Initialize(status => Load());
        }

        void Load()
        {
            if (!ready || loading || (ad != null && ad.CanShowAd())) return;
            loading = true;
            if (ad != null) { ad.Destroy(); ad = null; }
            RewardedAd.Load(Unit, new AdRequest(), (loaded, error) =>
            {
                loading = false;
                if (error != null || loaded == null)
                {
                    Debug.LogWarning("Реклама не загрузилась: " + (error != null ? error.GetMessage() : "пусто"));
                    fails++;
                    Retry();
                    return;
                }
                fails = 0;
                ad = loaded;
                loaded.OnAdPaid += value => Paid(loaded, value);
            });
        }

        // нет сети или роликов: пробовать реже и реже, после шести неудач — только когда игрок сам попросит ролик
        async void Retry()
        {
            if (fails > 6) return;
            await Task.Delay(Math.Min(60, 5 << Math.Min(fails, 4)) * 1000);
            Load();
        }

        public async void Show(Action<bool, string> done)
        {
            if (busy) { done?.Invoke(false, null); return; }
            busy = true;
            try
            {
                if (ad == null || !ad.CanShowAd())
                {
                    // ролик ещё не готов: подождать его немного, а не отказывать сразу
                    Init();
                    fails = 0;
                    Load();
                    for (var i = 0; i < 32 && (ad == null || !ad.CanShowAd()) && (loading || !ready); i++) await Task.Delay(250);
                }
                if (ad == null || !ad.CanShowAd())
                {
                    busy = false;
                    done?.Invoke(false, Loc.Tr("Реклама сейчас недоступна. Проверьте интернет и попробуйте чуть позже."));
                    return;
                }
                var shown = ad;
                ad = null;
                var earned = false;
                var closed = false;
                string note = null;
                shown.OnAdFullScreenContentClosed += () => closed = true;
                shown.OnAdFullScreenContentFailed += e =>
                {
                    Debug.LogWarning("Реклама не показалась: " + (e != null ? e.GetMessage() : ""));
                    note = Loc.Tr("Реклама сейчас недоступна. Проверьте интернет и попробуйте чуть позже.");
                    closed = true;
                };
                shown.Show(reward => earned = true);
                // пока ролик на экране, игра стоит на паузе и сюда не заходит. Если игра уже пять секунд
                // снова на экране, а плагин так и не сказал, что ролик закрыт, — не держать игрока
                for (var awake = 0; !closed && awake < 50; awake = Application.isFocused ? awake + 1 : 0) await Task.Delay(100);
                // на iOS награда иногда приходит чуть позже закрытия ролика
                for (var i = 0; i < 6 && !earned && note == null; i++) await Task.Delay(100);
                shown.Destroy();
                busy = false;
                Load();
                done?.Invoke(earned, earned ? null : note);
            }
            catch (Exception e)
            {
                Debug.LogWarning("Реклама не показалась: " + e.Message);
                busy = false;
                done?.Invoke(false, Loc.Tr("Реклама сейчас недоступна. Проверьте интернет и попробуйте чуть позже."));
            }
        }

        // доход с показа: сумма в микроединицах валюты аккаунта AdMob, уходит в аналитику и Tenjin
        static void Paid(RewardedAd shown, AdValue value)
        {
            if (value == null) return;
            var imp = new AdImpression { AdUnit = Unit, Format = "rewarded", Placement = Analytics.Placement, Currency = value.CurrencyCode, ValueMicros = value.Value, Precision = value.Precision.ToString(), Network = "AdMob" };
            try
            {
                var info = shown.GetResponseInfo();
                var adapter = info != null ? info.GetLoadedAdapterResponseInfo() : null;
                imp.ResponseId = info != null ? info.GetResponseId() : "";
                if (adapter != null) { imp.AdapterClass = adapter.AdapterClassName; if (!string.IsNullOrEmpty(adapter.AdSourceName)) imp.Network = adapter.AdSourceName; }
            }
            catch (Exception e) { Debug.LogWarning("Доход с рекламы: " + e.Message); }
            Analytics.AdRevenue(imp);
        }

        public bool PrivacyOptions =>
            started && ConsentInformation.PrivacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.Required;

        public void ShowPrivacyOptions(Action done)
        {
            ConsentForm.ShowPrivacyOptionsForm(error =>
            {
                if (error != null) Debug.LogWarning("Окно согласия не показалось: " + error.Message);
                Init();
                Analytics.ApplyConsent();
                done?.Invoke();
            });
        }
    }
}
#endif
