"""Painted interface skin: card frames, map card frame, scrolls, buttons and panels -> assets/ui/*.webp
usage: python3 -I build_ui.py SRC_DIR REPO_DIR
Card frames come on a dark backdrop (cut by flood fill from the border), the rest on magenta (keyed).
Prints the card frame geometry that css/style.css uses (section «Нарисованный интерфейс»)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from key import key, bbox

SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)

def save(im, name, q=82):
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, alpha_quality=88, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')

def cut_dark(path, thr=26):
    """dark backdrop -> transparent: flood from the border; small gaps in the gold rim are closed first"""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    B = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), 0)
    d = np.sqrt(((a - B) ** 2).sum(-1))
    m0 = Image.fromarray(np.where(d < thr, 255, 0).astype(np.uint8))
    m = m0.filter(ImageFilter.MinFilter(9)).copy()
    H, W = d.shape
    for x in range(0, W, 16):
        for y in (0, H - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, H, 16):
        for x in (0, W - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    f = Image.fromarray(((np.asarray(m) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    bg = (np.asarray(f) > 0) & (np.asarray(m0) > 0)
    al = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    out = im.convert('RGBA'); out.putalpha(al)
    return out

# Card frames. body: the card's own rectangle (the element box in CSS); protrusions (gem, lantern,
# bag, pointed bottom) hang outside it. Parts are in source pixels: gem centre+radius, title plate,
# art circle centre+radius, text box, type plate.
FRAMES = {
    'atk': dict(src='attack', body=(50, 38, 830, 1127), gem=(152, 112, 74), title=(238, 80, 696, 250),
                art=(440, 475, 190), text=(100, 708, 780, 1008), type=(278, 1018, 603, 1118)),
    'skill': dict(src='skill', body=(45, 22, 835, 1100), gem=(130, 100, 78), title=(222, 70, 786, 190),
                  art=(450, 452, 228), text=(170, 748, 770, 1022), type=(300, 1040, 580, 1100)),
    'charm': dict(src='charm', body=(30, 30, 850, 1135), gem=(125, 140, 64), title=(222, 95, 660, 190),
                  art=(440, 465, 208), text=(150, 714, 752, 966), type=(300, 1030, 580, 1100)),
    'status': dict(src='status', body=(120, 100, 786, 1072), gem=(152, 150, 78), title=(250, 135, 745, 280),
                   art=(452, 535, 220), text=(292, 792, 766, 994), type=(300, 1000, 600, 1060)),
}
BODY_W = 330  # output width of the card body in pixels

def pct(v, lo, size):
    return f'{(v - lo) / size * 100:.2f}%'

def frames():
    css = []
    for k, f in FRAMES.items():
        im = cut_dark(os.path.join(SRC, f'ui_card_frame_{f["src"]}.png'))
        bx = bbox(im, 40)
        c = im.crop(bx)
        s = BODY_W / (f['body'][2] - f['body'][0])
        c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
        save(c, f'f_{k}')
        x0, y0, x1, y1 = f['body']; W, H = x1 - x0, y1 - y0
        g = []
        # frame picture around the body
        g.append(f'--fl:{pct(bx[0], x0, W)};--ft:{pct(bx[1], y0, H)};--fw:{(bx[2] - bx[0]) / W * 100:.2f}%;--fh:{(bx[3] - bx[1]) / H * 100:.2f}%')
        cx, cy, r = f['gem']
        g.append(f'--gl:{pct(cx - r, x0, W)};--gt:{pct(cy - r, y0, H)};--gw:{2 * r / W * 100:.2f}%;--gh:{2 * r / H * 100:.2f}%')
        tx0, ty0, tx1, ty1 = f['title']
        g.append(f'--tl:{pct(tx0, x0, W)};--tt:{pct(ty0, y0, H)};--tw:{(tx1 - tx0) / W * 100:.2f}%;--th:{(ty1 - ty0) / H * 100:.2f}%')
        cx, cy, r = f['art']
        g.append(f'--al:{pct(cx - r, x0, W)};--at:{pct(cy - r, y0, H)};--aw:{2 * r / W * 100:.2f}%;--ah:{2 * r / H * 100:.2f}%')
        dx0, dy0, dx1, dy1 = f['text']
        g.append(f'--dl:{pct(dx0, x0, W)};--dt:{pct(dy0, y0, H)};--dw:{(dx1 - dx0) / W * 100:.2f}%;--dh:{(dy1 - dy0) / H * 100:.2f}%')
        px0, py0, px1, py1 = f['type']
        g.append(f'--yl:{pct((px0 + px1) / 2, x0, W)};--yt:{pct((py0 + py1) / 2, y0, H)}')
        css.append(f'#app.skin .card.{k} {{ {"; ".join(g)}; }}')
    print('\n'.join(css))

def plain(c, rows, cols, src):
    """hide a centre ornament: columns cols of rows are tiled from the plain columns src (same rows),
    so the piece can stretch sideways (CSS border-image) without a squashed lantern"""
    a = np.asarray(c).copy()
    (y0, y1), (x0, x1), (s0, s1) = rows, cols, src
    seg = a[y0:y1, s0:s1]
    for x in range(x0, x1, s1 - s0):
        w = min(s1 - s0, x1 - x)
        a[y0:y1, x:x + w] = seg[:, :w]
    return Image.fromarray(a, 'RGBA')

def mirror_top(c, mid):
    """rows above mid, then the same rows flipped: the sack and the lantern in the lower corners are gone
    and the text has the whole button"""
    a = np.asarray(c)[:mid]
    return Image.fromarray(np.concatenate([a, a[::-1]]), 'RGBA')

def magenta(name, out, width, q=82, plains=(), mirror=None):
    im = key(Image.open(os.path.join(SRC, f'ui_{name}.png')))
    c = im.crop(bbox(im, 40))
    c = c.resize((width, round(c.height * width / c.width)), Image.LANCZOS)
    for p in plains:
        c = plain(c, *p)
    if mirror:
        c = mirror_top(c, mirror)
    save(c, out, q)
    return c

def keyed(name, width):
    im = key(Image.open(os.path.join(SRC, f'ui_{name}.png')))
    c = im.crop(bbox(im, 40))
    return c.resize((width, round(c.height * width / c.width)), Image.LANCZOS)

def copy(c, dst, src):
    """paste the block at src (x, y) over dst (x0, y0, x1, y1): paints clean texture over an ornament or baked text"""
    a = np.asarray(c).copy()
    x0, y0, x1, y1 = dst; sx, sy = src
    a[y0:y1, x0:x1] = a[sy:sy + y1 - y0, sx:sx + x1 - x0]
    return Image.fromarray(a, 'RGBA')

def reflect(c, box, side):
    """paint paper over ornaments: box takes the mirror image of the block next to it across the given side,
    so the seam is continuous"""
    a = np.asarray(c).copy()
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0
    if side == 'top': m = a[y0 - h:y0, x0:x1][::-1]
    if side == 'bottom': m = a[y1:y1 + h, x0:x1][::-1]
    if side == 'left': m = a[y0:y1, x0 - w:x0][:, ::-1]
    if side == 'right': m = a[y0:y1, x1:x1 + w][:, ::-1]
    a[y0:y1, x0:x1] = m
    return Image.fromarray(a, 'RGBA')

def wood(c, box, sample, seed=7):
    """paint a flat dark board over baked text: the colour of the clean block sample, faint grain along the board, soft edges"""
    a = np.asarray(c).astype(np.float32)
    x0, y0, x1, y1 = box; sx0, sy0, sx1, sy1 = sample
    col = np.median(a[sy0:sy1, sx0:sx1, :3].reshape(-1, 3), 0)
    rng = np.random.default_rng(seed)
    grain = np.cumsum(rng.normal(0, 1.2, (y1 - y0, 1)), 0); grain -= grain.mean()
    tex = col + np.clip(grain, -6, 6)[..., None] + rng.normal(0, 1.5, (y1 - y0, x1 - x0, 1))
    m = Image.new('L', (c.width, c.height), 0)
    ImageDraw.Draw(m).rectangle((x0 + 3, y0 + 3, x1 - 4, y1 - 4), fill=255)
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)[y0:y1, x0:x1, None] / 255
    a[y0:y1, x0:x1, :3] = a[y0:y1, x0:x1, :3] * (1 - m) + tex * m
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def disc(c, cx, cy, r, color=None):
    """flat disc: hides a baked icon or face inside a round slot (colour: median of the disc's rim if not given)"""
    a = np.asarray(c).copy()
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    d = np.hypot(xx - cx, yy - cy)
    if color is None:
        color = np.median(a[(d > r - 3) & (d < r)][:, :3], 0)
    S = 4
    m = Image.new('L', (c.width * S, c.height * S), 0)
    ImageDraw.Draw(m).ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=255)
    m = np.asarray(m.resize(c.size, Image.LANCZOS)).astype(np.float32)[..., None] / 255
    a[..., :3] = (a[..., :3] * (1 - m) + np.array(color, np.float32) * m).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def scroll():
    """answer scroll: centre ornaments hidden, rod finials cut so that stacked scrolls do not overlap"""
    c = keyed('scroll_option', 720)
    c = plain(c, (0, 90), (240, 480), (150, 240))
    c = plain(c, (203, 260), (290, 430), (180, 290))
    save(c.crop((0, 57, 720, 238)), 'scroll')

def parch():
    """parchment panel: the curls in the lower corners lie on the paper where the last lines of text go;
    the lower band of the sheet is repainted with the mirror image of the band above it"""
    c = keyed('parchment_panel', 760)
    c = reflect(c, (36, 318, 724, 416), 'top')
    save(c, 'parch')

def herobar():
    """bottom bar: the baked face is hidden under a flat disc (the game puts the current hero there),
    the hood bobble above the ring is erased"""
    c = keyed('herobar', 800)
    a = np.asarray(c).copy()
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    out = (np.hypot(xx - 82, yy - 88) > 74) & (xx > 60) & (xx < 140) & (yy < 30)
    a[out, 3] = 0
    c = disc(Image.fromarray(a, 'RGBA'), 82, 85, 65, (24, 44, 58))
    save(c, 'herobar')

def topbar():
    """top bar: the baked title, progress slot, caption and the sack with its oval are painted over with one board,
    the round slots are emptied; the frame itself is left as drawn"""
    c = keyed('topbar', 800)
    c = plain(c, (145, c.height), (160, 280), (300, 420))    # the frame's bottom line under the sack
    a = np.asarray(c).astype(np.float32)
    x0, y0, x1, y1 = 160, 50, 536, 152
    col = np.median(a[62:96, 274:300, :3].reshape(-1, 3), 0)
    rng = np.random.default_rng(7)
    grain = np.cumsum(rng.normal(0, 1.2, (y1 - y0, 1)), 0); grain -= grain.mean()
    tex = col + np.clip(grain, -6, 6)[..., None] + rng.normal(0, 1.5, (y1 - y0, x1 - x0, 1))
    m = Image.new('L', (c.width, c.height), 0)
    d = ImageDraw.Draw(m)
    d.rectangle((166, 56, 276, 152), fill=255)    # the sack and its oval
    d.rectangle((270, 60, 529, 96), fill=255)     # title
    d.rectangle((270, 94, 541, 127), fill=255)    # progress slot
    d.rectangle((270, 125, 513, 152), fill=255)   # caption, short of the candle's curl
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255
    m[150:] = 0                                   # the frame's bottom line stays
    m *= np.clip((np.arange(c.width)[None, :] - 163) / 26, 0, 1)    # the board fades into the ring's panel
    m = m[y0:y1, x0:x1, None]
    a[y0:y1, x0:x1, :3] = a[y0:y1, x0:x1, :3] * (1 - m) + tex * m
    c = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    c = disc(c, 120, 100, 33)
    c = disc(c, 706, 99, 35)
    save(c, 'topbar')

def dark(name, out, width):
    im = cut_dark(os.path.join(SRC, f'ui_{name}.png'))
    c = im.crop(bbox(im, 40))
    c = c.resize((width, round(c.height * width / c.width)), Image.LANCZOS)
    save(c, out)
    return c

if __name__ == '__main__':
    frames()
    dark('card_back', 'back', 330)
    magenta('map_card_frame', 'mapcard', 300)
    # options and buttons stretch sideways: their top and bottom centre ornaments are hidden
    scroll()
    magenta('button_primary', 'btn_red', 480, plains=[((0, 44), (170, 305), (95, 170)), ((112, 150), (172, 300), (95, 172))])
    magenta('button_secondary', 'btn_dark', 480, plains=[((0, 32), (180, 300), (100, 180))], mirror=44)
    parch()
    herobar()
    topbar()
    magenta('speech_bubble', 'bubble', 520)
    magenta('panel_dark', 'panel', 720)
    # the same panel without the painted cross, for windows that close with their own button
    save(disc(keyed('panel_dark', 720), 668, 158, 25), 'panel_plain')
    magenta('achievement_tile', 'tile', 760)
    # list rows of any width: the same tile without the centre ornaments and the stamp slot
    magenta('achievement_tile', 'row', 760, plains=[((0, 52), (258, 484), (202, 258)), ((178, 212), (325, 430), (220, 325)), ((52, 178), (584, 708), (440, 564))])
        magenta('button_round', 'round', 132)
    for l in ('ru', 'en', 'uk'):
        magenta(f'logo_{l}', f'logo_{l}', 760)
