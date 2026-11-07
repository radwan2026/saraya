/* حارس ألعاب ستيم — يُضاف داخل ملف اللعبة نفسها:
     <script src="../../assets/js/game-guard.js" data-game="معرّف-اللعبة"></script>
   إن فُتحت اللعبة مباشرة (خارج صفحة التشغيل) ولم يكن الزائر قد اشتراها، يُحوَّل إلى صفحة التشغيل
   حيث تعمل التجربة المجانية ونافذة الشراء. */
(function () {
  "use strict";
  var me = document.currentScript;
  var id = me && me.getAttribute("data-game");
  if (!id) return;
  var inPlayer = false;
  try { inPlayer = window.top !== window.self && /\/games\/play\.html/.test(window.top.location.pathname); } catch (e) { inPlayer = false; }
  if (inPlayer) return;
  var owned = false;
  try { owned = !!JSON.parse(localStorage.getItem("steamGames.owned.v1") || "{}")[id]; } catch (e) { owned = false; }
  if (owned) return;
  var play = me.src.replace(/assets\/js\/game-guard\.js.*$/, "games/play.html?id=" + encodeURIComponent(id));
  window.location.replace(play);
})();
