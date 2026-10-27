// Procedural textures: stone, brushed metal, patina and painted signage, all generated on canvases
// so the game ships without any image assets.

import * as THREE from 'three';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(w: number, h: number, draw: Draw, opts: { srgb?: boolean; repeat?: [number, number] } = {}): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

/** Deterministic pseudo-random numbers so textures look the same on every load. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noiseLayer(g: CanvasRenderingContext2D, w: number, h: number, seed: number, count: number, alpha: number, size: number, light = false) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    const s = r() * size + 0.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

/** Weathered stone block wall. */
export function stoneTexture(seed = 1, base = '#1a1c1e') {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    // large tonal blotches
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 60 + r() * 220;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const v = r() < 0.5 ? 0 : 255;
      grd.addColorStop(0, `rgba(${v},${v},${v},${0.035 + r() * 0.04})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    noiseLayer(g, w, h, seed + 1, 26000, 0.12, 2);
    noiseLayer(g, w, h, seed + 2, 9000, 0.06, 2, true);
    // block joints
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 3;
    const rows = 4;
    for (let row = 0; row <= rows; row++) {
      const y = (row / rows) * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      const off = row % 2 ? w / 4 : 0;
      for (let x = off; x < w + 1; x += w / 2) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / rows); g.stroke();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,.04)';
    g.lineWidth = 1;
    for (let row = 0; row <= rows; row++) { const y = (row / rows) * h + 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

/** Floor slabs with brass inlay seams. */
export function floorTexture(seed = 7) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#141617';
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * (w / 4), y = Math.floor(i / 4) * (h / 4);
      const v = 18 + Math.floor(r() * 10);
      g.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      g.fillRect(x + 4, y + 4, w / 4 - 8, h / 4 - 8);
    }
    noiseLayer(g, w, h, seed + 3, 30000, 0.1, 2);
    noiseLayer(g, w, h, seed + 4, 6000, 0.05, 1.5, true);
    g.strokeStyle = 'rgba(176,141,74,.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
  });
}

/** Brushed metal: fine horizontal streaks. */
export function brushedTexture(seed = 11, base = '#8a8580') {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 2200; i++) {
      const y = r() * h, len = 40 + r() * 300, x = r() * w;
      const v = r() < 0.5 ? 0 : 255;
      g.strokeStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.06})`;
      g.lineWidth = r() * 1.5 + 0.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 2); g.stroke();
    }
  });
}

/** Oxidation and grime overlay for the present timeline (alpha texture). */
export function stainTexture(seed = 21) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h * 0.4, len = 80 + r() * 380;
      const grd = g.createLinearGradient(x, y, x, y + len);
      grd.addColorStop(0, `rgba(40,70,58,${0.25 + r() * 0.3})`);
      grd.addColorStop(1, 'rgba(20,30,25,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, 4 + r() * 18, len);
    }
    for (let i = 0; i < 30; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(60,96,80,${0.2 + r() * 0.25})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

/** Font stack for Arabic writing in the world (Jannat LT is loaded before the hall is built). */
export const AR_FONT = '"Jannat LT", "Noto Naskh Arabic", "Geeza Pro", Tahoma, serif';

/** Canvas text direction for a string: right to left whenever it contains Arabic. */
export const textDir = (t: string): CanvasDirection => (/[\u0600-\u06FF]/.test(t) ? 'rtl' : 'ltr');

/** A text panel, used for plaques, holograms and the door message. */
export function textTexture(lines: string[], opts: { w?: number; h?: number; color?: string; bg?: string; font?: string; size?: number; glow?: number; align?: CanvasTextAlign; spacing?: number } = {}) {
  const w = opts.w ?? 1024, h = opts.h ?? 256;
  return canvasTexture(w, h, (g) => {
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    const size = opts.size ?? 54;
    g.font = `${size}px ${opts.font ?? AR_FONT}`;
    g.direction = textDir(lines.join(''));
    g.fillStyle = opts.color ?? '#e9dcb8';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    if (opts.glow) { g.shadowColor = opts.color ?? '#e9dcb8'; g.shadowBlur = opts.glow; }
    const spacing = opts.spacing ?? 1.35;
    const x = g.textAlign === 'left' ? 40 : w / 2;
    lines.forEach((ln, i) => g.fillText(ln, x, h / 2 + (i - (lines.length - 1) / 2) * size * spacing));
  });
}
