// PUZZLE A — THE SHADOW ARCHIVE
// Three cut-metal plates stand on turntables in front of the west wall. In PRESENT the wall carries
// half-weathered engravings; in ECHO the historical lamp works and throws the plates' shadows onto
// the same wall. Each engraving is completed only by the right shadow, so the full pattern
// (◁ ● ▷, "the eye") never exists in either timeline alone.
//
// Rotations are quarter turns about the vertical axis: 0 = face to the lamp, 1 = edge-on,
// 2 = turned around (the silhouette is mirrored), 3 = edge-on again.

export const SCULPTURE_COUNT = 3;
/** Correct quarter-turn for each plate. Documented solution: [2, 0, 2]. */
export const SHADOW_TARGET = [2, 0, 2] as const;
export const SHADOW_INITIAL = [1, 2, 0] as const;

export type ShadowFit = 'complete' | 'mirrored' | 'edge';

/** How a plate's shadow sits against its engraving at a given rotation. */
export function shadowFit(index: number, rotation: number): ShadowFit {
  const r = ((rotation % 4) + 4) % 4;
  if (r === 1 || r === 3) return 'edge';
  return r === SHADOW_TARGET[index] ? 'complete' : 'mirrored';
}

export function rotateSculpture(rotations: readonly number[], index: number): number[] {
  if (index < 0 || index >= SCULPTURE_COUNT) throw new RangeError('no such sculpture');
  return rotations.map((r, i) => (i === index ? (r + 1) % 4 : r));
}

export function isShadowPatternComplete(rotations: readonly number[]): boolean {
  return rotations.length === SCULPTURE_COUNT && rotations.every((r, i) => shadowFit(i, r) === 'complete');
}

/**
 * The compartment opens only when the pattern is complete AND the old lamp is lit, i.e. in ECHO.
 * In PRESENT there is no light to cast the shadows, however well the plates are turned.
 */
export function shadowUnlocks(rotations: readonly number[], timeline: 'present' | 'echo'): boolean {
  return timeline === 'echo' && isShadowPatternComplete(rotations);
}
