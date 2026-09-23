/**
 * A fake provider for connector suites: records every request and answers
 * from a route function, with a clock whose sleeps advance time instantly.
 */
export interface RecordedRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  url: URL;
}

export type Route = (
  request: RecordedRequest,
  index: number
) => Response | Promise<Response>;

const parseBody = (body: unknown): unknown => {
  if (typeof body !== "string") {
    return body;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

export function fakeServer(route: Route) {
  const requests: RecordedRequest[] = [];
  const fetcher = (input: string | URL | Request, init: RequestInit = {}) => {
    const request: RecordedRequest = {
      url: new URL(input instanceof Request ? input.url : String(input)),
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string> | undefined) },
      body: parseBody(init.body),
    };
    requests.push(request);
    try {
      return Promise.resolve(route(request, requests.length - 1));
    } catch (error) {
      return Promise.reject(error);
    }
  };
  return { fetch: fetcher as typeof fetch, requests };
}

/** Answers each request with the next response; the last one repeats. */
export function sequence(...responses: (() => Response)[]): Route {
  return (_request, index) => {
    const next = responses[Math.min(index, responses.length - 1)];
    if (!next) {
      throw new TypeError("No response");
    }
    return next();
  };
}

export const networkFailure = (): Response => {
  throw new TypeError("fetch failed");
};

export function fakeClock(start = 1_700_000_000_000) {
  const clock = {
    time: start,
    sleeps: [] as number[],
    now: () => clock.time,
    sleep: (milliseconds: number) => {
      clock.sleeps.push(milliseconds);
      clock.time += milliseconds;
      return Promise.resolve();
    },
  };
  return clock;
}

export const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) => Response.json(body, { status, headers });

/** Runs `body` and returns what it threw. */
export async function caught(body: () => Promise<unknown>): Promise<unknown> {
  try {
    await body();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw");
}
