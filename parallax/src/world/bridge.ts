// Puzzle C in the world: the bridge gate, the three-part span, the phase anchor and the quarantine
// field. Segment poses come straight from the puzzle state, so anchoring animates the fallen span
// back up into the present.

import * as THREE from 'three';
import { BuildCtx, PALETTE } from './context';
import { BRIDGE, POS } from '../game/layout';
import { bridgeExists } from '../game/puzzles/bridge';
import { drawGlyph } from './glyphs';
import { canvasTexture } from './textures';

export const barrierMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.cyan) }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main(){
        vec2 p = vUv*vec2(10.0, 11.0);
        vec2 h = abs(fract(p + vec2(0.5*floor(p.y), 0.0)) - 0.5);
        float cell = smoothstep(0.42, 0.5, max(h.x, h.y));
        float scan = 0.5 + 0.5*sin(vUv.y*80.0 - uTime*6.0);
        float edge = smoothstep(0.0, 0.08, vUv.x)*smoothstep(1.0, 0.92, vUv.x)*smoothstep(1.0, 0.85, vUv.y);
        float v = (0.08 + cell*0.42 + scan*0.06) * edge;
        gl_FragColor = vec4(uColor * v * 0.8 * uAlpha, 1.0);
      }`,
  });

export function buildBridge(ctx: BuildCtx) {
  const { mats, temporal, scene } = ctx;

  // ---------------------------------------------------------------- gate with retracting bolts
  const gate = new THREE.Group();
  gate.position.set(0, 0, -9.1);
  scene.add(gate);
  for (const s of [-1, 1]) {
    ctx.box(0.4, 3.4, 0.5, mats.darkMetal, gate, s * 1.85, 1.7, 0, 0.05);
    ctx.box(0.5, 0.2, 0.6, mats.gold, gate, s * 1.85, 3.45, 0, 0.03);
  }
  ctx.box(4.1, 0.3, 0.5, mats.darkMetal, gate, 0, 3.55, 0, 0.05);
  const leaves: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    gate.add(leaf);
    for (let i = 0; i < 4; i++) ctx.box(0.08, 3.1, 0.08, mats.metal, leaf, s * (0.2 + i * 0.38), 1.6, 0, 0.02);
    ctx.box(1.6, 0.1, 0.1, mats.gold, leaf, s * 0.78, 0.5, 0, 0.02);
    ctx.box(1.6, 0.1, 0.1, mats.gold, leaf, s * 0.78, 2.7, 0, 0.02);
    leaves.push(leaf);
    temporal.register({ id: `gate-leaf-${s}`, object: leaf, speed: 0.9, resolve: (st) => ({ position: [st.engine.solved ? s * 1.75 : 0, 0, 0] }) });
  }
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const bolt = ctx.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12), mats.gold, gate, 0, 0, 0);
    bolt.rotation.z = Math.PI / 2;
    const y = 0.8 + (i % 3) * 0.95;
    temporal.register({ id: `gate-bolt-${i}`, object: bolt, speed: 2.2 - (i % 3) * 0.4, resolve: (st) => ({ position: [st.engine.solved ? s * 2.3 : s * 1.3, y, 0.12] }) });
  }
  ctx.interact('gate', [gate], 3.2);

  // ---------------------------------------------------------------- three-part span
  const length = (BRIDGE.z1 - BRIDGE.z0) / 3;
  const deckMat = mats.metal.clone();
  temporal.blendMaterial(deckMat, { color: 0x4c5049, roughness: 0.8 }, { color: 0x9a968d, roughness: 0.35 });
  const phaseMat = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.gold, emissiveIntensity: 0 });
  const segments: THREE.Group[] = [];
  const fallen: [number, number, number, number, number, number][] = [
    [0.15, -2.2, -9.75, 1.15, 0.12, 0.05],
    [-0.6, -14, -12.1, 0.5, 0.4, -0.35],
    [0.2, -1.9, -14.3, -1.05, -0.08, 0.04],
  ];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    scene.add(seg);
    ctx.box(BRIDGE.x1 - BRIDGE.x0 + 0.2, 0.22, length - 0.05, deckMat, seg, 0, -0.11, 0, 0.03);
    ctx.box(0.25, 0.5, length - 0.1, mats.darkMetal, seg, -1.15, -0.4, 0, 0.03);
    ctx.box(0.25, 0.5, length - 0.1, mats.darkMetal, seg, 1.15, -0.4, 0, 0.03);
    for (const s of [-1, 1]) {
      ctx.box(0.05, 0.05, length - 0.1, mats.gold, seg, s * 1.3, 1.0, 0, 0.01);
      for (const z of [-length / 2 + 0.15, length / 2 - 0.15]) ctx.box(0.06, 1.0, 0.06, mats.gold, seg, s * 1.3, 0.5, z, 0.01);
      ctx.box(0.04, 0.03, length - 0.1, phaseMat, seg, s * 1.12, 0.02, 0, 0.005);
    }
    const zc = BRIDGE.z1 - length * (i + 0.5);
    const f = fallen[i];
    temporal.register({
      id: `span-${i}`,
      object: seg,
      speed: 1.1 + i * 0.25,
      resolve: (s, t) =>
        bridgeExists(t, s.bridge.anchored)
          ? { position: [0, 0, zc], rotation: [0, 0, 0] }
          : { position: [f[0], f[1], f[2]], rotation: [f[3], f[4], f[5]] },
    });
    segments.push(seg);
  }
  ctx.animate((_dt, t, s) => { phaseMat.emissiveIntensity = s.bridge.anchored ? 1.6 + Math.sin(t * 3) * 0.4 : 0; });

  // ---------------------------------------------------------------- the phase anchor
  const anchor = new THREE.Group();
  anchor.position.set(POS.anchor.x, 0, POS.anchor.z);
  scene.add(anchor);
  ctx.mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 24), mats.darkMetal, anchor, 0, 0.15, 0);
  ctx.mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 16), mats.metal, anchor, 0, 0.9, 0);
  const clampRing = ctx.mesh(new THREE.TorusGeometry(0.32, 0.06, 12, 40), mats.gold, anchor, 0, 1.5, 0);
  const anchorCore = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.cyan, emissiveIntensity: 0.6 });
  ctx.mesh(new THREE.SphereGeometry(0.16, 24, 16), anchorCore, anchor, 0, 1.5, 0, false);
  ctx.animate((dt, t, s, e) => {
    clampRing.rotation.x = s.bridge.anchored ? Math.PI / 2 : Math.PI / 2 + Math.sin(t * 0.8) * 0.25;
    clampRing.rotation.z += dt * (s.bridge.anchored ? 0.6 : 0.1);
    anchorCore.emissive.setHex(s.bridge.anchored ? PALETTE.gold : PALETTE.cyan);
    anchorCore.emissiveIntensity = s.engine.solved ? (s.bridge.anchored ? 2.4 : 1 + Math.sin(t * 4) * 0.5) : 0.15 + e * 0.2;
  });
  ctx.interact('anchor', [anchor], 2.6, { pos: new THREE.Vector3(POS.anchor.x - 0.4, 1.8, POS.anchor.z + 1.4), look: new THREE.Vector3(POS.anchor.x, 1.3, POS.anchor.z) });

  // ---------------------------------------------------------------- quarantine field (echo only)
  const barrierMat = barrierMaterial();
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), barrierMat);
  barrier.position.set(0, 1.7, -15.05);
  scene.add(barrier);
  temporal.register({ id: 'barrier', fade: true, object: barrier, resolve: (_s, t) => ({ visible: t === 'echo' }) });
  ctx.animate((_dt, t) => { barrierMat.uniforms.uTime.value = t; });
  const emitterMat = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.cyan, emissiveIntensity: 2 });
  temporal.blendMaterial(emitterMat, { emissiveIntensity: 0, emissive: 0x111111 }, { emissiveIntensity: 1.1, emissive: PALETTE.cyan });
  for (const s of [-1, 1]) {
    ctx.box(0.3, 3.6, 0.3, mats.darkMetal, scene, s * 1.75, 1.8, -15.1, 0.04);
    ctx.box(0.08, 3.2, 0.1, emitterMat, scene, s * 1.6, 1.8, -15.1, 0.01);
  }
  ctx.interact('barrier', [barrier], 6);

  // ---------------------------------------------------------------- keystone arch with the span symbol
  const arch = ctx.mesh(new THREE.TorusGeometry(2.1, 0.16, 12, 48, Math.PI), mats.gold, scene, 0, 3.6, -15.35, false);
  arch.castShadow = false;
  const keyTex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#1a1712'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#b08d4a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, w - 16);
    drawGlyph(g, 'span', 40, 40, 176, '#f2d9a0', 10);
  });
  const keyMat = new THREE.MeshStandardMaterial({ map: keyTex, emissive: 0xffd79a, emissiveMap: keyTex, emissiveIntensity: 0.05, metalness: 0.5, roughness: 0.5 });
  const keystone = ctx.box(0.7, 0.7, 0.25, keyMat, scene, 0, 5.75, -15.35, 0.03);
  keystone.castShadow = false;
  ctx.animate((_dt, _t, s) => { keyMat.emissiveIntensity = s.bridge.crossed ? 1.2 : 0.05; });

  return { segments, leaves };
}
