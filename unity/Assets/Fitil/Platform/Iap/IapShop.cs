// Настоящие покупки: Unity IAP 5 (Google Play Billing и App Store). Подключается сам, когда в проекте
// есть пакет com.unity.purchasing версии 5 и выше: тогда Unity ставит условие FITIL_IAP (см. asmdef рядом).
// Без пакета этот файл не собирается, и магазин остаётся тестовым.
//
// Все товары — «навсегда» (non-consumable): герой, набор героев, «Без рекламы». Id на площадках:
// com.protekgames.lastray.hero_<герой>, .heroes, .noads — их надо завести в Play Console и App Store Connect.
// Ключей и паролей здесь нет: площадка узнаёт приложение по подписи сборки.
//
// В редакторе Unity магазин остаётся тестовым (окно «Тестовая покупка»): так игру можно проверять без площадки.
#if FITIL_IAP
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Fitil.Core;
using UnityEngine;
using UnityEngine.Purchasing;
// у игры свой Product (товар в Fitil.Platform): товар площадки зовём иначе, чтобы их не путать
using StoreProduct = UnityEngine.Purchasing.Product;

namespace Fitil.Platform.Iap
{
    public sealed class IapShop : IShop
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Register()
        {
            if (Application.isEditor || Store.Shop != null) return;
            Store.Shop = new IapShop();
        }

        StoreController store;
        List<ProductDefinition> defs;
        bool connected, connecting;
        readonly Dictionary<string, string> prices = new Dictionary<string, string>();
        // кто ждёт ответа площадки: покупка по id товара и «Восстановить покупки»
        readonly Dictionary<string, Action<bool, string>> waiting = new Dictionary<string, Action<bool, string>>();
        Action restoring;

        public bool Ready => prices.Count > 0;

        public void Start(IList<string> storeIds)
        {
            defs = new List<ProductDefinition>();
            foreach (var id in storeIds) defs.Add(new ProductDefinition(id, ProductType.NonConsumable));
            if (store == null)
            {
                store = UnityIAPServices.StoreController();
                store.OnPurchasePending += Pending;
                store.OnPurchaseConfirmed += Confirmed;
                store.OnPurchaseFailed += Failed;
                store.OnPurchaseDeferred += Deferred;
                store.OnPurchasesFetched += Fetched;
                store.OnPurchasesFetchFailed += f => { Debug.LogWarning("Покупки не прочитались: " + f.Message); RestoreDone(); };
                store.OnProductsFetched += Fetched;
                store.OnProductsFetchFailed += f => Debug.LogWarning("Товары не найдены на площадке: " + f.FailureReason);
                store.OnStoreDisconnected += d => { connected = false; Debug.LogWarning("Магазин площадки отключился: " + d.Message); };
            }
            Connect();
        }

        async void Connect()
        {
            if (connected || connecting || store == null) return;
            connecting = true;
            try
            {
                await store.Connect();
                connected = true;
                store.FetchProducts(defs);
            }
            catch (Exception e) { Debug.LogWarning("Магазин площадки недоступен: " + e.Message); }
            finally { connecting = false; }
        }

        // площадка прислала товары с ценами: теперь можно спросить, что уже куплено
        void Fetched(List<StoreProduct> products)
        {
            foreach (var p in products)
            {
                var price = p.metadata != null ? p.metadata.localizedPriceString : null;
                if (p.availableToPurchase && !string.IsNullOrEmpty(price)) prices[p.definition.id] = price;
            }
            store.FetchPurchases();
        }

        public string Price(string storeId) => prices.TryGetValue(storeId, out var p) ? p : null;

        public void Buy(string storeId, Action<bool, string> done)
        {
            if (!connected)
            {
                Connect();
                done?.Invoke(false, Loc.Tr("Магазин сейчас недоступен. Проверьте интернет и попробуйте ещё раз."));
                return;
            }
            var product = store.GetProductById(storeId);
            if (product == null || !product.availableToPurchase)
            {
                store.FetchProducts(defs);
                done?.Invoke(false, Loc.Tr("Этот товар пока недоступен в магазине."));
                return;
            }
            waiting[storeId] = done;
            try { store.PurchaseProduct(product); }
            catch (Exception e)
            {
                Debug.LogWarning("Покупка не началась: " + e.Message);
                Answer(storeId, false, Loc.Tr("Покупка не прошла. Деньги не списаны."));
            }
        }

        void Answer(string storeId, bool ok, string note)
        {
            if (!waiting.TryGetValue(storeId, out var done)) return;
            waiting.Remove(storeId);
            done?.Invoke(ok, note);
        }

        static IEnumerable<string> Ids(Order order)
        {
            var items = order != null && order.CartOrdered != null ? order.CartOrdered.Items() : null;
            if (items == null) yield break;
            foreach (var it in items)
                if (it != null && it.Product != null) yield return it.Product.definition.id;
        }

        // оплата прошла: открыть товар и подтвердить площадке (без подтверждения Google через три дня вернёт деньги)
        void Pending(PendingOrder order)
        {
            foreach (var id in Ids(order)) { Answer(id, true, null); Store.Owned(id); }
            Report(order);
            store.ConfirmPurchase(order);
        }

        // покупка в аналитику и Tenjin: цена и валюта площадки, чек для проверки
        static void Report(Order order)
        {
            try
            {
                var receipt = order.Info != null ? order.Info.Receipt : null;
                foreach (var it in order.CartOrdered.Items())
                {
                    if (it == null || it.Product == null) continue;
                    var m = it.Product.metadata;
                    Analytics.Purchase(it.Product.definition.id, m != null ? (double)m.localizedPrice : 0, m != null ? m.isoCurrencyCode : null, receipt);
                }
            }
            catch (Exception e) { Debug.LogWarning("Покупка не попала в аналитику: " + e.Message); }
        }

        void Confirmed(Order order)
        {
            if (order is ConfirmedOrder) { foreach (var id in Ids(order)) Store.Owned(id); }
            else if (order is FailedOrder f) Debug.LogWarning("Площадка не подтвердила покупку: " + f.FailureReason + " " + f.Details);
        }

        // «спросить родителей» и оплата, которая ещё идёт: товар откроется сам, когда площадка пришлёт оплату
        void Deferred(DeferredOrder order)
        {
            foreach (var id in Ids(order)) Answer(id, false, Loc.Tr("Покупка ждёт подтверждения. Товар откроется, как только оплата пройдёт."));
        }

        void Failed(FailedOrder order)
        {
            var cancelled = order.FailureReason == PurchaseFailureReason.UserCancelled;
            if (!cancelled) Debug.LogWarning("Покупка не прошла: " + order.FailureReason + " " + order.Details);
            foreach (var id in Ids(order)) Answer(id, false, cancelled ? null : Loc.Tr("Покупка не прошла. Деньги не списаны."));
            // «уже куплено» тоже приходит отказом: спросить площадку, и товар откроется
            if (!cancelled && connected) store.FetchPurchases();
        }

        // что куплено на этом аккаунте: при запуске, после «Восстановить покупки» и после отказа
        void Fetched(Orders orders)
        {
            foreach (var o in orders.ConfirmedOrders)
                foreach (var id in Ids(o)) Store.Owned(id);
            foreach (var o in orders.PendingOrders)
            {
                foreach (var id in Ids(o)) { Answer(id, true, null); Store.Owned(id); }
                store.ConfirmPurchase(o);
            }
            RestoreDone();
        }

        public void Restore(Action done)
        {
            if (!connected) { Connect(); done?.Invoke(); return; }
            restoring = done;
            // App Store просит войти в аккаунт и присылает прошлые покупки; Google Play отдаёт их без вопросов
            if (Application.platform == RuntimePlatform.IPhonePlayer)
                store.RestoreTransactions((ok, error) =>
                {
                    if (!ok) Debug.LogWarning("Покупки не восстановились: " + error);
                    if (connected) store.FetchPurchases(); else RestoreDone();
                });
            else store.FetchPurchases();
            GiveUp(done);
        }

        // площадка молчит: не держать игрока на кнопке
        async void GiveUp(Action done)
        {
            await Task.Delay(12000);
            if (restoring == done) RestoreDone();
        }

        void RestoreDone()
        {
            var done = restoring;
            restoring = null;
            done?.Invoke();
        }
    }
}
#endif
