"""Временные служебные значки (шестерёнка, меню, замок, реклама) в духе нарисованного набора.

Пока нет готовых картинок из набора 08, значки собираются кодом: латунь с палитрой и мазком,
снятыми с нарисованного колокольчика (assets/r/bell.webp), тёмный контур, свет слева сверху.
Когда придут настоящие картинки, их кладут в assets/i/ под НОВЫМИ именами (страница кэширует по пути)
и меняют имена в uiIco (js/game.js); этот файл после этого не нужен.

    python3 -I tools/art/build_interim_icons.py && python3 -I tools/art/gen_manifest.py
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets')
S = 384          # рисуем крупно, потом уменьшаем вчетверо
OUT = 96

BRASS = [(0.0, (74, 42, 16)), (0.3, (140, 88, 28)), (0.55, (196, 140, 44)), (0.8, (236, 190, 84)), (1.0, (255, 232, 150))]
RED = [(0.0, (92, 22, 18)), (0.35, (150, 38, 28)), (0.65, (206, 66, 44)), (1.0, (246, 132, 96))]
STEEL = [(0.0, (48, 56, 74)), (0.35, (98, 112, 136)), (0.7, (168, 184, 204)), (1.0, (232, 240, 250))]
INK = (34, 22, 16)


def ramp(stops, t):
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), dtype=np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        sel = (t >= a) & (t <= b)
        u = ((t - a) / (b - a))[sel][:, None]
        out[sel] = np.array(ca) * (1 - u) + np.array(cb) * u
    return out


def grain():
    """Мазок: высокие частоты с нарисованного колокольчика, растянутые на весь значок."""
    try:
        bell = Image.open(os.path.join(ROOT, 'r', 'bell.webp')).convert('L').crop((70, 70, 126, 140))
    except OSError:
        return np.ones((S, S), dtype=np.float32)
    big = bell.resize((S, S), Image.BICUBIC)
    low = big.filter(ImageFilter.GaussianBlur(26))
    g = (np.asarray(big, dtype=np.float32) - np.asarray(low, dtype=np.float32)) / 255.0
    return 1 + g * 1.5


GRAIN = grain()


def blur(mask, r):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255


def shift(a, dx, dy):
    return np.roll(np.roll(a, dy, axis=0), dx, axis=1)


def shade(mask, stops, bevel=9, lift=0.0):
    """Объём: свет слева сверху, тень справа снизу, мягкие ступени, как в рисованном наборе."""
    b = blur(mask, bevel)
    light = shift(b, -bevel, -bevel) - shift(b, bevel, bevel)   # >0 у левого верхнего края
    yy = np.linspace(0.16, -0.16, S, dtype=np.float32)[:, None]
    t = 0.52 + lift + light * 0.95 + yy
    t = t * 0.55 + np.round(t * 5) / 5 * 0.45
    return ramp(stops, t * GRAIN)


def compose(layers, outline=11):
    """layers: [(маска 0..1, палитра, параметры shade)]. Общий тёмный контур вокруг всего значка."""
    rgb = np.zeros((S, S, 3), dtype=np.float32)
    alpha = np.zeros((S, S), dtype=np.float32)
    whole = np.zeros((S, S), dtype=np.float32)
    for m, _, _ in layers:
        whole = np.maximum(whole, m)
    edge = np.asarray(Image.fromarray((whole * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(outline * 2 + 1)), dtype=np.float32) / 255
    edge = blur(edge, 1.2)
    rgb[:] = INK
    alpha = edge
    for m, stops, kw in layers:
        # тонкий тёмный зазор между соседними деталями
        gap = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)), dtype=np.float32) / 255
        rgb = rgb * (1 - gap[..., None]) + np.array(INK, dtype=np.float32) * gap[..., None]
        col = shade(m, stops, **kw)
        ms = blur(m, 0.8)[..., None]
        rgb = rgb * (1 - ms) + col * ms
    # мягкая тень под значком
    sh = shift(blur(whole, 10), 0, 10) * 0.35
    a = np.clip(np.maximum(alpha, sh), 0, 1)
    rgb = np.where((alpha > 0.02)[..., None], rgb, np.array((10, 8, 14), dtype=np.float32))
    img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA')
    return img.resize((OUT, OUT), Image.LANCZOS)


def canvas():
    im = Image.new('L', (S, S), 0)
    return im, ImageDraw.Draw(im)


def arr(im):
    return np.asarray(im, dtype=np.float32) / 255


def gear():
    im, d = canvas()
    c = S / 2
    teeth, r_out, r_root = 8, 168, 124
    pts = []
    for i in range(teeth):
        a0 = 2 * math.pi * i / teeth
        w_root, w_tip = 0.50, 0.30   # доля шага под зубом у основания и у вершины
        step = 2 * math.pi / teeth
        for da, r in ((-w_root / 2, r_root), (-w_tip / 2, r_out), (w_tip / 2, r_out), (w_root / 2, r_root)):
            pts.append((c + r * math.cos(a0 + da * step - math.pi / 2), c + r * math.sin(a0 + da * step - math.pi / 2)))
    d.polygon(pts, fill=255)
    d.ellipse((c - r_root - 2, c - r_root - 2, c + r_root + 2, c + r_root + 2), fill=255)
    d.ellipse((c - 54, c - 54, c + 54, c + 54), fill=0)
    body = arr(im)
    ring, d2 = canvas()
    d2.ellipse((c - 92, c - 92, c + 92, c + 92), fill=255)
    d2.ellipse((c - 54, c - 54, c + 54, c + 54), fill=0)
    return compose([(body, BRASS, dict(bevel=10, lift=-0.06)), (arr(ring), BRASS, dict(bevel=8, lift=0.1))])


def menu():
    layers = []
    for k in range(3):
        im, d = canvas()
        y = 92 + k * 84
        d.rounded_rectangle((58, y, S - 58, y + 46), radius=23, fill=255)
        layers.append((arr(im), BRASS, dict(bevel=8, lift=0.06)))
    return compose(layers)


def lock():
    sh, d = canvas()
    d.ellipse((104, 30, 280, 250), fill=255)
    d.ellipse((146, 74, 238, 230), fill=0)
    d.rectangle((0, 178, S, S), fill=0)
    d.rectangle((104, 140, 146, 196), fill=255)
    d.rectangle((238, 140, 280, 196), fill=255)
    body, d2 = canvas()
    d2.rounded_rectangle((64, 172, S - 64, 350), radius=30, fill=255)
    hole, d3 = canvas()
    d3.ellipse((166, 222, 218, 274), fill=255)
    d3.polygon([(180, 258), (204, 258), (214, 318), (170, 318)], fill=255)
    plate, d4 = canvas()
    d4.rounded_rectangle((92, 198, S - 92, 326), radius=18, fill=255)
    b = arr(body)
    h = arr(hole)
    img = compose([(arr(sh), STEEL, dict(bevel=8)), (b, BRASS, dict(bevel=11, lift=-0.04)), (arr(plate) * (1 - h), BRASS, dict(bevel=7, lift=0.12))])
    # скважина: тёмная, поверх всего
    px = np.asarray(img.resize((S, S), Image.LANCZOS), dtype=np.float32)
    hs = blur(h, 1.5)[..., None]
    px[..., :3] = px[..., :3] * (1 - hs) + np.array(INK, dtype=np.float32) * hs
    return Image.fromarray(px.astype(np.uint8), 'RGBA').resize((OUT, OUT), Image.LANCZOS)


def ad():
    t, d = canvas()
    d.rounded_rectangle((34, 84, S - 34, S - 84), radius=26, fill=255)
    for x in (34, S - 34):                       # вырезы билета по бокам
        d.ellipse((x - 26, S / 2 - 26, x + 26, S / 2 + 26), fill=0)
    tri, d2 = canvas()
    d2.polygon([(152, 132), (258, 192), (152, 252)], fill=255)
    tri = tri.filter(ImageFilter.GaussianBlur(5)).point(lambda v: 255 if v > 110 else 0)   # скруглить углы
    tm = arr(tri)
    return compose([(arr(t) * (1 - np.clip(blur(tm, 4) * 3, 0, 1)), BRASS, dict(bevel=10)), (tm, RED, dict(bevel=8, lift=0.05))])


if __name__ == '__main__':
    out = os.path.join(ROOT, 'i')
    for name, fn in (('gear', gear), ('menu', menu), ('lock', lock), ('ad', ad)):
        fn().save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=92, method=6)
        print('saved', name)
