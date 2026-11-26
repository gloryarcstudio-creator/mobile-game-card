// Магазин и реклама за награду: перенос js/store.js.
// Остальная игра пользуется только Store и не знает, откуда пришла покупка или реклама.
// Настоящие покупки и реклама подключаются сами, когда в проекте есть их пакеты:
//   Unity IAP 5 (Google Play Billing 7 и App Store) — Fitil.Platform.Iap, Shop;
//   Google Mobile Ads (AdMob) — Fitil.Platform.Ads, Ads.
// Без пакетов, как в веб-версии: тестовые окна покупки и ролика (их рисует игра через TestBuyWindow и TestAdWindow).
using System;
using System.Collections;
using System.Collections.Generic;
using Fitil.Core;
using UnityEngine;

namespace Fitil.Platform
{
    public sealed class Product
    {
        public string Id, Kind, HeroId, Name;
        public List<string> Gives = new List<string>();
        /// <summary>Подпись цены до ответа магазина. Настоящую цену в валюте игрока даёт магазин.</summary>
        public string FallbackPrice;
    }

    /// <summary>Магазин площадки (Unity IAP). Товары — по id в Google Play и App Store (com.protekgames.lastray.&lt;товар&gt;).</summary>
    public interface IShop
    {
        /// <summary>Подключиться к площадке, узнать цены и что уже куплено (купленное приходит в Store.Owned).</summary>
        void Start(IList<string> storeIds);
        /// <summary>Цена в валюте игрока, null — площадка ещё не ответила.</summary>
        string Price(string storeId);
        /// <summary>done(true, null) — куплено; done(false, null) — игрок передумал; done(false, текст) — почему не вышло.</summary>
        void Buy(string storeId, Action<bool, string> done);
        /// <summary>Спросить площадку о прошлых покупках; done — когда ответила (или не дождались).</summary>
        void Restore(Action done);
        /// <summary>Площадка ответила, и товары на ней есть.</summary>
        bool Ready { get; }
    }

    /// <summary>Реклама за награду (AdMob).</summary>
    public interface IAds
    {
        void Start();
        /// <summary>done(true, null) — досмотрена; done(false, null) — закрыта раньше; done(false, текст) — почему не показалась.</summary>
        void Show(Action<bool, string> done);
        /// <summary>Игроку положена кнопка «Согласие на рекламу» (Европа): показать её в настройках.</summary>
        bool PrivacyOptions { get; }
        void ShowPrivacyOptions(Action done);
    }

    public static class Store
    {
        const string Key = "lastray.store";
        public const float AdSeconds = 5f;

        // v177: все покупки по $5 (просьба Glory 2026-11-23). Цена в магазине задаётся в Play Console и App Store Connect.
        public const string Price = "$5";

        /// <summary>Id товара в Google Play и App Store: com.protekgames.lastray.&lt;товар&gt; (схема студии).
        /// Внутри игры и в сохранении товары зовутся как в веб-версии: hero_shepherd, heroes, noads.</summary>
        public const string StoreIdPrefix = "com.protekgames.lastray.";
        public static string StoreId(string id) => StoreIdPrefix + id;

        public static readonly Dictionary<string, Product> Products = new Dictionary<string, Product>();
        static readonly List<string> owned = new List<string>();

        public static void Init(GameData data)
        {
            Products.Clear();
            var paid = new List<string>();
            foreach (var h in data.Classes.Values)
            {
                if (!h.Paid) continue;
                paid.Add("hero_" + h.Id);
                Products["hero_" + h.Id] = new Product { Id = "hero_" + h.Id, Kind = "hero", HeroId = h.Id, FallbackPrice = Price, Name = h.Name + ", " + (h.Role ?? "").ToLowerInvariant() };
            }
            Products["heroes"] = new Product { Id = "heroes", Kind = "pack", Gives = paid, FallbackPrice = Price, Name = Loc.Tr("Все платные герои") };
            Products["noads"] = new Product { Id = "noads", Kind = "noads", FallbackPrice = Price, Name = Loc.Tr("Без рекламы") };
            Load();
            var ids = new List<string>();
            foreach (var id in Products.Keys) ids.Add(StoreId(id));
            try { Shop?.Start(ids); } catch (Exception e) { Debug.LogWarning("Магазин площадки не запустился: " + e.Message); }
            try { Ads?.Start(); } catch (Exception e) { Debug.LogWarning("Реклама не запустилась: " + e.Message); }
            // согласие для аналитики приходит из окна рекламного плагина; где его нет, читается сразу
            Analytics.Start(Ads != null);
        }

        static void Load()
        {
            owned.Clear();
            var json = SaveStore.Read(Key);
            if (json == null) return;
            try
            {
                var list = Json.Arr(Json.Get(Json.Obj(Json.Parse(json)), "owned"));
                if (list != null) foreach (var x in list) if (x is string s) owned.Add(s);
            }
            catch (Exception e) { Debug.LogWarning("Покупки не прочитались: " + e.Message); }
        }

        static void Persist() => SaveStore.Write(Key, Json.Write(new Dictionary<string, object> { ["owned"] = owned }));

        /// <summary>Открыть товар (набор открывает своих героев). true — что-то открылось впервые.</summary>
        static bool Grant(string id)
        {
            var ids = Products.TryGetValue(id, out var p) && p.Kind == "pack" ? p.Gives : new List<string> { id };
            var added = false;
            foreach (var x in ids) if (!owned.Contains(x)) { owned.Add(x); added = true; }
            if (added) Persist();
            return added;
        }

        /// <summary>Площадка сообщила, что товар куплен: новая покупка, отложенная («спросить родителей»,
        /// оплата наличными) или прошлая на этом аккаунте. Покупку не из окна магазина игра показывает сообщением.</summary>
        public static void Owned(string storeId)
        {
            if (storeId == null || !storeId.StartsWith(StoreIdPrefix)) return;
            var id = storeId.Substring(StoreIdPrefix.Length);
            if (!Products.TryGetValue(id, out var p)) return;
            if (!Grant(id)) return;
            if (id != buying) Say?.Invoke(Loc.Tr("Покупка открыта: {name}", ("name", p.Name)));
            Changed?.Invoke();
        }

        /// <summary>Купленное изменилось (магазин и выбор героя перерисовываются).</summary>
        public static event Action Changed;
        /// <summary>Короткое сообщение игроку (игра показывает его плашкой).</summary>
        public static Action<string> Say;

        /// <summary>Цена товара: от площадки, пока её нет — «$5».</summary>
        public static string PriceOf(string id) =>
            Shop?.Price(StoreId(id)) ?? (Products.TryGetValue(id, out var p) ? p.FallbackPrice : Price);

        public static bool Owns(string id) => owned.Contains(id);
        public static bool HeroOwned(GameData data, string cls) => !data.Classes.TryGetValue(cls, out var h) || !h.Paid || Owns("hero_" + cls);
        public static bool NoAds => Owns("noads");

        /// <summary>Платные герои по порядку (магазин, набор «Все три героя»).</summary>
        public static List<string> PaidHeroes
        {
            get
            {
                var l = new List<string>();
                foreach (var p in Products.Values) if (p.Kind == "hero") l.Add(p.HeroId);
                return l;
            }
        }

        static string buying;

        /// <summary>Почему последняя покупка не прошла (null — игрок сам отменил).</summary>
        public static string BuyNote { get; private set; }
        /// <summary>Почему последний ролик не дал награды (null — закрыт раньше времени).</summary>
        public static string AdNote { get; private set; }

        /// <summary>Купить. done(true) — покупка прошла; нет — причина в BuyNote.</summary>
        public static void Buy(string id, Action<bool> done)
        {
            BuyNote = null;
            if (Owns(id)) { done?.Invoke(true); return; }
            if (Test)
            {
                RealBuy(id, ok =>
                {
                    if (ok && Grant(id)) Changed?.Invoke();
                    done?.Invoke(ok);
                });
                return;
            }
            buying = id;
            Shop.Buy(StoreId(id), (ok, note) =>
            {
                buying = null;
                BuyNote = ok ? null : note;
                if (ok && Grant(id)) Changed?.Invoke();
                done?.Invoke(ok);
            });
        }

        /// <summary>Показать рекламу за награду. done(true) — досмотрена, награду давать; нет — причина в AdNote.
        /// С «Без рекламы» — сразу true. reason — за что награда (строка в окне тестовой рекламы).</summary>
        public static void Ad(MonoBehaviour host, Action<bool> done, string reason = null)
        {
            AdNote = null;
            if (NoAds) { done?.Invoke(true); return; }
            if (Ads == null) { RealAd(host, reason, done); return; }
            Analytics.Placement = reason ?? "";
            Ads.Show((ok, note) =>
            {
                AdNote = ok ? null : note;
                if (ok) Analytics.Event("ad_reward", ("placement", Analytics.Placement));
                done?.Invoke(ok);
            });
        }

        /// <summary>Восстановить покупки: спросить у площадки, что куплено. done(n) — сколько товаров открыто.</summary>
        public static void Restore(Action<int> done)
        {
            if (Test) { done?.Invoke(owned.Count); return; }
            Shop.Restore(() => done?.Invoke(owned.Count));
        }

        /// <summary>Только для тестовой версии: снова закрыть всё купленное.</summary>
        public static void ResetTest()
        {
            owned.Clear();
            Persist();
        }

        /// <summary>Настоящий магазин площадки и реклама. null — тестовые окна, как в веб-версии.
        /// Ставятся сами при запуске (RuntimeInitializeOnLoadMethod в Fitil.Platform.Iap и Fitil.Platform.Ads), до Init.</summary>
        public static IShop Shop;
        public static IAds Ads;

        /// <summary>Тестовые покупки: деньги не списываются (как в веб-версии). Так, когда магазина площадки нет,
        /// и в сборке для разработки (Development Build), пока товары не заведены на площадке: игру можно проверять на телефоне.</summary>
        public static bool Test => Shop == null || (Debug.isDebugBuild && !Shop.Ready);

        // ---------- тестовые окна, пока нет пакетов площадки ----------
        // Окна тестовой покупки и тестового ролика рисует игра (Fitil.Game.StoreScreen): платформе интерфейс не виден.
        public static Action<Product, Action<bool>> TestBuyWindow;
        public static Action<string, float, Action<bool>> TestAdWindow;

        static void RealBuy(string id, Action<bool> done)
        {
            if (TestBuyWindow != null && Products.TryGetValue(id, out var p)) TestBuyWindow(p, done);
            else done?.Invoke(true);
        }

        static void RealAd(MonoBehaviour host, string reason, Action<bool> done)
        {
            if (TestAdWindow != null) TestAdWindow(reason, AdSeconds, done);
            else host.StartCoroutine(FakeAd(done));
        }

        static IEnumerator FakeAd(Action<bool> done)
        {
            yield return new WaitForSecondsRealtime(AdSeconds);
            done?.Invoke(true);
        }
    }
}
