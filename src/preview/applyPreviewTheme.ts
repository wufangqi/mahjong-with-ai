import * as THREE from 'three';
import { FONT_SERIF } from '../fonts/families';
import { blendSkyColumn } from '../theme/skyBlend';
import type { ThemeId, ThemeModules } from '../theme/types';
import { visualRandom } from '../visual/rng';
import { setTileBackAppearance } from './tiles';

export type PreviewThemeTargets = {
  scene: THREE.Scene;
  feltMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
};

function channel(hex: number, shift: number): number {
  return (hex >> shift) & 0xff;
}

function mixHex(hex: number, toward: number, t: number): number {
  const r = Math.round(channel(hex, 16) + (channel(toward, 16) - channel(hex, 16)) * t);
  const g = Math.round(channel(hex, 8) + (channel(toward, 8) - channel(hex, 8)) * t);
  const b = Math.round(channel(hex, 0) + (channel(toward, 0) - channel(hex, 0)) * t);
  return (r << 16) | (g << 8) | b;
}

function cssHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Build felt CanvasTexture from theme felt + mark (seeded noise via visual RNG). */
export function makeThemedFeltTexture(modules: ThemeModules): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const mid = modules.table.felt;
  const inner = mixHex(mid, 0xffffff, 0.18);
  const outer = mixHex(mid, 0x000000, 0.45);
  const g = ctx.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, cssHex(inner));
  g.addColorStop(0.6, cssHex(mid));
  g.addColorStop(1, cssHex(outer));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (visualRandom() - 0.5) * 18;
    d[i]! += n;
    d[i + 1]! += n;
    d[i + 2]! += n;
  }
  ctx.putImageData(img, 0, 0);
  const mark = cssHex(modules.mark.color);
  ctx.strokeStyle = `${mark}59`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 165, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `${mark}29`;
  ctx.font = `900 150px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(modules.mark.glyph, S / 2, S / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function applySky(scene: THREE.Scene, modules: ThemeModules): void {
  const prev = scene.background;
  if (prev instanceof THREE.Texture) prev.dispose();
  if (modules.sky.kind === 'color') {
    scene.background = new THREE.Color(modules.sky.color);
    return;
  }
  const column = blendSkyColumn(modules.sky, modules.sky, 1, 256);
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = column.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  for (let y = 0; y < column.length; y++) {
    const [r, g, b] = column[y]!;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, 4, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  scene.background = tex;
}

/**
 * Apply ThemeManager modules onto the preview WebGL scene (felt, rails, sky, fog, lights, tile back, banner CSS).
 */
export function applyPreviewTheme(
  modules: ThemeModules,
  targets: PreviewThemeTargets,
  themeId?: ThemeId,
): void {
  const { scene, feltMat, woodMat, hemi, key } = targets;

  const oldMap = feltMat.map;
  feltMat.map = makeThemedFeltTexture(modules);
  feltMat.color.setHex(0xffffff);
  feltMat.needsUpdate = true;
  oldMap?.dispose();

  woodMat.color.setHex(modules.table.rail);
  woodMat.needsUpdate = true;

  applySky(scene, modules);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(modules.fog.color);
    scene.fog.near = modules.fog.near;
    scene.fog.far = modules.fog.far;
  } else {
    scene.fog = new THREE.Fog(modules.fog.color, modules.fog.near, modules.fog.far);
  }

  hemi.color.setHex(modules.lights.hemiSky);
  hemi.groundColor.setHex(modules.lights.hemiGround);
  hemi.intensity = modules.lights.hemiIntensity;
  key.color.setHex(modules.lights.key);
  key.intensity = modules.lights.keyIntensity;

  setTileBackAppearance({
    color: modules.tileBack.color,
    pattern: modules.tileBack.pattern,
  });

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--banner-basic', modules.palette.bannerBasic);
    document.documentElement.style.setProperty('--banner-big', modules.palette.bannerBig);
    document.documentElement.style.setProperty('--banner-top', modules.palette.bannerTop);
    if (themeId) document.body.dataset.theme = themeId;
  }
}
