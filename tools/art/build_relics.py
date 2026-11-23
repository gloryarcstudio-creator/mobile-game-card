"""Талисманы из исходников заново: свечение вокруг предмета сохраняет свой цвет.
Нейросеть рисует свечение прямо на пурпурном фоне. Обычный ключ (key.py) считает точку «рыжее пополам с фоном»
непрозрачной розово-красной, и рыжий или золотой ореол в игре выходил малиновым, а местами с серо-зелёной каймой.
Здесь зона ореола находится заливкой от краёв картинки (ярко и с примесью пурпура, до тёмного контура предмета),
и в ней фон вычитается с поправкой на цвет самого свечения: чистое свечение у контура даёт, сколько в нём
«своего» избытка синего над зелёным (d0), и доля свечения в точке считается от него, а не от нуля.
Кадрирование прежнее (рамка по старому ключу), размер 256 вместо 192. Папка новая (r2): страница помнит картинки по пути.
usage: python3 -I build_relics.py SRC_DIR REPO_DIR [OUT_SUBDIR=r2] [SIZE=256] [id ...]
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from key import key, bbox, fit, bg_color

def glow_key(raw):
    raw = raw.convert('RGB')
    old = key(raw)
    a = np.asarray(raw).astype(np.float32)
    Bg = bg_color(a)
    SB = max(1.0, min(Bg[0], Bg[2]) - Bg[1])
    s_raw = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    k = np.clip(s_raw / SB, 0, 1)
    walk = (a[..., 0] > 190) & (k > 0.08)
    m = Image.fromarray((walk * 255).astype(np.uint8)).copy()
    H, W = walk.shape
    seeds = [(x, y) for x in range(0, W, 16) for y in (0, H - 1)] + [(x, y) for y in range(0, H, 16) for x in (0, W - 1)]
    for x, y in seeds:
        if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    out = np.asarray(m) == 128
    C = np.asarray(old).astype(np.float32)
    # чистое свечение: яркие точки у самой границы зоны, уже без примеси фона
    ring = (np.asarray(Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0) & ~out
    core = ring & (a[..., 0] > 190) & (C[..., 3] > 200)
    d0 = float(np.percentile(s_raw[core], 30)) if core.sum() > 300 else 0.0
    d0 = min(0.0, max(-140.0, d0))
    t_s = 1 - k
    t_g = np.clip((SB - s_raw) / (SB - d0), 0, 1)
    t = np.minimum(t_s, t_g)
    un = np.clip((a - (1 - t)[..., None] * Bg) / np.maximum(t, 0.04)[..., None], 0, 255)
    al = np.clip((0.5 * (t_s + t) - 0.06) / 0.94, 0, 1)
    C[out, :3] = un[out]
    C[out, 3] = al[out] * 255
    # полоска сразу за границей зоны: свечение с малой примесью фона, оно непрозрачно, но слегка розовит
    band = ring & (a[..., 0] > 190) & (s_raw > d0 + 10) & (t_g > 0.6)
    C[band, :3] = un[band]
    return Image.fromarray(np.clip(C, 0, 255).astype(np.uint8), 'RGBA'), bbox(old), d0, float(out.mean())

if __name__ == '__main__':
    SRC, REPO = sys.argv[1:3]
    sub = sys.argv[3] if len(sys.argv) > 3 else 'r2'
    size = int(sys.argv[4]) if len(sys.argv) > 4 else 256
    only = set(sys.argv[5:])
    os.makedirs(os.path.join(REPO, 'assets', sub), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(SRC, 'relic_*.png'))):
        rid = os.path.basename(f)[6:-4]
        if only and rid not in only: continue
        im, box, d0, frac = glow_key(Image.open(f))
        p = os.path.join(REPO, 'assets', sub, rid + '.webp')
        fit(im, size, pad=0.02, anchor='center', box=box).save(p, 'WEBP', quality=82, alpha_quality=88, method=6)
        print(rid, 'd0 %.0f' % d0, 'bg %.2f' % frac, os.path.getsize(p))
