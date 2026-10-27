import { describe, expect, it } from 'vitest';
import { GameLogic } from './logic';
import { createInitialState, loadGame, saveGame, validateState, type KeyValueStore } from './state';
import * as Shadow from './puzzles/shadow';
import * as Engine from './puzzles/engine';
import * as Bridge from './puzzles/bridge';
import * as Voice from './puzzles/voice';
import * as Parallax from './puzzles/parallax';
import { BRIDGE, NORTH_FLOOR, isValidPosition, moveWithCollision, shiftBlockReason } from './layout';
import type { GameEvent, Keepsake } from './types';

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

/** Moves the player like the controller does, through the collision system. */
function walkTo(g: GameLogic, x: number, z: number) {
  const s = g.state;
  for (let i = 0; i < 2000; i++) {
    const dx = x - s.player.x;
    const dz = z - s.player.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const step = Math.min(0.2, d);
    const next = moveWithCollision(s, s.timeline, s.player.x, s.player.z, (dx / d) * step, (dz / d) * step);
    if (next.x === s.player.x && next.z === s.player.z) break;
    g.updatePlayer(next.x, next.z, 0, 0);
  }
  return { x: s.player.x, z: s.player.z };
}

function walkPath(g: GameLogic, points: [number, number][]) {
  for (const [x, z] of points) walkTo(g, x, z);
}

function solveShadow(g: GameLogic) {
  Shadow.SHADOW_TARGET.forEach((target, i) => {
    while (g.state.shadow.rotations[i] !== target) g.rotateSculpture(i);
  });
}

function solveEngine(g: GameLogic) {
  const target = Engine.engineTarget();
  for (let i = 0; i < 3; i++) while (g.state.engine.rings[i] !== target[i]) g.turnRing(i, 1);
}

function playToEnd(keepsake: Keepsake, events: GameEvent[] = []) {
  const g = new GameLogic();
  g.on((e) => events.push(e));
  g.chooseKeepsake(keepsake);
  // A: the pattern only unlocks in the echo, where the lamp works
  solveShadow(g);
  expect(g.state.shadow.solved).toBe(false);
  expect(g.shift().ok).toBe(true);
  expect(g.state.timeline).toBe('echo');
  expect(g.state.shadow.solved).toBe(true);
  expect(g.takeSegment().ok).toBe(true);
  // B: rings are only movable in the present
  expect(g.turnRing(1, 1).ok).toBe(false);
  g.shift();
  expect(g.installSegment().ok).toBe(true);
  solveEngine(g);
  expect(g.engageEngine().ok).toBe(true);
  // C: anchor in the present fails, in the echo it holds; cross in the present
  walkPath(g, [[2.2, 11], [2.2, -7.2], [0, -8.7]]);
  expect(g.state.player.z).toBeLessThan(-8.5);
  expect(g.engageAnchor().ok).toBe(false);
  g.shift();
  expect(g.engageAnchor().ok).toBe(true);
  // In the echo the quarantine field stops the crossing
  const stopped = walkTo(g, 0, -18);
  expect(stopped.z).toBeGreaterThan(-15);
  walkTo(g, 0, -9.5);
  g.shift();
  walkTo(g, 0, -18);
  expect(g.state.bridge.crossed).toBe(true);
  // D: register sources in the timeline where they sound
  expect(g.registerSource('drip').ok).toBe(true);
  expect(g.registerSource('relay').ok).toBe(true);
  expect(g.registerSource('turbine').ok).toBe(false);
  g.shift();
  expect(g.registerSource('turbine').ok).toBe(true);
  expect(g.registerSource('bell').ok).toBe(true);
  g.listenRecording();
  for (const src of Voice.RECORDING) g.pressVoice(src);
  expect(g.state.voice.solved).toBe(true);
  // E
  expect(g.insertCore().ok).toBe(true);
  Parallax.targetSequence(g.state.solveOrder).forEach((gl, i) => g.setGlyph(i, gl));
  const echoAttempt = g.activateParallax();
  expect(echoAttempt.ok).toBe(false);
  g.shift();
  const want = Parallax.keptByRoomBearing(keepsake);
  while (g.state.parallax.bearing !== want) g.turnBearing(1);
  return g;
}

describe('Puzzle A — shadow archive', () => {
  it('needs the exact rotation of every plate and the old light', () => {
    expect(Shadow.isShadowPatternComplete([...Shadow.SHADOW_TARGET])).toBe(true);
    expect(Shadow.isShadowPatternComplete([...Shadow.SHADOW_INITIAL])).toBe(false);
    expect(Shadow.shadowUnlocks([...Shadow.SHADOW_TARGET], 'present')).toBe(false);
    expect(Shadow.shadowUnlocks([...Shadow.SHADOW_TARGET], 'echo')).toBe(true);
  });
  it('distinguishes a mirrored silhouette from an edge-on one', () => {
    expect(Shadow.shadowFit(0, 0)).toBe('mirrored');
    expect(Shadow.shadowFit(0, 1)).toBe('edge');
    expect(Shadow.shadowFit(0, 2)).toBe('complete');
  });
  it('only one of 64 plate combinations works', () => {
    let n = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) if (Shadow.isShadowPatternComplete([a, b, c])) n++;
    expect(n).toBe(1);
  });
});

describe('Puzzle B — memory engine', () => {
  it('derives the hidden inner ring from the calibration law', () => {
    expect(Engine.engineTarget()).toEqual([4, 6, 0]);
    expect(Engine.obeysLaw(Engine.engineTarget())).toBe(true);
    expect(Engine.stationLabel(0)).toBe('I');
  });
  it('a ring arrangement that obeys the law but starts elsewhere is still wrong', () => {
    expect(Engine.obeysLaw([1, 3, 5])).toBe(true);
    expect(Engine.isEngineAligned([1, 3, 5])).toBe(false);
  });
  it('the outer ring cannot move until the segment is installed', () => {
    expect(Engine.canTurnRing(0, false)).toBe(false);
    expect(Engine.canTurnRing(1, false)).toBe(true);
  });
  it('rejects a wrong calibration without breaking anything', () => {
    const g = new GameLogic();
    g.state.shadow.solved = true;
    g.state.inventory.push('ring-segment');
    g.installSegment();
    expect(g.engageEngine().ok).toBe(false);
    expect(g.state.engine.solved).toBe(false);
    solveEngine(g);
    expect(g.engageEngine().ok).toBe(true);
  });
});

describe('Puzzle C — impossible bridge', () => {
  it('anchors only in the echo', () => {
    expect(Bridge.engageAnchor('present', false)).toBe('nothing-to-hold');
    expect(Bridge.engageAnchor('echo', false)).toBe('anchored');
    expect(Bridge.bridgeExists('present', false)).toBe(false);
    expect(Bridge.bridgeExists('present', true)).toBe(true);
  });
  it('blocks a shift that would drop the player into the chasm', () => {
    const s = createInitialState();
    s.engine.solved = true;
    const mid = { x: 0, z: (BRIDGE.z0 + BRIDGE.z1) / 2 };
    expect(isValidPosition(s, 'echo', mid.x, mid.z)).toBe(true);
    expect(shiftBlockReason(s, 'present', mid.x, mid.z)).toMatch(/ستسقط/);
    s.bridge.anchored = true;
    expect(shiftBlockReason(s, 'present', mid.x, mid.z)).toBeNull();
  });
  it('blocks a shift into the quarantine field', () => {
    const s = createInitialState();
    s.engine.solved = true;
    s.bridge.anchored = true;
    expect(shiftBlockReason(s, 'echo', 0, -15.05)).toMatch(/يشغل/);
  });
  it('the gate stays shut until the engine is calibrated', () => {
    const g = new GameLogic();
    walkPath(g, [[2.2, 11], [2.2, -7.2], [0, -8.7], [0, -12]]);
    expect(g.state.player.z).toBeLessThan(-8.4);
    expect(g.state.player.z).toBeGreaterThan(-9);
  });
});

describe('Puzzle D — voice that arrived early', () => {
  it('every signature can be told apart by rhythm alone', () => {
    expect(Voice.rhythmsAreUnique('compass')).toBe(true);
    expect(Voice.rhythmsAreUnique('hourglass')).toBe(true);
  });
  it('needs sources from both timelines and the keepsake', () => {
    const tl = Voice.RECORDING.filter((s) => s !== 'keepsake').map((s) => Voice.SIGNATURES[s as 'drip'].timeline);
    expect(new Set(tl)).toEqual(new Set(['echo', 'present']));
    expect(Voice.RECORDING).toContain('keepsake');
  });
  it('wrong sequences reset and report how much matched', () => {
    const g = new GameLogic();
    const events: GameEvent[] = [];
    g.on((e) => events.push(e));
    g.chooseKeepsake('compass');
    g.state.bridge.crossed = true;
    g.state.voice.registered = ['turbine', 'bell', 'drip', 'relay'];
    for (const s of ['turbine', 'drip', 'bell', 'keepsake', 'relay'] as const) g.pressVoice(s);
    expect(g.state.voice.solved).toBe(false);
    expect(g.state.voice.input).toEqual([]);
    expect(events.find((e) => e.type === 'voice-rejected')).toMatchObject({ matched: 2 });
  });
  it('unknown sounds cannot be entered', () => {
    const g = new GameLogic();
    g.state.bridge.crossed = true;
    expect(g.pressVoice('turbine').ok).toBe(false);
  });
});

describe('Puzzle E — final parallax', () => {
  it('the target sequence is the reverse of the learning order', () => {
    expect(Parallax.targetSequence(['shadow', 'engine', 'bridge', 'voice'])).toEqual(['wave', 'span', 'orbit', 'eye']);
    expect(Parallax.targetSequence(['shadow', 'engine', 'bridge', 'voice']).map((g) => Parallax.GLYPH_MEANING[g]).join(' ')).toBe('أنا أتذكّر أنّي كنتُ أنت');
  });
  it('the bearing depends on the first choice', () => {
    expect(Parallax.keptByRoomBearing('compass')).toBe(2);
    expect(Parallax.keptByRoomBearing('hourglass')).toBe(6);
  });
  it('reports the first failing requirement', () => {
    const base = { keepsake: 'compass' as const, coreInserted: true, sequence: ['wave', 'span', 'orbit', 'eye'] as const, bearing: 2, timeline: 'present' as const, solveOrder: ['shadow', 'engine', 'bridge', 'voice'] as const, voiceSolved: true };
    expect(Parallax.checkParallax({ ...base })).toBeNull();
    expect(Parallax.checkParallax({ ...base, voiceSolved: false })).toBe('locked');
    expect(Parallax.checkParallax({ ...base, coreInserted: false })).toBe('no-core');
    expect(Parallax.checkParallax({ ...base, sequence: ['eye', 'orbit', 'span', 'wave'] })).toBe('sequence');
    expect(Parallax.checkParallax({ ...base, bearing: 6 })).toBe('bearing');
    expect(Parallax.checkParallax({ ...base, timeline: 'echo' })).toBe('timeline');
  });
  it('cannot be activated before the voice puzzle', () => {
    const g = new GameLogic();
    expect(g.activateParallax().ok).toBe(false);
    expect(g.state.completed).toBe(false);
  });
});

describe('Full game', () => {
  for (const k of ['compass', 'hourglass'] as const) {
    it(`can be completed from a fresh save with the ${k}`, () => {
      const events: GameEvent[] = [];
      const g = playToEnd(k, events);
      expect(g.activateParallax().ok).toBe(true);
      expect(g.state.completed).toBe(true);
      expect(g.state.solveOrder).toEqual(['shadow', 'engine', 'bridge', 'voice', 'parallax']);
      expect(events.some((e) => e.type === 'parallax-solved')).toBe(true);
    });
  }

  it('the wrong bearing for the other keepsake fails', () => {
    const g = playToEnd('compass');
    g.turnBearing(1); // move off the correct bearing
    expect(g.activateParallax().ok).toBe(false);
  });

  it('repeated interactions never duplicate rewards or journal entries', () => {
    const g = new GameLogic();
    g.chooseKeepsake('hourglass');
    expect(g.chooseKeepsake('compass').ok).toBe(false);
    solveShadow(g);
    g.shift();
    g.takeSegment();
    g.takeSegment();
    expect(g.state.inventory.filter((i) => i === 'ring-segment')).toHaveLength(1);
    g.shift();
    g.installSegment();
    expect(g.takeSegment().ok).toBe(false);
    const ids = g.state.journal.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shifting is locked until the keepsake is taken', () => {
    const g = new GameLogic();
    expect(g.shift().ok).toBe(false);
    g.chooseKeepsake('compass');
    expect(g.shift().ok).toBe(true);
  });
});

describe('Persistence', () => {
  it('saves and restores progress, keeping solved puzzles solved', () => {
    const store = memoryStore();
    const g = playToEnd('compass');
    saveGame(g.state, store);
    const loaded = loadGame(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.voice.solved).toBe(true);
    expect(loaded.parallax.bearing).toBe(2);
    const resumed = new GameLogic(loaded);
    expect(resumed.activateParallax().ok).toBe(true);
  });
  it('rejects corrupt or impossible saves', () => {
    expect(validateState({})).toBeNull();
    expect(validateState({ ...createInitialState(), version: 1 })).toBeNull();
    const impossible = createInitialState();
    impossible.voice.solved = true;
    expect(validateState(JSON.parse(JSON.stringify(impossible)))).toBeNull();
    const bad = createInitialState() as unknown as { engine: { rings: number[] } };
    bad.engine.rings = [9, 0, 0];
    expect(validateState(bad)).toBeNull();
    const store = memoryStore();
    store.setItem('parallax.save', '{not json');
    expect(loadGame(store)).toBeNull();
  });
  it('the player cannot end up on the north platform without crossing', () => {
    const s = createInitialState();
    expect(isValidPosition(s, 'present', 0, (NORTH_FLOOR.z0 + NORTH_FLOOR.z1) / 2)).toBe(true);
    const g = new GameLogic(s);
    walkPath(g, [[2.2, 11], [2.2, -7.2], [0, -8.7], [0, -20]]);
    expect(g.state.player.z).toBeGreaterThan(-9);
  });
});
