# Режет пакеты нарисованных эффектов на небольшие файлы, чтобы на телефонной сети они не занимали
# канал надолго и картинки экрана успевали приходить между ними.
# Вход: новейшая папка assets/fx<N> (её пишет build_fx.py), выход: assets/fx<N+1> с тем же index.json,
# но с другим списком files и смещениями. Первыми идут ролики, нужные с первого боя.
#   python3 -I tools/art/split_fx.py [размер пакета в КБ, по умолчанию 900]
import base64, json, os, re, sys
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(REPO, 'assets')
LIMIT = int(sys.argv[1]) * 1000 if len(sys.argv) > 1 else 900_000
dirs = [d for d in sorted(os.listdir(A), key=lambda d: (len(d), d)) if re.fullmatch(r'fx\d+', d) and os.path.exists(os.path.join(A, d, 'index.json'))]
src = dirs[-1]; dst = 'fx%d' % (int(src[2:]) + 1)
idx = json.load(open(os.path.join(A, src, 'index.json')))
texts = [open(os.path.join(A, f)).read() for f in idx['files']]
def raw(name):
    f, off, ln, _ = idx['clips'][name]
    a = off // 3 * 4
    return base64.b64decode(texts[f][a:a + -(-ln // 3) * 4])[:ln]
FIRST = ['bonk', 'shield', 'claw', 'lantern', 'sparks', 'fire', 'flamelet_p', 'flamelet', 'slash', 'heavy', 'heal', 'gold',
         'burnApply', 'weak', 'vuln', 'energy', 'cards', 'coin_p', 'coin', 'letter_p', 'letter', 'deliver_p', 'bite_p', 'bite', 'growl', 'aura']
order = [n for n in FIRST if n in idx['clips']] + [n for n in idx['clips'] if n not in FIRST]
packs = [[]]; size = 0
for n in order:
    ln = idx['clips'][n][2]
    if packs[-1] and size + ln > LIMIT: packs.append([]); size = 0
    packs[-1].append(n); size += ln
os.makedirs(os.path.join(A, dst), exist_ok=True)
clips = {}; files = []
for i, names in enumerate(packs):
    buf = bytearray()
    for n in names:
        b = raw(n)
        clips[n] = [i, len(buf), len(b), idx['clips'][n][3]]
        buf += b + b'\0' * (-len(b) % 3)   # каждый ролик начинается на границе четырёх букв base64
    rel = f'{dst}/p{i}.txt'; files.append(rel)
    open(os.path.join(A, rel), 'w').write(base64.b64encode(bytes(buf)).decode())
    print(rel, len(names), 'роликов', round(len(buf) * 4 / 3 / 1000), 'КБ:', ' '.join(names))
out = dict(idx); out['files'] = files; out['clips'] = {n: clips[n] for n in idx['clips']}
json.dump(out, open(os.path.join(A, dst, 'index.json'), 'w'))
# проверка: каждый ролик байт в байт тот же
t2 = [open(os.path.join(A, f)).read() for f in files]
for n, (f, off, ln, _) in out['clips'].items():
    a = off // 3 * 4
    assert base64.b64decode(t2[f][a:a + -(-ln // 3) * 4])[:ln] == raw(n), n
print('готово:', dst, len(files), 'файлов; старую папку', src, 'можно удалить')
