// ===============================================================
//  الرسومات: منارات، مسجد، أيقونات الهدايا، الشخصية «نوري»، شارات الفرق
//  كلها SVG مرسومة بالكود — لا تحتاج صوراً خارجية
// ===============================================================

/** نجمة ثمانية (رُبع الحزب) كمسار SVG */
export function star8Path(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 === 0 ? r : r * 0.76;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** شارة الفريق: نجمة ثمانية بلون الفريق وحرف الفضيلة بخط نسخي */
export function teamBadge(team, size = 84) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="badge">
    <defs><radialGradient id="bg-${team.id}" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="${team.glow}"/><stop offset="1" stop-color="${team.color}"/></radialGradient></defs>
    <path d="${star8Path(50, 50, 48)}" fill="url(#bg-${team.id})" stroke="#fff6d8" stroke-width="2.5"/>
    <path d="${star8Path(50, 50, 38)}" fill="rgba(10,16,40,.78)" stroke="${team.glow}" stroke-width="1.5"/>
    <text x="50" y="64" text-anchor="middle" font-family="Amiri, serif" font-weight="700" font-size="40" fill="${team.glow}">${team.letter}</text>
  </svg>`;
}

/**
 * منارة بنور يرتفع من الأسفل حسب نسبة الإضاءة.
 * يُرجع SVG بإحداثيات viewBox 0..200 × 0..900
 */
export function minaretSVG(team) {
  const id = team.id;
  // الشكل: قاعدة، جذع مثمّن، شرفتان، مقصورة علوية، قبة بصلية، هلال
  const shape = `
    <path d="M58 900 L58 760 L50 748 L150 748 L142 760 L142 900 Z"/>
    <rect x="66" y="470" width="68" height="282" rx="4"/>
    <path d="M44 470 L156 470 L148 452 L52 452 Z"/>
    <rect x="72" y="270" width="56" height="186" rx="3"/>
    <path d="M50 270 L150 270 L142 254 L58 254 Z"/>
    <rect x="78" y="150" width="44" height="108" rx="3"/>
    <path d="M70 152 L130 152 C130 112 112 92 100 70 C88 92 70 112 70 152 Z"/>
    <rect x="98" y="34" width="4" height="40"/>`;
  return `<svg viewBox="0 0 200 900" class="minaret-svg" preserveAspectRatio="xMidYMax meet">
    <defs>
      <clipPath id="clip-${id}">${shape}</clipPath>
      <linearGradient id="stone-${id}" x1="0" x2="1">
        <stop offset="0" stop-color="#0d1430"/><stop offset=".45" stop-color="#1d2a55"/><stop offset="1" stop-color="#0a1028"/>
      </linearGradient>
      <linearGradient id="fill-${id}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${team.color}" stop-opacity=".95"/>
        <stop offset=".8" stop-color="${team.glow}" stop-opacity=".95"/>
        <stop offset="1" stop-color="#ffffff"/>
      </linearGradient>
      <pattern id="pat-${id}" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="${star8Path(12, 12, 9)}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/>
      </pattern>
      <filter id="blur-${id}"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <g fill="url(#stone-${id})" stroke="rgba(180,200,255,.25)" stroke-width="2">${shape}</g>
    <g clip-path="url(#clip-${id})">
      <rect class="light-fill" x="0" y="900" width="200" height="900" fill="url(#fill-${id})"/>
      <rect x="0" y="0" width="200" height="900" fill="url(#pat-${id})"/>
      <rect class="light-edge" x="0" y="900" width="200" height="10" fill="#fff" filter="url(#blur-${id})"/>
    </g>
    <!-- الشرفات (الدرابزين) -->
    <g stroke="${team.glow}" stroke-opacity=".55" stroke-width="2" fill="none">
      ${[60, 76, 92, 108, 124, 140].map((x) => `<line x1="${x}" y1="452" x2="${x}" y2="440"/>`).join('')}
      <line x1="52" y1="440" x2="148" y2="440"/>
      ${[66, 82, 100, 118, 134].map((x) => `<line x1="${x}" y1="254" x2="${x}" y2="243"/>`).join('')}
      <line x1="58" y1="243" x2="142" y2="243"/>
    </g>
    <!-- النوافذ المقوّسة -->
    <g class="windows">
      ${[[100, 690], [100, 580], [100, 380], [100, 200]].map(([x, y], i) => `
        <path class="win win-${i}" d="M${x - 9} ${y + 26} L${x - 9} ${y} Q${x} ${y - 16} ${x + 9} ${y} L${x + 9} ${y + 26} Z"/>`).join('')}
    </g>
    <!-- الهلال -->
    <g class="crescent" transform="translate(100 26)">
      <circle r="17" fill="${team.glow}"/>
      <circle cx="7" cy="-4" r="14" fill="#0a1230"/>
    </g>
  </svg>`;
}

/** المسجد في الخلفية: قبة كبرى، قبتان صغيرتان، سور بأقواس مضيئة */
export function mosqueSVG() {
  const arches = [];
  for (let i = 0; i < 13; i++) {
    const x = 60 + i * 80;
    arches.push(`<path class="arch" d="M${x - 18} 1880 L${x - 18} 1828 Q${x} 1800 ${x + 18} 1828 L${x + 18} 1880 Z"/>`);
  }
  return `<svg viewBox="0 0 1080 1920" class="mosque-svg" preserveAspectRatio="xMidYMax meet">
    <defs>
      <linearGradient id="dome" x1="0" x2="1">
        <stop offset="0" stop-color="#0b1330"/><stop offset=".5" stop-color="#1b2856"/><stop offset="1" stop-color="#080f26"/>
      </linearGradient>
      <radialGradient id="domeGlow" cx="50%" cy="100%" r="70%">
        <stop offset="0" stop-color="#ffcf7a" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#141e44"/><stop offset="1" stop-color="#070c20"/>
      </linearGradient>
    </defs>
    <ellipse cx="540" cy="1640" rx="520" ry="240" fill="url(#domeGlow)"/>
    <!-- قبتان جانبيتان -->
    <path d="M250 1700 C250 1610 300 1580 330 1560 C360 1580 410 1610 410 1700 Z" fill="url(#dome)" stroke="rgba(255,220,150,.25)" stroke-width="2"/>
    <path d="M670 1700 C670 1610 720 1580 750 1560 C780 1580 830 1610 830 1700 Z" fill="url(#dome)" stroke="rgba(255,220,150,.25)" stroke-width="2"/>
    <!-- القبة الكبرى -->
    <rect x="360" y="1610" width="360" height="110" fill="url(#wall)"/>
    <path d="M330 1620 C330 1420 470 1380 540 1330 C610 1380 750 1420 750 1620 Z" fill="url(#dome)" stroke="rgba(255,220,150,.35)" stroke-width="3"/>
    <path d="M380 1600 C390 1470 480 1430 540 1390" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/>
    <rect x="537" y="1270" width="6" height="64" fill="#f7d58b"/>
    <g transform="translate(540 1262)"><circle r="16" fill="#f7d58b"/><circle cx="7" cy="-4" r="13" fill="#0a1230"/></g>
    ${[420, 480, 540, 600, 660].map((x) => `<path class="arch" d="M${x - 12} 1700 L${x - 12} 1660 Q${x} 1642 ${x + 12} 1660 L${x + 12} 1700 Z"/>`).join('')}
    <!-- السور -->
    <rect x="0" y="1700" width="1080" height="220" fill="url(#wall)"/>
    <path d="M0 1700 ${Array.from({ length: 28 }, (_, i) => `L${i * 40 + 20} 1688 L${i * 40 + 40} 1700`).join(' ')}" fill="#141e44"/>
    ${arches.join('')}
  </svg>`;
}

/** أيقونات الهدايا */
export const GIFT_ICONS = {
  rose: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gr" cx="45%" cy="35%" r="60%"><stop offset="0" stop-color="#ff8fa8"/><stop offset=".6" stop-color="#e3204b"/><stop offset="1" stop-color="#8a0a2a"/></radialGradient></defs>
    <path d="M50 52 C50 70 48 82 46 96" stroke="#3fa35b" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M48 76 C36 68 26 72 22 80 C34 84 42 82 48 76Z" fill="#46b866"/>
    <path d="M49 70 C60 60 72 62 78 68 C68 76 58 76 49 70Z" fill="#3fa35b"/>
    <path d="M50 10 C70 10 80 26 76 40 C72 54 60 58 50 58 C40 58 28 54 24 40 C20 26 30 10 50 10Z" fill="url(#gr)"/>
    <path d="M38 26 C44 16 58 16 62 26 C64 34 56 40 50 38 C44 36 46 28 52 28" stroke="#7a0822" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M28 40 C34 50 44 52 50 50 C58 52 68 48 72 40" stroke="#9b0f30" stroke-width="2.5" fill="none"/></svg>`,
  heart: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gh" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffb3c7"/><stop offset=".5" stop-color="#ff3d6e"/><stop offset="1" stop-color="#b3093a"/></radialGradient></defs>
    <path d="M50 88 C20 66 8 50 8 34 C8 20 19 10 32 10 C40 10 46 14 50 21 C54 14 60 10 68 10 C81 10 92 20 92 34 C92 50 80 66 50 88Z" fill="url(#gh)" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <ellipse cx="30" cy="30" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 30 30)"/></svg>`,
  donut: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gd" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#ffd9a1"/><stop offset="1" stop-color="#c47a2c"/></radialGradient>
    <radialGradient id="gi" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#ffd1ea"/><stop offset="1" stop-color="#ff5fae"/></radialGradient></defs>
    <circle cx="50" cy="54" r="40" fill="url(#gd)"/>
    <path d="M14 48 C14 24 32 12 50 12 C68 12 86 24 86 48 C80 58 72 52 66 60 C60 66 56 58 50 62 C42 66 38 58 32 62 C24 64 20 56 14 48Z" fill="url(#gi)"/>
    <circle cx="50" cy="48" r="12" fill="#2a1b3d"/><circle cx="50" cy="48" r="12" fill="none" stroke="#e98bbd" stroke-width="3"/>
    ${[[28, 30, '#fff35c'], [40, 22, '#5ce1ff'], [64, 24, '#8bff7a'], [72, 36, '#fff'], [30, 44, '#7a8bff'], [70, 50, '#fff35c'], [58, 34, '#ff7a5c']].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="8" height="3" rx="1.5" fill="${c}" transform="rotate(${i * 47} ${x + 4} ${y + 1})"/>`).join('')}</svg>`,
  perfume: `<svg viewBox="0 0 100 100"><defs><linearGradient id="gp" x1="0" x2="1"><stop offset="0" stop-color="#b99cff"/><stop offset=".5" stop-color="#efe3ff"/><stop offset="1" stop-color="#8f6ae0"/></linearGradient>
    <linearGradient id="gc" x1="0" x2="1"><stop offset="0" stop-color="#b8862b"/><stop offset=".5" stop-color="#ffe59a"/><stop offset="1" stop-color="#a87420"/></linearGradient></defs>
    <rect x="40" y="10" width="20" height="18" rx="4" fill="url(#gc)"/><rect x="44" y="26" width="12" height="8" fill="url(#gc)"/>
    <path d="M26 46 C26 36 36 32 50 32 C64 32 74 36 74 46 L76 82 C76 90 68 94 50 94 C32 94 24 90 24 82Z" fill="url(#gp)" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>
    <path d="${star8Path(50, 64, 14)}" fill="none" stroke="#a87420" stroke-width="2.5"/>
    <ellipse cx="36" cy="54" rx="4" ry="12" fill="#fff" opacity=".55"/>
    <g fill="#ffe59a">${[[16, 20], [80, 14], [86, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</g></svg>`,
  meteor: `<svg viewBox="0 0 100 100"><defs><linearGradient id="gm" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7ad0ff" stop-opacity="0"/><stop offset="1" stop-color="#fff6c8"/></linearGradient></defs>
    <path d="M8 92 L70 30" stroke="url(#gm)" stroke-width="12" stroke-linecap="round"/><path d="${star8Path(72, 28, 22)}" fill="#fff1b0"/></svg>`,
  grand: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#f7d58b"/><circle cx="64" cy="40" r="38" fill="#0b1433"/>
    <path d="${star8Path(70, 58, 14)}" fill="#fff1b0"/></svg>`,
  sparkle: `<svg viewBox="0 0 100 100"><path d="M50 4 L58 42 L96 50 L58 58 L50 96 L42 58 L4 50 L42 42Z" fill="#fff1b0"/><circle cx="50" cy="50" r="10" fill="#fff"/></svg>`,
};

/** «نوري»: فانوس رمضاني لطيف بعينين، شخصية اللعبة */
export function nouriSVG() {
  return `<svg viewBox="0 0 200 260" class="nouri-svg">
    <defs>
      <linearGradient id="ng" x1="0" x2="1"><stop offset="0" stop-color="#a8741f"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#a8741f"/></linearGradient>
      <radialGradient id="nglass" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff4c2"/><stop offset=".55" stop-color="#ffc24d"/><stop offset="1" stop-color="#e8862a"/></radialGradient>
      <filter id="nglow"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <ellipse cx="100" cy="150" rx="78" ry="80" fill="#ffc24d" opacity=".35" filter="url(#nglow)" class="nouri-aura"/>
    <circle cx="100" cy="18" r="12" fill="none" stroke="url(#ng)" stroke-width="6"/>
    <path d="M60 62 C60 40 80 30 100 30 C120 30 140 40 140 62 Z" fill="url(#ng)"/>
    <rect x="50" y="60" width="100" height="12" rx="6" fill="url(#ng)"/>
    <path d="M56 72 L144 72 L156 120 L144 196 L56 196 L44 120 Z" fill="url(#nglass)" stroke="url(#ng)" stroke-width="6"/>
    <path d="M78 72 L72 196 M122 72 L128 196" stroke="url(#ng)" stroke-width="4" opacity=".8"/>
    <path d="${star8Path(100, 98, 10)}" fill="#fff" opacity=".7"/>
    <!-- الوجه -->
    <g class="nouri-face">
      <g class="eyes-open">
        <ellipse cx="84" cy="132" rx="9" ry="12" fill="#3a1d05"/><ellipse cx="116" cy="132" rx="9" ry="12" fill="#3a1d05"/>
        <circle cx="87" cy="127" r="3.5" fill="#fff"/><circle cx="119" cy="127" r="3.5" fill="#fff"/>
      </g>
      <g class="eyes-happy" fill="none" stroke="#3a1d05" stroke-width="5" stroke-linecap="round">
        <path d="M75 134 Q84 122 93 134"/><path d="M107 134 Q116 122 125 134"/>
      </g>
      <ellipse cx="72" cy="150" rx="8" ry="5" fill="#ff7a6b" opacity=".6"/><ellipse cx="128" cy="150" rx="8" ry="5" fill="#ff7a6b" opacity=".6"/>
      <path class="mouth" d="M90 152 Q100 162 110 152" fill="none" stroke="#3a1d05" stroke-width="4" stroke-linecap="round"/>
    </g>
    <path d="M56 196 L144 196 L132 214 L68 214 Z" fill="url(#ng)"/>
    <path d="M84 214 L116 214 L108 232 L92 232 Z" fill="url(#ng)"/>
    <circle cx="100" cy="240" r="6" fill="url(#ng)"/>
  </svg>`;
}

/** فانوس صغير (للتأثيرات على الـ canvas) */
export function lanternSVG(color = '#ffc24d') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 90" width="60" height="90">
    <defs><radialGradient id="l" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".6" stop-color="${color}"/><stop offset="1" stop-color="#b85a12"/></radialGradient></defs>
    <circle cx="30" cy="6" r="4" fill="none" stroke="#e7b850" stroke-width="2"/>
    <path d="M16 22 C16 14 22 10 30 10 C38 10 44 14 44 22Z" fill="#e7b850"/>
    <path d="M14 22 L46 22 L52 46 L46 72 L14 72 L8 46Z" fill="url(#l)" stroke="#e7b850" stroke-width="2.5"/>
    <path d="M14 72 L46 72 L40 80 L20 80Z" fill="#e7b850"/></svg>`;
}

/** كعكة العيد المنقوشة (لمطر الدونات) */
export function kaakSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
    <defs><radialGradient id="k" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#fff2d6"/><stop offset="1" stop-color="#d7a35a"/></radialGradient></defs>
    <circle cx="30" cy="30" r="27" fill="url(#k)"/><circle cx="30" cy="30" r="8" fill="none" stroke="#b9823d" stroke-width="3"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<line x1="${30 + Math.cos(a) * 12}" y1="${30 + Math.sin(a) * 12}" x2="${30 + Math.cos(a) * 23}" y2="${30 + Math.sin(a) * 23}" stroke="#c48e47" stroke-width="2"/>`; }).join('')}
    ${Array.from({ length: 14 }, () => `<circle cx="${10 + Math.random() * 40}" cy="${10 + Math.random() * 40}" r="1.6" fill="#fff"/>`).join('')}</svg>`;
}

/** بتلة ورد */
export function petalSVG(color = '#ff4d74') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
    <path d="M20 2 C34 8 38 24 20 38 C2 24 6 8 20 2Z" fill="${color}"/><path d="M20 6 C22 16 22 26 20 34" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/></svg>`;
}
