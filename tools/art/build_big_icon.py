"""Крупная чистая картинка для значка, который стоит на экране большим (сундук).
Обычные значки собираются в 192 px (build_assets.py): для фигуры в 170 px экрана на телефоне с плотностью 3 это размыто.
Заодно убирает цветной ореол вокруг фигуры: нейросеть рисует свечение прямо на пурпурном фоне,
обычный ключ оставляет от него розовое пятно. Ореол лежит снаружи чёрного контура, поэтому заливка
от краёв картинки по «розовым» точкам доходит ровно до контура.
Кадрирование то же, что у прежнего значка (рамка берётся по прежнему ключу), чтобы картинка встала на то же место.
usage: python3 -I build_big_icon.py SRC.png REPO_DIR NAME [SIZE=512]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from key import key, bbox, fit

SRC, REPO, NAME = sys.argv[1:4]
SIZE = int(sys.argv[4]) if len(sys.argv) > 4 else 512
raw = Image.open(SRC).convert('RGB')
old = key(raw)                      # прежний ключ: по нему рамка
box = bbox(old)
a = np.asarray(raw).astype(np.int32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
pink = (R > 170) & (R - G > 95)     # фон и ореол: красного много, зелёного мало (снег и дерево сюда не попадают)
m = Image.fromarray((pink * 255).astype(np.uint8)).copy()
H, W = pink.shape
for x, y in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (0, H // 2), (W - 1, H // 2), (W // 2, H - 1)]:
    if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
out_mask = np.asarray(m) == 128     # всё, что снаружи фигуры
C = np.asarray(old).astype(np.float32)
al = C[..., 3] / 255
# мягкий край в 1 px и только внутрь от найденной границы
soft = np.asarray(Image.fromarray((~out_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
al = np.minimum(al, np.where(out_mask, 0, np.clip((soft - 0.5) * 2, 0, 1) * 0.35 + 0.65))
al[out_mask] = 0
# у самой границы остаётся розовая кайма (смесь ореола с контуром): гасим избыток красного и синего над зелёным
band = np.asarray(Image.fromarray((out_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
band &= ~out_mask
ex = np.clip(np.minimum(C[..., 0], C[..., 2]) - C[..., 1], 0, None) * band
C[..., 0] -= ex * 0.9; C[..., 2] -= ex * 0.9
exr = np.clip(C[..., 0] - C[..., 1] - 40, 0, None) * band * (C[..., 1] < 150)   # розово-красный остаток у тёмного контура
C[..., 0] -= exr * 0.8
C[..., 3] = al * 255
im = Image.fromarray(np.clip(C, 0, 255).astype(np.uint8), 'RGBA')
im = fit(im, SIZE, pad=0.02, anchor='center', box=box)
p = os.path.join(REPO, 'assets', 'i', NAME + '.webp')
im.save(p, 'WEBP', quality=84, alpha_quality=90, method=6)
print(p, im.size, os.path.getsize(p), 'box', box, 'removed', int(out_mask.sum()), 'of', W * H)
