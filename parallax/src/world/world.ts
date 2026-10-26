// Assembles the chamber and owns everything that changes every frame in the 3D world.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BuildCtx, PALETTE, type Interactable, type Quality } from './context';
import { buildArchitecture, type DoorRig } from './architecture';
import { buildEngine, type EngineRig } from './engine';
import { buildArchive, type ArchiveRig } from './archive';
import { buildBridge } from './bridge';
import { buildNorth, type NorthRig } from './north';
import type { GameState, GlyphId } from '../game/types';
import { GLYPH_MEANING } from '../game/puzzles/parallax';
import { POS } from '../game/layout';
import { drawGlyph } from './glyphs';
import { FRAME_Y } from './archive';
import { canvasTexture } from './textures';

export interface World {
  scene: THREE.Scene;
  ctx: BuildCtx;
  engine: EngineRig;
  archive: ArchiveRig;
  north: NorthRig;
  door: DoorRig;
  interactables: Map<string, Interactable>;
  update: (dt: number, time: number, s: GameState) => void;
  pick: (raycaster: THREE.Raycaster) => { id: string; distance: number } | null;
  burst: (pos: THREE.Vector3, color: number, count?: number) => void;
  revealWords: (on: boolean) => void;
  setSectionPower: (name: string, power: number) => void;
}

export function buildWorld(renderer: THREE.WebGLRenderer, quality: Quality): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050607);
  scene.fog = new THREE.FogExp2(0x07090a, 0.028);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const ctx = new BuildCtx(scene, quality);
  const { door } = buildArchitecture(ctx);
  const engine = buildEngine(ctx);
  const archive = buildArchive(ctx);
  buildBridge(ctx);
  const north = buildNorth(ctx);

  // the archive wall frames are examined as one object
  const wallProbe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 6), new THREE.MeshBasicMaterial({ visible: false }));
  wallProbe.position.set(POS.shadowWallX + 0.1, FRAME_Y, 4.6);
  scene.add(wallProbe);
  ctx.interact('shadowWall', [wallProbe], 7, { pos: new THREE.Vector3(-5.6, 2.1, 4.6), look: new THREE.Vector3(POS.shadowWallX, FRAME_Y - 0.2, 4.6) });

  // ---------------------------------------------------------------- dust
  const dustCount = quality === 'high' ? 2600 : quality === 'medium' ? 1500 : 700;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 23;
    dustPos[i * 3 + 1] = Math.random() * 14;
    dustPos[i * 3 + 2] = -23 + Math.random() * 36;
    dustSeed[i] = Math.random() * 100;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustSprite = canvasTexture(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
  const dustMat = new THREE.PointsMaterial({ size: 0.05, map: dustSprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xbfd9d5, opacity: 0.55, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------- particle bursts
  const bursts: { points: THREE.Points; vel: THREE.Vector3[]; life: number }[] = [];
  const burst = (pos: THREE.Vector3, color: number, count = 220) => {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      vel.push(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 3.5));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ size: 0.07, map: dustSprite, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bursts.push({ points, vel, life: 0 });
  };

  // ---------------------------------------------------------------- the ending's revealed words
  const wordOrder: GlyphId[] = ['wave', 'span', 'orbit', 'eye'];
  const words = new THREE.Group();
  words.position.set(POS.engine.x, POS.engine.y, POS.engine.z + 1.5);
  scene.add(words);
  const wordMats: THREE.MeshBasicMaterial[] = [];
  wordOrder.forEach((gid, i) => {
    const tex = canvasTexture(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      drawGlyph(g, gid, 16, 64, 128, 'rgba(255,214,150,.9)', 6);
      g.fillStyle = '#fff1d6';
      g.shadowColor = '#ffb45e';
      g.shadowBlur = 20;
      g.font = '600 64px "Iowan Old Style", Palatino, Georgia, serif';
      g.textBaseline = 'middle';
      g.fillText(GLYPH_MEANING[gid], 170, h / 2 + 4);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), mat);
    m.position.set(-4.5 + i * 3, 3.6 - i * 0.2, 0);
    m.lookAt(0, 3.2 - i * 0.2, 20);
    words.add(m);
    wordMats.push(mat);
  });
  let wordsOn = false;

  const interactTargets = () => {
    const list: THREE.Object3D[] = [];
    ctx.interactables.forEach((it) => list.push(...it.objects));
    return list;
  };
  let cachedTargets: THREE.Object3D[] | null = null;

  const fogPresent = new THREE.Color(0x07090a);
  const fogEcho = new THREE.Color(0x120c06);

  const update = (dt: number, time: number, s: GameState) => {
    ctx.temporal.update(s, dt, time);
    const e = ctx.temporal.echo;
    (scene.fog as THREE.FogExp2).color.copy(fogPresent).lerp(fogEcho, e);
    (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.03, 0.022, e);
    (scene.background as THREE.Color).copy(fogPresent).lerp(fogEcho, e);
    for (const fn of ctx.animators) fn(dt, time, s, e);

    const arr = dustGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3] += Math.sin(time * 0.15 + dustSeed[i]) * dt * 0.04;
      arr[i * 3 + 1] += dt * (0.02 + (dustSeed[i] % 1) * 0.03) * (e > 0.5 ? 1.6 : 1);
      if (arr[i * 3 + 1] > 14) arr[i * 3 + 1] = 0.1;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.color.setHex(0xbfd9d5).lerp(new THREE.Color(PALETTE.amber), e * 0.7);

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life += dt;
      const a = b.points.geometry.attributes.position.array as Float32Array;
      b.vel.forEach((v, k) => {
        v.y -= dt * 1.1;
        v.multiplyScalar(1 - dt * 1.4);
        a[k * 3] += v.x * dt; a[k * 3 + 1] += v.y * dt; a[k * 3 + 2] += v.z * dt;
      });
      b.points.geometry.attributes.position.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.life / 2.4);
      if (b.life > 2.4) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        bursts.splice(i, 1);
      }
    }
    wordMats.forEach((m, i) => { m.opacity += ((wordsOn ? 1 : 0) - m.opacity) * Math.min(1, dt * (0.7 - i * 0.1)); });
  };

  return {
    scene,
    ctx,
    engine,
    archive,
    north,
    door,
    interactables: ctx.interactables,
    update,
    pick: (raycaster) => {
      cachedTargets ??= interactTargets();
      const shown = (o: THREE.Object3D | null) => {
        for (; o; o = o.parent) if (!o.visible) return false;
        return true;
      };
      for (const h of raycaster.intersectObjects(cachedTargets, true)) {
        if (!shown(h.object)) continue;
        const id = h.object.userData.interact as string | undefined;
        const it = id ? ctx.interactables.get(id) : undefined;
        if (!it || h.distance > it.range) continue;
        return { id: it.id, distance: h.distance };
      }
      return null;
    },
    burst,
    revealWords: (on) => { wordsOn = on; },
    setSectionPower: (name, power) => {
      const sec = ctx.sections.get(name);
      if (!sec) return;
      sec.lights.forEach((l) => (l.userData.power = power));
      sec.emissive.forEach((m) => (m.userData.power = power));
    },
  };
}
