import { describe, expect, it } from 'vitest';
import { applyCommand, type Seat } from '../core';
import { createEasyDecisionProvider } from './easy';
import {
  createExternalDecisionProvider,
  createSharedDeadline,
  EXTERNAL_AI_DEADLINE_MS,
} from './external';
import {
  buildExternalPayload,
  EXTERNAL_AI_SENT_FIELDS,
  EXTERNAL_AI_WITHHELD_FIELDS,
} from './payload';
import { buildSeatView, listLegalActions } from './seatView';

type MockResult = {
  status?: number;
  json?: unknown;
  delayMs?: number;
  networkError?: boolean;
};

function mockFetch(handler: (url: string, init?: RequestInit) => MockResult | Promise<MockResult>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const signal = init?.signal;
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const result = await handler(url, init);
    if (result.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), result.delayMs);
        const onAbort = (): void => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });
    }
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    if (result.networkError) {
      throw new TypeError('Failed to fetch');
    }
    const body = JSON.stringify(result.json ?? {});
    return new Response(body, {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

function discardView() {
  const { state } = applyCommand(null, { type: 'StartHand', seed: 11, dealer: 2 as Seat });
  const seat = 2 as Seat;
  const view = buildSeatView(state, seat);
  const legal = listLegalActions(state, seat);
  return { view, legal, drawnId: state.seats[seat].drawn!.id };
}

describe('external AI payload boundary', () => {
  it('includes only seat-visible facts and legal actions', () => {
    const { view, legal } = discardView();
    const payload = buildExternalPayload(view, legal);
    expect(Object.keys(payload).sort()).toEqual([...EXTERNAL_AI_SENT_FIELDS].sort());
    const json = JSON.stringify(payload);
    for (const key of EXTERNAL_AI_WITHHELD_FIELDS) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).not.toContain('"seed"');
    expect(json).not.toContain('"rngState"');
    expect(json).not.toContain('"wall":');
  });
});

describe('external DecisionProvider contract (local mock only)', () => {
  it('returns a legal action from a successful mock completion', async () => {
    const { view, legal, drawnId } = discardView();
    const fetchImpl = mockFetch((_url, init) => {
      const parsed = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const user = JSON.parse(parsed.messages[1]!.content) as { legalActions: unknown[] };
      expect(user.legalActions.length).toBeGreaterThan(0);
      return {
        json: {
          choices: [
            {
              message: {
                content: JSON.stringify({ type: 'Discard', tileId: drawnId }),
              },
            },
          ],
        },
      };
    });

    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      proxyToken: 'session-secret-token',
      timeoutMs: 2000,
      fetchImpl,
    });
    const choice = await provider.choose(view, legal);
    expect(choice).toEqual({ type: 'Discard', tileId: drawnId });
  });

  it('falls back to easy on shared-deadline timeout', async () => {
    const { view, legal, drawnId } = discardView();
    const fetchImpl = mockFetch(async () => ({
      delayMs: 300,
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({ type: 'Discard', tileId: drawnId }),
            },
          },
        ],
      },
    }));

    const easy = createEasyDecisionProvider();
    const expected = await easy.choose(view, legal);
    const { signal, cancel } = createSharedDeadline(80);
    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      timeoutMs: 80,
      fallback: easy,
      fetchImpl,
    });
    const choice = await provider.choose(view, legal, { signal });
    cancel();
    expect(choice).toEqual(expected);
  });

  it('falls back to easy on network failure', async () => {
    const { view, legal } = discardView();
    const easy = createEasyDecisionProvider();
    const expected = await easy.choose(view, legal);
    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      timeoutMs: 200,
      fallback: easy,
      fetchImpl: mockFetch(() => ({ networkError: true })),
    });
    const choice = await provider.choose(view, legal);
    expect(choice).toEqual(expected);
  });

  it('falls back to easy on malformed output', async () => {
    const { view, legal } = discardView();
    const easy = createEasyDecisionProvider();
    const expected = await easy.choose(view, legal);
    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      timeoutMs: 2000,
      fallback: easy,
      fetchImpl: mockFetch(() => ({
        json: { choices: [{ message: { content: 'not-json{{{' } }] },
      })),
    });
    expect(await provider.choose(view, legal)).toEqual(expected);
  });

  it('falls back to easy on illegal action', async () => {
    const { view, legal } = discardView();
    const easy = createEasyDecisionProvider();
    const expected = await easy.choose(view, legal);
    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      timeoutMs: 2000,
      fallback: easy,
      fetchImpl: mockFetch(() => ({
        json: {
          choices: [
            {
              message: {
                content: JSON.stringify({ type: 'Discard', tileId: 'tile-does-not-exist' }),
              },
            },
          ],
        },
      })),
    });
    expect(await provider.choose(view, legal)).toEqual(expected);
  });

  it('runs multi-seat requests in parallel under one shared deadline', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = mockFetch(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 60));
      inFlight -= 1;
      return {
        json: {
          choices: [{ message: { content: JSON.stringify({ type: 'Pass' }) } }],
        },
      };
    });

    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      timeoutMs: 2000,
      fetchImpl,
    });
    const { state } = applyCommand(null, { type: 'StartHand', seed: 7 });
    const views = ([1, 2, 3] as Seat[]).map((seat) => buildSeatView(state, seat));
    const legal = [{ type: 'Pass' as const }];
    const { signal, cancel } = createSharedDeadline(EXTERNAL_AI_DEADLINE_MS);
    const started = Date.now();
    await Promise.all(views.map((view) => provider.choose(view, legal, { signal })));
    const elapsed = Date.now() - started;
    cancel();
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
    expect(elapsed).toBeLessThan(500);
  });

  it('never puts the proxy token into the request JSON body', async () => {
    const token = 'super-secret-session-token';
    const { view, legal, drawnId } = discardView();
    let sawBody = '';
    let sawAuth = '';
    const fetchImpl = mockFetch((_url, init) => {
      sawBody = String(init?.body ?? '');
      const headers = init?.headers as Record<string, string> | undefined;
      sawAuth = headers?.Authorization ?? '';
      return {
        json: {
          choices: [
            {
              message: {
                content: JSON.stringify({ type: 'Discard', tileId: drawnId }),
              },
            },
          ],
        },
      };
    });
    const provider = createExternalDecisionProvider({
      proxyUrl: 'http://127.0.0.1:9',
      model: 'mock-model',
      proxyToken: token,
      timeoutMs: 2000,
      fetchImpl,
    });
    await provider.choose(view, legal);
    expect(sawAuth).toBe(`Bearer ${token}`);
    expect(sawBody).not.toContain(token);
  });
});
