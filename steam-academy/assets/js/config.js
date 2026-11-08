/* إعدادات الموقع — عدّل هنا فقط دون الحاجة للمس بقية الملفات */
window.STEAM_CONFIG = {
  // موقع ووردبريس (LearnPress) الذي تُسحب منه الدورات مباشرةً
  wpBase: "https://www.steamacademy.ly/wp",

  // روابط المنصة الحالية (التسجيل والملف الشخصي والدورات)
  links: {
    login: "https://www.steamacademy.ly/wp/login/",
    profile: "https://www.steamacademy.ly/wp/lp-profile/",
    joinTeam: "https://www.steamacademy.ly/wp/form/",
    allCoursesWp: "https://www.steamacademy.ly/wp/courses/",
    codeOrg: "https://code.org/en-US",
  },

  // منصة ستيمو للبرمجة والروبوتات
  stemo: {
    url: "https://stemo-coding.pages.dev/",
    login: "https://stemo-coding.pages.dev/login",
    register: "https://stemo-coding.pages.dev/register",
    api: "https://stemo-coding.pages.dev/api/public",
    // صور المنصة — ضع الصورتين بهذين الاسمين داخل assets/img
    image: "assets/img/stemo-1.webp",
    image2: "assets/img/stemo-2.webp",
  },

  // ===== معرض الفيديو =====
  // طريقتان لإضافة الفيديوهات:
  //  1) بالتحميل: ارفع الفيديو إلى «الوسائط» في لوحة ووردبريس فيظهر هنا تلقائياً (wpMedia: true)،
  //     أو ضع ملف الفيديو داخل مجلد assets/videos وأضف سطراً له في القائمة أدناه.
  //  2) برابط: أضف سطراً في القائمة أدناه برابط من يوتيوب / فيميو / فيسبوك / جوجل درايف / أو رابط ملف mp4 مباشر.
  videos: {
    wpMedia: true, // جلب الفيديوهات المرفوعة إلى مكتبة وسائط ووردبريس تلقائياً
    homeLimit: 6,  // عدد الفيديوهات في الصفحة الرئيسية
    list: [
      // (العنوان اختياري — إن تُرك فارغاً يُجلب عنوان الفيديو من يوتيوب/فيميو تلقائياً)
      { url: "https://www.youtube.com/watch?v=EqTITL74Y7I", category: "عن الأكاديمية" },
      { url: "https://www.youtube.com/watch?v=tEuGt1ung7s", category: "عن الأكاديمية" },
      { url: "https://www.youtube.com/watch?v=K1-D31fdmrw", category: "عن الأكاديمية" },
      { url: "https://www.youtube.com/watch?v=LIjmm62gwzQ", category: "عن الأكاديمية" },

      // أمثلة — انسخ السطر وعدّل القيم:
      // { title: "جولة داخل أكاديمية ستيم", url: "https://www.youtube.com/watch?v=XXXXXXXXXXX", category: "عن الأكاديمية" },
      // { title: "تجربة المصعد الهيدروليكي", url: "assets/videos/hydraulic-lift.mp4", poster: "assets/videos/hydraulic-lift.jpg", category: "تجارب علمية" },
      // { title: "شرح منصة ستيمو", url: "https://vimeo.com/123456789", category: "ستيمو" },
      // { title: "مشاركة طلابنا", url: "https://www.facebook.com/watch/?v=1234567890", category: "فعاليات" },
      // { title: "ورشة الروبوتات", url: "https://drive.google.com/file/d/FILE_ID/view", category: "روبوتات" },
    ],
  },

  // ===== منصة محاكاة ستيم (STEM Simulation) =====
  simulation: {
    appUrl: "simulation/index.html",   // مسار المنصة نفسها
    freeLessons: 3,                    // عدد الدروس المجانية (تجربة) قبل طلب الاشتراك

    // استقبال طلبات الاشتراك:
    //  - إن وضعت رابط نموذج (Formspree أو Google Apps Script أو أي خدمة تستقبل POST) تُرسل الطلبات إليه مباشرة.
    //  - إن تُرك فارغاً تُرسل الطلبات عبر واتساب (إن وُجد رقم في contact.whatsapp) أو البريد الإلكتروني.
    subscribeEndpoint: "",

    // ملاحظة الدفع التي تظهر للطالب بعد إرسال الطلب
    paymentNote: "سيتواصل معك فريق الأكاديمية لتأكيد الاشتراك وطريقة الدفع (نقداً في مقر الأكاديمية أو بتحويل مصرفي)، ثم يصلك كود التفعيل.",

    // الباقات — اترك السعر فارغاً ليظهر «يُحدَّد عند التواصل»
    plans: [
      { id: "trial",   name: "تجربة مجانية",   price: "مجاناً", period: "",          highlight: false,
        features: ["أول 3 دروس كاملة", "التجميع والمحاكاة والاختبار", "بدون تسجيل"] },
      { id: "monthly", name: "اشتراك شهري",    price: "",       period: "شهرياً",    highlight: false,
        features: ["جميع الدروس العشرة", "نقاط الخبرة والمستويات والنجوم", "يعمل على الكمبيوتر والتابلت"] },
      { id: "term",    name: "فصل دراسي",      price: "",       period: "3 أشهر",    highlight: true,
        features: ["جميع الدروس + كل درس جديد يُضاف", "متابعة من مدربي الأكاديمية", "شهادة إتمام من أكاديمية ستيم"] },
      { id: "school",  name: "باقة المدارس",   price: "",       period: "لكل فصل",   highlight: false,
        features: ["أكواد لجميع طلاب الفصل", "تدريب المعلم على المنصة", "تقرير تقدّم الطلاب"] },
    ],

    // أكواد التفعيل الصادرة للطلاب — تُولَّد من الصفحة simulation/codes.html ثم يُلصق سطرها هنا.
    // يُحفظ «بصمة» الكود فقط (SHA-256) وليس الكود نفسه.
    codes: [
      // { hash: "....", name: "اسم الطالب", expires: "2027-01-31" },
    ],
  },

  // ===== ألعاب ستيم (قسم ربحي) =====
  // لإضافة لعبة: ضع ملفاتها في مجلد games/<المعرّف>/ ثم أضف كائناً في القائمة أدناه (راجع games/README.md).
  games: {
    defaultPreviewMinutes: 3,   // مدة التجربة المجانية لكل لعبة قبل أن تُقفل (يمكن تغييرها لكل لعبة)
    currency: "د.ل",
    list: [
      {
        id: "planet-race",
        title: "سباق الكواكب",
        emoji: "🪐",
        desc: "انطلق بصاروخك من الأرض في سباق مثير بين كواكب المجموعة الشمسية، وتعرّف على المريخ وزحل وأسرار الفضاء.",
        cover: "games/planet-race/cover.webp",
        url: "games/planet-race/index.html",
        download: "",          // (اختياري) مسار ملف التحميل بعد الشراء
        price: 20,
        ages: "8–12", category: "فلك",
      },
      {
        id: "forest-of-life",
        title: "غابة الحياة",
        emoji: "🌳",
        desc: "«نزرع اليوم لنحيا غداً»: ازرع، ووفّر الماء، وحافظ على التربة والحيوانات، واكتشف دورة الحياة والتوازن البيئي.",
        cover: "games/forest-of-life/cover.webp",
        url: "games/forest-of-life/index.html",
        download: "",
        price: 25,
        ages: "8–12", category: "أحياء",
      },
      {
        id: "fares-al-darb",
        title: "فارس الدرب",
        emoji: "⚔️",
        desc: "رحلة في العلم والإيمان: انطلق مع فارس الدرب في مغامرة عبر الصحراء والقلاع، وأجب عن الأسئلة لتختبر علمك وإيمانك.",
        cover: "games/fares-al-darb/cover.webp",
        url: "games/fares-al-darb/index.html",
        download: "",
        price: "",             // ← ضع سعر اللعبة هنا (مثال: 20)
        ages: "9–14", category: "علم وإيمان",
      },

      // مثال لإضافة لعبة جديدة مستقبلاً:
      // {
      //   id: "water-cycle",                         // معرّف فريد بالإنجليزية (اسم مجلد اللعبة)
      //   title: "رحلة قطرة الماء",
      //   desc: "لعبة مغامرات يتعلّم فيها الطفل دورة الماء في الطبيعة.",
      //   cover: "games/water-cycle/cover.webp",     // صورة الغلاف
      //   url: "games/water-cycle/index.html",       // ملف تشغيل اللعبة
      //   download: "games/water-cycle/water-cycle.zip", // (اختياري) ملف التحميل بعد الشراء
      //   price: 15,
      //   ages: "8–12", category: "علوم", previewMinutes: 3,
      // },
    ],
    // أكواد فتح الألعاب — تُولَّد من games/codes.html ثم يُلصق سطرها هنا (تُحفظ بصمة الكود فقط)
    codes: [
      // { hash: "....", game: "water-cycle", name: "اسم المشتري" },
    ],
  },

  // ===== الدفع بالتحويل المصرفي =====
  payments: {
    bankAccount: "LY19006027000002004554046",
    bankName: "",        // (اختياري) اسم المصرف
    accountHolder: "",   // (اختياري) اسم صاحب الحساب
    receiptEmail: "k.gammo@steamacademy.ly",
    // خدمة إرسال النموذج مع صورة الحوالة إلى البريد أعلاه.
    // FormSubmit مجانية وتدعم المرفقات؛ أول إرسال يصل للبريد رسالة «تفعيل» يجب الضغط عليها مرة واحدة.
    formEndpoint: "https://formsubmit.co/k.gammo@steamacademy.ly",
    maxReceiptMB: 5,
  },

  // بيانات التواصل — نموذج «راسلنا» يفتح بريد المستخدم مُعبّأً مسبقاً
  contact: {
    email: "info@steamacademy.ly",
    phone: "",       // مثال: "+218 91 000 0000"
    whatsapp: "",    // مثال: "218910000000" (بدون + أو مسافات)
    city: "طرابلس، ليبيا",
    facebook: "",
    instagram: "",
  },
};
