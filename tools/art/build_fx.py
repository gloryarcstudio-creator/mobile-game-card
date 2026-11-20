"""Painted effect clips for js/fx.js (hits, fire, bites, statuses).
usage: python3 -I tools/art/build_fx.py SRC REPO [--preview DIR] [clip ...]

SRC holds fx_<kind>.mp4 (73 frames, 24 fps, on black or on magenta) and fx_<kind>_sheet.png
(8 frames in a row). Every clip becomes one small atlas (FS px frames, COLS in a row, transparent
background), cut tightly around everything the clip shows. All atlases go one after another into
a few text files assets/fx<N>/p<i>.txt (base64): the artifact holds at most 511 files, so 57
separate pictures would not fit, and it serves no plain binary files. index.json lists the file,
offset, length and frame count of each clip; gen_manifest.py copies it into ASSETS.fx and the game
decodes a clip when its effect is first needed. Changed pictures need a new folder (bump DIR): the
published page caches files by path.

Glowing effects are painted on black: brightness becomes opacity and the colour is brought to full
brightness, so a glow never darkens a snowy background. Solid inked effects are painted on magenta
and keyed like the characters. With clip names only those are rebuilt for the preview; the pack is
written only by a full run."""
import base64, sys, os, json, subprocess, io
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from key import bg_color, key, key_screen

args = sys.argv[1:]
PREVIEW = None
if '--preview' in args:
    i = args.index('--preview'); PREVIEW = args[i + 1]; del args[i:i + 2]
SRC, REPO = args[0], args[1]
ONLY = args[2:]

FS, COLS = 200, 5      # frame size and columns of a clip atlas
WORK = 720             # frames are keyed at this size, then reduced
DIR = 'fx5'            # bump when clips change: published pages cache files by path. After building run
                       # tools/art/split_fx.py: it cuts the packs into ~1 MB files in the next folder (fx6); then delete this one

def V(kind, **o): return dict(src=kind, sheet=False, **o)
def S(kind, **o): return dict(src=kind, sheet=True, **o)

# name of the clip in the game: where it comes from and how it is cut.
#   a, b   first and last source frame (default: the whole visible part)
#   n      frames kept (default 16)
#   fade   last frames that fade out (default 3); head = first frames that fade in
#   soft   a round patch: the picture fades towards the rim over this share of the radius (rain, snow streaks)
#   one    a single still (projectiles): the content is centred and enlarged to `fill` of the frame
#   mode   magenta clips: 'screen' reads translucent smoke and glow correctly, 'plain' keeps pink and violet paint
#   k      frames drawn in a sheet; left = frames are aligned by their left edge (the jaws stay in place while dust flies)
CLIPS = {
    'lantern': V('lantern'), 'bonk': V('bonk'), 'heavy': V('heavy', b=47, fade=5), 'slash': V('slash'), 'sparks': V('sparks'),
    'fire': V('fire', base=True, a=0, b=60, n=20, head=2, fade=5, floor=4.0),
    'snow': S('snow'),
    'snowball_p': V('snowball', a=10, one=True, fill=0.6), 'snowball': V('snowball', a=24, b=70, fade=4),
    'blizzard': V('blizzard', soft=0.55), 'avalanche': S('avalanche', base=True),
    'icicle_p': V('icicle', a=14, one=True, fill=0.9), 'icicle': V('icicle', a=24, fade=4),
    'shatter': S('shatter'),
    'stamp': S('stamp', base=True, fade=2),
    'letter_p': V('letter', a=20, one=True, fill=0.9), 'letter': V('letter', a=42, b=70, n=14),
    'starfall': V('starfall'), 'beam': V('beam', base=True), 'roots': V('roots', base=True, fade=4),
    'coin_p': V('coin', a=0, b=22, n=8, centre=True, fade=0), 'coin': V('coin', a=34, b=66, fade=4),
    'flour': V('flour', fade=5), 'confetti': V('confetti'), 'crumbs': V('crumbs'),
    'ink': V('ink', b=45, fade=5, mode='plain'), 'spikes': V('spikes', b=58, fade=4),
    'flash': S('flash'), 'shield': V('shield'), 'heal': S('heal', base=True), 'heart': V('heart'),
    'flamelet_p': V('flamelet', a=44, one=True, fill=0.8), 'flamelet': V('flamelet', a=30, b=66, n=12),
    'burnApply': V('burnApply', base=True), 'weak': S('weak'), 'vuln': S('vuln', mode='screen', fade=2), 'frost': V('frost'), 'sleep': V('sleep'),
    'energy': V('energy'), 'aura': V('aura'), 'thorns': V('thorns', b=62, fade=4), 'gold': V('gold', base=True, b=58, fade=4),
    'deliver_p': V('deliver', a=40, one=True, fill=0.9),
    'sigil': V('sigil'), 'clock': S('clock'), 'mirror': V('mirror'), 'cards': S('cards', k=7),
    'ginger': V('ginger'), 'sugar': S('sugar'), 'grind': V('grind'), 'growl': V('growl'),
    'bite_p': S('bite', k=7, pick=0, fill=0.86), 'bite': S('bite', k=7, take=(1, 5), anchor=2, fade=1), 'price': V('price', b=62, fade=4), 'claw': V('claw'),
    'notes': V('notes'), 'steam': V('steam'), 'wind': V('wind'),
}

def vframes(path, size):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={size}:{size}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, size, size, 3)

# ---------- mattes ----------
def glow_matte(a):
    """picture on black -> RGBA: brightness is opacity, colour goes to full brightness"""
    f = a.astype(np.float32) / 255
    m = f.max(-1)
    m2 = np.clip((m - 0.04) / 0.96, 0, 1)
    al = np.clip(1.25 * m2 ** 0.7, 0, 1)
    C = np.where(m[..., None] > 0.02, f / np.maximum(m, 1e-3)[..., None], 0)
    return np.dstack([C * 255, al * 255]).astype(np.uint8)

def magenta_matte(a, B, mode):
    im = Image.fromarray(a)
    out = np.asarray(key_screen(im, B) if mode == 'screen' else key(im, bg=B)).copy()
    al = out[..., 3].astype(np.float32)
    al[al < 26] = 0                       # faint leftovers of the backdrop
    out[..., 3] = al
    return out

def matte(a, B, mode):
    return glow_matte(a) if B.max() < 60 else magenta_matte(a, B, mode)

def resize(rgba, size):
    """reduce with premultiplied colour, so transparent pixels do not leak a fringe"""
    return np.asarray(Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA'))

def bbox(al, thr=40):
    ys, xs = np.where(al > thr)
    if not len(xs): return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def recentre(rgba, fill=None):
    """content to the middle of the frame; with fill it is also enlarged to that share of the frame.
    The soft glow around the content is kept: only the solid part counts for the size."""
    bx = bbox(rgba[..., 3])
    if bx is None: return rgba
    x0, y0, x1, y1 = bx; S_ = rgba.shape[0]
    s = fill * S_ / max(x1 - x0, y1 - y0) if fill else 1.0
    im = Image.fromarray(rgba, 'RGBA').convert('RGBa')
    if fill: im = im.resize((max(1, round(S_ * s)),) * 2, Image.LANCZOS)
    cx, cy = (x0 + x1) / 2 * s, (y0 + y1) / 2 * s
    can = Image.new('RGBa', (S_, S_), (0, 0, 0, 0))
    can.paste(im, (round(S_ / 2 - cx), round(S_ / 2 - cy)))
    return np.asarray(can.convert('RGBA'))

def soften(rgba, share):
    """a round patch: the picture fades towards the rim of the circle inscribed in its frame, from 1 - share of the radius"""
    n = rgba.shape[0]; c = (n - 1) / 2
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.sqrt((x - c) ** 2 + (y - c) ** 2) / (n / 2 * (1 - PAD))
    t = np.clip((1 - r) / share, 0, 1); t = t * t * (3 - 2 * t)
    out = rgba.copy(); out[..., 3] = (out[..., 3].astype(np.float32) * t).astype(np.uint8)
    return out

def feather(rgba, share=0.07):
    """the picture fades out at the very edge of its frame, so a cut glow or streak leaves no straight line"""
    n = rgba.shape[0]; w = max(1, int(n * share))
    r = np.minimum(np.arange(n), np.arange(n)[::-1]).astype(np.float32)
    t = np.clip((r + 0.5) / w, 0, 1); t = t * t * (3 - 2 * t)
    out = rgba.copy()
    out[..., 3] = (out[..., 3].astype(np.float32) * np.minimum.outer(t, t)).astype(np.uint8)
    return out

# ---------- frame choice ----------
def unique(small, g):
    """clips often hold one picture for two frames: keep one of each pair"""
    if len(g) < 3: return g
    d = np.array([np.abs(small[g[i + 1]] - small[g[i]]).mean() for i in range(len(g) - 1)])
    out = [g[0]]
    for i in range(len(d)):
        ref = np.percentile(d[max(0, i - 4): i + 5], 75)
        if d[i] < 0.4 * ref and d[i] < 8: continue
        out.append(g[i + 1])
    return out

def spaced(d, n, floor):
    """n of len(d)+1 frames: partly even in time, partly even along the change of the picture.
    A burst opens in two or three frames; taken evenly in time it would jump, so the quick part keeps more frames."""
    m = len(d) + 1
    if m <= n: return list(range(m))
    w = d + floor * d.mean() + 1e-6
    cum = np.concatenate([[0], np.cumsum(w)])
    idx = [int(np.argmin(np.abs(cum - t))) for t in np.linspace(0, cum[-1], n)]
    for k in range(1, n): idx[k] = max(idx[k], idx[k - 1] + 1)
    idx[-1] = min(idx[-1], m - 1)
    for k in range(n - 2, -1, -1): idx[k] = min(idx[k], idx[k + 1] - 1)
    return idx

def video_clip(c):
    fr = vframes(os.path.join(SRC, f"fx_{c['src']}.mp4"), WORK)
    B = bg_color(fr[0].astype(np.float32))
    black = B.max() < 60
    small = fr[:, ::9, ::9].astype(np.float32)
    act = small.max(-1).mean((1, 2)) if black else np.clip(np.sqrt(((small - B) ** 2).sum(-1)) - 40, 0, None).mean((1, 2))
    live = np.where(act > 0.06 * act.max())[0]
    a = c.get('a', int(live[0])); b = c.get('b', int(live[-1]))
    mode = c.get('mode', 'screen')
    if c.get('one'):
        return [resize(recentre(matte(fr[a], B, mode), c.get('fill', 0.8)), FS)], dict(src=[a])
    g = unique(small, list(range(a, b + 1)))
    d = np.array([np.abs(small[g[i + 1]] - small[g[i]]).mean() for i in range(len(g) - 1)])
    idx = [g[p] for p in spaced(d, c.get('n', 16), c.get('floor', 1.0))]
    frames = [matte(fr[i], B, mode) for i in idx]
    if c.get('centre'): frames = [recentre(f) for f in frames]
    frames = tight(frames, c.get('base', False))
    return [resize(f, FS) for f in frames], dict(src=idx, side=frames[0].shape[0])

PAD = 0.08   # empty margin around the content, as a share of the frame; a clip with base=True stands on the line 1 - PAD

def tight(frames, base=False):
    """every frame cut to one square around all that the clip ever shows: the picture fills its frame
    and stays where it was, so nothing jitters. With base the lowest point sits on the same line in every clip."""
    union = np.max([f[..., 3] for f in frames], 0)
    bx = bbox(union, 40)
    if bx is None: return frames
    x0, y0, x1, y1 = bx; S_ = union.shape[0]
    side = int(round(max(x1 - x0, y1 - y0) / (1 - 2 * PAD)))
    left = int(round((x0 + x1) / 2 - side / 2))
    top = int(round(y1 + side * PAD - side)) if base else int(round((y0 + y1) / 2 - side / 2))
    out = []
    for f in frames:
        can = np.zeros((side, side, 4), np.uint8)
        sx0, sy0 = max(left, 0), max(top, 0); sx1, sy1 = min(left + side, S_), min(top + side, S_)
        can[sy0 - top: sy1 - top, sx0 - left: sx1 - left] = f[sy0:sy1, sx0:sx1]
        out.append(can)
    return out

def sheet_clip(c):
    im = np.asarray(Image.open(os.path.join(SRC, f"fx_{c['src']}_sheet.png")).convert('RGB'))
    B = np.median(im[:8].reshape(-1, 3), 0).astype(np.float32)
    rgba = matte(im, B, c.get('mode', 'plain'))
    al = rgba[..., 3].astype(np.float32)
    H, W = al.shape
    k = c.get('k', 8)
    mass = al.sum(0)
    xs = np.arange(W)
    cen = (np.arange(k) + 0.5) * W / k
    for _ in range(30):                     # 1-D k-means of the columns, weighted by how much paint they hold
        own = np.argmin(np.abs(xs[:, None] - cen[None]), 1)
        new = np.array([(xs[own == j] * mass[own == j]).sum() / max(mass[own == j].sum(), 1e-6) if mass[own == j].sum() > 0 else cen[j] for j in range(k)])
        if np.abs(new - cen).max() < 0.2: break
        cen = new
    own = np.argmin(np.abs(xs[:, None] - cen[None]), 1)
    rows = np.where(al.max(1) > 40)[0]
    y0, y1 = rows[0], rows[-1] + 1
    spans = []
    for j in range(k):
        cols = np.where((own == j) & (al.max(0) > 40))[0]
        spans.append((cols[0], cols[-1] + 1) if len(cols) else (int(cen[j]), int(cen[j]) + 1))
    pick = c.get('pick')
    if pick is not None:                     # one drawing of the sheet as a still picture (a projectile)
        x0, x1 = spans[pick]
        part = rgba[y0:y1, x0:x1].copy(); part[:, own[x0:x1] != pick, 3] = 0
        sq = int(max(x1 - x0, y1 - y0) * 1.4)
        can = np.zeros((sq, sq, 4), np.uint8)
        can[(sq - (y1 - y0)) // 2:][:y1 - y0, (sq - (x1 - x0)) // 2:][:, :x1 - x0] = part
        return [resize(recentre(can, c.get('fill', 0.85)), FS)], dict(src=[int(cen[pick])])
    use = list(range(*c.get('take', (0, k))))
    an = c.get('anchor')
    if an is not None:
        # frames keep their left edge in one place, and the drawing `an` sits in the middle of the frame:
        # what the other frames add (a burst, dust) spreads from it
        wa = spans[an][1] - spans[an][0]
        half = max(max(wa / 2, (spans[j][1] - spans[j][0]) - wa / 2) for j in use)
        side = int(max(2 * half, y1 - y0) / (1 - 2 * PAD))
    else:
        side = int(max(max(spans[j][1] - spans[j][0] for j in use), y1 - y0) / (1 - 2 * PAD))
    frames = []
    for j, (x0, x1) in enumerate(spans):
        if j not in use: continue
        part = rgba.copy()
        part[:, own != j, 3] = 0             # nothing from the neighbouring frame
        can = np.zeros((side, side, 4), np.uint8)
        # where this frame sits in its square: by its left edge, or by its centre
        ox = (side // 2 - wa // 2 - x0 if an is not None else (side - max(spans[i][1] - spans[i][0] for i in use)) // 2 - x0 if c.get('left') else side // 2 - (x0 + x1) // 2)
        oy = side - int(side * PAD) - y1 if c.get('base') else side // 2 - (y0 + y1) // 2
        sx0, sx1 = max(x0, -ox), min(x1, side - ox)
        sy0, sy1 = max(y0, -oy), min(y1, side - oy)
        can[sy0 + oy: sy1 + oy, sx0 + ox: sx1 + ox] = part[sy0:sy1, sx0:sx1]
        frames.append(resize(can, FS))
    return frames, dict(src=[int(cen[j]) for j in use], side=side, spans=[spans[j][1] - spans[j][0] for j in use])

def build(name):
    c = CLIPS[name]
    frames, info = (sheet_clip if c['sheet'] else video_clip)(c)
    frames = [f.copy() for f in frames]
    n = len(frames)
    fade = 0 if c.get('one') or c.get('pick') is not None else c.get('fade', 0 if c['sheet'] else 3)
    for i in range(min(fade, n - 1)):        # the tail fades out
        f = frames[n - 1 - i]; f[..., 3] = (f[..., 3].astype(np.float32) * (i + 1) / (fade + 1)).astype(np.uint8)
    frames = [feather(f) for f in frames]
    if c.get('soft'): frames = [soften(f, c['soft']) for f in frames]
    for i in range(min(c.get('head', 0), n - 1)):
        f = frames[i]; f[..., 3] = (f[..., 3].astype(np.float32) * (i + 1) / (c['head'] + 1)).astype(np.uint8)
    return frames, info

def atlas(frames):
    rows = (len(frames) + COLS - 1) // COLS
    at = Image.new('RGBA', (COLS * FS, rows * FS), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        at.paste(Image.fromarray(f, 'RGBA'), ((i % COLS) * FS, (i // COLS) * FS))
    return at

def preview(built, out):
    """every clip over a dark and over a snowy background: what the key left behind shows at once"""
    os.makedirs(out, exist_ok=True)
    T, PER = 80, 8
    names = list(built)
    for page in range(0, len(names), PER):
        ks = names[page:page + PER]
        sheet = Image.new('RGB', (20 * T, len(ks) * 2 * T), (60, 60, 60))
        for r, k in enumerate(ks):
            for row, bgc in enumerate(((27, 34, 56), (222, 232, 242))):
                for i, f in enumerate(built[k][:20]):
                    tile = Image.new('RGBA', (T, T), bgc + (255,))
                    tile.alpha_composite(Image.fromarray(f, 'RGBA').resize((T, T), Image.LANCZOS))
                    sheet.paste(tile.convert('RGB'), (i * T, (r * 2 + row) * T))
        sheet.save(os.path.join(out, f'fx_preview_{page // PER}.png'))
        print('preview', page // PER, ks, flush=True)

if __name__ == '__main__':
    names = [n for n in CLIPS if not ONLY or n in ONLY]
    built = {}
    for n in names:
        built[n], info = build(n)
        print(n, len(built[n]), 'frames', info['src'], flush=True)
    if PREVIEW: preview(built, PREVIEW)
    if not ONLY:
        out = os.path.join(REPO, 'assets', DIR)
        os.makedirs(out, exist_ok=True)
        # Pictures travel as text (base64): a published page serves only usual web types, and a plain binary pack is not one.
        # Every clip starts on a multiple of 3 bytes, that is on a multiple of 4 letters, so the game cuts one clip out of the text.
        data = {}
        for n in names:
            buf = io.BytesIO()
            atlas(built[n]).save(buf, 'WEBP', quality=80, alpha_quality=85, method=6)
            data[n] = buf.getvalue()
        total = sum(len(v) for v in data.values())
        parts = max(1, -(-total // 4_500_000))
        packs = [bytearray()]; index = {}
        for n in names:
            if len(packs) < parts and len(packs[-1]) >= total / parts: packs.append(bytearray())
            index[n] = [len(packs) - 1, len(packs[-1]), len(data[n]), len(built[n])]
            packs[-1] += data[n] + b'\0' * (-len(data[n]) % 3)
        for old in os.listdir(out):
            os.remove(os.path.join(out, old))
        files = []
        for i, b in enumerate(packs):
            files.append(f'{DIR}/p{i}.txt')
            open(os.path.join(REPO, 'assets', files[-1]), 'w').write(base64.b64encode(bytes(b)).decode())
        json.dump({'files': files, 'fs': FS, 'cols': COLS, 'pad': PAD, 'clips': index}, open(os.path.join(out, 'index.json'), 'w'))
        blob = b''.join(packs)
        print('packs', [len(b) // 1024 for b in packs], 'KB,', len(index), 'clips')
