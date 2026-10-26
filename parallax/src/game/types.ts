// Shared game types. Everything here is plain data so it can be saved, validated and tested.

export type Timeline = 'present' | 'echo';
export type Keepsake = 'compass' | 'hourglass';
export type PuzzleId = 'shadow' | 'engine' | 'bridge' | 'voice' | 'parallax';
export type GlyphId = 'eye' | 'orbit' | 'span' | 'wave' | 'key' | 'crown';
export type SourceId = 'turbine' | 'bell' | 'drip' | 'relay' | 'keepsake';
export type ItemId = Keepsake | 'ring-segment' | 'anchor-key';

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  glyph?: GlyphId;
  /** milliseconds of play time when it was written */
  at: number;
}

export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface GameState {
  version: number;
  timeline: Timeline;
  echoUnlocked: boolean;
  player: PlayerPose;
  keepsake: Keepsake | null;
  inventory: ItemId[];
  journal: JournalEntry[];
  flags: Record<string, boolean>;
  shadow: { rotations: number[]; solved: boolean };
  engine: { segmentInstalled: boolean; rings: number[]; solved: boolean; attempts: number };
  bridge: { anchored: boolean; crossed: boolean; attempts: number };
  voice: { registered: SourceId[]; input: SourceId[]; solved: boolean; heardRecording: boolean; attempts: number };
  parallax: { coreInserted: boolean; sequence: (GlyphId | null)[]; bearing: number; solved: boolean; attempts: number };
  solveOrder: PuzzleId[];
  stats: { playMs: number; shifts: number; interactions: number; failures: number };
  completed: boolean;
}

/** Something the world, audio or UI should react to. Logic emits these; it never touches rendering. */
export type GameEvent =
  | { type: 'keepsake'; keepsake: Keepsake }
  | { type: 'timeline'; timeline: Timeline }
  | { type: 'shift-blocked'; reason: string }
  | { type: 'item'; item: ItemId; gained: boolean }
  | { type: 'journal'; entry: JournalEntry }
  | { type: 'sculpture'; index: number; rotation: number }
  | { type: 'shadow-solved' }
  | { type: 'segment-installed' }
  | { type: 'ring'; index: number; station: number }
  | { type: 'engine-rejected' }
  | { type: 'engine-solved' }
  | { type: 'anchor-failed' }
  | { type: 'anchored' }
  | { type: 'bridge-crossed' }
  | { type: 'source-registered'; source: SourceId }
  | { type: 'voice-input'; input: SourceId[] }
  | { type: 'voice-rejected'; matched: number }
  | { type: 'voice-solved' }
  | { type: 'core-inserted' }
  | { type: 'bearing'; bearing: number }
  | { type: 'parallax-rejected'; reason: ParallaxFailure }
  | { type: 'parallax-solved' }
  | { type: 'message'; text: string; tone?: 'info' | 'warn' | 'good' };

export type ParallaxFailure = 'no-core' | 'sequence' | 'bearing' | 'timeline' | 'locked';

export interface ActionResult {
  ok: boolean;
  message?: string;
}
