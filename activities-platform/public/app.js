// الواجهة العامة للموظفين — تطبيق صفحة واحدة بتوجيه عبر الرابط (#/...).
const $app = document.getElementById('app');
let SETTINGS = null;
let timers = [];

const store = {
  get(key, def = null) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* التخزين غير متاح */ } },
};

// ---------- عناصر مشتركة ----------
const pageHead = (title, sub = '', crumbs = []) => `
  <section class="page-head"><div class="container">
    <div class="crumbs"><a href="#/">الرئيسية</a>${crumbs.map(([t, h]) => ` / ${h ? `<a href="${h}">${esc(t)}</a>` : esc(t)}`).join('')}</div>
    <h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}
  </div></section>`;

const empty = (icon, text) => `<div class="empty"><span class="ico">${icon}</span>${esc(text)}</div>`;

function employeeFields({ jobTitle = true, phone = true, phoneRequired = true, email = false } = {}) {
  const me = store.get('employee', {});
  const deps = (SETTINGS?.departments || []).map((d) => `<option value="${esc(d)}">`).join('');
  return `
    <div class="row">
      <div class="field"><label>الاسم الكامل <span class="req">*</span></label><input class="input" name="name" required maxlength="120" value="${esc(me.name)}"></div>
      <div class="field"><label>الرقم الوظيفي <span class="req">*</span></label><input class="input" name="employeeId" required maxlength="30" inputmode="numeric" value="${esc(me.employeeId)}"></div>
    </div>
    <div class="row">
      ${jobTitle ? `<div class="field"><label>الوصف الوظيفي <span class="req">*</span></label><input class="input" name="jobTitle" required maxlength="160" placeholder="مثال: مهندس شبكات" value="${esc(me.jobTitle)}"></div>` : ''}
      <div class="field"><label>الإدارة / المكتب التابع له <span class="req">*</span></label><input class="input" name="department" required maxlength="160" list="deps" placeholder="اختر أو اكتب اسم الإدارة" value="${esc(me.department)}"><datalist id="deps">${deps}</datalist></div>
      ${!jobTitle && phone ? `<div class="field"><label>رقم الهاتف ${phoneRequired ? '<span class="req">*</span>' : ''}</label><input class="input" name="phone" ${phoneRequired ? 'required' : ''} maxlength="30" inputmode="tel" value="${esc(me.phone)}"></div>` : ''}
    </div>
    ${jobTitle && phone ? `<div class="row">
      <div class="field"><label>رقم الهاتف ${phoneRequired ? '<span class="req">*</span>' : ''}</label><input class="input" name="phone" ${phoneRequired ? 'required' : ''} maxlength="30" inputmode="tel" value="${esc(me.phone)}"></div>
      ${email ? `<div class="field"><label>البريد الإلكتروني</label><input class="input" type="email" name="email" maxlength="160" value="${esc(me.email)}"></div>` : '<div></div>'}
    </div>` : ''}`;
}

function rememberEmployee(d) {
  const keep = ['name', 'employeeId', 'jobTitle', 'department', 'phone', 'email'];
  const prev = store.get('employee', {});
  for (const k of keep) if (d[k]) prev[k] = d[k];
  store.set('employee', prev);
}

function bindForm(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const msg = form.querySelector('.form-msg');
    if (msg) msg.innerHTML = '';
    btn && (btn.disabled = true);
    try {
      await handler(formData(form));
    } catch (err) {
      if (msg) msg.innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
      else toast(err.message, true);
    } finally {
      btn && (btn.disabled = false);
    }
  });
}

function countdown(el, until) {
  const end = parseLocal(until)?.getTime();
  const tick = () => {
    let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    el.innerHTML = [[d, 'يوم'], [h, 'ساعة'], [m, 'دقيقة'], [s, 'ثانية']]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  };
  tick();
  timers.push(setInterval(tick, 1000));
}

const activityCard = (a) => `
  <a class="card" href="#/activity/${a.id}">
    <div class="media ${a.image ? '' : 'placeholder'}" ${a.image ? `style="background-image:url('${esc(a.image)}')"` : ''}>
      ${a.image ? '' : CATEGORY_ICONS[a.category] || '✨'}
      <span class="badge ${a.isOpen ? '' : 'gray'}">${a.isOpen ? 'التسجيل مفتوح' : esc(a.closedReason)}</span>
    </div>
    <div class="body">
      <span class="badge gold" style="align-self:flex-start">${CATEGORY_ICONS[a.category] || ''} ${esc(a.categoryLabel)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc((a.description || '').slice(0, 120))}${(a.description || '').length > 120 ? '…' : ''}</p>
      <div class="meta">
        ${a.startDate ? `<span>📅 ${fmtDate(a.startDate)}</span>` : ''}
        ${a.location ? `<span>📍 ${esc(a.location)}</span>` : ''}
      </div>
      <div class="foot">
        <span class="muted" style="font-size:14px">👥 ${a.registered}${a.capacity ? ` / ${a.capacity}` : ''} مشترك</span>
        ${a.deadline ? `<span class="muted" style="font-size:13px">آخر موعد: ${fmtDate(a.deadline)}</span>` : ''}
      </div>
    </div>
  </a>`;

const POST_ICONS = { announcement: '📢', decision: '📜', news: '📰' };
const postCard = (p) => `
  <a class="card" href="#/news/${p.id}">
    <div class="media ${p.image ? '' : 'placeholder'}" ${p.image ? `style="background-image:url('${esc(p.image)}')"` : ''}>
      ${p.image ? '' : POST_ICONS[p.type]}
      <span class="badge ${p.type === 'decision' ? 'gold' : p.type === 'announcement' ? 'blue' : ''}">${POST_ICONS[p.type]} ${esc(SETTINGS.postTypes[p.type])}</span>
    </div>
    <div class="body">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
      <div class="foot"><span class="muted" style="font-size:13px">📅 ${fmtDate(p.publishedAt)}</span><span>اقرأ المزيد ←</span></div>
    </div>
  </a>`;

const avatar = (photo, name, cls = '') => (photo
  ? `<div class="avatar ${cls}" style="background-image:url('${esc(photo)}')"></div>`
  : `<div class="avatar ${cls}">${esc((name || '؟').trim().charAt(0))}</div>`);

// ---------- الصفحات ----------
async function pageHome() {
  const d = await api('/api/home');
  const s = d.settings;
  $app.innerHTML = `
    <section class="hero"><div class="container inner">
      <div>
        <span class="badge gold">${esc(s.companyName)}</span>
        <h1 style="margin-top:12px">منصة <em>${esc(s.committeeName)}</em><br>بوابتك للمشاركة والتميّز</h1>
        <p>${esc(s.tagline)}</p>
        <div class="actions">
          <a class="btn gold" href="#/activities">سجّل في نشاط الآن</a>
          <a class="btn outline-light" href="#/quiz">🎁 المسابقة الأسبوعية</a>
        </div>
      </div>
      <div class="logo-card"><img src="/assets/logo-full.png" alt="شعار لجنة الأنشطة"></div>
    </div></section>

    <div class="container stats">
      <div class="stat"><b>${d.stats.activities}</b><span>نشاط</span></div>
      <div class="stat"><b>${d.stats.participants}</b><span>موظف مشارك</span></div>
      <div class="stat"><b>${d.stats.votes}</b><span>صوت في الاستطلاعات</span></div>
      <div class="stat"><b>${d.stats.members}</b><span>عضو في اللجنة</span></div>
    </div>

    ${d.ads.length ? `<section class="section container">
      <div class="ads" id="ads">
        ${d.ads.map((p, i) => `
          <div class="ad-slide ${i === 0 ? 'active' : ''}">
            <div class="txt">
              <span class="badge gold" style="align-self:flex-start">${POST_ICONS[p.type]} ${esc(s.postTypes[p.type])}</span>
              <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p>
              <div><a class="btn light small" href="#/news/${p.id}">التفاصيل</a></div>
            </div>
            <div class="img" style="background-image:url('${esc(p.image || '/assets/banner.webp')}')"></div>
          </div>`).join('')}
        ${d.ads.length > 1 ? `<div class="ad-dots">${d.ads.map((_, i) => `<button data-i="${i}" class="${i === 0 ? 'active' : ''}" aria-label="إعلان ${i + 1}"></button>`).join('')}</div>` : ''}
      </div>
    </section>` : ''}

    <section class="section container">
      <div class="quick">
        <a href="#/activities"><span class="ico">🏆</span>الأنشطة</a>
        <a href="#/quiz"><span class="ico">🎁</span>المسابقة الأسبوعية</a>
        <a href="#/polls"><span class="ico">🗳️</span>التصويت</a>
        <a href="#/star"><span class="ico">⭐</span>نجم الأسبوع</a>
        <a href="#/card"><span class="ico">🪪</span>بطاقة المشاركة</a>
        <a href="#/committee"><span class="ico">👥</span>أعضاء اللجنة</a>
        <a href="#/docs/charter"><span class="ico">📜</span>الميثاق واللائحة</a>
        <a href="#/complaints"><span class="ico">💬</span>الشكاوى والمقترحات</a>
      </div>
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>أنشطة مفتوحة للتسجيل</h2><p>رياضية، ثقافية، فنية، تطوعية واجتماعية</p></div><a class="btn ghost small" href="#/activities">كل الأنشطة</a></div>
      ${d.activities.length ? `<div class="grid cols-3">${d.activities.map(activityCard).join('')}</div>` : empty('📭', 'لا توجد أنشطة مفتوحة حالياً، تابعنا قريباً')}
    </section>

    <section class="section container">
      <div class="grid cols-2">
        <div class="panel">
          <h3>🎁 المسابقة الأسبوعية</h3>
          ${d.quiz ? `<p><b>${esc(d.quiz.title)}</b></p>
            <div class="prize"><span class="ico">📱</span><div><b>الجائزة</b><br>${esc(d.quiz.prize)}</div></div>
            <p class="muted mt">تنتهي المسابقة خلال:</p><div class="countdown" id="homeCountdown"></div>
            <a class="btn gold mt" href="#/quiz">شارك الآن</a>`
    : `<p class="muted">لا توجد مسابقة جارية الآن. تُطرح مسابقة جديدة كل أسبوع بجوائز رصيد — زرنا باستمرار!</p><a class="btn ghost" href="#/quiz">نتائج المسابقات السابقة</a>`}
        </div>
        <div class="panel">
          <h3>🗳️ صوتك يصنع القرار</h3>
          ${d.polls.length ? d.polls.map((p) => `<div class="flex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0"><div><b>${esc(p.title)}</b><br><small class="muted">ينتهي ${fmtDateTime(p.endsAt)}</small></div><a class="btn small" href="#/polls">صوّت</a></div>`).join('')
    : '<p class="muted">لا توجد استطلاعات مفتوحة حالياً.</p>'}
          <a class="btn ghost mt" href="#/polls">كل الاستطلاعات</a>
        </div>
      </div>
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>⭐ نجم الأسبوع</h2><p>نحتفي بالموظفين المبادرين بالأفكار والبرامج والأنشطة</p></div><a class="btn ghost small" href="#/star">شاركنا فكرتك</a></div>
      ${d.star ? starCard(d.star) : `<div class="panel center"><p class="muted">سيتم الإعلان عن نجم الأسبوع قريباً. هل لديك فكرة أو برنامج مميز؟</p><a class="btn gold" href="#/star">قدّم فكرتك وكن نجم الأسبوع</a></div>`}
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>الأخبار والقرارات</h2><p>آخر مستجدات اللجنة</p></div><a class="btn ghost small" href="#/news">كل الأخبار</a></div>
      ${d.latest.length ? `<div class="grid cols-3">${d.latest.slice(0, 3).map(postCard).join('')}</div>` : empty('📰', 'لا توجد أخبار بعد')}
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>من أنشطتنا</h2></div></div>
      <div class="gallery">
        <div style="background-image:url('/assets/team-veterans.webp')"></div>
        <div style="background-image:url('/assets/team-futsal.webp')"></div>
        <div style="background-image:url('/assets/volleyball-champions.webp')"></div>
      </div>
    </section>

    <section class="section container">
      <div class="panel center">
        <h3>تابعوا لجنة الأنشطة على منصات التواصل</h3>
        <div class="social on-light" style="justify-content:center">${socialLinks(s.social)}</div>
      </div>
    </section>`;

  if (d.quiz) countdown(document.getElementById('homeCountdown'), d.quiz.endsAt);
  const ads = document.getElementById('ads');
  if (ads && d.ads.length > 1) {
    const slides = ads.querySelectorAll('.ad-slide');
    const dots = ads.querySelectorAll('.ad-dots button');
    let i = 0;
    const show = (n) => {
      i = n % slides.length;
      slides.forEach((el, k) => el.classList.toggle('active', k === i));
      dots.forEach((el, k) => el.classList.toggle('active', k === i));
    };
    dots.forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.i))));
    timers.push(setInterval(() => show(i + 1), 6000));
  }
}

const starCard = (s) => `
  <div class="star-card">
    ${avatar(s.photo, s.name)}
    <div style="position:relative">
      <div class="label">⭐ نجم الأسبوع — ${fmtDate(s.weekOf)}</div>
      <h2>${esc(s.name)}</h2>
      <div style="opacity:.9">${esc([s.jobTitle, s.department].filter(Boolean).join(' — '))}</div>
      ${s.reason ? `<h3 style="margin-top:14px;color:#ffe39a">${esc(s.reason)}</h3>` : ''}
      ${s.achievements ? `<p>${esc(s.achievements)}</p>` : ''}
    </div>
  </div>`;

async function pageActivities(params) {
  const cat = params.get('category') || '';
  const list = await api(`/api/activities${cat ? `?category=${encodeURIComponent(cat)}` : ''}`);
  $app.innerHTML = `${pageHead('الأنشطة', 'اختر النشاط المناسب لك وسجّل بياناتك للمشاركة')}
    <section class="section container">
      <div class="chips">
        <a class="chip ${cat ? '' : 'active'}" href="#/activities">الكل</a>
        ${Object.entries(SETTINGS.categories).map(([k, v]) => `<a class="chip ${cat === k ? 'active' : ''}" href="#/activities?category=${k}">${CATEGORY_ICONS[k]} ${esc(v)}</a>`).join('')}
      </div>
      ${list.length ? `<div class="grid cols-3">${list.map(activityCard).join('')}</div>` : empty('📭', 'لا توجد أنشطة في هذا التصنيف حالياً')}
    </section>`;
}

async function pageActivity(id) {
  const a = await api(`/api/activities/${id}`);
  $app.innerHTML = `${pageHead(a.title, `${CATEGORY_ICONS[a.category]} نشاط ${a.categoryLabel}`, [['الأنشطة', '#/activities'], [a.title]])}
    <section class="section container layout-2">
      <div class="panel">
        ${a.image ? `<img src="${esc(a.image)}" alt="" style="border-radius:12px;margin-bottom:16px;width:100%;max-height:340px;object-fit:cover">` : ''}
        <div class="meta" style="margin-bottom:12px">
          ${a.startDate ? `<span>📅 ${fmtDate(a.startDate)}${a.endDate && a.endDate !== a.startDate ? ` — ${fmtDate(a.endDate)}` : ''}</span>` : ''}
          ${a.location ? `<span>📍 ${esc(a.location)}</span>` : ''}
          ${a.deadline ? `<span>⏰ آخر موعد للتسجيل: ${fmtDate(a.deadline)}</span>` : ''}
          <span>👥 ${a.registered}${a.capacity ? ` / ${a.capacity}` : ''} مشترك</span>
        </div>
        <p class="post-body">${esc(a.description)}</p>
        ${a.requiresApproval ? '<div class="alert info">يخضع التسجيل في هذا النشاط لمراجعة اللجنة وفق المادة (10) من الميثاق، وستصدر بطاقة المشاركة بعد القبول.</div>' : ''}
      </div>
      <div class="panel" id="regPanel">
        <h3>📝 نموذج التسجيل</h3>
        ${a.isOpen ? `<form class="form" id="regForm">
          ${employeeFields({ email: true })}
          <div class="field"><label>نوع العقد</label><select class="input" name="contractType"><option value="">— اختر —</option>${SETTINGS.contractTypes.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>الخبرة السابقة</label><textarea class="input" name="experience" maxlength="1000" placeholder="مثال: لاعب سابق في نادي...، مشاركات سابقة مع فريق الشركة"></textarea></div>
          <div class="field"><label>ملاحظات أو اعتبارات خاصة</label><textarea class="input" name="notes" maxlength="1000" style="min-height:70px"></textarea></div>
          <label class="check"><input type="checkbox" name="pledge" required><span>أُقر بصحة البيانات وأتعهد بالالتزام ببنود <a href="#/docs/charter" target="_blank">الميثاق الرياضي الاجتماعي الثقافي</a> وتعليمات اللجنة.</span></label>
          <div class="form-msg"></div>
          <button class="btn" type="submit">إرسال طلب التسجيل</button>
        </form>` : `<div class="alert err">${esc(a.closedReason || 'التسجيل غير متاح')}</div>`}
      </div>
    </section>`;
  const form = document.getElementById('regForm');
  if (form) {
    bindForm(form, async (data) => {
      const r = await api(`/api/activities/${id}/register`, { method: 'POST', body: data });
      rememberEmployee(data);
      document.getElementById('regPanel').innerHTML = r.status === 'approved'
        ? `<div class="center"><div style="font-size:64px">🎉</div><h3>تم تسجيلك بنجاح!</h3><p class="muted">بطاقة مشاركتك جاهزة.</p><a class="btn gold" href="#/card/${esc(r.cardCode)}">عرض بطاقة المشاركة</a></div>`
        : `<div class="center"><div style="font-size:64px">✅</div><h3>تم استلام طلبك</h3><p class="muted">طلبك قيد المراجعة من اللجنة. يمكنك متابعة حالته وإصدار بطاقتك بعد القبول من صفحة «بطاقة المشاركة».</p><a class="btn" href="#/card">متابعة الطلب</a></div>`;
    });
  }
}

async function pageNews(params) {
  const type = params.get('type') || '';
  const list = await api(`/api/posts${type ? `?type=${type}` : ''}`);
  $app.innerHTML = `${pageHead('الأخبار والإعلانات والقرارات', 'كل ما يصدر عن لجنة الأنشطة')}
    <section class="section container">
      <div class="chips">
        <a class="chip ${type ? '' : 'active'}" href="#/news">الكل</a>
        ${Object.entries(SETTINGS.postTypes).map(([k, v]) => `<a class="chip ${type === k ? 'active' : ''}" href="#/news?type=${k}">${POST_ICONS[k]} ${esc(v)}ات</a>`).join('')}
      </div>
      ${list.length ? `<div class="grid cols-3">${list.map(postCard).join('')}</div>` : empty('📰', 'لا توجد منشورات')}
    </section>`;
}

async function pagePost(id) {
  const p = await api(`/api/posts/${id}`);
  $app.innerHTML = `${pageHead(p.title, `${SETTINGS.postTypes[p.type]} — ${fmtDate(p.publishedAt)}`, [['الأخبار', '#/news'], [p.title]])}
    <section class="section container" style="max-width:860px">
      <article class="panel">
        ${p.image ? `<img src="${esc(p.image)}" alt="" style="border-radius:12px;margin-bottom:18px;width:100%">` : ''}
        ${p.summary ? `<p style="font-size:19px;font-weight:700;color:var(--green-800)">${esc(p.summary)}</p>` : ''}
        <div class="post-body">${esc(p.body)}</div>
      </article>
    </section>`;
}

async function pageQuiz() {
  const d = await api('/api/quiz');
  const q = d.current;
  const done = q ? store.get(`quiz:${q.id}`) : null;
  $app.innerHTML = `${pageHead('المسابقة الأسبوعية', 'أجب، شارك، واربح هدايا رصيد كل أسبوع!')}
    <section class="section container layout-2">
      <div>
        ${q ? `<div class="panel">
          <h2>${esc(q.title)}</h2>
          <p class="muted">${esc(q.description)}</p>
          <div class="prize"><span class="ico">🎁</span><div><b>الجائزة</b><br>${esc(q.prize)} — يُسحب على ${q.winnersCount} فائز من أصحاب أعلى الدرجات</div></div>
          <div class="flex mt"><span class="muted">الوقت المتبقي:</span><div class="countdown" id="qCountdown"></div></div>
          <p class="muted" style="font-size:14px">👥 ${q.participants} مشارك حتى الآن</p>
        </div>
        <div class="panel" id="quizPanel">
          ${done ? quizResult(done) : `<form class="form" id="quizForm">
            ${q.questions.map((x, i) => `<div class="question"><h4><span class="num">${i + 1}</span>${esc(x.text)}</h4>
              <div class="options">${x.options.map((o, k) => `<label class="option"><input type="radio" name="q${i}" value="${k}" required> ${esc(o)}</label>`).join('')}</div></div>`).join('')}
            <h3 style="margin:8px 0 0">بياناتك لاستلام الجائزة</h3>
            ${employeeFields({ jobTitle: false })}
            <small class="muted">مشاركة واحدة لكل رقم وظيفي. يُستخدم رقم الهاتف لتحويل الرصيد للفائزين فقط.</small>
            <div class="form-msg"></div>
            <button class="btn gold" type="submit">إرسال الإجابات</button>
          </form>`}
        </div>` : `<div class="panel center">
          <div style="font-size:64px">⏳</div>
          <h3>لا توجد مسابقة جارية حالياً</h3>
          ${d.upcoming ? `<p>المسابقة القادمة: <b>${esc(d.upcoming.title)}</b><br>تبدأ ${fmtDateTime(d.upcoming.startsAt)}</p><div class="countdown" id="upCountdown" style="justify-content:center"></div>` : '<p class="muted">ترقبوا المسابقة القادمة قريباً!</p>'}
        </div>`}
      </div>
      <div>
        <div class="panel">
          <h3>🏆 الفائزون في المسابقات السابقة</h3>
          ${d.past.length ? d.past.map((p) => `
            <details class="more" open>
              <summary>${esc(p.title)} <small class="muted">(${fmtDate(p.endsAt.slice(0, 10))})</small></summary>
              ${p.winners.length ? `<ul>${p.winners.map((w) => `<li><b>${esc(w.name)}</b> — ${esc(w.department)}</li>`).join('')}</ul>` : '<p class="muted">سيتم الإعلان عن الفائزين قريباً.</p>'}
              <details class="more"><summary>الإجابات الصحيحة</summary>
                <ol>${p.questions.map((x) => `<li>${esc(x.text)}<br><b style="color:var(--green-700)">✔ ${esc(x.options[x.correct])}</b></li>`).join('')}</ol>
              </details>
            </details>`).join('') : '<p class="muted">لا توجد نتائج سابقة بعد.</p>'}
        </div>
        <div class="panel">
          <h3>📌 كيف تشارك؟</h3>
          <ol class="muted">
            <li>أجب عن جميع أسئلة المسابقة قبل انتهاء الوقت.</li>
            <li>أدخل اسمك ورقمك الوظيفي ورقم هاتفك.</li>
            <li>بعد انتهاء المسابقة تسحب اللجنة على الفائزين من أصحاب أعلى الدرجات.</li>
            <li>يُحوَّل الرصيد إلى رقم هاتف الفائز وتُعلن الأسماء هنا.</li>
          </ol>
        </div>
      </div>
    </section>`;
  if (q) countdown(document.getElementById('qCountdown'), q.endsAt);
  if (!q && d.upcoming) countdown(document.getElementById('upCountdown'), d.upcoming.startsAt);
  const form = document.getElementById('quizForm');
  if (form) {
    bindForm(form, async (data) => {
      const answers = q.questions.map((_, i) => Number(data[`q${i}`]));
      const r = await api(`/api/quiz/${q.id}/submit`, { method: 'POST', body: { ...data, answers } });
      rememberEmployee(data);
      store.set(`quiz:${q.id}`, r);
      document.getElementById('quizPanel').innerHTML = quizResult(r);
    });
  }
}

const quizResult = (r) => `<div class="center">
  <div style="font-size:64px">${r.score === r.total ? '🏆' : '👏'}</div>
  <h3>شكراً لمشاركتك!</h3>
  <p>نتيجتك: <b style="font-size:24px;color:var(--green-700)">${r.score} / ${r.total}</b></p>
  <p class="muted">سيتم السحب على الفائزين بعد انتهاء المسابقة، وتُعلن النتائج والإجابات الصحيحة في هذه الصفحة.</p>
</div>`;

async function pagePolls() {
  const list = await api('/api/polls');
  $app.innerHTML = `${pageHead('التصويت على المشاريع والبرامج', 'شارك برأيك في خطط وبرامج لجنة الأنشطة — صوت واحد لكل موظف')}
    <section class="section container" style="max-width:900px" id="polls">
      ${list.length ? list.map(pollPanel).join('') : empty('🗳️', 'لا توجد استطلاعات حالياً')}
    </section>`;
  document.querySelectorAll('form[data-poll]').forEach((form) => {
    const id = form.dataset.poll;
    bindForm(form, async (data) => {
      const p = await api(`/api/polls/${id}/vote`, { method: 'POST', body: data });
      rememberEmployee(data);
      store.set(`poll:${id}`, data.optionId);
      form.closest('.panel').outerHTML = pollPanel(p);
      toast('تم تسجيل صوتك، شكراً لمشاركتك');
    });
  });
}

function pollPanel(p) {
  const voted = store.get(`poll:${p.id}`);
  const results = p.results ? `<div>${p.options.map((o) => {
    const n = p.results[o.id] || 0;
    const pct = p.totalVotes ? Math.round((n / p.totalVotes) * 100) : 0;
    return `<div class="bar-row"><div class="lbl"><span>${esc(o.label)} ${voted === o.id ? '<span class="badge">صوتك</span>' : ''}</span><b>${pct}% <small class="muted">(${n})</small></b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('')}</div>` : `<p class="muted">🔒 ${p.resultsVisibility === 'admin' ? 'النتائج متاحة للجنة فقط.' : 'تُعلن النتائج بعد إغلاق التصويت.'}</p>`;
  return `<div class="panel">
    <div class="flex" style="justify-content:space-between"><h3 style="margin:0">${esc(p.title)}</h3>${statusBadge(p.status)}</div>
    ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
    <p class="muted" style="font-size:14px">🗳️ ${p.totalVotes} صوت · ${p.status === 'active' ? `ينتهي ${fmtDateTime(p.endsAt)}` : `انتهى ${fmtDateTime(p.endsAt)}`}</p>
    ${p.status === 'active' && !voted ? `<form class="form" data-poll="${p.id}">
      <div class="options">${p.options.map((o) => `<label class="option"><input type="radio" name="optionId" value="${esc(o.id)}" required> ${esc(o.label)}</label>`).join('')}</div>
      ${employeeFields({ jobTitle: false, phone: false })}
      <div class="form-msg"></div>
      <button class="btn" type="submit">تأكيد التصويت</button>
    </form>${p.results ? `<details class="more"><summary>النتائج الحالية</summary>${results}</details>` : ''}` : results}
  </div>`;
}

async function pageCommittee() {
  const members = await api('/api/members');
  $app.innerHTML = `${pageHead('أعضاء لجنة الأنشطة', 'تعرّف على أعضاء اللجنة ومهامهم وفق المادة (13) من اللائحة التنظيمية')}
    <section class="section container">
      ${members.length ? `<div class="grid cols-3">${members.map((m) => `
        <div class="card member">
          ${avatar(m.photo, m.name)}
          <div class="pos">${esc(m.position)}</div>
          <h3>${esc(m.name)}</h3>
          <p class="muted">${esc([m.jobTitle, m.department].filter(Boolean).join(' — '))}</p>
          ${m.email ? `<p><a href="mailto:${esc(m.email)}">✉️ ${esc(m.email)}</a></p>` : ''}
          ${m.tasks ? `<details class="more" open><summary>المهام</summary><ul>${m.tasks.split('\n').filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
          ${m.bio ? `<details class="more"><summary>السيرة الذاتية</summary><p class="post-body" style="font-size:15px">${esc(m.bio)}</p></details>` : ''}
        </div>`).join('')}</div>` : empty('👥', 'لم تتم إضافة الأعضاء بعد')}
      <div class="panel mt center">
        <p>تُدار اللجنة بعدد من الأعضاء لا يقل عن 7 ولا يزيد عن 9 يُسمَّون بقرار من المدير العام، وتكون مدة عملها سنتين قابلة للتمديد مرة واحدة.</p>
        <a class="btn ghost" href="#/docs/bylaws">اقرأ اللائحة التنظيمية</a>
      </div>
    </section>`;
}

async function pageStar() {
  const stars = await api('/api/stars');
  const [current, ...archive] = stars;
  $app.innerHTML = `${pageHead('نجم الأسبوع', 'مساحة للاحتفاء بالموظفين المبادرين بالأفكار والبرامج والأنشطة المتنوعة')}
    <section class="section container">
      ${current ? starCard(current) : `<div class="panel center"><div style="font-size:64px">⭐</div><h3>لم يُعلن نجم الأسبوع بعد</h3><p class="muted">قدّم فكرتك أو برنامجك وقد تكون النجم القادم!</p></div>`}
    </section>
    <section class="section container layout-2">
      <div class="panel" id="ideaPanel">
        <h3>💡 شاركنا فكرتك أو برنامجك</h3>
        <p class="muted">تراجع اللجنة الأفكار المقدّمة أسبوعياً، ويُكرَّم صاحب الفكرة أو المبادرة المميزة كنجم للأسبوع.</p>
        <form class="form" id="ideaForm">
          ${employeeFields({ phoneRequired: false })}
          <div class="row">
            <div class="field"><label>عنوان الفكرة / البرنامج <span class="req">*</span></label><input class="input" name="title" required maxlength="200"></div>
            <div class="field"><label>المجال</label><select class="input" name="category">${Object.entries(SETTINGS.categories).map(([k, v]) => `<option value="${k}">${CATEGORY_ICONS[k]} ${esc(v)}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>وصف الفكرة <span class="req">*</span></label><textarea class="input" name="description" required maxlength="5000" placeholder="ما الفكرة؟ ما أهدافها؟ كيف يمكن تنفيذها؟"></textarea></div>
          <div class="form-msg"></div>
          <button class="btn gold" type="submit">إرسال الفكرة</button>
        </form>
      </div>
      <div class="panel">
        <h3>🌟 نجوم الأسابيع السابقة</h3>
        ${archive.length ? archive.map((s) => `<div class="flex" style="border-bottom:1px solid var(--line);padding:10px 0">
          ${avatar(s.photo, s.name, 'sm')}
          <div><b>${esc(s.name)}</b><br><small class="muted">${esc(s.reason || s.department)} · ${fmtDate(s.weekOf)}</small></div></div>`).join('') : '<p class="muted">لا يوجد أرشيف بعد.</p>'}
      </div>
    </section>`;
  bindForm(document.getElementById('ideaForm'), async (data) => {
    await api('/api/ideas', { method: 'POST', body: data });
    rememberEmployee(data);
    document.getElementById('ideaPanel').innerHTML = '<div class="center"><div style="font-size:64px">💡</div><h3>شكراً لمبادرتك!</h3><p class="muted">وصلت فكرتك إلى اللجنة وستتم مراجعتها.</p></div>';
  });
}

async function pageCardLookup() {
  const me = store.get('employee', {});
  $app.innerHTML = `${pageHead('بطاقة المشاركة', 'تابع طلبات تسجيلك وأصدر بطاقة المشاركة في النشاط')}
    <section class="section container" style="max-width:900px">
      <div class="panel">
        <form class="form" id="lookupForm">
          <div class="row" style="align-items:end">
            <div class="field"><label>الرقم الوظيفي</label><input class="input" name="employeeId" required value="${esc(me.employeeId)}" inputmode="numeric"></div>
            <div><button class="btn" type="submit">عرض طلباتي</button></div>
          </div>
          <div class="form-msg"></div>
        </form>
      </div>
      <div id="lookupResult"></div>
    </section>`;
  const form = document.getElementById('lookupForm');
  const run = async (data) => {
    const list = await api(`/api/my/registrations?employeeId=${encodeURIComponent(data.employeeId)}`);
    document.getElementById('lookupResult').innerHTML = `<div class="panel mt">${list.length ? `
      <div class="table-wrap"><table class="list"><thead><tr><th>النشاط</th><th>تاريخ الطلب</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${list.map((r) => `<tr><td>${CATEGORY_ICONS[r.category] || ''} ${esc(r.activityTitle)}</td><td>${fmtDate(r.createdAt.slice(0, 10))}</td>
        <td>${statusBadge(r.status)}${r.reviewNote ? `<br><small class="muted">السبب: ${esc(r.reviewNote)}</small>` : ''}</td>
        <td>${r.cardCode ? `<a class="btn small gold" href="#/card/${esc(r.cardCode)}">🪪 إصدار البطاقة</a>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('🔍', 'لا توجد طلبات مسجلة بهذا الرقم الوظيفي')}</div>`;
  };
  bindForm(form, run);
  if (me.employeeId) run({ employeeId: me.employeeId }).catch(() => {});
}

function cardHtml(c) {
  return `<div class="pcard">
    <img class="wm" src="/assets/emblem.png" alt="">
    <div class="top">
      <div><b>بطاقة مشاركة</b><small>${esc(SETTINGS.committeeName)} — ${esc(SETTINGS.companyName)}</small></div>
      <img src="/assets/logo-full.png" alt="">
    </div>
    <div class="mid">
      <div class="who">
        <h3>${esc(c.name)}</h3>
        <p>الرقم الوظيفي: <b>${esc(c.employeeId)}</b></p>
        <p>${esc(c.jobTitle)}${c.department ? ` — ${esc(c.department)}` : ''}</p>
        <span class="act">${CATEGORY_ICONS[c.activity.category] || ''} ${esc(c.activity.title)}</span>
        ${c.activity.startDate ? `<p style="margin-top:6px">📅 ${fmtDate(c.activity.startDate)}${c.activity.endDate && c.activity.endDate !== c.activity.startDate ? ` — ${fmtDate(c.activity.endDate)}` : ''}${c.activity.location ? ` · 📍 ${esc(c.activity.location)}` : ''}</p>` : ''}
      </div>
      <div class="qr"><img src="/api/cards/${esc(c.code)}/qr.svg" alt="رمز التحقق"></div>
    </div>
    <div class="bottom"><span>رقم البطاقة: <b>${esc(c.cardNo)}</b></span><span>رمز التحقق: <b>${esc(c.code)}</b></span></div>
  </div>`;
}

async function pageCard(code) {
  const c = await api(`/api/cards/${encodeURIComponent(code)}`);
  $app.innerHTML = `${pageHead('بطاقة المشاركة', c.activity.title, [['بطاقة المشاركة', '#/card'], [c.name]])}
    <section class="section container print-area">
      ${cardHtml(c)}
      <div class="flex no-print" style="justify-content:center;margin-top:24px">
        <button class="btn gold" id="printCard">🖨️ طباعة / حفظ PDF</button>
        <a class="btn ghost" href="#/verify/${esc(c.code)}">التحقق من البطاقة</a>
      </div>
      <p class="muted center no-print" style="font-size:14px">يمكن مسح رمز QR للتحقق من صحة البطاقة. لحفظها كملف PDF اختر «حفظ كـ PDF» من نافذة الطباعة.</p>
    </section>`;
  document.getElementById('printCard').addEventListener('click', () => {
    document.body.classList.add('print-card');
    window.print();
  });
}

async function pageVerify(code) {
  let c = null;
  try { c = await api(`/api/cards/${encodeURIComponent(code)}`); } catch { /* بطاقة غير صالحة */ }
  $app.innerHTML = `${pageHead('التحقق من بطاقة المشاركة')}
    <section class="section container" style="max-width:640px">
      <div class="panel center">
        ${c ? `<div style="font-size:64px">✅</div><h2 style="color:var(--green-700)">بطاقة سارية المفعول</h2>
          <table class="list" style="text-align:start"><tbody>
            <tr><th>الاسم</th><td>${esc(c.name)}</td></tr>
            <tr><th>الرقم الوظيفي</th><td>${esc(c.employeeId)}</td></tr>
            <tr><th>الإدارة / المكتب</th><td>${esc(c.department)}</td></tr>
            <tr><th>النشاط</th><td>${esc(c.activity.title)}</td></tr>
            <tr><th>رقم البطاقة</th><td>${esc(c.cardNo)}</td></tr>
            <tr><th>تاريخ الإصدار</th><td>${fmtDate((c.issuedAt || '').slice(0, 10))}</td></tr>
          </tbody></table>`
    : `<div style="font-size:64px">❌</div><h2 style="color:var(--danger)">بطاقة غير صالحة</h2><p class="muted">لم يتم العثور على بطاقة سارية بهذا الرمز، أو تم إلغاؤها.</p>`}
      </div>
    </section>`;
}

async function pageDocs(slug) {
  const doc = await api(`/api/docs/${slug}`);
  const other = slug === 'charter' ? ['bylaws', 'اللائحة التنظيمية'] : ['charter', 'الميثاق الرياضي'];
  $app.innerHTML = `${pageHead(doc.title, doc.subtitle, [['الوثائق'], [doc.title]])}
    <section class="section container">
      <div class="flex no-print" style="margin-bottom:16px">
        <div class="chips" style="margin:0">
          <a class="chip ${slug === 'charter' ? 'active' : ''}" href="#/docs/charter">📜 الميثاق الرياضي الاجتماعي الثقافي</a>
          <a class="chip ${slug === 'bylaws' ? 'active' : ''}" href="#/docs/bylaws">📘 اللائحة التنظيمية</a>
        </div>
        <span class="spacer"></span>
        <button class="btn small" id="printDoc">🖨️ طباعة</button>
        <button class="btn small gold" id="pdfDoc">📄 تصدير PDF</button>
        <a class="btn small ghost" href="${esc(doc.pdf)}" download>⬇️ النسخة الأصلية (PDF)</a>
      </div>
      <div class="doc-wrap">
        <aside class="panel doc-toc">
          <input class="input" id="docSearch" placeholder="🔍 ابحث في النص…" style="margin-bottom:10px">
          <div id="searchInfo" class="muted" style="font-size:13px"></div>
          ${doc.toc.map((t) => `<a href="#" data-target="${t.id}">${esc(t.title)}</a>`).join('')}
          <a href="#/docs/${other[0]}" style="margin-top:10px;font-weight:700">← ${esc(other[1])}</a>
        </aside>
        <article class="panel doc">
          <div class="doc-title">
            <img src="/assets/logo-full.png" alt="">
            <p>${esc(SETTINGS.companyName)} — ${esc(SETTINGS.committeeName)}</p>
            <p>${esc(doc.subtitle)}</p>
            <h1>${esc(doc.title)}</h1>
          </div>
          <div id="docBody">${doc.html}</div>
        </article>
      </div>
    </section>`;
  const body = document.getElementById('docBody');
  const original = body.innerHTML;
  document.querySelectorAll('.doc-toc a[data-target]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
  }));
  const doPrint = () => { document.body.classList.remove('print-card'); window.print(); };
  document.getElementById('printDoc').addEventListener('click', doPrint);
  document.getElementById('pdfDoc').addEventListener('click', () => {
    toast('اختر «حفظ كـ PDF» من نافذة الطباعة لتصدير الوثيقة');
    setTimeout(doPrint, 600);
  });
  let t;
  document.getElementById('docSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      body.innerHTML = original;
      const q = e.target.value.trim();
      const info = document.getElementById('searchInfo');
      if (q.length < 2) { info.textContent = ''; return; }
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (walker.currentNode.nodeValue.includes(q)) nodes.push(walker.currentNode);
      let count = 0;
      for (const node of nodes) {
        const parts = node.nodeValue.split(q);
        const frag = document.createDocumentFragment();
        parts.forEach((part, i) => {
          frag.appendChild(document.createTextNode(part));
          if (i < parts.length - 1) { const m = document.createElement('mark'); m.textContent = q; frag.appendChild(m); count += 1; }
        });
        node.parentNode.replaceChild(frag, node);
      }
      info.textContent = count ? `${count} نتيجة` : 'لا توجد نتائج';
      body.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
}

async function pageComplaints() {
  const s = SETTINGS;
  $app.innerHTML = `${pageHead('الشكاوى وحل المشاكل', 'نستقبل شكاواك ومقترحاتك ونتابعها حتى الحل')}
    <section class="section container layout-2">
      <div class="panel" id="cPanel">
        <h3>📨 تقديم شكوى أو مقترح</h3>
        <form class="form" id="cForm">
          <div class="field"><label>نوع الطلب</label>
            <div class="chips" style="margin:0">${Object.entries(s.complaintTypes).map(([k, v], i) => `<label class="option" style="padding:6px 14px"><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>
          </div>
          ${employeeFields({ jobTitle: false, phoneRequired: false })}
          <div class="field"><label>البريد الإلكتروني</label><input class="input" type="email" name="email" maxlength="160" placeholder="للرد عليك (اختياري إذا أدخلت الهاتف)"></div>
          <div class="field"><label>الموضوع <span class="req">*</span></label><input class="input" name="subject" required maxlength="200"></div>
          <div class="field"><label>التفاصيل <span class="req">*</span></label><textarea class="input" name="message" required maxlength="5000"></textarea></div>
          <div class="form-msg"></div>
          <button class="btn" type="submit">إرسال</button>
        </form>
      </div>
      <div>
        <div class="panel">
          <h3>📞 تواصل مباشر مع اللجنة</h3>
          ${s.email ? `<p>✉️ البريد: <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
          ${s.phone ? `<p>☎️ الهاتف: <a href="tel:${esc(s.phone)}" dir="ltr">${esc(s.phone)}</a></p>` : ''}
          ${s.whatsapp ? `<p>💬 واتساب: <a href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" dir="ltr">${esc(s.whatsapp)}</a></p>` : ''}
          ${!s.email && !s.phone && !s.whatsapp ? '<p class="muted">سيتم إضافة وسائل التواصل قريباً.</p>' : ''}
        </div>
        <div class="panel">
          <h3>🔎 متابعة حالة طلب</h3>
          <form class="form" id="trackForm">
            <div class="field"><label>رقم التذكرة</label><input class="input" name="ticket" required placeholder="T-2026-0001" dir="ltr"></div>
            <div class="field"><label>الرقم الوظيفي</label><input class="input" name="employeeId" required value="${esc(store.get('employee', {}).employeeId)}"></div>
            <div class="form-msg"></div>
            <button class="btn ghost" type="submit">استعلام</button>
          </form>
          <div id="trackResult"></div>
        </div>
      </div>
    </section>`;
  bindForm(document.getElementById('cForm'), async (data) => {
    const r = await api('/api/complaints', { method: 'POST', body: data });
    rememberEmployee(data);
    document.getElementById('cPanel').innerHTML = `<div class="center"><div style="font-size:64px">📬</div><h3>تم استلام طلبك</h3>
      <p>رقم التذكرة: <b style="font-size:22px;color:var(--green-700)" dir="ltr">${esc(r.ticket)}</b></p>
      <p class="muted">احتفظ برقم التذكرة لمتابعة حالة طلبك.</p></div>`;
  });
  bindForm(document.getElementById('trackForm'), async (data) => {
    const c = await api(`/api/complaints/track?ticket=${encodeURIComponent(data.ticket)}&employeeId=${encodeURIComponent(data.employeeId)}`);
    document.getElementById('trackResult').innerHTML = `<div class="alert info mt"><b>${esc(c.subject)}</b><br>الحالة: ${statusBadge(c.status)}
      ${c.response ? `<p style="margin:8px 0 0;white-space:pre-line"><b>رد اللجنة:</b> ${esc(c.response)}</p>` : ''}</div>`;
  });
}

// ---------- التوجيه ----------
const routes = [
  [/^\/$/, () => pageHome()],
  [/^\/activities$/, (m, p) => pageActivities(p)],
  [/^\/activity\/([\w-]+)$/, (m) => pageActivity(m[1])],
  [/^\/news$/, (m, p) => pageNews(p)],
  [/^\/news\/([\w-]+)$/, (m) => pagePost(m[1])],
  [/^\/quiz$/, () => pageQuiz()],
  [/^\/polls$/, () => pagePolls()],
  [/^\/committee$/, () => pageCommittee()],
  [/^\/star$/, () => pageStar()],
  [/^\/card$/, () => pageCardLookup()],
  [/^\/card\/([\w-]+)$/, (m) => pageCard(m[1])],
  [/^\/verify\/([\w-]+)$/, (m) => pageVerify(m[1])],
  [/^\/docs\/(charter|bylaws)$/, (m) => pageDocs(m[1])],
  [/^\/complaints$/, () => pageComplaints()],
];

async function router() {
  timers.forEach(clearInterval);
  timers = [];
  document.body.classList.remove('print-card');
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  document.querySelectorAll('#nav a').forEach((a) => {
    const href = a.getAttribute('href').slice(1);
    a.classList.toggle('active', href === '/' ? path === '/' : path.startsWith(href.split('/').slice(0, 2).join('/')));
  });
  document.getElementById('nav').classList.remove('open');
  window.scrollTo({ top: 0 });
  const route = routes.find(([re]) => re.test(path));
  if (!route) { $app.innerHTML = `${pageHead('الصفحة غير موجودة')}<section class="section container">${empty('🧭', 'الرابط غير صحيح')}</section>`; return; }
  $app.innerHTML = '<div class="loading"><div class="spinner"></div>جاري التحميل…</div>';
  try {
    await route[1](path.match(route[0]), params);
  } catch (err) {
    $app.innerHTML = `${pageHead('تعذر عرض الصفحة')}<section class="section container"><div class="alert err">${esc(err.message)}</div></section>`;
  }
}

function applySettings() {
  document.querySelectorAll('[data-setting]').forEach((el) => { el.textContent = SETTINGS[el.dataset.setting] || ''; });
  document.getElementById('footerSocial').innerHTML = socialLinks(SETTINGS.social);
  document.getElementById('footerContact').innerHTML = [
    SETTINGS.email && `<a href="mailto:${esc(SETTINGS.email)}">✉️ ${esc(SETTINGS.email)}</a>`,
    SETTINGS.phone && `<a href="tel:${esc(SETTINGS.phone)}" dir="ltr">☎️ ${esc(SETTINGS.phone)}</a>`,
    SETTINGS.whatsapp && `<a href="https://wa.me/${esc(SETTINGS.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">💬 واتساب</a>`,
  ].filter(Boolean).join('');
  document.getElementById('year').textContent = new Date().getFullYear();
}

document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('nav').classList.toggle('open'));
window.addEventListener('afterprint', () => document.body.classList.remove('print-card'));
window.addEventListener('hashchange', router);

(async () => {
  try {
    SETTINGS = await api('/api/settings');
    applySettings();
  } catch (err) {
    $app.innerHTML = `<div class="container section"><div class="alert err">تعذر الاتصال بالخادم: ${esc(err.message)}</div></div>`;
    return;
  }
  router();
})();
