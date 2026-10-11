import { createEasyDecisionProvider } from './easy';
import { decisionEquals } from './decisionEquals';
import { buildExternalPayload } from './payload';
import { chatCompletionsUrl } from './proxyUrl';
import type { DecisionAction, DecisionProvider, SeatVisibleState } from './types';

export const EXTERNAL_AI_DEADLINE_MS = 20_000;

export interface ExternalAiClientOptions {
  proxyUrl: string;
  model: string;
  /** Session-only; never logged or persisted by this module. */
  proxyToken?: string;
  fetchImpl?: typeof fetch;
  /** Per-call default when no signal is provided. */
  timeoutMs?: number;
  fallback?: DecisionProvider;
}

const SYSTEM_PROMPT =
  'You are a mahjong seat decision agent. Reply with a single JSON object that exactly ' +
  'matches one entry from legalActions. No markdown, no commentary.';

/**
 * OpenAI-compatible DecisionProvider. On timeout, network error, malformed or
 * illegal output, falls back to built-in easy for that action.
 */
export function createExternalDecisionProvider(options: ExternalAiClientOptions): DecisionProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? EXTERNAL_AI_DEADLINE_MS;
  const fallback = options.fallback ?? createEasyDecisionProvider();
  const token = options.proxyToken ?? '';

  return {
    async choose(view, legalActions, opts) {
      if (legalActions.length === 0) {
        return fallback.choose(view, legalActions, opts);
      }

      try {
        const action = await requestExternalAction({
          fetchImpl,
          proxyUrl: options.proxyUrl,
          model: options.model,
          token,
          view,
          legalActions,
          signal: opts?.signal,
          timeoutMs,
        });
        if (!legalActions.some((legal) => decisionEquals(legal, action))) {
          return fallback.choose(view, legalActions, opts);
        }
        return action;
      } catch {
        return fallback.choose(view, legalActions, opts);
      }
    },
  };
}

async function requestExternalAction(args: {
  fetchImpl: typeof fetch;
  proxyUrl: string;
  model: string;
  token: string;
  view: SeatVisibleState;
  legalActions: readonly DecisionAction[];
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<DecisionAction> {
  const payload = buildExternalPayload(args.view, args.legalActions);
  const body = {
    model: args.model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (args.token) {
    headers.Authorization = `Bearer ${args.token}`;
  }

  const localController = new AbortController();
  const timer =
    args.signal === undefined
      ? setTimeout(() => localController.abort(), args.timeoutMs)
      : null;
  if (args.signal?.aborted) {
    localController.abort();
  } else if (args.signal) {
    args.signal.addEventListener('abort', () => localController.abort(), { once: true });
  }

  try {
    const response = await args.fetchImpl(chatCompletionsUrl(args.proxyUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: localController.signal,
    });
    if (!response.ok) {
      throw new Error(`external AI HTTP ${response.status}`);
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('external AI empty content');
    }
    return parseDecisionAction(content);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export function parseDecisionAction(content: string): DecisionAction {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const parsed = JSON.parse(raw) as DecisionAction;
  if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') {
    throw new Error('external AI malformed action');
  }
  return parsed;
}

/** Shared abort signal for a multi-seat response window. */
export function createSharedDeadline(timeoutMs = EXTERNAL_AI_DEADLINE_MS): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) controller.abort();
    },
  };
}
