"""Calm idle loops and a magenta despill for generated character clips.

Some generated idle loops drip (wax, water, ink, drool) and read as machine-made. For those characters the loop
is rebuilt from its first frame: the figure breathes and sways a little, a candle flame or steam gets a small
flicker of its own, and nothing flows. Vapour and glints that kept a pink tint from the magenta backdrop are
neutralised. Frame 0 of the new loop is the still frame itself, so the tool can be run again on its own output.

usage: python3 -I calm.py REPO [id ...]   patches assets/<newest ea dir>/<id>_*.webp in place (all ids, or only the listed)
build_assets.py applies the same steps when it builds an idle loop from the source clip.
The game caches atlases by path: after patching, rename the ea folder (EA_DIR in build_assets.py) and rebuild the manifest.
"""
import os, re, sys
import numpy as np
from PIL import Image

FS, COLS, N = 320, 8, 36

# id -> how the still frame moves. anchor 'feet' (default) stands and breathes, 'top' hangs and swings.
# flame / steam: box x0, y0, x1, y1 and the base point x, y; the part above the base flickers on its own.
# flag: box x0, y0, x1, y1 and the x of the pole; the cloth ripples, more at the free edge.
# erase: boxes cleared in the still frame (a drop caught in mid-air).
CALM = {
    'waxgiant': {'flame': (156, 0, 192, 40, 172, 38)},
    'golem': {'flame': (144, 4, 180, 54, 162, 52)},
    'samovar': {'steam': (126, 0, 186, 54, 156, 52), 'erase': [(206, 226, 232, 264)]},
    'icicle': {'anchor': 'top'},
    'ghoul': {},
    'inkcat': {},
    # the letter in its mouth slid, turned and passed through the teeth like a sticker
    'mailbox': {'flag': (221, 16, 254, 56, 222)},
}
# breath, steam, wind and glints that came out pink in the idle loop
DESPILL = ('icebear', 'iceknight', 'vane', 'snowimp', 'frostfox', 'samovar')

def despill(im):
    """bright pixels where red and blue both stand above green turn white-grey; dark purples are left alone"""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    g = a[..., 1]
    m = np.minimum(a[..., 0], a[..., 2])
    k = (np.clip((m - g - 10) / 20, 0, 1) * np.clip((m - 100) / 60, 0, 1))[..., None]
    a[..., :3] += k * (a[..., :3].max(-1, keepdims=True) - a[..., :3])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def sample(P, sx, sy):
    """bilinear read of a premultiplied float picture at float coordinates; outside is empty"""
    H, W = P.shape[:2]
    x0 = np.floor(sx).astype(np.int32); y0 = np.floor(sy).astype(np.int32)
    fx = (sx - x0)[..., None]; fy = (sy - y0)[..., None]
    def at(yy, xx):
        ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
        return P[np.clip(yy, 0, H - 1), np.clip(xx, 0, W - 1)] * ok[..., None]
    return at(y0, x0) * (1 - fx) * (1 - fy) + at(y0, x0 + 1) * fx * (1 - fy) + at(y0 + 1, x0) * (1 - fx) * fy + at(y0 + 1, x0 + 1) * fx * fy

def calm_idle(base, anchor='feet', flame=None, steam=None, flag=None, erase=(), n=N):
    """one still frame -> n frames of a seamless loop"""
    a = np.asarray(base.convert('RGBA')).astype(np.float32)
    for x0, y0, x1, y1 in erase:
        a[y0:y1, x0:x1, 3] = 0
    P = a.copy(); P[..., :3] *= a[..., 3:4] / 255
    al = a[..., 3] > 40
    rows = np.where(al.any(1))[0]; top, bot = int(rows[0]), int(rows[-1]); hh = max(1, bot - top)
    feet = np.where(al[int(bot - hh * .12):bot + 1].any(0))[0]; cxf = (feet[0] + feet[-1]) / 2
    head = np.where(al[top:int(top + hh * .12) + 1].any(0))[0]; cxt = (head[0] + head[-1]) / 2
    Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    out = []
    for t in range(n):
        ph = 2 * np.pi * t / n
        if anchor == 'top':
            # hangs: a slow swing about the top and a hint of stretch
            th = np.radians(1.7) * np.sin(ph); c, s = np.cos(th), np.sin(th)
            dx, dy = X - cxt, Y - top
            sx = cxt + dx * c + dy * s; sy = top - dx * s + dy * c
            sy = top + (sy - top) / (1 + 0.008 * (1 - np.cos(2 * ph)) / 2)
        else:
            # stands: the still frame is the full breath; breathing out makes it lower and a touch wider,
            # the top leans a little. Nothing ever reaches above the still frame, so the cell never clips it
            b = -0.02 * (1 - np.cos(ph)) / 2
            sy = bot - (bot - Y) / (1 + b)
            u = np.clip((bot - sy) / hh, 0, 1.2)
            sx = cxf + (X - 2.0 * np.sin(ph) * u ** 1.5 - cxf) / (1 - 0.35 * b)
        for kind, reg in (('flame', flame), ('steam', steam)):
            if not reg:
                continue
            x0, y0, x1, y1, bx, by = reg
            v = np.clip((by - sy) / max(1, by - y0), 0, 1.3)
            if kind == 'flame':
                ly = by - (by - sy) / (1 - 0.09 * (1 - np.cos(3 * ph)) / 2 - 0.05 * (1 - np.cos(5 * ph)) / 2)
                lx = sx - (1.6 * np.sin(2 * ph) + 0.9 * np.sin(7 * ph)) * v ** 1.3
            else:
                ly = sy
                lx = sx - 2.2 * (np.sin(2 * np.pi * 1.4 * v - 2 * ph) - np.sin(2 * np.pi * 1.4 * v)) * v
            w = np.clip(np.minimum(np.minimum(sx - x0, x1 - sx), y1 - sy) / 4, 0, 1)
            sx = sx + w * (lx - sx); sy = sy + w * (ly - sy)
        if flag:
            x0, y0, x1, y1, px = flag
            u = np.clip((sx - px) / max(1, x1 - px), 0, 1)
            wave = np.sin(2 * np.pi * 0.9 * u - 2 * ph) - np.sin(2 * np.pi * 0.9 * u)
            w = np.clip(np.minimum(np.minimum(sx - x0, x1 - sx), np.minimum(sy - y0, y1 - sy)) / 3, 0, 1)
            sy = sy + w * 1.7 * wave * u
        F = sample(P, sx, sy)
        alpha = F[..., 3:4]
        rgb = F[..., :3] * 255 / np.maximum(alpha, 1)
        out.append(Image.fromarray(np.clip(np.concatenate([rgb, alpha], -1), 0, 255).astype(np.uint8), 'RGBA'))
    return out

def cells(at, n):
    return [at.crop(((i % COLS) * FS, (i // COLS) * FS, (i % COLS) * FS + FS, (i // COLS) * FS + FS)) for i in range(n)]

def atlas(frames):
    at = Image.new('RGBA', (COLS * FS, ((len(frames) + COLS - 1) // COLS) * FS), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        at.alpha_composite(f, ((i % COLS) * FS, (i // COLS) * FS))
    return at

if __name__ == '__main__':
    A = os.path.join(sys.argv[1], 'assets')
    ea = os.path.join(A, sorted(d for d in os.listdir(A) if re.fullmatch(r'ea\d*', d))[-1])
    put = lambda im, p: im.save(p, 'WEBP', quality=76, alpha_quality=70, method=6)
    only = set(sys.argv[2:])
    for cid in DESPILL:
        if only and cid not in only:
            continue
        for part in ('idle', 'act', 'die'):
            p = os.path.join(ea, f'{cid}_{part}.webp')
            if os.path.exists(p):
                put(despill(Image.open(p)), p)
        print('despill', cid)
    for cid, how in CALM.items():
        if only and cid not in only:
            continue
        p = os.path.join(ea, f'{cid}_idle.webp')
        put(atlas(calm_idle(cells(Image.open(p).convert('RGBA'), 1)[0], **how)), p)
        print('calm', cid)
