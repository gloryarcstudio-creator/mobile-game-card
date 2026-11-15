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

# ---------- effects keyed against the magenta backdrop ----------
# Smoke, fog, dust and sparks in the clips are translucent, so they pick up the magenta
# backdrop; the plain distance key then leaves them purple. The screen key reads every pixel
# as a mix of a non-magenta colour and the backdrop (share = magenta excess min(R,B) - G).
# The character's own colours (body palette from calm idle frames) keep the plain key, so
# violet wings or a purple cloak stay as drawn.
Q = 16

def key_screen(img, bg):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    B = np.array(bg, np.float32)
    SB = max(1.0, min(B[0], B[2]) - B[1])
    s = np.clip(np.minimum(a[..., 0], a[..., 2]) - a[..., 1], 0, None)
    k = np.clip(s / SB, 0, 1)
    al = 1 - k
    C = (a - k[..., None] * B) / np.maximum(al, 1e-3)[..., None]
    C = np.clip(np.where(al[..., None] > 0.02, C, 0), 0, 255)
    return Image.fromarray(np.dstack([C, al * 255]).astype(np.uint8), 'RGBA')

def tint(raw):
    """how much a raw pixel leans to the backdrop's own hue: magenta excess with R close to B"""
    s = np.clip(np.minimum(raw[..., 0], raw[..., 2]) - raw[..., 1], 0, None)
    return np.clip(1 - np.abs(raw[..., 0] - raw[..., 2]) / (0.5 * s + 12), 0, 1) * (s > 8)

def body_palette(frames, bg, min_count=12):
    """raw colours of the character's body in calm frames, without magenta-tinted edge pixels"""
    cnt = np.zeros((256 // Q,) * 3, np.int32)
    for f in frames:
        k = np.asarray(key(Image.fromarray(f), bg=bg))[..., 3] > 230
        k &= tint(f.astype(np.float32)) < 0.5
        q = (f[k] // Q).astype(np.int32)
        np.add.at(cnt, (q[:, 0], q[:, 1], q[:, 2]), 1)
    return cnt >= min_count

def key_fx(img, bg, pal):
    """plain key for the body's own colours, screen key for everything else"""
    raw = np.asarray(img.convert('RGB'))
    q = (raw // Q).astype(np.int32)
    # a magenta-tinted pixel is smoke or spill over the backdrop even when its colour bin is the body's
    prot = pal[q[..., 0], q[..., 1], q[..., 2]] & (tint(raw.astype(np.float32)) < 0.5)
    n = np.asarray(key(img, bg=bg)); s = np.asarray(key_screen(img, bg))
    return Image.fromarray(np.where(prot[..., None], n, s), 'RGBA')

def figure_tint(raw, bg):
    """share of the non-backdrop pixels that lean to the backdrop's hue (rises when a body fades into it)"""
    f = raw.astype(np.float32)
    off = np.sqrt(((f - np.asarray(bg, np.float32)) ** 2).sum(-1)) > 60
    return float((tint(f)[off] >= 0.5).mean()) if off.any() else 0.0

def key_fade(img, bg, base):
    """plain key while the body is solid; screen key once it turns see-through over the backdrop
    (a see-through body mixes with magenta into colours no palette can tell from its own)"""
    n = np.asarray(key(img, bg=bg)).astype(np.float32)
    w = float(np.clip((figure_tint(np.asarray(img.convert("RGB")), bg) - base) / 0.08, 0, 1))
    if w <= 0:
        return Image.fromarray(n.astype(np.uint8), 'RGBA')
    s = np.asarray(key_screen(img, bg)).astype(np.float32)
    a = n[..., 3:] * (1 - w) + s[..., 3:] * w
    c = (n[..., :3] * n[..., 3:] * (1 - w) + s[..., :3] * s[..., 3:] * w) / np.maximum(a, 1e-3)
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), a]).astype(np.uint8), 'RGBA')
