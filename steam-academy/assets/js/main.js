/* أكاديمية ستيم — سكربت الواجهة المشترك */
(function () {
  "use strict";
  const C = window.STEAM_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const page = document.body.dataset.page || "home";

  const ICON = {
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };
  window.STEAM_ICON = ICON;

  const GAMES = [
    { title: "لعبة المؤمن الصغير", ic: "🌙", desc: "قصص تفاعلية من سيرة الخلفاء الراشدين بأسلوب ممتع يناسب الأطفال.",
      items: [
        ["أبوبكر الصديق", "https://steamacademy.ly/wp/wp-content/uploads/moamen/abu_bakr_lesson.html"],
        ["عمر بن الخطاب", "https://steamacademy.ly/wp/wp-content/uploads/moamen/omar_ibn_khattab_lesson.html"],
        ["عثمان بن عفان", "https://steamacademy.ly/wp/wp-content/uploads/moamen/uthman_ibn_affan_lesson.html"],
        ["علي بن أبي طالب", "https://steamacademy.ly/wp/wp-content/uploads/moamen/ali_ibn_abi_talib_lesson.html"],
      ] },
    { title: "المحقق الصغير", ic: "🔍", desc: "ألغاز علمية ومحاكاة تفاعلية تنمّي التفكير الناقد وحل المشكلات.",
      items: [
        ["سر النباتات الذابلة", "https://steamacademy.ly/wp/wp-content/uploads/game2026/simulation.html"],
        ["لغز سر الماء المختفي", "https://steamacademy.ly/wp/wp-content/uploads/game2026/2.html"],
      ] },
  ];
  window.STEAM_GAMES = GAMES;

  /* ---------------- الهيدر والفوتر ---------------- */
  function navLink(href, label, key) {
    return `<a href="${href}"${page === key ? ' class="active" aria-current="page"' : ""}>${label}</a>`;
  }

  function renderHeader() {
    const el = $("#site-header");
    if (!el) return;
    const gamesMenu = GAMES.map((g) => `<h5>${g.ic} ${g.title}</h5>` + g.items.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join("")).join("");
    el.innerHTML = `
      <div class="topbar">
        <div class="container">
          <span>أكاديمية ستيم لإثراء العلوم — ليبيا</span>
          <div class="topbar-links">
            <a href="${C.links.joinTeam}">انضم إلى فريقنا</a>
            <a href="${C.links.profile}">الصفحة الشخصية</a>
          </div>
        </div>
      </div>
      <header class="header">
        <div class="container">
          <a class="brand" href="index.html" aria-label="أكاديمية ستيم — الرئيسية">
            <img src="assets/img/logo-mark.png" alt="" width="46" height="46">
            <span class="brand-text"><strong>أكاديمية ستيم</strong><span>STEAM ACADEMY</span></span>
          </a>
          <nav class="nav" id="main-nav" aria-label="القائمة الرئيسية">
            ${navLink("index.html", "الرئيسية", "home")}
            ${navLink("courses.html", "الدورات التدريبية", "courses")}
            <a href="stemo.html" class="nav-stemo${page === "stemo" ? " active" : ""}"><span class="dot"></span>ستيمو للبرمجة</a>
            <div class="nav-drop">
              <button type="button" aria-haspopup="true" aria-expanded="false">الألعاب ${ICON.chev}</button>
              <div class="drop-menu">${gamesMenu}</div>
            </div>
            ${navLink(page === "home" ? "#about" : "index.html#about", "من نحن", "about")}
            ${navLink(page === "home" ? "#contact" : "index.html#contact", "اتصل بنا", "contact")}
          </nav>
          <div class="header-cta">
            <a class="btn btn-ghost btn-sm" href="${C.links.login}">${ICON.user} تسجيل الدخول</a>
            <a class="btn btn-primary btn-sm" href="courses.html">سجّل طفلك الآن</a>
            <button class="menu-toggle" type="button" aria-label="فتح القائمة" aria-controls="main-nav" aria-expanded="false">${ICON.menu}</button>
          </div>
        </div>
      </header>`;

    const toggle = $(".menu-toggle", el);
    const nav = $("#main-nav", el);
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
      toggle.innerHTML = open ? ICON.close : ICON.menu;
    });
    $$(".nav-drop > button", el).forEach((b) =>
      b.addEventListener("click", () => {
        const open = b.parentElement.classList.toggle("open");
        b.setAttribute("aria-expanded", open);
      })
    );
    $$("#main-nav > a", el).forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open"); toggle.innerHTML = ICON.menu; toggle.setAttribute("aria-expanded", "false");
    }));
  }

  function renderFooter() {
    const el = $("#site-footer");
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <a class="footer-logo" href="index.html"><img src="assets/img/logo-full.png" alt="أكاديمية ستيم لألعاب العلوم" width="138" height="64"></a>
              <p>أكاديمية ستيم لإثراء العلوم مؤسسة تعليمية مبتكرة في ليبيا تُبسّط العلوم والتكنولوجيا والهندسة والفنون والرياضيات للأطفال عبر الألعاب والتجارب العملية.</p>
            </div>
            <div>
              <h4>الأكاديمية</h4>
              <ul>
                <li><a href="index.html#about">من نحن</a></li>
                <li><a href="index.html#levels">المستويات التدريبية</a></li>
                <li><a href="index.html#team">فريق الأكاديمية</a></li>
                <li><a href="${C.links.joinTeam}">انضم لفريق ستيم</a></li>
              </ul>
            </div>
            <div>
              <h4>التعلّم</h4>
              <ul>
                <li><a href="courses.html">الدورات التدريبية</a></li>
                <li><a href="stemo.html">منصة ستيمو للبرمجة</a></li>
                <li><a href="index.html#games">الألعاب التعليمية</a></li>
                <li><a href="${C.links.codeOrg}" target="_blank" rel="noopener">منصة Code.org</a></li>
              </ul>
            </div>
            <div>
              <h4>حسابي</h4>
              <ul>
                <li><a href="${C.links.login}">تسجيل الدخول</a></li>
                <li><a href="${C.links.profile}">الصفحة الشخصية</a></li>
                <li><a href="${C.stemo.login}" target="_blank" rel="noopener">دخول ستيمو</a></li>
                <li><a href="${C.stemo.register}" target="_blank" rel="noopener">تسجيل طالب في ستيمو</a></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${year} أكاديمية ستيم لإثراء العلوم. جميع الحقوق محفوظة.</span>
            <span>صُنع بشغف لجيل المبتكرين 💜</span>
          </div>
        </div>
      </footer>
      <button class="to-top" type="button" aria-label="العودة للأعلى">${ICON.up}</button>`;

    const top = $(".to-top", el);
    top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("scroll", () => top.classList.toggle("show", window.scrollY > 600), { passive: true });
  }

  /* ---------------- رسمة منصة ستيمو (SVG) ---------------- */
  function stemoArt() {
    return `
<svg viewBox="0 0 560 420" role="img" aria-label="منصة ستيمو: روبوت يتحرك بأوامر برمجية بالسحب والإفلات">
  <defs>
    <linearGradient id="sa-win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2160"/><stop offset="1" stop-color="#140f3e"/></linearGradient>
    <linearGradient id="sa-bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e3ff"/></linearGradient>
    <linearGradient id="sa-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b6cff"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
    <linearGradient id="sa-mag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d14fa0"/><stop offset="1" stop-color="#9b4fd1"/></linearGradient>
    <pattern id="sa-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="rgba(150,180,255,.12)" stroke-width="1"/></pattern>
    <filter id="sa-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>

  <!-- نافذة المتصفح -->
  <rect x="10" y="20" width="540" height="370" rx="22" fill="url(#sa-win)" stroke="rgba(56,189,248,.45)" stroke-width="1.5"/>
  <rect x="10" y="20" width="540" height="44" rx="22" fill="rgba(255,255,255,.05)"/>
  <circle cx="38" cy="42" r="6" fill="#ff6b8b"/><circle cx="58" cy="42" r="6" fill="#ffd84a"/><circle cx="78" cy="42" r="6" fill="#34d399"/>
  <rect x="150" y="30" width="260" height="24" rx="12" fill="rgba(0,0,0,.28)"/>
  <text x="280" y="47" text-anchor="middle" fill="#9fdcff" font-family="ui-monospace,monospace" font-size="12.5">🔒 stemo-coding.pages.dev</text>

  <!-- لوحة الأوامر (يمين في RTL) -->
  <rect x="350" y="80" width="182" height="292" rx="16" fill="rgba(0,0,0,.22)"/>
  <text x="441" y="106" text-anchor="middle" fill="#c4bce0" font-family="Cairo,Tajawal,sans-serif" font-size="13" font-weight="700">أوامر البرمجة</text>
  <g font-family="Cairo,Tajawal,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">
    <g class="blk-float"><rect x="366" y="120" width="150" height="36" rx="10" fill="#34d399"/><path d="M396 120v6h14v-6" fill="#2bb886"/><text x="441" y="143">▶ عند البدء</text></g>
    <g class="blk-float d2"><rect x="366" y="166" width="150" height="36" rx="10" fill="#5b6cff"/><text x="441" y="189">تقدّم 3 خطوات</text></g>
    <g class="blk-float d3"><rect x="366" y="212" width="150" height="36" rx="10" fill="#f59e0b"/><text x="441" y="235">🔁 كرّر 4 مرات</text></g>
    <g class="blk-float"><rect x="382" y="254" width="134" height="32" rx="10" fill="#38bdf8"/><text x="449" y="275">استدر ↺ 90°</text></g>
    <g class="blk-float d2"><rect x="366" y="296" width="150" height="36" rx="10" fill="#d14fa0"/><text x="441" y="319">إذا رأيت جداراً؟</text></g>
  </g>

  <!-- ساحة الروبوت -->
  <rect x="28" y="80" width="306" height="292" rx="16" fill="url(#sa-grid)" stroke="rgba(150,180,255,.15)"/>
  <!-- المسار -->
  <path d="M70 330 H200 V200 H290" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity=".9"/>
  <circle cx="70" cy="330" r="8" fill="#34d399"/>
  <!-- الهدف -->
  <g transform="translate(290 128)">
    <circle r="26" fill="#ffd84a" opacity=".25" filter="url(#sa-glow)"/>
    <path d="M-4 18 V-22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M-4 -22 L20 -14 L-4 -6 Z" fill="#ffd84a"/>
  </g>

  <!-- الروبوت ستيمو -->
  <g transform="translate(196 222)"><g class="bot-float">
    <ellipse cx="0" cy="92" rx="54" ry="10" fill="rgba(0,0,0,.35)"/>
    <line x1="0" y1="-62" x2="0" y2="-44" stroke="#c9d6ff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="0" cy="-66" r="8" fill="url(#sa-mag)"/>
    <rect x="-56" y="-46" width="112" height="84" rx="30" fill="url(#sa-bot)"/>
    <rect x="-42" y="-32" width="84" height="54" rx="20" fill="#0c0a26"/>
    <g fill="#38bdf8">
      <rect class="bot-eye" x="-24" y="-16" width="14" height="20" rx="7"/>
      <rect class="bot-eye" x="10" y="-16" width="14" height="20" rx="7"/>
    </g>
    <path d="M-12 10 Q0 18 12 10" stroke="#38bdf8" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="-64" y="-8" width="10" height="26" rx="5" fill="#9b4fd1"/>
    <rect x="54" y="-8" width="10" height="26" rx="5" fill="#9b4fd1"/>
    <rect x="-40" y="42" width="80" height="38" rx="14" fill="url(#sa-bot)"/>
    <circle cx="0" cy="61" r="9" fill="url(#sa-mag)"/>
    <circle cx="-28" cy="84" r="9" fill="#2a2160"/><circle cx="28" cy="84" r="9" fill="#2a2160"/>
  </g></g>

  <!-- شارات -->
  <g transform="translate(40 96)" font-family="Cairo,Tajawal,sans-serif" font-weight="800">
    <rect width="98" height="34" rx="17" fill="rgba(255,216,74,.16)" stroke="#ffd84a" stroke-opacity=".5"/>
    <text x="49" y="23" text-anchor="middle" fill="#ffd84a" font-size="14">⭐ +50 XP</text>
  </g>

  <!-- زر الدخول داخل الرسم -->
  <g transform="translate(150 392)" font-family="Cairo,Tajawal,sans-serif">
    <rect x="0" y="-18" width="260" height="44" rx="22" fill="url(#sa-cyan)"/>
    <text x="130" y="10" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">ابدأ المغامرة البرمجية 🚀</text>
  </g>
</svg>`;
  }
  window.STEAM_STEMO_ART = stemoArt;

  function renderStemoPromo() {
    $$("[data-stemo-promo]").forEach((el) => {
      el.innerHTML = `
        <div class="stemo-promo reveal">
          <div>
            <span class="stemo-logo"><span class="bot">🤖</span><span>STEMO<small>CODING &amp; ROBOTICS</small></span></span>
            <h2>منصة <span style="color:var(--cyan)">ستيمو</span> لتعليم البرمجة والروبوتات</h2>
            <p class="lead">منصة تفاعلية مدعومة بالذكاء الاصطناعي من أكاديمية ستيم، يتعلّم فيها طفلك البرمجة بسحب وإفلات أوامر ملوّنة لتحريك الروبوت «ستيمو» — دون أي خبرة سابقة.</p>
            <ul class="stemo-points">
              <li>19 درساً</li><li>4 مستويات</li><li>+50 أمراً برمجياً</li><li>مرشد ذكي بالذكاء الاصطناعي</li><li>للأعمار 7–16</li>
            </ul>
            <div class="hero-actions" style="margin-top:0">
              <a class="btn btn-cyan" href="${C.stemo.url}" target="_blank" rel="noopener">ادخل منصة ستيمو ${ICON.ext}</a>
              <a class="btn btn-ghost" href="stemo.html">تعرّف على المنصة</a>
            </div>
            <a class="stemo-url" href="${C.stemo.url}" target="_blank" rel="noopener">${ICON.ext.replace("<svg", '<svg width="16" height="16"')} stemo-coding.pages.dev</a>
          </div>
          <div class="stemo-art">
            <a class="stemo-photo" href="${C.stemo.url}" target="_blank" rel="noopener" aria-label="افتح منصة ستيمو للبرمجة والروبوتات">
              <img src="${C.stemo.image}" alt="طفل يبرمج الروبوت ستيمو على منصة ستيمو للبرمجة" width="1024" height="688" loading="lazy" data-stemo-img>
              <span class="stemo-photo-cta">ادخل المنصة ↗</span>
            </a>
          </div>
        </div>`;
    });
  }

  /* صور ستيمو: إن لم يوجد ملف الصورة تُستبدل بالرسم التوضيحي تلقائياً */
  function initStemoImages() {
    $$("img[data-stemo-img]").forEach((img) => {
      const swap = () => {
        const wrap = img.closest(".stemo-photo, .stemo-banner");
        if (!wrap) return;
        if (wrap.classList.contains("stemo-banner")) { wrap.closest("section")?.remove(); return; }
        wrap.classList.add("is-art");
        wrap.innerHTML = stemoArt();
      };
      const probe = new Image();
      probe.onerror = swap;
      probe.src = img.src;
    });
  }

  /* ---------------- لوحات المتصدرين من ستيمو ---------------- */
  async function getJSON(url, timeout = 9000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal, credentials: "omit" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  const fmt = (n) => Number(n || 0).toLocaleString("en-US");

  async function renderLeaderboards() {
    const st = $("[data-board='students']");
    const sc = $("[data-board='schools']");
    if (!st && !sc) return;
    // إن تعذّر الجلب (مثلاً لم تُضف منصة ستيمو نطاق الموقع لقائمة CORS) نعرض بطاقة تدعو لفتح اللوحة على ستيمو
    const fail = (el) => el && (el.innerHTML = `
      <li style="display:block;text-align:center;padding:36px 18px">
        <div style="font-size:40px">🏆</div>
        <strong style="display:block;font-size:17px;margin:6px 0 4px">شاهد المتصدرين على منصة ستيمو</strong>
        <span style="display:block;color:var(--text-3);font-size:14px;margin-bottom:16px">النتائج تتحدّث لحظياً داخل المنصة</span>
        <a class="btn btn-cyan btn-sm" href="${C.stemo.url}#landing-leaderboard" target="_blank" rel="noopener">عرض لوحة المتصدرين ↗</a>
      </li>`);
    if (st) {
      try {
        const d = await getJSON(`${C.stemo.api}/leaderboard`);
        const list = (d.results || []).slice(0, 10);
        st.innerHTML = list.length ? list.map((r) => `
          <li><span class="pos">${esc(r.rank)}</span>
            <span class="who"><strong dir="auto">${esc(r.display_name)}</strong><span>${r.school_name ? "🏫 " + esc(r.school_name) + " · " : ""}المستوى ${esc(r.level)}</span></span>
            <span class="xp">${fmt(r.xp)} XP</span></li>`).join("") : "";
        const tot = $("[data-stemo-total]");
        if (tot && d.total) tot.textContent = fmt(d.total);
      } catch { fail(st); }
    }
    if (sc) {
      try {
        const d = await getJSON(`${C.stemo.api}/schools-leaderboard`);
        const list = (d.results || []).slice(0, 6);
        sc.innerHTML = list.map((r) => `
          <li><span class="pos">${esc(r.rank)}</span>
            <span class="who"><strong dir="auto">${esc(r.school_name)}</strong><span>${fmt(r.students)} طالب</span></span>
            <span class="xp">${fmt(r.total_xp)} XP</span></li>`).join("");
        const tot = $("[data-stemo-schools]");
        if (tot) tot.textContent = fmt(d.results.length);
      } catch { fail(sc); }
    }
  }

  /* ---------------- الدورات من ووردبريس ---------------- */
  const FALLBACK_COURSES = [
    { id: 865, title: "المحقق الذكي: كيف نفهم ما يحدث؟", cat: "ألعاب تعليمية", img: "2026/02/8888.jpg", excerpt: "دورة تفاعلية قائمة على مجموعة ألعاب قصصية قصيرة موجّهة للأطفال من عمر 8 إلى 10 سنوات، تنمّي التفكير الناقد والملاحظة.", slug: "المحقق-الذكي-كيف-نفهم-ما-يحدث؟" },
    { id: 862, title: "الذكاء الاصطناعي – المستوى الأول", cat: "البرمجة", img: "2026/02/888.jpg", excerpt: "دورة تمهيدية صُمّمت لتعريف الأطفال بمفهوم الذكاء الاصطناعي بطريقة بسيطة وعملية وممتعة.", slug: "الذكاء-الإصطناعي-المستوى-الأول" },
    { id: 298, title: "الأمن السيبراني – المستوى الثاني", cat: "أمن سيبراني", img: "2025/12/222.jpg", excerpt: "يتعمّق الطفل في مفاهيم حماية البيانات والحسابات والتصفح الآمن عبر تحديات وأنشطة عملية.", slug: "الأمن-السيبراني-المستوى-الثاني" },
    { id: 272, title: "النماذج الهندسية – المستوى الثاني", cat: "نماذج هندسية", img: "2025/12/4444.jpg", excerpt: "بناء نماذج هندسية متحركة كالمصعد الهيدروليكي والقارب المروحي لفهم مبادئ الميكانيكا والطاقة.", slug: "النماذج-الهندسية-المستوى-الثاني" },
    { id: 264, title: "تعلّم البرمجة بسكراتش", cat: "البرمجة", img: "2025/12/666.jpg", excerpt: "تعلّم تفكير المبرمج بطريقة بسيطة وممتعة دون الحاجة لكتابة أكواد معقدة، عبر بناء القصص والألعاب.", slug: "تعلم-البرمجة-بسكراتش" },
    { id: 224, title: "النماذج الهندسية – المستوى الأول", cat: "نماذج هندسية", img: "2025/12/5555.jpg", excerpt: "مدخل عملي لعالم الهندسة: يصنع الطفل مجسّمات ونماذج بسيطة كالسيارة والمروحة بيديه.", slug: "النماذج-الهندسية-المستوى-الاول" },
    { id: 186, title: "الأمن السيبراني – المستوى الأول", cat: "أمن سيبراني", img: "2025/12/333.jpg", excerpt: "أساسيات الأمان الرقمي للأطفال: كلمات المرور القوية، الخصوصية، والتعامل الآمن مع الإنترنت.", slug: "الأمن-السيبراني-المستوى-الأول" },
    { id: 119, title: "الروبوتات", cat: "روبوتات", img: "2025/11/6666.jpg", excerpt: "يتعلّم الأطفال بناء الروبوتات وبرمجتها بالمحركات وأجهزة الاستشعار والتروس لأداء مهام حقيقية.", slug: "الروبوتات" },
    { id: 71, title: "مقدمة في برمجة البايثون", cat: "البرمجة", img: "2025/11/77777.jpg", excerpt: "يتعرّف المتدرب على أساسيات البرمجة بلغة بايثون ويصبح قادراً على تنفيذ التعليمات وتركيب البرامج وحل المسائل.", slug: "دورة-الروبوتات-المستوى-الأول" },
  ].map((c) => ({ ...c, img: `${C.wpBase}/wp-content/uploads/${c.img}`, link: `${C.wpBase}/courses/${encodeURIComponent(c.slug)}/` }));

  const CAT_EMOJI = { "البرمجة": "💻", "روبوتات": "🤖", "نماذج هندسية": "⚙️", "أمن سيبراني": "🛡️", "ألعاب تعليمية": "🎮", "عام": "✨" };
  const guessCat = (t) => /سيبر/.test(t) ? "أمن سيبراني" : /روبوت/.test(t) ? "روبوتات" : /هندس/.test(t) ? "نماذج هندسية" : /برمج|بايثون|سكراتش|ذكاء/.test(t) ? "البرمجة" : "عام";

  function decode(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").replace(/\s*\[…\]|\s*\[&hellip;\]/g, "…").replace(/\s+/g, " ").trim();
  }

  async function fetchCourses() {
    const base = `${C.wpBase}/wp-json/wp/v2`;
    const [courses, cats] = await Promise.all([
      getJSON(`${base}/lp_course?per_page=100&_embed=wp:featuredmedia&_fields=id,link,title,excerpt,course_category,_links,_embedded`),
      getJSON(`${base}/course_category?per_page=100&_fields=id,name`).catch(() => []),
    ]);
    const catMap = Object.fromEntries((cats || []).map((c) => [c.id, decode(c.name)]));
    return courses.map((c) => {
      const title = decode(c.title?.rendered);
      const media = c._embedded?.["wp:featuredmedia"]?.[0];
      const img = media?.media_details?.sizes?.medium_large?.source_url || media?.source_url || "";
      const fb = FALLBACK_COURSES.find((f) => f.id === c.id);
      return {
        id: c.id, title, link: c.link, img: img || fb?.img || "",
        cat: catMap[(c.course_category || [])[0]] || guessCat(title),
        excerpt: decode(c.excerpt?.rendered) || fb?.excerpt || "دورة تفاعلية من أكاديمية ستيم تجمع بين اللعب والتجربة العملية.",
      };
    });
  }

  function courseCard(c) {
    return `
      <article class="course card reveal">
        <a class="course-thumb" href="${esc(c.link)}" tabindex="-1" aria-hidden="true">
          ${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
          <span class="badge">${CAT_EMOJI[c.cat] || "✨"} ${esc(c.cat)}</span>
        </a>
        <div class="course-body">
          <h3><a href="${esc(c.link)}">${esc(c.title)}</a></h3>
          <p>${esc(c.excerpt)}</p>
          <div class="course-foot">
            <span class="meta">أكاديمية ستيم</span>
            <a class="link" href="${esc(c.link)}">التفاصيل والتسجيل ${ICON.arrow.replace("<svg", '<svg width="18" height="18"')}</a>
          </div>
        </div>
      </article>`;
  }

  async function renderCourses() {
    const grid = $("[data-courses]");
    if (!grid) return;
    const limit = Number(grid.dataset.limit || 0);
    grid.innerHTML = Array.from({ length: limit || 6 }, () => '<div class="card skeleton"></div>').join("");

    let courses;
    try { courses = await fetchCourses(); if (!courses.length) throw 0; }
    catch { courses = FALLBACK_COURSES; }

    const filtersEl = $("[data-course-filters]");
    const searchEl = $("[data-course-search]");
    let cat = "الكل", q = "";

    const draw = () => {
      let list = courses.filter((c) => (cat === "الكل" || c.cat === cat) && (!q || (c.title + " " + c.excerpt).includes(q)));
      if (limit) list = list.slice(0, limit);
      grid.innerHTML = list.length ? list.map(courseCard).join("") : `<p class="empty">لا توجد دورات مطابقة لبحثك حالياً.</p>`;
      observeReveal(grid);
    };

    if (filtersEl) {
      const cats = ["الكل", ...new Set(courses.map((c) => c.cat))];
      filtersEl.innerHTML = cats.map((c) => `<button class="chip" type="button" aria-pressed="${c === cat}">${c === "الكل" ? "🌟" : CAT_EMOJI[c] || "✨"} ${esc(c)}</button>`).join("");
      $$(".chip", filtersEl).forEach((b, i) => b.addEventListener("click", () => {
        cat = cats[i];
        $$(".chip", filtersEl).forEach((x, j) => x.setAttribute("aria-pressed", j === i));
        draw();
      }));
    }
    if (searchEl) searchEl.addEventListener("input", (e) => { q = e.target.value.trim(); draw(); });
    const count = $("[data-course-count]");
    if (count) count.textContent = courses.length;
    draw();
  }

  /* ---------------- الألعاب ---------------- */
  function renderGames() {
    const el = $("[data-games]");
    if (!el) return;
    el.innerHTML = GAMES.map((g) => `
      <div class="game card reveal">
        <div class="ic">${g.ic}</div>
        <h3>${g.title}</h3>
        <p>${g.desc}</p>
        <div class="game-links">${g.items.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}<span>العب الآن ←</span></a>`).join("")}</div>
      </div>`).join("");
  }

  /* ---------------- نموذج التواصل ---------------- */
  function initContact() {
    const f = $("#contact-form");
    if (!f) return;
    const info = $("[data-contact-info]");
    if (info) {
      const c = C.contact;
      const rows = [
        c.email && `<li><i>✉️</i><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`,
        c.phone && `<li><i>📞</i><a href="tel:${esc(c.phone.replace(/\s/g, ""))}" dir="ltr">${esc(c.phone)}</a></li>`,
        c.whatsapp && `<li><i>💬</i><a href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">راسلنا على واتساب</a></li>`,
        c.city && `<li><i>📍</i><span>${esc(c.city)}</span></li>`,
      ].filter(Boolean);
      info.innerHTML = rows.join("");
    }
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      const body = `الاسم: ${d.name}\nالبريد: ${d.email}\nالهاتف: ${d.phone || "-"}\nنوع الطلب: ${d.topic}\n\n${d.message}`;
      window.location.href = `mailto:${C.contact.email}?subject=${encodeURIComponent("رسالة من موقع أكاديمية ستيم — " + d.topic)}&body=${encodeURIComponent(body)}`;
      $(".form-note", f).textContent = "✓ تم تجهيز رسالتك في برنامج البريد — اضغط «إرسال» هناك لإتمامها.";
    });
  }

  /* ---------------- الظهور التدريجي ---------------- */
  let io;
  function observeReveal(root = document) {
    if (!("IntersectionObserver" in window)) { $$(".reveal", root).forEach((e) => e.classList.add("in")); return; }
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal:not(.in)", root).forEach((e) => io.observe(e));
  }

  /* ---------------- عدّادات ---------------- */
  function initCounters() {
    $$("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      let started = false;
      const run = () => {
        if (started) return; started = true;
        const t0 = performance.now(), dur = 1400;
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      if ("IntersectionObserver" in window) {
        const o = new IntersectionObserver((en) => { if (en[0].isIntersecting) { run(); o.disconnect(); } });
        o.observe(el);
      } else run();
    });
  }

  renderHeader();
  renderFooter();
  renderStemoPromo();
  renderGames();
  initStemoImages();
  initContact();
  observeReveal();
  initCounters();
  renderCourses();
  renderLeaderboards();
})();
