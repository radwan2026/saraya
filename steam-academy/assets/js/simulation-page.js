/* صفحة منصة محاكاة ستيم: الدروس، الباقات، الاشتراك أونلاين، وتفعيل الكود */
(function () {
  "use strict";
  const C = window.STEAM_CONFIG;
  const SIM = C.simulation || {};
  const A = window.STEAM_ACCESS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const appUrl = SIM.appUrl || "simulation/index.html";
  $$("[data-sim-app]").forEach((a) => (a.href = appUrl));

  /* ---------- الدروس (من بيانات المنصة نفسها) ---------- */
  const LEVELS = ["مبتدئ", "متوسط", "متقدم"];
  function renderLessons() {
    const grid = $("[data-sim-lessons]");
    if (!grid || !window.LESSONS) return;
    const st = A.status();
    grid.innerHTML = window.LESSONS.map((l, i) => {
      const free = A.isLessonFree(i);
      const open = free || st.active;
      let scene = "";
      try { scene = window.buildScene ? buildScene(l, { showAll: true }) : ""; } catch { scene = ""; }
      return `
        <article class="sim-lesson card reveal">
          <a class="sim-thumb bench-grid" href="${esc(appUrl)}" aria-label="افتح درس ${esc(l.title.ar)}">
            ${scene || `<span class="sim-emoji">${l.emoji || "🔬"}</span>`}
            <span class="sim-num">${i + 1}</span>
            <span class="sim-flag ${free ? "free" : open ? "open" : "lock"}">${free ? "مجاني" : open ? "✓ مفتوح" : "🔒 للمشتركين"}</span>
          </a>
          <div class="sim-body">
            <div class="sim-meta"><span>${esc(l.category?.ar || "")}</span><span>${LEVELS[(l.level || 1) - 1] || ""}</span><span>⏱ ${esc(l.minutes || 10)} د</span></div>
            <h3>${l.emoji || ""} ${esc(l.title.ar)}</h3>
            <p>${esc(l.concept?.ar || "")}</p>
          </div>
        </article>`;
    }).join("");
    const n = $("[data-sim-count]"); if (n) n.textContent = window.LESSONS.length;
    $$("[data-sim-free]").forEach((e) => (e.textContent = A.freeLessons));
  }

  /* ---------- الباقات ---------- */
  function renderPlans() {
    const el = $("[data-sim-plans]");
    if (!el) return;
    const plans = SIM.plans || [];
    el.innerHTML = plans.map((p) => `
      <div class="plan card reveal${p.highlight ? " hot" : ""}">
        ${p.highlight ? '<span class="plan-tag">الأكثر طلباً</span>' : ""}
        <h3>${esc(p.name)}</h3>
        <div class="plan-price">${p.price ? `<strong>${esc(p.price)}</strong>${p.period ? `<span>/ ${esc(p.period)}</span>` : ""}` : `<strong class="ask">يُحدَّد عند التواصل</strong>${p.period ? `<span>${esc(p.period)}</span>` : ""}`}</div>
        <ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        ${p.id === "trial"
          ? `<a class="btn btn-ghost" href="${esc(appUrl)}">ابدأ التجربة الآن</a>`
          : `<button class="btn ${p.highlight ? "btn-gold" : "btn-primary"}" type="button" data-pick-plan="${esc(p.id)}">اشترك في هذه الباقة</button>`}
      </div>`).join("");

    const sel = $("#s-plan");
    if (sel) {
      sel.innerHTML = plans.filter((p) => p.id !== "trial").map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.period ? " — " + esc(p.period) : ""}${p.price ? " (" + esc(p.price) + ")" : ""}</option>`).join("");
      const hot = plans.find((p) => p.highlight && p.id !== "trial");
      if (hot) sel.value = hot.id;
    }
    $$("[data-pick-plan]", el).forEach((b) => b.addEventListener("click", () => {
      if (sel) sel.value = b.dataset.pickPlan;
      $("#subscribe-form").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => $("#s-student")?.focus({ preventScroll: true }), 500);
    }));
  }

  /* ---------- نموذج الاشتراك أونلاين ---------- */
  function initForm() {
    const f = $("#subscribe-form");
    if (!f) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      const plan = (SIM.plans || []).find((p) => p.id === d.plan);
      const id = "SIM-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const lines = [
        `طلب اشتراك جديد — منصة محاكاة ستيم`,
        `رقم الطلب: ${id}`,
        `الباقة: ${plan ? plan.name + (plan.period ? " (" + plan.period + ")" : "") : d.plan}`,
        `اسم الطالب: ${d.student}`,
        `العمر: ${d.age}`,
        `ولي الأمر: ${d.guardian}`,
        `الهاتف: ${d.phone}`,
        `البريد: ${d.email || "-"}`,
        `المدينة: ${d.city || "-"}`,
        `المدرسة: ${d.school || "-"}`,
        `ملاحظات: ${d.notes || "-"}`,
      ];
      const btn = $("button[type=submit]", f);
      const note = $(".form-note", f);
      btn.disabled = true; note.style.color = ""; note.textContent = "جارٍ إرسال الطلب…";

      let sent = false, via = "";
      if (SIM.subscribeEndpoint) {
        try {
          const body = new FormData(f);
          body.append("request_id", id);
          body.append("plan_name", plan ? plan.name : d.plan);
          body.append("_subject", `طلب اشتراك محاكاة ستيم ${id}`);
          const r = await fetch(SIM.subscribeEndpoint, { method: "POST", body, headers: { Accept: "application/json" } });
          sent = r.ok; via = "online";
        } catch { sent = false; }
      }
      if (!sent) {
        const text = lines.join("\n");
        if (C.contact.whatsapp) { window.open(`https://wa.me/${C.contact.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener"); via = "whatsapp"; }
        else { window.location.href = `mailto:${C.contact.email}?subject=${encodeURIComponent("طلب اشتراك محاكاة ستيم " + id)}&body=${encodeURIComponent(text)}`; via = "email"; }
        sent = true;
      }
      btn.disabled = false;
      note.textContent = "";
      const done = $("#subscribe-done");
      $("[data-req-id]", done).textContent = id;
      $("[data-req-via]", done).textContent = via === "online"
        ? "وصل طلبك إلى الأكاديمية بنجاح."
        : via === "whatsapp" ? "فُتحت محادثة واتساب برسالة الطلب — اضغط «إرسال» هناك لإتمامه."
        : "فُتح برنامج البريد برسالة الطلب — اضغط «إرسال» هناك لإتمامه.";
      $("[data-pay-note]", done).textContent = SIM.paymentNote || "";
      f.hidden = true; done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("#subscribe-again")?.addEventListener("click", () => { f.reset(); f.hidden = false; $("#subscribe-done").hidden = true; renderPlans(); });
  }

  /* ---------- تفعيل الكود ---------- */
  function renderStatus() {
    const box = $("[data-access-status]");
    if (!box) return;
    const st = A.status();
    if (st.active) {
      box.className = "access-status ok";
      box.innerHTML = `✓ اشتراكك مفعّل${st.name ? " باسم <b>" + esc(st.name) + "</b>" : ""}${st.expires ? " حتى <b dir=\"ltr\">" + esc(st.expires) + "</b>" : ""}${st.daysLeft != null ? ` (متبقٍ ${st.daysLeft} يوماً)` : ""}. <a href="${esc(appUrl)}">ادخل المنصة ←</a>`;
    } else if (st.reason === "expired") {
      box.className = "access-status warn";
      box.innerHTML = `انتهى اشتراكك في <b dir="ltr">${esc(st.expires)}</b>. <a href="#subscribe">جدّد الاشتراك ←</a>`;
    } else {
      box.className = "access-status";
      box.textContent = `أنت تستخدم النسخة التجريبية (${A.freeLessons} دروس مجانية).`;
    }
  }

  function initActivate() {
    const f = $("#activate-form");
    if (!f) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = $(".form-note", f);
      const r = await A.activate($("#a-code").value);
      note.style.color = r.ok ? "" : "#fb7185";
      note.textContent = r.message;
      if (r.ok) { renderStatus(); renderLessons(); reveal(); $("#a-code").value = ""; }
    });
  }

  function reveal() { $$("[data-sim-lessons] .reveal, [data-sim-plans] .reveal").forEach((e) => e.classList.add("in")); }

  function boot() {
    renderLessons(); renderPlans(); initForm(); initActivate(); renderStatus();
    // العناصر التي تُبنى ديناميكياً تظهر مباشرة
    setTimeout(reveal, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
