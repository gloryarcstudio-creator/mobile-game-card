"""Музыка из готовых треков: ищет бесшовную петлю, сводит стык и пишет assets/m<N>/<имя>.mp3 и loops.json.

usage: python3 -I build_music.py SRC_DIR REPO_DIR [--scan] [имя ...]

Как устроен файл петли:
  [вступление 0..s] [петля s..s+P] [хвостик 0,5 с = начало петли ещё раз]
Игра играет файл с начала и крутит кусок s..s+P. Последние секунды петли плавно сведены
с тем, что звучало перед s, поэтому переход с конца на начало не слышен. Сведение кончается
чуть раньше конца петли, а после конца лежит повтор начала: сдвиг на десятки миллисекунд
при раскодировании mp3 в браузере стык не ломает.

Точку s и длину P скрипт выбирает сам: ищет два места трека, которые звучат одинаково
и до стыка, и после него. --scan только печатает кандидатов, чтобы выбрать вручную (PICK).
"""
import sys, os, json, subprocess
import numpy as np

SR = 48000          # частота файлов игры
ASR = 22050         # частота для анализа
HOP = 512           # шаг анализа: 23 мс
XFADE = 2.0         # длина сведения, с
GUARD = 0.08        # запас после сведения до конца петли, с
POST = 0.5          # повтор начала петли после её конца, с
BEFORE, AFTER = 2.6, 3.0   # окно сравнения вокруг стыка, с
TARGET_LUFS = -16.0
MDIR = 'm1'         # папка в assets; при замене файлов меняйте имя: опубликованная страница кеширует файлы по пути

# имя присланного файла -> имя дорожки в игре
MAP = {'music_title': 'title', 'music_stage1': 'stage1', 'music_stage2': 'stage2', 'music_night': 'night',
       'music_fight1': 'battle', 'music_fight2': 'battle2', 'music_stage_boss': 'boss', 'music_final_boss': 'final'}
# пределы поиска: начало петли не позже S_MAX, длина петли P_MIN..P_MAX, всего в файле не больше TOTAL
S_MAX, P_MIN, P_MAX, TOTAL = 40.0, 44.0, 100.0, 112.0
# ручной выбор (s, P) в секундах, если автоматический не подошёл
PICK = {
    'title': (27.91, 65.34),    # сходство 0.73: петля длиннее, чем у лучшего варианта (45 с при 0.76)
    'stage1': (22.06, 59.07),   # 0.72, удары совпадают на 0.62
    'stage2': (17.28, 52.41),   # 0.59
    'night': (36.22, 44.72),    # 0.75, ударов почти нет
    'battle': (36.01, 49.09),   # 0.73
    'battle2': (56.01, 49.53),  # 0.72: вариант с началом на 35 с давал только 0.59
    'boss': (2.93, 73.42),      # 0.51: лучший стык (0.66) начинался на 69 с, вступление бы пропало
    'final': (19.67, 62.88),    # 0.46: лучше в треке нет
}


def decode(path, sr, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-f', 'f32le', '-ac', str(ch), '-ar', str(sr), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def features(mono):
    """По кадру: 40 полос спектра (тембр и ритм) и 12 классов высоты (гармония), оба вектора единичной длины."""
    n_fft = 2048
    n = 1 + (len(mono) - n_fft) // HOP
    win = np.hanning(n_fft).astype(np.float32)
    spec = np.empty((n, n_fft // 2 + 1), np.float32)
    for a in range(0, n, 512):
        idx = np.arange(n_fft)[None, :] + HOP * np.arange(a, min(n, a + 512))[:, None]
        spec[a:a + 512] = np.abs(np.fft.rfft(mono[idx] * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(n_fft, 1 / ASR)
    edges = np.geomspace(55, 9000, 41)
    mel = np.stack([spec[:, (freqs >= lo) & (freqs < hi)].sum(1) for lo, hi in zip(edges[:-1], edges[1:])], 1)
    mel = np.log1p(mel * 50)
    mel -= mel.mean(0)
    sel = (freqs >= 70) & (freqs < 2200)
    pc = np.round(12 * np.log2(freqs[sel] / 440.0)).astype(int) % 12
    chroma = np.stack([spec[:, sel][:, pc == k].sum(1) for k in range(12)], 1)
    chroma = np.log1p(chroma * 50)
    chroma -= chroma.mean(1, keepdims=True)
    unit = lambda m: m / np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-9)
    rms = np.sqrt(np.maximum(spec.sum(1), 1e-12))
    return np.hstack([unit(mel), unit(chroma)]).astype(np.float32) / np.sqrt(2), rms


def active_span(rms):
    """Где трек звучит в полную силу: без тишины в начале и без затухания в конце."""
    db = 20 * np.log10(rms / np.median(rms))
    k = int(1.0 * ASR / HOP)
    sm = np.convolve(db, np.ones(k) / k, 'same')
    loud = np.where(sm > -14)[0]
    return loud[0], loud[-1]


def candidates(F, rms, top=8, s_max=None, total=None):
    fps = ASR / HOP
    nb, na = int(BEFORE * fps), int(AFTER * fps)
    first, last = active_span(rms)
    end = last - int(4.0 * fps)                 # последние секунды перед затуханием не берём
    i_min = max(first + nb, int((XFADE + 0.6) * fps))
    i_max = int((S_MAX if s_max is None else s_max) * fps)
    total = TOTAL if total is None else total
    allsc = []
    out = []
    for L in range(int(P_MIN * fps), int(P_MAX * fps)):
        hi = min(i_max, end - L - na, int(total * fps) - L)
        if hi <= i_min: break
        d = np.einsum('ij,ij->i', F[:-L], F[L:])
        c = np.concatenate([[0], np.cumsum(d)])
        i = np.arange(i_min, hi)
        sc = (c[i + na] - c[i - nb]) / (na + nb)
        j = int(np.argmax(sc)); allsc.append(sc[::8])
        out.append((float(sc[j]), int(i[j]), L))
    out.sort(reverse=True)
    picked = []
    for sc, i, L in out:                         # убираем соседей одного и того же пика
        if all(abs(L - l2) > fps * 0.4 or abs(i - i2) > fps * 2 for _, i2, l2 in picked):
            picked.append((sc, i, L))
        if len(picked) >= top: break
    ref = np.percentile(np.concatenate(allsc), [50, 99]) if allsc else (0, 0)
    return [(sc, i / fps, L / fps) for sc, i, L in picked], (first / fps, last / fps), ref


def refine(mono, s, P):
    """Уточняет длину петли до отсчёта: сдвигает второе место так, чтобы удары совпали с первым."""
    M = int(0.09 * SR)
    a0, a1 = s - int(BEFORE * SR), s + int(AFTER * SR)
    dec = 24                                     # огибающая с шагом 0,5 мс

    def envelope(x):
        e = np.abs(np.diff(x, prepend=x[0]))
        k = int(0.004 * SR)
        e = np.convolve(e, np.ones(k) / k, 'same')
        return e[::dec] - e[::dec].mean()
    A = envelope(mono[a0:a1])
    best = (-2, 0)
    Bfull = mono[a0 + P - M:a1 + P + M]
    for sh in range(-M, M + 1, dec):
        B = envelope(Bfull[M + sh:M + sh + (a1 - a0)])
        r = float(A @ B / (np.linalg.norm(A) * np.linalg.norm(B) + 1e-12))
        if r > best[0]: best = (r, sh)
    r_env, sh = best
    # точная подгонка по самой волне (низкие частоты), если два места совпадают и по фазе
    k = 8
    lp = lambda x: np.convolve(x, np.ones(k) / k, 'same')[::4]
    A2 = lp(mono[a0:a1]); A2 = A2 - A2.mean()
    best2 = (-2, sh)
    for d in range(sh - 2 * dec, sh + 2 * dec + 1, 4):
        B2 = lp(mono[a0 + P + d:a1 + P + d]); B2 = B2 - B2.mean()
        r = float(A2 @ B2 / (np.linalg.norm(A2) * np.linalg.norm(B2) + 1e-12))
        if r > best2[0]: best2 = (r, d)
    r_wave, d = best2
    if r_wave >= 0.35: sh = d
    elif r_env < 0.3: sh = 0                   # без ясных ударов сдвиг ненадёжен: остаёмся на сетке анализа
    return P + sh, r_env, r_wave


def render(st, s, P):
    """Собирает файл петли из стерео-трека: вступление, петля со сведённым концом, повтор начала."""
    X, G, R = int(XFADE * SR), int(GUARD * SR), int(POST * SR)
    mono = st.mean(1)
    lead = int(np.argmax(np.abs(mono) > 10 ** (-50 / 20)))
    lead = max(0, lead - int(0.02 * SR))
    out = st[lead:s + P].copy()
    a = len(out) - G - X                         # начало сведения внутри out
    tail, pre = out[a:a + X], st[s - G - X:s - G]
    r = float(np.clip(np.corrcoef(tail.mean(1), pre.mean(1))[0, 1], 0, 1))
    th = np.linspace(0, np.pi / 2, X, dtype=np.float32)[:, None]
    norm = 1 / np.sqrt(1 + r * np.sin(2 * th))   # ровная громкость и для похожих, и для непохожих кусков
    out[a:a + X] = (tail * np.cos(th) + pre * np.sin(th)) * norm
    out[a + X:] = st[s - G:s]
    fi = int(0.01 * SR)
    out[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    full = np.vstack([out, st[s:s + R]])
    return full, (s - lead) / SR, (s + P - lead) / SR, r


def loudness(pcm):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], input=pcm.tobytes(), capture_output=True)
    txt = p.stderr.decode('utf8', 'replace').split('Summary:')[-1]
    I = float(txt.split('I:')[1].split('LUFS')[0])
    peak = float(txt.split('Peak:')[1].split('dBFS')[0])
    return I, peak


def seam_report(full, ls, le):
    """Насколько гладок переход с конца петли на начало: скачок на стыке против обычных скачков в треке."""
    a, b = int(round(ls * SR)), int(round(le * SR))
    m = full.mean(1)
    jump = abs(float(m[a] - m[b - 1]))
    typical = float(np.percentile(np.abs(np.diff(m[a:b])), 99))
    return jump, typical


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    scan = '--scan' in sys.argv
    src, repo, only = args[0], args[1], set(args[2:])
    outdir = os.path.join(repo, 'assets', MDIR)
    os.makedirs(outdir, exist_ok=True)
    meta_path = os.path.join(outdir, 'loops.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for fname, name in MAP.items():
        if only and name not in only and fname not in only: continue
        path = os.path.join(src, fname + '.mp3')
        if not os.path.exists(path): print(name, 'нет файла', path); continue
        mono_a = decode(path, ASR, 1)[:, 0]
        F, rms = features(mono_a)
        cands, span, ref = candidates(F, rms)
        print(f'== {name}: {len(mono_a) / ASR:.1f} с, звучит {span[0]:.1f}..{span[1]:.1f} с; сходство случайных мест {ref[0]:.2f}, лучший 1% от {ref[1]:.2f}')
        for sc, s, P in cands: print(f'   сходство {sc:.3f}  начало {s:6.2f}  длина {P:6.2f}  конец {s + P:6.2f}')
        if scan:
            wide, _, _ = candidates(F, rms, top=6, s_max=1e9, total=1e9)
            m48 = decode(path, SR, 1)[:, 0]
            for sc, s, P in wide:
                P2, r_env, r_wave = refine(m48, int(round(s * SR)), int(round(P * SR)))
                print(f'   без вступления: сходство {sc:.3f}  начало {s:6.2f}  длина {P:6.2f}  конец {s + P:6.2f}  удары r={r_env:.2f} волна r={r_wave:.2f}')
            for sc, s, P in cands[:4]:
                P2, r_env, r_wave = refine(m48, int(round(s * SR)), int(round(P * SR)))
                print(f'   с вступлением {s:6.2f}+{P:6.2f}: удары r={r_env:.2f} волна r={r_wave:.2f} сдвиг {(P2 - int(round(P * SR))) / SR * 1000:+.1f} мс')
            continue
        s_sec, P_sec = PICK.get(name) or (cands[0][1], cands[0][2])
        st = decode(path, SR, 2)
        s, P = int(round(s_sec * SR)), int(round(P_sec * SR))
        P, r_env, r_wave = refine(st.mean(1), s, P)
        full, ls, le, r = render(st, s, P)
        I, peak = loudness(full)
        gain = min(TARGET_LUFS - I, -1.0 - peak)
        jump, typical = seam_report(full, ls, le)
        dst = os.path.join(outdir, name + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', f'volume={gain:.2f}dB',
                        '-c:a', 'libmp3lame', '-q:a', '5', '-map_metadata', '-1', dst], input=full.tobytes(), check=True)
        meta[name] = [round(ls, 4), round(le, 4)]
        print(f'   петля {ls:.3f}..{le:.3f} с (длина {le - ls:.3f}), удары r={r_env:.2f}, волна r={r_wave:.2f}, сведение r={r:.2f}, '
              f'громкость {I:.1f} LUFS, пик {peak:.1f}, усиление {gain:+.1f} дБ, стык {jump:.4f} при обычном {typical:.4f}, '
              f'файл {len(full) / SR:.1f} с, {os.path.getsize(dst) / 1e6:.2f} МБ')
    if not scan:
        json.dump(meta, open(meta_path, 'w'), indent=1, sort_keys=True)
        print('loops.json', meta)


if __name__ == '__main__':
    main()
