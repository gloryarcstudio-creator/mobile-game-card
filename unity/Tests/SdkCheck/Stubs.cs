// Заглушки вызовов Unity IAP 5 и Google Mobile Ads, которыми пользуется игра. Только подписи, без работы:
// сверены с com.unity.purchasing 5.0.4 и 5.5.1 и с googleads-mobile-unity. Нужны одной проверке сборки (SdkCheck.csproj).
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace UnityEngine.Purchasing
{
    public enum ProductType { Consumable, NonConsumable, Subscription, Unknown }
    public enum PurchaseFailureReason { PurchasingUnavailable, ExistingPurchasePending, ProductUnavailable, SignatureInvalid, UserCancelled, PaymentDeclined, DuplicateTransaction, Unknown }

    public class ProductDefinition
    {
        public ProductDefinition(string id, ProductType type) { this.id = id; this.type = type; }
        public string id { get; private set; }
        public ProductType type { get; private set; }
    }

    public class ProductMetadata { public string localizedPriceString { get; internal set; } }

    public class Product
    {
        public ProductDefinition definition { get; private set; }
        public ProductMetadata metadata { get; internal set; }
        public bool availableToPurchase { get; internal set; }
    }

    public class CartItem { public Product Product { get; } }
    public interface ICart { IReadOnlyList<CartItem> Items(); }
    public interface IOrderInfo { }

    public abstract class Order
    {
        public ICart CartOrdered { get; internal set; }
        public IOrderInfo Info { get; }
    }

    public class ConfirmedOrder : Order { }
    public class PendingOrder : Order { }
    public class DeferredOrder : Order { }

    public class FailedOrder : Order
    {
        public PurchaseFailureReason FailureReason => default;
        public string Details => "";
    }

    public class Orders
    {
        public IReadOnlyList<ConfirmedOrder> ConfirmedOrders { get; }
        public IReadOnlyList<PendingOrder> PendingOrders { get; }
        public IReadOnlyList<DeferredOrder> DeferredOrders { get; }
    }

    public class ProductFetchFailed
    {
        public List<ProductDefinition> FailedFetchProducts { get; }
        public string FailureReason { get; }
    }

    public class PurchasesFetchFailureDescription { public string Message => ""; }
    public class StoreConnectionFailureDescription { public string Message => ""; public bool IsRetryable => false; }
    public interface IRetryPolicy { }

    public class StoreController
    {
        public event Action<StoreConnectionFailureDescription> OnStoreDisconnected;
        public event Action<PendingOrder> OnPurchasePending;
        public event Action<Order> OnPurchaseConfirmed;
        public event Action<FailedOrder> OnPurchaseFailed;
        public event Action<DeferredOrder> OnPurchaseDeferred;
        public event Action<Orders> OnPurchasesFetched;
        public event Action<PurchasesFetchFailureDescription> OnPurchasesFetchFailed;
        public event Action<List<Product>> OnProductsFetched;
        public event Action<ProductFetchFailed> OnProductsFetchFailed;
        public Task Connect() => Task.CompletedTask;
        public void FetchProducts(List<ProductDefinition> productDefinitions, IRetryPolicy retryPolicy = null) { }
        public Product GetProductById(string productId) => null;
        public void PurchaseProduct(Product product) { }
        public void ConfirmPurchase(PendingOrder order) { }
        public void FetchPurchases() { }
        public void RestoreTransactions(Action<bool, string> callback) { }
    }

    public static class UnityIAPServices
    {
        public static StoreController StoreController(string storeName = null) => new StoreController();
    }
}

namespace GoogleMobileAds.Api
{
    public class InitializationStatus { }
    public class AdRequest { }
    public class AdError { public string GetMessage() => ""; }
    public class LoadAdError : AdError { }
    public class Reward : EventArgs { public string Type; public double Amount; }

    public class RewardedAd
    {
        public event Action OnAdFullScreenContentClosed;
        public event Action<AdError> OnAdFullScreenContentFailed;
        public static void Load(string adUnitId, AdRequest request, Action<RewardedAd, LoadAdError> adLoadCallback) { }
        public bool CanShowAd() => false;
        public void Show(Action<Reward> userRewardEarnedCallback) { }
        public void Destroy() { }
    }

    public class MobileAds
    {
        public static bool RaiseAdEventsOnUnityMainThread { get; set; }
        public static void Initialize(Action<InitializationStatus> initCompleteAction) { }
        public static void SetiOSAppPauseOnBackground(bool pause) { }
    }
}

namespace GoogleMobileAds.Ump.Api
{
    public enum PrivacyOptionsRequirementStatus { Unknown = 0, NotRequired = 1, Required = 2 }
    public class FormError { public int ErrorCode { get; private set; } public string Message { get; private set; } }
    public class ConsentRequestParameters { public bool TagForUnderAgeOfConsent; }

    public class ConsentInformation
    {
        public static PrivacyOptionsRequirementStatus PrivacyOptionsRequirementStatus => default;
        public static void Update(ConsentRequestParameters request, Action<FormError> consentInfoUpdateCallback) { }
        public static bool CanRequestAds() => false;
    }

    public class ConsentForm
    {
        public static void LoadAndShowConsentFormIfRequired(Action<FormError> onDismissed) { }
        public static void ShowPrivacyOptionsForm(Action<FormError> onDismissed) { }
    }
}
