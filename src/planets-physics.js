// ===============================================================
//  فيزياء «سباق الكواكب» — دوال نقية بدون آثار جانبية
//  الإحداثيات فيزيائية: الشمس في (0,0)، المحور y للأعلى، الوحدة = بكسل، الزمن = ثانية.
//  الشاشة تحوّلها: sx = cx + x ، sy = cy - y
// ===============================================================

export const WORLD = Object.freeze({
  GM: 4e6,          // ثابت جاذبية الشمس × كتلتها (مضبوط ليبدو جميلاً على الشاشة)
  sunRadius: 55,    // نصف قطر الشمس المرسوم
  sunHit: 50,       // من يقترب أكثر من هذا «يحترق»
  earthOrbit: 230,  // مدار الأرض (منصة الإطلاق في أسفل الشمس)
  launchSpeed: 300, // سرعة الإطلاق الثابتة
  laneFrom: 20,     // زاوية المسار 1 (بالدرجات، يمين الشاشة)
  laneTo: 160,      // زاوية المسار الأخير (يسار الشاشة)
  // حدود ما يُعتبر «داخل الشاشة» بالإحداثيات الفيزيائية
  bounds: { x: 620, top: 820, bottom: -680 },
  maxFlight: 4.5,   // أقصى زمن رحلة بالثواني
  sampleHz: 30,     // دقة النقاط المرسلة للمتصفح
});

/** الكواكب الهدف — المسافة من الشمس والسرعة الزاوية تتبع قانون كبلر الثالث */
export const PLANETS = Object.freeze([
  {
    id: 'mars', name: 'المريخ', orbit: 330, radius: 30, color: '#ff6b3d', glow: '#ff9a6b',
    facts: [
      'المريخ يُسمّى «الكوكب الأحمر» لأن تربته فيها صدأ الحديد!',
      'على المريخ أعلى بركان في المجموعة الشمسية: أوليمبوس مونس، أعلى من إيفرست 3 مرات!',
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
      'يوم المشتري أقصر من 10 ساعات، فهو أسرع الكواكب دوراناً.',
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

export function planetById(id) {
  return PLANETS.find((p) => p.id === id) || null;
}

/** السرعة الزاوية لكوكب في مدار دائري (قانون كبلر الثالث): ω = √(GM / r³) */
export function angularSpeed(orbit, GM = WORLD.GM) {
  return Math.sqrt(GM / orbit ** 3);
}

/** زاوية المسار رقم n (بالراديان). المسار 1 على اليمين والأخير على اليسار */
export function laneAngle(n, laneCount = 10, world = WORLD) {
  const k = laneCount > 1 ? (n - 1) / (laneCount - 1) : 0.5;
  return ((world.laneFrom + k * (world.laneTo - world.laneFrom)) * Math.PI) / 180;
}

export function lanes(laneCount = 10, world = WORLD) {
  return Array.from({ length: laneCount }, (_, i) => ({ n: i + 1, angle: laneAngle(i + 1, laneCount, world) }));
}

function normAngle(a) {
  const t = 2 * Math.PI;
  return ((a % t) + t) % t;
}

/**
 * يحاكي رحلة صاروخ منطلق من الأرض بزاوية معيّنة تحت جاذبية الشمس فقط.
 * @returns {{ samples: number[][], end: 'sun'|'out'|'time', crossing: {t:number, angle:number}|null }}
 *   samples: نقاط [t, x, y] بمعدل 60 نقطة/ثانية
 *   crossing: أول لحظة يعبر فيها الصاروخ مدار الهدف (إن عبره)
 */
export function simulateLane(angle, targetOrbit, world = WORLD) {
  const dt = 1 / 240;
  const every = 4; // 240/4 = 60Hz
  let x = 0;
  let y = -world.earthOrbit;
  let vx = world.launchSpeed * Math.cos(angle);
  let vy = world.launchSpeed * Math.sin(angle);
  let t = 0;
  let crossing = null;
  const samples = [[0, x, y]];
  let step = 0;
  let end = 'time';
  let prevR = Math.hypot(x, y);

  while (t < world.maxFlight) {
    const r = Math.hypot(x, y);
    // تسارع الجاذبية: a = -GM r̂ / r²  (نصف-ضمني: نحدّث السرعة ثم الموقع)
    const k = -world.GM / r ** 3;
    vx += k * x * dt;
    vy += k * y * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    step += 1;
    const nr = Math.hypot(x, y);
    if (!crossing && prevR < targetOrbit && nr >= targetOrbit) {
      crossing = { t, angle: normAngle(Math.atan2(y, x)) };
    }
    prevR = nr;
    if (step % every === 0) samples.push([t, x, y]);
    if (nr < world.sunHit) { end = 'sun'; break; }
    const b = world.bounds;
    if (Math.abs(x) > b.x || y > b.top || y < b.bottom) { end = 'out'; break; }
  }
  if (samples[samples.length - 1][0] !== t) samples.push([t, x, y]);
  return { samples, end, crossing };
}

/** موقع الكوكب في اللحظة t بعد الإطلاق */
export function planetPos(target, t) {
  const a = target.theta0 + target.omega * t;
  return [target.orbit * Math.cos(a), target.orbit * Math.sin(a)];
}

/**
 * يجهّز جولة كاملة: يحاكي كل المسارات، يختار «نافذة الإطلاق» (المسار الرابح)،
 * ويضع الكوكب بحيث يلتقي بصاروخ ذلك المسار تماماً، ثم يحسب نتيجة كل مسار.
 *
 * @param {object} planet عنصر من PLANETS
 * @param {{ laneCount?:number, random?:()=>number, landingPoints?:number, flybyPoints?:number, flybyMargin?:number }} opt
 */
export function planRound(planet, opt = {}, world = WORLD) {
  const laneCount = opt.laneCount || 10;
  const random = opt.random || Math.random;
  const landingPoints = opt.landingPoints ?? 3;
  const flybyPoints = opt.flybyPoints ?? 1;
  const flybyMargin = opt.flybyMargin ?? 80;

  const sims = lanes(laneCount, world).map((l) => ({ ...l, ...simulateLane(l.angle, planet.orbit, world) }));
  const candidates = sims.filter((s) => s.crossing);
  if (!candidates.length) throw new Error('لا يوجد مسار يصل إلى مدار الهدف — راجع إعدادات الفيزياء');
  const win = candidates[Math.floor(random() * candidates.length)];

  const omega = angularSpeed(planet.orbit, world.GM);
  const theta0 = normAngle(win.crossing.angle - omega * win.crossing.t);
  const target = { orbit: planet.orbit, omega, theta0 };
  const hitR = planet.radius + 16;

  const results = {};
  const paths = {};
  let duration = 0;
  for (const s of sims) {
    let closest = Infinity;
    let cut = s.samples.length;
    let outcome = s.end === 'sun' ? 'burned' : 'lost';
    let at = s.samples[s.samples.length - 1][0];
    for (let i = 0; i < s.samples.length; i++) {
      const [t, x, y] = s.samples[i];
      const [px, py] = planetPos(target, t);
      const d = Math.hypot(x - px, y - py);
      if (d < closest) closest = d;
      if (d <= hitR) { outcome = 'landed'; cut = i + 1; at = t; break; }
    }
    if (outcome !== 'landed' && outcome !== 'burned' && closest <= planet.radius + flybyMargin) outcome = 'flyby';
    const pts = outcome === 'landed' ? landingPoints : outcome === 'flyby' ? flybyPoints : 0;
    results[s.n] = { outcome, points: pts, closest: Math.round(closest), at: round3(at) };

    // تقليل النقاط المرسلة للمتصفح إلى sampleHz
    const stride = Math.max(1, Math.round(60 / world.sampleHz));
    const kept = s.samples.slice(0, cut).filter((_, i, arr) => i % stride === 0 || i === arr.length - 1);
    paths[s.n] = kept.map(([t, x, y]) => [round3(t), Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    duration = Math.max(duration, at);
  }

  return {
    planetId: planet.id,
    window: win.n,
    target: { ...target, theta0: round3(theta0), omega: round3(omega) },
    results,
    paths,
    duration: round3(duration),
  };
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}
