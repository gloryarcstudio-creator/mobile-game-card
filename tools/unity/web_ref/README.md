# Эталон вёрстки: веб-версия

Скрипты снимают экраны веб-версии и размеры их элементов, чтобы сверять с ними вёрстку в Unity.

    python3 -m http.server 8791        # из корня репозитория
    node tools/unity/web_ref/shots.js  # снимки экранов 400×860 в текущую папку
    node tools/unity/web_ref/rects.js talk   # прямоугольники элементов экрана: title, heroes, intro, map, combat, talk, shop, rest, chest, meet, after

Числа из `rects.js` — это места и размеры в точках макета 400×860; в Unity они идут в `Box(x, y, w, h)`.
