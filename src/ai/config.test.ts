import { describe, expect, it } from 'vitest';
import {
  assertNoTokenLeak,
  clearProxyToken,
  defaultExternalAiConfig,
  loadExternalAiConfig,
  loadProxyToken,
  saveExternalAiConfig,
  saveProxyToken,
  toExportableExternalAiConfig,
} from './config';
import { isAllowedProxyUrl } from './proxyUrl';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: () => null,
  };
}

describe('external AI config persistence', () => {
  it('persists proxy URL, model, seat sources, and disclosure — not the token', () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const config = defaultExternalAiConfig();
    config.proxyUrl = 'https://proxy.example.com';
    config.model = 'gpt-test';
    config.seatSources[1] = 'external';
    config.disclosureAccepted = true;
    saveExternalAiConfig(local, config);
    saveProxyToken(session, 'session-only-token');

    const loaded = loadExternalAiConfig(local);
    expect(loaded.proxyUrl).toBe('https://proxy.example.com');
    expect(loaded.model).toBe('gpt-test');
    expect(loaded.seatSources[1]).toBe('external');
    expect(loaded.disclosureAccepted).toBe(true);
    expect(JSON.stringify(loaded)).not.toContain('session-only-token');
    expect(loadProxyToken(session)).toBe('session-only-token');

    const exported = toExportableExternalAiConfig(loaded);
    assertNoTokenLeak(JSON.stringify(exported), 'session-only-token');
    assertNoTokenLeak(local.getItem('mahjong.externalAi.v1')!, 'session-only-token');

    clearProxyToken(session);
    expect(loadProxyToken(session)).toBe('');
  });

  it('allows HTTPS always and localhost HTTP only when enabled', () => {
    expect(isAllowedProxyUrl('https://proxy.example.com', { allowHttpLocalhost: false })).toBe(
      true,
    );
    expect(isAllowedProxyUrl('http://evil.example.com', { allowHttpLocalhost: true })).toBe(false);
    expect(isAllowedProxyUrl('http://localhost:8080', { allowHttpLocalhost: true })).toBe(true);
    expect(isAllowedProxyUrl('http://127.0.0.1:9', { allowHttpLocalhost: true })).toBe(true);
    expect(isAllowedProxyUrl('http://localhost:8080', { allowHttpLocalhost: false })).toBe(false);
  });
});
