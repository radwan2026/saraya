// البيانات الأولية عند أول تشغيل: إعدادات، حساب المدير، أعضاء اللجنة حسب المادة 13 من اللائحة، ومحتوى تجريبي.
import crypto from 'node:crypto';
import { hashPassword } from './auth.js';
import { newId } from './store.js';

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
    { text: 'خلال كم يوم عمل يحق للمشارك التظلم من قرار الجزاء؟', options: ['3 أيام', '5 أيام', '7 أيام', '10 أيام'], correct: 1 },
  ];

  return {
    meta: { cardSerial: 0, ticketSerial: 0, seededAt: now },
    settings: {
      committeeName: 'لجنة الأنشطة',
      companyName: 'شركة المدار الجديد',
      tagline: 'معاً نصنع بيئة عمل نابضة بالحياة — رياضة، ثقافة، فن وتطوع',
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
    activities: [
      row({
        title: 'دوري الشركة لكرة القدم الخماسية',
        category: 'sports',
        description: 'دوري داخلي بين فرق الإدارات والفروع، ويُعتمد كأحد طرق اختيار لاعبي منتخب الشركة وفق المادة (11) من الميثاق.',
        location: 'الصالة الرياضية المغلقة',
        startDate: isoDate(14), endDate: isoDate(45), deadline: isoDate(10),
        capacity: 120, image: '/assets/team-futsal.webp', status: 'open', published: true, requiresApproval: true,
      }),
      row({
        title: 'تشكيل فريق الشركة لكرة الطائرة',
        category: 'sports',
        description: 'فتح باب الترشح لتشكيل فريق كرة الطائرة استعداداً للمشاركة في البطولات القادمة. يخضع المترشحون للاختبار الطبي والبدني والفني.',
        location: 'الصالة الرياضية',
        startDate: isoDate(20), endDate: isoDate(20), deadline: isoDate(12),
        capacity: 30, image: '/assets/volleyball-champions.webp', status: 'open', published: true, requiresApproval: true,
      }),
      row({
        title: 'مسابقة حفظ القرآن الكريم',
        category: 'cultural',
        description: 'مسابقة ثقافية للعاملين والعاملات في حفظ وتجويد القرآن الكريم، بجوائز قيّمة للفائزين.',
        location: 'قاعة الاجتماعات الرئيسية',
        startDate: isoDate(25), endDate: isoDate(27), deadline: isoDate(18),
        capacity: 0, image: '/assets/quran-competition.webp', status: 'open', published: true, requiresApproval: false,
      }),
      row({
        title: 'معرض المواهب الفنية: تصوير ورسم وخط عربي',
        category: 'arts',
        description: 'شارك بأعمالك الفنية في معرض داخلي يحتفي بمواهب العاملين، وتُكرّم أفضل الأعمال.',
        location: 'بهو المبنى الرئيسي',
        startDate: isoDate(30), endDate: isoDate(32), deadline: isoDate(22),
        capacity: 0, image: '/assets/art-talents.webp', status: 'open', published: true, requiresApproval: false,
      }),
      row({
        title: 'حملة التبرع بالدم',
        category: 'volunteer',
        description: 'مبادرة تطوعية بالتعاون مع الهلال الأحمر، ساهم وأنقذ حياة.',
        location: 'مقر الشركة',
        startDate: isoDate(8), endDate: isoDate(8), deadline: isoDate(7),
        capacity: 80, image: '/assets/blood-donation.webp', status: 'open', published: true, requiresApproval: false,
      }),
      row({
        title: 'فريق قدامى اللاعبين — مباريات ودية',
        category: 'social',
        description: 'لقاءات ودية أسبوعية تجمع الزملاء لتعزيز روح الفريق والتواصل الإيجابي.',
        location: 'الصالة الرياضية',
        startDate: isoDate(5), endDate: isoDate(60), deadline: isoDate(30),
        capacity: 40, image: '/assets/team-veterans.webp', status: 'open', published: true, requiresApproval: false,
      }),
    ],
    posts: [
      row({
        type: 'announcement', pinned: true, published: true, publishedAt: isoDate(0),
        title: 'إطلاق المنصة الإلكترونية للجنة الأنشطة',
        summary: 'سجّل في الأنشطة، شارك في المسابقة الأسبوعية، صوّت على البرامج، واطّلع على الميثاق واللائحة — كل ذلك من مكان واحد.',
        body: 'يسر لجنة الأنشطة بشركة المدار الجديد أن تعلن عن إطلاق منصتها الإلكترونية لتكون نافذة كل العاملين والعاملات على الأنشطة الرياضية والثقافية والفنية والتطوعية.\nمن خلال المنصة يمكنك:\n- التسجيل في الأنشطة وإصدار بطاقة المشاركة.\n- المشاركة في المسابقة الأسبوعية والفوز بهدايا رصيد.\n- التصويت على المشاريع والبرامج المقترحة.\n- تقديم الأفكار والشكاوى والمقترحات.',
        image: '/assets/banner.webp',
      }),
      row({
        type: 'news', pinned: false, published: true, publishedAt: isoDate(-3),
        title: 'ختام بطولة المدار لكرة الطائرة 2025',
        summary: 'أُسدل الستار على منافسات بطولة المدار لكرة الطائرة وسط حضور جماهيري مميز وتتويج الفائزين.',
        body: 'شهدت البطولة منافسة قوية وروحاً رياضية عالية، وتم في الختام تتويج الفريق الفائز بالمركز الأول وتسليم الجوائز.',
        image: '/assets/volleyball-champions.webp',
      }),
      row({
        type: 'news', pinned: false, published: true, publishedAt: isoDate(-6),
        title: 'مشاركة متميزة لفرق الشركة في بطولة كرة القدم الخماسية',
        summary: 'قدّمت فرق الشركة مستويات لافتة في البطولة الداخلية لكرة القدم الخماسية.',
        body: 'تواصل لجنة الأنشطة دعم الفرق المشاركة وتوفير احتياجاتها من ملابس ومعدات وتدريب، وفق مسؤولياتها المنصوص عليها في اللائحة التنظيمية.',
        image: '/assets/team-futsal.webp',
      }),
      row({
        type: 'decision', pinned: false, published: true, publishedAt: isoDate(-1),
        title: 'نشر مقترح الميثاق الرياضي الاجتماعي الثقافي واللائحة التنظيمية للاطلاع',
        summary: 'أصبح بإمكان جميع العاملين الاطلاع على الميثاق واللائحة التنظيمية وطباعتهما من المنصة.',
        body: 'إعمالاً لمبدأ الشفافية، تتيح اللجنة نص مقترح الميثاق الرياضي الاجتماعي الثقافي واللائحة التنظيمية للجنة النشاط المُعدّين من فريق العمل المشكّل بقرار مدير عام الشركة رقم (120) لسنة 2025م، ويمكن الاطلاع عليهما وتحميلهما من قسم «الوثائق».',
        image: '',
      }),
    ],
    quizzes: [row({
      title: 'مسابقة الأسبوع: ماذا تعرف عن الميثاق واللائحة؟',
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
      title: 'ما النشاط الذي تقترح أن تنظمه اللجنة في الربع القادم؟',
      description: 'صوتك يساعد اللجنة على إعداد خطة الأنشطة وفق رغبات العاملين.',
      options: [
        { id: newId(), label: 'دوري كرة السلة' },
        { id: newId(), label: 'رحلة ترفيهية عائلية' },
        { id: newId(), label: 'بطولة الشطرنج' },
        { id: newId(), label: 'ماراثون الجري الخيري' },
        { id: newId(), label: 'أمسية ثقافية وشعرية' },
      ],
      startsAt: isoDateTime(-1),
      endsAt: isoDateTime(13),
      published: true,
      resultsVisibility: 'always',
    })],
    stars: [],
    ideas: [],
    registrations: [],
    quizSubmissions: [],
    votes: [],
    complaints: [],
  };
}

export const generatePassword = () => crypto.randomBytes(9).toString('base64url');
