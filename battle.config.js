// ===============================================================
//  إعدادات لعبة «حرب الفرق» — عدّل القيم هنا حسب رغبتك
//  التشغيل:  npm run battle            (بث حقيقي)
//            npm run battle:demo       (وضع التجربة)
//  خيارات سطر الأوامر: --user=اسم_الحساب --port=3001 --demo --key=مفتاح_Euler
// ===============================================================

export default {
  // اسم حساب تيك توك الذي يبث مباشرة (بدون @). يمكن تركه فارغاً وإدخاله من لوحة التحكم.
  tiktokUsername: '',

  // مفتاح Euler Stream (اختياري) عند ظهور خطأ sign أو rate limit — https://www.eulerstream.com
  signApiKey: '',

  port: 3001,
  demo: false,

  // -------------------------------------------------------------
  // صوت المعلّق بالذكاء الاصطناعي
  // -------------------------------------------------------------
  voice: {
    // google     : مجاني بدون مفتاح (صوت عربي واضح) — الافتراضي
    // openai     : أفضل جودة وحماس (يحتاج مفتاح OpenAI)
    // elevenlabs : صوت بشري جداً (يحتاج مفتاح ElevenLabs)
    // browser    : صوت المتصفح فقط (لا يلتقطه OBS عادةً)
    provider: 'google',
    lang: 'ar',

    openaiKey: '',              // أو متغير البيئة OPENAI_API_KEY
    openaiModel: 'gpt-4o-mini-tts',
    openaiVoice: 'onyx',        // onyx | ash | ballad | coral | echo | sage | verse ...
    openaiInstructions: 'تحدّث بالعربية بأسلوب معلّق رياضي متحمّس جداً وسريع، بطاقة عالية تشعل الجمهور.',

    elevenlabsKey: '',          // أو متغير البيئة ELEVENLABS_API_KEY
    elevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    elevenlabsModel: 'eleven_multilingual_v2',
  },

  battle: {
    // الفرق: يكتب المتابع رقم الفريق (أو رمزه أو اسمه) في التعليقات للانضمام
    teams: [
      { id: 1, name: 'الأسود', emoji: '🦁', color: '#ff3d6e' },
      { id: 2, name: 'النسور', emoji: '🦅', color: '#2f8cff' },
      { id: 3, name: 'الذئاب', emoji: '🐺', color: '#b36bff' },
      { id: 4, name: 'التنانين', emoji: '🐉', color: '#22e39b' },
    ],

    // ---- النقاط ----
    commentPoints: 1,          // كل تعليق من عضو فريق
    commentCooldownSeconds: 3, // أقل مدة بين تعليقين محسوبين لنفس الشخص (منع السبام)
    likePoints: 1,             // لكل لايك
    followPoints: 30,          // المتابعة (مرة واحدة لكل شخص)
    sharePoints: 20,           // المشاركة (حد أقصى 3 مرات لكل شخص في الجولة)
    giftPointsPerCoin: 10,     // كل عملة في الهدية = 10 نقاط

    // ---- القوى الخاصة (حسب قيمة الهدية بالعملات) ----
    boostCoins: 99,            // هدية بهذه القيمة أو أكثر = مضاعف لفريق المرسل
    boostMultiplier: 2,
    boostSeconds: 20,
    bombCoins: 299,            // هدية بهذه القيمة أو أكثر = قنبلة على الفريق المتصدر
    bombPercent: 15,           // نسبة النقاط التي يخسرها الفريق المستهدف

    // ---- الجولة ----
    goal: 20000,               // أول فريق يصل لهذه النقاط يفوز فوراً (0 = بدون هدف)
    roundSeconds: 180,         // مدة الجولة
    finalSeconds: 30,          // «الوقت الحاسم»: آخر ثوانٍ بنقاط مضاعفة
    finalMultiplier: 2,
    overtimeSeconds: 20,       // وقت إضافي عند التعادل
    lobbySeconds: 25,          // وقت اختيار الفرق قبل الجولة
    winnerSeconds: 14,         // مدة شاشة الفوز
    minPlayers: 1,             // أقل عدد أعضاء لبدء العد التنازلي
    autoStart: true,

    // انضمام تلقائي لأضعف فريق لمن يرسل لايك/هدية/متابعة دون أن يختار فريقاً
    autoAssign: true,
    // السماح بتغيير الفريق أثناء الجولة (الافتراضي: الولاء مقفل حتى نهاية الجولة)
    allowSwitchDuringBattle: false,
  },

  announcer: {
    hypeEverySeconds: 22,      // جملة حماسية كل كذا ثانية أثناء الجولة
    howtoEverySeconds: 75,     // تذكير قصير بطريقة اللعب أثناء الجولة
    bigGiftCoins: 99,          // الهدايا الكبيرة تُشكر بحماس خاص فوراً
  },

  demoBots: {
    count: 24,                 // عدد المتابعين الوهميين
    activity: 1,               // معامل النشاط (2 = ضعف التفاعل)
  },
};
