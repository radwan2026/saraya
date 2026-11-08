/* ===============================================================
   فارس الدرب — الرسوم (كلها مرسومة بالكود، بلا صور)
   الإحداثيات: عالم 1600×900، الأرض عند y = 720
   =============================================================== */
(function (root) {
  'use strict';

  var W = 1600, H = 900, GY = 720;
  var TAU = Math.PI * 2;

  function rr(seed) { // عشوائي ثابت
    var s = seed >>> 0 || 1;
    return function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
  function lerp(a, b, k) { return a + (b - a) * k; }

  // ------------------------------------------------------------------
  // ألوان المحطات
  // ------------------------------------------------------------------
  var SKIES = {
    dawn: ['#3b3f86', '#d9768a', '#ffc98a'],
    night: ['#070b26', '#16204e', '#33407a'],
    day: ['#3f8fe0', '#8ec9f2', '#f2e3bd'],
    noon: ['#e7a24a', '#f6cf86', '#fbe6b8'],
  };
  var THEMES = {
    damascus: { far: '#6a5a8a', mid: '#a7865c', near: '#d8b27a', road: '#c79b5f', accent: '#2f8f5a' },
    bosra: { far: '#2a2f4e', mid: '#3a3a44', near: '#57524a', road: '#6b6356', accent: '#e8c06a' },
    castle: { far: '#7a8fb0', mid: '#b99a6a', near: '#d6b47e', road: '#c49a62', accent: '#8a5a2b' },
    oasis: { far: '#8fb0c8', mid: '#d9b77a', near: '#e8c88e', road: '#d4ad70', accent: '#2f9a4a' },
    desert: { far: '#d99a5a', mid: '#e8b06a', near: '#f2c886', road: '#e4b574', accent: '#b5652a' },
    hegra: { far: '#2a2446', mid: '#6a4a3a', near: '#9a6a48', road: '#8a5e40', accent: '#ffcf6a' },
    madinah: { far: '#7a7aa0', mid: '#6a9a5a', near: '#d9c08e', road: '#cfae76', accent: '#2f8f5a' },
    makkah: { far: '#6a5a7a', mid: '#8a6a5a', near: '#c9a070', road: '#b98e5e', accent: '#ffd36a' },
  };

  // ------------------------------------------------------------------
  // الخلفيات
  // ------------------------------------------------------------------
  var starsCache = (function () { var r = rr(7); return Array.from({ length: 160 }, function () { return [r() * W, r() * 520, 0.5 + r() * 1.6, r() * 6]; }); })();

  function sky(g, time, t, vw) {
    var c = SKIES[time] || SKIES.day;
    var gr = g.createLinearGradient(0, 0, 0, GY);
    gr.addColorStop(0, c[0]); gr.addColorStop(0.55, c[1]); gr.addColorStop(1, c[2]);
    g.fillStyle = gr; g.fillRect(-vw, -200, W + vw * 2, GY + 220);
    if (time === 'night' || time === 'dawn') {
      g.fillStyle = '#fff';
      for (var i = 0; i < starsCache.length; i++) {
        var s = starsCache[i];
        g.globalAlpha = (time === 'night' ? 1 : 0.35) * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s[3])));
        if (time === 'dawn' && s[1] > 260) continue;
        g.beginPath(); g.arc(s[0], s[1], s[2], 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (time === 'night') {
      var mx = 1250, my = 150;
      var mg = g.createRadialGradient(mx, my, 10, mx, my, 160); mg.addColorStop(0, 'rgba(230,235,255,.5)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 160, 0, TAU); g.fill();
      g.fillStyle = '#f4f2e6'; g.beginPath(); g.arc(mx, my, 48, 0, TAU); g.fill();
      g.fillStyle = c[0]; g.beginPath(); g.arc(mx + 20, my - 12, 44, 0, TAU); g.fill(); // هلال
    } else {
      var sx = time === 'dawn' ? 1180 : time === 'noon' ? 800 : 1250;
      var sy = time === 'dawn' ? 560 : time === 'noon' ? 120 : 170;
      var R = time === 'noon' ? 70 : 60;
      var sg = g.createRadialGradient(sx, sy, R * 0.3, sx, sy, R * 4);
      sg.addColorStop(0, time === 'dawn' ? 'rgba(255,200,120,.85)' : 'rgba(255,245,200,.9)');
      sg.addColorStop(0.3, 'rgba(255,210,120,.3)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, R * 4, 0, TAU); g.fill();
      g.fillStyle = time === 'dawn' ? '#ffe0a0' : '#fff6d0'; g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fill();
    }
  }

  /** طبقة متكرّرة مع إزاحة المنظر (parallax) */
  function tiled(g, scroll, factor, tileW, vw, draw) {
    var off = ((scroll * factor) % tileW + tileW) % tileW;
    for (var x = -off - tileW; x < W + vw + tileW; x += tileW) draw(x);
  }

  function hillsPath(g, x0, w, base, amp, freq, seed, color) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(x0, GY + 10);
    for (var x = 0; x <= w; x += 20) {
      var y = base - amp * (0.55 + 0.45 * Math.sin((x + seed) * freq)) - amp * 0.3 * Math.sin((x + seed * 2) * freq * 2.3);
      g.lineTo(x0 + x, y);
    }
    g.lineTo(x0 + w, GY + 10); g.closePath(); g.fill();
  }

  function dome(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r, y - r * 1.2, x, y - r * 1.35); g.quadraticCurveTo(x + r, y - r * 1.2, x + r, y); g.fill();
    g.fillRect(x - 1.5, y - r * 1.35 - 14, 3, 14);
    g.beginPath(); g.arc(x, y - r * 1.35 - 16, 4, 0, TAU); g.fill();
  }
  function minaret(g, x, y, h, w, color) {
    g.fillStyle = color;
    g.fillRect(x - w / 2, y - h, w, h);
    g.fillRect(x - w * 0.9, y - h * 0.72, w * 1.8, 6);
    g.fillRect(x - w * 0.75, y - h - 4, w * 1.5, 5);
    g.beginPath(); g.moveTo(x - w * 0.6, y - h - 4); g.lineTo(x, y - h - 34); g.lineTo(x + w * 0.6, y - h - 4); g.fill();
  }
  function palm(g, x, y, h, t, color, trunk) {
    var sway = Math.sin(t * 0.8 + x * 0.01) * 6;
    g.strokeStyle = trunk || '#7a5230'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - h * 0.5, x + sway, y - h); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    for (var k = 0.1; k < 1; k += 0.1) { var yy = y - h * k; g.beginPath(); g.moveTo(x - 4 + sway * k, yy); g.lineTo(x + 5 + sway * k, yy - 3); g.stroke(); }
    g.fillStyle = color || '#2f8a3a';
    for (var i = 0; i < 8; i++) {
      var a = -Math.PI / 2 + (i - 3.5) * 0.42 + Math.sin(t + i) * 0.04;
      var len = 60 + (i % 3) * 12;
      g.save(); g.translate(x + sway, y - h); g.rotate(a + Math.PI / 2 * (i < 4 ? -0.15 : 0.15));
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -18, len, 14); g.quadraticCurveTo(len * 0.5, -4, 0, 0); g.fill();
      g.restore();
    }
    g.fillStyle = '#8a4a1a';
    for (var d = 0; d < 5; d++) { g.beginPath(); g.arc(x + sway - 8 + d * 4, y - h + 8 + (d % 2) * 4, 4, 0, TAU); g.fill(); }
  }

  var FAR = {
    damascus: function (g, x, c) {
      // جبل قاسيون
      g.fillStyle = c.far; g.beginPath(); g.moveTo(x, 600); g.quadraticCurveTo(x + 400, 380, x + 900, 520); g.quadraticCurveTo(x + 1300, 420, x + 1600, 600); g.lineTo(x + 1600, 720); g.lineTo(x, 720); g.fill();
    },
    bosra: function (g, x, c) { hillsPath(g, x, 1600, 600, 70, 0.006, 3, c.far); },
    castle: function (g, x, c) { hillsPath(g, x, 1600, 610, 60, 0.004, 9, c.far); },
    oasis: function (g, x, c) { hillsPath(g, x, 1600, 630, 40, 0.005, 5, c.far); },
    desert: function (g, x, c) {
      g.fillStyle = c.far;
      g.beginPath(); g.moveTo(x, 640); g.lineTo(x + 120, 520); g.lineTo(x + 380, 520); g.lineTo(x + 460, 640);
      g.lineTo(x + 900, 640); g.lineTo(x + 980, 560); g.lineTo(x + 1200, 560); g.lineTo(x + 1260, 640); g.lineTo(x + 1600, 640); g.lineTo(x + 1600, 720); g.lineTo(x, 720); g.fill();
    },
    hegra: function (g, x, c) { hillsPath(g, x, 1600, 620, 80, 0.007, 11, c.far); },
    madinah: function (g, x, c) { hillsPath(g, x, 1600, 610, 70, 0.005, 2, c.far); },
    makkah: function (g, x, c) {
      g.fillStyle = c.far;
      g.beginPath(); g.moveTo(x, 640);
      [[150, 430], [330, 560], [520, 380], [700, 540], [880, 420], [1080, 560], [1250, 400], [1450, 540], [1600, 470]].forEach(function (p) { g.lineTo(x + p[0], p[1]); });
      g.lineTo(x + 1600, 720); g.lineTo(x, 720); g.fill();
    },
  };

  var MID = {
    damascus: function (g, x, c, t) {
      var col = '#4a3a5a';
      g.fillStyle = col;
      for (var i = 0; i < 10; i++) g.fillRect(x + i * 160, 600 - (i % 3) * 22, 130, 140);
      dome(g, x + 300, 560, 60, col); dome(g, x + 1060, 575, 46, col); dome(g, x + 700, 590, 36, col);
      minaret(g, x + 420, 600, 170, 20, col); minaret(g, x + 960, 600, 140, 18, col); minaret(g, x + 1400, 600, 120, 16, col);
      // نوافذ مضيئة عند الفجر
      g.fillStyle = 'rgba(255,200,120,.75)';
      for (var k = 0; k < 18; k++) g.fillRect(x + 30 + k * 88, 640 - (k % 4) * 18, 8, 12);
    },
    bosra: function (g, x, c) {
      // مدرّجات المسرح الروماني
      g.fillStyle = c.mid;
      g.beginPath(); g.ellipse(x + 520, 700, 420, 220, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
      for (var r = 0; r < 6; r++) { g.beginPath(); g.ellipse(x + 520, 700, 420 - r * 50, 220 - r * 28, 0, Math.PI, TAU); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.45)';
      for (var a = 0; a < 9; a++) { var ax = x + 160 + a * 90; g.beginPath(); g.arc(ax, 560, 20, Math.PI, TAU); g.rect(ax - 20, 560, 40, 30); g.fill(); }
      g.fillStyle = '#4a4640';
      for (var p = 0; p < 6; p++) g.fillRect(x + 1050 + p * 70, 470 + (p % 2) * 30, 22, 260);
      g.fillRect(x + 1040, 460, 410, 20);
    },
    castle: function (g, x, c) {
      var col = '#8a6a4a';
      g.fillStyle = col;
      g.fillRect(x + 560, 520, 420, 200);
      for (var i = 0; i < 12; i++) g.fillRect(x + 560 + i * 36, 505, 22, 18);
      [x + 540, x + 960].forEach(function (tx) { g.fillRect(tx, 480, 60, 240); for (var j = 0; j < 3; j++) g.fillRect(tx + j * 22, 465, 14, 16); });
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 770, 650, 40, Math.PI, TAU); g.rect(x + 730, 650, 80, 70); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; for (var w2 = 0; w2 < 4; w2++) g.fillRect(x + 620 + w2 * 90, 570, 12, 26);
      hillsPath(g, x, 1600, 690, 30, 0.01, 4, c.mid);
    },
    oasis: function (g, x, c, t) {
      hillsPath(g, x, 1600, 690, 40, 0.008, 6, c.mid);
      g.fillStyle = 'rgba(80,170,220,.8)'; g.beginPath(); g.ellipse(x + 820, 700, 240, 22, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 700 + Math.sin(t) * 20, 696, 60, 3);
      [300, 380, 640, 980, 1060, 1300].forEach(function (px, i) { palm(g, x + px, 700, 150 + (i % 3) * 40, t, '#2a7a36'); });
      // بئر
      g.fillStyle = '#9a7a5a'; g.fillRect(x + 1180, 650, 70, 50); g.fillStyle = '#6a4a2a'; g.fillRect(x + 1172, 600, 8, 50); g.fillRect(x + 1250, 600, 8, 50); g.fillRect(x + 1172, 598, 86, 8);
    },
    desert: function (g, x, c) {
      g.fillStyle = c.mid;
      g.beginPath(); g.moveTo(x, 720); g.quadraticCurveTo(x + 250, 560, x + 520, 690); g.quadraticCurveTo(x + 800, 600, x + 1100, 700); g.quadraticCurveTo(x + 1350, 590, x + 1600, 700); g.lineTo(x + 1600, 720); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.beginPath(); g.moveTo(x + 250, 610); g.quadraticCurveTo(x + 380, 640, x + 520, 690); g.lineTo(x + 500, 690); g.quadraticCurveTo(x + 380, 650, x + 250, 618); g.fill();
    },
    hegra: function (g, x, c) {
      var rocks = [[200, 260, 300], [760, 330, 380], [1260, 280, 320]];
      rocks.forEach(function (rk) {
        var rx = x + rk[0], w = rk[1], h = rk[2];
        var gr = g.createLinearGradient(rx, 720 - h, rx + w, 720);
        gr.addColorStop(0, '#b07a52'); gr.addColorStop(1, '#5a3a2a');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(rx, 720); g.quadraticCurveTo(rx - 20, 720 - h * 0.7, rx + w * 0.25, 720 - h);
        g.quadraticCurveTo(rx + w * 0.6, 720 - h * 1.08, rx + w * 0.85, 720 - h * 0.85); g.quadraticCurveTo(rx + w + 20, 720 - h * 0.4, rx + w, 720); g.fill();
        // واجهة منحوتة
        var fx = rx + w * 0.32, fw = w * 0.36, fy = 720 - h * 0.62;
        g.fillStyle = 'rgba(255,220,170,.22)'; g.fillRect(fx, fy, fw, h * 0.62);
        g.fillStyle = 'rgba(40,20,10,.6)'; g.fillRect(fx + fw * 0.35, fy + h * 0.32, fw * 0.3, h * 0.3);
        g.fillStyle = 'rgba(255,220,170,.3)';
        for (var s = 0; s < 5; s++) { g.fillRect(fx + s * fw / 5, fy - 14 - (s % 2) * 0, fw / 5 - 4, 6); g.fillRect(fx + s * fw / 5 + 6, fy - 26, fw / 5 - 16, 12); }
      });
    },
    madinah: function (g, x, c, t) {
      hillsPath(g, x, 1600, 690, 30, 0.01, 8, '#5a8a4a');
      [120, 200, 300, 520, 600, 1100, 1180, 1280, 1500].forEach(function (px, i) { palm(g, x + px, 705, 130 + (i % 3) * 35, t, '#2f8a3a'); });
      var col = '#e9e2d0';
      g.fillStyle = col; g.fillRect(x + 760, 600, 280, 110);
      dome(g, x + 900, 600, 52, '#2f9a5a');
      minaret(g, x + 770, 640, 150, 16, col); minaret(g, x + 1030, 640, 150, 16, col);
    },
    makkah: function (g, x, c, t) {
      hillsPath(g, x, 1600, 680, 90, 0.006, 12, '#7a5a4a');
      // أضواء المدينة البعيدة ومآذن عند الفجر
      g.fillStyle = 'rgba(255,220,140,.7)';
      for (var i = 0; i < 40; i++) g.fillRect(x + 500 + (i * 37) % 600, 650 + (i * 13) % 50, 3, 3);
      ['#f2e6c8'].forEach(function (col) {
        [620, 700, 900, 980].forEach(function (px) { minaret(g, x + px, 690, 120, 12, col); });
      });
    },
  };

  function ground(g, theme, scroll, vw, t) {
    var c = THEMES[theme];
    var gr = g.createLinearGradient(0, GY - 10, 0, H);
    gr.addColorStop(0, c.near); gr.addColorStop(1, shade(c.near, -0.35));
    g.fillStyle = gr; g.fillRect(-vw, GY - 8, W + vw * 2, H - GY + 300);
    // الطريق
    g.fillStyle = c.road; g.fillRect(-vw, GY + 10, W + vw * 2, 60);
    g.fillStyle = 'rgba(0,0,0,.08)';
    tiled(g, scroll, 1, 160, vw, function (x) {
      g.beginPath(); g.ellipse(x + 40, GY + 40, 18, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + 120, GY + 92, 10, 3, 0, 0, TAU); g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,.12)';
    tiled(g, scroll, 1, 90, vw, function (x) { g.fillRect(x, GY + 30, 30, 3); });
  }

  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); };
    return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
  }

  // ------------------------------------------------------------------
  // خلفيات مصمّمة (صور) لبعض المحطات — تحلّ محل السماء والطبقات المرسومة
  // ------------------------------------------------------------------
  var BACKDROPS = {};
  /**
   * img: صورة محمّلة.
   * horizon: نسبة ارتفاع خط الأفق في الصورة (0..1) — يُوضع عند ارتفاع ثابت في المشهد.
   * top: لون السماء فوق الصورة (يُقرأ تلقائياً من أعلى الصورة إن أمكن).
   * road: لونا طريق الفارس (أعلى، أسفل).
   */
  function setBackdrop(theme, img, opts) {
    opts = opts || {};
    var top = opts.top || '#4e9ae6';
    try { // نأخذ لون السماء من أعلى الصورة ليمتد بلا فاصل
      var c = document.createElement('canvas'); c.width = 8; c.height = 2;
      var cg = c.getContext('2d'); cg.drawImage(img, 0, 0, img.naturalWidth, 4, 0, 0, 8, 2);
      var d = cg.getImageData(0, 0, 8, 1).data, r = 0, gg = 0, b = 0;
      for (var i = 0; i < 32; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      top = 'rgb(' + Math.round(r / 8) + ',' + Math.round(gg / 8) + ',' + Math.round(b / 8) + ')';
    } catch (e) { /* عند الفتح من الملفات مباشرة نستخدم اللون المعطى */ }
    BACKDROPS[theme] = { img: img, top: top, horizon: opts.horizon || 0.48, road: opts.road || ['#e8ad66', '#b8692f'] };
  }

  var HORIZON_Y = 455; // ارتفاع الأفق في المشهد

  /**
   * الخلفية صورة واحدة بمقاسها الأصلي (تكبير متساوٍ بلا مطّ ولا عكس)،
   * تنزلق ببطء في اتجاه واحد حسب pan (0..1)، وطريق الفارس طبقة مستقلة أمامها.
   */
  function backdrop(g, bd, t, scroll, vw, pan) {
    var img = bd.img, iw = img.naturalWidth, ih = img.naturalHeight;
    var Wv = W + vw * 2;
    var s = Math.max((Wv * 1.12) / iw, (HORIZON_Y + 260) / (ih * bd.horizon));
    var dw = iw * s, dh = ih * s;
    var x0 = -vw - (dw - Wv) * (pan == null ? 0.5 : pan);
    var y0 = HORIZON_Y - bd.horizon * dh;
    g.fillStyle = bd.top; g.fillRect(-vw - 10, -4000, Wv + 20, y0 + 4002);
    g.drawImage(img, x0, y0, dw, dh);
    road(g, scroll, vw, bd.road);
  }

  /** طريق الفارس: شريط مستقل بحافة مظلّلة يفصله عن الخلفية */
  function road(g, scroll, vw, col) {
    var top = GY - 16;
    var sh = g.createLinearGradient(0, top - 34, 0, top);
    sh.addColorStop(0, 'rgba(70,30,8,0)'); sh.addColorStop(1, 'rgba(70,30,8,.35)');
    g.fillStyle = sh; g.fillRect(-vw, top - 34, W + vw * 2, 34);
    var rg = g.createLinearGradient(0, top, 0, H + 120);
    rg.addColorStop(0, col[0]); rg.addColorStop(1, col[1]);
    g.fillStyle = rg; g.fillRect(-vw, top, W + vw * 2, H + 2000 - top);
    g.fillStyle = 'rgba(255,240,200,.55)'; g.fillRect(-vw, top, W + vw * 2, 3);
    // حصى على حافة الطريق وآثار القوافل — تتحرك بسرعة الفارس
    tiled(g, scroll, 1, 140, vw, function (x) {
      g.fillStyle = 'rgba(110,50,20,.55)';
      g.beginPath(); g.ellipse(x + 20, top + 6, 9, 4, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + 86, top + 9, 5, 3, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,60,25,.18)';
      g.beginPath(); g.ellipse(x + 60, GY + 48, 22, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + 120, GY + 112, 14, 4, 0, 0, TAU); g.fill();
    });
    g.fillStyle = 'rgba(255,240,210,.22)';
    tiled(g, scroll, 1, 90, vw, function (x) { g.fillRect(x, GY + 26, 34, 3); });
  }

  /** المشهد الكامل لمحطة. scroll يزيد مع التقدّم في الرحلة. vw: امتداد يمين/يسار للشاشات العريضة */
  function world(g, stage, t, scroll, vw, pan) {
    var c = THEMES[stage.theme];
    var bd = BACKDROPS[stage.theme];
    if (bd && bd.img.complete && bd.img.naturalWidth) { backdrop(g, bd, t, scroll, vw, pan); return; }
    sky(g, stage.time, t, vw);
    tiled(g, scroll, 0.08, 1600, vw, function (x) { FAR[stage.theme](g, x, c, t); });
    tiled(g, scroll, 0.3, 1600, vw, function (x) { MID[stage.theme](g, x, c, t); });
    ground(g, stage.theme, scroll, vw, t);
    if (stage.time === 'noon') { // تموّج الحرّ
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (var i = 0; i < 6; i++) g.fillRect(-vw, 600 + i * 18 + Math.sin(t * 3 + i) * 4, W + vw * 2, 3);
    }
  }

  // ------------------------------------------------------------------
  // الفارس وفرسه (يتّجه يساراً افتراضياً: من الشام نحو مكة)
  // ------------------------------------------------------------------
  function leg(g, hx, hy, a1, a2, l1, l2, w1, w2, col) {
    var kx = hx + Math.sin(a1) * l1, ky = hy + Math.cos(a1) * l1;
    var fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
    g.strokeStyle = col; g.lineCap = 'round';
    g.lineWidth = w1; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
    g.lineWidth = w2; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(fx + 1, fy + 2, 6, 4, 0, 0, TAU); g.fill();
  }

  /**
   * opts: { dir: -1 يسار | 1 يمين, gallop: 0..1, cloak, robe, sword: 'up'|'swing', swing: 0..1, hurt: 0..1, jump, scale }
   */
  function knight(g, x, y, t, o) {
    o = o || {};
    var dir = o.dir || -1, sc = o.scale || 1;
    var gal = o.gallop || 0;
    var p = t * 11 * (0.4 + gal);
    var bob = gal ? Math.sin(p * 2) * 4 : Math.sin(t * 2) * 1.2;
    g.save();
    g.translate(x, y); g.scale(dir * sc, sc); // يُرسم متجهاً لليمين، و dir = -1 يعكسه لليسار
    if (o.hurt) g.translate(Math.sin(t * 60) * 6 * o.hurt, 0);
    // ظل
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, 4, 85 - (o.jump || 0) * 0.2, 10, 0, 0, TAU); g.fill();
    g.translate(0, -(o.jump || 0));
    var horse = o.horse || '#ece6da', horseDark = o.horseDark || '#cfc5b4', mane = o.mane || '#4a3426';
    var la = function (off, amp) { return gal ? Math.sin(p + off) * amp : Math.sin(t + off) * 0.05; };
    // الأرجل البعيدة
    leg(g, -36, -58 + bob, la(Math.PI, 0.6) - 0.1, Math.abs(la(Math.PI + 0.6, 0.9)), 30, 30, 10, 7, horseDark);
    leg(g, 34, -60 + bob, la(0.5, 0.7) + 0.1, -Math.abs(la(1.1, 0.9)) * -1, 30, 30, 10, 7, horseDark);
    // الذيل
    g.strokeStyle = mane; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-50, -86 + bob); g.quadraticCurveTo(-82, -80 + Math.sin(t * 6) * 8, -96, -52 + Math.sin(t * 5) * 10); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(-50, -84 + bob); g.quadraticCurveTo(-76, -70, -86, -44 + Math.sin(t * 5 + 1) * 8); g.stroke();
    // الجسم
    var bg = g.createLinearGradient(0, -100, 0, -45);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, horse);
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(0, -74 + bob, 54, 27, 0, 0, TAU); g.fill();
    // الرقبة والرأس
    g.beginPath(); g.moveTo(26, -92 + bob); g.quadraticCurveTo(46, -130 + bob, 62, -138 + bob); g.lineTo(76, -128 + bob); g.quadraticCurveTo(66, -96 + bob, 54, -70 + bob); g.fill();
    g.save(); g.translate(82, -126 + bob); g.rotate(0.55);
    g.beginPath(); g.ellipse(0, 0, 24, 12, 0, 0, TAU); g.fill();
    g.fillStyle = horseDark; g.beginPath(); g.ellipse(18, 2, 7, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(-6, -4, 2.6, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-5.3, -4.8, 0.9, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = horse; g.beginPath(); g.moveTo(64, -146 + bob); g.lineTo(70, -164 + bob); g.lineTo(75, -142 + bob); g.fill();
    // العُرف
    g.strokeStyle = mane; g.lineWidth = 6;
    for (var m = 0; m < 6; m++) {
      var mx = 30 + m * 6.5, my = -100 - m * 7.5 + bob;
      g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx - 12, my + 4, mx - 20 + Math.sin(t * 7 + m) * 4, my + 14); g.stroke();
    }
    // اللجام
    g.strokeStyle = '#b5862a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(76, -122 + bob); g.lineTo(30, -104 + bob); g.stroke();
    // الأرجل القريبة
    leg(g, -30, -58 + bob, la(0, 0.6) - 0.1, Math.abs(la(0.6, 0.9)), 30, 30, 11, 8, horse);
    leg(g, 40, -60 + bob, la(Math.PI + 0.5, 0.7) + 0.1, -Math.abs(la(Math.PI + 1.1, 0.9)) * -1, 30, 30, 11, 8, horse);
    // غطاء السرج (عنابي بحواف ذهبية)
    var cloak = o.cloak || '#7a1f2a';
    g.fillStyle = cloak; g.beginPath(); g.moveTo(-30, -97 + bob); g.lineTo(24, -97 + bob); g.lineTo(20, -62 + bob); g.lineTo(-26, -62 + bob); g.fill();
    g.fillStyle = '#d9a441'; g.fillRect(-28, -67 + bob, 50, 4); g.fillRect(-29, -97 + bob, 52, 3);
    for (var f = 0; f < 7; f++) { g.beginPath(); g.moveTo(-24 + f * 7.5, -62 + bob); g.lineTo(-21 + f * 7.5, -55 + bob); g.lineTo(-18 + f * 7.5, -62 + bob); g.fill(); }
    // ======== الفارس ========
    var by = bob;
    var swing = o.swing || 0;
    var wave = Math.sin(t * 7) * 6 * (0.4 + gal);
    var cape = o.cape || '#3a2418';
    var skin = '#d39a6a', skinD = '#b27a4e';
    var leather = '#5a3420', gold = '#d9a441';
    // العباءة الداكنة الطائرة
    var cg = g.createLinearGradient(-90, -150, 0, -90);
    cg.addColorStop(0, shade(cape, -0.25)); cg.addColorStop(1, cape);
    g.fillStyle = cg;
    g.beginPath(); g.moveTo(-2, -150 + by);
    g.quadraticCurveTo(-36, -150 + by + wave * 0.4, -70 - gal * 22, -128 + by + wave);
    g.quadraticCurveTo(-84 - gal * 26, -112 + by + wave * 1.3, -90 - gal * 30, -92 + by + wave * 1.6);
    g.lineTo(-72 - gal * 20, -96 + by + wave); g.lineTo(-60 - gal * 14, -88 + by + wave * 0.8);
    g.quadraticCurveTo(-34, -100 + by, -10, -104 + by); g.closePath(); g.fill();
    g.strokeStyle = gold; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-90 - gal * 30, -92 + by + wave * 1.6); g.lineTo(-72 - gal * 20, -96 + by + wave); g.lineTo(-60 - gal * 14, -88 + by + wave * 0.8); g.stroke();
    // الساق: ثوب أبيض متدلٍّ وجزمة جلدية
    g.fillStyle = '#f4efe3';
    g.beginPath(); g.moveTo(-8, -104 + by); g.quadraticCurveTo(14, -98 + by, 20, -80 + by); g.lineTo(6, -74 + by); g.quadraticCurveTo(-4, -86 + by, -10, -96 + by); g.fill();
    g.fillStyle = '#4a2a16';
    g.beginPath(); g.moveTo(8, -82 + by); g.lineTo(20, -80 + by); g.lineTo(18, -60 + by); g.lineTo(24, -56 + by); g.lineTo(6, -55 + by); g.lineTo(6, -78 + by); g.fill();
    g.fillStyle = gold; g.fillRect(7, -79 + by, 13, 2.5);
    // الجذع: قميص أبيض وصدرية جلدية بزخارف ذهبية
    g.fillStyle = '#f6f2e8';
    g.beginPath(); g.moveTo(-11, -100 + by); g.lineTo(-9, -146 + by); g.quadraticCurveTo(4, -154 + by, 17, -146 + by); g.lineTo(15, -100 + by); g.fill();
    var vg = g.createLinearGradient(-10, -146, 16, -104);
    vg.addColorStop(0, '#7a4a2a'); vg.addColorStop(1, leather);
    g.fillStyle = vg;
    g.beginPath(); g.moveTo(-10, -106 + by); g.lineTo(-8, -145 + by); g.lineTo(0, -149 + by); g.lineTo(5, -112 + by); g.lineTo(14, -146 + by); g.lineTo(16, -140 + by); g.lineTo(14, -106 + by); g.fill();
    g.strokeStyle = gold; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-6, -142 + by); g.lineTo(-5, -110 + by); g.moveTo(12, -140 + by); g.lineTo(11, -110 + by); g.stroke();
    g.fillStyle = gold; g.beginPath(); g.arc(9, -137 + by, 3.4, 0, TAU); g.fill();
    g.fillStyle = '#7a4a10'; g.beginPath(); g.arc(9, -137 + by, 1.4, 0, TAU); g.fill();
    // الحزام العنابي
    g.fillStyle = '#7a1f2a'; g.fillRect(-11, -110 + by, 27, 9);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-11, -104 + by, 27, 2);
    g.fillStyle = gold; g.beginPath(); g.arc(4, -105.5 + by, 3.6, 0, TAU); g.fill();
    // الرأس: وجه بلحية قصيرة، شماغ أبيض وعقال أسود
    g.fillStyle = skin; g.fillRect(2, -156 + by, 8, 8); // الرقبة
    g.beginPath(); g.ellipse(7, -164 + by, 11, 12.5, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(16, -168 + by); g.lineTo(21, -161 + by); g.lineTo(16, -159 + by); g.fill(); // الأنف
    g.fillStyle = '#1e140c';
    g.beginPath(); g.moveTo(-2, -164 + by); g.quadraticCurveTo(0, -150 + by, 9, -150 + by); g.quadraticCurveTo(17, -150 + by, 18, -156 + by); g.quadraticCurveTo(12, -155 + by, 9, -157 + by); g.quadraticCurveTo(2, -158 + by, 1, -166 + by); g.fill();
    g.fillRect(9, -158.5 + by, 9, 2.2); // الشارب
    g.fillStyle = '#1e140c'; g.beginPath(); g.ellipse(12, -168 + by, 1.8, 2.2, 0, 0, TAU); g.fill();
    g.strokeStyle = '#1e140c'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, -173 + by); g.lineTo(16, -171.5 + by); g.stroke();
    // الشماغ: يغطي الرأس وينسدل خلف الكتفين ويطير بالريح
    g.fillStyle = '#fbf9f2';
    g.beginPath(); g.moveTo(-6, -158 + by); g.quadraticCurveTo(-8, -184 + by, 8, -182 + by); g.quadraticCurveTo(20, -182 + by, 19, -172 + by);
    g.lineTo(-2, -170 + by); g.quadraticCurveTo(-4, -160 + by, -2, -150 + by); g.lineTo(-12, -142 + by); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-6, -170 + by); g.quadraticCurveTo(-30 - gal * 12, -168 + by + wave, -44 - gal * 20, -150 + by + wave * 1.3);
    g.quadraticCurveTo(-30, -150 + by, -10, -146 + by); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-10, -166 + by); g.quadraticCurveTo(-26, -160 + by + wave * 0.6, -36 - gal * 14, -152 + by + wave); g.stroke();
    g.fillStyle = '#1a1414';
    g.beginPath(); g.ellipse(6, -179 + by, 13, 3.2, -0.08, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(6, -175 + by, 13, 2.8, -0.08, 0, TAU); g.fill();
    // الذراع: كمّ أبيض وسوار جلدي، والسيف المنحني بواقٍ ذهبي
    var sa = o.sword === 'swing' ? lerp(-2.2, 0.9, easeOut(swing)) : (o.sword === 'down' ? 0.6 : -1.1 + Math.sin(t * 2) * 0.05);
    g.save(); g.translate(10, -138 + by); g.rotate(sa);
    g.strokeStyle = '#f6f2e8'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(14, 3); g.stroke();
    g.strokeStyle = leather; g.lineWidth = 9; g.lineCap = 'butt'; g.beginPath(); g.moveTo(13, 3); g.lineTo(22, 4.5); g.stroke();
    g.strokeStyle = gold; g.lineWidth = 1.2; g.beginPath(); g.moveTo(17, -0.5); g.lineTo(17, 8.5); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(25, 4.5, 4.8, 0, TAU); g.fill();
    g.fillStyle = skinD; g.beginPath(); g.arc(26, 6, 2.4, 0, TAU); g.fill();
    g.fillStyle = '#3a2418'; g.fillRect(18, 2.5, 7, 4); // المقبض
    g.fillStyle = gold; g.beginPath(); g.moveTo(27, -5); g.lineTo(31, 4); g.lineTo(27, 13); g.lineTo(29, 4); g.fill(); // الواقي
    var blade = g.createLinearGradient(30, -4, 96, -20);
    blade.addColorStop(0, '#cfd6e0'); blade.addColorStop(0.5, '#ffffff'); blade.addColorStop(1, '#9aa6b8');
    g.fillStyle = blade;
    g.beginPath(); g.moveTo(30, 1.5); g.quadraticCurveTo(66, -1, 98, -26); g.quadraticCurveTo(72, 6, 30, 7.5); g.fill();
    g.strokeStyle = 'rgba(80,90,110,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 4.5); g.quadraticCurveTo(66, 3, 96, -23); g.stroke();
    if (o.glow) { g.strokeStyle = 'rgba(255,230,140,' + o.glow + ')'; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(66, 1, 98, -26); g.stroke(); }
    g.restore();
    g.restore();
  }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

  function starShape(g, x, y, R, r, n, color, rot) {
    g.fillStyle = color; g.beginPath();
    for (var i = 0; i < n * 2; i++) { var a = (rot || 0) + (i * Math.PI) / n; var rad = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    g.closePath(); g.fill();
  }

  // ------------------------------------------------------------------
  // الشخصيات (تتجه يميناً نحو الفارس افتراضياً)
  // ------------------------------------------------------------------
  function person(g, x, y, t, o) {
    var dir = o.dir || 1, sc = o.scale || 1;
    var look = o.look;
    var float = (look === 'sorcerer' || look === 'sorceress' || look === 'archsorcerer' || look === 'sandlord') ? Math.sin(t * 2) * 8 - 18 : 0;
    g.save(); g.translate(x, y); g.scale(dir * sc, sc);
    if (o.hurt) g.translate(Math.sin(t * 70) * 7 * o.hurt, 0);
    if (o.defeat) { g.globalAlpha = Math.max(0, 1 - o.defeat); g.translate(0, o.defeat * 30); g.rotate(-o.defeat * 0.3); }
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, 4, 48, 9, 0, 0, TAU); g.fill();
    g.translate(0, float);
    var col = o.color;
    switch (look) {
      case 'owl': owl(g, t); break;
      case 'stone': stoneGolem(g, t, col); break;
      case 'sandlord': sandLord(g, t, col); break;
      case 'elder': case 'scholar': case 'merchant': case 'bedouin': arabMan(g, t, look, col, o); break;
      case 'sorcerer': case 'sorceress': case 'archsorcerer': sorcerer(g, t, look, col, o); break;
      default: robed(g, t, look, col, o);
    }
    g.restore();
  }

  function robed(g, t, look, col, o) {
    var sorc = look === 'sorcerer' || look === 'sorceress' || look === 'archsorcerer';
    var robe = col || ({ merchant: '#b5651d', guard: '#6a7380', bedouin: '#c9b48a', scholar: '#2f6a5a', elder: '#f2efe6' })[look] || '#7a5a9a';
    var big = look === 'archsorcerer' ? 1.25 : look === 'merchant' ? 1.08 : 1;
    g.save(); g.scale(big, big);
    // هالة السحرة
    if (sorc || look === 'elder') {
      var ag = g.createRadialGradient(0, -100, 10, 0, -100, 150);
      ag.addColorStop(0, look === 'elder' ? 'rgba(255,240,180,.45)' : hexA(robe, 0.45)); ag.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ag; g.beginPath(); g.arc(0, -100, 150, 0, TAU); g.fill();
    }
    // الرداء
    var rg = g.createLinearGradient(-40, -160, 40, 0);
    rg.addColorStop(0, shade(robe, 0.25)); rg.addColorStop(1, shade(robe, -0.3));
    g.fillStyle = rg;
    var sway = Math.sin(t * 2) * 4;
    g.beginPath(); g.moveTo(-22, -150); g.quadraticCurveTo(-46, -70, -50 + sway, 0); g.lineTo(50 + sway, 0); g.quadraticCurveTo(46, -70, 22, -150); g.closePath(); g.fill();
    if (sorc) { // نجوم على الرداء
      for (var i = 0; i < 7; i++) starShape(g, -28 + (i * 23) % 56, -20 - (i * 37) % 110, 4, 1.8, 4, 'rgba(255,230,150,.7)', t + i);
    }
    if (look === 'guard') { g.fillStyle = '#9aa4b0'; g.fillRect(-26, -140, 52, 60); g.strokeStyle = '#5a6470'; g.lineWidth = 2; for (var k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-26, -128 + k * 14); g.lineTo(26, -128 + k * 14); g.stroke(); } }
    if (look === 'merchant' || look === 'bedouin') { g.fillStyle = '#7a4a22'; g.fillRect(-30, -96, 60, 8); }
    // الذراعان
    g.strokeStyle = shade(robe, 0.05); g.lineWidth = 14; g.lineCap = 'round';
    var cast = o.cast || 0;
    g.beginPath(); g.moveTo(-18, -138); g.lineTo(-30, -100); g.stroke();
    g.beginPath(); g.moveTo(18, -138); g.lineTo(34 + cast * 20, -110 - cast * 40); g.stroke();
    g.fillStyle = '#d9a47a'; g.beginPath(); g.arc(-30, -98, 6, 0, TAU); g.fill(); g.beginPath(); g.arc(34 + cast * 20, -110 - cast * 40, 6, 0, TAU); g.fill();
    // ما في اليد
    var hx = 34 + cast * 20, hy = -110 - cast * 40;
    if (sorc || look === 'bedouin' || look === 'elder') {
      g.strokeStyle = look === 'bedouin' ? '#7a5230' : '#4a2a1a'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(hx, hy + 60); g.lineTo(hx + 4, hy - 70); g.stroke();
      if (sorc) {
        var oc = look === 'archsorcerer' ? '#ffcc4a' : (col ? shade(col, 0.5) : '#c08aff');
        var og = g.createRadialGradient(hx + 4, hy - 80, 2, hx + 4, hy - 80, 30 + cast * 20);
        og.addColorStop(0, '#fff'); og.addColorStop(0.3, oc); og.addColorStop(1, hexA(oc, 0));
        g.fillStyle = og; g.beginPath(); g.arc(hx + 4, hy - 80, 30 + cast * 20, 0, TAU); g.fill();
      }
    }
    if (look === 'guard') { g.strokeStyle = '#6a4a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(hx, hy + 70); g.lineTo(hx + 2, hy - 90); g.stroke(); g.fillStyle = '#c8d0da'; g.beginPath(); g.moveTo(hx - 6, hy - 88); g.lineTo(hx + 2, hy - 118); g.lineTo(hx + 10, hy - 88); g.fill(); }
    if (look === 'scholar') { g.fillStyle = '#f2e6c4'; g.fillRect(-44, -112, 26, 20); g.fillStyle = '#8a5a2a'; g.fillRect(-46, -114, 4, 24); g.fillRect(-20, -114, 4, 24); }
    if (look === 'merchant') { g.strokeStyle = '#c9952a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-30, -98); g.lineTo(-30, -70); g.stroke(); g.beginPath(); g.moveTo(-44, -70); g.lineTo(-16, -70); g.stroke(); g.fillStyle = '#c9952a'; g.beginPath(); g.arc(-44, -66, 6, 0, Math.PI); g.arc(-16, -66, 6, 0, Math.PI); g.fill(); }
    // الرأس
    var hood = sorc;
    g.fillStyle = '#d9a47a'; g.beginPath(); g.arc(0, -166, 18, 0, TAU); g.fill();
    if (hood) {
      g.fillStyle = shade(robe, -0.15);
      g.beginPath(); g.moveTo(-26, -150); g.quadraticCurveTo(-30, -196, 0, -206); g.quadraticCurveTo(30, -196, 26, -150); g.quadraticCurveTo(0, -140, -26, -150); g.fill();
      g.fillStyle = 'rgba(10,0,20,.85)'; g.beginPath(); g.ellipse(0, -164, 15, 17, 0, 0, TAU); g.fill();
      var eye = look === 'archsorcerer' ? '#ffcc4a' : '#7affd8';
      g.fillStyle = eye; g.shadowColor = eye; g.shadowBlur = 12;
      g.beginPath(); g.ellipse(-6, -166, 3.5, 2.2, 0, 0, TAU); g.ellipse(7, -166, 3.5, 2.2, 0, 0, TAU); g.fill();
      g.shadowBlur = 0;
      if (look === 'archsorcerer') { starShape(g, 0, -210, 10, 4, 5, '#ffcc4a', -Math.PI / 2); }
      if (look === 'sorceress') { g.strokeStyle = hexA(shade(robe, 0.4), 0.8); g.lineWidth = 6; g.beginPath(); g.moveTo(20, -170); g.quadraticCurveTo(60, -150 + Math.sin(t * 4) * 10, 80, -110 + Math.sin(t * 3) * 14); g.stroke(); }
    } else {
      g.fillStyle = '#222'; g.beginPath(); g.arc(6, -168, 2.3, 0, TAU); g.arc(-5, -168, 2.3, 0, TAU); g.fill();
      g.strokeStyle = '#7a3a2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -160, 5, 0.3, Math.PI - 0.3); g.stroke();
      var beard = look === 'elder' || look === 'scholar' ? '#f4f2ea' : look === 'guard' ? null : '#3a2a1e';
      if (beard) { g.fillStyle = beard; g.beginPath(); g.moveTo(-14, -160); g.quadraticCurveTo(0, -126, 14, -160); g.quadraticCurveTo(0, -150, -14, -160); g.fill(); }
      if (look === 'bedouin') {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -170, 21, Math.PI * 0.9, Math.PI * 2.1); g.fill();
        g.fillStyle = '#c0392b'; for (var c = 0; c < 4; c++) g.fillRect(-16 + c * 9, -186, 4, 4);
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-20, -170); g.lineTo(-24, -136); g.lineTo(-12, -150); g.fill(); g.beginPath(); g.moveTo(20, -170); g.lineTo(24, -136); g.lineTo(12, -150); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -182, 18, 4, 0, 0, TAU); g.stroke();
      } else if (look === 'guard') {
        g.fillStyle = '#8a949e'; g.beginPath(); g.arc(0, -172, 20, Math.PI, TAU); g.fill();
        g.fillRect(-2, -198, 4, 10); g.fillStyle = '#c0392b'; g.beginPath(); g.ellipse(0, -200, 5, 8, 0, 0, TAU); g.fill();
      } else {
        var tur = look === 'elder' || look === 'scholar' ? '#ffffff' : '#f4efe0';
        g.fillStyle = tur; g.beginPath(); g.ellipse(0, -182, 22, 13, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 2; for (var w = 0; w < 3; w++) { g.beginPath(); g.ellipse(0, -182, 20 - w * 5, 11 - w * 3, 0.2, 0, Math.PI); g.stroke(); }
        if (look === 'scholar' && col) { g.fillStyle = col; g.fillRect(-21, -178, 42, 4); }
      }
    }
    g.restore();
  }

  // ------------------------------------------------------------------
  // رجل عربي بالبشت (الشيخ الحكيم، التاجر، البدوي، العالِم)
  // ------------------------------------------------------------------
  var MEN = {
    elder: { bisht: '#5a3420', beard: '#ecebe6', long: 1, head: 'shemagh', hand: 'cane', brow: '#e8e6e0' },
    scholar: { bisht: '#2f5a4a', beard: '#ecebe6', long: 0.8, head: 'turban', hand: 'book', brow: '#e8e6e0' },
    merchant: { bisht: '#8a3e16', beard: '#2a1a10', long: 0.55, head: 'turban', hand: 'scale', brow: '#2a1a10' },
    bedouin: { bisht: '#a8865a', beard: '#1a120a', long: 0.4, head: 'redShemagh', hand: 'staff', brow: '#1a120a' },
  };
  function arabMan(g, t, look, col, o) {
    var m = MEN[look];
    var bisht = col && col !== '#ffffff' ? col : m.bisht;
    var trim = '#c9963a', thobe = '#f3eee2', skin = '#d9a074', skinD = '#b8794e';
    var breathe = Math.sin(t * 1.6) * 1.2;
    var gest = Math.sin(t * 1.3) * 4 + (o.cast || 0) * -14;
    g.save(); g.translate(0, breathe * 0.3);
    // الحذاء
    g.fillStyle = '#3a2a20';
    g.beginPath(); g.ellipse(-10, -3, 16, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(18, -3, 15, 5, 0, 0, TAU); g.fill();
    // البشت (العباءة) من الخلف
    var bg = g.createLinearGradient(-50, -150, 40, 0);
    bg.addColorStop(0, shade(bisht, 0.12)); bg.addColorStop(1, shade(bisht, -0.3));
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(-26, -156); g.quadraticCurveTo(-46, -90, -54, -6); g.lineTo(42, -6); g.quadraticCurveTo(36, -90, 22, -156); g.quadraticCurveTo(-2, -164, -26, -156); g.fill();
    // طيّات البشت
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    [[-34, -120, -42, -10], [-20, -130, -24, -10], [28, -110, 34, -10]].forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); g.quadraticCurveTo(l[0] - 4, (l[1] + l[3]) / 2, l[2], l[3]); g.stroke(); });
    // الثوب الأبيض من الأمام مع حواف البشت الذهبية
    g.fillStyle = thobe;
    g.beginPath(); g.moveTo(-6, -152); g.lineTo(-14, -6); g.lineTo(12, -6); g.lineTo(10, -152); g.fill();
    g.strokeStyle = trim; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-7, -150); g.lineTo(-16, -6); g.moveTo(11, -150); g.lineTo(14, -6); g.stroke();
    g.strokeStyle = 'rgba(255,230,160,.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-9, -150); g.lineTo(-18, -6); g.stroke();
    // الذراع البعيدة ممدودة بإشارة اليد
    g.save(); g.translate(18, -138);
    g.fillStyle = shade(bisht, -0.08);
    g.beginPath(); g.moveTo(-6, -6); g.lineTo(34, 10 + gest * 0.4); g.lineTo(40, 30 + gest * 0.5); g.lineTo(6, 26); g.fill();
    g.fillStyle = trim; g.beginPath(); g.moveTo(34, 10 + gest * 0.4); g.lineTo(40, 30 + gest * 0.5); g.lineTo(37, 30 + gest * 0.5); g.lineTo(31, 11 + gest * 0.4); g.fill();
    g.fillStyle = thobe; g.fillRect(38, 14 + gest * 0.45, 8, 12);
    g.fillStyle = skin;
    var hx = 52, hy = 18 + gest * 0.5;
    g.beginPath(); g.ellipse(hx, hy, 11, 5.5, -0.25, 0, TAU); g.fill();
    for (var fi = 0; fi < 4; fi++) { g.beginPath(); g.ellipse(hx + 9 + fi * 0.5, hy - 5 + fi * 2.6, 6, 2.1, -0.4 + fi * 0.1, 0, TAU); g.fill(); }
    g.beginPath(); g.ellipse(hx - 3, hy - 6, 2.5, 5, 0.6, 0, TAU); g.fill();
    g.restore();
    // الرأس
    g.fillStyle = skin; g.fillRect(-2, -166, 12, 12);
    g.beginPath(); g.ellipse(4, -178, 14, 16, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(15, -184); g.quadraticCurveTo(24, -176, 17, -172); g.fill(); // الأنف
    g.fillStyle = skinD; g.beginPath(); g.arc(-4, -177, 3, 0, TAU); g.fill(); // الأذن
    g.fillStyle = '#1e140c'; g.beginPath(); g.ellipse(10, -182, 2, 2.6, 0, 0, TAU); g.fill();
    g.strokeStyle = m.brow; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(5, -188); g.quadraticCurveTo(10, -191, 15, -188); g.stroke();
    // اللحية
    var L = 30 + m.long * 52;
    g.fillStyle = m.beard;
    g.beginPath(); g.moveTo(-6, -180); g.quadraticCurveTo(-10, -160, -4, -170 + L * 0.6);
    g.quadraticCurveTo(4, -170 + L, 10, -170 + L * 0.95); g.quadraticCurveTo(18, -170 + L * 0.6, 18, -168); g.quadraticCurveTo(10, -170, 4, -168); g.quadraticCurveTo(-2, -172, -6, -180); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
    for (var bl = 0; bl < 4; bl++) { g.beginPath(); g.moveTo(-2 + bl * 5, -164); g.quadraticCurveTo(0 + bl * 5, -170 + L * 0.6, 4 + bl * 3, -172 + L * 0.9); g.stroke(); }
    g.fillStyle = m.beard; g.beginPath(); g.ellipse(14, -170, 7, 3, -0.2, 0, TAU); g.fill(); // الشارب
    // غطاء الرأس
    if (m.head === 'turban') {
      var tc = look === 'merchant' ? '#efe2c4' : '#ffffff';
      g.fillStyle = tc; g.beginPath(); g.ellipse(2, -192, 19, 12, -0.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2;
      for (var w = 0; w < 3; w++) { g.beginPath(); g.ellipse(2, -192 + w * 2, 18 - w * 4, 9 - w * 2, -0.25, 0.1, Math.PI); g.stroke(); }
      if (look === 'scholar' && col) { g.fillStyle = col; g.fillRect(-16, -188, 34, 3); }
    } else {
      var red = m.head === 'redShemagh';
      g.fillStyle = '#fbf9f2';
      g.beginPath(); g.moveTo(-12, -172); g.quadraticCurveTo(-14, -202, 4, -200); g.quadraticCurveTo(20, -200, 18, -188); g.lineTo(-2, -186);
      g.quadraticCurveTo(-8, -168, -6, -150); g.quadraticCurveTo(-26, -140, -32, -112); g.quadraticCurveTo(-34, -146, -12, -172); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-10, -180); g.quadraticCurveTo(-22, -150, -28, -120); g.stroke();
      if (red) { g.fillStyle = '#c0392b'; for (var rx = 0; rx < 5; rx++) for (var ry = 0; ry < 3; ry++) g.fillRect(-10 + rx * 5.5, -198 + ry * 5, 2.4, 2.4); }
      g.fillStyle = '#1a1414';
      g.beginPath(); g.ellipse(3, -197, 15, 3.6, -0.08, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(3, -192.5, 15, 3.2, -0.08, 0, TAU); g.fill();
    }
    // الذراع القريبة وما تحمله
    g.fillStyle = shade(bisht, 0.05);
    g.beginPath(); g.moveTo(-20, -150); g.quadraticCurveTo(-30, -120, -18, -100); g.lineTo(2, -98); g.quadraticCurveTo(-4, -128, 4, -148); g.fill();
    g.fillStyle = trim; g.fillRect(-18, -103, 21, 4);
    g.fillStyle = thobe; g.fillRect(-14, -100, 13, 5);
    var px = -6, py = -92;
    if (m.hand === 'cane' || m.hand === 'staff') {
      g.strokeStyle = m.hand === 'cane' ? '#6a3e1e' : '#7a5230'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(px - 1, m.hand === 'cane' ? py - 2 : py - 70);
      for (var k = 1; k <= 8; k++) g.lineTo(px + Math.sin(k * 1.7) * 1.6, py + k * 11.5);
      g.stroke();
      if (m.hand === 'staff') { g.beginPath(); g.arc(px - 4, py - 72, 6, Math.PI * 0.2, Math.PI * 1.4); g.stroke(); }
    } else if (m.hand === 'book') {
      g.fillStyle = '#7a4a1a'; g.fillRect(px - 16, py - 10, 22, 18); g.fillStyle = '#f2e6c4'; g.fillRect(px - 14, py - 8, 18, 14);
      g.strokeStyle = '#c9963a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px - 5, py - 8); g.lineTo(px - 5, py + 6); g.stroke();
    } else if (m.hand === 'scale') {
      g.strokeStyle = '#c9952a'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 26); g.moveTo(px - 16, py + 26); g.lineTo(px + 16, py + 26); g.stroke();
      g.fillStyle = '#c9952a'; g.beginPath(); g.arc(px - 16, py + 31, 7, 0, Math.PI); g.arc(px + 16, py + 31, 7, 0, Math.PI); g.fill();
    }
    g.fillStyle = skin; g.beginPath(); g.ellipse(px, py, 7, 6, 0, 0, TAU); g.fill();
    g.fillStyle = skinD; g.beginPath(); g.ellipse(px + 3, py + 1, 3, 4, 0, 0, TAU); g.fill();
    // هالة هادئة لشيخ الحكمة
    if (look === 'elder') {
      g.globalCompositeOperation = 'lighter';
      var ha = g.createRadialGradient(4, -178, 10, 4, -178, 60);
      ha.addColorStop(0, 'rgba(255,230,160,.18)'); ha.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = ha; g.beginPath(); g.arc(4, -178, 60, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  // ------------------------------------------------------------------
  // الساحر: رداء أسود بحواف ذهبية، حزام قرمزي، عصا بلورية ودخان سحري
  // ------------------------------------------------------------------
  function sorcerer(g, t, look, col, o) {
    var c = col || '#6b3fa0';
    var arch = look === 'archsorcerer', lady = look === 'sorceress';
    var magic = shade(c, 0.35), magicD = shade(c, -0.2);
    var gold = '#c8963e', robe = '#18131a', crimson = '#8a1c2c';
    var cast = o.cast || 0;
    var sway = Math.sin(t * 1.8) * 3;
    g.save(); if (arch) g.scale(1.18, 1.18);
    // البطانة/الوشاح الملوّن خلف الساحر بحافة ممزّقة متموّجة
    g.fillStyle = shade(c, -0.35);
    g.beginPath(); g.moveTo(-18, -160);
    g.quadraticCurveTo(-58, -110, -70 + sway, -30);
    for (var r = 0; r < 6; r++) g.lineTo(-70 + sway + r * 9 + (r % 2 ? 4 : 0), -18 + (r % 2 ? -10 : 6) + Math.sin(t * 4 + r) * 3);
    g.lineTo(-10, -40); g.closePath(); g.fill();
    // الحذاء المدبّب
    g.fillStyle = '#111';
    g.beginPath(); g.moveTo(-18, -6); g.lineTo(2, -6); g.lineTo(10, -10); g.lineTo(4, 0); g.lineTo(-18, 0); g.fill();
    g.beginPath(); g.moveTo(14, -6); g.lineTo(34, -6); g.lineTo(44, -12); g.lineTo(36, 0); g.lineTo(14, 0); g.fill();
    // الرداء الأسود المتّسع
    var rg = g.createLinearGradient(-40, -160, 40, 0);
    rg.addColorStop(0, '#2c2230'); rg.addColorStop(1, robe);
    g.fillStyle = rg;
    g.beginPath(); g.moveTo(-24, -156); g.quadraticCurveTo(-40, -80, -50 + sway, -6); g.lineTo(52 + sway, -6); g.quadraticCurveTo(38, -80, 24, -156); g.quadraticCurveTo(0, -164, -24, -156); g.fill();
    // حواف ذهبية مزخرفة (الذيل وفتحة الأمام)
    g.strokeStyle = gold; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-50 + sway, -12); g.lineTo(52 + sway, -12); g.stroke();
    g.lineWidth = 1.6; g.beginPath();
    for (var z = 0; z < 16; z++) { var zx = -46 + sway + z * 6.2; g.lineTo(zx, z % 2 ? -22 : -15); }
    g.stroke();
    g.strokeStyle = gold; g.lineWidth = 3;
    g.beginPath(); g.moveTo(4, -150); g.quadraticCurveTo(2, -80, 8 + sway * 0.6, -12); g.stroke();
    g.lineWidth = 1.2; g.beginPath();
    for (var z2 = 0; z2 < 12; z2++) { var zy = -140 + z2 * 10.5; g.lineTo(9 + (z2 % 2 ? 4 : 0) + sway * 0.4 * (z2 / 12), zy); }
    g.stroke();
    // الحزام القرمزي ودلّاية ماسية
    g.fillStyle = crimson; g.beginPath(); g.moveTo(-24, -104); g.lineTo(28, -104); g.lineTo(28, -91); g.lineTo(-24, -91); g.fill();
    g.fillStyle = shade(crimson, -0.2); g.beginPath(); g.moveTo(-2, -92); g.lineTo(8, -92); g.lineTo(12 + sway * 0.5, -48); g.lineTo(0 + sway * 0.5, -50); g.fill();
    g.fillStyle = gold; g.beginPath(); g.moveTo(4, -106); g.lineTo(10, -97.5); g.lineTo(4, -89); g.lineTo(-2, -97.5); g.fill();
    g.fillStyle = magic; g.beginPath(); g.moveTo(4, -101); g.lineTo(6.5, -97.5); g.lineTo(4, -94); g.lineTo(1.5, -97.5); g.fill();
    g.fillStyle = gold; g.beginPath(); g.moveTo(6 + sway * 0.5, -48); g.lineTo(10 + sway * 0.5, -40); g.lineTo(6 + sway * 0.5, -32); g.lineTo(2 + sway * 0.5, -40); g.fill();
    // الذراع البعيدة تمدّ اليد بالسحر نحو الفارس
    var ax = 50 + cast * 16, ay = -122 - cast * 24;
    g.fillStyle = '#231b26';
    g.beginPath(); g.moveTo(14, -150); g.lineTo(ax - 4, ay - 8); g.lineTo(ax + 2, ay + 14); g.lineTo(8, -112); g.fill();
    g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.moveTo(ax - 4, ay - 8); g.lineTo(ax + 2, ay + 14); g.stroke();
    g.fillStyle = '#c08a64';
    g.beginPath(); g.ellipse(ax + 9, ay + 3, 8, 6, -0.3, 0, TAU); g.fill();
    g.strokeStyle = '#c08a64'; g.lineWidth = 2.6; g.lineCap = 'round';
    for (var cl = 0; cl < 4; cl++) { g.beginPath(); g.moveTo(ax + 13, ay - 1 + cl * 3); g.quadraticCurveTo(ax + 22, ay - 6 + cl * 3, ax + 24, ay + 1 + cl * 4); g.stroke(); }
    // الدخان السحري المتلوّي
    g.save(); g.globalCompositeOperation = 'lighter';
    for (var sm = 0; sm < 5; sm++) {
      var ph = t * 2 + sm * 1.3;
      g.strokeStyle = hexA(sm % 2 ? magic : c, 0.55 + cast * 0.3);
      g.lineWidth = 6 - sm * 0.8 + cast * 3; g.lineCap = 'round';
      var sx = ax + 22, sy = ay - 4;
      g.beginPath(); g.moveTo(sx, sy);
      g.bezierCurveTo(sx + 14 + Math.sin(ph) * 10, sy - 18 - sm * 6, sx - 8 + Math.cos(ph * 1.3) * 12, sy - 34 - sm * 8, sx + 10 + Math.sin(ph * 0.8) * 14, sy - 52 - sm * 10 - cast * 20);
      g.stroke();
    }
    var og = g.createRadialGradient(ax + 22, ay - 6, 2, ax + 22, ay - 6, 26 + cast * 20);
    og.addColorStop(0, hexA(magic, 0.8)); og.addColorStop(1, hexA(c, 0));
    g.fillStyle = og; g.beginPath(); g.arc(ax + 22, ay - 6, 26 + cast * 20, 0, TAU); g.fill();
    g.restore();
    // الرأس: عمامة داكنة بعصابة ملوّنة وجوهرة، ووجه في الظل بعينين متوهجتين
    g.fillStyle = '#7a5a4a'; g.fillRect(-6, -168, 12, 12);
    g.fillStyle = '#5a4038'; g.beginPath(); g.ellipse(0, -178, 14, 15, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(10,0,20,.55)'; g.beginPath(); g.ellipse(2, -176, 14, 13, 0, 0, TAU); g.fill();
    var eye = arch ? '#ffcc4a' : magic;
    g.fillStyle = eye; g.shadowColor = eye; g.shadowBlur = 12;
    g.beginPath(); g.ellipse(6, -180, 3.4, 2, -0.15, 0, TAU); g.ellipse(13, -180.5, 2.6, 1.8, -0.15, 0, TAU); g.fill();
    g.shadowBlur = 0;
    // العمامة
    g.fillStyle = '#1a1418'; g.beginPath(); g.ellipse(0, -193, 18, 13, -0.08, 0, TAU); g.fill();
    g.fillStyle = crimson; g.beginPath(); g.ellipse(1, -188, 18, 4.5, -0.08, 0, TAU); g.fill();
    g.fillStyle = gold; g.beginPath(); g.ellipse(14, -190, 4.5, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = magicD; g.beginPath(); g.ellipse(14, -190, 2.6, 3.4, 0, 0, TAU); g.fill();
    // ذيل العمامة الملوّن على الكتف
    g.fillStyle = shade(c, -0.1);
    g.beginPath(); g.moveTo(-12, -196); g.quadraticCurveTo(-34, -170 + sway, -30, -128 + sway); g.lineTo(-18, -134 + sway); g.quadraticCurveTo(-22, -166, -6, -186); g.fill();
    if (lady) { g.fillStyle = hexA(magic, 0.7); g.beginPath(); g.moveTo(-4, -174); g.quadraticCurveTo(10, -168, 20, -174); g.lineTo(18, -162); g.quadraticCurveTo(8, -158, -2, -164); g.fill(); }
    if (arch) { for (var sp = 0; sp < 5; sp++) starShape(g, -12 + sp * 6.5, -206 - (sp % 2) * 4, 4, 1.6, 4, gold, 0); }
    // العصا الملتوية برأس شائك وبلّورة متوهجة
    var stx = -34, sty = -100;
    g.strokeStyle = '#2a1a16'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(stx + 2, 4);
    for (var sk = 1; sk <= 12; sk++) g.lineTo(stx + Math.sin(sk * 1.3) * 2.2, 4 - sk * 21);
    g.stroke();
    g.fillStyle = gold; [-40, -120, -190].forEach(function (yy) { g.fillRect(stx - 4, yy, 8, 4); });
    var cy = -258 + Math.sin(t * 3) * 2;
    // المخالب الشائكة خلف البلّورة
    g.strokeStyle = '#2a1a16'; g.lineWidth = 4; g.lineCap = 'round';
    [[-1, 0], [1, 0], [-0.5, 1], [0.5, 1]].forEach(function (d) { g.beginPath(); g.moveTo(stx, cy + 22); g.quadraticCurveTo(stx + d[0] * 22, cy + 8, stx + d[0] * (14 - d[1] * 6), cy - 18 - d[1] * 6); g.stroke(); });
    var cg2 = g.createRadialGradient(stx, cy, 2, stx, cy, 40 + cast * 18);
    cg2.addColorStop(0, hexA(magic, 0.9)); cg2.addColorStop(1, hexA(c, 0));
    g.fillStyle = cg2; g.beginPath(); g.arc(stx, cy, 40 + cast * 18, 0, TAU); g.fill();
    // البلّورة
    g.fillStyle = magicD; g.beginPath(); g.moveTo(stx, cy - 22); g.lineTo(stx + 11, cy - 2); g.lineTo(stx, cy + 16); g.lineTo(stx - 11, cy - 2); g.fill();
    g.fillStyle = magic; g.beginPath(); g.moveTo(stx, cy - 22); g.lineTo(stx + 11, cy - 2); g.lineTo(stx, cy + 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(stx - 1, cy - 17); g.lineTo(stx + 4, cy - 4); g.lineTo(stx - 3, cy - 5); g.fill();
    // الذراع القريبة تمسك العصا
    g.fillStyle = '#231b26';
    g.beginPath(); g.moveTo(-18, -150); g.quadraticCurveTo(-34, -130, -36, -108); g.lineTo(-22, -104); g.quadraticCurveTo(-18, -128, -6, -146); g.fill();
    g.strokeStyle = gold; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-37, -108); g.lineTo(-21, -104); g.stroke();
    g.fillStyle = '#c08a64'; g.beginPath(); g.ellipse(-32, -100, 7, 6, 0, 0, TAU); g.fill();
    g.restore();
  }

  function owl(g, t) {
    g.fillStyle = '#6a4a2a'; g.fillRect(-6, -90, 12, 90); g.fillRect(-40, -92, 80, 10);
    var blink = (Math.sin(t * 1.3) > 0.97) ? 0.15 : 1;
    var bg = g.createRadialGradient(0, -150, 10, 0, -140, 60); bg.addColorStop(0, '#c99a6a'); bg.addColorStop(1, '#7a5230');
    g.fillStyle = bg; g.beginPath(); g.ellipse(0, -140, 44, 54, 0, 0, TAU); g.fill();
    g.fillStyle = '#e9d2a8'; g.beginPath(); g.ellipse(0, -128, 28, 34, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a5230'; g.beginPath(); g.moveTo(-40, -182); g.lineTo(-30, -204); g.lineTo(-18, -186); g.fill(); g.beginPath(); g.moveTo(40, -182); g.lineTo(30, -204); g.lineTo(18, -186); g.fill();
    [-16, 16].forEach(function (ex) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, -160, 15, 0, TAU); g.fill();
      g.fillStyle = '#ffb02a'; g.beginPath(); g.ellipse(ex, -160, 10, 10 * blink, 0, 0, TAU); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.ellipse(ex, -160, 5, 5 * blink, 0, 0, TAU); g.fill();
    });
    g.fillStyle = '#e8a23a'; g.beginPath(); g.moveTo(-5, -146); g.lineTo(0, -134); g.lineTo(5, -146); g.fill();
    // قبعة العالِم
    g.fillStyle = '#1a2a4a'; g.fillRect(-26, -206, 52, 8); g.beginPath(); g.moveTo(-36, -206); g.lineTo(0, -222); g.lineTo(36, -206); g.fill();
    g.strokeStyle = '#ffcc4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, -206); g.lineTo(34, -186 + Math.sin(t * 3) * 3); g.stroke();
    // أرجل
    g.strokeStyle = '#e8a23a'; g.lineWidth = 3; [-12, 12].forEach(function (fx) { g.beginPath(); g.moveTo(fx, -92); g.lineTo(fx - 4, -86); g.moveTo(fx, -92); g.lineTo(fx + 4, -86); g.stroke(); });
  }

  function stoneGolem(g, t, col) {
    var c = col || '#7a6a5a';
    var glow = 0.5 + 0.5 * Math.sin(t * 3);
    [[0, -70, 52, 64], [0, -150, 40, 34], [-56, -110, 20, 44], [56, -110, 20, 44], [0, -196, 26, 24]].forEach(function (b, i) {
      var gr = g.createLinearGradient(b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3]);
      gr.addColorStop(0, shade(c, 0.25)); gr.addColorStop(1, shade(c, -0.35));
      g.fillStyle = gr; g.beginPath(); g.ellipse(b[0], b[1], b[2], b[3], 0.1 * (i - 2), 0, TAU); g.fill();
    });
    g.strokeStyle = 'rgba(255,170,60,' + (0.4 + glow * 0.6) + ')'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-20, -100); g.lineTo(-5, -70); g.lineTo(-18, -40); g.moveTo(15, -130); g.lineTo(25, -95); g.stroke();
    g.fillStyle = '#ffb03a'; g.shadowColor = '#ffb03a'; g.shadowBlur = 14;
    g.beginPath(); g.ellipse(-9, -198, 5, 3, 0, 0, TAU); g.ellipse(9, -198, 5, 3, 0, 0, TAU); g.fill(); g.shadowBlur = 0;
  }

  function sandLord(g, t, col) {
    var c = col || '#c9902a';
    // دوّامة رمل في الأسفل
    for (var i = 0; i < 30; i++) {
      var a = t * 4 + i * 0.7; var r = 10 + (i % 10) * 5;
      g.fillStyle = hexA(shade(c, (i % 3) * 0.15), 0.7);
      g.beginPath(); g.arc(Math.cos(a) * r, -10 - i * 3 + Math.sin(a) * 4, 3, 0, TAU); g.fill();
    }
    sorcerer(g, t, 'sorcerer', c, {});
  }

  function hexA(hex, a) {
    if (hex.indexOf('rgb') === 0) return hex.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ------------------------------------------------------------------
  // عناصر الرحلة
  // ------------------------------------------------------------------
  function obstacle(g, type, x, t) {
    g.save(); g.translate(x, GY + 6);
    if (type === 'rock') {
      var rg = g.createLinearGradient(-30, -50, 30, 0); rg.addColorStop(0, '#b59a7a'); rg.addColorStop(1, '#6a5240');
      g.fillStyle = rg; g.beginPath(); g.moveTo(-34, 0); g.lineTo(-26, -34); g.lineTo(-4, -48); g.lineTo(22, -36); g.lineTo(34, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(-22, -32); g.lineTo(-4, -44); g.lineTo(0, -30); g.fill();
    } else if (type === 'scorpion') {
      var k = Math.sin(t * 8) * 3;
      g.fillStyle = '#3a2a1e';
      g.beginPath(); g.ellipse(0, -10, 20, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3a2a1e'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(16, -12); g.quadraticCurveTo(40, -20, 34, -46 + k); g.quadraticCurveTo(28, -56 + k, 20, -48 + k); g.stroke();
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(20, -48 + k, 4, 0, TAU); g.fill();
      g.lineWidth = 3; for (var l = -1; l <= 1; l++) { g.beginPath(); g.moveTo(-4 + l * 8, -6); g.lineTo(-8 + l * 8, 2); g.stroke(); }
      g.lineWidth = 4; g.beginPath(); g.moveTo(-18, -12); g.lineTo(-32, -18); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-12, -14, 2.4, 0, TAU); g.fill();
    } else if (type === 'thorn') {
      g.strokeStyle = '#6a7a3a'; g.lineWidth = 3;
      for (var b = 0; b < 9; b++) { var a = -Math.PI / 2 + (b - 4) * 0.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 46, Math.sin(a) * 40); g.stroke(); }
      g.fillStyle = '#8a9a4a'; for (var d = 0; d < 12; d++) { g.beginPath(); g.arc(Math.cos(d) * 22, -18 - (d % 4) * 6, 4, 0, TAU); g.fill(); }
    } else if (type === 'column') {
      g.fillStyle = '#5a5248'; g.beginPath(); g.ellipse(0, -18, 54, 18, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a7266'; g.beginPath(); g.ellipse(-48, -18, 10, 18, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (var s = -3; s <= 3; s++) { g.beginPath(); g.moveTo(-40, -18 + s * 4); g.lineTo(50, -18 + s * 4); g.stroke(); }
    }
    g.restore();
  }

  function pickup(g, type, x, y, t) {
    g.save(); g.translate(x, y + Math.sin(t * 4 + x * 0.01) * 5);
    var gl = g.createRadialGradient(0, 0, 2, 0, 0, 28); gl.addColorStop(0, type === 'water' ? 'rgba(120,200,255,.6)' : 'rgba(255,210,120,.6)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill();
    if (type === 'water') {
      g.fillStyle = '#3f8fd0'; g.beginPath(); g.moveTo(-12, -6); g.quadraticCurveTo(-16, 16, 0, 16); g.quadraticCurveTo(16, 16, 12, -6); g.quadraticCurveTo(0, -12, -12, -6); g.fill();
      g.fillStyle = '#7a5230'; g.fillRect(-4, -16, 8, 8);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-5, 2, 3, 6, 0.3, 0, TAU); g.fill();
    } else {
      g.fillStyle = '#7a3a12'; g.beginPath(); g.ellipse(0, 0, 9, 14, 0.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,200,140,.5)'; g.beginPath(); g.ellipse(-3, -4, 2.5, 6, 0.4, 0, TAU); g.fill();
      g.fillStyle = '#c9a050'; g.fillRect(-2, -16, 4, 5);
    }
    g.restore();
  }

  function falcon(g, x, y, t, dir) {
    var flap = Math.sin(t * 14);
    g.save(); g.translate(x, y); g.scale(dir || 1, 1);
    g.fillStyle = '#7a5a3a';
    g.beginPath(); g.ellipse(0, 0, 16, 8, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(-4, -28 * flap, 18, -22 * flap); g.lineTo(8, 2); g.fill();
    g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(14, -4, 7, 0, TAU); g.fill();
    g.fillStyle = '#5a3a20'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-28, -4); g.lineTo(-26, 6); g.fill();
    g.fillStyle = '#e8a23a'; g.beginPath(); g.moveTo(20, -5); g.lineTo(26, -2); g.lineTo(20, 0); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(16, -6, 1.6, 0, TAU); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------------
  // خريطة الرحلة (مخطوطة)
  // ------------------------------------------------------------------
  var MAP_PTS = [[1010, 120], [985, 205], [930, 295], [870, 380], [790, 470], [735, 565], [760, 665], [670, 790]];

  function map(g, t, progress, current, vw) {
    // ورق قديم
    var pg = g.createRadialGradient(800, 450, 100, 800, 450, 900);
    pg.addColorStop(0, '#f6e7c4'); pg.addColorStop(1, '#d9b982');
    g.fillStyle = pg; g.fillRect(-vw, -100, W + vw * 2, H + 200);
    var r = rr(3);
    g.fillStyle = 'rgba(120,80,30,.07)';
    for (var i = 0; i < 260; i++) { g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 14, 0, TAU); g.fill(); }
    // البحر الأحمر
    g.fillStyle = 'rgba(70,130,160,.28)';
    g.beginPath(); g.moveTo(220, 900); g.quadraticCurveTo(420, 600, 560, 360); g.quadraticCurveTo(620, 260, 640, 180); g.lineTo(560, 160); g.quadraticCurveTo(500, 380, 300, 650); g.quadraticCurveTo(200, 800, 120, 900); g.fill();
    g.strokeStyle = 'rgba(40,90,120,.35)'; g.lineWidth = 2;
    for (var w = 0; w < 7; w++) { var wx = 360 + w * 30, wy = 720 - w * 70; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 10, wy - 8, wx + 20, wy); g.quadraticCurveTo(wx + 30, wy + 8, wx + 40, wy); g.stroke(); }
    // كثبان مرسومة بالحبر
    g.strokeStyle = 'rgba(120,80,40,.35)'; g.lineWidth = 2;
    for (var d = 0; d < 14; d++) { var dx = 1100 + (d % 4) * 90, dy = 300 + Math.floor(d / 4) * 120; g.beginPath(); g.arc(dx, dy, 26, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    // أسماء المناطق
    g.fillStyle = 'rgba(90,55,20,.55)'; g.textAlign = 'center';
    g.font = "900 34px 'Jannat LT', serif"; g.fillText('بلاد الشام', 1320, 230);
    g.fillText('الحجاز', 520, 700);
    g.font = "700 26px 'Jannat LT', serif"; g.fillText('البحر الأحمر', 360, 520);
    g.fillText('صحراء النفود', 1270, 440);
    // وردة الاتجاهات
    g.save(); g.translate(1380, 760); g.rotate(Math.sin(t * 0.3) * 0.03);
    starShape(g, 0, 0, 60, 14, 4, 'rgba(120,70,20,.6)', -Math.PI / 2);
    starShape(g, 0, 0, 36, 10, 4, 'rgba(200,150,60,.7)', -Math.PI / 4);
    g.fillStyle = 'rgba(90,55,20,.8)'; g.font = "900 22px 'Jannat LT', serif"; g.fillText('ش', 0, -70);
    g.restore();
    // الطريق: مُنجز بالحبر، والباقي منقّط
    g.lineCap = 'round';
    for (var s = 0; s < MAP_PTS.length - 1; s++) {
      var a = MAP_PTS[s], b = MAP_PTS[s + 1];
      var done = s < progress - 1;
      g.strokeStyle = done ? '#7a2a12' : 'rgba(90,55,20,.5)'; g.lineWidth = done ? 6 : 4;
      g.setLineDash(done ? [] : [10, 12]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + (s % 2 ? 40 : -40), (a[1] + b[1]) / 2, b[0], b[1]); g.stroke();
    }
    g.setLineDash([]);
    // إطار زخرفي
    g.strokeStyle = 'rgba(122,74,30,.7)'; g.lineWidth = 6; g.strokeRect(24, 24, W - 48, H - 48);
    g.lineWidth = 2; g.strokeRect(38, 38, W - 76, H - 76);
    for (var c = 0; c < 4; c++) { var cx = c % 2 ? W - 38 : 38, cy = c < 2 ? 38 : H - 38; starShape(g, cx, cy, 18, 8, 8, 'rgba(160,100,30,.8)', t * 0.2); }
  }

  var API = { setBackdrop: setBackdrop, W: W, H: H, GY: GY, THEMES: THEMES, MAP_PTS: MAP_PTS, world: world, knight: knight, person: person, obstacle: obstacle, pickup: pickup, falcon: falcon, map: map, starShape: starShape, shade: shade, hexA: hexA, palm: palm, minaret: minaret, dome: dome };
  root.KnightArt = API;
})(window);
