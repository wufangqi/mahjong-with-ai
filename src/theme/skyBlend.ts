import type { SkyConfig } from './types';

export type Rgb = readonly [number, number, number];

function parseCssColor(css: string): Rgb {
  const hex = css.trim();
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    if (hex.length === 4) {
      const r = parseInt(hex[1]! + hex[1]!, 16);
      const g = parseInt(hex[2]! + hex[2]!, 16);
      const b = parseInt(hex[3]! + hex[3]!, 16);
      return [r, g, b];
    }
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  return [0, 0, 0];
}

function hexToRgb(hex: number): Rgb {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerpChannel(a[0], b[0], t), lerpChannel(a[1], b[1], t), lerpChannel(a[2], b[2], t)];
}

/** Sample sky color at vertical position y in [0,1] (0 = top, 1 = bottom). */
export function sampleSkyRgb(sky: SkyConfig, y: number): Rgb {
  if (sky.kind === 'color') return hexToRgb(sky.color);
  const clamped = Math.min(1, Math.max(0, y));
  const stops = [...sky.stops].sort((a, b) => a.t - b.t);
  if (stops.length === 0) return [0, 0, 0];
  if (clamped <= stops[0]!.t) return parseCssColor(stops[0]!.color);
  if (clamped >= stops[stops.length - 1]!.t) return parseCssColor(stops[stops.length - 1]!.color);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (clamped >= a.t && clamped <= b.t) {
      const u = (clamped - a.t) / (b.t - a.t || 1);
      return lerpRgb(parseCssColor(a.color), parseCssColor(b.color), u);
    }
  }
  return parseCssColor(stops[stops.length - 1]!.color);
}

/** Build a height×1 column of blended sky RGB triples (top→bottom). */
export function blendSkyColumn(from: SkyConfig, to: SkyConfig, t: number, height: number): Rgb[] {
  const rows: Rgb[] = [];
  for (let i = 0; i < height; i++) {
    const y = height <= 1 ? 0 : i / (height - 1);
    rows.push(lerpRgb(sampleSkyRgb(from, y), sampleSkyRgb(to, y), t));
  }
  return rows;
}

export function rgbToHex(rgb: Rgb): number {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}
