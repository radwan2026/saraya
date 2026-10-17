// ===============================================================
//  إعدادات لعبة «واحة النور» — عدّل القيم هنا حسب رغبتك
//  يمكن تمرير بعض القيم من سطر الأوامر:
//     node noor-server.js --user=اسم_الحساب --port=3000 --demo
// ===============================================================

export default {
  // اسم حساب تيك توك الذي يبث مباشرة (بدون @). يمكن إدخاله من لوحة التحكم أيضاً.
  tiktokUsername: '',

  // مفتاح Euler Stream (اختياري) عند ظهور خطأ sign / rate limit — https://www.eulerstream.com
  signApiKey: '',

  port: 3000,

  // تشغيل وضع التجربة تلقائياً (متابعون وهميون)
  demo: false,

  // تقدير تقريبي لما يحصل عليه صانع المحتوى عن كل ماسة (بالدولار) — للعرض في لوحة التحكم فقط
  usdPerDiamond: 0.005,

  game: {
    firstGoal: 1500,        // نقاط النور المطلوبة لإضاءة المسجد في الليلة الأولى
    goalGrowth: 1.4,        // كل ليلة يكبر الهدف بهذه النسبة

    pointsPerDiamond: 10,   // نقاط النور لكل ماسة في الهدية (الوردة = 10 نقاط)
    bigGiftDiamonds: 99,    // هدية بقيمة ≥ هذا الرقم تُطلق «موكب النور» الذهبي

    muskSeconds: 30,        // كل عطر يضاعف النقاط هذه المدة
    muskMaxSeconds: 180,    // أقصى مدة متراكمة للمضاعفة
    muskMultiplier: 2,

    likesPerPoint: 10,      // كل 10 إعجابات = نقطة نور
    dhikrPoints: 2,         // نقاط كل ذكر
    dhikrCooldownMs: 1500,  // أقل فاصل بين ذكرين لنفس الشخص (ضد التكرار السريع)
    followPoints: 20,
    sharePoints: 30,

    answerPoints: 50,             // نقاط الإجابة الصحيحة في لوحة «أبطال المسابقة»
    firstAnswerBonus: [30, 20, 10], // مكافأة أول 3 إجابات صحيحة
    answerGoalPoints: 5,          // كل إجابة صحيحة تضيف للهدف الجماعي

    quiz: {
      auto: true,           // تشغيل الأسئلة تلقائياً
      questionSeconds: 20,
      revealSeconds: 8,
      pauseSeconds: 15,     // بطاقة آية/حديث بين الأسئلة
      categories: [],       // فارغة = كل التصنيفات: quran, prophets, seerah, sahaba, ibadat
    },

    dhikrChallenge: { target: 200, seconds: 90, bonusPoints: 300 },
  },

  // الصوت الافتراضي (يمكن تغييره مباشرة من لوحة التحكم)
  // mode: 'ambient' (موسيقى هادئة + طبيعة) | 'nature' (أصوات طبيعة فقط بلا موسيقى) | 'off'
  audio: { mode: 'ambient', music: 0.55, nature: 0.5, sfx: 0.7 },

  demoBots: { count: 24, speed: 1 },
};
