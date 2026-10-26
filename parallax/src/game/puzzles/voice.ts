// PUZZLE D — THE VOICE THAT ARRIVED EARLY
// A seventy-year-old recording on the north console plays five short sound signatures.
// Four come from machines on the north platform: two only run in ECHO (turbine, bell) and two
// only exist as damage in PRESENT (dripping pipe, arcing relay). The fifth is the sound of the
// keepsake the player chose at the very start — recorded decades before they made the choice.
// Every signature has a distinct rhythm (short / long / hiss) and pitch contour, so it can be
// matched by eye from the visual pulses and transcript as well as by ear.

import type { Keepsake, SourceId, Timeline } from '../types';

export type Beat = 'S' | 'L' | 'H';
export type Contour = 'rising' | 'falling' | 'steady';

export interface Signature {
  name: string;
  rhythm: Beat[];
  contour: Contour;
  /** Timeline in which the source can be heard. `null` = carried by the player. */
  timeline: Timeline | null;
}

export const SIGNATURES: Record<Exclude<SourceId, 'keepsake'>, Signature> = {
  turbine: { name: 'Turbine', rhythm: ['L', 'L'], contour: 'rising', timeline: 'echo' },
  bell: { name: 'Signal bell', rhythm: ['S', 'S', 'L'], contour: 'steady', timeline: 'echo' },
  drip: { name: 'Cracked pipe', rhythm: ['S', 'S', 'S'], contour: 'falling', timeline: 'present' },
  relay: { name: 'Arcing relay', rhythm: ['L', 'S'], contour: 'steady', timeline: 'present' },
};

export const KEEPSAKE_SIGNATURES: Record<Keepsake, Signature> = {
  compass: { name: 'Brass compass', rhythm: ['S', 'S'], contour: 'rising', timeline: null },
  hourglass: { name: 'Glass hourglass', rhythm: ['H'], contour: 'falling', timeline: null },
};

export function signatureOf(source: SourceId, keepsake: Keepsake | null): Signature | null {
  if (source === 'keepsake') return keepsake ? KEEPSAKE_SIGNATURES[keepsake] : null;
  return SIGNATURES[source];
}

/** The order of signatures on the recording. Documented solution. */
export const RECORDING: readonly SourceId[] = ['turbine', 'drip', 'keepsake', 'bell', 'relay'];

export function canHear(source: Exclude<SourceId, 'keepsake'>, timeline: Timeline): boolean {
  return SIGNATURES[source].timeline === timeline;
}

/** Number of leading entries that match the recording. */
export function matchedPrefix(input: readonly SourceId[]): number {
  let n = 0;
  while (n < input.length && n < RECORDING.length && input[n] === RECORDING[n]) n++;
  return n;
}

export function isVoiceSolved(input: readonly SourceId[]): boolean {
  return input.length === RECORDING.length && matchedPrefix(input) === RECORDING.length;
}

/** Signatures must all be distinguishable without pitch: rhythms are unique per keepsake set. */
export function rhythmsAreUnique(keepsake: Keepsake): boolean {
  const all = [...Object.values(SIGNATURES), KEEPSAKE_SIGNATURES[keepsake]].map((s) => s.rhythm.join(''));
  return new Set(all).size === all.length;
}
