/**
 * Offline doubles for the Mercado Libre HTTP calls.
 *
 * `Response` and `Headers` are not reliable in the jsdom test environment, so
 * these build a plain object with just what the client reads. Nothing here ever
 * touches the network, and nothing here holds a credential.
 */

export interface FakeResponseInit {
  readonly status?: number;
  /** Encoded with `JSON.stringify` unless `rawBody` is given. */
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export function fakeResponse(init: FakeResponseInit = {}): Response {
  const status = init.status ?? 200;
  const rawBody =
    init.rawBody ?? (init.body === undefined ? "" : JSON.stringify(init.body));

  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
    text: async () => rawBody,
    json: async () => JSON.parse(rawBody),
  } as unknown as Response;
}

export interface FakeFetch {
  readonly impl: typeof fetch;
  readonly calls: Array<{ readonly url: string; readonly init: RequestInit }>;
}

/** A `fetch` that records its calls and answers with whatever the handler returns. */
export function fakeFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): FakeFetch {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    calls.push({ url, init: init ?? {} });

    return handler(url, init ?? {});
  }) as unknown as typeof fetch;

  return { impl, calls };
}

/** A `fetch` that must never be called: reaching it fails the test loudly. */
export function unreachableFetch(): FakeFetch {
  return fakeFetch(() => {
    throw new Error("the test performed a network call it did not expect");
  });
}
