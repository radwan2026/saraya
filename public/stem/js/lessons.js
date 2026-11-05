/* =====================================================================
 * lessons.js — بيانات الدروس (المحتوى التعليمي + الرسومات)
 * ---------------------------------------------------------------------
 * كل درس عبارة عن كائن JSON مستقل يحتوي على:
 *   - id, title, concept, category, level, minutes  : بيانات البطاقة
 *   - bg        : خلفية المشهد (أرض، ماء، فضاء…) — ليست قطعة تُركّب
 *   - parts[]   : القطع التي يسحبها الطفل إلى طاولة العمل، ولكل قطعة:
 *        id      : معرّف فريد داخل الدرس
 *        name    : الاسم بالعربية والإنجليزية
 *        tip     : وصف قصير يظهر في المخزن
 *        slot    : مستطيل مكان التركيب {x,y,w,h} بإحداثيات المشهد (400×300)
 *        needs   : (اختياري) قطع يجب تركيبها أولاً — لتعليم ترتيب التجميع
 *        art     : رسم SVG للقطعة في مكانها النهائي داخل المشهد
 *   - rig       : كلاس حركة يُطبّق على المجسّم كاملاً عند التشغيل (اهتزاز، سير…)
 *   - fx        : مؤثرات تظهر فقط عند التشغيل (رياح، أشعة ضوء…) وتتحرك مع المجسّم
 *   - fxStatic  : مؤثرات ثابتة في الخلفية (طريق متحرك، أمواج…)
 *   - flow[]    : سلسلة تحوّل الطاقة التي تُعرض أثناء المحاكاة
 *   - explain, fact : شرح ما يحدث + معلومة ممتعة
 *   - quiz[]    : أسئلة الاختيار من متعدد (answer = رقم الإجابة الصحيحة)
 *
 * لإضافة درس جديد: انسخ أي كائن داخل مصفوفة LESSONS وعدّل محتواه فقط —
 * لا حاجة لتعديل أي منطق في app.js.
 * ===================================================================== */

/* ---------- لوحة الألوان الموحّدة للرسومات ---------- */
const PAL = {
  wood: '#F2D3A2', woodS: '#C08A4B',
  metal: '#CBD3DD', metalS: '#7D8794',
  dark: '#2F2A3B', red: '#EF4444', redD: '#B91C1C',
  yellow: '#FACC15', green: '#22C55E', blue: '#3B82F6',
  water: '#7DD3FC', purple: '#7C3AED', purpleL: '#C4B5FD', orange: '#F59E0B'
};

/* ---------- دوال رسم مساعدة تُعيد نصوص SVG قابلة لإعادة الاستخدام ---------- */
const Draw = {
  // لوح خشبي مستطيل
  wood: (x, y, w, h, rx = 4) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${PAL.wood}" stroke="${PAL.woodS}" stroke-width="2"/>`,

  // عارضة خشبية مائلة بين نقطتين (خط سميك بإطار)
  bar: (x1, y1, x2, y2, t = 12) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PAL.woodS}" stroke-width="${t + 4}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PAL.wood}" stroke-width="${t}" stroke-linecap="round"/>`,

  // مسمار/مفصل برتقالي
  pin: (cx, cy, r = 4) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PAL.orange}" stroke="#C2410C" stroke-width="1.5"/>`,

  // عجلة بأذرع — كلاس الدوران يُحدد اتجاه الحركة عند التشغيل
  wheel: (cx, cy, r, cls = 'spin-rev') => {
    let spokes = '';
    for (let a = 0; a < 360; a += 72) {
      const rad = (a * Math.PI) / 180;
      spokes += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(rad) * r * 0.6).toFixed(1)}" y2="${(cy + Math.sin(rad) * r * 0.6).toFixed(1)}" stroke="${PAL.dark}" stroke-width="3"/>`;
    }
    return `<g class="${cls}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${PAL.dark}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="#A3ACB9"/>${spokes}` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="${PAL.dark}"/></g>`;
  },

  // محرك كهربائي (أسطوانة فضية + غطاء أصفر + عمود دوران)
  motor: (x, y, w, h, shaft = 'right') => {
    const capX = shaft === 'right' ? x : x + w - w * 0.2;
    const shaftX = shaft === 'right' ? x + w : x - 14;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.3}" fill="url(#gMetal)" stroke="${PAL.metalS}" stroke-width="2"/>` +
      `<rect x="${capX}" y="${y}" width="${w * 0.2}" height="${h}" rx="${h * 0.25}" fill="#F6B73C" stroke="#B7791F" stroke-width="1.5"/>` +
      `<line x1="${x + w * 0.45}" y1="${y + 4}" x2="${x + w * 0.45}" y2="${y + h - 4}" stroke="${PAL.metalS}" stroke-width="1.5"/>` +
      `<rect x="${shaftX}" y="${y + h / 2 - 3}" width="14" height="6" rx="2" fill="${PAL.metalS}"/></g>`;
  },

  // حامل بطاريات أسود بخليتين
  battery: (x, y, w, h) =>
    `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${PAL.dark}" stroke="#15121c" stroke-width="2"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w / 2 - 7}" height="${h - 10}" rx="4" fill="#4B4560"/>` +
    `<rect x="${x + w / 2 + 2}" y="${y + 5}" width="${w / 2 - 7}" height="${h - 10}" rx="4" fill="#4B4560"/>` +
    `<text x="${x + w / 4}" y="${y + h / 2 + 4}" font-size="11" fill="#FDE68A" text-anchor="middle" font-weight="bold">+</text>` +
    `<text x="${x + (3 * w) / 4}" y="${y + h / 2 + 4}" font-size="11" fill="#FDE68A" text-anchor="middle" font-weight="bold">+</text></g>`,

  // مروحة ثلاثية الشفرات — الدائرة الشفافة تجعل مركز الدوران في منتصف المروحة تماماً
  prop: (cx, cy, r, cls = 'spin', color = PAL.red) => {
    let blades = '';
    for (const a of [0, 120, 240]) {
      blades += `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.17}" ry="${r * 0.45}" fill="${color}" stroke="${PAL.redD}" stroke-width="1.5" transform="rotate(${a} ${cx} ${cy})"/>`;
    }
    return `<g class="${cls}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent"/>${blades}` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${color}" stroke="${PAL.redD}" stroke-width="2"/></g>`;
  },

  // سلك كهربائي
  wire: (d, color = PAL.red) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`,

  // حقنة (أسطوانة شفافة + ماء + مكبس) — plungerCls يحدد حركة المكبس
  syringe: (x, y, len, h, { side = 'right', plungerCls = '', fill = 0.65 } = {}) => {
    const waterW = (len - 4) * fill;
    const waterX = side === 'right' ? x + 2 : x + len - 2 - waterW;
    const nozzleX = side === 'right' ? x - 8 : x + len;
    const rodX = side === 'right' ? x + len - 6 : x - 30;
    const thumbX = side === 'right' ? x + len + 22 : x - 32;
    return `<g><rect x="${waterX}" y="${y + 2}" width="${waterW}" height="${h - 4}" fill="${PAL.water}" opacity=".85"/>` +
      `<rect x="${x}" y="${y}" width="${len}" height="${h}" rx="3" fill="#F8FAFC" fill-opacity=".35" stroke="#94A3B8" stroke-width="2"/>` +
      `<rect x="${nozzleX}" y="${y + h / 2 - 3}" width="8" height="6" fill="#94A3B8"/>` +
      `<g class="${plungerCls}"><rect x="${rodX}" y="${y + h / 2 - 3}" width="36" height="6" fill="#E2E8F0" stroke="#94A3B8"/>` +
      `<rect x="${thumbX}" y="${y - 3}" width="10" height="${h + 6}" rx="3" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/></g></g>`;
  },

  // خطوط رياح متحركة (تظهر عند التشغيل)
  wind: (x1, x2, ys) => ys.map((y, i) =>
    `<line class="wind" style="animation-delay:${i * 0.15}s" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#A5B4FC" stroke-width="4" stroke-linecap="round" stroke-dasharray="18 14"/>`).join('')
};

/* ---------- تعريفات مشتركة (تدرجات لونية) تُضاف لكل مشهد ---------- */
const SVG_DEFS = `<defs>
  <linearGradient id="gMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF2F7"/><stop offset=".5" stop-color="#C7CFD9"/><stop offset="1" stop-color="#8E99A8"/></linearGradient>
  <radialGradient id="gSun"><stop offset="0" stop-color="#FEF08A"/><stop offset=".6" stop-color="#FBBF24"/><stop offset="1" stop-color="#F97316"/></radialGradient>
  <radialGradient id="gGlow"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

/* أرضية بسيطة مشتركة بين عدة مشاهد */
const GROUND = (y = 258) => `<rect x="0" y="${y}" width="400" height="${300 - y}" fill="#EDE9FE"/><line x1="0" y1="${y}" x2="400" y2="${y}" stroke="#C4B5FD" stroke-width="2"/>`;

/* =====================================================================
 *                         بيانات الدروس العشرة
 * ===================================================================== */
const LESSONS = [
  /* ------------------------------------------------------------------
   * 1) العربة المروحية — قانون نيوتن الثالث (الفعل ورد الفعل)
   * ------------------------------------------------------------------ */
  {
    id: 'propeller-car',
    emoji: '🚗',
    title: { ar: 'العربة المروحية', en: 'Propeller Car' },
    concept: { ar: 'الفعل ورد الفعل', en: 'Action & Reaction' },
    category: { ar: 'فيزياء', en: 'Physics' },
    level: 1, minutes: 10,
    photo: 'img/propeller-car.webp',
    bg: GROUND(256),
    parts: [
      { id: 'chassis', name: { ar: 'هيكل خشبي', en: 'Wood Chassis' }, tip: { ar: 'القاعدة التي تحمل كل شيء', en: 'The base that holds everything' },
        slot: { x: 62, y: 96, w: 266, h: 132 },
        art: Draw.wood(70, 190, 250, 22) + Draw.wood(197, 100, 24, 92) + Draw.wood(84, 210, 26, 14) + Draw.wood(280, 210, 26, 14) },
      { id: 'wheels', name: { ar: 'العجلات', en: 'Wheels' }, tip: { ar: 'تقلل الاحتكاك لتتحرك العربة بسهولة', en: 'Reduce friction so the car rolls' },
        slot: { x: 60, y: 198, w: 270, h: 64 },
        art: Draw.wheel(97, 229, 27) + Draw.wheel(293, 229, 27) },
      { id: 'battery', name: { ar: 'البطارية', en: 'Battery' }, tip: { ar: 'مخزن الطاقة الكهربائية', en: 'Stores electrical energy' },
        slot: { x: 104, y: 150, w: 84, h: 44 }, needs: ['chassis'],
        art: Draw.battery(110, 156, 72, 34) },
      { id: 'motor', name: { ar: 'المحرك', en: 'Motor' }, tip: { ar: 'يحوّل الكهرباء إلى حركة دوران', en: 'Turns electricity into spinning' },
        slot: { x: 150, y: 62, w: 112, h: 56 }, needs: ['chassis'],
        art: Draw.wire('M172 110 C172 130 160 140 168 156') + Draw.wire('M182 110 C184 132 176 142 180 156', '#111') + Draw.motor(158, 70, 78, 40) },
      { id: 'propeller', name: { ar: 'المروحة', en: 'Propeller' }, tip: { ar: 'تدفع الهواء للخلف', en: 'Pushes air backward' },
        slot: { x: 196, y: 26, w: 130, h: 130 }, needs: ['motor'],
        art: Draw.prop(262, 90, 64) }
    ],
    fx: Draw.wind(334, 396, [62, 90, 118]),
    fxStatic: `<g class="road"><line x1="-40" y1="276" x2="440" y2="276" stroke="#A78BFA" stroke-width="5" stroke-dasharray="26 22"/></g>`,
    rig: 'rig-rumble',
    flow: [
      { icon: '🔋', ar: 'بطارية', en: 'Battery' },
      { icon: '⚙️', ar: 'محرك', en: 'Motor' },
      { icon: '🌀', ar: 'مروحة', en: 'Propeller' },
      { icon: '💨', ar: 'هواء للخلف', en: 'Air backward' },
      { icon: '🚗', ar: 'العربة للأمام', en: 'Car forward' }
    ],
    explain: {
      ar: 'تدفع المروحة الهواء إلى الخلف بقوة، فيدفع الهواء العربة إلى الأمام بقوة مساوية في الاتجاه المعاكس. هذا هو قانون نيوتن الثالث: لكل فعل رد فعل مساوٍ له في المقدار ومعاكس له في الاتجاه.',
      en: 'The propeller pushes air backward, and the air pushes the car forward with an equal force in the opposite direction. That is Newton\'s Third Law: every action has an equal and opposite reaction.'
    },
    fact: { ar: 'الطائرات المروحية تطير بنفس الفكرة تماماً!', en: 'Propeller airplanes fly using exactly the same idea!' },
    quiz: [
      { q: { ar: 'ما الذي يجعل العربة تتحرك إلى الأمام؟', en: 'What makes the car move forward?' },
        options: [
          { ar: 'المروحة تدفع الهواء للخلف فيدفع الهواءُ العربةَ للأمام', en: 'The propeller pushes air back, and the air pushes the car forward' },
          { ar: 'في العجلات محركات صغيرة', en: 'The wheels have tiny motors' },
          { ar: 'مغناطيس تحت الأرض', en: 'Magnets under the floor' },
          { ar: 'لأن البطارية ثقيلة', en: 'Because the battery is heavy' }],
        answer: 0,
        why: { ar: 'هذا قانون نيوتن الثالث: الفعل ورد الفعل.', en: 'That\'s Newton\'s Third Law: action and reaction.' } },
      { q: { ar: 'أي قطعة تحوّل الطاقة الكهربائية إلى حركة؟', en: 'Which part turns electrical energy into motion?' },
        options: [{ ar: 'البطارية', en: 'Battery' }, { ar: 'المحرك', en: 'Motor' }, { ar: 'العجلات', en: 'Wheels' }, { ar: 'الهيكل', en: 'Chassis' }],
        answer: 1,
        why: { ar: 'المحرك يحوّل الكهرباء إلى دوران يدير المروحة.', en: 'The motor turns electricity into rotation that spins the propeller.' } },
      { q: { ar: 'ماذا يحدث لو عكسنا أسلاك البطارية؟', en: 'What happens if we swap the battery wires?' },
        options: [
          { ar: 'لا يتغير شيء', en: 'Nothing changes' },
          { ar: 'تطير العربة', en: 'The car flies' },
          { ar: 'تدور المروحة بالعكس فتتحرك العربة للخلف', en: 'The propeller spins the other way and the car moves backward' },
          { ar: 'تتغير ألوان المروحة', en: 'The propeller changes color' }],
        answer: 2,
        why: { ar: 'عكس اتجاه التيار يعكس اتجاه دوران المحرك.', en: 'Reversing the current reverses the motor\'s direction.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 2) المصعد الهيدروليكي (المقصّي) — مبدأ باسكال + آلية المقص
   * ------------------------------------------------------------------ */
  {
    id: 'elevator',
    emoji: '🛗',
    title: { ar: 'المصعد الهيدروليكي', en: 'Hydraulic Elevator' },
    concept: { ar: 'ضغط السوائل', en: 'Liquid Pressure' },
    category: { ar: 'هيدروليك', en: 'Hydraulics' },
    level: 2, minutes: 12,
    photo: 'img/hydraulic-lift.webp',
    bg: GROUND(262),
    parts: [
      { id: 'base', name: { ar: 'القاعدة', en: 'Base' }, tip: { ar: 'أرضية المصعد الثابتة', en: 'The fixed floor of the lift' },
        slot: { x: 14, y: 228, w: 292, h: 36 },
        art: Draw.wood(20, 236, 280, 22) },
      { id: 'scissor', name: { ar: 'أذرع المقص', en: 'Scissor Arms' }, tip: { ar: 'تتمدد لأعلى مثل المقص', en: 'Stretch upward like scissors' },
        slot: { x: 56, y: 62, w: 168, h: 180 }, needs: ['base'],
        art: `<g class="lift-scissor pivot" style="transform-origin:140px 236px">` +
          Draw.bar(70, 232, 210, 152, 9) + Draw.bar(70, 152, 210, 232, 9) + Draw.bar(70, 152, 210, 72, 9) + Draw.bar(70, 72, 210, 152, 9) +
          Draw.pin(140, 192) + Draw.pin(140, 112) + Draw.pin(70, 152) + Draw.pin(210, 152) + `</g>` },
      { id: 'platform', name: { ar: 'المنصة', en: 'Platform' }, tip: { ar: 'الصندوق الذي يرتفع بالحمولة', en: 'The box that carries the load' },
        slot: { x: 40, y: 20, w: 200, h: 60 }, needs: ['scissor'],
        art: `<g class="lift-platform">` + Draw.wood(46, 60, 188, 14) + Draw.wood(56, 26, 168, 36, 6) +
          `<rect x="66" y="32" width="148" height="24" rx="4" fill="#E9C48C"/><text x="140" y="49" font-size="14" text-anchor="middle">📦</text></g>` },
      { id: 'slave', name: { ar: 'حقنة الرفع', en: 'Lift Syringe' }, tip: { ar: 'تدفع الأذرع لأعلى', en: 'Pushes the arms up' },
        slot: { x: 110, y: 200, w: 120, h: 36 }, needs: ['scissor'],
        art: Draw.syringe(150, 210, 60, 16, { side: 'left', plungerCls: 'lift-rod' }) },
      { id: 'master', name: { ar: 'حقنة التحكم', en: 'Control Syringe' }, tip: { ar: 'تضغط عليها بيدك', en: 'You press this one by hand' },
        slot: { x: 262, y: 260, w: 136, h: 36 }, needs: ['base'],
        art: Draw.syringe(282, 270, 74, 16, { side: 'right', plungerCls: 'lift-push' }) },
      { id: 'tube', name: { ar: 'أنبوب الماء', en: 'Water Tube' }, tip: { ar: 'ينقل الضغط بين الحقنتين', en: 'Carries the pressure between syringes' },
        slot: { x: 206, y: 206, w: 80, h: 82 }, needs: ['slave', 'master'],
        art: `<path d="M218 218 C250 218 244 278 274 278" fill="none" stroke="#0EA5E9" stroke-width="6" stroke-linecap="round"/>` +
          `<path class="flow-dash" d="M218 218 C250 218 244 278 274 278" fill="none" stroke="#E0F2FE" stroke-width="2" stroke-dasharray="6 8"/>` }
    ],
    fx: '', fxStatic: '', rig: '',
    flow: [
      { icon: '✋', ar: 'دفع الحقنة', en: 'Push syringe' },
      { icon: '💧', ar: 'ضغط الماء', en: 'Water pressure' },
      { icon: '💉', ar: 'حقنة الرفع', en: 'Lift syringe' },
      { icon: '✂️', ar: 'أذرع المقص', en: 'Scissor arms' },
      { icon: '⬆️', ar: 'المنصة ترتفع', en: 'Platform rises' }
    ],
    explain: {
      ar: 'عندما تضغط على حقنة التحكم، ينتقل الضغط عبر الماء إلى حقنة الرفع فيخرج مكبسها ويدفع أذرع المقص لتنفتح، فترتفع المنصة. الماء لا ينضغط، لذلك ينقل الدفعة كاملة — هذا مبدأ باسكال.',
      en: 'When you press the control syringe, the pressure travels through the water to the lift syringe. Its plunger pushes the scissor arms open and the platform rises. Water can\'t be squeezed, so it passes the whole push along — that\'s Pascal\'s principle.'
    },
    fact: { ar: 'كراسي طبيب الأسنان ورافعات السيارات تعمل بنفس الطريقة!', en: 'Dentist chairs and car lifts work the same way!' },
    quiz: [
      { q: { ar: 'لماذا نستخدم الماء بدلاً من الهواء داخل الحقن؟', en: 'Why do we use water instead of air in the syringes?' },
        options: [
          { ar: 'لأن الماء أخف', en: 'Because water is lighter' },
          { ar: 'لأن الماء لا ينضغط فينقل الدفعة كاملة', en: 'Because water can\'t be squeezed, so it passes the full push' },
          { ar: 'لأن الماء ملوّن', en: 'Because water is colorful' },
          { ar: 'لأن الهواء مبلل', en: 'Because air is wet' }],
        answer: 1,
        why: { ar: 'السوائل غير قابلة للانضغاط تقريباً، بينما الهواء ينضغط كالإسفنجة.', en: 'Liquids barely compress, while air squishes like a sponge.' } },
      { q: { ar: 'عندما تدفع مكبس حقنة التحكم، ماذا يحدث للمنصة؟', en: 'When you push the control syringe, what happens to the platform?' },
        options: [{ ar: 'تنخفض', en: 'It goes down' }, { ar: 'تدور', en: 'It spins' }, { ar: 'ترتفع', en: 'It goes up' }, { ar: 'لا شيء', en: 'Nothing' }],
        answer: 2,
        why: { ar: 'الماء يدفع مكبس حقنة الرفع فتنفتح الأذرع وترتفع المنصة.', en: 'Water pushes the lift plunger, the arms open and the platform rises.' } },
      { q: { ar: 'ما اسم شكل الأذرع المتقاطعة في المصعد؟', en: 'What is the crossing-arms shape called?' },
        options: [{ ar: 'آلية المقص', en: 'Scissor mechanism' }, { ar: 'نابض', en: 'Spring' }, { ar: 'بكرة', en: 'Pulley' }, { ar: 'ترس', en: 'Gear' }],
        answer: 0,
        why: { ar: 'تتصل الأذرع بمفاصل مثل المقص، فتتحول الحركة الأفقية الصغيرة إلى ارتفاع كبير.', en: 'Arms joined like scissors turn a small sideways push into a big lift.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 3) إشارة المرور — الدوائر الكهربائية والتحكم بالتوقيت
   * ------------------------------------------------------------------ */
  {
    id: 'traffic-light',
    emoji: '🚦',
    title: { ar: 'إشارة المرور', en: 'Traffic Light' },
    concept: { ar: 'الدوائر والتوقيت', en: 'Circuits & Timing' },
    category: { ar: 'إلكترونيات', en: 'Electronics' },
    level: 1, minutes: 8,
    bg: GROUND(262),
    parts: [
      { id: 'pole', name: { ar: 'العمود', en: 'Pole' }, tip: { ar: 'يرفع الإشارة لتراها السيارات', en: 'Holds the light up high' },
        slot: { x: 140, y: 96, w: 120, h: 172 },
        art: `<rect x="150" y="250" width="100" height="14" rx="6" fill="#64748B"/><rect x="190" y="100" width="20" height="152" rx="4" fill="#94A3B8" stroke="#64748B" stroke-width="2"/>` },
      { id: 'housing', name: { ar: 'صندوق الإشارة', en: 'Light Box' }, tip: { ar: 'يحمي المصابيح', en: 'Protects the lights' },
        slot: { x: 150, y: 14, w: 100, h: 196 }, needs: ['pole'],
        art: `<rect x="160" y="20" width="80" height="186" rx="18" fill="${PAL.dark}" stroke="#15121c" stroke-width="3"/>` +
          [58, 113, 168].map(y => `<circle cx="200" cy="${y}" r="22" fill="#111"/><path d="M174 ${y - 14} Q200 ${y - 34} 226 ${y - 14}" fill="none" stroke="#4B4560" stroke-width="5" stroke-linecap="round"/>`).join('') },
      { id: 'red', name: { ar: 'مصباح أحمر', en: 'Red LED' }, tip: { ar: 'يعني: قف!', en: 'Means: STOP!' },
        slot: { x: 172, y: 30, w: 56, h: 56 }, needs: ['housing'],
        art: `<circle cx="200" cy="58" r="18" fill="#7F1D1D"/><circle class="tl-red" cx="200" cy="58" r="18" fill="#EF4444" filter="url(#fGlow)"/>` },
      { id: 'yellow', name: { ar: 'مصباح أصفر', en: 'Yellow LED' }, tip: { ar: 'يعني: استعد', en: 'Means: get ready' },
        slot: { x: 172, y: 85, w: 56, h: 56 }, needs: ['housing'],
        art: `<circle cx="200" cy="113" r="18" fill="#713F12"/><circle class="tl-yellow" cx="200" cy="113" r="18" fill="#FACC15" filter="url(#fGlow)"/>` },
      { id: 'green', name: { ar: 'مصباح أخضر', en: 'Green LED' }, tip: { ar: 'يعني: انطلق', en: 'Means: GO' },
        slot: { x: 172, y: 140, w: 56, h: 56 }, needs: ['housing'],
        art: `<circle cx="200" cy="168" r="18" fill="#14532D"/><circle class="tl-green" cx="200" cy="168" r="18" fill="#22C55E" filter="url(#fGlow)"/>` },
      { id: 'controller', name: { ar: 'لوحة التحكم', en: 'Controller' }, tip: { ar: 'العقل الذي ينظم التوقيت', en: 'The brain that sets the timing' },
        slot: { x: 20, y: 186, w: 124, h: 84 }, needs: ['pole'],
        art: `<rect x="28" y="196" width="94" height="62" rx="6" fill="#047857" stroke="#065F46" stroke-width="2"/>` +
          `<rect x="54" y="212" width="40" height="28" rx="3" fill="#111827"/>` +
          [0, 1, 2, 3, 4].map(i => `<rect x="${57 + i * 8}" y="208" width="3" height="4" fill="#D1D5DB"/><rect x="${57 + i * 8}" y="240" width="3" height="4" fill="#D1D5DB"/>`).join('') +
          `<circle class="blink" cx="108" cy="206" r="4" fill="#F87171"/>` +
          Draw.wire('M122 222 C150 222 160 200 190 200') + Draw.wire('M122 232 C155 232 165 214 190 214', '#111') }
    ],
    fx: '', fxStatic: '', rig: '',
    flow: [
      { icon: '🔋', ar: 'كهرباء', en: 'Power' },
      { icon: '🧠', ar: 'لوحة التحكم', en: 'Controller' },
      { icon: '⏱️', ar: 'مؤقّت', en: 'Timer' },
      { icon: '💡', ar: 'المصابيح', en: 'LEDs' },
      { icon: '🚗', ar: 'سيارات آمنة', en: 'Safe cars' }
    ],
    explain: {
      ar: 'لوحة التحكم تعمل كساعة ذكية: تغلق دائرة المصباح الأحمر لفترة، ثم الأخضر، ثم الأصفر، وتكرر ذلك. المصباح يضيء فقط عندما تكون الدائرة الكهربائية مغلقة ويمر فيها التيار.',
      en: 'The controller works like a smart clock: it closes the red LED\'s circuit for a while, then the green, then the yellow, and repeats. An LED only lights up when its circuit is closed and current flows.'
    },
    fact: { ar: 'أول إشارة مرور كهربائية ظهرت عام 1914!', en: 'The first electric traffic light appeared in 1914!' },
    quiz: [
      { q: { ar: 'أي لون يعني «قف»؟', en: 'Which color means STOP?' },
        options: [{ ar: 'الأخضر', en: 'Green' }, { ar: 'الأحمر', en: 'Red' }, { ar: 'الأصفر', en: 'Yellow' }, { ar: 'الأزرق', en: 'Blue' }],
        answer: 1, why: { ar: 'الأحمر لون التحذير ويُرى من مسافة بعيدة.', en: 'Red is the warning color and is seen from far away.' } },
      { q: { ar: 'ما وظيفة لوحة التحكم؟', en: 'What does the controller do?' },
        options: [
          { ar: 'تشغّل المصابيح وتطفئها بالترتيب والتوقيت الصحيح', en: 'Turns the lights on and off in the right order and timing' },
          { ar: 'تجعل المصابيح أكبر', en: 'Makes the lights bigger' },
          { ar: 'تقيس درجة الحرارة', en: 'Measures temperature' },
          { ar: 'تغيّر لون العمود', en: 'Changes the pole color' }],
        answer: 0, why: { ar: 'هي «عقل» الإشارة وتحتوي على مؤقّت.', en: 'It is the light\'s "brain" and contains a timer.' } },
      { q: { ar: 'ليضيء المصباح، يجب أن تكون الدائرة الكهربائية…', en: 'For an LED to light up, the circuit must be…' },
        options: [{ ar: 'مفتوحة', en: 'Open' }, { ar: 'مقطوعة', en: 'Cut' }, { ar: 'مبللة', en: 'Wet' }, { ar: 'مغلقة', en: 'Closed' }],
        answer: 3, why: { ar: 'الدائرة المغلقة تسمح للتيار بالمرور في حلقة كاملة.', en: 'A closed circuit lets current flow in a full loop.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 4) القارب الهوائي — الطفو + الدفع
   * ------------------------------------------------------------------ */
  {
    id: 'airboat',
    emoji: '🚤',
    title: { ar: 'القارب الهوائي', en: 'Airboat' },
    concept: { ar: 'الطفو والدفع', en: 'Buoyancy & Thrust' },
    category: { ar: 'فيزياء', en: 'Physics' },
    level: 2, minutes: 10,
    bg: `<rect x="0" y="214" width="400" height="86" fill="#BAE6FD"/>`,
    parts: [
      { id: 'hull', name: { ar: 'جسم القارب', en: 'Foam Hull' }, tip: { ar: 'خفيف فيطفو فوق الماء', en: 'Light enough to float' },
        slot: { x: 50, y: 178, w: 292, h: 56 },
        art: `<path d="M58 186 L336 186 L318 222 Q200 236 80 222 Z" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2"/><path d="M70 200 L326 200" stroke="${PAL.purple}" stroke-width="5"/>` },
      { id: 'post', name: { ar: 'حامل المحرك', en: 'Motor Mount' }, tip: { ar: 'يرفع المروحة فوق الماء', en: 'Lifts the fan above water' },
        slot: { x: 222, y: 100, w: 36, h: 90 }, needs: ['hull'],
        art: Draw.wood(230, 108, 18, 80) },
      { id: 'battery', name: { ar: 'البطارية', en: 'Battery' }, tip: { ar: 'مصدر الطاقة', en: 'Power source' },
        slot: { x: 90, y: 150, w: 80, h: 40 }, needs: ['hull'],
        art: Draw.battery(96, 154, 66, 32) },
      { id: 'motor', name: { ar: 'المحرك', en: 'Motor' }, tip: { ar: 'يدير المروحة', en: 'Spins the propeller' },
        slot: { x: 196, y: 76, w: 96, h: 52 }, needs: ['post'],
        art: Draw.wire('M162 166 C200 166 205 120 214 116') + Draw.motor(204, 84, 64, 34) },
      { id: 'propeller', name: { ar: 'المروحة', en: 'Propeller' }, tip: { ar: 'تدفع الهواء للخلف', en: 'Blows air backward' },
        slot: { x: 228, y: 42, w: 118, h: 118 }, needs: ['motor'],
        art: Draw.prop(286, 101, 56, 'spin', '#8B5CF6').replaceAll(PAL.redD, '#6D28D9') },
      { id: 'rudder', name: { ar: 'الدفّة', en: 'Rudder' }, tip: { ar: 'توجّه القارب يميناً ويساراً', en: 'Steers left and right' },
        slot: { x: 334, y: 118, w: 34, h: 80 }, needs: ['hull'],
        art: `<line x1="336" y1="186" x2="352" y2="182" stroke="${PAL.metalS}" stroke-width="4"/><rect x="346" y="126" width="12" height="60" rx="4" fill="${PAL.purpleL}" stroke="${PAL.purple}" stroke-width="2"/>` }
    ],
    fx: Draw.wind(362, 398, [70, 101, 132]),
    fxStatic: `<g class="waves"><path d="M-60 222 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#38BDF8" stroke-width="4"/><path d="M-60 250 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#7DD3FC" stroke-width="3"/></g>`,
    rig: 'rig-bob',
    flow: [
      { icon: '🔋', ar: 'بطارية', en: 'Battery' },
      { icon: '⚙️', ar: 'محرك', en: 'Motor' },
      { icon: '🌀', ar: 'مروحة', en: 'Propeller' },
      { icon: '💨', ar: 'دفع الهواء', en: 'Air thrust' },
      { icon: '🚤', ar: 'القارب ينزلق', en: 'Boat glides' }
    ],
    explain: {
      ar: 'جسم القارب خفيف ويزيح كمية من الماء، فيدفعه الماء إلى أعلى (قوة الطفو) فيطفو. المروحة في الهواء تدفع الهواء للخلف فيندفع القارب للأمام، والدفّة توجّه تيار الهواء لتغيير الاتجاه.',
      en: 'The light hull pushes some water aside, and the water pushes back up (buoyancy), so it floats. The propeller in the air blows air backward, pushing the boat forward, and the rudder steers the airflow to turn.'
    },
    fact: { ar: 'القوارب الهوائية تستطيع السير فوق المستنقعات الضحلة وحتى الجليد!', en: 'Airboats can glide over shallow swamps and even ice!' },
    quiz: [
      { q: { ar: 'لماذا يطفو القارب فوق الماء؟', en: 'Why does the boat float?' },
        options: [
          { ar: 'لأن الماء يدفعه لأعلى بقوة الطفو', en: 'Because water pushes it up with buoyancy' },
          { ar: 'لأن المروحة ترفعه', en: 'Because the propeller lifts it' },
          { ar: 'لأن البطارية مليئة بالهواء', en: 'Because the battery is full of air' },
          { ar: 'لأن الماء بارد', en: 'Because the water is cold' }],
        answer: 0, why: { ar: 'الأجسام الخفيفة مقارنةً بحجمها تطفو بفضل قوة الطفو.', en: 'Objects that are light for their size float thanks to buoyancy.' } },
      { q: { ar: 'لماذا توضع المروحة في الهواء وليس تحت الماء؟', en: 'Why is the propeller in the air, not under water?' },
        options: [
          { ar: 'لتبدو أجمل', en: 'To look nicer' },
          { ar: 'ليسير القارب في المياه الضحلة دون أن تعلق المروحة', en: 'So the boat can cross shallow water without getting stuck' },
          { ar: 'لأن الماء يطفئ المحرك فقط', en: 'Only because water stops the motor' },
          { ar: 'لتبريد البطارية', en: 'To cool the battery' }],
        answer: 1, why: { ar: 'لا شيء تحت القارب يعلق بالنباتات أو القاع.', en: 'Nothing under the boat can get caught on plants or the bottom.' } },
      { q: { ar: 'ما وظيفة الدفّة؟', en: 'What is the rudder for?' },
        options: [{ ar: 'زيادة السرعة', en: 'Going faster' }, { ar: 'شحن البطارية', en: 'Charging the battery' }, { ar: 'توجيه القارب', en: 'Steering the boat' }, { ar: 'إيقاف المحرك', en: 'Stopping the motor' }],
        answer: 2, why: { ar: 'تحرف الدفّة تيار الهواء فيلتف القارب.', en: 'The rudder bends the airflow so the boat turns.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 5) الشمس والأرض والقمر — الدوران والمدارات (منظر علوي)
   * ------------------------------------------------------------------ */
  {
    id: 'solar-system',
    emoji: '🌍',
    title: { ar: 'الشمس والأرض والقمر', en: 'Earth, Moon & Sun' },
    concept: { ar: 'المدارات والفصول', en: 'Orbits & Time' },
    category: { ar: 'فلك', en: 'Astronomy' },
    level: 2, minutes: 12,
    photo: 'img/solar-system.webp',
    bg: `<rect x="0" y="0" width="400" height="300" fill="#1E1B4B"/>` +
      [[30, 30], [80, 260], [360, 40], [372, 250], [20, 160], [120, 18], [300, 280], [384, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#E0E7FF"/>`).join(''),
    parts: [
      { id: 'base', name: { ar: 'القاعدة الخشبية', en: 'Wooden Base' }, tip: { ar: 'تحمل النموذج ومسار المدار', en: 'Holds the model and orbit path' },
        slot: { x: 44, y: 4, w: 312, h: 292 },
        art: `<rect x="50" y="10" width="300" height="280" rx="22" fill="${PAL.wood}" stroke="${PAL.woodS}" stroke-width="3" opacity=".95"/>` +
          `<circle cx="200" cy="150" r="110" fill="none" stroke="${PAL.purple}" stroke-width="2" stroke-dasharray="6 6" opacity=".6"/>` },
      { id: 'sun', name: { ar: 'الشمس', en: 'Sun' }, tip: { ar: 'نجم في المركز', en: 'A star in the center' },
        slot: { x: 160, y: 110, w: 80, h: 80 }, needs: ['base'],
        art: `<circle class="sun-glow" cx="200" cy="150" r="36" fill="#FDE68A" opacity=".5"/><circle cx="200" cy="150" r="28" fill="url(#gSun)" stroke="#EA580C" stroke-width="2"/>` },
      { id: 'arm', name: { ar: 'ذراع المدار', en: 'Orbit Arm' }, tip: { ar: 'تحمل الأرض حول الشمس', en: 'Carries Earth around the Sun' },
        slot: { x: 186, y: 132, w: 152, h: 36 }, needs: ['sun'],
        art: `<g class="orbit-earth pivot" style="transform-origin:200px 150px"><rect x="228" y="145" width="84" height="10" rx="5" fill="${PAL.woodS}"/>` +
          `<line x1="228" y1="150" x2="296" y2="150" stroke="${PAL.yellow}" stroke-width="2" stroke-dasharray="4 3"/></g>` },
      { id: 'earth', name: { ar: 'الأرض', en: 'Earth' }, tip: { ar: 'كوكبنا الأزرق', en: 'Our blue planet' },
        slot: { x: 288, y: 128, w: 44, h: 44 }, needs: ['arm'],
        art: `<g class="orbit-earth pivot" style="transform-origin:200px 150px"><circle cx="310" cy="150" r="16" fill="${PAL.blue}" stroke="#1D4ED8" stroke-width="2"/>` +
          `<path d="M302 142 q6 -4 9 2 q-2 6 -8 4 z M312 154 q6 -2 8 4 q-4 4 -9 0 z" fill="${PAL.green}"/></g>` },
      { id: 'moon', name: { ar: 'القمر', en: 'Moon' }, tip: { ar: 'يدور حول الأرض', en: 'Circles the Earth' },
        slot: { x: 322, y: 134, w: 32, h: 32 }, needs: ['earth'],
        art: `<g class="orbit-earth pivot" style="transform-origin:200px 150px"><g class="orbit-moon pivot" style="transform-origin:310px 150px">` +
          `<circle cx="338" cy="150" r="8" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="2"/><circle cx="336" cy="148" r="2" fill="#9CA3AF"/></g></g>` }
    ],
    fx: '', fxStatic: '', rig: '',
    flow: [
      { icon: '✋', ar: 'تدوير الذراع', en: 'Turn the arm' },
      { icon: '🌍', ar: 'الأرض تدور حول الشمس', en: 'Earth orbits Sun' },
      { icon: '🌙', ar: 'القمر يدور حول الأرض', en: 'Moon orbits Earth' },
      { icon: '📅', ar: 'سنة وشهر', en: 'Year & month' }
    ],
    explain: {
      ar: 'تدور الأرض حول الشمس دورة كاملة كل 365 يوماً تقريباً (سنة)، بينما يدور القمر حول الأرض كل 27 يوماً تقريباً (شهر قمري). وفي الوقت نفسه تدور الأرض حول نفسها كل 24 ساعة فيحدث الليل والنهار.',
      en: 'Earth travels once around the Sun about every 365 days (a year), while the Moon circles Earth about every 27 days (a lunar month). Meanwhile Earth spins on itself every 24 hours, making day and night.'
    },
    fact: { ar: 'يمكن أن تتسع الشمس لأكثر من مليون كرة بحجم الأرض!', en: 'More than a million Earths could fit inside the Sun!' },
    quiz: [
      { q: { ar: 'كم تستغرق الأرض لتدور حول الشمس دورة كاملة؟', en: 'How long does Earth take to go once around the Sun?' },
        options: [{ ar: 'يوماً واحداً', en: 'One day' }, { ar: 'شهراً واحداً', en: 'One month' }, { ar: 'سنة (365 يوماً تقريباً)', en: 'A year (about 365 days)' }, { ar: '100 سنة', en: '100 years' }],
        answer: 2, why: { ar: 'هذه الدورة هي ما نسميه «سنة».', en: 'That trip is what we call a "year".' } },
      { q: { ar: 'أي جرم يدور حول الأرض؟', en: 'What orbits the Earth?' },
        options: [{ ar: 'القمر', en: 'The Moon' }, { ar: 'الشمس', en: 'The Sun' }, { ar: 'المريخ', en: 'Mars' }, { ar: 'المشتري', en: 'Jupiter' }],
        answer: 0, why: { ar: 'القمر هو التابع الطبيعي الوحيد للأرض.', en: 'The Moon is Earth\'s only natural satellite.' } },
      { q: { ar: 'ما سبب حدوث الليل والنهار؟', en: 'What causes day and night?' },
        options: [
          { ar: 'القمر يغطي الشمس', en: 'The Moon covers the Sun' },
          { ar: 'دوران الأرض حول نفسها', en: 'Earth spinning on its axis' },
          { ar: 'الشمس تنطفئ ليلاً', en: 'The Sun switches off at night' },
          { ar: 'الغيوم', en: 'Clouds' }],
        answer: 1, why: { ar: 'الجانب المقابل للشمس يكون نهاراً، والجانب الآخر ليلاً.', en: 'The side facing the Sun has day; the other side has night.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 6) الرافعة الهيدروليكية — الروافع + مبدأ باسكال
   * ------------------------------------------------------------------ */
  {
    id: 'hydraulic-crane',
    emoji: '🏗️',
    title: { ar: 'الرافعة الهيدروليكية', en: 'Hydraulic Crane' },
    concept: { ar: 'الروافع والضغط', en: 'Levers & Pressure' },
    category: { ar: 'هيدروليك', en: 'Hydraulics' },
    level: 3, minutes: 15,
    bg: GROUND(262),
    parts: [
      { id: 'base', name: { ar: 'القاعدة الدوّارة', en: 'Turntable Base' }, tip: { ar: 'تثبّت الرافعة على الأرض', en: 'Keeps the crane steady' },
        slot: { x: 40, y: 220, w: 222, h: 44 },
        art: Draw.wood(46, 240, 208, 20) + `<rect x="96" y="226" width="110" height="16" rx="6" fill="${PAL.purpleL}" stroke="${PAL.purple}" stroke-width="2"/>` },
      { id: 'tower', name: { ar: 'البرج', en: 'Tower' }, tip: { ar: 'العمود الذي يحمل الذراع', en: 'The column holding the arm' },
        slot: { x: 128, y: 104, w: 50, h: 128 }, needs: ['base'],
        art: Draw.wood(140, 112, 26, 118) },
      { id: 'boom', name: { ar: 'ذراع الرافعة', en: 'Boom Arm' }, tip: { ar: 'رافعة طويلة ترفع الأحمال', en: 'A long lever that lifts loads' },
        slot: { x: 136, y: 58, w: 230, h: 84 }, needs: ['tower'],
        art: `<g class="crane-boom pivot" style="transform-origin:153px 124px;transform:rotate(-12deg)">` + Draw.wood(141, 116, 212, 16, 8) + Draw.pin(153, 124, 6) + Draw.pin(345, 124, 4) + `</g>` },
      { id: 'hook', name: { ar: 'الخطاف والحمولة', en: 'Hook & Load' }, tip: { ar: 'يمسك الصندوق', en: 'Grabs the crate' },
        slot: { x: 318, y: 72, w: 70, h: 110 }, needs: ['boom'],
        art: `<g class="crane-boom pivot" style="transform-origin:153px 124px;transform:rotate(-12deg)"><g class="crane-hook pivot" style="transform-origin:345px 124px;transform:rotate(12deg)">` +
          `<line x1="345" y1="124" x2="345" y2="166" stroke="#334155" stroke-width="2.5"/><path d="M345 166 q0 10 -8 10" fill="none" stroke="#334155" stroke-width="3"/>` +
          `<rect x="330" y="172" width="30" height="24" rx="3" fill="${PAL.orange}" stroke="#B45309" stroke-width="2"/><line x1="330" y1="184" x2="360" y2="184" stroke="#B45309"/></g></g>` },
      { id: 'cylinder', name: { ar: 'حقنة الذراع', en: 'Arm Syringe' }, tip: { ar: 'تدفع الذراع لأعلى', en: 'Pushes the arm upward' },
        slot: { x: 156, y: 98, w: 106, h: 118 }, needs: ['boom'],
        // الأسطوانة تدور حول قاعدتها (170,206) ومكبسها يتمدد — متزامنة مع حركة الذراع
        art: `<g class="crane-cyl pivot" style="transform-origin:170px 206px;transform:rotate(-49.9deg)">` +
          `<g class="crane-cyl-rod" style="transform:translateX(24.4px)"><rect x="210" y="203" width="60" height="6" rx="2" fill="#E2E8F0" stroke="#94A3B8"/></g>` +
          `<rect x="166" y="198" width="72" height="16" rx="3" fill="${PAL.water}" stroke="#94A3B8" stroke-width="2" fill-opacity=".8"/></g>` + Draw.pin(170, 206, 5) },
      { id: 'master', name: { ar: 'حقنة التحكم + الأنبوب', en: 'Control Syringe + Tube' }, tip: { ar: 'اضغطها لترفع الذراع', en: 'Press it to raise the arm' },
        slot: { x: 4, y: 196, w: 172, h: 100 }, needs: ['cylinder'],
        art: `<path d="M118 278 C150 278 150 228 168 210" fill="none" stroke="#0EA5E9" stroke-width="5" stroke-linecap="round"/>` +
          `<path class="flow-dash" d="M118 278 C150 278 150 228 168 210" fill="none" stroke="#E0F2FE" stroke-width="2" stroke-dasharray="6 8"/>` +
          Draw.syringe(40, 270, 70, 16, { side: 'left', plungerCls: 'crane-push' }) }
    ],
    fx: '', fxStatic: '', rig: '',
    flow: [
      { icon: '✋', ar: 'ضغط الحقنة', en: 'Press syringe' },
      { icon: '💧', ar: 'الماء ينقل الضغط', en: 'Water carries pressure' },
      { icon: '💉', ar: 'المكبس يتمدد', en: 'Piston extends' },
      { icon: '🏗️', ar: 'الذراع ترتفع', en: 'Boom rises' },
      { icon: '📦', ar: 'رفع الحمولة', en: 'Load lifted' }
    ],
    explain: {
      ar: 'الضغط على حقنة التحكم يدفع الماء إلى حقنة الذراع فيتمدد مكبسها ويرفع الذراع. الذراع تعمل كرافعة تدور حول مفصل أعلى البرج: حركة صغيرة قرب المفصل تصبح حركة كبيرة عند طرف الذراع.',
      en: 'Pressing the control syringe pushes water into the arm syringe; its piston extends and lifts the boom. The boom is a lever that turns around a joint on the tower: a small push near the joint becomes a big movement at the tip.'
    },
    fact: { ar: 'الحفّارات والجرّافات الحقيقية تستخدم الزيت بدلاً من الماء!', en: 'Real excavators use oil instead of water!' },
    quiz: [
      { q: { ar: 'ماذا ينص مبدأ باسكال؟', en: 'What does Pascal\'s principle say?' },
        options: [
          { ar: 'الضغط في السائل ينتقل بالتساوي في كل الاتجاهات', en: 'Pressure in a liquid is passed equally in all directions' },
          { ar: 'السوائل تطير عند تسخينها', en: 'Liquids fly when heated' },
          { ar: 'الماء أثقل من الحديد', en: 'Water is heavier than iron' },
          { ar: 'الهواء يدفع الماء دائماً', en: 'Air always pushes water' }],
        answer: 0, why: { ar: 'لذلك تتحرك الحقنة الثانية عندما تضغط الأولى.', en: 'That\'s why the second syringe moves when you press the first.' } },
      { q: { ar: 'ذراع الرافعة الطويلة تعمل مثل…', en: 'The long crane boom works like a…' },
        options: [{ ar: 'عجلة', en: 'Wheel' }, { ar: 'رافعة (عتلة)', en: 'Lever' }, { ar: 'بطارية', en: 'Battery' }, { ar: 'مرآة', en: 'Mirror' }],
        answer: 1, why: { ar: 'تدور حول نقطة ارتكاز ثابتة مثل العتلة.', en: 'It turns around a fixed pivot point, just like a lever.' } },
      { q: { ar: 'إذا ضغطت حقنة صغيرة متصلة بحقنة كبيرة، فإن الحقنة الكبيرة…', en: 'If a small syringe pushes a big one, the big syringe…' },
        options: [
          { ar: 'تدفع بقوة أقل وتتحرك أكثر', en: 'Pushes weaker and moves more' },
          { ar: 'لا تتحرك أبداً', en: 'Never moves' },
          { ar: 'تنفجر', en: 'Explodes' },
          { ar: 'تدفع بقوة أكبر لكن تتحرك مسافة أقل', en: 'Pushes stronger but moves a shorter distance' }],
        answer: 3, why: { ar: 'هكذا ترفع الآلات الهيدروليكية أحمالاً ثقيلة جداً.', en: 'That\'s how hydraulic machines lift very heavy loads.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 7) مضخة النفط — تحويل الحركة الدورانية إلى حركة ترددية
   * ------------------------------------------------------------------ */
  {
    id: 'oil-pump',
    emoji: '🛢️',
    title: { ar: 'مضخة النفط', en: 'Oil Pump' },
    concept: { ar: 'تحويل الحركة', en: 'Changing Motion' },
    category: { ar: 'ميكانيكا', en: 'Mechanics' },
    level: 3, minutes: 14,
    bg: GROUND(258) + `<rect x="2" y="236" width="30" height="22" rx="3" fill="#475569"/><rect x="2" y="240" width="30" height="4" fill="#334155"/>`,
    parts: [
      { id: 'base', name: { ar: 'القاعدة الحديدية', en: 'Steel Base' }, tip: { ar: 'تحمل المضخة الثقيلة', en: 'Carries the heavy pump' },
        slot: { x: 36, y: 236, w: 344, h: 28 },
        art: `<rect x="42" y="244" width="332" height="14" rx="3" fill="#64748B" stroke="#334155" stroke-width="2"/>` },
      { id: 'frame', name: { ar: 'الحامل الثلاثي', en: 'A-Frame' }, tip: { ar: 'نقطة ارتكاز العارضة', en: 'The pivot for the beam' },
        slot: { x: 150, y: 98, w: 100, h: 150 }, needs: ['base'],
        art: Draw.bar(165, 244, 200, 112, 10) + Draw.bar(235, 244, 200, 112, 10) + Draw.bar(182, 190, 218, 190, 7) },
      { id: 'beam', name: { ar: 'العارضة المتأرجحة', en: 'Walking Beam' }, tip: { ar: 'تتأرجح مثل الأرجوحة', en: 'Rocks like a seesaw' },
        slot: { x: 40, y: 70, w: 292, h: 92 }, needs: ['frame'],
        art: `<g class="pump-beam pivot" style="transform-origin:200px 108px">` + Draw.wood(80, 100, 240, 15, 6) +
          `<path d="M84 96 Q48 96 46 132 L52 152 L64 150 Q66 120 86 118 Z" fill="${PAL.orange}" stroke="#B45309" stroke-width="2"/>` + Draw.pin(200, 108, 6) + `</g>` },
      { id: 'rod', name: { ar: 'قضيب البئر', en: 'Well Rod' }, tip: { ar: 'يسحب النفط من باطن الأرض', en: 'Pulls oil up from underground' },
        slot: { x: 30, y: 140, w: 56, h: 110 }, needs: ['beam'],
        art: `<g class="pump-rod"><line x1="57" y1="150" x2="57" y2="232" stroke="${PAL.metalS}" stroke-width="4"/></g>` +
          `<rect x="45" y="222" width="24" height="24" rx="3" fill="#475569"/><rect x="28" y="228" width="20" height="6" fill="#475569"/>` },
      { id: 'crank', name: { ar: 'الذراع الدوّارة والثقل', en: 'Crank & Counterweight' }, tip: { ar: 'تحوّل الدوران إلى تأرجح', en: 'Turns spinning into rocking' },
        slot: { x: 248, y: 152, w: 92, h: 96 }, needs: ['base'],
        art: `<rect x="270" y="200" width="46" height="44" rx="4" fill="#64748B" stroke="#334155" stroke-width="2"/>` +
          `<g class="crank"><circle cx="293" cy="200" r="42" fill="transparent"/><rect x="289" y="164" width="8" height="38" fill="#334155"/>` +
          `<rect x="274" y="158" width="38" height="22" rx="6" fill="${PAL.red}" stroke="${PAL.redD}" stroke-width="2"/></g>` + Draw.pin(293, 200, 6) },
      { id: 'motor', name: { ar: 'المحرك', en: 'Motor' }, tip: { ar: 'يدير الذراع الدوّارة', en: 'Turns the crank' },
        slot: { x: 316, y: 204, w: 80, h: 44 }, needs: ['crank'],
        art: `<line x1="293" y1="200" x2="340" y2="226" stroke="#111" stroke-width="3"/>` + Draw.motor(330, 214, 54, 26, 'left') }
    ],
    fx: '',
    fxStatic: `<g class="oil-drops"><ellipse class="drop" cx="31" cy="238" rx="3" ry="4" fill="#111827"/><ellipse class="drop d2" cx="31" cy="238" rx="3" ry="4" fill="#111827"/></g>`,
    rig: '',
    flow: [
      { icon: '⚡', ar: 'كهرباء', en: 'Electricity' },
      { icon: '⚙️', ar: 'المحرك يدور', en: 'Motor spins' },
      { icon: '🔄', ar: 'ذراع دوّارة', en: 'Crank turns' },
      { icon: '↕️', ar: 'العارضة تتأرجح', en: 'Beam rocks' },
      { icon: '🛢️', ar: 'النفط يصعد', en: 'Oil rises' }
    ],
    explain: {
      ar: 'المحرك يدير الذراع الدوّارة في دائرة، فتتأرجح العارضة لأعلى ولأسفل مثل الأرجوحة. رأس العارضة يرفع قضيب البئر ويخفضه فيسحب النفط من باطن الأرض. الثقل الأحمر يوازن العارضة فيوفر طاقة المحرك.',
      en: 'The motor turns the crank in a circle, which rocks the beam up and down like a seesaw. The beam\'s head lifts and lowers the well rod, pulling oil up from deep underground. The red counterweight balances the beam to save the motor\'s energy.'
    },
    fact: { ar: 'بعض آبار النفط أعمق من 3 كيلومترات!', en: 'Some oil wells are more than 3 km deep!' },
    quiz: [
      { q: { ar: 'مضخة النفط تحوّل الحركة الدورانية إلى…', en: 'The oil pump changes spinning motion into…' },
        options: [{ ar: 'حرارة', en: 'Heat' }, { ar: 'حركة لأعلى ولأسفل', en: 'Up-and-down motion' }, { ar: 'ضوء', en: 'Light' }, { ar: 'صوت فقط', en: 'Only sound' }],
        answer: 1, why: { ar: 'تُسمى الحركة الترددية، وهي ما يحتاجه قضيب البئر.', en: 'It\'s called reciprocating motion — exactly what the well rod needs.' } },
      { q: { ar: 'ما فائدة الثقل الأحمر؟', en: 'What is the red counterweight for?' },
        options: [
          { ar: 'للزينة فقط', en: 'Only decoration' },
          { ar: 'لتخزين النفط', en: 'To store oil' },
          { ar: 'يوازن العارضة فيحتاج المحرك جهداً أقل', en: 'Balances the beam so the motor works less' },
          { ar: 'ليصدر صوتاً', en: 'To make noise' }],
        answer: 2, why: { ar: 'التوازن يقلل القوة المطلوبة لرفع العارضة.', en: 'Balance reduces the force needed to lift the beam.' } },
      { q: { ar: 'من أين جاء النفط؟', en: 'Where does oil come from?' },
        options: [
          { ar: 'من بقايا كائنات بحرية قديمة عبر ملايين السنين', en: 'Remains of ancient sea creatures over millions of years' },
          { ar: 'من المطر', en: 'From rain' },
          { ar: 'من الأشجار الحديثة', en: 'From today\'s trees' },
          { ar: 'من القمر', en: 'From the Moon' }],
        answer: 0, why: { ar: 'لذلك يُسمى «وقوداً أحفورياً».', en: 'That\'s why it is called a "fossil fuel".' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 8) الروبوت — المتحكم والحساسات والمشغّلات
   * ------------------------------------------------------------------ */
  {
    id: 'robot',
    emoji: '🤖',
    title: { ar: 'الروبوت', en: 'Robot' },
    concept: { ar: 'العقل والحركة', en: 'Brain & Motion' },
    category: { ar: 'روبوتات', en: 'Robotics' },
    level: 2, minutes: 12,
    bg: GROUND(262),
    parts: [
      { id: 'tracks', name: { ar: 'الجنازير', en: 'Tracks' }, tip: { ar: 'تحرك الروبوت على أي أرض', en: 'Move the robot on any ground' },
        slot: { x: 110, y: 218, w: 180, h: 46 },
        art: `<rect x="118" y="226" width="164" height="34" rx="17" fill="${PAL.dark}"/>` + [140, 177, 223, 260].map(x => Draw.wheel(x, 243, 12, 'spin')).join('') },
      { id: 'body', name: { ar: 'الجسم', en: 'Body' }, tip: { ar: 'يحمل كل الأجزاء', en: 'Holds all the parts' },
        slot: { x: 124, y: 114, w: 152, h: 114 }, needs: ['tracks'],
        art: `<rect x="186" y="112" width="28" height="14" fill="#6D28D9"/><rect x="132" y="122" width="136" height="104" rx="18" fill="#8B5CF6" stroke="#6D28D9" stroke-width="3"/>` },
      { id: 'head', name: { ar: 'الرأس', en: 'Head' }, tip: { ar: 'فيه العيون (الحساسات)', en: 'Has the eyes (sensors)' },
        slot: { x: 138, y: 36, w: 124, h: 88 }, needs: ['body'],
        art: `<rect x="140" y="64" width="12" height="26" rx="5" fill="${PAL.purpleL}"/><rect x="248" y="64" width="12" height="26" rx="5" fill="${PAL.purpleL}"/>` +
          `<rect x="148" y="44" width="104" height="74" rx="20" fill="#EDE9FE" stroke="${PAL.purple}" stroke-width="3"/>` +
          `<circle cx="180" cy="78" r="12" fill="#1E1B4B"/><circle cx="220" cy="78" r="12" fill="#1E1B4B"/>` +
          `<circle class="eye" cx="180" cy="78" r="7" fill="#22D3EE" filter="url(#fGlow)"/><circle class="eye" cx="220" cy="78" r="7" fill="#22D3EE" filter="url(#fGlow)"/>` +
          `<rect x="182" y="100" width="36" height="6" rx="3" fill="${PAL.purple}"/>` },
      { id: 'arms', name: { ar: 'الذراعان', en: 'Arms' }, tip: { ar: 'تتحرك بمحركات صغيرة', en: 'Moved by tiny motors' },
        slot: { x: 82, y: 120, w: 236, h: 110 }, needs: ['body'],
        art: `<g class="arm-l pivot" style="transform-origin:126px 138px"><rect x="106" y="128" width="24" height="76" rx="12" fill="${PAL.purpleL}" stroke="${PAL.purple}" stroke-width="2"/>` +
          `<path d="M108 204 l-6 14 M128 204 l6 14" stroke="#4C1D95" stroke-width="5" stroke-linecap="round"/></g>` +
          `<g class="arm-r pivot" style="transform-origin:274px 138px"><rect x="270" y="128" width="24" height="76" rx="12" fill="${PAL.purpleL}" stroke="${PAL.purple}" stroke-width="2"/>` +
          `<path d="M272 204 l-6 14 M292 204 l6 14" stroke="#4C1D95" stroke-width="5" stroke-linecap="round"/></g>` },
      { id: 'brain', name: { ar: 'المتحكم (العقل)', en: 'Controller (Brain)' }, tip: { ar: 'يقرر ماذا يفعل الروبوت', en: 'Decides what the robot does' },
        slot: { x: 150, y: 140, w: 100, h: 70 }, needs: ['body'],
        art: `<rect x="158" y="146" width="84" height="56" rx="8" fill="#1E1B4B"/><rect x="186" y="160" width="28" height="28" rx="3" fill="#312E81" stroke="#A5B4FC"/>` +
          `<circle class="blink" cx="170" cy="158" r="4" fill="#F87171"/><circle class="blink b2" cx="170" cy="174" r="4" fill="#FACC15"/><circle class="blink b3" cx="170" cy="190" r="4" fill="#4ADE80"/>` +
          `<path d="M222 160 h10 M222 170 h10 M222 180 h10 M222 190 h10" stroke="#A5B4FC" stroke-width="2"/>` },
      { id: 'antenna', name: { ar: 'الهوائي', en: 'Antenna' }, tip: { ar: 'يستقبل الأوامر لاسلكياً', en: 'Receives wireless commands' },
        slot: { x: 180, y: 2, w: 40, h: 46 }, needs: ['head'],
        art: `<line x1="200" y1="44" x2="200" y2="18" stroke="${PAL.purple}" stroke-width="4"/><circle class="blink" cx="200" cy="12" r="7" fill="${PAL.red}" filter="url(#fGlow)"/>` }
    ],
    fx: '', fxStatic: '', rig: 'rig-patrol',
    flow: [
      { icon: '📡', ar: 'أمر لاسلكي', en: 'Wireless command' },
      { icon: '👀', ar: 'الحساسات', en: 'Sensors' },
      { icon: '🧠', ar: 'المتحكم يقرر', en: 'Controller decides' },
      { icon: '⚙️', ar: 'المحركات', en: 'Motors' },
      { icon: '👋', ar: 'الروبوت يتحرك', en: 'Robot moves' }
    ],
    explain: {
      ar: 'كل روبوت يتكون من ثلاثة أشياء: حساسات (مثل العيون) تجمع المعلومات، ومتحكم (العقل) يقرر ماذا يفعل، ومشغّلات (محركات) تنفذ الحركة مثل تحريك الذراعين والجنازير.',
      en: 'Every robot has three things: sensors (like eyes) that gather information, a controller (the brain) that decides what to do, and actuators (motors) that move the arms and tracks.'
    },
    fact: { ar: 'كلمة «روبوت» تعني «العمل» في اللغة التشيكية!', en: 'The word "robot" comes from a Czech word meaning "work"!' },
    quiz: [
      { q: { ar: 'أي قطعة هي «عقل» الروبوت؟', en: 'Which part is the robot\'s "brain"?' },
        options: [{ ar: 'الجنازير', en: 'Tracks' }, { ar: 'الهوائي', en: 'Antenna' }, { ar: 'المتحكم', en: 'Controller' }, { ar: 'الذراعان', en: 'Arms' }],
        answer: 2, why: { ar: 'المتحكم يشغّل البرنامج ويتخذ القرارات.', en: 'The controller runs the program and makes decisions.' } },
      { q: { ar: 'الحساسات في الروبوت تشبه…', en: 'A robot\'s sensors are like our…' },
        options: [{ ar: 'حواسنا (العين والأذن)', en: 'Senses (eyes and ears)' }, { ar: 'ملابسنا', en: 'Clothes' }, { ar: 'طعامنا', en: 'Food' }, { ar: 'شعرنا', en: 'Hair' }],
        answer: 0, why: { ar: 'تساعد الروبوت على «الإحساس» بما حوله.', en: 'They help the robot "feel" the world around it.' } },
      { q: { ar: 'ماذا نسمي المحركات التي تحرك أجزاء الروبوت؟', en: 'What do we call the motors that move a robot\'s parts?' },
        options: [{ ar: 'بطاريات', en: 'Batteries' }, { ar: 'مشغّلات', en: 'Actuators' }, { ar: 'شاشات', en: 'Screens' }, { ar: 'أسلاك', en: 'Wires' }],
        answer: 1, why: { ar: 'المشغّلات تحوّل أوامر المتحكم إلى حركة.', en: 'Actuators turn the controller\'s commands into motion.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 9) الكاميرا — انتقال الضوء في خطوط مستقيمة
   * ------------------------------------------------------------------ */
  {
    id: 'camera',
    emoji: '📷',
    title: { ar: 'الكاميرا', en: 'Camera' },
    concept: { ar: 'الضوء والصورة', en: 'Light & Images' },
    category: { ar: 'بصريات', en: 'Optics' },
    level: 2, minutes: 10,
    // الشجرة في الخلفية هي «الجسم» الذي نصوّره
    bg: GROUND(262) + `<rect x="22" y="160" width="6" height="16" fill="#92400E"/><circle cx="25" cy="148" r="13" fill="${PAL.green}"/>`,
    parts: [
      { id: 'body', name: { ar: 'جسم الكاميرا', en: 'Camera Box' }, tip: { ar: 'صندوق مظلم من الداخل', en: 'A box that is dark inside' },
        slot: { x: 102, y: 88, w: 142, h: 136 },
        art: `<rect x="110" y="96" width="125" height="120" rx="14" fill="#F5F3FF" stroke="#5B21B6" stroke-width="8"/>` },
      { id: 'lens', name: { ar: 'العدسة', en: 'Lens' }, tip: { ar: 'تجمع الضوء في نقطة', en: 'Gathers the light' },
        slot: { x: 96, y: 118, w: 46, h: 74 }, needs: ['body'],
        art: `<ellipse cx="118" cy="155" rx="10" ry="30" fill="#93C5FD" fill-opacity=".8" stroke="#1D4ED8" stroke-width="3"/>` },
      { id: 'sensor', name: { ar: 'الحساس', en: 'Image Sensor' }, tip: { ar: 'يلتقط الصورة', en: 'Captures the picture' },
        slot: { x: 204, y: 108, w: 34, h: 96 }, needs: ['body'],
        art: `<rect x="212" y="114" width="10" height="84" rx="2" fill="#1F2937"/><rect x="214" y="118" width="6" height="76" fill="#4338CA"/>` },
      { id: 'shutter', name: { ar: 'زر الالتقاط', en: 'Shutter Button' }, tip: { ar: 'اضغطه لتلتقط صورة', en: 'Press it to take a photo' },
        slot: { x: 182, y: 70, w: 44, h: 30 }, needs: ['body'],
        art: `<g class="shutter"><rect x="190" y="80" width="26" height="14" rx="4" fill="${PAL.red}" stroke="${PAL.redD}" stroke-width="2"/></g>` },
      { id: 'flash', name: { ar: 'الفلاش', en: 'Flash' }, tip: { ar: 'يضيف ضوءاً في الظلام', en: 'Adds light in the dark' },
        slot: { x: 118, y: 62, w: 56, h: 36 }, needs: ['body'],
        art: `<rect x="126" y="72" width="40" height="22" rx="5" fill="#E5E7EB" stroke="#6B7280" stroke-width="2"/><rect x="132" y="76" width="28" height="14" rx="3" fill="#FEF9C3"/>` +
          `<circle class="flash-glow" cx="146" cy="83" r="40" fill="url(#gGlow)"/>` }
    ],
    // أشعة الضوء تنطلق من الشجرة وتتقاطع عند العدسة فتنقلب الصورة على الحساس
    fx: `<polyline class="ray" points="25,134 118,155 217,177" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-dasharray="7 5"/>` +
      `<polyline class="ray" points="25,175 118,155 217,134" fill="none" stroke="#10B981" stroke-width="2.5" stroke-dasharray="7 5"/>` +
      `<g><rect x="258" y="98" width="128" height="112" rx="14" fill="#fff" stroke="${PAL.purple}" stroke-width="3"/>` +
      `<path d="M258 150 L236 156" stroke="${PAL.purple}" stroke-width="3"/>` +
      `<g transform="rotate(180 322 154)"><rect x="318" y="160" width="8" height="22" fill="#92400E"/><circle cx="322" cy="144" r="20" fill="${PAL.green}"/></g>` +
      `<text x="322" y="204" font-size="11" text-anchor="middle" fill="#6D28D9" font-weight="bold">⤵ 180°</text></g>`,
    fxStatic: '', rig: '',
    flow: [
      { icon: '🌳', ar: 'الضوء من الشجرة', en: 'Light from tree' },
      { icon: '🔍', ar: 'العدسة', en: 'Lens' },
      { icon: '🔀', ar: 'الأشعة تتقاطع', en: 'Rays cross' },
      { icon: '🖼️', ar: 'صورة مقلوبة', en: 'Flipped image' },
      { icon: '💾', ar: 'حفظ الصورة', en: 'Saved photo' }
    ],
    explain: {
      ar: 'ينتقل الضوء في خطوط مستقيمة. الأشعة القادمة من أعلى الشجرة تمر عبر العدسة وتهبط إلى أسفل الحساس، والأشعة من أسفل الشجرة تصعد إلى أعلاه، لذلك تتكون الصورة مقلوبة! ثم يقلبها معالج الكاميرا لنراها معتدلة.',
      en: 'Light travels in straight lines. Rays from the top of the tree pass through the lens and land at the bottom of the sensor, and rays from the bottom land at the top — so the image is upside down! The camera\'s processor flips it back for us.'
    },
    fact: { ar: 'عينك تعمل مثل الكاميرا، ودماغك يقلب الصورة لتراها معتدلة!', en: 'Your eye works like a camera, and your brain flips the image right side up!' },
    quiz: [
      { q: { ar: 'لماذا تتكون الصورة مقلوبة داخل الكاميرا؟', en: 'Why is the image upside down inside the camera?' },
        options: [
          { ar: 'لأن الكاميرا مقلوبة', en: 'Because the camera is upside down' },
          { ar: 'لأن الضوء يسير في خطوط مستقيمة ويتقاطع عند العدسة', en: 'Because light travels straight and the rays cross at the lens' },
          { ar: 'بسبب الفلاش', en: 'Because of the flash' },
          { ar: 'لأن البطارية ضعيفة', en: 'Because the battery is weak' }],
        answer: 1, why: { ar: 'تقاطع الأشعة يقلب أعلى الصورة وأسفلها.', en: 'The crossing rays swap the top and bottom of the picture.' } },
      { q: { ar: 'أي قطعة تلتقط الصورة؟', en: 'Which part captures the image?' },
        options: [{ ar: 'الفلاش', en: 'Flash' }, { ar: 'الزر', en: 'Button' }, { ar: 'الصندوق', en: 'Box' }, { ar: 'الحساس', en: 'Sensor' }],
        answer: 3, why: { ar: 'الحساس يحوّل الضوء إلى إشارات كهربائية تُحفظ كصورة.', en: 'The sensor turns light into electrical signals saved as a photo.' } },
      { q: { ar: 'متى نحتاج إلى الفلاش؟', en: 'When do we need the flash?' },
        options: [{ ar: 'في الأماكن المظلمة', en: 'In dark places' }, { ar: 'تحت الماء فقط', en: 'Only under water' }, { ar: 'في النهار المشمس', en: 'On sunny days' }, { ar: 'لا نحتاجه أبداً', en: 'Never' }],
        answer: 0, why: { ar: 'الفلاش يضيف ضوءاً قوياً لحظياً.', en: 'The flash adds a quick burst of bright light.' } }
    ]
  },

  /* ------------------------------------------------------------------
   * 10) الرسّام الآلي — الاهتزاز والثقل غير المتوازن
   * ------------------------------------------------------------------ */
  {
    id: 'robotic-drawer',
    emoji: '🖍️',
    title: { ar: 'الرسّام الآلي', en: 'Robotic Drawer' },
    concept: { ar: 'الاهتزاز والتوازن', en: 'Vibration & Balance' },
    category: { ar: 'روبوتات', en: 'Robotics' },
    level: 1, minutes: 8,
    bg: `<rect x="0" y="228" width="400" height="72" fill="#F3E8D2"/>`,
    parts: [
      { id: 'paper', name: { ar: 'ورقة الرسم', en: 'Paper' }, tip: { ar: 'هنا سيرسم الروبوت', en: 'Where the robot draws' },
        slot: { x: 14, y: 228, w: 372, h: 46 },
        art: `<path d="M40 236 L360 236 L380 268 L20 268 Z" fill="#fff" stroke="#CBD5E1" stroke-width="2"/>` },
      { id: 'cup', name: { ar: 'جسم الكوب', en: 'Cup Body' }, tip: { ar: 'جسم الروبوت الخفيف', en: 'The robot\'s light body' },
        slot: { x: 140, y: 112, w: 120, h: 102 }, needs: ['paper'],
        art: `<path d="M150 206 L250 206 L238 120 L162 120 Z" fill="${PAL.purpleL}" stroke="#6D28D9" stroke-width="3"/>` +
          `<circle cx="186" cy="156" r="10" fill="#fff" stroke="#111" stroke-width="2"/><circle cx="214" cy="156" r="10" fill="#fff" stroke="#111" stroke-width="2"/>` +
          `<circle cx="189" cy="158" r="4" fill="#111"/><circle cx="211" cy="158" r="4" fill="#111"/><path d="M188 180 q12 10 24 0" fill="none" stroke="#6D28D9" stroke-width="3" stroke-linecap="round"/>` },
      { id: 'markers', name: { ar: 'أقلام التلوين', en: 'Markers' }, tip: { ar: 'أرجل الروبوت التي ترسم', en: 'Legs that draw' },
        slot: { x: 122, y: 196, w: 156, h: 48 }, needs: ['cup'],
        art: [['#EF4444', 160, 204, 138, 238], ['#3B82F6', 200, 206, 200, 242], ['#22C55E', 240, 204, 262, 238]].map(([c, x1, y1, x2, y2]) =>
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="10" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="3" fill="#111"/>`).join('') },
      { id: 'motor', name: { ar: 'محرك الاهتزاز', en: 'Vibration Motor' }, tip: { ar: 'عليه ثقل غير متوازن', en: 'Has an off-center weight' },
        slot: { x: 164, y: 82, w: 78, h: 42 }, needs: ['cup'],
        art: Draw.motor(172, 94, 46, 24) + `<g class="spin"><circle cx="232" cy="106" r="12" fill="transparent"/><circle cx="232" cy="99" r="7" fill="${PAL.orange}" stroke="#B45309" stroke-width="2"/></g>` },
      { id: 'battery', name: { ar: 'البطارية', en: 'Battery' }, tip: { ar: 'تعطي المحرك الطاقة', en: 'Powers the motor' },
        slot: { x: 244, y: 124, w: 60, h: 70 }, needs: ['cup'],
        art: `<rect x="250" y="132" width="40" height="54" rx="6" fill="${PAL.dark}"/><rect x="256" y="138" width="28" height="42" rx="4" fill="#4B4560"/>` +
          `<text x="270" y="164" font-size="12" text-anchor="middle" fill="#FDE68A" font-weight="bold">+</text>` + Draw.wire('M262 132 C262 110 212 120 205 116') }
    ],
    fx: '',
    // خط الرسم يظهر تدريجياً على الورقة عند التشغيل
    fxStatic: `<path class="scribble" d="M70 258 C90 240 120 266 140 248 S180 262 200 246 S240 264 262 248 S300 262 320 250 S350 244 340 258 S290 266 260 256 S200 244 170 260 S110 248 90 262" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path class="scribble s2" d="M80 250 C110 262 130 242 160 256 S210 240 230 258 S280 244 310 258" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>`,
    rig: 'rig-wander', inner: 'rig-jiggle',
    flow: [
      { icon: '🔋', ar: 'بطارية', en: 'Battery' },
      { icon: '⚙️', ar: 'محرك', en: 'Motor' },
      { icon: '🟠', ar: 'ثقل غير متوازن', en: 'Off-center weight' },
      { icon: '〰️', ar: 'اهتزاز', en: 'Vibration' },
      { icon: '🎨', ar: 'رسومات!', en: 'Drawings!' }
    ],
    explain: {
      ar: 'الثقل البرتقالي مثبّت على جانب واحد من عمود المحرك. عندما يدور يشدّ الروبوت في اتجاهات مختلفة بسرعة فيهتز ويتحرك عشوائياً، وترسم الأقلام خطوطاً متعرجة جميلة.',
      en: 'The orange weight is fixed on one side of the motor shaft. When it spins it tugs the robot in different directions very fast, so it shakes and wanders around, and the markers draw fun wiggly lines.'
    },
    fact: { ar: 'هاتفك يهتز بنفس الفكرة: محرك صغير جداً عليه ثقل غير متوازن!', en: 'Your phone vibrates the same way: a tiny motor with an off-center weight!' },
    quiz: [
      { q: { ar: 'لماذا يهتز الرسام الآلي؟', en: 'Why does the robotic drawer shake?' },
        options: [
          { ar: 'لأن الأقلام ثقيلة', en: 'Because the markers are heavy' },
          { ar: 'لأن الورقة تتحرك', en: 'Because the paper moves' },
          { ar: 'بسبب ثقل غير متوازن يدور على المحرك', en: 'Because of an off-center weight spinning on the motor' },
          { ar: 'لأنه بارد', en: 'Because it\'s cold' }],
        answer: 2, why: { ar: 'الثقل غير المتوازن يسبب قوة تتغير اتجاهها باستمرار.', en: 'The unbalanced weight makes a force that keeps changing direction.' } },
      { q: { ar: 'ما الذي يرسم الخطوط؟', en: 'What draws the lines?' },
        options: [{ ar: 'أقلام التلوين (الأرجل)', en: 'The markers (legs)' }, { ar: 'البطارية', en: 'The battery' }, { ar: 'العيون', en: 'The eyes' }, { ar: 'المحرك مباشرة', en: 'The motor directly' }],
        answer: 0, why: { ar: 'رؤوس الأقلام تلامس الورقة أثناء الاهتزاز.', en: 'The marker tips touch the paper as it shakes.' } },
      { q: { ar: 'أي جهاز في بيتك يستخدم نفس الفكرة؟', en: 'Which device at home uses the same idea?' },
        options: [{ ar: 'المصباح', en: 'A lamp' }, { ar: 'اهتزاز الهاتف', en: 'Phone vibration' }, { ar: 'الثلاجة', en: 'The fridge' }, { ar: 'الكتاب', en: 'A book' }],
        answer: 1, why: { ar: 'في الهاتف محرك اهتزاز صغير جداً.', en: 'Phones have a tiny vibration motor inside.' } }
    ]
  }
];

/* =====================================================================
 * بناء مشهد SVG كامل لدرس معيّن
 * ---------------------------------------------------------------------
 * opts.placed     : كائن {partId: true} للقطع المركّبة
 * opts.showAll    : عرض كل القطع (للمحاكاة والصور المصغرة)
 * opts.ghosts     : إظهار أشباح القطع غير المركّبة (وضع التجميع)
 * opts.hintPart   : قطعة يُضاء مكانها كتلميح
 * opts.awaiting   : هل يسحب الطفل قطعة الآن؟ (لتنبيض الأماكن الفارغة)
 * opts.lastPlaced : آخر قطعة رُكّبت (لتشغيل حركة «القفزة»)
 * ===================================================================== */
function buildScene(lesson, opts = {}) {
  const { placed = {}, showAll = false, ghosts = false, hintPart = null, awaiting = false, lastPlaced = null } = opts;
  const isOn = (p) => showAll || placed[p.id];

  // 1) أماكن القطع غير المركّبة: إطار متقطع + ظل باهت للقطعة
  let ghostLayer = '';
  if (ghosts) {
    for (const p of lesson.parts) {
      if (isOn(p)) continue;
      const s = p.slot;
      const cls = ['slot', hintPart === p.id ? 'hint' : '', awaiting ? 'await' : ''].join(' ');
      ghostLayer += `<g class="${cls}"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="10" class="slot-box"/>` +
        `<g class="ghost">${p.art}</g></g>`;
    }
  }

  // 2) القطع المركّبة بالترتيب (الترتيب يحدد الطبقات: الأولى في الخلف)
  let partsLayer = '';
  for (const p of lesson.parts) {
    if (!isOn(p)) continue;
    partsLayer += `<g class="part ${lastPlaced === p.id ? 'pop' : ''}" data-part="${p.id}">${p.art}</g>`;
  }

  const inner = lesson.inner ? `<g class="${lesson.inner}">${partsLayer}</g>` : partsLayer;
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" class="scene" role="img" aria-label="${lesson.title.en}">` +
    (lesson.bg || '') +
    `<g class="fx-static">${lesson.fxStatic || ''}</g>` +
    ghostLayer +
    `<g class="rig ${lesson.rig || ''}">${inner}<g class="fx">${lesson.fx || ''}</g></g>` +
    `</svg>`;
}

/* أيقونة قطعة للمخزن: نفس رسم القطعة لكن مع قصّ المشهد على حدود مكانها */
function buildPartIcon(part) {
  const s = part.slot;
  return `<svg viewBox="${s.x} ${s.y} ${s.w} ${s.h}" preserveAspectRatio="xMidYMid meet" class="w-full h-full">${part.art}</svg>`;
}

// التدرجات اللونية تُعرّف مرة واحدة في الصفحة (في SVG مخفي) حتى لا تتكرر المعرّفات
// ولا تختفي عند إخفاء أحد العناصر — كل المشاهد تشير إليها عبر url(#...)
document.addEventListener('DOMContentLoaded', () => {
  const holder = document.createElement('div');
  holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${SVG_DEFS}</svg>`;
  document.body.prepend(holder.firstChild);
});

// إتاحة البيانات لملف app.js
window.LESSONS = LESSONS;
window.buildScene = buildScene;
window.buildPartIcon = buildPartIcon;
