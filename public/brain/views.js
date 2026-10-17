/* رسومات الألغاز: كل لغز له mount (رسم المشهد) و tick (أثناء السؤال) و reveal (كشف الحل خطوة بخطوة) */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs = {}, parent = null, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function H(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function board(container, cls) {
    const svg = S('svg', { viewBox: '0 0 1000 900', class: `scene ${cls}` });
    container.appendChild(svg);
    return svg;
  }
  /** مولّد أرقام شبه عشوائي ثابت (حتى يبقى المشهد نفسه في كل مرة) */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const GLYPH = { triangle: '▲', circle: '●', square: '■', star: '★', diamond: '◆' };

  /** شكل هندسي (مثلث/دائرة/مربع/نجمة/معيّن) متمركز عند x,y */
  function shapePath(shape, x, y, size) {
    const r = size / 2;
    switch (shape) {
      case 'triangle': return `M${x} ${y - r} L${x + r * 0.95} ${y + r * 0.7} L${x - r * 0.95} ${y + r * 0.7} Z`;
      case 'square': return `M${x - r} ${y - r} H${x + r} V${y + r} H${x - r} Z`;
      case 'diamond': return `M${x} ${y - r} L${x + r * 0.8} ${y} L${x} ${y + r} L${x - r * 0.8} ${y} Z`;
      case 'star': {
        let d = '';
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          d += `${i ? 'L' : 'M'}${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)} `;
        }
        return `${d}Z`;
      }
      default: // circle
        return `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
  }

  function badge(parent, x, y, label, cls = '') {
    const g = S('g', { class: `badge ${cls}` }, parent);
    S('circle', { cx: x, cy: y, r: 30 }, g);
    S('text', { x, y: y + 11, 'text-anchor': 'middle' }, g, label);
    return g;
  }
  function mark(parent, x, y, ok) {
    const g = S('g', { class: `mark ${ok ? 'ok' : 'bad'}` }, parent);
    S('circle', { cx: x, cy: y, r: 34 }, g);
    S('text', { x, y: y + 14, 'text-anchor': 'middle' }, g, ok ? '✓' : '✗');
    return g;
  }

  // ==================================================================
  // 1) المحقق الرقمي — مشهد مكتب محقق ليلاً
  // ==================================================================
  const detective = {
    mount(container, pz) {
      const v = pz.visual;
      const svg = board(container, 'detective');
      const R = rng(7);
      const defs = S('defs', {}, svg);
      defs.innerHTML = `
        <linearGradient id="dWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a36"/><stop offset="1" stop-color="#070d1f"/></linearGradient>
        <linearGradient id="dSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1230"/><stop offset="1" stop-color="#2a1f4d"/></linearGradient>
        <linearGradient id="dFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a10"/><stop offset="1" stop-color="#120a05"/></linearGradient>
        <linearGradient id="dSafe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b7280"/><stop offset="1" stop-color="#2b3039"/></linearGradient>
        <radialGradient id="dLamp" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
        <radialGradient id="dVig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
        <pattern id="dStripe" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="13" height="26" fill="#ffffff" opacity=".018"/></pattern>
        <pattern id="dCork" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#7a5530"/><circle cx="3" cy="4" r="1.3" fill="#5e3f22"/><circle cx="10" cy="10" r="1.1" fill="#916a40"/></pattern>
        <clipPath id="dWin"><rect x="440" y="50" width="260" height="330"/></clipPath>
        <mask id="dSpot"><rect width="1000" height="900" fill="#fff"/><circle class="spot-hole" cx="500" cy="450" r="0" fill="#000"/></mask>`;

      S('rect', { width: 1000, height: 800, fill: 'url(#dWall)' }, svg);
      S('rect', { width: 1000, height: 800, fill: 'url(#dStripe)' }, svg);

      // النافذة والمدينة
      const win = S('g', { 'clip-path': 'url(#dWin)' }, svg);
      S('rect', { x: 440, y: 50, width: 260, height: 330, fill: 'url(#dSky)' }, win);
      S('circle', { cx: 655, cy: 105, r: 24, fill: '#f6f1c8', opacity: 0.9, class: 'moon' }, win);
      const buildings = [[445, 210, 55], [503, 150, 42], [548, 225, 56], [608, 175, 46], [656, 240, 44]];
      for (const [x, y, w] of buildings) {
        S('rect', { x, y, width: w, height: 380 - y, fill: '#081026' }, win);
        for (let wy = y + 12; wy < 370; wy += 22) {
          for (let wx = x + 6; wx < x + w - 10; wx += 14) {
            if (R() < 0.38) S('rect', { x: wx, y: wy, width: 8, height: 11, fill: '#ffd56b', opacity: (0.35 + R() * 0.5).toFixed(2) }, win);
          }
        }
      }
      const rain = S('g', { class: 'rain' }, win);
      for (let i = 0; i < 46; i++) {
        const x = 440 + R() * 260; const y = -300 + R() * 680;
        S('line', { x1: x, y1: y, x2: x - 6, y2: y + 26, stroke: '#9fc3ff', 'stroke-width': 1.4, opacity: 0.35 }, rain);
      }
      S('rect', { x: 440, y: 50, width: 260, height: 330, class: 'flash', fill: '#cfe0ff', opacity: 0 }, win);
      S('rect', { x: 434, y: 44, width: 272, height: 342, fill: 'none', stroke: '#1d1712', 'stroke-width': 12 }, svg);
      S('line', { x1: 625, y1: 50, x2: 625, y2: 380, stroke: '#1d1712', 'stroke-width': 8 }, svg);
      S('line', { x1: 440, y1: 180, x2: 700, y2: 180, stroke: '#1d1712', 'stroke-width': 8 }, svg);
      // ظلال الستائر على الجدار
      const blinds = S('g', { opacity: 0.06 }, svg);
      for (let i = 0; i < 7; i++) S('polygon', { points: `${430 + i * 6},${400 + i * 38} ${720 + i * 22},${400 + i * 38} ${760 + i * 24},${416 + i * 38} ${440 + i * 6},${416 + i * 38}`, fill: '#ffe2a8' }, blinds);

      // لوحة الأدلة
      S('rect', { x: 60, y: 70, width: 320, height: 300, fill: 'url(#dCork)', stroke: '#3d2a18', 'stroke-width': 10, rx: 4 }, svg);
      const photos = [[92, 96, 92, 72, -6], [262, 98, 92, 76, 5], [96, 262, 84, 88, 4], [268, 270, 86, 74, -4]];
      const pins = [];
      for (const [x, y, w, h, rot] of photos) {
        const g = S('g', { transform: `rotate(${rot} ${x + w / 2} ${y + h / 2})` }, svg);
        S('rect', { x, y, width: w, height: h, fill: '#e9e4d6' }, g);
        S('rect', { x: x + 6, y: y + 6, width: w - 12, height: h - 22, fill: '#2d3445' }, g);
        S('circle', { cx: x + w / 2, cy: y + h / 2 - 8, r: 11, fill: '#5b6478' }, g);
        S('rect', { x: x + w / 2 - 16, y: y + h / 2 + 4, width: 32, height: 16, rx: 8, fill: '#5b6478' }, g);
        pins.push([x + w / 2, y + 4]);
      }
      // خيوط حمراء — والمثلث مرسوم بنفس لون الخيوط ليختبئ بينها
      const strings = S('g', { stroke: '#b3261e', 'stroke-width': 2.2, fill: 'none', opacity: 0.9 }, svg);
      const links = [[0, 1], [0, 3], [1, 2], [2, 3]];
      for (const [a, b] of links) S('line', { x1: pins[a][0], y1: pins[a][1], x2: pins[b][0], y2: pins[b][1] }, strings);
      for (const [x, y] of pins) S('circle', { cx: x, cy: y, r: 6, fill: '#d63031', stroke: '#7a1010', 'stroke-width': 1.5 }, svg);

      // الساعة
      S('circle', { cx: 872, cy: 150, r: 62, fill: '#e8e2cf', stroke: '#3b2f22', 'stroke-width': 9 }, svg);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        S('line', { x1: 872 + 48 * Math.sin(a), y1: 150 - 48 * Math.cos(a), x2: 872 + 54 * Math.sin(a), y2: 150 - 54 * Math.cos(a), stroke: '#3b2f22', 'stroke-width': 3 }, svg);
      }
      S('line', { x1: 872, y1: 150, x2: 845, y2: 130, stroke: '#1d1712', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
      S('line', { x1: 872, y1: 150, x2: 912, y2: 128, stroke: '#1d1712', 'stroke-width': 3.5, 'stroke-linecap': 'round', class: 'clock-hand' }, svg);

      // التقويم
      S('rect', { x: 50, y: 430, width: 100, height: 130, fill: '#ddd6c3', rx: 4 }, svg);
      S('rect', { x: 50, y: 430, width: 100, height: 30, fill: '#9b2c2c', rx: 4 }, svg);
      S('text', { x: 100, y: 452, 'text-anchor': 'middle', class: 'cal-m' }, svg, 'أكتوبر');

      // رف الكتب
      S('rect', { x: 730, y: 360, width: 240, height: 240, fill: '#3a2616', stroke: '#24170c', 'stroke-width': 6 }, svg);
      const spines = ['#7c2d12', '#1e3a8a', '#14532d', '#713f12', '#4c1d95', '#831843', '#334155', '#92400e'];
      const shelf = (base, books) => {
        let x = 740;
        for (const [w, h, c] of books) {
          S('rect', { x, y: base - h, width: w, height: h, fill: spines[c], stroke: '#00000055' }, svg);
          S('line', { x1: x + 3, y1: base - h + 10, x2: x + w - 3, y2: base - h + 10, stroke: '#e2c08d', 'stroke-width': 1.5, opacity: 0.6 }, svg);
          x += w + 2;
        }
        S('rect', { x: 733, y: base, width: 234, height: 8, fill: '#24170c' }, svg);
      };
      shelf(468, [[22, 88, 0], [26, 96, 1], [20, 80, 2], [28, 92, 3], [24, 86, 4], [30, 98, 5], [22, 84, 6], [26, 94, 7], [24, 90, 1]]);
      shelf(592, [[26, 96, 6], [24, 90, 3], [30, 98, 0], [34, 100, 7], [22, 86, 2], [28, 92, 4], [24, 88, 5], [20, 80, 1]]);

      // الأرضية والسجادة (زخارف معيّنات — واحد منها يخفي رقماً للتمويه)
      S('rect', { y: 800, width: 1000, height: 100, fill: 'url(#dFloor)' }, svg);
      S('ellipse', { cx: 650, cy: 852, rx: 260, ry: 42, fill: '#5b1a1a', stroke: '#8a3b2a', 'stroke-width': 5 }, svg);
      for (const x of [480, 560, 770, 830]) S('path', { d: shapePath('diamond', x, 852, 30), fill: 'none', stroke: '#b9773f', 'stroke-width': 3 }, svg);

      // المكتب
      S('polygon', { points: '240,610 790,610 830,662 200,662', fill: '#5a3a22' }, svg);
      S('rect', { x: 200, y: 662, width: 630, height: 140, fill: '#3e2716' }, svg);
      S('rect', { x: 560, y: 690, width: 230, height: 46, fill: '#4a2f1b', stroke: '#2a190d', 'stroke-width': 3 }, svg);
      S('rect', { x: 560, y: 746, width: 230, height: 46, fill: '#4a2f1b', stroke: '#2a190d', 'stroke-width': 3 }, svg);
      S('circle', { cx: 675, cy: 713, r: 5, fill: '#c9a227' }, svg);
      S('circle', { cx: 675, cy: 769, r: 5, fill: '#c9a227' }, svg);
      // المصباح وضوءه
      S('polygon', { points: '612,486 676,486 840,650 430,650', fill: 'url(#dLamp)', class: 'lamp-cone' }, svg);
      S('ellipse', { cx: 700, cy: 640, rx: 40, ry: 9, fill: '#1f2937' }, svg);
      S('path', { d: 'M700 636 L690 540 L650 486', stroke: '#1f2937', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, svg);
      S('path', { d: 'M600 492 Q644 430 690 486 Z', fill: '#14532d', stroke: '#0b2e18', 'stroke-width': 3 }, svg);
      // ملف القضية
      const d1947 = v.decoys.find((d) => d.text === '1947');
      S('polygon', { points: `${d1947.x - 80},618 ${d1947.x + 70},614 ${d1947.x + 82},656 ${d1947.x - 70},660`, fill: '#c9a66b', stroke: '#8a6a35', 'stroke-width': 2 }, svg);
      S('text', { x: d1947.x - 48, y: 640, class: 'ink small', 'text-anchor': 'middle' }, svg, 'سرّي');
      // كوب القهوة
      const star = v.symbols.find((s) => s.shape === 'star');
      S('path', { d: `M${star.x - 26} ${star.y - 38} h52 l-4 72 q-22 8 -44 0 Z`, fill: '#e5e7eb', stroke: '#9ca3af', 'stroke-width': 2 }, svg);
      S('path', { d: `M${star.x + 25} ${star.y - 18} q26 4 18 30 q-6 12 -21 10`, fill: 'none', stroke: '#e5e7eb', 'stroke-width': 7 }, svg);
      const steam = S('g', { class: 'steam', stroke: '#ffffff', 'stroke-width': 3, fill: 'none', opacity: 0.35 }, svg);
      for (const dx of [-10, 6]) S('path', { d: `M${star.x + dx} ${star.y - 46} q-10 -16 0 -30 q10 -14 0 -28` }, steam);

      // الخزنة وورقة الملاحظة
      S('rect', { x: 36, y: 600, width: 196, height: 230, rx: 10, fill: 'url(#dSafe)', stroke: '#1f2329', 'stroke-width': 5 }, svg);
      S('rect', { x: 164, y: 612, width: 58, height: 26, rx: 4, fill: '#0b1f12', stroke: '#111', class: 'safe-lcd' }, svg);
      S('text', { x: 193, y: 631, 'text-anchor': 'middle', class: 'lcd' }, svg, '----');
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const n = r === 3 ? ['*', '0', '#'][c] : String(r * 3 + c + 1);
          S('rect', { x: 166 + c * 19, y: 648 + r * 21, width: 16, height: 17, rx: 3, fill: '#d1d5db' }, svg);
          S('text', { x: 174 + c * 19, y: 661 + r * 21, 'text-anchor': 'middle', class: 'key' }, svg, n);
        }
      }
      S('circle', { cx: 194, cy: 776, r: 26, fill: '#9ca3af', stroke: '#374151', 'stroke-width': 4 }, svg);
      S('circle', { cx: 194, cy: 776, r: 5, fill: '#374151' }, svg);
      S('circle', { cx: 222, cy: 616, r: 4, fill: '#ef4444', class: 'safe-led' }, svg);
      const note = S('g', { transform: 'rotate(-3 100 712)' }, svg);
      S('rect', { x: 52, y: 616, width: 98, height: 196, fill: '#fde68a', stroke: '#d4a017', 'stroke-width': 1.5 }, note);
      S('text', { x: 101, y: 640, 'text-anchor': 'middle', class: 'ink' }, note, 'الشفرة');
      v.note.forEach((shape, i) => {
        const y = 674 + i * 38;
        S('text', { x: 136, y: y + 8, 'text-anchor': 'middle', class: 'ink' }, note, '١٢٣٤'[i]);
        S('path', { d: shapePath(shape, 88, y, 24), fill: '#1f2937' }, note);
      });

      // الأرقام التمويهية
      for (const d of v.decoys) {
        const cls = d.text === '17' ? 'cal-d' : d.text === '1947' ? 'ink small' : 'spine-n';
        S('text', { x: d.x, y: d.y, 'text-anchor': 'middle', class: cls }, svg, d.text);
      }

      // الرموز المخفية
      const symStyle = {
        triangle: { stroke: '#b3261e', fill: 'none', ink: '#8f1d16' },
        circle: { stroke: '#c9a227', fill: 'none', ink: '#d9b84a' },
        square: { stroke: '#8a5a00', fill: 'none', ink: '#6b4400' },
        star: { stroke: '#9ca3af', fill: 'none', ink: '#6b7280' },
        diamond: { stroke: '#b9773f', fill: 'none', ink: '#d39a5d' },
      };
      for (const s of v.symbols) {
        if (s.shape === 'square') S('rect', { x: s.x - 22, y: s.y - 22, width: 44, height: 44, fill: '#ffcf5a', opacity: 0.9 }, svg);
        const st = symStyle[s.shape];
        S('path', { d: shapePath(s.shape, s.x, s.y, s.size), fill: st.fill, stroke: st.stroke, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, svg);
        const fy = s.shape === 'triangle' ? s.y + s.size * 0.32 : s.y + s.size * 0.2;
        S('text', { x: s.x, y: fy, 'text-anchor': 'middle', class: 'hid', fill: st.ink, 'font-size': Math.round(s.size * (s.shape === 'star' ? 0.36 : 0.5)) }, svg, String(s.digit));
      }

      S('rect', { width: 1000, height: 900, fill: 'url(#dVig)', 'pointer-events': 'none' }, svg);
      // طبقة الكشف بالكشاف
      S('rect', { width: 1000, height: 900, fill: '#000', class: 'spot-dim', mask: 'url(#dSpot)' }, svg);
      this.callouts = S('g', { class: 'callouts' }, svg);
      this.svg = svg;
      this.v = v;
    },
    tick(sec) {
      // برق خفيف في النافذة كل فترة لزيادة التوتر
      if (Math.floor(sec) % 9 === 4 && this.lastFlash !== Math.floor(sec)) {
        this.lastFlash = Math.floor(sec);
        const f = this.svg.querySelector('.flash');
        f.classList.remove('go'); void f.getBoundingClientRect(); f.classList.add('go');
      }
    },
    reveal(i, data) {
      const svg = this.svg;
      const hole = svg.querySelector('.spot-hole');
      svg.classList.add('revealing');
      const focus = data.focus || [];
      if (i === 0) {
        Object.assign(hole.style, { cx: '96px', cy: '712px', r: '120px' });
      } else if (i >= 1 && i <= focus.length) {
        const f = focus[i - 1];
        Object.assign(hole.style, { cx: `${f.x}px`, cy: `${f.y}px`, r: `${f.size * 1.5}px` });
        const g = S('g', { class: 'callout' }, this.callouts);
        const bx = Math.max(90, Math.min(910, f.x)); const by = f.y < 200 ? f.y + 110 : f.y - 100;
        S('line', { x1: f.x, y1: f.y, x2: bx, y2: by, class: 'callout-line' }, g);
        S('rect', { x: bx - 70, y: by - 38, width: 140, height: 76, rx: 18 }, g);
        S('text', { x: bx, y: by + 16, 'text-anchor': 'middle' }, g, `${GLYPH[f.shape]} ${f.digit}`);
      } else if (i === focus.length + 1) {
        Object.assign(hole.style, { cx: '500px', cy: '450px', r: '1400px' });
        for (const s of this.v.symbols.filter((x) => !this.v.note.includes(x.shape))) mark(this.callouts, s.x, s.y - 50, false);
        for (const d of this.v.decoys.filter((x) => x.text.length > 1)) mark(this.callouts, d.x + 50, d.y - 20, false);
      } else {
        Object.assign(hole.style, { cx: '134px', cy: '700px', r: '1400px' });
        svg.querySelector('.lcd').textContent = data.answer;
        svg.querySelector('.safe-led').setAttribute('fill', '#22c55e');
        svg.classList.add('unlocked');
      }
    },
  };

  // ==================================================================
  // 2) الآلة الغامضة — تروس تدور
  // ==================================================================
  function gearPath(cx, cy, r, teeth = true) {
    if (!teeth) return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
    const n = Math.max(6, Math.round(r / 5));
    const ro = r + 7; const ri = r - 7;
    let d = '';
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const w = (Math.PI * 2) / n;
      const pts = [[ri, a], [ro, a + w * 0.18], [ro, a + w * 0.48], [ri, a + w * 0.66]];
      for (const [rr, aa] of pts) d += `${d ? 'L' : 'M'}${(cx + rr * Math.cos(aa)).toFixed(1)} ${(cy + rr * Math.sin(aa)).toFixed(1)} `;
    }
    return `${d}Z`;
  }
  function drawGear(parent, g, cls = '') {
    const wrap = S('g', { class: `gear ${cls} ${g.role || ''} ${g.teeth === false ? 'smooth' : ''}`, 'data-id': g.id }, parent);
    const rot = S('g', { class: 'rot', style: `transform-origin:${g.x}px ${g.y}px` }, wrap);
    S('path', { d: gearPath(g.x, g.y, g.r, g.teeth !== false), class: 'gear-body' }, rot);
    S('circle', { cx: g.x, cy: g.y, r: g.r * 0.62, class: 'gear-ring' }, rot);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      S('line', { x1: g.x, y1: g.y, x2: g.x + g.r * 0.6 * Math.cos(a), y2: g.y + g.r * 0.6 * Math.sin(a), class: 'gear-spoke' }, rot);
    }
    S('circle', { cx: g.x, cy: g.y, r: Math.max(7, g.r * 0.16), class: 'gear-hub' }, rot);
    return wrap;
  }
  function spin(wrap, r, dir) {
    const rot = wrap.querySelector('.rot');
    if (!dir) { rot.style.animation = 'none'; return; }
    rot.style.animation = `spin ${(r / 26).toFixed(2)}s linear infinite ${dir > 0 ? 'normal' : 'reverse'}`;
  }
  function gearDirs(gears, meshes, driver, dir) {
    const by = new Map(gears.map((g) => [g.id, g]));
    const adj = new Map(gears.map((g) => [g.id, []]));
    for (const [a, b] of meshes) {
      if (by.get(a).teeth === false || by.get(b).teeth === false) continue;
      adj.get(a).push(b); adj.get(b).push(a);
    }
    const dirs = { [driver]: dir }; const q = [driver]; let jam = false;
    while (q.length) {
      const id = q.shift();
      for (const n of adj.get(id)) {
        if (dirs[n] === undefined) { dirs[n] = -dirs[id]; q.push(n); } else if (dirs[n] === dirs[id]) jam = true;
      }
    }
    return { dirs, jam };
  }
  function arrowArc(parent, x, y, r, dir, cls) {
    const a0 = -Math.PI * 0.85; const a1 = -Math.PI * 0.15;
    const p = (a) => `${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`;
    const d = dir > 0 ? `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}` : `M${p(a1)} A${r} ${r} 0 0 0 ${p(a0)}`;
    return S('path', { d, class: `arc ${cls}`, 'marker-end': 'url(#mArrow)' }, parent);
  }

  const machine = {
    mount(container, pz) {
      const v = pz.visual;
      const svg = board(container, 'machine');
      const defs = S('defs', {}, svg);
      defs.innerHTML = `
        <pattern id="mGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#38bdf8" stroke-opacity=".08"/></pattern>
        <linearGradient id="mPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#111827"/></linearGradient>
        <radialGradient id="mBulb"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#facc15" stop-opacity="0"/></radialGradient>
        <marker id="mArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e2e8f0"/></marker>`;
      S('rect', { width: 1000, height: 900, fill: '#0a1120' }, svg);
      S('rect', { width: 1000, height: 900, fill: 'url(#mGrid)' }, svg);
      S('rect', { x: 30, y: 300, width: 940, height: 330, rx: 26, fill: 'url(#mPlate)', stroke: '#334155', 'stroke-width': 4 }, svg);
      for (const [x, y] of [[54, 324], [946, 324], [54, 606], [946, 606]]) S('circle', { cx: x, cy: y, r: 7, fill: '#475569' }, svg);

      // المحرّك
      S('rect', { x: 40, y: 340, width: 70, height: 260, rx: 10, fill: '#7f1d1d', stroke: '#450a0a', 'stroke-width': 3 }, svg);
      S('text', { x: 75, y: 330, 'text-anchor': 'middle', class: 'm-label' }, svg, 'المحرّك');
      // المولّد والمصباح
      S('rect', { x: 600, y: 462, width: 140, height: 16, fill: '#64748b' }, svg);
      S('rect', { x: 720, y: 395, width: 200, height: 150, rx: 16, fill: '#1e293b', stroke: '#fbbf24', 'stroke-width': 3, class: 'gen' }, svg);
      S('text', { x: 820, y: 478, 'text-anchor': 'middle', class: 'm-label' }, svg, 'المولّد');
      S('path', { d: 'M820 395 C820 340 800 330 800 300', fill: 'none', stroke: '#94a3b8', 'stroke-width': 5, class: 'cable' }, svg);
      S('circle', { cx: 800, cy: 200, r: 120, fill: 'url(#mBulb)', class: 'bulb-glow' }, svg);
      S('path', { d: 'M800 150 a50 50 0 0 1 28 92 v22 h-56 v-22 a50 50 0 0 1 28 -92z', class: 'bulb' }, svg);
      S('rect', { x: 776, y: 266, width: 48, height: 26, rx: 5, fill: '#64748b' }, svg);

      this.layer = S('g', {}, svg);
      this.gearEls = new Map();
      for (const g of v.gears) this.gearEls.set(g.id, drawGear(this.layer, g, g.role === 'target' ? 'gold' : ''));
      arrowArc(svg, v.gears[0].x, v.gears[0].y, v.gears[0].r + 26, v.driverDir, 'given');
      const tgt = v.gears.find((g) => g.id === v.target);
      arrowArc(svg, tgt.x, tgt.y, tgt.r + 26, v.targetDir, 'need');
      S('text', { x: tgt.x, y: tgt.y + tgt.r + 62, 'text-anchor': 'middle', class: 'm-need' }, svg, 'مطلوب ↻');

      // الفراغ
      this.slot = S('g', { class: 'slot' }, svg);
      S('rect', { x: 372, y: 360, width: 156, height: 220, rx: 22 }, this.slot);
      S('text', { x: 450, y: 500, 'text-anchor': 'middle' }, this.slot, '?');
      this.inserted = S('g', {}, svg);
      this.dirLayer = S('g', { class: 'dir-layer' }, svg);

      // بطاقات الخيارات
      this.cards = [];
      v.options.forEach((o, i) => {
        const cx = 128 + i * 248; const cy = 752;
        const g = S('g', { class: 'opt' }, svg);
        S('rect', { x: cx - 112, y: 650, width: 224, height: 236, rx: 22, class: 'opt-card' }, g);
        const mini = S('g', { transform: `translate(${cx - 450 * 0.78} ${cy - 470 * 0.78}) scale(0.78)` }, g);
        for (const og of o.gears) drawGear(mini, og, 'mini');
        S('text', { x: cx, y: 868, 'text-anchor': 'middle', class: 'opt-label' }, g, o.label);
        badge(g, cx - 82, 682, String(i + 1));
        this.cards.push(g);
      });

      this.v = v;
      this.svg = svg;
      const base = gearDirs(v.gears, v.meshes, v.driver, v.driverDir);
      for (const g of v.gears) spin(this.gearEls.get(g.id), g.r, base.dirs[g.id]);
    },
    reveal(i, data) {
      const v = this.v;
      const answer = Number(data.answer) - 1;
      const wrong = v.options.map((_, k) => k).filter((k) => k !== answer);
      if (i === 1) {
        const [m, g1] = v.gears;
        S('text', { x: m.x, y: m.y + 12, 'text-anchor': 'middle', class: 'dir-tag' }, this.dirLayer, '↻');
        S('text', { x: g1.x, y: g1.y + 12, 'text-anchor': 'middle', class: 'dir-tag' }, this.dirLayer, '↺');
      } else if (i >= 2 && i < 2 + wrong.length) {
        const k = wrong[i - 2];
        const card = this.cards[k];
        card.classList.add('wrong');
        mark(card, 128 + k * 248 + 80, 682, false);
        this.tryOption(k, true);
      } else if (i >= 2 + wrong.length) {
        const card = this.cards[answer];
        card.classList.add('right');
        mark(card, 128 + answer * 248 + 80, 682, true);
        this.tryOption(answer, false);
        this.svg.classList.add('powered');
      }
    },
    /** يضع الخيار في الفراغ ويشغّل الآلة لنرى ماذا يحدث */
    tryOption(k, temporary) {
      const v = this.v; const o = v.options[k];
      this.inserted.textContent = '';
      this.slot.classList.add('filled');
      const els = new Map(this.gearEls);
      for (const og of o.gears) els.set(og.id, drawGear(this.inserted, og, 'inserted'));
      const all = [...v.gears, ...o.gears];
      const { dirs, jam } = gearDirs(all, [...v.meshes, ...o.meshes], v.driver, v.driverDir);
      for (const g of all) spin(els.get(g.id), g.r, jam ? 0 : dirs[g.id]);
      this.svg.classList.toggle('jam', jam);
      if (temporary) {
        clearTimeout(this.tmo);
        this.tmo = setTimeout(() => {
          this.inserted.textContent = '';
          this.svg.classList.remove('jam');
          const base = gearDirs(v.gears, v.meshes, v.driver, v.driverDir);
          for (const g of v.gears) spin(this.gearEls.get(g.id), g.r, base.dirs[g.id]);
        }, 1300);
      } else {
        clearTimeout(this.tmo);
      }
    },
  };

  // ==================================================================
  // 3) توصيل الدائرة
  // ==================================================================
  const LANE_Y = [210, 345, 480, 615];
  const XR = 850; const XL = 150; const YB = 770;
  const circuit = {
    mount(container, pz) {
      const v = pz.visual;
      const svg = board(container, 'circuit');
      const defs = S('defs', {}, svg);
      defs.innerHTML = `
        <pattern id="cGrid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1.4" fill="#22d3ee" opacity=".12"/></pattern>
        <radialGradient id="cGlow"><stop offset="0" stop-color="#fff9c4"/><stop offset=".45" stop-color="#fde047" stop-opacity=".8"/><stop offset="1" stop-color="#fde047" stop-opacity="0"/></radialGradient>`;
      S('rect', { width: 1000, height: 900, fill: '#04131a' }, svg);
      S('rect', { width: 1000, height: 900, fill: 'url(#cGrid)' }, svg);
      S('rect', { x: 20, y: 120, width: 960, height: 760, rx: 30, fill: '#062a2a', stroke: '#0f766e', 'stroke-width': 4, opacity: 0.55 }, svg);

      const wires = S('g', { class: 'wires' }, svg);
      S('line', { x1: XR, y1: LANE_Y[0], x2: XR, y2: YB, class: 'wire plus' }, wires);
      S('line', { x1: XL, y1: LANE_Y[0], x2: XL, y2: 690, class: 'wire' }, wires);
      S('line', { x1: XL, y1: YB, x2: 440, y2: YB, class: 'wire' }, wires);
      S('line', { x1: 560, y1: YB, x2: XR, y2: YB, class: 'wire' }, wires);
      // البطارية: الموجب يميناً
      const bat = S('g', { class: 'battery' }, svg);
      S('rect', { x: 440, y: YB - 40, width: 120, height: 80, rx: 12 }, bat);
      S('rect', { x: 560, y: YB - 14, width: 10, height: 28, rx: 3, class: 'tip' }, bat);
      S('text', { x: 535, y: YB + 13, 'text-anchor': 'middle', class: 'pole' }, bat, '+');
      S('text', { x: 466, y: YB + 13, 'text-anchor': 'middle', class: 'pole' }, bat, '−');
      // المصباح
      S('circle', { cx: XL, cy: 730, r: 120, fill: 'url(#cGlow)', class: 'lamp-glow' }, svg);
      const lamp = S('g', { class: 'lamp' }, svg);
      S('circle', { cx: XL, cy: 730, r: 38 }, lamp);
      S('path', { d: `M${XL - 18} 742 l8 -22 l10 18 l10 -18 l8 22`, class: 'filament' }, lamp);
      S('line', { x1: XL, y1: 690, x2: XL, y2: 692 }, lamp);
      S('line', { x1: XL, y1: 768, x2: XL, y2: YB, class: 'wire' }, lamp);
      S('text', { x: XL + 120, y: 742, 'text-anchor': 'middle', class: 'c-label' }, svg, 'المصباح');

      this.lanes = [];
      v.lanes.forEach((lane, i) => {
        const y = LANE_Y[i];
        const g = S('g', { class: 'lane' }, svg);
        const slots = [720, 500, 290]; // مواقع العناصر من اليمين لليسار
        const xs = [];
        lane.parts.forEach((p, k) => { xs.push([slots[k], p]); });
        // السلك مقسّم حول العناصر
        let x = XR;
        for (const [px, p] of xs) {
          const half = p.type === 'break' ? 6 : p.type === 'switch' ? 34 : 34;
          S('line', { x1: x, y1: y, x2: px + half, y2: y, class: 'wire' }, g);
          this.part(g, px, y, p);
          x = px - half;
        }
        S('line', { x1: x, y1: y, x2: XL, y2: y, class: 'wire' }, g);
        S('circle', { cx: XR, cy: y, r: 7, class: 'node' }, g);
        S('circle', { cx: XL, cy: y, r: 7, class: 'node' }, g);
        badge(g, XR + 70, y, String(i + 1));
        this.lanes.push({ g, y, xs });
      });

      // مفتاح الرموز
      const lg = S('g', { class: 'legend' }, svg);
      S('rect', { x: 40, y: 20, width: 920, height: 80, rx: 20 }, lg);
      this.part(lg, 885, 60, { type: 'switch', closed: true }, true);
      S('text', { x: 740, y: 69, class: 'lg', 'text-anchor': 'middle' }, lg, 'مفتاح مغلق');
      this.part(lg, 600, 60, { type: 'switch', closed: false }, true);
      S('text', { x: 470, y: 69, class: 'lg', 'text-anchor': 'middle' }, lg, 'مفتاح مفتوح');
      this.part(lg, 330, 60, { type: 'diode', dir: 'forward' }, true);
      S('text', { x: 165, y: 69, class: 'lg', 'text-anchor': 'middle' }, lg, 'صمام يمرّر نحو رأسه');
      this.svg = svg;
      this.flow = S('g', { class: 'flow' }, svg);
    },
    part(g, x, y, p, legend = false) {
      switch (p.type) {
        case 'switch': {
          if (legend) S('line', { x1: x + 34, y1: y, x2: x + 50, y2: y, class: 'wire' }, g);
          S('circle', { cx: x + 30, cy: y, r: 6, class: 'node' }, g);
          S('circle', { cx: x - 30, cy: y, r: 6, class: 'node' }, g);
          const ang = p.closed ? 0 : -16; // الفتح بزاوية صغيرة يجعله صعب الملاحظة
          S('line', { x1: x + 30, y1: y, x2: x - 32, y2: y, class: 'lever', transform: `rotate(${ang} ${x + 30} ${y})` }, g);
          if (legend) S('line', { x1: x - 50, y1: y, x2: x - 34, y2: y, class: 'wire' }, g);
          break;
        }
        case 'resistor': {
          let d = `M${x + 34} ${y}`;
          for (let k = 0; k < 6; k++) d += ` L${x + 28 - k * 11} ${y + (k % 2 ? 14 : -14)}`;
          d += ` L${x - 34} ${y}`;
          S('path', { d, class: 'resistor' }, g);
          break;
        }
        case 'break':
          S('circle', { cx: x, cy: y, r: 0.1, class: 'break-pt' }, g);
          break;
        case 'diode': {
          // forward = الرأس يشير لليسار (نحو المصباح)
          const s = p.dir === 'forward' ? -1 : 1;
          if (legend) S('line', { x1: x - 50, y1: y, x2: x + 50, y2: y, class: 'wire' }, g);
          S('path', { d: `M${x - 22 * s} ${y - 22} L${x + 18 * s} ${y} L${x - 22 * s} ${y + 22} Z`, class: 'diode' }, g);
          S('line', { x1: x + 20 * s, y1: y - 24, x2: x + 20 * s, y2: y + 24, class: 'diode-bar' }, g);
          if (!legend) {
            S('line', { x1: x + 34, y1: y, x2: x + 20, y2: y, class: 'wire' }, g);
            S('line', { x1: x - 34, y1: y, x2: x - 20, y2: y, class: 'wire' }, g);
          }
          break;
        }
        default:
      }
    },
    reveal(i, data) {
      const answer = Number(data.answer) - 1;
      const wrong = this.lanes.map((_, k) => k).filter((k) => k !== answer);
      if (i < wrong.length) {
        const L = this.lanes[wrong[i]];
        L.g.classList.add('wrong');
        const bad = L.xs.find(([, p]) => (p.type === 'switch' && !p.closed) || p.type === 'break' || (p.type === 'diode' && p.dir !== 'forward'));
        if (bad) S('circle', { cx: bad[0], cy: L.y, r: 48, class: 'fault' }, L.g);
        mark(L.g, XR + 70, L.y - 2, false);
      } else {
        const L = this.lanes[answer];
        L.g.classList.add('right');
        mark(L.g, XR + 70, L.y - 2, true);
        const y = L.y;
        S('path', { d: `M570 ${YB} H${XR} V${y} H${XL} V${YB} H440`, class: 'current' }, this.flow);
        this.svg.classList.add('lit');
      }
    },
  };

  // ==================================================================
  // 4) خداع بصري
  // ==================================================================
  const LINE_Y = [190, 400, 610];
  const ALIGN_X = 280;
  const illusion = {
    mount(container, pz) {
      const v = pz.visual;
      const svg = board(container, 'illusion');
      const defs = S('defs', {}, svg);
      defs.innerHTML = '<radialGradient id="iBg" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#05040f"/></radialGradient>';
      S('rect', { width: 1000, height: 900, fill: 'url(#iBg)' }, svg);
      const rings = S('g', { class: 'hypno' }, svg);
      for (let r = 60; r < 700; r += 60) S('circle', { cx: 500, cy: 400, r, fill: 'none', stroke: '#8b5cf6', 'stroke-opacity': 0.07, 'stroke-width': 18 }, rings);

      this.ruler = S('g', { class: 'ruler' }, svg);
      const maxL = Math.max(...v.lines.map((l) => l.length));
      S('line', { x1: ALIGN_X, y1: 110, x2: ALIGN_X, y2: 690, class: 'guide' }, this.ruler);
      S('line', { x1: ALIGN_X + 400, y1: 110, x2: ALIGN_X + 400, y2: 690, class: 'guide' }, this.ruler);
      S('rect', { x: ALIGN_X - 10, y: 700, width: maxL + 60, height: 46, rx: 6, class: 'ruler-body' }, this.ruler);
      for (let k = 0; k <= maxL + 40; k += 20) S('line', { x1: ALIGN_X + k, y1: 700, x2: ALIGN_X + k, y2: k % 100 === 0 ? 728 : 714, class: 'ruler-tick' }, this.ruler);

      this.items = v.lines.map((l, i) => {
        const y = LINE_Y[i];
        const x0 = 500 - l.length / 2; const x1 = 500 + l.length / 2;
        const g = S('g', { class: 'ill-line' }, svg);
        g.style.transform = 'translateX(0px)';
        S('line', { x1: x0, y1: y, x2: x1, y2: y, class: 'shaft' }, g);
        const fins = S('g', { class: 'fins' }, g);
        const f = l.fins === 'out' ? -1 : 1;
        if (l.fins !== 'none') {
          for (const [x, s] of [[x0, 1], [x1, -1]]) {
            S('line', { x1: x, y1: y, x2: x + 52 * f * s, y2: y - 46, class: 'fin' }, fins);
            S('line', { x1: x, y1: y, x2: x + 52 * f * s, y2: y + 46, class: 'fin' }, fins);
          }
        }
        S('text', { x: x1 + 50, y: y + 10, class: 'len', 'text-anchor': 'middle' }, g, String(l.length));
        badge(svg, 90, y, String(i + 1));
        return { g, x0 };
      });
      // خيارات
      (v.optionsLabel || []).forEach((label, k) => {
        const cx = 130 + k * 248;
        const g = S('g', { class: 'opt pill' }, svg);
        S('rect', { x: cx - 110, y: 790, width: 220, height: 84, rx: 42, class: 'opt-card' }, g);
        S('text', { x: cx + 20, y: 843, 'text-anchor': 'middle', class: 'opt-label big' }, g, label);
        badge(g, cx - 72, 832, String(k + 1));
      });
      this.svg = svg;
      this.v = v;
    },
    reveal(i, data) {
      const svg = this.svg;
      if (i === 0) svg.classList.add('fins-pulse');
      if (i === 1) {
        S('text', { x: 500, y: 300, 'text-anchor': 'middle', class: 'equal-q' }, svg, 'متساوية؟ 🤔');
      }
      if (i === 2) {
        svg.classList.remove('fins-pulse');
        svg.classList.add('measured');
        svg.querySelector('.equal-q')?.remove();
        this.items.forEach((it) => { it.g.style.transform = `translateX(${ALIGN_X - it.x0}px)`; });
      }
      if (i >= 3) {
        const k = Number(data.answer) - 1;
        if (this.items[k]) this.items[k].g.classList.add('winner-line');
        const opts = svg.querySelectorAll('.opt');
        opts.forEach((o, idx) => o.classList.add(idx === k ? 'right' : 'dim'));
      }
    },
  };

  // ==================================================================
  // 5) الشفرة العلمية
  // ==================================================================
  const science = {
    mount(container, pz) {
      const v = pz.visual;
      const root = H('div', 'sci', undefined, container);
      const grid = H('div', 'sci-grid', undefined, root);
      const art = [
        () => '<svg viewBox="0 0 200 120"><line x1="100" y1="60" x2="40" y2="95" stroke="#cbd5e1" stroke-width="8"/><line x1="100" y1="60" x2="160" y2="95" stroke="#cbd5e1" stroke-width="8"/><circle cx="100" cy="55" r="34" fill="#ef4444"/><text x="100" y="66" text-anchor="middle" font-size="30" font-weight="900" fill="#fff">O</text><circle cx="38" cy="96" r="20" fill="#f8fafc"/><text x="38" y="104" text-anchor="middle" font-size="20" font-weight="900" fill="#0f172a">H</text><circle cx="162" cy="96" r="20" fill="#f8fafc"/><text x="162" y="104" text-anchor="middle" font-size="20" font-weight="900" fill="#0f172a">H</text></svg>',
        () => '<svg viewBox="0 0 200 120"><rect x="62" y="6" width="76" height="108" rx="10" fill="#0f172a" stroke="#22d3ee" stroke-width="4"/><text x="74" y="34" font-size="22" font-weight="900" fill="#fbbf24">?</text><text x="100" y="86" text-anchor="middle" font-size="52" font-weight="900" fill="#e2e8f0">C</text><text x="100" y="106" text-anchor="middle" font-size="14" fill="#94a3b8">كربون</text></svg>',
        () => '<svg viewBox="0 0 200 120"><circle cx="155" cy="60" r="30" fill="none" stroke="#a78bfa" stroke-width="6"/><text x="155" y="72" text-anchor="middle" font-size="34" font-weight="900" fill="#a78bfa">②</text><text x="100" y="74" text-anchor="middle" font-size="40" font-weight="900" fill="#e2e8f0">−</text><circle cx="45" cy="60" r="30" fill="none" stroke="#22d3ee" stroke-width="6"/><text x="45" y="72" text-anchor="middle" font-size="34" font-weight="900" fill="#22d3ee">①</text></svg>',
        () => '<svg viewBox="0 0 200 120"><defs><linearGradient id="ph" x1="0" x2="1"><stop offset="0" stop-color="#ef4444"/><stop offset=".25" stop-color="#f59e0b"/><stop offset=".5" stop-color="#22c55e"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect x="14" y="70" width="172" height="22" rx="11" fill="url(#ph)"/><text x="14" y="112" font-size="14" fill="#94a3b8">0</text><text x="178" y="112" font-size="14" fill="#94a3b8">14</text><path d="M100 10 C80 38 76 50 100 58 C124 50 120 38 100 10Z" fill="#38bdf8"/><text x="100" y="50" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">?</text></svg>',
      ];
      this.slots = [];
      v.stages.forEach((st, i) => {
        const card = H('div', 'sci-card', undefined, grid);
        H('div', 'sci-n', '①②③④'[i], card);
        const a = H('div', 'sci-art', undefined, card);
        a.innerHTML = art[i] ? art[i]() : '';
        H('div', 'sci-q', st.text, card);
        const slot = H('div', 'sci-val', '?', card);
        this.slots.push({ card, slot });
      });
      H('div', 'sci-rule', `🔁 ${v.finalText}`, root);
      const code = H('div', 'sci-code', undefined, root);
      this.codeCells = [0, 1, 2, 3].map(() => H('span', '', '?', code));
      this.root = root;
    },
    reveal(i, data) {
      const vals = data.stageValues || [];
      if (i < this.slots.length) {
        const s = this.slots[i];
        s.card.classList.add('solved');
        s.slot.textContent = String(vals[i]);
        this.codeCells[i].textContent = String(vals[i]);
        this.codeCells[i].classList.add('on');
      } else {
        this.root.classList.add('flip');
        const digits = [...data.answer];
        this.codeCells.forEach((c, k) => {
          c.classList.add('swap');
          setTimeout(() => { c.textContent = digits[k]; c.classList.remove('swap'); c.classList.add('final'); }, 380 + k * 90);
        });
      }
    },
  };

  // ==================================================================
  // 6) اللغز النهائي — بطاقات تنقلب
  // ==================================================================
  const COLOR = { red: '#ef4444', blue: '#3b82f6', yellow: '#facc15' };
  const finalView = {
    mount(container, pz) {
      const v = pz.visual;
      const root = H('div', 'fin', undefined, container);
      const rule = H('div', 'fin-rule', undefined, root);
      rule.innerHTML = 'الإجابة = ( مجموع أرقام <b class="r">■ المربعات الحمراء</b> ) × ( عدد <b class="s">★ النجوم</b> )';
      const grid = H('div', 'fin-grid', undefined, root);
      this.tiles = v.tiles.map((t) => {
        const tile = H('div', 'tile hidden-face', undefined, grid);
        const inner = H('div', 'tile-in', undefined, tile);
        const front = H('div', 'tile-front', undefined, inner);
        front.innerHTML = `<svg viewBox="0 0 200 200"><path d="${shapePath(t.shape, 100, 100, t.shape === 'star' ? 170 : 140)}" fill="${COLOR[t.color]}"/>`
          + `<text x="100" y="${t.shape === 'star' ? 122 : 124}" text-anchor="middle" font-size="${t.shape === 'star' ? 56 : 70}" font-weight="900" fill="${t.color === 'yellow' ? '#111' : '#fff'}">${t.digit}</text></svg>`;
        H('div', 'tile-back', '?', inner);
        return { tile, t };
      });
      this.countdown = H('div', 'fin-count', '', root);
      this.v = v;
      this.root = root;
      this.stage = -1;
    },
    tick(sec) {
      const { showAt, hideAt } = this.v;
      const st = sec < showAt ? 0 : sec < hideAt ? 1 : 2;
      if (st === 0) this.countdown.textContent = `استعد… ${Math.ceil(showAt - sec)}`;
      else if (st === 1) this.countdown.textContent = `احفظها! ${Math.ceil(hideAt - sec)}`;
      else this.countdown.textContent = 'انقلبت! اكتب إجابتك الآن ⚡';
      if (st === this.stage) return;
      this.stage = st;
      this.root.classList.toggle('memorize', st === 1);
      for (const x of this.tiles) x.tile.classList.toggle('hidden-face', st !== 1);
      if (st === 2) window.BrainFX?.sfx('flip');
    },
    reveal(i) {
      const isRS = (t) => t.shape === 'square' && t.color === 'red';
      if (i === 0) {
        this.countdown.textContent = '';
        for (const x of this.tiles) {
          x.tile.classList.remove('hidden-face');
          x.tile.classList.toggle('hl', isRS(x.t));
          x.tile.classList.toggle('dim', !isRS(x.t));
        }
      } else if (i === 2) {
        for (const x of this.tiles) x.tile.classList.toggle('trap', (x.t.shape === 'square' && x.t.color !== 'red') || (x.t.shape === 'star' && x.t.color === 'red'));
      } else if (i === 3) {
        for (const x of this.tiles) {
          x.tile.classList.remove('trap');
          x.tile.classList.toggle('hl', x.t.shape === 'star');
          x.tile.classList.toggle('hl2', isRS(x.t));
          x.tile.classList.toggle('dim', x.t.shape !== 'star' && !isRS(x.t));
        }
      }
    },
  };

  window.PuzzleViews = { detective, machine, circuit, illusion, science, final: finalView };
})();
