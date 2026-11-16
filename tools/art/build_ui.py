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
    magenta('scroll_option', 'scroll', 720, plains=[((0, 90), (240, 480), (150, 240)), ((203, 260), (290, 430), (180, 290))])
    magenta('button_primary', 'btn_red', 480, plains=[((0, 44), (170, 305), (95, 170)), ((112, 150), (172, 300), (95, 172))])
    magenta('button_secondary', 'btn_dark', 480, plains=[((0, 32), (180, 300), (100, 180))], mirror=44)
    magenta('parchment_panel', 'parch', 760)
    magenta('speech_bubble', 'bubble', 520)
    magenta('panel_dark', 'panel', 720)
    magenta('achievement_tile', 'tile', 760)
    magenta('energy_orb', 'orb', 180)
    magenta('button_round', 'round', 132)
    for l in ('ru', 'en', 'uk'):
        magenta(f'logo_{l}', f'logo_{l}', 760)
