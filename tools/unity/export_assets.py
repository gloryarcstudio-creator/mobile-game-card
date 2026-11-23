#!/usr/bin/env python3
"""Картинки веб-версии для Unity.

python3 -I tools/unity/export_assets.py [OUT]   (по умолчанию unity/Assets/Fitil/Resources/Art)

Unity не читает WebP, поэтому каждая картинка из assets/ переводится в PNG той же
величины: assets/bg/bg_title.webp -> Art/bg/bg_title.png. Результат в git не кладётся
(см. unity/.gitignore): его делают CI перед сборкой и вы перед открытием проекта.
Пока переводятся плоские папки (фоны, карты, талисманы, интерфейс, герои, иконки).
Атласы анимаций (ea6), эффекты (fx4) и музыка добавятся на этапе «Конвертеры».
Нужен Pillow с поддержкой WebP: pip install pillow."""
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'unity', 'Assets', 'Fitil', 'Resources', 'Art')
FLAT = ['bg', 'c', 'e', 'h', 'i', 'it', 'pic', 'r2', 'st', 'ui2']


def main():
    done = skipped = 0
    for d in FLAT:
        src = os.path.join(ROOT, 'assets', d)
        if not os.path.isdir(src):
            continue
        dst = os.path.join(OUT, d)
        os.makedirs(dst, exist_ok=True)
        for name in sorted(os.listdir(src)):
            if not name.endswith('.webp'):
                continue
            s = os.path.join(src, name)
            o = os.path.join(dst, name[:-5] + '.png')
            if os.path.exists(o) and os.path.getmtime(o) >= os.path.getmtime(s):
                skipped += 1
                continue
            with Image.open(s) as im:
                im.load()
                im.save(o, compress_level=6)
            done += 1
    print(f'PNG: {done} новых, {skipped} без изменений -> {OUT}')


if __name__ == '__main__':
    main()
