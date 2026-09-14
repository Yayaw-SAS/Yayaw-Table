import type { createMemoryPlanningAdapter } from "../src/components/ui/yayaw-table/planning/adapter";
import type {
  calculatePlanning,
  normalizeGanttView,
  planningTree,
} from "../src/components/ui/yayaw-table/planning/engine";
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
}
export function planningContractSuite({
  test,
  calculate,
  memory,
  tree,
  normalizeView,
  session,
}: Suite): void {
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
