import type { createMemoryPlanningAdapter } from "../src/components/ui/yayaw-table/planning/adapter";
import type {
  calculatePlanning,
  normalizeGanttView,
  planningTree,
} from "../src/components/ui/yayaw-table/planning/engine";
import type {
  canDeriveRowsPlanning,
  createRowsPlanningAdapter,
} from "../src/components/ui/yayaw-table/planning/rows-adapter";
import type { createPlanningSession } from "../src/components/ui/yayaw-table/planning/session";
import type {
  PlanningDependency,
  PlanningMutation,
  PlanningSnapshot,
  TablePlanningConfig,
} from "../src/components/ui/yayaw-table/planning/types";
import scenarios from "./fixtures/planning.json";

export function planningFixture(): PlanningSnapshot {
  return {
    scopeId: "project",
    revision: "r1",
    complete: true,
    defaultCalendarId: "office",
    sources: [
      {
        id: "tasks",
        label: "Tasks",
        fields: {
          title: "name",
          start: "start",
          end: "end",
          parent: "parentId",
        },
      },
      { id: "releases", label: "Releases" },
    ],
    calendars: [
      { id: "office", workingDays: [1, 2, 3, 4, 5] },
      { id: "always", workingDays: [0, 1, 2, 3, 4, 5, 6] },
    ],
    dependencies: [],
    tasks: ["a", "b"].map((id) => ({
      ref: { source: "tasks", id },
      label: id.toUpperCase(),
      start: "2026-09-14",
      end: "2026-09-15",
      record: {
        id,
        name: id.toUpperCase(),
        start: "2026-09-14",
        end: "2026-09-15",
        parentId: null,
      },
    })),
  };
}
export const planningConfig: TablePlanningConfig = {
  enabled: true,
  scopeId: "project",
  sourceId: "tasks",
};
const edge = (
  type: PlanningDependency["type"] = "FS",
  lag = 0
): PlanningDependency => ({
  id: "a-b",
  from: { source: "tasks", id: "a" },
  to: { source: "tasks", id: "b" },
  type,
  lag,
});
const at = <T>(items: T[], index: number): T => {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`Missing fixture item ${index}`);
  }
  return value;
};
const equal = (actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
};
const throws = (fn: () => unknown, code: string): void => {
  try {
    fn();
  } catch (error) {
    equal((error as { code: string }).code, code);
    return;
  }
  throw new Error(`Expected ${code}`);
};
interface Suite {
  test: (name: string, fn: () => unknown | Promise<unknown>) => unknown;
  calculate: typeof calculatePlanning;
  memory: typeof createMemoryPlanningAdapter;
  tree: typeof planningTree;
  normalizeView: typeof normalizeGanttView;
  session: typeof createPlanningSession;
  rowsAdapter: typeof createRowsPlanningAdapter;
  canDeriveRows: typeof canDeriveRowsPlanning;
}
export function planningContractSuite({
  test,
  calculate,
  memory,
  tree,
  normalizeView,
  session,
  rowsAdapter,
  canDeriveRows,
}: Suite): void {
  rowsPlanningCases({ test, rowsAdapter, canDeriveRows, session });
  for (const scenario of scenarios) {
    test(scenario.name, () => {
      const snapshot = planningFixture();
      at(snapshot.tasks, 0).start = at(scenario.a, 0);
      at(snapshot.tasks, 0).end = at(scenario.a, 1);
      const result = calculate(
        snapshot,
        [
          {
            type: "dependency.put",
            dependency: edge(
              scenario.type as PlanningDependency["type"],
              scenario.lag
            ),
          },
        ],
        planningConfig
      );
      equal(
        [at(result.snapshot.tasks, 1).start, at(result.snapshot.tasks, 1).end],
        scenario.expected
      );
      equal(snapshot.dependencies, []);
    });
  }
  test("source identifiers disambiguate identical record IDs", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 1).ref = { source: "releases", id: "a" };
    const link = { ...edge(), to: at(snapshot.tasks, 1).ref };
    const result = calculate(
      snapshot,
      [{ type: "dependency.put", dependency: link }],
      planningConfig
    );
    equal(at(result.snapshot.tasks, 1).start, "2026-09-16");
  });
  test("task calendars override source and planning calendars", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 0).start = at(snapshot.tasks, 0).end = "2026-09-18";
    at(snapshot.tasks, 1).calendarId = "always";
    const result = calculate(
      snapshot,
      [{ type: "dependency.put", dependency: edge() }],
      planningConfig
    );
    equal(
      [at(result.snapshot.tasks, 1).start, at(result.snapshot.tasks, 1).end],
      ["2026-09-19", "2026-09-20"]
    );
  });
  test("calendar exceptions are enforced", () => {
    const snapshot = planningFixture();
    at(snapshot.calendars, 0).exceptions = { "2026-09-16": false };
    const result = calculate(
      snapshot,
      [{ type: "dependency.put", dependency: edge() }],
      planningConfig
    );
    equal(at(result.snapshot.tasks, 1).start, "2026-09-17");
  });
  test("preserves an existing successor margin", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 1).start = "2026-10-01";
    at(snapshot.tasks, 1).end = "2026-10-02";
    equal(
      calculate(
        snapshot,
        [{ type: "dependency.put", dependency: edge() }],
        planningConfig
      ).preview.changes.length,
      0
    );
  });
  test("manual scheduling reports a conflict without moving successors", () => {
    const result = calculate(
      planningFixture(),
      [{ type: "dependency.put", dependency: edge() }],
      { ...planningConfig, scheduling: "manual" }
    );
    equal(at(result.snapshot.tasks, 1).start, "2026-09-14");
    equal(result.preview.warnings.length, 1);
  });
  test("date and dependency flags cannot be bypassed", () => {
    const dates: PlanningMutation = {
      type: "dates",
      ref: { source: "tasks", id: "a" },
      start: "2026-09-16",
      end: "2026-09-17",
    };
    throws(
      () =>
        calculate(planningFixture(), [dates], {
          ...planningConfig,
          allowDateEdit: false,
        }),
      "feature-disabled"
    );
    throws(
      () =>
        calculate(
          planningFixture(),
          [{ type: "dependency.put", dependency: edge() }],
          { ...planningConfig, allowDependencyEdit: false }
        ),
      "feature-disabled"
    );
    throws(
      () =>
        calculate(
          planningFixture(),
          [{ type: "dependency.put", dependency: edge() }],
          { ...planningConfig, dependencyTypes: [] }
        ),
      "feature-disabled"
    );
  });
  test("forbids a dependency cycle", () => {
    const snapshot = planningFixture();
    snapshot.dependencies.push(edge());
    throws(
      () =>
        calculate(
          snapshot,
          [
            {
              type: "dependency.put",
              dependency: {
                id: "b-a",
                from: edge().to,
                to: edge().from,
                type: "FS",
              },
            },
          ],
          planningConfig
        ),
      "dependency-cycle"
    );
  });
  test("forbids hierarchy cycles", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 0).parent = at(snapshot.tasks, 1).ref;
    throws(
      () =>
        calculate(
          snapshot,
          [
            {
              type: "parent",
              ref: at(snapshot.tasks, 1).ref,
              parent: at(snapshot.tasks, 0).ref,
            },
          ],
          planningConfig
        ),
      "hierarchy-cycle"
    );
  });
  test("moves a summary group while preserving leaf working durations", () => {
    const snapshot = planningFixture();
    const parent = {
      ref: { source: "tasks", id: "group" },
      label: "Group",
      start: null,
      end: null,
    };
    snapshot.tasks.push(parent);
    at(snapshot.tasks, 0).parent = parent.ref;
    at(snapshot.tasks, 1).parent = parent.ref;
    const result = calculate(
      snapshot,
      [{ type: "move", ref: parent.ref, days: 4 }],
      planningConfig
    );
    equal(
      result.snapshot.tasks.map((task) => [task.start, task.end]),
      [
        ["2026-09-18", "2026-09-21"],
        ["2026-09-18", "2026-09-21"],
        ["2026-09-18", "2026-09-21"],
      ]
    );
    equal(result.preview.changes.length, 3);
  });
  test("summary cycles through another source are rejected", () => {
    const snapshot = planningFixture();
    const parent = {
      ref: { source: "tasks", id: "group" },
      label: "Group",
      start: null,
      end: null,
    };
    snapshot.tasks.push(parent);
    at(snapshot.tasks, 0).parent = parent.ref;
    at(snapshot.tasks, 1).ref.source = "releases";
    snapshot.dependencies = [{ ...edge(), to: at(snapshot.tasks, 1).ref }];
    throws(
      () =>
        calculate(
          snapshot,
          [
            {
              type: "dependency.put",
              dependency: {
                id: "back",
                from: at(snapshot.tasks, 1).ref,
                to: parent.ref,
                type: "FS",
              },
            },
          ],
          planningConfig
        ),
      "dependency-cycle"
    );
  });
  test("independent parents retain their own dates", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 1).parent = at(snapshot.tasks, 0).ref;
    const result = calculate(
      snapshot,
      [{ type: "move", ref: at(snapshot.tasks, 1).ref, days: 4 }],
      { ...planningConfig, parentDates: "independent" }
    );
    equal(at(result.snapshot.tasks, 0).start, "2026-09-14");
  });
  test("a protected descendant blocks the whole group move", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 1).parent = at(snapshot.tasks, 0).ref;
    at(snapshot.tasks, 1).editable = false;
    throws(
      () =>
        calculate(
          snapshot,
          [{ type: "move", ref: at(snapshot.tasks, 0).ref, days: 4 }],
          planningConfig
        ),
      "permission-denied"
    );
    equal(at(snapshot.tasks, 0).start, "2026-09-14");
  });
  test("partial graphs, dangling references and unscheduled predecessors block recalculation", () => {
    const snapshot = planningFixture();
    throws(
      () => calculate({ ...snapshot, complete: false }, [], planningConfig),
      "incomplete-graph"
    );
    throws(
      () =>
        calculate(
          {
            ...snapshot,
            dependencies: [
              { ...edge(), from: { source: "tasks", id: "missing" } },
            ],
          },
          [],
          planningConfig
        ),
      "missing-task"
    );
    at(snapshot.tasks, 0).start = at(snapshot.tasks, 0).end = null;
    throws(
      () =>
        calculate(
          snapshot,
          [{ type: "dependency.put", dependency: edge() }],
          planningConfig
        ),
      "unscheduled-task"
    );
  });
  test("filtered tree restores parents but does not reveal siblings", () => {
    const snapshot = planningFixture();
    at(snapshot.tasks, 1).parent = at(snapshot.tasks, 0).ref;
    equal(
      tree(snapshot, new Set(['["tasks","b"]'])).map((row) => [
        row.task.ref.id,
        row.depth,
      ]),
      [
        ["a", 0],
        ["b", 1],
      ]
    );
    equal(tree(snapshot, undefined, new Set(['["tasks","a"]'])).length, 1);
  });
  test("presentation normalization keeps semantic data out of saved views", () => {
    equal(
      normalizeView({
        zoom: "month",
        weekStartsOn: 0,
        showDependencies: false,
        scheduling: "automatic",
        calendars: [],
      }),
      { zoom: "month", weekStartsOn: 0, showDependencies: false }
    );
    equal(normalizeView({ anchorDate: "2026-02-30", weekStartsOn: 9 }), {});
  });
  test("record patches use the same scheduling engine and preserve ordinary fields", () => {
    const result = calculate(
      planningFixture(),
      [
        {
          type: "record",
          ref: edge().from,
          patch: { start: "2026-09-16", end: "2026-09-17", name: "Renamed" },
        },
      ],
      planningConfig
    );
    equal(at(result.snapshot.tasks, 0).label, "Renamed");
    equal(at(result.preview.changes, 0).after.record?.start, "2026-09-16");
  });
  test("preview is read-only and apply is atomic and idempotent", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const context = { scopeId: "project", sourceId: "tasks" };
    const prepared = await store.actions.preview({
      ...context,
      revision: "r1",
      mutations: [{ type: "dependency.put", dependency: edge() }],
    });
    equal(prepared.success, true);
    equal(store.getSnapshot().dependencies.length, 0);
    const request = {
      ...context,
      revision: "r1",
      previewId: prepared.data?.id ?? "",
      idempotencyKey: "once",
    };
    const first = await store.actions.apply(request);
    equal(first.success, true);
    const retry = await store.actions.apply(request);
    equal(retry.data?.revision, first.data?.revision);
    equal(at(store.getSnapshot().tasks, 1).start, "2026-09-16");
  });
  test("stale preview and mismatched scope cannot save", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const context = { scopeId: "project", sourceId: "tasks" };
    const prepared = await store.actions.preview({
      ...context,
      revision: "r1",
      mutations: [{ type: "dependency.put", dependency: edge() }],
    });
    store.replaceSnapshot(store.getSnapshot());
    equal(
      (
        await store.actions.apply({
          ...context,
          revision: "r1",
          previewId: prepared.data?.id ?? "",
          idempotencyKey: "stale",
        })
      ).code,
      "stale-preview"
    );
    equal(store.getSnapshot().dependencies.length, 0);
    equal(
      (
        await store.actions.preview({
          ...context,
          scopeId: "other",
          revision: store.getSnapshot().revision,
          mutations: [],
        })
      ).code,
      "scope-mismatch"
    );
  });
  test("application validation is repeated at commit and failures save nothing", async () => {
    let allowed = true;
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
      validate: () => {
        if (!allowed) {
          throw new Error("Permission revoked");
        }
      },
    });
    const context = { scopeId: "project", sourceId: "tasks" };
    const prepared = await store.actions.preview({
      ...context,
      revision: "r1",
      mutations: [{ type: "dependency.put", dependency: edge() }],
    });
    allowed = false;
    equal(
      (
        await store.actions.apply({
          ...context,
          revision: "r1",
          previewId: prepared.data?.id ?? "",
          idempotencyKey: "denied",
        })
      ).success,
      false
    );
    equal(store.getSnapshot().dependencies.length, 0);
  });
  test("cancelling the shared session never calls apply", async () => {
    const store = memory({
      snapshot: planningFixture(),
      config: planningConfig,
    });
    const runtime = session({ config: planningConfig, actions: store.actions });
    await runtime.load();
    const pending = runtime.request([
      { type: "dependency.put", dependency: edge() },
    ]);
    for (let i = 0; i < 30 && !runtime.getState().preview; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    equal(Boolean(runtime.getState().preview), true);
    runtime.cancel();
    equal((await pending).code, "cancelled");
    equal(store.getSnapshot().revision, "r1");
    runtime.dispose();
  });
}

/** Rows the table's own list action would return. */
const planningRows = () => [
  {
    id: "parent",
    name: "Parent",
    start: "2026-09-14",
    end: "2026-09-18",
    parentId: null,
  },
  {
    id: "a",
    name: "A",
    start: "2026-09-14",
    end: "2026-09-15",
    parentId: "parent",
  },
  {
    id: "b",
    name: "B",
    start: "2026-09-16",
    end: "2026-09-17",
    parentId: "parent",
  },
];
const rowsGantt = {
  titleColumn: "name",
  startColumn: "start",
  endColumn: "end",
  parentColumn: "parentId",
};
const rowsContext = { scopeId: "project", sourceId: "tasks" };

function rowsPlanningCases({
  test,
  rowsAdapter,
  canDeriveRows,
  session,
}: Pick<Suite, "test" | "rowsAdapter" | "canDeriveRows" | "session">): void {
  const listing =
    (rows: Record<string, unknown>[], pages = 1) =>
    (params: Record<string, unknown>) => {
      const page = Number(params.page);
      const size = Math.ceil(rows.length / pages);
      return Promise.resolve({
        data: rows.slice((page - 1) * size, page * size),
        meta: { pageCount: pages, totalCount: rows.length },
      });
    };

  test("a planning is derivable only once both date columns are mapped", () => {
    equal(canDeriveRows(undefined), false);
    equal(canDeriveRows({ startColumn: "start" }), false);
    equal(canDeriveRows(rowsGantt), true);
  });

  test("rows become a complete graph with their hierarchy", async () => {
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(planningRows()),
    });
    const snapshot = await store.actions.load(rowsContext);
    equal(snapshot.complete, true);
    equal(snapshot.tasks.length, 3);
    equal(at(snapshot.tasks, 1).label, "A");
    equal(at(snapshot.tasks, 1).parent, { source: "tasks", id: "parent" });
  });

  test("every list page is gathered before the graph is used", async () => {
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(planningRows(), 3),
    });
    equal((await store.actions.load(rowsContext)).tasks.length, 3);
  });

  test("the revision tracks the rows rather than the reload", async () => {
    const rows = planningRows();
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(rows),
    });
    const first = await store.actions.load(rowsContext);
    equal((await store.actions.load(rowsContext)).revision, first.revision);
    at(rows, 1).end = "2026-09-16";
    equal(
      (await store.actions.load(rowsContext)).revision === first.revision,
      false
    );
  });

  test("applying a move patches only the columns that changed", async () => {
    const patches: [string, Record<string, unknown>][] = [];
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(planningRows()),
      update: (id, data) => {
        patches.push([id, data]);
        return Promise.resolve({ success: true });
      },
    });
    const loaded = await store.actions.load(rowsContext);
    const prepared = await store.actions.preview({
      ...rowsContext,
      revision: loaded.revision,
      mutations: [{ type: "move", ref: { source: "tasks", id: "b" }, days: 1 }],
    });
    const applied = await store.actions.apply({
      ...rowsContext,
      revision: loaded.revision,
      previewId: prepared.data?.id ?? "",
      idempotencyKey: "move-b",
    });
    equal(applied.success, true);
    // The moved leaf and the parent whose rolled-up dates followed it.
    equal(
      patches.map(([id]) => id),
      ["parent", "b"]
    );
    equal(at(patches, 1), ["b", { start: "2026-09-17", end: "2026-09-18" }]);
  });

  test("a read-only planning refuses to store dates", async () => {
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(planningRows()),
    });
    const loaded = await store.actions.load(rowsContext);
    const prepared = await store.actions.preview({
      ...rowsContext,
      revision: loaded.revision,
      mutations: [{ type: "move", ref: { source: "tasks", id: "b" }, days: 1 }],
    });
    const applied = await store.actions.apply({
      ...rowsContext,
      revision: loaded.revision,
      previewId: prepared.data?.id ?? "",
      idempotencyKey: "read-only",
    });
    equal(applied.success, false);
    equal(applied.code, "read-only");
  });

  test("a rejected update surfaces its reason and resynchronizes", async () => {
    const rows = planningRows();
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(rows),
      update: () => Promise.resolve({ success: false, error: "Row is locked" }),
    });
    const loaded = await store.actions.load(rowsContext);
    const prepared = await store.actions.preview({
      ...rowsContext,
      revision: loaded.revision,
      mutations: [{ type: "move", ref: { source: "tasks", id: "b" }, days: 1 }],
    });
    const applied = await store.actions.apply({
      ...rowsContext,
      revision: loaded.revision,
      previewId: prepared.data?.id ?? "",
      idempotencyKey: "locked",
    });
    equal(applied.success, false);
    equal(applied.error, "Row is locked");
    equal(at(store.getSnapshot().tasks, 2).start, "2026-09-16");
  });

  test("the shared session drives a rows planning end to end", async () => {
    const rows = planningRows();
    const store = rowsAdapter({
      config: planningConfig,
      gantt: rowsGantt,
      list: listing(rows),
      update: (id, data) => {
        const row = rows.find((item) => item.id === id);
        if (row) {
          Object.assign(row, data);
        }
        return Promise.resolve({ success: true });
      },
    });
    const runtime = session({
      config: { ...planningConfig, scheduling: "automatic" },
      actions: store.actions,
    });
    await runtime.load();
    equal(runtime.getState().snapshot?.tasks.length, 3);
    const result = await runtime.request([
      { type: "move", ref: { source: "tasks", id: "b" }, days: 2 },
    ]);
    equal(result.success, true);
    equal(at(rows, 2).start, "2026-09-18");
    runtime.dispose();
  });
}
