import type {
  createMemoryPlanningAdapter,
  loadPlanningSnapshot,
} from "../src/components/ui/yayaw-table/planning/adapter";
import type { calculatePlanning } from "../src/components/ui/yayaw-table/planning/engine";
import type { buildPlanningRows } from "../src/components/ui/yayaw-table/planning/query";
import type { planningTasksFromRows } from "../src/components/ui/yayaw-table/planning/rows";
import type {
  createPlanningSession,
  withPlanningActions,
} from "../src/components/ui/yayaw-table/planning/session";
import type { mountPlanningSurface } from "../src/components/ui/yayaw-table/planning/surface";
import type {
  PlanningSnapshot,
  TablePlanningActions,
} from "../src/components/ui/yayaw-table/planning/types";
import { planningConfig, planningFixture } from "./planning-contract-suite";

interface WorkflowSuite {
  test: (name: string, run: () => unknown | Promise<unknown>) => unknown;
  memory: typeof createMemoryPlanningAdapter;
  calculate: typeof calculatePlanning;
  load: typeof loadPlanningSnapshot;
  session: typeof createPlanningSession;
  wrap: typeof withPlanningActions;
  mount: typeof mountPlanningSurface;
  rows: typeof planningTasksFromRows;
  project: typeof buildPlanningRows;
}
const assert = (value: unknown, message: string): void => {
  if (!value) {
    throw new Error(message);
  }
};
const task = (snapshot: PlanningSnapshot, id: string) => {
  const found = snapshot.tasks.find((item) => item.ref.id === id);
  if (!found) {
    throw new Error(`Task ${id} missing`);
  }
  return found;
};
async function until(predicate: () => unknown): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Expected planning state was not reached");
}
const context = { scopeId: "project", sourceId: "tasks" };
const move = {
  type: "move" as const,
  ref: { source: "tasks", id: "a" },
  days: 1,
};
function selectElement<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing control ${selector}`);
  }
  return element;
}
export function planningWorkflowSuite(api: WorkflowSuite): void {
  const { test, memory, calculate, load, session, wrap, mount, rows } = api;
  test("card projections retain children while Table restores its tree", () => {
    const snapshot = planningFixture();
    task(snapshot, "b").parent = task(snapshot, "a").ref;
    const nested = [
      { ...task(snapshot, "a").record, subRows: [task(snapshot, "b").record] },
    ];
    const getId = (row: Record<string, unknown>) => String(row.id);
    const tree = api.project(nested, snapshot, planningConfig, getId);
    const cards = api.project(nested, snapshot, planningConfig, getId, "flat");
    assert(
      tree.length === 1 && tree[0]?.subRows.length === 1,
      "Table keeps parent and child"
    );
    assert(
      cards.length === 2 && cards.every((row) => row.subRows.length === 0),
      "Kanban and Gallery receive each task exactly once"
    );
  });
  test("record patches preserve identifiers omitted by the common form", () => {
    const snapshot = planningFixture();
    const item = task(snapshot, "a");
    item.record = { ...item.record, id: "a" };
    const result = calculate(
      snapshot,
      [{ type: "record", ref: item.ref, patch: { id: undefined } }],
      planningConfig
    );
    assert(
      task(result.snapshot, "a").record?.id === "a",
      "undefined must not erase the identifier"
    );
    assert(
      result.preview.changes.length === 0,
      "omitted values must not produce writes"
    );
  });
  test("summary finish constraints survive a compressed holiday span", () => {
    const snapshot = planningFixture();
    snapshot.tasks.push({
      ref: { source: "tasks", id: "group" },
      label: "Group",
      start: null,
      end: null,
    });
    task(snapshot, "b").parent = { source: "tasks", id: "group" };
    task(snapshot, "b").start = "2026-09-18";
    task(snapshot, "b").end = "2026-09-21";
    task(snapshot, "a").start = "2026-09-14";
    task(snapshot, "a").end = "2026-09-22";
    const result = calculate(
      snapshot,
      [
        {
          type: "dependency.put",
          dependency: {
            id: "finish-group",
            from: move.ref,
            to: { source: "tasks", id: "group" },
            type: "FF",
          },
        },
      ],
      planningConfig
    );
    assert(
      task(result.snapshot, "group").end === "2026-09-22",
      "Group finish must satisfy the actual bound"
    );
    assert(
      task(result.snapshot, "b").start === "2026-09-21",
      "The child retains two working days"
    );
  });
  test("calendar-day advances differ from successor working-day advances", () => {
    const snapshot = planningFixture();
    task(snapshot, "a").start = task(snapshot, "a").end = "2026-09-21";
    const edge = {
      id: "lag",
      from: move.ref,
      to: { source: "tasks", id: "b" },
      type: "SS" as const,
      lag: -1,
    };
    const civil = calculate(
      snapshot,
      [
        {
          type: "dependency.put",
          dependency: { ...edge, lagUnit: "calendarDays" },
        },
      ],
      planningConfig
    );
    const working = calculate(
      snapshot,
      [
        {
          type: "dependency.put",
          dependency: { ...edge, lagUnit: "workingDays" },
        },
      ],
      planningConfig
    );
    assert(
      task(civil.snapshot, "b").start === "2026-09-21",
      "Sunday constraint advances to Monday"
    );
    assert(
      task(working.snapshot, "b").start === "2026-09-18",
      "One working-day advance lands on Friday"
    );
  });
  test("normalization maps custom columns, subRows and cross-source parents", () => {
    const mapped = rows({
      source: { id: "custom", label: "Custom" },
      gantt: {
        titleColumn: "caption",
        startColumn: "begins",
        endColumn: "ends",
      },
      rows: [
        {
          id: "p",
          caption: "Parent",
          begins: null,
          ends: null,
          subRows: [
            {
              id: "c",
              caption: "Child",
              begins: "2026-09-14",
              ends: "2026-09-15",
            },
          ],
        },
      ],
      getId: (row) => String(row.id),
    });
    assert(
      mapped.tasks[1]?.parent?.id === "p",
      "subRows forms a separate hierarchy"
    );
    assert(
      mapped.tasks[1]?.label === "Child" &&
        mapped.source.fields?.start === "begins",
      "Mappings are reusable by record editing"
    );
    const cross = rows({
      source: mapped.source,
      rows: [{ id: "p" }],
      getId: (row) => row.id,
      getParent: () => ({ source: "another", id: "p" }),
    });
    assert(
      cross.tasks[0]?.parent?.source === "another",
      "Parent identity includes its source"
    );
  });
  test("invalid civil dates and calendars fail before any write", () => {
    for (const date of ["2026-02-30", "", "2026-09-14T00:00:00Z"]) {
      let rejected = false;
      try {
        calculate(
          planningFixture(),
          [{ type: "dates", ref: move.ref, start: date, end: date }],
          planningConfig
        );
      } catch {
        rejected = true;
      }
      assert(rejected, `Reject invalid date ${date}`);
    }
    const snapshot = planningFixture();
    snapshot.calendars.push({ id: "bad", workingDays: [9] });
    let rejected = false;
    try {
      calculate(snapshot, [move], planningConfig);
    } catch {
      rejected = true;
    }
    assert(rejected, "Invalid calendars cannot enter the scheduling engine");
  });
  test("cross-table and group-move flags remain independent", () => {
    const snapshot = planningFixture();
    task(snapshot, "b").ref.source = "releases";
    let rejected = false;
    try {
      calculate(
        snapshot,
        [
          {
            type: "dependency.put",
            dependency: {
              id: "cross",
              from: move.ref,
              to: task(snapshot, "b").ref,
              type: "FS",
            },
          },
        ],
        { ...planningConfig, allowCrossTableDependencies: false }
      );
    } catch {
      rejected = true;
    }
    assert(rejected, "Cross-table flag must reject the edge");
    task(snapshot, "b").parent = move.ref;
    rejected = false;
    try {
      calculate(snapshot, [move], {
        ...planningConfig,
        allowSummaryMove: false,
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "Group movement flag must protect descendants");
  });
  test("loading all graph pages retains constraints outside the first page", async () => {
    const snapshot = planningFixture();
    const store = memory({ snapshot, config: planningConfig });
    const calls: string[] = [];
    const actions: TablePlanningActions = {
      ...store.actions,
      load(input) {
        calls.push(input.cursor ?? "first");
        return Promise.resolve({
          ...snapshot,
          tasks: input.cursor ? [task(snapshot, "b")] : [task(snapshot, "a")],
          complete: Boolean(input.cursor),
          nextCursor: input.cursor ? undefined : "second",
        });
      },
    };
    const result = await load(actions, context);
    assert(
      result.complete && result.tasks.length === 2 && calls.length === 2,
      "Load must resolve the entire graph"
    );
  });
  test("changing revision during graph pagination discards the graph", async () => {
    const snapshot = planningFixture();
    const store = memory({ snapshot, config: planningConfig });
    let rejected = false;
    try {
      await load(
        {
          ...store.actions,
          load(input) {
            return Promise.resolve({
              ...snapshot,
              revision: input.cursor ? "changed" : "r1",
              tasks: [],
              complete: Boolean(input.cursor),
              nextCursor: input.cursor ? undefined : "next",
            });
          },
        },
        context
      );
    } catch {
      rejected = true;
    }
    assert(rejected, "Do not combine graph pages from different revisions");
  });
  test("concurrent atomic commits cannot both consume one revision", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const a = await store.actions.preview({
      ...context,
      revision: "r1",
      mutations: [move],
    });
    const b = await store.actions.preview({
      ...context,
      revision: "r1",
      mutations: [{ ...move, days: 2 }],
    });
    const results = await Promise.all(
      [a, b].map((preview, index) =>
        store.actions.apply({
          ...context,
          revision: "r1",
          previewId: preview.data?.id ?? "",
          idempotencyKey: String(index),
        })
      )
    );
    assert(
      results.filter((result) => result.success).length === 1,
      "Exactly one commit must win"
    );
  });
  test("deleted or inaccessible tasks invalidate previously prepared edits", async () => {
    for (const deleted of [true, false]) {
      const store = memory({
        snapshot: planningFixture(),
        config: planningConfig,
      });
      const plan = await store.actions.preview({
        ...context,
        revision: "r1",
        mutations: [move],
      });
      const changed = store.getSnapshot();
      if (deleted) {
        changed.tasks = changed.tasks.filter((item) => item.ref.id !== "a");
      } else {
        task(changed, "a").editable = false;
      }
      store.replaceSnapshot(changed);
      const result = await store.actions.apply({
        ...context,
        revision: "r1",
        previewId: plan.data?.id ?? "",
        idempotencyKey: "changed",
      });
      assert(
        !result.success,
        "External removal and permission changes cannot reuse a preview"
      );
    }
  });
  test("successor movement cannot grant itself a row permission", async () => {
    const snapshot = planningFixture();
    snapshot.dependencies = [
      {
        id: "a-b",
        from: move.ref,
        to: { source: "tasks", id: "b" },
        type: "FS",
      },
    ];
    const store = memory({ snapshot, config: planningConfig });
    const client = session({
      config: planningConfig,
      actions: store.actions,
      canEditRow: (row) => row.id !== "b" || String(row.start) >= "2026-09-17",
    });
    try {
      await client.load();
      const result = await client.request([move]);
      assert(
        !result.success && result.code === "permission-denied",
        "Check the successor permission before moving its dates"
      );
      assert(
        store.getSnapshot().revision === "r1",
        "A denied successor leaves the whole operation untouched"
      );
    } finally {
      client.dispose();
    }
  });
  test("automatic mode still uses one validated atomic preview", async () => {
    const config = { ...planningConfig, scheduling: "automatic" as const };
    const store = memory({ snapshot: planningFixture(), config });
    const client = session({ config, actions: store.actions });
    await client.load();
    const result = await client.request([move]);
    assert(
      result.success && !client.getState().preview,
      "Automatic mode commits through the same adapter"
    );
    client.dispose();
  });
  test("local parent permissions cannot be bypassed through record fields", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({
      config: planningConfig,
      actions: store.actions,
      canEditRow: (row) => row.id !== "b",
    });
    await client.load();
    const result = await client.request([
      { type: "record", ref: move.ref, patch: { parentId: "b" } },
    ]);
    assert(
      result.code === "permission-denied",
      "Parent permission must be checked even if its dates do not change"
    );
    client.dispose();
  });
  test("an uncertain response retries the same idempotency key", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    let first = true;
    const keys: string[] = [];
    const client = session({
      config: planningConfig,
      actions: {
        ...store.actions,
        async apply(input) {
          keys.push(input.idempotencyKey);
          const result = await store.actions.apply(input);
          if (first) {
            first = false;
            throw new Error("Response lost");
          }
          return result;
        },
      },
    });
    await client.load();
    const pending = client.request([move]);
    await until(() => client.getState().preview);
    await client.apply();
    assert(client.getState().preview, "Uncertain commit remains retryable");
    await client.apply();
    assert(
      (await pending).success && keys[0] === keys[1],
      "Retry must reuse the request identity"
    );
    client.dispose();
  });
  test("inline and bulk actions wait for the shared preview without partial writes", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({ config: planningConfig, actions: store.actions });
    await client.load();
    let raw = 0;
    const actions = wrap(
      {
        update: (_id: string, _patch: Record<string, unknown>) => {
          raw += 1;
          return { success: true };
        },
        bulkUpdate: (_ids: string[], _patch: Record<string, unknown>) => {
          raw += 1;
          return { success: true };
        },
      },
      client
    );
    const pending = actions.bulkUpdate(["a", "b"], {
      start: "2026-09-16",
      end: "2026-09-17",
    });
    await until(() => client.getState().preview);
    assert(
      raw === 0 && task(store.getSnapshot(), "a").start === "2026-09-14",
      "No update occurs before confirmation"
    );
    await client.apply();
    assert(
      (await pending).success &&
        task(store.getSnapshot(), "b").start === "2026-09-16",
      "All rows commit together"
    );
    client.dispose();
  });
  test("native surface supports keyboard move, resize, cancel and apply", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({ config: planningConfig, actions: store.actions });
    await client.load();
    const host = document.createElement("div");
    const overlay = document.createElement("div");
    document.body.append(host, overlay);
    const chart = mount(host, { session: client, mode: "gantt" });
    const dialogs = mount(overlay, { session: client, mode: "overlay" });
    try {
      selectElement<HTMLButtonElement>(
        host,
        'button[aria-label^="Move A:"]'
      ).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      await until(() => client.getState().preview);
      assert(
        overlay.textContent?.includes("2026-09-16"),
        "Preview shows the complete new interval"
      );
      client.cancel();
      assert(
        task(store.getSnapshot(), "a").start === "2026-09-14",
        "Cancel leaves storage untouched"
      );
      selectElement<HTMLButtonElement>(
        host,
        'button[aria-label="Resize end A"]'
      ).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      await until(() => client.getState().preview);
      await client.apply();
      assert(
        task(store.getSnapshot(), "a").end === "2026-09-16",
        "Keyboard resize saves the new end"
      );
    } finally {
      dialogs.destroy();
      chart.destroy();
      client.dispose();
      host.remove();
      overlay.remove();
    }
  });
  test("dependency-only previews show exact changes and preserve invalid drafts", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({ config: planningConfig, actions: store.actions });
    await client.load();
    const host = document.createElement("div");
    document.body.append(host);
    const surface = mount(host, { session: client, mode: "overlay" });
    client.open({ source: "tasks", id: "b" });
    try {
      const source = selectElement<HTMLSelectElement>(
        host,
        'select[data-focus="dependency-source"]'
      );
      const add = Array.from(
        host.querySelectorAll<HTMLButtonElement>("button")
      ).find((button) => button.textContent === "Add dependency");
      assert(add && !add.disabled, "A local predecessor is available");
      source.value = "releases";
      source.dispatchEvent(new Event("change", { bubbles: true }));
      assert(add?.disabled, "An empty source must disable submission");
      source.value = "tasks";
      source.dispatchEvent(new Event("change", { bubbles: true }));
      assert(
        !add?.disabled,
        "Changing back to a populated source re-enables submission"
      );
      const start = selectElement<HTMLInputElement>(
        host,
        'input[data-focus="start-date"]'
      );
      start.value = "2026-09-18";
      selectElement<HTMLFormElement>(host, "form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await until(() => client.getState().error);
      assert(
        selectElement<HTMLInputElement>(host, 'input[data-focus="start-date"]')
          .value === "2026-09-18",
        "Validation errors keep the draft"
      );
      const pending = client.request([
        {
          type: "dependency.put",
          dependency: {
            id: "link-review",
            from: move.ref,
            to: { source: "tasks", id: "b" },
            type: "SS",
            lag: 0,
          },
        },
      ]);
      await until(() => client.getState().preview);
      assert(
        host.textContent?.includes("tasks/a → tasks/b · SS"),
        "Relation-only changes remain reviewable"
      );
      client.cancel();
      await pending;
    } finally {
      surface.destroy();
      client.dispose();
      host.remove();
    }
  });
  test("disabled date editing removes drag and resize behavior", async () => {
    const config = { ...planningConfig, allowDateEdit: false };
    const store = memory({ snapshot: planningFixture(), config });
    const client = session({ config, actions: store.actions });
    await client.load();
    const host = document.createElement("div");
    document.body.append(host);
    const surface = mount(host, { session: client, mode: "gantt" });
    try {
      assert(
        !host.querySelector('[aria-label="Resize end A"]'),
        "Resize is unavailable"
      );
      selectElement<HTMLButtonElement>(
        host,
        'button[aria-label^="Move A:"]'
      ).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
      assert(!client.getState().preview, "Keyboard cannot bypass the flag");
    } finally {
      surface.destroy();
      client.dispose();
      host.remove();
    }
  });
  test("week origin and link visibility change presentation only", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({ config: planningConfig, actions: store.actions });
    await client.load();
    const host = document.createElement("div");
    document.body.append(host);
    const views: unknown[] = [];
    const surface = mount(host, {
      session: client,
      mode: "gantt",
      onViewChange: (view) => views.push(view),
    });
    try {
      surface.update({
        session: client,
        mode: "gantt",
        gantt: { weekStartsOn: 0, showDependencies: false },
      });
      assert(
        views.length === 0 && store.getSnapshot().revision === "r1",
        "Presentation never writes to the planning adapter"
      );
    } finally {
      surface.destroy();
      client.dispose();
      host.remove();
    }
  });
  test("timeline date markers follow navigation without changing the planning", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const client = session({ config: planningConfig, actions: store.actions });
    await client.load();
    const host = document.createElement("div");
    document.body.append(host);
    const surface = mount(host, { session: client, mode: "gantt" });
    const before = JSON.stringify(store.getSnapshot());
    try {
      selectElement<HTMLButtonElement>(host, '[data-focus="today"]').click();
      const current = selectElement<HTMLElement>(host, '[aria-current="date"]');
      assert(
        current.title === new Date().toISOString().slice(0, 10),
        "Today identifies the current civil date"
      );
      const marker = selectElement<HTMLElement>(host, ".yp-today-line");
      assert(
        Number.parseFloat(marker.style.left) ===
          Number.parseFloat(current.style.left) +
            Number.parseFloat(current.style.width) / 2,
        "The date marker stays centered beneath its header"
      );
      selectElement<HTMLButtonElement>(
        host,
        '[aria-label="Next period"]'
      ).click();
      assert(
        !(
          host.querySelector('[aria-current="date"]') ||
          host.querySelector(".yp-today-line")
        ),
        "A future window does not show a misleading today marker"
      );
      assert(
        JSON.stringify(store.getSnapshot()) === before,
        "Navigating the visual markers never mutates planning dates"
      );
    } finally {
      surface.destroy();
      client.dispose();
      host.remove();
    }
  });
  test("sessions isolate drafts and refresh only their application scope", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    let refreshed = 0;
    const a = session({ config: planningConfig, actions: store.actions });
    const b = session({
      config: planningConfig,
      actions: store.actions,
      onChanged: () => {
        refreshed += 1;
      },
    });
    a.connect();
    b.connect();
    await until(() => !(a.getState().busy || b.getState().busy));
    const pending = a.request([move]);
    await until(() => a.getState().preview);
    assert(!b.getState().preview, "Drafts never cross instance boundaries");
    await a.apply();
    await pending;
    await until(() => !b.getState().busy);
    assert(
      refreshed === 1 &&
        task(b.getState().snapshot as PlanningSnapshot, "a").start ===
          "2026-09-15",
      "Committed sources refresh peer instances"
    );
    a.dispose();
    b.dispose();
  });
}
