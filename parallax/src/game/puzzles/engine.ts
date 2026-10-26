// PUZZLE B — THE MEMORY ENGINE
// Three concentric rings hang above the dais, each resting at one of eight stations (I–VIII).
// In ECHO the engine runs in its original calibration: the outer ring shows V and the middle ring
// VII, but the inner ring is hidden behind its spinning governor shield. A brass plate in ECHO states
// the calibration law: every ring rests two stations clockwise of the ring that holds it.
// In PRESENT the rings have drifted and the outer ring is missing a segment, so it cannot be turned
// until the segment from the Shadow Archive is fitted.
// Documented solution: outer V, middle VII, inner I  (indices 4, 6, 0).

export const STATIONS = 8;
export const RING_NAMES = ['outer', 'middle', 'inner'] as const;
export const CALIBRATION_STEP = 2;
/** Stations visible in ECHO. `null` is the shielded inner ring. */
export const ECHO_VISIBLE: readonly (number | null)[] = [4, 6, null];
export const ENGINE_INITIAL = [1, 3, 5] as const;

export function engineTarget(): number[] {
  const outer = ECHO_VISIBLE[0] as number;
  return [outer, (outer + CALIBRATION_STEP) % STATIONS, (outer + 2 * CALIBRATION_STEP) % STATIONS];
}

/** The rings as they actually sit in ECHO, including the hidden inner ring. */
export function echoRings(): number[] {
  return engineTarget();
}

export function stationLabel(station: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][((station % STATIONS) + STATIONS) % STATIONS];
}

export function canTurnRing(index: number, segmentInstalled: boolean): boolean {
  if (index < 0 || index > 2) return false;
  return index !== 0 || segmentInstalled;
}

export function turnRing(rings: readonly number[], index: number, dir: 1 | -1): number[] {
  return rings.map((s, i) => (i === index ? (s + dir + STATIONS) % STATIONS : s));
}

export function isEngineAligned(rings: readonly number[]): boolean {
  const t = engineTarget();
  return rings.length === 3 && rings.every((s, i) => s === t[i]);
}

/** True when the rings obey the calibration law relative to each other, whatever the outer ring. */
export function obeysLaw(rings: readonly number[]): boolean {
  return (
    (rings[1] - rings[0] + STATIONS) % STATIONS === CALIBRATION_STEP &&
    (rings[2] - rings[1] + STATIONS) % STATIONS === CALIBRATION_STEP
  );
}
