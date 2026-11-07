/* أكاديمية ستيم — صلاحيات الوصول لمنصة محاكاة ستيم
   - الدروس الأولى (freeLessons) مجانية للجميع
   - باقي الدروس تُفتح بكود تفعيل يصدر للطالب بعد الاشتراك
   - يُقارن «بصمة» الكود (SHA-256) بقائمة config.simulation.codes مع تاريخ الانتهاء
   ملاحظة: التحقق يتم في المتصفح، وهو مناسب لموقع ثابت لكنه ليس حماية خادمية كاملة. */
(function () {
  "use strict";
  const KEY = "steamSimAccess.v1";
  const SIM = (window.STEAM_CONFIG && window.STEAM_CONFIG.simulation) || {};

  const normalize = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const endOfDay = (d) => { const t = new Date(d + "T23:59:59"); return isNaN(t) ? Infinity : t.getTime(); };

  function findCode(hash) { return (SIM.codes || []).find((c) => c && c.hash === hash); }

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
  function write(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* تخزين غير متاح */ } }

  /* الحالة الحالية: يُعاد التحقق في كل مرة (ليُلغى الكود إن حُذف من القائمة أو انتهت صلاحيته) */
  function status() {
    const saved = read();
    if (!saved) return { active: false };
    const entry = findCode(saved.hash);
    if (!entry) return { active: false, reason: "revoked" };
    const exp = endOfDay(entry.expires);
    if (Date.now() > exp) return { active: false, reason: "expired", name: entry.name, expires: entry.expires };
    const daysLeft = isFinite(exp) ? Math.ceil((exp - Date.now()) / 864e5) : null;
    return { active: true, name: entry.name || "", expires: entry.expires || "", daysLeft };
  }

  async function activate(code) {
    const n = normalize(code);
    if (n.length < 8) return { ok: false, message: "الكود قصير — تأكد من كتابته كاملاً." };
    if (!window.crypto || !crypto.subtle) return { ok: false, message: "المتصفح لا يدعم التحقق. افتح الصفحة عبر https." };
    const hash = await sha256(n);
    const entry = findCode(hash);
    if (!entry) return { ok: false, message: "الكود غير صحيح. تأكد منه أو تواصل مع الأكاديمية." };
    if (Date.now() > endOfDay(entry.expires)) return { ok: false, message: `انتهت صلاحية هذا الكود في ${entry.expires}. جدّد اشتراكك.` };
    write({ hash, at: Date.now() });
    return { ok: true, name: entry.name || "", expires: entry.expires || "", message: "تم تفعيل اشتراكك بنجاح! 🎉 جميع الدروس مفتوحة الآن." };
  }

  function deactivate() { write(null); }

  const freeLessons = Number.isFinite(SIM.freeLessons) ? SIM.freeLessons : 3;
  const isLessonFree = (index) => index < freeLessons;
  const canOpen = (index) => isLessonFree(index) || status().active;

  window.STEAM_ACCESS = { status, activate, deactivate, isLessonFree, canOpen, freeLessons, normalize, sha256 };
})();
