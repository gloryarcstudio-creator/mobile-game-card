#!/usr/bin/env python3
"""Картинки веб-версии для Unity.

python3 -I tools/unity/export_assets.py [OUT]   (по умолчанию unity/Assets/Fitil/Resources/Art)

Unity не читает WebP, поэтому каждая картинка из assets/ переводится в PNG той же
величины: assets/bg/bg_title.webp -> Art/bg/bg_title.png. Результат в git не кладётся
(см. unity/.gitignore): его делают CI перед сборкой и вы перед открытием проекта.
Переводятся плоские папки (фоны, карты, талисманы, интерфейс, герои, иконки).
Музыка (последняя папка assets/m<N>/ с loops.json) копируется как есть в Resources/Audio/Music:
Unity читает MP3, границы петель — loops.json. Звуки делает tools/unity/render_sfx.js (они в git).
Живые враги (раскадровки assets/ea<N>/) — см. enemies(): кадры обрезаются по рисунку и плотно
укладываются в Art/ea/<враг>_<часть>.png, их места записаны в Art/ea/anim.json.
Нарисованные эффекты боя (пакеты assets/fx<N>/p*.txt) — см. effects(): Art/fx/<ролик>.png и Art/fx/fx.json.
Нужны Pillow с поддержкой WebP и numpy: pip install pillow numpy."""
import base64
import io
import json
import os
import shutil
import sys

import numpy as np
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
    enemies()
    effects()
    music()


def manifest():
    """window.ASSETS из js/assets.js (его пишет gen_manifest.py)."""
    src = open(os.path.join(ROOT, 'js', 'assets.js'), encoding='utf-8').read()
    body = src[src.index('{', src.index('window.ASSETS')):].strip().rstrip(';')
    return json.loads(body)


# Летающие враги висят над землёй: их кадр не опускается к ногам (ALOFT в js/paint.js)
ALOFT = ['bat', 'lampghost', 'mist', 'skywhale', 'wisp', 'icicle', 'laundress']
EDGE_FADE = 0.13   # ширина растворения у обрезанного края кадра, доля кадра (EDGE_FADE в js/paint.js)
PACK_W = 2048      # ширина атласа после укладки


def edge_fade(px, fs, e):
    """Замах вышел за кадр и обрезан по линейке: край кадра растворяется (paint() в js/paint.js).
    e: 1 верх, 2 право, 4 низ, 8 лево; низ только у вспышки во весь кадр — ногам нужна опора."""
    burst = (e & 1 and 1 or 0) + (e & 2 and 1 or 0) + (e & 8 and 1 or 0) >= 3
    f = fs * EDGE_FADE
    t = np.arange(fs, dtype=np.float32) / f   # расстояние от края в долях полосы
    g = np.interp(t, [0, 0.3, 0.7, 1], [1, 0.78, 0.2, 0]).astype(np.float32)  # сколько стереть
    keep = np.ones((fs, fs), np.float32)
    if e & 1: keep *= (1 - g)[:, None]
    if e & 4 and burst: keep *= (1 - g[::-1])[:, None]
    if e & 8: keep *= (1 - g)[None, :]
    if e & 2: keep *= (1 - g[::-1])[None, :]
    px[:, :, 3] = (px[:, :, 3].astype(np.float32) * keep + 0.5).astype(np.uint8)


def effects():
    """Ролики эффектов: в вебе они лежат в текстовых пакетах (base64), каждый ролик — WebP-атлас
    из кадров fs×fs по cols в ряд. Здесь каждый становится своим PNG: Art/fx/<имя>.png."""
    fx = manifest().get('fx')
    if not fx:
        print('эффектов нет')
        return
    base = os.path.join(ROOT, 'assets')
    dst = os.path.join(OUT, 'fx')
    os.makedirs(dst, exist_ok=True)
    texts = {}
    made = 0
    clips = {}
    for name, (fi, off, ln, n) in sorted(fx['clips'].items()):
        clips[name] = n
        o = os.path.join(dst, f'{name}.png')
        src = os.path.join(base, fx['files'][fi])
        if os.path.exists(o) and os.path.getmtime(o) >= os.path.getmtime(src):
            continue
        if fi not in texts:
            texts[fi] = open(src, encoding='ascii').read()
        a = off // 3 * 4   # каждый ролик начинается на границе четырёх букв base64
        raw = base64.b64decode(texts[fi][a:a + (ln + 2) // 3 * 4])[:ln]
        with Image.open(io.BytesIO(raw)) as im:
            im.convert('RGBA').save(o, compress_level=6)
        made += 1
    meta = {'fs': fx['fs'], 'cols': fx['cols'], 'pad': fx.get('pad', 0.08), 'clips': clips}
    json.dump(meta, open(os.path.join(dst, 'fx.json'), 'w'), separators=(',', ':'))
    print(f'эффекты: {len(clips)} роликов, {made} новых -> {dst}')


def pack(sizes):
    """Полки: кадры от высоких к низким, слева направо. Между кадрами 2 точки пустоты (сжатие блоками)."""
    w = PACK_W
    while True:
        order = sorted(range(len(sizes)), key=lambda i: -sizes[i][1])
        at = [None] * len(sizes)
        x = y = row = 0
        for i in order:
            cw, ch = sizes[i]
            if not cw:
                continue
            if x + cw > w:
                x, y, row = 0, y + row + 2, 0
            at[i] = (x, y)
            x += cw + 2
            row = max(row, ch)
        h = y + row
        if h <= 4096 or w >= 4096:
            return at, w, max(h, 1)
        w *= 2


def enemies():
    """Раскадровки живых врагов. Кадр 320×320 почти наполовину пуст, поэтому каждый обрезается по рисунку
    (прозрачность больше 2 из 255) и кадры укладываются плотно: файлов и памяти на треть меньше.
    Край кадра с меткой e растворяется прямо в файле. Опись: Art/ea/anim.json."""
    a = manifest()
    ea = a.get('ea') or 'ea'
    src = os.path.join(ROOT, 'assets', ea)
    dst = os.path.join(OUT, 'ea')
    os.makedirs(os.path.join(dst, '.cache'), exist_ok=True)
    out = {'src': ea, 'aloft': ALOFT, 'foot': a.get('foot', {}), 'enemies': {}}
    made = kept = 0
    for eid, m in sorted(a.get('anim', {}).items()):
        if not m.get('idle'):
            continue
        fs, cols = m['fs'], m['cols']
        idle = dict(m['idle'])
        acts = {k: dict(v) for k, v in (m.get('act') or {}).items()}
        # метки краёв по номеру кадра в атласе каждой части
        flags = {}
        ip = idle.get('f') or 'idle'
        for i, ch in enumerate(idle.pop('e', '') or ''):
            flags.setdefault(ip, {})[i] = int(ch, 16)
        for v in acts.values():
            ap = v.get('f') or 'act'
            for i, ch in enumerate(v.pop('e', '') or ''):
                flags.setdefault(ap, {})[v.get('o', 0) + i] = int(ch, 16)
        parts = {}
        for part in sorted({ip} | {v.get('f') or 'act' for v in acts.values()}):
            s = os.path.join(src, f'{eid}_{part}.webp')
            if not os.path.exists(s):
                continue
            o = os.path.join(dst, f'{eid}_{part}.png')
            meta = os.path.join(dst, '.cache', f'{eid}_{part}.json')  # Unity не видит папки с точкой
            if os.path.exists(o) and os.path.exists(meta) and os.path.getmtime(o) >= os.path.getmtime(s):
                parts[part] = json.load(open(meta))
                kept += 1
                continue
            with Image.open(s) as im:
                px = np.array(im.convert('RGBA'))
            rows = px.shape[0] // fs
            crops = []
            for k in range(rows * cols):
                fr = px[(k // cols) * fs:(k // cols + 1) * fs, (k % cols) * fs:(k % cols + 1) * fs].copy()
                e = flags.get(part, {}).get(k, 0)
                if e:
                    edge_fade(fr, fs, e)
                ys, xs = np.nonzero(fr[:, :, 3] > 2)
                if not len(xs):
                    crops.append((None, 0, 0))
                    continue
                x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
                crops.append((fr[y0:y1, x0:x1], int(x0), int(y0)))
            at, W, H = pack([(c[0].shape[1], c[0].shape[0]) if c[0] is not None else (0, 0) for c in crops])
            sheet = np.zeros((H, W, 4), np.uint8)
            fr_meta = []
            for k, (c, ox, oy) in enumerate(crops):
                if c is None:
                    fr_meta.append([0, 0, 0, 0, 0, 0])
                    continue
                x, y = at[k]
                sheet[y:y + c.shape[0], x:x + c.shape[1]] = c
                fr_meta.append([x, y, c.shape[1], c.shape[0], ox, oy])
            Image.fromarray(sheet, 'RGBA').save(o, compress_level=6)
            parts[part] = {'w': W, 'h': H, 'f': fr_meta}
            json.dump(parts[part], open(meta, 'w'), separators=(',', ':'))
            made += 1
        out['enemies'][eid] = {'fs': fs, 'idle': idle, 'act': acts, 'parts': parts}
    json.dump(out, open(os.path.join(dst, 'anim.json'), 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print(f'живые враги: {len(out["enemies"])}, атласов {made} новых, {kept} без изменений -> {dst}')


def music():
    """Дорожки из самой новой папки assets/m<N>/ (номер растёт, когда файлы меняются)."""
    dirs = sorted((d for d in os.listdir(os.path.join(ROOT, 'assets')) if d[:1] == 'm' and d[1:].isdigit()
                   and os.path.exists(os.path.join(ROOT, 'assets', d, 'loops.json'))), key=lambda d: int(d[1:]))
    if not dirs:
        print('музыки нет')
        return
    src = os.path.join(ROOT, 'assets', dirs[-1])
    dst = os.path.join(os.path.dirname(OUT), 'Audio', 'Music')
    os.makedirs(dst, exist_ok=True)
    n = 0
    for name in sorted(os.listdir(src)):
        if not (name.endswith('.mp3') or name == 'loops.json'):
            continue
        s = os.path.join(src, name)
        o = os.path.join(dst, name)
        if os.path.exists(o) and os.path.getmtime(o) >= os.path.getmtime(s) and os.path.getsize(o) == os.path.getsize(s):
            continue
        shutil.copyfile(s, o)
        n += 1
    print(f'музыка: {n} файлов скопировано из {src} -> {dst}')


if __name__ == '__main__':
    main()
