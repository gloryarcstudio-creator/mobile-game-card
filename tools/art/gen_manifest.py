"""Scan assets/ and write js/assets.js (window.ASSETS manifest).
usage: python3 -I gen_manifest.py REPO_DIR"""
import sys, os, json, time, re
from PIL import Image
import numpy as np

REPO = sys.argv[1]
A = os.path.join(REPO, 'assets')
build = json.load(open(os.path.join(A, '_build.json')))

def names(d, suffix='.webp', strip=''):
    p = os.path.join(A, d)
    if not os.path.isdir(p): return []
    return sorted(f[:-len(suffix)][len(strip):] for f in os.listdir(p) if f.endswith(suffix) and f.startswith(strip))

hero = [n for n in names('h') if not n.endswith('_face')]
face = [n[:-5] for n in names('h') if n.endswith('_face')]
EA = sorted(d for d in os.listdir(A) if re.fullmatch(r'ea\d*', d))[-1] if any(re.fullmatch(r'ea\d*', d) for d in os.listdir(A)) else 'ea'
anim = {}
for k, v in build.items():
    kind, cid = k.split(':', 1)
    if kind == 'anim' and isinstance(v, list):
        meta = v[1]
        if os.path.exists(os.path.join(A, EA, f'{cid}_idle.webp')):
            at = Image.open(os.path.join(A, EA, f'{cid}_idle.webp'))
            meta['iw'], meta['ih'] = at.size
        if os.path.exists(os.path.join(A, EA, f'{cid}_act.webp')):
            at = Image.open(os.path.join(A, EA, f'{cid}_act.webp'))
            meta['aw'], meta['ah'] = at.size
        meta.pop('bg', None)
        anim[cid] = meta

# bottom colour of each background, used to extend the ground below the picture
bgc = {}
for n in names('bg'):
    im = np.asarray(Image.open(os.path.join(A, 'bg', n + '.webp')).convert('RGB')).astype(float)
    c = im[-12:].reshape(-1, 3).mean(0)
    bgc[n] = '#%02x%02x%02x' % tuple(int(x) for x in c)

# where the feet are: lowest opaque row of each enemy picture, as a fraction of its height.
# The game shifts the picture down by the empty strip below the feet so enemies stand on the ground.
foot = {}
for n in names('e'):
    al = np.asarray(Image.open(os.path.join(A, 'e', n + '.webp')).convert('RGBA'))[..., 3] > 40
    rows = np.where(al.any(1))[0]
    if len(rows): foot[n] = round((rows[-1] + 1) / al.shape[0], 3)

M = {
    'hero': hero, 'face': face,
    'enemy': names('e'), 'foot': foot, 'anim': anim,
    'relic': names('r'), 'card': names('c'), 'st': names('st'),
    'intent': names('it'), 'icon': names('i'),
    'bg': names('bg'), 'bgc': bgc, 'pic': names('pic'), 'ea': EA,
}
js = '/* Сгенерировано gen_manifest.py: какие нарисованные картинки есть в assets/ */\nwindow.ASSETS = ' + json.dumps(M, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(REPO, 'js', 'assets.js'), 'w').write(js)
print('assets.js', len(js), 'bytes;', {k: len(v) for k, v in M.items() if isinstance(v, (list, dict))})
