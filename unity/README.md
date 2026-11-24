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
| `Assets/Fitil/Game` | Экраны на uGUI, собираются кодом. `Boot` — запуск и титул, `RunFlow*` — забег, `CombatScreen` — бой, `Menus` — настройки и пауза, `Progress*` — достижения, статистика и база знаний, `StoreScreen` — магазин, `Cinema` — заставка, `Snow` — снегопад, `Ui` — помощники вёрстки. |
| `Assets/Fitil/Platform` | Сохранения (`SaveStore`), покупки и реклама (`Store`: пока тестовые окна, как в веб-версии; все покупки по $5). |
| `Assets/Fitil/Editor` | Настройки проекта кодом: портрет, отрисовка вокруг выреза камеры, идентификатор `com.protekgames.lastray`, IL2CPP, ARM64. Меню Fitil → Применить настройки. |
| `Assets/Fitil/Resources/Data` | JSON из веб-версии: `node tools/unity/export_data.js` (данные и строки) и `node tools/unity/export_card_text.js` (шаблоны описаний карт). Не править руками. |
| `Assets/Fitil/Resources/Art` | PNG из `assets/`: `tools/unity/export_assets.py`. В git не кладётся. |
| `Tests/Core.Tests` | Тесты Core без Unity: `dotnet run --project unity/Tests/Core.Tests`. Эталоны в `Tests/Fixtures` делает `node tools/unity/parity_fixtures.js`. | Бои: `node tools/unity/combat_fixtures.js` (128 настоящих боёв из браузера через Playwright, после любого изменения боя в веб-версии).

## Сборка

GitHub Actions (`.github/workflows/unity.yml`) на каждый пуш гоняет тесты Core и проверяет, что JSON совпадает с веб-версией.
Сборки Android и iOS включаются, когда в Settings → Secrets → Actions есть `UNITY_LICENSE`, `UNITY_EMAIL`, `UNITY_PASSWORD`
(бесплатная лицензия Unity Personal, как её получить: https://game.ci/docs/github/activation).

## Проверка сборки без Unity

`dotnet build unity/Tests/CompileCheck` компилирует Core, Platform и Game против справочных сборок
UnityEngine из NuGet (Unity 2021.3 и uGUI 2020.3). Так ошибки в коде видны сразу, ещё до открытия
проекта в редакторе. API, которого в этих сборках нет (только в Unity 6), закрыт условием `FITIL_REFCHECK`.

