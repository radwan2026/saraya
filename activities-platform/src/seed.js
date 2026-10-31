// البيانات الأولية عند أول تشغيل: إعدادات، حساب المدير، أعضاء اللجنة حسب المادة 13 من اللائحة، ومحتوى تجريبي.
import crypto from 'node:crypto';
import { hashPassword } from './auth.js';
import { newId } from './store.js';
import { DEFAULT_CHECKLIST } from './checklist.js';

const day = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const isoDateTime = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
};

// أعضاء اللجنة المسمَّون. مهام الرئيس من المادة 13 من اللائحة التنظيمية، ومهام الأعضاء من المادتين 5 و8؛
// تُحدَّث التقسيمات التنظيمية (نائب الرئيس، أمين السر...) من لوحة التحكم عند تسميتها.
const CHAIR_TASKS = [
  'قيادة وتنظيم الاجتماعات والتنسيق العام، واعتماد الخطط والبرامج.',
  'تمثيل اللجنة أمام إدارة الشركة، أو تفويض من يمثلها من أعضائها.',
  'إصدار القرارات والتوجيهات التي تنظم عمل اللجنة.',
  'اعتماد مشروع الميزانية التقديرية للمشاركة في الأنشطة والبطولات المحلية والخارجية.',
  'تسمية الأعضاء المكلفين بالتقسيمات التنظيمية للجنة وتدوير التكليف بينهم.',
];
const MEMBER_TASKS = [
  'حضور اجتماعات اللجنة والمشاركة في اتخاذ القرارات.',
  'تولي المسؤولية المباشرة عن الأنشطة المكلف بها: المتابعة والتنسيق والتنفيذ.',
  'تنفيذ المهام المكلف بها وفق الجدول الزمني المعتمد.',
  'المساهمة في تقييم الأنشطة بعد انتهائها واقتراح التحسينات.',
];
const COMMITTEE_MEMBERS = [
  ['عبد الباسط منير الفورتي', 'رئيس اللجنة', CHAIR_TASKS],
  ['محمد مفتاح الزواوي', 'عضو اللجنة', MEMBER_TASKS],
  ['علي محمود طويلب', 'عضو اللجنة', MEMBER_TASKS],
  ['أسامة بحر موسى', 'عضو اللجنة', MEMBER_TASKS],
  ['عادل إبراهيم الأمير', 'عضو اللجنة', MEMBER_TASKS],
  ['رضوان صالح الزناتي', 'عضو اللجنة', MEMBER_TASKS],
  ['مراد مصطفى دخيل', 'عضو اللجنة', MEMBER_TASKS],
];

export function buildSeed({ adminPassword }) {
  const now = new Date().toISOString();
  const row = (obj) => ({ id: newId(), createdAt: now, updatedAt: now, ...obj });

  const quizQuestions = [
    { text: 'كم الحد الأدنى لعدد أعضاء لجنة النشاط وفق اللائحة التنظيمية؟', options: ['5 أعضاء', '7 أعضاء', '9 أعضاء', '11 عضواً'], correct: 1 },
    { text: 'ما مدة عمل لجنة النشاط وفق اللائحة؟', options: ['سنة واحدة', 'سنتان قابلة للتمديد مرة واحدة', 'ثلاث سنوات', 'غير محددة'], correct: 1 },
    { text: 'كم عدد الأنشطة المختلفة التي يُسمح للعامل بقيد اسمه فيها وفق الميثاق؟', options: ['نشاط واحد', 'نشاطان', 'ثلاثة أنشطة', 'بدون حد'], correct: 1 },
    { text: 'ما الدرجة المعتمدة كأصل عام لتذاكر السفر في المشاركات؟', options: ['الدرجة الأولى', 'درجة رجال الأعمال', 'الدرجة السياحية', 'حسب رغبة المشارك'], correct: 2 },
    { text: 'قبل كم يوم عمل على الأقل تُشعر اللجنة الرئيس المباشر بترشيح العامل لمشاركة خارجية؟', options: ['3 أيام', '5 أيام', '7 أيام', '10 أيام'], correct: 2 },
    { text: 'من يتحمل تكاليف علاج العامل إذا أُصيب أثناء مشاركته مع الشركة؟', options: ['العامل نفسه', 'الشركة', 'الجهة المنظمة', 'النادي'], correct: 1 },
  ];

  const checklist = (doneCount) => DEFAULT_CHECKLIST.map((label, i) => ({ label, done: i < doneCount }));
  const team = (obj) => row({
    category: 'sports', description: '', coach: 'يُحدَّد لاحقاً', manager: 'يُحدَّد لاحقاً', captain: '', image: '',
    status: 'forming', schedule: '', needs: '', members: [], published: true, ...obj,
  });
  const futsal = team({
    name: 'منتخب الشركة لكرة القدم الخماسية', image: '/assets/team-futsal.webp', status: 'forming',
    description: 'المنتخب الذي يمثل الشركة في بطولات كرة القدم الخماسية للمؤسسات والشركات.',
    schedule: 'اختبارات الانتقاء بعد غلق باب الترشح.', needs: 'أطقم رسمية جديدة، كرات، حجز ملعب للتدريب.',
  });
  const volleyball = team({
    name: 'فريق الشركة لكرة الطائرة', image: '/assets/volleyball-champions.webp', status: 'training',
    description: 'بطل بطولة كرة الطائرة 2025، ويستعد للموسم الجديد من دوري الشركات.',
    schedule: 'تدريبات أيام الأحد والثلاثاء والخميس بعد الدوام.', needs: 'معسكر إعداد قصير، أحذية رياضية، أخصائي علاج طبيعي.',
  });
  const veterans = team({
    name: 'فريق قدامى اللاعبين', image: '/assets/team-veterans.webp', status: 'active',
    description: 'يضم نخبة من قدامى لاعبي الشركة، ويشارك في البطولات الرمضانية والودية.',
    schedule: 'مباراة ودية أسبوعية.', needs: '',
  });
  const culture = team({
    name: 'فريق المسابقات الثقافية', category: 'cultural', image: '/assets/quran-competition.webp', status: 'forming',
    description: 'يمثل الشركة في المسابقات الثقافية ومسابقات القرآن الكريم والبرمجيات.',
    schedule: '', needs: '',
  });

  return {
    meta: { cardSerial: 0, ticketSerial: 0, seededAt: now },
    settings: {
      committeeName: 'لجنة الأنشطة',
      companyName: 'شركة المدار الجديد',
      tagline: 'نمثّل الشركة بفخر في كل محفل — بطولات، مسابقات، ومواهب نرعاها ونجهّزها',
      email: 'activities@almadar.ly',
      phone: '',
      whatsapp: '',
      publicUrl: '',
      social: { facebook: '', tiktok: '', instagram: '', youtube: '' },
      maxActivitiesPerEmployee: 0,
      departments: [
        'الإدارة العامة', 'الموارد البشرية', 'الشؤون المالية', 'تقنية المعلومات', 'الشبكات',
        'التسويق', 'المبيعات', 'خدمة العملاء', 'الشؤون القانونية', 'المراجعة الداخلية',
        'فرع المنطقة الغربية', 'فرع المنطقة الشرقية', 'فرع المنطقة الجنوبية', 'فرع المنطقة الوسطى',
      ],
    },
    users: [row({
      username: 'admin',
      name: 'مدير المنصة',
      role: 'admin',
      permissions: [],
      active: true,
      passwordHash: hashPassword(adminPassword),
    })],
    members: COMMITTEE_MEMBERS.map(([name, position, tasks], i) => row({
      name,
      position,
      jobTitle: '',
      department: '',
      bio: 'يُرجى تحديث السيرة الذاتية لهذا العضو من لوحة التحكم.',
      tasks: tasks.join('\n'),
      photo: '',
      email: '',
      order: i + 1,
    })),
    teams: [futsal, volleyball, veterans, culture],
    activities: [
      row({
        title: 'بطولة المؤسسات والشركات لكرة القدم الخماسية 2026',
        category: 'sports', organizer: 'رابطة المؤسسات والشركات الرياضية', level: 'local',
        description: 'باب الترشح مفتوح لتمثيل الشركة في بطولة المؤسسات والشركات لكرة القدم الخماسية. يخضع المترشحون للاختبار الطبي والبدني والفني، ويُراعى في الاختيار سلم الأولوية في المادة (12) من الميثاق.',
        location: 'طرابلس — الصالة الرياضية المغلقة',
        startDate: isoDate(30), endDate: isoDate(45), deadline: isoDate(12),
        capacity: 20, image: '/assets/team-futsal.webp', status: 'open', teamId: futsal.id,
        checklist: checklist(1), budget: 15000, resultRank: '', result: '', resultNotes: '',
        published: true, requiresApproval: true,
      }),
      row({
        title: 'دوري الشركات لكرة الطائرة — الموسم الجديد',
        category: 'sports', organizer: 'اللجنة المنظمة لدوري الشركات', level: 'local',
        description: 'الفريق في مرحلة التجهيز والتدريب استعداداً لانطلاق الدوري: معسكر إعداد، مباريات ودية، وتجهيز الزي والمعدات.',
        location: 'طرابلس',
        startDate: isoDate(18), endDate: isoDate(60), deadline: isoDate(-5),
        capacity: 14, image: '/assets/volleyball-champions.webp', status: 'preparing', teamId: volleyball.id,
        checklist: checklist(5), budget: 22000, resultRank: '', result: '', resultNotes: '',
        published: true, requiresApproval: true,
      }),
      row({
        title: 'المسابقة الوطنية لحفظ القرآن الكريم للعاملين',
        category: 'cultural', organizer: 'جهة ثقافية وطنية', level: 'local',
        description: 'ترشيح العاملين والعاملات من حفظة القرآن الكريم لتمثيل الشركة. يُمنح المشارك فترة تفرغ مع الاحتفاظ بحقوقه الوظيفية (المادة 40 — ثانياً).',
        location: 'يُحدَّد لاحقاً',
        startDate: isoDate(40), endDate: isoDate(42), deadline: isoDate(20),
        capacity: 5, image: '/assets/quran-competition.webp', status: 'open', teamId: culture.id,
        checklist: checklist(0), budget: 3000, resultRank: '', result: '', resultNotes: '',
        published: true, requiresApproval: true,
      }),
      row({
        title: 'معرض المواهب الفنية السنوي',
        category: 'arts', organizer: 'مركز الفنون', level: 'local',
        description: 'مشاركة الشركة بأعمال موظفيها الموهوبين في الرسم والتصوير والخط العربي. تراجع اللجنة الأعمال المقدّمة وتختار الأفضل لتمثيل الشركة.',
        location: 'طرابلس — قاعة المعارض',
        startDate: isoDate(25), endDate: isoDate(28), deadline: isoDate(-2),
        capacity: 10, image: '/assets/art-talents.webp', status: 'selection', teamId: '',
        checklist: checklist(2), budget: 4000, resultRank: '', result: '', resultNotes: '',
        published: true, requiresApproval: true,
      }),
      row({
        title: 'حملة التبرع بالدم بالتعاون مع الهلال الأحمر',
        category: 'volunteer', organizer: 'الهلال الأحمر الليبي', level: 'local',
        description: 'مبادرة مجتمعية تشارك فيها الشركة بفريق من المتطوعين والمتبرعين، وتُحتسب فترة المشاركة وقت عمل مرن (المادة 40 — ثالثاً).',
        location: 'مقر الهلال الأحمر',
        startDate: isoDate(9), endDate: isoDate(9), deadline: isoDate(7),
        capacity: 60, image: '/assets/blood-donation.webp', status: 'open', teamId: '',
        checklist: checklist(2), budget: 0, resultRank: '', result: '', resultNotes: '',
        published: true, requiresApproval: false,
      }),
      row({
        title: 'بطولة كرة الطائرة 2025',
        category: 'sports', organizer: 'اللجنة المنظمة للبطولة', level: 'local',
        description: 'مشاركة فريق الشركة لكرة الطائرة في بطولة 2025.',
        location: 'طرابلس',
        startDate: isoDate(-90), endDate: isoDate(-75), deadline: isoDate(-110),
        capacity: 14, image: '/assets/volleyball-champions.webp', status: 'completed', teamId: volleyball.id,
        checklist: checklist(8), budget: 18000, resultRank: 'gold', result: 'المركز الأول وكأس البطولة',
        resultNotes: 'تُوِّج فريق الشركة بالمركز الأول بعد مستوى مميز طوال البطولة، وتُحفظ الكأس في مكتبة إنجازات الشركة (المادة 89).',
        published: true, requiresApproval: true,
      }),
      row({
        title: 'البطولة الرمضانية لقدامى اللاعبين',
        category: 'sports', organizer: 'الدوري الرمضاني', level: 'local',
        description: 'مشاركة فريق قدامى اللاعبين في البطولة الرمضانية.',
        location: 'طرابلس',
        startDate: isoDate(-200), endDate: isoDate(-180), deadline: isoDate(-215),
        capacity: 16, image: '/assets/team-veterans.webp', status: 'completed', teamId: veterans.id,
        checklist: checklist(8), budget: 6000, resultRank: 'silver', result: 'المركز الثاني',
        resultNotes: 'أداء مشرّف للفريق ووصول إلى المباراة النهائية.',
        published: true, requiresApproval: true,
      }),
    ],
    posts: [
      row({
        type: 'announcement', pinned: true, published: true, publishedAt: isoDate(0),
        title: 'إطلاق منصة لجنة الأنشطة للمشاركات الخارجية',
        summary: 'تابع البطولات والمحافل التي تشارك فيها الشركة، ترشّح لتمثيلها، وسجّل موهبتك — كل ذلك من مكان واحد.',
        body: 'يسر لجنة الأنشطة بشركة المدار الجديد أن تعلن عن إطلاق منصتها الإلكترونية لتنظيم مشاركة العاملين في الأنشطة والمسابقات خارج الشركة.\nمن خلال المنصة يمكنك:\n- متابعة البطولات والمحافل والترشح لتمثيل الشركة.\n- التعرف على فرق الشركة ومنتخباتها.\n- قيد موهبتك في سجل المواهب لتحظى بالدعم والتأهيل.\n- إصدار بطاقة المشارك الرسمي، وتقديم طلبات الدعم والتجهيز.',
        image: '/assets/banner.webp',
      }),
      row({
        type: 'decision', pinned: true, published: true, publishedAt: isoDate(-1),
        title: 'فتح باب الترشح لمنتخب الشركة لكرة القدم الخماسية',
        summary: 'تعلن اللجنة فتح باب الترشح لتمثيل الشركة في بطولة المؤسسات والشركات لكرة القدم الخماسية 2026.',
        body: 'وفقاً للمادة (10) من الميثاق، تعلن اللجنة فتح باب الترشح عبر المنصة، على أن يستوفي المترشح شروط المادة (9). تُعلن قائمة المختارين والقائمة الاحتياطية بعد الاختبارات.',
        image: '/assets/team-futsal.webp',
      }),
      row({
        type: 'news', pinned: false, published: true, publishedAt: isoDate(-3),
        title: 'فريق الشركة لكرة الطائرة يحرز المركز الأول في بطولة 2025',
        summary: 'تتويج مستحق لفريق الشركة بعد مشوار مميز في البطولة.',
        body: 'تهنئ لجنة الأنشطة فريق الشركة لكرة الطائرة على إحراز المركز الأول، وتواصل دعم الفريق وتجهيزه للموسم الجديد.',
        image: '/assets/volleyball-champions.webp',
      }),
      row({
        type: 'decision', pinned: false, published: true, publishedAt: isoDate(-5),
        title: 'نشر مقترح الميثاق الرياضي الاجتماعي الثقافي واللائحة التنظيمية للاطلاع',
        summary: 'أصبح بإمكان جميع العاملين الاطلاع على الميثاق واللائحة التنظيمية وطباعتهما من المنصة.',
        body: 'إعمالاً لمبدأ الشفافية، تتيح اللجنة نص مقترح الميثاق الرياضي الاجتماعي الثقافي واللائحة التنظيمية للجنة النشاط المُعدّين من فريق العمل المشكّل بقرار مدير عام الشركة رقم (120) لسنة 2025م.',
        image: '',
      }),
    ],
    quizzes: [row({
      title: 'مسابقة الأسبوع: ماذا تعرف عن تمثيل الشركة في المحافل؟',
      description: 'أجب عن الأسئلة التالية، ويُسحب على الفائزين من أصحاب الإجابات الصحيحة الكاملة.',
      prize: 'رصيد مكالمات بقيمة 20 دينار لكل فائز',
      winnersCount: 3,
      startsAt: isoDateTime(-1),
      endsAt: isoDateTime(6),
      published: true,
      questions: quizQuestions.map((q) => ({ id: newId(), ...q })),
      winners: [],
    })],
    polls: [row({
      title: 'ما البطولة الخارجية التي تقترح أن تشارك فيها الشركة في الموسم القادم؟',
      description: 'صوتك يساعد اللجنة على اختيار المشاركات الخارجية وإعداد خطة التجهيز والميزانية.',
      options: [
        { id: newId(), label: 'دوري الشركات لكرة السلة' },
        { id: newId(), label: 'الماراثون الخيري' },
        { id: newId(), label: 'بطولة الشطرنج للمؤسسات' },
        { id: newId(), label: 'بطولة البادل' },
        { id: newId(), label: 'المسابقة الثقافية الوطنية' },
      ],
      startsAt: isoDateTime(-1),
      endsAt: isoDateTime(13),
      published: true,
      resultsVisibility: 'always',
    })],
    talents: [],
    registrations: [],
    quizSubmissions: [],
    votes: [],
    complaints: [],
  };
}

export const generatePassword = () => crypto.randomBytes(9).toString('base64url');
