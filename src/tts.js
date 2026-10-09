/**
 * تحويل النص إلى صوت (المعلّق بالذكاء الاصطناعي).
 * يولّد ملف MP3 على الخادم حتى يُشغَّل داخل صفحة اللعبة ويلتقطه OBS / LIVE Studio مع البث.
 * المزوّدون: google (مجاني) | openai | elevenlabs | browser (صوت المتصفح فقط).
 */

/** يقسّم النص إلى مقاطع قصيرة (Google يقبل ~200 حرف لكل طلب) عند علامات الترقيم */
export function splitForTts(text, max = 180) {
  const sentences = String(text).split(/(?<=[.!؟?،,:;])\s+/u).filter(Boolean);
  const out = [];
  let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const s of sentences) {
    if ((cur + ' ' + s).trim().length <= max) { cur = (cur + ' ' + s).trim(); continue; }
    push();
    if (s.length <= max) { cur = s; continue; }
    // جملة طويلة جداً: قسّمها على المسافات
    for (const w of s.split(/\s+/)) {
      if ((cur + ' ' + w).trim().length > max) push();
      cur = (cur + ' ' + w).trim();
    }
  }
  push();
  return out;
}

export class TTS {
  constructor(opt = {}) {
    this.opt = {
      provider: 'google',
      lang: 'ar',
      ...opt,
      openaiKey: opt.openaiKey || process.env.OPENAI_API_KEY || '',
      elevenlabsKey: opt.elevenlabsKey || process.env.ELEVENLABS_API_KEY || '',
    };
    this.cache = new Map();
    this.failures = 0;
    this.lastError = '';
  }

  get provider() { return this.opt.provider; }

  info() {
    return { provider: this.opt.provider, failures: this.failures, lastError: this.lastError };
  }

  /** @returns {Promise<Buffer|null>} ملف MP3، أو null لاستخدام صوت المتصفح */
  async synth(text) {
    text = String(text || '').trim().slice(0, 1200);
    if (!text || this.opt.provider === 'browser') return null;
    const key = `${this.opt.provider}:${text}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let buf = null;
    try {
      if (this.opt.provider === 'openai') buf = await this.openai(text);
      else if (this.opt.provider === 'elevenlabs') buf = await this.elevenlabs(text);
      else buf = await this.google(text);
      this.failures = 0;
    } catch (err) {
      this.failures += 1;
      this.lastError = err?.message || String(err);
      if (this.failures <= 3 || this.failures % 20 === 0) console.warn(`[TTS] فشل توليد الصوت (${this.opt.provider}): ${this.lastError}`);
      return null;
    }
    this.cache.set(key, buf);
    if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value);
    return buf;
  }

  async google(text) {
    const parts = splitForTts(text);
    const bufs = [];
    for (const [i, part] of parts.entries()) {
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob'
        + `&tl=${encodeURIComponent(this.opt.lang)}&total=${parts.length}&idx=${i}&textlen=${part.length}`
        + `&q=${encodeURIComponent(part)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
      bufs.push(Buffer.from(await res.arrayBuffer()));
    }
    // مقاطع MP3 يمكن وصلها مباشرة
    return Buffer.concat(bufs);
  }

  async openai(text) {
    if (!this.opt.openaiKey) throw new Error('لا يوجد مفتاح OpenAI (openaiKey)');
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opt.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.opt.openaiModel || 'gpt-4o-mini-tts',
        voice: this.opt.openaiVoice || 'onyx',
        input: text,
        instructions: this.opt.openaiInstructions || undefined,
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`OpenAI TTS HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async elevenlabs(text) {
    if (!this.opt.elevenlabsKey) throw new Error('لا يوجد مفتاح ElevenLabs (elevenlabsKey)');
    const voice = encodeURIComponent(this.opt.elevenlabsVoiceId || 'pNInz6obpgDQGcFmaJgB');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': this.opt.elevenlabsKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: this.opt.elevenlabsModel || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.6 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
