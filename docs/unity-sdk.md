# «Последний луч» (Unity): реклама и аналитика

В игру встроены AdMob с показом Unity Ads через медиацию, окно согласия Google (UMP), Firebase (Analytics, Crashlytics, Remote Config) и Tenjin. Схема та же, что в «Коте-экзорцисте», с одним отличием: репозиторий открытый, поэтому ни одного id, ключа или файла настроек в нём нет. Сборка в GitHub берёт их из секретов репозитория.

Пока секретов нет, игра собирается с пробными рекламными блоками Google, без Firebase и без отправки данных в Tenjin.

## Секреты GitHub

Settings → Secrets and variables → Actions → New repository secret.

| Секрет | Что положить | Где взять |
|---|---|---|
| `ADMOB_APP_ID_ANDROID` | id приложения AdMob для Android (вид `ca-app-pub-…~…`) | AdMob → Приложения → приложение → Настройки |
| `ADMOB_APP_ID_IOS` | то же для iOS | там же |
| `ADMOB_REWARDED_ANDROID` | id блока «реклама с вознаграждением» для Android (вид `ca-app-pub-…/…`) | AdMob → приложение → Рекламные блоки |
| `ADMOB_REWARDED_IOS` | то же для iOS | там же |
| `TENJIN_SDK_KEY` | ключ SDK Tenjin | Tenjin → Configure → SDK key |
| `FIREBASE_GOOGLE_SERVICES_JSON` | файл `google-services.json` в base64 | Firebase → Настройки проекта → приложение Android |
| `FIREBASE_GOOGLE_SERVICE_INFO_PLIST` | файл `GoogleService-Info.plist` в base64 | Firebase → Настройки проекта → приложение iOS |

Base64 из файла: `base64 -w0 google-services.json` (Linux), `base64 -i google-services.json` (macOS), в Windows PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))`.

Свои рекламные блоки работают только в выпускной сборке. В сборке для разработки всегда стоят пробные, чтобы случайные нажатия не навредили аккаунту AdMob.

## Что сделать в кабинетах

Идентификатор игры: `com.protekgames.lastray`.

1. **AdMob.** Добавить приложение для Android и для iOS, в каждом создать блок «С вознаграждением». В Privacy & messaging включить для игры сообщение о согласии (GDPR) и пояснение перед запросом IDFA для iOS.
2. **Unity Ads.** В Unity Dashboard создать проект игры (Monetization), взять Game ID и Placement ID для rewarded. В AdMob → Медиация создать группу для rewarded и добавить Unity Ads как источник с этими id. В коде игры для Unity Ads ничего менять не нужно.
3. **Firebase.** Создать проект (или добавить приложения в существующий), зарегистрировать Android и iOS с идентификатором выше, скачать два файла настроек. Связать Firebase с AdMob, чтобы доход от рекламы попадал в отчёты.
4. **Tenjin.** Добавить приложение, подключить Google Play. Ключ SDK общий на аккаунт.
5. **app-ads.txt** на protekgames.com: строки AdMob уже должны быть, добавить строки Unity Ads, если их там нет.

## Что уходит в аналитику

`run_start`, `run_end`, `run_won`, `first_fight_won`, `first_boss_won`, `level_reached`, `ad_reward` (с местом показа), `iap_purchase`, доход с каждого показа рекламы. В Tenjin идут ключевые события, покупки и доход от рекламы. До ответа игрока в окне согласия Firebase ничего не собирает.

## Как это устроено

- `unity/Assets/Fitil/Platform/Analytics.cs`: общий слой и чтение согласия.
- `unity/Assets/Fitil/Platform/Ads/AdMobAds.cs`: реклама, окно согласия, доход с показа.
- `unity/Assets/Fitil/Platform/Firebase/FirebaseSink.cs`, `unity/Assets/FitilSdk/TenjinSink.cs`: отправка.
- `unity/Assets/Fitil/Editor/SdkSetup.cs`: записывает id из секретов перед сборкой.
- `tools/unity/fetch_sdks.py`: скачивает Tenjin и Firebase перед сборкой.

## Важно

Не нажимать на настоящую рекламу на своих телефонах: AdMob может заблокировать аккаунт. Для проверки добавить свои устройства в AdMob → Настройки → Тестовые устройства.

## Подпись для Google Play

Сборка Android подписывается своим ключом, когда в секретах репозитория есть `ANDROID_KEYSTORE_BASE64` (файл ключа в base64),
`ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS` и `ANDROID_KEY_PASS` (если пуст, берётся пароль файла). Без них подпись отладочная:
для проверки на телефоне годится, Google Play такой пакет не принимает. Код версии равен номеру прогона в GitHub.
Файл ключа и пароли хранятся в менеджере паролей, в репозиторий не кладутся.
