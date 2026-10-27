// Contextual puzzle interfaces. Each panel only calls GameLogic actions; it holds no rules itself.

import type { GameLogic } from '../game/logic';
import type { GameState, GlyphId, SourceId } from '../game/types';
import { $, esc } from './hud';
import { glyphSvg, GLYPH_NAMES } from '../world/glyphs';
import { RING_NAMES, STATIONS, stationLabel, canTurnRing, echoRings } from '../game/puzzles/engine';
import { RECORDING, signatureOf, type Signature } from '../game/puzzles/voice';
import { BEARING_FULL, BEARING_NAMES, GLYPH_PALETTE } from '../game/puzzles/parallax';
import { KEEPSAKE_NAME } from '../game/texts';

const RING_LABELS = ['الحلقة الخارجية', 'الحلقة الوسطى', 'الحلقة الداخلية'];
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

function yours(k: GameState['keepsake']): string {
  return k === 'compass' ? 'بوصلتك' : k === 'hourglass' ? 'ساعتك الرملية' : '';
}

export function sigHtml(sig: Signature | null): string {
  if (!sig) return '';
  const arrow = sig.contour === 'rising' ? '↗' : sig.contour === 'falling' ? '↘' : '→';
  return `<span class="sig" aria-label="${esc(describeSignature(sig))}">${sig.rhythm.map((b) => `<i class="${b}"></i>`).join('')}<span class="ct">${arrow}</span></span>`;
}

export function readPanel(title: string, body: string, s: GameState): PanelDef {
  return {
    eyebrow: s.timeline === 'echo' ? 'الصدى · 1956' : 'الحاضر · 2026',
    title,
    render: () => `<span class="tag">${s.timeline === 'echo' ? 'شوهد في الصدى' : 'شوهد في الحاضر'}</span><p class="read">${esc(body)}</p>`,
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
    eyebrow: 'اللغز الثاني · محرّك الذاكرة',
    title: 'لوحة المحرّك',
    render: () => {
      const s = L.state;
      const echo = s.timeline === 'echo';
      const rings = echo ? echoRings() : s.engine.rings;
      let html = `<p>${echo ? 'في الصدى يعمل المحرّك على معايرته الأصلية. أدوات التحكّم مقفلة؛ لا يمكن تحريك الماضي.' : 'ثلاثة أقراص، واحد لكل حلقة. كل خطوة تُدير الحلقة محطّة واحدة باتجاه عقارب الساعة أو عكسه.'}</p>`;
      html += '<div class="rings">' + RING_NAMES.map((_name, i) => {
        const hidden = echo && i === 2;
        const locked = !echo && !canTurnRing(i, s.engine.segmentInstalled);
        const dis = echo || s.engine.solved || locked ? 'disabled' : '';
        return `<div class="ring-row"><div><b>${RING_LABELS[i]}</b><small>${hidden ? 'مخفيّة خلف درع الحاكم' : locked ? 'قطعة مفقودة: لا تدور' : i === 2 && !echo ? 'العلامة ممسوحة؛ القرص ما زال يقرأ' : 'العلامة ظاهرة'}</small></div>
          <button class="step" data-act="turn" data-i="${i}" data-d="-1" ${dis} aria-label="أدِر ${RING_LABELS[i]} إلى الخلف">▶</button>
          <span class="station">${hidden ? '—' : stationLabel(rings[i])}</span>
          <button class="step" data-act="turn" data-i="${i}" data-d="1" ${dis} aria-label="أدِر ${RING_LABELS[i]} إلى الأمام">◀</button></div>`;
      }).join('') + '</div>';
      html += dialSvg(rings, echo);
      if (!echo && !s.engine.segmentInstalled) {
        html += L.has('ring-segment') ? '<div class="row"><button class="btn primary" data-act="install">ركّب قطعة الحلقة</button></div>' : '<div class="status">في الحلقة الخارجية فجوة حيث ينبغي أن تكون قطعة.</div>';
      }
      if (!echo && !s.engine.solved) html += '<div class="row"><button class="btn primary" data-act="engage">اسحب ذراع المعايرة</button></div>';
      if (s.engine.solved) html += '<div class="status good">تمّت المعايرة. بوّابة الجسر مفتوحة.</div>';
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
  let s = `<svg class="dial" viewBox="0 0 220 220" role="img" aria-label="مواضع الحلقات"><circle cx="110" cy="110" r="104" fill="none" stroke="#8a713f" stroke-width="1.5"/>`;
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
    eyebrow: 'اللغز الرابع · الصوت الذي وصل مبكرًا',
    title: 'لوحة التسجيل',
    render: () => {
      const s = L.state;
      if (s.voice.solved) return '<div class="status good">أجابت القاعة التسجيل. لوحة التوجيه مستيقظة.</div><p>توقّفت البكرة. على ملصقها رُسمت موجة.</p>';
      let html = '<p>بكرة مكتوب عليها <i>«إلى من يأتي بعدي»</i>. تحمل خمسة أصوات قصيرة. أدخِل مصادرها بالترتيب الذي تعزفها به البكرة.</p>';
      html += `<div class="row"><button class="btn primary" data-act="play" ${state.playing ? 'disabled' : ''}>${state.playing ? 'يُشغَّل…' : s.voice.heardRecording ? 'شغّل التسجيل مرّة أخرى' : 'شغّل التسجيل'}</button></div>`;
      html += '<div class="transcript" aria-label="نصّ التسجيل">' + RECORDING.map((src, i) => {
        const sig = signatureOf(src, s.keepsake);
        const show = s.voice.heardRecording || state.lit >= i;
        return `<div class="tcell ${state.lit === i ? 'lit' : ''}"><span class="n">${i + 1}</span>${show ? sigHtml(sig) : ''}</div>`;
      }).join('') + '</div>';
      const sources = L.voiceSources();
      html += '<span class="eyebrow">الأصوات المعروفة</span><div class="sources">';
      html += sources.length
        ? sources.map((src) => {
            const sig = signatureOf(src, s.keepsake);
            const name = src === 'keepsake' ? yours(s.keepsake) : sig?.name ?? src;
            return `<button class="source" data-act="press" data-src="${src}"><span>${esc(name)}</span>${sigHtml(sig)}</button>`;
          }).join('')
        : '<p class="empty">لم تستمع إلى أي شيء في القاعة بعد. قِف بجانب آلة واستمع. بعضها لا يعمل إلا في الصدى.</p>';
      html += '</div>';
      html += '<span class="eyebrow">إجابتك</span><div class="slots">' + [0, 1, 2, 3, 4].map((i) => {
        const src = s.voice.input[i];
        const sig = src ? signatureOf(src, s.keepsake) : null;
        return `<span class="${src ? 'filled' : ''}">${src ? esc(src === 'keepsake' ? yours(s.keepsake) : sig!.name) : i + 1}</span>`;
      }).join('') + '</div>';
      html += `<div class="row"><button class="btn small" data-act="clear" ${s.voice.input.length ? '' : 'disabled'}>امسح</button></div>`;
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
    eyebrow: 'اللغز الخامس · البارالاكس الأخير',
    title: 'لوحة التوجيه',
    render: () => {
      const s = L.state;
      const p = s.parallax;
      let html = '<p>توجّه هذه اللوحة المحرّك عبر الهوّة. تجويف للنواة، وأربع خانات للرموز، وعجلة اتجاه، وذراع واحدة.</p>';
      // core
      html += '<span class="eyebrow">النواة</span>';
      html += p.coreInserted
        ? `<div class="status good">${esc(s.keepsake ? KEEPSAKE_NAME[s.keepsake] : '')} في النواة.</div>`
        : s.keepsake && L.has(s.keepsake)
          ? `<div class="row"><button class="btn" data-act="core">ضع ${esc(KEEPSAKE_NAME[s.keepsake])} في النواة</button></div>`
          : '<div class="status">النواة فارغة.</div>';
      // symbols
      html += '<span class="eyebrow">الرموز</span><div class="gslots">' + p.sequence.map((g, i) => `<button class="gslot ${ui.slot === i ? 'sel' : ''}" data-act="slot" data-i="${i}" aria-label="الخانة ${i + 1}${g ? ': ' + GLYPH_NAMES[g] : ''}"><span class="n">${i + 1}</span>${g ? glyphSvg(g, 'glyph big') : ''}</button>`).join('') + '</div>';
      html += '<div class="palette">' + GLYPH_PALETTE.map((g) => `<button data-act="glyph" data-g="${g}" aria-label="${GLYPH_NAMES[g]}" title="${GLYPH_NAMES[g]}">${glyphSvg(g)}</button>`).join('') + '</div>';
      // bearing
      html += `<span class="eyebrow">الاتجاه</span><div class="bearing" dir="ltr"><button class="step" data-act="bear" data-d="-1" aria-label="أدِر المحرّك عكس عقارب الساعة">↺</button>${roseSvg(p.bearing)}<button class="step" data-act="bear" data-d="1" aria-label="أدِر المحرّك باتجاه عقارب الساعة">↻</button></div>`;
      html += `<p style="text-align:center">المحرّك يواجه <b>${BEARING_FULL[p.bearing]}</b>${s.timeline === 'echo' ? ' — في الصدى لا يقبل التوجيه' : ''}.</p>`;
      html += '<div class="row"><button class="btn primary" data-act="activate">اسحب ذراع البارالاكس</button></div>';
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
  let s = '<svg class="rose" viewBox="0 0 160 160" role="img" aria-label="وردة الاتجاهات"><circle cx="80" cy="80" r="62" fill="none" stroke="#8a713f"/>';
  BEARING_NAMES.forEach((n, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const on = i === bearing;
    s += `<text x="${80 + Math.cos(a) * 74}" y="${84 + Math.sin(a) * 74}" font-size="${on ? 13 : 10}" text-anchor="middle" fill="${on ? '#ffb45e' : '#c9a45c'}">${n}</text>`;
  });
  const a = (bearing / 8) * Math.PI * 2 - Math.PI / 2;
  s += `<line x1="80" y1="80" x2="${80 + Math.cos(a) * 54}" y2="${80 + Math.sin(a) * 54}" stroke="#8ff0ff" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="80" r="6" fill="#c9a45c"/></svg>`;
  return s;
}
