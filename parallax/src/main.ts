// PARALLAX: The Room That Remembers — game bootstrap and orchestration.

import * as THREE from 'three';
import { GameLogic } from './game/logic';
import { clearSave, createInitialState, loadGame, saveGame } from './game/state';
import type { GameEvent, GameState, SourceId } from './game/types';
import { POS, SPAWN } from './game/layout';
import { RECORDING, SIGNATURES } from './game/puzzles/voice';
import { ENDING } from './game/texts';
import { buildWorld, type World } from './world/world';
import { createPipeline, detectQuality, type Pipeline } from './world/effects';
import type { Quality } from './world/context';
import { PlayerController } from './player/controller';
import { Director } from './cinema/director';
import { AudioEngine, type PulseSegment } from './audio/audio';
import { $, Hud, esc } from './ui/hud';
import { Panels, enginePanel, parallaxPanel, readPanel, voicePanel, type PanelHooks } from './ui/panels';
import { describeSignature } from './game/logic';

type Mode = 'loading' | 'menu' | 'intro' | 'play' | 'ending' | 'complete';

interface Settings {
  master: number; music: number; ambience: number; sfx: number;
  sensitivity: number; invertY: boolean; captions: boolean; reduceMotion: boolean; quality: Quality | null;
}
const SETTINGS_KEY = 'parallax.settings';
const defaultSettings = (): Settings => ({ master: 0.8, music: 0.55, ambience: 0.8, sfx: 0.85, sensitivity: 1, invertY: false, captions: true, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, quality: null });
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...defaultSettings(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return defaultSettings();
  }
}
function storeSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

class Game {
  mode: Mode = 'loading';
  settings = loadSettings();
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 120);
  pipeline!: Pipeline;
  world!: World;
  logic = new GameLogic();
  controller!: PlayerController;
  director = new Director(this.camera);
  audio = new AudioEngine();
  hud = new Hud();
  panels = new Panels();
  raycaster = new THREE.Raycaster();
  clock = new THREE.Clock();
  target: string | null = null;
  paused = false;
  overlay: 'journal' | 'pause' | 'settings' | null = null;
  private time = 0;
  private ripple = 0;
  private saveTimer = 0;
  private pulseSegs: { src: SourceId; start: number; end: number }[] = [];
  private emitClock = 0;
  private captionUntil = 0;
  private unsub: (() => void) | null = null;
  private voiceUi = { playing: false, lit: -1 };
  private parallaxUi = { slot: 0 };
  private glanceTimer = 0;
  private menuAngle = 0;
  private viewShift = 0;
  /** Debug-only: speeds up simulated time for automated tests on slow software renderers. */
  timeScale = 1;
  private frameMs: number[] = [];
  private frameCount = 0;

  async boot() {
    const forced = new URLSearchParams(location.search).get('quality');
    const quality: Quality = forced === 'low' || forced === 'medium' || forced === 'high' ? forced : this.settings.quality ?? detectQuality();
    this.setLoad(0.15, 'Starting the renderer…');
    await frame();
    try {
      this.setLoad(0.35, 'Assembling the hall…');
      await frame();
      this.pipeline = createPipeline($('view') as HTMLCanvasElement, this.camera, quality, (renderer) => {
        this.world = buildWorld(renderer, quality);
        return this.world.scene;
      });
      this.setLoad(0.7, 'Compiling materials…');
      await frame();
      this.pipeline.renderer.compile(this.world.scene, this.camera);
    } catch (err) {
      console.warn('PARALLAX could not start WebGL', err);
      this.showError(String((err as Error)?.message ?? err));
      return;
    }
    this.controller = new PlayerController(this.camera, $('view'), this.logic);
    this.applySettings();
    this.bindUi();
    this.director.reduceMotion = this.settings.reduceMotion;
    addEventListener('resize', () => this.pipeline.resize());
    this.setLoad(1, 'Ready');
    this.attach(this.logic);
    this.world.ctx.temporal.snap(this.logic.state);
    this.showMenu();
    this.clock.start();
    requestAnimationFrame(this.loop);
    if (new URLSearchParams(location.search).has('debug')) this.exposeDebug();
  }

  private setLoad(p: number, text: string) {
    ($('loadBar') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
    $('loadText').textContent = text;
  }

  private showError(text: string) {
    $('loading').hidden = true;
    $('error').hidden = false;
    $('errorText').textContent = `Your browser could not start the 3D renderer (${text}). Try the low quality mode, or a browser with WebGL enabled.`;
    $('eRetry').onclick = () => {
      this.settings.quality = 'low';
      storeSettings(this.settings);
      location.reload();
    };
  }

  // ---------------------------------------------------------------- menu and flow

  private showMenu() {
    this.mode = 'menu';
    this.controller.enabled = false;
    this.controller.cinematic = true;
    this.hud.show(false);
    $('loading').hidden = true;
    $('complete').hidden = true;
    $('ending').hidden = true;
    $('menu').hidden = false;
    $('mContinue').hidden = !loadGame();
    $('mConfirm').hidden = true;
    for (const name of ['ambient', 'south', 'pedestal', 'center', 'engine', 'north', 'door']) this.world.setSectionPower(name, 1);
    ($(loadGame() ? 'mContinue' : 'mBegin') as HTMLButtonElement).focus();
  }

  private attach(logic: GameLogic) {
    this.unsub?.();
    this.logic = logic;
    if (this.controller) this.controller.logic = logic;
    this.unsub = logic.on((e) => this.onEvent(e));
  }

  private newGame() {
    clearSave();
    this.attach(new GameLogic(createInitialState()));
    this.audio.start();
    this.audio.setTimeline('present');
    this.world.ctx.temporal.snap(this.logic.state);
    this.controller.setPose(SPAWN.x, SPAWN.z, SPAWN.yaw, 0);
    $('menu').hidden = true;
    this.playIntro();
  }

  private continueGame() {
    const saved = loadGame();
    if (!saved) return this.newGame();
    this.attach(new GameLogic(saved));
    this.audio.start();
    this.audio.setTimeline(saved.timeline);
    this.audio.setIntensity(saved.solveOrder.length);
    this.world.ctx.temporal.snap(saved);
    this.controller.setPose(saved.player.x, saved.player.z, saved.player.yaw, saved.player.pitch);
    $('menu').hidden = true;
    this.startPlay();
    this.hud.toast('The hall remembers where you were.', 'info');
  }

  private startPlay() {
    this.mode = 'play';
    document.body.classList.remove('cinematic');
    $('skip').hidden = true;
    this.hud.show(true);
    this.controller.cinematic = false;
    this.controller.enabled = true;
    this.world.engine.redrawHolo(this.logic.state);
    this.refreshHud();
  }

  private playIntro() {
    this.mode = 'intro';
    this.controller.enabled = false;
    this.controller.cinematic = true;
    document.body.classList.add('cinematic');
    $('black').classList.add('on');
    $('skip').hidden = false;
    for (const name of ['ambient', 'south', 'pedestal', 'center', 'engine', 'north', 'door']) this.world.setSectionPower(name, 0);
    this.audio.intro();
    const power = (name: string, to: number, dur = 0.9) => this.tweenPower(name, to, dur);
    const sp = SPAWN;
    this.director.play(
      [
        { t: 0, pos: [0, 11.5, 13.3], look: [0, 7, -2] },
        { t: 2.5, pos: [0, 10.5, 11], look: [0, 6.5, -4] },
        { t: 6.5, pos: [-4.5, 6.5, 2.5], look: [0, 7.2, -4] },
        { t: 9.0, pos: [3.5, 5.5, -6.5], look: [0, 7.2, -4] },
        { t: 11.5, pos: [0.5, 4.2, -9.6], look: [0, 6.6, -24] },
        { t: 13.5, pos: [0.4, 3.0, -2], look: [0, 4.5, -24] },
        { t: 16, pos: [sp.x, 1.65, sp.z], look: [sp.x, 1.6, sp.z - 5] },
      ],
      [
        { t: 1.4, run: () => $('black').classList.remove('on') },
        { t: 2.2, run: () => power('ambient', 1, 2) },
        { t: 2.8, run: () => power('south', 1) },
        { t: 3.6, run: () => power('pedestal', 1) },
        { t: 5.0, run: () => { power('center', 1, 1.6); this.audio.sfx('locks', new THREE.Vector3(0, 7, -4)); this.director.shake(0.04); } },
        { t: 6.0, run: () => power('engine', 1, 2) },
        { t: 8.0, run: () => power('north', 1) },
        { t: 11.2, run: () => power('door', 1, 2.5) },
      ],
      () => {
        for (const name of ['ambient', 'south', 'pedestal', 'center', 'engine', 'north', 'door']) this.world.setSectionPower(name, 1);
        $('black').classList.remove('on');
        this.controller.setPose(sp.x, sp.z, sp.yaw, 0);
        this.logic.addJournal('door', 'The exit door', 'A round door at the far end of the hall. Letters of light above it: YOU HAVE BEEN HERE BEFORE. ONLY THE PRESENT MAY LEAVE.');
        this.startPlay();
      },
    );
  }

  private powerTweens = new Map<string, { from: number; to: number; t: number; dur: number }>();
  private tweenPower(name: string, to: number, dur: number) {
    this.powerTweens.set(name, { from: 0, to, t: 0, dur });
  }

  private startEnding() {
    this.mode = 'ending';
    this.panels.close();
    this.controller.enabled = false;
    this.controller.cinematic = true;
    this.controller.releaseLock();
    document.body.classList.add('cinematic');
    this.hud.show(false);
    this.audio.finale();
    const temporal = this.world.ctx.temporal;
    let flips = 0;
    const flip = setInterval(() => {
      temporal.forceEcho = flips % 2 ? 0.15 : 0.85;
      this.ripple = 1;
      if (++flips > 5) {
        clearInterval(flip);
        temporal.forceEcho = 0.5;
      }
    }, 420);
    const p = this.camera.position.clone();
    this.director.play(
      [
        { t: 0, pos: [p.x, p.y, p.z], look: [0, 7.2, -4] },
        { t: 3, pos: [2.8, 3.3, -16.6], look: [0, 7.6, -4] },
        { t: 7, pos: [0.4, 5.2, -12.8], look: [0, 7.6, -4] },
        { t: 10, pos: [0, 4.6, -19], look: [0, 5.2, -24] },
        { t: 13.5, pos: [0, 5.2, -23.2], look: [0, 5.2, -30] },
      ],
      [
        { t: 2.6, run: () => { this.world.revealWords(true); this.audio.sfx('discover'); } },
        { t: 4.2, run: () => { this.world.burst(new THREE.Vector3(0, 7.2, -3.5), 0xffd49a, 600); this.director.shake(0.08); this.audio.sfx('locks', new THREE.Vector3(0, 7, -4)); } },
        { t: 8.5, run: () => this.audio.sfx('door', new THREE.Vector3(0, 5, -23)) },
        { t: 12.2, run: () => { $('black').classList.add('white', 'on'); } },
      ],
      () => this.showEndingText(),
    );
  }

  private showEndingText() {
    const s = this.logic.state;
    $('ending').hidden = false;
    $('black').classList.remove('on');
    setTimeout(() => $('black').classList.remove('white'), 900);
    const lines = ENDING[s.keepsake ?? 'compass'];
    $('endingLines').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
    const ps = Array.from($('endingLines').children) as HTMLElement[];
    let i = 0;
    let timer = 0;
    const next = () => {
      clearTimeout(timer);
      if (i >= ps.length) return this.showComplete();
      ps.forEach((p, k) => p.classList.toggle('on', k === i));
      i++;
      timer = window.setTimeout(next, 3600 + ps[i - 1].textContent!.length * 25);
    };
    $('endingNext').onclick = next;
    next();
  }

  private showComplete() {
    this.mode = 'complete';
    $('ending').hidden = true;
    $('complete').hidden = false;
    document.body.classList.remove('cinematic');
    const s = this.logic.state;
    const mins = Math.floor(s.stats.playMs / 60000);
    const secs = Math.floor((s.stats.playMs % 60000) / 1000);
    const stat = (k: string, v: string) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
    $('stats').innerHTML = [
      stat('Time', `${mins}:${String(secs).padStart(2, '0')}`),
      stat('Time shifts', String(s.stats.shifts)),
      stat('Interactions', String(s.stats.interactions)),
      stat('Wrong turns', String(s.stats.failures)),
      stat('Clues found', String(s.journal.length)),
      stat('Keepsake', s.keepsake ? s.keepsake[0].toUpperCase() + s.keepsake.slice(1) : '—'),
    ].join('');
    saveGame(s);
    ($('cAgain') as HTMLButtonElement).focus();
  }

  // ---------------------------------------------------------------- events from the rules

  private onEvent(e: GameEvent) {
    const w = this.world;
    switch (e.type) {
      case 'message':
        this.hud.toast(e.text, e.tone);
        break;
      case 'timeline':
        this.audio.shift(e.timeline);
        this.ripple = 1;
        if (this.pipeline.quality === 'low' && !this.settings.reduceMotion) {
          const r = $('ripple');
          r.classList.remove('go');
          void r.offsetWidth;
          r.classList.add('go');
        }
        w.engine.redrawHolo(this.logic.state);
        this.panels.refresh();
        this.save();
        break;
      case 'shift-blocked':
        this.audio.shiftBlocked();
        this.director.shake(0.03);
        break;
      case 'keepsake':
        this.audio.sfx('pickup');
        setTimeout(() => this.audio.signature('keepsake', e.keepsake), 500);
        break;
      case 'item':
        if (e.gained) this.audio.sfx('pickup');
        break;
      case 'journal':
        if (e.entry.glyph) this.audio.sfx('discover');
        break;
      case 'sculpture':
        this.audio.sfx('plate', new THREE.Vector3(POS.sculptures[e.index].x, 1.5, POS.sculptures[e.index].z));
        break;
      case 'shadow-solved':
        this.audio.sfx('solve');
        w.burst(new THREE.Vector3(POS.compartment.x + 0.3, 1.2, POS.compartment.z), 0xffd49a);
        this.glance(new THREE.Vector3(-8.2, 2.1, 7.6), new THREE.Vector3(POS.compartment.x, 1.4, POS.compartment.z), 2.6);
        break;
      case 'segment-installed':
        this.audio.sfx('clank', new THREE.Vector3(0, 7, -4));
        w.engine.redrawHolo(this.logic.state);
        break;
      case 'ring':
        w.engine.redrawHolo(this.logic.state);
        break;
      case 'engine-rejected':
        this.audio.sfx('fail');
        this.audio.sfx('clank', new THREE.Vector3(0, 7, -4));
        this.director.shake(0.05);
        break;
      case 'engine-solved':
        this.audio.sfx('locks', new THREE.Vector3(0, 6, -6));
        setTimeout(() => this.audio.sfx('solve'), 900);
        this.audio.setIntensity(this.logic.state.solveOrder.length);
        this.director.shake(0.07);
        w.burst(new THREE.Vector3(0, 7.2, -3.4), 0x8ff0ff, 360);
        w.engine.redrawHolo(this.logic.state);
        this.glanceAfterPanel(new THREE.Vector3(1.5, 3.2, -3.5), new THREE.Vector3(0, 1.6, -9.3), 2.8);
        break;
      case 'anchor-failed':
        this.audio.sfx('anchorFail', new THREE.Vector3(POS.anchor.x, 1.4, POS.anchor.z));
        break;
      case 'anchored':
        this.audio.sfx('anchor', new THREE.Vector3(0, 0, -12));
        this.director.shake(0.05);
        w.burst(new THREE.Vector3(0, 0.6, -12), 0xffd49a, 300);
        this.glance(new THREE.Vector3(3.2, 3, -7.4), new THREE.Vector3(0, 0, -12.5), 2.8);
        break;
      case 'bridge-crossed':
        w.burst(new THREE.Vector3(0, 5.7, -15.2), 0xffd49a, 160);
        this.audio.setIntensity(this.logic.state.solveOrder.length);
        break;
      case 'voice-rejected':
        this.audio.sfx('fail');
        break;
      case 'voice-solved':
        this.audio.sfx('solve');
        this.audio.setIntensity(this.logic.state.solveOrder.length);
        w.burst(new THREE.Vector3(POS.parallaxConsole.x, 1.6, POS.parallaxConsole.z), 0x22d39a, 240);
        break;
      case 'core-inserted':
        this.audio.sfx('clank', new THREE.Vector3(POS.parallaxConsole.x, 1.2, POS.parallaxConsole.z));
        this.audio.sfx('discover');
        break;
      case 'bearing':
        this.audio.sfx('ring', new THREE.Vector3(0, 7, -4));
        break;
      case 'parallax-rejected':
        this.audio.sfx('fail');
        this.director.shake(0.04);
        break;
      case 'parallax-solved':
        this.save();
        this.startEnding();
        break;
    }
    if (e.type !== 'message') this.refreshHud();
    if (['shadow-solved', 'engine-solved', 'anchored', 'bridge-crossed', 'voice-solved', 'item', 'keepsake'].includes(e.type)) this.save();
  }

  /** A short cinematic look at something that just changed, then control returns. */
  private glance(pos: THREE.Vector3, look: THREE.Vector3, seconds: number) {
    if (this.panels.open || this.mode !== 'play' || this.settings.reduceMotion) return;
    this.controller.cinematic = true;
    this.director.closeUp(pos, look);
    this.glanceTimer = seconds;
  }

  private pendingGlance: [THREE.Vector3, THREE.Vector3, number] | null = null;
  private glanceAfterPanel(pos: THREE.Vector3, look: THREE.Vector3, s: number) {
    if (this.panels.open) this.pendingGlance = [pos, look, s];
    else this.glance(pos, look, s);
  }

  // ---------------------------------------------------------------- interaction

  private interact() {
    if (this.mode !== 'play' || this.panels.open || this.controller.cinematic) return;
    const id = this.target;
    if (!id) return;
    const L = this.logic;
    const info = L.interaction(id);
    if (!info.enabled) {
      this.hud.toast(info.reason ?? '', 'info');
      return;
    }
    L.state.stats.interactions++;
    this.audio.sfx('interact');
    L.state.flags.interacted = true;
    const it = this.world.interactables.get(id);
    if (id.startsWith('keepsake-')) {
      L.chooseKeepsake(id.slice(9) as 'compass' | 'hourglass');
      return;
    }
    if (id.startsWith('sculpture-')) {
      L.rotateSculpture(Number(id.slice(10)));
      return;
    }
    if (id.startsWith('machine-')) {
      const src = id.slice(8) as Exclude<SourceId, 'keepsake'>;
      if (L.registerSource(src).ok) this.emit(src);
      return;
    }
    switch (id) {
      case 'compartment':
        L.takeSegment();
        return;
      case 'anchor':
        L.engageAnchor();
        return;
      case 'engine-console':
        return this.openPanel(enginePanel(this.hooks()), it?.focus);
      case 'voice-console':
        L.listenRecording();
        return this.openPanel(voicePanel(this.hooks(), this.voiceUi), it?.focus);
      case 'parallax-console':
        return this.openPanel(parallaxPanel(this.hooks(), this.parallaxUi), it?.focus);
      default: {
        const r = L.read(id);
        if (!r.body) return;
        this.openPanel(readPanel(r.title, r.body, L.state), it?.focus);
      }
    }
  }

  private hooks(): PanelHooks {
    return {
      logic: this.logic,
      refreshWorld: () => {
        this.panels.refresh();
        this.refreshHud();
        this.world.engine.redrawHolo(this.logic.state);
        this.save();
      },
      playSignature: (src) => {
        this.emit(src, true);
        return 0;
      },
      playRecording: (onStep, onDone) => this.playRecording(onStep, onDone),
      sfx: (name) => this.audio.sfx(name),
    };
  }

  private openPanel(def: Parameters<Panels['show']>[0], focus?: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    this.controller.enabled = false;
    this.controller.releaseLock();
    this.controller.cinematic = true;
    if (focus) this.director.closeUp(focus.pos, focus.look);
    this.hud.prompt(null);
    this.panels.show(def);
    this.panels.onClosed = () => {
      this.director.release(() => {
        if (this.mode !== 'play') return;
        this.controller.cinematic = false;
        this.controller.enabled = !this.overlay;
        if (this.pendingGlance) {
          const [p, l, s] = this.pendingGlance;
          this.pendingGlance = null;
          this.glance(p, l, s);
        }
      });
      if (!focus) this.director.release(() => {});
      if (this.mode === 'play' && !this.overlay) this.controller.requestLock();
    };
  }

  /** Plays a signature, drives its machine lamp and shows a caption. */
  private emit(src: SourceId, local = false) {
    const keepsake = this.logic.state.keepsake;
    const pos = src === 'keepsake' || local ? undefined : this.world.north.machinePos[src as Exclude<SourceId, 'keepsake'>];
    const segs = this.audio.signature(src, keepsake, pos);
    this.addPulses(src, segs);
    if (this.settings.captions) {
      const sig = src === 'keepsake' ? null : SIGNATURES[src];
      const text = sig ? describeSignature(sig) : `Your ${keepsake}`;
      this.hud.caption(`[${text}]`);
      this.captionUntil = this.time + 3;
    }
  }

  private addPulses(src: SourceId, segs: PulseSegment[]) {
    const now = this.time + 0.03;
    for (const s of segs) this.pulseSegs.push({ src, start: now + s.start, end: now + s.end });
  }

  private playRecording(onStep: (i: number) => void, onDone: () => void) {
    let i = 0;
    const step = () => {
      if (i >= RECORDING.length) return onDone();
      const src = RECORDING[i];
      onStep(i);
      const segs = this.audio.signature(src, this.logic.state.keepsake);
      if (this.settings.captions) {
        const sig = src === 'keepsake' ? null : SIGNATURES[src];
        this.hud.caption(`[Recording ${i + 1}/5 — ${sig ? sig.rhythm.map((b) => (b === 'S' ? 'short' : 'long')).join(', ') : 'a sound from your pocket'}]`);
        this.captionUntil = this.time + 2;
      }
      const dur = segs.length ? segs[segs.length - 1].end : 0.5;
      i++;
      setTimeout(step, (dur + 0.9) * 1000);
    };
    this.world.north.playing.value = true;
    setTimeout(() => {
      step();
    }, 300);
    const total = RECORDING.length * 2.4;
    setTimeout(() => (this.world.north.playing.value = false), total * 1000);
  }

  // ---------------------------------------------------------------- UI wiring

  private bindUi() {
    this.controller.onAction = (a) => {
      if (this.mode !== 'play') return;
      if (a === 'interact') this.interact();
      if (a === 'shift') this.logic.shift();
      if (a === 'journal') this.toggleJournal();
      if (a === 'pause') this.openPause();
    };
    this.controller.onStep = () => this.audio.sfx('footstep');
    $('mBegin').onclick = () => {
      this.audio.start();
      if (loadGame()) $('mConfirm').hidden = false;
      else this.newGame();
    };
    $('mBeginYes').onclick = () => this.newGame();
    $('mContinue').onclick = () => this.continueGame();
    $('mSettings').onclick = () => this.openSettings();
    $('btnJournal').onclick = () => this.toggleJournal();
    $('btnPause').onclick = () => this.openPause();
    $('journalClose').onclick = () => this.toggleJournal();
    $('journalTabs').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (b) this.hud.renderJournal(this.logic.state, b.dataset.tab as 'clues');
    });
    $('pResume').onclick = () => this.closeOverlay();
    $('pJournal').onclick = () => { this.closeOverlay(false); this.toggleJournal(); };
    $('pSettings').onclick = () => this.openSettings();
    $('pMenu').onclick = () => { this.save(); this.closeOverlay(false); this.showMenu(); };
    $('pRestart').onclick = () => ($('pConfirm').hidden = false);
    $('pRestartYes').onclick = () => { this.closeOverlay(false); this.newGame(); };
    $('cAgain').onclick = () => { $('complete').hidden = true; this.world.revealWords(false); this.world.ctx.temporal.forceEcho = null; this.newGame(); };
    $('cMenu').onclick = () => { this.world.revealWords(false); this.world.ctx.temporal.forceEcho = null; this.attach(new GameLogic()); this.world.ctx.temporal.snap(this.logic.state); this.showMenu(); };
    $('skip').onclick = () => this.director.skip();
    $('tE').onclick = () => this.interact();
    $('tQ').onclick = () => this.mode === 'play' && this.logic.shift();
    $('tJ').onclick = () => this.toggleJournal();
    $('view').addEventListener('click', () => {
      if (this.mode === 'play' && matchMedia('(pointer: coarse)').matches === false && this.controller.dragLook && !this.panels.open) this.interact();
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.mode === 'intro') { e.preventDefault(); this.director.skip(); }
      if (e.code !== 'Escape') return;
      if (this.mode !== 'play') return;
      if (this.panels.open) { this.panels.close(); return; }
      if (this.overlay === 'settings') { this.openPause(); return; }
      if (this.overlay) { this.closeOverlay(); return; }
      this.openPause();
    });
    addEventListener('keydown', (e) => {
      // the controller already handled this key if it opened the journal on this same press
      if (e.defaultPrevented) return;
      if ((e.code === 'Tab' || e.code === 'KeyJ') && this.overlay === 'journal') { e.preventDefault(); this.toggleJournal(); }
    });
    addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.save(); this.audio.suspend(true); } else if (!this.paused) this.audio.suspend(false);
    });

    // settings
    const bindRange = (id: string, key: 'master' | 'music' | 'ambience' | 'sfx' | 'sensitivity') => {
      const el = $(id) as HTMLInputElement;
      el.value = String(this.settings[key]);
      el.oninput = () => { this.settings[key] = Number(el.value); this.applySettings(); };
    };
    bindRange('sMaster', 'master');
    bindRange('sMusic', 'music');
    bindRange('sAmbience', 'ambience');
    bindRange('sSfx', 'sfx');
    bindRange('sSens', 'sensitivity');
    const bindCheck = (id: string, key: 'invertY' | 'captions' | 'reduceMotion') => {
      const el = $(id) as HTMLInputElement;
      el.checked = this.settings[key];
      el.onchange = () => { this.settings[key] = el.checked; this.applySettings(); };
    };
    bindCheck('sInvert', 'invertY');
    bindCheck('sCaptions', 'captions');
    bindCheck('sMotion', 'reduceMotion');
    const q = $('sQuality') as HTMLSelectElement;
    q.value = this.pipeline.quality;
    q.onchange = () => {
      this.settings.quality = q.value as Quality;
      this.applySettings();
      $('qualityNote').hidden = q.value === this.pipeline.quality;
    };
    $('sReload').onclick = () => { this.save(); location.reload(); };
    $('sDone').onclick = () => (this.mode === 'play' ? this.openPause() : this.closeOverlay());
  }

  private applySettings() {
    storeSettings(this.settings);
    this.audio.setVolumes({ master: this.settings.master, music: this.settings.music, ambience: this.settings.ambience, sfx: this.settings.sfx });
    if (this.controller) Object.assign(this.controller.settings, { sensitivity: this.settings.sensitivity, invertY: this.settings.invertY, reduceMotion: this.settings.reduceMotion });
    this.director.reduceMotion = this.settings.reduceMotion;
  }

  private showOverlay(which: 'journal' | 'pause' | 'settings') {
    for (const id of ['journal', 'pause', 'settings']) $(id).hidden = id !== which;
    this.overlay = which;
    this.controller.enabled = false;
    this.controller.releaseLock();
  }

  private closeOverlay(resume = true) {
    for (const id of ['journal', 'pause', 'settings']) $(id).hidden = true;
    this.overlay = null;
    this.paused = false;
    this.audio.suspend(false);
    $('pConfirm').hidden = true;
    if (resume && this.mode === 'play' && !this.panels.open) {
      this.controller.enabled = true;
      this.controller.requestLock();
    }
  }

  private openPause() {
    if (this.mode !== 'play') return;
    if (this.panels.open) this.panels.close();
    this.paused = true;
    this.showOverlay('pause');
    ($('pResume') as HTMLButtonElement).focus();
  }

  private openSettings() {
    this.showOverlay('settings');
    ($('sDone') as HTMLButtonElement).focus();
  }

  private toggleJournal() {
    if (this.mode !== 'play') return;
    if (this.overlay === 'journal') return this.closeOverlay();
    if (this.panels.open) this.panels.close();
    this.logic.state.flags.openedJournal = true;
    this.hud.renderJournal(this.logic.state);
    this.showOverlay('journal');
  }

  private refreshHud() {
    if (this.mode !== 'play' && this.mode !== 'intro') return;
    this.hud.update(this.logic.state, this.logic.objective());
  }

  private save() {
    if (this.mode === 'play' || this.mode === 'ending' || this.mode === 'complete') saveGame(this.logic.state);
  }

  // ---------------------------------------------------------------- per-frame

  private updateHints() {
    const s = this.logic.state;
    const touch = matchMedia('(pointer: coarse)').matches;
    const dist = Math.hypot(s.player.x - SPAWN.x, s.player.z - SPAWN.z);
    if (dist > 1.5) s.flags.moved = true;
    if (this.panels.open || this.overlay || this.controller.cinematic) return this.hud.hint('', null);
    if (!touch && !this.controller.pointerLocked && !this.controller.dragLook && !s.flags.moved) return this.hud.hint('look', 'Click the view to look around.');
    if (!s.flags.moved) return this.hud.hint('move', touch ? 'Drag on the left to walk, on the right to look.' : 'Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk.');
    if (!s.flags.interacted && this.target) return this.hud.hint('interact', touch ? 'Tap <kbd>E</kbd> to interact.' : 'Press <kbd>E</kbd> to interact.');
    if (s.keepsake && !s.flags.visitedEcho) return this.hud.hint('shift', touch ? 'Tap <kbd>Q</kbd> to shift into the Echo.' : 'Press <kbd>Q</kbd> to shift into the Echo.');
    if (s.flags.visitedEcho && !s.flags.openedJournal && s.journal.length > 2) return this.hud.hint('journal', 'Your journal keeps every clue. Press <kbd>Tab</kbd> or <kbd>J</kbd>.');
    this.hud.hint('', null);
  }

  private autoEmit(dt: number) {
    // machines sound by themselves, in turn, when you are near and in their timeline
    this.emitClock += dt;
    if (this.emitClock < 2.4) return;
    this.emitClock = 0;
    const s = this.logic.state;
    if (!s.engine.solved) return;
    const order: Exclude<SourceId, 'keepsake'>[] = ['turbine', 'drip', 'bell', 'relay'];
    const idx = Math.floor(this.time / 2.4) % order.length;
    const src = order[idx];
    const sig = SIGNATURES[src];
    if (sig.timeline !== s.timeline) return;
    const p = this.world.north.machinePos[src];
    if (Math.hypot(p.x - s.player.x, p.z - s.player.z) > 13) return;
    this.emit(src);
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    this.frameCount++;
    this.frameMs.push(raw * 1000);
    if (this.frameMs.length > 30) this.frameMs.shift();
    const dt = Math.min(0.05, raw) * this.timeScale;
    this.time += dt;
    const s = this.logic.state;
    const playing = this.mode === 'play' && !this.paused;

    for (const [name, tw] of this.powerTweens) {
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      const flicker = u < 1 && Math.random() < 0.25 ? 0.3 : 1;
      this.world.setSectionPower(name, (tw.from + (tw.to - tw.from) * u) * flicker);
      if (u >= 1) this.powerTweens.delete(name);
    }

    if (this.mode === 'menu') {
      this.menuAngle += dt * 0.05;
      const a = this.menuAngle;
      this.camera.position.set(Math.sin(a) * 7.5, 4.6 + Math.sin(a * 0.7) * 0.6, -4 + Math.cos(a) * 9);
      this.camera.lookAt(0, 6.4, -4);
    }

    if (playing && this.overlay === null) {
      this.logic.tick(dt * 1000);
      this.controller.update(dt);
      this.autoEmit(dt);
      if (this.glanceTimer > 0) {
        this.glanceTimer -= dt;
        if (this.glanceTimer <= 0) this.director.release(() => { if (!this.panels.open && this.mode === 'play') this.controller.cinematic = false; });
      }
      // what is under the crosshair
      if (!this.panels.open && !this.controller.cinematic) {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const hit = this.world.pick(this.raycaster);
        this.target = hit?.id ?? null;
        if (this.target) {
          const info = this.logic.interaction(this.target);
          this.hud.prompt(info.enabled ? info.label : `${info.label}${info.reason ? ' — ' + info.reason : ''}`, info.enabled);
        } else this.hud.prompt(null);
      }
      this.updateHints();
      this.saveTimer += dt;
      if (this.saveTimer > 4) { this.saveTimer = 0; this.save(); }
    } else if (this.mode === 'play') {
      this.hud.prompt(null);
    }

    this.director.update(dt);

    // keep the subject of a close-up visible beside the panel
    document.body.classList.toggle('panel-open', this.panels.open);
    const wantShift = this.panels.open && innerWidth > 720 ? Math.min(500, innerWidth) / 2 : 0;
    this.viewShift += (wantShift - this.viewShift) * Math.min(1, dt * 6);
    if (this.viewShift > 0.5) this.camera.setViewOffset(innerWidth, innerHeight, this.viewShift, 0, innerWidth, innerHeight);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();

    // pulses for machine lamps
    const pulses = this.world.north.pulses;
    (Object.keys(pulses) as SourceId[]).forEach((k) => (pulses[k] *= Math.pow(0.02, dt)));
    this.pulseSegs = this.pulseSegs.filter((p) => p.end > this.time - 0.2);
    for (const p of this.pulseSegs) if (this.time >= p.start && this.time <= p.end) pulses[p.src] = 1;
    if (this.captionUntil && this.time > this.captionUntil) { this.hud.caption(null); this.captionUntil = 0; }

    if (this.mode !== 'loading') {
      this.world.update(dt, this.time, s);
      this.audio.updateListener(this.camera);
      const g = this.pipeline.grade;
      this.ripple = Math.max(0, this.ripple - dt * 1.3);
      if (g) {
        g.uniforms.uTime.value = this.time;
        g.uniforms.uEcho.value = this.world.ctx.temporal.echo;
        g.uniforms.uRipple.value = this.settings.reduceMotion ? 0 : this.ripple;
        g.uniforms.uVignette.value = this.mode === 'play' ? 0.32 : 0.55;
        const hp = this.world.engine.heatPoint.clone().project(this.camera);
        const visible = hp.z < 1 && Math.abs(hp.x) < 1.3 && Math.abs(hp.y) < 1.3;
        g.uniforms.uHeatPos.value.set(hp.x * 0.5 + 0.5, hp.y * 0.5 + 0.5);
        g.uniforms.uHeat.value = visible && !this.settings.reduceMotion ? (s.engine.solved ? 0.9 : 0.35) * (0.5 + this.world.ctx.temporal.echo * 0.5) : 0;
      }
      this.pipeline.render(this.world.scene, this.camera);
    }
  };

  // ---------------------------------------------------------------- automation hooks for tests

  private exposeDebug() {
    (window as unknown as Record<string, unknown>).__parallax = {
      game: this,
      state: () => JSON.parse(JSON.stringify(this.logic.state)) as GameState,
      logic: () => this.logic,
      teleport: (x: number, z: number, yaw = 0) => this.controller.setPose(x, z, yaw, 0),
      look: (x: number, y: number, z: number) => {
        const s = this.logic.state;
        const yaw = Math.atan2(-(x - s.player.x), -(z - s.player.z));
        const pitch = Math.atan2(y - 1.65, Math.hypot(x - s.player.x, z - s.player.z));
        this.controller.setPose(s.player.x, s.player.z, yaw, pitch);
      },
      target: () => this.target,
      mode: () => this.mode,
      why: () => ({ paused: this.paused, time: this.time, mode: this.mode, enabled: this.controller.enabled, cinematic: this.controller.cinematic, panel: this.panels.open, overlay: this.overlay, glance: this.glanceTimer, director: this.director.active }),
      ready: () => this.mode === 'play' && this.controller.enabled && !this.controller.cinematic && !this.panels.open && !this.overlay,
      interact: () => this.interact(),
      panelAct: (act: string, data: Record<string, string> = {}) => {
        const el = document.createElement('button');
        Object.assign(el.dataset, data);
        this.panels.current?.on?.(act, el);
      },
      closePanel: () => this.panels.close(),
      skip: () => this.director.skip(),
      renderInfo: () => this.pipeline.renderer.info.render,
      frames: () => this.frameCount,
      frameMs: () => Math.round(this.frameMs.reduce((a, b) => a + b, 0) / Math.max(1, this.frameMs.length)),
      setTimeScale: (k: number) => (this.timeScale = k),
      loadState: (st: GameState) => {
        this.audio.start();
        $('menu').hidden = true;
        this.attach(new GameLogic(st));
        this.world.ctx.temporal.snap(st);
        this.controller.setPose(st.player.x, st.player.z, st.player.yaw, st.player.pitch);
        this.startPlay();
      },
      initialState: () => createInitialState(),
      audioLevel: () => this.audio.level(),
      audioLayers: () => this.audio.layers(),
      fps: () => new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => (++n < 10 ? requestAnimationFrame(tick) : resolve(Math.round((n / (performance.now() - t0)) * 10000) / 10));
        requestAnimationFrame(tick);
      }),
    };
  }
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

new Game().boot().catch((err) => {
  console.error(err);
  $('loading').hidden = true;
  $('error').hidden = false;
  $('errorText').textContent = String(err?.message ?? err);
});
