// PUZZLE E — THE FINAL PARALLAX
// The north console steers the suspended engine. It needs four things, checked in this order:
//  1. The keepsake seated in the engine core.
//  2. The four symbols earned so far, entered as the ECHO plaque instructs:
//     "What the present learns last, the past knew first" — i.e. the reverse of the order they were
//     learned (wave, span, orbit, eye).
//  3. The engine turned to face what the room kept: the keepsake the player did NOT take appears in
//     ECHO, in the niche of its maker. The hourglass rests with the Clockmaker (east, bearing 2);
//     the compass rests with the Cartographer (west, bearing 6).
//  4. Activation in PRESENT. The exit door says it plainly: ONLY THE PRESENT MAY LEAVE.
// The solution depends on the player's very first choice, which is the story's reveal.

import type { GlyphId, Keepsake, ParallaxFailure, PuzzleId, Timeline } from '../types';

export const BEARINGS = 8;
export const BEARING_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const PARALLAX_INITIAL_BEARING = 4; // facing south, towards the player's entrance

export const PUZZLE_GLYPH: Record<Exclude<PuzzleId, 'parallax'>, GlyphId> = {
  shadow: 'eye',
  engine: 'orbit',
  bridge: 'span',
  voice: 'wave',
};

/** What each symbol turns out to mean at the end. Read in entry order: "I remember being you." */
export const GLYPH_MEANING: Record<GlyphId, string> = {
  wave: 'I',
  span: 'REMEMBER',
  orbit: 'BEING',
  eye: 'YOU',
  key: '—',
  crown: '—',
};

export const GLYPH_PALETTE: readonly GlyphId[] = ['eye', 'orbit', 'span', 'wave', 'key', 'crown'];

export function otherKeepsake(k: Keepsake): Keepsake {
  return k === 'compass' ? 'hourglass' : 'compass';
}

/** Where the left-behind keepsake rests in ECHO, as an engine bearing. */
export function keptByRoomBearing(kept: Keepsake): number {
  return otherKeepsake(kept) === 'hourglass' ? 2 : 6;
}

export function targetSequence(solveOrder: readonly PuzzleId[]): GlyphId[] {
  return solveOrder
    .filter((p): p is Exclude<PuzzleId, 'parallax'> => p !== 'parallax')
    .map((p) => PUZZLE_GLYPH[p])
    .reverse();
}

export interface ParallaxInput {
  keepsake: Keepsake | null;
  coreInserted: boolean;
  sequence: readonly (GlyphId | null)[];
  bearing: number;
  timeline: Timeline;
  solveOrder: readonly PuzzleId[];
  voiceSolved: boolean;
}

export function checkParallax(p: ParallaxInput): ParallaxFailure | null {
  if (!p.voiceSolved) return 'locked';
  if (!p.coreInserted || !p.keepsake) return 'no-core';
  const target = targetSequence(p.solveOrder);
  if (target.length !== 4 || p.sequence.length !== 4 || p.sequence.some((g, i) => g !== target[i])) return 'sequence';
  if (p.bearing !== keptByRoomBearing(p.keepsake)) return 'bearing';
  if (p.timeline !== 'present') return 'timeline';
  return null;
}

export function parallaxFailureText(f: ParallaxFailure): string {
  switch (f) {
    case 'locked':
      return 'The console is dark. Something on this platform still has to speak first.';
    case 'no-core':
      return 'The core socket is empty. The engine has nothing of yours to remember.';
    case 'sequence':
      return 'The symbols flare and scatter. The engine does not recognise that order.';
    case 'bearing':
      return 'The engine turns, searches, and settles. It is facing nothing the room has kept.';
    case 'timeline':
      return 'Everything aligns, then fades. The echo cannot open the door.';
  }
}
