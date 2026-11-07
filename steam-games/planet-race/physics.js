/* ===============================================================
   سباق الكواكب — الفيزياء (بدون أي اعتماد على المتصفح)
   الإحداثيات: الشمس في (0,0)، المحور y للأعلى، الوحدة = بكسل افتراضي، الزمن = ثانية.
   يعمل في المتصفح (window.PlanetPhysics) وفي Node للاختبارات.
   =============================================================== */
(function (root) {
  'use strict';

  var WORLD = Object.freeze({
    GM: 4e6,           // جاذبية الشمس (مضبوطة لتبدو جميلة على الشاشة)
    sunRadius: 55,
    sunHit: 50,        // الاقتراب أكثر من هذا = احتراق
    earthOrbit: 230,   // منصة الإطلاق أسفل الشمس
    launchSpeed: 300,  // السرعة عند القوة المتوسطة
    minAngle: 10,      // حدود التصويب بالدرجات (0 = يمين، 180 = يسار)
    maxAngle: 170,
    escapeRadius: 650, // الابتعاد أكثر من هذا = ضاع في الفضاء
    maxFlight: 7,
    worldRadius: 560,  // نصف قطر المشهد المرئي
  });

  /** القوى الخمس: مضاعف سرعة الإطلاق */
  var POWERS = Object.freeze([0.85, 0.95, 1.05, 1.15, 1.25]);

  var PLANETS = Object.freeze([
    {
      id: 'mars', name: 'المريخ', orbit: 330, radius: 30, color: '#ff6b3d', glow: '#ff9a6b',
      facts: [
        'المريخ يُسمّى «الكوكب الأحمر» لأن تربته فيها صدأ الحديد!',
        'على المريخ أعلى بركان في المجموعة الشمسية: أوليمبوس مونس، أعلى من إيفرست 3 مرات تقريباً!',
        'يوم المريخ أطول من يومنا بـ 37 دقيقة فقط.',
        'للمريخ قمران صغيران: فوبوس وديموس.',
      ],
    },
    {
      id: 'jupiter', name: 'المشتري', orbit: 420, radius: 44, color: '#e0a96d', glow: '#f3cf9b',
      facts: [
        'المشتري أكبر كواكب المجموعة الشمسية، يتّسع لأكثر من 1300 أرض!',
        'البقعة الحمراء العظيمة على المشتري عاصفة أكبر من كوكب الأرض.',
        'المشتري كوكب غازي — لا يوجد سطح صلب تقف عليه!',
        'يوم المشتري أقصر من 10 ساعات، فهو أسرع الكواكب دوراناً حول نفسه.',
      ],
    },
    {
      id: 'saturn', name: 'زحل', orbit: 500, radius: 38, color: '#f2d27a', glow: '#fff0b8', rings: true,
      facts: [
        'حلقات زحل مصنوعة من قطع ثلج وصخور، بعضها بحجم بيت!',
        'زحل خفيف جداً: لو وُجد حوض ماء ضخم لطفا زحل فوقه!',
        'لزحل أكثر من 140 قمراً، أكبرها تيتان.',
        'كلما ابتعد الكوكب عن الشمس دار حولها أبطأ — هذا قانون كبلر!',
      ],
    },
  ]);

  function planetById(id) {
    for (var i = 0; i < PLANETS.length; i++) if (PLANETS[i].id === id) return PLANETS[i];
    return null;
  }

  /** قانون كبلر الثالث لمدار دائري: ω = √(GM / r³) */
  function angularSpeed(orbit, GM) {
    return Math.sqrt((GM || WORLD.GM) / Math.pow(orbit, 3));
  }

  function clampAngle(deg) {
    return Math.max(WORLD.minAngle, Math.min(WORLD.maxAngle, deg));
  }

  /** زاوية الكوكب في اللحظة t */
  function planetAngle(orbit, theta0, t) {
    return theta0 + angularSpeed(orbit) * t;
  }

  function planetPos(orbit, theta0, t) {
    var a = planetAngle(orbit, theta0, t);
    return { x: orbit * Math.cos(a), y: orbit * Math.sin(a), a: a };
  }

  /** صاروخ جديد على منصة الإطلاق */
  function createRocket(angleDeg, power) {
    var a = (clampAngle(angleDeg) * Math.PI) / 180;
    var v = WORLD.launchSpeed * (power || 1);
    return {
      x: 0, y: -WORLD.earthOrbit, vx: v * Math.cos(a), vy: v * Math.sin(a),
      t: 0, done: false, outcome: null, closest: Infinity, crossing: null, trail: [[0, -WORLD.earthOrbit]],
    };
  }

  function normAngle(a) {
    var t = 2 * Math.PI;
    a = ((a % t) + t) % t;
    return a > Math.PI ? a - t : a;
  }

  /**
   * يحرّك الصاروخ dt ثانية تحت جاذبية الشمس (خطوات صغيرة ثابتة 1/240 ثانية).
   * target: { orbit, radius, theta0, launchTime } — launchTime هو زمن الكوكب لحظة الإطلاق.
   * عند انتهاء الرحلة يضع rocket.outcome = 'landed' | 'burned' | 'lost' | 'flyby'
   */
  function stepRocket(rocket, dt, target) {
    var h = 1 / 240;
    var hitR = target.radius + 14;
    var flybyR = target.radius + 75;
    var steps = Math.max(1, Math.round(dt / h));
    for (var i = 0; i < steps && !rocket.done; i++) {
      var r = Math.hypot(rocket.x, rocket.y);
      var k = -WORLD.GM / (r * r * r);
      rocket.vx += k * rocket.x * h;
      rocket.vy += k * rocket.y * h;
      var prevR = r;
      rocket.x += rocket.vx * h;
      rocket.y += rocket.vy * h;
      rocket.t += h;
      var nr = Math.hypot(rocket.x, rocket.y);
      var p = planetPos(target.orbit, target.theta0, target.launchTime + rocket.t);
      var d = Math.hypot(rocket.x - p.x, rocket.y - p.y);
      if (d < rocket.closest) rocket.closest = d;
      if (!rocket.crossing && prevR < target.orbit && nr >= target.orbit) {
        // هل وصل الصاروخ قبل الكوكب أم بعده؟ (الكوكب يدور عكس عقارب الساعة)
        rocket.crossing = { t: rocket.t, ahead: normAngle(Math.atan2(rocket.y, rocket.x) - p.a) };
      }
      if (d <= hitR) { finish(rocket, 'landed'); rocket.landAngle = Math.atan2(rocket.y - p.y, rocket.x - p.x) - p.a; }
      else if (nr < WORLD.sunHit) finish(rocket, 'burned');
      else if (nr > WORLD.escapeRadius || rocket.t > WORLD.maxFlight) {
        finish(rocket, rocket.closest <= flybyR ? 'flyby' : 'lost');
      }
    }
    var last = rocket.trail[rocket.trail.length - 1];
    if (Math.hypot(rocket.x - last[0], rocket.y - last[1]) > 6 || rocket.done) rocket.trail.push([rocket.x, rocket.y]);
    return rocket;
  }

  function finish(rocket, outcome) {
    rocket.done = true;
    rocket.outcome = outcome;
  }

  /**
   * مسار متوقّع (للمساعد البصري) — لا يعتمد على الكوكب.
   * يتوقف عند الشمس أو حافة المشهد أو بعد maxT ثانية.
   */
  function predictPath(angleDeg, power, maxT) {
    var r = createRocket(angleDeg, power);
    var pts = [[r.x, r.y]];
    var h = 1 / 120;
    for (var t = 0; t < maxT; t += h) {
      var d = Math.hypot(r.x, r.y);
      var k = -WORLD.GM / (d * d * d);
      r.vx += k * r.x * h; r.vy += k * r.y * h;
      r.x += r.vx * h; r.y += r.vy * h;
      pts.push([r.x, r.y]);
      var nd = Math.hypot(r.x, r.y);
      if (nd < WORLD.sunHit || nd > WORLD.escapeRadius) break;
    }
    return pts;
  }

  /** زمن وصول الصاروخ إلى مدار معيّن (أو null) — يستخدمه المساعد لتحديد طول المسار المتوقّع */
  function timeToOrbit(angleDeg, power, orbit) {
    var r = createRocket(angleDeg, power);
    var h = 1 / 240;
    for (var t = 0; t < WORLD.maxFlight; t += h) {
      var d = Math.hypot(r.x, r.y);
      if (d >= orbit) return t;
      if (d < WORLD.sunHit) return null;
      var k = -WORLD.GM / (d * d * d);
      r.vx += k * r.x * h; r.vy += k * r.y * h;
      r.x += r.vx * h; r.y += r.vy * h;
    }
    return null;
  }

  /** النقاط: هبوط 3، مرور قريب 1 */
  function pointsFor(outcome) {
    return outcome === 'landed' ? 3 : outcome === 'flyby' ? 1 : 0;
  }

  /** النجوم في وضع اللاعب الواحد حسب رقم المحاولة التي نجحت (1..3) */
  function starsFor(attempt) {
    return attempt <= 1 ? 3 : attempt === 2 ? 2 : attempt === 3 ? 1 : 0;
  }

  /** نصيحة علمية بعد محاولة فاشلة */
  function adviceFor(rocket, planetName) {
    if (rocket.outcome === 'burned') return 'صوّبت قريباً من الشمس فسحبتها جاذبيتها! ابتعد بزاوية الإطلاق عنها.';
    if (rocket.crossing) {
      return rocket.crossing.ahead > 0
        ? 'وصل صاروخك قبل ' + planetName + '! انتظر قليلاً قبل الإطلاق أو صوّب أبعد في اتجاه حركته.'
        : 'وصل صاروخك بعد مرور ' + planetName + '! أطلق أبكر أو صوّب أمام الكوكب أكثر.';
    }
    return 'لم يصل صاروخك إلى مدار ' + planetName + '. جرّب زاوية أو قوة مختلفة.';
  }

  /** مراحل وضع اللاعب الواحد */
  var LEVELS = Object.freeze([
    { planet: 'mars', guide: 1, title: 'الرحلة الأولى' },
    { planet: 'jupiter', guide: 1, title: 'العملاق الغازي' },
    { planet: 'saturn', guide: 1, title: 'سيد الحلقات' },
    { planet: 'mars', guide: 0.5, title: 'المريخ مرة أخرى' },
    { planet: 'jupiter', guide: 0.5, title: 'عاصفة المشتري' },
    { planet: 'saturn', guide: 0, title: 'تحدّي الرواد' },
  ]);

  var API = {
    WORLD: WORLD, POWERS: POWERS, PLANETS: PLANETS, LEVELS: LEVELS,
    planetById: planetById, angularSpeed: angularSpeed, clampAngle: clampAngle,
    planetAngle: planetAngle, planetPos: planetPos, createRocket: createRocket, stepRocket: stepRocket,
    predictPath: predictPath, timeToOrbit: timeToOrbit, pointsFor: pointsFor, starsFor: starsFor, adviceFor: adviceFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PlanetPhysics = API;
})(typeof window !== 'undefined' ? window : globalThis);
