// GameLogic owns the state and every rule. The renderer, audio and UI only call these actions and
// listen to the events they emit, so the whole game can be played and tested without a browser.

import type { ActionResult, GameEvent, GameState, GlyphId, ItemId, Keepsake, PuzzleId, SourceId, Timeline } from './types';
import { createInitialState } from './state';
import * as Shadow from './puzzles/shadow';
import * as Engine from './puzzles/engine';
import * as Bridge from './puzzles/bridge';
import * as Voice from './puzzles/voice';
import * as Parallax from './puzzles/parallax';
import { NORTH_FLOOR, inRegion, shiftBlockReason } from './layout';
import { KEEPSAKE_INFO, KEEPSAKE_NAME, ROOM_KEPT_IT, WRITINGS, nicheText, writing } from './texts';

type Listener = (e: GameEvent) => void;

export interface InteractionInfo {
  label: string;
  /** false: the prompt shows `reason` instead of an action. */
  enabled: boolean;
  reason?: string;
}

const MACHINE_IDS: Record<string, Exclude<SourceId, 'keepsake'>> = {
  'machine-turbine': 'turbine',
  'machine-bell': 'bell',
  'machine-drip': 'drip',
  'machine-relay': 'relay',
};

export class GameLogic {
  state: GameState;
  private listeners = new Set<Listener>();

  constructor(state: GameState = createInitialState()) {
    this.state = state;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent) {
    this.listeners.forEach((fn) => fn(e));
  }

  private say(text: string, tone: 'info' | 'warn' | 'good' = 'info') {
    this.emit({ type: 'message', text, tone });
  }

  private fail(message: string): ActionResult {
    this.state.stats.failures++;
    this.say(message, 'warn');
    return { ok: false, message };
  }

  has(item: ItemId): boolean {
    return this.state.inventory.includes(item);
  }

  private gain(item: ItemId) {
    if (this.has(item)) return;
    this.state.inventory.push(item);
    this.emit({ type: 'item', item, gained: true });
  }

  private lose(item: ItemId) {
    const i = this.state.inventory.indexOf(item);
    if (i < 0) return;
    this.state.inventory.splice(i, 1);
    this.emit({ type: 'item', item, gained: false });
  }

  addJournal(id: string, title: string, body: string, glyph?: GlyphId): boolean {
    if (this.state.journal.some((j) => j.id === id)) return false;
    const entry = { id, title, body, glyph, at: this.state.stats.playMs };
    this.state.journal.push(entry);
    this.emit({ type: 'journal', entry });
    return true;
  }

  private solved(p: PuzzleId) {
    if (!this.state.solveOrder.includes(p)) this.state.solveOrder.push(p);
  }

  tick(ms: number) {
    this.state.stats.playMs += ms;
  }

  // ---------------------------------------------------------------- onboarding

  chooseKeepsake(k: Keepsake): ActionResult {
    if (this.state.keepsake) return { ok: false, message: 'القاعدة فارغة الآن.' };
    this.state.keepsake = k;
    this.state.echoUnlocked = true;
    this.gain(k);
    this.emit({ type: 'keepsake', keepsake: k });
    const info = KEEPSAKE_INFO[k];
    this.addJournal('keepsake', info.name, `أخذتُ ${KEEPSAKE_NAME[k]}. ${info.desc} أمّا الأخرى فذابت في الهواء كأنها لم تكن صلبة قطّ. معصمي دافئ حيث ينبغي أن يكون حزام شيءٍ لا أراه. «Q»، يقول صوتٌ في ذاكرتي.`);
    this.say(`أخذتَ ${KEEPSAKE_NAME[k]}. وستحتفظ الغرفة بالأخرى.`, 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- the temporal echo

  shift(): ActionResult {
    const s = this.state;
    if (!s.echoUnlocked) return this.fail('لا شيء يجيب. ليس بعد.');
    const target: Timeline = s.timeline === 'present' ? 'echo' : 'present';
    const reason = shiftBlockReason(s, target, s.player.x, s.player.z);
    if (reason) {
      this.emit({ type: 'shift-blocked', reason });
      return this.fail(reason);
    }
    s.timeline = target;
    s.stats.shifts++;
    if (target === 'echo' && !s.flags.visitedEcho) {
      s.flags.visitedEcho = true;
      this.addJournal('echo', 'الصدى', 'القاعة موجودة مرّتين. في الصدى نحن في عام 1956: المصابيح تتّقد بلون كهرماني، والآلات تعمل، والطلاء جديد. ما أحرّكه في إحدى القاعتين يتحرّك في الأخرى. وما بُني في القاعة القديمة ليس دائمًا ما يزال قائمًا في قاعتي.');
    }
    this.emit({ type: 'timeline', timeline: target });
    this.checkShadow();
    return { ok: true };
  }

  // ---------------------------------------------------------------- A: shadow archive

  rotateSculpture(i: number): ActionResult {
    const s = this.state;
    if (s.shadow.solved) return { ok: false, message: 'اللوح مُثبَّت في مكانه.' };
    s.shadow.rotations = Shadow.rotateSculpture(s.shadow.rotations, i);
    this.emit({ type: 'sculpture', index: i, rotation: s.shadow.rotations[i] });
    this.checkShadow();
    return { ok: true };
  }

  private checkShadow() {
    const s = this.state;
    if (s.shadow.solved || !Shadow.shadowUnlocks(s.shadow.rotations, s.timeline)) return;
    s.shadow.solved = true;
    this.solved('shadow');
    this.emit({ type: 'shadow-solved' });
    this.addJournal('glyph-eye', 'الرمز الأول', 'إسفين، قرص، إسفين: حين أُديرت الألواح واتّقد المصباح القديم، أكملت الظلال النقوش فصارت عينًا. وانزلقت حجرة في الجدار الغربي وانفتحت.', 'eye');
    this.say('تُكمل الظلال الأشكال. شيءٌ في الجدار الغربي ينفتح.', 'good');
  }

  takeSegment(): ActionResult {
    const s = this.state;
    if (!s.shadow.solved) return this.fail('لوح حجري بلا أي فاصل. لا يتحرّك.');
    if (s.engine.segmentInstalled || this.has('ring-segment') || s.flags.segmentTaken) return { ok: false, message: 'الحجرة فارغة.' };
    s.flags.segmentTaken = true;
    this.gain('ring-segment');
    this.addJournal('segment', 'قطعة الحلقة', 'قطعة برونزية مقوّسة من الحجرة، مختومة: «الخارجية — VIII». تطابق الفجوة في حلقة المحرّك الخارجية.');
    this.say('تأخذ قطعة حلقة برونزية مقوّسة.', 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- B: memory engine

  installSegment(): ActionResult {
    const s = this.state;
    if (s.engine.segmentInstalled) return { ok: false, message: 'الحلقة الخارجية مكتملة بالفعل.' };
    if (!this.has('ring-segment')) return this.fail('في الحلقة الخارجية فجوة. لن تدور حتى يملأها شيء.');
    if (s.timeline !== 'present') return this.fail('في الصدى الحلقة الخارجية مكتملة أصلًا. الفجوة في الحاضر.');
    this.lose('ring-segment');
    s.engine.segmentInstalled = true;
    this.emit({ type: 'segment-installed' });
    this.say('تستقرّ القطعة في الحلقة الخارجية.', 'good');
    return { ok: true };
  }

  turnRing(index: number, dir: 1 | -1): ActionResult {
    const s = this.state;
    if (s.engine.solved) return { ok: false, message: 'الحلقات مقفلة على المعايرة.' };
    if (s.timeline !== 'present') return this.fail('لا يمكن تحريك الماضي. محرّك الصدى يعمل كما كان يعمل دائمًا.');
    if (!Engine.canTurnRing(index, s.engine.segmentInstalled)) return this.fail('تعلق الحلقة الخارجية عند قطعتها المفقودة.');
    s.engine.rings = Engine.turnRing(s.engine.rings, index, dir);
    this.emit({ type: 'ring', index, station: s.engine.rings[index] });
    return { ok: true };
  }

  engageEngine(): ActionResult {
    const s = this.state;
    if (s.engine.solved) return { ok: false };
    if (s.timeline !== 'present') return this.fail('الذراع مقفلة في الصدى. إنها تنتمي إلى الحاضر.');
    if (!s.engine.segmentInstalled) return this.fail('يسعل المحرّك. الحلقة الخارجية غير مكتملة.');
    s.engine.attempts++;
    if (!Engine.isEngineAligned(s.engine.rings)) {
      this.emit({ type: 'engine-rejected' });
      return this.fail('تصطكّ الحلقات وترتجف ثم ترتدّ. المعايرة خاطئة.');
    }
    s.engine.solved = true;
    this.solved('engine');
    this.emit({ type: 'engine-solved' });
    this.addJournal('glyph-orbit', 'الرمز الثاني', 'الخارجية عند V، والوسطى عند VII، والداخلية المخفيّة عند I: محطّتان بين كل حلقة والتي تليها، تمامًا كما قالت اللوحة. استيقظ المحرّك، وومضت حلقاته برمز من ثلاث دوائر متداخلة، وانفكّت مزاليج بوّابة الجسر.', 'orbit');
    this.say('تُقفل الحلقات. تنسحب مزاليج البوّابة.', 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- C: impossible bridge

  engageAnchor(): ActionResult {
    const s = this.state;
    if (!s.engine.solved) return this.fail('لا طاقة في المرساة. كابلها يصعد إلى المحرّك.');
    const out = Bridge.engageAnchor(s.timeline, s.bridge.anchored);
    if (out === 'already') return { ok: false, message: 'المرساة تمسك الجسر.' };
    s.bridge.attempts++;
    if (out === 'nothing-to-hold') {
      this.emit({ type: 'anchor-failed' });
      this.addJournal('anchor-ruin', 'المرساة', 'شغّلتُ المرساة في الحاضر. أطبقت على الركام ثم أفلتته: لم يكن هناك ما تمسكه. «إنها تمسك ما هو موجود».');
      return this.fail('تُطبق المرساة على هواء فارغ ثم تُفلته. لا شيء هنا لتمسكه.');
    }
    s.bridge.anchored = true;
    this.emit({ type: 'anchored' });
    this.addJournal('anchored', 'تمّ الإرساء', 'في الصدى الجسر مكتمل، فأمسكته المرساة على تلك الحال. صار الجسر موجودًا في القاعتين. في الصدى ما زال حقل العزل يسدّ الطرف البعيد، أمّا في الحاضر فهو ميّت.');
    this.say('تعضّ المرساة. يرتجف الجسر ويثبت في الزمنين.', 'good');
    return { ok: true };
  }

  /** Called by the movement system whenever the player moves. */
  updatePlayer(x: number, z: number, yaw: number, pitch: number) {
    const s = this.state;
    s.player.x = x;
    s.player.z = z;
    s.player.yaw = yaw;
    s.player.pitch = pitch;
    if (!s.bridge.crossed && s.engine.solved && inRegion(NORTH_FLOOR, x, z)) {
      s.bridge.crossed = true;
      this.solved('bridge');
      this.emit({ type: 'bridge-crossed' });
      this.addJournal('glyph-span', 'الرمز الثالث', 'عبرتُ جسرًا سقط قبل عقود. يحمل حجر عقده رمزًا: قوسٌ فوق خط.', 'span');
      this.say('تقف على المنصّة الشمالية. يُظهر حجر العقد رمزًا ثالثًا.', 'good');
    }
  }

  // ---------------------------------------------------------------- D: voice that arrived early

  registerSource(source: Exclude<SourceId, 'keepsake'>): ActionResult {
    const s = this.state;
    if (!Voice.canHear(source, s.timeline)) {
      const sig = Voice.SIGNATURES[source];
      return this.fail(sig.timeline === 'echo' ? `${sig.the} صامت وصدئ في الحاضر.` : `في الصدى ${sig.the} جديد ولا يُصدر صوتًا.`);
    }
    if (s.voice.registered.includes(source)) return { ok: true };
    s.voice.registered.push(source);
    const sig = Voice.SIGNATURES[source];
    this.emit({ type: 'source-registered', source });
    this.addJournal(`sound-${source}`, `صوت: ${sig.name}`, `${describeSignature(sig)} سُمع في ${sig.timeline === 'echo' ? 'الصدى' : 'الحاضر'}.`);
    return { ok: true };
  }

  listenRecording(): ActionResult {
    if (!this.state.bridge.crossed) return this.fail('لوحة التحكّم بعيدة عن متناولك.');
    if (!this.state.voice.heardRecording) {
      this.state.voice.heardRecording = true;
      this.addJournal('recording', 'التسجيل', 'بكرة مكتوب عليها: كالدر — 1956 — «إلى من يأتي بعدي». خمسة أصوات، واحد تلو الآخر. الثالث صوتٌ أعرفه من جيبي.');
    }
    return { ok: true };
  }

  voiceSources(): SourceId[] {
    const s = this.state;
    const list: SourceId[] = [...s.voice.registered];
    if (s.keepsake && this.has(s.keepsake)) list.push('keepsake');
    return list;
  }

  pressVoice(source: SourceId): ActionResult {
    const s = this.state;
    if (s.voice.solved) return { ok: false };
    if (!s.bridge.crossed) return this.fail('لوحة التحكّم بعيدة عن متناولك.');
    if (!this.voiceSources().includes(source)) return this.fail('لا تعرف اللوحة هذا الصوت بعد. استمع إليه أوّلًا.');
    s.voice.input = [...s.voice.input, source];
    this.emit({ type: 'voice-input', input: s.voice.input });
    if (s.voice.input.length < Voice.RECORDING.length) return { ok: true };
    s.voice.attempts++;
    if (Voice.isVoiceSolved(s.voice.input)) {
      s.voice.solved = true;
      this.solved('voice');
      this.emit({ type: 'voice-solved' });
      this.addJournal('glyph-wave', 'الرمز الرابع', 'تجاوب التسجيل والقاعة. رسمت اللوحة موجة، واستيقظت لوحة التوجيه بجانبها. الصوت على البكرة عرف صوت تذكاري قبل أن ألتقطه بسبعين عامًا.', 'wave');
      this.say('تُجيب القاعة التسجيل. تستيقظ لوحة التوجيه.', 'good');
      return { ok: true };
    }
    const matched = Voice.matchedPrefix(s.voice.input);
    s.voice.input = [];
    this.emit({ type: 'voice-rejected', matched });
    return this.fail(`تقبل اللوحة ${matched} من 5 ثم تُعيد الضبط.`);
  }

  clearVoice() {
    this.state.voice.input = [];
    this.emit({ type: 'voice-input', input: [] });
  }

  // ---------------------------------------------------------------- E: final parallax

  insertCore(): ActionResult {
    const s = this.state;
    if (!s.voice.solved) return this.fail('لوحة التوجيه مُظلمة.');
    if (s.parallax.coreInserted) return { ok: false, message: 'النواة تحمل تذكارك بالفعل.' };
    if (!s.keepsake || !this.has(s.keepsake)) return this.fail('ليس معك ما تضعه في النواة.');
    this.lose(s.keepsake);
    s.parallax.coreInserted = true;
    this.emit({ type: 'core-inserted' });
    this.say(`تستقرّ ${KEEPSAKE_NAME[s.keepsake]} في النواة. يميل المحرّك نحوها.`, 'good');
    return { ok: true };
  }

  setGlyph(slot: number, glyph: GlyphId | null): ActionResult {
    const s = this.state;
    if (!s.voice.solved || s.parallax.solved) return { ok: false };
    if (slot < 0 || slot > 3) return { ok: false };
    s.parallax.sequence = s.parallax.sequence.map((g, i) => (i === slot ? glyph : g));
    return { ok: true };
  }

  turnBearing(dir: 1 | -1): ActionResult {
    const s = this.state;
    if (!s.voice.solved || s.parallax.solved) return { ok: false };
    if (s.timeline !== 'present') return this.fail('محرّك الصدى لا يقبل التوجيه.');
    s.parallax.bearing = (s.parallax.bearing + dir + Parallax.BEARINGS) % Parallax.BEARINGS;
    this.emit({ type: 'bearing', bearing: s.parallax.bearing });
    return { ok: true };
  }

  activateParallax(): ActionResult {
    const s = this.state;
    if (s.parallax.solved) return { ok: false };
    s.parallax.attempts++;
    const failure = Parallax.checkParallax({
      keepsake: s.keepsake,
      coreInserted: s.parallax.coreInserted,
      sequence: s.parallax.sequence,
      bearing: s.parallax.bearing,
      timeline: s.timeline,
      solveOrder: s.solveOrder,
      voiceSolved: s.voice.solved,
    });
    if (failure) {
      this.emit({ type: 'parallax-rejected', reason: failure });
      return this.fail(Parallax.parallaxFailureText(failure));
    }
    s.parallax.solved = true;
    s.completed = true;
    this.solved('parallax');
    this.emit({ type: 'parallax-solved' });
    return { ok: true };
  }

  // ---------------------------------------------------------------- reading and objectives

  read(id: string): { title: string; body: string } {
    const s = this.state;
    const t = s.timeline;
    if (id === 'niche-west' || id === 'niche-east') {
      const side = id === 'niche-west' ? 'west' : 'east';
      const out = nicheText(side, t, s.keepsake);
      if (t === 'echo' && s.keepsake && out.body.includes(ROOM_KEPT_IT)) {
        const [adj, dir] = side === 'west' ? ['الغربية', 'الغرب'] : ['الشرقية', 'الشرق'];
        this.addJournal('kept', 'ما احتفظت به الغرفة', `في الصدى، يرقد التذكار الذي تركتُه في الكوّة ${adj}. ومن موقع المحرّك يقع باتجاه ${dir} تمامًا.`);
      }
      return out;
    }
    const w = WRITINGS[id];
    if (!w) return { title: id, body: '' };
    const body = writing(id, t);
    // Clues worth keeping are copied into the journal the first time they are read in the right timeline.
    const clue: Record<string, Timeline> = { archive: 'echo', calder: 'echo', enginePlaque: 'echo', finalPlaque: 'echo', shadowWall: 'present', engine: 'echo', arrival: 'echo', anchor: 'present' };
    if (clue[id] === t) this.addJournal(`read-${id}`, w.title, body);
    if (id === 'finalPlaque' && t === 'present') this.addJournal('read-finalPlaque-present', `${w.title} (محفورة باليد)`, body);
    if (id === 'door') this.addJournal('read-door', 'The exit door', WRITINGS.door.present);
    return { title: w.title, body };
  }

  objective(): string {
    const s = this.state;
    if (s.completed) return 'الحاضر مفتوح.';
    if (!s.keepsake) return 'خُذ أحد التذكارين من القاعدة.';
    if (!s.flags.visitedEcho) return 'اضغط Q للانتقال إلى الصدى.';
    if (!s.shadow.solved) return 'اكتشف ما كان مصباح الأرشيف يكشفه على الجدار الغربي.';
    if (!s.engine.segmentInstalled) return s.flags.segmentTaken ? 'ركّب قطعة الحلقة من لوحة محرّك الذاكرة.' : 'خُذ ما كان الجدار الغربي يخبّئه.';
    if (!s.engine.solved) return 'أعِد المحرّك إلى معايرته الأصلية.';
    if (!s.bridge.anchored) return 'جِد طريقة لإبقاء الجسر قائمًا.';
    if (!s.bridge.crossed) return 'اعبُر الهوّة.';
    if (!s.voice.solved) return 'طابِق التسجيل على لوحة التحكّم الشمالية.';
    return 'وجِّه المحرّك وافتح الباب.';
  }

  /** Prompt and availability for every interactable. The world shows this; actions re-check it. */
  interaction(id: string): InteractionInfo {
    const s = this.state;
    const t = s.timeline;
    if (id.startsWith('keepsake-')) {
      if (s.keepsake) return { label: '', enabled: false, reason: 'لم يبقَ إلا الغبار.' };
      return { label: `خُذ ${KEEPSAKE_NAME[id.slice(9) as Keepsake]}`, enabled: true };
    }
    if (id.startsWith('sculpture-')) {
      if (s.shadow.solved) return { label: 'لوح', enabled: false, reason: 'مُثبَّت في مكانه' };
      return { label: 'أدِر اللوح', enabled: true };
    }
    if (id in MACHINE_IDS) {
      const src = MACHINE_IDS[id];
      const sig = Voice.SIGNATURES[src];
      if (!Voice.canHear(src, t)) return { label: sig.name, enabled: false, reason: t === 'present' ? 'صدئ وصامت' : 'جديد وصامت' };
      return { label: s.voice.registered.includes(src) ? `استمع إلى ${sig.the} مرّة أخرى` : `استمع إلى ${sig.the}`, enabled: true };
    }
    switch (id) {
      case 'compartment':
        if (!s.shadow.solved) return { label: 'لوح حجري', enabled: true };
        return s.flags.segmentTaken ? { label: 'حجرة فارغة', enabled: false, reason: 'فارغة' } : { label: 'خُذ قطعة الحلقة', enabled: true };
      case 'engine-console':
        return { label: 'استخدم لوحة المحرّك', enabled: true };
      case 'anchor':
        return s.bridge.anchored ? { label: 'مرساة الطور', enabled: false, reason: 'تمسك الجسر' } : { label: 'شغّل مرساة الطور', enabled: true };
      case 'voice-console':
        return { label: 'استخدم لوحة التسجيل', enabled: true };
      case 'parallax-console':
        return s.voice.solved ? { label: 'استخدم لوحة التوجيه', enabled: true } : { label: 'لوحة التوجيه', enabled: false, reason: 'مُظلمة' };
      default:
        return { label: `تفحّص: ${(WRITINGS[id] && WRITINGS[id].title) || (id.startsWith('niche') ? 'الكوّة' : id)}`, enabled: true };
    }
  }
}

export function describeSignature(sig: Voice.Signature): string {
  const beats = sig.rhythm.map((b) => (b === 'S' ? 'قصير' : b === 'L' ? 'طويل' : 'هسيس طويل واحد')).join('، ');
  const pitch = sig.contour === 'rising' ? 'صاعدة' : sig.contour === 'falling' ? 'هابطة' : 'ثابتة';
  return `${sig.name}: ${beats}؛ النغمة ${pitch}.`;
}
