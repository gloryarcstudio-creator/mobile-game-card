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
      <path d="M0 600 Q100 585 200 598 T400 592 V860 H0z" fill="url(#snowG)"/>
      <path d="M0 600 Q100 585 200 598 T400 592" fill="none" stroke="${p.snowEdge}" stroke-width="3" opacity="0.7"/>
      <path d="M150 860 Q190 700 ${200 - 10 * sc} ${hy} L${200 + 10 * sc} ${hy} Q210 700 250 860z" fill="${p.snowBot}" opacity="0.55"/>
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
        <linearGradient id="snowG" x1="0" y1="0" x2="0" y2="1">
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
      <path d="M0 600 Q100 585 200 598 T400 592 V860 H0z" fill="url(#snowG)"/>
      <path d="M0 600 Q100 585 200 598 T400 592" fill="none" stroke="${p.snowEdge}" stroke-width="3" opacity="0.7"/>
      <!-- забор -->
      <g stroke="#17121f" stroke-width="2.5" fill="${p.fence}">
        <path d="M130 585 l4 -18 l4 18z M150 588 l4 -20 l4 20z M170 590 l4 -18 l4 18z"/>
        <path d="M128 578 h52" fill="none"/>
      </g>
      `}
    `, 'bg-svg');
  }

  /* ---------- Героиня: Ива, ученица фонарщика ---------- */
  function hero() {
    const bag = window.Story && window.Story.story.heroBag ? `
      <!-- сумка почтальонки -->
      <path d="M72 132 Q100 170 128 212" stroke="#5a3a22" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M72 132 Q100 170 128 212" ${sw(1.5)} fill="none" opacity="0.6"/>
      <path d="M44 186 h44 v34 q0 6 -6 6 h-32 q-6 0 -6 -6z" fill="#8a5a32" ${sw(3.5)}/>
      <rect x="52" y="174" width="30" height="20" rx="2" fill="#f2e6c9" ${sw(2.5)} transform="rotate(-8 67 184)"/>
      <path d="M42 186 h48 v12 q-24 8 -48 0z" fill="#a06a3a" ${sw(3)}/>
      <circle cx="66" cy="198" r="3.5" fill="#d8a94a" ${sw(1.5)}/>` : '';
    return svg('0 0 200 240', `
      <defs>
        <radialGradient id="hl"><stop offset="0" stop-color="#ffe9a8"/><stop offset="0.5" stop-color="#ffb84a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="152" cy="168" r="48" fill="url(#hl)"/>
      <!-- плащ -->
      <path d="M58 236 Q52 160 70 128 L130 128 Q150 165 144 236z" fill="#2f5d62" ${sw(4)}/>
      <path d="M100 132 L100 236" ${sw(3)} fill="none" opacity="0.5"/>
      <path d="M70 140 Q66 190 74 236" stroke="#3f7a80" stroke-width="5" fill="none"/>
      <!-- шарф -->
      <path d="M66 126 Q100 146 134 126 L136 140 Q100 160 64 140z" fill="#c98a2b" ${sw(4)}/>
      <path d="M118 140 l8 34 l-14 2z" fill="#c98a2b" ${sw(3.5)}/>
      <!-- капюшон -->
      <path d="M52 108 Q48 40 100 34 Q152 40 148 108 Q146 128 132 132 L68 132 Q54 128 52 108z" fill="#d79a35" ${sw(4)}/>
      <path d="M100 34 Q104 18 116 14" ${sw(4)} fill="none"/>
      <circle cx="118" cy="13" r="5" fill="#d79a35" ${sw(3)}/>
      <!-- лицо -->
      <ellipse cx="100" cy="94" rx="34" ry="32" fill="#f3cda6" ${sw(4)}/>
      <!-- чёлка -->
      <path d="M66 86 Q70 58 100 58 Q132 58 134 86 Q124 72 112 76 Q104 66 94 76 Q80 70 66 86z" fill="#8a3f28" ${sw(3.5)}/>
      <!-- глаза -->
      <ellipse cx="87" cy="96" rx="6.5" ry="8.5" fill="${O}"/>
      <ellipse cx="113" cy="96" rx="6.5" ry="8.5" fill="${O}"/>
      <circle cx="89" cy="93" r="2.4" fill="#fff"/>
      <circle cx="115" cy="93" r="2.4" fill="#fff"/>
      <!-- веснушки и щёки -->
      <circle cx="78" cy="108" r="5" fill="#e79a8a" opacity="0.6"/>
      <circle cx="122" cy="108" r="5" fill="#e79a8a" opacity="0.6"/>
      <g fill="#b0603e"><circle cx="82" cy="105" r="1.2"/><circle cx="86" cy="108" r="1.2"/><circle cx="118" cy="105" r="1.2"/><circle cx="114" cy="108" r="1.2"/></g>
      <path d="M94 114 Q100 119 106 114" ${sw(3)} fill="none"/>
      ${bag}
      <!-- рука и фонарь -->
      <path d="M130 150 Q148 156 150 146" ${sw(4)} fill="#2f5d62"/>
      <path d="M152 136 v10" ${sw(3)}/>
      <path d="M140 148 h24 l-3 6 h-18z" fill="#3a3240" ${sw(3)}/>
      <rect x="141" y="154" width="22" height="26" rx="3" fill="#ffd36e" ${sw(3)}/>
      <path d="M152 154 v26 M141 167 h22" ${sw(2)}/>
      <path d="M152 161 q-5 7 0 13 q5 -6 0 -13z" fill="#ff8a2a"/>
      <path d="M139 180 h26 l-4 6 h-18z" fill="#3a3240" ${sw(3)}/>
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
      <text x="184" y="198" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#e6c45a" stroke="${O}" stroke-width="1">В</text>
      <text x="40" y="198" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#e6c45a" stroke="${O}" stroke-width="1">З</text>
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
        <text x="46" y="211" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="bold" fill="#5a2a26">ПЛАТА</text>
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
  };
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

  window.Art = { soundIcon, background, mixSky, sampleSky, hero, enemy: (id) => (enemiesArt[id] || enemiesArt.inkcat)(), icon, intentIcon, flame: (s = 1) => svg('0 0 100 100', flameShape(50, 44, s * 1.2), 'icon') };
})();
