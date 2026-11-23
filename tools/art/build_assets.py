"""Turn the Higgsfield deliveries into game-ready webp assets + js/assets.js manifest.
usage: python3 -I build_assets.py SRC_DIR REPO_DIR [only-prefix ...]
"""
import sys, os, json, subprocess, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from multiprocessing import Pool
from key import key, bbox, fit, bg_color, body_palette, key_fx, key_screen, key_fade, figure_tint
from calm import CALM, DESPILL, calm_idle, despill

SRC, REPO = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3:]
OUT = os.path.join(REPO, 'assets')
_OLD = json.load(open(os.path.join(OUT, '_build.json'))) if os.environ.get('MOVES_ONLY') == '1' and os.path.exists(os.path.join(OUT, '_build.json')) else {}
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
EA_DIR = 'ea6'
COLS = 8
# idle: whole 3 s loop at 12 fps (the game blends neighbouring frames, so it reads as smooth).
# One-shot moves start and end in the rest pose: forward to the strongest pose, then the same
# frames backwards. Their frames are spaced evenly along the path of motion (arc_pick), so no step
# between two frames is a big jump of the pose.
IDLE_N, IDLE_FPS = 36, 12
# Restless idles (hopping, flapping) whose clips really hold 24 different pictures a second keep every
# frame: 72 frames at 24 fps, in <id>_rest.webp (a new name: published pages cache files by path).
HI_IDLE = {'snowimp', 'snowbrute', 'firecracker', 'magpie'}
# name: (frames forward to the strongest pose, ticks back to rest, ticks per second).
# Only the forward frames take room in the atlas: attack 22 + hurt 10 fill exactly four rows of eight.
# The tick rate sets the pace: the blow lands 0.58 s after the start, as the fight code expects.
MOVES = {
    'attack': (22, 13, 36), 'hurt': (10, 6, 36), 'happy': (16, 10, 30),
}
# MOVES_ONLY=1 rebuilds only the move atlases (<id>_mv.webp); idle and death keep their files and records
MOVES_ONLY = os.environ.get('MOVES_ONLY') == '1'
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

def select_idle(fr, n=IDLE_N):
    N = len(fr)
    # drop the duplicated closing frame so the loop does not stutter
    return pick(0, N - 1 - (N - 1) / n, n)

def arc_pick(d, n):
    """n positions out of len(d)+1 frames, spaced evenly along the path of motion.
    d[i] is how much the picture changes from frame i to i+1. Slow stretches are passed quickly,
    quick ones keep every frame, so the pose never jumps between two neighbouring picks."""
    m = len(d) + 1
    if m <= n: return list(range(m))
    w = d + 0.35 * d.mean() + 1e-6   # a still stretch also takes some time
    cum = np.concatenate([[0], np.cumsum(w)])
    idx = [int(np.argmin(np.abs(cum - t))) for t in np.linspace(0, cum[-1], n)]
    for k in range(1, n): idx[k] = max(idx[k], idx[k - 1] + 1)
    idx[-1] = min(idx[-1], m - 1)
    for k in range(n - 2, -1, -1): idx[k] = min(idx[k], idx[k + 1] - 1)
    return idx

def unique_frames(small, g):
    """the clips often hold one picture for two frames (12 pictures a second inside a 24 fps file):
    keep one frame of each such pair, so that every stored frame is a new pose"""
    if len(g) < 3: return g
    d = np.array([np.abs(small[g[i + 1]] - small[g[i]]).mean() for i in range(len(g) - 1)])
    out = [g[0]]
    for i in range(len(d)):
        ref = np.percentile(d[max(0, i - 4): i + 5], 75)
        if d[i] < 0.4 * ref and d[i] < 8: continue   # the same picture again
        out.append(g[i + 1])
    return out

def select_move(fr, an):
    """source frames of a one-shot move, the tick sequence that plays them and the tick of the strongest pose"""
    N = len(fr)
    nf, nb = MOVES[an][:2]
    e = energy(fr)
    ok = ~flashes(fr)
    act = np.where((e > 1.2) & ok)[0]
    s = max(0, (act[0] - 2) if len(act) else 0)
    small = fr[:, ::8, ::8].astype(np.float32)
    good = unique_frames(small, [i for i in range(s, N) if ok[i]] or list(range(s, N)))
    motion = lambda g: np.array([np.abs(small[g[i + 1]] - small[g[i]]).mean() for i in range(len(g) - 1)])
    if an == 'hurt' and len(good) > 6:
        # a hit must answer at once: drop the slow lead-in, start one frame before the body really moves
        m = motion(good)
        quick = np.where(m > 0.3 * np.percentile(m, 90))[0]
        if len(quick) and len(good) - quick[0] > 5: good = good[max(0, quick[0] - 1):]
    if e[good[-1]] < 5:
        # already comes back to rest by itself: plays out fully
        idx = [good[p] for p in arc_pick(motion(good), nf + nb)]
        return idx, list(range(len(idx))), int(np.argmax([e[i] for i in idx]))
    # strongest pose within the first 80% of the clip
    lim = good[: max(2, int(len(good) * 0.8))]
    pk = lim[int(np.argmax([e[i] for i in lim]))]
    fw = [i for i in good if i <= pk]
    idx = [fw[p] for p in arc_pick(motion(fw), nf)]
    n = len(idx)
    after = [i for i in good if i > pk]
    if an == 'hurt' and n <= 5 and len(after) >= 4:
        # The blow itself is often hidden by a white burst, so only a few frames lead up to the recoil.
        # Then the clip's own recovery plays on: from the recoil to its calmest frame, real motion
        # instead of the same two or three frames run backwards. The game dissolves the rest into idle.
        ea = np.array([e[i] for i in after])
        j = int(np.argmin(ea))
        if j >= 3 and ea[j] < 0.7 * e[pk]:
            rec = [pk] + after[: j + 1]
            idx += [rec[p] for p in arc_pick(motion(rec), nf - n + 1)[1:]]
            return idx, list(range(len(idx))), n - 1
    # back to the rest pose over the same frames; the last tick is the rest frame itself
    back = [int(round(x)) for x in np.linspace(n - 1, 0, nb + 1)][1:]
    if n - 1 <= nb // 2: back = list(range(n - 2, -1, -1))   # a very short move: no frame is held twice
    return idx, list(range(n)) + back, n - 1

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
    old = _OLD.get(f'anim:{cid}') if MOVES_ONLY else None
    old = old[1] if isinstance(old, list) else {}
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
        if MOVES_ONLY and an in ('idle', 'death'):
            # the palette for the keyer comes from the idle clip; the files and records stay as they are
            if an == 'idle' and 'idle' in old: meta['idle'] = old['idle']
            if an == 'death' and 'death' in old.get('act', {}): act_meta[an] = old['act']['death']
            continue
        if an == 'death':
            frames, seq, peak = select_death(fr, B, keyer)
            save(atlas(frames), f'{EA_DIR}/{cid}_die.webp', 76, 70)
            act_meta[an] = {'f': 'die', 'o': 0, 'n': len(frames), 'fps': DEATH_FPS, 'hit': peak, 'seq': seq}
            continue
        if an == 'idle':
            idx, seq, peak = select_idle(fr, len(fr) - 1 if cid in HI_IDLE else IDLE_N), None, 0
        else:
            idx, seq, peak = select_move(fr, an)
        kf = (lambda im: key(im, bg=B)) if an == 'idle' else (lambda im: keyer(im, B))
        frames = [kf(Image.fromarray(fr[i])).resize((FS, FS), Image.LANCZOS) for i in idx]
        if an == 'idle':
            # vapour that kept a pink tint turns white; loops that drip are rebuilt from one breathing frame
            if cid in DESPILL: frames = [despill(f) for f in frames]
            if cid in CALM: frames = calm_idle(frames[0], **CALM[cid])
            idle_frames = frames
            meta['idle'] = {'n': len(frames), 'fps': IDLE_FPS}
            if cid in HI_IDLE: meta['idle'] = {'n': len(frames), 'fps': 24, 'f': 'rest'}
        else:
            act_meta[an] = {'f': 'mv', 'o': len(act_frames), 'n': len(frames), 'fps': MOVES[an][2], 'hit': peak, 'seq': seq}
            act_frames += frames
    if idle_frames:
        part = meta['idle'].get('f', 'idle')
        save(atlas(idle_frames), f'{EA_DIR}/{cid}_{part}.webp', 76, 70)
        stale = os.path.join(OUT, EA_DIR, f'{cid}_idle.webp')
        if part != 'idle' and os.path.exists(stale): os.remove(stale)
    if act_frames:
        save(atlas(act_frames), f'{EA_DIR}/{cid}_mv.webp', 76, 70)
        stale = os.path.join(OUT, EA_DIR, f'{cid}_act.webp')   # the earlier, sparser atlas
        if os.path.exists(stale): os.remove(stale)
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
        if kind == 'relic': return j, still_square(f'relic_{k}.png', f'r/{k}.webp', 192, pad=0.02)  # в игре стоят картинки из r2: их собирает build_relics.py
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
    bad = lambda r: isinstance(r, str) and r.startswith('ERR')
    for k, r in res.items():
        if bad(r) and k in old and not bad(old[k]): continue   # a failed job keeps the earlier good record
        old[k] = r
    json.dump(old, open(bj, 'w'), indent=1)
    print('done', len(res))
