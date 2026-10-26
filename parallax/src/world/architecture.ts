// The hall itself: floors, walls, the chasm, ceiling coffers, light shafts, conduits, cables,
// wall machinery and the monumental exit door. Lights are tagged by section for the intro.

import * as THREE from 'three';
import { BuildCtx, PALETTE, gearGeometry, ringGeometry } from './context';
import { HALL, POS } from '../game/layout';
import { DOOR_MESSAGE } from '../game/texts';
import { canvasTexture, textTexture } from './textures';

/** A plane whose UVs repeat every `tile` metres, so one material fits walls of any size. */
function tiledPlane(w: number, h: number, tile: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (h / tile));
  return g;
}

export const lightShaftMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0x9fdcff) }, uIntensity: { value: 0.25 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vView = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5); }
      void main(){
        float edge = pow(abs(dot(vN, vView)), 1.6);
        float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float motes = 0.75 + 0.25*sin(vUv.y*40.0 - uTime*0.6 + sin(vUv.x*30.0)*2.0);
        gl_FragColor = vec4(uColor * uIntensity * edge * fade * motes, 1.0);
      }`,
  });

export const conduitMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.emeraldGlow) }, uFlow: { value: 0.4 }, uIntensity: { value: 0.6 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uFlow; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float pulse = pow(0.5 + 0.5*sin(vUv.x*60.0 - uTime*uFlow*8.0), 6.0);
        float core = 0.25 + pulse;
        gl_FragColor = vec4(uColor * core * uIntensity * 2.2, 1.0);
      }`,
  });

export function buildArchitecture(ctx: BuildCtx) {
  const { scene, mats, temporal } = ctx;
  const root = new THREE.Group();
  root.name = 'architecture';
  scene.add(root);
  const W = HALL.x1 - HALL.x0;
  const H = HALL.height;

  // ---------------------------------------------------------------- floors
  const southLen = HALL.z1 - -9;
  const floorS = ctx.mesh(tiledPlane(W, southLen, 6), mats.floor, root, 0, 0, (HALL.z1 + -9) / 2, false);
  floorS.rotation.x = -Math.PI / 2;
  const northLen = -15 - HALL.z0;
  const floorN = ctx.mesh(tiledPlane(W, northLen, 6), mats.floor, root, 0, 0, (-15 + HALL.z0) / 2, false);
  floorN.rotation.x = -Math.PI / 2;

  // the engine dais: concentric gold and emerald inlays under the suspended engine
  const inlay = new THREE.Group();
  inlay.position.set(POS.engine.x, 0.012, POS.engine.z);
  inlay.rotation.x = -Math.PI / 2;
  root.add(inlay);
  const inlayGold = mats.gold.clone();
  [5.4, 4.2, 2.6].forEach((r) => ctx.mesh(new THREE.RingGeometry(r - 0.06, r, 128), inlayGold, inlay, 0, 0, 0, false));
  const inlayGlow = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.emeraldGlow, emissiveIntensity: 0.9 });
  ctx.mesh(new THREE.RingGeometry(4.75, 4.8, 128), inlayGlow, inlay, 0, 0, 0, false);
  for (let i = 0; i < 8; i++) {
    const spoke = ctx.mesh(new THREE.PlaneGeometry(0.05, 2.8), inlayGold, inlay, 0, 0, 0, false);
    spoke.rotation.z = (i / 8) * Math.PI * 2;
    spoke.position.set(Math.sin(spoke.rotation.z) * -4, Math.cos(spoke.rotation.z) * 4, 0);
  }
  temporal.blendMaterial(inlayGlow, { emissiveIntensity: 0.35, emissive: PALETTE.emeraldGlow }, { emissiveIntensity: 1.2, emissive: PALETTE.amber });
  ctx.section('center').emissive.push(inlayGlow);

  // ---------------------------------------------------------------- walls
  const wallGeo = tiledPlane(HALL.z1 - HALL.z0, H + 2, 8);
  const west = ctx.mesh(wallGeo, mats.stone, root, HALL.x0, H / 2 - 1, (HALL.z0 + HALL.z1) / 2, false);
  west.rotation.y = Math.PI / 2;
  const east = ctx.mesh(wallGeo, mats.stone, root, HALL.x1, H / 2 - 1, (HALL.z0 + HALL.z1) / 2, false);
  east.rotation.y = -Math.PI / 2;
  const south = ctx.mesh(tiledPlane(W, H + 2, 8), mats.stone, root, 0, H / 2 - 1, HALL.z1, false);
  south.rotation.y = Math.PI;
  // north wall with a circular opening for the door
  const northShape = new THREE.Shape();
  northShape.moveTo(-W / 2, -1); northShape.lineTo(W / 2, -1); northShape.lineTo(W / 2, H + 1); northShape.lineTo(-W / 2, H + 1); northShape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 5.2, 4.75, 0, Math.PI * 2, true);
  northShape.holes.push(hole);
  const northGeo = new THREE.ShapeGeometry(northShape, 64);
  const nuv = northGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < nuv.count; i++) nuv.setXY(i, nuv.getX(i) / 8, nuv.getY(i) / 8);
  ctx.mesh(northGeo, mats.stone, root, 0, 0, HALL.z0, false);

  // grime and patina streaks exist only in the present
  const stainMat = new THREE.MeshBasicMaterial({ map: mats.stains, transparent: true, depthWrite: false, opacity: 0.85 });
  const stains = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let z = HALL.z0 + 4; z < HALL.z1 - 2; z += 7.5) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), stainMat);
      st.position.set(side * (HALL.x1 - 0.02), 7, z);
      st.rotation.y = -side * Math.PI / 2;
      stains.add(st);
    }
  }
  root.add(stains);
  temporal.register({ id: 'stains', fade: true, object: stains, resolve: (_s, t) => ({ visible: t === 'present' }) });

  // pilasters, capitals and arches, instanced along both long walls
  const pilasterZ = [12, 8, 4, 0, -8, -12, -16, -20];
  const pilGeo = new THREE.BoxGeometry(0.9, H, 0.7);
  const pil = new THREE.InstancedMesh(pilGeo, mats.stone, pilasterZ.length * 2);
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.35, 0.9), mats.gold, pilasterZ.length * 2);
  const base = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), mats.darkMetal, pilasterZ.length * 2);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (const side of [-1, 1]) {
    for (const z of pilasterZ) {
      const x = side * (HALL.x1 - 0.35);
      m4.makeTranslation(x, H / 2, z); pil.setMatrixAt(n, m4);
      m4.makeTranslation(x, 11.2, z); cap.setMatrixAt(n, m4);
      m4.makeTranslation(x, 0.3, z); base.setMatrixAt(n, m4);
      n++;
    }
  }
  for (const im of [pil, cap, base]) { im.castShadow = false; im.receiveShadow = ctx.quality !== 'low'; root.add(im); }
  const arches = new THREE.InstancedMesh(new THREE.TorusGeometry(2, 0.16, 10, 32, Math.PI), mats.darkMetal, (pilasterZ.length - 1) * 2);
  let a = 0;
  const q = new THREE.Quaternion();
  for (const side of [-1, 1]) {
    for (let i = 0; i < pilasterZ.length - 1; i++) {
      const z0 = pilasterZ[i], z1 = pilasterZ[i + 1];
      if (Math.abs(z0 - z1) > 4.5) continue;
      q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
      m4.compose(new THREE.Vector3(side * (HALL.x1 - 0.3), 11.2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1));
      arches.setMatrixAt(a++, m4);
    }
  }
  arches.count = a;
  root.add(arches);

  // cornice
  for (const side of [-1, 1]) {
    ctx.box(0.6, 0.5, HALL.z1 - HALL.z0, mats.darkMetal, root, side * (HALL.x1 - 0.3), 12.6, (HALL.z0 + HALL.z1) / 2, 0.05);
    ctx.box(0.2, 0.08, HALL.z1 - HALL.z0, mats.gold, root, side * (HALL.x1 - 0.62), 12.3, (HALL.z0 + HALL.z1) / 2, 0.02);
  }

  // ---------------------------------------------------------------- ceiling
  const ceil = ctx.mesh(tiledPlane(W, HALL.z1 - HALL.z0, 8), mats.darkMetal, root, 0, H, (HALL.z0 + HALL.z1) / 2, false);
  ceil.rotation.x = Math.PI / 2;
  const beamsX = new THREE.InstancedMesh(new THREE.BoxGeometry(W, 0.5, 0.35), mats.darkMetal, 10);
  for (let i = 0; i < 10; i++) { m4.makeTranslation(0, H - 0.25, HALL.z1 - 2 - i * 4); beamsX.setMatrixAt(i, m4); }
  const beamsZ = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.5, HALL.z1 - HALL.z0), mats.darkMetal, 5);
  for (let i = 0; i < 5; i++) { m4.makeTranslation(-8 + i * 4, H - 0.25, (HALL.z0 + HALL.z1) / 2); beamsZ.setMatrixAt(i, m4); }
  root.add(beamsX, beamsZ);
  const oculus = ctx.mesh(new THREE.TorusGeometry(3.2, 0.28, 16, 96), mats.gold, root, POS.engine.x, H - 0.4, POS.engine.z, false);
  oculus.rotation.x = Math.PI / 2;

  // ---------------------------------------------------------------- the chasm
  const pit = new THREE.Group();
  root.add(pit);
  const pitDepth = 34;
  const pitMat = mats.stone.clone();
  pitMat.color.set(0x5d6266);
  for (const z of [-9, -15]) {
    const face = ctx.mesh(tiledPlane(W, pitDepth, 8), pitMat, pit, 0, -pitDepth / 2, z, false);
    face.rotation.y = z === -9 ? Math.PI : 0;
  }
  for (const side of [-1, 1]) {
    const face = ctx.mesh(tiledPlane(6, pitDepth, 8), pitMat, pit, side * HALL.x1, -pitDepth / 2, -12, false);
    face.rotation.y = -side * Math.PI / 2;
  }
  const pitGlow = new THREE.PointLight(PALETTE.cyan, 60, 40, 1.6);
  pitGlow.position.set(0, -24, -12);
  pit.add(pitGlow);
  temporal.blendLight(pitGlow, { intensity: 60, color: PALETTE.cyan }, { intensity: 30, color: PALETTE.amber }, 0.6);
  ctx.section('center').lights.push(pitGlow);
  // pipes falling into the dark
  for (let i = 0; i < 7; i++) {
    const x = -10 + i * 3.3;
    ctx.mesh(new THREE.CylinderGeometry(0.16, 0.16, pitDepth, 10), mats.darkMetal, pit, x, -pitDepth / 2, -9.3, false);
  }
  // gold lips and railings on both edges, open at the bridge
  const railPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), mats.gold, 40);
  let rp = 0;
  for (const z of [-9.05, -14.95]) {
    for (const side of [-1, 1]) {
      const x0 = side * 1.6, x1 = side * 11.8;
      ctx.box(Math.abs(x1 - x0), 0.08, 0.12, mats.gold, root, (x0 + x1) / 2, 0.06, z, 0.02);
      ctx.box(Math.abs(x1 - x0), 0.06, 0.06, mats.gold, root, (x0 + x1) / 2, 1.08, z, 0.02);
      for (let x = x0; Math.abs(x) <= Math.abs(x1) + 0.01; x += side * 1.4) {
        if (rp < 40) { m4.makeTranslation(x, 0.55, z); railPosts.setMatrixAt(rp++, m4); }
      }
    }
  }
  railPosts.count = rp;
  root.add(railPosts);

  // ---------------------------------------------------------------- light shafts
  const shafts: { mat: THREE.ShaderMaterial; present: number; echo: number }[] = [];
  const addShaft = (x: number, z: number, rTop: number, rBottom: number, hgt: number, present: number, echo: number) => {
    const mat = lightShaftMaterial();
    const geo = new THREE.CylinderGeometry(rTop, rBottom, hgt, 40, 1, true);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, H - hgt / 2, z);
    m.renderOrder = 5;
    root.add(m);
    shafts.push({ mat, present, echo });
  };
  addShaft(POS.engine.x, POS.engine.z, 2.8, 4.2, 15.5, 0.22, 0.42);
  addShaft(-6, 7, 0.9, 2.4, 15.5, 0.14, 0.26);
  addShaft(6, -19, 0.9, 2.6, 15.5, 0.16, 0.3);
  ctx.animate((_dt, t, _s, e) => {
    for (const s of shafts) {
      s.mat.uniforms.uTime.value = t;
      s.mat.uniforms.uIntensity.value = THREE.MathUtils.lerp(s.present, s.echo, e) * (s.mat.userData.power ?? 1);
      (s.mat.uniforms.uColor.value as THREE.Color).setHex(0x9fdcff).lerp(new THREE.Color(PALETTE.amber), e);
    }
  });
  ctx.section('center').emissive.push(...shafts.map((s) => s.mat as unknown as THREE.MeshStandardMaterial));

  // ---------------------------------------------------------------- conduits along the walls
  const conduitMats: THREE.ShaderMaterial[] = [];
  for (const side of [-1, 1]) {
    for (const y of [0.55, 9.4]) {
      const cm = conduitMaterial();
      conduitMats.push(cm);
      const len = HALL.z1 - HALL.z0 - 1;
      const pipe = ctx.mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 12, 1, true), mats.darkMetal, root, side * (HALL.x1 - 0.95), y, (HALL.z0 + HALL.z1) / 2, false);
      pipe.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 8), cm);
      core.position.copy(pipe.position);
      core.rotation.x = Math.PI / 2;
      core.position.x += side * -0.06;
      root.add(core);
      for (let z = HALL.z0 + 1; z < HALL.z1; z += 3) ctx.box(0.12, 0.34, 0.12, mats.gold, root, side * (HALL.x1 - 0.95), y, z, 0.02);
    }
  }
  ctx.animate((_dt, t, s, e) => {
    const solved = [s.shadow.solved, s.engine.solved, s.bridge.anchored, s.voice.solved].filter(Boolean).length;
    for (const cm of conduitMats) {
      cm.uniforms.uTime.value = t;
      cm.uniforms.uFlow.value = THREE.MathUtils.lerp(0.25 + solved * 0.12, 1.1, e);
      (cm.uniforms.uColor.value as THREE.Color).setHex(PALETTE.emeraldGlow).lerp(new THREE.Color(PALETTE.amber), e);
      const flick = e < 0.5 && Math.sin(t * 13.0) * Math.sin(t * 3.1) > 0.9 ? 0.3 : 1;
      cm.uniforms.uIntensity.value = THREE.MathUtils.lerp(0.35 + solved * 0.1, 0.9, e) * flick * (cm.userData.power ?? 1);
    }
  });
  ctx.section('south').emissive.push(...conduitMats.map((m) => m as unknown as THREE.MeshStandardMaterial));

  // ---------------------------------------------------------------- wall machinery
  const gears: THREE.Mesh[] = [];
  const gearMat = mats.gold.clone();
  temporal.blendMaterial(gearMat, { color: 0x4b5b52, roughness: 0.78, metalness: 0.55 }, { color: 0xb08d4a, roughness: 0.3, metalness: 0.95 });
  const gearSpots: [number, number, number, number, number][] = [
    [-1, 7.5, 10.5, 2.0, 1], [-1, 6.2, 7.6, 1.2, -1], [1, 7.5, 5.5, 2.2, -1], [1, 5.8, 8.6, 1.0, 1],
    [-1, 8, -19.5, 2.4, 1], [1, 8, -19.5, 2.4, -1], [1, 6.4, -16.6, 1.2, 1],
  ];
  for (const [side, y, z, r, dir] of gearSpots) {
    const g = new THREE.Mesh(gearGeometry(Math.round(r * 11), r, 0.3), gearMat);
    g.position.set(side * (HALL.x1 - 0.5), y, z);
    g.rotation.y = side * Math.PI / 2;
    g.userData.w = dir / r;
    g.castShadow = false;
    root.add(g);
    gears.push(g);
  }
  ctx.animate((dt, _t, s, e) => {
    const solvedBoost = s.engine.solved ? 0.25 : 0;
    for (const g of gears) g.rotateZ(g.userData.w * dt * (e * 0.6 + solvedBoost));
  });

  // ---------------------------------------------------------------- cables from the ceiling to the engine
  const cableGroup = new THREE.Group();
  root.add(cableGroup);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.2;
    const top = new THREE.Vector3(Math.cos(ang) * 6.5, H - 0.3, POS.engine.z + Math.sin(ang) * 5.5);
    const bottom = new THREE.Vector3(Math.cos(ang) * 2.4, POS.engine.y + 2.2, POS.engine.z + Math.sin(ang) * 0.6);
    const mid = top.clone().lerp(bottom, 0.5);
    mid.y -= 1.6;
    const curve = new THREE.QuadraticBezierCurve3(top, mid, bottom);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.06, 6), cableMat);
    cableGroup.add(tube);
  }
  ctx.animate((_dt, t) => { cableGroup.rotation.z = Math.sin(t * 0.4) * 0.004; });

  // ---------------------------------------------------------------- sconces and lighting
  const hemi = new THREE.HemisphereLight(0x6c8a9a, 0x0b0d10, 0.35);
  scene.add(hemi);
  temporal.blendLight(hemi, { intensity: 0.32, color: 0x6c8a9a }, { intensity: 0.5, color: 0xffd6a0 });
  ctx.section('ambient').lights.push(hemi);

  const keySouth = new THREE.SpotLight(0x9fdcff, 900, 40, Math.PI / 4.2, 0.6, 1.6);
  keySouth.position.set(-3, H - 0.6, 7);
  keySouth.target.position.set(-2, 0, 5);
  scene.add(keySouth, keySouth.target);
  temporal.blendLight(keySouth, { intensity: 700, color: 0x9fdcff }, { intensity: 1100, color: 0xffc98a }, 0.5);
  ctx.section('south').lights.push(keySouth);

  const keyNorth = new THREE.SpotLight(0x9fdcff, 900, 40, Math.PI / 4.2, 0.6, 1.6);
  keyNorth.position.set(4, H - 0.6, -19);
  keyNorth.target.position.set(1, 0, -19);
  scene.add(keyNorth, keyNorth.target);
  temporal.blendLight(keyNorth, { intensity: 650, color: 0x8fd7ff }, { intensity: 1000, color: 0xffc98a }, 0.4);
  ctx.section('north').lights.push(keyNorth);

  const sconceGeo = new THREE.SphereGeometry(0.16, 16, 12);
  const sconceMats: THREE.MeshStandardMaterial[] = [];
  const sconceLights: THREE.PointLight[] = [];
  const sconceZ = [10, 2, -10, -18];
  for (const side of [-1, 1]) {
    for (const z of sconceZ) {
      const x = side * (HALL.x1 - 0.95);
      ctx.box(0.12, 0.5, 0.12, mats.gold, root, x, 4.1, z, 0.02);
      const bm = mats.amber.clone();
      sconceMats.push(bm);
      ctx.mesh(sconceGeo, bm, root, x - side * 0.2, 4.45, z, false);
      temporal.blendMaterial(bm, { emissiveIntensity: 0.05, emissive: 0x3a5a52 }, { emissiveIntensity: 3, emissive: PALETTE.amber });
    }
    // two real lights per side; the remaining sconces are emissive only
    // the west light sits away from the shadow archive so it does not wash out the shadows
    for (const z of side < 0 ? [12.2, -14] : [6, -14]) {
      const pl = new THREE.PointLight(PALETTE.amber, 0, 18, 1.8);
      pl.position.set(side * (HALL.x1 - 1.3), 4.4, z);
      scene.add(pl);
      sconceLights.push(pl);
      temporal.blendLight(pl, { intensity: 4, color: PALETTE.emeraldGlow }, { intensity: 70, color: PALETTE.amber }, 0.8);
      ctx.section(z > 0 ? 'south' : 'north').lights.push(pl);
    }
  }
  ctx.section('south').emissive.push(...sconceMats.slice(0, 2), ...sconceMats.slice(4, 6));
  ctx.section('north').emissive.push(...sconceMats.slice(2, 4), ...sconceMats.slice(6, 8));

  // emergency strips along the floor: the present's only steady light
  const stripMat = new THREE.MeshStandardMaterial({ color: 0, emissive: PALETTE.emeraldGlow, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    ctx.box(0.06, 0.04, 22, stripMat, root, side * (HALL.x1 - 0.12), 0.05, 2.5, 0.01);
    ctx.box(0.06, 0.04, 8.4, stripMat, root, side * (HALL.x1 - 0.12), 0.05, -19.4, 0.01);
  }
  temporal.blendMaterial(stripMat, { emissiveIntensity: 1.4 }, { emissiveIntensity: 0.0 });
  ctx.section('south').emissive.push(stripMat);

  // ---------------------------------------------------------------- the exit door
  const door = buildDoor(ctx);
  root.add(door.group);
  return { door, hemi };
}

export interface DoorRig {
  group: THREE.Group;
  outer: THREE.Object3D;
  middle: THREE.Object3D;
  leftHalf: THREE.Object3D;
  rightHalf: THREE.Object3D;
  glow: THREE.MeshBasicMaterial;
  message: THREE.Mesh;
  /** 0 = sealed, 1 = open. Driven by the ending. */
  open: number;
}

function buildDoor(ctx: BuildCtx): DoorRig {
  const { mats, temporal } = ctx;
  const group = new THREE.Group();
  group.position.set(POS.door.x, 5.2, POS.door.z);

  const frame = ctx.mesh(new THREE.TorusGeometry(4.75, 0.32, 24, 128), mats.gold, group, 0, 0, 0.1, false);
  frame.castShadow = false;
  // light beyond the door, revealed in the ending
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const beyond = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), glow);
  beyond.position.z = -0.5;
  group.add(beyond);
  ctx.mesh(new THREE.CircleGeometry(4.6, 64), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 }), group, 0, 0, -0.6, false);

  // two halves of the main plate
  const halfShape = (dir: 1 | -1) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 4.45, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : (3 * Math.PI) / 2, false);
    s.lineTo(0, dir > 0 ? -4.45 : 4.45);
    return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 64 });
  };
  const plateMat = mats.darkMetal.clone();
  temporal.blendMaterial(plateMat, { color: 0x262a2c, roughness: 0.6 }, { color: 0x3a3f44, roughness: 0.32 });
  const leftHalf = new THREE.Group();
  const rightHalf = new THREE.Group();
  group.add(leftHalf, rightHalf);
  ctx.mesh(halfShape(-1), plateMat, leftHalf, 0, 0, -0.3, false);
  ctx.mesh(halfShape(1), plateMat, rightHalf, 0, 0, -0.3, false);
  // seam
  ctx.box(0.05, 8.8, 0.05, ctx.mats.cyan, group, 0, 0, 0.08, 0.01);

  // rotating rings with bolts
  const outer = new THREE.Group();
  group.add(outer);
  ctx.mesh(ringGeometry(4.4, 3.3, 0.22), mats.metal, outer, 0, 0, 0.1, false);
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), mats.gold, 24);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    m.compose(new THREE.Vector3(Math.cos(ang) * 3.85, Math.sin(ang) * 3.85, 0.25), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
    bolts.setMatrixAt(i, m);
  }
  outer.add(bolts);
  const middle = new THREE.Group();
  group.add(middle);
  ctx.mesh(ringGeometry(3.2, 1.9, 0.3), mats.gold, middle, 0, 0, 0.18, false);
  for (let i = 0; i < 12; i++) {
    const s = ctx.box(0.18, 1.1, 0.12, mats.darkMetal, middle, 0, 0, 0.36, 0.02);
    const ang = (i / 12) * Math.PI * 2;
    s.position.set(Math.cos(ang) * 2.55, Math.sin(ang) * 2.55, 0.36);
    s.rotation.z = ang + Math.PI / 2;
  }
  const centreTex = canvasTexture(512, 512, (g, w) => {
    g.fillStyle = '#16191b'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#b08d4a'; g.lineWidth = 6;
    for (let r = 60; r < 250; r += 46) { g.beginPath(); g.arc(w / 2, w / 2, r, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 3;
    for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(an) * 60, w / 2 + Math.sin(an) * 60); g.lineTo(w / 2 + Math.cos(an) * 240, w / 2 + Math.sin(an) * 240); g.stroke(); }
  });
  ctx.mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.4, 64).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: centreTex, metalness: 0.8, roughness: 0.35 }), middle, 0, 0, 0.2, false);

  // the message, cut into the stone above the door: only in the present
  const message = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.6),
    new THREE.MeshStandardMaterial({ map: textTexture(DOOR_MESSAGE, { w: 2048, h: 360, size: 96, color: '#bdf6ff', glow: 24, font: '"Iowan Old Style", Palatino, Georgia, serif', spacing: 1.45 }), transparent: true, emissive: 0x9feaff, emissiveIntensity: 0.9, emissiveMap: textTexture(DOOR_MESSAGE, { w: 2048, h: 360, size: 96, color: '#ffffff', glow: 24, font: '"Iowan Old Style", Palatino, Georgia, serif', spacing: 1.45 }), depthWrite: false }),
  );
  message.position.set(0, 10.95 - 5.2, HALL.z0 + 0.06 - POS.door.z);
  group.add(message);
  temporal.register({ id: 'door-message', fade: true, object: message, resolve: (s, t) => ({ visible: t === 'present' || s.completed }) });
  ctx.section('door').emissive.push(message.material as THREE.MeshStandardMaterial);

  ctx.interact('door', [leftHalf, rightHalf, outer, middle], 9, { pos: new THREE.Vector3(0, 3.2, -16.5), look: new THREE.Vector3(0, 6.2, -24) });

  const rig: DoorRig = { group, outer, middle, leftHalf, rightHalf, glow, message, open: 0 };
  ctx.animate((dt, t, s) => {
    const target = s.completed ? 1 : 0;
    rig.open += (target - rig.open) * Math.min(1, dt * 0.35);
    const o = rig.open;
    const spin = THREE.MathUtils.smoothstep(o, 0, 0.45);
    outer.rotation.z = spin * Math.PI * 0.75 + Math.sin(t * 0.3) * 0.002;
    middle.rotation.z = -spin * Math.PI * 1.1;
    const retract = THREE.MathUtils.smoothstep(o, 0.35, 0.6);
    outer.position.z = -retract * 0.8;
    middle.position.z = -retract * 0.8;
    outer.scale.setScalar(1 - retract * 0.02);
    const slide = THREE.MathUtils.smoothstep(o, 0.55, 1);
    leftHalf.position.x = -slide * 5.2;
    rightHalf.position.x = slide * 5.2;
    outer.visible = middle.visible = slide < 0.6;
    glow.opacity = THREE.MathUtils.smoothstep(o, 0.5, 0.95);
  });
  return rig;
}
