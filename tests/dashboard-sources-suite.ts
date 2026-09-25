import assert from "node:assert/strict";
import type * as Sources from "../src/components/ui/yayaw-table-dashboard/dashboard-sources";

/** The source loader both editions run through this suite. */
export type DashboardSourcesApi = Pick<
  typeof Sources,
  "createDashboardSourceLoader" | "isDashboardSourceUnavailable"
>;
type Test = (name: string, run: () => void | Promise<void>) => void;

interface FakeSource {
  id: string;
  rows: number;
}

type LoadResult = FakeSource | Sources.DashboardSourceUnavailable;

/** A catalogue whose loads the test settles by hand, counting them. */
function catalogue(answers: Record<string, () => Promise<LoadResult>>) {
  const calls: string[] = [];
  let lists = 0;
  const sources: Sources.DashboardSources<FakeSource> = {
    list: () => {
      lists += 1;
      return Promise.resolve([
        { id: "pages", name: "Pages (catalogue)" },
        { id: "media", name: { en: "Media", fr: "Médias" }, group: "CMS" },
      ]);
    },
    load: (id) => {
      calls.push(id);
      const answer = answers[id];
      return answer
        ? answer()
        : Promise.resolve({
            unavailable: true as const,
            reason: "notFound" as const,
          });
    },
  };
  return { sources, calls, lists: () => lists };
}

const summarize = (id: string, source: FakeSource) => ({
  id,
  name: `${id} (${source.rows} rows)`,
});

function loadingSuite(test: Test, api: DashboardSourcesApi) {
  test("concurrent loads share one request and ready sources stay cached", async () => {
    let release: (value: FakeSource) => void = () => undefined;
    const host = catalogue({
      media: () =>
        new Promise<FakeSource>((resolve) => {
          release = resolve;
        }),
    });
    const loader = api.createDashboardSourceLoader({
      sources: host.sources,
      summarize,
    });
    const changes: string[] = [];
    const stop = loader.subscribe((id) =>
      changes.push(`${id}:${loader.state(id)?.status}`)
    );
    const first = loader.load("media");
    const second = loader.load("media");
    assert.equal(first, second);
    assert.deepEqual(loader.state("media"), { status: "loading" });
    release({ id: "media", rows: 3 });
    const state = await first;
    assert.deepEqual(state, {
      status: "ready",
      source: { id: "media", rows: 3 },
    });
    assert.deepEqual(await loader.load("media"), state);
    assert.deepEqual(host.calls, ["media"]);
    assert.deepEqual(loader.summary("media"), {
      id: "media",
      name: "media (3 rows)",
    });
    assert.deepEqual(changes, ["media:loading", "media:ready"]);
    stop();
    await loader.load("pages");
    assert.deepEqual(changes, ["media:loading", "media:ready"]);
  });

  test("unavailable sources are kept and never asked again", async () => {
    const host = catalogue({
      secret: () =>
        Promise.resolve({
          unavailable: true as const,
          reason: "forbidden" as const,
          message: "Ask an admin.",
        }),
      odd: () =>
        Promise.resolve({
          unavailable: true as const,
          reason: "sideways" as never,
        }),
    });
    const loader = api.createDashboardSourceLoader({
      sources: host.sources,
      summarize,
    });
    const unavailable = {
      status: "unavailable",
      reason: "forbidden",
      message: "Ask an admin.",
    };
    assert.deepEqual(await loader.load("secret"), unavailable);
    assert.deepEqual(await loader.retry("secret"), unavailable);
    assert.deepEqual(await loader.load("secret"), unavailable);
    assert.deepEqual(host.calls, ["secret"]);
    assert.deepEqual(await loader.load("odd"), {
      status: "unavailable",
      reason: "notFound",
    });
    assert.equal(api.isDashboardSourceUnavailable({ unavailable: true }), true);
    assert.equal(
      api.isDashboardSourceUnavailable({ unavailable: "yes" }),
      false
    );
    // Without a catalogue, unknown sources are not found.
    const bare = api.createDashboardSourceLoader<FakeSource>({ summarize });
    assert.deepEqual(await bare.load("x"), {
      status: "unavailable",
      reason: "notFound",
    });
  });

  test("a failed load stays an error until it is retried", async () => {
    let attempts = 0;
    const host = catalogue({
      flaky: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("Network down"))
          : Promise.resolve({ id: "flaky", rows: 1 });
      },
      sync: () => {
        throw new Error("Thrown before any promise");
      },
    });
    const loader = api.createDashboardSourceLoader({
      sources: host.sources,
      summarize,
    });
    const failed = await loader.load("flaky");
    assert.equal(failed.status, "error");
    assert.equal(failed.status === "error" && failed.message, "Network down");
    // Loading again keeps the error: no request storm while it renders.
    assert.equal((await loader.load("flaky")).status, "error");
    assert.equal(attempts, 1);
    assert.deepEqual(await loader.retry("flaky"), {
      status: "ready",
      source: { id: "flaky", rows: 1 },
    });
    assert.equal(attempts, 2);
    const thrown = await loader.load("sync");
    assert.equal(
      thrown.status === "error" && thrown.message,
      "Thrown before any promise"
    );
    assert.equal((await loader.retry("sync")).status, "error");
    assert.deepEqual(host.calls, ["flaky", "flaky", "sync", "sync"]);
  });

  test("tables win over the catalogue, in loads and in the list", async () => {
    const host = catalogue({
      pages: () => Promise.resolve({ id: "pages", rows: 99 }),
    });
    const loader = api.createDashboardSourceLoader({
      sources: host.sources,
      tables: { pages: { id: "pages", rows: 2 } },
      summarize,
    });
    assert.deepEqual(await loader.load("pages"), {
      status: "ready",
      source: { id: "pages", rows: 2 },
    });
    assert.deepEqual(host.calls, []);
    const listed = await loader.list();
    assert.deepEqual(listed, [
      { id: "pages", name: "pages (2 rows)" },
      { id: "media", name: { en: "Media", fr: "Médias" }, group: "CMS" },
    ]);
    // The list is read once.
    await loader.list();
    assert.equal(host.lists(), 1);
    assert.deepEqual(loader.summary("media"), listed[1]);
  });
}

export function dashboardSourcesSuite(test: Test, api: DashboardSourcesApi) {
  loadingSuite(test, api);
}
