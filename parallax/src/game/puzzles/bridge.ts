// PUZZLE C — THE IMPOSSIBLE BRIDGE
// The span over the chasm is rubble in PRESENT and whole in ECHO. In ECHO, however, the quarantine
// field at the far end is still running and nobody can pass. In PRESENT the field is dead.
// The phase anchor at the bridge head freezes "whatever exists at the moment of locking":
// engaged in PRESENT it anchors ruin (nothing); engaged in ECHO it pins the intact span into both
// timelines. Then the player crosses in PRESENT, where the field is gone.

import type { Timeline } from '../types';

export function bridgeExists(timeline: Timeline, anchored: boolean): boolean {
  return timeline === 'echo' || anchored;
}

export function barrierActive(timeline: Timeline): boolean {
  return timeline === 'echo';
}

export type AnchorOutcome = 'anchored' | 'nothing-to-hold' | 'already';

export function engageAnchor(timeline: Timeline, anchored: boolean): AnchorOutcome {
  if (anchored) return 'already';
  return timeline === 'echo' ? 'anchored' : 'nothing-to-hold';
}
