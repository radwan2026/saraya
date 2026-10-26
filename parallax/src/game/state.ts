// Initial state, versioned persistence and validation.

import type { GameState, GlyphId, ItemId, Keepsake, PuzzleId, SourceId } from './types';
import { SHADOW_INITIAL } from './puzzles/shadow';
import { ENGINE_INITIAL, STATIONS } from './puzzles/engine';
import { PARALLAX_INITIAL_BEARING, BEARINGS } from './puzzles/parallax';
import { EYE_HEIGHT, SPAWN } from './layout';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'parallax.save';

export function createInitialState(): GameState {
  return {
    version: SAVE_VERSION,
    timeline: 'present',
    echoUnlocked: false,
    player: { x: SPAWN.x, y: EYE_HEIGHT, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0 },
    keepsake: null,
    inventory: [],
    journal: [],
    flags: {},
    shadow: { rotations: [...SHADOW_INITIAL], solved: false },
    engine: { segmentInstalled: false, rings: [...ENGINE_INITIAL], solved: false, attempts: 0 },
    bridge: { anchored: false, crossed: false, attempts: 0 },
    voice: { registered: [], input: [], solved: false, heardRecording: false, attempts: 0 },
    parallax: { coreInserted: false, sequence: [null, null, null, null], bearing: PARALLAX_INITIAL_BEARING, solved: false, attempts: 0 },
    solveOrder: [],
    stats: { playMs: 0, shifts: 0, interactions: 0, failures: 0 },
    completed: false,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const intIn = (v: unknown, lo: number, hi: number) => isNum(v) && Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

const KEEPSAKES = ['compass', 'hourglass'] as const;
const ITEMS: readonly ItemId[] = ['compass', 'hourglass', 'ring-segment', 'anchor-key'];
const PUZZLES: readonly PuzzleId[] = ['shadow', 'engine', 'bridge', 'voice', 'parallax'];
const SOURCES: readonly SourceId[] = ['turbine', 'bell', 'drip', 'relay', 'keepsake'];
const GLYPHS: readonly GlyphId[] = ['eye', 'orbit', 'span', 'wave', 'key', 'crown'];

/** Returns a sanitised state, or null when the data cannot be trusted. Never throws. */
export function validateState(raw: unknown): GameState | null {
  try {
    if (!isObj(raw) || raw.version !== SAVE_VERSION) return null;
    const s = raw as unknown as GameState;
    if (!oneOf(s.timeline, ['present', 'echo'] as const) || !isBool(s.echoUnlocked) || !isBool(s.completed)) return null;
    const p = s.player;
    if (!isObj(p) || ![p.x, p.y, p.z, p.yaw, p.pitch].every(isNum)) return null;
    if (s.keepsake !== null && !oneOf(s.keepsake, KEEPSAKES)) return null;
    if (!Array.isArray(s.inventory) || !s.inventory.every((i) => oneOf(i, ITEMS))) return null;
    if (!Array.isArray(s.journal) || !s.journal.every((j) => isObj(j) && typeof j.id === 'string' && typeof j.title === 'string' && typeof j.body === 'string')) return null;
    if (!isObj(s.flags)) return null;
    if (!isObj(s.shadow) || !Array.isArray(s.shadow.rotations) || s.shadow.rotations.length !== 3 || !s.shadow.rotations.every((r) => intIn(r, 0, 3)) || !isBool(s.shadow.solved)) return null;
    const e = s.engine;
    if (!isObj(e) || !isBool(e.segmentInstalled) || !isBool(e.solved) || !Array.isArray(e.rings) || e.rings.length !== 3 || !e.rings.every((r) => intIn(r, 0, STATIONS - 1))) return null;
    if (!isObj(s.bridge) || !isBool(s.bridge.anchored) || !isBool(s.bridge.crossed)) return null;
    const v = s.voice;
    if (!isObj(v) || !isBool(v.solved) || !Array.isArray(v.registered) || !v.registered.every((x) => oneOf(x, SOURCES)) || !Array.isArray(v.input) || !v.input.every((x) => oneOf(x, SOURCES))) return null;
    const x = s.parallax;
    if (!isObj(x) || !isBool(x.coreInserted) || !isBool(x.solved) || !intIn(x.bearing, 0, BEARINGS - 1) || !Array.isArray(x.sequence) || x.sequence.length !== 4 || !x.sequence.every((g) => g === null || oneOf(g, GLYPHS))) return null;
    if (!Array.isArray(s.solveOrder) || !s.solveOrder.every((q) => oneOf(q, PUZZLES))) return null;
    if (!isObj(s.stats) || !isNum(s.stats.playMs)) return null;
    // Cross-field rules: progress must be reachable in the order the game allows.
    if (s.engine.solved && !s.shadow.solved) return null;
    if (s.bridge.anchored && !s.engine.solved) return null;
    if (s.voice.solved && !s.bridge.crossed) return null;
    if (s.parallax.solved && !s.voice.solved) return null;
    if (s.engine.segmentInstalled && !s.shadow.solved) return null;
    if (s.parallax.coreInserted && !s.keepsake) return null;
    return {
      ...createInitialState(),
      ...s,
      stats: { ...createInitialState().stats, ...s.stats },
      voice: { ...createInitialState().voice, ...s.voice },
      bridge: { ...createInitialState().bridge, ...s.bridge },
      engine: { ...createInitialState().engine, ...s.engine },
      parallax: { ...createInitialState().parallax, ...s.parallax },
    };
  } catch {
    return null;
  }
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(store: KeyValueStore | null = defaultStore()): GameState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    return raw ? validateState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearSave(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isKeepsake(v: unknown): v is Keepsake {
  return oneOf(v, KEEPSAKES);
}
