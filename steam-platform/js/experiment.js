/* صفحة التجربة: قالب موحّد (مقدّمة → المختبر والتحدّي → اختبار → نشاط منزلي → دليل المعلّم) */
(function () {
  'use strict';
  const { el, fmt } = STEAM.util;
  const store = STEAM.store;

  const exp = STEAM.getExperiment(STEAM.util.qs('id')) || STEAM.experiments[0];
  const def = STEAM.sims[exp.id];
  const grade = store.grade();
  const level = store.level(grade);
  const levelName = { simple: 'مبسّط (1–2)', standard: 'قياسي (3–4)', advanced: 'متقدّم (5–6)' }[level];
  document.title = `${exp.title} — STEAM Science Games`;

  STEAM.ui.header('home');
  const main = document.getElementById('app');

  /* ---------- الترويسة + خطوات الدرس ---------- */
  const tabs = ['مقدّمة', 'المختبر والتحدّي', 'اختبار سريع', 'نشاط منزلي وأمان', 'دليل المعلّم والمطوّر'];
  const outOfRange = grade < exp.grades[0] || grade > exp.grades[1];
  const header = el('section', { class: 'exp-header' },
    el('div', { class: 'container' },
      el('div', { class: 'breadcrumbs' }, el('a', { href: 'index.html' }, 'التجارب'), ' / ', exp.title),
      el('h1', {}, `${exp.icon} ${exp.title}`),
      el('div', { class: 'tags' },
        el('span', { class: 'tag purple' }, `الصفوف المقترحة: ${exp.grades[0]}–${exp.grades[1]}`),
        el('span', { class: 'tag' }, `صفّك: ${grade}`),
        el('span', { class: 'tag green' }, `المستوى: ${levelName}`),
        el('span', { class: 'tag', style: 'direction:ltr' }, exp.en),
        outOfRange ? el('span', { class: 'tag orange' }, 'خارج نطاق الصف المقترح — تم تكييف المستوى') : null),
      el('div', { class: 'steps', role: 'tablist' },
        tabs.map((t, i) => el('button', { class: 'step-tab' + (i === 0 ? ' active' : ''), role: 'tab', 'data-i': i, onclick: () => go(i) },
          el('span', { class: 'num' }, fmt(i + 1)), t)))));
  main.append(header);

  const body = el('div', { class: 'container section' });
  main.append(body);
  const panels = tabs.map((_, i) => el('section', { class: 'step-panel' + (i === 0 ? ' active' : ''), role: 'tabpanel' }));
  body.append(...panels);

  function go(i) {
    document.querySelectorAll('.step-tab').forEach((b, j) => {
      b.classList.toggle('active', i === j);
      if (j < i) b.classList.add('done');
    });
    panels.forEach((p, j) => p.classList.toggle('active', i === j));
    STEAM.tts.stop();
    if (i === 1) sim && sim.stage.resize();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const nextBtn = (i, label) => el('div', { style: 'margin-top:20px;display:flex;justify-content:flex-end' },
    el('button', { class: 'btn btn-primary', onclick: () => go(i) }, label || `التالي: ${tabs[i]} ←`));

  /* ---------- 1) المقدّمة: أهداف + قصة مصوّرة (فيديو تمهيدي) ---------- */
  (function intro() {
    const p = panels[0];
    const frames = exp.story.map((f, i) => el('div', { class: 'frame' + (i === 0 ? ' on' : '') }, el('div', { class: 'art' }, f.art), el('p', {}, f.text)));
    const dots = el('div', { class: 'dots' }, exp.story.map((_, i) => el('span', { class: i === 0 ? 'on' : '', onclick: () => show(i) })));
    let cur = 0, timer = null;
    function show(i) {
      cur = (i + frames.length) % frames.length;
      frames.forEach((f, j) => f.classList.toggle('on', j === cur));
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j === cur));
    }
    function play() {
      stop();
      const speakAndNext = () => {
        STEAM.tts.speak(exp.story[cur].text);
        timer = setTimeout(() => { if (cur < frames.length - 1) { show(cur + 1); speakAndNext(); } else stop(); }, 5200);
      };
      playBtn.textContent = '⏸ إيقاف';
      playBtn.onclick = stop;
      speakAndNext();
    }
    function stop() { clearTimeout(timer); STEAM.tts.stop(); playBtn.textContent = '▶ تشغيل مع الصوت'; playBtn.onclick = play; }
    const playBtn = el('button', { class: 'btn btn-primary btn-sm', onclick: play }, '▶ تشغيل مع الصوت');

    p.append(el('div', { class: 'grid grid-2' },
      el('div', { class: 'card' },
        el('h2', {}, 'فيديو تمهيدي مصوّر'),
        el('div', { class: 'story' }, frames),
        el('div', { class: 'story-controls' },
          el('button', { class: 'btn btn-sm', onclick: () => show(cur + 1) }, '→'),
          dots,
          el('button', { class: 'btn btn-sm', onclick: () => show(cur - 1) }, '←'),
          playBtn)),
      el('div', { class: 'panel' },
        el('div', { class: 'card' },
          el('h3', {}, '🎯 أهداف التعلّم', STEAM.tts.button(exp.objectives.join('. '))),
          el('ul', { class: 'list-check' }, exp.objectives.map((o) => el('li', {}, o)))),
        el('div', { class: 'card' },
          el('h3', {}, '🕹️ ماذا ستفعل في المحاكاة؟'),
          el('ul', {}, exp.ux.map((u) => el('li', {}, u)))),
        el('div', { class: 'card challenge-card' },
          el('h3', {}, '⭐ تحدّي اليوم: ', exp.challenge.title, STEAM.tts.button(exp.challenge.text)),
          el('p', {}, exp.challenge.text)))));
    p.append(nextBtn(1, 'ادخل المختبر ←'));
  })();

  /* ---------- 2) المختبر: المحاكاة + أدوات التحكم + التحدّي ---------- */
  let sim = null;
  (function lab() {
    const p = panels[1];
    if (!def) { p.append(el('div', { class: 'card empty' }, 'المحاكاة غير متوفّرة بعد.')); return; }

    const canvas = el('canvas', { class: 'sim', 'aria-label': `محاكاة ${exp.title}` });
    const hud = el('div', { class: 'hud' });
    const toolbar = el('div', { class: 'stage-toolbar' });
    const chartWrap = el('div', { class: 'chart-box' });
    const stageBox = el('div', { class: 'stage' }, canvas, hud, toolbar, chartWrap);

    const controlsCard = el('div', { class: 'card' }, el('h3', {}, '🎛️ أدوات التحكم'));
    const chStatus = el('div', { class: 'challenge-status' }, 'اضغط «ابدأ التحدّي» عندما تكون مستعداً.');
    const chBar = el('span', { style: 'width:0%' });
    const chStars = el('div', { class: 'stars' }, store.get().badges[exp.id] ? '⭐⭐⭐' : '☆☆☆');
    const chExtra = el('div');
    const chBtn = el('button', { class: 'btn btn-primary', onclick: startChallenge }, '🚀 ابدأ التحدّي');
    const chCard = el('div', { class: 'card challenge-card' },
      el('h3', {}, '⭐ ', exp.challenge.title, STEAM.tts.button(exp.challenge.text)),
      el('p', {}, exp.challenge.text),
      el('div', { class: 'progress' }, chBar), chStatus, chExtra,
      el('div', { style: 'display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap' }, chBtn, chStars));

    p.append(el('div', { class: 'lab' }, stageBox, el('div', { class: 'panel' }, chCard, controlsCard)));

    const stage = new STEAM.Stage(canvas);
    const params = {};
    let chartCanvas = null;
    let attempt = null;
    const sessionStart = Date.now();

    const host = {
      stage, params, level, grade, exp,
      sound: STEAM.sound,
      toast: STEAM.ui.toast,
      challengeActive: () => !!attempt,
      setChallenge(text, ratio) {
        if (text != null) chStatus.textContent = text;
        if (ratio != null) chBar.style.width = Math.round(STEAM.util.clamp(ratio, 0, 1) * 100) + '%';
      },
      setChallengeExtra(node) { chExtra.innerHTML = ''; if (node) chExtra.append(node); },
      challengeResult(success, detail) {
        if (!attempt) return;
        const a = attempt; attempt = null;
        chBtn.disabled = false; chBtn.textContent = '🔁 حاول مرة أخرى';
        renderControls();
        store.addLog({ type: 'challenge', exp: exp.id, success, duration: Date.now() - a.start, settings: snapshot(), detail: detail || '' });
        if (success) {
          const isNew = store.awardBadge(exp.id, 3);
          chStars.textContent = '⭐⭐⭐';
          host.setChallenge('🎉 أحسنت! نجحت في التحدّي وحصلت على وسام «' + exp.title + '»', 1);
          STEAM.sound.success(); STEAM.ui.confetti();
          if (isNew && store.badgeCount() === STEAM.CERT_THRESHOLD) setTimeout(() => { STEAM.ui.toast('🏅 أكملت 5 تجارب! شهادتك جاهزة'); STEAM.ui.certificate(); }, 1500);
        } else {
          host.setChallenge('لم تنجح هذه المرة' + (detail ? ': ' + detail : '') + ' — جرّب إعدادات أخرى!', null);
          STEAM.sound.fail();
        }
      },
      refreshControls: () => renderControls(),
    };

    function snapshot() {
      const s = {};
      for (const [k, v] of Object.entries(params)) if (typeof v !== 'function' && typeof v !== 'object') s[k] = v;
      return Object.assign(s, sim.settings ? sim.settings() : {});
    }

    // تهيئة القيم الافتراضية قبل إنشاء المحاكاة
    const allControls = () => def.controls(level, host);
    for (const c of allControls()) if (c.value !== undefined && params[c.id] === undefined) params[c.id] = c.value;

    sim = def.create(host);
    sim.stage = stage;

    function setParam(id, v) {
      params[id] = v;
      if (sim.onParam) sim.onParam(id, v);
      renderControls();
    }

    function renderControls() {
      controlsCard.querySelectorAll('.control, .hint.locknote').forEach((n) => n.remove());
      let anyLocked = false;
      for (const c of allControls()) {
        if (c.hidden) continue;
        const locked = store.isLocked(exp.id, c.id) || (c.disabledInChallenge && attempt);
        if (store.isLocked(exp.id, c.id)) anyLocked = true;
        const wrap = el('div', { class: 'control' + (locked ? ' locked' : '') });
        const val = params[c.id];
        const showNum = level !== 'simple' && c.type === 'range';
        wrap.append(el('div', { class: 'label-row' }, el('span', {}, c.label),
          showNum ? el('span', { class: 'val' }, (c.format ? c.format(val) : fmt(val, c.decimals || 0)) + (c.unit ? ' ' + c.unit : '')) : null));
        let type = c.type;
        let options = c.options;
        if (type === 'range' && level === 'simple') {
          // الصفوف الدنيا: أزرار بسيطة بدل المنزلقات
          const pr = c.presets || [c.min, (c.min + c.max) / 2, c.max];
          options = pr.map((v, i) => ({ value: v, label: (c.presetLabels || ['قليل', 'متوسط', 'كثير'])[i] }));
          type = 'seg';
        }
        if (type === 'range') {
          wrap.append(el('input', {
            type: 'range', min: c.min, max: c.max, step: c.step || 1, value: val, disabled: locked, 'aria-label': c.label,
            oninput: (e) => {
              params[c.id] = parseFloat(e.target.value);
              if (sim.onParam) sim.onParam(c.id, params[c.id]);
              const vEl = wrap.querySelector('.val');
              if (vEl) vEl.textContent = (c.format ? c.format(params[c.id]) : fmt(params[c.id], c.decimals || 0)) + (c.unit ? ' ' + c.unit : '');
            },
          }));
        } else if (type === 'seg') {
          let near = options[0].value;
          for (const o of options) if (Math.abs(o.value - val) < Math.abs(near - val) || o.value === val) near = o.value;
          wrap.append(el('div', { class: 'seg' }, options.map((o) => el('button', {
            class: o.value === near ? 'on' : '', disabled: locked, onclick: () => { STEAM.sound.click(); setParam(c.id, o.value); },
          }, o.label))));
        } else if (type === 'chips') {
          wrap.append(el('div', { class: 'chips' }, options.map((o) => el('button', {
            class: 'chip' + ((c.multi ? (val || []).includes(o.value) : o.value === val) ? ' on' : ''), disabled: locked, title: o.title || '',
            onclick: () => { STEAM.sound.click(); if (c.onPick) c.onPick(o.value); else setParam(c.id, o.value); renderControls(); },
          }, o.color ? el('span', { class: 'sw', style: `background:${o.color}` }) : null, o.label))));
        } else if (type === 'toggle') {
          wrap.append(el('div', { class: 'seg' },
            el('button', { class: val ? 'on' : '', disabled: locked, onclick: () => setParam(c.id, true) }, c.on || 'نعم'),
            el('button', { class: !val ? 'on' : '', disabled: locked, onclick: () => setParam(c.id, false) }, c.off || 'لا')));
        } else if (type === 'select') {
          const s = el('select', { class: 'input', disabled: locked, onchange: (e) => setParam(c.id, isNaN(+e.target.value) ? e.target.value : +e.target.value) },
            options.map((o) => el('option', { value: o.value, selected: o.value === val }, o.label)));
          wrap.append(s);
        } else if (type === 'info') {
          wrap.append(el('div', { class: 'hint' }, c.text));
        }
        if (c.hint) wrap.append(el('div', { class: 'hint' }, c.hint));
        controlsCard.append(wrap);
      }
      if (anyLocked) controlsCard.append(el('div', { class: 'hint locknote' }, '🔒 بعض الأدوات مقفلة من قِبل المعلّم لهذا الدرس.'));
    }
    renderControls();

    // شريط الأدوات
    function renderToolbar() {
      toolbar.innerHTML = '';
      for (const a of def.actions ? def.actions(level, host) : []) {
        if (a.hidden) continue;
        toolbar.append(el('button', { class: 'btn btn-sm ' + (a.primary ? 'btn-primary' : ''), onclick: () => { STEAM.sound.click(); sim.onAction(a.id); renderToolbar(); } }, a.label));
      }
      toolbar.append(el('button', { class: 'btn btn-sm', onclick: () => { sim.reset(); host.setChallenge(null, 0); } }, '↺ إعادة ضبط'));
      if (def.help) toolbar.append(el('span', { class: 'hint', style: 'margin-inline-start:auto' }, def.help(level)));
    }
    host.refreshToolbar = renderToolbar;
    renderToolbar();

    // الرسم البياني (حسب المستوى)
    const chartTitle = def.chartTitle ? def.chartTitle(level) : null;
    if (chartTitle) {
      chartCanvas = el('canvas');
      chartWrap.append(el('div', { class: 'chart-title' }, '📈 ', chartTitle), chartCanvas);
    } else chartWrap.remove();

    function startChallenge() {
      if (attempt) return;
      attempt = { start: Date.now() };
      chBtn.disabled = true; chBtn.textContent = '⏳ التحدّي جارٍ...';
      host.setChallenge('بدأ التحدّي!', 0);
      STEAM.sound.click();
      if (sim.startChallenge) sim.startChallenge();
      renderControls();
    }
    host.cancelChallenge = () => { attempt = null; chBtn.disabled = false; chBtn.textContent = '🚀 ابدأ التحدّي'; renderControls(); };

    // المؤشّرات
    function renderHud() {
      const items = sim.hud ? sim.hud() : [];
      hud.innerHTML = items.map(([k, v]) => `<div class="hud-item">${STEAM.util.esc(k)}: <b>${STEAM.util.esc(v)}</b></div>`).join('');
    }

    // أحداث المؤشّر (فأرة/لمس)
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); sim.pointerDown && sim.pointerDown(stage.pointer(e)); });
    canvas.addEventListener('pointermove', (e) => sim.pointerMove && sim.pointerMove(stage.pointer(e), e.buttons > 0));
    canvas.addEventListener('pointerup', (e) => sim.pointerUp && sim.pointerUp(stage.pointer(e)));
    canvas.addEventListener('pointercancel', (e) => sim.pointerUp && sim.pointerUp(stage.pointer(e)));

    // الحلقة الرئيسية
    let last = performance.now(), hudT = 0, chartT = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (panels[1].classList.contains('active') && stage.w) {
        sim.step(dt);
        stage.g.clearRect(0, 0, stage.w, stage.h);
        sim.draw(stage.g, stage.w, stage.h);
        hudT += dt; chartT += dt;
        if (hudT > 0.15) { hudT = 0; renderHud(); }
        if (chartCanvas && chartT > 0.25 && sim.drawChart) { chartT = 0; sim.drawChart(chartCanvas); }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.addEventListener('beforeunload', () => {
      store.addLog({ type: 'session', exp: exp.id, duration: Date.now() - sessionStart, settings: snapshot() });
    });

    p.append(nextBtn(2));
  })();

  /* ---------- 3) الاختبار السريع ---------- */
  (function quiz() {
    const p = panels[2];
    const answers = new Array(exp.quiz.length).fill(null);
    const card = el('div', { class: 'card' }, el('h2', {}, '📝 اختبار سريع (3 أسئلة)'));
    const qNodes = exp.quiz.map((q, qi) => {
      const fb = el('div', { class: 'feedback' });
      const opts = q.options.map((o, oi) => el('button', {
        class: 'option', onclick: () => {
          if (submitted) return;
          answers[qi] = oi;
          opts.forEach((b, j) => b.classList.toggle('selected', j === oi));
          STEAM.sound.click();
        },
      }, o));
      return { node: el('div', { class: 'quiz-q' }, el('div', { class: 'q' }, `${fmt(qi + 1)}. ${q.q}`, STEAM.tts.button(q.q + '. ' + q.options.join('، '))), el('div', { class: 'options' }, opts), fb), opts, fb };
    });
    let submitted = false;
    const result = el('div', { class: 'challenge-status' });
    const submit = el('button', {
      class: 'btn btn-primary', onclick: () => {
        if (answers.some((a) => a === null)) { STEAM.ui.toast('أجب عن جميع الأسئلة أولاً'); return; }
        submitted = true;
        let score = 0;
        const wrong = [];
        exp.quiz.forEach((q, qi) => {
          const ok = answers[qi] === q.answer;
          if (ok) score++; else wrong.push(qi + 1);
          qNodes[qi].opts.forEach((b, j) => { b.classList.toggle('correct', j === q.answer); b.classList.toggle('wrong', j === answers[qi] && !ok); });
          qNodes[qi].fb.className = 'feedback ' + (ok ? 'ok' : 'no');
          qNodes[qi].fb.textContent = (ok ? '✔ صحيح! ' : '✘ الإجابة الصحيحة: ' + q.options[q.answer] + ' — ') + q.explain;
        });
        store.setQuiz(exp.id, score, exp.quiz.length);
        store.addLog({ type: 'quiz', exp: exp.id, score, total: exp.quiz.length, wrong });
        result.textContent = `نتيجتك: ${fmt(score)} من ${fmt(exp.quiz.length)}` + (score === exp.quiz.length ? ' 🌟 ممتاز!' : score >= 2 ? ' 👍 جيد جداً' : ' — راجع المقدّمة وجرّب المحاكاة مرة أخرى');
        if (score === exp.quiz.length) STEAM.sound.success(); else STEAM.sound.click();
        submit.hidden = true; retry.hidden = false;
      },
    }, 'تحقّق من إجاباتي');
    const retry = el('button', {
      class: 'btn btn-outline', hidden: true, onclick: () => {
        submitted = false; answers.fill(null);
        qNodes.forEach((q) => { q.opts.forEach((b) => (b.className = 'option')); q.fb.textContent = ''; });
        result.textContent = ''; submit.hidden = false; retry.hidden = true;
      },
    }, 'أعد المحاولة');
    card.append(...qNodes.map((q) => q.node), el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, submit, retry), result);
    p.append(card, nextBtn(3));
  })();

  /* ---------- 4) النشاط المنزلي + الأمان ---------- */
  (function home() {
    const p = panels[3];
    p.append(el('div', { class: 'grid grid-2' },
      el('div', { class: 'card' },
        el('h2', {}, '🏠 جرّبها في البيت أو الصف', STEAM.tts.button(exp.home.steps.join('. '))),
        el('h3', {}, 'الأدوات'),
        el('ul', { class: 'list-check' }, exp.home.materials.map((m) => el('li', {}, m))),
        el('h3', {}, 'الخطوات'),
        el('ol', {}, exp.home.steps.map((s) => el('li', {}, s)))),
      el('div', { class: 'card safety' },
        el('h2', {}, '⚠️ ملاحظات الأمان', STEAM.tts.button(exp.safety.join('. '))),
        el('ul', {}, exp.safety.map((s) => el('li', {}, s))),
        el('p', { class: 'hint' }, 'تُنفَّذ التجربة الحقيقية دائماً بإشراف شخص بالغ.'))));
    p.append(el('div', { style: 'margin-top:20px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap' },
      el('a', { class: 'btn', href: 'index.html' }, 'العودة إلى التجارب'),
      el('button', { class: 'btn btn-primary', onclick: () => go(4) }, 'دليل المعلّم ←')));
  })();

  /* ---------- 5) دليل المعلّم والمطوّر ---------- */
  (function dev() {
    const p = panels[4];
    p.append(el('div', { class: 'grid grid-2' },
      el('div', { class: 'panel' },
        el('div', { class: 'card' },
          el('h3', {}, '🎚️ الباراميترات القابلة للتعديل'),
          el('ul', {}, exp.params.map((x) => el('li', {}, x)))),
        el('div', { class: 'card' },
          el('h3', {}, '🪜 امتدادات صفّية'),
          el('p', {}, el('strong', {}, 'تبسيط: '), exp.extensions.lower),
          el('p', {}, el('strong', {}, 'توسيع: '), exp.extensions.upper)),
        el('div', { class: 'card' },
          el('h3', {}, '🏆 مؤشّرات نجاح التحدّي'),
          el('p', {}, exp.challenge.success))),
      el('div', { class: 'panel' },
        el('div', { class: 'card' },
          el('h3', {}, '🧮 النموذج المبسّط الذي تحسبه المحاكاة'),
          el('pre', {}, exp.model)),
        el('div', { class: 'card' },
          el('h3', {}, '🛠️ تعقيد التطوير والتقنيات'),
          el('p', {}, el('span', { class: 'tag purple' }, `المستوى: ${exp.complexity}`)),
          el('ul', {}, exp.tech.map((t) => el('li', {}, t)))))));
  })();
})();
