// Магазин и реклама за награду: перенос js/store.js.
// Остальная игра пользуется только Store и не знает, откуда пришла покупка или реклама.
// Сейчас покупки и реклама — заглушки, как в веб-версии: RealBuy и RealAd заменятся
// на Unity IAP 5 (Google Play Billing 7 и App Store; IAP 4 с Billing 7 не работает) и SDK рекламной сети на этапе «Платформа».
using System;
using System.Collections;
using System.Collections.Generic;
using Fitil.Core;
using UnityEngine;

namespace Fitil.Platform
{
    public sealed class Product
    {
        public string Id, Kind, HeroId;
        public List<string> Gives = new List<string>();
        /// <summary>Подпись цены до ответа магазина. Настоящую цену в валюте игрока даёт магазин.</summary>
        public string FallbackPrice;
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
                Products["hero_" + h.Id] = new Product { Id = "hero_" + h.Id, Kind = "hero", HeroId = h.Id, FallbackPrice = Price };
            }
            Products["heroes"] = new Product { Id = "heroes", Kind = "pack", Gives = paid, FallbackPrice = Price };
            Products["noads"] = new Product { Id = "noads", Kind = "noads", FallbackPrice = Price };
            Load();
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

        static void Grant(string id)
        {
            var ids = Products.TryGetValue(id, out var p) && p.Kind == "pack" ? p.Gives : new List<string> { id };
            foreach (var x in ids) if (!owned.Contains(x)) owned.Add(x);
            Persist();
        }

        public static bool Owns(string id) => owned.Contains(id);
        public static bool HeroOwned(GameData data, string cls) => !data.Classes.TryGetValue(cls, out var h) || !h.Paid || Owns("hero_" + cls);
        public static bool NoAds => Owns("noads");

        /// <summary>Купить. done(true) — покупка прошла.</summary>
        public static void Buy(string id, Action<bool> done)
        {
            RealBuy(id, ok =>
            {
                if (ok) Grant(id);
                done?.Invoke(ok);
            });
        }

        /// <summary>Показать рекламу за награду. done(true) — досмотрена, награду давать. С «Без рекламы» — сразу true.</summary>
        public static void Ad(MonoBehaviour host, Action<bool> done)
        {
            if (NoAds) { done?.Invoke(true); return; }
            RealAd(host, done);
        }

        // ---------- заглушки: заменятся SDK ----------

        static void RealBuy(string id, Action<bool> done) => done?.Invoke(true);

        static void RealAd(MonoBehaviour host, Action<bool> done) => host.StartCoroutine(FakeAd(done));

        static IEnumerator FakeAd(Action<bool> done)
        {
            yield return new WaitForSecondsRealtime(AdSeconds);
            done?.Invoke(true);
        }
    }
}
