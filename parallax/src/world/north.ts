// The north platform: four sound machines for puzzle D, the recording console, the steering
// console for the final puzzle and its plaque. Each machine has a lamp that pulses with its sound,
// so every signature can be read by eye as well as by ear.

import * as THREE from 'three';
import { BuildCtx, PALETTE, gearGeometry } from './context';
import { POS } from '../game/layout';
import type { Keepsake, SourceId } from '../game/types';
import { keepsakeModel } from './archive';
import { canvasTexture } from './textures';

export type Pulses = Record<SourceId, number>;

export interface NorthRig {
  pulses: Pulses;
  /** Machine world positions for positional audio. */
  machinePos: Record<Exclude<SourceId, 'keepsake'>, THREE.Vector3>;
  reels: THREE.Mesh[];
  playing: { value: boolean };
  voiceHolo: THREE.CanvasTexture;
  coreModels: Record<Keepsake, THREE.Group>;
}

export function buildNorth(ctx: BuildCtx): NorthRig {
  const { mats, temporal, scene } = ctx;
  const pulses: Pulses = { turbine: 0, bell: 0, drip: 0, relay: 0, keepsake: 0 };
  const rusty = mats.metal.clone();
  temporal.blendMaterial(rusty, { color: 0x5b4a3a, roughness: 0.92, metalness: 0.45 }, { color: 0xa39f96, roughness: 0.32, metalness: 0.9 });
  // generous invisible volumes so machines are easy to target with the crosshair
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitBox = (parent: THREE.Object3D, w: number, h: number, d: number, x = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.set(x, h / 2, z);
    parent.add(m);
    return m;
  };
  const lampFor = (src: SourceId, color: number) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x080808, emissive: color, emissiveIntensity: 0 });
    ctx.animate(() => { m.emissiveIntensity = 0.08 + pulses[src] * 4.5; });
    return m;
  };

  // ---------------------------------------------------------------- turbine (echo)
  const tp = POS.machines.turbine;
  const turbine = new THREE.Group();
  turbine.position.set(tp.x, 0, tp.z);
  scene.add(turbine);
  ctx.mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.3, 40), mats.darkMetal, turbine, 0, 0.15, 0);
  const drum = ctx.mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.8, 48, 1, true), rusty, turbine, 0, 1.25, 0);
  (drum.material as THREE.Material).side = THREE.DoubleSide;
  ctx.mesh(new THREE.TorusGeometry(1.06, 0.07, 10, 48), mats.gold, turbine, 0, 2.15, 0).rotation.x = Math.PI / 2;
  ctx.mesh(new THREE.TorusGeometry(1.06, 0.07, 10, 48), mats.gold, turbine, 0, 0.35, 0).rotation.x = Math.PI / 2;
  const fan = new THREE.Mesh(gearGeometry(9, 0.95, 0.06, 0.18), rusty);
  fan.position.set(0, 1.3, 0);
  fan.rotation.x = Math.PI / 2;
  turbine.add(fan);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1.4, 0.22), mats.darkMetal, 18);
  const fm = new THREE.Matrix4();
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    fm.compose(new THREE.Vector3(Math.cos(a) * 1.12, 1.25, Math.sin(a) * 1.12), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(1, 1, 1));
    fins.setMatrixAt(k, fm);
  }
  turbine.add(fins);
  ctx.mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.18, 40), mats.darkMetal, turbine, 0, 2.24, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 20), rusty, turbine, 0.45, 2.6, 0.3);
  ctx.mesh(new THREE.TorusGeometry(0.23, 0.04, 8, 20), mats.gold, turbine, 0.45, 2.9, 0.3).rotation.x = Math.PI / 2;
  const feed = ctx.mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 14), rusty, turbine, -2.3, 1.0, -0.2, false);
  feed.rotation.z = Math.PI / 2;
  const turbineLamp = lampFor('turbine', PALETTE.amber);
  ctx.mesh(new THREE.SphereGeometry(0.14, 16, 12), turbineLamp, turbine, 0, 2.45, 0, false);
  ctx.animate((dt, _t, _s, e) => { fan.rotation.z += dt * (e * 9 + pulses.turbine * 14); });
  hitBox(turbine, 2.3, 2.6, 2.3);
  ctx.interact('machine-turbine', [turbine], 3.6);

  // ---------------------------------------------------------------- signal bell (echo)
  const bp = POS.machines.bell;
  const bell = new THREE.Group();
  bell.position.set(bp.x, 0, bp.z);
  scene.add(bell);
  for (const s of [-1, 1]) ctx.box(0.16, 3.0, 0.16, mats.darkMetal, bell, s * 0.8, 1.5, 0, 0.03);
  ctx.box(1.9, 0.18, 0.22, mats.gold, bell, 0, 3.0, 0, 0.03);
  const bellMat = mats.gold.clone();
  temporal.blendMaterial(bellMat, { color: 0x2f5d50, roughness: 0.85, metalness: 0.5 }, { color: 0xc8a052, roughness: 0.25, metalness: 0.95 });
  const pts = [0.05, 0.18, 0.26, 0.3, 0.34, 0.42, 0.55, 0.6].map((r, i) => new THREE.Vector2(r, 0.9 - i * 0.12));
  const bellBody = ctx.mesh(new THREE.LatheGeometry(pts, 40), bellMat, bell, 0, 1.85, 0);
  (bellBody.material as THREE.Material).side = THREE.DoubleSide;
  const hammer = new THREE.Group();
  hammer.position.set(0.75, 2.9, 0);
  bell.add(hammer);
  ctx.mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), mats.metal, hammer, 0, -0.5, 0);
  ctx.mesh(new THREE.SphereGeometry(0.09, 12, 10), mats.darkMetal, hammer, 0, -1.0, 0);
  const bellLamp = lampFor('bell', PALETTE.amber);
  ctx.mesh(new THREE.SphereGeometry(0.12, 16, 12), bellLamp, bell, 0, 3.25, 0, false);
  ctx.animate(() => { hammer.rotation.z = -0.15 - pulses.bell * 0.45; });
  hitBox(bell, 1.9, 3.3, 1.0);
  ctx.interact('machine-bell', [bell], 3.4);

  // ---------------------------------------------------------------- cracked pipe (present)
  const dp = POS.machines.drip;
  const drip = new THREE.Group();
  drip.position.set(dp.x, 0, dp.z);
  scene.add(drip);
  // three pipes run floor to ceiling against the north wall, braced to it, joined by a manifold
  const PZ = -2.05;
  for (const [x, r] of [[-0.6, 0.16], [0, 0.22], [0.55, 0.14]] as const) {
    ctx.mesh(new THREE.CylinderGeometry(r, r, 16, 16), rusty, drip, x, 8, PZ, false);
    for (let y = 1.2; y < 15; y += 3.2) {
      ctx.mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.08, 16), mats.gold, drip, x, y, PZ, false);
      ctx.box(0.06, 0.08, 0.32, mats.darkMetal, drip, x, y + 0.12, PZ - 0.2, 0.01);
    }
  }
  const manifold = ctx.mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.2, 14), rusty, drip, 0.5, 3.4, PZ + 0.02, false);
  manifold.rotation.z = Math.PI / 2;
  ctx.mesh(new THREE.SphereGeometry(0.17, 14, 10), mats.gold, drip, 1.6, 3.4, PZ + 0.02, false);
  // valve wheel on the main pipe
  const valve = new THREE.Group();
  valve.position.set(0, 1.35, PZ + 0.32);
  drip.add(valve);
  ctx.mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 28), mats.gold, valve, 0, 0, 0, false);
  for (let k = 0; k < 3; k++) ctx.box(0.4, 0.025, 0.025, mats.gold, valve, 0, 0, 0, 0.005).rotation.z = (k * Math.PI) / 3;
  ctx.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), mats.metal, valve, 0, 0, -0.1, false).rotation.x = Math.PI / 2;
  const crack = ctx.box(0.05, 0.3, 0.05, new THREE.MeshStandardMaterial({ color: 0x050505 }), drip, 0, 2.4, PZ + 0.22, 0.01);
  temporal.register({ id: 'pipe-crack', object: crack, resolve: (_s, t) => ({ visible: t === 'present' }) });
  const water = new THREE.MeshStandardMaterial({ color: 0x5fa8b0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8 });
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const d = ctx.mesh(new THREE.SphereGeometry(0.035, 8, 6), water, drip, 0, 2.3, PZ + 0.26, false);
    d.scale.y = 1.6;
    drops.push(d);
  }
  const puddle = ctx.mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshStandardMaterial({ color: 0x0a1416, roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0.85 }), drip, 0, 0.012, -1.35, false);
  puddle.rotation.x = -Math.PI / 2;
  temporal.register({ id: 'puddle', object: puddle, resolve: (_s, t) => ({ visible: t === 'present' }) });
  const dripLamp = lampFor('drip', PALETTE.cyan);
  ctx.mesh(new THREE.SphereGeometry(0.1, 16, 12), dripLamp, drip, 0.42, 2.8, PZ + 0.2, false);
  ctx.box(0.06, 0.06, 0.3, mats.darkMetal, drip, 0.42, 2.72, PZ + 0.08, 0.01);
  const dripState = drops.map((_, i) => ({ y: 2.3, v: 0, delay: i * 0.4, active: false }));
  ctx.animate((dt, _t, s) => {
    const present = s.timeline === 'present';
    dripState.forEach((d, i) => {
      if (!present) { drops[i].visible = false; return; }
      if (!d.active && pulses.drip > 0.85) { d.active = true; d.y = 2.3; d.v = 0; }
      drops[i].position.z = PZ + 0.26 + (2.3 - d.y) * 0.12;
      if (d.active) {
        d.v += 9.8 * dt;
        d.y -= d.v * dt;
        if (d.y < 0.02) d.active = false;
      }
      drops[i].visible = d.active;
      drops[i].position.y = d.y + i * 0.02;
    });
  });
  hitBox(drip, 1.8, 3.2, 2.2, 0, -1.1);
  ctx.interact('machine-drip', [drip], 3.2);

  // ---------------------------------------------------------------- arcing relay (present)
  const rp = POS.machines.relay;
  const relay = new THREE.Group();
  relay.position.set(rp.x, 0, rp.z);
  scene.add(relay);
  ctx.box(1.3, 2.2, 0.7, rusty, relay, 0, 1.1, -0.3, 0.04);
  ctx.box(1.4, 0.12, 0.8, mats.darkMetal, relay, 0, 2.26, -0.3, 0.03);
  ctx.box(1.4, 0.16, 0.8, mats.darkMetal, relay, 0, 0.08, -0.3, 0.03);
  // glazed contact window with three hinged arms
  ctx.box(1.1, 0.9, 0.05, mats.obsidian, relay, 0, 1.55, 0.06, 0.01);
  for (let i = 0; i < 3; i++) {
    ctx.box(0.08, 0.3, 0.08, mats.gold, relay, -0.35 + i * 0.35, 1.55, 0.12, 0.01);
    const arm = ctx.box(0.04, 0.28, 0.04, mats.metal, relay, -0.35 + i * 0.35 + 0.08, 1.72, 0.14, 0.005);
    arm.rotation.z = -0.5;
  }
  const glass = ctx.mesh(new THREE.PlaneGeometry(1.0, 0.8), mats.glass, relay, 0, 1.55, 0.2, false);
  glass.renderOrder = 3;
  for (const [w, h, x, y] of [[1.15, 0.06, 0, 2.0], [1.15, 0.06, 0, 1.1], [0.06, 0.95, -0.56, 1.55], [0.06, 0.95, 0.56, 1.55]] as const) ctx.box(w, h, 0.06, mats.gold, relay, x, y, 0.2, 0.01);
  // cooling fins down both flanks
  for (const sx of [-1, 1]) for (let k = 0; k < 8; k++) ctx.box(0.12, 0.05, 0.6, mats.darkMetal, relay, sx * 0.72, 0.5 + k * 0.2, -0.3, 0.005);
  // warning plate
  const warnTex = canvasTexture(256, 96, (g, w, h) => {
    for (let x = -h; x < w + h; x += 32) { g.fillStyle = '#d8a81e'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - h, h); g.lineTo(x - h, h); g.fill(); g.fillStyle = '#141414'; g.beginPath(); g.moveTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - h, h); g.lineTo(x + 16 - h, h); g.fill(); }
    g.fillStyle = '#141414'; g.fillRect(24, 24, w - 48, h - 48);
    g.fillStyle = '#e8e2d0'; g.font = '700 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2000 V', w / 2, h / 2 + 1);
  });
  ctx.mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6 }), relay, 0, 0.75, 0.06, false);
  // conduit from the cabinet up into the ceiling
  ctx.mesh(new THREE.CylinderGeometry(0.09, 0.09, 13.7, 12), mats.darkMetal, relay, 0.4, 9.15, -0.5, false);
  ctx.mesh(new THREE.CylinderGeometry(0.06, 0.06, 13.7, 10), mats.darkMetal, relay, 0.15, 9.15, -0.55, false);
  const sparkMat = new THREE.PointsMaterial({ color: 0xbfefff, size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparkGeo = new THREE.BufferGeometry();
  const sparkCount = 40;
  const sparkPos = new Float32Array(sparkCount * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.position.set(0, 1.55, 0.15);
  relay.add(sparks);
  const relayLamp = lampFor('relay', PALETTE.cyan);
  ctx.mesh(new THREE.SphereGeometry(0.1, 16, 12), relayLamp, relay, 0.45, 2.35, 0.05, false);
  ctx.animate((_dt, _t, s) => {
    const p = s.timeline === 'present' ? pulses.relay : 0;
    sparks.visible = p > 0.05;
    if (!sparks.visible) return;
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 0.7 * p;
      sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 0.4 * p;
      sparkPos[i * 3 + 2] = Math.random() * 0.25 * p;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkMat.opacity = p;
  });
  hitBox(relay, 1.6, 2.4, 1.2, 0, -0.2);
  ctx.interact('machine-relay', [relay], 3.2);

  // ---------------------------------------------------------------- recording console
  const vc = new THREE.Group();
  vc.position.set(POS.voiceConsole.x, 0, POS.voiceConsole.z);
  vc.rotation.y = 0.35;
  scene.add(vc);
  ctx.box(1.7, 0.95, 0.9, mats.darkMetal, vc, 0, 0.475, 0, 0.05);
  ctx.box(1.8, 0.06, 1.0, mats.gold, vc, 0, 0.98, 0, 0.02);
  ctx.box(1.2, 0.5, 0.12, mats.obsidian, vc, 0, 1.3, -0.3, 0.03);
  const reels: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const reel = ctx.mesh(gearGeometry(36, 0.2, 0.03, 0.18), mats.metal, vc, s * 0.3, 1.38, -0.22);
    reels.push(reel);
    ctx.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.6 }), vc, s * 0.3, 1.38, -0.21, false);
  }
  ctx.box(0.62, 0.012, 0.012, new THREE.MeshStandardMaterial({ color: 0x2a1d14 }), vc, 0, 1.27, -0.2, 0);
  for (const s of [-1, 1]) {
    ctx.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 10).rotateX(Math.PI / 2), mats.gold, vc, s * 0.1, 1.24, -0.2, false);
  }
  const vuMat = new THREE.MeshStandardMaterial({ color: 0x110a04, emissive: PALETTE.amber, emissiveIntensity: 0.25, map: canvasTexture(128, 64, (g, w, h) => { g.fillStyle = '#f2e3c2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a14'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h + 20, 70, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); g.fillStyle = '#9b1d1d'; g.fillRect(w * 0.72, 12, 16, 6); }) });
  const needles: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    ctx.mesh(new THREE.PlaneGeometry(0.22, 0.11), vuMat, vc, s * 0.36, 1.05, 0.08, false).rotation.x = -0.45;
    const n = ctx.box(0.006, 0.08, 0.004, new THREE.MeshStandardMaterial({ color: 0x111111 }), vc, s * 0.36, 1.03, 0.1, 0);
    n.rotation.x = -0.45;
    needles.push(n);
  }
  const playing = { value: false };
  ctx.animate((_dt, t) => { needles.forEach((n, i) => (n.rotation.z = playing.value ? Math.sin(t * (9 + i * 3)) * 0.5 - 0.1 : -0.7)); });
  ctx.animate((dt) => { if (playing.value) reels.forEach((r, i) => (r.rotation.y += dt * (3 + i))); });
  const voiceHolo = canvasTexture(1024, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(143,240,255,.6)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#8ff0ff'; g.font = '44px "Iowan Old Style", Georgia, serif'; g.fillText('CALDER — 1956 — FOR WHOEVER COMES NEXT', 40, 80);
  });
  const vh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: voiceHolo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  vh.position.set(0, 2.0, -0.2);
  vc.add(vh);
  ctx.interact('voice-console', [vc], 3, { pos: new THREE.Vector3(POS.voiceConsole.x + 0.55, 1.95, POS.voiceConsole.z + 1.6), look: new THREE.Vector3(POS.voiceConsole.x, 1.4, POS.voiceConsole.z) });

  // ---------------------------------------------------------------- steering console
  const pc = new THREE.Group();
  pc.position.set(POS.parallaxConsole.x, 0, POS.parallaxConsole.z);
  scene.add(pc);
  ctx.mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.0, 8), mats.darkMetal, pc, 0, 0.5, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 8), mats.gold, pc, 0, 1.04, 0);
  const wheel = new THREE.Group();
  wheel.position.set(0, 1.55, 0.35);
  pc.add(wheel);
  ctx.mesh(new THREE.TorusGeometry(0.45, 0.04, 10, 48), mats.gold, wheel, 0, 0, 0);
  for (let i = 0; i < 4; i++) ctx.box(0.9, 0.04, 0.04, mats.gold, wheel, 0, 0, 0, 0.01).rotation.z = (i * Math.PI) / 4;
  ctx.animate((dt, _t, s) => {
    const target = -s.parallax.bearing * (Math.PI / 4);
    wheel.rotation.z += (target - wheel.rotation.z) * Math.min(1, dt * 4);
  });
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: PALETTE.emeraldGlow, emissiveIntensity: 0.2 });
  ctx.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 32), socketMat, pc, 0, 1.12, -0.3, false);
  ctx.animate((_dt, t, s) => { socketMat.emissiveIntensity = s.voice.solved ? (s.parallax.coreInserted ? 2.2 : 0.8 + Math.sin(t * 3) * 0.4) : 0.05; });
  const coreModels = { compass: keepsakeModel(ctx, 'compass'), hourglass: keepsakeModel(ctx, 'hourglass') };
  for (const k of ['compass', 'hourglass'] as Keepsake[]) {
    const m = coreModels[k];
    m.position.set(0, 1.17, -0.3);
    m.visible = false;
    pc.add(m);
    ctx.animate((_dt, _t, s) => { m.visible = s.parallax.coreInserted && s.keepsake === k; });
  }
  ctx.interact('parallax-console', [pc], 3, { pos: new THREE.Vector3(POS.parallaxConsole.x - 0.2, 2.1, POS.parallaxConsole.z - 1.5), look: new THREE.Vector3(POS.parallaxConsole.x, 1.4, POS.parallaxConsole.z) });

  // steering plate
  const plaque = new THREE.Group();
  plaque.position.set(POS.finalPlaque.x, 0, POS.finalPlaque.z);
  plaque.rotation.y = -0.6;
  scene.add(plaque);
  ctx.mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 10), mats.darkMetal, plaque, 0, 0.55, 0);
  const plate = ctx.box(0.75, 0.48, 0.04, mats.gold.clone(), plaque, 0, 1.2, 0.02, 0.01);
  plate.rotation.x = -0.4;
  temporal.blendMaterial(plate.material as THREE.MeshStandardMaterial, { color: 0x3c5c4e, roughness: 0.9, metalness: 0.4 }, { color: 0xc49a4f, roughness: 0.3, metalness: 0.95 });
  ctx.interact('finalPlaque', [plaque], 2.6, { pos: new THREE.Vector3(POS.finalPlaque.x - 0.7, 1.75, POS.finalPlaque.z + 0.6), look: new THREE.Vector3(POS.finalPlaque.x, 1.2, POS.finalPlaque.z) });

  // north lights for the machines
  const amberFill = new THREE.PointLight(PALETTE.amber, 0, 14, 1.8);
  amberFill.position.set(0, 3.5, -20.5);
  scene.add(amberFill);
  temporal.blendLight(amberFill, { intensity: 6, color: PALETTE.cyan }, { intensity: 45, color: PALETTE.amber }, 0.6);
  ctx.section('north').lights.push(amberFill);

  return {
    pulses,
    machinePos: {
      turbine: new THREE.Vector3(tp.x, 1.3, tp.z),
      bell: new THREE.Vector3(bp.x, 2.2, bp.z),
      drip: new THREE.Vector3(dp.x, 2.3, dp.z),
      relay: new THREE.Vector3(rp.x, 1.5, rp.z),
    },
    reels,
    playing,
    voiceHolo,
    coreModels,
  };
}
