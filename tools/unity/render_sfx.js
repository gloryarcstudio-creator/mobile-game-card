#!/usr/bin/env node
/* Звуки веб-версии для Unity.
   node tools/unity/render_sfx.js [OUT]   (по умолчанию unity/Assets/Fitil/Resources/Audio/Sfx)

   В веб-версии звуки синтезируются на лету (SFX в js/audio.js). Здесь тот же код играет каждый звук
   в OfflineAudioContext в Chromium (через всю цепочку: шина звуков, реверберация, компрессор),
   и результат пишется в OGG: <имя>.ogg. Хвост тишины обрезается. Нужны Playwright и ffmpeg.
   Звуки поменялись в js/audio.js — запустите заново и закоммитьте файлы. */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'unity', 'Assets', 'Fitil', 'Resources', 'Audio', 'Sfx'));
const SR = 44100;
const SECONDS = 6;

async function main() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8');
  const names = [...src.slice(src.indexOf('const SFX = {'), src.indexOf('function sfx(name')).matchAll(/^\s{4}([a-z0-9]+)\(t/gm)].map((m) => m[1]);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('about:blank');
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-'));
  const report = [];
  for (const name of names) {
    const pcm = await p.evaluate(async ({ src, name, SR, SECONDS }) => {
      window.AudioContext = function AC() { return new OfflineAudioContext(2, SR * SECONDS, SR); };
      // свежая копия audio.js: у каждого звука свой контекст
      new Function(src)();
      window.Sound.unlock();
      window.Sound.sfx(name);
      const buf = await window.Sound._probe().ctx.startRendering();
      const l = buf.getChannelData(0); const r = buf.getChannelData(1);
      // конец звука: последний отсчёт громче −60 дБ, плюс 50 мс на затухание
      let end = l.length - 1;
      while (end > 0 && Math.abs(l[end]) < 0.001 && Math.abs(r[end]) < 0.001) end--;
      end = Math.min(l.length, end + Math.round(SR * 0.05));
      const out = new Int16Array(end * 2);
      let peak = 0;
      for (let i = 0; i < end; i++) {
        const fade = i > end - SR * 0.05 ? (end - i) / (SR * 0.05) : 1;
        const a = Math.max(-1, Math.min(1, l[i] * fade)); const c = Math.max(-1, Math.min(1, r[i] * fade));
        peak = Math.max(peak, Math.abs(a), Math.abs(c));
        out[i * 2] = a * 32767; out[i * 2 + 1] = c * 32767;
      }
      let s = ''; const bytes = new Uint8Array(out.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { b64: btoa(s), frames: end, peak };
    }, { src, name, SR, SECONDS });
    const raw = Buffer.from(pcm.b64, 'base64');
    const wav = path.join(tmp, `${name}.wav`);
    fs.writeFileSync(wav, Buffer.concat([wavHeader(raw.length), raw]));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '5', path.join(OUT, `${name}.ogg`)]);
    report.push(`${name} ${(pcm.frames / SR).toFixed(2)} с, пик ${(20 * Math.log10(pcm.peak || 1e-9)).toFixed(1)} дБ`);
  }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`звуков: ${names.length} -> ${OUT}`);
  console.log(report.join('\n'));
}

function wavHeader(n) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(n, 40);
  return h;
}

main().catch((e) => { console.error(e); process.exit(1); });
