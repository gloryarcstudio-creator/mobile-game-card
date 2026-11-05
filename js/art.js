/* Фитиль — процедурная SVG-графика.
   Всё рисуется кодом, чтобы прототип не зависел от внешних ассетов.
   Стиль: толстый тёмный контур, плоские цвета, мягкие тени, ночная палитра. */
(function () {
  const O = '#17121f'; // цвет контура
  const sw = (w) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  function svg(vb, body, cls = '') {
    return `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  /* ---------- Фон: ночная заснеженная улица ---------- */
  function background(litLamps = 0) {
    const lampXs = [70, 170, 265, 345];
    let lamps = '';
    lampXs.forEach((x, i) => {
      const lit = i < litLamps;
      lamps += `
        <g transform="translate(${x},0)">
          ${lit ? `<circle cx="0" cy="512" r="34" fill="url(#lampGlow)"/>` : ''}
          <rect x="-2" y="515" width="4" height="70" fill="#141826"/>
          <path d="M-9 500 h18 l-3 16 h-12z" fill="${lit ? '#ffcf6b' : '#2a3044'}" stroke="#141826" stroke-width="2"/>
          <path d="M-11 500 h22 l-11 -8z" fill="#141826"/>
        </g>`;
    });
    return svg('0 0 400 860', `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#232a42"/>
          <stop offset="0.6" stop-color="#3a4566"/>
          <stop offset="1" stop-color="#4b5878"/>
        </linearGradient>
        <linearGradient id="snowG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7d8db0"/>
          <stop offset="1" stop-color="#4c5a7c"/>
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/>
          <stop offset="1" stop-color="#ffd27a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="winGlow">
          <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.6"/>
          <stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="fog" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#9fb0d0" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#9fb0d0" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="860" fill="url(#sky)"/>
      <!-- пустое место от украденной луны -->
      <circle cx="300" cy="120" r="38" fill="none" stroke="#5d6a8f" stroke-width="2" stroke-dasharray="4 7" opacity="0.6"/>
      <!-- дальние холмы и шпили -->
      <path d="M0 520 Q80 470 160 505 T320 490 T400 500 V600 H0z" fill="#33405e"/>
      <path d="M118 505 l8 -40 l8 40z M126 465 v-12 M121 457 h10" fill="#2a3450" stroke="#2a3450" stroke-width="2"/>
      <path d="M300 495 l10 -55 l10 55z" fill="#2a3450"/>
      <path d="M330 500 l7 -30 l7 30z" fill="#2a3450"/>
      <circle cx="210" cy="540" r="160" fill="url(#fog)"/>
      <!-- дом слева -->
      <g>
        <circle cx="40" cy="585" r="70" fill="url(#winGlow)"/>
        <rect x="-10" y="520" width="120" height="100" fill="#2b2733" stroke="#17121f" stroke-width="3"/>
        <path d="M-20 530 L50 455 L125 530z" fill="#c9d4ea" stroke="#17121f" stroke-width="3"/>
        <path d="M-20 530 L50 455 L125 530 L118 538 Q60 528 -12 540z" fill="#e6edf8"/>
        <rect x="68" y="440" width="12" height="40" fill="#22202a" stroke="#17121f" stroke-width="3"/>
        <rect x="10" y="555" width="26" height="24" fill="#ff9d42" stroke="#17121f" stroke-width="3"/>
        <path d="M23 555 v24 M10 567 h26" stroke="#17121f" stroke-width="2"/>
        <rect x="70" y="570" width="22" height="50" fill="#e07a2c" stroke="#17121f" stroke-width="3"/>
      </g>
      <!-- дом справа, окна погашены -->
      <g>
        <rect x="300" y="540" width="110" height="80" fill="#252431" stroke="#17121f" stroke-width="3"/>
        <path d="M290 548 L350 490 L415 548z" fill="#c9d4ea" stroke="#17121f" stroke-width="3"/>
        <rect x="320" y="565" width="20" height="20" fill="#1b1a24" stroke="#17121f" stroke-width="2"/>
        <rect x="360" y="565" width="20" height="20" fill="#1b1a24" stroke="#17121f" stroke-width="2"/>
      </g>
      ${lamps}
      <!-- снег на земле -->
      <path d="M0 600 Q100 585 200 598 T400 592 V860 H0z" fill="url(#snowG)"/>
      <path d="M0 600 Q100 585 200 598 T400 592" fill="none" stroke="#a9b8d6" stroke-width="3" opacity="0.7"/>
      <!-- забор -->
      <g stroke="#17121f" stroke-width="2.5" fill="#3b3640">
        <path d="M130 585 l4 -18 l4 18z M150 588 l4 -20 l4 20z M170 590 l4 -18 l4 18z"/>
        <path d="M128 578 h52" fill="none"/>
      </g>
    `, 'bg-svg');
  }

  /* ---------- Героиня: Ива, ученица фонарщика ---------- */
  function hero() {
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

  window.Art = { background, hero, enemy: (id) => (enemiesArt[id] || enemiesArt.inkcat)(), icon, intentIcon, flame: (s = 1) => svg('0 0 100 100', flameShape(50, 44, s * 1.2), 'icon') };
})();
