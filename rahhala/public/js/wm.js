// Minimal MDI window manager: draggable, focusable, maximizable, minimizable windows inside the workspace.
import { h } from './core.js';

const wins = new Map();
let z = 100;
let seq = 0;
let cascade = 0;

const workspace = () => document.getElementById('workspace');
const taskbar = () => document.getElementById('taskbar');

/**
 * openWindow({ key, title, width, height, render(win) })
 * If a window with the same key is open it is focused instead of creating a duplicate.
 */
export function openWindow({ key, title, width = 760, height = 520, render, onClose }) {
  if (key && wins.has(key)) {
    const w = wins.get(key);
    w.restore();
    w.focus();
    return w;
  }
  const id = ++seq;
  const ws = workspace();
  const W = Math.min(width, ws.clientWidth - 10);
  const H = Math.min(height, ws.clientHeight - 10);
  const off = (cascade++ % 6) * 26;
  const left = Math.max(5, (ws.clientWidth - W) / 2 - 60 + off);
  const top = Math.max(5, (ws.clientHeight - H) / 2 - 40 + off);

  const titleEl = h('span.t', title);
  const body = h('div.win-body');
  const btnMin = h('button', { title: 'تصغير', 'aria-label': 'تصغير' }, '—');
  const btnMax = h('button.max', { title: 'تكبير', 'aria-label': 'تكبير' }, '▢');
  const btnClose = h('button.close', { title: 'إغلاق', 'aria-label': 'إغلاق' }, '✕');
  const bar = h('div.win-title', titleEl, btnMin, btnMax, btnClose);
  const el = h('div.win', { role: 'dialog', 'aria-label': title, style: { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px' } }, bar, body);
  const task = h('button', title);

  const win = {
    id, key, el, body,
    setTitle(t) { titleEl.textContent = t; task.textContent = t; },
    focus() {
      for (const w of wins.values()) { w.el.classList.add('inactive'); w.task.classList.remove('active'); }
      el.classList.remove('inactive');
      task.classList.add('active');
      el.style.zIndex = ++z;
    },
    close() {
      el.remove();
      task.remove();
      wins.delete(key || id);
      onClose?.();
    },
    minimize() { el.classList.add('hidden'); task.classList.remove('active'); },
    restore() { el.classList.remove('hidden'); },
    task,
  };

  btnClose.addEventListener('click', () => win.close());
  btnMax.addEventListener('click', () => el.classList.toggle('max'));
  btnMin.addEventListener('click', () => win.minimize());
  bar.addEventListener('dblclick', (e) => { if (e.target === bar || e.target === titleEl) el.classList.toggle('max'); });
  el.addEventListener('mousedown', () => win.focus(), true);
  task.addEventListener('click', () => {
    if (el.classList.contains('hidden')) { win.restore(); win.focus(); }
    else if (task.classList.contains('active')) win.minimize();
    else win.focus();
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.target.closest('.modal')) win.close(); });

  // dragging
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || el.classList.contains('max') || window.innerWidth <= 700) return;
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    const move = (ev) => {
      const nx = Math.min(Math.max(ox + ev.clientX - sx, -el.offsetWidth + 80), ws.clientWidth - 80);
      const ny = Math.min(Math.max(oy + ev.clientY - sy, 0), ws.clientHeight - 30);
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });

  wins.set(key || id, win);
  ws.append(el);
  taskbar().append(task);
  win.focus();
  try {
    const r = render(win);
    if (r instanceof Promise) r.catch((err) => body.append(h('p.error', err.message)));
  } catch (err) {
    body.append(h('p.error', err.message));
  }
  setTimeout(() => body.querySelector('input:not([readonly]), select')?.focus(), 30);
  return win;
}

export function closeAll() {
  for (const w of [...wins.values()]) w.close();
}
