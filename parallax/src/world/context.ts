// Shared building context: materials, helpers and registries every part of the chamber uses.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { GameState } from '../game/types';
import { TemporalController } from './temporal';
import { brushedTexture, floorTexture, stainTexture, stoneTexture } from './textures';

export type Quality = 'low' | 'medium' | 'high';

export interface Focus {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface Interactable {
  id: string;
  objects: THREE.Object3D[];
  range: number;
  focus?: Focus;
}

export type Animator = (dt: number, time: number, s: GameState, echo: number) => void;

export const PALETTE = {
  obsidian: 0x0b0c0e,
  emerald: 0x0f7a5a,
  emeraldGlow: 0x22d39a,
  gold: 0xb08d4a,
  cyan: 0x6fe3ff,
  amber: 0xffb45e,
};

export function createMaterials() {
  const stoneMap = stoneTexture(3);
  stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  const floorMap = floorTexture(9);
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  const brushed = brushedTexture(13);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  const stains = stainTexture(5);
  return {
    stoneMap,
    floorMap,
    brushed,
    stains,
    stone: new THREE.MeshStandardMaterial({ map: stoneMap, bumpMap: stoneMap, bumpScale: 0.025, roughness: 0.82, metalness: 0.05, color: 0x9a9da1 }),
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.42, metalness: 0.35, color: 0xb9bcc0 }),
    metal: new THREE.MeshStandardMaterial({ map: brushed, roughness: 0.38, metalness: 0.9, color: 0x9a9690 }),
    darkMetal: new THREE.MeshStandardMaterial({ map: brushed, roughness: 0.45, metalness: 0.85, color: 0x2b2d30 }),
    gold: new THREE.MeshStandardMaterial({ map: brushed, roughness: 0.32, metalness: 0.95, color: 0xb08d4a }),
    patina: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.5, color: 0x2f5d50 }),
    obsidian: new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.3, color: 0x0b0c0e }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd8d0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 1 }),
    emerald: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x22d39a, emissiveIntensity: 1.6 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x6fe3ff, emissiveIntensity: 1.4 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x110800, emissive: 0xffb45e, emissiveIntensity: 2.2 }),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

export class BuildCtx {
  readonly temporal = new TemporalController();
  readonly interactables = new Map<string, Interactable>();
  readonly animators: Animator[] = [];
  readonly mats: Materials;
  /** Lights grouped by section so the intro can switch them on one area at a time. */
  readonly sections = new Map<string, { lights: THREE.Light[]; emissive: THREE.MeshStandardMaterial[] }>();

  constructor(readonly scene: THREE.Scene, readonly quality: Quality) {
    this.mats = createMaterials();
  }

  interact(id: string, objects: THREE.Object3D[], range = 3.2, focus?: Focus) {
    for (const o of objects) o.traverse((c) => (c.userData.interact = id));
    this.interactables.set(id, { id, objects, range, focus });
  }

  animate(fn: Animator) {
    this.animators.push(fn);
  }

  section(name: string) {
    let s = this.sections.get(name);
    if (!s) this.sections.set(name, (s = { lights: [], emissive: [] }));
    return s;
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast && this.quality !== 'low';
    m.receiveShadow = this.quality !== 'low';
    parent.add(m);
    return m;
  }

  box(w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, radius = 0.03): THREE.Mesh {
    const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) / 2.01)) : new THREE.BoxGeometry(w, h, d);
    return this.mesh(geo, mat, parent, x, y, z);
  }
}

/** A gear outline with optional spokes, extruded and bevelled. */
export function gearGeometry(teeth: number, r: number, depth: number, hole = 0.3): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const rin = r * 0.86;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [[rin, a], [r, a + step * 0.2], [r, a + step * 0.46], [rin, a + step * 0.66], [rin, a + step]];
    pts.forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  const h = new THREE.Path();
  h.absarc(0, 0, r * hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  const spokes = 6;
  for (let k = 0; k < spokes; k++) {
    const a0 = (k / spokes) * Math.PI * 2 + 0.18, a1 = a0 + (Math.PI * 2) / spokes - 0.36;
    const w = new THREE.Path();
    w.absarc(0, 0, rin * 0.82, a0, a1, false);
    w.absarc(0, 0, r * hole * 1.6, a1, a0, true);
    s.holes.push(w);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: depth * 0.18, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A flat ring (annulus) with optional gap, extruded with bevels. */
export function ringGeometry(rOuter: number, rInner: number, depth: number, gapStart = 0, gapSize = 0): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const a0 = gapSize > 0 ? gapStart + gapSize : 0;
  const a1 = gapSize > 0 ? gapStart + Math.PI * 2 : Math.PI * 2;
  if (gapSize > 0) {
    s.absarc(0, 0, rOuter, a0, a1, false);
    s.absarc(0, 0, rInner, a1, a0, true);
  } else {
    s.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, rInner, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 96 });
  g.translate(0, 0, -depth / 2);
  return g;
}
