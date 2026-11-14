# Собирает игру для артефакта: CSS и JS внутри одной страницы, картинки рядом в assets/
import re, os, shutil, sys
root = '/home/user/mobile-game-card/'
pub = sys.argv[1]
os.makedirs(pub, exist_ok=True)
idx = open(root + 'index.html').read()
body = re.search(r'<div id="app">.*?\n  </div>', idx, re.S).group(0)
body = '\n'.join(l[2:] if l.startswith('  ') else l for l in body.split('\n'))
css = open(root + 'css/style.css').read()
order = re.findall(r'<script src="js/([^"]+)\.js"></script>', idx)
js = '\n'.join(open(root + f'js/{n}.js').read() for n in order)
html = f'''<title>Последний луч</title>
<meta name="theme-color" content="#1a1f30">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kurale&family=Neucha&display=swap" rel="stylesheet">
<style>
:root {{ color-scheme: dark; }}
{css}
</style>
{body}
<script>
{js}
</script>
'''
open(os.path.join(pub, 'fitil.html'), 'w').write(html)
src = root + 'assets'
n = 0
for d, _, fs in os.walk(src):
    for f in fs:
        if not f.endswith('.webp'): continue
        rel = os.path.relpath(os.path.join(d, f), src)
        dst = os.path.join(pub, 'assets', rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(os.path.join(d, f)):
            shutil.copy2(os.path.join(d, f), dst)
        n += 1
print('page', len(html), 'scripts', order, 'assets', n)
