import type { Seat } from '../core';

export type OpponentSource = 'easy' | 'external';

export interface ExternalAiPersistedConfig {
  proxyUrl: string;
  model: string;
  /** Opponent seats 1–3; player seat 0 is always human. */
  seatSources: Record<1 | 2 | 3, OpponentSource>;
  disclosureAccepted: boolean;
}

export interface ExternalAiSessionSecrets {
  /** Session-only proxy token; never persisted. */
  proxyToken: string;
}

const STORAGE_KEY = 'mahjong.externalAi.v1';
const TOKEN_KEY = 'mahjong.externalAi.token.v1';

export const DEFAULT_EXTERNAL_AI_CONFIG: ExternalAiPersistedConfig = {
  proxyUrl: '',
  model: '',
  seatSources: { 1: 'easy', 2: 'easy', 3: 'easy' },
  disclosureAccepted: false,
};

export function defaultExternalAiConfig(): ExternalAiPersistedConfig {
  return {
    proxyUrl: '',
    model: '',
    seatSources: { 1: 'easy', 2: 'easy', 3: 'easy' },
    disclosureAccepted: false,
  };
}

/** Strip secrets — safe for logs, saves, and exports. */
export function toExportableExternalAiConfig(
  config: ExternalAiPersistedConfig,
): ExternalAiPersistedConfig {
  return {
    proxyUrl: config.proxyUrl,
    model: config.model,
    seatSources: { ...config.seatSources },
    disclosureAccepted: config.disclosureAccepted,
  };
}

export function loadExternalAiConfig(storage: Storage): ExternalAiPersistedConfig {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return defaultExternalAiConfig();
  try {
    const parsed = JSON.parse(raw) as Partial<ExternalAiPersistedConfig>;
    return normalizeConfig(parsed);
  } catch {
    return defaultExternalAiConfig();
  }
}

export function saveExternalAiConfig(storage: Storage, config: ExternalAiPersistedConfig): void {
  const safe = toExportableExternalAiConfig(config);
  storage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

export function loadProxyToken(sessionStorage: Storage): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveProxyToken(sessionStorage: Storage, token: string): void {
  if (!token) {
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearProxyToken(sessionStorage: Storage): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Assert a serialized blob never embeds the session token. */
export function assertNoTokenLeak(serialized: string, token: string): void {
  if (token && serialized.includes(token)) {
    throw new Error('proxy token must not appear in persisted or exported data');
  }
}

function normalizeConfig(parsed: Partial<ExternalAiPersistedConfig>): ExternalAiPersistedConfig {
  const base = defaultExternalAiConfig();
  const seats = parsed.seatSources ?? base.seatSources;
  return {
    proxyUrl: typeof parsed.proxyUrl === 'string' ? parsed.proxyUrl : '',
    model: typeof parsed.model === 'string' ? parsed.model : '',
    seatSources: {
      1: seats[1] === 'external' ? 'external' : 'easy',
      2: seats[2] === 'external' ? 'external' : 'easy',
      3: seats[3] === 'external' ? 'external' : 'easy',
    },
    disclosureAccepted: Boolean(parsed.disclosureAccepted),
  };
}

export function opponentSeats(): Array<1 | 2 | 3> {
  return [1, 2, 3];
}

export function isOpponentSeat(seat: Seat): seat is 1 | 2 | 3 {
  return seat === 1 || seat === 2 || seat === 3;
}
