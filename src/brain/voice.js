import fs from 'node:fs';
import path from 'node:path';

// ===============================================================
//  التعليق الصوتي — مقدّم البرنامج (صوت شاب واضح) يشرح فكرة البرنامج وطريقة الاشتراك
//  text: النص المنطوق (مُشكَّل ليحسن نطقه)   caption: الترجمة المكتوبة على الشاشة
// ===============================================================

export function voiceLines(channel = '', spokenName = '') {
  const follow = channel
    ? { text: `وَلَا تَنْسَوْا مُتَابَعَةَ ${spokenName ? `حِسَابِ ${spokenName}` : 'الْحِسَابِ'}... لِيَصِلَكُمُ التَّحَدِّي الْقَادِمُ.`, caption: `ولا تنسوا متابعة @${channel} ليصلكم التحدّي القادم 🔔` }
    : { text: 'وَلَا تَنْسَوْا الْمُتَابَعَةَ... لِيَصِلَكُمُ التَّحَدِّي الْقَادِمُ.', caption: 'ولا تنسوا المتابعة ليصلكم التحدّي القادم 🔔' };
  return [
    // شرح البرنامج وطريقة الاشتراك (في الاستوديو)
    { id: 'welcome-1', group: 'welcome', text: 'أَهْلًا أَهْلًا يَا شَبَابُ! مَعَكُمْ مُقَدِّمُ الْبَرْنَامَجِ.', caption: 'أهلاً أهلاً يا شباب! معكم مقدّم البرنامج 🎙️' },
    { id: 'welcome-2', group: 'welcome', text: 'أَهْلًا بِكُمْ فِي بَرْنَامَجِ خَارِجَ الصُّنْدُوقِ... تَحَدِّي الْعَقْلِ.', caption: 'أهلاً بكم في برنامج «خارج الصندوق»... تحدّي العقل 🧠' },
    { id: 'welcome-3', group: 'welcome', text: 'الِاشْتِرَاكُ سَهْلٌ جِدًّا: اُكْتُبْ أَيَّ تَعْلِيقٍ الْآنَ، فَتَظْهَرُ صُورَتُكَ عَلَى الشَّاشَةِ وَتُصْبِحُ مُتَسَابِقًا.', caption: 'الاشتراك سهل: اكتب أي تعليق الآن، فتظهر صورتك وتصبح متسابقاً ✍️' },
    { id: 'welcome-4', group: 'welcome', text: 'عِنْدَنَا سِتُّ جَوْلَاتٍ مِنَ الْأَلْغَازِ: مُحَقِّقٌ، وَآلَاتٌ، وَدَوَائِرُ كَهْرَبَائِيَّةٌ، وَخِدَعٌ بَصَرِيَّةٌ، وَشِفْرَاتٌ عِلْمِيَّةٌ، وَلُغْزٌ نِهَائِيٌّ.', caption: 'ست جولات: محقق، آلات، دوائر، خدع بصرية، شفرات علمية، ولغز نهائي' },
    { id: 'welcome-5', group: 'welcome', text: 'فِي كُلِّ جَوْلَةٍ اُكْتُبْ إِجَابَتَكَ فِي التَّعْلِيقَاتِ... وَانْتَبِهْ: إِجَابَتُكَ الْأُولَى هِيَ النِّهَائِيَّةُ!', caption: 'اكتب إجابتك في التعليقات... وانتبه: إجابتك الأولى هي النهائية! 🔒' },
    { id: 'welcome-6', group: 'welcome', text: 'الْأَسْرَعُ يَأْخُذُ نِقَاطًا أَكْثَرَ، وَالْجَوْلَةُ الْأَخِيرَةُ نِقَاطُهَا مُضَاعَفَةٌ، وَفِي النِّهَايَةِ نُتَوِّجُ الْبَطَلَ.', caption: 'الأسرع يأخذ نقاطاً أكثر، والجولة الأخيرة مضاعفة، وفي النهاية نتوّج البطل 👑' },
    { id: 'welcome-7', group: 'welcome', ...follow },
    { id: 'welcome-8', group: 'welcome', text: 'هَيَّا... أَرُونِي ذَكَاءَكُمْ!', caption: 'هيّا... أروني ذكاءكم! 🔥' },

    // جملة قصيرة في بداية كل لغز
    { id: 'round-detective', group: 'round-detective', text: 'اِبْحَثُوا فِي كُلِّ زَاوِيَةٍ يَا شَبَابُ... الرُّمُوزُ مُخَبَّأَةٌ أَمَامَ أَعْيُنِكُمْ.', caption: 'ابحثوا في كل زاوية... الرموز مخبّأة أمام أعينكم 🔍' },
    { id: 'round-machine', group: 'round-machine', text: 'تَذَكَّرُوا... كُلُّ تُرْسَيْنِ مُتَعَشِّقَيْنِ يَدُورَانِ عَكْسَ بَعْضِهِمَا.', caption: 'تذكّروا... كل ترسين متعشّقين يدوران عكس بعضهما ⚙️' },
    { id: 'round-circuit', group: 'round-circuit', text: 'التَّيَّارُ لَا يَمُرُّ إِلَّا فِي طَرِيقٍ سَلِيمٍ... رَكِّزُوا جَيِّدًا.', caption: 'التيار لا يمرّ إلا في طريق سليم... ركّزوا جيداً 💡' },
    { id: 'round-illusion', group: 'round-illusion', text: 'لَا تُصَدِّقُوا أَعْيُنَكُمْ يَا شَبَابُ... وَلَا مَا حَفِظْتُمُوهُ!', caption: 'لا تصدّقوا أعينكم... ولا ما حفظتموه! 👁️' },
    { id: 'round-science', group: 'round-science', text: 'مَرْحَلَةً بَعْدَ مَرْحَلَةٍ... وَلَا تَنْسَوْا الْقَاعِدَةَ الْأَخِيرَةَ.', caption: 'مرحلة بعد مرحلة... ولا تنسوا القاعدة الأخيرة 🧪' },
    { id: 'round-final', group: 'round-final', text: 'اِحْفَظُوا الْبِطَاقَاتِ جَيِّدًا... سَتَنْقَلِبُ بَعْدَ ثَوَانٍ! وَالنِّقَاطُ مُضَاعَفَةٌ.', caption: 'احفظوا البطاقات جيداً... ستنقلب بعد ثوانٍ! والنقاط مضاعفة ✖️2' },

    // آخر الثواني والتتويج
    { id: 'hurry', group: 'hurry', text: 'أَسْرِعُوا... أَسْرِعُوا! الْوَقْتُ يَنْفَدُ!', caption: 'أسرعوا... أسرعوا! الوقت ينفد! ⏳' },
    { id: 'finale-1', group: 'finale', text: 'مَبْرُوكٌ لِلْبَطَلِ... أَدَاءٌ رَائِعٌ!', caption: 'مبروك للبطل... أداء رائع! 🏆' },
    { id: 'finale-2', group: 'finale', ...follow },
    { id: 'follow', group: 'follow', ...follow },
  ];
}

/**
 * يولّد ملفات الصوت بصوت عربي طبيعي من Microsoft (يحتاج إنترنت) ويحفظها مؤقتاً.
 * إذا فشل (بدون إنترنت) تُستخدم الملفات المرفقة مع اللعبة تلقائياً.
 * يُعاد التوليد فقط عند تغيّر النص أو إعدادات الصوت.
 */
export async function prepareVoices({ cacheDir, lines, voice, log = console.log }) {
  if (!voice || voice.enabled === false || voice.neural === false) return { generated: 0, skipped: true };
  fs.mkdirSync(cacheDir, { recursive: true });
  const sig = (l) => JSON.stringify([l.text, voice.name, voice.rate, voice.pitch]);
  const metaPath = path.join(cacheDir, 'meta.json');
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* أول مرة */ }
  const todo = lines.filter((l) => meta[l.id] !== sig(l) || !fs.existsSync(path.join(cacheDir, `${l.id}.mp3`)));
  if (!todo.length) return { generated: 0 };

  let tts;
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    tts = new MsEdgeTTS();
    await tts.setMetadata(voice.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  } catch (err) {
    log(`[صوت] تعذّر الاتصال بخدمة الأصوات (${err?.message || err}) — سيُستخدم الصوت المرفق.`);
    return { generated: 0, error: true };
  }

  let generated = 0;
  for (const l of todo) {
    try {
      const { audioStream } = tts.toStream(l.text, { rate: voice.rate, pitch: voice.pitch });
      const chunks = [];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 30_000);
        audioStream.on('data', (c) => chunks.push(c));
        audioStream.on('end', () => { clearTimeout(timer); resolve(); });
        audioStream.on('error', (e) => { clearTimeout(timer); reject(e); });
      });
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error('ملف صوت فارغ');
      fs.writeFileSync(path.join(cacheDir, `${l.id}.mp3`), buf);
      meta[l.id] = sig(l);
      generated += 1;
    } catch (err) {
      log(`[صوت] فشل توليد ${l.id}: ${err?.message || err} — سيُستخدم الصوت المرفق.`);
      break;
    }
  }
  try { tts.close(); } catch { /* تجاهل */ }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
  if (generated) log(`[صوت] تم توليد ${generated} مقطعاً بصوت ${voice.name}.`);
  return { generated };
}

/** مسار ملف المقطع: المولَّد بالصوت الطبيعي أولاً، ثم المرفق مع اللعبة */
export function voiceFile(id, { cacheDir, bundledDir }) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  for (const dir of [cacheDir, bundledDir]) {
    const p = path.join(dir, `${id}.mp3`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
