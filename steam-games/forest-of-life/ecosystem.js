/* ===============================================================
   غابة الحياة — محاكاة النظام البيئي (بدون أي اعتماد على المتصفح)
   الأرض مقسّمة إلى خلايا لكلٍّ منها رطوبة وخصوبة.
   النباتات تحتاج ماءً وضوءاً، والحيوانات تأكل وتتكاثر وتموت،
   والمحلّلات (الفطر) تعيد الغذاء إلى التربة.
   يعمل في المتصفح (window.Ecosystem) وفي Node للاختبارات.
   =============================================================== */
(function (root) {
  'use strict';

  var WORLD = Object.freeze({
    width: 1400,
    height: 820,
    groundY: 640,
    cellW: 50,
    dayLength: 48,     // ثانية لليوم الكامل (نهار + ليل)
    dayPart: 0.68,     // نسبة النهار من اليوم
    skyMin: 120,       // أعلى ما تطير إليه الكائنات
    skyMax: 520,
  });
  var CELLS = Math.floor(WORLD.width / WORLD.cellW);

  /** الأدوات التي يضعها اللاعب وتكلفتها من «طاقة الحياة» */
  var TOOLS = Object.freeze({
    rain: { cost: 4, name: 'مطر', icon: '🌧️' },
    grass: { cost: 3, name: 'عشب', icon: '🌿' },
    flower: { cost: 5, name: 'زهرة', icon: '🌸' },
    tree: { cost: 15, name: 'شجرة', icon: '🌳' },
    caterpillar: { cost: 6, name: 'يرقة', icon: '🐛' },
    bee: { cost: 8, name: 'نحلة', icon: '🐝' },
    rabbit: { cost: 10, name: 'أرنب', icon: '🐇' },
    bird: { cost: 12, name: 'طائر', icon: '🐦' },
    fox: { cost: 18, name: 'ثعلب', icon: '🦊' },
  });

  /** موسوعة الغابة: كل الكائنات وما تحتاجه */
  var SPECIES = Object.freeze({
    grass: { name: 'العشب', kind: 'منتِج', needs: 'ماء + ضوء الشمس', eats: '—', fact: 'النبات يصنع غذاءه بنفسه من الماء والهواء وضوء الشمس — هذا اسمه «البناء الضوئي».' },
    flower: { name: 'الزهرة', kind: 'منتِج', needs: 'ماء + ضوء + ملقِّحات', eats: '—', fact: 'تحتاج الأزهار إلى النحل والفراشات لتنقل حبوب اللقاح بينها فتصنع بذوراً جديدة.' },
    tree: { name: 'الشجرة', kind: 'منتِج', needs: 'ماء كثير + وقت', eats: '—', fact: 'الأشجار بيوت للطيور، وتعطينا الأكسجين والثمار والظل.' },
    mushroom: { name: 'الفطر', kind: 'محلِّل', needs: 'بقايا الكائنات', eats: 'البقايا', fact: 'الفطر يحلّل بقايا الكائنات ويعيد غذاءها إلى التربة، فتصبح أخصب.' },
    caterpillar: { name: 'اليرقة', kind: 'مستهلك أول', needs: 'أوراق خضراء', eats: 'العشب والأوراق', fact: 'اليرقة تأكل كثيراً، ثم تصنع شرنقة وتتحوّل إلى فراشة — هذا «التحوّل الكامل».' },
    butterfly: { name: 'الفراشة', kind: 'ملقِّح', needs: 'رحيق الأزهار', eats: 'الرحيق', fact: 'الفراشة تتذوّق بأقدامها! وتنقل حبوب اللقاح وهي تتنقّل بين الأزهار.' },
    bee: { name: 'النحلة', kind: 'ملقِّح', needs: 'أزهار كثيرة', eats: 'الرحيق', fact: 'ثلث طعامنا تقريباً يعتمد على النحل في تلقيح أزهاره!' },
    rabbit: { name: 'الأرنب', kind: 'مستهلك أول (عاشب)', needs: 'عشب وفير', eats: 'العشب', fact: 'الأرنب عاشب: يأكل النباتات فقط، وأسنانه الأمامية لا تتوقف عن النمو.' },
    bird: { name: 'الطائر', kind: 'مستهلك ثانٍ', needs: 'شجرة كبيرة يعيش فيها', eats: 'اليرقات', fact: 'الطيور تحمي النباتات لأنها تأكل اليرقات والحشرات التي تأكل الأوراق.' },
    fox: { name: 'الثعلب', kind: 'مفترس (مستهلك ثانٍ)', needs: 'أرانب يصطادها', eats: 'الأرانب', fact: 'المفترسات مهمة: تمنع الأرانب من التكاثر الزائد فلا يختفي العشب.' },
  });

  /** خصائص الكائنات */
  var BIO = Object.freeze({
    grass: { grow: 0.16, thirst: 0.0022, perCell: 3 },
    flower: { grow: 0.12, thirst: 0.0025, perCell: 2 },
    tree: { grow: 0.035, thirst: 0.006, perCell: 1 },
    rabbit: { speed: 70, hunger: 0.026, life: 130, max: 14, adult: 14, eat: 0.38 },
    fox: { speed: 85, chase: 125, hunger: 0.022, life: 170, max: 4, adult: 22, eat: 0.7 },
    caterpillar: { speed: 9, hunger: 0.02, life: 60, max: 8, adult: 22 },
    butterfly: { speed: 70, hunger: 0.018, life: 75, max: 8 },
    bee: { speed: 110, hunger: 0.02, life: 95, max: 6 },
    bird: { speed: 140, hunger: 0.016, life: 150, max: 6, adult: 20 },
  });

  var FLOWER_COLORS = ['#ff6fb5', '#ffd23f', '#b07cff', '#ffffff', '#ff8a4c', '#5fd3ff'];

  // ------------------------------------------------------------------
  // أدوات صغيرة
  // ------------------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function cellOf(x) { return clamp(Math.floor(x / WORLD.cellW), 0, CELLS - 1); }
  function cellCenter(c) { return c * WORLD.cellW + WORLD.cellW / 2; }

  /** مولّد أرقام عشوائية قابل للتكرار (للاختبارات) */
  function seeded(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------
  // إنشاء العالم
  // ------------------------------------------------------------------
  function createWorld(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var cells = [];
    for (var i = 0; i < CELLS; i++) {
      cells.push({ moisture: opts.moisture != null ? opts.moisture : 0.08 + rng() * 0.06, fertility: 0.45 + rng() * 0.1 });
    }
    return {
      time: opts.time || 0,
      cells: cells,
      plants: [],
      animals: [],
      clouds: [],
      orbs: [],
      mushrooms: [],
      energy: opts.energy != null ? opts.energy : 30,
      maxEnergy: 250,
      events: [],
      nextId: 1,
      rng: rng,
      balancedFor: 0,
      orbTimer: 0,
    };
  }

  function emit(s, type, data) {
    var e = data || {};
    e.type = type;
    s.events.push(e);
    if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
  }

  // ------------------------------------------------------------------
  // الوقت والضوء
  // ------------------------------------------------------------------
  /** موقع اليوم من 0 إلى 1 (يبدأ صباحاً) */
  function dayPhase(s) {
    return ((s.time / WORLD.dayLength) + 0.12) % 1;
  }
  /** شدة ضوء الشمس 0..1 */
  function light(s) {
    var p = dayPhase(s);
    if (p >= WORLD.dayPart) return 0;
    return Math.max(0, Math.sin((Math.PI * p) / WORLD.dayPart));
  }
  function isNight(s) { return dayPhase(s) >= WORLD.dayPart; }

  // ------------------------------------------------------------------
  // العدّ والإحصاء
  // ------------------------------------------------------------------
  function counts(s) {
    var c = { grass: 0, flower: 0, tree: 0, grassAll: 0, flowerAll: 0, treeAll: 0, mushroom: s.mushrooms.length,
      rabbit: 0, fox: 0, caterpillar: 0, cocoon: 0, butterfly: 0, bee: 0, bird: 0 };
    for (var i = 0; i < s.plants.length; i++) {
      var p = s.plants[i];
      c[p.type + 'All']++;
      var mature = p.type === 'tree' ? p.growth >= 0.8 : p.growth >= 0.6;
      if (mature) c[p.type]++;
    }
    for (var j = 0; j < s.animals.length; j++) {
      var a = s.animals[j];
      if (a.type === 'caterpillar' && a.cocoon) c.cocoon++;
      else c[a.type]++;
    }
    return c;
  }

  /** الأنواع الموجودة الآن (للموسوعة والتنوّع) */
  function speciesPresent(s) {
    var c = counts(s);
    var out = [];
    if (c.grassAll) out.push('grass');
    if (c.flowerAll) out.push('flower');
    if (c.treeAll) out.push('tree');
    if (c.mushroom) out.push('mushroom');
    ['caterpillar', 'butterfly', 'bee', 'rabbit', 'bird', 'fox'].forEach(function (k) {
      if (c[k] || (k === 'caterpillar' && c.cocoon)) out.push(k);
    });
    return out;
  }

  function avgMoisture(s) {
    var t = 0;
    for (var i = 0; i < s.cells.length; i++) t += s.cells[i].moisture;
    return t / s.cells.length;
  }

  /**
   * ميزان الحياة: درجة 0..1 وحالة ورسالة تشرح السبب
   * status: 'empty' | 'growing' | 'balanced' | 'danger'
   */
  function balance(s) {
    var c = counts(s);
    var plants = c.grassAll + c.flowerAll + c.treeAll * 3;
    var herb = c.rabbit + c.caterpillar * 0.4;
    var m = avgMoisture(s);
    var wilting = 0;
    for (var i = 0; i < s.plants.length; i++) if (s.plants[i].health < 0.5) wilting++;

    if (plants === 0 && s.animals.length === 0) return { score: 0, status: 'empty', reason: 'الأرض فارغة — ازرع أول نبتة!' };
    if (plants === 0) return { score: 0.1, status: 'danger', reason: 'لا توجد نباتات! الحيوانات ستجوع.' };
    if (m < 0.1 && wilting > plants * 0.3) return { score: 0.25, status: 'danger', reason: 'التربة جافة والنباتات تذبل — الغابة تحتاج مطراً 🌧️' };
    if (herb > 0 && c.grassAll < herb * 1.6) return { score: 0.3, status: 'danger', reason: 'الآكلات كثيرة والعشب قليل!' };
    if (c.fox > 0 && c.rabbit === 0) return { score: 0.35, status: 'danger', reason: 'الثعالب جائعة — لا توجد أرانب.' };
    if (c.rabbit > 9 && c.fox === 0) return { score: 0.5, status: 'growing', reason: 'الأرانب تتكاثر بسرعة… لا يوجد من يوازن أعدادها.' };
    if (c.bird > 0 && c.tree === 0) return { score: 0.45, status: 'danger', reason: 'الطيور تحتاج شجرة كبيرة تعيش فيها!' };

    var kinds = speciesPresent(s).length;
    var chain = (c.grass + c.flower > 0 ? 1 : 0) + (c.rabbit > 0 ? 1 : 0) + (c.fox > 0 ? 1 : 0);
    var score = clamp(0.35 + kinds * 0.06 + chain * 0.08 + Math.min(0.15, m * 0.3), 0, 1);
    if (chain === 3 && c.grass >= 4) return { score: Math.max(score, 0.8), status: 'balanced', reason: 'سلسلة الحياة مكتملة ومتوازنة 🌍' };
    if (kinds >= 4) return { score: score, status: 'balanced', reason: 'الغابة متنوّعة ومزدهرة 🌳' };
    return { score: score, status: 'growing', reason: 'الحياة تنمو… أضف كائنات جديدة.' };
  }

  // ------------------------------------------------------------------
  // الوضع (ما يفعله اللاعب)
  // ------------------------------------------------------------------
  function plantsInCell(s, c, type) {
    var n = 0;
    for (var i = 0; i < s.plants.length; i++) if (s.plants[i].cell === c && (!type || s.plants[i].type === type)) n++;
    return n;
  }

  function canPlace(s, tool, x) {
    var def = TOOLS[tool];
    if (!def) return { ok: false, reason: 'أداة غير معروفة' };
    if (s.energy < def.cost) return { ok: false, reason: 'طاقة الحياة لا تكفي ✨ — انتظر قليلاً أو اجمع الثمار المضيئة' };
    if (x < 20 || x > WORLD.width - 20) return { ok: false, reason: 'ضعها داخل الغابة' };
    var c = cellOf(x);
    if (tool === 'rain') {
      if (s.clouds.length >= 3) return { ok: false, reason: 'السماء مليئة بالغيوم الآن' };
      return { ok: true };
    }
    if (tool === 'grass' || tool === 'flower') {
      if (plantsInCell(s, c) >= BIO[tool].perCell + (tool === 'grass' ? 0 : 1)) return { ok: false, reason: 'المكان مزدحم — ازرع في مكان آخر' };
      return { ok: true };
    }
    if (tool === 'tree') {
      for (var i = 0; i < s.plants.length; i++) {
        var p = s.plants[i];
        if (p.type === 'tree' && Math.abs(p.cell - c) < 3) return { ok: false, reason: 'الأشجار تحتاج مسافة بينها' };
      }
      return { ok: true };
    }
    var bio = BIO[tool];
    var cnt = counts(s)[tool] + (tool === 'caterpillar' ? counts(s).cocoon : 0);
    if (bio && cnt >= bio.max) return { ok: false, reason: 'هذا العدد يكفي من هذا الكائن' };
    return { ok: true };
  }

  function place(s, tool, x, y) {
    var chk = canPlace(s, tool, x);
    if (!chk.ok) return chk;
    s.energy -= TOOLS[tool].cost;
    var e;
    if (tool === 'rain') {
      e = { id: s.nextId++, x: x, t: 0, dur: 8, w: 230, vx: (s.rng() - 0.5) * 18 };
      s.clouds.push(e);
      emit(s, 'rain', { x: x });
    } else if (tool === 'grass' || tool === 'flower' || tool === 'tree') {
      e = addPlant(s, tool, x, 0.05);
      emit(s, 'planted', { species: tool, x: x });
    } else {
      e = addAnimal(s, tool, x, y, true);
      emit(s, 'released', { species: tool, x: x });
    }
    return { ok: true, entity: e };
  }

  function addPlant(s, type, x, growth) {
    var p = {
      id: s.nextId++, type: type, x: clamp(x, 15, WORLD.width - 15), cell: cellOf(x), growth: growth || 0.05,
      health: 1, age: 0, pollinated: false, seedT: 0, sprouted: false, fruitT: 4 + s.rng() * 8,
      color: FLOWER_COLORS[Math.floor(s.rng() * FLOWER_COLORS.length)], seed: s.rng(),
    };
    s.plants.push(p);
    return p;
  }

  function addAnimal(s, type, x, y, adult) {
    var flyer = type === 'bee' || type === 'butterfly' || type === 'bird';
    var a = {
      id: s.nextId++, type: type, x: clamp(x, 20, WORLD.width - 20),
      y: flyer ? clamp(y != null ? y : WORLD.groundY - 160 - s.rng() * 200, WORLD.skyMin, WORLD.skyMax) : WORLD.groundY,
      vx: 0, vy: 0, dir: s.rng() < 0.5 ? -1 : 1,
      energy: 0.75, age: adult ? (BIO[type].adult || 0) + 1 : 0, baby: !adult,
      cooldown: 6 + s.rng() * 6, target: null, state: 'wander', wanderX: x, wanderY: y,
      homeless: 0, cocoon: false, cocoonT: 0, eatT: 0, seed: s.rng(), flyAway: false,
    };
    s.animals.push(a);
    return a;
  }

  // ------------------------------------------------------------------
  // الخطوة الزمنية
  // ------------------------------------------------------------------
  function step(s, dt) {
    var h = 0.1;
    while (dt > 1e-9) {
      var d = Math.min(h, dt);
      tick(s, d);
      dt -= d;
    }
  }

  function tick(s, dt) {
    s.time += dt;
    var L = light(s);
    var rng = s.rng;

    // الغيوم والمطر
    for (var ci = s.clouds.length - 1; ci >= 0; ci--) {
      var cl = s.clouds[ci];
      cl.t += dt;
      cl.x = clamp(cl.x + cl.vx * dt, 60, WORLD.width - 60);
      if (cl.t > 0.8 && cl.t < cl.dur - 0.8) {
        for (var k = 0; k < CELLS; k++) {
          var dx = Math.abs(cellCenter(k) - cl.x);
          if (dx < cl.w / 2 + 25) s.cells[k].moisture = Math.min(1, s.cells[k].moisture + dt * 0.2 * Math.min(1, 1.4 * (1 - dx / (cl.w / 2 + 25))));
        }
      }
      if (cl.t >= cl.dur) s.clouds.splice(ci, 1);
    }

    // التبخّر
    for (var i = 0; i < CELLS; i++) {
      var cell = s.cells[i];
      cell.moisture = Math.max(0, cell.moisture - dt * (0.0035 + 0.0065 * L));
      cell.fertility = clamp(cell.fertility - dt * 0.0015, 0.2, 1);
    }

    tickPlants(s, dt, L);
    tickAnimals(s, dt, L);

    // الفطر (المحلّلات)
    for (var mi = s.mushrooms.length - 1; mi >= 0; mi--) {
      var mu = s.mushrooms[mi];
      mu.t += dt;
      s.cells[mu.cell].fertility = Math.min(1, s.cells[mu.cell].fertility + dt * 0.03);
      if (mu.t > mu.life) s.mushrooms.splice(mi, 1);
    }

    // طاقة الحياة: دخل ثابت + حسب النباتات الناضجة والتنوّع
    var c = counts(s);
    var kinds = speciesPresent(s).length;
    s.energy = Math.min(s.maxEnergy, s.energy + dt * (0.7 + 0.06 * Math.min(40, c.grass + c.flower) + 0.15 * c.tree + 0.1 * kinds));

    // الثمار المضيئة (تجمع بالنقر)
    s.orbTimer -= dt;
    for (var oi = s.orbs.length - 1; oi >= 0; oi--) {
      var o = s.orbs[oi];
      o.t += dt;
      if (o.t > o.life) { s.energy = Math.min(s.maxEnergy, s.energy + Math.ceil(o.value / 2)); s.orbs.splice(oi, 1); emit(s, 'orb-auto', { x: o.x, y: o.y, value: Math.ceil(o.value / 2) }); }
    }

    // مدة بقاء الغابة متوازنة (لأهداف المراحل)
    var b = balance(s);
    s.balancedFor = b.status === 'balanced' ? s.balancedFor + dt : 0;
    s.lastBalance = b;
  }

  function tickPlants(s, dt, L) {
    var rng = s.rng;
    for (var i = s.plants.length - 1; i >= 0; i--) {
      var p = s.plants[i];
      var bio = BIO[p.type];
      var cell = s.cells[p.cell];
      p.age += dt;
      var mf = clamp((cell.moisture - 0.06) / 0.25, 0, 1);
      var ff = 0.7 + 0.6 * cell.fertility;
      var lf = 0.12 + 0.88 * L;
      if (cell.moisture > 0.06) {
        var before = p.growth;
        p.growth = Math.min(1, p.growth + dt * bio.grow * mf * ff * lf);
        cell.moisture = Math.max(0, cell.moisture - dt * bio.thirst * (0.4 + p.growth));
        if (!p.sprouted && p.growth >= 0.25) { p.sprouted = true; emit(s, 'sprout', { species: p.type, x: p.x }); }
        if (before < 0.8 && p.growth >= 0.8 && p.type === 'tree') emit(s, 'tree-grown', { x: p.x });
      }
      // الذبول من العطش
      if (cell.moisture < 0.06) {
        var before2 = p.health;
        p.health -= dt * (p.type === 'tree' ? 0.015 : 0.03);
        if (before2 >= 0.5 && p.health < 0.5) emit(s, 'wilt', { species: p.type, x: p.x });
      } else p.health = Math.min(1, p.health + dt * 0.06);

      if (p.health <= 0 || p.growth <= 0.02 && p.age > 3) { killPlant(s, i, 'dry'); continue; }

      // الانتشار
      if (p.type === 'grass' && p.growth >= 0.9 && cell.moisture > 0.22 && rng() < dt * 0.06) spread(s, p, 'grass');
      if (p.type === 'flower' && p.pollinated && p.growth >= 0.8) {
        p.seedT += dt;
        if (p.seedT > 7) { p.pollinated = false; p.seedT = 0; if (rng() < 0.75) spread(s, p, 'flower'); }
      }
      // الثمار المضيئة من الأشجار والأزهار
      if ((p.type === 'tree' && p.growth >= 0.8) || (p.type === 'flower' && p.growth >= 0.9)) {
        p.fruitT -= dt;
        if (p.fruitT <= 0 && s.orbs.length < 6) {
          p.fruitT = (p.type === 'tree' ? 14 : 22) + rng() * 10;
          var oy = p.type === 'tree' ? WORLD.groundY - 120 - 160 * p.growth * (0.4 + rng() * 0.4) : WORLD.groundY - 60;
          s.orbs.push({ id: s.nextId++, x: p.x + (rng() - 0.5) * 60, y: oy, value: p.type === 'tree' ? 8 : 5, t: 0, life: 9, kind: p.type === 'tree' ? 'fruit' : 'nectar' });
        }
      }
    }
  }

  function spread(s, p, type) {
    var dir = s.rng() < 0.5 ? -1 : 1;
    var c = clamp(p.cell + dir * (1 + Math.floor(s.rng() * 2)), 0, CELLS - 1);
    var cap = type === 'grass' ? BIO.grass.perCell : BIO.flower.perCell;
    if (plantsInCell(s, c, type) >= cap || plantsInCell(s, c) >= 4) return;
    var np = addPlant(s, type, cellCenter(c) + (s.rng() - 0.5) * 40, 0.05);
    np.color = type === 'flower' ? p.color : np.color;
    emit(s, type === 'flower' ? 'seeded' : 'spread', { species: type, x: np.x });
  }

  function killPlant(s, i, why) {
    var p = s.plants[i];
    s.plants.splice(i, 1);
    s.cells[p.cell].fertility = Math.min(1, s.cells[p.cell].fertility + 0.08);
    emit(s, 'plant-died', { species: p.type, x: p.x, why: why });
  }

  function killAnimal(s, a, why) {
    var i = s.animals.indexOf(a);
    if (i < 0) return;
    s.animals.splice(i, 1);
    if (a.flyAway) { emit(s, 'left', { species: a.type, x: a.x, y: a.y }); return; }
    emit(s, 'died', { species: a.type, x: a.x, y: a.y, why: why });
    if (why !== 'eaten' && a.type !== 'bee' && a.type !== 'butterfly') {
      var c = cellOf(a.x);
      s.mushrooms.push({ id: s.nextId++, x: a.x, cell: c, t: 0, life: 14 });
      emit(s, 'decompose', { x: a.x });
    }
  }

  function nearest(list, x, y, maxD, filter) {
    var best = null; var bd = maxD;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (filter && !filter(o)) continue;
      var d = Math.hypot(o.x - x, (o.y != null && y != null ? o.y - y : 0));
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function moveToward(a, tx, speed, dt) {
    var dx = tx - a.x;
    if (Math.abs(dx) < 2) return true;
    a.dir = dx > 0 ? 1 : -1;
    a.x += clamp(dx, -speed * dt, speed * dt);
    return Math.abs(tx - a.x) < 4;
  }

  function fly(a, tx, ty, speed, dt) {
    var dx = tx - a.x; var dy = ty - a.y;
    var d = Math.hypot(dx, dy);
    if (d < 3) return true;
    if (Math.abs(dx) > 1) a.dir = dx > 0 ? 1 : -1;
    var k = Math.min(1, (speed * dt) / d);
    a.x += dx * k; a.y += dy * k;
    return d < 8;
  }

  function wanderGround(s, a, speed, dt) {
    if (a.wanderX == null || Math.abs(a.wanderX - a.x) < 5 || s.rng() < dt * 0.15) {
      a.wanderX = clamp(a.x + (s.rng() - 0.5) * 360, 30, WORLD.width - 30);
    }
    moveToward(a, a.wanderX, speed, dt);
  }

  function wanderAir(s, a, speed, dt) {
    if (a.wanderY == null || s.rng() < dt * 0.3 || fly(a, a.wanderX, a.wanderY, speed, dt)) {
      a.wanderX = clamp(a.x + (s.rng() - 0.5) * 400, 40, WORLD.width - 40);
      a.wanderY = clamp(a.y + (s.rng() - 0.5) * 200, WORLD.skyMin, WORLD.skyMax);
    }
  }

  function tickAnimals(s, dt, L) {
    var rng = s.rng;
    var night = L === 0;
    var list = s.animals.slice();
    var c = counts(s);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (s.animals.indexOf(a) < 0) continue;
      var bio = BIO[a.type];
      a.age += dt;
      a.cooldown -= dt;
      if (a.baby && a.age >= (bio.adult || 10)) a.baby = false;
      var rest = night && (a.type === 'rabbit' || a.type === 'bee' || a.type === 'butterfly');
      a.energy -= dt * bio.hunger * (rest ? 0.4 : 1);
      if (a.energy <= 0) { killAnimal(s, a, 'starved'); continue; }
      if (a.age > bio.life) { killAnimal(s, a, 'old'); continue; }

      if (a.flyAway) {
        a.y -= 160 * dt; a.x += a.dir * 120 * dt;
        if (a.y < -60) killAnimal(s, a, 'left');
        continue;
      }

      switch (a.type) {
        case 'rabbit': tickRabbit(s, a, dt, rest); break;
        case 'fox': tickFox(s, a, dt); break;
        case 'caterpillar': tickCaterpillar(s, a, dt, c); break;
        case 'butterfly':
        case 'bee': tickPollinator(s, a, dt, rest, c); break;
        case 'bird': tickBird(s, a, dt, c); break;
        default:
      }
    }
  }

  function tickRabbit(s, a, dt, rest) {
    var bio = BIO.rabbit;
    a.state = 'wander';
    if (rest) { a.state = 'sleep'; return; }
    // الهروب من الثعلب القريب
    var fox = nearest(s.animals, a.x, null, 170, function (o) { return o.type === 'fox' && o.state === 'hunt'; });
    if (fox && a.energy > 0.25) { a.state = 'flee'; moveToward(a, a.x + (a.x > fox.x ? 220 : -220), bio.speed * 1.5, dt); return; }
    if (a.energy < 0.72) {
      var g = nearest(s.plants, a.x, null, 450, function (p) { return p.type === 'grass' && p.growth > 0.35; });
      if (g) {
        a.state = 'eat';
        if (moveToward(a, g.x, bio.speed, dt)) {
          a.eatT += dt;
          if (a.eatT > 1.2) {
            a.eatT = 0;
            g.growth -= 0.45;
            a.energy = Math.min(1, a.energy + bio.eat);
            emit(s, 'ate', { species: 'rabbit', food: 'grass', x: a.x });
            if (g.growth <= 0.06) { var gi = s.plants.indexOf(g); if (gi >= 0) killPlant(s, gi, 'eaten'); }
          }
        }
        return;
      }
    }
    // التكاثر
    if (!a.baby && a.energy > 0.7 && a.cooldown <= 0 && counts(s).rabbit < bio.max) {
      var mate = nearest(s.animals, a.x, null, 450, function (o) { return o !== a && o.type === 'rabbit' && !o.baby && o.energy > 0.5 && o.cooldown <= 0; });
      if (mate) {
        if (moveToward(a, mate.x, bio.speed, dt) || Math.abs(mate.x - a.x) < 30) {
          a.energy -= 0.2; mate.energy -= 0.15; a.cooldown = 16 + s.rng() * 6; mate.cooldown = 16;
          addAnimal(s, 'rabbit', a.x + (s.rng() - 0.5) * 30, null, false);
          emit(s, 'born', { species: 'rabbit', x: a.x });
        }
        return;
      }
    }
    wanderGround(s, a, bio.speed * 0.45, dt);
  }

  function tickFox(s, a, dt) {
    var bio = BIO.fox;
    a.state = 'wander';
    if (a.energy < 0.5) {
      var prey = nearest(s.animals, a.x, null, 520, function (o) { return o.type === 'rabbit'; });
      if (prey) {
        a.state = 'hunt';
        moveToward(a, prey.x, bio.chase, dt);
        if (Math.abs(prey.x - a.x) < 22) {
          killAnimal(s, prey, 'eaten');
          a.energy = Math.min(1, a.energy + bio.eat);
          emit(s, 'ate', { species: 'fox', food: 'rabbit', x: a.x });
        }
        return;
      }
    }
    if (!a.baby && a.energy > 0.8 && a.cooldown <= 0 && counts(s).fox < bio.max) {
      var mate = nearest(s.animals, a.x, null, 400, function (o) { return o !== a && o.type === 'fox' && !o.baby && o.energy > 0.6; });
      if (mate && Math.abs(mate.x - a.x) < 60) {
        a.energy -= 0.3; mate.energy -= 0.2; a.cooldown = 40; mate.cooldown = 40;
        addAnimal(s, 'fox', a.x, null, false);
        emit(s, 'born', { species: 'fox', x: a.x });
        return;
      }
      if (mate) { moveToward(a, mate.x, bio.speed, dt); return; }
    }
    wanderGround(s, a, bio.speed * 0.5, dt);
  }

  function tickCaterpillar(s, a, dt, c) {
    var bio = BIO.caterpillar;
    if (a.cocoon) {
      a.energy = Math.max(a.energy, 0.5); // الشرنقة لا تجوع
      a.cocoonT += dt;
      if (a.cocoonT > 8) {
        var i = s.animals.indexOf(a);
        if (i >= 0) s.animals.splice(i, 1);
        var b = addAnimal(s, 'butterfly', a.x, WORLD.groundY - 60, true);
        b.energy = 0.9;
        emit(s, 'metamorph', { x: a.x, y: WORLD.groundY - 40 });
      }
      return;
    }
    if (a.age > bio.adult && a.energy > 0.45) {
      a.cocoon = true; a.cocoonT = 0;
      emit(s, 'cocoon', { x: a.x });
      return;
    }
    var leaf = nearest(s.plants, a.x, null, 260, function (p) { return (p.type === 'grass' || p.type === 'flower') && p.growth > 0.2; });
    if (leaf) {
      a.state = 'eat';
      if (moveToward(a, leaf.x, bio.speed + 6, dt)) {
        leaf.growth -= dt * 0.025;
        a.energy = Math.min(1, a.energy + dt * 0.07);
      }
    } else wanderGround(s, a, bio.speed, dt);
  }

  function tickPollinator(s, a, dt, rest, c) {
    var bio = BIO[a.type];
    if (rest) {
      a.state = 'sleep';
      var perch = nearest(s.plants, a.x, a.y, 600, function (p) { return p.type === 'flower' || p.type === 'tree'; });
      if (perch) fly(a, perch.x, WORLD.groundY - (perch.type === 'tree' ? 130 : 45), bio.speed * 0.6, dt);
      return;
    }
    var fl = a.target && s.plants.indexOf(a.target) >= 0 ? a.target : null;
    if (!fl || s.rng() < dt * 0.15) {
      fl = nearest(s.plants, a.x, a.y, 900, function (p) { return p.type === 'flower' && p.growth >= 0.6 && p !== a.lastFlower; });
      a.target = fl;
    }
    if (fl) {
      a.state = 'visit';
      var fy = WORLD.groundY - 22 - 50 * fl.growth;
      if (fly(a, fl.x, fy, bio.speed, dt)) {
        a.eatT += dt;
        if (a.eatT > 1.4) {
          a.eatT = 0;
          a.energy = Math.min(1, a.energy + 0.3);
          if (!fl.pollinated) { fl.pollinated = true; emit(s, 'pollinate', { species: a.type, x: fl.x, y: fy }); }
          a.lastFlower = fl; a.target = null;
        }
      }
    } else {
      a.state = 'wander';
      wanderAir(s, a, bio.speed * 0.6, dt);
    }
    // الفراشة تضع بيضاً يفقس يرقة، والنحل يتكاثر في الخلية إن كثرت الأزهار
    if (a.type === 'butterfly' && a.energy > 0.8 && a.cooldown <= 0 && c.caterpillar + c.cocoon < BIO.caterpillar.max && c.grass > 2) {
      a.cooldown = 28;
      a.energy -= 0.3;
      addAnimal(s, 'caterpillar', a.x, null, false);
      emit(s, 'born', { species: 'caterpillar', x: a.x });
    }
    if (a.type === 'bee' && a.energy > 0.85 && a.cooldown <= 0 && c.flower >= 4 && c.bee < BIO.bee.max) {
      a.cooldown = 26;
      a.energy -= 0.3;
      addAnimal(s, 'bee', a.x, a.y, true);
      emit(s, 'born', { species: 'bee', x: a.x, y: a.y });
    }
  }

  function tickBird(s, a, dt, c) {
    var bio = BIO.bird;
    var home = nearest(s.plants, a.x, null, 2000, function (p) { return p.type === 'tree' && p.growth >= 0.7; });
    if (!home) {
      a.homeless += dt;
      if (a.homeless > 9) { a.flyAway = true; emit(s, 'homeless', { x: a.x, y: a.y }); return; }
    } else a.homeless = 0;
    a.home = home ? home.id : null;

    if (a.energy < 0.6) {
      var prey = nearest(s.animals, a.x, a.y, 700, function (o) { return o.type === 'caterpillar' && !o.cocoon; });
      if (prey) {
        a.state = 'hunt';
        if (fly(a, prey.x, WORLD.groundY - 8, bio.speed, dt)) {
          killAnimal(s, prey, 'eaten');
          a.energy = Math.min(1, a.energy + 0.55);
          emit(s, 'ate', { species: 'bird', food: 'caterpillar', x: a.x, y: a.y });
        }
        return;
      }
      // تأكل من ثمار الشجرة إن لم تجد يرقات
      if (home) a.energy = Math.min(1, a.energy + dt * 0.012);
    }
    if (home && !a.baby && a.energy > 0.75 && a.cooldown <= 0 && c.bird < bio.max) {
      var mate = nearest(s.animals, a.x, a.y, 500, function (o) { return o !== a && o.type === 'bird' && !o.baby; });
      if (mate) {
        a.cooldown = 38; mate.cooldown = 38; a.energy -= 0.3;
        addAnimal(s, 'bird', home.x, WORLD.groundY - 150, false);
        emit(s, 'born', { species: 'bird', x: home.x, y: WORLD.groundY - 150 });
        return;
      }
    }
    if (home && (a.state === 'perch' || s.rng() < dt * 0.25)) {
      a.state = 'perch';
      var px = home.x + (((a.id * 37) % 90) - 45) * home.growth;
      var py = WORLD.groundY - 110 - 140 * home.growth + ((a.id * 13) % 30);
      fly(a, px, py, bio.speed * 0.7, dt);
      if (s.rng() < dt * 0.12) a.state = 'wander';
      return;
    }
    a.state = 'wander';
    wanderAir(s, a, bio.speed * 0.55, dt);
  }

  function collectOrb(s, id) {
    for (var i = 0; i < s.orbs.length; i++) {
      if (s.orbs[i].id === id) {
        var o = s.orbs[i];
        s.orbs.splice(i, 1);
        s.energy = Math.min(s.maxEnergy, s.energy + o.value);
        emit(s, 'orb', { x: o.x, y: o.y, value: o.value });
        return o.value;
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------
  // المراحل والأهداف
  // ------------------------------------------------------------------
  var LEVELS = Object.freeze([
    {
      id: 'drop', title: 'أول قطرة', tools: ['rain', 'grass'], energy: 30, stars: [70, 110],
      intro: 'الأرض جافة وحزينة… أنزل المطر وازرع العشب لتعود إليها الحياة!',
      goals: [{ species: 'grass', n: 8, label: 'عشب نامٍ' }],
      lesson: 'النبات يحتاج إلى الماء وضوء الشمس ليصنع غذاءه بنفسه. لاحظت أنه لا ينمو تقريباً في الليل؟',
    },
    {
      id: 'rabbits', title: 'بيت الأرانب', tools: ['rain', 'grass', 'flower', 'rabbit'], energy: 45, stars: [100, 160],
      intro: 'الأرانب تبحث عن بيت فيه طعام كثير. هل تستطيع أن تجعل عائلتها تكبر؟',
      goals: [{ species: 'rabbit', n: 6, label: 'أرانب' }, { species: 'grass', n: 10, label: 'عشب نامٍ' }],
      lesson: 'الأرنب «عاشب» يأكل النباتات فقط. كلما زاد العشب وجدت الأرانب طعاماً أكثر وتكاثرت.',
    },
    {
      id: 'blossom', title: 'رقصة الأزهار', tools: ['rain', 'grass', 'flower', 'bee', 'caterpillar'], energy: 50, stars: [110, 170],
      intro: 'الأزهار لا تستطيع أن تنتشر وحدها… تحتاج أصدقاء يطيرون!',
      goals: [{ species: 'flower', n: 10, label: 'زهرة متفتّحة' }, { species: 'butterfly', n: 1, label: 'فراشة' }],
      lesson: 'النحل والفراشات تنقل حبوب اللقاح بين الأزهار فتصنع بذوراً. واليرقة تتحوّل إلى شرنقة ثم فراشة!',
    },
    {
      id: 'trees', title: 'حرّاس الشجر', tools: ['rain', 'grass', 'flower', 'tree', 'caterpillar', 'bird'], energy: 60, stars: [130, 200],
      intro: 'الطيور تريد أن تسكن الغابة، لكنها تحتاج بيوتاً عالية…',
      goals: [{ species: 'tree', n: 3, label: 'شجرة كبيرة' }, { species: 'bird', n: 3, label: 'طيور' }],
      lesson: 'الشجرة «موطن» للطيور. والطيور تأكل اليرقات فتحمي أوراق النباتات — كل كائن يساعد غيره.',
    },
    {
      id: 'chain', title: 'سلسلة الحياة', tools: ['rain', 'grass', 'flower', 'tree', 'caterpillar', 'bee', 'rabbit', 'bird', 'fox'], energy: 70, stars: [150, 230],
      intro: 'التحدّي الأكبر: اصنع غابة فيها نباتات وأرانب وثعالب… وحافظ على توازنها!',
      goals: [{ species: 'grass', n: 8, label: 'عشب' }, { species: 'rabbit', n: 3, label: 'أرانب' }, { species: 'fox', n: 1, label: 'ثعلب' }, { balanced: 30, label: 'ثانية من التوازن' }],
      lesson: 'العشب ← الأرنب ← الثعلب: هذه «سلسلة غذائية». لو اختفى حلقة منها اختلّ توازن الغابة كلها.',
    },
  ]);

  var FREE_PLAY = Object.freeze({
    id: 'free', title: 'غابتي الحرّة', tools: Object.keys(TOOLS), energy: 120, free: true,
    intro: 'لا أهداف ولا وقت — اصنع الغابة التي تحلم بها، وراقب كيف تعيش وحدها!', goals: [], lesson: '',
  });

  /** تقدّم أهداف المرحلة */
  function goalProgress(s, level) {
    var c = counts(s);
    var all = true;
    var list = level.goals.map(function (g) {
      var have = g.balanced ? Math.floor(s.balancedFor) : c[g.species];
      var need = g.balanced || g.n;
      var done = have >= need;
      if (!done) all = false;
      return { label: g.label, species: g.species, have: Math.min(have, need), need: need, done: done, balanced: !!g.balanced };
    });
    return { goals: list, done: level.goals.length > 0 && all };
  }

  /** النجوم حسب زمن إكمال المرحلة (ثوانٍ من زمن اللعبة) */
  function starsFor(level, seconds) {
    if (!level.stars) return 3;
    return seconds <= level.stars[0] ? 3 : seconds <= level.stars[1] ? 2 : 1;
  }

  /** غابة جاهزة مزدهرة (لخلفية القائمة) */
  function showcase(rng) {
    var s = createWorld({ rng: rng, energy: 999, moisture: 0.55 });
    for (var i = 0; i < CELLS; i++) s.cells[i].fertility = 0.8;
    var r = s.rng;
    for (var g = 0; g < 26; g++) addPlant(s, 'grass', 40 + r() * (WORLD.width - 80), 0.7 + r() * 0.3);
    for (var f = 0; f < 12; f++) addPlant(s, 'flower', 40 + r() * (WORLD.width - 80), 0.8 + r() * 0.2);
    [180, 640, 1150].forEach(function (x) { addPlant(s, 'tree', x, 0.95); });
    ['rabbit', 'rabbit', 'rabbit', 'rabbit', 'fox', 'bee', 'bee', 'butterfly', 'butterfly', 'bird', 'bird', 'caterpillar'].forEach(function (t) {
      addAnimal(s, t, 80 + r() * (WORLD.width - 160), null, true).energy = 0.9;
    });
    s.events = [];
    return s;
  }

  var API = {
    WORLD: WORLD, CELLS: CELLS, TOOLS: TOOLS, SPECIES: SPECIES, BIO: BIO, LEVELS: LEVELS, FREE_PLAY: FREE_PLAY,
    seeded: seeded, createWorld: createWorld, step: step, place: place, canPlace: canPlace, collectOrb: collectOrb,
    counts: counts, speciesPresent: speciesPresent, balance: balance, avgMoisture: avgMoisture,
    dayPhase: dayPhase, light: light, isNight: isNight, cellOf: cellOf,
    goalProgress: goalProgress, starsFor: starsFor, showcase: showcase, addPlant: addPlant, addAnimal: addAnimal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Ecosystem = API;
})(typeof window !== 'undefined' ? window : globalThis);
