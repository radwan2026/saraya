// Architectural dressing: the south entrance, wall bays, pendant lamps, dais curb, floor furniture,
// debris and inscriptions. Static pieces are merged per material so the extra detail costs few draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BuildCtx, PALETTE } from './context';
import { HALL, POS } from '../game/layout';
import { AR_FONT, canvasTexture, rng, textTexture } from './textures';

/** Collects transformed geometry per material and merges it into one mesh per material. */
class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
    this.e.set(...rot);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...pos), this.q, new THREE.Vector3(...scale));
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g = g.applyMatrix4(this.m);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  box(w: number, h: number, d: number, mat: THREE.Material, pos: [number, number, number], rot?: [number, number, number], r = 0.02) {
    this.add(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.01)) : new THREE.BoxGeometry(w, h, d), mat, pos, rot);
  }

  build(parent: THREE.Object3D, receive = true, cast = false): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.parts.forEach((geos, mat) => {
      const merged = mergeGeometries(geos, false);
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = receive;
      mesh.castShadow = cast;
      parent.add(mesh);
      out.push(mesh);
      geos.forEach((g) => g.dispose());
    });
    this.parts.clear();
    return out;
  }
}

export interface DetailsRig {
  clockPos: THREE.Vector3;
  /** Advances the echo wall clock by one second. */
  stepSecond: () => void;
  /** Releases a puff of steam from the turbine stack (echo). */
  puff: () => void;
  turbineStack: THREE.Vector3;
}

export function buildDetails(ctx: BuildCtx): DetailsRig {
  const { scene, mats, temporal } = ctx;
  const root = new THREE.Group();
  root.name = 'details';
  scene.add(root);
  const W = HALL.x1;
  const lowQ = ctx.quality === 'low';

  // shared detail materials, tarnished in the present and polished in the echo
  const trim = mats.gold.clone();
  temporal.blendMaterial(trim, { color: 0x5d5a45, roughness: 0.7, metalness: 0.7 }, { color: 0xb8924c, roughness: 0.3, metalness: 0.95 });
  const panel = new THREE.MeshStandardMaterial({ map: mats.brushed, color: 0x1b1f22, roughness: 0.55, metalness: 0.6 });
  temporal.blendMaterial(panel, { color: 0x16191b, roughness: 0.75 }, { color: 0x2a2620, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.62, metalness: 0.05 });
  temporal.blendMaterial(wood, { color: 0x2a221c, roughness: 0.9 }, { color: 0x4a2c18, roughness: 0.45 });
  const iron = mats.darkMetal;

  const stat = new Batch();

  // ---------------------------------------------------------------- side wall bays
  // pilaster positions; bays are the spaces between neighbours
  const pil = [12, 8, 4, 0, -8, -12, -16, -20];
  for (const side of [-1, 1]) {
    const x = side * (W - 0.06);
    const ry = -side * Math.PI / 2;
    for (let i = 0; i < pil.length - 1; i++) {
      const z0 = pil[i], z1 = pil[i + 1];
      if (Math.abs(z0 - z1) > 4.5) continue; // the niche bay stays clear
      const zc = (z0 + z1) / 2;
      const w = Math.abs(z0 - z1) - 1.3;
      // west bays behind the shadow archive keep their lower wall for the engraved frames
      const archiveBay = side < 0 && zc > 0 && zc < 12;
      const y0 = archiveBay ? 3.5 : 1.6, y1 = 8.6;
      const h = y1 - y0;
      const yc = (y0 + y1) / 2;
      stat.box(0.08, h, w, panel, [x, yc, zc], [0, 0, 0], 0.02);
      // gold frame
      stat.box(0.06, 0.07, w + 0.1, trim, [x - side * 0.05, y1, zc]);
      stat.box(0.06, 0.07, w + 0.1, trim, [x - side * 0.05, y0, zc]);
      stat.box(0.06, h, 0.07, trim, [x - side * 0.05, yc, zc - w / 2]);
      stat.box(0.06, h, 0.07, trim, [x - side * 0.05, yc, zc + w / 2]);
      // vertical fluting inside the panel
      for (let k = 1; k < 5; k++) stat.box(0.05, h - 0.5, 0.04, iron, [x - side * 0.05, yc, zc - w / 2 + (w * k) / 5], [0, 0, 0], 0.01);
      // a ventilation grille high in each bay
      stat.box(0.06, 0.5, 1.2, iron, [x - side * 0.04, 10.0, zc], [0, 0, 0], 0.02);
      for (let k = 0; k < 6; k++) stat.box(0.07, 0.04, 1.1, trim, [x - side * 0.06, 9.8 + k * 0.08, zc], [0, 0, 0], 0);
      void ry;
    }
    // dado rail and baseboard; they break at the hidden compartment and the niche
    const breaks = side < 0 ? [[POS.compartment.z - 0.7, POS.compartment.z + 0.7], [POS.westNiche.z - 1.3, POS.westNiche.z + 1.3]] : [[POS.eastNiche.z - 1.3, POS.eastNiche.z + 1.3]];
    let start = HALL.z0 + 0.5;
    const ends = [...breaks.sort((a, b) => a[0] - b[0]), [HALL.z1 - 0.5, HALL.z1 - 0.5]];
    for (const [b0, b1] of ends) {
      const len = b0 - start;
      if (len > 0.2) {
        stat.box(0.1, 0.08, len, trim, [side * (W - 0.08), 1.15, (start + b0) / 2], [0, 0, 0], 0.02);
        stat.box(0.12, 0.28, len, iron, [side * (W - 0.08), 0.14, (start + b0) / 2], [0, 0, 0], 0.02);
      }
      start = b1;
    }
  }

  // ---------------------------------------------------------------- north wall beside the door
  for (const s of [-1, 1]) {
    for (const xc of [5.6, 9.2]) {
      const x = s * xc;
      stat.box(2.6, 7, 0.08, panel, [x, 5.1, HALL.z0 + 0.06], [0, 0, 0], 0.02);
      stat.box(2.7, 0.07, 0.06, trim, [x, 8.6, HALL.z0 + 0.12]);
      stat.box(2.7, 0.07, 0.06, trim, [x, 1.6, HALL.z0 + 0.12]);
      stat.box(0.07, 7, 0.06, trim, [x - 1.33, 5.1, HALL.z0 + 0.12]);
      stat.box(0.07, 7, 0.06, trim, [x + 1.33, 5.1, HALL.z0 + 0.12]);
    }
  }
  // a stepped plinth in front of the exit door
  stat.box(10.5, 0.14, 1.0, iron, [0, 0.07, HALL.z0 + 0.55], [0, 0, 0], 0.03);
  stat.box(10.5, 0.03, 0.06, trim, [0, 0.145, HALL.z0 + 1.03]);

  // ---------------------------------------------------------------- south entrance
  const zs = HALL.z1 - 0.05;
  // portal frame
  for (const s of [-1, 1]) {
    stat.box(1.0, 7.4, 0.7, mats.stone, [s * 2.9, 3.7, zs - 0.35], [0, 0, 0], 0.05);
    stat.box(1.2, 0.4, 0.85, trim, [s * 2.9, 7.55, zs - 0.38]);
    stat.box(1.2, 0.5, 0.85, iron, [s * 2.9, 0.25, zs - 0.38]);
  }
  stat.box(6.8, 1.2, 0.75, mats.stone, [0, 8.2, zs - 0.38], [0, 0, 0], 0.05);
  stat.box(6.9, 0.12, 0.85, trim, [0, 7.58, zs - 0.4]);
  // sealed double doors with studded bands
  for (const s of [-1, 1]) {
    stat.box(2.3, 6.9, 0.18, panel, [s * 1.18, 3.45, zs - 0.12], [0, 0, 0], 0.03);
    for (const y of [1.2, 3.4, 5.6]) stat.box(2.2, 0.12, 0.06, trim, [s * 1.18, y, zs - 0.24]);
    const r = rng(s > 0 ? 3 : 4);
    for (let k = 0; k < 10; k++) stat.add(new THREE.SphereGeometry(0.035, 8, 6), trim, [s * (0.25 + k * 0.2), 1.2 + Math.floor(r() * 3) * 2.2, zs - 0.28]);
  }
  stat.box(0.06, 6.9, 0.08, iron, [0, 3.45, zs - 0.26]);
  // the bar that seals the doors
  stat.box(5.2, 0.22, 0.2, iron, [0, 3.0, zs - 0.38], [0, 0, 0], 0.04);
  for (const s of [-1, 1]) stat.box(0.3, 0.5, 0.35, trim, [s * 2.45, 3.0, zs - 0.35]);
  // benches either side
  for (const s of [-1, 1]) {
    stat.box(2.4, 0.08, 0.6, wood, [s * 6.2, 0.48, zs - 1.2], [0, 0, 0], 0.03);
    stat.box(2.4, 0.5, 0.06, wood, [s * 6.2, 0.82, zs - 0.92], [0.18, 0, 0], 0.02);
    for (const dx of [-1.05, 1.05]) stat.box(0.06, 0.46, 0.5, iron, [s * 6.2 + dx, 0.23, zs - 1.2], [0, 0, 0], 0.01);
  }

  // the entrance is lit from above: a cold shaft through a broken skylight in the present,
  // the portal floodlight and two sconces in the echo
  const wash = new THREE.SpotLight(0xffffff, 0, 22, 0.75, 0.8, 1.6);
  wash.position.set(0, 13.5, zs - 6.5);
  wash.target.position.set(0, 3.2, zs);
  root.add(wash, wash.target);
  temporal.blendLight(wash, { intensity: 180, color: 0x8fbfe0 }, { intensity: 260, color: 0xffc98a }, 0.2);
  const sconceMat = new THREE.MeshStandardMaterial({ color: 0x110800, emissive: 0xffb45e, emissiveIntensity: 2 });
  temporal.blendMaterial(sconceMat, { emissiveIntensity: 0 }, { emissiveIntensity: 2.4 });
  for (const s of [-1, 1]) {
    stat.box(0.12, 0.5, 0.18, trim, [s * 3.9, 5.2, zs - 0.12]);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.34, 16), sconceMat);
    glass.position.set(s * 3.9, 5.55, zs - 0.28);
    root.add(glass);
    const sl = new THREE.PointLight(0xffb45e, 0, 7, 1.8);
    sl.position.set(s * 3.9, 5.6, zs - 0.6);
    root.add(sl);
    temporal.blendLight(sl, { intensity: 0, color: 0xffb45e }, { intensity: 14, color: 0xffb45e }, 0.3);
  }

  // transom inscription, honour board and the wall clock (textured, so separate meshes)
  const inscription = textTexture(['معهد بارالاكس', 'محرّك الذاكرة · القاعة الأولى · 1951'], { w: 2048, h: 320, size: 104, color: '#d9b56b', font: AR_FONT, spacing: 1.3 });
  const insMat = new THREE.MeshStandardMaterial({ map: inscription, transparent: true, metalness: 0.6, roughness: 0.4, emissive: 0xffc070, emissiveMap: inscription, emissiveIntensity: 0.1 });
  temporal.blendMaterial(insMat, { color: 0x6c6656, emissiveIntensity: 0.0 }, { color: 0xffffff, emissiveIntensity: 0.35 });
  const ins = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.97), insMat);
  ins.position.set(0, 8.2, zs - 0.77);
  ins.rotation.y = Math.PI;
  root.add(ins);

  const boardTex = canvasTexture(768, 1024, (g, w, h) => {
    g.fillStyle = '#1a1510'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8924c'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
    g.fillStyle = '#d9b56b'; g.textAlign = 'center'; g.direction = 'rtl';
    g.font = `700 64px ${AR_FONT}`; g.fillText('المشغّلون', w / 2, 120);
    g.font = `36px ${AR_FONT}`; g.fillText('محرّك الذاكرة', w / 2, 180);
    g.font = `44px ${AR_FONT}`;
    ['1951   هـ. أبرنيثي', '1952   م. أويلاران', '1953   س. فانتربول', '1954   ل. كريستيانسن', '1955   ت. إيبارا', '1956   ر. كالدر', '1957   —'].forEach((t, i) => g.fillText(t, w / 2, 290 + i * 92));
  });
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, metalness: 0.3 });
  temporal.blendMaterial(boardMat, { color: 0x5c5850 }, { color: 0xffffff });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.8), boardMat);
    b.position.set(s * 6.2, 3.4, zs - 0.07); // in front of its frame
    b.rotation.y = Math.PI;
    root.add(b);
    stat.box(2.3, 3.0, 0.08, trim, [s * 6.2, 3.4, zs - 0.02], [0, 0, 0], 0.02);
  }
  ctx.interact('honourBoard', [root.children[root.children.length - 1]], 3.4, { pos: new THREE.Vector3(6.2, 2.2, zs - 2.6), look: new THREE.Vector3(6.2, 3.3, zs) });

  // wall clock above the portal: stopped at 11:58 in the present, running in the echo
  const clock = new THREE.Group();
  clock.position.set(0, 11.0, zs - 0.15);
  clock.rotation.y = Math.PI;
  root.add(clock);
  const faceTex = canvasTexture(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2116'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, c - 24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2a2116'; g.font = '600 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(n, c + Math.cos(a) * (c - 72), c + Math.sin(a) * (c - 72));
    });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.fillRect(c + Math.cos(a) * (c - 40) - 2, c + Math.sin(a) * (c - 40) - 2, 4, i % 5 ? 4 : 10);
    }
  });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 });
  temporal.blendMaterial(faceMat, { color: 0x6a6658 }, { color: 0xffffff });
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), faceMat);
  clock.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.09, 12, 64), trim);
  clock.add(bezel);
  const handMat = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.4, metalness: 0.7 });
  const hand = (len: number, w: number, z: number) => {
    const p = new THREE.Group();
    p.position.z = z;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.02), handMat);
    m.position.y = len / 2 - 0.08;
    p.add(m);
    clock.add(p);
    return p;
  };
  const hourH = hand(0.6, 0.07, 0.03), minH = hand(0.95, 0.045, 0.05), secH = hand(1.0, 0.018, 0.07);
  (secH.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x8b1d1d });
  let echoSeconds = 0;
  const setHands = (h: number, m: number, sec: number) => {
    secH.rotation.z = -(sec / 60) * Math.PI * 2;
    minH.rotation.z = -((m + sec / 60) / 60) * Math.PI * 2;
    hourH.rotation.z = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
  };
  ctx.animate((_dt, _t, s) => {
    if (s.timeline === 'present' && !s.completed) setHands(11, 58, 0);
    else setHands(9, 14 + Math.floor(echoSeconds / 60), echoSeconds % 60);
  });
  ctx.interact('wallClock', [face], 12, { pos: new THREE.Vector3(0, 6.5, 6.8), look: new THREE.Vector3(0, 10.8, zs) });

  // ---------------------------------------------------------------- dais curb and floor furniture
  const curb = new THREE.Mesh(new THREE.TorusGeometry(5.65, 0.11, 8, 128), trim);
  curb.rotation.x = Math.PI / 2;
  curb.position.set(POS.engine.x, 0.03, POS.engine.z);
  curb.scale.z = 0.4;
  root.add(curb);
  const grateTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#0b0d0e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4d4f';
    for (let x = 8; x < w; x += 22) g.fillRect(x, 8, 9, h - 16);
    g.strokeStyle = '#6b6e70'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
  const grateMat = new THREE.MeshStandardMaterial({ map: grateTex, metalness: 0.8, roughness: 0.5 });
  for (const [x, z] of [[-7, 12.4], [7, 12.4], [-9.5, -7.6], [9.5, -7.6], [-6, -16.6], [6, -22.6]]) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), grateMat);
    gm.rotation.x = -Math.PI / 2;
    gm.position.set(x, 0.008, z);
    root.add(gm);
  }
  // power cables across the floor from the console to the gate and the anchor
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.55, metalness: 0.3 });
  const floorCable = (pts: [number, number][]) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.035, z)));
    stat.add(new THREE.TubeGeometry(curve, 48, 0.035, 6), cableMat, [0, 0, 0]);
  };
  floorCable([[1.3, -6.3], [1.9, -7.2], [1.75, -8.4], [1.7, -9.0]]);
  floorCable([[1.4, -5.8], [2.2, -6.9], [2.5, -7.8]]);
  floorCable([[-1.4, -6.2], [-3.4, -6.7], [-6.5, -6.4], [-11.4, -6.9]]);
  floorCable([[POS.voiceConsole.x + 0.6, POS.voiceConsole.z - 0.3], [-1.5, -19.5], [1.5, -20.2], [POS.parallaxConsole.x - 0.4, POS.parallaxConsole.z - 0.6]]);

  // ---------------------------------------------------------------- pendant lamps
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: PALETTE.amber, emissiveIntensity: 2 });
  temporal.blendMaterial(bulbMat, { emissiveIntensity: 0, emissive: 0x334044, color: 0x1a1d1e }, { emissiveIntensity: 2.6, emissive: PALETTE.amber, color: 0x111111 });
  const shadeMat = trim;
  const pendants: [number, number][] = [[-5, 10.5], [5, 10.5], [-5, 2.5], [5, 2.5], [-5, -19], [5, -19]];
  for (const [x, z] of pendants) {
    stat.add(new THREE.CylinderGeometry(0.015, 0.015, 5.2, 4), iron, [x, 16 - 2.6, z]);
    stat.add(new THREE.CylinderGeometry(0.12, 0.62, 0.42, 24, 1, true), shadeMat, [x, 10.6, z]);
    stat.add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), iron, [x, 10.86, z]);
    stat.add(new THREE.SphereGeometry(0.13, 14, 10), bulbMat, [x, 10.4, z]);
  }

  // ---------------------------------------------------------------- cornice inscriptions
  const motto = textTexture(['الذاكرة   ·   الزمن   ·   بارالاكس   ·   ما كان يبقى'], { w: 4096, h: 160, size: 104, color: '#d9b56b', font: AR_FONT });
  const mottoMat = new THREE.MeshStandardMaterial({ map: motto, transparent: true, metalness: 0.6, roughness: 0.35, emissive: 0xffc070, emissiveMap: motto, emissiveIntensity: 0.1 });
  temporal.blendMaterial(mottoMat, { color: 0x5d5a4c, emissiveIntensity: 0.0 }, { color: 0xffffff, emissiveIntensity: 0.4 });
  for (const side of [-1, 1]) {
    for (const zc of [6, -18]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 0.5), mottoMat);
      m.position.set(side * (W - 0.62), 12.6, zc);
      m.rotation.y = -side * Math.PI / 2;
      root.add(m);
    }
  }

  // ---------------------------------------------------------------- present-only debris, echo-only order
  const debris = new Batch();
  const rubble = mats.stone.clone();
  rubble.color.set(0x6f7377);
  const r = rng(77);
  const debrisSpots: [number, number, number][] = [[-10.4, 11.5, 1.2], [9.8, 6.8, 1.4], [-10.2, -1.5, 1.0], [10.3, -11.6 + 3, 0.9], [-10.6, -21.5, 1.3], [7.5, -23, 1.0], [-3.4, 12.8, 0.7]];
  for (const [x, z, spread] of debrisSpots) {
    for (let k = 0; k < 9; k++) {
      const s = 0.08 + r() * 0.28;
      debris.box(s * (1 + r()), s * 0.6, s * (1 + r()), rubble, [x + (r() - 0.5) * spread * 2, s * 0.25, z + (r() - 0.5) * spread * 2], [r() * 0.5, r() * 3, r() * 0.5], 0.01);
    }
  }
  // fallen ceiling panels and scattered paper
  const paper = new THREE.MeshStandardMaterial({ color: 0x8a8370, roughness: 0.95, side: THREE.DoubleSide });
  for (let k = 0; k < 22; k++) debris.add(new THREE.PlaneGeometry(0.21, 0.29), paper, [-8 + r() * 4, 0.012 + k * 0.0005, 6 + r() * 5], [-Math.PI / 2, 0, r() * 6]);
  for (let k = 0; k < 12; k++) debris.add(new THREE.PlaneGeometry(0.21, 0.29), paper, [-5 + r() * 3, 0.012 + k * 0.0005, -20 + r() * 3], [-Math.PI / 2, 0, r() * 6]);
  debris.box(2.2, 0.06, 1.2, panel, [9.6, 0.32, 8.0], [0.1, 0.4, 0.25], 0.02);
  debris.box(2.0, 0.06, 1.1, panel, [-9.8, 0.25, -20.6], [-0.15, -0.6, 0.2], 0.02);
  const debrisGroup = new THREE.Group();
  root.add(debrisGroup);
  debris.build(debrisGroup, !lowQ, false);
  temporal.register({ id: 'debris', object: debrisGroup, resolve: (_s, t) => ({ visible: t === 'present' }) });

  // the archivist's chair: upright in the echo, toppled in the present
  const chair = new THREE.Group();
  root.add(chair);
  ctx.box(0.5, 0.06, 0.5, wood, chair, 0, 0.48, 0, 0.02);
  ctx.box(0.5, 0.55, 0.05, wood, chair, 0, 0.8, -0.23, 0.02);
  for (const [cx, cz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) ctx.box(0.04, 0.46, 0.04, iron, chair, cx, 0.23, cz, 0.01);
  temporal.register({
    id: 'archive-chair',
    object: chair,
    speed: 1.8,
    resolve: (_s, t) => (t === 'echo' ? { position: [POS.notes.archive.x + 0.2, 0, POS.notes.archive.z + 0.75], rotation: [0, 0.2, 0] } : { position: [POS.notes.archive.x + 0.9, 0.26, POS.notes.archive.z + 1.3], rotation: [Math.PI / 2 - 0.05, 0.9, 0] }),
  });

  stat.build(root, !lowQ, false);

  // ---------------------------------------------------------------- steam from the turbine (echo) and falling dust (present)
  const puffTex = canvasTexture(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
  const stack = new THREE.Vector3(POS.machines.turbine.x, 2.7, POS.machines.turbine.z);
  const puffs: { sprite: THREE.Sprite; life: number; vx: number }[] = [];
  const puff = () => {
    for (let k = 0; k < 6; k++) {
      const mat = new THREE.SpriteMaterial({ map: puffTex, color: 0xffe2b8, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(stack).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, k * 0.05, (Math.random() - 0.5) * 0.3));
      sp.scale.setScalar(0.4);
      scene.add(sp);
      puffs.push({ sprite: sp, life: -k * 0.08, vx: (Math.random() - 0.5) * 0.3 });
    }
  };
  const dustCount = 160;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(dustCount * 3);
  const streams = [[-7.5, 5.5], [8.2, -1.0], [-4.2, -20.5]];
  for (let i = 0; i < dustCount; i++) {
    const s = streams[i % streams.length];
    dPos.set([s[0] + (Math.random() - 0.5) * 0.25, Math.random() * 15.5, s[1] + (Math.random() - 0.5) * 0.25], i * 3);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.035, map: puffTex, color: 0xcfd8d6, transparent: true, depthWrite: false, opacity: 0.8, blending: THREE.AdditiveBlending });
  const falling = new THREE.Points(dustGeo, dustMat);
  falling.frustumCulled = false;
  scene.add(falling);

  ctx.animate((dt, _t, _s, e) => {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life < 0) continue;
      const u = p.life / 3.2;
      p.sprite.position.y += dt * (0.9 - u * 0.5);
      p.sprite.position.x += p.vx * dt;
      p.sprite.scale.setScalar(0.4 + u * 2.2);
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(Math.min(1, u) * Math.PI) * 0.45;
      if (u >= 1) {
        scene.remove(p.sprite);
        (p.sprite.material as THREE.Material).dispose();
        puffs.splice(i, 1);
      }
    }
    falling.visible = e < 0.6;
    if (!falling.visible) return;
    dustMat.opacity = 0.8 * (1 - e);
    const a = dustGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < dustCount; i++) {
      a[i * 3 + 1] -= dt * (0.6 + (i % 7) * 0.12);
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 15.5;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  return {
    clockPos: new THREE.Vector3(0, 11, zs),
    stepSecond: () => { echoSeconds = (echoSeconds + 1) % 3600; },
    puff,
    turbineStack: stack,
  };
}
