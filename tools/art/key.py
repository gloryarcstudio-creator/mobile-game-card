import numpy as np
from PIL import Image, ImageFilter

def bg_color(a):
    h, w = a.shape[:2]
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1], a[2], a[-3], a[:, 2], a[:, -3]])
    # keep border pixels close to magenta-ish majority
    med = np.median(b, 0)
    d = np.linalg.norm(b - med, axis=1)
    return np.median(b[d < 40], 0) if (d < 40).sum() > 20 else med

def key(img, d0=45, d1=130, bg=None):
    """img: PIL RGB/RGBA -> PIL RGBA with flat background keyed out."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    B = bg_color(a) if bg is None else np.array(bg, np.float32)
    diff = a - B
    # weight distance: magenta bg has R,B high, G low. use plain RGB distance plus green emphasis
    dist = np.sqrt((diff ** 2).sum(-1))
    al = np.clip((dist - d0) / (d1 - d0), 0, 1)
    # pixels strongly magenta-hued (R,B >> G) near bg hue get extra transparency
    # un-premultiply against bg where partial
    am = al[..., None]
    with np.errstate(divide='ignore', invalid='ignore'):
        C = (a - (1 - am) * B) / np.maximum(am, 1e-3)
    C = np.where(am > 0.02, C, a)
    C = np.clip(C, 0, 255)
    # despill: on edge band, cap magenta excess (min(R,B) - G) to what it was in the interior
    edge = (al < 0.999)
    a8 = (al * 255).astype(np.uint8)
    band = np.asarray(Image.fromarray(a8).filter(ImageFilter.MinFilter(5))) < 250
    band &= al > 0
    R, G, Bc = C[..., 0], C[..., 1], C[..., 2]
    ex = np.minimum(R, Bc) - G
    sp = band & (ex > 30)
    k = np.where(sp, (ex - 30), 0)
    C[..., 0] -= k * 0.6
    C[..., 2] -= k * 0.6
    C = np.clip(C, 0, 255)
    # remove isolated specks: alpha cleanup with small open
    out = np.dstack([C, al * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def bbox(im, thr=24):
    al = np.asarray(im)[..., 3]
    ys, xs = np.where(al > thr)
    if len(xs) == 0: return (0, 0, im.width, im.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)

def fit(im, size, pad=0.04, anchor='bottom', box=None):
    """trim and place on a size×size canvas; anchor bottom-center or center."""
    bx = box or bbox(im)
    c = im.crop(bx)
    W = H = size
    inner = size * (1 - 2 * pad)
    s = min(inner / c.width, inner / c.height)
    nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
    c = c.resize((nw, nh), Image.LANCZOS)
    can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - nw) // 2
    y = (H - nh - round(size * pad)) if anchor == 'bottom' else (H - nh) // 2
    can.alpha_composite(c, (x, y))
    return can
