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
