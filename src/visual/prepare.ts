import { parseVisualConfig, type VisualConfig } from './config';
import { installVisualRng } from './rng';

let prepared: VisualConfig | null = null;

export function getPreparedVisualConfig(): VisualConfig | null {
  return prepared;
}

/**
 * Must run before preview scene module side effects so textures/particles see the seeded RNG
 * and fixed viewport/DPR.
 */
export function prepareVisualMode(search?: string): VisualConfig {
  const cfg = parseVisualConfig(search);
  prepared = cfg;
  if (!cfg.enabled) return cfg;

  installVisualRng(cfg.seed);

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => cfg.dpr,
    });
    // Playwright / headless: force layout size before WebGL init.
    window.resizeTo?.(cfg.width, cfg.height);
    document.documentElement.style.width = `${cfg.width}px`;
    document.documentElement.style.height = `${cfg.height}px`;
    document.body.style.width = `${cfg.width}px`;
    document.body.style.height = `${cfg.height}px`;
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.dataset.visual = '1';
    document.body.dataset.theme = cfg.theme;
  }
  return cfg;
}
