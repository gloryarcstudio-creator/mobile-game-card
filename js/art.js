/* Фитиль — процедурная SVG-графика.
   Всё рисуется кодом, чтобы прототип не зависел от внешних ассетов.
   Стиль: толстый тёмный контур, плоские цвета, мягкие тени, ночная палитра. */
(function () {
  const O = '#17121f'; // цвет контура
  const sw = (w) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  function svg(vb, body, cls = '') {
    return `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  /* ---------- Цвет: смешивание палитр неба ---------- */
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mixC = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  /* Палитра неба между двумя ключевыми кадрами: числа смешиваются линейно, цвета по каналам */
  function mixSky(from, to, t) {
    const out = {};
    for (const k of Object.keys(from)) {
      const a = from[k], b = to[k] === undefined ? a : to[k];
      out[k] = typeof a === 'number' ? a + (b - a) * t : typeof a === 'string' && a[0] === '#' ? mixC(a, b, t) : (t < 0.5 ? a : b);
    }
    return out;
  }

  /* Палитра в точке пути t (0..1) по списку ключевых кадров [[t, палитра], ...] */
  function sampleSky(keys, t) {
    if (keys.length === 1 || t <= keys[0][0]) return mixSky(keys[0][1], keys[0][1], 0);
    for (let i = 1; i < keys.length; i++) {
      const [t1, p1] = keys[i];
      const [t0, p0] = keys[i - 1];
      if (t <= t1) return mixSky(p0, p1, (t - t0) / (t1 - t0 || 1));
    }
    const last = keys[keys.length - 1][1];
    return mixSky(last, last, 0);
  }

  /* Ёлка из трёх ярусов со снежными шапками */
  function pine(x, y, h, fill, snow) {
    const w = h * 0.55;
    let g = `<rect x="${x - h * 0.04}" y="${y - h * 0.12}" width="${h * 0.08}" height="${h * 0.12}" fill="${fill}" stroke="${O}" stroke-width="2.5"/>`;
    for (let i = 0; i < 3; i++) {
      const top = y - h + i * h * 0.26, bot = y - h * 0.1 - (2 - i) * h * 0.2, ww = w * (0.5 + i * 0.25);
      g += `<path d="M${x} ${top} L${x + ww / 2} ${bot} L${x - ww / 2} ${bot}z" fill="${fill}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
      g += `<path d="M${x} ${top} L${x + ww * 0.2} ${top + (bot - top) * 0.4} Q${x} ${top + (bot - top) * 0.5} ${x - ww * 0.2} ${top + (bot - top) * 0.4}z" fill="${snow}"/>`;
    }
    return g;
  }

  /* Окраина: ёлки, дорога и дом адресата, который приближается с каждым шагом (approach 0..1) */
  function outskirts(p, approach) {
    const sc = 0.45 + approach * 0.85;
    const hy = 512 + approach * 62;
    const lit = p.lampGlow > 0.5;
    const lamp = (x) => `<g transform="translate(${x},0)">
        ${lit ? `<circle cx="0" cy="512" r="34" fill="url(#lampGlow)" opacity="${p.lampGlow}"/>` : ''}
        <rect x="-2" y="515" width="4" height="80" fill="${p.ink}"/>
        <path d="M-9 500 h18 l-3 16 h-12z" fill="${lit ? '#ffcf6b' : p.lampOff}" stroke="${p.ink}" stroke-width="2"/>
        <path d="M-11 500 h22 l-11 -8z" fill="${p.ink}"/></g>`;
    return `
      ${pine(40, 520, 90, p.spires, p.roofHi)}${pine(352, 515, 80, p.spires, p.roofHi)}${pine(300, 522, 60, p.spires, p.roofHi)}
      <!-- дом адресата -->
      <g transform="translate(200 ${hy}) scale(${sc})">
        <circle cx="0" cy="-40" r="70" fill="url(#winGlow)"/>
        <rect x="-46" y="-70" width="92" height="70" fill="${p.wall}" stroke="${O}" stroke-width="3"/>
        <path d="M-58 -64 L0 -118 L58 -64z" fill="${p.roof}" stroke="${O}" stroke-width="3"/>
        <rect x="24" y="-128" width="10" height="34" fill="${p.ink}" stroke="${O}" stroke-width="3"/>
        <rect x="-32" y="-52" width="22" height="20" fill="#ffcf6b" stroke="${O}" stroke-width="2.5"/>
        <rect x="8" y="-44" width="22" height="44" fill="${p.door}" stroke="${O}" stroke-width="2.5"/>
        <circle cx="26" cy="-22" r="2" fill="#e6c45a"/>
      </g>
      <!-- снег и дорога -->
      <path d="M0 600 Q100 585 200 598 T400 592 V1200 H0z" fill="url(#snowG)"/>
      <path d="M0 600 Q100 585 200 598 T400 592" fill="none" stroke="${p.snowEdge}" stroke-width="3" opacity="0.7"/>
      <path d="M110 1120 L150 860 Q190 700 ${200 - 10 * sc} ${hy} L${200 + 10 * sc} ${hy} Q210 700 250 860 L290 1120z" fill="${p.snowBot}" opacity="0.55"/>
      ${lamp(110)}${lamp(290)}
      ${pine(-6, 640, 190, p.wall, p.roofHi)}${pine(408, 650, 210, p.wall, p.roofHi)}${pine(70, 612, 110, p.wall2, p.roofHi)}${pine(334, 618, 120, p.wall2, p.roofHi)}
    `;
  }

  /* ---------- Фон: заснеженная улица, время суток задаёт палитра p ---------- */
  function background(p, litLamps = 0, scene = 'town', approach = 0) {
    const lampXs = [70, 170, 265, 345];
    let lamps = '';
    lampXs.forEach((x, i) => {
      const lit = i < litLamps;
      lamps += `
        <g transform="translate(${x},0)">
          ${lit ? `<circle cx="0" cy="512" r="34" fill="url(#lampGlow)" opacity="${p.lampGlow}"/>` : ''}
          <rect x="-2" y="515" width="4" height="70" fill="${p.ink}"/>
          <path d="M-9 500 h18 l-3 16 h-12z" fill="${lit ? '#ffcf6b' : p.lampOff}" stroke="${p.ink}" stroke-width="2"/>
          <path d="M-11 500 h22 l-11 -8z" fill="${p.ink}"/>
        </g>`;
    });
    let stars = '';
    if (p.stars > 0.02) {
      const pts = [[30, 60], [80, 130], [140, 40], [190, 160], [240, 80], [350, 50], [380, 190], [60, 250], [210, 260], [330, 280], [120, 330], [290, 360]];
      stars = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2.2}" fill="#fff6dc" opacity="${(p.stars * (0.5 + (i % 4) / 6)).toFixed(2)}"/>`).join('');
    }
    const sun = p.sunR > 0 ? `
      <circle cx="${p.sunX}" cy="${p.sunY}" r="${p.sunR * 3.2}" fill="url(#sunGlow)"/>
      <circle cx="${p.sunX}" cy="${p.sunY}" r="${p.sunR}" fill="${p.sun}"/>` : '';
    const moonHole = p.moonHole ? `<circle cx="300" cy="120" r="38" fill="none" stroke="#5d6a8f" stroke-width="2" stroke-dasharray="4 7" opacity="0.6"/>` : '';
    return svg('0 0 400 860', `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${p.skyTop}"/>
          <stop offset="0.6" stop-color="${p.skyMid}"/>
          <stop offset="1" stop-color="${p.skyBot}"/>
        </linearGradient>
        <linearGradient id="snowG" gradientUnits="userSpaceOnUse" x1="0" y1="585" x2="0" y2="860">
          <stop offset="0" stop-color="${p.snowTop}"/>
          <stop offset="1" stop-color="${p.snowBot}"/>
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stop-color="${p.sun}" stop-opacity="0.55"/>
          <stop offset="1" stop-color="${p.sun}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/>
          <stop offset="1" stop-color="#ffd27a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="winGlow">
          <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.6"/>
          <stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="fog" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="${p.fog}" stop-opacity="0.35"/>
          <stop offset="1" stop-color="${p.fog}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g class="bg-cam">
      <rect y="-300" width="400" height="1160" fill="${p.skyTop}"/>
      <rect width="400" height="860" fill="url(#sky)"/>
      ${stars}
      ${moonHole}
      ${sun}
      <!-- дальние холмы и шпили -->
      <path d="M0 520 Q80 470 160 505 T320 490 T400 500 V600 H0z" fill="${p.hills}"/>
      <path d="M118 505 l8 -40 l8 40z M126 465 v-12 M121 457 h10" fill="${p.spires}" stroke="${p.spires}" stroke-width="2"/>
      <path d="M300 495 l10 -55 l10 55z" fill="${p.spires}"/>
      <path d="M330 500 l7 -30 l7 30z" fill="${p.spires}"/>
      <circle cx="210" cy="540" r="160" fill="url(#fog)"/>
      ${scene === 'outskirts' ? outskirts(p, approach) : `
      <!-- дом слева -->
      <g>
        <circle cx="40" cy="585" r="70" fill="url(#winGlow)" opacity="${p.winGlow}"/>
        <rect x="-10" y="520" width="120" height="100" fill="${p.wall}" stroke="#17121f" stroke-width="3"/>
        <path d="M-20 530 L50 455 L125 530z" fill="${p.roof}" stroke="#17121f" stroke-width="3"/>
        <path d="M-20 530 L50 455 L125 530 L118 538 Q60 528 -12 540z" fill="${p.roofHi}"/>
        <rect x="68" y="440" width="12" height="40" fill="${p.ink}" stroke="#17121f" stroke-width="3"/>
        <rect x="10" y="555" width="26" height="24" fill="${p.window}" stroke="#17121f" stroke-width="3"/>
        <path d="M23 555 v24 M10 567 h26" stroke="#17121f" stroke-width="2"/>
        <rect x="70" y="570" width="22" height="50" fill="${p.door}" stroke="#17121f" stroke-width="3"/>
      </g>
      <!-- дом справа -->
      <g>
        <rect x="300" y="540" width="110" height="80" fill="${p.wall2}" stroke="#17121f" stroke-width="3"/>
        <path d="M290 548 L350 490 L415 548z" fill="${p.roof}" stroke="#17121f" stroke-width="3"/>
        <rect x="320" y="565" width="20" height="20" fill="${p.window2}" stroke="#17121f" stroke-width="2"/>
        <rect x="360" y="565" width="20" height="20" fill="${p.window2}" stroke="#17121f" stroke-width="2"/>
      </g>
      ${lamps}
      <!-- снег на земле -->
      <path d="M0 600 Q100 585 200 598 T400 592 V1200 H0z" fill="url(#snowG)"/>
      <path d="M0 600 Q100 585 200 598 T400 592" fill="none" stroke="${p.snowEdge}" stroke-width="3" opacity="0.7"/>
      <!-- забор -->
      <g stroke="#17121f" stroke-width="2.5" fill="${p.fence}">
        <path d="M130 585 l4 -18 l4 18z M150 588 l4 -20 l4 20z M170 590 l4 -18 l4 18z"/>
        <path d="M128 578 h52" fill="none"/>
      </g>
      `}
      </g>
    `, 'bg-svg');
  }

  /* ---------- Герои: Ива-фонарщица, скороход Тиша, сторожиха Марфа, трубочист Фома ---------- */
  // один силуэт, разные цвета, головной убор и предмет в руке
  const LOOKS = {
    lamp: { hood: '#d79a35', cloak: '#2f5d62', fold: '#3f7a80', scarf: '#c98a2b', hair: '#8a3f28', prop: 'lantern', freckles: true },
    courier: { hood: '#3d63a8', cloak: '#26304e', fold: '#3a4a74', scarf: '#efe2c4', hair: '#e0b050', prop: 'letters', wings: true },
    guard: { hood: '#8a5a3a', cloak: '#4a5a36', fold: '#5e7246', scarf: '#a33a3a', hair: '#3a2a3a', prop: 'shield', fur: true },
    stoker: { hat: true, cloak: '#3a3440', fold: '#4c4656', scarf: '#e8702a', hair: '#3a2a20', prop: 'brush', soot: true },
    baker: { hood: '#c8423a', cloak: '#8a4a2a', fold: '#a05a34', scarf: '#f2e6c9', hair: '#c87a3a', prop: 'pryanik', kerchief: true },
    grinder: { cap: true, cloak: '#5a4a3a', fold: '#6e5c48', scarf: '#d8a94a', hair: '#6a4a2a', prop: 'wheel', beard: true },
    shepherd: { hood: '#5a7ac8', cloak: '#7a4a6a', fold: '#8e5a7e', scarf: '#e8c84a', hair: '#d8a050', prop: 'crook', braids: true, stripes: true, dog: true },
    herbalist: { hood: '#4a6a3a', cloak: '#3e4a3a', fold: '#506050', scarf: '#c86a8a', hair: '#2a2a3a', prop: 'herbs', wreath: true },
  };
  // пёс Дружок у ног пастушки
  const DOG = `
      <path d="M186 224 q14 -6 8 -24" fill="none" ${sw(7)}/><path d="M186 224 q14 -6 8 -24" fill="none" stroke="#c88a4a" stroke-width="3"/>
      <path d="M144 238 q-4 -36 16 -46 q22 -6 30 16 q6 16 -2 30z" fill="#c88a4a" ${sw(3.5)}/>
      <path d="M156 238 q-2 -18 8 -26 q9 8 7 26z" fill="#f4ead8" ${sw(2.5)}/>
      <ellipse cx="160" cy="182" rx="18" ry="16" fill="#c88a4a" ${sw(3.5)}/>
      <path d="M146 172 q-12 2 -9 20 q9 3 11 -8z" fill="#8a5a32" ${sw(2.5)}/>
      <path d="M174 172 q12 2 9 20 q-9 3 -11 -8z" fill="#8a5a32" ${sw(2.5)}/>
      <ellipse cx="160" cy="190" rx="9" ry="6.5" fill="#f4ead8" ${sw(2)}/>
      <ellipse cx="160" cy="186.5" rx="3.8" ry="2.6" fill="${O}"/>
      <circle cx="153" cy="178" r="2.4" fill="${O}"/><circle cx="167" cy="178" r="2.4" fill="${O}"/>
      <path d="M157.5 194 q2.5 7 5 0z" fill="#e85a6a" ${sw(1.2)}/>
      <path d="M147 198 q13 6 26 0" stroke="${O}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M147 198 q13 6 26 0" stroke="#c8423a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="160" cy="203" r="3" fill="#e6c45a" ${sw(1.5)}/>`;
  const PROPS = {
    lantern: `
      <path d="M130 150 Q148 156 150 146" ${sw(4)} fill="CLOAK"/>
      <path d="M152 136 v10" ${sw(3)}/>
      <path d="M140 148 h24 l-3 6 h-18z" fill="#3a3240" ${sw(3)}/>
      <rect x="141" y="154" width="22" height="26" rx="3" fill="#ffd36e" ${sw(3)}/>
      <path d="M152 154 v26 M141 167 h22" ${sw(2)}/>
      <path d="M152 161 q-5 7 0 13 q5 -6 0 -13z" fill="#ff8a2a"/>
      <path d="M139 180 h26 l-4 6 h-18z" fill="#3a3240" ${sw(3)}/>`,
    letters: `
      <path d="M130 150 Q146 158 150 150" ${sw(4)} fill="CLOAK"/>
      <g transform="rotate(-14 154 158)">
        <rect x="136" y="138" width="38" height="25" rx="2" fill="#e6d8b8" ${sw(3)}/>
        <rect x="133" y="146" width="38" height="25" rx="2" fill="#f2e6c9" ${sw(3)}/>
        <path d="M133 148 l19 12 l19 -12" fill="none" ${sw(2.2)}/>
        <path d="M150 138 v34 M133 160 h38" stroke="#c8423a" stroke-width="2.5"/>
        <circle cx="150" cy="160" r="3.5" fill="#c8423a" ${sw(1.5)}/>
      </g>`,
    shield: `
      <path d="M130 150 Q144 160 146 152" ${sw(4)} fill="CLOAK"/>
      <circle cx="150" cy="176" r="31" fill="#8a5a32" ${sw(4)}/>
      <path d="M124 162 h52 M120 176 h60 M124 190 h52" stroke="#5a3a1e" stroke-width="2.5"/>
      <circle cx="150" cy="176" r="27" fill="none" stroke="#9aa0ac" stroke-width="5"/>
      <circle cx="150" cy="176" r="31" fill="none" ${sw(3)}/>
      <circle cx="150" cy="176" r="6" fill="#c9ccd8" ${sw(2.5)}/>
      <g fill="#c9ccd8" ${sw(1.5)}><circle cx="150" cy="150" r="2.6"/><circle cx="150" cy="202" r="2.6"/><circle cx="124" cy="176" r="2.6"/><circle cx="176" cy="176" r="2.6"/></g>`,
    pryanik: `
      <path d="M130 150 Q146 158 150 150" ${sw(4)} fill="CLOAK"/>
      <g transform="rotate(-10 158 162)">
        <rect x="134" y="142" width="48" height="40" rx="14" fill="#b8743a" ${sw(3.5)}/>
        <rect x="140" y="148" width="36" height="28" rx="9" fill="none" stroke="#f8f2e8" stroke-width="2.5" stroke-dasharray="4 3"/>
        <path d="M158 171 q-10 -7 -7 -13 q3 -5 7 0 q4 -5 7 0 q3 6 -7 13z" fill="#e85a5a" ${sw(1.8)}/>
      </g>
      <circle cx="150" cy="150" r="7" fill="#f3cda6" ${sw(3)}/>`,
    wheel: `
      <path d="M130 150 Q146 158 150 152" ${sw(4)} fill="CLOAK"/>
      <circle cx="158" cy="172" r="27" fill="#9a9aa6" ${sw(4)}/>
      <circle cx="158" cy="172" r="19" fill="none" stroke="#7a7a86" stroke-width="3"/>
      <circle cx="158" cy="172" r="6" fill="#6a4a2a" ${sw(2.5)}/>
      <path d="M180 152 l14 -12 M184 160 l14 -3 M174 146 l5 -16" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <path d="M180 152 l14 -12 M184 160 l14 -3 M174 146 l5 -16" stroke="#ffb23e" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="148" cy="152" r="7" fill="#f3cda6" ${sw(3)}/>`,
    crook: `
      <path d="M150 230 L156 66" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
      <path d="M150 230 L156 66" stroke="#a0703a" stroke-width="4" stroke-linecap="round"/>
      <path d="M156 68 Q154 34 174 34 Q192 36 188 56" fill="none" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
      <path d="M156 68 Q154 34 174 34 Q192 36 188 56" fill="none" stroke="#a0703a" stroke-width="4" stroke-linecap="round"/>
      <path d="M130 150 Q146 158 154 148" ${sw(4)} fill="CLOAK"/>
      <circle cx="155" cy="146" r="6" fill="#f3cda6" ${sw(3)}/>`,
    herbs: `
      <g stroke="${O}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M152 188 L138 120"/><path d="M154 188 L156 108"/><path d="M156 188 L174 122"/></g>
      <g stroke="#5a8a3a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M152 188 L138 120"/><path d="M154 188 L156 108"/><path d="M156 188 L174 122"/></g>
      <g fill="#7ab04a" ${sw(2)}><ellipse cx="135" cy="138" rx="9" ry="4" transform="rotate(-50 135 138)"/><ellipse cx="166" cy="134" rx="9" ry="4" transform="rotate(40 166 134)"/><ellipse cx="149" cy="126" rx="8" ry="3.5" transform="rotate(60 149 126)"/><ellipse cx="176" cy="146" rx="8" ry="3.5" transform="rotate(30 176 146)"/><ellipse cx="160" cy="122" rx="7" ry="3" transform="rotate(-60 160 122)"/></g>
      <g ${sw(1.5)}><circle cx="138" cy="116" r="7.5" fill="#f8f4ea"/><circle cx="138" cy="116" r="3.2" fill="#ffcf4a"/><circle cx="156" cy="104" r="6.5" fill="#b08ad8"/><circle cx="174" cy="119" r="7.5" fill="#f8f4ea"/><circle cx="174" cy="119" r="3.2" fill="#ffcf4a"/></g>
      <path d="M130 150 Q146 162 150 158" ${sw(4)} fill="CLOAK"/>
      <circle cx="154" cy="162" r="7" fill="#f3cda6" ${sw(3)}/>
      <path d="M147 173 h14" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M147 173 h14" stroke="#c8423a" stroke-width="3" stroke-linecap="round"/>`,
    brush: `
      <path d="M148 226 L162 52" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
      <path d="M148 226 L162 52" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/>
      <g transform="translate(163 40)">
        <circle r="17" fill="#2a2430" ${sw(3)}/>
        <path d="M0 -24 v8 M0 16 v8 M-24 0 h8 M16 0 h8 M-17 -17 l6 6 M11 11 l6 6 M17 -17 l-6 6 M-11 11 l-6 6" ${sw(4)}/>
        <circle r="6" fill="#4c4656" ${sw(2)}/>
      </g>
      <path d="M130 150 Q146 158 154 148" ${sw(4)} fill="CLOAK"/>
      <circle cx="155" cy="146" r="6" fill="#f3cda6" ${sw(3)}/>`,
  };

  function hero(lookId = 'lamp') {
    const L = LOOKS[lookId] || LOOKS.lamp;
    const bag = window.Story && window.Story.story.heroBag ? `
      <!-- сумка почтальона -->
      <path d="M72 132 Q100 170 128 212" stroke="#5a3a22" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M72 132 Q100 170 128 212" ${sw(1.5)} fill="none" opacity="0.6"/>
      <path d="M44 186 h44 v34 q0 6 -6 6 h-32 q-6 0 -6 -6z" fill="#8a5a32" ${sw(3.5)}/>
      <rect x="52" y="174" width="30" height="20" rx="2" fill="#f2e6c9" ${sw(2.5)} transform="rotate(-8 67 184)"/>
      <path d="M42 186 h48 v12 q-24 8 -48 0z" fill="#a06a3a" ${sw(3)}/>
      <circle cx="66" cy="198" r="3.5" fill="#d8a94a" ${sw(1.5)}/>` : '';
    // головной убор: капюшон (у Тиши с крылышками, у Марфы с меховой опушкой) или цилиндр трубочиста
    const head = L.hat || L.cap ? `
      <path d="M62 84 Q58 122 72 130 L128 130 Q142 122 138 84z" fill="${L.hair}" ${sw(4)}/>` : `
      <path d="M52 108 Q48 40 100 34 Q152 40 148 108 Q146 128 132 132 L68 132 Q54 128 52 108z" fill="${L.hood}" ${sw(4)}/>
      ${L.wings ? `<path d="M54 80 q-26 -16 -34 2 q12 -2 12 8 q10 -4 12 6 q6 -4 10 2z" fill="#f4f1ea" ${sw(3)}/><path d="M146 80 q26 -16 34 2 q-12 -2 -12 8 q-10 -4 -12 6 q-6 -4 -10 2z" fill="#f4f1ea" ${sw(3)}/>` : ''}
      ${L.fur || L.kerchief || L.wreath ? '' : `<path d="M100 34 Q104 18 116 14" ${sw(4)} fill="none"/><circle cx="118" cy="13" r="5" fill="${L.hood}" ${sw(3)}/>`}
      ${L.kerchief ? '<g fill="#f4ead8"><circle cx="72" cy="56" r="3.2"/><circle cx="88" cy="44" r="3.2"/><circle cx="104" cy="40" r="3.2"/><circle cx="120" cy="46" r="3.2"/><circle cx="132" cy="60" r="3.2"/><circle cx="60" cy="80" r="3"/><circle cx="141" cy="82" r="3"/><circle cx="58" cy="104" r="3"/><circle cx="143" cy="106" r="3"/></g>' : ''}
      ${L.stripes ? `<path d="M62 60 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7" fill="none" stroke="#f4f1ea" stroke-width="4" stroke-linejoin="round"/><path d="M68 44 Q100 30 132 44" fill="none" stroke="#e8c84a" stroke-width="4"/>` : ''}
      ${L.wreath ? `<g ${sw(1.5)}><path d="M60 64 Q70 40 100 38 Q130 40 140 64" fill="none" stroke="${O}" stroke-width="7"/><path d="M60 64 Q70 40 100 38 Q130 40 140 64" fill="none" stroke="#6a9a4a" stroke-width="4"/>
        <circle cx="64" cy="56" r="6" fill="#f8f4ea"/><circle cx="64" cy="56" r="2.5" fill="#ffcf4a"/><circle cx="80" cy="44" r="5.5" fill="#b08ad8"/><circle cx="100" cy="39" r="6.5" fill="#f8f4ea"/><circle cx="100" cy="39" r="2.8" fill="#ffcf4a"/>
        <circle cx="120" cy="44" r="5.5" fill="#e87a9a"/><circle cx="136" cy="56" r="6" fill="#f8f4ea"/><circle cx="136" cy="56" r="2.5" fill="#ffcf4a"/></g>` : ''}`;
    const fur = L.fur ? `
      <path d="M60 116 Q54 62 100 56 Q146 62 140 116" fill="none" stroke="${O}" stroke-width="15" stroke-linecap="round"/>
      <path d="M60 116 Q54 62 100 56 Q146 62 140 116" fill="none" stroke="#f2ead8" stroke-width="9" stroke-linecap="round"/>
      <path d="M134 118 q10 14 4 30 q-4 8 2 16" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/>
      <path d="M134 118 q10 14 4 30 q-4 8 2 16" fill="none" stroke="${L.hair}" stroke-width="6" stroke-linecap="round"/>` : '';
    const extra = `
      ${L.kerchief ? `<path d="M92 126 l-12 16 l14 -4z M108 126 l12 16 l-14 -4z" fill="${L.hood}" ${sw(3)}/><circle cx="100" cy="127" r="6" fill="${L.hood}" ${sw(3)}/>` : ''}
      ${L.beard ? `<path d="M68 100 Q70 136 100 138 Q130 136 132 100 Q122 124 100 123 Q78 124 68 100z" fill="${L.hair}" ${sw(3.5)}/>` : ''}
      ${L.braids ? `<g fill="none" stroke-linecap="round"><path d="M68 112 q-10 18 -4 44 M132 112 q10 18 4 44" stroke="${O}" stroke-width="13"/><path d="M68 112 q-10 18 -4 44 M132 112 q10 18 4 44" stroke="${L.hair}" stroke-width="8"/>
        <path d="M60 124 l8 4 M59 136 l8 4 M140 124 l-8 4 M141 136 l-8 4" stroke="#a8763a" stroke-width="2"/></g><circle cx="64" cy="158" r="4.5" fill="${L.scarf}" ${sw(2)}/><circle cx="136" cy="158" r="4.5" fill="${L.scarf}" ${sw(2)}/>` : ''}`;
    const cap = L.cap ? `
      <path d="M62 76 Q60 38 100 36 Q140 38 138 76z" fill="#3a4a6a" ${sw(4)}/>
      <path d="M66 60 Q100 52 134 60" fill="none" stroke="#2a3450" stroke-width="3"/>
      <path d="M58 76 Q100 64 148 78 Q144 88 104 84 Q72 84 58 76z" fill="#22283a" ${sw(3.5)}/>
      <circle cx="100" cy="37" r="4" fill="#d8a94a" ${sw(2)}/>` : '';
    const hat = L.hat ? `
      <path d="M72 66 L75 16 Q100 9 125 16 L128 66z" fill="#2a2430" ${sw(4)}/>
      <path d="M74 50 h52 v9 h-52z" fill="${L.scarf}" ${sw(2.5)}/>
      <ellipse cx="100" cy="66" rx="45" ry="9" fill="#1e1a24" ${sw(4)}/>
      <path d="M86 24 q4 -4 10 -3" stroke="#4c4656" stroke-width="3" fill="none" stroke-linecap="round"/>` : '';
    return svg('0 0 200 240', `
      <defs>
        <radialGradient id="hl"><stop offset="0" stop-color="#ffe9a8"/><stop offset="0.5" stop-color="#ffb84a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>
      </defs>
      ${L.prop === 'lantern' ? '<circle cx="152" cy="168" r="48" fill="url(#hl)"/>' : ''}
      <!-- плащ -->
      <path d="M58 236 Q52 160 70 128 L130 128 Q150 165 144 236z" fill="${L.cloak}" ${sw(4)}/>
      <path d="M100 132 L100 236" ${sw(3)} fill="none" opacity="0.5"/>
      <path d="M70 140 Q66 190 74 236" stroke="${L.fold}" stroke-width="5" fill="none"/>
      <!-- шарф -->
      <path d="M66 126 Q100 146 134 126 L136 140 Q100 160 64 140z" fill="${L.scarf}" ${sw(4)}/>
      <path d="M118 140 l8 34 l-14 2z" fill="${L.scarf}" ${sw(3.5)}/>
      ${head}
      <!-- лицо -->
      <ellipse cx="100" cy="94" rx="34" ry="32" fill="#f3cda6" ${sw(4)}/>
      ${fur}
      ${L.beard ? '' : extra}
      <!-- чёлка -->
      <path d="M66 86 Q70 58 100 58 Q132 58 134 86 Q124 72 112 76 Q104 66 94 76 Q80 70 66 86z" fill="${L.hair}" ${sw(3.5)}/>
      ${hat}${cap}
      ${L.beard ? extra : ''}
      <!-- глаза -->
      <ellipse cx="87" cy="96" rx="6.5" ry="8.5" fill="${O}"/>
      <ellipse cx="113" cy="96" rx="6.5" ry="8.5" fill="${O}"/>
      <circle cx="89" cy="93" r="2.4" fill="#fff"/>
      <circle cx="115" cy="93" r="2.4" fill="#fff"/>
      <!-- щёки -->
      <circle cx="78" cy="108" r="5" fill="#e79a8a" opacity="0.6"/>
      <circle cx="122" cy="108" r="5" fill="#e79a8a" opacity="0.6"/>
      ${L.freckles ? '<g fill="#b0603e"><circle cx="82" cy="105" r="1.2"/><circle cx="86" cy="108" r="1.2"/><circle cx="118" cy="105" r="1.2"/><circle cx="114" cy="108" r="1.2"/></g>' : ''}
      ${L.soot ? '<ellipse cx="121" cy="112" rx="7" ry="3.5" fill="#3a3440" opacity="0.55"/><ellipse cx="80" cy="84" rx="5" ry="2.5" fill="#3a3440" opacity="0.4"/>' : ''}
      <path d="M94 114 Q100 119 106 114" ${sw(3)} fill="none"/>
      ${bag}
      <!-- рука и предмет -->
      ${PROPS[L.prop].replace(/CLOAK/g, L.cloak)}
      ${L.dog ? DOG : ''}
    `, 'char hero');
  }

  /* ---------- Враги ---------- */
  const enemiesArt = {
    inkcat: () => svg('0 0 200 220', `
      <!-- хвост -->
      <path d="M150 170 Q195 150 180 105 Q172 85 160 100 Q176 128 140 150z" fill="#1d1928" ${sw(4)}/>
      <!-- тело-клякса -->
      <path d="M40 190 Q30 120 60 96 Q100 70 140 96 Q170 120 160 190 Q150 200 140 192 Q132 208 120 194 Q108 214 96 194 Q82 210 74 194 Q60 206 52 192 Q44 200 40 190z" fill="#1d1928" ${sw(4)}/>
      <path d="M60 110 Q80 96 100 98" stroke="#3d3560" stroke-width="6" fill="none" stroke-linecap="round"/>
      <!-- капли чернил -->
      <path d="M62 196 q4 12 0 16 q-4 -4 0 -16z M104 198 q4 10 0 14 q-4 -4 0 -14z" fill="#1d1928" ${sw(2.5)}/>
      <!-- уши -->
      <path d="M58 104 L52 56 L88 86z" fill="#1d1928" ${sw(4)}/>
      <path d="M142 104 L150 54 L114 86z" fill="#1d1928" ${sw(4)}/>
      <path d="M60 92 L58 70 L76 86z M140 92 L144 68 L126 86z" fill="#6b3a5e"/>
      <!-- перо в голове -->
      <path d="M110 80 Q128 30 150 22 Q138 52 116 84z" fill="#e8e2d0" ${sw(3)}/>
      <path d="M114 82 L146 26" ${sw(2)}/>
      <!-- глаза -->
      <ellipse cx="78" cy="122" rx="15" ry="17" fill="#f4d23c" ${sw(3.5)}/>
      <ellipse cx="122" cy="122" rx="15" ry="17" fill="#f4d23c" ${sw(3.5)}/>
      <ellipse cx="80" cy="123" rx="3.5" ry="12" fill="${O}"/>
      <ellipse cx="120" cy="123" rx="3.5" ry="12" fill="${O}"/>
      <!-- ухмылка -->
      <path d="M72 152 Q100 172 128 152 Q100 160 72 152z" fill="#f2efe6" ${sw(3)}/>
      <path d="M84 156 l3 6 M96 159 l2 7 M108 159 l-1 7 M118 156 l-3 6" ${sw(2)}/>
    `, 'char'),

    laundress: () => svg('0 0 200 240', `
      <defs><linearGradient id="ghost" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e3ef"/><stop offset="1" stop-color="#8ea2bd" stop-opacity="0.55"/></linearGradient></defs>
      <path d="M58 228 Q40 150 62 90 Q70 50 100 46 Q132 50 140 90 Q160 150 142 228 Q132 214 122 230 Q112 214 100 230 Q88 214 78 230 Q68 214 58 228z" fill="url(#ghost)" ${sw(4)}/>
      <!-- волосы-пучок с прищепками -->
      <ellipse cx="100" cy="40" rx="24" ry="16" fill="#6f7f9b" ${sw(3.5)}/>
      <rect x="82" y="20" width="6" height="16" rx="2" fill="#c9a36a" ${sw(2)} transform="rotate(-20 85 28)"/>
      <rect x="110" y="18" width="6" height="16" rx="2" fill="#c9a36a" ${sw(2)} transform="rotate(18 113 26)"/>
      <!-- лицо -->
      <ellipse cx="100" cy="82" rx="26" ry="30" fill="#e8eef6" ${sw(3.5)}/>
      <ellipse cx="90" cy="80" rx="6" ry="9" fill="#2a3550"/>
      <ellipse cx="110" cy="80" rx="6" ry="9" fill="#2a3550"/>
      <circle cx="90" cy="78" r="2" fill="#9ff0ff"/>
      <circle cx="110" cy="78" r="2" fill="#9ff0ff"/>
      <path d="M92 100 Q100 96 108 100" ${sw(3)} fill="none"/>
      <!-- руки и скрученная простыня -->
      <path d="M64 120 Q36 140 46 170" ${sw(4)} fill="none"/>
      <path d="M136 120 Q164 140 154 170" ${sw(4)} fill="none"/>
      <path d="M40 168 Q70 150 100 172 Q130 194 160 168 L162 182 Q130 208 100 186 Q70 164 42 182z" fill="#f3f6fb" ${sw(3.5)}/>
      <path d="M60 165 l6 14 M84 166 l4 14 M112 180 l4 14 M138 180 l2 12" ${sw(2)} opacity="0.6"/>
      <!-- капли -->
      <path d="M70 196 q3 8 0 11 q-3 -3 0 -11z M130 200 q3 8 0 11 q-3 -3 0 -11z" fill="#9fd8ff" ${sw(1.5)}/>
    `, 'char ghosty'),

    golem: () => svg('0 0 200 240', `
      <defs><radialGradient id="cold"><stop offset="0" stop-color="#b8f3ff"/><stop offset="1" stop-color="#4ab7ff" stop-opacity="0"/></radialGradient></defs>
      <circle cx="100" cy="30" r="26" fill="url(#cold)"/>
      <!-- ноги -->
      <rect x="62" y="190" width="30" height="40" rx="6" fill="#d9caa4" ${sw(4)}/>
      <rect x="108" y="190" width="30" height="40" rx="6" fill="#d9caa4" ${sw(4)}/>
      <!-- туловище-свеча -->
      <path d="M50 100 Q48 90 60 88 H140 Q152 90 150 100 V196 Q100 206 50 196z" fill="#efe3c6" ${sw(4)}/>
      <path d="M60 88 Q62 112 68 108 Q72 124 78 104 Q84 92 92 116 Q98 128 104 104 Q112 92 118 120 Q124 130 128 104 Q134 92 140 88z" fill="#fff6e0" ${sw(3)}/>
      <path d="M60 140 Q100 150 140 140" stroke="#cbb88e" stroke-width="5" fill="none"/>
      <!-- руки -->
      <path d="M50 110 Q22 130 28 172 Q38 182 46 170 Q44 140 56 128z" fill="#e3d5b2" ${sw(4)}/>
      <path d="M150 110 Q178 130 172 172 Q162 182 154 170 Q156 140 144 128z" fill="#e3d5b2" ${sw(4)}/>
      <!-- голова-огарок -->
      <path d="M72 88 V56 Q72 46 84 46 H116 Q128 46 128 56 V88z" fill="#efe3c6" ${sw(4)}/>
      <path d="M72 58 Q80 70 86 58 Q94 72 100 56 Q108 70 114 56 Q122 68 128 58" fill="none" ${sw(3)}/>
      <path d="M100 46 V36" ${sw(3)}/>
      <path d="M100 36 q-8 -10 0 -22 q8 12 0 22z" fill="#9be7ff" ${sw(2.5)}/>
      <!-- лицо -->
      <path d="M82 70 l10 4 M118 70 l-10 4" ${sw(3)}/>
      <circle cx="88" cy="78" r="4" fill="${O}"/>
      <circle cx="112" cy="78" r="4" fill="${O}"/>
      <path d="M90 162 Q100 154 110 162" ${sw(3)} fill="none" opacity="0.4"/>
    `, 'char'),

    owl: () => svg('0 0 200 240', `
      <!-- алебарда -->
      <path d="M168 20 V230" ${sw(5)}/>
      <path d="M168 20 L186 44 L168 56 Z" fill="#9aa6b6" ${sw(3)}/>
      <path d="M168 34 Q146 34 150 56 Q160 46 168 50" fill="#9aa6b6" ${sw(3)}/>
      <!-- тело -->
      <path d="M44 220 Q30 140 56 96 Q100 62 144 96 Q170 140 156 220z" fill="#6b4a32" ${sw(4)}/>
      <path d="M70 130 Q100 112 130 130 Q140 180 128 214 H72 Q60 180 70 130z" fill="#c9a77a" ${sw(3)}/>
      <g ${sw(2)} fill="none" opacity="0.7"><path d="M84 146 q6 6 12 0 q6 6 12 0 q6 6 12 0"/><path d="M80 168 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0"/><path d="M84 190 q6 6 12 0 q6 6 12 0 q6 6 12 0"/></g>
      <!-- крыло держит древко -->
      <path d="M150 120 Q176 130 170 160 Q156 150 146 150z" fill="#5a3d28" ${sw(3.5)}/>
      <path d="M50 120 Q28 150 46 186 Q56 160 60 140z" fill="#5a3d28" ${sw(3.5)}/>
      <!-- шлем -->
      <path d="M48 92 Q50 40 100 38 Q150 40 152 92 Z" fill="#7b8794" ${sw(4)}/>
      <path d="M48 92 H152" ${sw(5)}/>
      <path d="M100 38 V18 M92 22 h16" ${sw(4)}/>
      <!-- глаза -->
      <circle cx="78" cy="108" r="19" fill="#f5ead2" ${sw(3.5)}/>
      <circle cx="122" cy="108" r="19" fill="#f5ead2" ${sw(3.5)}/>
      <circle cx="78" cy="108" r="11" fill="#f0a020"/>
      <circle cx="122" cy="108" r="11" fill="#f0a020"/>
      <circle cx="78" cy="108" r="6" fill="${O}"/>
      <circle cx="122" cy="108" r="6" fill="${O}"/>
      <path d="M58 90 L96 100 M142 90 L104 100" ${sw(5)}/>
      <path d="M94 118 L100 132 L106 118z" fill="#e0a43a" ${sw(3)}/>
      <!-- лапы -->
      <path d="M80 220 l-6 12 M86 222 l0 12 M92 220 l6 12 M110 220 l-6 12 M116 222 l0 12 M122 220 l6 12" ${sw(3.5)}/>
    `, 'char'),

    moth: () => svg('0 0 240 240', `
      <defs>
        <radialGradient id="wingG"><stop offset="0" stop-color="#6a4a90"/><stop offset="1" stop-color="#2e1f45"/></radialGradient>
      </defs>
      <!-- крылья -->
      <path d="M120 100 Q60 10 12 40 Q-4 100 40 130 Q10 170 40 210 Q90 220 120 140z" fill="url(#wingG)" ${sw(4)}/>
      <path d="M120 100 Q180 10 228 40 Q244 100 200 130 Q230 170 200 210 Q150 220 120 140z" fill="url(#wingG)" ${sw(4)}/>
      <!-- глазки на крыльях -->
      <circle cx="58" cy="76" r="20" fill="#e6c45a" ${sw(3)}/><circle cx="58" cy="76" r="10" fill="${O}"/><circle cx="62" cy="72" r="3" fill="#fff"/>
      <circle cx="182" cy="76" r="20" fill="#e6c45a" ${sw(3)}/><circle cx="182" cy="76" r="10" fill="${O}"/><circle cx="186" cy="72" r="3" fill="#fff"/>
      <path d="M40 180 Q70 170 90 150 M200 180 Q170 170 150 150" stroke="#8d6cc0" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- тело -->
      <ellipse cx="120" cy="150" rx="20" ry="58" fill="#3a2c3e" ${sw(4)}/>
      <path d="M102 140 h36 M101 160 h38 M104 180 h32" ${sw(2.5)} opacity="0.7"/>
      <!-- голова с мехом -->
      <circle cx="120" cy="88" r="28" fill="#cbb9a6" ${sw(4)}/>
      <path d="M94 96 q6 8 12 2 q6 8 14 2 q8 8 14 -2 q6 8 12 -2" fill="none" ${sw(3)}/>
      <ellipse cx="108" cy="84" rx="9" ry="11" fill="#1a1020"/>
      <ellipse cx="132" cy="84" rx="9" ry="11" fill="#1a1020"/>
      <circle cx="110" cy="80" r="3" fill="#c5a8ff"/><circle cx="134" cy="80" r="3" fill="#c5a8ff"/>
      <!-- усики -->
      <path d="M108 62 Q90 30 70 26 M132 62 Q150 30 170 26" ${sw(3.5)} fill="none"/>
      <!-- корона из погасших ламп -->
      <g ${sw(2.5)}>
        <path d="M102 62 l-4 -16 h10z" fill="#4a5168"/>
        <path d="M120 58 l-5 -20 h10z" fill="#4a5168"/>
        <path d="M138 62 l-4 -16 h10z" fill="#4a5168"/>
        <circle cx="103" cy="44" r="4" fill="#7f8aa8"/><circle cx="120" cy="35" r="5" fill="#7f8aa8"/><circle cx="139" cy="44" r="4" fill="#7f8aa8"/>
      </g>
      <!-- украденная луна в лапках -->
      <circle cx="120" cy="196" r="16" fill="#f4eccf" ${sw(3)}/>
      <path d="M100 186 q10 -8 8 8 M140 186 q-10 -8 -8 8" ${sw(3)} fill="none"/>
    `, 'char boss'),

    magpie: () => svg('0 0 220 230', `
      <!-- хвост -->
      <path d="M128 150 L206 196 L198 208 L120 168z" fill="#1d2a3a" ${sw(3.5)}/>
      <path d="M134 156 L200 200" stroke="#3f8a8a" stroke-width="4" stroke-linecap="round"/>
      <!-- тело -->
      <path d="M60 110 Q50 170 92 196 Q140 210 152 160 Q160 120 128 96 Q92 80 60 110z" fill="#1a1a24" ${sw(4)}/>
      <path d="M72 140 Q76 184 104 192 Q132 192 136 156 Q112 168 72 140z" fill="#f2f0ea" ${sw(3)}/>
      <!-- крыло с отливом -->
      <path d="M100 108 Q150 104 160 150 Q130 150 104 136z" fill="#22394a" ${sw(3.5)}/>
      <path d="M112 116 Q140 118 150 142" stroke="#4fb0a8" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M108 130 Q130 134 142 150" stroke="#f2f0ea" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- голова -->
      <circle cx="76" cy="82" r="30" fill="#1a1a24" ${sw(4)}/>
      <path d="M48 86 L18 94 L48 98z" fill="#4a4a58" ${sw(3)}/>
      <circle cx="70" cy="78" r="9" fill="#f2f0ea" ${sw(2.5)}/>
      <circle cx="68" cy="78" r="5" fill="${O}"/><circle cx="66" cy="76" r="1.8" fill="#fff"/>
      <path d="M58 66 L82 70" ${sw(4)}/>
      <!-- украденная фуражка почтальона -->
      <path d="M52 60 Q76 36 104 56 L100 64 Q78 52 56 66z" fill="#3a5a8a" ${sw(3.5)}/>
      <path d="M48 64 Q70 60 102 62 L104 68 Q72 66 46 70z" fill="#22304a" ${sw(3)}/>
      <circle cx="78" cy="52" r="4" fill="#e6c45a" ${sw(1.5)}/>
      <!-- лапы с пачкой писем -->
      <path d="M90 196 l-6 18 M104 198 l2 18" ${sw(3.5)}/>
      <g transform="rotate(-10 96 214)">
        <rect x="70" y="202" width="52" height="22" rx="2" fill="#f2e6c9" ${sw(3)}/>
        <rect x="74" y="196" width="44" height="10" rx="2" fill="#e8d8b8" ${sw(2.5)}/>
        <path d="M96 196 v28 M70 213 h52" stroke="#c8423a" stroke-width="3"/>
      </g>
      <!-- блестяшки -->
      <circle cx="170" cy="96" r="7" fill="#e6c45a" ${sw(2.5)}/><circle cx="186" cy="118" r="5" fill="#cfd6e6" ${sw(2)}/>
      <path d="M176 76 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#fff3c4"/>
    `, 'char boss'),

    clockmaker: () => svg('0 0 220 240', `
      <defs><radialGradient id="dialG"><stop offset="0.6" stop-color="#efe2c4"/><stop offset="1" stop-color="#c8b48a"/></radialGradient></defs>
      <!-- длинное пальто -->
      <path d="M70 112 Q54 180 52 232 H168 Q166 180 150 112 Q110 100 70 112z" fill="#3a2f4a" ${sw(4)}/>
      <path d="M110 112 V232" ${sw(3)} opacity="0.6"/>
      <!-- окошко с маятником -->
      <rect x="92" y="150" width="36" height="58" rx="6" fill="#1e1a2c" ${sw(3)}/>
      <g class="pendulum"><path d="M110 152 V190" stroke="#d8a94a" stroke-width="3"/><circle cx="110" cy="194" r="9" fill="#d8a94a" ${sw(2.5)}/></g>
      <!-- руки-стрелки -->
      <path d="M70 124 Q36 150 30 196" ${sw(5)} fill="none"/>
      <path d="M150 124 Q186 140 196 110" ${sw(5)} fill="none"/>
      <!-- большой ключ -->
      <g transform="rotate(-30 198 96)">
        <circle cx="198" cy="80" r="12" fill="none" stroke="#d8a94a" stroke-width="5"/>
        <path d="M198 92 V128 M198 116 h10 M198 124 h8" stroke="#d8a94a" stroke-width="5" stroke-linecap="round"/>
      </g>
      <!-- голова-циферблат -->
      <circle cx="110" cy="72" r="44" fill="#5a4a6a" ${sw(4)}/>
      <circle cx="110" cy="72" r="36" fill="url(#dialG)" ${sw(3)}/>
      <g stroke="${O}" stroke-width="3" stroke-linecap="round">
        <path d="M110 40 v7 M110 97 v7 M78 72 h7 M135 72 h7 M87 49 l4 4 M133 49 l-4 4 M87 95 l4 -4 M133 95 l-4 -4"/>
      </g>
      <!-- стрелки почти на полночи -->
      <path d="M110 72 L106 46" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <path d="M110 72 L98 52" stroke="#c8423a" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="110" cy="72" r="5" fill="${O}"/>
      <!-- глаза в циферблате -->
      <ellipse cx="96" cy="80" rx="5" ry="6" fill="${O}"/><ellipse cx="124" cy="80" rx="5" ry="6" fill="${O}"/>
      <circle cx="97" cy="78" r="1.8" fill="#ffcf6b"/><circle cx="125" cy="78" r="1.8" fill="#ffcf6b"/>
      <!-- цилиндр с шестерёнкой -->
      <path d="M84 30 h52 v-26 h-52z" fill="#241e30" ${sw(3.5)}/>
      <path d="M76 30 h68" ${sw(5)}/>
      <circle cx="124" cy="16" r="7" fill="#d8a94a" ${sw(2)}/><circle cx="124" cy="16" r="2.5" fill="#241e30"/>
    `, 'char boss'),

    waxgiant: () => svg('0 0 240 240', `
      <!-- тело из сургуча -->
      <path d="M50 228 Q30 150 60 100 Q90 60 128 62 Q176 66 192 118 Q210 176 190 228 Q176 214 166 230 Q150 212 136 230 Q120 214 104 230 Q88 214 76 230 Q62 214 50 228z" fill="#9a2a26" ${sw(4)}/>
      <path d="M70 112 Q92 84 124 80" stroke="#d0564a" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M72 150 q6 22 0 30 q-6 -8 0 -30z M160 160 q6 18 0 26 q-6 -8 0 -26z" fill="#7a1e1c" ${sw(2.5)}/>
      <!-- прилипшие письма -->
      <g ${sw(2.5)}><rect x="140" y="132" width="34" height="22" rx="2" fill="#f2e6c9" transform="rotate(14 157 143)"/><rect x="62" y="186" width="30" height="20" rx="2" fill="#f2e6c9" transform="rotate(-12 77 196)"/></g>
      <!-- лицо -->
      <path d="M92 104 l22 8 M164 104 l-22 8" ${sw(5)}/>
      <circle cx="104" cy="120" r="7" fill="#ffcf6b" ${sw(2.5)}/><circle cx="152" cy="120" r="7" fill="#ffcf6b" ${sw(2.5)}/>
      <path d="M108 150 Q128 140 148 150" ${sw(4)} fill="none"/>
      <!-- фитиль на макушке -->
      <path d="M128 62 V44" ${sw(3)}/><path d="M128 44 q-8 -10 0 -22 q8 12 0 22z" fill="#ffb23e" ${sw(2.5)}/>
      <!-- кулак-печать -->
      <path d="M58 140 Q20 150 22 190" ${sw(14)} stroke="#9a2a26" fill="none"/>
      <path d="M58 140 Q20 150 22 190" stroke="${O}" stroke-width="3" fill="none" opacity="0.5"/>
      <rect x="10" y="186" width="24" height="18" rx="3" fill="#b8862e" ${sw(3)}/>
      <ellipse cx="22" cy="214" rx="20" ry="10" fill="#c8423a" ${sw(3.5)}/>
      <path d="M14 214 l8 -5 l8 5 l-8 5z" fill="#7a1e1c"/>
    `, 'char boss'),

    vane: () => svg('0 0 240 240', `
      <!-- вихри ветра -->
      <g stroke="#cfe6ff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75">
        <path d="M14 80 q30 -14 48 4 q10 12 -4 18"/><path d="M180 50 q30 -10 46 8"/><path d="M190 150 q24 -6 38 10 q6 10 -6 14"/>
      </g>
      <!-- шест и стороны света -->
      <path d="M120 166 V236" ${sw(6)}/>
      <path d="M70 206 H170" ${sw(5)}/>
      <path d="M166 198 l14 8 l-14 8z M74 198 l-14 8 l14 8z" fill="#3a3a46" ${sw(2.5)}/>
      <text x="184" y="198" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#e6c45a" stroke="${O}" stroke-width="1">${tr('В')}</text>
      <text x="40" y="198" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#e6c45a" stroke="${O}" stroke-width="1">${tr('З')}</text>
      <!-- петух из кованого железа -->
      <path d="M86 70 Q60 60 40 86 Q60 92 66 116 Q70 160 120 168 Q168 168 174 126 Q178 96 156 80 Q140 70 128 84 Q118 60 86 70z" fill="#2a2a34" ${sw(4)}/>
      <!-- хвост-перья -->
      <path d="M66 112 Q20 100 14 140 Q40 124 58 134 Q30 148 34 176 Q56 150 74 148z" fill="#2a2a34" ${sw(3.5)}/>
      <path d="M30 140 Q44 132 58 134 M42 168 Q56 154 72 150" stroke="#4f9a8a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- патина -->
      <path d="M96 120 Q120 104 150 118" stroke="#4f9a8a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M100 140 Q126 128 156 140" stroke="#4f9a8a" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>
      <!-- голова, гребень, клюв -->
      <circle cx="152" cy="74" r="20" fill="#2a2a34" ${sw(4)}/>
      <path d="M138 58 q2 -18 12 -12 q4 -14 14 -6 q8 -8 12 6 q-12 2 -20 12z" fill="#c8603a" ${sw(3)}/>
      <path d="M170 74 l22 6 l-22 6z" fill="#e6c45a" ${sw(3)}/>
      <path d="M164 88 q4 14 -6 16 q-4 -8 2 -16z" fill="#c8423a" ${sw(2.5)}/>
      <circle cx="156" cy="70" r="5" fill="#ff5a4a"/><circle cx="157" cy="69" r="1.6" fill="#fff"/>
      <!-- лапы на шесте -->
      <path d="M110 166 l-4 8 M120 168 v8 M130 166 l4 8" ${sw(3.5)}/>
    `, 'char boss'),

    wolf: () => svg('0 0 240 240', `
      <defs><radialGradient id="wolfEye"><stop offset="0" stop-color="#ffcf6b"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient></defs>
      <!-- туловище и грива -->
      <path d="M40 224 Q30 150 70 120 Q120 92 170 120 Q210 150 200 224z" fill="#3c3a78" ${sw(4)}/>
      <path d="M56 140 l-14 -10 l18 0 l-10 -16 l20 8 l0 -18 l14 14 l8 -18 l8 18 M184 140 l14 -10 l-18 0 l10 -16 l-20 8 l0 -18 l-14 14 l-8 -18 l-8 18" fill="#3c3a78" ${sw(3)}/>
      <!-- звёзды в шерсти -->
      <g fill="#fff6dc"><circle cx="80" cy="170" r="2"/><circle cx="104" cy="196" r="1.5"/><circle cx="150" cy="180" r="2.2"/><circle cx="170" cy="204" r="1.6"/><circle cx="64" cy="204" r="1.4"/><circle cx="128" cy="210" r="1.8"/></g>
      <path d="M80 170 L104 196 L128 210 M150 180 L170 204" stroke="#fff6dc" stroke-width="1" opacity="0.5"/>
      <!-- голова -->
      <path d="M78 104 L64 40 L100 72 Q120 64 140 72 L176 40 L162 104 Q170 140 120 162 Q70 140 78 104z" fill="#4a4690" ${sw(4)}/>
      <path d="M72 52 L96 76 M168 52 L144 76" stroke="#6a5a9a" stroke-width="5" stroke-linecap="round"/>
      <!-- морда -->
      <path d="M96 118 Q120 108 144 118 Q140 150 120 156 Q100 150 96 118z" fill="#6e68aa" ${sw(3)}/>
      <ellipse cx="120" cy="124" rx="10" ry="7" fill="${O}"/>
      <path d="M106 144 l4 8 l4 -6 l6 8 l6 -8 l4 6 l4 -8" fill="#f2efe6" ${sw(2)}/>
      <!-- глаза -->
      <circle cx="98" cy="100" r="14" fill="url(#wolfEye)"/><circle cx="142" cy="100" r="14" fill="url(#wolfEye)"/>
      <path d="M88 98 L108 96 L100 106z" fill="#ffcf6b" ${sw(2)}/>
      <path d="M152 98 L132 96 L140 106z" fill="#ffcf6b" ${sw(2)}/>
      <!-- пар изо рта -->
      <g fill="#cfe6ff" opacity="0.5"><circle cx="150" cy="166" r="8"/><circle cx="164" cy="160" r="6"/><circle cx="176" cy="152" r="4"/></g>
    `, 'char boss'),

    troll: () => svg('0 0 240 240', `
      <!-- дубина из доски моста -->
      <g transform="rotate(-24 196 120)">
        <rect x="184" y="40" width="26" height="140" rx="4" fill="#8a6a4a" ${sw(3.5)}/>
        <path d="M184 70 h26 M184 110 h26" ${sw(2)} opacity="0.6"/>
        <circle cx="192" cy="54" r="2.5" fill="#cfd6e6"/><circle cx="202" cy="90" r="2.5" fill="#cfd6e6"/>
      </g>
      <!-- туловище -->
      <path d="M44 226 Q36 140 78 116 Q120 96 162 116 Q204 140 196 226z" fill="#6a7a8a" ${sw(4)}/>
      <path d="M70 150 Q120 132 170 150 L172 226 H68z" fill="#6a5a3a" ${sw(3)}/>
      <path d="M68 170 h104" stroke="#4a3a2a" stroke-width="5"/>
      <!-- руки -->
      <path d="M58 140 Q24 168 40 204" stroke="#6a7a8a" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M58 140 Q24 168 40 204" stroke="${O}" stroke-width="3" fill="none" opacity="0.4"/>
      <!-- табличка «Плата» -->
      <g transform="rotate(-8 44 206)">
        <rect x="14" y="190" width="64" height="30" rx="3" fill="#d8c59c" ${sw(3)}/>
        <text x="46" y="211" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="bold" fill="#5a2a26">${tr('ПЛАТА')}</text>
      </g>
      <!-- голова -->
      <ellipse cx="120" cy="84" rx="50" ry="44" fill="#7a8a9a" ${sw(4)}/>
      <!-- мох-волосы и сосульки на бровях -->
      <path d="M74 66 Q90 30 120 36 Q154 32 168 68 Q150 52 132 58 Q118 46 104 58 Q88 52 74 66z" fill="#4f7a4a" ${sw(3)}/>
      <path d="M86 78 h26 M128 78 h26" ${sw(6)}/>
      <path d="M92 80 l3 10 l3 -10 M104 80 l2 8 l2 -8 M136 80 l3 10 l3 -10 M148 80 l2 7 l2 -7" fill="#cfe6ff" ${sw(1.5)}/>
      <circle cx="100" cy="94" r="5" fill="${O}"/><circle cx="140" cy="94" r="5" fill="${O}"/>
      <!-- нос и клыки -->
      <path d="M120 88 Q138 104 124 116 Q112 118 110 106 Q108 94 120 88z" fill="#8a9aaa" ${sw(3)}/>
      <path d="M94 116 Q120 132 146 116" ${sw(4)} fill="none"/>
      <path d="M100 120 l4 -14 l6 16z M140 120 l-4 -14 l-6 16z" fill="#f2efe6" ${sw(2)}/>
    `, 'char boss'),

    hollowpost: () => svg('0 0 240 240', `
      <defs><radialGradient id="voidG"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#1a1428"/></radialGradient></defs>
      <!-- шлейф тени вместо ног -->
      <path d="M76 190 Q60 220 40 230 Q90 226 120 236 Q150 226 200 230 Q180 220 164 190z" fill="#15122a" opacity="0.8"/>
      <!-- пальто без хозяина -->
      <path d="M70 92 Q52 150 70 210 Q120 222 170 210 Q188 150 170 92 Q120 76 70 92z" fill="#3e3658" ${sw(4)}/>
      <path d="M120 96 V212" ${sw(3)}/>
      <g fill="#b8862e" ${sw(1.5)}><circle cx="128" cy="124" r="3.5"/><circle cx="128" cy="150" r="3.5"/><circle cx="128" cy="176" r="3.5"/></g>
      <!-- пустые рукава -->
      <path d="M70 100 Q36 130 40 176 L58 178 Q58 140 82 118z" fill="#3e3658" ${sw(3.5)}/>
      <path d="M170 100 Q204 130 200 176 L182 178 Q182 140 158 118z" fill="#3e3658" ${sw(3.5)}/>
      <ellipse cx="49" cy="178" rx="10" ry="5" fill="url(#voidG)" ${sw(2)}/>
      <ellipse cx="191" cy="178" rx="10" ry="5" fill="url(#voidG)" ${sw(2)}/>
      <!-- сумка с чёрными письмами -->
      <path d="M78 98 Q130 140 174 196" stroke="#3a2a22" stroke-width="7" fill="none"/>
      <path d="M150 178 h52 v34 q0 6 -6 6 h-40 q-6 0 -6 -6z" fill="#4a3428" ${sw(3.5)}/>
      <g ${sw(2)}><rect x="156" y="164" width="22" height="16" rx="2" fill="#1a1428" transform="rotate(-14 167 172)"/><rect x="174" y="160" width="22" height="16" rx="2" fill="#1a1428" transform="rotate(10 185 168)"/></g>
      <circle cx="167" cy="172" r="3" fill="#8a4ab0"/><circle cx="185" cy="168" r="3" fill="#8a4ab0"/>
      <path d="M148 178 h56 v10 q-28 8 -56 0z" fill="#5a4030" ${sw(3)}/>
      <!-- воротник и пустота -->
      <path d="M86 92 L104 74 L120 88 L136 74 L154 92 Q120 106 86 92z" fill="#504470" ${sw(3)}/>
      <ellipse cx="120" cy="72" rx="28" ry="24" fill="url(#voidG)" ${sw(3.5)}/>
      <circle cx="110" cy="72" r="4" fill="#cfe6ff"/><circle cx="130" cy="72" r="4" fill="#cfe6ff"/>
      <circle cx="110" cy="72" r="9" fill="#cfe6ff" opacity="0.2"/><circle cx="130" cy="72" r="9" fill="#cfe6ff" opacity="0.2"/>
      <!-- фуражка -->
      <path d="M88 52 Q120 22 152 52 L148 60 Q120 48 92 60z" fill="#1e1a2c" ${sw(3.5)}/>
      <path d="M86 56 Q120 50 160 56 L162 64 Q120 58 84 64z" fill="#14101e" ${sw(3)}/>
      <circle cx="120" cy="44" r="4.5" fill="#b8862e" ${sw(1.5)}/>
    `, 'char boss'),

    skywhale: () => svg('0 0 260 240', `
      <defs><radialGradient id="starIn"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.4" stop-color="#ffcf6b" stop-opacity="0.7"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient></defs>
      <!-- звёздный фонтан -->
      <g fill="#fff6dc"><circle cx="150" cy="40" r="3"/><circle cx="136" cy="24" r="2"/><circle cx="166" cy="20" r="2.4"/><circle cx="150" cy="8" r="1.6"/><circle cx="178" cy="36" r="1.8"/><circle cx="124" cy="40" r="1.6"/></g>
      <path d="M150 70 Q146 54 150 44 Q154 54 150 70" stroke="#cfe6ff" stroke-width="3" fill="none"/>
      <!-- хвост -->
      <path d="M40 120 Q14 96 6 70 Q30 84 44 96 Q34 70 40 50 Q56 82 60 118z" fill="#1a2450" ${sw(4)}/>
      <!-- тело -->
      <path d="M50 124 Q60 70 150 70 Q236 72 246 140 Q248 186 196 196 Q120 206 76 178 Q54 160 50 124z" fill="#1a2450" ${sw(4)}/>
      <!-- брюхо с полосами -->
      <path d="M86 170 Q140 200 236 160 Q230 186 196 196 Q120 206 86 170z" fill="#3a4a80" ${sw(3)}/>
      <path d="M110 182 l8 14 M134 188 l6 14 M160 190 l4 12 M186 186 l2 12 M210 178 l0 12" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
      <!-- созвездия на спине -->
      <g stroke="#fff6dc" stroke-width="1.2" opacity="0.7" fill="none"><path d="M96 104 L120 92 L146 100 L170 88 L196 100"/><path d="M120 92 L128 120 L156 126"/></g>
      <g fill="#fff6dc"><circle cx="96" cy="104" r="2.6"/><circle cx="120" cy="92" r="2.2"/><circle cx="146" cy="100" r="3"/><circle cx="170" cy="88" r="2"/><circle cx="196" cy="100" r="2.6"/><circle cx="128" cy="120" r="2"/><circle cx="156" cy="126" r="2.4"/></g>
      <!-- плавник -->
      <path d="M140 160 Q150 196 120 214 Q124 186 116 168z" fill="#24306a" ${sw(3.5)}/>
      <!-- глаз и рот -->
      <circle cx="210" cy="132" r="9" fill="#f2efe6" ${sw(3)}/><circle cx="212" cy="132" r="5" fill="${O}"/><circle cx="213" cy="130" r="1.8" fill="#ffcf6b"/>
      <path d="M200 156 Q226 164 244 150" ${sw(3.5)} fill="none"/>
      <!-- проглоченная звезда светится внутри -->
      <circle cx="176" cy="150" r="16" fill="url(#starIn)"/>
    `, 'char boss'),

    shadowking: () => svg('0 0 240 240', `
      <defs>
        <radialGradient id="eyeGlow"><stop offset="0" stop-color="#ffb347" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        <linearGradient id="capeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2448"/><stop offset="1" stop-color="#15122a"/></linearGradient>
      </defs>
      <!-- клочья тени у земли -->
      <g fill="#15122a" opacity="0.55">
        <path d="M30 220 q20 -24 40 -4 q-10 18 -40 4z"/><path d="M170 222 q24 -26 44 -2 q-14 16 -44 2z"/>
      </g>
      <!-- летающие письма -->
      <g ${sw(2.5)} opacity="0.85">
        <g transform="rotate(-18 36 92)"><rect x="18" y="80" width="36" height="24" rx="2" fill="#f2e6c9"/><path d="M18 80 l18 13 l18 -13" fill="none"/></g>
        <g transform="rotate(14 206 70)"><rect x="190" y="58" width="32" height="22" rx="2" fill="#f2e6c9"/><path d="M190 58 l16 12 l16 -12" fill="none"/></g>
      </g>
      <!-- плащ -->
      <path d="M120 70 Q60 90 50 150 Q42 196 40 226 Q56 212 66 228 Q78 210 90 230 Q104 212 120 232 Q136 212 150 230 Q162 210 174 228 Q184 212 200 226 Q198 196 190 150 Q180 90 120 70z" fill="url(#capeG)" ${sw(4)}/>
      <path d="M120 96 Q92 130 96 222 M120 96 Q148 130 144 222" stroke="#3d3566" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- воротник -->
      <path d="M78 98 L92 70 L120 92 L148 70 L162 98 Q120 118 78 98z" fill="#3a2f5e" ${sw(3.5)}/>
      <!-- голова -->
      <ellipse cx="120" cy="70" rx="30" ry="32" fill="#1a1630" ${sw(4)}/>
      <!-- корона -->
      <path d="M92 48 L90 18 L104 36 L112 8 L120 32 L128 8 L136 36 L150 18 L148 48 Q120 40 92 48z" fill="#b8862e" ${sw(3.5)}/>
      <circle cx="120" cy="40" r="4" fill="#7a3a8a" ${sw(2)}/>
      <!-- глаза -->
      <circle cx="107" cy="68" r="14" fill="url(#eyeGlow)"/><circle cx="133" cy="68" r="14" fill="url(#eyeGlow)"/>
      <path d="M98 64 L114 70 L100 74z" fill="#ffcf6b"/>
      <path d="M142 64 L126 70 L140 74z" fill="#ffcf6b"/>
      <!-- ухмылка -->
      <path d="M104 86 Q120 98 136 86 Q120 92 104 86z" fill="#f3e0c0" ${sw(2.5)}/>
      <!-- руки с когтями держат письмо -->
      <path d="M70 140 Q86 158 102 160" ${sw(4)} fill="none"/>
      <path d="M170 140 Q154 158 138 160" ${sw(4)} fill="none"/>
      <g transform="rotate(-6 120 162)">
        <rect x="96" y="148" width="48" height="32" rx="3" fill="#f2e6c9" ${sw(3)}/>
        <path d="M96 148 l24 18 l24 -18" fill="none" ${sw(2.5)}/>
        <circle cx="120" cy="168" r="5" fill="#c8423a" ${sw(2)}/>
      </g>
      <path d="M96 158 l-8 -4 M96 164 l-9 0 M144 158 l8 -4 M144 164 l9 0" ${sw(3)}/>
    `, 'char boss'),

    /* ---------- Город (стадия I) ---------- */
    snowimp: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="206" rx="56" ry="8" fill="#000" opacity="0.15"/>
      <!-- руки-веточки -->
      <path d="M52 132 L18 110 M30 118 L22 100 M148 132 L182 104" ${sw(4)}/>
      <circle cx="184" cy="100" r="13" fill="#eef4fb" ${sw(3)}/>
      <!-- тело-снежок -->
      <circle cx="100" cy="140" r="60" fill="#eef4fb" ${sw(4)}/>
      <path d="M50 160 Q100 206 150 160 Q140 196 100 200 Q60 196 50 160z" fill="#c8d6ea"/>
      <!-- рожки-льдинки -->
      <path d="M66 92 l-8 -26 l18 16z M134 92 l8 -26 l-18 16z" fill="#bfe3f7" ${sw(3)}/>
      <!-- лицо -->
      <path d="M70 116 l20 8 M130 116 l-20 8" ${sw(4)}/>
      <circle cx="82" cy="132" r="7" fill="${O}"/><circle cx="118" cy="132" r="7" fill="${O}"/>
      <circle cx="84" cy="130" r="2" fill="#fff"/><circle cx="120" cy="130" r="2" fill="#fff"/>
      <path d="M78 156 Q100 176 124 154 Q100 164 78 156z" fill="#5a2a3a" ${sw(3)}/>
      <rect x="96" y="158" width="8" height="7" fill="#fff" ${sw(1.5)}/>
    `, 'char'),

    icicle: () => svg('0 0 200 220', `
      <!-- кусок сугроба с крыши -->
      <path d="M30 40 Q100 10 170 40 L170 58 Q100 70 30 58z" fill="#eef4fb" ${sw(4)}/>
      <!-- сосулька -->
      <path d="M58 56 Q100 66 142 56 L104 214 Q100 220 96 214z" fill="#bfe3f7" ${sw(4)}/>
      <path d="M76 64 L98 196" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
      <path d="M124 62 L112 150" stroke="#8ec6e6" stroke-width="5" stroke-linecap="round"/>
      <!-- маленькие сосульки -->
      <path d="M40 56 l6 30 l6 -30z M150 56 l6 24 l6 -24z" fill="#bfe3f7" ${sw(2.5)}/>
      <!-- сердитое лицо -->
      <path d="M78 92 l18 8 M122 92 l-18 8" ${sw(4)}/>
      <ellipse cx="88" cy="108" rx="5" ry="6" fill="${O}"/><ellipse cx="112" cy="108" rx="5" ry="6" fill="${O}"/>
      <path d="M88 134 Q100 126 112 134" ${sw(3.5)} fill="none"/>
      <!-- капля -->
      <path d="M100 218 q4 8 0 12 q-4 -4 0 -12z" fill="#9fd8ff" ${sw(1.5)}/>
    `, 'char'),

    pigeon: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="208" rx="60" ry="8" fill="#000" opacity="0.15"/>
      <!-- хвост -->
      <path d="M150 150 L192 170 L184 186 L146 172z" fill="#6a7286" ${sw(3.5)}/>
      <!-- тело -->
      <ellipse cx="104" cy="148" rx="62" ry="50" fill="#8a93a6" ${sw(4)}/>
      <path d="M86 152 Q120 140 152 158 Q130 188 96 182z" fill="#737c90" ${sw(3)}/>
      <path d="M100 160 Q124 154 144 164 M98 172 Q118 166 136 174" ${sw(2)} fill="none" opacity="0.6"/>
      <!-- шея с переливом -->
      <path d="M58 132 Q56 96 74 84 Q100 80 108 104 Q104 130 86 140z" fill="#5fa08a" ${sw(3.5)}/>
      <path d="M70 120 Q84 112 100 118" stroke="#8a6ab0" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- голова -->
      <circle cx="80" cy="74" r="26" fill="#9aa3b6" ${sw(4)}/>
      <path d="M56 78 L36 84 L56 88z" fill="#4a4550" ${sw(3)}/>
      <circle cx="72" cy="70" r="7" fill="#ff9a3c" ${sw(2.5)}/><circle cx="72" cy="70" r="3" fill="${O}"/>
      <!-- лапки -->
      <path d="M90 196 v12 l-8 4 M90 208 l8 4 M118 194 v14 l-8 4 M118 208 l8 4" stroke="#d8655a" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- сплетня -->
      <path d="M118 30 h60 q8 0 8 8 v22 q0 8 -8 8 h-40 l-12 12 l2 -12 h-10 q-8 0 -8 -8 v-22 q0 -8 8 -8z" fill="#f2e6c9" ${sw(3)}/>
      <circle cx="134" cy="49" r="3.5" fill="${O}"/><circle cx="148" cy="49" r="3.5" fill="${O}"/><circle cx="162" cy="49" r="3.5" fill="${O}"/>
    `, 'char'),

    scarfsnake: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="206" rx="70" ry="8" fill="#000" opacity="0.15"/>
      <defs><pattern id="knit" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#c8423a"/><rect y="12" width="24" height="12" fill="#f2e6c9"/></pattern></defs>
      <!-- вязаное тело -->
      <path d="M40 200 Q20 160 60 150 Q110 140 120 112 Q130 80 96 76 Q72 76 70 96" fill="none" stroke="${O}" stroke-width="36" stroke-linecap="round"/>
      <path d="M40 200 Q20 160 60 150 Q110 140 120 112 Q130 80 96 76 Q72 76 70 96" fill="none" stroke="url(#knit)" stroke-width="28" stroke-linecap="round"/>
      <!-- кисточки хвоста -->
      <path d="M36 196 l-14 16 M42 200 l-4 20 M48 198 l6 18" stroke="#c8423a" stroke-width="4" stroke-linecap="round"/>
      <!-- голова -->
      <ellipse cx="74" cy="92" rx="34" ry="28" fill="#c8423a" ${sw(4)}/>
      <path d="M44 86 h60 M44 100 h60" stroke="#f2e6c9" stroke-width="6" opacity="0.8"/>
      <!-- глаза-пуговицы -->
      <circle cx="62" cy="84" r="8" fill="#3a2a22" ${sw(2.5)}/><circle cx="88" cy="84" r="8" fill="#3a2a22" ${sw(2.5)}/>
      <g fill="#f2e6c9"><circle cx="60" cy="82" r="1.5"/><circle cx="64" cy="86" r="1.5"/><circle cx="86" cy="82" r="1.5"/><circle cx="90" cy="86" r="1.5"/></g>
      <!-- язык -->
      <path d="M74 118 v16 l-6 6 M74 134 l6 6" stroke="#d8655a" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    `, 'char'),

    sootmouse: () => svg('0 0 200 220', `
      <!-- облако сажи -->
      <g fill="#3a3640" opacity="0.5"><circle cx="40" cy="190" r="18"/><circle cx="160" cy="196" r="16"/><circle cx="64" cy="204" r="12"/></g>
      <!-- хвост -->
      <path d="M140 178 Q190 170 180 130 Q176 116 166 122" stroke="${O}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M140 178 Q190 170 180 130 Q176 116 166 122" stroke="#6a5a6a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- тело -->
      <ellipse cx="100" cy="160" rx="50" ry="44" fill="#4a4550" ${sw(4)}/>
      <ellipse cx="100" cy="170" rx="28" ry="26" fill="#6a6470"/>
      <!-- уши -->
      <circle cx="58" cy="78" r="26" fill="#4a4550" ${sw(4)}/><circle cx="58" cy="78" r="14" fill="#d88a9a"/>
      <circle cx="142" cy="78" r="26" fill="#4a4550" ${sw(4)}/><circle cx="142" cy="78" r="14" fill="#d88a9a"/>
      <!-- голова -->
      <ellipse cx="100" cy="108" rx="40" ry="34" fill="#55505c" ${sw(4)}/>
      <ellipse cx="84" cy="102" rx="7" ry="8" fill="#ffcf6b" ${sw(2)}/><ellipse cx="116" cy="102" rx="7" ry="8" fill="#ffcf6b" ${sw(2)}/>
      <ellipse cx="84" cy="103" rx="2.5" ry="5" fill="${O}"/><ellipse cx="116" cy="103" rx="2.5" ry="5" fill="${O}"/>
      <circle cx="100" cy="124" r="6" fill="#d88a9a" ${sw(2)}/>
      <path d="M86 126 l-22 -4 M86 130 l-22 4 M114 126 l22 -4 M114 130 l22 4" ${sw(1.5)}/>
      <!-- спичка -->
      <path d="M140 170 L172 130" stroke="#d8b878" stroke-width="5" stroke-linecap="round"/>
      <circle cx="174" cy="128" r="5" fill="#c8423a" ${sw(2)}/>
      <path d="M174 122 q-6 -10 0 -18 q6 8 0 18z" fill="#ffb23e" ${sw(1.5)}/>
    `, 'char'),

    mailbox: () => svg('0 0 200 220', `
      <!-- столб -->
      <rect x="90" y="150" width="20" height="66" fill="#5a4636" ${sw(3.5)}/>
      <!-- ящик -->
      <path d="M42 70 Q42 40 100 40 Q158 40 158 70 V156 H42z" fill="#2f5d9a" ${sw(4)}/>
      <path d="M42 70 Q42 40 100 40 Q158 40 158 70" fill="none" stroke="#5a88c8" stroke-width="6" transform="translate(0 6)"/>
      <!-- флажок -->
      <path d="M158 80 h20 v-24 h-14" fill="none" ${sw(3.5)}/><rect x="164" y="56" width="16" height="12" fill="#c8423a" ${sw(2.5)}/>
      <!-- глаза на крышке -->
      <circle cx="78" cy="72" r="11" fill="#fff" ${sw(3)}/><circle cx="122" cy="72" r="11" fill="#fff" ${sw(3)}/>
      <circle cx="80" cy="74" r="5" fill="${O}"/><circle cx="120" cy="74" r="5" fill="${O}"/>
      <path d="M64 56 l24 8 M136 56 l-24 8" ${sw(4)}/>
      <!-- щель-пасть с зубами -->
      <rect x="56" y="100" width="88" height="30" rx="6" fill="#1a1428" ${sw(3.5)}/>
      <path d="M58 102 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 M58 128 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9 l8 -9 l8 9" fill="#f2efe6" ${sw(1.5)}/>
      <!-- письмо-язык -->
      <g transform="rotate(12 100 136)"><rect x="82" y="124" width="36" height="26" rx="2" fill="#f2e6c9" ${sw(2.5)}/><path d="M82 124 l18 13 l18 -13" fill="none" ${sw(2)}/></g>
    `, 'char'),

    /* ---------- Окраина (стадия II) ---------- */
    shadowthief: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="208" rx="50" ry="7" fill="#000" opacity="0.25"/>
      <!-- мешок с украденным светом -->
      <defs><radialGradient id="sackGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.8"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
      <circle cx="150" cy="96" r="44" fill="url(#sackGlow)"/>
      <path d="M126 112 Q118 66 150 60 Q182 66 174 112 Q150 124 126 112z" fill="#8a6a4a" ${sw(3.5)}/>
      <path d="M140 64 Q150 52 160 64" ${sw(3)} fill="none"/>
      <path d="M140 100 q10 -14 20 0" stroke="#ffd27a" stroke-width="3" fill="none"/>
      <!-- тень -->
      <path d="M50 206 Q38 140 66 104 Q100 70 132 104 Q150 140 146 206 Q134 194 124 208 Q112 192 100 208 Q86 192 74 208 Q62 194 50 206z" fill="#1e1a33" ${sw(4)}/>
      <path d="M130 116 Q146 112 150 96" stroke="#1e1a33" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M130 116 Q146 112 150 96" ${sw(3)} fill="none" opacity="0.4"/>
      <!-- глаза -->
      <ellipse cx="84" cy="126" rx="9" ry="5" fill="#f2f0ff" transform="rotate(12 84 126)"/>
      <ellipse cx="112" cy="126" rx="9" ry="5" fill="#f2f0ff" transform="rotate(-12 112 126)"/>
      <path d="M86 152 Q98 160 110 152" stroke="#f2f0ff" stroke-width="3" fill="none" stroke-linecap="round"/>
    `, 'char'),

    bat: () => svg('0 0 220 200', `
      <!-- крылья -->
      <path d="M110 100 Q70 40 10 60 Q30 76 26 96 Q44 90 52 108 Q70 98 82 116z" fill="#4a3a6a" ${sw(4)}/>
      <path d="M110 100 Q150 40 210 60 Q190 76 194 96 Q176 90 168 108 Q150 98 138 116z" fill="#4a3a6a" ${sw(4)}/>
      <path d="M26 96 L72 80 M52 108 L84 90 M194 96 L148 80 M168 108 L136 90" stroke="#6a5a90" stroke-width="3"/>
      <!-- тело -->
      <ellipse cx="110" cy="122" rx="32" ry="40" fill="#3a2e54" ${sw(4)}/>
      <!-- уши -->
      <path d="M86 92 L80 52 L102 82z M134 92 L140 52 L118 82z" fill="#3a2e54" ${sw(3.5)}/>
      <path d="M86 84 L84 62 L96 80z M134 84 L136 62 L124 80z" fill="#d88a9a"/>
      <!-- глаза и клыки -->
      <ellipse cx="98" cy="108" rx="8" ry="9" fill="#ffcf6b" ${sw(2.5)}/><ellipse cx="122" cy="108" rx="8" ry="9" fill="#ffcf6b" ${sw(2.5)}/>
      <ellipse cx="98" cy="110" rx="3" ry="5" fill="${O}"/><ellipse cx="122" cy="110" rx="3" ry="5" fill="${O}"/>
      <path d="M98 130 Q110 138 122 130" ${sw(3)} fill="none"/>
      <path d="M102 132 l3 8 l3 -7 M112 133 l3 7 l3 -8" fill="#fff" ${sw(1.5)}/>
      <!-- лапки -->
      <path d="M100 160 l-4 12 M120 160 l4 12" ${sw(3.5)}/>
    `, 'char'),

    stump: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="208" rx="70" ry="8" fill="#000" opacity="0.2"/>
      <!-- корни-ноги -->
      <path d="M50 190 Q36 206 22 206 M76 196 Q72 212 60 216 M124 196 Q130 212 142 216 M150 190 Q164 206 178 204" ${sw(8)} stroke="#5a4030"/>
      <path d="M50 190 Q36 206 22 206 M76 196 Q72 212 60 216 M124 196 Q130 212 142 216 M150 190 Q164 206 178 204" ${sw(2.5)} fill="none" opacity="0.5"/>
      <!-- ствол -->
      <path d="M44 196 Q38 120 50 76 H150 Q162 120 156 196z" fill="#6a4a34" ${sw(4)}/>
      <path d="M64 100 Q60 150 66 190 M136 96 Q142 150 134 190 M100 120 v60" stroke="#4a3424" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- спил со снегом и кольцами -->
      <ellipse cx="100" cy="76" rx="50" ry="16" fill="#c8a07a" ${sw(4)}/>
      <ellipse cx="100" cy="76" rx="30" ry="9" fill="none" stroke="#9a7458" stroke-width="2.5"/>
      <path d="M52 74 Q70 56 100 58 Q132 56 150 72 Q130 66 116 70 Q100 62 86 70 Q66 64 52 74z" fill="#eef4fb" ${sw(3)}/>
      <!-- грибы -->
      <path d="M150 128 q14 -10 22 4 z" fill="#c8423a" ${sw(2.5)}/><path d="M160 130 v8" ${sw(3)}/>
      <!-- лицо в коре -->
      <path d="M72 116 l18 6 M128 116 l-18 6" ${sw(4)}/>
      <ellipse cx="82" cy="132" rx="7" ry="9" fill="#1a1020"/><ellipse cx="118" cy="132" rx="7" ry="9" fill="#1a1020"/>
      <circle cx="82" cy="132" r="2.5" fill="#9be7a0"/><circle cx="118" cy="132" r="2.5" fill="#9be7a0"/>
      <path d="M82 160 Q100 150 118 160 Q100 170 82 160z" fill="#1a1020" ${sw(2.5)}/>
      <!-- руки-ветки -->
      <path d="M46 120 L14 96 M26 106 L18 86 M154 120 L186 100 M174 108 L186 90" ${sw(5)} stroke="#5a4030"/>
    `, 'char'),

    frostfox: () => svg('0 0 210 210', `
      <ellipse cx="100" cy="198" rx="64" ry="8" fill="#000" opacity="0.15"/>
      <!-- хвост с кристаллами -->
      <path d="M130 180 Q200 190 196 130 Q190 100 166 110 Q180 140 140 156z" fill="#e8f2fb" ${sw(4)}/>
      <path d="M176 120 l6 -12 l4 12z M188 142 l10 -6 l-2 12z" fill="#9fd8ff" ${sw(2)}/>
      <!-- тело -->
      <path d="M60 196 Q50 140 76 116 Q100 100 124 116 Q148 140 140 196z" fill="#d8e8f6" ${sw(4)}/>
      <path d="M84 196 Q86 150 100 132 Q114 150 116 196z" fill="#ffffff" ${sw(2.5)}/>
      <!-- голова -->
      <path d="M58 70 L66 24 L88 54 Q100 50 112 54 L134 24 L142 70 Q148 96 100 120 Q52 96 58 70z" fill="#e8f2fb" ${sw(4)}/>
      <path d="M66 32 L82 54 M134 32 L118 54" stroke="#9fb8d8" stroke-width="5" stroke-linecap="round"/>
      <path d="M76 86 Q100 80 124 86 Q114 110 100 116 Q86 110 76 86z" fill="#ffffff"/>
      <circle cx="100" cy="108" r="6" fill="${O}"/>
      <!-- хитрые глаза -->
      <path d="M72 76 Q82 70 92 78 Q82 82 72 76z" fill="#5ab8e0" ${sw(2.5)}/>
      <path d="M128 76 Q118 70 108 78 Q118 82 128 76z" fill="#5ab8e0" ${sw(2.5)}/>
      <path d="M86 112 Q100 120 114 110" ${sw(2.5)} fill="none"/>
    `, 'char'),

    wisp: () => svg('0 0 200 220', `
      <defs><radialGradient id="wispG"><stop offset="0" stop-color="#e8fbff"/><stop offset="0.5" stop-color="#7ad6ff"/><stop offset="1" stop-color="#3a7ad0"/></radialGradient>
        <radialGradient id="wispGlow"><stop offset="0" stop-color="#7ad6ff" stop-opacity="0.6"/><stop offset="1" stop-color="#7ad6ff" stop-opacity="0"/></radialGradient></defs>
      <circle cx="100" cy="110" r="96" fill="url(#wispGlow)"/>
      <!-- хвост-пламя -->
      <path d="M100 30 Q150 60 146 110 Q144 150 112 170 Q130 190 104 214 Q108 192 90 180 Q50 160 54 110 Q56 70 100 30z" fill="url(#wispG)" ${sw(4)}/>
      <path d="M100 52 Q132 80 128 110" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>
      <!-- пустые глаза -->
      <ellipse cx="84" cy="112" rx="9" ry="13" fill="#1a2a4a"/><ellipse cx="116" cy="112" rx="9" ry="13" fill="#1a2a4a"/>
      <path d="M90 144 Q100 150 110 144" stroke="#1a2a4a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- искры -->
      <g fill="#e8fbff"><circle cx="40" cy="70" r="3"/><circle cx="164" cy="56" r="2.5"/><circle cx="170" cy="150" r="3"/><circle cx="34" cy="160" r="2"/></g>
    `, 'char'),

    raven: () => svg('0 0 210 220', `
      <ellipse cx="100" cy="208" rx="56" ry="8" fill="#000" opacity="0.2"/>
      <!-- хвост -->
      <path d="M120 176 L170 210 L150 214 L112 186z" fill="#1a1a24" ${sw(3.5)}/>
      <!-- тело -->
      <path d="M50 130 Q50 80 92 70 Q136 66 146 112 Q152 170 112 192 Q70 200 56 170 Q48 150 50 130z" fill="#22222e" ${sw(4)}/>
      <path d="M104 100 Q140 104 144 150 Q120 150 100 132z" fill="#2e2e40" ${sw(3)}/>
      <path d="M112 112 Q132 120 136 140" stroke="#5a6a9a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- голова -->
      <circle cx="80" cy="74" r="30" fill="#22222e" ${sw(4)}/>
      <path d="M52 78 L14 92 L52 94z" fill="#3a3a48" ${sw(3)}/>
      <!-- очки -->
      <circle cx="74" cy="70" r="11" fill="#cfe6ff" fill-opacity="0.35" ${sw(3)}/>
      <circle cx="96" cy="70" r="9" fill="#cfe6ff" fill-opacity="0.35" ${sw(3)}/>
      <path d="M85 70 h2" ${sw(3)}/>
      <circle cx="74" cy="70" r="3.5" fill="#ffcf6b"/><circle cx="96" cy="70" r="3" fill="#ffcf6b"/>
      <!-- счёты -->
      <g transform="rotate(-8 60 160)">
        <rect x="24" y="136" width="70" height="50" rx="4" fill="#8a5a32" ${sw(3)}/>
        <rect x="30" y="142" width="58" height="38" fill="#3a2a22"/>
        <path d="M30 152 h58 M30 162 h58 M30 172 h58" stroke="#d8b878" stroke-width="1.5"/>
        <g fill="#e6c45a" ${sw(1)}><circle cx="38" cy="152" r="3.5"/><circle cx="46" cy="152" r="3.5"/><circle cx="74" cy="152" r="3.5"/><circle cx="54" cy="162" r="3.5"/><circle cx="80" cy="162" r="3.5"/><circle cx="38" cy="172" r="3.5"/><circle cx="62" cy="172" r="3.5"/><circle cx="70" cy="172" r="3.5"/></g>
      </g>
      <!-- лапы -->
      <path d="M92 192 l-6 12 M104 192 l4 12" ${sw(3.5)}/>
    `, 'char'),

    /* ---------- Элита ---------- */
    snowbrute: () => svg('0 0 220 240', `
      <ellipse cx="110" cy="230" rx="76" ry="8" fill="#000" opacity="0.15"/>
      <!-- нижний ком -->
      <circle cx="110" cy="176" r="58" fill="#eef4fb" ${sw(4)}/>
      <path d="M56 190 Q110 236 164 190 Q154 226 110 232 Q66 226 56 190z" fill="#c8d6ea"/>
      <!-- руки-палки с варежками -->
      <path d="M66 112 L20 70 M154 112 L198 64" ${sw(6)} stroke="#6a4a34"/>
      <circle cx="18" cy="66" r="15" fill="#c8423a" ${sw(3.5)}/><circle cx="200" cy="60" r="15" fill="#c8423a" ${sw(3.5)}/>
      <path d="M10 56 l6 6 M192 50 l6 6" ${sw(3)}/>
      <!-- верхний ком -->
      <circle cx="110" cy="96" r="46" fill="#eef4fb" ${sw(4)}/>
      <!-- шарф -->
      <path d="M66 126 Q110 146 154 126 L156 140 Q110 162 64 140z" fill="#2f5d9a" ${sw(3.5)}/>
      <path d="M128 140 l10 34 l-16 2z" fill="#2f5d9a" ${sw(3)}/>
      <!-- ведро-шлем -->
      <path d="M72 66 L80 22 H140 L148 66z" fill="#7b8794" ${sw(4)}/>
      <path d="M68 66 H152" ${sw(6)}/>
      <path d="M86 30 Q110 40 134 30" stroke="#9aa6b6" stroke-width="4" fill="none"/>
      <!-- угольные глаза и нос -->
      <path d="M84 80 l20 8 M136 80 l-20 8" ${sw(5)}/>
      <circle cx="94" cy="96" r="6" fill="${O}"/><circle cx="126" cy="96" r="6" fill="${O}"/>
      <path d="M108 104 L148 112 L108 116z" fill="#e8762c" ${sw(3)}/>
      <g fill="${O}"><circle cx="92" cy="122" r="3"/><circle cx="102" cy="126" r="3"/><circle cx="114" cy="126" r="3"/><circle cx="124" cy="122" r="3"/></g>
      <g fill="${O}"><circle cx="110" cy="166" r="5"/><circle cx="110" cy="190" r="5"/></g>
    `, 'char'),

    icebear: () => svg('0 0 220 240', `
      <ellipse cx="110" cy="230" rx="80" ry="8" fill="#000" opacity="0.18"/>
      <!-- тело -->
      <path d="M40 228 Q26 150 64 112 Q110 84 156 112 Q194 150 180 228z" fill="#dce8f4" ${sw(4)}/>
      <path d="M76 228 Q80 160 110 140 Q140 160 144 228z" fill="#f2f8ff" ${sw(2.5)}/>
      <!-- ледяные кристаллы на спине -->
      <path d="M60 122 l-10 -30 l22 18z M160 122 l10 -30 l-22 18z M84 104 l-2 -26 l14 20z M136 104 l2 -26 l-14 20z" fill="#9fd8ff" ${sw(2.5)}/>
      <!-- лапы с когтями -->
      <path d="M52 150 Q22 170 30 204" stroke="#dce8f4" stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M168 150 Q198 170 190 204" stroke="#dce8f4" stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M52 150 Q22 170 30 204 M168 150 Q198 170 190 204" ${sw(3)} fill="none" opacity="0.5"/>
      <path d="M20 210 l-4 10 M30 214 l0 10 M40 210 l4 10 M180 210 l-4 10 M190 214 l0 10 M200 210 l4 10" ${sw(3.5)}/>
      <!-- голова -->
      <circle cx="74" cy="56" r="16" fill="#dce8f4" ${sw(4)}/><circle cx="146" cy="56" r="16" fill="#dce8f4" ${sw(4)}/>
      <ellipse cx="110" cy="84" rx="48" ry="40" fill="#e8f2fb" ${sw(4)}/>
      <path d="M84 70 l18 8 M136 70 l-18 8" ${sw(4.5)}/>
      <circle cx="92" cy="84" r="5" fill="${O}"/><circle cx="128" cy="84" r="5" fill="${O}"/>
      <ellipse cx="110" cy="104" rx="20" ry="14" fill="#f8fbff" ${sw(3)}/>
      <ellipse cx="110" cy="98" rx="8" ry="5" fill="${O}"/>
      <path d="M100 112 l4 6 l6 -4 l6 4 l4 -6" fill="#fff" ${sw(2)}/>
      <!-- дыхание -->
      <g fill="#cfe6ff" opacity="0.6"><circle cx="146" cy="118" r="7"/><circle cx="160" cy="112" r="5"/></g>
    `, 'char'),

    lampghost: () => svg('0 0 200 240', `
      <defs><radialGradient id="lgGlow"><stop offset="0" stop-color="#b8f3ff" stop-opacity="0.7"/><stop offset="1" stop-color="#b8f3ff" stop-opacity="0"/></radialGradient></defs>
      <circle cx="100" cy="96" r="80" fill="url(#lgGlow)"/>
      <!-- призрачный шлейф вместо столба -->
      <path d="M78 150 Q60 196 74 236 Q90 220 100 238 Q110 220 126 236 Q140 196 122 150z" fill="#b8c8e0" fill-opacity="0.75" ${sw(3.5)}/>
      <!-- фонарь -->
      <path d="M100 18 v14" ${sw(4)}/>
      <path d="M62 36 h76 l-10 16 h-56z" fill="#2a3044" ${sw(3.5)}/>
      <path d="M68 52 h64 l-6 92 h-52z" fill="#3a4a6a" ${sw(3.5)}/>
      <path d="M74 58 h52 l-5 80 h-42z" fill="#b8f3ff" fill-opacity="0.85"/>
      <path d="M100 52 v92" ${sw(2.5)}/>
      <path d="M58 144 h84 l-8 12 h-68z" fill="#2a3044" ${sw(3.5)}/>
      <!-- лицо в стекле -->
      <ellipse cx="88" cy="90" rx="7" ry="11" fill="#1a2a4a"/><ellipse cx="112" cy="90" rx="7" ry="11" fill="#1a2a4a"/>
      <path d="M86 118 Q100 110 114 118 Q100 128 86 118z" fill="#1a2a4a"/>
      <!-- холодный огонёк -->
      <path d="M100 136 q-6 -8 0 -16 q6 8 0 16z" fill="#7ad6ff"/>
      <!-- руки-ленты -->
      <path d="M68 100 Q36 96 24 120 M132 100 Q164 96 176 120" stroke="#b8c8e0" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.8"/>
    `, 'char ghosty'),

    /* ---------- Новые: город ---------- */
    matryoshka: () => svg('0 0 200 220', `
      <ellipse cx="100" cy="210" rx="56" ry="8" fill="#000" opacity="0.15"/>
      <!-- тело -->
      <path d="M100 18 Q62 18 60 62 Q40 92 42 150 Q44 206 100 208 Q156 206 158 150 Q160 92 140 62 Q138 18 100 18z" fill="#c8423a" ${sw(4)}/>
      <path d="M62 96 Q52 130 58 176" stroke="#e8746a" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/>
      <!-- платок и лицо -->
      <ellipse cx="100" cy="66" rx="35" ry="33" fill="#f2c94c" ${sw(3.5)}/>
      <ellipse cx="100" cy="68" rx="26" ry="25" fill="#f8dcc0" ${sw(3)}/>
      <path d="M76 54 Q100 32 124 54 Q112 46 100 47 Q88 46 76 54z" fill="#5a3020" ${sw(2)}/>
      <path d="M83 62 l12 5 M117 62 l-12 5" ${sw(3.5)}/>
      <circle cx="90" cy="72" r="4" fill="${O}"/><circle cx="110" cy="72" r="4" fill="${O}"/>
      <circle cx="82" cy="82" r="5.5" fill="#e8746a" opacity="0.7"/><circle cx="118" cy="82" r="5.5" fill="#e8746a" opacity="0.7"/>
      <path d="M92 87 Q100 82 108 87" ${sw(3)} fill="none"/>
      <!-- шов, по которому она раскрывается -->
      <path d="M48 116 Q100 128 152 116" fill="none" ${sw(5)}/>
      <path d="M48 116 Q100 128 152 116" fill="none" stroke="#e6c45a" stroke-width="2.5"/>
      <!-- фартук с цветком -->
      <path d="M72 128 Q100 136 128 128 Q138 170 126 198 Q100 204 74 198 Q62 170 72 128z" fill="#f2e6c9" ${sw(3)}/>
      <path d="M100 176 q-14 4 -18 14 M100 176 q14 4 18 14" stroke="#3a7a4a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g fill="#c8423a" ${sw(2.5)}><circle cx="100" cy="148" r="8"/><circle cx="88" cy="158" r="8"/><circle cx="112" cy="158" r="8"/><circle cx="93" cy="171" r="8"/><circle cx="107" cy="171" r="8"/></g>
      <circle cx="100" cy="161" r="6" fill="#e6c45a" ${sw(2)}/>
    `, 'char'),

    samovar: () => svg('0 0 200 230', `
      <ellipse cx="100" cy="220" rx="62" ry="8" fill="#000" opacity="0.15"/>
      <!-- пар -->
      <path d="M92 26 q-12 -10 0 -20 M108 24 q-10 -10 2 -18" stroke="#e8eef6" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>
      <!-- ручки -->
      <path d="M50 86 q-26 4 -22 30 q4 14 22 10" fill="none" ${sw(7)}/>
      <path d="M150 86 q26 4 22 30 q-4 14 -22 10" fill="none" ${sw(7)}/>
      <path d="M50 86 q-26 4 -22 30 q4 14 22 10 M150 86 q26 4 22 30 q-4 14 -22 10" fill="none" stroke="#b07a2a" stroke-width="3"/>
      <!-- труба и крышка -->
      <rect x="88" y="28" width="24" height="22" fill="#b07a2a" ${sw(3.5)}/>
      <path d="M64 66 Q100 40 136 66z" fill="#d8a94a" ${sw(4)}/>
      <!-- тело -->
      <path d="M58 64 h84 q22 52 8 110 q-4 10 -14 12 h-72 q-10 -2 -14 -12 q-14 -58 8 -110z" fill="#d8a94a" ${sw(4)}/>
      <path d="M70 76 q-12 42 0 92" stroke="#ffe8a0" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.8"/>
      <path d="M62 82 h76" stroke="#b07a2a" stroke-width="4"/>
      <!-- кран -->
      <path d="M150 138 h22 v10 h-8 v12 h-8 v-12 h-6z" fill="#b07a2a" ${sw(3)}/>
      <path d="M168 166 q4 8 0 12 q-4 -4 0 -12z" fill="#9fd8ff" ${sw(1.5)}/>
      <!-- поддон и ножки -->
      <path d="M62 184 h76 l10 14 h-96z" fill="#b07a2a" ${sw(4)}/>
      <path d="M58 198 l-6 14 M142 198 l6 14 M100 198 v14" ${sw(5)}/>
      <!-- сердитое лицо -->
      <path d="M72 104 l20 8 M128 104 l-20 8" ${sw(4)}/>
      <ellipse cx="84" cy="120" rx="6" ry="7" fill="${O}"/><ellipse cx="116" cy="120" rx="6" ry="7" fill="${O}"/>
      <circle cx="86" cy="118" r="2" fill="#fff"/><circle cx="118" cy="118" r="2" fill="#fff"/>
      <circle cx="70" cy="138" r="8" fill="#e8502a" opacity="0.45"/><circle cx="130" cy="138" r="8" fill="#e8502a" opacity="0.45"/>
      <path d="M80 144 Q100 162 120 144 Q100 152 80 144z" fill="#5a2a1a" ${sw(3)}/>
    `, 'char'),

    cuckoo: () => svg('0 0 200 230', `
      <!-- гири-шишки на цепочках -->
      <path d="M78 150 v38 M122 150 v52" stroke="#6a5a4a" stroke-width="3" stroke-dasharray="4 3"/>
      <path d="M70 188 h16 l2 16 q-10 10 -20 0z" fill="#8a5a32" ${sw(3)}/>
      <path d="M114 202 h16 l2 14 q-10 10 -20 0z" fill="#8a5a32" ${sw(3)}/>
      <!-- маятник -->
      <path d="M100 150 v32" ${sw(3)}/>
      <circle cx="100" cy="190" r="10" fill="#e6c45a" ${sw(3)}/>
      <!-- крыша и домик -->
      <path d="M36 80 L100 22 L164 80z" fill="#6b3a1e" ${sw(4)}/>
      <path d="M52 74 L100 32 L148 74" fill="none" stroke="#8a5a32" stroke-width="5"/>
      <rect x="54" y="76" width="92" height="76" fill="#a06a3a" ${sw(4)}/>
      <path d="M54 92 h92" stroke="#8a5a32" stroke-width="3"/>
      <!-- циферблат -->
      <circle cx="100" cy="124" r="22" fill="#f2e6c9" ${sw(3.5)}/>
      <g fill="${O}"><circle cx="100" cy="107" r="2"/><circle cx="117" cy="124" r="2"/><circle cx="100" cy="141" r="2"/><circle cx="83" cy="124" r="2"/></g>
      <path d="M100 124 v-14 M100 124 l10 6" ${sw(3)}/>
      <!-- дверца и кукушка -->
      <rect x="86" y="46" width="28" height="28" rx="3" fill="#3a2418" ${sw(3)}/>
      <path d="M86 46 l-12 6 v26 l12 -4z" fill="#8a5a32" ${sw(2.5)}/>
      <circle cx="100" cy="58" r="13" fill="#7a8aa0" ${sw(3)}/>
      <path d="M108 54 l22 -4 l-20 8 l20 4 l-22 0z" fill="#e8a42a" ${sw(2.5)}/>
      <path d="M92 48 l12 5" ${sw(3)}/>
      <circle cx="101" cy="56" r="3.5" fill="${O}"/>
      <path d="M140 34 q8 -8 16 -4 M146 46 q10 -4 16 2" stroke="#fff3c4" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    `, 'char'),

    /* ---------- Новые: окраина ---------- */
    mist: () => svg('0 0 200 240', `
      <defs><radialGradient id="mistG"><stop offset="0" stop-color="#e8ecf8" stop-opacity="0.75"/><stop offset="1" stop-color="#e8ecf8" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="100" cy="140" rx="98" ry="92" fill="url(#mistG)"/>
      <!-- руки-завитки -->
      <path d="M66 122 Q30 122 26 98 Q24 82 38 84 Q48 88 42 98" stroke="${O}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M134 122 Q170 122 174 98 Q176 82 162 84 Q152 88 158 98" stroke="${O}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M66 122 Q30 122 26 98 Q24 82 38 84 Q48 88 42 98 M134 122 Q170 122 174 98 Q176 82 162 84 Q152 88 158 98" stroke="#c8cde6" stroke-width="8" fill="none" stroke-linecap="round"/>
      <!-- шлейф -->
      <path d="M50 230 Q40 170 64 122 Q78 94 100 92 Q122 94 136 122 Q160 170 150 230 Q136 214 124 232 Q112 214 100 232 Q88 214 76 232 Q64 214 50 230z" fill="#c8cde6" fill-opacity="0.9" ${sw(4)}/>
      <path d="M64 152 Q100 168 136 152 M58 188 Q100 206 142 188" stroke="#eef2fc" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>
      <!-- волосы-туман -->
      <path d="M62 78 Q60 28 100 24 Q140 28 138 78 Q150 106 170 114 Q140 122 130 98 L70 98 Q60 122 30 114 Q50 106 62 78z" fill="#9aa2c8" ${sw(4)}/>
      <!-- сонное лицо -->
      <ellipse cx="100" cy="74" rx="28" ry="30" fill="#eef0fa" ${sw(3.5)}/>
      <path d="M83 72 q7 6 14 0 M103 72 q7 6 14 0" ${sw(3)} fill="none"/>
      <path d="M84 62 q6 -4 12 0 M104 62 q6 -4 12 0" stroke="#7a80a8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="90" rx="4.5" ry="5.5" fill="#5a5a80"/>
      <circle cx="80" cy="82" r="5" fill="#c8b0e0" opacity="0.6"/><circle cx="120" cy="82" r="5" fill="#c8b0e0" opacity="0.6"/>
    `, 'char ghosty'),

    ghoul: () => svg('0 0 200 230', `
      <ellipse cx="100" cy="220" rx="64" ry="8" fill="#000" opacity="0.18"/>
      <!-- длинные руки -->
      <path d="M60 122 Q22 150 28 198 M140 122 Q178 150 172 198" stroke="${O}" stroke-width="24" fill="none" stroke-linecap="round"/>
      <path d="M60 122 Q22 150 28 198 M140 122 Q178 150 172 198" stroke="#7fa8c8" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M18 200 l-5 14 M28 204 l0 14 M38 200 l5 14 M162 200 l-5 14 M172 204 l0 14 M182 200 l5 14" ${sw(4)}/>
      <!-- тело -->
      <path d="M54 214 Q40 142 62 106 Q100 78 138 106 Q160 142 146 214z" fill="#8ab4d4" ${sw(4)}/>
      <path d="M80 214 Q84 152 100 136 Q116 152 120 214z" fill="#b8d8ee"/>
      <path d="M84 164 q16 7 32 0 M86 182 q14 7 28 0" stroke="#5a84a8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- ледяные шипы на спине -->
      <path d="M66 108 l-12 -32 l22 18z M134 108 l12 -32 l-22 18z" fill="#d8f0ff" ${sw(2.5)}/>
      <!-- голова -->
      <ellipse cx="100" cy="92" rx="40" ry="34" fill="#9cc4e0" ${sw(4)}/>
      <path d="M90 60 l6 -24 l8 22z" fill="#d8f0ff" ${sw(2.5)}/>
      <path d="M72 80 l20 9 M128 80 l-20 9" ${sw(4)}/>
      <ellipse cx="84" cy="96" rx="7" ry="6" fill="#ff5a5a" ${sw(2.5)}/><ellipse cx="116" cy="96" rx="7" ry="6" fill="#ff5a5a" ${sw(2.5)}/>
      <circle cx="84" cy="96" r="2.5" fill="#fff3c4"/><circle cx="116" cy="96" r="2.5" fill="#fff3c4"/>
      <path d="M74 112 Q100 130 126 112 Q100 120 74 112z" fill="#2a3450" ${sw(3)}/>
      <path d="M82 114 l3 9 l3 -8 M94 117 l3 10 l3 -10 M106 117 l3 10 l3 -9 M118 114 l2 8 l3 -9" fill="#eef8ff" ${sw(1.5)}/>
      <!-- украденное тепло -->
      <g opacity="0.8"><path d="M150 54 q-10 -8 -6 -16 q4 -6 10 0 q6 -6 10 0 q4 8 -6 16 l-4 4z" fill="#ff8a6a" ${sw(2)}/></g>
    `, 'char'),

    firecracker: () => svg('0 0 200 230', `
      <ellipse cx="100" cy="220" rx="54" ry="8" fill="#000" opacity="0.15"/>
      <!-- фитиль с искрами -->
      <path d="M100 40 Q114 26 104 10" fill="none" ${sw(5)}/>
      <path d="M100 40 Q114 26 104 10" fill="none" stroke="#8a6a4a" stroke-width="2"/>
      <circle cx="104" cy="10" r="9" fill="#ffe38a" opacity="0.6"/>
      <path d="M104 10 l-12 -6 M104 10 l14 -8 M104 10 l2 -10 M104 10 l-14 6 M104 10 l16 4" stroke="#ffd36e" stroke-width="4" stroke-linecap="round"/>
      <circle cx="104" cy="10" r="5" fill="#fff3c4"/>
      <!-- бумажный колпак -->
      <path d="M62 72 L100 34 L138 72z" fill="#f2e6c9" ${sw(4)}/>
      <path d="M80 54 l14 18 M100 34 l8 38" stroke="#5b8fd0" stroke-width="4"/>
      <!-- ножки -->
      <path d="M82 190 v20 h-12 M118 190 v20 h12" fill="none" ${sw(5)}/>
      <!-- корпус -->
      <rect x="60" y="70" width="80" height="122" rx="8" fill="#c8423a" ${sw(4)}/>
      <path d="M60 94 h80 M60 166 h80" stroke="${O}" stroke-width="11"/>
      <path d="M60 94 h80 M60 166 h80" stroke="#e6c45a" stroke-width="6"/>
      <path d="M72 78 v106" stroke="#e8746a" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
      <path d="M124 176 l3 6 l6 2 l-6 2 l-3 6 l-3 -6 l-6 -2 l6 -2z M78 104 l2 4 l4 1 l-4 1 l-2 4 l-2 -4 l-4 -1 l4 -1z" fill="#fff3c4" ${sw(1.5)}/>
      <!-- озорное лицо -->
      <path d="M78 112 l16 8 M122 112 l-16 8" ${sw(4)}/>
      <circle cx="88" cy="128" r="6" fill="${O}"/><circle cx="112" cy="128" r="6" fill="${O}"/>
      <circle cx="90" cy="126" r="2" fill="#fff"/><circle cx="114" cy="126" r="2" fill="#fff"/>
      <path d="M78 142 Q100 164 122 142 Q100 150 78 142z" fill="#5a1a1a" ${sw(3)}/>
      <path d="M88 145 l3 6 l3 -5 M104 147 l3 5 l3 -6" fill="#fff" ${sw(1.5)}/>
      <!-- руки -->
      <path d="M60 130 l-24 -14 M140 130 l24 -16" ${sw(5)}/>
    `, 'char'),

    /* ---------- Новая элита ---------- */
    iceknight: () => svg('0 0 220 240', `
      <ellipse cx="110" cy="230" rx="78" ry="8" fill="#000" opacity="0.18"/>
      <!-- меч-сосулька -->
      <path d="M182 36 l10 -4 l-4 132 l-6 8 l-6 -8z" fill="#cfeaff" ${sw(3.5)}/>
      <path d="M182 40 l-2 120" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <path d="M168 166 h32" ${sw(7)}/><path d="M184 172 v22" stroke="#6b4a32" stroke-width="8" stroke-linecap="round"/><path d="M184 172 v22" ${sw(2)}/>
      <!-- латы -->
      <path d="M58 228 Q50 150 68 116 H152 Q170 150 162 228z" fill="#9cc8e8" ${sw(4)}/>
      <path d="M66 142 h88 M62 170 h96 M60 200 h100" ${sw(3)}/>
      <path d="M68 134 h84 M64 162 h92 M62 192 h96" stroke="#d8f0ff" stroke-width="3" opacity="0.8"/>
      <path d="M110 116 v112" stroke="#7aa8cc" stroke-width="4"/>
      <!-- наплечники -->
      <path d="M44 134 q8 -32 40 -22 v26 q-24 -6 -40 -4z" fill="#b8dcf4" ${sw(4)}/>
      <path d="M176 134 q-8 -32 -40 -22 v26 q24 -6 40 -4z" fill="#b8dcf4" ${sw(4)}/>
      <!-- шлем -->
      <path d="M100 38 l10 -30 l10 30z" fill="#e8f6ff" ${sw(3)}/>
      <path d="M72 112 Q66 42 110 36 Q154 42 148 112z" fill="#b8dcf4" ${sw(4)}/>
      <path d="M80 72 h60 v16 h-60z" fill="#1a2a4a" ${sw(3)}/>
      <ellipse cx="97" cy="80" rx="7" ry="4" fill="#7ad6ff"/><ellipse cx="123" cy="80" rx="7" ry="4" fill="#7ad6ff"/>
      <path d="M84 96 h52 M88 104 h44" stroke="#7aa8cc" stroke-width="3" stroke-linecap="round"/>
      <!-- щит со снежинкой -->
      <path d="M18 136 h56 v42 q0 26 -28 38 q-28 -12 -28 -38z" fill="#7fb4dc" ${sw(4)}/>
      <path d="M46 146 v56 M28 160 l36 28 M28 188 l36 -28" stroke="#e8f6ff" stroke-width="4" stroke-linecap="round"/>
    `, 'char'),

    blizzard: () => svg('0 0 220 240', `
      <!-- вихрь-юбка -->
      <path d="M28 232 Q60 152 92 132 Q110 122 128 132 Q160 152 192 232 Q162 214 142 234 Q122 212 110 236 Q98 212 78 234 Q58 214 28 232z" fill="#e6eef8" ${sw(4)}/>
      <path d="M60 204 Q110 172 160 204 M78 170 Q110 152 142 170" stroke="#9fc3e8" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- руки со снежинками -->
      <path d="M92 116 Q62 92 42 64 M128 116 Q158 92 178 64" stroke="${O}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M92 116 Q62 92 42 64 M128 116 Q158 92 178 64" stroke="#e6eef8" stroke-width="8" fill="none" stroke-linecap="round"/>
      <g transform="translate(-12 -14)">${flake(46, 60, 14)}</g>
      <g transform="translate(12 -14)">${flake(174, 60, 14)}</g>
      ${flake(30, 140, 8)}${flake(190, 150, 9)}
      <!-- платье -->
      <path d="M88 134 Q90 100 110 96 Q130 100 132 134z" fill="#5b8fd0" ${sw(3.5)}/>
      <!-- волосы-позёмка -->
      <path d="M80 72 Q76 30 110 26 Q144 30 140 72 Q152 100 182 112 Q148 116 136 92 L84 92 Q72 116 38 112 Q68 100 80 72z" fill="#f4f8ff" ${sw(4)}/>
      <!-- лицо -->
      <ellipse cx="110" cy="66" rx="22" ry="24" fill="#dfe8f6" ${sw(3)}/>
      <path d="M95 60 l11 4 M125 60 l-11 4" ${sw(3)}/>
      <circle cx="101" cy="68" r="3.5" fill="#2a5aa0"/><circle cx="119" cy="68" r="3.5" fill="#2a5aa0"/>
      <path d="M103 80 q7 3 14 0" ${sw(2.5)} fill="none"/>
      <!-- ледяная корона -->
      <path d="M90 42 l6 -22 l6 14 l8 -24 l8 24 l6 -14 l6 22z" fill="#bfe3f7" ${sw(3)}/>
    `, 'char'),

    watchman: () => svg('0 0 220 240', `
      <ellipse cx="110" cy="230" rx="78" ry="8" fill="#000" opacity="0.18"/>
      <!-- тулуп -->
      <path d="M50 228 Q44 142 74 114 Q110 98 146 114 Q176 142 170 228z" fill="#7a5032" ${sw(4)}/>
      <path d="M104 116 Q98 172 104 228 M116 116 Q122 172 116 228" stroke="#e8d8b8" stroke-width="10" fill="none"/>
      <path d="M110 116 V228" ${sw(3)}/>
      <path d="M52 172 h116" stroke="${O}" stroke-width="15"/><path d="M52 172 h116" stroke="#c8423a" stroke-width="9"/>
      <!-- левая рука в рукавице -->
      <path d="M66 130 Q44 160 50 190" stroke="${O}" stroke-width="24" fill="none" stroke-linecap="round"/>
      <path d="M66 130 Q44 160 50 190" stroke="#7a5032" stroke-width="16" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="196" r="13" fill="#3a5a3a" ${sw(3.5)}/>
      <!-- правая рука с колотушкой -->
      <path d="M152 128 Q182 114 186 78" stroke="${O}" stroke-width="24" fill="none" stroke-linecap="round"/>
      <path d="M152 128 Q182 114 186 78" stroke="#7a5032" stroke-width="16" fill="none" stroke-linecap="round"/>
      <circle cx="186" cy="74" r="12" fill="#3a5a3a" ${sw(3.5)}/>
      <path d="M186 64 v-26" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M186 64 v-26" stroke="#8a5a32" stroke-width="5" stroke-linecap="round"/>
      <rect x="172" y="10" width="30" height="30" rx="4" fill="#c98a5a" ${sw(3.5)}/>
      <path d="M172 20 q-12 -2 -16 8" fill="none" ${sw(2)}/>
      <circle cx="156" cy="32" r="7" fill="#6b4a32" ${sw(2.5)}/>
      <path d="M140 14 l-8 -6 M138 28 h-10 M210 18 l6 -6" stroke="#fff3c4" stroke-width="3.5" stroke-linecap="round"/>
      <!-- воротник -->
      <path d="M70 118 Q110 138 150 118 Q146 102 110 104 Q74 102 70 118z" fill="#e8d8b8" ${sw(3.5)}/>
      <!-- голова -->
      <ellipse cx="110" cy="86" rx="30" ry="28" fill="#f0c8a0" ${sw(3.5)}/>
      <path d="M90 74 l14 5 M130 74 l-14 5" ${sw(4)}/>
      <circle cx="98" cy="84" r="3.5" fill="${O}"/><circle cx="122" cy="84" r="3.5" fill="${O}"/>
      <circle cx="110" cy="92" r="6" fill="#e8907a" ${sw(2)}/>
      <path d="M84 100 Q98 92 110 98 Q122 92 136 100 Q124 110 110 104 Q96 110 84 100z" fill="#d8d0c0" ${sw(2.5)}/>
      <!-- меховая шапка -->
      <path d="M78 70 Q76 26 110 22 Q144 26 142 70z" fill="#5a3a2a" ${sw(4)}/>
      <path d="M74 72 Q110 58 146 72 L146 82 Q110 68 74 82z" fill="#e8d8b8" ${sw(3.5)}/>
    `, 'char'),

    hedgehog: () => svg('0 0 200 220', `
      <path d="M30 170 Q20 90 90 70 Q170 60 176 150 Q178 182 150 190 H50 Q32 188 30 170z" fill="#5a4636" ${sw(4)}/>
      <g fill="#3e2f25" ${sw(2.5)}><path d="M44 110 l-14 -16 l22 4z"/><path d="M62 86 l-6 -22 l18 12z"/><path d="M92 74 l4 -24 l12 20z"/><path d="M128 76 l14 -18 l4 22z"/><path d="M158 100 l20 -10 l-6 22z"/><path d="M172 140 l20 2 l-16 14z"/></g>
      <path d="M70 120 Q60 150 72 186 H140 Q150 140 124 112 Q96 100 70 120z" fill="#e7c9a2" ${sw(3.5)}/>
      <ellipse cx="62" cy="140" rx="18" ry="14" fill="#e7c9a2" ${sw(3.5)}/>
      <circle cx="46" cy="138" r="6" fill="${O}"/>
      <circle cx="82" cy="128" r="5" fill="${O}"/><circle cx="83.5" cy="126.5" r="1.6" fill="#fff"/>
      <!-- очки и шапочка -->
      <circle cx="82" cy="128" r="10" fill="none" ${sw(2.5)}/>
      <path d="M86 70 Q110 40 140 60 L132 76 Q110 66 92 80z" fill="#a33a3a" ${sw(3)}/>
      <circle cx="142" cy="56" r="6" fill="#f2e6c9" ${sw(2.5)}/>
      <!-- мешок -->
      <path d="M120 150 Q110 200 150 204 Q188 200 172 150 Q160 140 146 146 Q132 140 120 150z" fill="#b48a54" ${sw(3.5)}/>
      <path d="M134 150 Q146 158 160 150" ${sw(3)} fill="none"/>
    `, 'char'),
  };

  /* ---------- Иконки для карт ---------- */
  const flameShape = (x, y, s, c1 = '#ffb23e', c2 = '#ffe38a') => `
    <path d="M${x} ${y + 26 * s} q${-20 * s} ${-8 * s} ${-14 * s} ${-28 * s} q${4 * s} ${-12 * s} ${10 * s} ${-22 * s} q${2 * s} ${12 * s} ${8 * s} ${14 * s} q${2 * s} ${-12 * s} ${10 * s} ${-18 * s} q${14 * s} ${22 * s} ${6 * s} ${38 * s} q${-6 * s} ${12 * s} ${-20 * s} ${16 * s}z" fill="${c1}" ${sw(3)}/>
    <path d="M${x} ${y + 22 * s} q${-8 * s} ${-6 * s} ${-4 * s} ${-16 * s} q${4 * s} ${4 * s} ${6 * s} ${6 * s} q${2 * s} ${-6 * s} ${4 * s} ${-10 * s} q${8 * s} ${12 * s} ${-6 * s} ${20 * s}z" fill="${c2}"/>`;

  // снежинка из трёх перекладин
  const flake = (x, y, r) => {
    const d = `M${x} ${y - r} v${2 * r} M${x - 0.87 * r} ${y - 0.5 * r} l${1.73 * r} ${r} M${x - 0.87 * r} ${y + 0.5 * r} l${1.73 * r} ${-r}`;
    return `<path d="${d}" ${sw(Math.max(3, r / 3.2))}/><path d="${d}" stroke="#eef4fc" stroke-width="${Math.max(1.4, r / 7)}" stroke-linecap="round"/>`;
  };
  // четырёхлучевая звёздочка
  const star4 = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28}z" fill="#ffe38a" ${sw(Math.max(1.5, r / 4))}/>`;
  // голова пса Дружка для иконок пастушки
  const dogHead = (x, y, k = 1, o = {}) => `<g transform="translate(${x} ${y}) scale(${k}) rotate(${o.rot || 0})">
    <ellipse cx="0" cy="0" rx="24" ry="21" fill="${o.fur || '#c88a4a'}" ${sw(3.5)}/>
    <path d="M-18 -12 q-16 0 -14 22 q10 4 14 -8z" fill="${o.ear || '#8a5a32'}" ${sw(3)}/>
    <path d="M18 -12 q16 0 14 22 q-10 4 -14 -8z" fill="${o.ear || '#8a5a32'}" ${sw(3)}/>
    <ellipse cx="0" cy="9" rx="12" ry="9" fill="#f4ead8" ${sw(2.5)}/>
    <ellipse cx="0" cy="4.5" rx="5" ry="3.5" fill="${O}"/>
    <circle cx="-8.5" cy="-5" r="3.2" fill="${O}"/><circle cx="8.5" cy="-5" r="3.2" fill="${O}"/>
    <circle cx="-7.5" cy="-6" r="1" fill="#fff"/><circle cx="9.5" cy="-6" r="1" fill="#fff"/>
    ${o.bark ? `<path d="M-6 12 q6 10 12 0z" fill="#c8423a" ${sw(2)}/>` : o.howl ? `<ellipse cx="0" cy="14" rx="4" ry="5" fill="#5a1a1a" ${sw(2)}/>` : `<path d="M-2 13 q2 6 4 0z" fill="#e85a6a" ${sw(1.2)}/>`}
  </g>`;
  const icons = {
    strike: `<path d="M30 80 L70 30" ${sw(7)}/><path d="M64 22 h16 l-3 8 h-10z" fill="#3a3240" ${sw(3)}/><rect x="62" y="30" width="18" height="20" rx="3" fill="#ffd36e" ${sw(3)} transform="rotate(38 71 40)"/><path d="M18 46 l14 6 M22 30 l12 12 M38 20 l4 14" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>`,
    guard: `<path d="M24 22 h52 v44 q0 18 -26 26 q-26 -8 -26 -26z" fill="#5b6f8f" ${sw(4)}/><path d="M24 40 h52 M24 58 h52 M50 22 v68" ${sw(3)}/><circle cx="40" cy="31" r="3" fill="${O}"/><circle cx="60" cy="31" r="3" fill="${O}"/>`,
    kindle: `${flameShape(50, 44, 1.2)}<path d="M36 82 h28 v8 h-28z" fill="#efe3c6" ${sw(3)}/>`,
    spark: `<path d="M50 14 l8 26 l26 8 l-26 8 l-8 26 l-8 -26 l-26 -8 l26 -8z" fill="#ffe38a" ${sw(3.5)}/><circle cx="76" cy="24" r="5" fill="#ffb23e" ${sw(2)}/><circle cx="24" cy="76" r="4" fill="#ffb23e" ${sw(2)}/>`,
    sparks: `<path d="M30 22 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 l14 -5z" fill="#ffe38a" ${sw(3)}/><path d="M70 30 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 l14 -5z" fill="#ffcc55" ${sw(3)}/><path d="M48 58 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 l14 -5z" fill="#ffb23e" ${sw(3)}/>`,
    cloak: `<path d="M50 14 Q20 20 18 50 Q16 76 26 90 H74 Q84 76 82 50 Q80 20 50 14z" fill="#2f5d62" ${sw(4)}/><path d="M50 14 Q34 40 38 90 M50 14 Q66 40 62 90" ${sw(3)} fill="none"/><path d="M36 22 Q50 34 64 22" fill="#c98a2b" ${sw(3)}/>`,
    tea: `<path d="M22 44 h46 v18 q0 22 -23 22 q-23 0 -23 -22z" fill="#d9e1ee" ${sw(4)}/><path d="M68 50 q16 0 14 12 q-2 10 -14 8" fill="none" ${sw(4)}/><ellipse cx="45" cy="44" rx="23" ry="5" fill="#b66a2a" ${sw(3)}/><path d="M36 34 q-6 -8 0 -14 M48 32 q-6 -8 0 -16 M60 34 q-6 -8 0 -14" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    wind: `<path d="M14 40 h50 q14 0 14 -12 q0 -12 -12 -10" fill="none" ${sw(5)}/><path d="M14 58 h64 q12 0 12 12 q0 12 -12 10" fill="none" ${sw(5)}/><path d="M24 76 h30" ${sw(5)}/><path d="M14 40 h50 q14 0 14 -12 q0 -12 -12 -10 M14 58 h64 q12 0 12 12 q0 12 -12 10" stroke="#cfe6ff" stroke-width="2" fill="none"/>`,
    oil: `<path d="M28 40 h40 v44 h-40z" fill="#8a6a3a" ${sw(4)}/><path d="M68 50 l18 -14 l4 6 l-16 14" fill="#8a6a3a" ${sw(3)}/><path d="M36 40 v-10 h24 v10" fill="#5a4630" ${sw(3)}/><path d="M89 48 q4 8 0 12 q-4 -4 0 -12z" fill="#ffcf6b" ${sw(2)}/><path d="M38 60 h20" ${sw(3)}/>`,
    mirror: `<ellipse cx="50" cy="46" rx="26" ry="32" fill="#9fc3e8" ${sw(4)}/><ellipse cx="50" cy="46" rx="18" ry="24" fill="#cfe6ff" ${sw(2)}/><path d="M50 78 v14 M38 92 h24" ${sw(4)}/><path d="M40 34 l10 -6 M38 46 l18 -12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>${flameShape(50, 36, 0.5)}`,
    heavy: `<path d="M20 84 L62 30" ${sw(8)}/><rect x="52" y="12" width="34" height="28" rx="4" fill="#ffd36e" ${sw(4)} transform="rotate(38 69 26)"/><path d="M10 30 q20 -20 40 -18 M14 50 q18 -16 30 -14" stroke="#fff3c4" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    palm: `<path d="M30 90 V52 q0 -6 6 -6 q6 0 6 6 V36 q0 -6 6 -6 q6 0 6 6 v4 q0 -6 6 -6 q6 0 6 6 v8 q0 -6 6 -6 q6 0 6 6 V70 q0 20 -20 20z" fill="#f3cda6" ${sw(3.5)}/>${flameShape(54, 2, 0.7)}`,
    shadow: `<path d="M20 86 Q18 40 50 24 Q82 40 80 86 Q66 76 50 86 Q34 76 20 86z" fill="#3a2f55" ${sw(4)}/><ellipse cx="40" cy="52" rx="5" ry="7" fill="#f4d23c"/><ellipse cx="60" cy="52" rx="5" ry="7" fill="#f4d23c"/>`,
    wax: `<path d="M34 38 h32 v50 h-32z" fill="#efe3c6" ${sw(4)}/><path d="M34 38 q4 14 8 4 q4 16 8 2 q4 18 8 4 q4 12 8 -10" fill="#fff6e0" ${sw(3)}/><path d="M50 38 v-8" ${sw(3)}/>${flameShape(50, 6, 0.55)}`,
    ember: `<path d="M24 70 Q20 44 44 36 Q74 30 80 56 Q84 80 56 86 Q30 90 24 70z" fill="#b8361e" ${sw(4)}/><path d="M38 60 l10 -8 l8 10 l10 -6" stroke="#ffb23e" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="66" cy="24" r="4" fill="#ffb23e"/><circle cx="44" cy="20" r="3" fill="#ffb23e"/>`,
    blaze: `${flameShape(32, 40, 0.9, '#e8502a', '#ffb23e')}${flameShape(66, 40, 0.9, '#e8502a', '#ffb23e')}${flameShape(50, 34, 1.2)}`,
    breath: `<circle cx="50" cy="50" r="30" fill="#2f5d62" ${sw(4)}/><path d="M36 50 q14 -18 28 0 q-14 18 -28 0z" fill="#ffe38a" ${sw(3)}/><circle cx="50" cy="50" r="5" fill="${O}"/>`,
    bell: `<path d="M30 70 Q30 30 50 26 Q70 30 70 70 h8 v8 h-56 v-8z" fill="#c98a2b" ${sw(4)}/><circle cx="50" cy="84" r="6" fill="#c98a2b" ${sw(3)}/><path d="M50 26 v-8" ${sw(4)}/>`,
    feather: `<path d="M22 86 Q30 30 82 14 Q70 60 26 82z" fill="#e8e2d0" ${sw(3.5)}/><path d="M18 90 L76 22" ${sw(2.5)}/>`,
    jar: `<path d="M28 34 h44 v48 q0 8 -8 8 h-28 q-8 0 -8 -8z" fill="#9fc3e8" fill-opacity="0.6" ${sw(4)}/><rect x="30" y="22" width="40" height="12" rx="3" fill="#8a6a3a" ${sw(3)}/><circle cx="42" cy="56" r="4" fill="#fff27a"/><circle cx="58" cy="66" r="4" fill="#fff27a"/><circle cx="52" cy="48" r="3" fill="#fff27a"/><circle cx="44" cy="74" r="3" fill="#fff27a"/>`,
    flint: `<path d="M20 60 l30 -30 l12 12 l-30 30z" fill="#7b8794" ${sw(4)}/><path d="M56 56 q10 -4 22 6 q-8 12 -22 6z" fill="#6b4a32" ${sw(3.5)}/><path d="M64 34 l8 -8 M70 44 l12 -2 M58 26 l2 -10" stroke="#ffd36e" stroke-width="4" stroke-linecap="round"/>`,
    chest: `<path d="M16 46 h68 v38 h-68z" fill="#8a5a32" ${sw(4)}/><path d="M16 46 Q16 22 50 22 Q84 22 84 46z" fill="#a06a3a" ${sw(4)}/><path d="M16 56 h68 M50 22 v62" ${sw(3)}/><rect x="44" y="50" width="12" height="14" rx="2" fill="#e6c45a" ${sw(3)}/><circle cx="50" cy="40" r="22" fill="#ffe38a" opacity="0.25"/>`,
    fire: `<path d="M18 86 l64 -14 M18 72 l64 14" ${sw(7)} stroke="#6b4a32"/><path d="M18 86 l64 -14 M18 72 l64 14" ${sw(2)}/>${flameShape(50, 34, 1.2)}`,
    well: `<path d="M20 50 h60 v36 h-60z" fill="#6f7f9b" ${sw(4)}/><path d="M20 62 h60 M20 74 h60 M40 50 v12 M60 62 v12 M40 74 v12" ${sw(2)}/><path d="M24 50 V20 M76 50 V20" ${sw(4)}/><path d="M16 22 L50 6 L84 22z" fill="#5a4636" ${sw(4)}/><path d="M50 22 v20" ${sw(2)}/><rect x="44" y="40" width="12" height="8" fill="#8a6a3a" ${sw(2)}/>`,
    puppet: `<path d="M20 10 h60" ${sw(4)}/><path d="M30 10 L40 40 M70 10 L60 40 M50 10 V28" ${sw(1.5)}/><circle cx="50" cy="38" r="12" fill="#f2e6c9" ${sw(3)}/><path d="M38 52 h24 l6 26 h-36z" fill="#a33a3a" ${sw(3)}/><path d="M42 78 v14 M58 78 v14" ${sw(3)}/><circle cx="46" cy="37" r="2" fill="${O}"/><circle cx="54" cy="37" r="2" fill="${O}"/><path d="M45 43 q5 3 10 0" ${sw(2)} fill="none"/>`,
    lantern: `<path d="M50 10 v10" ${sw(3)}/><path d="M32 22 h36 l-4 8 h-28z" fill="#3a3240" ${sw(3)}/><rect x="34" y="30" width="32" height="40" rx="4" fill="#5d6a8f" ${sw(3)}/><path d="M50 30 v40 M34 50 h32" ${sw(2)}/><path d="M30 70 h40 l-6 8 h-28z" fill="#3a3240" ${sw(3)}/><path d="M40 40 l20 20 M60 40 l-20 20" stroke="#c9d4ea" stroke-width="2"/>`,
    snowman: `<circle cx="50" cy="70" r="22" fill="#e6edf8" ${sw(4)}/><circle cx="50" cy="36" r="16" fill="#e6edf8" ${sw(4)}/><circle cx="44" cy="33" r="2.5" fill="${O}"/><circle cx="56" cy="33" r="2.5" fill="${O}"/><path d="M50 38 l14 4 l-14 2z" fill="#e8762c" ${sw(2)}/><path d="M30 24 h40 M36 24 v-14 h28 v14" fill="#22202a" ${sw(3)}/>`,
    coin: `<circle cx="50" cy="50" r="26" fill="#e6c45a" ${sw(4)}/><circle cx="50" cy="50" r="17" fill="none" stroke="#b08a2a" stroke-width="3"/>${flameShape(50, 34, 0.45, '#b08a2a', '#b08a2a')}`,
    heart: `<path d="M50 84 Q14 60 18 36 Q22 16 40 18 Q48 20 50 30 Q52 20 60 18 Q78 16 82 36 Q86 60 50 84z" fill="#d0463b" ${sw(4)}/><path d="M30 34 q4 -8 12 -6" stroke="#ff9a8a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    envelope: `<rect x="14" y="28" width="72" height="48" rx="4" fill="#f2e6c9" ${sw(4)}/><path d="M14 30 l36 26 l36 -26" fill="none" ${sw(3.5)}/><rect x="62" y="36" width="16" height="14" fill="#c8423a" ${sw(2)}/><circle cx="50" cy="58" r="6" fill="#c8423a" ${sw(2)}/>`,
    thimble: `<path d="M28 84 Q28 30 50 22 Q72 30 72 84z" fill="#b8bcc8" ${sw(4)}/><path d="M26 84 h48" ${sw(6)}/><g fill="#7a8090"><circle cx="42" cy="44" r="3"/><circle cx="56" cy="44" r="3"/><circle cx="38" cy="58" r="3"/><circle cx="50" cy="58" r="3"/><circle cx="62" cy="58" r="3"/><circle cx="44" cy="70" r="3"/><circle cx="58" cy="70" r="3"/></g>`,
    scissors: `<circle cx="30" cy="70" r="12" fill="none" ${sw(4)}/><circle cx="70" cy="70" r="12" fill="none" ${sw(4)}/><path d="M38 62 L72 16 M62 62 L28 16" ${sw(5)}/>`,
    // ---- новые карты ----
    snowkick: `<circle cx="20" cy="74" r="9" fill="#eef4fc" ${sw(3)}/><circle cx="14" cy="58" r="6" fill="#eef4fc" ${sw(3)}/><circle cx="26" cy="46" r="4" fill="#eef4fc" ${sw(2.5)}/><path d="M42 14 h22 v42 l18 8 q8 4 8 12 v6 h-48z" fill="#7a4e32" ${sw(4)}/><path d="M40 82 h52" ${sw(7)}/><path d="M42 26 h22" stroke="#c98a5a" stroke-width="4"/>`,
    payback: `<path d="M22 22 h44 v38 q0 16 -22 24 q-22 -8 -22 -24z" fill="#5b8fd0" ${sw(4)}/><path d="M48 30 l-10 18 h10 l-6 20 l18 -26 h-10 l6 -12z" fill="#ffd36e" ${sw(2.5)}/><path d="M74 30 l14 -8 M76 48 h16 M74 66 l14 8" stroke="#ff9a6a" stroke-width="5" stroke-linecap="round"/>`,
    luckycoin: `<circle cx="50" cy="52" r="32" fill="#e6c45a" ${sw(4)}/><circle cx="50" cy="52" r="23" fill="none" stroke="#b08a2a" stroke-width="3"/><g fill="#5aa05a" ${sw(2)}><circle cx="44" cy="46" r="7"/><circle cx="56" cy="46" r="7"/><circle cx="44" cy="58" r="7"/><circle cx="56" cy="58" r="7"/></g><path d="M50 58 q4 10 10 14" ${sw(3)} fill="none"/><path d="M80 18 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff3c4" ${sw(2)}/>`,
    snowball: `<path d="M8 40 h20 M4 56 h22 M10 72 h18" stroke="#cfe6ff" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="54" r="30" fill="#eef4fc" ${sw(4)}/><path d="M40 70 q18 14 44 -6 q-10 22 -34 18 q-10 -4 -10 -12z" fill="#b8cbe6"/><circle cx="52" cy="40" r="5" fill="#ffffff"/><path d="M66 34 q6 4 6 10" stroke="#b8cbe6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    flurry: `<path d="M50 50 m-30 0 a30 30 0 1 1 30 30 a20 20 0 1 1 -20 -20 a10 10 0 1 1 10 10" fill="none" ${sw(6)}/><path d="M50 50 m-30 0 a30 30 0 1 1 30 30 a20 20 0 1 1 -20 -20 a10 10 0 1 1 10 10" fill="none" stroke="#cfe6ff" stroke-width="2.5"/><path d="M80 18 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#eef4fc" ${sw(2)}/><path d="M16 80 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" fill="#eef4fc" ${sw(2)}/>`,
    stamp: `<circle cx="50" cy="20" r="11" fill="#8a5a32" ${sw(4)}/><path d="M44 30 h12 v18 h-12z" fill="#6b4a32" ${sw(3.5)}/><path d="M24 48 h52 v16 h-52z" fill="#a06a3a" ${sw(4)}/><path d="M22 64 h56 v8 h-56z" fill="#3a3240" ${sw(3)}/><path d="M18 84 h64" stroke="#c8423a" stroke-width="8" stroke-linecap="round"/><path d="M30 84 h10 M48 84 h22" stroke="#e8746a" stroke-width="3" stroke-linecap="round"/>`,
    redseal: `<path d="M50 14 q10 4 14 -2 q4 10 14 8 q-2 10 8 14 q-8 6 -2 16 q-10 2 -10 12 q-10 -4 -14 6 q-6 -8 -16 -4 q0 -10 -10 -12 q4 -10 -4 -16 q10 -4 8 -14 q10 2 12 -8z" fill="#c8423a" ${sw(4)}/><circle cx="50" cy="50" r="18" fill="#a8322c" ${sw(3)}/><path d="M42 58 l8 -18 l8 18 M45 52 h10" stroke="#ffb0a0" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    whistle: `<path d="M18 44 h44 q20 0 20 20 q0 20 -20 20 q-18 0 -20 -16 h-24z" fill="#e6c45a" ${sw(4)}/><circle cx="62" cy="64" r="8" fill="#b08a2a" ${sw(3)}/><path d="M18 44 v12" ${sw(4)}/><path d="M30 44 q-8 -14 -22 -18" fill="none" ${sw(3)}/><path d="M70 30 l8 -12 M80 38 l14 -6 M58 26 l2 -14" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>`,
    cocoa: `<path d="M18 40 h46 v22 q0 22 -23 22 q-23 0 -23 -22z" fill="#c98a5a" ${sw(4)}/><path d="M64 46 q16 0 14 12 q-2 10 -14 8" fill="none" ${sw(4)}/><ellipse cx="41" cy="40" rx="23" ry="5" fill="#6b3a1e" ${sw(3)}/><path d="M60 26 q14 -16 28 -10 q-4 4 -6 12 q-12 6 -22 -2z" fill="#d0463b" ${sw(3)}/><path d="M84 14 q2 -6 8 -6" ${sw(3)} fill="none"/><path d="M30 30 q-4 -8 0 -14 M42 28 q-4 -8 0 -16" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    prickly: `<path d="M16 34 q34 -16 68 0 v18 q-34 -16 -68 0z" fill="#a33a3a" ${sw(4)}/><path d="M60 46 l10 40 h-16 l-6 -36z" fill="#a33a3a" ${sw(4)}/><path d="M30 30 v14 M44 27 v16 M58 28 v14 M58 62 h12 M56 74 h14" stroke="#f2e6c9" stroke-width="3"/><path d="M20 30 l-6 -12 l12 6 M40 24 l-2 -14 l10 10 M64 24 l4 -14 l4 14 M82 32 l12 -8 l-4 14" fill="#e6edf8" ${sw(2.5)}/>`,
    frostlace: `<g ${sw(5)}><path d="M50 12 v76 M17 31 l66 38 M17 69 l66 -38"/></g><g stroke="#cfe6ff" stroke-width="2.5" stroke-linecap="round"><path d="M50 12 v76 M17 31 l66 38 M17 69 l66 -38"/></g><g fill="none" ${sw(4)}><path d="M42 18 l8 8 l8 -8 M42 82 l8 -8 l8 8 M20 42 l10 -2 l-4 -10 M80 58 l-10 2 l4 10 M20 58 l10 2 l-4 10 M80 42 l-10 -2 l4 -10"/></g><circle cx="50" cy="50" r="7" fill="#9fc3e8" ${sw(3)}/>`,
    parcel: `<path d="M16 40 l34 -14 l34 14 v38 l-34 14 l-34 -14z" fill="#b8865a" ${sw(4)}/><path d="M16 40 l34 14 l34 -14 M50 54 v38" fill="none" ${sw(3.5)}/><path d="M33 33 l34 14 v12" fill="none" stroke="#e8d8b0" stroke-width="5"/><path d="M33 33 l34 14 v12" fill="none" ${sw(1.5)}/><rect x="22" y="60" width="18" height="10" fill="#f2e6c9" ${sw(2)} transform="rotate(22 31 65)"/>`,
    telegram: `<path d="M10 30 h60 l-6 10 l6 10 h-60 l6 -10z" fill="#f2e6c9" ${sw(3.5)}/><path d="M20 40 h6 M32 40 h2 M40 40 h8 M54 40 h2" ${sw(4)}/><path d="M30 60 h60 l-6 10 l6 10 h-60 l6 -10z" fill="#f2e6c9" ${sw(3.5)}/><path d="M40 70 h2 M48 70 h8 M62 70 h2 M70 70 h8" ${sw(4)}/><path d="M78 10 l-10 18 h10 l-8 18 l20 -24 h-10 l8 -12z" fill="#ffd36e" ${sw(2.5)}/>`,
    surprise: `<rect x="18" y="40" width="64" height="46" rx="4" fill="#c8423a" ${sw(4)}/><rect x="14" y="30" width="72" height="14" rx="3" fill="#d85a4a" ${sw(4)}/><path d="M44 30 h12 v56 h-12z" fill="#ffd36e" ${sw(3)}/><path d="M50 30 q-22 -22 -24 -4 q2 8 24 4 q22 4 24 -4 q-2 -18 -24 4z" fill="#ffd36e" ${sw(3)}/><path d="M14 16 l6 6 M86 16 l-6 6 M50 4 v8" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>`,
    umbrella: `<path d="M10 52 Q14 16 50 14 Q86 16 90 52 q-10 -8 -20 0 q-10 -8 -20 0 q-10 -8 -20 0 q-10 -8 -20 0z" fill="#c8423a" ${sw(4)}/><path d="M50 14 q-14 16 -10 38 M50 14 q14 16 10 38" fill="none" ${sw(3)}/><path d="M50 14 v66 q0 10 -9 10 q-8 0 -8 -8" fill="none" ${sw(5)}/><path d="M50 8 v6" ${sw(4)}/><g fill="#9fc3e8"><circle cx="18" cy="70" r="3"/><circle cx="80" cy="74" r="3"/><circle cx="72" cy="88" r="2.5"/></g>`,
    blotter: `<path d="M14 66 q36 -34 72 0z" fill="#e8d8b0" ${sw(4)}/><path d="M38 50 v-16 h24 v16" fill="#8a5a32" ${sw(3.5)}/><circle cx="50" cy="26" r="9" fill="#a06a3a" ${sw(3.5)}/><path d="M10 80 h80" ${sw(4)}/><path d="M26 76 q8 -6 14 2 q6 6 0 8 q-12 2 -14 -10z" fill="#3a2f55"/><path d="M62 74 q6 -2 8 4 q-2 6 -8 2z" fill="#3a2f55"/><path d="M80 52 l-6 -18 M88 44 l-12 -4" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/>`,
    mittens: `<path d="M14 84 V44 q0 -20 18 -20 q16 0 16 20 v6 q8 -10 12 -2 q2 8 -10 16 V84z" fill="#c8423a" ${sw(4)}/><path d="M14 74 h36" stroke="#f2e6c9" stroke-width="7"/><path d="M14 74 h36" ${sw(1.5)}/><path d="M52 88 V48 q0 -20 18 -20 q16 0 16 20 v6 q8 -10 12 -2 q2 8 -10 16 V88z" fill="#2f5d62" ${sw(4)}/><path d="M52 78 h36" stroke="#f2e6c9" stroke-width="7"/><path d="M52 78 h36" ${sw(1.5)}/><path d="M24 40 l6 6 l6 -6 M62 44 l6 6 l6 -6" stroke="#f2e6c9" stroke-width="3" fill="none"/>`,
    inkpen: `<path d="M20 64 h40 v18 q0 6 -6 6 h-28 q-6 0 -6 -6z" fill="#2c3550" ${sw(4)}/><path d="M26 64 v-8 h28 v8" fill="#1e2436" ${sw(3)}/><path d="M24 70 h32" stroke="#4a5a90" stroke-width="3"/><path d="M44 58 Q56 20 92 8 Q82 46 50 60z" fill="#efe3c6" ${sw(3.5)}/><path d="M42 64 L84 16" ${sw(2.5)}/><path d="M56 40 l10 6 M64 30 l10 4" stroke="#c9b48a" stroke-width="2.5" stroke-linecap="round"/>`,
    lullaby: `<path d="M66 14 A34 34 0 1 0 84 70 A28 28 0 1 1 66 14z" fill="#f4e6a8" ${sw(4)}/><circle cx="42" cy="56" r="3" fill="#e0c870"/><circle cx="34" cy="40" r="2.5" fill="#e0c870"/><path d="M62 30 h12 l-12 14 h12 M78 12 h8 l-8 10 h8" fill="none" stroke="#cfe6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    lastword: `<path d="M16 24 h56 v58 h-56z" fill="#f2e6c9" ${sw(4)}/><path d="M12 20 q4 -8 10 0 v6 h-10z M66 82 q6 8 10 0 v-6 h-10z" fill="#d8c59c" ${sw(3)}/><path d="M24 38 h28 M24 48 h36 M24 58 h20" stroke="#8a7a60" stroke-width="3" stroke-linecap="round"/><path d="M50 72 Q62 36 94 22 Q86 56 56 74z" fill="#c8423a" ${sw(3)}/><path d="M46 80 L88 28" ${sw(2.5)}/><path d="M28 70 l6 6 l10 -12" fill="none" stroke="#c8423a" stroke-width="4" stroke-linecap="round"/>`,
    secret: `<rect x="12" y="24" width="64" height="44" rx="4" fill="#f2e6c9" ${sw(4)}/><path d="M12 26 l32 24 l32 -24" fill="none" ${sw(3.5)}/><path d="M60 62 v-10 q0 -12 12 -12 q12 0 12 12 v10" fill="none" ${sw(5)}/><path d="M60 62 v-10 q0 -12 12 -12 q12 0 12 12 v10" fill="none" stroke="#b8bcc8" stroke-width="2.5"/><rect x="54" y="60" width="36" height="28" rx="4" fill="#e6c45a" ${sw(4)}/><circle cx="72" cy="72" r="4" fill="${O}"/><path d="M72 74 v8" ${sw(3)}/>`,
    finale: `<path d="M34 76 V22 l46 -10 v54" fill="none" ${sw(5)}/><path d="M34 22 l46 -10 v12 l-46 10z" fill="#e6c45a" ${sw(3)}/><ellipse cx="26" cy="78" rx="11" ry="8" fill="#e6c45a" ${sw(4)} transform="rotate(-18 26 78)"/><ellipse cx="72" cy="68" rx="11" ry="8" fill="#e6c45a" ${sw(4)} transform="rotate(-18 72 68)"/><path d="M12 30 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff3c4" ${sw(2)}/><path d="M86 82 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" fill="#fff3c4" ${sw(2)}/>`,
    flashpoint: `<path d="M50 50 m-38 0 l14 -6 l-6 -14 l14 4 l2 -16 l12 10 l12 -10 l2 16 l14 -4 l-6 14 l14 6 l-14 6 l6 14 l-14 -4 l-2 16 l-12 -10 l-12 10 l-2 -16 l-14 4 l6 -14z" fill="#ffe38a" ${sw(3)}/><rect x="38" y="36" width="24" height="30" rx="4" fill="#5d6a8f" ${sw(3.5)}/><path d="M34 36 h32 l-4 -8 h-24z M34 66 h32 l-4 8 h-24z" fill="#3a3240" ${sw(3)}/>${flameShape(50, 40, 0.4)}<path d="M66 72 l14 14 M76 82 l6 -6 M80 86 l6 -6" ${sw(4)}/>`,
    drift: `<path d="M6 86 q8 -40 40 -42 q16 -24 36 -10 q14 10 12 52z" fill="#eef4fc" ${sw(4)}/><path d="M14 86 q10 -24 34 -26 q10 -16 26 -6 q-14 2 -18 18 q-20 -4 -28 14z" fill="#c8d9ec"/><path d="M58 30 h18 v16 q0 8 -9 12 q-9 -4 -9 -12z" fill="#5b8fd0" ${sw(3)}/><path d="M30 30 v-10 M24 24 h12 M86 22 l4 -4 M88 16 v8 M84 20 h8" stroke="#eef4fc" stroke-width="3" stroke-linecap="round"/>`,
    pockethog: `<path d="M14 74 q0 -40 40 -42 q34 0 36 30 q2 12 -8 12z" fill="#7a5a42" ${sw(4)}/><path d="M22 52 l-8 -8 M30 40 l-4 -12 M42 34 l0 -14 M54 32 l4 -14 M66 34 l8 -12 M76 42 l12 -8" ${sw(4)}/><path d="M58 74 q4 -18 22 -16 q10 2 12 8 l6 4 q-2 6 -8 4 h-32z" fill="#e8c8a0" ${sw(3.5)}/><circle cx="96" cy="70" r="3" fill="${O}"/><circle cx="78" cy="64" r="2.5" fill="${O}"/><path d="M10 80 h82" stroke="#8a6a3a" stroke-width="6" stroke-linecap="round"/>`,
    drafts: `<path d="M16 30 l40 -8 l8 44 l-40 8z" fill="#f2e6c9" ${sw(3.5)}/><path d="M24 38 l24 -5 M26 48 l24 -5 M28 58 l18 -4" stroke="#8a7a60" stroke-width="2.5"/><path d="M40 40 l40 4 l-4 44 l-40 -4z" fill="#efe2c4" ${sw(3.5)}/><path d="M46 52 l26 3 M45 62 l26 3" stroke="#8a7a60" stroke-width="2.5"/>${flameShape(62, 52, 0.95, '#e8502a', '#ffb23e')}`,
    eveninglamp: `<path d="M50 92 V40" ${sw(6)}/><path d="M50 92 V40" stroke="#3a3240" stroke-width="2.5"/><path d="M36 92 h28" ${sw(6)}/><path d="M30 22 h40 l-6 -10 h-28z" fill="#3a3240" ${sw(3.5)}/><path d="M34 22 h32 l-4 20 h-24z" fill="#ffe38a" ${sw(3.5)}/>${flameShape(50, 22, 0.42)}<path d="M50 4 v8" ${sw(3)}/><circle cx="50" cy="32" r="30" fill="#ffd36e" opacity=".22"/>`,
    stubborn: `<path d="M30 88 V58 q-10 -4 -10 -16 q0 -12 12 -12 h6 v-6 q0 -8 8 -8 q8 0 8 8 v-2 q0 -8 8 -8 q8 0 8 8 v4 q0 -8 8 -8 q8 0 8 8 v26 q0 14 -14 18 v24z" fill="#f3cda6" ${sw(4)}/><path d="M54 24 v18 M70 22 v20 M38 30 v14 q8 2 14 -4" fill="none" ${sw(3)}/><path d="M28 74 h50" stroke="#c8423a" stroke-width="8"/><path d="M28 74 h50" ${sw(2)}/><path d="M8 26 l6 4 M10 46 h8 M86 12 l-4 6" stroke="#ffb23e" stroke-width="4" stroke-linecap="round"/>`,
    compass: `<circle cx="50" cy="52" r="34" fill="#c98a2b" ${sw(4)}/><circle cx="50" cy="52" r="26" fill="#f2e6c9" ${sw(3)}/><path d="M50 30 l8 22 h-16z" fill="#c8423a" ${sw(2.5)}/><path d="M50 74 l8 -22 h-16z" fill="#e6edf8" ${sw(2.5)}/><circle cx="50" cy="52" r="4" fill="${O}"/><rect x="44" y="10" width="12" height="10" rx="3" fill="#c98a2b" ${sw(3)}/>`,
    hearth: `<path d="M50 88 Q12 62 16 36 Q20 14 38 16 Q46 18 50 28 Q54 18 62 16 Q80 14 84 36 Q88 62 50 88z" fill="#8a2a24" ${sw(4)}/>${flameShape(50, 44, 1.05, '#e8502a', '#ffb23e')}`,
    rhythm: `<g fill="#c8d9ec" ${sw(3)}><ellipse cx="22" cy="78" rx="8" ry="12" transform="rotate(-15 22 78)"/><ellipse cx="42" cy="56" rx="8" ry="12" transform="rotate(-15 42 56)"/><ellipse cx="62" cy="76" rx="8" ry="12" transform="rotate(-15 62 76)"/></g><path d="M74 40 V10 l16 -4 v26" fill="none" ${sw(4)}/><ellipse cx="70" cy="42" rx="7" ry="5" fill="#ffd36e" ${sw(3)}/><ellipse cx="86" cy="34" rx="7" ry="5" fill="#ffd36e" ${sw(3)}/>`,
    // ---- помехи ----
    blot: `<path d="M50 20 q10 12 20 4 q2 14 16 14 q-8 12 2 22 q-14 4 -12 18 q-12 -6 -20 6 q-6 -12 -20 -8 q2 -14 -12 -18 q10 -10 2 -22 q14 0 14 -14 q8 8 10 -2z" fill="#2a2440" ${sw(4)}/><circle cx="84" cy="18" r="5" fill="#2a2440" ${sw(2.5)}/><circle cx="14" cy="80" r="4" fill="#2a2440" ${sw(2.5)}/><circle cx="88" cy="84" r="3" fill="#2a2440"/><path d="M40 40 q6 -4 10 0" stroke="#6a5aa0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    icy: `<path d="M50 12 l32 16 v40 l-32 18 l-32 -18 v-40z" fill="#9fd0f0" fill-opacity=".8" ${sw(4)}/><path d="M18 28 l32 16 l32 -16 M50 44 v42" fill="none" ${sw(3)}/><path d="M28 40 l12 6 v12 M60 52 l12 -6" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M80 86 q2 6 0 8 q-2 -2 0 -8z M24 88 q2 6 0 8 q-2 -2 0 -8z" fill="#9fd0f0" ${sw(1.5)}/>`,
    sealwax: `<path d="M16 60 q-4 -24 18 -30 q8 -16 26 -10 q20 -2 24 16 q14 10 4 26 q4 18 -16 20 q-14 10 -28 2 q-22 2 -22 -14 q-8 -4 -6 -10z" fill="#8a1e1e" ${sw(4)}/><circle cx="52" cy="56" r="18" fill="#6a1414" ${sw(3)}/><path d="M42 50 h20 M42 58 h20 M52 46 v20" stroke="#b8423a" stroke-width="3"/><path d="M30 28 q-6 -8 2 -14" stroke="#b8423a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    dread: `<rect x="12" y="24" width="76" height="52" rx="4" fill="#5a5a6e" ${sw(4)}/><path d="M12 26 l38 28 l38 -28" fill="none" ${sw(3.5)}/><path d="M34 72 l8 -10 l6 8 l8 -12 l8 14" fill="none" stroke="#2a2a38" stroke-width="3"/><ellipse cx="38" cy="44" rx="4" ry="6" fill="#d6b0ff"/><ellipse cx="62" cy="44" rx="4" ry="6" fill="#d6b0ff"/><path d="M80 82 q4 8 0 12 q-4 -4 0 -12z" fill="#9fc3e8" ${sw(2)}/>`,
    // ---- новые талисманы ----
    magnifier: `<circle cx="42" cy="42" r="26" fill="#cfe6ff" fill-opacity=".7" ${sw(5)}/><circle cx="42" cy="42" r="26" fill="none" stroke="#c98a2b" stroke-width="3"/><path d="M62 62 l24 24" ${sw(11)}/><path d="M62 62 l24 24" stroke="#6b4a32" stroke-width="5" stroke-linecap="round"/><path d="M28 34 q6 -10 16 -10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    kettle: `<path d="M22 84 q-6 -36 28 -42 q34 6 28 42z" fill="#5b8fd0" ${sw(4)}/><path d="M76 60 q14 -4 18 -18" fill="none" ${sw(6)}/><path d="M76 60 q14 -4 18 -18" fill="none" stroke="#5b8fd0" stroke-width="2.5"/><path d="M30 46 q20 -26 40 0" fill="none" ${sw(4)}/><circle cx="50" cy="40" r="5" fill="#3a3240" ${sw(2)}/><path d="M18 84 h64" ${sw(5)}/><path d="M90 30 q-6 -8 0 -14 M84 24 q-6 -8 0 -14" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    whetstone: `<path d="M12 64 l20 -18 h56 l-20 18z" fill="#9aa0ac" ${sw(4)}/><path d="M12 64 h56 v14 h-56z M68 64 l20 -18 v14 l-20 18z" fill="#7a808c" ${sw(4)}/><path d="M30 38 L70 14 l6 6 l-38 28z" fill="#e6edf8" ${sw(3.5)}/><path d="M70 14 l14 -6 l-8 12z" fill="#6b4a32" ${sw(3)}/><path d="M24 30 l-8 -6 M30 24 l-2 -10 M18 40 h-10" stroke="#ffd36e" stroke-width="3.5" stroke-linecap="round"/>`,
    inkwell: `<path d="M24 46 q0 -8 8 -8 h36 q8 0 8 8 v32 q0 8 -8 8 h-36 q-8 0 -8 -8z" fill="#2c3550" ${sw(4)}/><path d="M36 38 v-12 h28 v12" fill="#1e2436" ${sw(4)}/><path d="M24 58 h52" stroke="#4a5a90" stroke-width="4"/><path d="M34 26 h32" ${sw(5)}/><path d="M66 76 q8 6 16 4 q-2 8 -12 6" fill="#3a2f55" ${sw(2)}/><ellipse cx="38" cy="50" rx="4" ry="2" fill="#6a7ab0"/>`,
    pinecone: `<path d="M50 10 q30 20 26 52 q-6 26 -26 30 q-20 -4 -26 -30 q-4 -32 26 -52z" fill="#8a5a32" ${sw(4)}/><path d="M30 36 q20 10 40 0 M26 52 q24 12 48 0 M28 68 q22 12 44 0 M40 22 q10 6 20 0" fill="none" stroke="#5a3a1e" stroke-width="3.5"/><path d="M38 36 l4 14 M58 36 l-4 14 M50 50 v18 M36 56 l4 14 M64 56 l-4 14" stroke="#5a3a1e" stroke-width="3"/><path d="M50 10 q-4 -6 4 -8" ${sw(3)} fill="none"/>`,
    coupon: `<path d="M10 28 h80 v12 q-8 0 -8 10 q0 10 8 10 v12 h-80 v-12 q8 0 8 -10 q0 -10 -8 -10z" fill="#f2d27a" ${sw(4)}/><path d="M34 28 v44" stroke="${O}" stroke-width="3" stroke-dasharray="5 5"/><circle cx="52" cy="40" r="5" fill="none" ${sw(3)}/><circle cx="70" cy="60" r="5" fill="none" ${sw(3)}/><path d="M72 36 L50 64" ${sw(3.5)}/><path d="M22 40 v20" stroke="#c8423a" stroke-width="5" stroke-linecap="round"/>`,
    stub: `<path d="M30 62 h40 v24 h-40z" fill="#efe3c6" ${sw(4)}/><path d="M30 62 q6 8 10 0 q4 10 10 2 q4 8 10 0 q6 8 10 -2" fill="#fff6e0" ${sw(3)}/><path d="M50 62 v-8" ${sw(3)}/><path d="M20 88 h60" ${sw(6)}/><path d="M20 88 h60" stroke="#c98a2b" stroke-width="2.5"/>${flameShape(50, 30, 0.7)}`,
    sled: `<path d="M16 50 h62 v12 h-62z" fill="#a06a3a" ${sw(4)}/><path d="M24 50 v-10 M70 50 v-10 M20 40 h56" ${sw(4)}/><path d="M24 62 v12 M70 62 v12" ${sw(4)}/><path d="M8 78 h76 q12 0 10 -14" fill="none" ${sw(6)}/><path d="M8 78 h76 q12 0 10 -14" fill="none" stroke="#c8423a" stroke-width="2.5"/><path d="M30 56 h34" stroke="#c98a5a" stroke-width="3"/>`,
    piggy: `<ellipse cx="50" cy="56" rx="34" ry="26" fill="#f0a8b4" ${sw(4)}/><path d="M28 38 l-4 -14 l14 8z M58 32 l8 -12 l4 14z" fill="#f0a8b4" ${sw(3)}/><ellipse cx="84" cy="56" rx="8" ry="10" fill="#e88a9a" ${sw(3)}/><circle cx="82" cy="53" r="1.6" fill="${O}"/><circle cx="82" cy="59" r="1.6" fill="${O}"/><circle cx="68" cy="46" r="3" fill="${O}"/><path d="M34 80 v8 M62 80 v8" ${sw(5)}/><path d="M40 34 h18" ${sw(4)}/><circle cx="49" cy="20" r="9" fill="#e6c45a" ${sw(3)}/><path d="M16 52 q-8 -4 -6 -12" fill="none" ${sw(3)}/>`,
    frostglass: `<rect x="16" y="12" width="68" height="76" rx="4" fill="#3a6a9a" ${sw(5)}/><path d="M50 12 v76 M16 50 h68" ${sw(4)}/><g stroke="#e6f2ff" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M22 18 q10 8 6 20 M22 30 q8 0 12 -8 M56 18 q4 10 18 8 M62 28 l8 6 M22 56 q12 4 16 18 M30 80 q4 -8 12 -10 M60 84 q2 -14 18 -20 M66 58 l10 10"/></g>`,
    matchbox: `<path d="M14 54 h60 v30 h-60z" fill="#c8423a" ${sw(4)}/><path d="M14 54 l12 -10 h60 l-12 10z M74 54 l12 -10 v30 l-12 10z" fill="#a8322c" ${sw(4)}/><path d="M26 66 h36" stroke="#f2e6c9" stroke-width="5"/><path d="M40 44 l20 -30 M52 44 l22 -26" ${sw(4)}/><path d="M40 44 l20 -30 M52 44 l22 -26" stroke="#e8d8b0" stroke-width="2"/><circle cx="61" cy="13" r="5" fill="#c8423a" ${sw(2.5)}/><circle cx="75" cy="17" r="5" fill="#c8423a" ${sw(2.5)}/>`,
    stampbook: `<path d="M12 18 h36 q2 0 2 4 v66 q0 -4 -4 -4 h-34z" fill="#2f5d62" ${sw(4)}/><path d="M88 18 h-36 q-2 0 -2 4 v66 q0 -4 4 -4 h34z" fill="#2f5d62" ${sw(4)}/><g ${sw(2.5)}><rect x="18" y="26" width="12" height="14" fill="#c8423a"/><rect x="32" y="26" width="12" height="14" fill="#e6c45a"/><rect x="18" y="46" width="12" height="14" fill="#9fc3e8"/><rect x="56" y="26" width="12" height="14" fill="#8dbf6a"/><rect x="70" y="26" width="12" height="14" fill="#c8423a"/><rect x="56" y="46" width="12" height="14" fill="#e6c45a"/><rect x="70" y="46" width="12" height="14" fill="#d6b0ff"/></g>`,
    hotstone: `<path d="M16 66 q-2 -30 30 -34 q34 -2 40 26 q4 24 -36 26 q-32 0 -34 -18z" fill="#b8361e" ${sw(4)}/><path d="M28 60 q4 -14 22 -16" stroke="#ff9a6a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M34 24 q-6 -8 0 -16 M50 20 q-6 -8 0 -16 M66 24 q-6 -8 0 -16" stroke="#ffb23e" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="60" r="38" fill="#ff7a3a" opacity=".15"/>`,
    clover: `<path d="M50 52 q10 24 30 36" fill="none" ${sw(5)}/><path d="M50 52 q10 24 30 36" fill="none" stroke="#3a7a3a" stroke-width="2"/><path d="M50 48 q-22 -4 -20 -24 q10 -8 20 6 q10 -14 20 -6 q2 20 -20 24z" fill="#5aa05a" ${sw(3)} transform="rotate(0 50 50)"/><path d="M50 48 q-22 -4 -20 -24 q10 -8 20 6 q10 -14 20 -6 q2 20 -20 24z" fill="#5aa05a" ${sw(3)} transform="rotate(90 50 50)"/><path d="M50 48 q-22 -4 -20 -24 q10 -8 20 6 q10 -14 20 -6 q2 20 -20 24z" fill="#5aa05a" ${sw(3)} transform="rotate(180 50 50)"/><path d="M50 48 q-22 -4 -20 -24 q10 -8 20 6 q10 -14 20 -6 q2 20 -20 24z" fill="#5aa05a" ${sw(3)} transform="rotate(270 50 50)"/><circle cx="50" cy="50" r="4" fill="#3a7a3a"/>`,
    horseshoe: `<path d="M24 88 V48 q0 -32 26 -32 q26 0 26 32 v40 h-14 V50 q0 -18 -12 -18 q-12 0 -12 18 v38z" fill="#9aa0ac" ${sw(4)}/><g fill="${O}"><circle cx="31" cy="78" r="2.5"/><circle cx="31" cy="62" r="2.5"/><circle cx="34" cy="44" r="2.5"/><circle cx="69" cy="78" r="2.5"/><circle cx="69" cy="62" r="2.5"/><circle cx="66" cy="44" r="2.5"/></g><path d="M38 24 q10 -6 22 0" stroke="#e6edf8" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    brazier: `<path d="M14 50 h72 q-4 26 -36 28 q-32 -2 -36 -28z" fill="#5a4636" ${sw(4)}/><path d="M30 76 l-10 16 M70 76 l10 16 M50 78 v14" ${sw(5)}/>${flameShape(36, 20, 0.75, '#e8502a', '#ffb23e')}${flameShape(64, 20, 0.75, '#e8502a', '#ffb23e')}${flameShape(50, 12, 1)}`,
    musicbox: `<rect x="14" y="44" width="64" height="40" rx="4" fill="#8a5a32" ${sw(4)}/><path d="M14 44 l10 -16 h64 l-10 16z" fill="#a06a3a" ${sw(4)}/><path d="M78 84 l10 -10 v-30 l-10 16z" fill="#6b4a32" ${sw(3.5)}/><rect x="30" y="56" width="32" height="16" rx="3" fill="#e6c45a" ${sw(3)}/><path d="M88 58 h8 v12" ${sw(4)} fill="none"/><path d="M36 22 V8 l12 -3 v14" fill="none" ${sw(3)}/><ellipse cx="33" cy="22" rx="5" ry="4" fill="#ffd36e" ${sw(2.5)}/><ellipse cx="45" cy="19" rx="5" ry="4" fill="#ffd36e" ${sw(2.5)}/>`,
    ribbon: `<rect x="22" y="40" width="56" height="44" rx="3" fill="#f2e6c9" ${sw(4)}/><rect x="18" y="34" width="56" height="44" rx="3" fill="#efe2c4" ${sw(4)}/><path d="M46 34 v44" stroke="#c8423a" stroke-width="7"/><path d="M46 34 v44" ${sw(1.5)}/><path d="M46 30 q-22 -20 -24 -2 q2 8 24 2 q22 6 24 -2 q-2 -18 -24 2z" fill="#c8423a" ${sw(3)}/><path d="M46 32 l-10 22 M46 32 l12 22" ${sw(4)}/><path d="M46 32 l-10 22 M46 32 l12 22" stroke="#c8423a" stroke-width="2"/>`,
    horn: `<path d="M12 46 q30 -6 52 -24 v56 q-22 -18 -52 -24z" fill="#e6c45a" ${sw(4)}/><ellipse cx="64" cy="50" rx="10" ry="28" fill="#c98a2b" ${sw(4)}/><ellipse cx="64" cy="50" rx="5" ry="18" fill="#6b4a32"/><circle cx="32" cy="64" r="12" fill="none" ${sw(5)}/><circle cx="32" cy="64" r="12" fill="none" stroke="#e6c45a" stroke-width="2"/><path d="M8 46 h8" ${sw(6)}/><path d="M80 30 l10 -6 M82 50 h12 M80 70 l10 6" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>`,
    hourglass: `<path d="M24 12 h52 M24 88 h52" ${sw(7)}/><path d="M24 12 h52 M24 88 h52" stroke="#c98a2b" stroke-width="3"/><path d="M30 16 h40 q0 22 -16 34 q16 12 16 34 h-40 q0 -22 16 -34 q-16 -12 -16 -34z" fill="#cfe6ff" fill-opacity=".7" ${sw(4)}/><path d="M36 22 h28 q-2 12 -14 22 q-12 -10 -14 -22z" fill="#e6c45a"/><path d="M34 82 q2 -14 16 -18 q14 4 16 18z" fill="#e6c45a"/><path d="M50 50 v14" stroke="#e6c45a" stroke-width="2"/>`,
    bottomless: `<path d="M20 36 q-6 30 2 46 q28 12 56 0 q8 -16 2 -46z" fill="#8a6a4a" ${sw(4)}/><ellipse cx="50" cy="36" rx="30" ry="10" fill="#141226" ${sw(4)}/><g fill="#fff3c4"><circle cx="40" cy="36" r="1.8"/><circle cx="56" cy="34" r="2.2"/><circle cx="64" cy="38" r="1.4"/><circle cx="34" cy="38" r="1.2"/></g><path d="M30 30 q20 -24 40 0" fill="none" ${sw(5)}/><path d="M30 30 q20 -24 40 0" fill="none" stroke="#a06a3a" stroke-width="2"/><rect x="40" y="56" width="20" height="14" fill="#f2e6c9" ${sw(2.5)}/><path d="M40 57 l10 7 l10 -7" fill="none" ${sw(2)}/>`,
    crown: `<path d="M14 74 l-4 -44 l22 18 l18 -30 l18 30 l22 -18 l-4 44z" fill="#e6c45a" ${sw(4)}/><path d="M14 74 h72 v12 h-72z" fill="#c98a2b" ${sw(4)}/><circle cx="50" cy="56" r="7" fill="#4fc7c0" ${sw(3)}/><circle cx="28" cy="62" r="4" fill="#c8423a" ${sw(2.5)}/><circle cx="72" cy="62" r="4" fill="#c8423a" ${sw(2.5)}/><circle cx="10" cy="30" r="4" fill="#e6c45a" ${sw(2.5)}/><circle cx="50" cy="18" r="4" fill="#e6c45a" ${sw(2.5)}/><circle cx="90" cy="30" r="4" fill="#e6c45a" ${sw(2.5)}/>`,
    bellows: `<path d="M20 30 q-8 20 0 40 l40 -10 v-20z" fill="#8a5a32" ${sw(4)}/><path d="M24 36 l34 8 M22 50 h36 M24 64 l34 -8" stroke="#5a3a1e" stroke-width="3"/><path d="M20 30 l-12 -8 M20 70 l-12 8" ${sw(5)}/><path d="M60 44 h22 l4 6 l-4 6 h-22z" fill="#9aa0ac" ${sw(3.5)}/>${flameShape(90, 30, 0.6, '#e8502a', '#ffb23e')}<path d="M70 70 q8 4 16 0 M74 80 q6 2 12 0" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    moonstone: `<path d="M50 10 l30 24 l-8 44 l-22 14 l-22 -14 l-8 -44z" fill="#cfd8f0" ${sw(4)}/><path d="M20 34 l30 10 l30 -10 M50 44 v48" fill="none" stroke="#9aa8c8" stroke-width="3"/><path d="M58 58 A12 12 0 1 1 52 36 A9 9 0 1 0 58 58z" fill="#fff3c4" ${sw(2)}/><circle cx="50" cy="50" r="42" fill="#d6e2ff" opacity=".15"/>`,
    goldquill: `<path d="M18 88 Q26 30 88 10 Q74 62 24 84z" fill="#e6c45a" ${sw(4)}/><path d="M14 92 L80 18" ${sw(3)}/><path d="M40 56 l14 8 M50 42 l14 6 M62 30 l12 4" stroke="#b08a2a" stroke-width="3" stroke-linecap="round"/><path d="M80 52 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff3c4" ${sw(2)}/>`,
    // ---- карты и особенности героев ----
    firefly: `<path d="M40 50 q-22 -22 -30 -4 q2 14 26 10z M60 50 q22 -22 30 -4 q-2 14 -26 10z" fill="#cfe6ff" fill-opacity=".85" ${sw(3)}/><ellipse cx="50" cy="56" rx="10" ry="16" fill="#3a3240" ${sw(3.5)}/><ellipse cx="50" cy="70" rx="9" ry="9" fill="#ffe38a" ${sw(3)}/><circle cx="50" cy="70" r="16" fill="#ffe38a" opacity=".3"/><path d="M44 40 q-4 -10 -10 -12 M56 40 q4 -10 10 -12" fill="none" ${sw(2.5)}/><circle cx="50" cy="40" r="7" fill="#3a3240" ${sw(3)}/>`,
    lampglass: `<path d="M34 16 h32 l-4 10 q14 14 14 34 q0 24 -26 28 q-26 -4 -26 -28 q0 -20 14 -34z" fill="#cfe6ff" fill-opacity=".55" ${sw(4)}/><path d="M42 36 q-8 12 -6 30" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>${flameShape(52, 48, 0.8)}<path d="M32 88 h36" ${sw(5)}/>`,
    beam: `<path d="M8 92 L54 46 L64 56 Z" fill="#ffe38a" ${sw(3)}/><path d="M14 92 L58 50" stroke="#fff6d0" stroke-width="3"/><circle cx="66" cy="34" r="20" fill="#ffd36e" ${sw(4)}/><circle cx="66" cy="34" r="30" fill="#ffd36e" opacity=".25"/><path d="M66 4 v8 M96 34 h-8 M87 13 l-6 6 M45 13 l6 6 M87 55 l-6 -6" ${sw(4)}/>`,
    urgent: `<rect x="10" y="30" width="62" height="42" rx="4" fill="#f2e6c9" ${sw(4)}/><path d="M10 32 l31 22 l31 -22" fill="none" ${sw(3.5)}/><path d="M76 24 l14 -6 M78 44 h16 M76 62 l14 6" ${sw(4)}/><path d="M28 62 h26" stroke="#c8423a" stroke-width="5" stroke-linecap="round"/><path d="M62 10 l-10 18 h10 l-8 16" fill="none" stroke="#ffd36e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    express: `<path d="M18 40 l32 -14 l32 14 v36 l-32 14 l-32 -14z" fill="#b8865a" ${sw(4)}/><path d="M18 40 l32 14 l32 -14 M50 54 v36" fill="none" ${sw(3.5)}/><path d="M16 46 q-12 -10 -10 -26 q8 10 18 10 M84 46 q12 -10 10 -26 q-8 10 -18 10" fill="#f4f1ea" ${sw(3)}/><path d="M34 33 l32 14" stroke="#c8423a" stroke-width="4"/>`,
    rushmail: `<path d="M14 62 h50 l-6 10 l6 10 h-50 l6 -10z" fill="#f2e6c9" ${sw(3.5)}/><path d="M24 72 h6 M36 72 h2 M44 72 h10" ${sw(4)}/><path d="M30 20 h50 l-6 10 l6 10 h-50 l6 -10z" fill="#efe2c4" ${sw(3.5)}/><path d="M42 30 h4 M52 30 h12" ${sw(4)}/><path d="M78 50 l12 -4 l-6 10 l12 -2" fill="none" stroke="#ffd36e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    icewall: `<path d="M10 88 V40 l14 -18 l16 14 l12 -20 l16 18 l12 -14 l10 20 v48z" fill="#9fd0f0" fill-opacity=".85" ${sw(4)}/><path d="M10 60 h80 M10 74 h80 M30 40 v20 M60 36 v24 M44 60 v14 M74 60 v14 M24 74 v14 M58 74 v14" stroke="#e6f6ff" stroke-width="3"/><path d="M10 88 h80" ${sw(5)}/>`,
    hedge: `<path d="M8 90 q4 -40 20 -44 q6 -20 22 -16 q16 -10 26 8 q18 2 16 52z" fill="#3a7a4a" ${sw(4)}/><g fill="#cfe6ff" ${sw(2.5)}><path d="M24 48 l-6 -14 l12 8z"/><path d="M48 30 l2 -16 l8 14z"/><path d="M76 38 l10 -12 l-2 16z"/><path d="M90 66 l8 -4 l-6 10z"/><path d="M10 66 l-6 -6 l10 0z"/></g><path d="M8 90 h84" ${sw(5)}/><path d="M30 64 q8 -6 14 2 M56 56 q8 -6 14 2" stroke="#2a5a36" stroke-width="3" fill="none"/>`,
    standfast: `<path d="M66 14 A34 34 0 1 0 84 70 A28 28 0 1 1 66 14z" fill="#f4e6a8" ${sw(4)}/><path d="M22 54 h44 v30 q0 10 -22 14 q-22 -4 -22 -14z" fill="#5b6f8f" ${sw(4)}/><path d="M22 66 h44 M44 54 v44" ${sw(3)}/><g fill="#c9ccd8" ${sw(1.5)}><circle cx="30" cy="60" r="2.5"/><circle cx="58" cy="60" r="2.5"/><circle cx="30" cy="78" r="2.5"/><circle cx="58" cy="78" r="2.5"/></g>`,
    flue: `<path d="M30 90 V44 h40 v46z" fill="#a8553a" ${sw(4)}/><path d="M26 36 h48 v10 h-48z" fill="#8a4430" ${sw(4)}/><path d="M30 58 h40 M30 74 h40 M50 46 v12 M40 58 v16 M60 58 v16 M50 74 v16" stroke="#6a3222" stroke-width="2.5"/><path d="M44 30 q-10 -10 0 -18 q8 -6 0 -10 M58 30 q-6 -8 2 -14" fill="none" stroke="#7a7488" stroke-width="5" stroke-linecap="round"/>${flameShape(50, 62, 0.55, '#e8502a', '#ffb23e')}`,
    poker: `<path d="M18 88 L70 26" ${sw(7)}/><path d="M18 88 L70 26" stroke="#5a5a6e" stroke-width="3"/><path d="M66 30 l10 -18 l8 6 l-10 10 l8 6" fill="none" ${sw(5)}/><path d="M66 30 l10 -18 l8 6 l-10 10 l8 6" fill="none" stroke="#ff7a3a" stroke-width="2"/><path d="M12 80 l14 14" ${sw(8)}/><path d="M12 80 l14 14" stroke="#6b4a32" stroke-width="4"/><circle cx="84" cy="14" r="10" fill="#ffb23e" opacity=".45"/>`,
    fan: `<path d="M20 60 q-8 20 0 40 l40 -10 v-20z" fill="#8a5a32" ${sw(4)} transform="translate(-6 -30)"/><path d="M54 50 l14 0" ${sw(5)}/>${flameShape(80, 34, 0.85, '#e8502a', '#ffb23e')}<path d="M58 30 q8 -2 12 4 M58 64 q8 2 12 -4" fill="none" stroke="#cfe6ff" stroke-width="3" stroke-linecap="round"/>`,
    wingboots: `<path d="M30 30 h22 v34 l24 8 q8 4 6 14 h-52z" fill="#8a4a2a" ${sw(4)}/><path d="M30 86 h52" ${sw(6)}/><path d="M30 44 q-18 -18 -24 -4 q8 0 8 8 q-8 2 -6 10 q10 -6 22 0" fill="#f4f1ea" ${sw(3)}/><path d="M36 40 h12 M36 50 h12" stroke="#d8a94a" stroke-width="3"/>`,
    ironshutter: `<path d="M22 14 h56 v72 h-56z" fill="#8a5a32" ${sw(4)}/><path d="M22 32 h56 M22 50 h56 M22 68 h56" stroke="#5a3a1e" stroke-width="3"/><path d="M22 24 h56 M22 76 h56" stroke="#9aa0ac" stroke-width="7"/><path d="M22 24 h56 M22 76 h56" ${sw(1.5)}/><g fill="#c9ccd8" ${sw(1.5)}><circle cx="30" cy="24" r="3"/><circle cx="70" cy="24" r="3"/><circle cx="30" cy="76" r="3"/><circle cx="70" cy="76" r="3"/></g>`,
    sootbroom: `<path d="M74 10 L40 66" ${sw(7)}/><path d="M74 10 L40 66" stroke="#b07a4a" stroke-width="3"/><path d="M40 60 l-28 22 l6 8 l14 -6 l-2 10 l12 -10 l2 8 l8 -14z" fill="#c9a46a" ${sw(3.5)}/><path d="M18 84 l6 6 M28 82 l2 8 M36 76 l4 6" stroke="#3a3440" stroke-width="3" stroke-linecap="round"/><path d="M36 64 l10 6" ${sw(5)}/><path d="M36 64 l10 6" stroke="#e8702a" stroke-width="2"/><circle cx="20" cy="70" r="4" fill="#ff8a3a" opacity=".8"/><circle cx="30" cy="92" r="3" fill="#ff8a3a" opacity=".7"/>`,
    showbooth: `<path d="M50 8 v8" ${sw(3)}/><path d="M50 6 l12 4 l-12 4z" fill="#c8423a" ${sw(2)}/><path d="M12 46 Q30 30 50 16 Q70 30 88 46z" fill="#e8c84a" ${sw(4)}/><path d="M50 16 Q42 30 36 46 M50 16 Q58 30 64 46 M50 16 Q26 32 22 46 M50 16 Q74 32 78 46" fill="none" stroke="#c8423a" stroke-width="5"/><path d="M12 46 Q30 30 50 16 Q70 30 88 46z" fill="none" ${sw(4)}/><rect x="16" y="46" width="68" height="42" fill="#3a3456" ${sw(4)}/><rect x="28" y="52" width="44" height="28" rx="2" fill="#fbf6ee" ${sw(3)}/><path d="M34 74 l10 -12 l8 8 l6 -6 l10 10z" fill="#5a7ab0"/><circle cx="62" cy="60" r="4" fill="#ffcf4a"/><path d="M16 46 q8 10 16 0 q8 10 18 0 q8 10 18 0 q8 10 16 0" fill="#c8423a" ${sw(3)}/>`,
    // ---------- герои: пряничница, точильщик, пастушка, знахарка ----------
    gingerbread: `<rect x="14" y="20" width="72" height="60" rx="20" fill="#b8743a" ${sw(4)}/><rect x="22" y="28" width="56" height="44" rx="13" fill="none" stroke="#f8f2e8" stroke-width="3" stroke-dasharray="5 4"/><path d="M50 64 q-15 -10 -11 -19 q4 -7 11 0 q7 -7 11 0 q4 9 -11 19z" fill="#e85a5a" ${sw(2.5)}/><g fill="#f8f2e8"><circle cx="30" cy="50" r="2.6"/><circle cx="70" cy="50" r="2.6"/><circle cx="50" cy="36" r="2.6"/></g>`,
    dough: `<path d="M62 34 L86 10" ${sw(7)}/><path d="M62 34 L86 10" stroke="#c9a46a" stroke-width="3"/><path d="M22 50 q6 -24 28 -22 q24 -2 28 22z" fill="#f4e2c0" ${sw(4)}/><path d="M36 40 q4 -5 9 -3 M55 36 q5 -2 9 2" stroke="#d8b888" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M12 50 h76 q-2 34 -38 36 q-36 -2 -38 -36z" fill="#5a7ab0" ${sw(4)}/><path d="M20 62 h60" stroke="#f4f1ea" stroke-width="3" opacity=".7"/><circle cx="50" cy="72" r="4" fill="#f4f1ea" opacity=".8"/>`,
    rollingpin: `<g transform="rotate(-35 50 50)"><rect x="6" y="45" width="18" height="10" rx="4" fill="#b07a40" ${sw(3.5)}/><rect x="76" y="45" width="18" height="10" rx="4" fill="#b07a40" ${sw(3.5)}/><rect x="22" y="38" width="56" height="24" rx="10" fill="#e0b070" ${sw(4)}/><path d="M32 43 v14 M68 43 v14" stroke="#b07a40" stroke-width="2.5"/></g><g fill="#f4f1ea" opacity=".85"><circle cx="20" cy="80" r="7"/><circle cx="31" cy="88" r="5"/><circle cx="80" cy="20" r="5"/><circle cx="88" cy="30" r="3.5"/></g>`,
    glaze: `<rect x="16" y="32" width="68" height="54" rx="18" fill="#b8743a" ${sw(4)}/><path d="M18 52 q0 -20 20 -20 h24 q20 0 20 20 v4 q-6 9 -10 0 q-6 11 -12 0 q-6 13 -12 0 q-6 9 -12 0 q-6 7 -10 0z" fill="#fbf6ee" ${sw(3)}/>${star4(80, 20, 10)}${star4(22, 18, 6)}${star4(56, 14, 5)}`,
    gingerhouse: `<path d="M16 52 L50 16 L84 52z" fill="#8a4a2a" ${sw(4)}/><path d="M24 50 L50 23 L76 50" fill="none" stroke="#fbf6ee" stroke-width="3" stroke-dasharray="4 3"/><rect x="22" y="52" width="56" height="36" fill="#c8843a" ${sw(4)}/><path d="M22 52 q4 7 8 0 q4 7 8 0 q4 7 8 0 q4 7 8 0 q4 7 8 0 q4 7 8 0 q4 7 8 0" fill="#fbf6ee" ${sw(2.5)}/><rect x="42" y="66" width="16" height="22" rx="7" fill="#5a2e1a" ${sw(3)}/><rect x="28" y="64" width="10" height="10" fill="#ffd36e" ${sw(2.5)}/><rect x="62" y="64" width="10" height="10" fill="#ffd36e" ${sw(2.5)}/><circle cx="50" cy="38" r="5" fill="#e85a5a" ${sw(2)}/>`,
    fair: `<path d="M14 32 h72 l-8 -16 h-56z" fill="#c8423a" ${sw(4)}/><path d="M32 16 l-4 16 M50 16 v16 M68 16 l4 16" stroke="#fbf6ee" stroke-width="5"/><path d="M14 32 h72 l-8 -16 h-56z" fill="none" ${sw(4)}/><path d="M14 32 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0" fill="#fbf6ee" ${sw(3)}/><path d="M20 38 v48 M80 38 v48" ${sw(4)}/><circle cx="36" cy="56" r="10" fill="#b8743a" ${sw(3)}/><circle cx="62" cy="54" r="11" fill="#b8743a" ${sw(3)}/><circle cx="36" cy="56" r="4.5" fill="none" stroke="#fbf6ee" stroke-width="2"/><path d="M62 59 q-6 -4 -4 -8 q2 -3 4 0 q2 -3 4 0 q2 4 -4 8z" fill="#e85a5a"/><rect x="12" y="68" width="76" height="20" rx="2" fill="#8a5a32" ${sw(4)}/><path d="M12 78 h76" stroke="#6b4428" stroke-width="3"/>`,
    hone: `<g transform="rotate(-24 50 66)"><rect x="12" y="58" width="76" height="18" rx="4" fill="#9a948a" ${sw(4)}/><path d="M20 64 h60 M24 70 h52" stroke="#bab4aa" stroke-width="2"/></g><path d="M22 46 L84 16 q8 6 0 12 L30 56z" fill="#e4eaf2" ${sw(4)}/><path d="M34 46 L80 24" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M30 56 l-14 6 l-5 -9 l11 -7" fill="#6b4a32" ${sw(3.5)}/><path d="M60 48 l12 10 M66 42 l16 4 M56 52 l4 14" stroke="${O}" stroke-width="5" stroke-linecap="round"/><path d="M60 48 l12 10 M66 42 l16 4 M56 52 l4 14" stroke="#ffb23e" stroke-width="2.5" stroke-linecap="round"/>`,
    gritsparks: `<circle cx="38" cy="58" r="28" fill="#9a9aa6" ${sw(4)}/><circle cx="38" cy="58" r="20" fill="none" stroke="#7a7a86" stroke-width="3"/><path d="M24 50 a16 16 0 0 1 14 -8" fill="none" stroke="#c4c4ce" stroke-width="3" stroke-linecap="round"/><circle cx="38" cy="58" r="6" fill="#6a4a2a" ${sw(3)}/><path d="M64 42 L90 20 M68 50 L96 40 M62 34 L74 10 M68 58 L94 62" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M64 42 L90 20 M68 50 L96 40 M62 34 L74 10 M68 58 L94 62" stroke="#ffb23e" stroke-width="3" stroke-linecap="round"/><path d="M66 42 L86 25 M70 50 L90 42" stroke="#fff3c4" stroke-width="1.5" stroke-linecap="round"/>`,
    oselok: `<path d="M12 56 L64 28 L88 42 L36 70z" fill="#b0aaa0" ${sw(4)}/><path d="M12 56 L36 70 V84 L12 70z" fill="#8a847a" ${sw(4)}/><path d="M36 70 L88 42 V56 L36 84z" fill="#7a746c" ${sw(4)}/><path d="M26 56 L68 34 M36 62 L78 40" stroke="#ccc6bc" stroke-width="2.5" stroke-linecap="round"/><path d="M22 20 q-7 11 0 13 q7 -2 0 -13z M38 8 q-5 8 0 10 q5 -2 0 -10z" fill="#9ad4ff" ${sw(2)}/>`,
    apprentice: `<path d="M20 90 L38 36 M80 90 L62 36" ${sw(6)}/><path d="M20 90 L38 36 M80 90 L62 36" stroke="#a06a3a" stroke-width="2.5"/><path d="M22 70 h56" ${sw(5)}/><path d="M22 70 h56" stroke="#a06a3a" stroke-width="2"/><circle cx="50" cy="38" r="24" fill="#9a9aa6" ${sw(4)}/><circle cx="50" cy="38" r="16" fill="none" stroke="#7a7a86" stroke-width="3"/><circle cx="50" cy="38" r="5" fill="#6a4a2a" ${sw(3)}/><path d="M50 38 L76 56 h12" fill="none" ${sw(6)}/><path d="M50 38 L76 56 h12" fill="none" stroke="#d8a94a" stroke-width="2.5"/>${star4(16, 18, 8)}${star4(86, 20, 6)}`,
    steelring: `<path d="M24 28 q-9 16 0 32 M13 20 q-14 24 0 48 M76 28 q9 16 0 32 M87 20 q14 24 0 48" fill="none" stroke="#cfe6ff" stroke-width="3.5" stroke-linecap="round"/><path d="M44 72 L44 20 L50 8 L56 20 L56 72z" fill="#e4eaf2" ${sw(4)}/><path d="M50 14 V68" stroke="#ffffff" stroke-width="2.5"/><path d="M34 74 h32" ${sw(7)}/><path d="M34 74 h32" stroke="#d8a94a" stroke-width="3.5"/><rect x="45" y="78" width="10" height="14" rx="2" fill="#6b4a32" ${sw(3)}/>`,
    sic: `${dogHead(42, 54, 1.05, { bark: true })}<path d="M74 34 l14 -8 M78 50 h16 M74 66 l14 8" stroke="#fff3c4" stroke-width="4.5" stroke-linecap="round"/><path d="M74 34 l14 -8 M78 50 h16 M74 66 l14 8" ${sw(1.2)} fill="none" opacity=".4"/>`,
    heel: `<path d="M50 10 l34 10 v26 q0 30 -34 46 q-34 -16 -34 -46 v-26z" fill="#5b6f8f" ${sw(4)}/><path d="M50 18 l26 8 v20 q0 24 -26 37 q-26 -13 -26 -37 v-20z" fill="none" stroke="#8aa0c4" stroke-width="2.5"/>${dogHead(50, 54, 0.95)}`,
    bone: `<g transform="rotate(-30 50 50)"><g fill="${O}"><circle cx="24" cy="41" r="12"/><circle cx="24" cy="59" r="12"/><circle cx="76" cy="41" r="12"/><circle cx="76" cy="59" r="12"/><rect x="22" y="39" width="56" height="22"/></g><g fill="#f4ead8"><circle cx="24" cy="41" r="8.5"/><circle cx="24" cy="59" r="8.5"/><circle cx="76" cy="41" r="8.5"/><circle cx="76" cy="59" r="8.5"/><rect x="22" y="42.5" width="56" height="15"/></g><path d="M30 46 h40" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></g>${star4(80, 18, 8)}${star4(18, 80, 6)}${star4(84, 76, 4)}`,
    wolfhound: `${dogHead(50, 46, 1.25, { fur: '#9a9aa6', ear: '#5e5e6a' })}<path d="M24 76 q26 14 52 0" fill="none" ${sw(10)}/><path d="M24 76 q26 14 52 0" fill="none" stroke="#3a3240" stroke-width="6"/><g fill="#c9ccd8" ${sw(1.8)}><path d="M30 80 l-2 10 l7 -6z"/><path d="M44 84 l0 10 l6 -8z"/><path d="M58 84 l2 10 l4 -10z"/><path d="M70 80 l4 9 l1 -10z"/></g>`,
    howl: `<path d="M74 8 A22 22 0 1 0 92 40 A17 17 0 1 1 74 8z" fill="#f4e6a8" ${sw(3.5)}/>${dogHead(40, 62, 1, { howl: true, rot: -28 })}<path d="M58 30 q6 -6 4 -14 M64 40 q10 -6 10 -16" stroke="#cfe6ff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    bitterroot: `<path d="M44 22 q-10 -12 -22 -8 q6 10 22 8z M56 22 q10 -14 24 -10 q-6 12 -24 10z" fill="#6aa04a" ${sw(3)}/><path d="M50 22 v-10" ${sw(3)}/><path d="M38 24 h24 q6 22 -4 38 q-2 16 8 28 q-12 -2 -13 -16 q-3 12 -16 16 q10 -10 7 -26 q-10 -18 -6 -40z" fill="#a0703a" ${sw(4)}/><path d="M45 36 q5 4 0 8 M54 48 q-5 4 0 8 M47 60 q4 3 0 6" stroke="#6b4a2a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    chamomile: `<path d="M38 26 q-6 -8 0 -16 M52 26 q-6 -8 0 -18" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M72 50 q16 0 14 14 q-2 10 -14 8" fill="none" ${sw(4)}/><path d="M18 40 h56 q0 40 -28 42 q-28 -2 -28 -42z" fill="#f4f1ea" ${sw(4)}/><ellipse cx="46" cy="40" rx="28" ry="5" fill="#e6c45a" ${sw(3)}/><g ${sw(1.8)} fill="#ffffff"><ellipse cx="34" cy="31" rx="4" ry="7"/><ellipse cx="34" cy="49" rx="4" ry="7"/><ellipse cx="25" cy="40" rx="7" ry="4"/><ellipse cx="43" cy="40" rx="7" ry="4"/><ellipse cx="28" cy="34" rx="6" ry="3.5" transform="rotate(45 28 34)"/><ellipse cx="40" cy="46" rx="6" ry="3.5" transform="rotate(45 40 46)"/><ellipse cx="40" cy="34" rx="6" ry="3.5" transform="rotate(-45 40 34)"/><ellipse cx="28" cy="46" rx="6" ry="3.5" transform="rotate(-45 28 46)"/></g><circle cx="34" cy="40" r="5.5" fill="#ffcf4a" ${sw(2)}/><path d="M28 64 q18 8 36 0" stroke="#d8d0c4" stroke-width="3" fill="none"/>`,
    wormwood: `<path d="M44 92 Q40 60 50 18" fill="none" ${sw(5)}/><path d="M44 92 Q40 60 50 18" fill="none" stroke="#7a9a6a" stroke-width="2.4"/><g fill="#b8ccb0" ${sw(2)}><path d="M48 30 q-14 -4 -20 -14 q12 0 20 8z"/><path d="M48 30 q12 -8 22 -6 q-6 10 -22 10z"/><path d="M45 50 q-16 -2 -24 -12 q14 -2 24 6z"/><path d="M45 50 q14 -8 24 -4 q-6 10 -24 8z"/><path d="M43 70 q-14 0 -22 -10 q14 -2 22 4z"/><path d="M43 70 q14 -6 22 -2 q-6 10 -22 6z"/></g><path d="M80 52 l-10 14 h8 l-6 14 l14 -18 h-8 l6 -10z" fill="#ffd36e" ${sw(2.5)}/>`,
    sleepgrass: `<path d="M48 92 q-6 -26 2 -46" fill="none" ${sw(5)}/><path d="M48 92 q-6 -26 2 -46" fill="none" stroke="#6a9a4a" stroke-width="2.4"/><path d="M40 70 q-12 -4 -16 -14 q12 0 16 8z M50 74 q12 -6 18 -2 q-6 8 -18 6z" fill="#7ab04a" ${sw(2)}/><path d="M32 22 q2 24 18 26 q16 -2 18 -26 q-8 6 -10 -6 q-6 10 -8 -2 q-2 12 -8 2 q-2 12 -10 6z" fill="#b08ad8" ${sw(3.5)}/><path d="M44 30 q4 8 6 14 M56 30 q-4 8 -6 14" stroke="#8a64b8" stroke-width="2" fill="none"/><circle cx="50" cy="40" r="3.5" fill="#ffcf4a" ${sw(1.5)}/><path d="M70 14 h12 l-12 12 h12 M82 36 h8 l-8 8 h8" fill="none" stroke="#cfe6ff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    livingwater: `<rect x="40" y="6" width="20" height="12" rx="3" fill="#a06a3a" ${sw(3)}/><path d="M42 18 h16 v16 q22 10 22 32 q0 24 -30 24 q-30 0 -30 -24 q0 -22 22 -32z" fill="#e6f4ff" ${sw(4)}/><path d="M23 62 q27 -10 54 0 q2 20 -27 22 q-29 -2 -27 -22z" fill="#5ac8e8"/><path d="M42 18 h16 v16 q22 10 22 32 q0 24 -30 24 q-30 0 -30 -24 q0 -22 22 -32z" fill="none" ${sw(4)}/><path d="M30 52 q4 -8 12 -12" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>${star4(50, 70, 7)}${star4(84, 24, 6)}${star4(16, 30, 5)}`,
    moldform: `<rect x="12" y="12" width="76" height="76" rx="12" fill="#b07a40" ${sw(4)}/><rect x="22" y="22" width="56" height="56" rx="9" fill="#8a5a2a" ${sw(3)}/><g fill="none" stroke="#5a3a1a" stroke-width="3" stroke-linecap="round"><path d="M50 30 v40 M30 50 h40"/><circle cx="50" cy="50" r="10"/><path d="M34 34 l6 6 M66 34 l-6 6 M34 66 l6 -6 M66 66 l-6 -6"/></g><circle cx="50" cy="50" r="4" fill="#e85a5a" ${sw(1.5)}/><g fill="#d8a94a"><circle cx="18" cy="18" r="2"/><circle cx="82" cy="18" r="2"/><circle cx="18" cy="82" r="2"/><circle cx="82" cy="82" r="2"/></g>`,
    grindwheel: `<path d="M16 92 L30 52 M64 92 L52 52" ${sw(6)}/><path d="M16 92 L30 52 M64 92 L52 52" stroke="#a06a3a" stroke-width="2.5"/><path d="M58 88 h22 l6 -6" fill="none" ${sw(5)}/><path d="M58 88 h22 l6 -6" fill="none" stroke="#a06a3a" stroke-width="2"/><circle cx="42" cy="42" r="28" fill="#9a9aa6" ${sw(4)}/><circle cx="42" cy="42" r="20" fill="none" stroke="#7a7a86" stroke-width="3"/><circle cx="42" cy="42" r="6" fill="#6a4a2a" ${sw(3)}/><path d="M70 30 L92 14 M72 40 L96 34 M66 22 L76 6" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M70 30 L92 14 M72 40 L96 34 M66 22 L76 6" stroke="#ffb23e" stroke-width="3" stroke-linecap="round"/>`,
    dogfriend: `${dogHead(50, 44, 1.35)}<path d="M26 74 q24 12 48 0" fill="none" ${sw(10)}/><path d="M26 74 q24 12 48 0" fill="none" stroke="#c8423a" stroke-width="6"/><circle cx="50" cy="86" r="7" fill="#e6c45a" ${sw(2.5)}/>`,
    mortar: `<path d="M56 50 L82 12" ${sw(10)}/><path d="M56 50 L82 12" stroke="#c9a46a" stroke-width="5.5"/><path d="M16 46 h68 q-2 32 -18 38 h-32 q-16 -6 -18 -38z" fill="#8a8a96" ${sw(4)}/><path d="M28 84 h44 l4 8 h-52z" fill="#6a6a76" ${sw(3.5)}/><ellipse cx="50" cy="46" rx="34" ry="7" fill="#4a4a56" ${sw(3.5)}/><path d="M24 44 q4 -14 16 -12 q-4 12 -16 12z" fill="#6aa04a" ${sw(2.5)}/><path d="M64 44 q8 -10 16 -6 q-6 8 -16 6z" fill="#7ab04a" ${sw(2.5)}/><path d="M24 60 q26 8 52 0" stroke="#a8a8b4" stroke-width="3" fill="none"/>`,
    wickcutter: `<path d="M30 92 L52 46 M70 92 L48 46" ${sw(7)}/><path d="M30 92 L52 46 M70 92 L48 46" stroke="#9aa0ac" stroke-width="3.5"/><circle cx="50" cy="50" r="5" fill="#c9ccd8" ${sw(2.5)}/><path d="M50 46 L36 18 h10 L52 40 M50 46 L64 18 h-10 L48 40" fill="#9aa0ac" ${sw(3)}/><circle cx="26" cy="90" r="8" fill="none" ${sw(4)}/><circle cx="74" cy="90" r="8" fill="none" ${sw(4)}/>${flameShape(50, 10, 0.4)}`,
    milestone: `<path d="M34 92 V20 h32 v72" fill="#f4f1ea" ${sw(4)}/><path d="M34 34 h32 M34 58 h32" stroke="#2a2a3a" stroke-width="7"/><path d="M34 46 h32 M34 70 h32" stroke="#2a2a3a" stroke-width="7"/><path d="M30 14 h40 l-4 8 h-32z" fill="#c8423a" ${sw(3.5)}/><path d="M34 92 V20 h32 v72" fill="none" ${sw(4)}/><path d="M18 92 h64" ${sw(5)}/>`,
    bridgerail: `<path d="M8 40 h84" ${sw(9)}/><path d="M8 40 h84" stroke="#8a5a32" stroke-width="5"/><path d="M8 78 h84" ${sw(9)}/><path d="M8 78 h84" stroke="#8a5a32" stroke-width="5"/><g fill="#8a5a32" ${sw(3.5)}><rect x="16" y="34" width="10" height="56"/><rect x="45" y="34" width="10" height="56"/><rect x="74" y="34" width="10" height="56"/></g><g fill="#c9ccd8" ${sw(2)}><path d="M21 34 l-4 -14 l8 0z"/><path d="M50 34 l-4 -14 l8 0z"/><path d="M79 34 l-4 -14 l8 0z"/></g><path d="M30 50 l6 8 l6 -8 M60 50 l6 8 l6 -8" stroke="#cfe6ff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    chimneycap: `<path d="M30 92 V50 h40 v42" fill="#a0523a" ${sw(4)}/><path d="M30 62 h40 M30 76 h40 M50 50 v12 M42 62 v14 M58 62 v14 M50 76 v16" stroke="#6b2e1e" stroke-width="2.5"/><path d="M22 50 h56 v-8 h-56z" fill="#5a4a5a" ${sw(3.5)}/><path d="M18 36 L50 14 L82 36z" fill="#3a3440" ${sw(4)}/><path d="M50 36 v6" ${sw(4)}/>${flameShape(84, 70, 0.55, '#e8502a', '#ffb23e')}`,
    honeypot: `<path d="M26 40 h48 q8 4 6 14 q-2 30 -30 34 q-28 -4 -30 -34 q-2 -10 6 -14z" fill="#c8843a" ${sw(4)}/><path d="M22 30 h56 v10 h-56z" fill="#e8d0a0" ${sw(3.5)}/><path d="M30 40 q2 10 6 0 q4 14 8 0 q4 10 8 0 q4 14 8 0 q4 8 6 0" fill="#ffcf4a" ${sw(2.5)}/><path d="M26 64 q24 10 48 0" stroke="#8a4a2a" stroke-width="3" fill="none"/><path d="M60 24 L84 6" ${sw(6)}/><path d="M60 24 L84 6" stroke="#c9a46a" stroke-width="2.5"/><circle cx="58" cy="26" r="6" fill="#ffcf4a" ${sw(2.5)}/>`,
    leatherstrop: `<path d="M28 10 q-6 0 -6 8 v70 h22 v-70 q0 -8 -6 -8z" fill="#8a4a2a" ${sw(4)}/><path d="M33 22 v60" stroke="#6b3a1e" stroke-width="2.5" stroke-dasharray="5 4"/><rect x="18" y="6" width="30" height="10" rx="3" fill="#c9ccd8" ${sw(3)}/><path d="M58 76 L86 20 q6 4 2 10 L66 80z" fill="#e4eaf2" ${sw(4)}/><path d="M64 72 L84 30" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/><path d="M66 80 l-6 12 l-8 -4 l6 -12" fill="#6b4a32" ${sw(3)}/>${star4(78, 52, 7)}`,
    collar: `<ellipse cx="50" cy="44" rx="36" ry="26" fill="none" ${sw(13)}/><ellipse cx="50" cy="44" rx="36" ry="26" fill="none" stroke="#c8423a" stroke-width="8"/><g fill="#e6c45a" ${sw(1.5)}><circle cx="18" cy="38" r="3"/><circle cx="30" cy="22" r="3"/><circle cx="50" cy="18" r="3"/><circle cx="70" cy="22" r="3"/><circle cx="82" cy="38" r="3"/></g><path d="M50 70 v6" ${sw(4)}/><path d="M38 90 q0 -16 12 -16 q12 0 12 16z" fill="#e6c45a" ${sw(3.5)}/><circle cx="50" cy="90" r="3" fill="${O}"/><path d="M68 84 q6 2 8 8 M74 76 q8 2 12 10" stroke="#fff3c4" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    herbbag: `<path d="M50 24 q-6 -10 -16 -12 M50 24 q2 -12 10 -16 M50 24 q10 -6 20 -4" fill="none" ${sw(4)}/><path d="M50 24 q-6 -10 -16 -12 M50 24 q2 -12 10 -16 M50 24 q10 -6 20 -4" fill="none" stroke="#6a9a4a" stroke-width="2"/><circle cx="34" cy="12" r="5" fill="#f8f4ea" ${sw(2)}/><circle cx="60" cy="8" r="4.5" fill="#b08ad8" ${sw(2)}/><circle cx="70" cy="20" r="5" fill="#f8f4ea" ${sw(2)}/><path d="M30 36 q-14 50 20 54 q34 -4 20 -54z" fill="#c8a46a" ${sw(4)}/><path d="M28 34 q22 -8 44 0 l-2 6 q-20 -6 -40 0z" fill="#a8844a" ${sw(3)}/><path d="M32 40 q18 6 36 0" stroke="#c8423a" stroke-width="4" fill="none"/><path d="M42 60 q8 -10 16 0 q-8 10 -16 0z" fill="#6aa04a" ${sw(2)}/>`,
    // ---------- новые карты ----------
    icethrow: `<path d="M14 56 h18 M8 74 h16 M24 92 h14" stroke="#cfe6ff" stroke-width="4" stroke-linecap="round"/><path d="M22 84 L72 28 l16 -10 l-8 18 L32 92z" fill="#bfe3f7" ${sw(4)}/><path d="M32 78 L74 32" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M60 52 l10 2 M48 66 l8 2" stroke="#8ec6e6" stroke-width="3" stroke-linecap="round"/>`,
    heavybag: `<path d="M30 46 Q50 6 70 46" fill="none" ${sw(6)}/><path d="M30 46 Q50 6 70 46" fill="none" stroke="#a06a3a" stroke-width="2.5"/><path d="M28 46 l8 -12 h16 l-4 12 M50 46 l10 -14 h14 l-6 14" fill="#f2e6c9" ${sw(2.5)}/><path d="M18 46 h64 l4 38 q0 6 -6 6 h-60 q-6 0 -6 -6z" fill="#8a5a32" ${sw(4)}/><path d="M16 52 h68 v16 h-68z" fill="#a06a3a" ${sw(3)}/><rect x="43" y="56" width="14" height="12" rx="2" fill="#e6c45a" ${sw(2.5)}/><path d="M24 78 h52" stroke="#6b4428" stroke-width="3"/>`,
    sbiten: `<path d="M40 24 q-6 -8 0 -14 M54 24 q-6 -8 0 -16" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M70 52 q16 0 14 14 q-2 10 -12 8" fill="none" ${sw(4)}/><path d="M32 40 q-6 -8 4 -10 h30 q10 2 4 10 q16 14 10 32 q-4 16 -30 16 q-26 0 -30 -16 q-6 -18 12 -32z" fill="#c98a5a" ${sw(4)}/><path d="M28 58 h44" stroke="#8a4a2a" stroke-width="4"/><path d="M50 64 q6 8 0 12 q-6 -4 0 -12z" fill="#ffcf6b" ${sw(2)}/>`,
    sledram: `<path d="M6 38 h22 M4 52 h14 M10 84 h18" stroke="#cfe6ff" stroke-width="4" stroke-linecap="round"/><path d="M22 52 h50 l-4 14 h-46z" fill="#c8423a" ${sw(4)}/><path d="M32 66 v10 M62 66 v10" ${sw(4)}/><path d="M16 76 h62 q12 0 14 -14" fill="none" ${sw(5)}/><path d="M80 14 l-12 16 h9 l-7 14 l16 -20 h-9 l7 -10z" fill="#ffd36e" ${sw(2.5)}/>`,
    hornblow: `<path d="M12 44 h12 l50 -22 v56 l-50 -22 h-12z" fill="#e6c45a" ${sw(4)}/><path d="M74 22 q12 28 0 56" fill="#d8a94a" ${sw(4)}/><path d="M24 44 v12" ${sw(3)}/><path d="M84 36 q6 14 0 28 M92 28 q10 22 0 44" stroke="#fff3c4" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M40 52 q4 16 -4 28" stroke="#c8423a" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="36" cy="82" r="4" fill="#c8423a" ${sw(2)}/>`,
    patch: `<path d="M12 24 l70 -8 l6 68 l-70 8z" fill="#3f6a8a" ${sw(4)}/><path d="M20 36 l56 -6 M22 56 l56 -6 M24 76 l56 -6" stroke="#4f7a9a" stroke-width="3"/><rect x="34" y="34" width="34" height="32" fill="#c8a24a" ${sw(3.5)} transform="rotate(-6 51 50)"/><path d="M34 33 l3 5 M45 32 l1 5 M57 31 l0 5 M67 30 l-1 5 M70 41 l-5 1 M71 53 l-5 0 M71 63 l-5 0 M38 68 l2 -5 M50 67 l0 -5 M62 66 l-1 -5 M32 44 l5 1 M33 57 l5 0" stroke="#f2e6c9" stroke-width="3" stroke-linecap="round"/><path d="M66 86 L92 60" ${sw(3)}/><circle cx="90" cy="62" r="3" fill="none" ${sw(2)}/>`,
    snowstorm: `<path d="M8 36 q30 -22 58 -4 q14 10 2 18" fill="none" ${sw(7)}/><path d="M8 36 q30 -22 58 -4 q14 10 2 18" fill="none" stroke="#cfe6ff" stroke-width="3"/><path d="M16 70 q32 -18 62 0 q12 8 0 14" fill="none" ${sw(7)}/><path d="M16 70 q32 -18 62 0 q12 8 0 14" fill="none" stroke="#cfe6ff" stroke-width="3"/>${flake(80, 22, 10)}${flake(28, 54, 8)}${flake(86, 58, 7)}${flake(46, 90, 6)}`,
    icelantern: `<path d="M50 8 v10" ${sw(3)}/><path d="M30 20 h40 l-5 9 h-30z" fill="#3a4a6a" ${sw(3)}/><rect x="33" y="29" width="34" height="42" rx="4" fill="#9fe0ff" ${sw(3.5)}/>${flameShape(50, 44, 0.5, '#7ad6ff', '#e8faff')}<path d="M28 71 h44 l-6 9 h-32z" fill="#3a4a6a" ${sw(3)}/><circle cx="50" cy="50" r="34" fill="#9fe0ff" opacity=".18"/>${flake(82, 22, 9)}${flake(18, 82, 7)}`,
    cancel: `<path d="M20 20 h52 v60 h-52z" fill="#f2e6c9" ${sw(4)}/><g fill="#262d45"><circle cx="20" cy="30" r="3"/><circle cx="20" cy="44" r="3"/><circle cx="20" cy="58" r="3"/><circle cx="20" cy="72" r="3"/><circle cx="72" cy="30" r="3"/><circle cx="72" cy="44" r="3"/><circle cx="72" cy="58" r="3"/><circle cx="72" cy="72" r="3"/></g><rect x="30" y="30" width="32" height="38" fill="#5b8fd0" ${sw(2.5)}/>${flameShape(46, 42, 0.45)}<circle cx="70" cy="66" r="18" fill="none" stroke="#2a2440" stroke-width="4"/><path d="M8 46 q8 -7 16 0 t16 0 t16 0 t16 0 t16 0 M8 58 q8 -7 16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#2a2440" stroke-width="4" stroke-linecap="round"/>`,
    carbon: `<path d="M34 12 h48 v66 h-48z" fill="#2c3550" ${sw(4)}/><path d="M40 24 h30 M40 36 h30 M40 48 h22" stroke="#4a5a90" stroke-width="3" stroke-linecap="round"/><path d="M16 24 h48 v66 h-48z" fill="#f2e6c9" ${sw(4)}/><path d="M24 40 h30 M24 52 h30 M24 64 h22" stroke="#8a7a60" stroke-width="3" stroke-linecap="round"/><path d="M70 90 q18 -2 18 -22" fill="none" ${sw(5)}/><path d="M80 70 l8 -9 l8 10" fill="none" ${sw(5)}/><path d="M70 90 q18 -2 18 -22" fill="none" stroke="#e6c45a" stroke-width="2"/>`,
    nightshift: `<path d="M62 10 A30 30 0 1 0 86 60 A24 24 0 1 1 62 10z" fill="#f4e6a8" ${sw(4)}/><g fill="#fff3c4"><circle cx="86" cy="18" r="3"/><circle cx="20" cy="22" r="2.5"/></g><path d="M12 48 h40 v20 q0 14 -20 22 q-20 -8 -20 -22z" fill="#5b8fd0" ${sw(4)}/><path d="M32 54 v28 M18 64 h28" stroke="#cfe6ff" stroke-width="3"/>`,
    kindling: `<path d="M14 74 L80 52 M18 86 L86 64 M20 62 L76 40" stroke="${O}" stroke-width="14" stroke-linecap="round"/><path d="M14 74 L80 52 M18 86 L86 64 M20 62 L76 40" stroke="#8a5a32" stroke-width="8" stroke-linecap="round"/><path d="M42 50 l8 30" stroke="${O}" stroke-width="9"/><path d="M42 50 l8 30" stroke="#c8423a" stroke-width="5"/>${flameShape(72, 24, 0.75, '#e8502a', '#ffb23e')}`,
    avalanche: `<path d="M8 90 L52 18 L92 90z" fill="#6f7f9b" ${sw(4)}/><path d="M38 42 L52 18 L66 42 q-7 6 -14 0 q-7 6 -14 0z" fill="#eef4fc" ${sw(3)}/><path d="M12 54 l10 6 M18 40 l12 8 M8 68 l10 4" stroke="#cfe6ff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="74" r="13" fill="#eef4fc" ${sw(3.5)}/><circle cx="58" cy="80" r="9" fill="#eef4fc" ${sw(3)}/><circle cx="78" cy="72" r="7" fill="#eef4fc" ${sw(3)}/><path d="M26 70 q6 -6 12 0" stroke="#b8cbe6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    moneyorder: `<rect x="10" y="30" width="62" height="44" rx="4" fill="#efe2c4" ${sw(4)}/><path d="M10 32 l31 22 l31 -22" fill="none" ${sw(3.5)}/><circle cx="72" cy="68" r="18" fill="#e6c45a" ${sw(4)}/><circle cx="72" cy="68" r="11" fill="none" stroke="#b08a2a" stroke-width="3"/><path d="M58 14 h28 M78 6 l9 8 l-9 8" fill="none" ${sw(7)}/><path d="M58 14 h28 M78 6 l9 8 l-9 8" fill="none" stroke="#5ac06a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    aurora: `<circle cx="50" cy="50" r="40" fill="#1a1d3a" ${sw(4)}/><path d="M16 46 q14 -26 34 -10 q16 14 34 -12" fill="none" stroke="#7af0b0" stroke-width="9" stroke-linecap="round" opacity=".9"/><path d="M14 60 q16 -18 34 -4 q16 12 36 -10" fill="none" stroke="#c88aff" stroke-width="6" stroke-linecap="round" opacity=".85"/><g fill="#fff3c4"><circle cx="30" cy="24" r="2.5"/><circle cx="66" cy="20" r="2"/><circle cx="76" cy="40" r="2"/></g><path d="M12 66 Q50 54 88 66 A40 40 0 0 1 12 66z" fill="#dfe8f6" ${sw(3)}/>`,
    returnaddr: `<rect x="22" y="38" width="64" height="46" rx="4" fill="#f2e6c9" ${sw(4)}/><path d="M22 40 l32 22 l32 -22" fill="none" ${sw(3.5)}/><path d="M76 30 Q52 2 22 22" fill="none" ${sw(7)}/><path d="M12 12 l10 12 l14 -6" fill="none" ${sw(7)}/><path d="M76 30 Q52 2 22 22 M12 12 l10 12 l14 -6" fill="none" stroke="#e6c45a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 72 h22" stroke="#8a7a60" stroke-width="3" stroke-linecap="round"/>`,
    frostbite: `<circle cx="50" cy="50" r="36" fill="#2c4a6a" ${sw(4)}/><path d="M50 14 l5 10 l-10 0z M50 86 l5 -10 l-10 0z M14 50 l10 5 l0 -10z M86 50 l-10 5 l0 -10z" fill="#bfe3f7" ${sw(2)}/>${flake(50, 50, 24)}<circle cx="50" cy="50" r="6" fill="#bfe3f7" ${sw(2.5)}/>`,
    poste: `<path d="M18 52 h60 v34 h-60z" fill="#d8c59c" ${sw(4)}/><path d="M24 42 h60 v34 h-60z" fill="#efe2c4" ${sw(4)}/><path d="M30 30 h60 v34 h-60z" fill="#f2e6c9" ${sw(4)}/><path d="M30 32 l30 20 l30 -20" fill="none" ${sw(3)}/><path d="M24 36 Q16 24 20 14" fill="none" ${sw(2.5)}/><path d="M8 16 l14 -8 l8 14 l-14 8z" fill="#c8423a" ${sw(3)}/><circle cx="14" cy="16" r="2.5" fill="${O}"/>`,
    // ---------- новые талисманы ----------
    mug: `<path d="M36 26 q-4 -8 0 -14 M50 26 q-4 -8 0 -16" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M68 44 q18 0 16 14 q-2 12 -16 10" fill="none" ${sw(5)}/><path d="M24 34 h44 v40 q0 12 -12 12 h-20 q-12 0 -12 -12z" fill="#b8865a" ${sw(4)}/><path d="M24 44 h44" stroke="#8a5a32" stroke-width="4"/><path d="M46 74 q-12 -7 -10 -14 q2 -7 10 -2 q8 -5 10 2 q2 7 -10 14z" fill="#d0463b" ${sw(2)}/>`,
    pencil: `<path d="M24 74 L64 34 l14 14 L38 88z" fill="#e6c45a" ${sw(4)}/><path d="M64 34 l8 -8 l14 14 l-8 8z" fill="#e8908a" ${sw(3.5)}/><path d="M24 74 l14 14 l-24 10z" fill="#f2d8b0" ${sw(3.5)}/><path d="M17 92 l-4 6 l6 -3z" fill="${O}"/><path d="M42 58 l14 14" stroke="#c8a24a" stroke-width="3"/><path d="M80 82 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff3c4" ${sw(2)}/>`,
    bookmark: `<path d="M12 30 q19 -8 38 0 q19 -8 38 0 v54 q-19 -8 -38 0 q-19 -8 -38 0z" fill="#f2e6c9" ${sw(4)}/><path d="M50 30 v54" ${sw(3)}/><path d="M20 44 h22 M20 56 h22 M58 44 h22" stroke="#8a7a60" stroke-width="2.5" stroke-linecap="round"/><path d="M60 22 h14 v44 l-7 -6 l-7 6z" fill="#c8423a" ${sw(3)}/><path d="M67 62 q2 14 -4 24" fill="none" stroke="#e6c45a" stroke-width="4" stroke-linecap="round"/><circle cx="62" cy="88" r="5" fill="#e6c45a" ${sw(2.5)}/>`,
    cocoatin: `<path d="M26 26 h48 v60 h-48z" fill="#c8423a" ${sw(4)}/><ellipse cx="50" cy="26" rx="24" ry="7" fill="#d8a94a" ${sw(4)}/><path d="M26 42 h48 v26 h-48z" fill="#f2e6c9" ${sw(3)}/><ellipse cx="50" cy="55" rx="9" ry="7" fill="#6b3a1e" ${sw(2.5)}/><path d="M50 49 q-3 6 0 12" stroke="#a0603a" stroke-width="2" fill="none"/><path d="M26 86 q24 8 48 0" fill="none" ${sw(4)}/><path d="M82 26 q-6 -4 -4 -8 q2 -3 4 0 q2 -3 4 0 q2 4 -4 8z" fill="#d0463b" ${sw(1.5)}/>`,
    stamppad: `<path d="M40 14 h20 v10 h-20z" fill="#a06a3a" ${sw(3.5)}/><path d="M45 24 h10 v14 h-10z" fill="#8a5a32" ${sw(3)}/><path d="M30 38 h40 v10 h-40z" fill="#a06a3a" ${sw(3.5)}/><path d="M30 48 h40 v5 h-40z" fill="#c8423a" ${sw(2.5)}/><path d="M10 62 h80 v24 h-80z" fill="#3a3240" ${sw(4)}/><path d="M16 62 h68 v9 h-68z" fill="#c8423a" ${sw(3)}/><path d="M24 66 h20" stroke="#e8746a" stroke-width="2.5" stroke-linecap="round"/>`,
    snowglobe: `<circle cx="50" cy="42" r="32" fill="#bfe3f7" fill-opacity=".75" ${sw(4)}/><path d="M22 58 q28 -10 56 0 v4 q-28 10 -56 0z" fill="#eef4fc" ${sw(2)}/><path d="M42 58 v-12 l8 -8 l8 8 v12z" fill="#a06a3a" ${sw(2.5)}/><rect x="47" y="50" width="6" height="8" fill="#ffd36e"/><g fill="#ffffff"><circle cx="34" cy="28" r="2.5"/><circle cx="62" cy="24" r="2"/><circle cx="68" cy="40" r="2.5"/><circle cx="30" cy="44" r="2"/></g><path d="M30 22 q8 -8 18 -10" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 72 h52 l6 16 h-64z" fill="#6b4a32" ${sw(4)}/>`,
    oilcan: `<path d="M94 38 q4 8 0 12 q-4 -4 0 -12z" fill="#ffcf6b" ${sw(2)}/><path d="M62 58 l26 -24 l5 5 l-24 26" fill="#7b8794" ${sw(3)}/><path d="M22 54 q-16 -2 -14 12 q2 10 14 8" fill="none" ${sw(5)}/><path d="M22 50 h40 v34 q0 4 -4 4 h-32 q-4 0 -4 -4z" fill="#7b8794" ${sw(4)}/><path d="M28 50 l6 -12 h16 l6 12" fill="#5a6070" ${sw(3.5)}/><path d="M28 60 v20" stroke="#a8b4c4" stroke-width="4" stroke-linecap="round"/>`,
    candybox: `<path d="M14 50 h72 v36 h-72z" fill="#d85a8a" ${sw(4)}/><path d="M50 50 v36" stroke="#f2e6c9" stroke-width="6"/><path d="M50 50 v36" ${sw(1.5)}/><path d="M14 50 l10 -12 h52 l10 12z" fill="#e88aaa" ${sw(4)}/><path d="M24 34 l-8 -6 v12z M44 34 l8 -6 v12z" fill="#e6c45a" ${sw(2.5)}/><ellipse cx="34" cy="34" rx="11" ry="7" fill="#e6c45a" ${sw(3)}/><path d="M56 26 l-8 -6 v12z M78 26 l8 -6 v12z" fill="#f2e6c9" ${sw(2.5)}/><ellipse cx="67" cy="26" rx="12" ry="7" fill="#f2e6c9" ${sw(3)}/><path d="M60 22 l4 9 M68 20 l4 10" stroke="#c8423a" stroke-width="3"/>`,
    vanefeather: `<path d="M20 86 Q26 34 82 14 Q76 62 24 84z" fill="#d8a94a" ${sw(3.5)}/><path d="M16 92 L76 22" ${sw(2.5)}/><path d="M32 68 l12 -2 M42 56 l13 -4 M52 44 l13 -6" stroke="#8a5a32" stroke-width="2.5" stroke-linecap="round"/><path d="M60 72 h26 M66 84 h18 M8 30 h20" stroke="#cfe6ff" stroke-width="4" stroke-linecap="round"/>`,
    stokerglove: `<path d="M26 80 V46 q0 -8 7 -8 q7 0 7 8 V30 q0 -8 7 -8 q7 0 7 8 v-4 q0 -8 7 -8 q7 0 7 8 v12 q0 -6 6 -6 q6 0 6 6 v28 q0 16 -14 18z" fill="#8a5a32" ${sw(4)}/><path d="M40 46 v14 M54 30 v26" stroke="#6b4428" stroke-width="3" stroke-linecap="round"/><path d="M22 76 h50 v16 h-50z" fill="#5a3a2a" ${sw(3.5)}/><g fill="#2a2440" opacity=".55"><circle cx="46" cy="66" r="4"/><circle cx="60" cy="58" r="3"/></g>${flameShape(80, 60, 0.45, '#e8502a', '#ffb23e')}`,
    luckystamp: `<path d="M20 14 h60 v72 h-60z" fill="#f2e6c9" ${sw(4)}/><g fill="#262d45"><circle cx="20" cy="26" r="3"/><circle cx="20" cy="42" r="3"/><circle cx="20" cy="58" r="3"/><circle cx="20" cy="74" r="3"/><circle cx="80" cy="26" r="3"/><circle cx="80" cy="42" r="3"/><circle cx="80" cy="58" r="3"/><circle cx="80" cy="74" r="3"/></g><rect x="30" y="24" width="40" height="44" fill="#3a7a4a" ${sw(3)}/><g fill="#8ad08a" ${sw(2)}><circle cx="44" cy="40" r="7"/><circle cx="56" cy="40" r="7"/><circle cx="44" cy="52" r="7"/><circle cx="56" cy="52" r="7"/></g><path d="M50 52 q4 10 10 14" ${sw(3)} fill="none"/><path d="M30 78 h40" stroke="#c8423a" stroke-width="4" stroke-linecap="round"/>`,
    mirrorshard: `<path d="M30 12 L80 30 L58 90 L16 64z" fill="#9fc3e8" ${sw(4)}/><path d="M34 22 L72 34 L54 82 Z" fill="#cfe6ff" opacity=".7"/><path d="M36 34 l22 7 M32 46 l14 4" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><path d="M84 56 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff3c4" ${sw(2)}/><path d="M12 20 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff3c4" ${sw(1.5)}/>`,
    eternaloil: `<circle cx="50" cy="58" r="30" fill="#ffd36e" opacity=".22"/><path d="M38 30 h24 v10 q14 8 14 26 v18 q0 6 -6 6 h-40 q-6 0 -6 -6 v-18 q0 -18 14 -26z" fill="#e6c45a" fill-opacity=".9" ${sw(4)}/><rect x="40" y="16" width="20" height="14" rx="2" fill="#6b4a32" ${sw(3)}/>${flameShape(50, 56, 0.55)}<path d="M30 60 q0 -10 6 -16" stroke="#fff3c4" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    medal: `<path d="M30 6 h16 l10 34 h-16z" fill="#c8423a" ${sw(3.5)}/><path d="M70 6 h-16 l-10 34 h16z" fill="#2f5d9a" ${sw(3.5)}/><circle cx="50" cy="64" r="26" fill="#e6c45a" ${sw(4)}/><circle cx="50" cy="64" r="18" fill="none" stroke="#b08a2a" stroke-width="3"/><path d="M39 57 h22 v15 h-22z M39 57 l11 8 l11 -8" fill="none" stroke="#8a6a2a" stroke-width="3" stroke-linejoin="round"/>`,
    thermos: `<path d="M42 16 q-4 -6 0 -10 M56 16 q-4 -6 0 -10" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M28 18 h44 v12 h-44z" fill="#c8423a" ${sw(3.5)}/><rect x="32" y="28" width="36" height="64" rx="8" fill="#2f5d62" ${sw(4)}/><path d="M32 46 h36 M32 74 h36" stroke="#f2e6c9" stroke-width="5"/><path d="M32 46 h36 M32 74 h36" stroke="${O}" stroke-width="1.2"/><path d="M40 52 v18" stroke="#5a8a8e" stroke-width="4" stroke-linecap="round"/>`,
    northstar: `<circle cx="50" cy="48" r="34" fill="#fff3c4" opacity=".18"/><path d="M50 6 l8 32 l32 10 l-32 10 l-8 32 l-8 -32 l-32 -10 l32 -10z" fill="#fff3c4" ${sw(3.5)}/><path d="M50 26 l4 18 l18 4 l-18 4 l-4 18 l-4 -18 l-18 -4 l18 -4z" fill="#ffe38a"/><path d="M8 94 q42 -20 84 0" fill="#dfe8f6" ${sw(3)}/>`,
    // ---------- эпические и легендарные карты ----------
    starfall: `<circle cx="50" cy="50" r="40" fill="#1a1d3a" ${sw(4)}/><path d="M16 22 L44 50 M42 12 L72 42 M12 52 L30 70" stroke="#ffe38a" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>${star4(46, 52, 11)}${star4(74, 44, 9)}${star4(32, 72, 7)}<g fill="#fff3c4"><circle cx="70" cy="18" r="2"/><circle cx="82" cy="64" r="2"/><circle cx="22" cy="34" r="1.8"/></g>`,
    iceprison: `<path d="M50 10 l36 18 v44 l-36 18 l-36 -18 v-44z" fill="#9fd0f0" fill-opacity=".85" ${sw(4)}/><path d="M14 28 l36 18 l36 -18 M50 46 v44" fill="none" stroke="#e8f6ff" stroke-width="3"/><ellipse cx="42" cy="60" rx="4" ry="5" fill="#2a2440"/><ellipse cx="58" cy="60" rx="4" ry="5" fill="#2a2440"/><path d="M28 36 v40 M42 42 v44 M58 42 v44 M72 36 v40" ${sw(3.5)}/><path d="M28 36 v40 M42 42 v44 M58 42 v44 M72 36 v40" stroke="#7b8794" stroke-width="1.5"/>`,
    bonfire: `<g fill="#ffb23e"><circle cx="20" cy="30" r="3"/><circle cx="80" cy="22" r="2.5"/><circle cx="84" cy="48" r="2"/><circle cx="16" cy="54" r="2"/></g><path d="M16 90 L50 52 L84 90 M30 90 L50 64 L70 90" fill="none" stroke="${O}" stroke-width="11" stroke-linecap="round"/><path d="M16 90 L50 52 L84 90 M30 90 L50 64 L70 90" fill="none" stroke="#8a5a32" stroke-width="6" stroke-linecap="round"/>${flameShape(50, 38, 1.3, '#e8502a', '#ffb23e')}`,
    registered: `<rect x="12" y="26" width="76" height="52" rx="4" fill="#f2e6c9" ${sw(4)}/><path d="M12 52 h76 M50 26 v52" stroke="${O}" stroke-width="9"/><path d="M12 52 h76 M50 26 v52" stroke="#c8423a" stroke-width="5"/><circle cx="50" cy="52" r="12" fill="#a8322c" ${sw(3)}/><path d="M45 58 v-12 h6 q5 0 5 4 q0 4 -5 4 h-6 M51 54 l5 4" fill="none" stroke="#ffb0a0" stroke-width="2.5" stroke-linecap="round"/><path d="M72 20 l8 -10 l8 10 M72 30 l8 -10 l8 10" fill="none" ${sw(6)}/><path d="M72 20 l8 -10 l8 10 M72 30 l8 -10 l8 10" fill="none" stroke="#5ac06a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    chimes: `<path d="M8 40 q-6 14 0 28 M92 40 q6 14 0 28" stroke="#fff3c4" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="54" r="36" fill="#e6c45a" ${sw(4)}/><circle cx="50" cy="54" r="28" fill="#f2e6c9" ${sw(3)}/><g fill="${O}"><circle cx="50" cy="30" r="2.5"/><circle cx="74" cy="54" r="2.5"/><circle cx="50" cy="78" r="2.5"/><circle cx="26" cy="54" r="2.5"/><circle cx="67" cy="37" r="1.6"/><circle cx="33" cy="37" r="1.6"/><circle cx="67" cy="71" r="1.6"/><circle cx="33" cy="71" r="1.6"/></g><path d="M50 54 V30 M50 54 V36" ${sw(4)}/><circle cx="50" cy="54" r="4" fill="#c8423a" ${sw(2)}/><path d="M38 14 l4 -10 l8 8 l8 -8 l4 10z" fill="#ffd36e" ${sw(2.5)}/>`,
    lastlight: `<circle cx="30" cy="68" r="34" fill="#ffd36e" opacity=".25"/><path d="M40 58 L94 12 L96 30 L46 70z" fill="#ffe38a" ${sw(3)}/><path d="M48 60 L92 22" stroke="#fffbe6" stroke-width="3" stroke-linecap="round"/><path d="M8 68 a22 22 0 0 1 44 0z" fill="#ff9a2a" ${sw(4)}/><path d="M30 38 v-10 M12 46 l-6 -6 M48 46 l6 -6" stroke="#ffb23e" stroke-width="4" stroke-linecap="round"/><path d="M4 70 h92" ${sw(4)}/><path d="M10 80 h50 M18 90 h30" stroke="#ffd0a0" stroke-width="3.5" stroke-linecap="round"/>`,
    firebird: `<path d="M22 90 Q18 42 58 14 Q88 2 86 28 Q78 70 26 88z" fill="#e8502a" ${sw(4)}/><path d="M30 80 Q32 46 60 24 Q78 16 76 32 Q70 60 34 78z" fill="#ffb23e"/><path d="M34 70 l-8 8 M40 58 l-12 4 M48 48 l-12 0" stroke="#c8361e" stroke-width="3" stroke-linecap="round"/><ellipse cx="62" cy="34" rx="10" ry="12" fill="#ffe38a" ${sw(2.5)}/><ellipse cx="62" cy="34" rx="5" ry="6" fill="#2f8c74"/><circle cx="62" cy="34" r="2.5" fill="${O}"/><path d="M14 96 L64 32" ${sw(3)}/><g fill="#ffe38a"><circle cx="88" cy="50" r="2.5"/><circle cx="80" cy="66" r="2"/></g>`,
    eternalwinter: `<circle cx="50" cy="50" r="40" fill="#cfe6ff" ${sw(4)}/><path d="M12 64 Q30 54 50 62 Q70 54 88 64 A40 40 0 0 1 12 64z" fill="#ffffff" ${sw(3)}/>${flake(50, 40, 24)}<circle cx="50" cy="40" r="6" fill="#5b8fd0" ${sw(2.5)}/>`,
    // ---------- эпические и легендарные талисманы ----------
    frostring: `<circle cx="50" cy="62" r="25" fill="none" stroke="${O}" stroke-width="13"/><circle cx="50" cy="62" r="25" fill="none" stroke="#c8d4e6" stroke-width="7"/><path d="M34 52 q6 -8 14 -10" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M50 10 l15 15 l-15 19 l-15 -19z" fill="#9fe0ff" ${sw(3.5)}/><path d="M35 25 h30 M50 10 l-5 15 l5 19 l5 -19z" fill="none" stroke="#e8faff" stroke-width="2"/>${flake(84, 26, 8)}${flake(16, 30, 6)}`,
    buckle: `<path d="M6 40 h88 v24 h-88z" fill="#8a5a32" ${sw(4)}/><path d="M6 46 h88 M6 58 h88" stroke="#6b4428" stroke-width="2" stroke-dasharray="4 4"/><rect x="28" y="26" width="44" height="52" rx="8" fill="none" stroke="${O}" stroke-width="13"/><rect x="28" y="26" width="44" height="52" rx="8" fill="none" stroke="#e6c45a" stroke-width="7"/><path d="M34 32 q8 -4 16 -2" stroke="#fff3c4" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M50 30 v44" ${sw(5)}/><path d="M50 30 v44" stroke="#c9a46a" stroke-width="2"/>`,
    wreath: `<circle cx="50" cy="46" r="30" fill="none" stroke="${O}" stroke-width="22"/><circle cx="50" cy="46" r="30" fill="none" stroke="#3a7a4a" stroke-width="15"/><circle cx="50" cy="46" r="30" fill="none" stroke="#5aa86a" stroke-width="4" stroke-dasharray="3 6"/><g fill="#d0463b" ${sw(2)}><circle cx="26" cy="30" r="4"/><circle cx="76" cy="34" r="4"/><circle cx="72" cy="66" r="4"/><circle cx="30" cy="66" r="3.5"/></g><path d="M50 74 l-16 12 l2 -16z M50 74 l16 12 l-2 -16z" fill="#c8423a" ${sw(3)}/><circle cx="50" cy="74" r="6" fill="#a8322c" ${sw(2.5)}/>`,
    sunstone: `<circle cx="50" cy="50" r="44" fill="#ffd36e" opacity=".25"/><path d="M50 4 v12 M50 84 v12 M4 50 h12 M84 50 h12 M18 18 l8 8 M74 74 l8 8 M82 18 l-8 8 M18 82 l8 -8" stroke="#ffb23e" stroke-width="5" stroke-linecap="round"/><path d="M50 20 l24 14 v32 l-24 14 l-24 -14 v-32z" fill="#ff9a2a" ${sw(4)}/><path d="M26 34 l24 12 l24 -12 M50 46 v34" fill="none" stroke="#ffe38a" stroke-width="3"/><path d="M36 32 l12 -7" stroke="#fffbe6" stroke-width="3.5" stroke-linecap="round"/>`,
    lastcandle: `<circle cx="50" cy="28" r="26" fill="#ffd36e" opacity=".3"/>${flameShape(50, 12, 0.7)}<path d="M50 30 v8" ${sw(3)}/><rect x="39" y="38" width="22" height="48" rx="2" fill="#f2e6c9" ${sw(4)}/><path d="M39 44 q4 10 8 2 q3 8 6 0 q4 6 8 -4" fill="#fff8e6" ${sw(2.5)}/><path d="M46 52 v26" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M22 86 h56 l-6 9 h-44z" fill="#c98a2b" ${sw(3.5)}/>`,
    magicbag: `<g fill="#ffe38a">${star4(30, 20, 7)}${star4(66, 14, 9)}${star4(84, 34, 6)}</g><path d="M30 46 Q50 22 70 46" fill="none" ${sw(6)}/><path d="M30 46 Q50 22 70 46" fill="none" stroke="#c98a2b" stroke-width="2.5"/><path d="M16 46 h68 l4 38 q0 6 -6 6 h-64 q-6 0 -6 -6z" fill="#5a3a7a" ${sw(4)}/><path d="M14 52 h72 v16 h-72z" fill="#6e4a94" ${sw(3)}/><rect x="43" y="56" width="14" height="12" rx="2" fill="#e6c45a" ${sw(2.5)}/><g fill="#ffe38a"><circle cx="28" cy="78" r="2"/><circle cx="70" cy="80" r="2.5"/><circle cx="52" cy="84" r="1.8"/></g>`,
    // помехи мрачных героев: Зола и Чёрствый пряник
    ash: `<path d="M14 80 q8 -30 24 -26 q4 -22 22 -18 q18 -8 26 12 q12 8 4 32z" fill="#4a4652" ${sw(4)}/><path d="M30 70 q10 -6 18 0 M54 60 q8 -4 14 2" stroke="#6e6a78" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="40" cy="62" r="4" fill="#ff8a3a"/><circle cx="64" cy="70" r="3" fill="#ffb84a"/><circle cx="52" cy="48" r="2.5" fill="#ff8a3a"/><path d="M36 30 q-4 -10 4 -18 M60 26 q6 -8 0 -16" stroke="#8a8494" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
    stale: `<path d="M50 14 q12 0 12 12 q0 8 -6 10 h18 q8 0 8 8 q0 8 -8 8 h-12 l8 26 q2 8 -6 8 q-6 0 -8 -6 l-6 -16 l-6 16 q-2 6 -8 6 q-8 0 -6 -8 l8 -26 h-12 q-8 0 -8 -8 q0 -8 8 -8 h18 q-6 -2 -6 -10 q0 -12 12 -12z" fill="#8a6a4a" ${sw(4)}/><circle cx="45" cy="25" r="2.5" fill="${O}"/><circle cx="55" cy="25" r="2.5" fill="${O}"/><path d="M44 32 q6 -4 12 0" stroke="${O}" stroke-width="2.5" fill="none"/><path d="M30 50 l8 -4 M62 46 l8 4 M42 60 l6 6 M58 64 l-4 6" stroke="#5a4232" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="20" r="3" fill="#9fc3a0"/><circle cx="24" cy="76" r="2.5" fill="#9fc3a0"/>`,
  };

  function icon(name) {
    return svg('0 0 100 100', icons[name] || icons.spark, 'icon');
  }

  /* Иконки намерений врага */
  const intentIcons = {
    attack: `<path d="M8 32 L30 10" ${sw(4)}/><path d="M26 6 l8 8 l-4 2 l-6 -6z" fill="#e6edf8" ${sw(2)}/><path d="M6 26 l8 8" ${sw(4)}/>`,
    block: `<path d="M8 8 h24 v14 q0 10 -12 14 q-12 -4 -12 -14z" fill="#5b8fd0" ${sw(3)}/>`,
    buff: `<path d="M20 4 l6 12 h-4 v18 h-4 v-18 h-4z" fill="#e8502a" ${sw(2.5)}/>`,
    debuff: `<circle cx="20" cy="20" r="13" fill="#7a5aa0" ${sw(3)}/><path d="M14 16 l12 8 M26 16 l-12 8" stroke="#fff" stroke-width="2.5"/>`,
    snuff: `${flameShape(20, 6, 0.55, '#4a5168', '#7f8aa8')}<path d="M6 34 L34 6" stroke="#d0463b" stroke-width="4"/>`,
    curse: `<path d="M20 6 q4 6 9 2 q1 7 8 7 q-4 6 1 11 q-7 2 -6 9 q-6 -3 -10 3 q-3 -6 -10 -4 q1 -7 -6 -9 q5 -5 1 -11 q7 0 7 -7 q4 4 6 -1z" fill="#3a2f55" ${sw(2.5)}/><circle cx="16" cy="18" r="2" fill="#d6b0ff"/><circle cx="24" cy="18" r="2" fill="#d6b0ff"/>`,
    steal: `<circle cx="16" cy="22" r="11" fill="#e6c45a" ${sw(2.5)}/><circle cx="16" cy="22" r="6" fill="none" stroke="#b08a2a" stroke-width="2"/><path d="M24 14 l12 -10 M28 4 h8 v8" fill="none" stroke="#ff9a8a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    heal: `<path d="M20 36 Q4 24 6 14 Q8 4 16 6 Q19 7 20 11 Q21 7 24 6 Q32 4 34 14 Q36 24 20 36z" fill="#5ac06a" ${sw(2.5)}/><path d="M20 13 v14 M13 20 h14" stroke="#fff" stroke-width="3.5"/>`,
    spikes: `<path d="M4 34 l6 -24 l6 24 l4 -30 l4 30 l6 -24 l6 24z" fill="#cfe6ff" ${sw(2.5)}/>`,
    sap: `<circle cx="20" cy="20" r="14" fill="#4fc7c0" ${sw(3)}/><path d="M22 8 l-8 14 h6 l-4 12 l10 -16 h-6 l4 -10z" fill="#fff" ${sw(1.5)}/><path d="M7 33 L33 7" stroke="#d0463b" stroke-width="4" stroke-linecap="round"/>`,
    mist: `<path d="M8 26 q-5 -10 6 -12 q2 -8 12 -6 q8 -4 12 4 q8 2 3 14z" fill="#c8cde6" ${sw(2.5)}/><path d="M5 32 h28 M10 37 h18" stroke="#c8cde6" stroke-width="3" stroke-linecap="round"/>`,
    boom: `<path d="M20 2 l4 10 l10 -6 l-4 11 l10 3 l-10 4 l6 10 l-11 -4 l-3 10 l-4 -10 l-10 5 l4 -10 l-10 -4 l10 -3 l-5 -10 l10 5z" fill="#ffb23e" ${sw(2.5)}/><circle cx="20" cy="20" r="5" fill="#fff3c4"/>`,
    bury: `<rect x="10" y="12" width="20" height="25" rx="3" fill="#2c3550" ${sw(2.5)}/><path d="M6 16 q4 -9 10 -4 q4 -7 10 -2 q6 -4 9 2 q3 6 -4 7 h-22 q-6 0 -3 -3z" fill="#eef4fc" ${sw(2)}/>`,
    frail: `<path d="M8 8 h24 v14 q0 10 -12 14 q-12 -4 -12 -14z" fill="#5b8fd0" ${sw(3)}/><path d="M21 8 l-5 10 l7 4 l-5 13" fill="none" stroke="#f2e6c9" stroke-width="2.5" stroke-linejoin="round"/>`,
    sleep: `<path d="M30 6 A14 14 0 1 0 36 26 A11 11 0 1 1 30 6z" fill="#f4e6a8" ${sw(2.5)}/><path d="M4 8 h8 l-8 9 h8" fill="none" stroke="#cfe6ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  intentIcons.leech = `${intentIcons.attack}<path d="M31 21 q6 8 0 12 q-6 -4 0 -12z" fill="#d0463b" ${sw(2)}/>`;
  function intentIcon(kind) {
    return svg('0 0 40 40', intentIcons[kind] || intentIcons.attack, 'intent-ico');
  }

  /* Значок кнопки звука: all — музыка и звуки, sfx — только звуки, off — тишина */
  function soundIcon(mode) {
    const spk = `<path d="M6 15 h6 l8 -7 v24 l-8 -7 h-6z" fill="#f3d27c" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const waves = `<path d="M25 14 q4 6 0 12 M29 10 q7 10 0 20" fill="none" stroke="#f3d27c" stroke-width="2.5" stroke-linecap="round"/>`;
    const note = (crossed) => `<g transform="translate(25 2)"><path d="M3 12 V2 l8 -2 v10" fill="none" stroke="#f3d27c" stroke-width="2"/><circle cx="1.5" cy="12" r="2.5" fill="#f3d27c"/><circle cx="9.5" cy="10" r="2.5" fill="#f3d27c"/>${crossed ? '<path d="M-1 -1 L13 15" stroke="#ff7a6a" stroke-width="2.5"/>' : ''}</g>`;
    const x = `<path d="M26 14 l10 10 M36 14 l-10 10" stroke="#ff7a6a" stroke-width="3" stroke-linecap="round"/>`;
    const body = mode === 'off' ? spk + x : mode === 'sfx' ? spk + `<path d="M25 18 q3 4 0 8" fill="none" stroke="#f3d27c" stroke-width="2.5" stroke-linecap="round"/>` + note(true) : spk + waves;
    return svg('0 0 40 40', body, 'snd-ico');
  }

  /* Мрачные версии героев (финальные боссы): тот же рисунок героя в синей тени,
     со светящимися глазами, хмурым ртом и теневой короной Короля Теней */
  function darkHero(look) {
    const L = LOOKS[look] || LOOKS.lamp;
    const body = hero(look).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const id = `dk-${look}`;
    const glow = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="url(#${id}-g)"/><ellipse cx="${x}" cy="${y}" rx="${r * 0.65}" ry="${r}" fill="#f2e6ff"/>`;
    return svg('0 0 200 270', `
      <defs>
        <filter id="${id}-f" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.22 0.18 0.1 0 0.02  0.14 0.18 0.16 0 0.03  0.3 0.3 0.42 0 0.1  0 0 0 1 0"/></filter>
        <radialGradient id="${id}-g"><stop offset="0" stop-color="#e2c8ff"/><stop offset="0.45" stop-color="#9a6ae0" stop-opacity=".75"/><stop offset="1" stop-color="#9a6ae0" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="262" rx="76" ry="9" fill="#0e0a1c" opacity=".75"/>
      <path d="M44 262 q-18 -34 4 -66 q-2 30 16 46 M156 262 q18 -34 -4 -66 q2 30 -16 46" fill="#1e1838" opacity=".9"/>
      <g transform="translate(0 26)">
        <g filter="url(#${id}-f)">${body}
          <ellipse cx="100" cy="115" rx="9" ry="4.5" fill="${L.beard ? L.hair : '#f3cda6'}"/>
          <path d="M93 118 Q100 112 107 118" ${sw(3)} fill="none"/>
        </g>
        ${glow(87, 96, 6)}${glow(113, 96, 6)}
        ${L.dog ? `${glow(153, 178, 2.6)}${glow(167, 178, 2.6)}` : ''}
        <path d="M68 ${L.hat ? -2 : 30} l8 -22 l10 15 l14 -24 l14 24 l10 -15 l8 22 q-32 9 -64 0z" fill="#1e1838" stroke="#0b0816" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="100" cy="${L.hat ? -14 : 18}" r="4" fill="#c9a0ff"/>
      </g>`);
  }
  Object.keys(LOOKS).forEach((look) => { enemiesArt[`dk_${look}`] = () => darkHero(look); });

  window.Art = { soundIcon, background, mixSky, sampleSky, hero, enemy: (id) => (enemiesArt[id] || enemiesArt.inkcat)(), icon, intentIcon, flame: (s = 1) => svg('0 0 100 100', flameShape(50, 44, s * 1.2), 'icon'), dog: (o = {}) => svg('-34 -34 68 68', dogHead(0, 0, 1, o), 'icon') };
})();
