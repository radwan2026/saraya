// ===============================================================
//  مكتبة الألعاب: الأقسام والألعاب المتاحة على الخادم
// ===============================================================

export const SECTIONS = [
  {
    id: 'steam',
    title: 'STEAM Games',
    subtitle: 'ألعاب علمية بصرية — علوم • تقنية • هندسة • فنون • رياضيات',
    games: ['planets'],
  },
  {
    id: 'live',
    title: 'ألعاب التحدي',
    subtitle: 'ألعاب سريعة وحماسية لبث تيك توك المباشر',
    games: ['redlight'],
  },
];

export const GAMES = {
  planets: {
    id: 'planets',
    title: 'سباق الكواكب',
    emoji: '🪐',
    page: 'planets.html',
    section: 'steam',
    tags: ['فيزياء', 'فلك'],
    steam: ['S', 'T', 'M'],
    ages: '7+',
    description: 'صوّب صاروخك نحو الكوكب! جاذبية الشمس تحني المسار والكوكب يتحرك في مداره — اكتب رقم المسار من 1 إلى 10 واهبط قبل الجميع.',
    learn: ['الجاذبية', 'المدارات وقانون كبلر', 'نافذة الإطلاق', 'معلومات عن الكواكب'],
  },
  redlight: {
    id: 'redlight',
    title: 'الضوء الأحمر / الأخضر',
    emoji: '🚦',
    page: 'index.html',
    section: 'live',
    tags: ['تحدي', 'حظ', 'استراتيجية'],
    steam: ['M'],
    ages: '10+',
    description: 'اكتب رقماً من 1 إلى 10 — الرقم الكبير يقدّمك أسرع لكنه أخطر أمام الدمية!',
    learn: ['المقارنة بين الأرقام', 'الموازنة بين المخاطرة والمكسب'],
  },
};

export function catalog() {
  return SECTIONS.map((s) => ({ ...s, games: s.games.map((id) => GAMES[id]) }));
}
