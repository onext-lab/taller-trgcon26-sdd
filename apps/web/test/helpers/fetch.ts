import { vi } from 'vitest';

/**
 * Simulated `fetch` by method and path. Only the network is simulated: everything else is real.
 * Routes are keyed `'METHOD /path'` (the exact URL, query included, so an unexpected parameter is
 * an unmatched call). A request to a route that is not declared is recorded in `unmatched` and
 * rejected with an `Error`.
 */

export type MockReply =
  | { status: number; json?: unknown; text?: string }
  | { networkError: true }
  /** Never answers; rejects with `AbortError` when the request signal aborts. */
  | { hang: true };

export interface RecordedCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export type MockRoute = MockReply | ((call: RecordedCall) => MockReply);

export interface FetchMock {
  calls: RecordedCall[];
  unmatched: RecordedCall[];
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function record(input: RequestInfo | URL, init: RequestInit | undefined): RecordedCall {
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const body = typeof init?.body === 'string' ? init.body : undefined;
  return { method: (init?.method ?? 'GET').toUpperCase(), url: toUrl(input), headers, body };
}

function toResponse(reply: { status: number; json?: unknown; text?: string }): Response {
  const noBody = reply.status === 204 || reply.status === 205 || reply.status === 304;
  if (noBody) return new Response(null, { status: reply.status });
  if (reply.text !== undefined) return new Response(reply.text, { status: reply.status });
  return new Response(JSON.stringify(reply.json ?? null), {
    status: reply.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function hang(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

/** Installs the simulated `fetch` with `vi.stubGlobal`; undo it with `vi.unstubAllGlobals()`. */
export function mockFetch(routes: Record<string, MockRoute>): FetchMock {
  const mock: FetchMock = { calls: [], unmatched: [] };
  const fake = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const call = record(input, init);
    mock.calls.push(call);
    if (init?.signal?.aborted) return Promise.reject(abortError());
    const route = routes[`${call.method} ${call.url}`];
    if (route === undefined) {
      mock.unmatched.push(call);
      return Promise.reject(new Error(`Ruta no simulada: ${call.method} ${call.url}`));
    }
    const reply = typeof route === 'function' ? route(call) : route;
    if ('hang' in reply) return hang(init?.signal);
    if ('networkError' in reply) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(toResponse(reply));
  };
  vi.stubGlobal('fetch', vi.fn(fake));
  return mock;
}
