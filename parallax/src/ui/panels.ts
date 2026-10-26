// Contextual puzzle interfaces. Each panel only calls GameLogic actions; it holds no rules itself.

import type { GameLogic } from '../game/logic';
import type { GameState, GlyphId, SourceId } from '../game/types';
import { $, esc } from './hud';
import { glyphSvg, GLYPH_NAMES } from '../world/glyphs';
import { RING_NAMES, STATIONS, stationLabel, canTurnRing, echoRings } from '../game/puzzles/engine';
import { RECORDING, signatureOf, type Signature } from '../game/puzzles/voice';
import { BEARING_NAMES, GLYPH_PALETTE } from '../game/puzzles/parallax';
import { describeSignature } from '../game/logic';

export interface PanelDef {
  eyebrow: string;
  title: string;
  render: () => string;
  on?: (act: string, el: HTMLElement) => void;
  onClose?: () => void;
}

export class Panels {
  current: PanelDef | null = null;
  onClosed: () => void = () => {};

  constructor() {
    $('panelBody').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || !this.current?.on || (el as HTMLButtonElement).disabled) return;
      this.current.on(el.dataset.act!, el);
    });
    $('panelClose').addEventListener('click', () => this.close());
  }

  get open() {
    return !!this.current;
  }

  show(def: PanelDef) {
    this.current = def;
    $('panelEyebrow').textContent = def.eyebrow;
    $('panelTitle').textContent = def.title;
    $('panel').hidden = false;
    this.refresh();
    setTimeout(() => $('panelClose').focus({ preventScroll: true }), 30);
  }

  refresh() {
    if (!this.current) return;
    const body = $('panelBody');
    const top = body.scrollTop;
    body.innerHTML = this.current.render();
    body.scrollTop = top;
  }

  close() {
    if (!this.current) return;
    const def = this.current;
    this.current = null;
    $('panel').hidden = true;
    def.onClose?.();
    this.onClosed();
  }
}

export function sigHtml(sig: Signature | null): string {
  if (!sig) return '';
  const arrow = sig.contour === 'rising' ? '↗' : sig.contour === 'falling' ? '↘' : '→';
  return `<span class="sig" aria-label="${esc(describeSignature(sig))}">${sig.rhythm.map((b) => `<i class="${b}"></i>`).join('')}<span class="ct">${arrow}</span></span>`;
}

export function readPanel(title: string, body: string, s: GameState): PanelDef {
  return {
    eyebrow: s.timeline === 'echo' ? 'Echo · 1956' : 'Present · 2026',
    title,
    render: () => `<span class="tag">${s.timeline === 'echo' ? 'Seen in the echo' : 'Seen in the present'}</span><p class="read">${esc(body)}</p>`,
  };
}

export interface PanelHooks {
  logic: GameLogic;
  refreshWorld: () => void;
  playSignature: (src: SourceId) => number;
  playRecording: (onStep: (i: number) => void, onDone: () => void) => void;
  sfx: (name: 'ring' | 'click' | 'clank') => void;
}

export function enginePanel(h: PanelHooks): PanelDef {
  const L = h.logic;
  return {
    eyebrow: 'Puzzle B · Memory Engine',
    title: 'Engine console',
    render: () => {
      const s = L.state;
      const echo = s.timeline === 'echo';
      const rings = echo ? echoRings() : s.engine.rings;
      let html = `<p>${echo ? 'In the echo the engine runs on its original calibration. Its controls are locked; the past cannot be moved.' : 'Three dials, one for each ring. Each step turns a ring one station clockwise or back.'}</p>`;
      html += '<div class="rings">' + RING_NAMES.map((name, i) => {
        const hidden = echo && i === 2;
        const locked = !echo && !canTurnRing(i, s.engine.segmentInstalled);
        const dis = echo || s.engine.solved || locked ? 'disabled' : '';
        return `<div class="ring-row"><div><b>${name[0].toUpperCase() + name.slice(1)} ring</b><small>${hidden ? 'Hidden behind the governor shield' : locked ? 'Missing segment: cannot turn' : i === 2 && !echo ? 'Marker scraped away; dial still reads' : 'Marker visible'}</small></div>
          <button class="step" data-act="turn" data-i="${i}" data-d="-1" ${dis} aria-label="Turn ${name} ring back">◀</button>
          <span class="station">${hidden ? '—' : stationLabel(rings[i])}</span>
          <button class="step" data-act="turn" data-i="${i}" data-d="1" ${dis} aria-label="Turn ${name} ring forward">▶</button></div>`;
      }).join('') + '</div>';
      html += dialSvg(rings, echo);
      if (!echo && !s.engine.segmentInstalled) {
        html += L.has('ring-segment') ? '<div class="row"><button class="btn primary" data-act="install">Fit the ring segment</button></div>' : '<div class="status">The outer ring has a gap where a segment should be.</div>';
      }
      if (!echo && !s.engine.solved) html += '<div class="row"><button class="btn primary" data-act="engage">Pull the calibration lever</button></div>';
      if (s.engine.solved) html += '<div class="status good">Calibrated. The gate to the bridge is open.</div>';
      return html;
    },
    on: (act, el) => {
      if (act === 'turn') {
        const r = L.turnRing(Number(el.dataset.i), Number(el.dataset.d) as 1 | -1);
        if (r.ok) h.sfx('ring');
      }
      if (act === 'install') L.installSegment();
      if (act === 'engage') L.engageEngine();
      h.refreshWorld();
    },
  };
}

function dialSvg(rings: number[], echo: boolean): string {
  const col = echo ? '#ffb45e' : '#8ff0ff';
  const radii = [86, 64, 42];
  let s = `<svg class="dial" viewBox="0 0 220 220" role="img" aria-label="Ring positions"><circle cx="110" cy="110" r="104" fill="none" stroke="#8a713f" stroke-width="1.5"/>`;
  for (let k = 0; k < STATIONS; k++) {
    const a = (k / STATIONS) * Math.PI * 2 - Math.PI / 2;
    s += `<text x="${110 + Math.cos(a) * 100}" y="${113 + Math.sin(a) * 100}" fill="#c9a45c" font-size="10" text-anchor="middle" font-family="Georgia">${stationLabel(k)}</text>`;
  }
  rings.forEach((st, i) => {
    const r = radii[i];
    s += `<circle cx="110" cy="110" r="${r}" fill="none" stroke="rgba(233,227,212,.25)" stroke-width="10"/>`;
    if (echo && i === 2) {
      s += `<circle cx="110" cy="110" r="${r}" fill="rgba(40,32,20,.9)" stroke="#5a4a2a" stroke-dasharray="6 5"/>`;
      return;
    }
    const a = (st / STATIONS) * Math.PI * 2 - Math.PI / 2;
    s += `<circle cx="${110 + Math.cos(a) * r}" cy="${110 + Math.sin(a) * r}" r="6" fill="${col}"/>`;
  });
  return s + '</svg>';
}

export function voicePanel(h: PanelHooks, state: { playing: boolean; lit: number }): PanelDef {
  const L = h.logic;
  return {
    eyebrow: 'Puzzle D · The voice that arrived early',
    title: 'Recording console',
    render: () => {
      const s = L.state;
      if (s.voice.solved) return '<div class="status good">The hall has answered the recording. The steering console is awake.</div><p>The reel has stopped. A wave is drawn on its label.</p>';
      let html = '<p>A reel labelled <i>FOR WHOEVER COMES NEXT</i>. It holds five short sounds. Enter the sources in the order the reel plays them.</p>';
      html += `<div class="row"><button class="btn primary" data-act="play" ${state.playing ? 'disabled' : ''}>${state.playing ? 'Playing…' : s.voice.heardRecording ? 'Play the recording again' : 'Play the recording'}</button></div>`;
      html += '<div class="transcript" aria-label="Transcript of the recording">' + RECORDING.map((src, i) => {
        const sig = signatureOf(src, s.keepsake);
        const show = s.voice.heardRecording || state.lit >= i;
        return `<div class="tcell ${state.lit === i ? 'lit' : ''}"><span class="n">${i + 1}</span>${show ? sigHtml(sig) : ''}</div>`;
      }).join('') + '</div>';
      const sources = L.voiceSources();
      html += '<span class="eyebrow">Known sounds</span><div class="sources">';
      html += sources.length
        ? sources.map((src) => {
            const sig = signatureOf(src, s.keepsake);
            const name = src === 'keepsake' ? `Your ${s.keepsake}` : sig?.name ?? src;
            return `<button class="source" data-act="press" data-src="${src}"><span>${esc(name)}</span>${sigHtml(sig)}</button>`;
          }).join('')
        : '<p class="empty">You have not listened to anything in the hall yet. Stand by a machine and listen. Some only run in the echo.</p>';
      html += '</div>';
      html += '<span class="eyebrow">Your answer</span><div class="slots">' + [0, 1, 2, 3, 4].map((i) => {
        const src = s.voice.input[i];
        const sig = src ? signatureOf(src, s.keepsake) : null;
        return `<span class="${src ? 'filled' : ''}">${src ? esc(src === 'keepsake' ? `Your ${s.keepsake}` : sig!.name) : i + 1}</span>`;
      }).join('') + '</div>';
      html += `<div class="row"><button class="btn small" data-act="clear" ${s.voice.input.length ? '' : 'disabled'}>Clear</button></div>`;
      return html;
    },
    on: (act, el) => {
      if (act === 'play' && !state.playing) {
        L.listenRecording();
        state.playing = true;
        state.lit = -1;
        h.playRecording(
          (i) => { state.lit = i; h.refreshWorld(); },
          () => { state.playing = false; state.lit = -1; h.refreshWorld(); },
        );
      }
      if (act === 'press') {
        const src = el.dataset.src as SourceId;
        h.playSignature(src);
        L.pressVoice(src);
      }
      if (act === 'clear') L.clearVoice();
      h.refreshWorld();
    },
  };
}

export function parallaxPanel(h: PanelHooks, ui: { slot: number }): PanelDef {
  const L = h.logic;
  return {
    eyebrow: 'Puzzle E · The final parallax',
    title: 'Steering console',
    render: () => {
      const s = L.state;
      const p = s.parallax;
      let html = '<p>The console steers the engine across the chasm. A socket for the core, four symbol slots, a bearing wheel and one lever.</p>';
      // core
      html += '<span class="eyebrow">Core</span>';
      html += p.coreInserted
        ? `<div class="status good">Your ${esc(s.keepsake ?? '')} sits in the core.</div>`
        : s.keepsake && L.has(s.keepsake)
          ? `<div class="row"><button class="btn" data-act="core">Seat the ${esc(s.keepsake)} in the core</button></div>`
          : '<div class="status">The core is empty.</div>';
      // symbols
      html += '<span class="eyebrow">Symbols</span><div class="gslots">' + p.sequence.map((g, i) => `<button class="gslot ${ui.slot === i ? 'sel' : ''}" data-act="slot" data-i="${i}" aria-label="Slot ${i + 1}${g ? ': ' + GLYPH_NAMES[g] : ''}"><span class="n">${i + 1}</span>${g ? glyphSvg(g, 'glyph big') : ''}</button>`).join('') + '</div>';
      html += '<div class="palette">' + GLYPH_PALETTE.map((g) => `<button data-act="glyph" data-g="${g}" aria-label="${GLYPH_NAMES[g]}" title="${GLYPH_NAMES[g]}">${glyphSvg(g)}</button>`).join('') + '</div>';
      // bearing
      html += `<span class="eyebrow">Bearing</span><div class="bearing"><button class="step" data-act="bear" data-d="-1" aria-label="Turn engine anticlockwise">◀</button>${roseSvg(p.bearing)}<button class="step" data-act="bear" data-d="1" aria-label="Turn engine clockwise">▶</button></div>`;
      html += `<p style="text-align:center">The engine faces <b>${BEARING_NAMES[p.bearing]}</b>${s.timeline === 'echo' ? ' — in the echo it will not be steered' : ''}.</p>`;
      html += '<div class="row"><button class="btn primary" data-act="activate">Pull the parallax lever</button></div>';
      return html;
    },
    on: (act, el) => {
      if (act === 'core') L.insertCore();
      if (act === 'slot') ui.slot = Number(el.dataset.i);
      if (act === 'glyph') {
        L.setGlyph(ui.slot, el.dataset.g as GlyphId);
        ui.slot = (ui.slot + 1) % 4;
        h.sfx('click');
      }
      if (act === 'bear') {
        if (L.turnBearing(Number(el.dataset.d) as 1 | -1).ok) h.sfx('clank');
      }
      if (act === 'activate') L.activateParallax();
      h.refreshWorld();
    },
  };
}

function roseSvg(bearing: number): string {
  let s = '<svg class="rose" viewBox="0 0 160 160" role="img" aria-label="Bearing rose"><circle cx="80" cy="80" r="62" fill="none" stroke="#8a713f"/>';
  BEARING_NAMES.forEach((n, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const on = i === bearing;
    s += `<text x="${80 + Math.cos(a) * 74}" y="${84 + Math.sin(a) * 74}" font-size="${on ? 13 : 10}" text-anchor="middle" fill="${on ? '#ffb45e' : '#c9a45c'}" font-family="Georgia">${n}</text>`;
  });
  const a = (bearing / 8) * Math.PI * 2 - Math.PI / 2;
  s += `<line x1="80" y1="80" x2="${80 + Math.cos(a) * 54}" y2="${80 + Math.sin(a) * 54}" stroke="#8ff0ff" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="80" r="6" fill="#c9a45c"/></svg>`;
  return s;
}
