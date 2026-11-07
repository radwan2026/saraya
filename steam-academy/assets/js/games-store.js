/* أكاديمية ستيم — متجر «ألعاب ستيم»
   - تجربة مجانية محدودة بالوقت لكل لعبة ثم تُقفل
   - نافذة شراء: رقم الحساب المصرفي + رفع صورة الحوالة وإرسالها للبريد
   - فتح اللعبة/تحميلها بكود يصدر من الأكاديمية بعد التحقق من الحوالة
   ملاحظة: التحقق يتم في المتصفح (موقع ثابت) — حماية مناسبة للاستخدام العادي وليست حماية خادمية. */
(function () {
  "use strict";
  const C = window.STEAM_CONFIG || {};
  const G = C.games || { list: [], codes: [] };
  const PAY = C.payments || {};
  const OWN_KEY = "steamGames.owned.v1";
  const PREV_KEY = "steamGames.preview.v1";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);

  // جذر الموقع (تعمل الصفحات من الجذر ومن مجلد games/)
  const ROOT = (document.currentScript && document.currentScript.src.replace(/assets\/js\/games-store\.js.*$/, "")) || "";
  const abs = (p) => (!p ? "" : /^(https?:|data:|\/)/.test(p) ? p : ROOT + p);

  const store = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

  const normalize = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  async function sha256(t) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  const notExpired = (e) => !e.expires || Date.now() <= new Date(e.expires + "T23:59:59").getTime();
  const codeFor = (hash, gameId) => (G.codes || []).find((c) => c && c.hash === hash && (c.game === gameId || c.game === "*"));

  const list = () => (G.list || []).filter((g) => g && g.id);
  const get = (id) => list().find((g) => g.id === id);
  const price = (g) => (g.price || g.price === 0) ? `${g.price} ${G.currency || "د.ل"}` : "حسب الطلب";
  const previewSec = (g) => Math.round(60 * (g.previewMinutes ?? G.defaultPreviewMinutes ?? 3));

  /* ---------- الملكية ---------- */
  function owned(id) {
    const h = store(OWN_KEY)[id];
    if (!h) return false;
    const e = codeFor(h, id);
    return !!(e && notExpired(e));
  }
  async function redeem(id, code) {
    const n = normalize(code);
    if (n.length < 8) return { ok: false, message: "الكود قصير — تأكد من كتابته كاملاً." };
    if (!window.crypto || !crypto.subtle) return { ok: false, message: "المتصفح لا يدعم التحقق. افتح الصفحة عبر https." };
    const h = await sha256(n);
    const e = codeFor(h, id);
    if (!e) return { ok: false, message: "الكود غير صحيح لهذه اللعبة. تأكد منه أو راسلنا." };
    if (!notExpired(e)) return { ok: false, message: "انتهت صلاحية هذا الكود." };
    const o = store(OWN_KEY);
    if (e.game === "*") list().forEach((g) => (o[g.id] = h)); else o[id] = h;
    save(OWN_KEY, o);
    return { ok: true, message: "تم فتح اللعبة بنجاح! 🎉 استمتع باللعب." };
  }

  /* ---------- وقت التجربة ---------- */
  const usedSec = (id) => Number(store(PREV_KEY)[id] || 0);
  function addUsed(id, s) { const p = store(PREV_KEY); p[id] = Math.min(1e6, (p[id] || 0) + s); save(PREV_KEY, p); }
  const leftSec = (g) => Math.max(0, previewSec(g) - usedSec(g.id));

  /* ---------- بطاقة لعبة ---------- */
  function card(g) {
    const own = owned(g.id);
    const left = leftSec(g);
    const play = abs(`games/play.html?id=${encodeURIComponent(g.id)}`);
    return `
      <article class="gcard card reveal">
        <a class="gcard-cover" href="${play}">
          ${g.cover ? `<img src="${esc(abs(g.cover))}" alt="" loading="lazy" onerror="this.remove()">` : ""}
          <span class="gcard-emoji" aria-hidden="true">${esc(g.emoji || "🎮")}</span>
          <span class="gcard-badge ${own ? "own" : ""}">${own ? "✓ مملوكة" : left > 0 ? `▶ تجربة ${Math.ceil(left / 60)} د` : "🔒 انتهت التجربة"}</span>
        </a>
        <div class="gcard-body">
          <div class="gcard-meta">${g.category ? `<span>${esc(g.category)}</span>` : ""}${g.ages ? `<span>👧 <bdi dir="ltr">${esc(g.ages)}</bdi> سنة</span>` : ""}</div>
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.desc || "")}</p>
          <div class="gcard-foot">
            <span class="gprice">${own ? "مملوكة" : esc(price(g))}</span>
            <div class="gcard-btns">
              <a class="btn btn-ghost btn-sm" href="${play}">${own ? "العب" : "جرّب مجاناً"}</a>
              ${own ? (g.download ? `<a class="btn btn-gold btn-sm" href="${esc(abs(g.download))}" download>⬇ تحميل</a>` : "")
                    : `<button class="btn btn-gold btn-sm" type="button" data-buy="${esc(g.id)}">اشترِ الآن</button>`}
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderGrid(el, limit) {
    if (!el) return 0;
    let games = list();
    if (limit) games = games.slice(0, limit);
    el.innerHTML = games.length ? games.map(card).join("")
      : `<div class="empty card" style="padding:40px"><div style="font-size:52px">🎮</div><h3 style="margin:8px 0 4px">ألعاب جديدة قريباً</h3><p>نعمل على إطلاق مجموعة من ألعاب ستيم التعليمية — ترقّبوها!</p></div>`;
    el.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => openBuy(b.dataset.buy)));
    el.querySelectorAll(".reveal").forEach((e) => e.classList.add("in"));
    return games.length;
  }

  /* ---------- نافذة الشراء ---------- */
  let dlg;
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "buy-modal";
    document.body.appendChild(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => (document.body.style.overflow = ""));
    return dlg;
  }

  function openBuy(id, opts = {}) {
    const g = get(id);
    if (!g) return;
    const d = ensureDialog();
    const back = opts.returnUrl || location.href.split("#")[0];
    const sep = back.includes("?") ? "&" : "?";
    const next = back.replace(/[?&]sent=1/, "") + `${sep}sent=1&game=${encodeURIComponent(g.id)}`;
    d.innerHTML = `
      <div class="buy-inner">
        <button class="buy-close" type="button" aria-label="إغلاق">✕</button>
        <div class="buy-head">
          <span class="buy-emoji">${esc(g.emoji || "🎮")}</span>
          <div><h2>شراء لعبة «${esc(g.title)}»</h2><p>السعر: <b>${esc(price(g))}</b> — دفعة واحدة، وتبقى اللعبة لك.</p></div>
        </div>

        <ol class="buy-steps">
          <li>
            <h3>حوّل قيمة اللعبة إلى حساب الأكاديمية</h3>
            ${PAY.bankName ? `<p class="muted">المصرف: ${esc(PAY.bankName)}</p>` : ""}
            ${PAY.accountHolder ? `<p class="muted">باسم: ${esc(PAY.accountHolder)}</p>` : ""}
            <div class="iban"><code dir="ltr">${esc(PAY.bankAccount || "")}</code><button type="button" class="btn btn-ghost btn-sm" data-copy-iban>نسخ</button></div>
            <p class="muted">اكتب في وصف الحوالة: <b>${esc(g.title)}</b> + اسمك.</p>
          </li>
          <li>
            <h3>ارفع صورة الحوالة وأرسلها</h3>
            <form class="buy-form" method="POST" action="${esc(PAY.formEndpoint || "")}" enctype="multipart/form-data">
              <input type="hidden" name="_subject" value="شراء لعبة: ${esc(g.title)} (${esc(price(g))})">
              <input type="hidden" name="_template" value="table">
              <input type="hidden" name="_captcha" value="false">
              <input type="hidden" name="_next" value="${esc(next)}">
              <input type="hidden" name="اللعبة" value="${esc(g.title)} [${esc(g.id)}]">
              <input type="hidden" name="السعر" value="${esc(price(g))}">
              <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
              <div class="row">
                <div class="field"><label>الاسم</label><input name="الاسم" required autocomplete="name"></div>
                <div class="field"><label>رقم الهاتف</label><input name="الهاتف" type="tel" required dir="ltr" autocomplete="tel"></div>
              </div>
              <div class="field"><label>بريدك الإلكتروني (يصلك عليه كود فتح اللعبة)</label><input name="email" type="email" required dir="ltr" autocomplete="email"></div>
              <div class="field">
                <label>صورة الحوالة</label>
                <label class="drop">
                  <input type="file" name="attachment" accept="image/*,application/pdf" required>
                  <span class="drop-txt">📎 اضغط لاختيار صورة الحوالة (حتى ${esc(PAY.maxReceiptMB || 5)} ميجابايت)</span>
                  <img class="drop-prev" alt="" hidden>
                </label>
              </div>
              <div class="field"><label>ملاحظات (اختياري)</label><input name="ملاحظات"></div>
              <button class="btn btn-gold" type="submit">إرسال الحوالة للأكاديمية</button>
              <p class="form-note" role="status"></p>
              <p class="muted small">تُرسل بياناتك وصورة الحوالة إلى بريد الأكاديمية <span dir="ltr">${esc(PAY.receiptEmail || "")}</span>. بعد التحقق يصلك كود فتح اللعبة على بريدك.</p>
            </form>
          </li>
          <li>
            <h3>أدخل كود الفتح الذي وصلك</h3>
            <form class="redeem-form">
              <div class="iban"><input dir="ltr" placeholder="GAME-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" required><button class="btn btn-primary btn-sm" type="submit">فتح اللعبة</button></div>
              <p class="form-note" role="status"></p>
            </form>
          </li>
        </ol>
      </div>`;

    d.querySelector(".buy-close").onclick = () => d.close();
    d.querySelector("[data-copy-iban]").onclick = async (e) => {
      try { await navigator.clipboard.writeText(PAY.bankAccount); e.target.textContent = "✓ نُسخ"; } catch { e.target.textContent = "انسخ يدوياً"; }
    };

    const f = d.querySelector(".buy-form");
    const file = f.querySelector("input[type=file]");
    const prev = f.querySelector(".drop-prev");
    const txt = f.querySelector(".drop-txt");
    file.addEventListener("change", () => {
      const fl = file.files[0];
      if (!fl) return;
      if (fl.size > (PAY.maxReceiptMB || 5) * 1048576) { file.value = ""; txt.textContent = `⚠ الملف أكبر من ${PAY.maxReceiptMB || 5} ميجابايت — اختر صورة أصغر.`; prev.hidden = true; return; }
      txt.textContent = "✓ " + fl.name;
      if (fl.type.startsWith("image/")) { prev.src = URL.createObjectURL(fl); prev.hidden = false; } else prev.hidden = true;
    });
    f.addEventListener("submit", (e) => {
      const note = f.querySelector(".form-note");
      if (!PAY.formEndpoint) {
        e.preventDefault();
        const body = `أرغب بشراء لعبة: ${g.title} (${price(g)})\nالاسم: ${f.elements["الاسم"].value}\nالهاتف: ${f.elements["الهاتف"].value}\nالبريد: ${f.elements.email.value}\n\n(مرفق: صورة الحوالة)`;
        location.href = `mailto:${PAY.receiptEmail}?subject=${encodeURIComponent("شراء لعبة: " + g.title)}&body=${encodeURIComponent(body)}`;
        note.textContent = "فُتح برنامج البريد — أرفق صورة الحوالة ثم اضغط إرسال.";
        return;
      }
      try { sessionStorage.setItem("steamGames.pending", g.id); } catch { /* */ }
      note.textContent = "جارٍ الإرسال…";
      f.querySelector("button[type=submit]").disabled = true;
    });

    const r = d.querySelector(".redeem-form");
    r.addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await redeem(g.id, r.querySelector("input").value);
      const note = r.querySelector(".form-note");
      note.style.color = res.ok ? "" : "#fb7185";
      note.textContent = res.message;
      if (res.ok) setTimeout(() => { d.close(); (opts.onUnlock || (() => location.reload()))(); }, 1100);
    });

    document.body.style.overflow = "hidden";
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }

  /* رسالة بعد العودة من إرسال الحوالة */
  function sentNotice() {
    const q = new URLSearchParams(location.search);
    if (q.get("sent") !== "1") return;
    const g = get(q.get("game"));
    const box = document.createElement("div");
    box.className = "sent-toast";
    box.innerHTML = `<b>✓ وصلت حوالتك${g ? " لشراء «" + esc(g.title) + "»" : ""}!</b><span>سنراجعها ونرسل كود فتح اللعبة إلى بريدك قريباً.</span><button type="button" aria-label="إغلاق">✕</button>`;
    document.body.appendChild(box);
    box.querySelector("button").onclick = () => box.remove();
    history.replaceState(null, "", location.pathname + (q.get("id") ? "?id=" + encodeURIComponent(q.get("id")) : "") + location.hash);
  }

  window.STEAM_GAMES_STORE = { list, get, owned, redeem, usedSec, addUsed, leftSec, previewSec, price, abs, card, renderGrid, openBuy, sentNotice, normalize, sha256, esc };
})();
