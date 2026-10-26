// The Temporal Echo, data-driven. Every object that differs between PRESENT and ECHO registers a
// definition whose `resolve` returns its target pose and look for the current game state and
// timeline. The controller eases each object towards that target, so objects glide, fade and swing
// between states instead of popping. Shared materials and lights blend on the global echo factor.

import * as THREE from 'three';
import type { GameState, Timeline } from '../game/types';

export interface TemporalProps {
  visible?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export interface TemporalDef {
  id: string;
  object: THREE.Object3D;
  resolve: (s: GameState, t: Timeline) => TemporalProps;
  /** Approach rate per second (higher is snappier). */
  speed?: number;
  /** Cross-fade opacity when visibility changes. Gives the object its own material copies. */
  fade?: boolean;
}

interface Live {
  def: TemporalDef;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
  opacity: number;
  meshes: { mats: THREE.Material[]; baseOpacity: number[]; baseDepth: boolean[]; baseTransparent: boolean[] }[];
}

export interface MaterialState {
  color?: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
}

interface MatBlend {
  mat: THREE.MeshStandardMaterial;
  a: Required<Pick<MaterialState, 'emissiveIntensity' | 'roughness' | 'metalness' | 'opacity'>> & { color: THREE.Color; emissive: THREE.Color };
  b: MatBlend['a'];
}

interface LightBlend {
  light: THREE.Light;
  present: { intensity: number; color: THREE.Color };
  echo: { intensity: number; color: THREE.Color };
  flicker: number;
}

export class TemporalController {
  private live: Live[] = [];
  private mats: MatBlend[] = [];
  private lights: LightBlend[] = [];
  /** 0 = fully PRESENT, 1 = fully ECHO. Eased so lighting and grading cross-fade. */
  echo = 0;
  echoTarget = 0;
  /** When set, overrides the timeline for lighting and materials (used by the ending). */
  forceEcho: number | null = null;

  register(def: TemporalDef): void {
    const meshes: Live['meshes'] = [];
    if (def.fade) {
      def.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // Own materials, so fading one object never fades another that shares a material.
        const list = (Array.isArray(m.material) ? m.material : [m.material]).map((mt) => mt.clone());
        m.material = Array.isArray(m.material) ? list : list[0];
        meshes.push({
          mats: list,
          baseOpacity: list.map((mt) => mt.opacity),
          baseDepth: list.map((mt) => mt.depthWrite),
          baseTransparent: list.map((mt) => mt.transparent),
        });
      });
    }
    this.live.push({
      def,
      pos: def.object.position.clone(),
      rot: def.object.rotation.clone(),
      scale: def.object.scale.x,
      opacity: def.object.visible ? 1 : 0,
      meshes,
    });
  }

  blendMaterial(mat: THREE.MeshStandardMaterial, present: MaterialState, echo: MaterialState): void {
    const full = (s: MaterialState) => ({
      color: new THREE.Color(s.color ?? mat.color),
      emissive: new THREE.Color(s.emissive ?? mat.emissive),
      emissiveIntensity: s.emissiveIntensity ?? mat.emissiveIntensity,
      roughness: s.roughness ?? mat.roughness,
      metalness: s.metalness ?? mat.metalness,
      opacity: s.opacity ?? mat.opacity,
    });
    this.mats.push({ mat, a: full(present), b: full(echo) });
  }

  blendLight(light: THREE.Light, present: { intensity: number; color?: THREE.ColorRepresentation }, echo: { intensity: number; color?: THREE.ColorRepresentation }, flicker = 0): void {
    this.lights.push({
      light,
      present: { intensity: present.intensity, color: new THREE.Color(present.color ?? light.color) },
      echo: { intensity: echo.intensity, color: new THREE.Color(echo.color ?? light.color) },
      flicker,
    });
  }

  /** Jump straight to the target state (used on load and after cinematics). */
  snap(s: GameState): void {
    this.echo = this.echoTarget = s.timeline === 'echo' ? 1 : 0;
    this.update(s, 10, 0, true);
  }

  update(s: GameState, dt: number, time: number, snap = false): void {
    this.echoTarget = this.forceEcho ?? (s.timeline === 'echo' ? 1 : 0);
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.echo += (this.echoTarget - this.echo) * k;
    if (Math.abs(this.echo - this.echoTarget) < 0.001) this.echo = this.echoTarget;
    const e = this.echo;

    for (const m of this.mats) {
      m.mat.color.copy(m.a.color).lerp(m.b.color, e);
      m.mat.emissive.copy(m.a.emissive).lerp(m.b.emissive, e);
      m.mat.emissiveIntensity = THREE.MathUtils.lerp(m.a.emissiveIntensity, m.b.emissiveIntensity, e) * (m.mat.userData.power ?? 1);
      m.mat.roughness = THREE.MathUtils.lerp(m.a.roughness, m.b.roughness, e);
      m.mat.metalness = THREE.MathUtils.lerp(m.a.metalness, m.b.metalness, e);
    }
    for (const l of this.lights) {
      let i = THREE.MathUtils.lerp(l.present.intensity, l.echo.intensity, e);
      if (l.flicker > 0 && e < 0.5) {
        const f = Math.sin(time * 23.1 + l.light.id) * Math.sin(time * 7.3) > 0.82 ? 0.25 : 1;
        i *= THREE.MathUtils.lerp(1, f, l.flicker * (1 - e * 2));
      }
      l.light.intensity = i * (l.light.userData.power ?? 1);
      l.light.color.copy(l.present.color).lerp(l.echo.color, e);
    }

    for (const L of this.live) {
      const p = L.def.resolve(s, s.timeline);
      const rate = snap ? 1 : 1 - Math.exp(-dt * (L.def.speed ?? 2.4));
      if (p.position) L.pos.lerp(new THREE.Vector3(...p.position), rate);
      if (p.rotation) {
        L.rot.x += (p.rotation[0] - L.rot.x) * rate;
        L.rot.y += (p.rotation[1] - L.rot.y) * rate;
        L.rot.z += (p.rotation[2] - L.rot.z) * rate;
      }
      if (p.scale !== undefined) L.scale += (p.scale - L.scale) * rate;
      const targetOpacity = p.visible === false ? 0 : 1;
      if (!L.def.fade) L.opacity = targetOpacity;
      else {
        L.opacity += (targetOpacity - L.opacity) * (snap ? 1 : 1 - Math.exp(-dt * 4));
        if (Math.abs(L.opacity - targetOpacity) < 0.004) L.opacity = targetOpacity;
      }

      const o = L.def.object;
      o.position.copy(L.pos);
      o.rotation.copy(L.rot);
      o.scale.setScalar(L.scale);
      o.visible = L.opacity > 0.003;
      if (!L.def.fade) continue;
      for (const me of L.meshes) {
        me.mats.forEach((mt, i) => {
          const fading = L.opacity < 0.999;
          const sh = mt as THREE.ShaderMaterial;
          if (sh.isShaderMaterial && sh.uniforms.uAlpha) {
            sh.uniforms.uAlpha.value = L.opacity;
            return;
          }
          mt.transparent = fading || me.baseTransparent[i];
          mt.opacity = me.baseOpacity[i] * L.opacity;
          mt.depthWrite = fading ? false : me.baseDepth[i];
        });
      }
    }
  }
}
