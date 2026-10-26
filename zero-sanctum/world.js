/*
 * ZERO SANCTUM — العالم ثلاثي الأبعاد
 * يبني الغرف الست، ويتولى الكاميرا والإضاءة والجسيمات والتوهج والنقر على العناصر.
 * لا يعرف شيئًا عن قواعد الألغاز؛ game.js يخبره بما يتغير.
 */
(function () {
  'use strict';
  const ZS = window.ZS;
  const T = THREE;

  // الهوية البصرية: فحمي، بنفسجي مضيء، ذهبي معتّق
  const C = {
    char: 0x0c0f0e, charLift: 0x1a1f1d, steel: 0x3a403e, violet: 0xb46bff, violetDeep: 0x6a2fb0,
    gold: 0xc9a253, goldDeep: 0x7a5a24, bone: 0xe8e0cc, red: 0xff3b3b,
  };
  const ROOM_THEME = {
    1: { fog: 0x0c0a0e, accent: C.gold, key: 0xffd9a0, dust: 0xd8b878, density: 0.055 },
    2: { fog: 0x0c0714, accent: C.violet, key: 0xe6d2ff, dust: 0xc9a0ff, density: 0.05 },
    3: { fog: 0x0d0b07, accent: 0xe0a24a, key: 0xffcf8a, dust: 0xe8c48a, density: 0.06 },
    4: { fog: 0x0e0806, accent: 0xff7a3a, key: 0xffb27a, dust: 0xffa060, density: 0.05 },
    5: { fog: 0x070a0e, accent: 0x9fd8ff, key: 0xd8eeff, dust: 0xbfe6ff, density: 0.045 },
    6: { fog: 0x0a0512, accent: C.violet, key: 0xe2c7ff, dust: 0xc08aff, density: 0.04 },
  };

  const W = {
    ready: false, room: 1, onHotspot: null, onHover: null,
    groups: {}, hot: {}, dyn: {}, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  window.ZW = W;

  let renderer, scene, camera, composer, bloom, clock;
  let dust, hemi;
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const view = { yaw: 0, pitch: -0.04, tYaw: 0, tPitch: -0.04, pos: new T.Vector3(0, 1.7, 4.6), tPos: new T.Vector3(0, 1.7, 4.6), look: null, tLook: null, focus: null };
  const anims = []; // دوال تُستدعى كل إطار
  let hovered = null;

  // ===== أدوات =====
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, metalness: 0.55, roughness: 0.5 }, o));
  const glow = (color, intensity = 1.6) => new T.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, metalness: 0, roughness: 1 });
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    t.userData = { canvas: c, draw };
    return t;
  }
  function redraw(tex, draw) {
    const c = tex.userData.canvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    draw(g, c.width, c.height);
    tex.needsUpdate = true;
  }
  function drawGlyph(g, id, x, y, size, color, lw = 1.6) {
    const mirrored = ZS.isMirrored(id);
    const p = new Path2D(ZS.GLYPHS[ZS.baseGlyph(id)].path);
    g.save();
    g.translate(x, y);
    g.scale(size / 20, size / 20);
    if (mirrored) { g.translate(20, 0); g.scale(-1, 1); }
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(p);
    g.restore();
  }
  W.drawGlyph = drawGlyph;
  function arabicText(g, text, x, y, size, color, opts = {}) {
    g.save();
    g.direction = 'rtl';
    g.textAlign = opts.align || 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.font = `${opts.weight || 600} ${size}px ${opts.font || '"IBM Plex Sans Arabic", Tahoma, sans-serif'}`;
    if (opts.glow) { g.shadowColor = color; g.shadowBlur = opts.glow; }
    const lines = String(text).split('\n');
    lines.forEach((ln, i) => g.fillText(ln, x, y + (i - (lines.length - 1) / 2) * size * 1.45));
    g.restore();
  }

  function gearShape(teeth, rOuter, rInner, hole) {
    const s = new T.Shape();
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [[rInner, a], [rOuter, a + step * 0.18], [rOuter, a + step * 0.48], [rInner, a + step * 0.66], [rInner, a + step]];
      pts.forEach(([r, ang], k) => {
        const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
        if (i === 0 && k === 0) s.moveTo(px, py); else s.lineTo(px, py);
      });
    }
    if (hole) {
      const h = new T.Path();
      h.absarc(0, 0, hole, 0, Math.PI * 2, true);
      s.holes.push(h);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2, r = (hole + rInner) / 2, rr = (rInner - hole) * 0.22;
        const w = new T.Path();
        w.absarc(Math.cos(a) * r, Math.sin(a) * r, rr, 0, Math.PI * 2, true);
        s.holes.push(w);
      }
    }
    return s;
  }
  function gear(teeth, r, depth, mat) {
    const g = new T.ExtrudeGeometry(gearShape(teeth, r, r * 0.86, r * 0.28), { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    const m = new T.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  W.gear = gear;

  // ===== الهيكل المشترك لكل غرفة =====
  function panelTexture(base, line, accent) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1, 1 + Math.random() * 3);
      }
      g.strokeStyle = line; g.lineWidth = 3;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.strokeRect(w / 2 - 2, 6, 4, h - 12);
      g.fillStyle = accent;
      [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      for (let y = 120; y < h; y += 130) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
    });
  }
  function floorTexture(accentRGB) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#0e0c12'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14000; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 6;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
      g.strokeStyle = `rgba(${accentRGB},.22)`; g.lineWidth = 1.5;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128 + 4, 0); g.lineTo(i * 128 + 4, h); g.stroke(); }
    });
  }
  const hex2rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].join(',');

  function shell(group, n, opts = {}) {
    const th = ROOM_THEME[n];
    const wallTex = panelTexture(opts.wall || '#15121a', 'rgba(0,0,0,.6)', '#' + th.accent.toString(16).padStart(6, '0'));
    wallTex.wrapS = wallTex.wrapT = T.RepeatWrapping; wallTex.repeat.set(4, 2);
    const wallMat = std(0xffffff, { map: wallTex, metalness: 0.35, roughness: 0.72 });
    const ft = floorTexture(hex2rgb(th.accent));
    ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(4, 4);
    const floor = mesh(new T.PlaneGeometry(14, 14), std(0xffffff, { map: ft, metalness: 0.7, roughness: 0.38 }), group, 0, 0, 0, false);
    floor.rotation.x = -Math.PI / 2;
    const ceil = mesh(new T.PlaneGeometry(14, 14), std(0x0a0c0b, { roughness: 0.9 }), group, 0, 6, 0, false);
    ceil.rotation.x = Math.PI / 2;
    const back = mesh(new T.PlaneGeometry(14, 6), wallMat, group, 0, 3, -7, false);
    const left = mesh(new T.PlaneGeometry(14, 6), wallMat, group, -7, 3, 0, false); left.rotation.y = Math.PI / 2;
    const right = mesh(new T.PlaneGeometry(14, 6), wallMat, group, 7, 3, 0, false); right.rotation.y = -Math.PI / 2;
    const front = mesh(new T.PlaneGeometry(14, 6), wallMat, group, 0, 3, 7, false); front.rotation.y = Math.PI;
    [floor, ceil, back, left, right, front].forEach((m) => { m.userData.block = true; });
    // شرائط ضوء في السقف والأرضية
    const stripMat = glow(th.accent, 0.9);
    [-4.5, 4.5].forEach((x) => mesh(new T.BoxGeometry(0.08, 0.04, 12), stripMat, group, x, 5.96, 0, false));
    [[-6.95, 0], [6.95, 0]].forEach(([x]) => mesh(new T.BoxGeometry(0.04, 0.05, 13.6), stripMat, group, x, 0.06, 0, false));
    mesh(new T.BoxGeometry(13.6, 0.05, 0.04), stripMat, group, 0, 0.06, -6.95, false);
    // أضلاع عمودية
    const ribMat = std(C.steel, { metalness: 0.8, roughness: 0.35 });
    for (let i = -6; i <= 6; i += 3) {
      if (!opts.bareBack) mesh(new T.BoxGeometry(0.22, 6, 0.18), ribMat, group, i, 3, -6.9);
      if (Math.abs(i) < 6) {
        mesh(new T.BoxGeometry(0.18, 6, 0.22), ribMat, group, -6.9, 3, i);
        mesh(new T.BoxGeometry(0.18, 6, 0.22), ribMat, group, 6.9, 3, i);
      }
    }
    // إضاءة الغرفة: العدد نفسه في كل غرفة كي لا يُعاد تجميع المظللات عند التنقل
    const key = new T.SpotLight(th.key, 2.4, 22, Math.PI / 4.2, 0.55, 1.4);
    key.position.set(opts.keyX ?? 2.5, 5.8, opts.keyZ ?? 1.5);
    key.target.position.set(opts.keyTX ?? 0, 0.5, opts.keyTZ ?? -4.5);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004;
    group.add(key, key.target);
    const p1 = new T.PointLight(th.accent, 1.1, 11, 2); p1.position.set(-4.5, 3.2, -4.5); group.add(p1);
    const p2 = new T.PointLight(th.accent, 0.8, 11, 2); p2.position.set(4.5, 2.4, -1); group.add(p2);
    group.userData.lights = { key, p1, p2 };
    return { wallMat };
  }

  // ===== العناصر التفاعلية =====
  // hit: مجسم (أو أكثر) يُلتقط بالنقر. glowTargets: مجسمات تتوهج عند التحويم.
  function hotspot(room, id, label, objs, focus, opts = {}) {
    const list = Array.isArray(objs) ? objs : [objs];
    list.forEach((o) => o.traverse((m) => {
      if (!m.isMesh) return;
      m.userData.hot = id;
      if (m.material && m.material.emissive && !m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; }
    }));
    W.hot[id] = { id, room, label, objs: list, focus, enabled: opts.enabled !== false, lookAt: opts.lookAt };
  }
  W.setHotEnabled = (id, on) => { if (W.hot[id]) W.hot[id].enabled = on; };
  W.setHotLabel = (id, label) => { if (W.hot[id]) W.hot[id].label = label; };
  function setHighlight(id, on) {
    const h = W.hot[id];
    if (!h) return;
    h.objs.forEach((o) => o.traverse((m) => {
      if (!m.isMesh || !m.material || !m.material.emissive) return;
      if (on) {
        m.userData.e0 = m.userData.e0 || { c: m.material.emissive.clone(), i: m.material.emissiveIntensity };
        m.material.emissive.setHex(C.violet); m.material.emissiveIntensity = Math.max(0.35, m.userData.e0.i);
      } else if (m.userData.e0) {
        m.material.emissive.copy(m.userData.e0.c); m.material.emissiveIntensity = m.userData.e0.i;
        delete m.userData.e0;
      }
    }));
  }

  function door(group, room, side, toRoom, label) {
    const x = side === 'right' ? 6.92 : -6.92;
    const d = new T.Group();
    d.position.set(x, 0, side === 'right' ? -1.2 : -1.2);
    d.rotation.y = side === 'right' ? -Math.PI / 2 : Math.PI / 2;
    group.add(d);
    const frame = std(C.goldDeep, { metalness: 0.85, roughness: 0.3 });
    mesh(new T.BoxGeometry(2.3, 0.2, 0.25), frame, d, 0, 3.3, 0);
    mesh(new T.BoxGeometry(0.2, 3.3, 0.25), frame, d, -1.1, 1.65, 0);
    mesh(new T.BoxGeometry(0.2, 3.3, 0.25), frame, d, 1.1, 1.65, 0);
    const leafMat = std(0x1c2220, { metalness: 0.75, roughness: 0.35 });
    const lL = mesh(new T.BoxGeometry(1, 3.2, 0.12), leafMat, d, -0.5, 1.6, 0.02);
    const lR = mesh(new T.BoxGeometry(1, 3.2, 0.12), leafMat, d, 0.5, 1.6, 0.02);
    const seam = mesh(new T.BoxGeometry(0.03, 3.1, 0.14), glow(C.red, 1.4), d, 0, 1.6, 0.03, false);
    const sign = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#070509'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a253'; g.font = '700 30px "Michroma", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SECTOR 0' + toRoom, w / 2, h / 2 + 2);
    });
    mesh(new T.PlaneGeometry(1.2, 0.3), new T.MeshBasicMaterial({ map: sign }), d, 0, 3.62, 0.14, false);
    const id = 'door' + room + '_' + toRoom;
    hotspot(room, id, label, [lL, lR], { pos: new T.Vector3(side === 'right' ? 3.5 : -3.5, 1.7, -1.2), look: new T.Vector3(x, 1.6, -1.2) });
    W.dyn[id] = { lL, lR, seam, open: 0, target: 0 };
    anims.push((dt) => {
      const s = W.dyn[id];
      s.open += (s.target - s.open) * Math.min(1, dt * 3);
      lL.position.x = -0.5 - s.open * 0.95; lR.position.x = 0.5 + s.open * 0.95;
    });
  }
  W.setDoor = (room, toRoom, state) => {
    const s = W.dyn['door' + room + '_' + toRoom];
    if (!s) return;
    s.seam.material.emissive.setHex(state === 'locked' ? C.red : C.violet);
    s.unlocked = state !== 'locked';
  };
  W.openDoor = (room, toRoom, open) => { const s = W.dyn['door' + room + '_' + toRoom]; if (s) s.target = open ? 1 : 0; };

  // ===== الغرفة 1: الساعة المعطوبة =====
  function photoFront(id) {
    const p = ZS.PHOTOS[id];
    return (g, w, h) => {
      g.fillStyle = '#d9cfb8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3b3a33'; g.fillRect(14, 14, w - 28, h - 58);
      const cx = w / 2, cy = (h - 44) / 2 + 8;
      const grd = g.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
      grd.addColorStop(0, '#b7a789'); grd.addColorStop(1, '#6d634f');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, w * 0.36, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,35,25,.5)'; g.lineWidth = 2;
      for (let r = 30; r < w * 0.36; r += 26) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
      // الظل: المسلّة طولها 30 بكسل في الصورة
      const a = (p.azimuth * Math.PI) / 180, L = p.length * 30;
      const dx = Math.sin(a), dy = -Math.cos(a);
      g.fillStyle = 'rgba(12,10,6,.78)';
      g.beginPath();
      g.moveTo(cx - dy * 7, cy + dx * 7);
      g.lineTo(cx + dx * L - dy * 3, cy + dy * L + dx * 3);
      g.lineTo(cx + dx * L + dy * 3, cy + dy * L - dx * 3);
      g.lineTo(cx + dy * 7, cy - dx * 7);
      g.closePath(); g.fill();
      g.fillStyle = '#f0e6cf'; g.fillRect(cx - 7, cy - 7, 14, 14);
      g.strokeStyle = '#2a261c'; g.lineWidth = 2; g.strokeRect(cx - 7, cy - 7, 14, 14);
      // بوصلة: الشمال إلى الأعلى دائمًا
      const bx = w - 46, by = 50;
      g.strokeStyle = '#f2ead6'; g.fillStyle = '#f2ead6'; g.lineWidth = 2;
      g.beginPath(); g.arc(bx, by, 20, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(bx, by - 18); g.lineTo(bx - 6, by); g.lineTo(bx + 6, by); g.closePath(); g.fill();
      arabicText(g, 'ش', bx, by - 32, 16, '#f2ead6', { weight: 700 });
      arabicText(g, 'شرق', bx + 34, by + 1, 11, '#f2ead6');
      arabicText(g, 'غرب', bx - 34, by + 1, 11, '#f2ead6');
      // الوقت المكتوب (مضلِّل)
      g.save(); g.translate(40, h - 28); g.rotate(-0.06);
      g.fillStyle = '#9b1f1f'; g.font = '700 26px "Courier New", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(p.shownTime, 0, 0); g.restore();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.font = '14px "Courier New", monospace'; g.textAlign = 'right';
      g.fillText('ساحة المسلّة', w - 20, h - 26);
    };
  }
  function photoBack(id) {
    return (g, w, h) => {
      g.fillStyle = '#e4dccb'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(80,70,50,.25)'; g.lineWidth = 1;
      for (let y = 30; y < h; y += 22) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
      drawGlyph(g, ZS.PHOTOS[id].back, w / 2 - 60, h / 2 - 70, 120, '#1a1a17', 1.5);
      g.save(); g.translate(w - 40, h - 30); g.rotate(-0.05);
      g.fillStyle = '#3d1f5e'; g.font = 'italic 22px Georgia, serif'; g.textAlign = 'right';
      g.fillText('—٠', 0, 0); g.restore();
    };
  }
  W.photoFront = photoFront; W.photoBack = photoBack;

  function clockFaceDraw(forward) {
    return (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      const grd = g.createRadialGradient(cx, cy, 20, cx, cy, w / 2);
      grd.addColorStop(0, '#1d2421'); grd.addColorStop(1, '#070908');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9a253'; g.lineWidth = 4;
      g.beginPath(); g.arc(cx, cy, w * 0.47, 0, 7); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, w * 0.37, 0, 7); g.stroke();
      const nums = ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١'];
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r1 = w * 0.44, r2 = i % 5 === 0 ? w * 0.4 : w * 0.425;
        g.strokeStyle = i % 5 === 0 ? '#e8d4a0' : 'rgba(232,212,160,.5)'; g.lineWidth = i % 5 === 0 ? 4 : 1.5;
        g.beginPath(); g.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.lineTo(cx + Math.sin(a) * r2, cy - Math.cos(a) * r2); g.stroke();
      }
      nums.forEach((n, i) => {
        // قبل الإصلاح تُرقَّم الساعة عكس عقاربها
        const a = ((forward ? i : (12 - i) % 12) / 12) * Math.PI * 2;
        arabicText(g, n, cx + Math.sin(a) * w * 0.32, cy - Math.cos(a) * w * 0.32, 44, '#e8d4a0', { weight: 700, font: '"Reem Kufi", "IBM Plex Sans Arabic", sans-serif' });
      });
      arabicText(g, forward ? 'الزمن يسير' : 'الزمن يرتد', cx, cy + w * 0.16, 22, forward ? '#b46bff' : '#c9a253', { glow: 8 });
    };
  }

  function buildRoom1(group) {
    shell(group, 1, { keyX: 0, keyZ: 2, keyTZ: -6 });
    // الساعة الكبرى
    const clockG = new T.Group(); clockG.position.set(0, 3.25, -6.75); group.add(clockG);
    const goldMat = std(C.gold, { metalness: 0.95, roughness: 0.28 });
    mesh(new T.TorusGeometry(2.05, 0.16, 16, 96), goldMat, clockG);
    mesh(new T.TorusGeometry(2.3, 0.05, 8, 96), std(C.goldDeep, { metalness: 0.9, roughness: 0.35 }), clockG, 0, 0, -0.05);
    const faceTex = canvasTex(1024, 1024, clockFaceDraw(false));
    const face = mesh(new T.CircleGeometry(1.98, 96), std(0xffffff, { map: faceTex, metalness: 0.3, roughness: 0.55 }), clockG, 0, 0, -0.02, false);
    const handMat = std(0xe8d4a0, { metalness: 0.9, roughness: 0.25, emissive: 0x332611, emissiveIntensity: 0.4 });
    const hourP = new T.Group(); clockG.add(hourP); mesh(new T.BoxGeometry(0.1, 1.1, 0.04), handMat, hourP, 0, 0.45, 0.06);
    const minP = new T.Group(); clockG.add(minP); mesh(new T.BoxGeometry(0.06, 1.6, 0.04), handMat, minP, 0, 0.7, 0.1);
    mesh(new T.CylinderGeometry(0.1, 0.1, 0.12, 24).rotateX(Math.PI / 2), goldMat, clockG, 0, 0, 0.12);
    // تروس خلف الساعة
    const gearMat = std(C.goldDeep, { metalness: 0.9, roughness: 0.4 });
    const gears = [[-2.9, 1.3, 0.9, 18, 1], [2.85, -1.1, 1.1, 22, -1], [-2.4, -1.6, 0.55, 12, -1], [3.1, 1.5, 0.5, 10, 1]].map(([x, y, r, t, d]) => {
      const gg = gear(t, r, 0.18, gearMat); gg.position.set(x, y, -0.15); clockG.add(gg); gg.userData.dir = d / r; return gg;
    });
    W.dyn.clock = { hourP, minP, faceTex, forward: false, gears, speed: 1, engaged: 0 };
    anims.push((dt, t) => {
      const s = W.dyn.clock;
      const dir = s.forward ? -1 : 1; // دوران موجب حول z عكس عقارب الساعة
      minP.rotation.z += dir * dt * 0.9 * s.speed;
      hourP.rotation.z += dir * dt * 0.075 * s.speed;
      gears.forEach((gg, i) => { gg.rotation.z += gg.userData.dir * dt * 0.35 * dir * (i < s.engaged || s.forward ? 1.6 : 0.5); });
    });
    hotspot(1, 'clock', 'الساعة الكبرى', [face, clockG.children[0]], { pos: new T.Vector3(0, 3, -2.2), look: new T.Vector3(0, 3.2, -6.8) });

    // سكة الصور تحت الساعة
    const rail = new T.Group(); rail.position.set(0, 0.95, -6.55); group.add(rail);
    mesh(new T.BoxGeometry(5.6, 0.12, 0.3), goldMat, rail, 0, -0.45, 0);
    mesh(new T.BoxGeometry(5.8, 0.06, 0.06), glow(C.gold, 0.6), rail, 0, -0.38, 0.16, false);
    const slotTex = [];
    for (let i = 0; i < 5; i++) {
      const x = -2.2 + i * 1.1;
      mesh(new T.BoxGeometry(0.86, 0.66, 0.06), std(0x241d12, { metalness: 0.8 }), rail, x, 0, 0);
      const tex = canvasTex(256, 200, (g, w, h) => { g.fillStyle = '#0a0b0a'; g.fillRect(0, 0, w, h); arabicText(g, String(i + 1).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]), w / 2, h / 2, 60, 'rgba(201,162,83,.35)'); });
      mesh(new T.PlaneGeometry(0.76, 0.56), new T.MeshBasicMaterial({ map: tex }), rail, x, 0, 0.035, false);
      slotTex.push(tex);
    }
    W.dyn.rail = { slotTex };
    hotspot(1, 'rail', 'سكة الصور', rail.children.filter((m) => m.isMesh), { pos: new T.Vector3(0, 1.6, -3.2), look: new T.Vector3(0, 0.9, -6.6) });

    // الصور على الجدران
    const spots = {
      left1: { p: [-6.88, 2.1, -1.8], r: Math.PI / 2 }, left2: { p: [-6.88, 2.4, -4.6], r: Math.PI / 2 },
      right1: { p: [6.88, 2.3, -4.7], r: -Math.PI / 2 }, right2: { p: [6.88, 1.9, -3.1], r: -Math.PI / 2 },
      floor: { p: [2.6, 0.03, -1.4], floor: true },
    };
    const keys = ['left1', 'left2', 'right1', 'right2', 'floor'];
    ZS.WALL_ORDER.forEach((pid, i) => {
      const s = spots[keys[i]];
      const pg = new T.Group(); pg.position.set(...s.p);
      if (s.floor) { pg.rotation.x = -Math.PI / 2; pg.rotation.z = 0.5; } else pg.rotation.y = s.r;
      group.add(pg);
      mesh(new T.BoxGeometry(1.0, 1.16, 0.05), std(0x2a2117, { metalness: 0.6 }), pg, 0, 0, -0.02);
      const tex = canvasTex(320, 370, photoFront(pid));
      mesh(new T.PlaneGeometry(0.9, 1.04), std(0xffffff, { map: tex, metalness: 0, roughness: 0.8 }), pg, 0, 0, 0.01, false);
      const look = new T.Vector3(...s.p);
      const pos = s.floor ? new T.Vector3(s.p[0] - 0.4, 2.2, s.p[2] + 1.6) : new T.Vector3(s.p[0] * 0.55, 2.0, s.p[2] + 0.4);
      hotspot(1, 'photo' + pid, s.floor ? 'صورة ملقاة على الأرض' : 'صورة قديمة', pg, { pos, look });
      W.dyn['photo' + pid] = pg;
    });

    // مكتب وشاشة قديمة
    const desk = new T.Group(); desk.position.set(-4.2, 0, -5.4); group.add(desk);
    const deskMat = std(0x1d1a16, { metalness: 0.4, roughness: 0.6 });
    mesh(new T.BoxGeometry(2.4, 0.08, 1.1), deskMat, desk, 0, 0.92, 0);
    [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.07, 0.9, 0.07), deskMat, desk, x, 0.45, z));
    mesh(new T.BoxGeometry(0.9, 0.72, 0.7), std(0x2b2e2a, { metalness: 0.3, roughness: 0.7 }), desk, 0.2, 1.32, -0.05);
    const crtTex = canvasTex(512, 384, (g, w, h) => {
      g.fillStyle = '#14061f'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 2); }
      arabicText(g, 'أنت لم تدخل هذه الغرفة\nللمرة الأولى.', w / 2, h / 2 - 10, 40, '#c99bff', { glow: 14, weight: 700 });
      arabicText(g, 'الدورة ٧', w / 2, h - 40, 22, 'rgba(201,155,255,.55)');
    });
    const crt = mesh(new T.PlaneGeometry(0.7, 0.52), new T.MeshBasicMaterial({ map: crtTex, toneMapped: false }), desk, 0.2, 1.34, 0.31, false);
    hotspot(1, 'crt', 'شاشة قديمة', [crt, desk.children[desk.children.length - 2]], { pos: new T.Vector3(-3.4, 1.6, -3.6), look: new T.Vector3(-4, 1.34, -5.1) });

    // خدوش على الجدار
    const scratchTex = canvasTex(256, 160, (g, w, h) => {
      g.strokeStyle = 'rgba(220,210,190,.7)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(40 + i * 26, 30); g.lineTo(44 + i * 26, 120); g.stroke(); }
      g.beginPath(); g.moveTo(26, 110); g.lineTo(150, 40); g.stroke();
      g.beginPath(); g.moveTo(190, 32); g.lineTo(193, 122); g.stroke();
    });
    const scratches = mesh(new T.PlaneGeometry(0.8, 0.5), new T.MeshBasicMaterial({ map: scratchTex, transparent: true, color: 0xb8b0a0 }), group, -6.94, 1.1, 1.6, false);
    scratches.rotation.y = Math.PI / 2;
    const scratchHit = mesh(new T.BoxGeometry(0.05, 0.6, 0.9), std(0x222222, { transparent: true, opacity: 0 }), group, -6.93, 1.1, 1.6, false);
    hotspot(1, 'scratches', 'خدوش على الجدار', scratchHit, { pos: new T.Vector3(-4.6, 1.4, 1.6), look: new T.Vector3(-6.9, 1.1, 1.6) });

    // صندوق زجاجي تحت الساعة ينفتح بعد إصلاحها
    const vitrine = new T.Group(); vitrine.position.set(3.6, 0, -5.6); group.add(vitrine);
    mesh(new T.CylinderGeometry(0.45, 0.55, 1.1, 8), std(0x1b1a17, { metalness: 0.8 }), vitrine, 0, 0.55, 0);
    const glass = mesh(new T.CylinderGeometry(0.38, 0.38, 0.7, 24, 1, true), std(0xe2c7ff, { transparent: true, opacity: 0.18, metalness: 1, roughness: 0.05, side: T.DoubleSide }), vitrine, 0, 1.45, 0, false);
    const crystal = mesh(new T.OctahedronGeometry(0.17, 0), std(C.violet, { emissive: C.violet, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.1 }), vitrine, 0, 1.42, 0);
    crystal.scale.y = 1.6;
    mesh(new T.CylinderGeometry(0.4, 0.4, 0.05, 24), goldMat, vitrine, 0, 1.82, 0);
    W.dyn.vitrine = { glass, crystal, open: 0, target: 0 };
    anims.push((dt, t) => {
      const v = W.dyn.vitrine;
      v.open += (v.target - v.open) * Math.min(1, dt * 2);
      glass.position.y = 1.45 + v.open * 0.75; glass.material.opacity = 0.18 * (1 - v.open * 0.6);
      crystal.rotation.y = t * 0.8; crystal.position.y = 1.42 + Math.sin(t * 2) * 0.03;
    });
    hotspot(1, 'vitrine', 'صندوق زجاجي مختوم', [vitrine.children[0], glass, crystal], { pos: new T.Vector3(2.4, 1.8, -3.4), look: new T.Vector3(3.6, 1.3, -5.6) });

    door(group, 1, 'right', 2, 'باب القطاع ٠٢');
  }

  // ===== الغرفة 2: مختبر الضوء =====
  const TABLE = { x: 0, y: 1.0, z: -3.6, cell: 0.46 };
  function gridToWorld(gx, gy) {
    const g = ZS.LASER_GRID, cols = g[0].length, rows = g.length;
    return new T.Vector3((gx - (cols - 1) / 2) * TABLE.cell, 0, (gy - (rows - 1) / 2) * TABLE.cell);
  }
  function buildRoom2(group) {
    shell(group, 2, { keyX: -1, keyZ: 1, keyTZ: -3.6 });
    const table = new T.Group(); table.position.set(TABLE.x, TABLE.y, TABLE.z); group.add(table);
    const grid = ZS.LASER_GRID, cols = grid[0].length, rows = grid.length;
    const tw = cols * TABLE.cell + 0.4, td = rows * TABLE.cell + 0.4;
    const top = mesh(new T.BoxGeometry(tw, 0.1, td), std(0x111513, { metalness: 0.85, roughness: 0.25 }), table, 0, -0.05, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => mesh(new T.CylinderGeometry(0.06, 0.08, 1, 10), std(C.steel, { metalness: 0.9 }), table, sx * (tw / 2 - 0.2), -0.55, sz * (td / 2 - 0.2)));
    const holeTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#0d0b11'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#020303';
      for (let x = 16; x < w; x += 32) for (let y = 16; y < h; y += 32) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    });
    holeTex.wrapS = holeTex.wrapT = T.RepeatWrapping; holeTex.repeat.set(cols / 2, rows / 2);
    mesh(new T.PlaneGeometry(tw - 0.1, td - 0.1).rotateX(-Math.PI / 2), std(0xffffff, { map: holeTex, metalness: 0.7, roughness: 0.4 }), table, 0, 0.002, 0, false);

    const mirrorMeshes = {};
    const receivers = {};
    let crystalMesh = null;
    const blockMat = std(0x1e2422, { metalness: 0.8, roughness: 0.4 });
    grid.forEach((row, y) => [...row].forEach((ch, x) => {
      const p = gridToWorld(x, y);
      const onEdge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      if (ch === '#') { if (!onEdge || Math.random() < 0.5) mesh(new T.BoxGeometry(TABLE.cell * 0.8, 0.16, TABLE.cell * 0.8), blockMat, table, p.x, 0.08, p.z); return; }
      if (ch === 'E') {
        const e = mesh(new T.CylinderGeometry(0.11, 0.13, 0.4, 20).rotateZ(Math.PI / 2), std(C.steel, { metalness: 0.95, roughness: 0.2 }), table, p.x, 0.16, p.z);
        mesh(new T.CircleGeometry(0.08, 20).rotateY(Math.PI / 2), glow(0xffffff, 3), e, 0.205, 0, 0, false);
      }
      if (ch === 'S') {
        const s = mesh(new T.BoxGeometry(0.04, 0.26, TABLE.cell * 0.9), std(0xcff7ff, { transparent: true, opacity: 0.45, metalness: 1, roughness: 0.05 }), table, p.x, 0.15, p.z);
        s.rotation.y = Math.PI / 4;
        mesh(new T.CylinderGeometry(0.12, 0.14, 0.04, 16), std(C.gold, { metalness: 0.9 }), table, p.x, 0.02, p.z);
      }
      if (ch === 'y') mesh(new T.BoxGeometry(0.06, 0.24, TABLE.cell * 0.8), std(0xffc040, { transparent: true, opacity: 0.6, emissive: 0x8a5a10, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 }), table, p.x, 0.14, p.z);
      if (ch === 'C') {
        mesh(new T.TorusGeometry(0.13, 0.03, 8, 24).rotateX(Math.PI / 2), std(C.gold, { metalness: 0.95, roughness: 0.25 }), table, p.x, 0.06, p.z);
        crystalMesh = mesh(new T.OctahedronGeometry(0.11, 0), std(C.violet, { emissive: C.violet, emissiveIntensity: 1.1, roughness: 0.1 }), table, p.x, 0.22, p.z);
        crystalMesh.scale.y = 1.5; crystalMesh.visible = false;
      }
      if (ch === 'm') {
        const piv = new T.Group(); piv.position.set(p.x, 0, p.z); table.add(piv);
        mesh(new T.CylinderGeometry(0.15, 0.17, 0.05, 20), std(C.gold, { metalness: 0.9, roughness: 0.3 }), piv, 0, 0.025, 0);
        mesh(new T.BoxGeometry(0.035, 0.26, TABLE.cell * 0.85), std(0xe9fff8, { metalness: 1, roughness: 0.02, emissive: 0x2e1450, emissiveIntensity: 0.5 }), piv, 0, 0.17, 0);
        mirrorMeshes[x + ',' + y] = piv;
      }
      if (ch in ZS.RECEIVERS) {
        const col = { green: C.violet, gold: 0xffc040, white: 0xffffff }[ZS.RECEIVERS[ch]];
        const r = new T.Group(); r.position.set(p.x, 0.18, p.z); table.add(r);
        mesh(new T.CylinderGeometry(0.16, 0.18, 0.34, 20), std(0x1b201e, { metalness: 0.9 }), r, 0, 0, 0);
        const lens = mesh(new T.SphereGeometry(0.1, 20, 14), new T.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 0.15 }), r, 0, 0.2, 0);
        receivers[x + ',' + y] = { lens, col };
      }
    }));
    const beams = new T.Group(); table.add(beams);
    W.dyn.laser = { mirrorMeshes, receivers, crystalMesh, beams };
    hotspot(2, 'laser', 'طاولة البصريات', [top], { pos: new T.Vector3(0, 3.4, -0.6), look: new T.Vector3(0, 1, -3.7) });

    // مصدر الطاقة المخفي خلف لوح في الجدار الخلفي
    const vault = new T.Group(); vault.position.set(0, 2.9, -6.85); group.add(vault);
    mesh(new T.BoxGeometry(1.8, 1.8, 0.2), std(0x0f1312, { metalness: 0.8 }), vault, 0, 0, -0.05);
    const coreLight = mesh(new T.SphereGeometry(0.32, 32, 20), glow(0xffd27a, 2.4), vault, 0, 0, 0.1);
    const cage = mesh(new T.IcosahedronGeometry(0.5, 1), std(C.gold, { wireframe: true, metalness: 1 }), vault, 0, 0, 0.1, false);
    const panelL = mesh(new T.BoxGeometry(0.9, 1.8, 0.1), std(0x232a27, { metalness: 0.85, roughness: 0.3 }), vault, -0.45, 0, 0.22);
    const panelR = mesh(new T.BoxGeometry(0.9, 1.8, 0.1), std(0x232a27, { metalness: 0.85, roughness: 0.3 }), vault, 0.45, 0, 0.22);
    W.dyn.lightVault = { panelL, panelR, coreLight, cage, open: 0, target: 0 };
    anims.push((dt, t) => {
      const v = W.dyn.lightVault;
      v.open += (v.target - v.open) * Math.min(1, dt * 1.6);
      panelL.position.x = -0.45 - v.open * 0.9; panelR.position.x = 0.45 + v.open * 0.9;
      cage.rotation.y = t * 0.5; cage.rotation.x = t * 0.3;
      coreLight.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.6;
    });
    hotspot(2, 'lightVault', 'لوح معدني مغلق', [panelL, panelR, coreLight], { pos: new T.Vector3(0, 2.6, -3.4), look: new T.Vector3(0, 2.9, -6.8) });

    // مكتب جانبي عليه محور
    const desk = new T.Group(); desk.position.set(-5.2, 0, -4.2); group.add(desk);
    const deskMat = std(0x1a1f1d, { metalness: 0.6 });
    mesh(new T.BoxGeometry(1.4, 0.06, 2.4), deskMat, desk, 0, 0.9, 0);
    mesh(new T.BoxGeometry(1.3, 0.86, 0.06), deskMat, desk, 0, 0.45, -1.1);
    mesh(new T.BoxGeometry(1.3, 0.86, 0.06), deskMat, desk, 0, 0.45, 1.1);
    const axle = mesh(new T.CylinderGeometry(0.04, 0.04, 0.7, 12).rotateZ(Math.PI / 2), std(0xcfd6d3, { metalness: 1, roughness: 0.2 }), desk, 0.1, 0.97, 0.4);
    axle.rotation.y = 0.6;
    W.dyn.axle = axle;
    hotspot(2, 'axle', 'محور فولاذي', axle, { pos: new T.Vector3(-3.6, 1.9, -3.2), look: new T.Vector3(-5.1, 0.95, -3.8) });
    // دفاتر وأدوات للزينة
    for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(0.3, 0.04, 0.42), std([0x3a2a1a, 0x1a2a3a, 0x2a1a1a, 0x22301f][i], { metalness: 0.1, roughness: 0.9 }), desk, -0.3, 0.95 + i * 0.04, -0.6 + (i % 2) * 0.05);

    // سبورة الملاحظات
    const boardTex = canvasTex(1024, 640, (g, w, h) => {
      g.fillStyle = '#101614'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(232,224,204,.08)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); }
      arabicText(g, 'قوانين البلورات', w / 2, 70, 46, '#e8e0cc', { weight: 700 });
      arabicText(g, '١. الضوء الأبيض يأخذ لون الزجاج الذي يعبره.\n٢. الزجاج يمرّر لونه فقط، ويبتلع أي لون آخر.\n٣. المقسِّم يمرّر نصف الشعاع ويعكس نصفه.\n٤. المقبس الفارغ يحجب كل شيء.', w - 60, 300, 34, '#cfe9df', { align: 'right' });
      arabicText(g, 'البلورة نُقلت إلى غرفة الساعة بعد الحادث. —٠', w / 2, h - 70, 28, '#c9a253');
    });
    const board = mesh(new T.PlaneGeometry(3.2, 2), new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9, metalness: 0, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.25 }), group, -6.88, 2.6, 1.6, false);
    board.rotation.y = Math.PI / 2;
    hotspot(2, 'board2', 'سبورة الملاحظات', board, { pos: new T.Vector3(-3.6, 2.4, 1.6), look: new T.Vector3(-6.9, 2.6, 1.6) });

    // بلورات معلقة للزينة
    for (let i = 0; i < 6; i++) {
      const cr = mesh(new T.OctahedronGeometry(0.12 + Math.random() * 0.1, 0), std(C.violet, { emissive: C.violetDeep, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.1 }), group, 3 + Math.random() * 3, 3.4 + Math.random() * 1.8, -5 + Math.random() * 4);
      cr.userData.ph = Math.random() * 6;
      anims.push((dt, t) => { cr.rotation.y += dt * 0.4; cr.position.y += Math.sin(t + cr.userData.ph) * dt * 0.05; });
    }
    door(group, 2, 'left', 1, 'العودة إلى غرفة الساعة');
    door(group, 2, 'right', 3, 'باب القطاع ٠٣');
  }

  const beamMat = {
    white: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    green: new T.MeshBasicMaterial({ color: 0xc08aff, toneMapped: false }),
    gold: new T.MeshBasicMaterial({ color: 0xffc85a, toneMapped: false }),
  };
  W.setLaser = (mirrors, crystal, trace) => {
    const L = W.dyn.laser;
    Object.entries(L.mirrorMeshes).forEach(([k, piv]) => { piv.userData.target = mirrors[k] === '/' ? Math.PI / 4 : -Math.PI / 4; });
    if (!L.anim) {
      L.anim = true;
      anims.push((dt) => Object.values(L.mirrorMeshes).forEach((piv) => { piv.rotation.y += ((piv.userData.target || 0) - piv.rotation.y) * Math.min(1, dt * 10); }));
    }
    L.crystalMesh.visible = !!crystal;
    while (L.beams.children.length) L.beams.remove(L.beams.children[0]);
    trace.segments.forEach((s) => {
      const a = gridToWorld(s.x1, s.y1), b = gridToWorld(s.x2, s.y2);
      if (s.stop) b.lerp(a, 0.55);
      const len = a.distanceTo(b);
      const m = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, len, 6), beamMat[s.color]);
      m.position.copy(a).lerp(b, 0.5); m.position.y = 0.17;
      m.lookAt(b.x, 0.17, b.z); // قبل إضافته للمجموعة: الإحداثيات كلها محلية للطاولة
      m.rotateX(Math.PI / 2);
      L.beams.add(m);
    });
    Object.entries(trace.receivers).forEach(([k, r]) => { L.receivers[k].lens.material.emissiveIntensity = r.ok ? 3 : r.got.length ? 0.6 : 0.12; });
  };

  // ===== الغرفة 3: أرشيف الذاكرة =====
  function buildRoom3(group) {
    shell(group, 3, { wall: '#16130e', keyX: -2, keyZ: 2, keyTZ: -4 });
    // رفوف ملفات على الجدار الخلفي
    const shelfMat = std(0x2a2318, { metalness: 0.5, roughness: 0.6 });
    const boxGeo = new T.BoxGeometry(0.34, 0.42, 0.5);
    const boxes = new T.InstancedMesh(boxGeo, std(0xb59b6a, { metalness: 0.05, roughness: 0.95 }), 160);
    let bi = 0;
    const dummy = new T.Object3D();
    const colors = [0xb59b6a, 0x8f7a52, 0xc8b285, 0x6e5d3f];
    for (let row = 0; row < 5; row++) {
      mesh(new T.BoxGeometry(9.6, 0.06, 0.7), shelfMat, group, 0, 0.5 + row * 1.0, -6.55);
      for (let i = 0; i < 26 && bi < 160; i++) {
        if (Math.random() < 0.15) continue;
        dummy.position.set(-4.6 + i * 0.36, 0.74 + row * 1.0, -6.5 + Math.random() * 0.08);
        dummy.rotation.set(0, (Math.random() - 0.5) * 0.12, Math.random() < 0.08 ? 0.3 : 0);
        dummy.updateMatrix(); boxes.setMatrixAt(bi, dummy.matrix);
        boxes.setColorAt(bi, new T.Color(colors[bi % 4])); bi++;
      }
    }
    boxes.count = bi; boxes.castShadow = true; boxes.receiveShadow = true;
    group.add(boxes);

    // اللوحة الهولوغرافية للخط الزمني
    const holo = new T.Group(); holo.position.set(-2.2, 1.9, -3.6); holo.rotation.y = 0.35; group.add(holo);
    mesh(new T.CylinderGeometry(0.5, 0.6, 0.9, 6), std(0x1a1712, { metalness: 0.85 }), holo, 0, -1.45, 0);
    mesh(new T.CylinderGeometry(0.45, 0.45, 0.04, 32), glow(0xe0a24a, 1.4), holo, 0, -0.98, 0, false);
    const holoTex = canvasTex(1024, 560, (g, w, h) => {
      g.fillStyle = 'rgba(255,190,90,.06)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,200,110,.7)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
      g.beginPath(); g.moveTo(60, h / 2); g.lineTo(w - 60, h / 2); g.stroke();
      for (let i = 0; i < 5; i++) { const x = 120 + i * ((w - 240) / 4); g.beginPath(); g.arc(x, h / 2, 16, 0, 7); g.stroke(); }
      arabicText(g, 'الخط الزمني للحوادث', w / 2, 70, 44, '#ffd08a', { glow: 10 });
      arabicText(g, '؟  ؟  ؟  ؟  ؟', w / 2, h / 2 + 90, 40, 'rgba(255,208,138,.7)');
    });
    const holoPlane = mesh(new T.PlaneGeometry(2.4, 1.3), new T.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.9, side: T.DoubleSide, toneMapped: false, depthWrite: false }), holo, 0, 0, 0, false);
    W.dyn.holo = { holoTex, holoPlane };
    anims.push((dt, t) => { holoPlane.material.opacity = 0.75 + Math.sin(t * 7) * 0.05 + (Math.random() < 0.01 ? -0.4 : 0); });
    hotspot(3, 'timeline', 'لوحة الخط الزمني', [holoPlane, holo.children[0]], { pos: new T.Vector3(-1.2, 2.0, -0.6), look: new T.Vector3(-2.2, 1.9, -3.6) });

    // باب الخزنة على الجدار الأيمن
    const vault = new T.Group(); vault.position.set(6.85, 2.0, -4.2); vault.rotation.y = -Math.PI / 2; group.add(vault);
    const vMat = std(0x3a3226, { metalness: 0.95, roughness: 0.3 });
    mesh(new T.CylinderGeometry(1.4, 1.4, 0.2, 48).rotateX(Math.PI / 2), std(0x171410, { metalness: 0.9 }), vault, 0, 0, -0.05);
    const vdoor = new T.Group(); vault.add(vdoor);
    mesh(new T.CylinderGeometry(1.22, 1.22, 0.24, 48).rotateX(Math.PI / 2), vMat, vdoor, 0, 0, 0.1);
    const wheel = mesh(new T.TorusGeometry(0.45, 0.05, 10, 32), std(C.gold, { metalness: 1, roughness: 0.25 }), vdoor, 0, 0, 0.28);
    for (let i = 0; i < 3; i++) { const sp = mesh(new T.BoxGeometry(0.9, 0.05, 0.05), std(C.gold, { metalness: 1 }), wheel, 0, 0, 0); sp.rotation.z = (i * Math.PI) / 3; }
    const keypad = mesh(new T.BoxGeometry(0.5, 0.7, 0.08), std(0x0e0f0d, { metalness: 0.7, emissive: 0x3a2508, emissiveIntensity: 0.6 }), vault, 1.75, 0, 0.05);
    const gearInside = gear(14, 0.28, 0.08, std(0xc77a3a, { metalness: 0.95, roughness: 0.3 }));
    gearInside.position.set(0, 0, -0.02); vault.add(gearInside);
    W.dyn.archiveVault = { vdoor, wheel, gearInside, open: 0, target: 0 };
    anims.push((dt) => {
      const v = W.dyn.archiveVault;
      v.open += (v.target - v.open) * Math.min(1, dt * 1.2);
      wheel.rotation.z = v.open * Math.PI * 2;
      vdoor.position.x = -v.open * 1.6; vdoor.position.z = v.open * 0.4;
      gearInside.rotation.z += dt * 0.6 * v.open;
    });
    hotspot(3, 'vault', 'خزنة الأرشيف', [keypad, vdoor.children[0], wheel], { pos: new T.Vector3(3.6, 2.0, -4.2), look: new T.Vector3(6.8, 2.0, -4.2) });

    // مصادر البطاقات الست
    const deskMat = std(0x2b241a, { metalness: 0.3, roughness: 0.7 });
    const desk = new T.Group(); desk.position.set(1.6, 0, -4.6); group.add(desk);
    mesh(new T.BoxGeometry(2.6, 0.08, 1.2), deskMat, desk, 0, 0.92, 0);
    mesh(new T.BoxGeometry(2.5, 0.85, 0.06), deskMat, desk, 0, 0.45, -0.55);
    // جهاز تسجيل
    const rec = new T.Group(); rec.position.set(0.7, 0.96, 0.1); desk.add(rec);
    mesh(new T.BoxGeometry(0.6, 0.18, 0.4), std(0x2a2a26, { metalness: 0.6 }), rec, 0, 0.09, 0);
    const reelA = mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 20), std(0x111111), rec, -0.14, 0.2, 0);
    const reelB = mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 20), std(0x111111), rec, 0.14, 0.2, 0);
    anims.push((dt) => { reelA.rotation.y += dt * 1.2; reelB.rotation.y += dt * 1.2; });
    hotspot(3, 'card_audio', 'جهاز تسجيل', rec, { pos: new T.Vector3(2.0, 1.9, -2.8), look: new T.Vector3(2.3, 1.0, -4.5) });
    // مذكرة على المكتب
    const memoTex = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#ede4cf'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.5)'; for (let y = 40; y < h - 30; y += 18) g.fillRect(24, y, 150 + Math.random() * 60, 3); g.fillStyle = '#9b1f1f'; g.beginPath(); g.arc(w - 50, h - 50, 26, 0, 7); g.fill(); });
    const memo = mesh(new T.PlaneGeometry(0.36, 0.46).rotateX(-Math.PI / 2), std(0xffffff, { map: memoTex, metalness: 0, roughness: 0.9 }), desk, -0.5, 0.965, 0.15, false);
    memo.rotation.y = 0.3;
    hotspot(3, 'card_memo', 'مذكرة مختومة', memo, { pos: new T.Vector3(1.0, 2.0, -3.0), look: new T.Vector3(1.1, 0.96, -4.45) });
    // خزانة ملفات
    const cab = new T.Group(); cab.position.set(-5.6, 0, -5.4); group.add(cab);
    mesh(new T.BoxGeometry(0.9, 1.6, 0.8), std(0x39413c, { metalness: 0.75, roughness: 0.35 }), cab, 0, 0.8, 0);
    const drawer = mesh(new T.BoxGeometry(0.8, 0.4, 0.06), std(0x4a544e, { metalness: 0.8, roughness: 0.3 }), cab, 0, 1.25, 0.42);
    hotspot(3, 'card_maintenance', 'خزانة ملفات', [cab.children[0], drawer], { pos: new T.Vector3(-4.2, 1.8, -3.2), look: new T.Vector3(-5.6, 1.1, -5.4) });
    // صورة مؤطرة على الجدار الأيسر
    const phTex = canvasTex(400, 300, (g, w, h) => {
      g.fillStyle = '#1a1a18'; g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#5d5a4e'); grd.addColorStop(1, '#2a2924');
      g.fillStyle = grd; g.fillRect(12, 12, w - 24, h - 24);
      g.fillStyle = 'rgba(255,248,220,.9)'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 58, 30, 22, 8);
      g.fillStyle = '#9aa7ad'; g.fillRect(140, 70, 120, 170);
      g.fillStyle = '#26241f'; for (let i = 0; i < 3; i++) g.fillRect(100 + i * 90, 170, 26, 90);
    });
    const ph = mesh(new T.PlaneGeometry(1.3, 0.98), std(0xffffff, { map: phTex, metalness: 0, roughness: 0.8 }), group, -6.88, 2.2, -2.2, false);
    ph.rotation.y = Math.PI / 2;
    mesh(new T.BoxGeometry(0.05, 1.1, 1.42), std(C.goldDeep, { metalness: 0.9 }), group, -6.92, 2.2, -2.2);
    hotspot(3, 'card_photo', 'صورة مؤطرة', ph, { pos: new T.Vector3(-4.4, 2.1, -2.2), look: new T.Vector3(-6.9, 2.2, -2.2) });
    // ملصق رسمي على الجدار الأيمن
    const posterTex = canvasTex(320, 440, (g, w, h) => {
      g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#4b2a86'; g.fillRect(0, 0, w, 70);
      arabicText(g, 'بيان رسمي', w / 2, 36, 30, '#ffffff', { weight: 700 });
      g.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 110; y < h - 80; y += 22) g.fillRect(30, y, w - 60 - Math.random() * 60, 4);
      g.strokeStyle = '#4b2a86'; g.lineWidth = 4; g.beginPath(); g.arc(w - 70, h - 60, 32, 0, 7); g.stroke();
    });
    const poster = mesh(new T.PlaneGeometry(0.9, 1.24), std(0xffffff, { map: posterTex, metalness: 0, roughness: 0.85 }), group, 6.88, 2.3, -0.4, false);
    poster.rotation.y = -Math.PI / 2;
    hotspot(3, 'card_statement', 'ملصق رسمي', poster, { pos: new T.Vector3(4.6, 2.2, -0.4), look: new T.Vector3(6.9, 2.3, -0.4) });
    // ملف ملقى على الأرض
    const file = mesh(new T.BoxGeometry(0.5, 0.04, 0.66), std(0x8a2a1f, { metalness: 0.05, roughness: 0.9 }), group, 2.4, 0.03, -1.0);
    file.rotation.y = -0.7;
    const sheet = mesh(new T.PlaneGeometry(0.42, 0.56).rotateX(-Math.PI / 2), std(0xece4d0, { metalness: 0, roughness: 0.95 }), group, 2.75, 0.052, -0.75, false);
    sheet.rotation.y = -0.3;
    hotspot(3, 'card_incident', 'ملف ممزق على الأرض', [file, sheet], { pos: new T.Vector3(2.0, 2.0, 1.0), look: new T.Vector3(2.5, 0.05, -0.9) });

    door(group, 3, 'left', 2, 'العودة إلى مختبر الضوء');
    door(group, 3, 'right', 4, 'باب القطاع ٠٤');
    // نُقل باب القطاع ٤ إلى الأمام قليلًا ليبتعد عن الخزنة
    W.dyn['door3_4'].lL.parent.position.z = 1.4;
    W.hot['door3_4'].focus.pos.z = 1.4; W.hot['door3_4'].focus.look.z = 1.4;
  }
  W.setTimelineHolo = (labels, ok) => {
    redraw(W.dyn.holo.holoTex, (g, w, h) => {
      const col = ok ? '#d2b0ff' : '#ffd08a';
      g.fillStyle = ok ? 'rgba(60,255,180,.07)' : 'rgba(255,190,90,.06)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
      g.beginPath(); g.moveTo(60, h / 2); g.lineTo(w - 60, h / 2); g.stroke();
      arabicText(g, ok ? 'الخط الزمني متماسك' : 'الخط الزمني للحوادث', w / 2, 70, 44, col, { glow: 10 });
      for (let i = 0; i < 5; i++) {
        const x = w - 120 - i * ((w - 240) / 4);
        g.beginPath(); g.arc(x, h / 2, 16, 0, 7); g.stroke();
        arabicText(g, labels[i] || '؟', x, h / 2 + 80, labels[i] ? 22 : 40, col);
      }
    });
  };

  // ===== الغرفة 4: القلب الميكانيكي =====
  function buildRoom4(group) {
    shell(group, 4, { wall: '#17110d', keyX: 0, keyZ: 2, keyTZ: -5 });
    const brass = std(0xb8862f, { metalness: 0.95, roughness: 0.32 });
    const copper = std(0xa85a2c, { metalness: 0.95, roughness: 0.35 });
    const dark = std(0x2b2621, { metalness: 0.85, roughness: 0.4 });
    const big = [
      [-3.6, 3.6, 1.6, 24, brass, 1], [-1.15, 4.6, 0.95, 14, copper, -1], [3.4, 3.2, 1.8, 26, dark, -1],
      [1.0, 4.9, 0.75, 12, brass, 1], [-4.9, 1.4, 0.9, 14, copper, -1], [4.9, 0.9, 0.8, 12, brass, 1],
    ].map(([x, y, r, t, m, d]) => { const g = gear(t, r, 0.25, m); g.position.set(x, y, -6.7); group.add(g); g.userData.w = d / r; return g; });
    // القلب: قفص كروي ونواة
    const heart = new T.Group(); heart.position.set(0, 2.5, -5.2); group.add(heart);
    const ringA = mesh(new T.TorusGeometry(1.1, 0.06, 10, 64), brass, heart);
    const ringB = mesh(new T.TorusGeometry(0.95, 0.05, 10, 64), copper, heart); ringB.rotation.y = Math.PI / 2;
    const ringC = mesh(new T.TorusGeometry(0.8, 0.045, 10, 64), brass, heart); ringC.rotation.x = Math.PI / 2;
    const core = mesh(new T.IcosahedronGeometry(0.42, 2), std(0x3a0d08, { emissive: 0xff5a2a, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.4 }), heart);
    const coreLight = new T.PointLight(0xff6a30, 0.6, 6, 2); heart.add(coreLight);
    // مكابس
    const pistons = [];
    [-2.4, 2.4].forEach((x) => {
      mesh(new T.CylinderGeometry(0.26, 0.26, 2.2, 20), dark, group, x, 1.1, -5.6);
      const rod = mesh(new T.CylinderGeometry(0.1, 0.1, 2.4, 14), std(0xd8dcda, { metalness: 1, roughness: 0.15 }), group, x, 2.6, -5.6);
      pistons.push(rod);
    });
    W.dyn.heart = { big, heart, rings: [ringA, ringB, ringC], core, coreLight, pistons, mode: 'idle', dir: 0, open: 0, jam: 0 };
    anims.push((dt, t) => {
      const h = W.dyn.heart;
      const running = h.mode === 'running' || h.mode === 'open';
      const speed = running ? 1 : h.mode === 'jam' ? 0 : 0.08;
      big.forEach((g) => { g.rotation.z += g.userData.w * dt * speed * 0.8; });
      if (h.mode === 'jam') big.forEach((g) => { g.rotation.z += Math.sin(t * 60) * 0.004; });
      h.rings[0].rotation.z += dt * (running ? h.dir * 1.6 : 0.05);
      h.rings[1].rotation.x += dt * (running ? 1.2 : 0.04);
      h.rings[2].rotation.y += dt * (running ? 0.9 : 0.03);
      h.open += ((h.mode === 'open' ? 1 : 0) - h.open) * Math.min(1, dt * 1.5);
      h.rings.forEach((r, i) => r.scale.setScalar(1 + h.open * (0.4 + i * 0.2)));
      const beat = (Math.sin(t * (running ? 7 : 2.2)) + 1) / 2;
      h.core.material.emissiveIntensity = 0.3 + beat * (running ? 1.6 : 0.4) + h.open * 1.5;
      h.coreLight.intensity = 0.4 + beat * (running ? 1.4 : 0.3) + h.open * 2;
      h.pistons.forEach((p, i) => { p.position.y = 2.6 + (h.mode === 'locked' || !running ? 0 : Math.sin(t * 6 + i * Math.PI) * 0.35); });
    });
    hotspot(4, 'heartCore', 'القلب الميكانيكي', [core, ringA], { pos: new T.Vector3(0, 2.4, -2.2), look: new T.Vector3(0, 2.5, -5.2) });

    // وحدة التحكم
    const con = new T.Group(); con.position.set(0, 0, -1.6); group.add(con);
    mesh(new T.BoxGeometry(1.8, 1.0, 0.8), dark, con, 0, 0.5, 0);
    const panel = mesh(new T.BoxGeometry(1.7, 0.08, 0.7), std(0x14110e, { metalness: 0.6, emissive: 0x3a1a08, emissiveIntensity: 0.5 }), con, 0, 1.08, 0.05);
    panel.rotation.x = -0.5;
    const levers = [];
    for (let i = 0; i < 4; i++) {
      const lv = new T.Group(); lv.position.set(-0.6 + i * 0.4, 1.12, 0.05); con.add(lv);
      mesh(new T.CylinderGeometry(0.02, 0.02, 0.35, 8), std(0xd8dcda, { metalness: 1 }), lv, 0, 0.17, 0);
      mesh(new T.SphereGeometry(0.05, 12, 10), std(i === 3 ? C.red : C.gold, { metalness: 0.6, emissive: i === 3 ? 0x440000 : 0x221500 }), lv, 0, 0.35, 0);
      lv.rotation.x = -0.4; levers.push(lv);
    }
    W.dyn.heart.levers = levers;
    hotspot(4, 'machine', 'وحدة التحكم', [con.children[0], panel], { pos: new T.Vector3(0, 2.0, 0.6), look: new T.Vector3(0, 1.0, -1.7) });

    // لوحة نحاسية
    const plateTex = canvasTex(800, 400, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#8a6a2c'); grd.addColorStop(1, '#5a4218');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,20,5,.6)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      arabicText(g, 'القلب لا يستيقظ إلا مع عقارب الساعة.', w / 2, 140, 40, '#24180a', { weight: 700 });
      arabicText(g, 'كل ترس يعكس دوران جاره.\nلا تُشبك القابض والمكابس مقفلة.', w / 2, 270, 32, '#2e200c');
    });
    const plate = mesh(new T.PlaneGeometry(2.2, 1.1), std(0xffffff, { map: plateTex, metalness: 0.7, roughness: 0.35 }), group, -6.88, 2.2, -3.4, false);
    plate.rotation.y = Math.PI / 2;
    hotspot(4, 'plate', 'لوحة نحاسية محفورة', plate, { pos: new T.Vector3(-4.0, 2.2, -3.4), look: new T.Vector3(-6.9, 2.2, -3.4) });
    door(group, 4, 'left', 3, 'العودة إلى الأرشيف');
    door(group, 4, 'right', 5, 'باب القطاع ٠٥');
  }
  W.setHeart = (s) => {
    const h = W.dyn.heart;
    h.mode = s.solved ? 'open' : s.jammed ? 'jam' : s.clutch ? 'running' : s.pistons === 'locked' ? 'locked' : 'idle';
    h.dir = s.clutch && s.gear ? (s.idler ? -1 : 1) : 0; // دوران سالب حول z مع عقارب الساعة
    const lv = h.levers;
    lv[0].rotation.x = s.idler ? 0.4 : -0.4;
    lv[1].rotation.x = s.pistons === 'released' ? 0.4 : -0.4;
    lv[2].rotation.x = s.clutch ? 0.4 : -0.4;
    lv[3].rotation.x = s.jammed ? -0.4 : 0.4;
  };

  // ===== الغرفة 5: الغرفة المعكوسة =====
  function buildRoom5(group) {
    shell(group, 5, { wall: '#10141a', keyX: 3, keyZ: 3, keyTZ: -2, bareBack: true });
    // مرآة حقيقية على الجدار الخلفي
    let mirror;
    if (T.Reflector) {
      mirror = new T.Reflector(new T.PlaneGeometry(9.6, 4.6), { textureWidth: 1024, textureHeight: 512, color: 0x9aa7b0, clipBias: 0.003 });
    } else {
      mirror = new T.Mesh(new T.PlaneGeometry(9.6, 4.6), std(0x9aa7b0, { metalness: 1, roughness: 0.05 }));
    }
    mirror.position.set(0, 2.75, -6.84);
    group.add(mirror);
    const frame = std(0x8fa3b3, { metalness: 1, roughness: 0.2 });
    mesh(new T.BoxGeometry(10, 0.14, 0.16), frame, group, 0, 5.1, -6.8);
    mesh(new T.BoxGeometry(10, 0.14, 0.16), frame, group, 0, 0.4, -6.8);
    mesh(new T.BoxGeometry(0.14, 4.8, 0.16), frame, group, -4.93, 2.75, -6.8);
    mesh(new T.BoxGeometry(0.14, 4.8, 0.16), frame, group, 4.93, 2.75, -6.8);
    const mirrorHit = mesh(new T.PlaneGeometry(9.6, 4.6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), group, 0, 2.75, -6.8, false);
    hotspot(5, 'mirror', 'المرآة الكبرى', mirrorHit, { pos: new T.Vector3(-0.6, 1.9, -1.0), look: new T.Vector3(-2.4, 2.0, -6.8) });

    // أثاث مقلوب معلق بالسقف
    const furn = std(0x2a2f36, { metalness: 0.5, roughness: 0.5 });
    const inv = new T.Group(); inv.position.set(-2.6, 6, -3.2); inv.rotation.z = Math.PI; group.add(inv);
    mesh(new T.BoxGeometry(1.8, 0.08, 0.9), furn, inv, 0, 0.9, 0);
    [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.06, 0.9, 0.06), furn, inv, x, 0.45, z));
    const chair = new T.Group(); chair.position.set(2.4, 6, -2.0); chair.rotation.set(Math.PI, 0.6, 0); group.add(chair);
    mesh(new T.BoxGeometry(0.5, 0.06, 0.5), furn, chair, 0, 0.5, 0);
    mesh(new T.BoxGeometry(0.5, 0.6, 0.06), furn, chair, 0, 0.8, -0.22);
    [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.04, 0.5, 0.04), furn, chair, x, 0.25, z));
    // كرات معلقة تتحرك عكس الجاذبية
    for (let i = 0; i < 7; i++) {
      const s = mesh(new T.SphereGeometry(0.08 + Math.random() * 0.1, 16, 12), std(0xcfe8ff, { metalness: 1, roughness: 0.05 }), group, -4 + Math.random() * 8, 0.5 + Math.random() * 4, -5 + Math.random() * 7);
      const ph = Math.random() * 6, base = s.position.y;
      anims.push((dt, t) => { s.position.y = base + Math.sin(t * 0.6 + ph) * 0.4; });
    }

    // كتابة معكوسة على الجدار الأيمن (تُقرأ في المرآة)
    const mirTex = canvasTex(1024, 300, (g, w, h) => {
      g.translate(w, 0); g.scale(-1, 1);
      arabicText(g, 'ما حفظته الساعة،\nلا تقرؤه إلا المرآة.', w / 2, h / 2, 54, '#d8eeff', { weight: 700, glow: 12 });
    });
    const mirText = mesh(new T.PlaneGeometry(3.6, 1.05), new T.MeshBasicMaterial({ map: mirTex, transparent: true, toneMapped: false }), group, 6.88, 2.9, 1.2, false);
    mirText.rotation.y = -Math.PI / 2;
    hotspot(5, 'mirrorText', 'كتابة غريبة', mirText, { pos: new T.Vector3(3.8, 2.6, 1.2), look: new T.Vector3(6.9, 2.9, 1.2) });

    // خدوش في الجدار الأيسر: ستة في الحقيقة، وسبعة في المرآة
    const tallyDraw = (n) => (g, w, h) => {
      g.strokeStyle = 'rgba(220,230,240,.8)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < Math.min(4, n); i++) { g.beginPath(); g.moveTo(40 + i * 26, 30); g.lineTo(44 + i * 26, 120); g.stroke(); }
      if (n >= 5) { g.beginPath(); g.moveTo(26, 110); g.lineTo(150, 40); g.stroke(); }
      for (let i = 5; i < n; i++) { g.beginPath(); g.moveTo(190 + (i - 5) * 26, 32); g.lineTo(193 + (i - 5) * 26, 122); g.stroke(); }
    };
    const tally = mesh(new T.PlaneGeometry(0.9, 0.56), new T.MeshBasicMaterial({ map: canvasTex(256, 160, tallyDraw(6)), transparent: true }), group, -6.94, 1.4, 1.8, false);
    tally.rotation.y = Math.PI / 2;
    // الخدش السابع لا يظهر إلا في الانعكاس
    const ghostTally = mesh(new T.PlaneGeometry(0.9, 0.56), new T.MeshBasicMaterial({ map: canvasTex(256, 160, (g, w, h) => { g.strokeStyle = 'rgba(180,107,255,.95)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(216, 32); g.lineTo(219, 122); g.stroke(); }), transparent: true, toneMapped: false }), group, -6.93, 1.4, 1.8, false);
    ghostTally.rotation.y = Math.PI / 2; ghostTally.visible = false;
    hotspot(5, 'tally5', 'خدوش على الجدار', tally, { pos: new T.Vector3(-4.6, 1.6, 1.8), look: new T.Vector3(-6.9, 1.4, 1.8) });

    // هيئة شخص أمام القفل، لا تظهر إلا في المرآة
    const ghost = new T.Group(); ghost.position.set(-5.2, 0, -2.6); ghost.rotation.y = Math.PI / 2; group.add(ghost); ghost.visible = false;
    const gm = new T.MeshBasicMaterial({ color: 0xb46bff, transparent: true, opacity: 0.6, toneMapped: false });
    mesh(T.CapsuleGeometry ? new T.CapsuleGeometry(0.28, 0.9, 6, 12) : new T.CylinderGeometry(0.28, 0.24, 1.4, 12), gm, ghost, 0, 1.15, 0, false);
    mesh(new T.SphereGeometry(0.2, 16, 12), gm, ghost, 0, 1.95, 0, false);
    const arm = mesh(new T.CylinderGeometry(0.06, 0.05, 0.7, 8), gm, ghost, 0.15, 1.45, 0.3, false); arm.rotation.x = -1.1;
    if (mirror.onBeforeRender && T.Reflector) {
      const orig = mirror.onBeforeRender;
      mirror.onBeforeRender = function (...a) {
        ghost.visible = ghostTally.visible = true;
        orig.apply(this, a);
        ghost.visible = ghostTally.visible = false;
      };
    }
    W.dyn.mirrorRoom = { ghost, ghostTally };

    // لوحة القفل على الجدار الأيسر
    const lock = new T.Group(); lock.position.set(-6.8, 1.7, -2.6); lock.rotation.y = Math.PI / 2; group.add(lock);
    mesh(new T.BoxGeometry(2.4, 1.1, 0.2), std(0x1c232b, { metalness: 0.9, roughness: 0.25 }), lock, 0, 0, 0);
    const dialTex = canvasTex(1024, 400, () => {});
    const dialFace = mesh(new T.PlaneGeometry(2.2, 0.86), new T.MeshBasicMaterial({ map: dialTex, toneMapped: false }), lock, 0, 0, 0.11, false);
    W.dyn.lockTex = dialTex;
    hotspot(5, 'mirrorLock', 'قفل الرموز', [lock.children[0], dialFace], { pos: new T.Vector3(-4.0, 1.8, -2.6), look: new T.Vector3(-6.8, 1.7, -2.6) });
    // الشظية خلف لوح القفل
    const shard = mesh(new T.TetrahedronGeometry(0.22, 0), std(0xdff2ff, { metalness: 1, roughness: 0.02, emissive: 0x335577, emissiveIntensity: 0.6 }), group, -6.3, 0.95, -2.6);
    shard.visible = false;
    anims.push((dt) => { shard.rotation.y += dt; shard.rotation.x += dt * 0.6; });
    W.dyn.shard = shard;
    hotspot(5, 'shard', 'شظية مرآة', shard, { pos: new T.Vector3(-4.6, 1.5, -2.6), look: new T.Vector3(-6.3, 0.95, -2.6) }, { enabled: false });

    door(group, 5, 'left', 4, 'العودة إلى القلب الميكانيكي');
    // باب القطاع ٦ في الجدار الأيمن، بعيدًا عن الكتابة
    door(group, 5, 'right', 6, 'باب البوابة صفر');
    W.dyn['door5_6'].lL.parent.position.z = -4.0;
    W.hot['door5_6'].focus.pos.z = -4.0; W.hot['door5_6'].focus.look.z = -4.0;
  }
  W.setLockDials = (row, view) => {
    redraw(W.dyn.lockTex, (g, w, h) => {
      g.fillStyle = '#0a0e12'; g.fillRect(0, 0, w, h);
      row.forEach((gid, i) => {
        const x = 40 + i * 192;
        g.fillStyle = '#121a22'; g.fillRect(x, 60, 170, 280);
        g.strokeStyle = 'rgba(159,216,255,.5)'; g.lineWidth = 3; g.strokeRect(x, 60, 170, 280);
        drawGlyph(g, gid, x + 25, 120, 120, '#d8eeff', 1.4);
      });
    });
  };

  // ===== الغرفة 6: البوابة صفر =====
  function buildRoom6(group) {
    shell(group, 6, { wall: '#0b100e', keyX: 0, keyZ: 2.5, keyTZ: -5.5 });
    const gold = std(C.gold, { metalness: 1, roughness: 0.22 });
    const gate = new T.Group(); gate.position.set(0, 3.0, -5.8); group.add(gate);
    mesh(new T.TorusGeometry(2.5, 0.22, 20, 120), gold, gate);
    mesh(new T.TorusGeometry(2.85, 0.06, 10, 120), std(C.goldDeep, { metalness: 1, roughness: 0.3 }), gate);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const t = mesh(new T.BoxGeometry(0.12, 0.42, 0.18), gold, gate, Math.cos(a) * 2.95, Math.sin(a) * 2.95, 0);
      t.rotation.z = a - Math.PI / 2;
    }
    const swirlTex = canvasTex(512, 512, (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
      grd.addColorStop(0, 'rgba(230,205,255,1)'); grd.addColorStop(0.25, 'rgba(180,107,255,.85)'); grd.addColorStop(0.7, 'rgba(60,20,100,.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(240,225,255,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 18; i++) { g.beginPath(); for (let a = 0; a < 5; a += 0.05) { const r = 10 + a * 46; g.lineTo(cx + Math.cos(a + i * 0.35) * r, cy + Math.sin(a + i * 0.35) * r); } g.stroke(); }
    });
    const swirl = mesh(new T.CircleGeometry(2.4, 64), new T.MeshBasicMaterial({ map: swirlTex, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }), gate, 0, 0, -0.05, false);
    const sockets = [];
    ZS.GATE_SOCKETS.forEach((gid, i) => {
      const a = Math.PI / 2 + (i - 1) * 0.75;
      const s = new T.Group(); s.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0.25); gate.add(s);
      mesh(new T.CylinderGeometry(0.36, 0.36, 0.14, 32).rotateX(Math.PI / 2), std(0x0d1210, { metalness: 0.9 }), s, 0, 0, 0);
      const engr = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#0a0f0d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a253'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 118, 0, 7); g.stroke(); drawGlyph(g, gid, 58, 58, 140, '#e8d4a0', 1.4); });
      const face = mesh(new T.CircleGeometry(0.33, 32), new T.MeshStandardMaterial({ map: engr, emissive: 0xffffff, emissiveMap: engr, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.5 }), s, 0, 0, 0.075, false);
      const core = mesh(new T.SphereGeometry(0.2, 24, 16), glow(C.violet, 2), s, 0, 0, 0.2);
      core.visible = false;
      sockets.push({ group: s, face, core });
      hotspot(6, 'socket' + i, 'مقبس محفور', [face, s.children[0]], { pos: new T.Vector3(s.position.x * 0.5, 3 + s.position.y * 0.6, -2.4), look: new T.Vector3(s.position.x, 3 + s.position.y, -5.6) });
    });
    const gateLight = new T.PointLight(C.violet, 0.5, 12, 2); gateLight.position.set(0, 3, -4.8); group.add(gateLight);
    W.dyn.gate = { gate, swirl, sockets, gateLight, power: 0, target: 0, open: 0 };
    anims.push((dt, t) => {
      const G = W.dyn.gate;
      G.power += (G.target - G.power) * Math.min(1, dt * 1.2);
      swirl.rotation.z -= dt * (0.15 + G.power * 1.2);
      swirl.material.opacity = 0.18 + G.power * 0.75 + Math.sin(t * 3) * 0.04;
      gateLight.intensity = 0.4 + G.power * 3.5;
      gate.children[1].rotation.z += dt * 0.1 * (1 + G.power * 4);
    });
    hotspot(6, 'gate', 'البوابة صفر', [swirl, gate.children[0]], { pos: new T.Vector3(0, 2.8, -1.4), look: new T.Vector3(0, 3, -5.8) });

    // قاعدة رموز القطاعات
    const ped = new T.Group(); ped.position.set(-3.4, 0, -2.4); ped.rotation.y = 0.5; group.add(ped);
    mesh(new T.CylinderGeometry(0.7, 0.9, 1.05, 6), std(0x141917, { metalness: 0.85 }), ped, 0, 0.52, 0);
    const pedTop = mesh(new T.CylinderGeometry(0.75, 0.75, 0.06, 6), std(0x0c100e, { metalness: 0.8, emissive: 0x22103a, emissiveIntensity: 0.8 }), ped, 0, 1.07, 0);
    const sig = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      sig.push(mesh(new T.CylinderGeometry(0.1, 0.1, 0.05, 16), glow(C.gold, 0.25), ped, Math.cos(a) * 0.45, 1.12, Math.sin(a) * 0.45, false));
    }
    W.dyn.sigils = sig;
    hotspot(6, 'sigils', 'منصة القطاعات', [ped.children[0], pedTop], { pos: new T.Vector3(-2.0, 2.2, -0.4), look: new T.Vector3(-3.4, 1.1, -2.4) });

    // منصة الهوية
    const id = new T.Group(); id.position.set(3.4, 0, -2.4); id.rotation.y = -0.5; group.add(id);
    mesh(new T.BoxGeometry(0.9, 1.1, 0.5), std(0x141917, { metalness: 0.85 }), id, 0, 0.55, 0);
    const idScreen = canvasTex(512, 320, (g, w, h) => { g.fillStyle = '#14061f'; g.fillRect(0, 0, w, h); arabicText(g, 'من ترك لك الأدلة؟', w / 2, h / 2, 40, '#c99bff', { glow: 12, weight: 700 }); });
    const idS = mesh(new T.PlaneGeometry(1.1, 0.68), new T.MeshBasicMaterial({ map: idScreen, toneMapped: false }), id, 0, 1.55, 0, false);
    idS.rotation.x = -0.2;
    hotspot(6, 'identity', 'منصة الاعتراف', [id.children[0], idS], { pos: new T.Vector3(2.0, 2.0, -0.4), look: new T.Vector3(3.4, 1.4, -2.4) });

    // دوائر طاقة على الأرض
    for (let r = 1; r <= 3; r++) {
      const ring = mesh(new T.RingGeometry(r * 1.1, r * 1.1 + 0.03, 96).rotateX(-Math.PI / 2), glow(C.violet, 0.6), group, 0, 0.02, -3.2, false);
      anims.push((dt) => { ring.rotation.y += dt * 0.05 * (r % 2 ? 1 : -1); });
    }
    door(group, 6, 'left', 5, 'العودة إلى الغرفة المعكوسة');
  }
  W.setGate = (g) => {
    const G = W.dyn.gate;
    g.sockets.forEach((c, i) => {
      G.sockets[i].core.visible = !!c;
      if (c) G.sockets[i].core.material.emissive.setHex({ light_core: 0xffc85a, heart_core: 0xff6a30, mirror_shard: 0xbfe6ff }[c]);
    });
    G.target = g.sockets.filter(Boolean).length / 3 * 0.5 + (g.sigilsDone ? 0.5 : 0);
    W.dyn.sigils.forEach((s, i) => { s.material.emissiveIntensity = g.sigilsDone ? 2.2 : i < g.sigilCount ? 1.6 : 0.25; s.material.emissive.setHex(g.sigilsDone ? C.violet : C.gold); });
  };

  // ===== الجسيمات =====
  function buildDust() {
    const n = 900, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 13; pos[i * 3 + 1] = Math.random() * 5.8; pos[i * 3 + 2] = (Math.random() - 0.5) * 13; seed[i] = Math.random() * 10; }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const spr = canvasTex(64, 64, (g) => { const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); });
    const mat = new T.PointsMaterial({ size: 0.045, map: spr, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, color: 0xd8b878, toneMapped: false });
    dust = new T.Points(geo, mat);
    scene.add(dust);
    anims.push((dt, t) => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        p[i * 3] += Math.sin(t * 0.2 + seed[i]) * dt * 0.05;
        p[i * 3 + 1] += dt * (0.03 + (seed[i] % 1) * 0.04);
        if (p[i * 3 + 1] > 5.9) p[i * 3 + 1] = 0.1;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }
  // انفجار جسيمات عند حل لغز
  W.burst = (pos, color = C.violet) => {
    if (W.reduced) return;
    const n = 260, p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = new T.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 3);
      v.push(d);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(p, 3));
    const mat = new T.PointsMaterial({ size: 0.07, color, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, map: dust.material.map });
    const pts = new T.Points(geo, mat); scene.add(pts);
    let life = 0;
    const f = (dt) => {
      life += dt;
      const a = geo.attributes.position.array;
      for (let i = 0; i < n; i++) { v[i].y -= dt * 1.2; v[i].multiplyScalar(1 - dt * 1.2); a[i * 3] += v[i].x * dt; a[i * 3 + 1] += v[i].y * dt; a[i * 3 + 2] += v[i].z * dt; }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - life / 2.2);
      if (life > 2.2) { scene.remove(pts); geo.dispose(); mat.dispose(); anims.splice(anims.indexOf(f), 1); }
    };
    anims.push(f);
    W.pulse(1.2);
  };
  let pulseAmt = 0;
  W.pulse = (a) => { pulseAmt = Math.max(pulseAmt, a); };

  // ===== الكاميرا والتفاعل =====
  const BASE = { pos: new T.Vector3(0, 1.7, 4.6) };
  W.setRoom = (n) => {
    W.room = n;
    Object.entries(W.groups).forEach(([k, g]) => { g.visible = Number(k) === n; });
    const th = ROOM_THEME[n];
    scene.fog.color.setHex(th.fog); scene.fog.density = th.density;
    scene.background.setHex(th.fog);
    dust.material.color.setHex(th.dust);
    view.focus = null;
    view.pos.set(0, 1.9, 6.2); view.tPos.copy(BASE.pos);
    view.yaw = view.tYaw = 0; view.pitch = view.tPitch = -0.04;
    view.look = null; view.tLook = null;
  };
  W.focus = (id) => {
    const h = W.hot[id];
    if (!h || !h.focus) return;
    view.focus = id;
    view.tPos.copy(h.focus.pos);
    view.tLook = h.focus.look.clone();
    if (!view.look) view.look = lookPointFromAngles();
  };
  W.unfocus = () => {
    if (!view.focus) return;
    view.focus = null;
    view.tPos.copy(BASE.pos);
    // نعود إلى زاوية تنظر إلى ما كان مركّزًا عليه
    const d = view.look.clone().sub(BASE.pos);
    view.tYaw = view.yaw = Math.atan2(-d.x, -d.z);
    view.tPitch = view.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    view.tLook = null;
  };
  W.isFocused = () => !!view.focus;
  const shift = { x: 0, y: 0, tx: 0, ty: 0 };
  W.setOffset = (x, y) => { shift.tx = x; shift.ty = y; };
  function lookPointFromAngles() {
    const d = new T.Vector3(-Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), -Math.cos(view.yaw) * Math.cos(view.pitch));
    return view.pos.clone().add(d.multiplyScalar(5));
  }

  let drag = null;
  function onDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    drag = { x: e.clientX, y: e.clientY, yaw: view.tYaw, pitch: view.tPitch, moved: 0 };
  }
  function onMove(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (drag && !view.focus) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      view.tYaw = Math.max(-1.35, Math.min(1.35, drag.yaw + dx * 0.004));
      view.tPitch = Math.max(-0.5, Math.min(0.45, drag.pitch + dy * 0.003));
    }
    if (e.pointerType === 'mouse') updateHover();
  }
  function onUp(e) {
    if (drag && drag.moved < 6) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      const id = pick();
      if (id && W.onHotspot) W.onHotspot(id);
    }
    drag = null;
  }
  function shown(o) {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  }
  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(W.groups[W.room].children, true);
    for (const h of hits) {
      if (!shown(h.object)) continue;
      let o = h.object;
      while (o && !o.userData.hot) o = o.parent;
      if (o) { const hs = W.hot[o.userData.hot]; if (hs && hs.enabled) return hs.id; }
      if (h.object.userData.block) break; // الجدران تحجب ما خلفها
    }
    return null;
  }
  function updateHover() {
    if (W.blocked) { if (hovered) { setHighlight(hovered, false); hovered = null; W.onHover && W.onHover(null); } return; }
    const id = pick();
    if (id !== hovered) {
      if (hovered) setHighlight(hovered, false);
      hovered = id;
      if (id) setHighlight(id, true);
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      W.onHover && W.onHover(id ? W.hot[id].label : null);
    }
  }
  W.clearHover = () => { if (hovered) setHighlight(hovered, false); hovered = null; W.onHover && W.onHover(null); };
  W.nudge = (dx) => { if (!view.focus) view.tYaw = Math.max(-1.35, Math.min(1.35, view.tYaw + dx)); };

  // ===== المشهد الختامي =====
  W.ending = (onDone) => {
    const G = W.dyn.gate;
    G.target = 1.6;
    view.focus = 'ending';
    view.tPos.set(0, 3, -2.5);
    view.tLook = new T.Vector3(0, 3, -6);
    if (!view.look) view.look = lookPointFromAngles();
    const t0 = performance.now();
    const f = () => {
      const t = (performance.now() - t0) / 1000; // زمن حقيقي كي لا يطول المشهد على الأجهزة البطيئة
      if (t > 2.2) { view.tPos.set(0, 3, -5.6); bloom && (bloom.strength = 1.2 + Math.min(3, (t - 2.2) * 1.5)); }
      if (t > 4.5) { anims.splice(anims.indexOf(f), 1); onDone && onDone(); }
    };
    anims.push(f);
  };

  // ===== التهيئة =====
  function envMap() {
    const pm = new T.PMREMGenerator(renderer);
    const tex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#070509'; g.fillRect(0, 0, w, h);
      const add = (x, y, rw, rh, c) => { const grd = g.createRadialGradient(x, y, 0, x, y, rw); grd.addColorStop(0, c); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(x - rw, y - rh, rw * 2, rh * 2); };
      add(w * 0.25, h * 0.3, 90, 60, 'rgba(255,214,150,.9)');
      add(w * 0.7, h * 0.25, 120, 40, 'rgba(180,107,255,.6)');
      add(w * 0.5, h * 0.05, 200, 20, 'rgba(255,255,255,.6)');
      g.fillStyle = 'rgba(201,162,83,.25)'; g.fillRect(0, h * 0.55, w, 6);
    });
    tex.mapping = T.EquirectangularReflectionMapping;
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose();
    return env;
  }

  W.init = (canvas) => {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new T.Scene();
    scene.background = new T.Color(0x070509);
    scene.fog = new T.FogExp2(0x0c0a0e, 0.05);
    scene.environment = envMap();
    camera = new T.PerspectiveCamera(58, 1, 0.05, 60);
    hemi = new T.HemisphereLight(0x9a8fb0, 0x0a0806, 0.35);
    scene.add(hemi);
    clock = new T.Clock();

    [buildRoom1, buildRoom2, buildRoom3, buildRoom4, buildRoom5, buildRoom6].forEach((b, i) => {
      const g = new T.Group(); g.visible = false; scene.add(g); W.groups[i + 1] = g; b(g);
    });
    buildDust();

    const hasPost = T.EffectComposer && T.RenderPass && T.UnrealBloomPass && T.ShaderPass && T.GammaCorrectionShader;
    if (hasPost) {
      composer = new T.EffectComposer(renderer);
      composer.addPass(new T.RenderPass(scene, camera));
      bloom = new T.UnrealBloomPass(new T.Vector2(512, 512), 0.75, 0.55, 0.82);
      composer.addPass(bloom);
      composer.addPass(new T.ShaderPass(T.GammaCorrectionShader));
    } else {
      renderer.outputEncoding = T.sRGBEncoding;
    }

    canvas.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('resize', resize);
    resize();
    W.setRoom(1);
    W.ready = true;
    requestAnimationFrame(frame);
  };
  W.precompile = () => {
    // نجمع كل الغرف مرة واحدة لتجنب التقطع عند أول دخول
    Object.values(W.groups).forEach((g) => { g.visible = true; });
    renderer.compile(scene, camera);
    Object.entries(W.groups).forEach(([k, g]) => { g.visible = Number(k) === W.room; });
  };

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 74 : 58;
    camera.updateProjectionMatrix();
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const k = 1 - Math.pow(0.0025, dt);
    view.pos.lerp(view.tPos, k);
    shift.x += (shift.tx - shift.x) * k; shift.y += (shift.ty - shift.y) * k;
    if (Math.abs(shift.x) + Math.abs(shift.y) > 0.5) {
      const w = innerWidth, h = innerHeight;
      camera.setViewOffset(w, h, shift.x, shift.y, w, h);
    } else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    if (view.tLook) {
      view.look = view.look || lookPointFromAngles();
      view.look.lerp(view.tLook, k);
      camera.position.copy(view.pos);
      camera.lookAt(view.look);
    } else {
      view.yaw += (view.tYaw - view.yaw) * k;
      view.pitch += (view.tPitch - view.pitch) * k;
      view.look = null;
      camera.position.copy(view.pos);
      // تنفّس خفيف للكاميرا
      const sway = W.reduced ? 0 : 1;
      camera.position.y += Math.sin(t * 0.6) * 0.015 * sway;
      camera.lookAt(lookPointFromAngles().add(new T.Vector3(Math.sin(t * 0.37) * 0.03 * sway, 0, 0)));
    }
    // وميض خفيف في أضواء الغرفة
    const g = W.groups[W.room];
    if (g && g.userData.lights) {
      const L = g.userData.lights;
      const flick = W.reduced ? 1 : (Math.random() < 0.004 ? 0.35 : 1);
      L.p1.intensity = (1.0 + Math.sin(t * 1.3) * 0.15) * flick;
      L.key.intensity = 2.4 * (Math.random() < 0.002 && !W.reduced ? 0.6 : 1);
    }
    if (bloom) {
      pulseAmt *= Math.pow(0.25, dt);
      if (view.focus !== 'ending') bloom.strength = 0.75 + pulseAmt;
    }
    anims.slice().forEach((f) => f(dt, t));
    if (composer) composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
})();
