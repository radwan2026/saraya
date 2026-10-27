// First-person navigation. Movement goes through the shared collision rules, so the player can never
// walk off the bridge, through the gate or into the quarantine field.

import * as THREE from 'three';
import type { GameLogic } from '../game/logic';
import { EYE_HEIGHT, moveWithCollision } from '../game/layout';

export interface ControlSettings {
  sensitivity: number;
  invertY: boolean;
  reduceMotion: boolean;
}

export type Action = 'interact' | 'shift' | 'journal' | 'pause';

export class PlayerController {
  yaw = 0;
  pitch = 0;
  /** Gameplay input is accepted (false during cinematics, menus and panels). */
  enabled = false;
  /** When true something else (a cinematic or close-up) drives the camera. */
  cinematic = false;
  pointerLocked = false;
  dragLook = false;
  onAction: (a: Action) => void = () => {};
  onStep: () => void = () => {};
  readonly settings: ControlSettings = { sensitivity: 1, invertY: false, reduceMotion: false };

  private keys = new Set<string>();
  private touchMove = new THREE.Vector2();
  private bob = 0;
  private stepAcc = 0;
  private dragging = false;
  private lockFailed = false;

  constructor(private camera: THREE.PerspectiveCamera, private dom: HTMLElement, public logic: GameLogic) {
    addEventListener('keydown', this.keydown);
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      if (!this.pointerLocked && this.enabled && !this.cinematic) this.onAction('pause');
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockFailed = true;
      this.dragLook = true;
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled || this.cinematic) return;
      // Chrome can report one huge movement right after pointer lock engages; ignore such jumps
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      if (this.pointerLocked || (this.dragLook && this.dragging)) this.look(e.movementX, e.movementY);
    });
    this.dom.addEventListener('mousedown', () => {
      if (!this.enabled) return;
      if (!this.pointerLocked && !this.lockFailed) this.requestLock();
      this.dragging = true;
    });
    addEventListener('mouseup', () => (this.dragging = false));
    this.bindTouch();
  }

  requestLock() {
    if (this.lockFailed || matchMedia('(pointer: coarse)').matches) {
      this.dragLook = true;
      return;
    }
    try {
      const p = this.dom.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => { this.lockFailed = true; this.dragLook = true; });
    } catch {
      this.lockFailed = true;
      this.dragLook = true;
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private keydown = (e: KeyboardEvent) => {
    if (e.repeat && e.code !== 'KeyW') return;
    this.keys.add(e.code);
    if (!this.enabled) return;
    if (e.code === 'KeyE' || e.code === 'Enter') this.onAction('interact');
    if (e.code === 'KeyQ') this.onAction('shift');
    if (e.code === 'Tab' || e.code === 'KeyJ') {
      e.preventDefault();
      this.onAction('journal');
    }
  };

  look(dx: number, dy: number) {
    const k = 0.0022 * this.settings.sensitivity;
    this.yaw -= dx * k;
    this.pitch -= dy * k * (this.settings.invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.35);
  }

  private bindTouch() {
    let stickId: number | null = null;
    let lookId: number | null = null;
    const origin = new THREE.Vector2();
    const last = new THREE.Vector2();
    this.dom.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < innerWidth * 0.4 && stickId === null) {
          stickId = t.identifier;
          origin.set(t.clientX, t.clientY);
        } else if (lookId === null) {
          lookId = t.identifier;
          last.set(t.clientX, t.clientY);
        }
      }
    }, { passive: true });
    this.dom.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) {
          this.touchMove.set(t.clientX - origin.x, t.clientY - origin.y).divideScalar(60);
          if (this.touchMove.length() > 1) this.touchMove.normalize();
        } else if (t.identifier === lookId) {
          this.look((t.clientX - last.x) * 1.6, (t.clientY - last.y) * 1.6);
          last.set(t.clientX, t.clientY);
        }
      }
    }, { passive: true });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) { stickId = null; this.touchMove.set(0, 0); }
        if (t.identifier === lookId) lookId = null;
      }
    };
    this.dom.addEventListener('touchend', end);
    this.dom.addEventListener('touchcancel', end);
  }

  /** Places the player at the saved pose. */
  setPose(x: number, z: number, yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.logic.updatePlayer(x, z, yaw, pitch);
    this.applyCamera(0);
  }

  update(dt: number) {
    const s = this.logic.state;
    if (this.enabled && !this.cinematic) {
      const f = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.touchMove.y;
      const r = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touchMove.x;
      const len = Math.hypot(f, r);
      if (len > 0.01) {
        const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 5 : 3.1;
        const nf = f / Math.max(1, len), nr = r / Math.max(1, len);
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        const dx = (-sin * nf + cos * nr) * speed * dt;
        const dz = (-cos * nf - sin * nr) * speed * dt;
        const next = moveWithCollision(s, s.timeline, s.player.x, s.player.z, dx, dz);
        const moved = Math.hypot(next.x - s.player.x, next.z - s.player.z);
        this.logic.updatePlayer(next.x, next.z, this.yaw, this.pitch);
        this.bob += moved * 3.4;
        this.stepAcc += moved;
        if (this.stepAcc > 0.62) {
          this.stepAcc = 0;
          this.onStep();
        }
      } else {
        this.logic.updatePlayer(s.player.x, s.player.z, this.yaw, this.pitch);
      }
    }
    if (!this.cinematic) this.applyCamera(dt);
  }

  private applyCamera(_dt: number) {
    const s = this.logic.state;
    const bobAmp = this.settings.reduceMotion ? 0 : 0.035;
    this.camera.position.set(s.player.x, EYE_HEIGHT + Math.sin(this.bob) * bobAmp, s.player.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
