// ===============================================================
//  ألغاز «خارج الصندوق | تحدّي العقل»
//  كل لغز يحمل بيانات رسمه (visual) وحلّه. الإجابة الصحيحة لا تُكتب يدوياً
//  بل تُحسب من بيانات الرسم بدالة الحل (solve) — وتتحقق منها الاختبارات،
//  فلا يمكن أن يختلف ما يراه المشارك على الشاشة عن الإجابة المعتمدة.
// ===============================================================

// ------------------------------------------------------------------
// 1) لغز المحقق الرقمي
// ------------------------------------------------------------------

/** يقرأ الشفرة: لكل رمز في ورقة الملاحظة نأخذ الرقم المخفي داخل الرمز نفسه في المشهد */
export function solveDetective(visual) {
  return visual.note.map((shape) => {
    const found = visual.symbols.filter((s) => s.shape === shape);
    if (found.length !== 1) throw new Error(`الرمز ${shape} يجب أن يظهر مرة واحدة بالضبط`);
    return String(found[0].digit);
  }).join('');
}

const detective = {
  id: 'detective',
  type: 'code',
  codeLength: 4,
  icon: '🕵️',
  title: 'لغز المحقق الرقمي',
  tagline: 'المشهد يخفي الشفرة… هل تراها؟',
  prompt: 'الورقة على الخزنة تحدد ترتيب الرموز. ابحث عن كل رمز في المشهد، واقرأ الرقم المخفي بداخله، ثم اكتب الشفرة المكوّنة من 4 أرقام.',
  seconds: 50,
  visual: {
    // ترتيب الرموز كما هو مكتوب على ورقة الخزنة (من الأعلى إلى الأسفل)
    note: ['triangle', 'circle', 'square', 'star'],
    // الرموز المخفية في المشهد (إحداثيات داخل لوحة 1000×900)
    symbols: [
      { shape: 'triangle', digit: 5, x: 214, y: 222, size: 54, where: 'لوحة الأدلة — بين الصور' },
      { shape: 'circle', digit: 2, x: 835, y: 540, size: 32, where: 'كعب كتاب في الرف' },
      { shape: 'square', digit: 8, x: 572, y: 262, size: 30, where: 'نافذة مضاءة في ناطحة السحاب' },
      { shape: 'star', digit: 1, x: 385, y: 608, size: 36, where: 'كوب القهوة على المكتب' },
      // رمز تمويه: ليس في الورقة، فلا يدخل في الشفرة
      { shape: 'diamond', digit: 6, x: 690, y: 852, size: 36, where: 'السجادة — تمويه' },
    ],
    // أرقام تمويه بلا رمز حولها
    decoys: [
      { text: '17', x: 100, y: 520, where: 'التقويم' },
      { text: '9', x: 902, y: 428, where: 'كتاب' },
      { text: '3', x: 766, y: 428, where: 'كتاب' },
      { text: '1947', x: 525, y: 645, where: 'ملف القضية' },
    ],
  },
};
detective.answer = solveDetective(detective.visual);
detective.steps = [
  'الورقة على الخزنة تقول: ▲ ثم ● ثم ■ ثم ★',
  ...detective.visual.symbols.filter((s) => detective.visual.note.includes(s.shape))
    .sort((a, b) => detective.visual.note.indexOf(a.shape) - detective.visual.note.indexOf(b.shape))
    .map((s) => `${shapeGlyph(s.shape)} مخفي في ${s.where} وبداخله الرقم ${s.digit}`),
  'المعيّن ◆ والرقم 17 والرقم 1947 مجرد تمويه — ليست في الورقة',
  `الشفرة: ${detective.answer}`,
];
detective.revealFocus = detective.visual.note.map((shape) => detective.visual.symbols.find((s) => s.shape === shape));

function shapeGlyph(shape) {
  return { triangle: '▲', circle: '●', square: '■', star: '★', diamond: '◆' }[shape] || '?';
}

// ------------------------------------------------------------------
// 2) فكّ الآلة الغامضة — محاكاة اتجاه دوران التروس
// ------------------------------------------------------------------

/**
 * يحاكي آلة تروس: كل تعشيق بين ترسين بأسنان يعكس اتجاه الدوران.
 * القرص بلا أسنان لا ينقل الحركة. الحلقة الفردية من التروس المتعشّقة تُقفل الآلة.
 * @returns {{ jammed: boolean, dirs: Record<string, 1|-1> }}  1 = مع عقارب الساعة
 */
export function simulateGears(gears, meshes, driverId, driverDir = 1) {
  const byId = new Map(gears.map((g) => [g.id, g]));
  const adj = new Map(gears.map((g) => [g.id, []]));
  for (const [a, b] of meshes) {
    if (!byId.has(a) || !byId.has(b)) throw new Error(`تعشيق مع ترس غير موجود: ${a}-${b}`);
    if (byId.get(a).teeth === false || byId.get(b).teeth === false) continue; // احتكاك أملس لا ينقل الحركة
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const dirs = { [driverId]: driverDir };
  const queue = [driverId];
  let jammed = false;
  while (queue.length) {
    const id = queue.shift();
    for (const n of adj.get(id)) {
      if (dirs[n] === undefined) { dirs[n] = -dirs[id]; queue.push(n); } else if (dirs[n] === dirs[id]) jammed = true;
    }
  }
  return { jammed, dirs };
}

/** يدمج قطعة الخيار في الآلة ويعيد: هل تدور عجلة المولّد بالاتجاه المطلوب؟ */
export function machineWorksWith(visual, option) {
  const gears = [...visual.gears, ...option.gears];
  const meshes = [...visual.meshes, ...option.meshes];
  const { jammed, dirs } = simulateGears(gears, meshes, visual.driver, visual.driverDir);
  if (jammed) return { works: false, reason: 'jam' };
  const d = dirs[visual.target];
  if (d === undefined) return { works: false, reason: 'idle' };
  return { works: d === visual.targetDir, reason: d === visual.targetDir ? 'ok' : 'reverse' };
}

export function solveMachine(visual) {
  const ok = visual.options.map((o, i) => (machineWorksWith(visual, o).works ? i + 1 : 0)).filter(Boolean);
  if (ok.length !== 1) throw new Error(`لغز الآلة يجب أن يكون له حل واحد، وجدنا ${ok.length}`);
  return String(ok[0]);
}

const machine = {
  id: 'machine',
  type: 'choice',
  icon: '⚙️',
  title: 'فكّ الآلة الغامضة',
  tagline: 'قطعة واحدة فقط تعيد الحياة للآلة',
  prompt: 'المحرّك يدور مع عقارب الساعة ↻. يجب أن تدور عجلة المولّد الذهبية ↻ أيضاً ليضيء المصباح. أي قطعة تكمل الآلة؟ اكتب رقمها.',
  seconds: 35,
  visual: {
    driver: 'M',
    driverDir: 1,
    target: 'G2',
    targetDir: 1,
    gears: [
      { id: 'M', x: 150, y: 470, r: 100, role: 'motor' },
      { id: 'G1', x: 310, y: 470, r: 60 },
      { id: 'G2', x: 590, y: 470, r: 60, role: 'target' },
    ],
    meshes: [['M', 'G1']],
    // كل خيار قطعة توضع في الفراغ بين G1 و G2
    options: [
      { label: 'ترس واحد كبير', gears: [{ id: 'X', x: 450, y: 470, r: 80 }], meshes: [['G1', 'X'], ['X', 'G2']] },
      {
        label: 'ترسان متعشّقان',
        gears: [{ id: 'X', x: 410, y: 470, r: 40 }, { id: 'Y', x: 490, y: 470, r: 40 }],
        meshes: [['G1', 'X'], ['X', 'Y'], ['Y', 'G2']],
      },
      {
        label: 'ثلاثة تروس في مثلث',
        gears: [{ id: 'X', x: 410, y: 470, r: 40 }, { id: 'Y', x: 450, y: 400.72, r: 40 }, { id: 'Z', x: 490, y: 470, r: 40 }],
        meshes: [['G1', 'X'], ['X', 'Y'], ['Y', 'Z'], ['X', 'Z'], ['Z', 'G2']],
      },
      {
        label: 'ترس + قرص أملس',
        gears: [{ id: 'X', x: 410, y: 470, r: 40 }, { id: 'Y', x: 490, y: 470, r: 40, teeth: false }],
        meshes: [['G1', 'X'], ['X', 'Y'], ['Y', 'G2']],
      },
    ],
  },
};
machine.answer = solveMachine(machine.visual);
machine.steps = [
  'كل ترسين متعشّقين يدوران باتجاهين متعاكسين',
  'المحرّك ↻ ← الترس الأول ↺',
  '① ترس واحد: ↻ ← فتدور العجلة ↺ عكس المطلوب ✗',
  '③ ثلاثة تروس في مثلث تتعارض اتجاهاتها فتُقفل الآلة ✗',
  '④ القرص الأملس بلا أسنان لا ينقل الحركة ✗',
  '② ترسان: ↻ ثم ↺ ← العجلة ↻ والمصباح يضيء ✓',
];

// ------------------------------------------------------------------
// 3) تحدّي توصيل الدائرة
// ------------------------------------------------------------------

/** هل يمرّ التيار عبر المسار؟ (التيار الاصطلاحي من القطب الموجب نحو المصباح) */
export function laneConducts(lane) {
  return lane.parts.every((p) => {
    switch (p.type) {
      case 'wire': case 'resistor': return true;
      case 'switch': return p.closed === true;
      case 'diode': return p.dir === 'forward';
      case 'break': return false;
      default: throw new Error(`عنصر غير معروف: ${p.type}`);
    }
  });
}

export function solveCircuit(visual) {
  const ok = visual.lanes.map((l, i) => (laneConducts(l) ? i + 1 : 0)).filter(Boolean);
  if (ok.length !== 1) throw new Error(`لغز الدائرة يجب أن يكون له مسار واحد صحيح، وجدنا ${ok.length}`);
  return String(ok[0]);
}

const circuit = {
  id: 'circuit',
  type: 'choice',
  icon: '💡',
  title: 'تحدّي توصيل الدائرة',
  tagline: 'أربعة مسارات… واحد فقط يضيء',
  prompt: 'التيار يخرج من القطب الموجب (+) يميناً ويتجه نحو المصباح يساراً. الصمام (المثلث) يمرّر التيار باتجاه رأسه فقط. أي مسار يضيء المصباح؟',
  seconds: 35,
  visual: {
    // كل مسار: عناصر مرتّبة من البطارية (يمين) إلى المصباح (يسار)
    lanes: [
      { parts: [{ type: 'switch', closed: true }, { type: 'resistor' }, { type: 'diode', dir: 'reverse' }] },
      { parts: [{ type: 'switch', closed: true }, { type: 'break' }, { type: 'diode', dir: 'forward' }] },
      { parts: [{ type: 'switch', closed: false }, { type: 'resistor' }, { type: 'diode', dir: 'forward' }] },
      { parts: [{ type: 'switch', closed: true }, { type: 'resistor' }, { type: 'diode', dir: 'forward' }] },
    ],
  },
};
circuit.answer = solveCircuit(circuit.visual);
circuit.steps = [
  '① الصمام مقلوب — رأسه يواجه البطارية فيمنع التيار ✗',
  '② انتبه للفجوة الصغيرة في السلك — الدائرة مفتوحة ✗',
  '③ المفتاح مرفوع (مفتوح) — لا يمر تيار ✗',
  '④ المفتاح مغلق، السلك متصل، الصمام في الاتجاه الصحيح ✓',
];

// ------------------------------------------------------------------
// 4) خداع بصري — خطوط مولر-لاير بلمسة «خارج الصندوق»
// ------------------------------------------------------------------

export function solveIllusion(visual) {
  const lens = visual.lines.map((l) => l.length);
  const max = Math.max(...lens);
  const idx = lens.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  // إذا تساوت كلها فالإجابة هي الخيار الأخير «كلها متساوية»
  if (idx.length === lens.length) return String(lens.length + 1);
  if (idx.length !== 1) throw new Error('لغز الخداع يجب أن يكون له خط واحد هو الأطول');
  return String(idx[0] + 1);
}

const illusion = {
  id: 'illusion',
  type: 'choice',
  icon: '👁️',
  title: 'خداع بصري',
  tagline: 'لا تصدّق عينيك… ولا ما حفظته!',
  prompt: 'أي خط هو الأطول فعلاً (بدون الأطراف)؟ اكتب 1 أو 2 أو 3، أو 4 إذا كانت كلها متساوية.',
  seconds: 25,
  visual: {
    // الطول الحقيقي للخط بالبكسل، ونوع الأطراف التي تخدع العين
    lines: [
      { length: 400, fins: 'out' },
      { length: 400, fins: 'none' },
      { length: 432, fins: 'in' },
    ],
    optionsLabel: ['الخط 1', 'الخط 2', 'الخط 3', 'كلها متساوية'],
  },
};
illusion.answer = solveIllusion(illusion.visual);
illusion.steps = [
  'الأطراف الخارجية ‹ › تجعل الخط يبدو أطول، والداخلية › ‹ تجعله يبدو أقصر',
  'كثيرون يعرفون الخدعة فيجيبون «متساوية»… لكن لنقِس!',
  'نزيل الأطراف ونضع المسطرة: 1 = 400 • 2 = 400 • 3 = 432',
  'الخط 3 هو الأطول فعلاً ✓',
];

// ------------------------------------------------------------------
// 5) شفرة علمية متعددة المراحل
// ------------------------------------------------------------------

const ATOMIC_NUMBER = { H: 1, He: 2, Li: 3, Be: 4, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10, Na: 11 };

/** يعدّ الذرات في صيغة كيميائية بسيطة مثل H2O أو CO2 */
export function countAtoms(formula) {
  let total = 0;
  for (const [, el, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!(el in ATOMIC_NUMBER)) throw new Error(`عنصر غير معروف: ${el}`);
    total += n ? Number(n) : 1;
  }
  return total;
}

export function solveScience(visual) {
  const values = [];
  for (const st of visual.stages) {
    let v;
    switch (st.kind) {
      case 'atoms': v = countAtoms(st.formula); break;
      case 'atomicNumber': v = ATOMIC_NUMBER[st.element]; break;
      case 'chain': v = values[st.a] - values[st.b] + st.plus; break;
      case 'ph': v = 7; break; // الماء النقي متعادل عند 25°م
      default: throw new Error(`مرحلة غير معروفة: ${st.kind}`);
    }
    if (!Number.isInteger(v) || v < 0 || v > 9) throw new Error(`ناتج المرحلة يجب أن يكون رقماً واحداً: ${v}`);
    values.push(v);
  }
  const digits = visual.finalRule === 'reverse' ? [...values].reverse() : values;
  return { values, code: digits.join('') };
}

const science = {
  id: 'science',
  type: 'code',
  codeLength: 4,
  icon: '🧪',
  title: 'الشفرة العلمية',
  tagline: 'أربع مراحل… وخطوة أخيرة تقلب كل شيء',
  prompt: 'حلّ المراحل الأربع بالترتيب، كل مرحلة تعطيك رقماً، ثم طبّق القاعدة الأخيرة واكتب الشفرة.',
  seconds: 55,
  visual: {
    stages: [
      { kind: 'atoms', formula: 'H2O', text: 'عدد الذرات في جزيء الماء H₂O' },
      { kind: 'atomicNumber', element: 'C', text: 'العدد الذري لعنصر الكربون C' },
      { kind: 'chain', a: 1, b: 0, plus: 1, text: 'ناتج ② ناقص ناتج ① ثم زِد واحداً' },
      { kind: 'ph', text: 'الرقم الهيدروجيني pH للماء النقي' },
    ],
    finalRule: 'reverse',
    finalText: 'القاعدة الأخيرة: اقلب الترتيب — ④ أولاً ثم ③ ثم ② ثم ①',
  },
};
{
  const { values, code } = solveScience(science.visual);
  science.answer = code;
  science.stageValues = values;
  science.steps = [
    `① H₂O = ذرتا هيدروجين + ذرة أكسجين = ${values[0]}`,
    `② الكربون C عدده الذري ${values[1]}`,
    `③ ${values[1]} − ${values[0]} + 1 = ${values[2]}`,
    `④ الماء النقي متعادل: pH = ${values[3]}`,
    `الترتيب ${values.join('')} ← بعد العكس: ${code}`,
  ];
}

// ------------------------------------------------------------------
// 6) اللغز النهائي — ملاحظة + منطق + سرعة
// ------------------------------------------------------------------

export function solveFinal(visual) {
  const redSquares = visual.tiles.filter((t) => t.shape === 'square' && t.color === 'red');
  const stars = visual.tiles.filter((t) => t.shape === 'star');
  const sum = redSquares.reduce((s, t) => s + t.digit, 0);
  return { sum, stars: stars.length, answer: String(sum * stars.length) };
}

const final = {
  id: 'final',
  type: 'number',
  icon: '🧠',
  title: 'اللغز النهائي',
  tagline: 'ملاحظة • منطق • سرعة — النقاط مضاعفة!',
  prompt: 'احفظ البطاقات قبل أن تنقلب! الإجابة = (مجموع الأرقام في المربعات الحمراء) × (عدد النجوم بكل ألوانها).',
  seconds: 35,
  multiplier: 2,
  visual: {
    // البطاقات تظهر من الثانية showAt وتنقلب عند hideAt (منذ بداية السؤال)
    showAt: 3,
    hideAt: 12,
    tiles: [
      { shape: 'square', color: 'red', digit: 7 },
      { shape: 'star', color: 'blue', digit: 3 },
      { shape: 'circle', color: 'red', digit: 5 },
      { shape: 'star', color: 'yellow', digit: 9 },
      { shape: 'square', color: 'red', digit: 4 },
      { shape: 'square', color: 'blue', digit: 8 },
      { shape: 'star', color: 'red', digit: 2 },
      { shape: 'circle', color: 'yellow', digit: 6 },
      { shape: 'square', color: 'red', digit: 1 },
    ],
  },
};
{
  const r = solveFinal(final.visual);
  final.answer = r.answer;
  final.steps = [
    'المربعات الحمراء: 7 و 4 و 1',
    `مجموعها = ${r.sum}`,
    'انتبه: المربع 8 أزرق، والنجمة 2 حمراء لكنها ليست مربعاً',
    `عدد النجوم = ${r.stars} (زرقاء + صفراء + حمراء)`,
    `${r.sum} × ${r.stars} = ${r.answer} ✓`,
  ];
}

// ------------------------------------------------------------------

export const PUZZLES = { detective, machine, circuit, illusion, science, final };
export const DEFAULT_ORDER = ['detective', 'machine', 'circuit', 'illusion', 'science', 'final'];

/** نسخة اللغز التي تُرسل للشاشة أثناء السؤال (بدون الإجابة أو الحل) */
export function publicPuzzle(p) {
  const optionCount = p.type === 'choice' ? (p.visual.options?.length || p.visual.lanes?.length || 4) : 0;
  return {
    id: p.id, type: p.type, icon: p.icon, title: p.title, tagline: p.tagline, prompt: p.prompt,
    seconds: p.seconds, multiplier: p.multiplier || 1, codeLength: p.codeLength || 0, optionCount, visual: p.visual,
  };
}

/** بيانات كشف الحل (تُرسل بعد انتهاء الوقت فقط) */
export function revealData(p) {
  return { answer: p.answer, steps: p.steps, focus: p.revealFocus || null, stageValues: p.stageValues || null };
}
