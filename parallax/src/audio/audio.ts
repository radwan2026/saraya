// Procedural, adaptive sound for the whole game. Nothing is loaded from files: drones, machinery,
// signatures, music and effects are all synthesised with the Web Audio API.
// PRESENT is cold and unstable (low drone, wind, electrical hum, creaks). ECHO is warm and busy
// (amber chord, rhythmic machinery, reversed swells). Shifting cross-fades the two layers.

import * as THREE from 'three';
import type { Keepsake, SourceId, Timeline } from '../game/types';
import { KEEPSAKE_SIGNATURES, SIGNATURES, type Beat, type Signature } from '../game/puzzles/voice';

export interface Volumes { master: number; music: number; ambience: number; sfx: number }
export interface PulseSegment { start: number; end: number }

const BEAT_LEN: Record<Beat, number> = { S: 0.16, L: 0.55, H: 1.3 };
const GAP = 0.15;

export function signatureTimeline(sig: Signature): PulseSegment[] {
  let t = 0;
  return sig.rhythm.map((b) => {
    const seg = { start: t, end: t + BEAT_LEN[b] };
    t += BEAT_LEN[b] + GAP;
    return seg;
  });
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private analyser!: AnalyserNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private sfxBus!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private presentLayer!: GainNode;
  private echoLayer!: GainNode;
  private engineHum!: GainNode;
  private enginePanner!: PannerNode;
  private noiseBuf!: AudioBuffer;
  private timers: number[] = [];
  private musicStep = 0;
  private intensity = 0;
  volumes: Volumes = { master: 0.8, music: 0.55, ambience: 0.8, sfx: 0.85 };

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private silentLoop: HTMLAudioElement | null = null;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  start() {
    if (this.ctx) {
      // 'suspended' after backgrounding, 'interrupted' on iOS after a call or another app took the audio
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
      this.keepSessionAwake();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    void ctx.resume().catch(() => {});
    // iOS only unlocks Web Audio once a buffer has started inside the gesture
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);
    this.keepSessionAwake();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    comp.connect(this.analyser);
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    for (const b of [this.musicBus, this.ambBus, this.sfxBus]) b.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(4.2, 2.6);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.55;
    this.verbSend.connect(this.verb).connect(this.master);
    this.noiseBuf = this.makeNoise(4);
    this.applyVolumes();
    this.buildAmbience();
    this.scheduleMusic();
  }

  /**
   * On iPhone and iPad the ringer switch silences Web Audio unless the page is also playing media.
   * A looping silent <audio> element (and the Audio Session API where Safari has it) moves the page
   * into the playback category, so the game is heard with the switch on silent, like a video would be.
   */
  private keepSessionAwake() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try { nav.audioSession.type = 'playback'; } catch { /* older Safari */ }
    }
    if (!this.silentLoop) {
      const rate = 8000, n = rate / 2;
      const wav = new DataView(new ArrayBuffer(44 + n * 2));
      const str = (o: number, s: string) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
      wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true);
      str(36, 'data'); wav.setUint32(40, n * 2, true);
      const el = (this.silentLoop = new Audio(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))));
      el.loop = true;
      el.setAttribute('playsinline', '');
    }
    if (this.silentLoop.paused) void this.silentLoop.play().catch(() => {});
  }

  setVolumes(v: Partial<Volumes>) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master * 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.32, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.ambience * 0.6, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.8, t, 0.05);
  }

  suspend(on: boolean) {
    if (!this.ctx) return;
    if (on) {
      void this.ctx.suspend();
      this.silentLoop?.pause();
    } else {
      void this.ctx.resume().catch(() => {});
      if (this.silentLoop?.paused) void this.silentLoop.play().catch(() => {});
    }
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1);
    }
    return buf;
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w; // slightly pink
      d[i] = (w * 0.4 + b * 2.2) * 0.5;
    }
    return buf;
  }

  private noiseSource(loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  // ---------------------------------------------------------------- ambience

  private buildAmbience() {
    const ctx = this.ctx!;
    this.presentLayer = ctx.createGain();
    this.echoLayer = ctx.createGain();
    this.presentLayer.gain.value = 1;
    this.echoLayer.gain.value = 0;
    this.presentLayer.connect(this.ambBus);
    this.echoLayer.connect(this.ambBus);
    this.presentLayer.connect(this.verbSend);
    this.echoLayer.connect(this.verbSend);

    // PRESENT: sub drone with slow beating
    for (const [f, g] of [[38, 0.22], [38.6, 0.18], [57.2, 0.07]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.presentLayer);
      o.start();
    }
    // wind through the hall
    const wind = this.noiseSource();
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 320;
    wf.Q.value = 0.8;
    const wg = ctx.createGain();
    wg.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(this.presentLayer);
    wind.start();
    lfo.start();
    // electrical hum
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 50;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 210;
    const hg = ctx.createGain();
    hg.gain.value = 0.025;
    hum.connect(hf).connect(hg).connect(this.presentLayer);
    hum.start();

    // ECHO: warm chord pad
    for (const [f, g] of [[55, 0.14], [82.4, 0.08], [110, 0.07], [138.6, 0.045], [164.8, 0.035]] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(lp).connect(og).connect(this.echoLayer);
      o.start();
    }
    // the engine's positional hum, louder once calibrated
    const eh = ctx.createOscillator();
    eh.type = 'sawtooth';
    eh.frequency.value = 73.4;
    const ef = ctx.createBiquadFilter();
    ef.type = 'lowpass';
    ef.frequency.value = 300;
    this.engineHum = ctx.createGain();
    this.engineHum.gain.value = 0.05;
    this.enginePanner = this.panner(new THREE.Vector3(0, 7.2, -4), 4);
    eh.connect(ef).connect(this.engineHum).connect(this.enginePanner).connect(this.ambBus);
    eh.start();

    const loop = (fn: () => void, min: number, max: number) => {
      const tick = () => {
        fn();
        this.timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
      };
      this.timers.push(window.setTimeout(tick, min * 1000));
    };
    loop(() => this.creak(), 4, 10);
    loop(() => this.energyPulse(), 7, 15);
    loop(() => this.echoMachinery(), 0.75, 0.75);
    loop(() => this.reversedSwell(), 9, 18);
  }

  setTimeline(t: Timeline) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.presentLayer.gain.cancelScheduledValues(now);
    this.echoLayer.gain.cancelScheduledValues(now);
    this.presentLayer.gain.setTargetAtTime(t === 'present' ? 1 : 0, now, 0.45);
    this.echoLayer.gain.setTargetAtTime(t === 'echo' ? 1 : 0, now, 0.45);
  }

  /** Raises the music and engine hum as puzzles are solved (0..5). */
  setIntensity(n: number) {
    this.intensity = n;
    if (!this.ctx) return;
    this.engineHum.gain.setTargetAtTime(0.05 + (n >= 2 ? 0.08 : 0), this.ctx.currentTime, 1);
  }

  updateListener(camera: THREE.Camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02);
      l.forwardY.setTargetAtTime(f.y, t, 0.02);
      l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.setTargetAtTime(u.x, t, 0.02);
      l.upY.setTargetAtTime(u.y, t, 0.02);
      l.upZ.setTargetAtTime(u.z, t, 0.02);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  private panner(pos: THREE.Vector3, ref = 3) {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.1;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    return p;
  }

  /** A destination for a one-shot: positional if a position is given. */
  private out(pos?: THREE.Vector3, bus: GainNode = this.sfxBus, verb = 0.6): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const send = ctx.createGain();
    send.gain.value = verb;
    if (pos) {
      const p = this.panner(pos);
      g.connect(p).connect(bus);
    } else g.connect(bus);
    g.connect(send).connect(this.verbSend);
    return g;
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, vol: number, attack = 0.01) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseHit(dest: AudioNode, t0: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1, attack = 0.005) {
    const ctx = this.ctx!;
    const s = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t0, Math.random() * 2);
    s.stop(t0 + dur + 0.05);
  }

  private creak() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(new THREE.Vector3((Math.random() - 0.5) * 20, 8 + Math.random() * 6, -20 + Math.random() * 30), this.presentLayer, 0.8);
    const f = 300 + Math.random() * 500;
    this.noiseHit(dest, t, 0.9 + Math.random(), 0.12, 'bandpass', f, f * (0.7 + Math.random() * 0.5), 18, 0.2);
  }

  private energyPulse() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(undefined, this.presentLayer, 0.9);
    this.tone(dest, 'sine', 60, 220, t, 1.6, 0.05, 0.4);
    this.tone(dest, 'sine', 1200, 900, t + 0.2, 0.9, 0.012, 0.1);
  }

  private echoMachinery() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(new THREE.Vector3(0, 7, -4), this.echoLayer, 0.4);
    this.tone(dest, 'sine', 70, 45, t, 0.25, 0.14, 0.004);
    this.noiseHit(dest, t, 0.05, 0.05, 'highpass', 3000);
  }

  private reversedSwell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(undefined, this.echoLayer, 1);
    this.noiseHit(dest, t, 2.4, 0.07, 'bandpass', 400, 1800, 3, 2.2);
    this.tone(dest, 'triangle', 220, 233, t, 2.4, 0.02, 2.2);
  }

  // ---------------------------------------------------------------- music: a restrained pad progression

  private scheduleMusic() {
    const chords = [
      [146.8, 220, 261.6, 329.6],
      [116.5, 174.6, 233.1, 293.7],
      [98, 146.8, 196, 233.1],
      [110, 164.8, 220, 277.2],
    ];
    const play = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      const chord = chords[this.musicStep++ % chords.length];
      const voices = 2 + Math.min(2, this.intensity);
      chord.slice(0, voices).forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        const lp = this.ctx!.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 3);
        g.gain.linearRampToValueAtTime(0.0001, t + 9.5);
        o.connect(lp).connect(g);
        g.connect(this.musicBus);
        g.connect(this.verbSend);
        o.start(t);
        o.stop(t + 10);
      });
      this.timers.push(window.setTimeout(play, 8000));
    };
    this.timers.push(window.setTimeout(play, 1500));
  }

  // ---------------------------------------------------------------- effects

  sfx(name: 'click' | 'interact' | 'fail' | 'discover' | 'solve' | 'pickup' | 'plate' | 'ring' | 'clank' | 'anchor' | 'anchorFail' | 'door' | 'locks' | 'footstep' | 'ui' | 'tick' | 'steam' | 'paper', pos?: THREE.Vector3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out(pos);
    switch (name) {
      case 'ui':
      case 'click':
        this.tone(d, 'triangle', 1800, 1500, t, 0.05, 0.05);
        break;
      case 'interact':
        this.tone(d, 'sine', 660, 640, t, 0.18, 0.06);
        break;
      case 'fail':
        this.tone(d, 'sine', 110, 70, t, 0.5, 0.18);
        this.tone(d, 'triangle', 233, 220, t, 0.4, 0.04);
        this.tone(d, 'triangle', 247, 240, t, 0.4, 0.035);
        break;
      case 'discover':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(d, 'sine', f, f, t + i * 0.09, 1.4, 0.05));
        break;
      case 'pickup':
        this.tone(d, 'sine', 880, 880, t, 0.5, 0.06);
        this.tone(d, 'sine', 1318.5, 1318.5, t + 0.07, 0.7, 0.04);
        break;
      case 'solve':
        [130.8, 196, 261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(d, i < 2 ? 'sine' : 'triangle', f, f, t + i * 0.12, 3.2, 0.06, 0.05));
        this.noiseHit(d, t, 2.5, 0.05, 'highpass', 6000, 9000, 1, 0.8);
        break;
      case 'plate':
        this.noiseHit(d, t, 0.45, 0.25, 'bandpass', 700, 400, 6, 0.03);
        this.tone(d, 'sine', 180, 160, t + 0.4, 0.2, 0.08, 0.004);
        break;
      case 'ring':
        this.metal(d, t, 140, 0.18);
        this.noiseHit(d, t, 0.35, 0.15, 'bandpass', 500, 300, 4, 0.02);
        break;
      case 'clank':
        this.metal(d, t, 95, 0.3);
        break;
      case 'locks':
        for (let i = 0; i < 6; i++) this.metal(d, t + 0.18 * i, 110 + i * 9, 0.22);
        this.tone(d, 'sine', 55, 41, t, 2.2, 0.25, 0.1);
        break;
      case 'anchor':
        this.tone(d, 'sine', 80, 160, t, 1.4, 0.2, 0.05);
        this.tone(d, 'triangle', 440, 880, t + 0.2, 1.2, 0.04, 0.2);
        this.noiseHit(d, t, 1.6, 0.08, 'bandpass', 200, 2000, 2, 0.6);
        break;
      case 'anchorFail':
        this.tone(d, 'sine', 160, 60, t, 0.9, 0.18, 0.02);
        this.noiseHit(d, t, 0.6, 0.08, 'lowpass', 900, 200, 1, 0.02);
        break;
      case 'door':
        this.noiseHit(d, t, 6, 0.4, 'lowpass', 240, 90, 1, 1.2);
        this.tone(d, 'sine', 36, 30, t, 6, 0.35, 1);
        for (let i = 0; i < 4; i++) this.metal(d, t + 0.8 + i * 0.9, 80 + i * 6, 0.25);
        break;
      case 'tick':
        this.noiseHit(d, t, 0.05, 0.22, 'bandpass', 2600, 2600, 6, 0.002);
        this.tone(d, 'sine', 1760, 1700, t, 0.04, 0.03, 0.002);
        break;
      case 'steam':
        this.noiseHit(d, t, 2.6, 0.16, 'highpass', 2400, 5200, 0.7, 0.25);
        this.noiseHit(d, t, 1.2, 0.06, 'lowpass', 400, 200, 1, 0.05);
        break;
      case 'paper':
        for (let i = 0; i < 3; i++) this.noiseHit(d, t + i * 0.07, 0.12, 0.08, 'bandpass', 3000 + i * 600, 1800, 1.2, 0.01);
        break;
      case 'footstep':
        this.noiseHit(d, t, 0.12, 0.06, 'lowpass', 500 + Math.random() * 200, 200, 1, 0.003);
        break;
    }
  }

  /** Inharmonic metallic strike, synchronised with gears and bolts. */
  private metal(d: AudioNode, t: number, f: number, vol: number) {
    for (const r of [1, 2.76, 5.4, 8.93]) this.tone(d, 'sine', f * r, f * r * 0.995, t, 0.9 / Math.sqrt(r), vol / r, 0.002);
    this.noiseHit(d, t, 0.08, vol * 0.6, 'highpass', 2500);
  }

  /** The temporal shift: a folding sweep, upward into the echo, downward back to the present. */
  shift(target: Timeline) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out(undefined, this.sfxBus, 1);
    const up = target === 'echo';
    this.noiseHit(d, t, 1.0, 0.22, 'bandpass', up ? 300 : 2400, up ? 2400 : 300, 4, 0.25);
    this.tone(d, 'sine', up ? 110 : 330, up ? 330 : 110, t, 0.9, 0.12, 0.2);
    this.tone(d, 'sine', 55, 55, t + 0.2, 1.2, 0.18, 0.05);
    this.setTimeline(target);
  }

  shiftBlocked() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out();
    this.tone(d, 'sine', 220, 180, t, 0.25, 0.1);
    this.tone(d, 'sine', 207, 170, t + 0.08, 0.3, 0.08);
  }

  /** Plays a sound signature and returns its pulse timeline (seconds from now) for visual sync. */
  signature(source: SourceId, keepsake: Keepsake | null, pos?: THREE.Vector3): PulseSegment[] {
    const sig = source === 'keepsake' ? (keepsake ? KEEPSAKE_SIGNATURES[keepsake] : null) : SIGNATURES[source];
    if (!sig) return [];
    const segs = signatureTimeline(sig);
    if (!this.ctx) return segs;
    const t0 = this.ctx.currentTime + 0.03;
    const d = this.out(pos, this.sfxBus, 0.5);
    const n = segs.length;
    segs.forEach((s, i) => {
      const t = t0 + s.start;
      const dur = s.end - s.start;
      const step = n > 1 ? i / (n - 1) : 0;
      const contour = sig.contour === 'rising' ? 1 + step * 0.5 : sig.contour === 'falling' ? 1 - step * 0.3 : 1;
      switch (source === 'keepsake' ? keepsake : source) {
        case 'turbine':
          this.tone(d, 'sawtooth', 90 * contour, 170 * contour, t, dur, 0.09, 0.05);
          this.noiseHit(d, t, dur, 0.06, 'bandpass', 600 * contour, 1400 * contour, 2, 0.05);
          break;
        case 'bell':
          this.bell(d, t, 523.3 * contour, dur);
          break;
        case 'drip':
          this.tone(d, 'sine', 1500 * contour, 650 * contour, t, Math.max(dur, 0.12), 0.12, 0.003);
          break;
        case 'relay':
          this.tone(d, 'square', 110, 110, t, dur, 0.035, 0.005);
          this.noiseHit(d, t, dur, 0.12, 'bandpass', 3200, 3200, 1.5, 0.003);
          break;
        case 'compass':
          this.noiseHit(d, t, 0.06, 0.25, 'highpass', 4000);
          this.tone(d, 'sine', 2400 * contour, 2400 * contour, t, 0.08, 0.06, 0.002);
          break;
        case 'hourglass':
          this.noiseHit(d, t, dur, 0.16, 'bandpass', 7000, 2600, 1.2, 0.2);
          break;
      }
    });
    return segs;
  }

  private bell(d: AudioNode, t: number, f: number, dur: number) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 1.4;
    mg.gain.setValueAtTime(f * 2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur + 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    car.connect(g).connect(d);
    car.start(t); mod.start(t);
    car.stop(t + dur + 1); mod.stop(t + dur + 1);
  }

  /** Intro: distant machinery, then a vibration that slowly rises. */
  intro() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out(undefined, this.sfxBus, 1);
    for (let i = 0; i < 5; i++) this.metal(d, t + 0.4 + i * 1.3, 60 + i * 7, 0.08);
    this.tone(d, 'sine', 28, 42, t + 2, 6, 0.32, 3);
    this.noiseHit(d, t + 2, 6, 0.12, 'lowpass', 120, 300, 1, 3);
    this.tone(d, 'triangle', 73.4, 73.4, t + 8, 4, 0.1, 1.5);
  }

  finale() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out(undefined, this.musicBus, 1.2);
    [65.4, 98, 130.8, 196, 261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(d, i % 2 ? 'triangle' : 'sine', f, f, t + i * 0.45, 9 - i * 0.5, 0.07, 1.4));
    this.noiseHit(d, t + 2, 7, 0.08, 'highpass', 3000, 9000, 1, 3);
  }

  /** RMS of the mixed output, for diagnostics and automated tests. */
  level(): number {
    if (!this.ctx || !this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  }

  /** Current gains of the two ambience layers. */
  layers(): { present: number; echo: number; state: string } {
    if (!this.ctx) return { present: 0, echo: 0, state: 'none' };
    return { present: this.presentLayer.gain.value, echo: this.echoLayer.gain.value, state: this.ctx.state };
  }

  dispose() {
    this.timers.forEach((id) => clearTimeout(id));
    void this.ctx?.close();
    this.ctx = null;
  }
}
