// The five symbols of the Memory Engine, drawn once as vector paths and used both on canvas
// textures in the world and as inline SVG in the interface.

import type { GlyphId } from '../game/types';

/** SVG path data in a 100×100 box. */
export const GLYPH_PATHS: Record<GlyphId, string> = {
  eye: 'M8 50 L30 32 L30 68 Z M50 34 A16 16 0 1 1 49.9 34 Z M92 50 L70 32 L70 68 Z',
  orbit: 'M50 10 A40 40 0 1 1 49.9 10 Z M50 26 A24 24 0 1 1 49.9 26 Z M50 42 A8 8 0 1 1 49.9 42 Z',
  span: 'M10 78 L90 78 M18 78 Q50 18 82 78 M50 40 L50 78',
  wave: 'M8 50 Q20 22 32 50 T56 50 T80 50 T92 44',
  key: 'M30 50 A14 14 0 1 1 29.9 50 Z M44 50 L90 50 M78 50 L78 62 M88 50 L88 60',
  crown: 'M14 74 L22 30 L38 54 L50 22 L62 54 L78 30 L86 74 Z',
};

export const GLYPH_NAMES: Record<GlyphId, string> = {
  eye: 'Eye', orbit: 'Orbit', span: 'Span', wave: 'Wave', key: 'Key', crown: 'Crown',
};

export function glyphSvg(id: GlyphId, cls = 'glyph'): string {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="${GLYPH_PATHS[id]}"/></svg>`;
}

export function drawGlyph(g: CanvasRenderingContext2D, id: GlyphId, x: number, y: number, size: number, color: string, width = 4, fill = false) {
  g.save();
  g.translate(x, y);
  g.scale(size / 100, size / 100);
  const p = new Path2D(GLYPH_PATHS[id]);
  g.strokeStyle = color;
  g.lineWidth = (width * 100) / size;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (fill) {
    g.fillStyle = color;
    g.fill(p);
  }
  g.stroke(p);
  g.restore();
}
