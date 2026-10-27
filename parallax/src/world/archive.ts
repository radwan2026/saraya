// The south half of the hall: the keepsake pedestal, the Shadow Archive (puzzle A), the hidden
// compartment, the two keepsake niches and the readable notes.

import * as THREE from 'three';
import { BuildCtx, PALETTE } from './context';
import { POS } from '../game/layout';
import { SHADOW_TARGET } from '../game/puzzles/shadow';
import type { Keepsake } from '../game/types';
import { AR_SERIF, canvasTexture } from './textures';

type P = [number, number];
const tri = (a: P, b: P, c: P) => [a, b, c];
const mirror = (pts: P[]): P[] => pts.map(([x, y]) => [-x, y] as P).reverse();
function halfDisc(side: 'left' | 'right', r: number): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (side === 'left' ? 1 : -1) * (i / 24) * Math.PI;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// Figures are drawn in the wall's frame: u to the viewer's right, v up, centred on the plate.
// Plate order on the wall from the viewer's left: index 2, 1, 0.
const FULL: P[][] = [
  tri([0.45, 0], [-0.35, 0.4], [-0.35, -0.4]), // right-pointing wedge
  halfDisc('left', 0.38).concat(halfDisc('right', 0.38)),
  tri([-0.45, 0], [0.35, 0.4], [0.35, -0.4]), // left-pointing wedge
];
/** The weathered half that is cut into the stone. */
export const ENGRAVED: P[][] = [
  tri([0.45, 0], [-0.35, 0], [-0.35, -0.4]),
  halfDisc('right', 0.38),
  tri([-0.45, 0], [0.35, 0], [0.35, -0.4]),
];
/** The half the light must supply. */
const NEEDED: P[][] = [
  tri([0.45, 0], [-0.35, 0.4], [-0.35, 0]),
  halfDisc('left', 0.38),
  tri([-0.45, 0], [0.35, 0.4], [0.35, 0]),
];
/** Plate outlines in the plate's own frame. A 180° turn mirrors them, so plates whose target is 2 are cut mirrored. */
export const PLATE_SHAPES: P[][] = NEEDED.map((pts, i) => (SHADOW_TARGET[i] === 2 ? mirror(pts) : pts));

const shapeOf = (pts: P[]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

/** Plates sit low; the echo lamp is a floor uplight, so each shadow lands higher on the wall, inside its frame. */
export const PLATE_Y = 1.15;
export const LIGHT_SLOPE = 0.42;
export const FRAME_Y = PLATE_Y + (POS.sculptures[0].x - POS.shadowWallX) * LIGHT_SLOPE;
const LAMP_X = -6.6;
const LAMP = { x: LAMP_X, y: PLATE_Y - (LAMP_X - POS.sculptures[0].x) * LIGHT_SLOPE };

export interface ArchiveRig {
  plates: THREE.Group[];
  archiveLight: THREE.DirectionalLight;
  keepsakeModels: Record<Keepsake, THREE.Group>;
}

export function keepsakeModel(ctx: BuildCtx, k: Keepsake): THREE.Group {
  const g = new THREE.Group();
  const { mats } = ctx;
  if (k === 'compass') {
    ctx.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 40), mats.gold, g, 0, 0.018, 0);
    ctx.mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.004, 40), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 128, (c, w) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, w); c.strokeStyle = '#3a2f1c'; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, w / 2, 54, 0, 7); c.stroke(); c.fillStyle = '#3a2f1c'; c.font = `bold 22px ${AR_SERIF}`; c.textAlign = 'center'; c.fillText('ش', w / 2, 32); }), roughness: 0.6 }), g, 0, 0.037, 0, false);
    const needle = ctx.mesh(new THREE.ConeGeometry(0.012, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0x8b1d1d, metalness: 0.6, roughness: 0.4 }), g, 0, 0.045, 0, false);
    needle.rotation.x = Math.PI / 2;
    ctx.mesh(new THREE.SphereGeometry(0.1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass, g, 0, 0.035, 0, false).scale.y = 0.25;
    ctx.mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16), mats.gold, g, 0, 0.02, -0.12, false);
  } else {
    ctx.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), mats.gold, g, 0, 0.01, 0);
    ctx.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), mats.gold, g, 0, 0.27, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), mats.gold, g, Math.cos(a) * 0.062, 0.14, Math.sin(a) * 0.062);
    }
    const glass = ctx.mesh(new THREE.LatheGeometry([0, 0.02, 0.05, 0.055, 0.03, 0.006, 0.03, 0.055, 0.05, 0.02, 0].map((r, i) => new THREE.Vector2(Math.max(r, 0.001), 0.02 + i * 0.023)), 24), mats.glass, g, 0, 0, 0, false);
    glass.renderOrder = 2;
    ctx.mesh(new THREE.ConeGeometry(0.04, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xd9b26a, roughness: 0.9 }), g, 0, 0.055, 0, false);
  }
  return g;
}

export function buildArchive(ctx: BuildCtx): ArchiveRig {
  const { mats, temporal, scene } = ctx;

  // ---------------------------------------------------------------- pedestal and keepsakes
  const ped = new THREE.Group();
  ped.position.set(POS.pedestal.x, 0, POS.pedestal.z);
  scene.add(ped);
  ctx.mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.15, 48), mats.darkMetal, ped, 0, 0.075, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.85, 32), mats.stone, ped, 0, 0.55, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.12, 48), mats.gold, ped, 0, 1.03, 0);
  const velvet = new THREE.MeshStandardMaterial({ color: 0x5a1820, roughness: 0.95 });
  temporal.blendMaterial(velvet, { color: 0x2c2a29 }, { color: 0x260810 });
  ctx.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 48), velvet, ped, 0, 1.1, 0, false);
  const models: Record<Keepsake, THREE.Group> = { compass: keepsakeModel(ctx, 'compass'), hourglass: keepsakeModel(ctx, 'hourglass') };
  (['compass', 'hourglass'] as Keepsake[]).forEach((k, i) => {
    const m = models[k];
    m.position.set(i === 0 ? -0.22 : 0.22, 1.12, 0);
    ped.add(m);
    temporal.register({
      id: `keepsake-${k}`,
      fade: true,
      object: m,
      speed: 1.2,
      resolve: (s) => ({ visible: !s.keepsake, position: [i === 0 ? -0.22 : 0.22, s.keepsake ? 1.6 : 1.12, 0], scale: s.keepsake ? 0.2 : 1 }),
    });
    ctx.interact(`keepsake-${k}`, [m], 2.6, { pos: new THREE.Vector3(POS.pedestal.x, 1.7, POS.pedestal.z + 0.95), look: new THREE.Vector3(POS.pedestal.x, 1.1, POS.pedestal.z) });
  });
  ctx.interact('pedestal', [ped.children[1], ped.children[2]], 2.4);
  const pedLight = new THREE.SpotLight(0xdff8ff, 120, 8, Math.PI / 9, 0.6, 1.5);
  pedLight.position.set(POS.pedestal.x, 6, POS.pedestal.z + 0.5);
  pedLight.target.position.set(POS.pedestal.x, 1, POS.pedestal.z);
  scene.add(pedLight, pedLight.target);
  temporal.blendLight(pedLight, { intensity: 140 }, { intensity: 90, color: PALETTE.amber });
  ctx.section('pedestal').lights.push(pedLight);

  // ---------------------------------------------------------------- shadow archive
  const wallX = POS.shadowWallX;
  const engraveMat = (pts: P[], full: P[]) => {
    const tex = canvasTexture(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const toPx = ([u, v]: P): P => [w / 2 + u * 400, h / 2 - v * 400];
      // the carved half, darker than the stone with a worn gold edge
      g.beginPath();
      pts.map(toPx).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = 'rgba(6,8,8,.72)';
      g.fill();
      g.strokeStyle = 'rgba(176,141,74,.85)';
      g.lineWidth = 7;
      g.stroke();
      // a faint scratch hint of where the full figure would run
      g.setLineDash([10, 16]);
      g.strokeStyle = 'rgba(200,210,205,.12)';
      g.lineWidth = 3;
      g.beginPath();
      full.map(toPx).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.stroke();
    });
    return new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9 });
  };
  const frameMat = mats.gold.clone();
  temporal.blendMaterial(frameMat, { color: 0x4a5148, roughness: 0.85, metalness: 0.5 }, { color: 0xb08d4a, roughness: 0.3, metalness: 0.95 });

  const limestone = new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.92, metalness: 0 });
  temporal.blendMaterial(limestone, { color: 0x8f8c80 }, { color: 0xb3a68c });
  const plates: THREE.Group[] = [];
  const decals: { meshes: THREE.Mesh[]; index: number }[] = [];
  const plateMat = new THREE.MeshStandardMaterial({ map: mats.brushed, color: 0x8f8a80, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide });
  POS.sculptures.forEach((p, i) => {
    // engraved frame on the wall
    const frame = new THREE.Group();
    frame.position.set(wallX + 0.02, FRAME_Y, p.z);
    frame.rotation.y = Math.PI / 2;
    scene.add(frame);
    for (const [w, h, x, y] of [[1.25, 0.06, 0, 0.6], [1.25, 0.06, 0, -0.6], [0.06, 1.25, 0.6, 0], [0.06, 1.25, -0.6, 0]] as const) ctx.box(w, h, 0.05, frameMat, frame, x, y, 0, 0.01);
    // a pale limestone panel so engravings and shadows read clearly
    ctx.mesh(new THREE.PlaneGeometry(1.2, 1.2), limestone, frame, 0, 0, 0.006, false);
    const engraving = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.28), engraveMat(ENGRAVED[i], FULL[i]));
    engraving.position.z = 0.014;
    frame.add(engraving);
    temporal.register({ id: `engraving-${i}`, fade: true, object: engraving, resolve: (_s, t) => ({ visible: t === 'present' }) });

    // turntable and plate
    const base = new THREE.Group();
    base.position.set(p.x, 0, p.z);
    scene.add(base);
    ctx.mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 32), mats.stone, base, 0, 0.25, 0);
    ctx.mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 32), mats.gold, base, 0, 0.53, 0);
    const turn = new THREE.Group();
    turn.position.y = 0.56;
    base.add(turn);
    ctx.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 32), mats.darkMetal, turn, 0, 0.025, 0);
    const notch = ctx.mesh(new THREE.BoxGeometry(0.06, 0.03, 0.14), ctx.mats.emerald, turn, 0.3, 0.06, 0, false);
    notch.castShadow = false;
    base.traverse((o) => (o.castShadow = false)); // only the plate and its rod throw shadows on the wall
    const rod = ctx.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), mats.metal, turn, 0, 0.17, 0);
    rod.castShadow = true;
    const plateGeo = new THREE.ExtrudeGeometry(shapeOf(PLATE_SHAPES[i]), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 24 });
    plateGeo.translate(0, 0, -0.0175);
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.castShadow = true;
    plate.position.y = PLATE_Y - 0.56;
    plate.rotation.y = Math.PI / 2; // face the lamp at rotation 0
    turn.add(plate);
    plates.push(turn);
    temporal.register({ id: `plate-${i}`, object: turn, speed: 6, resolve: (s) => ({ rotation: [0, s.shadow.rotations[i] * (Math.PI / 2), 0] }) });
    ctx.interact(`sculpture-${i}`, [base], 2.8, undefined);

    // deterministic fallback for devices without real-time shadows
    if (ctx.quality === 'low') {
      const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.72, depthWrite: false });
      const holder = new THREE.Group();
      holder.position.set(wallX + 0.03, FRAME_Y, p.z);
      holder.rotation.y = Math.PI / 2;
      scene.add(holder);
      const asShown = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(PLATE_SHAPES[i])), decalMat);
      const mirrored = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(mirror(PLATE_SHAPES[i]))), decalMat);
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.8), decalMat);
      holder.add(asShown, mirrored, edge);
      decals.push({ meshes: [asShown, edge, mirrored, edge], index: i });
      temporal.register({ id: `decal-${i}`, fade: true, object: holder, resolve: (_s, t) => ({ visible: t === 'echo' }) });
    }
  });
  if (decals.length) {
    ctx.animate((_dt, _t, s) => {
      for (const d of decals) {
        const r = s.shadow.rotations[d.index];
        d.meshes.forEach((m) => (m.visible = false));
        d.meshes[r].visible = true;
      }
    });
  }
  ctx.interact('shadowWall', [], 6);

  // the archive lamp: a floor uplight aimed at the wall. Knocked over and dark in the present.
  const lamp = new THREE.Group();
  scene.add(lamp);
  ctx.mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.06, 24), mats.darkMetal, lamp, 0, 0.03, 0, false);
  for (const s of [-1, 1]) ctx.box(0.04, 0.32, 0.04, mats.gold, lamp, 0, 0.18, s * 0.26, 0.01);
  const head = new THREE.Group();
  head.position.y = LAMP.y;
  head.rotation.z = -Math.atan(LIGHT_SLOPE);
  lamp.add(head);
  const housing = ctx.mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.42, 24, 1, true), mats.gold, head, 0, 0, 0, false);
  housing.rotation.z = Math.PI / 2;
  (housing.material as THREE.Material).side = THREE.DoubleSide;
  ctx.mesh(new THREE.CircleGeometry(0.2, 24), mats.darkMetal, head, 0.21, 0, 0, false).rotation.y = Math.PI / 2;
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: PALETTE.amber, emissiveIntensity: 3 });
  const lens = ctx.mesh(new THREE.CircleGeometry(0.24, 32), lensMat, head, -0.22, 0, 0, false);
  lens.rotation.y = -Math.PI / 2;
  temporal.blendMaterial(lensMat, { emissiveIntensity: 0.0, color: 0x1a1a1a }, { emissiveIntensity: 4, color: 0x111111 });
  temporal.register({
    id: 'archive-lamp',
    object: lamp,
    speed: 1.6,
    resolve: (_s, t) => (t === 'echo' ? { position: [LAMP.x, 0, POS.lamp.z], rotation: [0, 0, 0] } : { position: [LAMP.x + 0.5, 0.22, POS.lamp.z + 0.9], rotation: [0.25, 0.9, 1.45] }),
  });
  ctx.interact('lamp', [lamp], 3);

  const archiveLight = new THREE.DirectionalLight(PALETTE.amber, 0);
  archiveLight.position.set(LAMP.x, LAMP.y, POS.lamp.z);
  archiveLight.target.position.set(wallX - 0.5, LAMP.y + (LAMP.x - (wallX - 0.5)) * LIGHT_SLOPE, POS.lamp.z);
  if (ctx.quality !== 'low') {
    archiveLight.castShadow = true;
    const cam = archiveLight.shadow.camera as THREE.OrthographicCamera;
    cam.left = -3.2; cam.right = 3.2; cam.top = 2.2; cam.bottom = -2.2; cam.near = 0.05; cam.far = 9;
    archiveLight.shadow.mapSize.set(ctx.quality === 'high' ? 2048 : 1024, ctx.quality === 'high' ? 2048 : 1024);
    archiveLight.shadow.bias = -0.0008;
    archiveLight.shadow.normalBias = 0.02;
  }
  scene.add(archiveLight, archiveLight.target);
  temporal.blendLight(archiveLight, { intensity: 0 }, { intensity: 2.6, color: 0xffd7a0 });

  // ---------------------------------------------------------------- hidden compartment
  const comp = new THREE.Group();
  comp.position.set(wallX + 0.02, 1.15, POS.compartment.z);
  comp.rotation.y = Math.PI / 2;
  scene.add(comp);
  ctx.mesh(new THREE.BoxGeometry(1.0, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x050606, roughness: 1, side: THREE.BackSide }), comp, 0, 0, -0.2, false);
  const panel = ctx.box(0.98, 0.78, 0.08, mats.stone, comp, 0, 0, 0.02, 0.01);
  temporal.register({ id: 'compartment-panel', object: panel, speed: 1.4, resolve: (s) => (s.shadow.solved ? { position: [0, 0.82, -0.05] } : { position: [0, 0, 0.02] }) });
  const segGlow = new THREE.MeshStandardMaterial({ color: 0x3a2a10, metalness: 0.9, roughness: 0.3, emissive: PALETTE.gold, emissiveIntensity: 0.6 });
  const seg = ctx.mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 24, 0.9), segGlow, comp, 0, -0.2, -0.18, false);
  temporal.register({ id: 'compartment-segment', fade: true, object: seg, resolve: (s) => ({ visible: s.shadow.solved && !s.flags.segmentTaken }) });
  ctx.interact('compartment', [comp], 2.6, { pos: new THREE.Vector3(wallX + 1.6, 1.6, POS.compartment.z), look: new THREE.Vector3(wallX, 1.15, POS.compartment.z) });

  // ---------------------------------------------------------------- the keepsake niches
  (['west', 'east'] as const).forEach((side) => {
    const p = side === 'west' ? POS.westNiche : POS.eastNiche;
    const s = side === 'west' ? -1 : 1;
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -s * Math.PI / 2;
    scene.add(g);
    ctx.box(2.0, 3.6, 0.5, mats.darkMetal, g, 0, 1.8, -0.6, 0.05);
    ctx.mesh(new THREE.TorusGeometry(1.0, 0.09, 12, 48, Math.PI), mats.gold, g, 0, 3.0, -0.3, false);
    ctx.box(0.12, 3.0, 0.2, mats.gold, g, -1.0, 1.5, -0.3, 0.02);
    ctx.box(0.12, 3.0, 0.2, mats.gold, g, 1.0, 1.5, -0.3, 0.02);
    ctx.mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 24), mats.stone, g, 0, 0.5, 0);
    ctx.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 24), mats.gold, g, 0, 1.03, 0);
    const resident: Keepsake = side === 'west' ? 'compass' : 'hourglass';
    const model = keepsakeModel(ctx, resident);
    model.position.y = 1.06;
    model.scale.setScalar(1.4);
    g.add(model);
    temporal.register({ id: `niche-${side}-keepsake`, fade: true, object: model, resolve: (st, t) => ({ visible: t === 'echo' && !!st.keepsake && st.keepsake !== resident }) });
    const plate = canvasTexture(512, 128, (c, w, h) => {
      c.fillStyle = '#2a2116'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#b08d4a'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#e9dcb8'; c.font = `700 52px ${AR_SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
      c.fillText(side === 'west' ? 'رسّام الخرائط' : 'صانع الساعات', w / 2, h / 2 + 4);
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshStandardMaterial({ map: plate, metalness: 0.6, roughness: 0.4 }));
    pm.position.set(0, 3.55, -0.33);
    g.add(pm);
    const nicheLight = new THREE.PointLight(PALETTE.amber, 0, 4, 2);
    nicheLight.position.set(0, 2.4, 0.2);
    g.add(nicheLight);
    temporal.blendLight(nicheLight, { intensity: 0.5, color: PALETTE.cyan }, { intensity: 12, color: PALETTE.amber });
    ctx.interact(`niche-${side}`, [g], 3.2, { pos: new THREE.Vector3(p.x - s * 2.2, 1.7, p.z), look: new THREE.Vector3(p.x, 1.2, p.z) });
  });

  // ---------------------------------------------------------------- readable props
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xe7dcc2, roughness: 0.95 });
  temporal.blendMaterial(paperMat, { color: 0x6d6450 }, { color: 0xefe4c8 });
  // visitor lectern
  const lectern = new THREE.Group();
  lectern.position.set(POS.notes.arrival.x, 0, POS.notes.arrival.z);
  lectern.rotation.y = -0.5;
  scene.add(lectern);
  ctx.mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 10), mats.darkMetal, lectern, 0, 0.55, 0);
  const desk = ctx.box(0.6, 0.04, 0.42, mats.darkMetal, lectern, 0, 1.12, 0, 0.01);
  desk.rotation.x = -0.45;
  const sheet = ctx.box(0.3, 0.006, 0.4, paperMat, lectern, 0, 1.15, 0.01, 0);
  sheet.rotation.x = -0.45;
  ctx.interact('arrival', [lectern], 2.4, { pos: new THREE.Vector3(POS.notes.arrival.x - 0.45, 1.75, POS.notes.arrival.z + 0.75), look: new THREE.Vector3(POS.notes.arrival.x, 1.1, POS.notes.arrival.z) });
  // archivist's desk
  const adesk = new THREE.Group();
  adesk.position.set(POS.notes.archive.x, 0, POS.notes.archive.z);
  adesk.rotation.y = 0.3;
  scene.add(adesk);
  ctx.box(1.4, 0.06, 0.7, mats.darkMetal, adesk, 0, 0.82, 0, 0.02);
  for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) ctx.box(0.05, 0.8, 0.05, mats.darkMetal, adesk, x, 0.4, z, 0.01);
  ctx.box(0.42, 0.05, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.8 }), adesk, -0.1, 0.88, 0, 0.01);
  ctx.box(0.36, 0.008, 0.26, paperMat, adesk, 0.3, 0.86, 0.05, 0);
  ctx.interact('archive', [adesk], 2.4, { pos: new THREE.Vector3(POS.notes.archive.x + 0.6, 1.6, POS.notes.archive.z + 0.7), look: new THREE.Vector3(POS.notes.archive.x, 0.85, POS.notes.archive.z) });
  // operator's coat stand
  const stand = new THREE.Group();
  stand.position.set(POS.notes.calder.x, 0, POS.notes.calder.z);
  scene.add(stand);
  ctx.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 10), mats.gold, stand, 0, 0.95, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 24), mats.gold, stand, 0, 0.02, 0);
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x2e3330, roughness: 0.95 });
  temporal.blendMaterial(coatMat, { color: 0x4a4c48 }, { color: 0x23302b });
  const coat = ctx.mesh(new THREE.LatheGeometry([0.05, 0.18, 0.24, 0.26, 0.27, 0.3].map((r, i) => new THREE.Vector2(r, 1.75 - i * 0.22)), 20), coatMat, stand, 0, 0, 0.05);
  coat.scale.z = 0.6;
  ctx.interact('calder', [stand], 2.4, { pos: new THREE.Vector3(POS.notes.calder.x - 0.9, 1.6, POS.notes.calder.z + 0.9), look: new THREE.Vector3(POS.notes.calder.x, 1.3, POS.notes.calder.z) });

  return { plates, archiveLight, keepsakeModels: models };
}
