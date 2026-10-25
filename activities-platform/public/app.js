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

const STAGE_ORDER = ['open', 'selection', 'preparing', 'competing', 'completed'];
const STAGE_ICONS = { open: '📝', selection: '🎯', preparing: '🏋️', competing: '🏁', completed: '🏆' };
const RANK_ICONS = { gold: '🥇', silver: '🥈', bronze: '🥉', honor: '🎖️', participation: '🏅' };
const stageBadge = (a) => {
  const cls = { open: '', selection: 'blue', preparing: 'warn', competing: 'gold', completed: 'gray' }[a.status] || 'gray';
  return `<span class="badge ${cls}">${STAGE_ICONS[a.status] || ''} ${esc(a.stageLabel)}</span>`;
};
const prepBar = (p) => (p && p.total ? `<div class="bar-row" style="margin:4px 0 0"><div class="lbl"><span>جاهزية التجهيز</span><b>${Math.round((p.done / p.total) * 100)}%</b></div><div class="bar"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></div></div>` : '');

const activityCard = (a) => `
  <a class="card" href="#/activity/${a.id}">
    <div class="media ${a.image ? '' : 'placeholder'}" ${a.image ? `style="background-image:url('${esc(a.image)}')"` : ''}>
      ${a.image ? '' : CATEGORY_ICONS[a.category] || '✨'}
      ${stageBadge(a)}
    </div>
    <div class="body">
      <div class="flex" style="gap:6px"><span class="badge gold">${CATEGORY_ICONS[a.category] || ''} ${esc(a.categoryLabel)}</span><span class="badge gray">🌍 ${esc(a.levelLabel)}</span></div>
      <h3>${esc(a.title)}</h3>
      ${a.organizer ? `<p style="font-size:14px">🏛️ ${esc(a.organizer)}</p>` : ''}
      <div class="meta">
        ${a.startDate ? `<span>📅 ${fmtDate(a.startDate)}</span>` : ''}
        ${a.location ? `<span>📍 ${esc(a.location)}</span>` : ''}
      </div>
      ${a.status === 'completed' && a.resultLabel ? `<div class="alert ok" style="padding:8px 12px">${RANK_ICONS[a.resultRank] || ''} ${esc(a.result || a.resultLabel)}</div>`
    : ['preparing', 'competing', 'selection'].includes(a.status) ? prepBar(a.prep) : ''}
      <div class="foot">
        <span class="muted" style="font-size:14px">👥 ${a.registered}${a.capacity ? ` / ${a.capacity}` : ''} مرشّح</span>
        ${a.isOpen && a.deadline ? `<span class="muted" style="font-size:13px">آخر موعد للترشح: ${fmtDate(a.deadline)}</span>` : a.team ? `<span class="muted" style="font-size:13px">🛡️ ${esc(a.team.name)}</span>` : ''}
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

const teamCard = (t) => `
  <a class="card" href="#/teams" data-team="${t.id}">
    <div class="media ${t.image ? '' : 'placeholder'}" ${t.image ? `style="background-image:url('${esc(t.image)}')"` : ''}>
      ${t.image ? '' : '🛡️'}<span class="badge ${t.status === 'active' ? '' : t.status === 'training' ? 'warn' : 'blue'}">${esc(t.statusLabel)}</span>
    </div>
    <div class="body">
      <h3>${esc(t.name)}</h3>
      <div class="meta"><span>🧑‍🏫 المدرب: ${esc(t.coach || '—')}</span><span>👥 ${t.members.length} عضو</span></div>
      ${t.participations.length ? `<p style="font-size:14px">🏁 ${esc(t.participations[0].title)}</p>` : ''}
    </div>
  </a>`;

const achievementRow = (a) => `
  <a class="ach" href="#/activity/${a.id}">
    <span class="medal">${RANK_ICONS[a.resultRank] || '🏅'}</span>
    <div><b>${esc(a.result || a.resultLabel)}</b><br><span class="muted">${esc(a.title)}${a.team ? ` — ${esc(a.team.name)}` : ''}</span></div>
    <span class="muted" style="margin-inline-start:auto;font-size:14px">${fmtDate(a.endDate || a.startDate)}</span>
  </a>`;

// ---------- الصفحات ----------
async function pageHome() {
  const d = await api('/api/home');
  const s = d.settings;
  $app.innerHTML = `
    <section class="hero"><div class="container inner">
      <div>
        <span class="badge gold">${esc(s.companyName)} — ${esc(s.committeeName)}</span>
        <h1 style="margin-top:12px">نمثّل الشركة <em>في كل محفل</em><br>ونرعى مواهبها</h1>
        <p>${esc(s.tagline)}</p>
        <div class="actions">
          <a class="btn gold" href="#/activities?status=open">ترشّح لتمثيل الشركة</a>
          <a class="btn outline-light" href="#/talents">⭐ سجّل موهبتك</a>
        </div>
      </div>
      <div class="logo-card"><img src="/assets/logo-full.png" alt="شعار لجنة الأنشطة"></div>
    </div></section>

    <div class="container stats">
      <div class="stat"><b>${d.stats.activities}</b><span>مشاركة خارجية</span></div>
      <div class="stat"><b>${d.stats.teams}</b><span>فريق ومنتخب</span></div>
      <div class="stat"><b>${d.stats.talents}</b><span>موهبة مقيدة</span></div>
      <div class="stat"><b>${d.stats.medals}</b><span>ميدالية وإنجاز</span></div>
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
        <a href="#/activities"><span class="ico">🏁</span>المشاركات الخارجية</a>
        <a href="#/teams"><span class="ico">🛡️</span>الفرق والمنتخبات</a>
        <a href="#/talents"><span class="ico">⭐</span>سجل المواهب</a>
        <a href="#/achievements"><span class="ico">🏆</span>سجل الإنجازات</a>
        <a href="#/card"><span class="ico">🪪</span>بطاقة المشارك</a>
        <a href="#/quiz"><span class="ico">🎁</span>المسابقة الأسبوعية</a>
        <a href="#/polls"><span class="ico">🗳️</span>اختر مشاركاتنا</a>
        <a href="#/complaints"><span class="ico">🧰</span>الدعم والشكاوى</a>
      </div>
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>باب الترشح مفتوح</h2><p>بطولات ومحافل خارجية تبحث عمّن يمثّل الشركة</p></div><a class="btn ghost small" href="#/activities">كل المشاركات</a></div>
      ${d.activities.length ? `<div class="grid cols-3">${d.activities.map(activityCard).join('')}</div>` : empty('📭', 'لا يوجد ترشح مفتوح حالياً، تابعنا قريباً')}
    </section>

    ${d.upcoming.length ? `<section class="section container">
      <div class="section-head"><div><h2>مشاركات قيد الإعداد</h2><p>فرقنا تستعد — تابع مراحل الاختيار والتجهيز</p></div></div>
      <div class="grid cols-3">${d.upcoming.map(activityCard).join('')}</div>
    </section>` : ''}

    <section class="section container">
      <div class="section-head"><div><h2>الفرق والمنتخبات</h2><p>من يمثّل الشركة في البطولات والدوريات</p></div><a class="btn ghost small" href="#/teams">كل الفرق</a></div>
      ${d.teams.length ? `<div class="grid cols-4">${d.teams.map(teamCard).join('')}</div>` : empty('🛡️', 'لم تُشكَّل فرق بعد')}
    </section>

    <section class="section container">
      <div class="grid cols-2">
        <div class="panel">
          <h3>🏆 أحدث الإنجازات</h3>
          ${d.achievements.length ? d.achievements.slice(0, 4).map(achievementRow).join('') : '<p class="muted">ستظهر هنا نتائج مشاركات الشركة وإنجازاتها.</p>'}
          <a class="btn ghost mt" href="#/achievements">سجل الإنجازات</a>
        </div>
        <div class="panel talent-cta">
          <h3>⭐ هل لديك موهبة تمثّل بها الشركة؟</h3>
          <p>رياضية، ثقافية، فنية أو تقنية… سجّلها في <b>سجل المواهب</b> لتحظى بالتقييم والتأهيل والدعم والرعاية وفق المواد (26–30) من الميثاق.</p>
          <a class="btn gold mt" href="#/talents">سجّل موهبتك الآن</a>
        </div>
      </div>
    </section>

    <section class="section container">
      <div class="grid cols-2">
        <div class="panel">
          <h3>🎁 المسابقة الأسبوعية</h3>
          ${d.quiz ? `<p><b>${esc(d.quiz.title)}</b></p>
            <div class="prize"><span class="ico">📱</span><div><b>الجائزة</b><br>${esc(d.quiz.prize)}</div></div>
            <p class="muted mt">تنتهي المسابقة خلال:</p><div class="countdown" id="homeCountdown"></div>
            <a class="btn gold mt" href="#/quiz">شارك الآن</a>`
    : `<p class="muted">لا توجد مسابقة جارية الآن. تُطرح مسابقة جديدة كل أسبوع بجوائز رصيد.</p><a class="btn ghost" href="#/quiz">نتائج المسابقات السابقة</a>`}
        </div>
        <div class="panel">
          <h3>🗳️ اختر معنا مشاركاتنا القادمة</h3>
          ${d.polls.length ? d.polls.map((p) => `<div class="flex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0"><div><b>${esc(p.title)}</b><br><small class="muted">ينتهي ${fmtDateTime(p.endsAt)}</small></div><a class="btn small" href="#/polls">صوّت</a></div>`).join('')
    : '<p class="muted">لا توجد استطلاعات مفتوحة حالياً.</p>'}
          <a class="btn ghost mt" href="#/polls">كل الاستطلاعات</a>
        </div>
      </div>
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>الأخبار والقرارات</h2><p>نتائج المشاركات وقرارات اللجنة</p></div><a class="btn ghost small" href="#/news">كل الأخبار</a></div>
      ${d.latest.length ? `<div class="grid cols-3">${d.latest.slice(0, 3).map(postCard).join('')}</div>` : empty('📰', 'لا توجد أخبار بعد')}
    </section>

    <section class="section container">
      <div class="section-head"><div><h2>من مشاركاتنا</h2></div></div>
      <div class="gallery">
        <div style="background-image:url('/assets/volleyball-champions.webp')"></div>
        <div style="background-image:url('/assets/team-futsal.webp')"></div>
        <div style="background-image:url('/assets/team-veterans.webp')"></div>
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

async function pageActivities(params) {
  const cat = params.get('category') || '';
  const status = params.get('status') || '';
  const q = new URLSearchParams({ ...(cat && { category: cat }), ...(status && { status }) });
  const list = await api(`/api/activities${q.toString() ? `?${q}` : ''}`);
  const link = (c, st) => {
    const p = new URLSearchParams({ ...(c && { category: c }), ...(st && { status: st }) });
    return `#/activities${p.toString() ? `?${p}` : ''}`;
  };
  $app.innerHTML = `${pageHead('المشاركات الخارجية', 'البطولات والمسابقات والمحافل التي تمثّل فيها الشركة خارجياً')}
    <section class="section container">
      <div class="chips">
        <a class="chip ${status ? '' : 'active'}" href="${link(cat, '')}">كل المراحل</a>
        ${STAGE_ORDER.map((k) => `<a class="chip ${status === k ? 'active' : ''}" href="${link(cat, k)}">${STAGE_ICONS[k]} ${esc(SETTINGS.stages[k])}</a>`).join('')}
      </div>
      <div class="chips">
        <a class="chip ${cat ? '' : 'active'}" href="${link('', status)}">كل المجالات</a>
        ${Object.entries(SETTINGS.categories).map(([k, v]) => `<a class="chip ${cat === k ? 'active' : ''}" href="${link(k, status)}">${CATEGORY_ICONS[k]} ${esc(v)}</a>`).join('')}
      </div>
      ${list.length ? `<div class="grid cols-3">${list.map(activityCard).join('')}</div>` : empty('📭', 'لا توجد مشاركات بهذه التصفية حالياً')}
    </section>`;
}

async function pageActivity(id) {
  const a = await api(`/api/activities/${id}`);
  const current = STAGE_ORDER.indexOf(a.status);
  $app.innerHTML = `${pageHead(a.title, `${CATEGORY_ICONS[a.category]} مشاركة ${a.categoryLabel} — ${a.levelLabel}`, [['المشاركات الخارجية', '#/activities'], [a.title]])}
    <section class="section container">
      <div class="stages">${STAGE_ORDER.map((k, i) => `<div class="stage ${i < current ? 'done' : i === current ? 'now' : ''}"><span>${STAGE_ICONS[k]}</span>${esc(SETTINGS.stages[k])}</div>`).join('')}</div>
    </section>
    <section class="section container layout-2" style="padding-top:20px">
      <div class="panel">
        ${a.image ? `<img src="${esc(a.image)}" alt="" style="border-radius:12px;margin-bottom:16px;width:100%;max-height:340px;object-fit:cover">` : ''}
        <table class="list facts"><tbody>
          ${a.organizer ? `<tr><th>🏛️ الجهة المنظمة</th><td>${esc(a.organizer)}</td></tr>` : ''}
          <tr><th>🌍 المستوى</th><td>${esc(a.levelLabel)}</td></tr>
          ${a.startDate ? `<tr><th>📅 الموعد</th><td>${fmtDate(a.startDate)}${a.endDate && a.endDate !== a.startDate ? ` — ${fmtDate(a.endDate)}` : ''}</td></tr>` : ''}
          ${a.location ? `<tr><th>📍 المكان</th><td>${esc(a.location)}</td></tr>` : ''}
          ${a.team ? `<tr><th>🛡️ الفريق الممثل</th><td><a href="#/teams">${esc(a.team.name)}</a></td></tr>` : ''}
          ${a.deadline && a.status === 'open' ? `<tr><th>⏰ آخر موعد للترشح</th><td>${fmtDate(a.deadline)}</td></tr>` : ''}
          <tr><th>👥 المرشّحون</th><td>${a.registered}${a.capacity ? ` من أصل ${a.capacity} مطلوب` : ''}</td></tr>
        </tbody></table>
        <p class="post-body mt">${esc(a.description)}</p>
        ${a.status === 'completed' && a.resultLabel ? `<div class="result-box"><span>${RANK_ICONS[a.resultRank] || '🏅'}</span><div><b>${esc(a.result || a.resultLabel)}</b>${a.resultNotes ? `<p>${esc(a.resultNotes)}</p>` : ''}</div></div>` : ''}
        ${['selection', 'preparing', 'competing'].includes(a.status) && a.prep.total ? `<div class="mt">${prepBar(a.prep)}<small class="muted">تتابع اللجنة قائمة تجهيز المشاركة: الاعتماد، إشعار الرؤساء المباشرين، الإيفاد، الكشف الطبي، الزي والمعدات، السفر والإقامة.</small></div>` : ''}
      </div>
      <div class="panel" id="regPanel">
        <h3>📝 نموذج الترشح لتمثيل الشركة</h3>
        ${a.isOpen ? `<form class="form" id="regForm">
          ${employeeFields({ email: true })}
          <div class="row">
            <div class="field"><label>نوع العقد</label><select class="input" name="contractType"><option value="">— اختر —</option>${SETTINGS.contractTypes.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
            <div class="field"><label>الانتساب الرياضي</label><select class="input" name="affiliation">${Object.entries(SETTINGS.affiliations).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>اسم النادي / المنتخب (إن وجد)</label><input class="input" name="clubName" maxlength="160"></div>
          <div class="field"><label>الخبرة السابقة</label><textarea class="input" name="experience" maxlength="1000" placeholder="مثال: لاعب سابق في نادي...، مشاركات سابقة مع فريق الشركة، دوريات رمضانية"></textarea></div>
          <div class="field"><label>ملاحظات أو اعتبارات خاصة</label><textarea class="input" name="notes" maxlength="1000" style="min-height:70px" placeholder="اللياقة البدنية، الاستعداد لحضور التدريبات..."></textarea></div>
          <label class="check"><input type="checkbox" name="pledge" required><span>أُقر بصحة البيانات وخلوّي من أي حالة صحية تمنع المشاركة، وأتعهد بالالتزام ببنود <a href="#/docs/charter" target="_blank">الميثاق</a> وتعليمات اللجنة والجهاز الفني.</span></label>
          <div class="form-msg"></div>
          <button class="btn" type="submit">إرسال طلب الترشح</button>
          <small class="muted">تراجع اللجنة الطلبات وفق المواد (9–12) من الميثاق، وتُعلن قائمة المختارين والقائمة الاحتياطية.</small>
        </form>` : `<div class="alert info">${esc(a.closedReason || 'باب الترشح غير مفتوح')}</div><p class="muted mt">يمكنك متابعة طلباتك السابقة من صفحة <a href="#/card">بطاقة المشارك</a>.</p>`}
      </div>
    </section>`;
  const form = document.getElementById('regForm');
  if (form) {
    bindForm(form, async (data) => {
      const r = await api(`/api/activities/${id}/register`, { method: 'POST', body: data });
      rememberEmployee(data);
      document.getElementById('regPanel').innerHTML = r.status === 'approved'
        ? `<div class="center"><div style="font-size:64px">🎉</div><h3>تم قبول ترشحك!</h3><p class="muted">بطاقة المشارك الرسمي جاهزة.</p><a class="btn gold" href="#/card/${esc(r.cardCode)}">عرض البطاقة</a></div>`
        : `<div class="center"><div style="font-size:64px">✅</div><h3>تم استلام طلب ترشحك</h3><p class="muted">طلبك قيد المراجعة من اللجنة. تابع حالته (مقبول / احتياطي) وأصدر بطاقتك بعد القبول من صفحة «بطاقة المشارك».</p><a class="btn" href="#/card">متابعة الطلب</a></div>`;
    });
  }
}

async function pageTeams() {
  const teams = await api('/api/teams');
  $app.innerHTML = `${pageHead('الفرق والمنتخبات', 'فرق الشركة المرشّحة والمنتخبة لتمثيلها في البطولات والدوريات والمحافل')}
    <section class="section container">
      ${teams.length ? teams.map((t) => `
        <article class="panel team" id="team-${t.id}">
          <div class="team-head">
            ${t.image ? `<div class="team-img" style="background-image:url('${esc(t.image)}')"></div>` : '<div class="team-img placeholder">🛡️</div>'}
            <div>
              <div class="flex" style="gap:8px"><span class="badge gold">${CATEGORY_ICONS[t.category] || ''} ${esc(t.categoryLabel)}</span><span class="badge ${t.status === 'active' ? '' : t.status === 'training' ? 'warn' : 'blue'}">${esc(t.statusLabel)}</span></div>
              <h2 style="margin:8px 0 4px">${esc(t.name)}</h2>
              ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
              <div class="meta" style="margin-top:6px">
                <span>🧑‍🏫 المدرب: <b>${esc(t.coach || '—')}</b></span>
                <span>📋 الإداري: <b>${esc(t.manager || '—')}</b></span>
                ${t.captain ? `<span>©️ القائد: <b>${esc(t.captain)}</b></span>` : ''}
              </div>
              ${t.schedule ? `<p style="margin-top:8px">🗓️ ${esc(t.schedule)}</p>` : ''}
            </div>
          </div>
          <div class="grid cols-2 mt">
            <div>
              <h4>👥 التشكيلة (${t.members.length})</h4>
              ${t.members.length ? `<ul class="roster">${t.members.map((m) => `<li><span>${esc(m.name)}</span>${m.role ? `<small>${esc(m.role)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted">تُعلن التشكيلة بعد اختبارات الانتقاء.</p>'}
            </div>
            <div>
              <h4>🏁 المشاركات</h4>
              ${t.participations.length ? t.participations.map((p) => `<a class="ach" href="#/activity/${p.id}"><span class="medal">${STAGE_ICONS[p.status]}</span><div><b>${esc(p.title)}</b><br><span class="muted">${esc(p.resultLabel || p.stageLabel)}</span></div></a>`).join('') : '<p class="muted">لا توجد مشاركات مرتبطة بعد.</p>'}
            </div>
          </div>
        </article>`).join('') : empty('🛡️', 'لم تُشكَّل فرق بعد')}
    </section>`;
}

async function pageAchievements() {
  const d = await api('/api/achievements');
  $app.innerHTML = `${pageHead('سجل الإنجازات', 'نتائج مشاركات الشركة في البطولات والمحافل الخارجية')}
    <section class="section container">
      <div class="medals">
        <div class="stat"><b>🥇 ${d.medals.gold}</b><span>مركز أول</span></div>
        <div class="stat"><b>🥈 ${d.medals.silver}</b><span>مركز ثانٍ</span></div>
        <div class="stat"><b>🥉 ${d.medals.bronze}</b><span>مركز ثالث</span></div>
        <div class="stat"><b>🏅 ${d.total}</b><span>إنجاز مسجّل</span></div>
      </div>
      <div class="panel mt">
        ${d.list.length ? d.list.map(achievementRow).join('') : empty('🏆', 'لم تُسجَّل نتائج بعد')}
      </div>
      <p class="muted center mt">تحتفظ الشركة بالكؤوس والدروع والجوائز الجماعية في مكتبة الإنجازات تحت إشراف لجنة الأنشطة (المادة 89).</p>
    </section>`;
}

const TALENT_FIELD_ICONS = { sports: '⚽', literature: '✍️', innovation: '💡', arts: '🎨', media: '🎬', other: '✨' };

async function pageTalents() {
  const st = await api('/api/talents/stats');
  const me = store.get('employee', {});
  const S = SETTINGS;
  const box = (name, key, label, hint) => `<label class="option"><input type="checkbox" name="${name}" value="${key}"> <span>${label}${hint ? ` <small class="muted">(${esc(hint)})</small>` : ''}</span></label>`;
  $app.innerHTML = `${pageHead('سجل المواهب', 'نموذج حصر المواهب داخل شركة المدار الجديد — نكتشف المواهب ونؤهلها وندعمها لتمثيل الشركة')}
    <section class="section container">
      <div class="medals">
        <div class="stat"><b>${st.registered}</b><span>موهبة مقيدة</span></div>
        <div class="stat"><b>${st.sponsored}</b><span>موهبة ترعاها الشركة</span></div>
        ${Object.entries(st.byField).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `<div class="stat"><b>${n}</b><span>${TALENT_FIELD_ICONS[k] || ''} ${esc(S.talentFields[k] || k)}</span></div>`).join('')}
      </div>
    </section>
    <section class="section container layout-2" style="padding-top:20px">
      <div class="panel" id="talentPanel">
        <div class="flex" style="justify-content:space-between"><h3 style="margin:0">📋 نموذج حصر المواهب</h3><a class="btn small ghost" href="/docs/talent-form.pdf" download>⬇️ النموذج الورقي (PDF)</a></div>
        <div class="alert info mt" style="font-size:14.5px">يُعد هذا النموذج جزءاً من منظومة تطوير وتنمية المواهب بالشركة، ولا يترتب عليه أي التزام أو قرار إلا بعد دراسة الطلب من لجنة الأنشطة واعتماده وفق اللوائح والسياسات النافذة، كما تلتزم الشركة بمبدأ تكافؤ الفرص وعدم التمييز بين العاملين في جميع مراحل الفرز والتقييم.</div>
        <form class="form mt" id="talentForm">
          <h4 class="form-sec"><span>1</span> البيانات الشخصية</h4>
          <div class="row">
            <div class="field"><label>الاسم الرباعي <span class="req">*</span></label><input class="input" name="name" required maxlength="160" value="${esc(me.name)}"></div>
            <div class="field"><label>الرقم الوظيفي <span class="req">*</span></label><input class="input" name="employeeId" required maxlength="30" inputmode="numeric" value="${esc(me.employeeId)}"></div>
          </div>
          <div class="row">
            <div class="field"><label>العمر</label><input class="input" name="age" type="number" min="16" max="80"></div>
            <div class="field"><label>الفرع</label><select class="input" name="branch"><option value="">— اختر —</option>${S.branches.map((b) => `<option>${esc(b)}</option>`).join('')}</select></div>
          </div>
          <div class="row">
            <div class="field"><label>الإدارة <span class="req">*</span></label><input class="input" name="department" required maxlength="160" list="deps" value="${esc(me.department)}"><datalist id="deps">${(S.departments || []).map((d) => `<option value="${esc(d)}">`).join('')}</datalist></div>
            <div class="field"><label>الدائرة</label><input class="input" name="division" maxlength="160"></div>
          </div>
          <div class="row">
            <div class="field"><label>القسم</label><input class="input" name="section" maxlength="160"></div>
            <div class="field"><label>رقم الهاتف <span class="req">*</span></label><input class="input" name="phone" required maxlength="30" inputmode="tel" value="${esc(me.phone)}"></div>
          </div>
          <div class="field"><label>البريد الإلكتروني</label><input class="input" type="email" name="email" maxlength="160" value="${esc(me.email)}"></div>

          <h4 class="form-sec"><span>2</span> المجال / الموهبة <small class="muted">(يمكن اختيار أكثر من مجال)</small></h4>
          <div class="options">
            ${Object.entries(S.talentFields).map(([k, v]) => box('fields', k, `${TALENT_FIELD_ICONS[k]} ${esc(v)}`, S.talentFieldHints[k])).join('')}
          </div>
          <div class="field" id="sportTypeBox" hidden><label>نوع الرياضة</label><div class="chips" style="margin:0">${Object.entries(S.sportTypes).map(([k, v]) => `<label class="option" style="padding:6px 14px"><input type="radio" name="sportType" value="${k}"> ${esc(v)}</label>`).join('')}</div></div>
          <div class="field" id="otherFieldBox" hidden><label>حدّد المجال <span class="req">*</span></label><input class="input" name="otherField" maxlength="160"></div>
          <div class="field"><label>وصف مبسّط عن المجال الذي فيه الموهبة</label><textarea class="input" name="fieldDescription" maxlength="3000"></textarea></div>

          <h4 class="form-sec"><span>3</span> مستوى الموهبة <span class="req">*</span></h4>
          <div class="chips" style="margin:0">${Object.entries(S.talentLevels).map(([k, v]) => `<label class="option" style="padding:8px 18px"><input type="radio" name="level" value="${k}" required> ${esc(v)}</label>`).join('')}</div>
          <div class="field"><label>وصف محدد لمستوى الموهبة وذكر الجهة التي ينتمي إليها الموظف لممارسة موهبته (نادي – جهة – مركز – تطوير ذاتي – الخ)</label><textarea class="input" name="levelDescription" maxlength="3000"></textarea></div>

          <h4 class="form-sec"><span>4</span> الإنجازات والمشاركات السابقة (إن وجدت)</h4>
          <textarea class="input" name="achievements" maxlength="5000"></textarea>

          <h4 class="form-sec"><span>5</span> الاحتياجات لتطوير الموهبة</h4>
          <div class="options">${Object.entries(S.talentNeeds).map(([k, v]) => box('needs', k, esc(v))).join('')}</div>
          <div class="field" id="otherNeedBox" hidden><label>حدّد الاحتياج</label><input class="input" name="otherNeed" maxlength="160"></div>
          <div class="field"><label>وصف نوع الاحتياج</label><textarea class="input" name="needsDescription" maxlength="3000"></textarea></div>

          <h4 class="form-sec"><span>6</span> أي إضافة أخرى</h4>
          <textarea class="input" name="extra" maxlength="5000"></textarea>

          <label class="check"><input type="checkbox" name="consent" required><span>أُقر بصحة البيانات، وأوافق على قيد اسمي في سجل المواهب بالشركة، وأعلم أن القيد اختياري (المادة 30 من الميثاق).</span></label>
          <div class="form-msg"></div>
          <button class="btn gold" type="submit">إرسال النموذج</button>
        </form>
      </div>
      <div>
        <div class="panel">
          <h3>🔍 من هو الموهوب؟</h3>
          <ul class="muted" style="padding-inline-start:20px">
            <li>من يمتلك قدرات وأداءً متميزاً في مجال أو أكثر مقارنة بأقرانه.</li>
            <li>القادر على إنتاج أفكار جديدة ومبتكرة.</li>
            <li>من قدّم حلولاً تقنية أو تجارية أسهمت في نمو الشركة.</li>
            <li>من لديه أفكار ومقترحات تحتاج إلى تطوير.</li>
          </ul>
        </div>
        <div class="panel">
          <h3>🤝 ماذا تقدّم اللجنة للمواهب؟</h3>
          <ul class="muted" style="padding-inline-start:20px">
            <li>تقييم متخصص واختبارات لتحديد مستوى الموهبة.</li>
            <li>برامج تأهيل وتدريب وتوفير الأدوات والموارد.</li>
            <li>فرص العرض والمشاركة في المسابقات الداخلية والخارجية.</li>
            <li>الرعاية المالية أو اللوجستية للمشاركات المعتمدة، والدعم الإعلامي.</li>
          </ul>
          <a class="btn ghost small" href="#/docs/charter">اقرأ المواد 26–50 في الميثاق</a>
        </div>
        <div class="panel">
          <h3>🗂️ مراحل الطلب</h3>
          <ol class="muted" style="padding-inline-start:20px">
            <li>تعبئة النموذج وإرساله.</li>
            <li>دراسة الطلب وتقييم الموهبة من اللجنة.</li>
            <li>القيد في سجل المواهب ووضع برنامج التأهيل والدعم.</li>
            <li>الترشيح لتمثيل الشركة في المحافل المناسبة، أو رعاية مشاركاتك.</li>
          </ol>
        </div>
      </div>
    </section>`;
  const form = document.getElementById('talentForm');
  const sync = () => {
    const picked = (n) => [...form.querySelectorAll(`[name=${n}]:checked`)].map((i) => i.value);
    document.getElementById('sportTypeBox').hidden = !picked('fields').includes('sports');
    const otherF = picked('fields').includes('other');
    document.getElementById('otherFieldBox').hidden = !otherF;
    form.querySelector('[name=otherField]').required = otherF;
    document.getElementById('otherNeedBox').hidden = !picked('needs').includes('other');
  };
  form.addEventListener('change', sync);
  bindForm(form, async (data) => {
    const picked = (n) => [...form.querySelectorAll(`[name=${n}]:checked`)].map((i) => i.value);
    const body = { ...data, fields: picked('fields'), needs: picked('needs'), age: Number(data.age) || 0 };
    if (!body.fields.length) throw new Error('اختر مجال الموهبة (مجالاً واحداً على الأقل)');
    await api('/api/talents', { method: 'POST', body });
    rememberEmployee(data);
    document.getElementById('talentPanel').innerHTML = '<div class="center"><div style="font-size:64px">⭐</div><h3>وصل نموذجك إلى لجنة الأنشطة</h3><p class="muted">ستدرس اللجنة طلبك وتقيّم موهبتك، ثم تتواصل معك بشأن برنامج التأهيل والدعم المناسب.</p></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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
  $app.innerHTML = `${pageHead('اختر معنا مشاركاتنا', 'صوّت على البطولات والمحافل التي تشارك فيها الشركة وبرامج تجهيز الفرق — صوت واحد لكل موظف')}
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

async function pageCardLookup() {
  const me = store.get('employee', {});
  $app.innerHTML = `${pageHead('بطاقة المشارك الرسمي', 'تابع طلبات ترشحك وأصدر بطاقة تمثيل الشركة بعد قبولك')}
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
      <div class="table-wrap"><table class="list"><thead><tr><th>المشاركة</th><th>المرحلة</th><th>تاريخ الطلب</th><th>حالة الترشح</th><th></th></tr></thead><tbody>
      ${list.map((r) => `<tr><td>${CATEGORY_ICONS[r.category] || ''} ${esc(r.activityTitle)}</td><td>${esc(r.stageLabel || '')}</td><td>${fmtDate(r.createdAt.slice(0, 10))}</td>
        <td>${statusBadge(r.status)}${r.reviewNote ? `<br><small class="muted">السبب: ${esc(r.reviewNote)}</small>` : ''}</td>
        <td>${r.cardCode ? `<a class="btn small gold" href="#/card/${esc(r.cardCode)}">🪪 إصدار البطاقة</a>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('🔍', 'لا توجد طلبات ترشح بهذا الرقم الوظيفي')}</div>`;
  };
  bindForm(form, run);
  if (me.employeeId) run({ employeeId: me.employeeId }).catch(() => {});
}

function cardHtml(c) {
  return `<div class="pcard">
    <img class="wm" src="/assets/emblem.png" alt="">
    <div class="top">
      <div><b>بطاقة مشارك رسمي — تمثيل الشركة</b><small>${esc(SETTINGS.committeeName)} — ${esc(SETTINGS.companyName)}</small></div>
      <img src="/assets/emblem.png" alt="">
    </div>
    <div class="mid">
      <div class="who">
        <h3>${esc(c.name)}</h3>
        <p>الرقم الوظيفي: <b>${esc(c.employeeId)}</b></p>
        <p>${esc(c.jobTitle)}${c.department ? ` — ${esc(c.department)}` : ''}</p>
        <span class="act">${CATEGORY_ICONS[c.activity.category] || ''} ${esc(c.activity.title)}</span>
        ${c.activity.team || c.activity.organizer ? `<p style="margin-top:6px">${c.activity.team ? `🛡️ ${esc(c.activity.team)}` : ''}${c.activity.team && c.activity.organizer ? ' · ' : ''}${c.activity.organizer ? `🏛️ ${esc(c.activity.organizer)}` : ''}</p>` : ''}
        ${c.activity.startDate ? `<p>📅 ${fmtDate(c.activity.startDate)}${c.activity.endDate && c.activity.endDate !== c.activity.startDate ? ` — ${fmtDate(c.activity.endDate)}` : ''}${c.activity.location ? ` · 📍 ${esc(c.activity.location)}` : ''}</p>` : ''}
      </div>
      <div class="qr"><img src="/api/cards/${esc(c.code)}/qr.svg" alt="رمز التحقق"></div>
    </div>
    <div class="bottom"><span>رقم البطاقة: <b>${esc(c.cardNo)}</b></span><span>رمز التحقق: <b>${esc(c.code)}</b></span></div>
  </div>`;
}

async function pageCard(code) {
  const c = await api(`/api/cards/${encodeURIComponent(code)}`);
  $app.innerHTML = `${pageHead('بطاقة المشارك الرسمي', c.activity.title, [['بطاقة المشارك', '#/card'], [c.name]])}
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
  $app.innerHTML = `${pageHead('التحقق من بطاقة المشارك')}
    <section class="section container" style="max-width:640px">
      <div class="panel center">
        ${c ? `<div style="font-size:64px">✅</div><h2 style="color:var(--green-700)">بطاقة سارية المفعول</h2>
          <table class="list" style="text-align:start"><tbody>
            <tr><th>الاسم</th><td>${esc(c.name)}</td></tr>
            <tr><th>الرقم الوظيفي</th><td>${esc(c.employeeId)}</td></tr>
            <tr><th>الإدارة / المكتب</th><td>${esc(c.department)}</td></tr>
            <tr><th>المشاركة</th><td>${esc(c.activity.title)}</td></tr>
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
  $app.innerHTML = `${pageHead('الدعم والشكاوى', 'طلبات الدعم والتجهيز للمشاركين، والشكاوى والمقترحات — نتابعها حتى الحل')}
    <section class="section container layout-2">
      <div class="panel" id="cPanel">
        <h3>📨 تقديم طلب دعم أو شكوى أو مقترح</h3>
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
  [/^\/teams$/, () => pageTeams()],
  [/^\/talents$/, () => pageTalents()],
  [/^\/achievements$/, () => pageAchievements()],
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
