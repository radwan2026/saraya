// Camera choreography: the intro, close-ups for discoveries, camera shake and the ending flight.
// While a sequence runs the player controller hands the camera over (`cinematic = true`).

import * as THREE from 'three';

export interface Key { t: number; pos: [number, number, number]; look: [number, number, number] }
export interface Cue { t: number; run: () => void }

interface Sequence {
  keys: Key[];
  cues: Cue[];
  time: number;
  fired: Set<number>;
  done: () => void;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export class Director {
  private seq: Sequence | null = null;
  private focus: { pos: THREE.Vector3; look: THREE.Vector3; from: THREE.Vector3; fromLook: THREE.Vector3; t: number; back: boolean; onBack?: () => void } | null = null;
  private shakeAmt = 0;
  reduceMotion = false;
  private lookTmp = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  get active() {
    return !!this.seq || !!this.focus;
  }

  get sequenceRunning() {
    return !!this.seq;
  }

  play(keys: Key[], cues: Cue[], done: () => void) {
    this.focus = null;
    this.seq = { keys, cues: cues.sort((a, b) => a.t - b.t), time: 0, fired: new Set(), done };
  }

  /** Jump to the end of the running sequence, firing every cue that has not fired yet. */
  skip() {
    const s = this.seq;
    if (!s) return;
    s.cues.forEach((c, i) => { if (!s.fired.has(i)) c.run(); });
    this.seq = null;
    s.done();
  }

  /** Smoothly moves the camera to a close-up. `release` returns it to the player's view. */
  closeUp(pos: THREE.Vector3, look: THREE.Vector3) {
    const from = this.camera.position.clone();
    const fromLook = this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4).add(from);
    this.focus = { pos: pos.clone(), look: look.clone(), from, fromLook, t: 0, back: false };
  }

  release(onBack: () => void) {
    if (!this.focus) return onBack();
    const f = this.focus;
    f.back = true;
    f.t = 0;
    f.onBack = onBack;
  }

  shake(amount: number) {
    if (!this.reduceMotion) this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  update(dt: number) {
    if (this.seq) {
      const s = this.seq;
      s.time += dt;
      s.cues.forEach((c, i) => {
        if (!s.fired.has(i) && s.time >= c.t) {
          s.fired.add(i);
          c.run();
        }
      });
      const k = s.keys;
      let i = 0;
      while (i < k.length - 2 && s.time > k[i + 1].t) i++;
      const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
      const span = Math.max(0.0001, b.t - a.t);
      const u = ease(THREE.MathUtils.clamp((s.time - a.t) / span, 0, 1));
      this.camera.position.set(...a.pos).lerp(new THREE.Vector3(...b.pos), u);
      this.lookTmp.set(...a.look).lerp(new THREE.Vector3(...b.look), u);
      this.camera.lookAt(this.lookTmp);
      if (s.time >= k[k.length - 1].t && s.fired.size === s.cues.length) {
        this.seq = null;
        s.done();
      }
    } else if (this.focus) {
      const f = this.focus;
      f.t = Math.min(1, f.t + dt * 1.8);
      const u = ease(f.t);
      if (!f.back) {
        this.camera.position.copy(f.from).lerp(f.pos, u);
        this.lookTmp.copy(f.fromLook).lerp(f.look, u);
      } else {
        this.camera.position.copy(f.pos).lerp(f.from, u);
        this.lookTmp.copy(f.look).lerp(f.fromLook, u);
      }
      this.camera.lookAt(this.lookTmp);
      if (f.back && f.t >= 1) {
        this.focus = null;
        f.onBack?.();
      }
    }
    if (this.shakeAmt > 0.0005) {
      const a = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      this.camera.rotation.z += (Math.random() - 0.5) * a * 0.05;
      this.shakeAmt *= Math.pow(0.04, dt);
    }
  }
}
