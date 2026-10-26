// The chamber's floor plan, shared by the renderer, the movement code and the tests.
// Units are metres. North is -z (towards the exit door), east is +x.

import type { GameState, Timeline } from './types';
import { barrierActive, bridgeExists } from './puzzles/bridge';

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Circle { x: number; z: number; r: number }

export const HALL = { x0: -12, x1: 12, z0: -24, z1: 14, height: 16 };
export const SPAWN = { x: 0, z: 12.2, yaw: 0 };
export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.3;

export const SOUTH_FLOOR: Rect = { x0: -11.6, x1: 11.6, z0: -9, z1: 13.6 };
export const BRIDGE: Rect = { x0: -1.2, x1: 1.2, z0: -15, z1: -9 };
export const NORTH_FLOOR: Rect = { x0: -11.6, x1: 11.6, z0: -23.4, z1: -15 };
export const CHASM = { z0: -15, z1: -9 };
export const GATE: Rect = { x0: -1.6, x1: 1.6, z0: -9.35, z1: -8.85 };
export const BARRIER: Rect = { x0: -1.6, x1: 1.6, z0: -15.35, z1: -14.75 };

export const POS = {
  pedestal: { x: 0, z: 9.4 },
  sculptures: [
    { x: -9, z: 2.6 },
    { x: -9, z: 4.6 },
    { x: -9, z: 6.6 },
  ],
  shadowWallX: -11.9,
  lamp: { x: -4.8, z: 4.6 },
  compartment: { x: -11.9, z: 9.2 },
  engine: { x: 0, y: 7.2, z: -4 },
  engineConsole: { x: 0, z: -6 },
  echoPlaque: { x: -2.6, z: -6.4 },
  westNiche: { x: -11.2, z: -4 },
  eastNiche: { x: 11.2, z: -4 },
  anchor: { x: 2.5, z: -8.3 },
  voiceConsole: { x: -3.6, z: -17.4 },
  parallaxConsole: { x: 3.6, z: -16.8 },
  finalPlaque: { x: 6.2, z: -16.2 },
  door: { x: 0, z: -23.9 },
  machines: {
    turbine: { x: -8, z: -18 },
    bell: { x: 8, z: -18 },
    drip: { x: -8.5, z: -21.6 },
    relay: { x: 8.5, z: -21.6 },
  },
  notes: {
    arrival: { x: 3.4, z: 10.6 },
    archive: { x: -6.8, z: 8.8 },
    calder: { x: 6.8, z: 1.2 },
  },
};

const SOLID_CIRCLES: Circle[] = [
  { ...POS.pedestal, r: 0.55 },
  ...POS.sculptures.map((p) => ({ ...p, r: 0.5 })),
  { ...POS.westNiche, r: 0.6 },
  { ...POS.eastNiche, r: 0.6 },
  { ...POS.anchor, r: 0.55 },
  { ...POS.voiceConsole, r: 0.7 },
  { ...POS.parallaxConsole, r: 0.7 },
  { ...POS.machines.turbine, r: 1.3 },
  { ...POS.machines.bell, r: 1.0 },
  { ...POS.machines.drip, r: 0.7 },
  { ...POS.machines.relay, r: 0.8 },
  { ...POS.notes.archive, r: 0.45 },
  { ...POS.notes.calder, r: 0.45 },
  { ...POS.notes.arrival, r: 0.4 },
];
const SOLID_RECTS: Rect[] = [
  { x0: -1.5, x1: 1.5, z0: -6.6, z1: -5.4 }, // engine console
];

const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const circleHitsRect = (r: Rect, x: number, z: number, rad: number) => {
  const cx = Math.max(r.x0, Math.min(x, r.x1));
  const cz = Math.max(r.z0, Math.min(z, r.z1));
  return (x - cx) ** 2 + (z - cz) ** 2 < rad * rad;
};

type WorldView = Pick<GameState, 'engine' | 'bridge'>;

export function walkableRects(s: WorldView, timeline: Timeline): Rect[] {
  const rects = [SOUTH_FLOOR, NORTH_FLOOR];
  if (s.engine.solved && bridgeExists(timeline, s.bridge.anchored)) rects.push(BRIDGE);
  return rects;
}

export function solidRects(s: WorldView, timeline: Timeline): Rect[] {
  const rects = [...SOLID_RECTS];
  if (!s.engine.solved) rects.push(GATE);
  if (barrierActive(timeline)) rects.push(BARRIER);
  return rects;
}

export function isSupported(s: WorldView, timeline: Timeline, x: number, z: number): boolean {
  return walkableRects(s, timeline).some((r) => inRect(r, x, z));
}

export function isBlocked(s: WorldView, timeline: Timeline, x: number, z: number, rad = PLAYER_RADIUS): boolean {
  if (SOLID_CIRCLES.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + rad) ** 2)) return true;
  return solidRects(s, timeline).some((r) => circleHitsRect(r, x, z, rad));
}

export function isValidPosition(s: WorldView, timeline: Timeline, x: number, z: number): boolean {
  return isSupported(s, timeline, x, z) && !isBlocked(s, timeline, x, z);
}

/** Slides the player along walls: each axis is tried separately so movement never tunnels or sticks. */
export function moveWithCollision(
  s: WorldView,
  timeline: Timeline,
  x: number,
  z: number,
  dx: number,
  dz: number,
): { x: number; z: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  let px = x;
  let pz = z;
  for (let i = 0; i < steps; i++) {
    const nx = px + dx / steps;
    if (isValidPosition(s, timeline, nx, pz)) px = nx;
    const nz = pz + dz / steps;
    if (isValidPosition(s, timeline, px, nz)) pz = nz;
  }
  return { x: px, z: pz };
}

/** Why a timeline shift would be unsafe at this spot, or null when it is allowed. */
export function shiftBlockReason(s: WorldView, target: Timeline, x: number, z: number): string | null {
  if (!isSupported(s, target, x, z)) {
    return target === 'present'
      ? 'There is no floor here in the present. You would fall.'
      : 'The echo has no floor here.';
  }
  if (isBlocked(s, target, x, z)) {
    return target === 'echo' ? 'Something occupies this space in the echo.' : 'Something occupies this space in the present.';
  }
  return null;
}

export function inRegion(r: Rect, x: number, z: number): boolean {
  return inRect(r, x, z);
}
