"""Turn the Higgsfield deliveries into game-ready webp assets + js/assets.js manifest.
usage: python3 -I build_assets.py SRC_DIR REPO_DIR [only-prefix ...]
"""
import sys, os, json, subprocess, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from multiprocessing import Pool
from key import key, bbox, fit, bg_color, body_palette, key_fx, key_screen, key_fade, figure_tint

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
# atlas folder; bump the number when atlases are rebuilt, so browsers do not mix old cached files with new frame counts
EA_DIR = 'ea4'
COLS = 8
# idle: whole 3 s loop at 12 fps. One-shot moves are cut so they start and end in
# the rest pose (forward to the strongest pose, then back), so no cross-fade is needed.
IDLE_N, IDLE_FPS = 36, 12
MOVES = {
    # name: (frames forward, frames back, fps)
    'attack': (9, 5, 16),
    'hurt': (5, 3, 16),
    'happy': (10, 5, 14),
}
# dark heroes and the moth are violet by design: their moves keep the plain key everywhere,
# their deaths switch to the screen key only while the body fades into the backdrop (it turned pink)
PLAIN_KEY = ('dk_', 'moth')
# the fog maiden's own lavender would shield her purple fog: her moves use the screen key everywhere
SCREEN_KEY = ('mist',)
# death: only the action itself, at the clip's own 24 fps, at most 40 ticks (1.7 s), in its own atlas
DEATH_TICKS, DEATH_FPS = 40, 24

def flashes(fr):
    """frames that flash white or lose the magenta backdrop (impact bursts look odd once keyed)"""
    small = fr[:, ::8, ::8].astype(np.int16)
    white = (small.min(-1) > 225).mean((1, 2))
    base = np.median(white[:5])
    B = bg_color(fr[0].astype(np.float32))
    h, w = small.shape[1:3]; r = max(2, h // 12)
    ring = np.ones((h, w), bool); ring[r:-r, r:-r] = False
    off = np.sqrt(((small - B) ** 2).sum(-1)) > 70
    lost = off[:, ring].mean(1) > 0.45
    return (white > base * 2 + 0.01) | lost

def select_idle(fr):
    N = len(fr)
    # drop the duplicated closing frame so the loop does not stutter
    return pick(0, N - 1 - (N - 1) / IDLE_N, IDLE_N)

def select_move(fr, an):
    """indices for a one-shot move and the index (in the result) of its strongest pose"""
    N = len(fr)
    nf, nb, _ = MOVES.get(an, (10, 5, 14))
    e = energy(fr)
    ok = ~flashes(fr)
    act = np.where((e > 1.2) & ok)[0]
    s = max(0, (act[0] - 2) if len(act) else 0)
    good = [i for i in range(s, N) if ok[i]] or list(range(s, N))
    if an == 'death' or e[good[-1]] < 5:
        # plays out fully (death) or already comes back to rest by itself
        idx = [good[int(round(x))] for x in np.linspace(0, len(good) - 1, nf + nb)]
        peak = int(np.argmax([e[i] for i in idx]))
        return idx, peak
    # strongest pose within the first 80% of the clip
    lim = good[: max(2, int(len(good) * 0.8))]
    pk = lim[int(np.argmax([e[i] for i in lim]))]
    fw = [i for i in good if i <= pk]
    fwd = [fw[int(round(x))] for x in np.linspace(0, len(fw) - 1, min(nf, len(fw)))]
    back = [fw[int(round(x))] for x in np.linspace(len(fw) - 1, 0, nb + 2)][1:-1]
    return fwd + back, len(fwd) - 1

def lost_backdrop(f, B):
    """one frame: the magenta backdrop is gone from the border (a full-screen burst)"""
    small = f[::8, ::8].astype(np.int16)
    h, w = small.shape[:2]; r = max(2, h // 12)
    ring = np.ones((h, w), bool); ring[r:-r, r:-r] = False
    off = np.sqrt(((small - B) ** 2).sum(-1)) > 70
    return off[ring].mean() > 0.45

def edge_mask(n):
    r = np.clip(np.minimum(np.arange(n), np.arange(n)[::-1]) / (n * 0.07), 0, 1)
    return np.minimum.outer(r, r)

def clean_death(im, mult):
    a = np.asarray(im).copy()
    al = a[..., 3].astype(np.float32)
    al[al < 56] = 0                      # faint leftovers of the backdrop (showed as grey boxes)
    al *= edge_mask(al.shape[0]) * mult  # no hard lines where pieces fly out of the frame; fade at the end
    a[..., 3] = al.astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def select_death(fr, B0, keyer=None):
    """unique frames, the tick sequence (DEATH_FPS) that plays them, and the tick of the strongest motion.
    Skips the calm lead-in, keeps steam, snow and sparks (no flash filter), stops when the remains settle
    or vanish, keys every frame against its own backdrop (the light changes during bursts)."""
    N = len(fr)
    Bs = []
    for f in fr:
        b = bg_color(f.astype(np.float32))
        Bs.append(b if np.linalg.norm(b - B0) < 60 else B0)
    small = fr[:, ::8, ::8].astype(np.float32)
    d = np.r_[0, np.abs(np.diff(small, axis=0)).mean((1, 2, 3))]
    ds = np.convolve(d, np.ones(5) / 5, 'same')
    lost = np.array([lost_backdrop(f, b) for f, b in zip(fr, Bs)])
    big = np.where(ds > ds.max() * 0.35)[0]
    st = max(0, (big[0] if len(big) else 0) - 6)
    cov = np.array([(np.sqrt(((s_ - b) ** 2).sum(-1)) > 60).mean() for s_, b in zip(small, Bs)])
    c0 = cov[:st + 1].mean() or 1
    act = np.where(ds > ds[st:].max() * 0.12)[0]
    en = min(N - 1, (act[-1] + 4) if len(act) else N - 1)
    gone = [i for i in range(st + 6, N) if cov[i] < c0 * 0.06]
    if gone: en = min(en, gone[0] + 3)
    src = list(range(st, en + 1))
    if len(src) > DEATH_TICKS:
        src = [src[int(round(x))] for x in np.linspace(0, len(src) - 1, DEATH_TICKS)]
    # a run of bursts at the very end is cut (the remains fade before it);
    # a burst frame in the middle is replaced by the previous good one
    while len(src) > 8 and lost[src[-1]]: src.pop()
    for k in range(len(src)):
        if lost[src[k]] and k: src[k] = src[k - 1]
    # the clips often repeat each frame twice: store a frame once, play it twice
    uniq, seq = [], []
    for i in src:
        if uniq and (i == uniq[-1] or np.abs(small[i] - small[uniq[-1]]).mean() < 1.2):
            seq.append(len(uniq) - 1)
        else:
            uniq.append(i); seq.append(len(uniq) - 1)
    T = len(seq); fade = min(8, max(4, T // 5))
    mult = {}
    for k, u in enumerate(seq):
        mult[u] = min(1, (T - 1 - k) / fade)
    keyer = keyer or (lambda im, bg: key(im, bg=bg))
    frames = [clean_death(keyer(Image.fromarray(fr[i]), Bs[i]).resize((FS, FS), Image.LANCZOS), mult[u]) for u, i in enumerate(uniq)]
    peak = int(np.argmax([ds[i] for i in src]))
    return frames, seq, peak

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
    pal = None
    for an in sets:
        name = alt.get(an, an)
        path = src(f'{cid}_{name}.mp4')
        if not os.path.exists(path):
            continue
        fr = vframes(path, 640)
        if B is None:
            B = bg_color(fr[0].astype(np.float32))
        if an == 'idle':
            pal = body_palette(fr[::4], B)
        # moves and deaths: smoke and sparks lose the magenta tint, the body keeps its colours
        if cid in SCREEN_KEY: keyer = lambda im, bg: key_screen(im, bg)
        elif cid.startswith(PLAIN_KEY) or pal is None: keyer = lambda im, bg: key(im, bg=bg)
        else: keyer = lambda im, bg, p=pal: key_fx(im, bg, p)
        if an == 'death' and cid.startswith(PLAIN_KEY):
            # the usual share while the body is solid: first 60% of the clip, upper quartile
            base = float(np.percentile([figure_tint(f, B) for f in fr[: max(5, int(len(fr) * 0.6))]], 75))
            keyer = lambda im, bg, b0=base: key_fade(im, bg, b0)
        if an == 'death':
            frames, seq, peak = select_death(fr, B, keyer)
            save(atlas(frames), f'{EA_DIR}/{cid}_die.webp', 76, 70)
            act_meta[an] = {'f': 'die', 'o': 0, 'n': len(frames), 'fps': DEATH_FPS, 'hit': peak, 'seq': seq}
            continue
        if an == 'idle':
            idx, peak = select_idle(fr), 0
        else:
            idx, peak = select_move(fr, an)
        kf = (lambda im: key(im, bg=B)) if an == 'idle' else (lambda im: keyer(im, B))
        frames = [kf(Image.fromarray(fr[i])).resize((FS, FS), Image.LANCZOS) for i in idx]
        if an == 'idle':
            idle_frames = frames
            meta['idle'] = {'n': len(frames), 'fps': IDLE_FPS}
        else:
            act_meta[an] = {'o': len(act_frames), 'n': len(frames), 'fps': MOVES.get(an, (0, 0, 14))[2], 'hit': peak}
            act_frames += frames
    if idle_frames:
        save(atlas(idle_frames), f'{EA_DIR}/{cid}_idle.webp', 76, 70)
    if act_frames:
        save(atlas(act_frames), f'{EA_DIR}/{cid}_act.webp', 76, 70)
    if act_meta:
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
    # a filtered run keeps the records of everything it did not rebuild
    bj = os.path.join(OUT, '_build.json')
    old = json.load(open(bj)) if ONLY and os.path.exists(bj) else {}
    old.update(res)
    json.dump(old, open(bj, 'w'), indent=1)
    print('done', len(res))
