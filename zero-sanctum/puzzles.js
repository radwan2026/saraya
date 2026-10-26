/*
 * ZERO SANCTUM — منطق الألغاز (بلا رسوميات)
 * كل لغز هنا دالة نقية قابلة للاختبار. ملف game.js يرسم ويستدعي هذه الدوال فقط.
 * الحلول الموثّقة موجودة في SOLUTIONS وفي الدرجة الثالثة من التلميحات، ولا تُعرض إلا عند طلبها.
 */
(function (root) {
  'use strict';

  // ===== الرموز =====
  // خمسة رموز غير متناظرة أفقيًا، حتى يختلف كل رمز عن صورته في المرآة
  const GLYPHS = {
    kaf:  { name: 'الشوكة',  path: 'M6 3 L6 17 M6 10 L15 3 M6 10 L15 17' },
    step: { name: 'الدرج',   path: 'M3 17 L3 11 L9 11 L9 5 L17 5' },
    flag: { name: 'الراية',  path: 'M6 18 L6 2 L16 6 L6 10' },
    moon: { name: 'الهلال',  path: 'M15 4 A7 7 0 1 0 15 16 M5 10 L5 10.1' },
    fork: { name: 'المذراة', path: 'M5 3 L5 17 L15 17 M5 10 L12 10' },
  };
  const GLYPH_IDS = Object.keys(GLYPHS);
  // رمز معكوس يُكتب بالمعرّف مع اللاحقة «~»
  const mirrorGlyph = (g) => (g.endsWith('~') ? g.slice(0, -1) : g + '~');
  const baseGlyph = (g) => g.replace(/~$/, '');
  const isMirrored = (g) => g.endsWith('~');

  // ===== الغرفة 1: الساعة المعطوبة =====
  // صور من الأعلى لمسلّة في ساحة. اتجاه الظل وطوله هما الدليل، والوقت المكتوب على كل صورة مضلِّل.
  // الشمس تشرق من الشرق، فظل الصباح طويل نحو الغرب، وظل الظهيرة قصير نحو الشمال، وظل المساء طويل نحو الشرق.
  // azimuth: اتجاه الظل بالدرجات (0 = شمال، 90 = شرق، 270 = غرب). length: نسبة إلى طول المسلّة.
  const PHOTOS = {
    A: { azimuth: 268, length: 3.1, shownTime: '18:10', back: 'kaf'  },
    B: { azimuth: 302, length: 1.5, shownTime: '12:00', back: 'step' },
    C: { azimuth: 0,   length: 0.45, shownTime: '07:30', back: 'flag' },
    D: { azimuth: 55,  length: 1.4, shownTime: '09:45', back: 'moon' },
    E: { azimuth: 92,  length: 3.0, shownTime: '15:20', back: 'fork' },
  };
  const PHOTO_IDS = Object.keys(PHOTOS);
  const WALL_ORDER = ['D', 'A', 'E', 'C', 'B']; // ترتيب تعليق الصور على الجدران (مختلط)

  /** ترتيب الصور زمنيًا من الظلال: من الغرب عبر الشمال إلى الشرق */
  function shadowRank(id) {
    const a = PHOTOS[id].azimuth;
    return a >= 180 ? a - 360 : a; // الغرب = -90، الشمال = 0، الشرق = +90
  }
  function solveClockOrder() {
    return PHOTO_IDS.slice().sort((x, y) => shadowRank(x) - shadowRank(y));
  }
  /** يعيد عدد التروس المتعشّقة: طول البادئة الصحيحة. 5 تعني تشغيل الساعة */
  function checkClockOrder(order) {
    const solution = solveClockOrder();
    let engaged = 0;
    while (engaged < solution.length && order[engaged] === solution[engaged]) engaged++;
    return { engaged, solved: engaged === solution.length && order.length === solution.length };
  }
  /** تسلسل الساعة: رموز ظهور الصور بالترتيب الصحيح. يُستخدم في الغرفة الخامسة */
  function clockSequence() {
    return solveClockOrder().map((id) => PHOTOS[id].back);
  }

  // ===== الغرفة 2: مختبر الضوء =====
  // الشبكة: '.' فراغ، '#' جدار، 'E' مصدر (يتجه شرقًا)، '/' و '\' مرايا ثابتة،
  // 'S' مقسِّم شعاع ثابت (يمرّر ويعكس كمرآة '/')، 'm' مرآة قابلة للتدوير،
  // 'y' زجاج ذهبي، 'C' مقبس البلورة (يحجب الضوء ما دام فارغًا، ويصبح مرشحًا زمرديًا بعد تركيبها)،
  // 'G' مستقبل زمردي، 'Y' مستقبل ذهبي، 'W' مستقبل أبيض.
  const LASER_GRID = [
    '####W####',
    '#.mC.m..#',
    '#.......#',
    'E.S.S.ym#',
    '#.......#',
    '#....m..G',
    '#######Y#',
  ];
  // قاعدة الألوان: المرشِّح يلوّن الضوء الأبيض بلونه، ويمرّر لونه نفسه، ويمتص أي لون آخر.
  const FILTERS = { y: 'gold', C: 'green' };
  const RECEIVERS = { G: 'green', Y: 'gold', W: 'white' };

  function laserMirrors() {
    const list = [];
    LASER_GRID.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'm') list.push(x + ',' + y); }));
    return list;
  }

  /**
   * يتتبع الأشعة.
   * mirrors: كائن { "x,y": "/" | "\\" } لحالة كل مرآة متحركة.
   * crystal: هل البلورة مركّبة في المقبس.
   * يعيد المقاطع المرسومة والمستقبلات المضاءة وألوانها.
   */
  function traceLasers(mirrors, crystal) {
    const H = LASER_GRID.length, W = LASER_GRID[0].length;
    const cell = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? '#' : LASER_GRID[y][x]);
    const segments = [];
    const hits = {};
    const seen = new Set();
    let sx = -1, sy = -1;
    LASER_GRID.forEach((row, y) => { const i = row.indexOf('E'); if (i >= 0) { sx = i; sy = y; } });
    const queue = [{ x: sx, y: sy, dx: 1, dy: 0, color: 'white' }];
    const reflect = (m, dx, dy) => (m === '/' ? [-dy, -dx] : [dy, dx]);
    while (queue.length) {
      const b = queue.shift();
      let { x, y, dx, dy, color } = b;
      for (let guard = 0; guard < 200; guard++) {
        const nx = x + dx, ny = y + dy;
        const ch = cell(nx, ny);
        const key = nx + ',' + ny + ',' + dx + ',' + dy + ',' + color;
        if (seen.has(key)) break;
        seen.add(key);
        if (ch === '#' || ch === 'E') { segments.push({ x1: x, y1: y, x2: nx, y2: ny, color, stop: true }); break; }
        segments.push({ x1: x, y1: y, x2: nx, y2: ny, color });
        x = nx; y = ny;
        if (ch in RECEIVERS) { (hits[x + ',' + y] = hits[x + ',' + y] || []).push(color); break; }
        if (ch === 'C' && !crystal) break;
        if (ch in FILTERS) {
          const f = FILTERS[ch];
          if (color === 'white') color = f;
          else if (color !== f) break;
          continue;
        }
        if (ch === '/' || ch === '\\') { [dx, dy] = reflect(ch, dx, dy); continue; }
        if (ch === 'm') { [dx, dy] = reflect(mirrors[x + ',' + y] || '/', dx, dy); continue; }
        if (ch === 'S') {
          const [rx, ry] = reflect('/', dx, dy);
          queue.push({ x, y, dx: rx, dy: ry, color });
          continue;
        }
      }
    }
    const lit = {};
    LASER_GRID.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch in RECEIVERS) {
        const got = hits[x + ',' + y] || [];
        lit[x + ',' + y] = { need: RECEIVERS[ch], got, ok: got.includes(RECEIVERS[ch]) && got.every((c) => c === RECEIVERS[ch]) };
      }
    }));
    const solved = Object.values(lit).every((r) => r.ok);
    return { segments, receivers: lit, solved };
  }

  /** حالة البداية: كل المرايا '/' */
  function initialMirrors() {
    const m = {};
    laserMirrors().forEach((k) => { m[k] = '/'; });
    return m;
  }

  /** كل الحلول (للاختبار وللتلميح الثالث) */
  function laserSolutions(crystal = true) {
    const keys = laserMirrors();
    const out = [];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const m = {};
      keys.forEach((k, i) => { m[k] = mask & (1 << i) ? '\\' : '/'; });
      if (traceLasers(m, crystal).solved) out.push(m);
    }
    return out;
  }

  // ===== الغرفة 3: أرشيف الذاكرة =====
  // خمسة أحداث، لكل حدث قطاع. البطاقات تحمل علاقات «قبل/بعد». بطاقة واحدة مزوّرة تناقض بطاقتين أصليتين.
  const EVENTS = {
    mirror:   { name: 'تركيب المرآة الكبرى',   room: 5 },
    blackout: { name: 'انفجار البلورة وانقطاع الطاقة', room: 2 },
    clock:    { name: 'انعكاس الساعة',          room: 1 },
    heart:    { name: 'تشغيل القلب يدويًا',     room: 4 },
    archive:  { name: 'ختم الأرشيف',            room: 3 },
  };
  // claim: [قبل، بعد] يعني أن الحدث الأول وقع قبل الثاني
  const CARDS = {
    photo: {
      event: 'mirror', kind: 'صورة', seal: 2, title: 'صورة: تركيب المرآة في القطاع الخامس',
      text: 'العمّال يرفعون المرآة الكبرى إلى مكانها. خلفهم كل مصابيح الممر مضاءة، والمختبر في نهاية الممر يعمل بكامل طاقته.',
      claim: ['mirror', 'blackout'],
    },
    incident: {
      event: 'blackout', kind: 'تقرير حادث', seal: 7, title: 'تقرير حادث: مختبر الضوء',
      text: 'تشققت البلورة الزمردية أثناء التجربة، وانقطعت الطاقة عن المنشأة بالكامل. نُقلت البلورة إلى غرفة الساعة لحفظها.',
      claim: null,
    },
    statement: {
      event: 'blackout', kind: 'بيان رسمي', seal: 5, title: 'بيان رسمي للإدارة',
      text: 'نؤكد أن انقطاع الطاقة وقع بعد ختم الأرشيف، ولم يكن له أي أثر على السجلات.',
      claim: ['archive', 'blackout'], forged: true,
    },
    maintenance: {
      event: 'clock', kind: 'سجل صيانة', seal: 1, title: 'سجل صيانة: غرفة الساعة',
      text: 'بعد ساعة واحدة من انقطاع الطاقة بدأت عقارب الساعة الكبرى تدور عكسيًا. لم نتمكن من إيقافها.',
      claim: ['blackout', 'clock'],
    },
    audio: {
      event: 'heart', kind: 'تسجيل صوتي', seal: 9, title: 'تسجيل صوتي: د. نور',
      text: '«شغّلنا القلب الميكانيكي يدويًا. الساعة تدور عكسيًا منذ الصباح، ولا أحد يعرف لماذا. الخاضع يكتب ملاحظات بخط يده… ثم ننسى جميعًا أنه كتبها.»',
      claim: ['clock', 'heart'],
    },
    memo: {
      event: 'archive', kind: 'مذكرة داخلية', seal: 4, title: 'مذكرة داخلية',
      text: 'خُتم الأرشيف بعد أن عاد القلب إلى النبض. لا يُفتح إلا بأختام السجلات الصادقة، مقروءة بترتيب وقوعها.',
      claim: ['heart', 'archive'],
    },
  };
  const CARD_IDS = Object.keys(CARDS);
  const TIMELINE_LENGTH = 5;

  /**
   * يفحص خطًا زمنيًا (مصفوفة من معرّفات البطاقات أو null).
   * يعيد التعارضات: بطاقة تقول إن حدثًا قبل آخر، لكن الخط يضعه بعده.
   */
  function timelineConflicts(slots) {
    const pos = {};
    const conflicts = [];
    slots.forEach((id, i) => {
      if (!id) return;
      const ev = CARDS[id].event;
      if (ev in pos) conflicts.push({ type: 'duplicate', card: id, event: ev });
      else pos[ev] = i;
    });
    slots.forEach((id) => {
      if (!id || !CARDS[id].claim) return;
      const [a, b] = CARDS[id].claim;
      if (a in pos && b in pos && !(pos[a] < pos[b])) conflicts.push({ type: 'order', card: id, before: a, after: b });
    });
    return conflicts;
  }
  function timelineComplete(slots) {
    return slots.length === TIMELINE_LENGTH && slots.every(Boolean) && timelineConflicts(slots).length === 0;
  }
  /** رمز الخزانة: أختام البطاقات الصادقة بترتيب وقوعها */
  function archiveCode() {
    const order = ['mirror', 'blackout', 'clock', 'heart', 'archive'];
    return order.map((ev) => CARD_IDS.find((id) => CARDS[id].event === ev && !CARDS[id].forged))
      .map((id) => CARDS[id].seal).join('');
  }
  function checkArchiveCode(code) { return String(code).trim() === archiveCode(); }
  /** ترتيب سقوط القطاعات، يُستخدم في البوابة صفر */
  function collapseOrder() { return ['mirror', 'blackout', 'clock', 'heart', 'archive'].map((e) => EVENTS[e].room); }

  // ===== الغرفة 4: القلب الميكانيكي =====
  // المحرك يدور مع عقارب الساعة. كل تعشيق يعكس الاتجاه. القلب لا ينفتح إلا إذا دار مع عقارب الساعة.
  function heartInitial() {
    return { gear: false, idler: false, pistons: 'locked', clutch: false, jammed: false, solved: false, last: 'idle' };
  }
  /** سلسلة التروس الحالية من المحرك إلى القلب، مع اتجاه كل ترس (1 = مع عقارب الساعة) */
  function heartChain(s) {
    const chain = [{ id: 'motor', dir: 1 }, { id: 'g1', dir: -1 }];
    if (s.idler) chain.push({ id: 'idler', dir: -chain[chain.length - 1].dir });
    if (!s.gear) return { chain, reaches: false };
    chain.push({ id: 'socket', dir: -chain[chain.length - 1].dir });
    chain.push({ id: 'heart', dir: -chain[chain.length - 1].dir });
    return { chain, reaches: true };
  }
  /** يطبّق إجراء ويعيد حالة جديدة. لا عقوبات عشوائية: كل خطأ يغيّر حالة الآلة بشكل مفهوم */
  function heartAction(state, action) {
    const s = Object.assign({}, state);
    if (s.solved) return s;
    switch (action) {
      case 'installGear': s.gear = true; s.last = 'gear'; break;
      case 'idler':
        if (s.clutch) { s.last = 'busy'; break; }
        s.idler = !s.idler; s.last = s.idler ? 'idlerIn' : 'idlerOut'; break;
      case 'pistons':
        if (s.clutch) { s.last = 'busy'; break; }
        s.pistons = s.pistons === 'locked' ? 'released' : 'locked'; s.last = 'pistons'; break;
      case 'vent': s.jammed = false; s.clutch = false; s.last = 'vented'; break;
      case 'clutch':
        if (s.clutch) { s.clutch = false; s.last = 'stopped'; break; }
        if (s.jammed) { s.last = 'stillJammed'; break; }
        if (s.pistons === 'locked') { s.jammed = true; s.last = 'jam'; break; }
        s.clutch = true;
        {
          const { chain, reaches } = heartChain(s);
          if (!reaches) s.last = 'noGear';
          else if (chain[chain.length - 1].dir === 1) { s.solved = true; s.last = 'open'; }
          else s.last = 'wrongWay';
        }
        break;
      default: break;
    }
    return s;
  }

  // ===== الغرفة 5: الغرفة المعكوسة =====
  // القفل يُرى مباشرة أو في المرآة. المرآة تعكس ترتيب الأقراص وتقلب كل رمز.
  // المطلوب: أن ترى المرآة تسلسل الساعة كما هو.
  const MIRROR_DIAL_OPTIONS = GLYPH_IDS.flatMap((g) => [g, g + '~']);
  function reflectRow(row) { return row.slice().reverse().map(mirrorGlyph); }
  function mirrorLockAnswer() { return reflectRow(clockSequence()); }
  function checkMirrorLock(row) {
    const target = clockSequence();
    const seen = reflectRow(row);
    return { solved: seen.every((g, i) => g === target[i]), reflection: seen };
  }

  // ===== الغرفة 6: البوابة صفر =====
  const CORES = {
    light_core:   { back: 'flag' },
    heart_core:   { back: 'kaf'  },
    mirror_shard: { back: 'moon' },
  };
  // كل مقبس محفور عليه رمز، ولا يقبل إلا النواة التي يحمل ظهرها الرمز نفسه
  const GATE_SOCKETS = ['moon', 'kaf', 'flag'];
  function socketAccepts(socketIndex, coreId) {
    return !!CORES[coreId] && CORES[coreId].back === GATE_SOCKETS[socketIndex];
  }
  function checkSigils(sequence) {
    const want = collapseOrder();
    return sequence.length === want.length && sequence.every((r, i) => r === want[i]);
  }
  const IDENTITY_OPTIONS = {
    nour:     { label: 'د. نور، رئيسة التجربة', reply: 'د. نور تقول في تسجيلها إنها تنسى الملاحظات بعد كتابتها. لا أحد يترك أدلة لا يتذكرها، إلا من يعيش الدورة نفسها مرة بعد مرة.' },
    observer: { label: 'المراقب خلف الزجاج', reply: 'لم يظهر في المرآة أحد غيرك. الهيئة التي وقفت أمام القفل كانت تقف حيث وقفت أنت.' },
    guard:    { label: 'حارس المنشأة', reply: 'لا يذكر أي سجل حارسًا بعد انقطاع الطاقة. والملاحظات كلها موقّعة بـ «٠»، وهو الرقم المحفور على سوارك.' },
    self:     { label: 'أنا. الخاضع صفر', reply: '' },
  };
  function checkIdentity(id) { return id === 'self'; }

  // ===== الحلول الموثّقة (داخلية) =====
  const SOLUTIONS = {
    clock: 'رتّب الصور حسب الظل من الصباح إلى المساء: الصورة المكتوب عليها 18:10 (ظل طويل نحو الغرب)، ثم 12:00، ثم 07:30 (ظل قصير نحو الشمال)، ثم 09:45، ثم 15:20 (ظل طويل نحو الشرق). الأوقات المكتوبة مضلِّلة.',
    light: 'ركّب البلورة الزمردية في المقبس. المرايا: العليا اليسرى «/»، العليا الوسطى «\\»، اليمنى «\\»، السفلى «\\». المقسِّم الثاني يرسل الأبيض إلى الأعلى مباشرة.',
    archive: 'استبعد «البيان الرسمي» لأنه يناقض سجل الصيانة ومذكرة الأرشيف. الترتيب: صورة تركيب المرآة، تقرير الحادث، سجل الصيانة، التسجيل الصوتي، المذكرة الداخلية.',
    heart: 'ركّب الترس بمحوره، أدخل الترس الوسيط، حرّر المكابس، ثم شغّل القابض.',
    mirror: 'اضبط الأقراص مباشرة على: المذراة، الهلال، الراية، الدرج، الشوكة، وكلها معكوسة. عندها ترى المرآة تسلسل الساعة كما هو.',
    gate: 'المقابس: الهلال ← شظية المرآة، الشوكة ← نواة القلب، الراية ← نواة الضوء. القطاعات: 5، 2، 1، 4، 3. الهوية: أنت.',
  };

  const api = {
    GLYPHS, GLYPH_IDS, mirrorGlyph, baseGlyph, isMirrored,
    PHOTOS, PHOTO_IDS, WALL_ORDER, solveClockOrder, checkClockOrder, clockSequence,
    LASER_GRID, laserMirrors, traceLasers, initialMirrors, laserSolutions, RECEIVERS, FILTERS,
    EVENTS, CARDS, CARD_IDS, TIMELINE_LENGTH, timelineConflicts, timelineComplete, archiveCode, checkArchiveCode, collapseOrder,
    heartInitial, heartChain, heartAction,
    MIRROR_DIAL_OPTIONS, reflectRow, mirrorLockAnswer, checkMirrorLock,
    CORES, GATE_SOCKETS, socketAccepts, checkSigils, IDENTITY_OPTIONS, checkIdentity,
    SOLUTIONS,
  };
  root.ZS = api;
})(typeof window !== 'undefined' ? window : globalThis);
