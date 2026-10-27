// In-game HUD, toasts, captions, onboarding hints and the journal.

import type { GameState, GlyphId, ItemId } from '../game/types';
import { glyphSvg, GLYPH_NAMES } from '../world/glyphs';
import { KEEPSAKE_INFO } from '../game/texts';
import { PUZZLE_GLYPH } from '../game/puzzles/parallax';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const ITEM_INFO: Record<ItemId, { name: string; desc: string }> = {
  compass: KEEPSAKE_INFO.compass,
  hourglass: KEEPSAKE_INFO.hourglass,
  'ring-segment': { name: 'قطعة الحلقة', desc: 'قطعة برونزية مقوّسة مختومة «الخارجية — VIII». مكانها الفجوة في حلقة المحرّك الخارجية.' },
  'anchor-key': { name: 'مفتاح المرساة', desc: 'مفتاح لمرساة الطور.' },
};

export class Hud {
  private lastToast = '';
  private hintKey = '';
  private journalTab: 'clues' | 'items' | 'symbols' = 'clues';

  show(on: boolean) {
    $('hud').hidden = !on;
  }

  update(s: GameState, objective: string) {
    $('objective').textContent = objective;
    const echo = s.timeline === 'echo';
    document.body.classList.toggle('echo', echo);
    $('tlName').textContent = echo ? 'الصدى' : 'الحاضر';
    $('tlYear').textContent = echo ? '1956' : '2026';
    $('timelineInd').style.opacity = s.echoUnlocked ? '1' : '0.35';
    $('journalCount').textContent = String(s.journal.length);
    $('invStrip').innerHTML = s.inventory.map((i) => `<span title="${esc(ITEM_INFO[i].desc)}">${esc(ITEM_INFO[i].name)}</span>`).join('');
  }

  prompt(text: string | null, enabled = true) {
    const p = $('prompt');
    $('crosshair').classList.toggle('on', !!text && enabled);
    if (!text) {
      p.hidden = true;
      return;
    }
    p.hidden = false;
    p.classList.toggle('off', !enabled);
    $('promptText').textContent = text;
  }

  toast(text: string, tone: 'info' | 'warn' | 'good' = 'info') {
    if (!text || text === this.lastToast) return;
    this.lastToast = text;
    setTimeout(() => { if (this.lastToast === text) this.lastToast = ''; }, 1500);
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild?.remove();
    setTimeout(() => el.remove(), 5200);
  }

  caption(text: string | null) {
    const c = $('caption');
    c.hidden = !text;
    if (text) c.textContent = text;
  }

  /** Onboarding: one contextual hint at a time, removed once the player does the thing. */
  hint(key: string, text: string | null) {
    if (key === this.hintKey && text) return;
    this.hintKey = text ? key : '';
    const h = $('hint');
    h.hidden = !text;
    if (text) h.innerHTML = text;
  }

  get currentHint() {
    return this.hintKey;
  }

  renderJournal(s: GameState, tab = this.journalTab) {
    this.journalTab = tab;
    document.querySelectorAll<HTMLButtonElement>('#journalTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('journalBody');
    if (tab === 'clues') {
      body.innerHTML = s.journal.length
        ? s.journal.slice().reverse().map((j) => `<div class="entry"><span class="g">${j.glyph ? glyphSvg(j.glyph, 'glyph big') : ''}</span><b>${esc(j.title)}</b><p>${esc(j.body)}</p></div>`).join('')
        : '<p class="empty">لم يُكتب شيء بعد. ما تكتشفه يُسجَّل هنا تلقائيًا.</p>';
    } else if (tab === 'items') {
      body.innerHTML = s.inventory.length
        ? s.inventory.map((i) => `<div class="entry"><span class="g"></span><b>${esc(ITEM_INFO[i].name)}</b><p>${esc(ITEM_INFO[i].desc)}</p></div>`).join('')
        : '<p class="empty">لا تحمل شيئًا.</p>';
    } else {
      const learned = s.solveOrder.filter((p) => p !== 'parallax').map((p) => PUZZLE_GLYPH[p as keyof typeof PUZZLE_GLYPH]);
      body.innerHTML = learned.length
        ? learned.map((g: GlyphId, i) => `<div class="entry"><span class="g">${glyphSvg(g, 'glyph big')}</span><b>${GLYPH_NAMES[g]}</b><p>تعلّمته ${['أوّلًا', 'ثانيًا', 'ثالثًا', 'رابعًا'][i]}.</p></div>`).join('')
        : '<p class="empty">لا رموز بعد.</p>';
    }
  }
}
