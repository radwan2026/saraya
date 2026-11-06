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
