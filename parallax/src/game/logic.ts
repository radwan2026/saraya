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
import { KEEPSAKE_INFO, WRITINGS, nicheText, writing } from './texts';

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
    if (this.state.keepsake) return { ok: false, message: 'The pedestal is empty now.' };
    this.state.keepsake = k;
    this.state.echoUnlocked = true;
    this.gain(k);
    this.emit({ type: 'keepsake', keepsake: k });
    const info = KEEPSAKE_INFO[k];
    this.addJournal('keepsake', info.name, `I took the ${k}. ${info.desc} The other one dissolved into the air as if it had never been solid. My wrist is warm where the strap of something I cannot see should be. Q, a voice in my memory says.`);
    this.say(`You took the ${k}. The room keeps the other.`, 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- the temporal echo

  shift(): ActionResult {
    const s = this.state;
    if (!s.echoUnlocked) return this.fail('Nothing answers. Not yet.');
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
      this.addJournal('echo', 'The Echo', 'The hall exists twice. In the echo it is 1956: the lamps burn amber, the machines run, the paint is fresh. Whatever I move in one hall is moved in the other. Whatever was built in the old hall is not always still standing in mine.');
    }
    this.emit({ type: 'timeline', timeline: target });
    this.checkShadow();
    return { ok: true };
  }

  // ---------------------------------------------------------------- A: shadow archive

  rotateSculpture(i: number): ActionResult {
    const s = this.state;
    if (s.shadow.solved) return { ok: false, message: 'The plate is locked in place.' };
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
    this.addJournal('glyph-eye', 'The first symbol', 'Wedge, disc, wedge: with the plates turned and the old lamp burning, the shadows closed the engravings into an eye. A compartment in the west wall slid open.', 'eye');
    this.say('The shadows close the figures. Something in the west wall unlocks.', 'good');
  }

  takeSegment(): ActionResult {
    const s = this.state;
    if (!s.shadow.solved) return this.fail('A seamless stone panel. It does not move.');
    if (s.engine.segmentInstalled || this.has('ring-segment') || s.flags.segmentTaken) return { ok: false, message: 'The compartment is empty.' };
    s.flags.segmentTaken = true;
    this.gain('ring-segment');
    this.addJournal('segment', 'Ring segment', 'A curved bronze segment from the compartment, stamped OUTER — VIII. It matches the gap in the engine\'s outer ring.');
    this.say('You take a curved bronze ring segment.', 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- B: memory engine

  installSegment(): ActionResult {
    const s = this.state;
    if (s.engine.segmentInstalled) return { ok: false, message: 'The outer ring is already whole.' };
    if (!this.has('ring-segment')) return this.fail('The outer ring has a gap. It cannot turn until something fills it.');
    if (s.timeline !== 'present') return this.fail('In the echo the outer ring is already whole. The gap is in the present.');
    this.lose('ring-segment');
    s.engine.segmentInstalled = true;
    this.emit({ type: 'segment-installed' });
    this.say('The segment locks into the outer ring.', 'good');
    return { ok: true };
  }

  turnRing(index: number, dir: 1 | -1): ActionResult {
    const s = this.state;
    if (s.engine.solved) return { ok: false, message: 'The rings are locked in calibration.' };
    if (s.timeline !== 'present') return this.fail('The past cannot be moved. The echo engine runs as it always ran.');
    if (!Engine.canTurnRing(index, s.engine.segmentInstalled)) return this.fail('The outer ring catches on its missing segment.');
    s.engine.rings = Engine.turnRing(s.engine.rings, index, dir);
    this.emit({ type: 'ring', index, station: s.engine.rings[index] });
    return { ok: true };
  }

  engageEngine(): ActionResult {
    const s = this.state;
    if (s.engine.solved) return { ok: false };
    if (s.timeline !== 'present') return this.fail('The lever is locked in the echo. It belongs to the present.');
    if (!s.engine.segmentInstalled) return this.fail('The engine coughs. The outer ring is not whole.');
    s.engine.attempts++;
    if (!Engine.isEngineAligned(s.engine.rings)) {
      this.emit({ type: 'engine-rejected' });
      return this.fail('The rings grind, shudder and fall back. The calibration is wrong.');
    }
    s.engine.solved = true;
    this.solved('engine');
    this.emit({ type: 'engine-solved' });
    this.addJournal('glyph-orbit', 'The second symbol', 'Outer V, middle VII, and the hidden inner ring at I: two stations each, exactly as the plate said. The engine woke. Its rings flashed a symbol of three nested circles, and the bridge gate unbolted.', 'orbit');
    this.say('The rings lock. The gate bolts retract.', 'good');
    return { ok: true };
  }

  // ---------------------------------------------------------------- C: impossible bridge

  engageAnchor(): ActionResult {
    const s = this.state;
    if (!s.engine.solved) return this.fail('The anchor has no power. Its cable runs up to the engine.');
    const out = Bridge.engageAnchor(s.timeline, s.bridge.anchored);
    if (out === 'already') return { ok: false, message: 'The anchor is holding the span.' };
    s.bridge.attempts++;
    if (out === 'nothing-to-hold') {
      this.emit({ type: 'anchor-failed' });
      this.addJournal('anchor-ruin', 'The anchor', 'I engaged the anchor in the present. It locked onto the rubble and let go: there was nothing to hold. "It holds whatever is there."');
      return this.fail('The anchor clamps onto empty air and releases. There is nothing here to hold.');
    }
    s.bridge.anchored = true;
    this.emit({ type: 'anchored' });
    this.addJournal('anchored', 'Anchored', 'In the echo the span is whole, so that is what the anchor held. Now the bridge exists in both halls. In the echo the quarantine field still blocks the far end. In the present it is dead.');
    this.say('The anchor bites. The span shudders into both timelines.', 'good');
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
      this.addJournal('glyph-span', 'The third symbol', 'I walked across a bridge that fell decades ago. Its keystone carries a symbol: an arch over a line.', 'span');
      this.say('You stand on the north platform. The keystone shows a third symbol.', 'good');
    }
  }

  // ---------------------------------------------------------------- D: voice that arrived early

  registerSource(source: Exclude<SourceId, 'keepsake'>): ActionResult {
    const s = this.state;
    if (!Voice.canHear(source, s.timeline)) {
      const sig = Voice.SIGNATURES[source];
      return this.fail(sig.timeline === 'echo' ? `The ${sig.name.toLowerCase()} is silent and rusted in the present.` : `In the echo the ${sig.name.toLowerCase()} is new and makes no sound.`);
    }
    if (s.voice.registered.includes(source)) return { ok: true };
    s.voice.registered.push(source);
    const sig = Voice.SIGNATURES[source];
    this.emit({ type: 'source-registered', source });
    this.addJournal(`sound-${source}`, `Sound: ${sig.name}`, `${describeSignature(sig)} Heard in the ${sig.timeline}.`);
    return { ok: true };
  }

  listenRecording(): ActionResult {
    if (!this.state.bridge.crossed) return this.fail('The console is out of reach.');
    if (!this.state.voice.heardRecording) {
      this.state.voice.heardRecording = true;
      this.addJournal('recording', 'The recording', 'A reel labelled CALDER — 1956 — "FOR WHOEVER COMES NEXT". Five sounds, one after another. The third is a sound I know from my own pocket.');
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
    if (!s.bridge.crossed) return this.fail('The console is out of reach.');
    if (!this.voiceSources().includes(source)) return this.fail('The console does not know that sound yet. Listen to it first.');
    s.voice.input = [...s.voice.input, source];
    this.emit({ type: 'voice-input', input: s.voice.input });
    if (s.voice.input.length < Voice.RECORDING.length) return { ok: true };
    s.voice.attempts++;
    if (Voice.isVoiceSolved(s.voice.input)) {
      s.voice.solved = true;
      this.solved('voice');
      this.emit({ type: 'voice-solved' });
      this.addJournal('glyph-wave', 'The fourth symbol', 'The recording and the hall answered each other. The console drew a wave and the steering console beside it woke up. The voice on the reel knew my keepsake\'s sound seventy years before I picked it up.', 'wave');
      this.say('The hall answers the recording. The steering console wakes.', 'good');
      return { ok: true };
    }
    const matched = Voice.matchedPrefix(s.voice.input);
    s.voice.input = [];
    this.emit({ type: 'voice-rejected', matched });
    return this.fail(`The console accepts ${matched} of 5 and resets.`);
  }

  clearVoice() {
    this.state.voice.input = [];
    this.emit({ type: 'voice-input', input: [] });
  }

  // ---------------------------------------------------------------- E: final parallax

  insertCore(): ActionResult {
    const s = this.state;
    if (!s.voice.solved) return this.fail('The steering console is dark.');
    if (s.parallax.coreInserted) return { ok: false, message: 'The core already holds your keepsake.' };
    if (!s.keepsake || !this.has(s.keepsake)) return this.fail('You have nothing to place in the core.');
    this.lose(s.keepsake);
    s.parallax.coreInserted = true;
    this.emit({ type: 'core-inserted' });
    this.say(`The ${s.keepsake} settles into the core. The engine leans towards it.`, 'good');
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
    if (s.timeline !== 'present') return this.fail('The echo engine will not be steered.');
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
      if (t === 'echo' && s.keepsake && out.body.includes('The room kept it')) {
        this.addJournal('kept', 'What the room kept', `In the echo, the keepsake I left behind sits in the ${side} niche. Seen from the engine it lies due ${side}.`);
      }
      return out;
    }
    const w = WRITINGS[id];
    if (!w) return { title: id, body: '' };
    const body = writing(id, t);
    // Clues worth keeping are copied into the journal the first time they are read in the right timeline.
    const clue: Record<string, Timeline> = { archive: 'echo', calder: 'echo', enginePlaque: 'echo', finalPlaque: 'echo', shadowWall: 'present', engine: 'echo', arrival: 'echo', anchor: 'present' };
    if (clue[id] === t) this.addJournal(`read-${id}`, w.title, body);
    if (id === 'finalPlaque' && t === 'present') this.addJournal('read-finalPlaque-present', `${w.title} (scratched)`, body);
    if (id === 'door') this.addJournal('read-door', 'The exit door', WRITINGS.door.present);
    return { title: w.title, body };
  }

  objective(): string {
    const s = this.state;
    if (s.completed) return 'The present is open.';
    if (!s.keepsake) return 'Take one of the keepsakes from the pedestal.';
    if (!s.flags.visitedEcho) return 'Press Q to shift into the Echo.';
    if (!s.shadow.solved) return 'Find what the archive lamp once revealed on the west wall.';
    if (!s.engine.segmentInstalled) return s.flags.segmentTaken ? 'Fit the ring segment to the Memory Engine console.' : 'Take what the west wall was hiding.';
    if (!s.engine.solved) return 'Restore the engine\'s original calibration.';
    if (!s.bridge.anchored) return 'Find a way to keep the bridge standing.';
    if (!s.bridge.crossed) return 'Cross the chasm.';
    if (!s.voice.solved) return 'Match the recording on the north console.';
    return 'Steer the engine and open the door.';
  }

  /** Prompt and availability for every interactable. The world shows this; actions re-check it. */
  interaction(id: string): InteractionInfo {
    const s = this.state;
    const t = s.timeline;
    if (id.startsWith('keepsake-')) {
      if (s.keepsake) return { label: '', enabled: false, reason: 'Only dust remains.' };
      return { label: `Take the ${id.slice(9)}`, enabled: true };
    }
    if (id.startsWith('sculpture-')) {
      if (s.shadow.solved) return { label: 'Plate', enabled: false, reason: 'Locked in place' };
      return { label: 'Turn the plate', enabled: true };
    }
    if (id in MACHINE_IDS) {
      const src = MACHINE_IDS[id];
      const sig = Voice.SIGNATURES[src];
      if (!Voice.canHear(src, t)) return { label: sig.name, enabled: false, reason: t === 'present' ? 'Rusted and silent' : 'New and silent' };
      return { label: s.voice.registered.includes(src) ? `Listen to the ${sig.name.toLowerCase()} again` : `Listen to the ${sig.name.toLowerCase()}`, enabled: true };
    }
    switch (id) {
      case 'compartment':
        if (!s.shadow.solved) return { label: 'Stone panel', enabled: true };
        return s.flags.segmentTaken ? { label: 'Empty compartment', enabled: false, reason: 'Empty' } : { label: 'Take the ring segment', enabled: true };
      case 'engine-console':
        return { label: 'Use the engine console', enabled: true };
      case 'anchor':
        return s.bridge.anchored ? { label: 'Phase anchor', enabled: false, reason: 'Holding the span' } : { label: 'Engage the phase anchor', enabled: true };
      case 'voice-console':
        return { label: 'Use the recording console', enabled: true };
      case 'parallax-console':
        return s.voice.solved ? { label: 'Use the steering console', enabled: true } : { label: 'Steering console', enabled: false, reason: 'Dark' };
      default:
        return { label: `Examine: ${(WRITINGS[id] && WRITINGS[id].title) || (id.startsWith('niche') ? 'niche' : id)}`, enabled: true };
    }
  }
}

export function describeSignature(sig: Voice.Signature): string {
  const beats = sig.rhythm.map((b) => (b === 'S' ? 'short' : b === 'L' ? 'long' : 'one long hiss')).join(', ');
  return `${sig.name}: ${beats}; pitch ${sig.contour}.`;
}
