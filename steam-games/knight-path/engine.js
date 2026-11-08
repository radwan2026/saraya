/* ===============================================================
   فارس الدرب — المنطق (بدون أي اعتماد على المتصفح)
   المحطات، اختيار الأسئلة، حسابات المبارزة، الرتب والتطويرات.
   =============================================================== */
(function (root) {
  'use strict';

  /** المحطات الثماني على طريق الحج الشامي */
  var STAGES = [
    {
      id: 'damascus', name: 'دمشق', sub: 'بداية الرحلة', theme: 'damascus', time: 'dawn', runner: 26,
      guardians: [
        { name: 'التاجر أبو سليم', look: 'merchant', hp: 60, intro: 'أهلاً بالفارس الصغير! قبل أن تخرج من أسواق دمشق، أجبني عن أسئلتي.', win: 'بارك الله فيك! خذ هذا التمر زاداً للطريق.' },
      ],
      boss: { name: 'حارس البوابة', look: 'guard', hp: 90, trick: null, intro: 'لن تعبر بوابة دمشق إلا بالعلم! استعدّ للمبارزة.', win: 'أنت أهلٌ للرحلة. افتح البوابة… وانطلق!' },
    },
    {
      id: 'bosra', name: 'بُصرى', sub: 'مدينة الحجر الأسود', theme: 'bosra', time: 'night', runner: 30,
      guardians: [
        { name: 'البومة الحكيمة', look: 'owl', hp: 60, intro: 'هووو… الليل طويل، فلنرَ إن كان علمك يضيء الطريق.', win: 'هووو! عيناك تريان بالعلم في الظلام.' },
      ],
      boss: { name: 'ساحر الظلال', look: 'sorcerer', color: '#6b3fa0', hp: 110, trick: 'shadow', intro: 'هاهاها! سأطفئ الأنوار، ولن ترى أسئلتك إلا بصعوبة!', win: 'آآه! نورُ علمك بدّد ظلالي!' },
    },
    {
      id: 'qatrana', name: 'الزرقاء والقطرانة', sub: 'قلاع الطريق', theme: 'castle', time: 'day', runner: 32,
      guardians: [
        { name: 'بدوي الألغاز', look: 'bedouin', hp: 60, intro: 'يا هلا بالفارس! عندي أسئلة مثل رياح البادية… سريعة!', win: 'ما شاء الله! حلّ عليك الخير.' },
        { name: 'حارس القلعة', look: 'guard', hp: 60, intro: 'هذه القلعة تحمي القوافل. أثبت أنك فارس حكيم.', win: 'تفضّل، اشرب من بركة القلعة واسترِح.' },
      ],
      boss: { name: 'سيدة الرياح', look: 'sorceress', color: '#1f9fa0', hp: 120, trick: 'wind', intro: 'ووووش! رياحي ستبعثر كلمات أسئلتك!', win: 'هدأت رياحي… علمك أثبت من الجبال.' },
    },
    {
      id: 'maan', name: 'معان', sub: 'واحة الآبار', theme: 'oasis', time: 'day', runner: 32,
      guardians: [
        { name: 'ساقي الواحة', look: 'merchant', color: '#2f7fd0', hp: 60, intro: 'مرحباً بك في الواحة! الماء حياة، فهل تعرف أسراره؟', win: 'املأ قِربتك يا فارس، الطريق طويل.' },
      ],
      boss: { name: 'ساحر السراب', look: 'sorcerer', color: '#e07a2a', hp: 130, trick: 'mirage', intro: 'انظر… انظر… هل ترى الإجابات؟ إنها تتحرك! هههه', win: 'ما كان إلا سراباً… والحقيقة لا تخدعها الأوهام.' },
    },
    {
      id: 'tabuk', name: 'تبوك', sub: 'عبور الصحراء', theme: 'desert', time: 'noon', runner: 36,
      guardians: [
        { name: 'قائد القافلة', look: 'bedouin', color: '#8a3a2a', hp: 70, intro: 'الصحراء لا ترحم من لا يعرف طريقه. أجبني لأدلّك.', win: 'الآن تعرف النجوم والرمال. سِر على بركة الله.' },
        { name: 'صانع البوصلات', look: 'scholar', hp: 70, intro: 'البوصلة لا تكذب، والعلم كذلك. هيا!', win: 'خذ هذه البوصلة، لن تضلّ بعد اليوم.' },
      ],
      boss: { name: 'سيد الرمال', look: 'sandlord', color: '#c9902a', hp: 140, trick: 'sand', intro: 'عاصفتي الرملية ستسرق وقتك! أسرع… أسرع!', win: 'هدأت العاصفة… سرعتك وعلمك غلباني!' },
    },
    {
      id: 'hegra', name: 'الحِجر والعُلا', sub: 'جبال منحوتة', theme: 'hegra', time: 'night', runner: 34,
      guardians: [
        { name: 'الفلكي', look: 'scholar', color: '#2a4a8a', hp: 70, intro: 'انظر إلى السماء يا فارس… النجوم كتابٌ مفتوح لمن يعلم.', win: 'أحسنت! أنت تقرأ السماء كما تقرأ الكتاب.' },
      ],
      boss: { name: 'ساحر الصخر', look: 'stone', color: '#7a6a5a', hp: 150, trick: 'stone', intro: 'أسئلتي كالصخر… تتساقط عليك بلا توقف!', win: 'تحطّمت صخوري… الصبر والعلم أقوى.' },
    },
    {
      id: 'madinah', name: 'المدينة المنورة', sub: 'مدينة الهجرة', theme: 'madinah', time: 'dawn', runner: 28, peaceful: true,
      guardians: [
        { name: 'معلّم الكُتّاب', look: 'scholar', color: '#1f7a4a', hp: 60, intro: 'أهلاً بالفارس في مدينة الهجرة. هنا نتعلّم بالحكمة لا بالسيف.', win: 'علمٌ نافع وخلقٌ حسن… هكذا يكون الفارس.' },
        { name: 'طبيب الأعشاب', look: 'merchant', color: '#5a8a2a', hp: 60, intro: 'جسمك أمانة يا فارس، فهل تعرف كيف يعمل؟', win: 'بارك الله فيك! صحتك قوتك.' },
      ],
      boss: { name: 'شيخ الحكمة', look: 'elder', hp: 120, trick: 'wisdom', friendly: true, intro: 'لا سحر هنا ولا مبارزة، بل «اختبار الحكمة». أجب بقلبٍ هادئ.', win: 'أنت جاهز لآخر الطريق… مكة تنتظرك.' },
    },
    {
      id: 'makkah', name: 'مكة المكرمة', sub: 'نهاية الرحلة', theme: 'makkah', time: 'dawn', runner: 30,
      guardians: [
        { name: 'دليل الحجاج', look: 'bedouin', color: '#ffffff', hp: 70, intro: 'اقتربنا يا فارس! هذه جبال مكة أمامك.', win: 'لم يبقَ إلا التحدّي الأخير…' },
      ],
      boss: { name: 'كبير السحرة', look: 'archsorcerer', color: '#3a1a5a', hp: 200, trick: 'final', intro: 'جمعتُ كل خدع السحرة! الظلال والرياح والسراب والرمال… لن تصل!', win: 'لا… لا! العلم نور… والأوهام تزول!' },
    },
  ];

  var AGES = [
    { id: 'young', label: '7–9 سنوات', dset: [[1], [2], [3]], time: 26 },
    { id: 'mid', label: '10–12 سنة', dset: [[1, 2], [3]], time: 22 },
    { id: 'teen', label: '13 سنة فأكثر', dset: [[2, 3], [1]], time: 18 },
  ];

  var RANKS = [
    { xp: 0, name: 'فتى الدرب', icon: '🐎' },
    { xp: 250, name: 'فارس', icon: '🗡️' },
    { xp: 700, name: 'فارس الحكمة', icon: '📜' },
    { xp: 1300, name: 'فارس النور', icon: '🌟' },
  ];

  var UPGRADES = {
    sword: { name: 'السيف الدمشقي', icon: '⚔️', costs: [30, 60, 110], desc: 'ضرباتك أقوى' },
    shield: { name: 'الدرع المزخرف', icon: '🛡️', costs: [30, 60, 110], desc: 'خدع السحرة تؤذيك أقل' },
    falcon: { name: 'تدريب الصقر', icon: '🦅', costs: [40, 90], desc: 'مساعدة إضافية من الصقر في كل محطة' },
    saddle: { name: 'سرج القافلة', icon: '🐎', costs: [25, 55], desc: 'تجذب التمر والماء من بعيد في الرحلة' },
  };

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

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /**
   * يختار أسئلة لمحطة: يفضّل أسئلة المحطة بالصعوبة المناسبة للعمر،
   * ثم الصعوبات القريبة، ثم الأسئلة العامة. لا يكرّر ما في used.
   */
  function pickQuestions(bank, stage, ageIdx, count, rng, used) {
    used = used || {};
    var age = AGES[ageIdx] || AGES[1];
    var out = [];
    var pools = [];
    age.dset.forEach(function (ds) {
      pools.push(bank.filter(function (q) { return q.stage === stage && ds.indexOf(q.d) >= 0; }));
    });
    age.dset.forEach(function (ds) {
      pools.push(bank.filter(function (q) { return q.stage === -1 && ds.indexOf(q.d) >= 0; }));
    });
    pools.push(bank.filter(function (q) { return q.stage === -1 || q.stage === stage; }));
    for (var p = 0; p < pools.length && out.length < count; p++) {
      var pool = shuffle(pools[p], rng);
      for (var i = 0; i < pool.length && out.length < count; i++) {
        var key = keyOf(pool[i]);
        if (used[key]) continue;
        used[key] = true;
        out.push(pool[i]);
      }
    }
    // إن نفدت الأسئلة كلها نسمح بالتكرار
    if (out.length < count) {
      var all = shuffle(bank.filter(function (q) { return q.stage === stage || q.stage === -1; }), rng);
      for (var k = 0; out.length < count && k < all.length * 3; k++) out.push(all[k % all.length]);
    }
    return out;
  }

  function keyOf(q) { return q.stage + '|' + q.q; }

  /** يجهّز سؤالاً للعرض: يخلط الخيارات ويحفظ موضع الصحيح */
  function prepare(q, rng) {
    if (q.type === 'order') {
      var items = shuffle(q.a.map(function (t, i) { return { t: t, i: i }; }), rng);
      // لا نعرضها مرتبة صحيحة من البداية
      if (items.every(function (it, i) { return it.i === i; })) items.reverse();
      return { q: q, type: 'order', items: items };
    }
    var opts = q.a.map(function (t, i) { return { t: t, ok: i === 0 }; });
    if (q.type !== 'tf') opts = shuffle(opts, rng);
    else opts = [{ t: 'صح', ok: q.a[0] === 'صح' }, { t: 'خطأ', ok: q.a[0] === 'خطأ' }];
    return { q: q, type: q.type, options: opts };
  }

  function checkOrder(prepared, chosenIdx) {
    if (chosenIdx.length !== prepared.items.length) return false;
    for (var i = 0; i < chosenIdx.length; i++) if (prepared.items[chosenIdx[i]].i !== i) return false;
    return true;
  }

  // ------------------------------------------------------------------
  // المبارزة
  // ------------------------------------------------------------------
  function createDuel(enemy, upgrades, opts) {
    upgrades = upgrades || {};
    opts = opts || {};
    return {
      enemyMax: enemy.hp, enemyHp: enemy.hp,
      playerMax: 100, playerHp: opts.playerHp != null ? opts.playerHp : 100,
      sword: upgrades.sword || 0, shield: upgrades.shield || 0,
      friendly: !!enemy.friendly,
      streak: 0, correct: 0, wrong: 0, phase: 0, done: false, won: false,
    };
  }

  /**
   * نتيجة إجابة. speed من 0 (آخر لحظة) إلى 1 (فوراً).
   * الإجابة السريعة تعطي «ضربة قاضية» أقوى، والسلسلة تزيد الضرر.
   */
  function answer(duel, correct, speed) {
    speed = Math.max(0, Math.min(1, speed || 0));
    var res = { correct: correct, damage: 0, hurt: 0, crit: false, phaseChanged: false };
    if (correct) {
      duel.streak++;
      duel.correct++;
      var dmg = 22 + duel.sword * 6 + Math.round(10 * speed) + Math.min(3, duel.streak - 1) * 3;
      if (speed > 0.7) { dmg = Math.round(dmg * 1.35); res.crit = true; }
      res.damage = dmg;
      duel.enemyHp = Math.max(0, duel.enemyHp - dmg);
    } else {
      duel.streak = 0;
      duel.wrong++;
      // في «اختبار الحكمة» الخطأ لا يؤذي، لكنه لا يقرّبك من النهاية
      res.hurt = duel.friendly ? 0 : Math.max(8, 26 - duel.shield * 5);
      duel.playerHp = Math.max(0, duel.playerHp - res.hurt);
    }
    var ph = phaseOf(duel);
    if (ph !== duel.phase) { duel.phase = ph; res.phaseChanged = true; }
    if (duel.enemyHp <= 0) { duel.done = true; duel.won = true; }
    else if (duel.playerHp <= 0) { duel.done = true; duel.won = false; }
    return res;
  }

  /** طور الخصم الكبير حسب حياته المتبقية: 0 ثم 1 (دون الثلثين) ثم 2 (دون الثلث) */
  function phaseOf(duel) {
    var k = duel.enemyHp / duel.enemyMax;
    return k > 0.66 ? 0 : k > 0.33 ? 1 : 2;
  }

  /** الخدع النشطة حسب نوع الخصم وطوره */
  function tricksFor(trick, phase) {
    if (!trick) return [];
    if (trick === 'final') return phase === 0 ? ['shadow'] : phase === 1 ? ['mirage', 'wind'] : ['sand', 'wind', 'shadow'];
    if (trick === 'wisdom') return [];
    return phase === 0 ? [] : [trick];
  }

  function healWater(duel) {
    duel.playerHp = Math.min(duel.playerMax, duel.playerHp + 35);
    return duel.playerHp;
  }

  function starsFor(correct, total) {
    if (!total) return 0;
    var k = correct / total;
    return k >= 0.9 ? 3 : k >= 0.7 ? 2 : 1;
  }

  function rankOf(xp) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = RANKS[i];
    return r;
  }

  function upgradeCost(key, level) {
    var u = UPGRADES[key];
    return u && level < u.costs.length ? u.costs[level] : null;
  }

  function buyUpgrade(save, key) {
    var lvl = save.upgrades[key] || 0;
    var cost = upgradeCost(key, lvl);
    if (cost == null) return { ok: false, reason: 'وصلت إلى أعلى مستوى' };
    if (save.dates < cost) return { ok: false, reason: 'تحتاج تمراً أكثر 🌴' };
    save.dates -= cost;
    save.upgrades[key] = lvl + 1;
    return { ok: true, level: lvl + 1 };
  }

  function newSave(name, ageIdx) {
    return {
      v: 1, name: name || 'الفارس', age: ageIdx == null ? 1 : ageIdx,
      unlocked: 1, stars: [], xp: 0, dates: 20, water: 2,
      upgrades: { sword: 0, shield: 0, falcon: 0, saddle: 0 },
      correct: 0, answered: 0, finished: false, finishedAt: null, codex: [],
    };
  }

  var API = {
    STAGES: STAGES, AGES: AGES, RANKS: RANKS, UPGRADES: UPGRADES,
    seeded: seeded, shuffle: shuffle, pickQuestions: pickQuestions, prepare: prepare, checkOrder: checkOrder,
    createDuel: createDuel, answer: answer, phaseOf: phaseOf, tricksFor: tricksFor, healWater: healWater,
    starsFor: starsFor, rankOf: rankOf, upgradeCost: upgradeCost, buyUpgrade: buyUpgrade, newSave: newSave,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.KnightEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
