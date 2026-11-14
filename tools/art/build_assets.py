"""Turn the Higgsfield deliveries into game-ready webp assets + js/assets.js manifest.
usage: python3 -I build_assets.py SRC_DIR REPO_DIR [only-prefix ...]
"""
import sys, os, json, subprocess, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from multiprocessing import Pool
from key import key, bbox, fit, bg_color

SRC, REPO = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3:]
OUT = os.path.join(REPO, 'assets')
REDO = set(open(os.path.join(os.path.dirname(SRC.rstrip('/')), 'redo_ids.txt')).read().split()) if os.path.exists(os.path.join(os.path.dirname(SRC.rstrip('/')), 'redo_ids.txt')) else set()

def save(im, rel, q=80, aq=80):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, alpha_quality=aq, method=6)
    return rel

def src(name):
    return os.path.join(SRC, name)

def have(name):
    return os.path.exists(src(name)) and name.rsplit('.', 1)[0] not in REDO

# ---------- stills ----------
def still_square(name, rel, size, anchor='center', pad=0.03, trim=True, q=80):
    im = key(Image.open(src(name)))
    if trim:
        im = fit(im, size, pad=pad, anchor=anchor)
    else:
        im = im.resize((size, size), Image.LANCZOS)
    return save(im, rel, q)

def hero_sprite(look):
    im = key(Image.open(src(f'{look}_sprite.png')))
    bx = bbox(im)
    c = im.crop(bx)
    W, H = 400, 540
    s = min(W * 0.96 / c.width, H * 0.97 / c.height)
    c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    can.alpha_composite(c, ((W - c.width) // 2, H - c.height - 4))
    return save(can, f'h/{look}.webp')

def hero_face(look):
    im = Image.open(src(f'{look}_portrait.png')).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    # bust touches the bottom edge: estimate bg from top + side borders only
    b = np.concatenate([a[0], a[:, 0][: a.shape[0] // 2], a[:, -1][: a.shape[0] // 2]])
    B = np.median(b, 0)
    k = key(im, bg=B)
    k = k.resize((256, 256), Image.LANCZOS)
    return save(k, f'h/{look}_face.webp')

def card(cid):
    im = Image.open(src(f'card_{cid}.png')).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    # medallion: find the disc against the dark square bg
    B = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), 0)
    d = np.sqrt(((a - B) ** 2).sum(-1))
    m = d > 18
    ys, xs = np.where(m)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = min(xs.max() - xs.min(), ys.max() - ys.min()) / 2
    r *= 0.965  # drop the outer rim pixels
    box = (int(cx - r), int(cy - r), int(cx + r), int(cy + r))
    c = im.crop(box).resize((256, 256), Image.LANCZOS)
    S = 1024
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse((4, 4, S - 4, S - 4), fill=255)
    mask = mask.resize((256, 256), Image.LANCZOS)
    c.putalpha(mask)
    return save(c, f'c/{cid}.webp', 80)

def flat(name, rel, w, q=74):
    im = Image.open(src(name)).convert('RGB')
    h = round(im.height * w / im.width)
    return save(im.resize((w, h), Image.LANCZOS), rel, q)

# ---------- animations ----------
def vframes(path, size):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={size}:{size}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, size, size, 3)

def energy(fr):
    small = fr[:, ::8, ::8].astype(np.float32)
    return np.abs(small - small[0]).mean((1, 2, 3))

def pick(lo, hi, n):
    return [int(round(x)) for x in np.linspace(lo, hi, n)]

FS = 320       # frame size in atlases
COLS = 8
ANIMS = {
    # name: (n frames, fps, mode)
    'idle': (25, 8, 'loop'),
    'attack': (14, 14, 'active'),
    'hurt': (9, 15, 'hurt'),
    'death': (14, 13, 'active'),
}

def keyed_frames(path, idx, B=None):
    fr = vframes(path, 640)
    if B is None:
        B = bg_color(fr[0].astype(np.float32))
    out = []
    for i in idx:
        k = key(Image.fromarray(fr[i]), bg=B)
        out.append(k.resize((FS, FS), Image.LANCZOS))
    return out, fr, B

def select(fr, mode, n):
    N = len(fr)
    if mode == 'loop':
        # drop the duplicated closing frame so the loop does not stutter
        return pick(0, N - 1 - (N - 1) / n, n)
    e = energy(fr)
    act = np.where(e > 1.2)[0]
    s = max(0, (act[0] - 2) if len(act) else 0)
    if mode == 'hurt':
        end = min(N - 1, s + 42)
        return pick(s, end, n)
    return pick(s, N - 1, n)

def atlas(frames):
    rows = (len(frames) + COLS - 1) // COLS
    at = Image.new('RGBA', (COLS * FS, rows * FS), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        at.alpha_composite(f, ((i % COLS) * FS, (i // COLS) * FS))
    return at

def char_anim(cid, sets=('idle', 'attack', 'hurt', 'death'), alt=None):
    """build idle atlas + action atlas for one character. alt maps anim -> source anim name."""
    meta = {'fs': FS, 'cols': COLS}
    alt = alt or {}
    idle_frames = None
    act_frames, act_meta = [], {}
    B = None
    for an in sets:
        name = alt.get(an, an)
        path = src(f'{cid}_{name}.mp4')
        if not os.path.exists(path):
            continue
        n, fps, mode = ANIMS.get(an, (14, 14, 'active'))
        fr = vframes(path, 640)
        if B is None:
            B = bg_color(fr[0].astype(np.float32))
        idx = select(fr, mode, n)
        frames = [key(Image.fromarray(fr[i]), bg=B).resize((FS, FS), Image.LANCZOS) for i in idx]
        if an == 'death':
            # fade the remains out over the last frames
            for j in range(1, 6):
                f = frames[-j]
                a = np.asarray(f).copy()
                a[..., 3] = (a[..., 3] * (j - 1) / 5).astype(np.uint8)
                frames[-j] = Image.fromarray(a, 'RGBA')
        if an == 'idle':
            idle_frames = frames
            meta['idle'] = {'n': len(frames), 'fps': fps}
        else:
            act_meta[an] = {'o': len(act_frames), 'n': len(frames), 'fps': fps}
            act_frames += frames
    if idle_frames:
        save(atlas(idle_frames), f'ea/{cid}_idle.webp', 76, 70)
    if act_frames:
        save(atlas(act_frames), f'ea/{cid}_act.webp', 76, 70)
        meta['act'] = act_meta
    meta['bg'] = [round(float(x)) for x in B] if B is not None else None
    return cid, meta

# ---------- job list ----------
def jobs():
    J = []
    names = set(os.listdir(SRC))
    looks = ['lamp', 'courier', 'guard', 'stoker', 'baker', 'grinder', 'shepherd', 'herbalist']
    for l in looks:
        if f'{l}_sprite.png' in names: J.append(('hero', l))
        if f'{l}_portrait.png' in names: J.append(('face', l))
    for n in sorted(names):
        b = n.rsplit('.', 1)[0]
        if b in REDO: continue
        if n.endswith('_sprite.png') and b[:-7] not in looks:
            J.append(('enemy', b[:-7]))
        elif n.startswith('relic_') and n.endswith('.png'):
            J.append(('relic', b[6:]))
        elif n.startswith('card_') and n.endswith('.png'):
            J.append(('card', b[5:]))
        elif n.startswith('st_') and n.endswith('.png'):
            J.append(('st', b[3:]))
        elif n.startswith('intent_') and n.endswith('.png'):
            J.append(('intent', b[7:]))
        elif n.startswith('icon_') and n.endswith('.png'):
            J.append(('icon', b[5:]))
        elif n.startswith(('bg_', 'scene_')) and n.endswith('.png'):
            J.append(('bg', b))
        elif n.startswith(('ev_', 'story_', 'ending_')) and n.endswith('.png'):
            J.append(('pic', b))
        elif n.endswith('_idle.mp4') and not n.startswith('anim_') and b[:-5] not in looks:
            J.append(('anim', b[:-5]))
    if ONLY:
        J = [j for j in J if j[0] in ONLY or j[1] in ONLY]
    return J

def run(j):
    kind, k = j
    try:
        if kind == 'hero': return j, hero_sprite(k)
        if kind == 'face': return j, hero_face(k)
        if kind == 'enemy': return j, still_square(f'{k}_sprite.png', f'e/{k}.webp', 384, trim=False, q=80)
        if kind == 'relic': return j, still_square(f'relic_{k}.png', f'r/{k}.webp', 192, pad=0.02)
        if kind == 'card': return j, card(k)
        if kind == 'st': return j, still_square(f'st_{k}.png', f'st/{k}.webp', 128, pad=0.02)
        if kind == 'intent': return j, still_square(f'intent_{k}.png', f'it/{k}.webp', 128, pad=0.02)
        if kind == 'icon': return j, still_square(f'icon_{k}.png', f'i/{k}.webp', 192, pad=0.02)
        if kind == 'bg': return j, flat(f'{k}.png', f'bg/{k}.webp', 752, 72)
        if kind == 'pic': return j, flat(f'{k}.png', f'pic/{k}.webp', 800, 76)
        if kind == 'anim':
            if k == 'hedgehog':
                return j, char_anim(k, ('idle', 'happy'), {})
            return j, char_anim(k)
    except Exception as ex:
        return j, 'ERR ' + repr(ex)

if __name__ == '__main__':
    J = jobs()
    print(len(J), 'jobs', flush=True)
    # heavy anim jobs first so the pool stays busy
    J.sort(key=lambda j: j[0] != 'anim')
    res = {}
    with Pool(4) as p:
        for j, r in p.imap_unordered(run, J):
            res[f'{j[0]}:{j[1]}'] = r
            if isinstance(r, str) and r.startswith('ERR'): print(j, r, flush=True)
    json.dump(res, open(os.path.join(OUT, '_build.json'), 'w'), indent=1)
    print('done', len(res))
