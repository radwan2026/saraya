// The Memory Engine: a suspended assembly of three rings around a glass core, its console and the
// calibration plate. Its present and echo poses come from the puzzle state through the temporal system.

import * as THREE from 'three';
import { BuildCtx, PALETTE, ringGeometry } from './context';
import { POS } from '../game/layout';
import { echoRings, stationLabel } from '../game/puzzles/engine';
import { PARALLAX_INITIAL_BEARING } from '../game/puzzles/parallax';
import type { GameState } from '../game/types';
import { canvasTexture, textTexture, AR_FONT } from './textures';

export interface EngineRig {
  root: THREE.Group;
  yaw: THREE.Group;
  rings: THREE.Group[];
  core: THREE.MeshStandardMaterial;
  shield: THREE.Group;
  holo: THREE.CanvasTexture;
  redrawHolo: (s: GameState) => void;
  /** World position used for the heat-haze effect. */
  heatPoint: THREE.Vector3;
}

export const bearingToYaw = (b: number) => -(b - PARALLAX_INITIAL_BEARING) * (Math.PI / 4);

export function buildEngine(ctx: BuildCtx): EngineRig {
  const { mats, temporal } = ctx;
  const root = new THREE.Group();
  root.position.set(POS.engine.x, POS.engine.y, POS.engine.z);
  ctx.scene.add(root);

  // yoke from the ceiling: never turns
  ctx.box(0.5, 6.5, 0.5, mats.darkMetal, root, -5.6, 4.6, 0, 0.06);
  ctx.box(0.5, 6.5, 0.5, mats.darkMetal, root, 5.6, 4.6, 0, 0.06);
  ctx.box(11.7, 0.5, 0.6, mats.darkMetal, root, 0, 7.7, 0, 0.06);
  ctx.mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 24), mats.gold, root, 0, 7.1, 0);

  // the yaw group is steered by the final console
  const yaw = new THREE.Group();
  root.add(yaw);
  temporal.register({
    id: 'engine-yaw',
    object: yaw,
    speed: 0.9,
    resolve: (s, t) => ({ rotation: [0, t === 'echo' && !s.completed ? 0 : bearingToYaw(s.parallax.bearing), 0] }),
  });
  ctx.mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 16), mats.gold, yaw, 0, 6.0, 0);

  // bezel with eight station plates
  const bezelMat = mats.gold.clone();
  temporal.blendMaterial(bezelMat, { color: 0x6b6247, roughness: 0.62, metalness: 0.8 }, { color: 0xc49a4f, roughness: 0.28, metalness: 0.95 });
  ctx.mesh(new THREE.TorusGeometry(4.95, 0.22, 20, 160), bezelMat, yaw, 0, 0, 0, false);
  ctx.mesh(new THREE.TorusGeometry(5.35, 0.08, 10, 160), bezelMat, yaw, 0, 0, -0.1, false);
  for (let i = 0; i < 8; i++) {
    const ang = Math.PI / 2 - (i / 8) * Math.PI * 2;
    const tex = canvasTexture(128, 128, (g, w) => {
      g.fillStyle = '#121416'; g.fillRect(0, 0, w, w);
      g.strokeStyle = '#b08d4a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, w - 12);
      g.fillStyle = '#e9dcb8'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(stationLabel(i), w / 2, w / 2 + 3);
    });
    const plate = ctx.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.12), [mats.darkMetal, mats.darkMetal, mats.darkMetal, mats.darkMetal, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.4 }), mats.darkMetal] as unknown as THREE.Material, yaw, Math.cos(ang) * 5.55, Math.sin(ang) * 5.55, 0.05);
    plate.rotation.z = ang - Math.PI / 2;
  }
  // index pointer at the top of the bezel
  const pointer = ctx.mesh(new THREE.ConeGeometry(0.18, 0.5, 4), mats.emerald.clone(), yaw, 0, 4.65, 0.25, false);
  pointer.rotation.z = Math.PI;

  // clamps that hold the rings until calibration
  const clamps: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const c = ctx.box(0.5, 1.1, 0.7, mats.darkMetal, yaw, Math.cos(ang) * 4.6, Math.sin(ang) * 4.6, 0, 0.05);
    c.rotation.z = ang - Math.PI / 2;
    c.userData.ang = ang;
    clamps.push(c);
  }

  // rings
  const ringMats = [mats.metal.clone(), mats.gold.clone(), mats.metal.clone()];
  temporal.blendMaterial(ringMats[0], { color: 0x5a5e57, roughness: 0.7 }, { color: 0xa9a49a, roughness: 0.3 });
  temporal.blendMaterial(ringMats[1], { color: 0x5f5a43, roughness: 0.66 }, { color: 0xc49a4f, roughness: 0.25 });
  temporal.blendMaterial(ringMats[2], { color: 0x4b524e, roughness: 0.75 }, { color: 0x9b968e, roughness: 0.32 });
  const radii: [number, number][] = [[4.45, 3.6], [3.4, 2.6], [2.4, 1.65]];
  const rings: THREE.Group[] = [];
  const markerMats: THREE.MeshStandardMaterial[] = [];
  radii.forEach(([ro, ri], i) => {
    const g = new THREE.Group();
    g.position.z = 0.2 + i * 0.12;
    yaw.add(g);
    rings.push(g);
    // the outer ring is cast with a gap at the bottom; the bronze segment fills it
    const gap = i === 0 ? 0.62 : 0;
    ctx.mesh(ringGeometry(ro, ri, 0.34, -Math.PI / 2 - gap / 2, gap), ringMats[i], g, 0, 0, 0, false);
    // station studs
    const studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), mats.gold, 8);
    const m = new THREE.Matrix4();
    for (let k = 0; k < 8; k++) {
      const an = (k / 8) * Math.PI * 2;
      m.compose(new THREE.Vector3(Math.cos(an) * (ro + ri) / 2, Math.sin(an) * (ro + ri) / 2, 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
      studs.setMatrixAt(k, m);
    }
    g.add(studs);
    // the marker at the top. The present inner ring's marker has been scraped away.
    const mm = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.emeraldGlow, emissiveIntensity: 1.6 });
    markerMats.push(mm);
    const marker = ctx.mesh(new THREE.ConeGeometry(0.2, (ro - ri) * 0.75, 3), mm, g, 0, (ro + ri) / 2, 0.22, false);
    marker.rotation.z = Math.PI;
    if (i === 2) {
      temporal.register({ id: 'inner-marker', fade: true, object: marker, resolve: (_s, t) => ({ visible: t === 'echo' }) });
      const scar = ctx.box(0.36, 0.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 1 }), g, 0, (ro + ri) / 2, 0.19, 0.01);
      temporal.register({ id: 'inner-scar', fade: true, object: scar, resolve: (_s, t) => ({ visible: t === 'present' }) });
    }
    temporal.register({
      id: `ring-${i}`,
      object: g,
      speed: 1.6,
      resolve: (s, t) => {
        const st = t === 'echo' && !s.completed ? echoRings()[i] : s.engine.rings[i];
        const open = s.completed ? 1 : 0;
        return { rotation: [open * (i - 1) * 0.6, open * (1 - i) * 0.5, -st * (Math.PI / 4)], position: [0, 0, 0.2 + i * 0.12 + open * (1 - i) * 1.4] };
      },
    });
  });
  temporal.blendMaterial(markerMats[0], { emissiveIntensity: 0.8 }, { emissiveIntensity: 2.4, emissive: PALETTE.amber });
  temporal.blendMaterial(markerMats[1], { emissiveIntensity: 0.8 }, { emissiveIntensity: 2.4, emissive: PALETTE.amber });

  // the missing segment of the outer ring
  const segShape = new THREE.Shape();
  const g0 = -Math.PI / 2 - 0.31, g1 = -Math.PI / 2 + 0.31;
  segShape.absarc(0, 0, 4.45, g0, g1, false);
  segShape.absarc(0, 0, 3.6, g1, g0, true);
  const segment = ctx.mesh(new THREE.ExtrudeGeometry(segShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 }).translate(0, 0, -0.17), mats.gold.clone(), rings[0], 0, 0, 0, false);
  temporal.register({ id: 'outer-segment', fade: true, object: segment, resolve: (s, t) => ({ visible: t === 'echo' || s.engine.segmentInstalled }) });

  // governor shield covers the inner ring while the echo engine runs
  const shield = new THREE.Group();
  shield.position.z = 0.75;
  yaw.add(shield);
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0x2a2416, metalness: 0.9, roughness: 0.35 });
  for (let k = 0; k < 6; k++) {
    const blade = new THREE.Shape();
    const a0 = (k / 6) * Math.PI * 2, a1 = a0 + Math.PI / 3 - 0.08;
    blade.absarc(0, 0, 2.55, a0, a1, false);
    blade.absarc(0, 0, 1.0, a1, a0, true);
    ctx.mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.06, bevelEnabled: false, curveSegments: 16 }), shieldMat, shield, 0, 0, 0, false);
  }
  temporal.register({ id: 'governor-shield', fade: true, object: shield, resolve: (s, t) => ({ visible: t === 'echo' && !s.completed }) });

  // glass core
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.emeraldGlow, emissiveIntensity: 1.2 });
  ctx.mesh(new THREE.IcosahedronGeometry(0.85, 3), coreMat, yaw, 0, 0, 0.55, false);
  ctx.mesh(new THREE.SphereGeometry(1.35, 48, 32), mats.glass, yaw, 0, 0, 0.55, false);
  temporal.blendMaterial(coreMat, { emissiveIntensity: 0.6, emissive: PALETTE.emeraldGlow }, { emissiveIntensity: 1.3, emissive: PALETTE.amber });
  ctx.section('engine').emissive.push(coreMat, ...markerMats);

  const engineLight = new THREE.PointLight(PALETTE.emeraldGlow, 0, 16, 1.8);
  engineLight.position.set(0, 0, 2.2);
  yaw.add(engineLight);
  temporal.blendLight(engineLight, { intensity: 25 }, { intensity: 40, color: PALETTE.amber }, 0.5);
  ctx.section('engine').lights.push(engineLight);

  // down light from the oculus, the room's main shadow caster
  const down = new THREE.SpotLight(0xbfefff, 1200, 30, Math.PI / 7, 0.5, 1.4);
  down.position.set(POS.engine.x, 15.6, POS.engine.z);
  down.target.position.set(POS.engine.x, 0, POS.engine.z);
  if (ctx.quality === 'high') {
    down.castShadow = true;
    down.shadow.mapSize.set(1024, 1024);
    down.shadow.bias = -0.0005;
  }
  ctx.scene.add(down, down.target);
  temporal.blendLight(down, { intensity: 420, color: 0xbfefff }, { intensity: 480, color: 0xffd49a }, 0.3);
  ctx.section('engine').lights.push(down);

  ctx.interact('engine', [rings[0], rings[1], rings[2], shield], 16, { pos: new THREE.Vector3(0, 4.2, 1.8), look: new THREE.Vector3(0, 7.2, -4) });

  // ---------------------------------------------------------------- console
  const con = new THREE.Group();
  con.position.set(POS.engineConsole.x, 0, POS.engineConsole.z);
  ctx.scene.add(con);
  ctx.box(2.8, 1.0, 1.0, mats.darkMetal, con, 0, 0.5, 0, 0.06);
  ctx.box(2.9, 0.08, 1.1, mats.gold, con, 0, 1.02, 0, 0.02);
  const deck = ctx.box(2.6, 0.12, 0.8, mats.obsidian, con, 0, 1.15, 0.12, 0.03);
  deck.rotation.x = -0.45;
  const knobMat = mats.gold.clone();
  for (let i = 0; i < 3; i++) {
    const k = ctx.mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.12, 24), knobMat, con, -0.8 + i * 0.8, 1.27, 0.15);
    k.rotation.x = -0.45;
  }
  const lever = new THREE.Group();
  lever.position.set(1.15, 1.2, 0.05);
  con.add(lever);
  ctx.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 10), mats.metal, lever, 0, 0.27, 0);
  ctx.mesh(new THREE.SphereGeometry(0.08, 16, 12), ctx.mats.emerald, lever, 0, 0.55, 0, false);
  temporal.register({ id: 'engine-lever', object: lever, speed: 3, resolve: (s) => ({ rotation: [s.engine.solved ? 0.9 : -0.5, 0, 0] }) });

  // gauges on the deck, one per ring; their needles follow the ring stations
  const gaugeTex = canvasTexture(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#e9dfc6'; g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2116'; g.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * (c - 18), c + Math.sin(a) * (c - 18)); g.lineTo(c + Math.cos(a) * (c - 40), c + Math.sin(a) * (c - 40)); g.stroke();
      g.fillStyle = '#2a2116'; g.font = 'bold 26px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(stationLabel(k), c + Math.cos(a) * (c - 62), c + Math.sin(a) * (c - 62));
    }
    g.strokeStyle = '#b08d4a'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.stroke();
  });
  const gaugeMat = new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.5, emissive: 0xffe3b0, emissiveMap: gaugeTex, emissiveIntensity: 0.05 });
  temporal.blendMaterial(gaugeMat, { color: 0x77735f, emissiveIntensity: 0.02 }, { color: 0xffffff, emissiveIntensity: 0.25 });
  const deckFrame = new THREE.Group();
  deckFrame.position.set(0, 1.2, 0.1);
  deckFrame.rotation.x = -0.45;
  con.add(deckFrame);
  const gaugeNeedles: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.8 + i * 0.8;
    ctx.mesh(new THREE.CircleGeometry(0.17, 40), gaugeMat, deckFrame, x, 0.075, -0.2, false).rotation.x = -Math.PI / 2;
    ctx.mesh(new THREE.TorusGeometry(0.175, 0.018, 8, 40), mats.gold, deckFrame, x, 0.075, -0.2, false).rotation.x = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.085, -0.2);
    deckFrame.add(pivot);
    const nd = ctx.box(0.012, 0.004, 0.14, new THREE.MeshStandardMaterial({ color: 0x8b1d1d }), pivot, 0, 0, -0.06, 0);
    nd.castShadow = false;
    gaugeNeedles.push(pivot);
    // toggle switches under each knob
    for (let k = 0; k < 3; k++) {
      const sw = ctx.box(0.025, 0.025, 0.06, mats.metal, deckFrame, x - 0.12 + k * 0.12, 0.09, 0.3, 0.005);
      sw.rotation.x = k === 1 ? 0.5 : -0.5;
    }
  }
  // status lamps: amber when idle, red when faulted, green when calibrated
  const statusMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3b2f, emissiveIntensity: 1 }));
  statusMats.forEach((m, i) => ctx.mesh(new THREE.SphereGeometry(0.035, 12, 8), m, deckFrame, 0.95 + (i - 1) * 0.1, 0.08, -0.32, false));
  // vents and nameplate on the console body
  for (let k = 0; k < 7; k++) ctx.box(2.2, 0.025, 0.02, mats.darkMetal, con, 0, 0.25 + k * 0.07, 0.51, 0.004);
  const plateTex = textTexture(['المعايرة'], { w: 512, h: 96, size: 60, color: '#e2c27a', bg: '#1a1611' });
  ctx.mesh(new THREE.PlaneGeometry(0.9, 0.17), new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.5, roughness: 0.4 }), con, 0, 0.84, 0.511, false);
  ctx.animate((dt, t, s, e) => {
    const rings = e > 0.5 && !s.completed ? echoRings() : s.engine.rings;
    gaugeNeedles.forEach((p, i) => {
      const target = -(rings[i] / 8) * Math.PI * 2 + (e > 0.5 ? 0 : Math.sin(t * 7 + i) * 0.02);
      p.rotation.y += (target - p.rotation.y) * Math.min(1, dt * 6);
    });
    statusMats.forEach((m, i) => {
      const ok = s.engine.solved || e > 0.5;
      m.emissive.setHex(ok ? 0x37e69b : !s.engine.segmentInstalled && i === 0 ? 0xff3b2f : 0xffb45e);
      const blink = !ok && i === 0 ? (Math.sin(t * 5) > 0 ? 1.6 : 0.1) : 1.2;
      m.emissiveIntensity = blink;
    });
  });

  // holographic readout floating above the console
  const holo = canvasTexture(1024, 512, () => {}, {});
  const holoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({ map: holo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
  );
  holoMesh.position.set(0, 2.25, 0.05);
  holoMesh.rotation.y = 0;
  holoMesh.rotation.x = -0.1;
  con.add(holoMesh);
  const redrawHolo = (s: GameState) => {
    const c = holo.image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const echo = s.timeline === 'echo';
    const col = echo ? '#ffcf8f' : '#8ff0ff';
    g.strokeStyle = col; g.globalAlpha = 0.55; g.lineWidth = 3;
    g.strokeRect(12, 12, c.width - 24, c.height - 24);
    g.globalAlpha = 1;
    g.fillStyle = col;
    g.font = `700 50px ${AR_FONT}`;
    g.textAlign = 'right';
    g.direction = 'rtl';
    const right = c.width - 48;
    g.fillText(echo ? 'محرّك الذاكرة — يعمل، 1956' : s.engine.solved ? 'محرّك الذاكرة — تمّت المعايرة' : 'محرّك الذاكرة — عطل', right, 90);
    g.font = `44px ${AR_FONT}`;
    const rows: [string, string, string][] = echo
      ? [['الخارجية', 'V', ''], ['الوسطى', 'VII', ''], ['الداخلية', '—', 'محجوبة خلف الدرع']]
      : [
          ['الخارجية', stationLabel(s.engine.rings[0]), s.engine.segmentInstalled ? '' : 'القطعة مفقودة'],
          ['الوسطى', stationLabel(s.engine.rings[1]), ''],
          ['الداخلية', stationLabel(s.engine.rings[2]), 'العلامة ممسوحة'],
        ];
    rows.forEach(([name, st, note], i) => {
      const y = 196 + i * 86;
      g.fillText(name, right - 12, y);
      g.fillText(st, right - 300, y);
      if (note) g.fillText(note, right - 440, y);
    });
    holo.needsUpdate = true;
  };
  // the close-up looks in from the east, past the bezel's lowest station plate, at the deck and hologram
  ctx.interact('engine-console', [con], 3.2, { pos: new THREE.Vector3(1.9, 1.6, -3.7), look: new THREE.Vector3(-0.3, 1.15, -6.1) });

  // calibration plate on its stand
  const plaque = new THREE.Group();
  plaque.position.set(POS.echoPlaque.x, 0, POS.echoPlaque.z);
  plaque.rotation.y = 0.35;
  ctx.scene.add(plaque);
  ctx.mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 10), mats.darkMetal, plaque, 0, 0.55, 0);
  const plate = ctx.box(0.7, 0.45, 0.04, mats.gold.clone(), plaque, 0, 1.2, 0.02, 0.01);
  plate.rotation.x = -0.4;
  temporal.blendMaterial(plate.material as THREE.MeshStandardMaterial, { color: 0x3c5c4e, roughness: 0.9, metalness: 0.4 }, { color: 0xc49a4f, roughness: 0.3, metalness: 0.95 });
  ctx.interact('enginePlaque', [plaque], 2.6, { pos: new THREE.Vector3(POS.echoPlaque.x + 0.35, 1.75, POS.echoPlaque.z + 0.9), look: new THREE.Vector3(POS.echoPlaque.x, 1.2, POS.echoPlaque.z) });

  // clamp retraction and operating motion
  ctx.animate((dt, t, s, e) => {
    const open = s.engine.solved ? 1 : 0;
    for (const c of clamps) {
      const target = 4.6 + open * 0.9;
      const r = Math.hypot(c.position.x, c.position.y);
      const nr = r + (target - r) * Math.min(1, dt * 1.5);
      c.position.set(Math.cos(c.userData.ang) * nr, Math.sin(c.userData.ang) * nr, 0);
    }
    shield.rotation.z += dt * 2.6 * e;
    coreMat.emissiveIntensity *= 1 + Math.sin(t * (e > 0.5 ? 5 : 1.4)) * 0.12;
  });

  return { root, yaw, rings, core: coreMat, shield, holo, redrawHolo, heatPoint: new THREE.Vector3(POS.engine.x, POS.engine.y, POS.engine.z + 0.5) };
}
