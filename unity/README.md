# Последний луч — Unity

Перенос веб-версии на Unity для Android и iOS. План: документ «Последний луч: план переноса на Unity».
Веб-версия в корне репозитория остаётся эталоном: данные, тексты и числа берутся из неё скриптами.

## Версия Unity

Только **6000.0 LTS не ниже 6000.0.58f2** с модулями Android Build Support и iOS Build Support.
Более старые версии (например, 6000.0.47f1) уязвимы к CVE-2025-59489, и Google Play блокирует собранные на них приложения.
Проект сам напишет ошибку в консоли, если открыт в старой версии.

## Как открыть

Из архивов (без репозитория): распаковать `lastray-unity-project.zip` в пустую папку, а `lastray-unity-enemies.zip`
(раскадровки живых врагов, около 480 МБ) — в ту же папку поверх: он кладёт файлы в `Assets/Fitil/Resources/Art/ea`.
Без него враги стоят неподвижными картинками. Дальше — с шага 2.

Из репозитория:

1. Один раз сделать картинки для Unity (Unity не читает WebP):
   ```sh
   pip install pillow
   python3 -I tools/unity/export_assets.py
   ```
2. Unity Hub → Add → Add project from disk → папка `unity`.
3. Нажать Play в любой сцене: игра запускается кодом (`Fitil.Game.Boot`), сцены не нужны.
   Для проверки высоких экранов и выреза камеры: Window → General → Device Simulator.

## Что где

| Папка | Что |
| --- | --- |
| `Assets/Fitil/Core` | Логика без UnityEngine: языки (`Loc`), случайность (`Rng`), данные (`GameData`), JSON. Дальше сюда переезжают бой и забег. |
| `Assets/Fitil/Game` | Экраны на uGUI, собираются кодом. `Boot` — запуск и титул, `RunFlow*` — забег, `CombatScreen` — бой, `Menus` — настройки и пауза, `Progress*` — достижения, статистика и база знаний, `StoreScreen` — магазин, `Cinema` — заставка, `Snow` — снегопад, `Tip` — подсказки к значкам, `TapGuard` — защита от двойного касания, `Ui` — помощники вёрстки. |
| `Assets/Fitil/Platform` | Сохранения (`SaveStore`), покупки и реклама (`Store`; все покупки по $5). `Iap` — настоящие покупки через Unity IAP 5, `Ads` — реклама за награду через Google Mobile Ads. Без их пакетов — тестовые окна, как в веб-версии. |
| `Assets/Fitil/Editor` | Настройки проекта кодом: портрет, отрисовка вокруг выреза камеры, идентификатор `com.protekgames.lastray`, IL2CPP, ARM64. Меню Fitil → Применить настройки. |
| `Assets/Fitil/Resources/Data` | JSON из веб-версии: `node tools/unity/export_data.js` (данные и строки) и `node tools/unity/export_card_text.js` (шаблоны описаний карт). Не править руками. |
| `Assets/Fitil/Resources/Art` | PNG из `assets/`: `tools/unity/export_assets.py`. В git не кладётся. |
| `Tests/Core.Tests` | Тесты Core без Unity: `dotnet run --project unity/Tests/Core.Tests`. Эталоны в `Tests/Fixtures` делает `node tools/unity/parity_fixtures.js`. | Бои: `node tools/unity/combat_fixtures.js` (128 настоящих боёв из браузера через Playwright, после любого изменения боя в веб-версии).

## Покупки и реклама

Ключей и паролей для этого в проекте нет и быть не должно: площадки узнают игру по подписи сборки и идентификатору.

**Покупки.** Пакет Unity IAP 5.5.1 уже в `Packages/manifest.json` (Google Play Billing 9 и App Store).

| Где запущена игра | Покупки |
| --- | --- |
| Редактор Unity | Тестовое окно, деньги не списываются. |
| Сборка Development Build | Тестовое окно, пока товары не заведены на площадке; потом настоящие. |
| Обычная сборка | Только настоящие. |

Товары заводятся в Play Console (Монетизация → Товары → Разовые товары) и App Store Connect (In-App Purchases → Non-Consumable),
все по $5:

| Id товара | Что открывает |
| --- | --- |
| `com.protekgames.lastray.hero_grinder` | Савва |
| `com.protekgames.lastray.hero_shepherd` | Луша |
| `com.protekgames.lastray.hero_herbalist` | Ульяна |
| `com.protekgames.lastray.heroes` | все три героя |
| `com.protekgames.lastray.noads` | «Без рекламы» |

Проверять настоящие покупки можно только сборкой, установленной из Google Play (внутреннее тестирование) или TestFlight.
Если пакет мешает, строку `com.unity.purchasing` можно убрать из манифеста: покупки снова станут тестовыми.

**Реклама.** Пока плагина нет, вместо ролика идёт тестовый отсчёт. Чтобы включить настоящую:

1. Поставить Google Mobile Ads for Unity версии 9 или новее: файл `.unitypackage` со страницы выпусков
   https://github.com/googleads/googleads-mobile-unity/releases (Assets → Import Package → Custom Package).
2. Assets → Google Mobile Ads → Settings: вписать id приложения из AdMob для Android и iOS (вида `ca-app-pub-…~…`).
   Без него сборка для Android не запускается. Для пробы годятся общие id Google:
   Android `ca-app-pub-3940256099942544~3347511713`, iOS `ca-app-pub-3940256099942544~1458002511`.
3. Рекламные блоки вписать в `Assets/Fitil/Platform/Ads/AdMobAds.cs` (`AndroidUnit`, `IosUnit`). Сейчас там пробные блоки
   Google: ролики показываются, денег не приносят.
4. Для Европы в AdMob (Конфиденциальность и сообщения) создать сообщение о согласии GDPR: игра сама покажет его перед
   рекламой, а в настройках игры появится «Согласие на рекламу».

Перед сборкой для магазина редактор пишет предупреждение в консоль, если покупки или реклама в ней ещё тестовые.

## Сборка

GitHub Actions (`.github/workflows/unity.yml`) на каждый пуш гоняет тесты Core и проверяет, что JSON совпадает с веб-версией.
Сборки Android и iOS включаются, когда в Settings → Secrets → Actions есть `UNITY_LICENSE`, `UNITY_EMAIL`, `UNITY_PASSWORD`
(бесплатная лицензия Unity Personal, как её получить: https://game.ci/docs/github/activation).

## Проверка сборки без Unity

`dotnet build unity/Tests/CompileCheck` компилирует Core, Platform и Game против справочных сборок
UnityEngine из NuGet (Unity 2021.3 и uGUI 2020.3). Так ошибки в коде видны сразу, ещё до открытия
проекта в редакторе. API, которого в этих сборках нет (только в Unity 6), закрыт условием `FITIL_REFCHECK`.

`dotnet build unity/Tests/SdkCheck` так же проверяет код настоящих покупок и рекламы (`Platform/Iap`, `Platform/Ads`):
вызовы Unity IAP 5 и Google Mobile Ads описаны заглушками в `Tests/SdkCheck/Stubs.cs`.

