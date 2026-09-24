import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/connectors/connector-model";
import type * as Engine from "../src/components/ui/yayaw-table/connectors/sync-engine";

type SyncEngineApi = Pick<typeof Model, "ConnectorError"> &
  Pick<
    typeof Engine,
    | "applyConflictResolutions"
    | "applySyncPlan"
    | "hashSyncValues"
    | "mergeSyncLists"
    | "nextSyncState"
    | "normalizeSyncValue"
    | "planSync"
    | "resolvePendingConflicts"
    | "summarizeSyncPlan"
    | "toSyncMapping"
    | "validateConflictConfig"
  >;

type SyncRecord = Engine.SyncRecord;
type SyncState = Engine.SyncState;
type PlanSyncInput = Engine.PlanSyncInput;

const fields: Engine.SyncField[] = [
  { columnId: "name", field: "Name" },
  { columnId: "amount", field: "Amount", type: "number" },
  { columnId: "due", field: "Due", type: "date" },
  { columnId: "done", field: "Done", type: "boolean" },
  { columnId: "tags", field: "Tags", type: "multiSelect" },
  { columnId: "status", field: "Status", type: "select" },
];
const mapping: Engine.SyncMapping = { keyField: "Yayaw ID", fields };
/** The mapping once a Site column is mapped after the first sync. */
const siteMapping: Engine.SyncMapping = {
  keyField: "Yayaw ID",
  fields: [...fields, { columnId: "site", field: "Site" }],
};
const NOW = "2026-09-23T10:00:00.000Z";
const HASH = /^[0-9a-f]{16}$/;

const clone = (record: SyncRecord): SyncRecord => ({
  ...record,
  values: { ...record.values },
});

interface MemorySide extends Engine.SyncSideAdapter {
  calls: string[];
  /** Write failures by record id or key. */
  failing: Map<string, Engine.SyncFailureCode>;
  list(): SyncRecord[];
  records: Map<string, SyncRecord>;
}

/** An in-memory side: the table (ids `row-N`) or a target (`page-N`). */
function memorySide(prefix: string, initial: SyncRecord[] = []): MemorySide {
  const records = new Map(initial.map((record) => [record.id, clone(record)]));
  const failing = new Map<string, Engine.SyncFailureCode>();
  const calls: string[] = [];
  let next = 0;
  const failure = (...ids: (string | undefined)[]) => {
    const code = ids.map((id) => failing.get(id ?? "")).find(Boolean);
    return code ? ({ ok: false, code } as const) : undefined;
  };
  return {
    records,
    failing,
    calls,
    list: () => [...records.values()].map(clone),
    create(items) {
      calls.push(`create:${items.length}`);
      return Promise.resolve(
        items.map((item) => {
          const failed = failure(item.key);
          if (failed) {
            return failed;
          }
          next += 1;
          const id = `${prefix}${next}`;
          const key = prefix === "row-" ? undefined : item.key;
          records.set(id, {
            id,
            ...(key ? { key } : {}),
            values: { ...item.values },
          });
          return { ok: true, id } as const;
        })
      );
    },
    update(items) {
      calls.push(`update:${items.length}`);
      return Promise.resolve(
        items.map((item) => {
          const record = records.get(item.id ?? "");
          const failed = failure(item.id, item.key);
          if (failed || !record) {
            return failed ?? ({ ok: false, code: "not_found" } as const);
          }
          record.values = { ...record.values, ...item.values };
          if (item.key !== undefined) {
            record.key = item.key;
          }
          return { ok: true } as const;
        })
      );
    },
    delete(ids) {
      calls.push(`delete:${ids.length}`);
      return Promise.resolve(
        ids.map((id) => {
          const failed = failure(id);
          if (failed) {
            return failed;
          }
          records.delete(id);
          return { ok: true } as const;
        })
      );
    },
  };
}

interface World {
  state: SyncState;
  table: MemorySide;
  target: MemorySide;
}

const world = (table: SyncRecord[] = [], target: SyncRecord[] = []): World => ({
  state: { links: [] },
  table: memorySide("row-", table),
  target: memorySide("page-", target),
});

const row = (id: string, values: Record<string, unknown>): SyncRecord => ({
  id,
  values,
});

const page = (
  id: string,
  key: string | undefined,
  values: Record<string, unknown>,
  updatedAt?: string
): SyncRecord => ({
  id,
  ...(key ? { key } : {}),
  values,
  ...(updatedAt ? { updatedAt } : {}),
});

const project = {
  name: "Launch",
  amount: 1200.5,
  due: "2026-10-01",
  done: false,
  tags: ["web", "api"],
  status: "Active",
};

export function connectorsSyncEngineSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: SyncEngineApi
) {
  const plan = (current: World, input: Partial<PlanSyncInput> = {}) =>
    api.planSync({
      direction: "two-way",
      mapping,
      tableRecords: current.table.list(),
      targetRecords: current.target.list(),
      state: current.state,
      now: NOW,
      ...input,
    });

  const run = async (current: World, input: Partial<PlanSyncInput> = {}) => {
    const planned = plan(current, input);
    const result = await api.applySyncPlan(planned, {
      table: current.table,
      target: current.target,
    });
    current.state = result.state;
    return { plan: planned, result };
  };

  const changes = (planned: Engine.SyncPlan) =>
    api.summarizeSyncPlan(planned).changes;

  /**
   * A world where `r1` is linked to `page-1` by a first two-way run.
   * `storeBaseValues` applies to that run.
   */
  const linkedWorld = async (
    input: Pick<PlanSyncInput, "storeBaseValues"> = {},
    values: Record<string, unknown> = project
  ) => {
    const current = world([row("r1", { ...values })]);
    await run(current, input);
    if (current.state.links.length !== 1) {
      throw new Error("Expected r1 to be linked");
    }
    return current;
  };

  const edit = (
    side: MemorySide,
    id: string,
    values: Record<string, unknown>
  ) => {
    const record = side.records.get(id);
    if (!record) {
      throw new Error(`No record ${id}`);
    }
    record.values = { ...record.values, ...values };
  };

  test("normalizes values by column type", () => {
    const n = api.normalizeSyncValue;
    assert.deepEqual(
      [n("1.50", "number"), n(" 2 ", "number"), n(-0, "number")],
      [1.5, 2, 0]
    );
    assert.deepEqual(
      [n("", "number"), n("n/a", "number"), n(Number.NaN, "number")],
      [null, "n/a", null]
    );
    assert.deepEqual(
      [
        n("2026-10-01", "date"),
        n("2026-10-01T12:00:00.000+02:00", "date"),
        n(new Date("2026-10-01T10:00:00Z"), "date"),
        n(Date.parse("2026-10-01T10:00:00Z"), "date"),
        n("", "date"),
      ],
      [
        "2026-10-01",
        "2026-10-01T10:00:00.000Z",
        "2026-10-01T10:00:00.000Z",
        "2026-10-01T10:00:00.000Z",
        null,
      ]
    );
    assert.deepEqual(
      [n(null, "boolean"), n("yes", "boolean"), n("0", "boolean")],
      [false, true, false]
    );
    assert.deepEqual(n(["b", "a", "a", " "], "multiSelect"), ["a", "b"]);
    assert.deepEqual(n("b, a", "multiSelect"), ["a", "b"]);
    assert.equal(n([], "multiSelect"), null);
    assert.deepEqual(
      [n(" Active ", "select"), n(5), n("  "), n(undefined)],
      ["Active", "5", null, null]
    );
  });

  test("hashes values independently of order and representation", () => {
    const left = api.hashSyncValues(
      { tags: "api, web", amount: "1200.50", name: "Launch", done: "no" },
      fields
    );
    const right = api.hashSyncValues(
      { name: "Launch", done: null, amount: 1200.5, tags: ["web", "api"] },
      [...fields].reverse()
    );
    assert.equal(left, right);
    assert.match(left, HASH);
    assert.notEqual(
      api.hashSyncValues({ name: "Launch", amount: 1200.51 }, fields),
      left
    );
  });

  test("builds a sync mapping from the connector settings", () => {
    assert.deepEqual(
      api.toSyncMapping(
        {
          keyField: "Row",
          mapping: [
            { columnId: "name", field: "Name" },
            { columnId: "notes", field: null },
            { columnId: "amount", field: "Total" },
          ],
        },
        [{ id: "amount", type: "number" }, { id: "name" }]
      ),
      {
        keyField: "Row",
        fields: [
          { columnId: "name", field: "Name" },
          { columnId: "amount", field: "Total", type: "number" },
        ],
      }
    );
  });

  test("push creates target records, links them and then has nothing to do", async () => {
    const current = world([row("r1", project), row("r2", { name: "Docs" })]);
    const first = await run(current, { direction: "push" });
    assert.deepEqual(
      first.plan.createInTarget.map((item) => [item.rowId, item.key]),
      [
        ["r1", "r1"],
        ["r2", "r2"],
      ]
    );
    assert.equal(first.result.applied.createInTarget, 2);
    assert.deepEqual(
      current.state.links.map((link) => [link.rowId, link.remoteId]),
      [
        ["r1", "page-1"],
        ["r2", "page-2"],
      ]
    );
    assert.equal(current.state.lastSyncAt, NOW);
    assert.equal(current.target.records.get("page-1")?.key, "r1");
    const second = plan(current, { direction: "push" });
    assert.equal(changes(second), 0);
    assert.equal(second.unchanged, 2);
    assert.equal(second.conflicts.length, 0);
    // An unchanged run keeps the links as they were.
    assert.deepEqual(api.nextSyncState(second).links, current.state.links);
  });

  test("pull creates table rows and writes their id back to keyless records", async () => {
    const current = world(
      [],
      [
        page("page-9", undefined, project),
        page("page-8", "ext-1", { name: "B" }),
      ]
    );
    const first = await run(current, { direction: "pull" });
    assert.equal(first.plan.createInTable.length, 2);
    assert.equal(first.result.applied.createInTable, 2);
    assert.equal(first.result.applied.setKeyInTarget, 2);
    assert.equal(current.target.records.get("page-9")?.key, "row-1");
    // A key the table did not keep is replaced by the new row id.
    assert.equal(current.target.records.get("page-8")?.key, "row-2");
    assert.deepEqual(current.table.records.get("row-1")?.values, project);
    const second = plan(current, { direction: "pull" });
    assert.equal(changes(second), 0);
  });

  test("two-way creates on both sides, then is idempotent", async () => {
    const current = world(
      [row("r1", project)],
      [page("page-9", undefined, { name: "From Notion", amount: "3" })]
    );
    const first = await run(current);
    assert.deepEqual(api.summarizeSyncPlan(first.plan), {
      changes: 2,
      conflicts: 0,
      createInTable: 1,
      createInTarget: 1,
      deleteInTable: 0,
      deleteInTarget: 0,
      duplicates: 0,
      flagged: 0,
      initialized: 0,
      overridden: 0,
      pendingConflicts: 0,
      setKeyInTarget: 0,
      skipped: 0,
      unchanged: 0,
      updateInTable: 0,
      updateInTarget: 0,
    });
    assert.equal(current.state.links.length, 2);
    const second = await run(current);
    assert.equal(changes(second.plan), 0);
    assert.equal(changes(plan(current)), 0);
  });

  test("a change on one side goes to the other with only its columns", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { amount: 99 });
    const toTarget = plan(current);
    assert.deepEqual(
      toTarget.updateInTarget.map((item) => [
        item.remoteId,
        item.key,
        item.columns,
        item.values,
      ]),
      [["page-1", "r1", ["amount"], { amount: 99 }]]
    );
    await run(current);
    edit(current.target, "page-1", { status: "Done" });
    const toTable = plan(current);
    assert.deepEqual(toTable.updateInTarget, []);
    assert.deepEqual(
      toTable.updateInTable.map((item) => [item.rowId, item.values]),
      [["r1", { status: "Done" }]]
    );
    await run(current);
    assert.equal(current.table.records.get("r1")?.values.status, "Done");
    assert.equal(changes(plan(current)), 0);
  });

  test("changes to different columns on both sides merge without conflict", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { name: "Launch v2" });
    edit(current.target, "page-1", { done: true, tags: "api, web, ops" });
    const { plan: planned } = await run(current);
    assert.equal(planned.conflicts.length, 0);
    assert.deepEqual(planned.updateInTarget[0]?.values, { name: "Launch v2" });
    assert.deepEqual(planned.updateInTable[0]?.values, {
      done: true,
      tags: "api, web, ops",
    });
    assert.equal(changes(plan(current)), 0);
  });

  test("resolves a conflict on the same column by the conflict rule", async () => {
    const cases: [Engine.ConflictRule, string, string, Engine.SyncSide][] = [
      ["table-wins", NOW, NOW, "table"],
      ["target-wins", NOW, NOW, "target"],
      ["latest-wins", "2026-09-23T09:00:00Z", "2026-09-23T09:30:00Z", "target"],
      ["latest-wins", "2026-09-23T09:30:00Z", "2026-09-23T09:00:00Z", "table"],
    ];
    for (const [conflictRule, tableTime, targetTime, winner] of cases) {
      // Each case needs a fresh world synced once.
      const current = await linkedWorld();
      const tableRecords = current.table.list().map((record) => ({
        ...record,
        updatedAt: tableTime,
        values: { ...record.values, amount: 1 },
      }));
      const targetRecords = current.target.list().map((record) => ({
        ...record,
        updatedAt: targetTime,
        values: { ...record.values, amount: "2" },
      }));
      const planned = plan(current, {
        conflictRule,
        tableRecords,
        targetRecords,
      });
      assert.deepEqual(
        planned.conflicts.map((conflict) => [
          conflict.columnId,
          conflict.field,
          conflict.tableValue,
          conflict.targetValue,
          conflict.baseValue,
          conflict.winner,
        ]),
        [["amount", "Amount", 1, 2, 1200.5, winner]],
        conflictRule
      );
      const written =
        winner === "table" ? planned.updateInTarget : planned.updateInTable;
      assert.equal(written.length, 1);
      assert.equal(changes(planned), 1);
    }
  });

  test("latest-wins falls back to the table without both edit times", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { name: "Table" });
    edit(current.target, "page-1", { name: "Target" });
    const planned = plan(current, { conflictRule: "latest-wins" });
    assert.equal(planned.conflicts[0]?.winner, "table");
  });

  test("push and pull mirror one side and never report conflicts", async () => {
    const pushed = await linkedWorld();
    edit(pushed.target, "page-1", { name: "Edited in target" });
    const push = plan(pushed, { direction: "push" });
    assert.deepEqual(push.updateInTarget[0]?.values, { name: "Launch" });
    assert.deepEqual([push.updateInTable, push.conflicts], [[], []]);

    const pulled = await linkedWorld();
    edit(pulled.table, "r1", { name: "Edited in table" });
    edit(pulled.target, "page-1", { amount: 5 });
    const pull = plan(pulled, { direction: "pull" });
    assert.deepEqual(pull.updateInTable[0]?.values, {
      name: "Launch",
      amount: 5,
    });
    assert.deepEqual([pull.updateInTarget, pull.conflicts], [[], []]);
  });

  test("push leaves unlinked target records and pull unlinked rows alone", () => {
    const current = world([row("r1", project)], [page("p", undefined, {})]);
    assert.deepEqual(
      [
        plan(current, { direction: "push" }).skipped,
        plan(current, { direction: "pull" }).skipped,
      ],
      [1, 1]
    );
  });

  test("without base values, merges by record hash", async () => {
    const current = await linkedWorld({ storeBaseValues: false });
    assert.equal(current.state.links[0]?.baseValues, undefined);
    edit(current.table, "r1", { name: "Only the table" });
    const oneSide = plan(current, { storeBaseValues: false });
    assert.deepEqual(oneSide.updateInTarget[0]?.values, {
      name: "Only the table",
    });
    edit(current.target, "page-1", { amount: 7 });
    const bothSides = plan(current, { storeBaseValues: false });
    // Both records changed: every differing column is a conflict.
    assert.deepEqual(
      bothSides.conflicts.map((conflict) => conflict.columnId).sort(),
      ["amount", "name"]
    );
  });

  test("deletions follow the delete policy", async () => {
    const policies: [Engine.DeletePolicy, number, number, number][] = [
      ["ignore", 0, 0, 1],
      ["flag", 1, 0, 1],
      ["propagate", 0, 1, 0],
    ];
    for (const [deletePolicy, flagged, deletes, links] of policies) {
      const current = await linkedWorld();
      current.table.records.delete("r1");
      const { plan: planned } = await run(current, { deletePolicy });
      assert.equal(planned.flagged.length, flagged, deletePolicy);
      assert.equal(planned.deleteInTarget.length, deletes, deletePolicy);
      assert.equal(current.state.links.length, links, deletePolicy);
      assert.equal(current.target.records.has("page-1"), deletes === 0);
      if (flagged) {
        assert.deepEqual(planned.flagged[0], {
          ref: planned.flagged[0]?.ref,
          rowId: "r1",
          remoteId: "page-1",
          deletedIn: "table",
        });
      }
      // Nothing is left to do, and a kept link never recreates the record.
      assert.equal(changes(plan(current, { deletePolicy })), 0);
    }
  });

  test("a record deleted in the target is deleted in the table with propagate", async () => {
    const current = await linkedWorld();
    current.target.records.delete("page-1");
    const { plan: planned } = await run(current, {
      deletePolicy: "propagate",
    });
    assert.deepEqual(
      planned.deleteInTable.map((item) => item.rowId),
      ["r1"]
    );
    assert.equal(current.table.records.size, 0);
    assert.deepEqual(current.state.links, []);
  });

  test("a deletion the direction cannot propagate is flagged", async () => {
    const current = await linkedWorld();
    current.table.records.delete("r1");
    const planned = plan(current, {
      direction: "pull",
      deletePolicy: "propagate",
    });
    assert.deepEqual(planned.deleteInTarget, []);
    assert.equal(planned.flagged[0]?.deletedIn, "table");
  });

  test("forgets a link deleted on both sides", async () => {
    const current = await linkedWorld();
    current.table.records.delete("r1");
    current.target.records.delete("page-1");
    const { plan: planned } = await run(current);
    assert.equal(changes(planned), 0);
    assert.deepEqual(current.state.links, []);
  });

  test("adopts target records by key instead of duplicating them", async () => {
    const current = world(
      [row("r1", project), row("r2", { name: "Docs" })],
      [
        page("page-7", "r1", { ...project, tags: "api, web" }),
        page("page-8", "r2", { name: "Docs (edited)" }),
      ]
    );
    const { plan: planned } = await run(current, {
      conflictRule: "target-wins",
    });
    assert.deepEqual([planned.createInTarget, planned.createInTable], [[], []]);
    assert.deepEqual(
      planned.conflicts.map((conflict) => [conflict.rowId, conflict.columnId]),
      [["r2", "name"]]
    );
    assert.equal(planned.conflicts[0]?.baseValue, undefined);
    assert.deepEqual(
      current.state.links.map((link) => [link.rowId, link.remoteId]),
      [
        ["r1", "page-7"],
        ["r2", "page-8"],
      ]
    );
    assert.equal(current.table.records.get("r2")?.values.name, "Docs (edited)");
    assert.equal(changes(plan(current)), 0);
  });

  test("reports duplicate keys and never guesses", async () => {
    const current = world(
      [],
      [
        page("page-1", "r1", {}),
        page("page-2", "r1", {}),
        page("page-3", "r2", {}),
      ]
    );
    const planned = plan(current, {
      tableRecords: [
        row("r1", project),
        row("r2", { name: "Two" }),
        row("r2", {}),
      ],
    });
    assert.deepEqual(
      planned.duplicates.map((item) => [item.side, item.key, item.ids]),
      [
        ["table", "r2", ["r2", "r2"]],
        ["target", "r1", ["page-1", "page-2"]],
      ]
    );
    assert.equal(changes(planned), 0);
    // A linked record whose key got duplicated is left alone, not deleted.
    const linked = await linkedWorld();
    linked.target.records.set("page-5", page("page-5", "r1", {}));
    const again = plan(linked, { deletePolicy: "propagate" });
    assert.deepEqual([changes(again), again.flagged.length], [0, 0]);
    assert.deepEqual(api.nextSyncState(again).links, linked.state.links);
  });

  test("a partial failure keeps the state retryable", async () => {
    const current = world([row("r1", project), row("r2", { name: "Two" })]);
    current.target.failing.set("r2", "provider_unavailable");
    const first = await run(current);
    assert.equal(first.result.failed, 1);
    assert.deepEqual(first.result.failures, [
      {
        operation: "createInTarget",
        ref: first.plan.createInTarget[1]?.ref,
        code: "provider_unavailable",
        rowId: "r2",
      },
    ]);
    assert.deepEqual(
      current.state.links.map((link) => link.rowId),
      ["r1"]
    );
    current.target.failing.clear();
    const retry = plan(current);
    assert.deepEqual(
      retry.createInTarget.map((item) => item.rowId),
      ["r2"]
    );
    await run(current);

    // A failed update keeps the previous link, so it is planned again.
    edit(current.table, "r1", { amount: 5 });
    current.target.failing.set("page-1", "invalid_request");
    const failed = await run(current);
    assert.equal(failed.result.failed, 1);
    current.target.failing.clear();
    assert.deepEqual(plan(current).updateInTarget[0]?.values, { amount: 5 });
  });

  test("an authorization error stops the run", async () => {
    const current = world(
      [row("r1", project)],
      [page("page-9", undefined, { name: "New" })]
    );
    current.target.create = () =>
      Promise.reject(new api.ConnectorError("unauthorized"));
    const { result } = await run(current);
    assert.equal(result.stopped, "unauthorized");
    assert.deepEqual(current.table.calls, []);
    assert.deepEqual(
      result.failures.map((item) => [item.operation, item.code]),
      [
        ["createInTarget", "unauthorized"],
        ["createInTable", "unauthorized"],
      ]
    );
    assert.deepEqual(current.state.links, []);
  });

  test("an item-level authorization failure stops the run too", async () => {
    const current = world([row("r1", project), row("r2", {})]);
    current.target.failing.set("r1", "forbidden");
    const { result } = await run(current, { direction: "push" });
    assert.equal(result.stopped, "forbidden");
    assert.equal(current.target.records.size, 1);
  });

  test("applies in batches of batchSize", async () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) => row(id, { name: id }));
    const current = world(rows);
    const planned = plan(current);
    await api.applySyncPlan(
      planned,
      { table: current.table, target: current.target },
      { batchSize: 2 }
    );
    assert.deepEqual(current.target.calls, [
      "create:2",
      "create:2",
      "create:1",
    ]);
  });

  test("an adapter without the needed method fails its operations", async () => {
    const current = world([row("r1", project)]);
    const result = await api.applySyncPlan(plan(current), {});
    assert.deepEqual(
      result.failures.map((item) => item.code),
      ["unsupported"]
    );
    assert.deepEqual(result.state.links, []);
  });

  test("a partial target read never looks like a deletion", async () => {
    const current = await linkedWorld({}, project);
    edit(current.table, "r1", { amount: 10 });
    const planned = plan(current, {
      targetRecords: [],
      targetPartial: true,
      deletePolicy: "propagate",
    });
    assert.deepEqual(planned.deleteInTable, []);
    assert.deepEqual(planned.updateInTarget[0]?.values, { amount: 10 });
    const unchanged = world();
    unchanged.state = current.state;
    unchanged.table = current.table;
    edit(current.table, "r1", { amount: 1200.5 });
    assert.equal(
      changes(plan(unchanged, { targetRecords: [], targetPartial: true })),
      0
    );
  });

  test("writes the key of a linked target record that lost it", async () => {
    const current = await linkedWorld();
    const target = current.target.records.get("page-1");
    assert.ok(target);
    target.key = undefined;
    const { plan: planned, result } = await run(current, {
      direction: "pull",
    });
    assert.deepEqual(
      planned.setKeyInTarget.map((item) => [item.remoteId, item.key]),
      [["page-1", "r1"]]
    );
    assert.equal(result.applied.setKeyInTarget, 1);
    assert.equal(current.target.records.get("page-1")?.key, "r1");
  });

  test("finds a linked sheet row again when its remote id became its key", async () => {
    const current = await linkedWorld();
    const record = current.target.records.get("page-1");
    assert.ok(record);
    current.target.records.delete("page-1");
    current.target.records.set("r1", { ...record, id: "r1" });
    const { plan: planned } = await run(current, {
      deletePolicy: "propagate",
    });
    assert.equal(changes(planned), 0);
    assert.equal(current.state.links[0]?.remoteId, "r1");
  });

  // Conflict rules in code ---------------------------------------------------

  const LATER = "2026-09-24T10:00:00.000Z";

  /** r1 linked, then `amount`, `name`, `status` and `done` changed on both sides. */
  const conflictingWorld = async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", {
      amount: 1,
      name: "Table",
      status: "Paused",
      done: true,
    });
    edit(current.target, "page-1", {
      amount: 2,
      name: "Target",
      status: "Done",
      done: "no",
    });
    // `done` only changed in the table: not a conflict.
    return current;
  };

  const settled = (planned: Engine.SyncPlan) =>
    planned.conflicts.map((conflict) => [
      conflict.columnId,
      conflict.resolution,
      conflict.source,
    ]);

  test("applies ownership, column rules, the resolver and the global rule in that order", async () => {
    const current = await conflictingWorld();
    const asked: string[] = [];
    const planned = plan(current, {
      conflictRule: "table-wins",
      ownership: { amount: "target" },
      columnRules: { amount: "table-wins", name: "target-wins" },
      resolveConflict: (conflict) => {
        asked.push(conflict.columnId);
        return conflict.columnId === "status" ? "target" : undefined;
      },
    });
    assert.deepEqual(asked, ["status"]);
    assert.deepEqual(settled(planned), [
      ["name", "target", "column"],
      ["status", "target", "resolver"],
    ]);
    assert.deepEqual(
      planned.overridden.map((item) => [
        item.columnId,
        item.owner,
        item.bothChanged,
      ]),
      [["amount", "target", true]]
    );
    assert.deepEqual(planned.updateInTable[0]?.values, {
      amount: 2,
      name: "Target",
      status: "Done",
    });
    assert.deepEqual(planned.updateInTarget[0]?.values, { done: true });

    // Without a resolver answer, the global rule decides.
    const byRule = plan(current, {
      conflictRule: "target-wins",
      resolveConflict: () => undefined,
    });
    assert.deepEqual(settled(byRule), [
      ["name", "target", "rule"],
      ["amount", "target", "rule"],
      ["status", "target", "rule"],
    ]);
  });

  test("an owned column is written back when the other side changes it", async () => {
    const current = await linkedWorld();
    const ownership = { amount: "target" } as const;
    edit(current.table, "r1", { amount: 5 });
    const drift = plan(current, { ownership });
    assert.deepEqual(drift.conflicts, []);
    assert.deepEqual(
      drift.overridden.map((item) => [
        item.columnId,
        item.tableValue,
        item.targetValue,
        item.bothChanged,
      ]),
      [["amount", 5, 1200.5, false]]
    );
    assert.deepEqual(drift.updateInTarget, []);
    assert.deepEqual(drift.updateInTable[0]?.values, { amount: 1200.5 });
    assert.equal(api.summarizeSyncPlan(drift).overridden, 1);
    await run(current, { ownership });
    assert.equal(current.table.records.get("r1")?.values.amount, 1200.5);
    assert.equal(changes(plan(current, { ownership })), 0);

    // The owner's own changes flow as usual.
    edit(current.target, "page-1", { amount: 7 });
    const owned = plan(current, { ownership });
    assert.deepEqual(owned.overridden, []);
    assert.deepEqual(owned.updateInTable[0]?.values, { amount: 7 });
  });

  test("a one-way sync never writes a column to the side that owns it", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { amount: 5, name: "Pushed" });
    const push = plan(current, {
      direction: "push",
      ownership: { amount: "target" },
    });
    assert.deepEqual(push.updateInTarget[0]?.values, { name: "Pushed" });
    assert.deepEqual(push.overridden, []);

    edit(current.target, "page-1", { status: "Done" });
    const pull = plan(current, {
      direction: "pull",
      ownership: { status: "table" },
    });
    assert.deepEqual(pull.updateInTable[0]?.values, {
      amount: 1200.5,
      name: "Launch",
    });
  });

  test("merge unites list values against the base and falls back for other types", async () => {
    assert.deepEqual(
      api.mergeSyncLists(
        ["api", "web", "ops"],
        ["web", "mobile"],
        ["api", "web"]
      ),
      ["web", "ops", "mobile"]
    );
    assert.deepEqual(api.mergeSyncLists(["b", "a"], ["a", "c"]), [
      "b",
      "a",
      "c",
    ]);
    assert.equal(api.mergeSyncLists(["a"], null, ["a"]), null);

    const current = await linkedWorld();
    edit(current.table, "r1", { tags: ["api", "web", "ops"], name: "Table" });
    edit(current.target, "page-1", { tags: "web, mobile", name: "Target" });
    const columnRules = { tags: "merge", name: "merge" } as const;
    const planned = plan(current, { columnRules });
    assert.deepEqual(settled(planned), [
      ["name", "table", "rule"],
      ["tags", "merged", "column"],
    ]);
    assert.deepEqual(planned.conflicts[1]?.value, ["mobile", "ops", "web"]);
    assert.deepEqual(planned.updateInTable[0]?.values, {
      tags: ["ops", "web", "mobile"],
    });
    assert.deepEqual(planned.updateInTarget[0]?.values, {
      name: "Table",
      tags: ["ops", "web", "mobile"],
    });
    await run(current, { columnRules });
    assert.equal(changes(plan(current, { columnRules })), 0);
  });

  test("the resolver can pick a side, a value, skip or leave it to a person", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { amount: 1, name: "Table", status: "Paused" });
    edit(current.target, "page-1", {
      amount: 2,
      name: "Target",
      status: "Done",
    });
    const contexts: Engine.ConflictContext[] = [];
    const answers: Record<string, Engine.ConflictDecision> = {
      amount: { value: "3" },
      name: "skip",
      status: "manual",
    };
    const planned = plan(current, {
      resolveConflict: (conflict) => {
        contexts.push(conflict);
        return answers[conflict.columnId];
      },
    });
    assert.deepEqual(
      contexts.map((item) => [
        item.columnId,
        item.field,
        item.tableValue,
        item.targetValue,
        item.baseValue,
        item.rowId,
        item.remoteId,
        item.tableRecord.id,
        item.targetRecord.id,
      ]),
      [
        [
          "name",
          "Name",
          "Table",
          "Target",
          "Launch",
          "r1",
          "page-1",
          "r1",
          "page-1",
        ],
        ["amount", "Amount", 1, 2, 1200.5, "r1", "page-1", "r1", "page-1"],
        [
          "status",
          "Status",
          "Paused",
          "Done",
          "Active",
          "r1",
          "page-1",
          "r1",
          "page-1",
        ],
      ]
    );
    assert.deepEqual(settled(planned), [
      ["name", "skipped", "resolver"],
      ["amount", "custom", "resolver"],
      ["status", "manual", "resolver"],
    ]);
    assert.equal(planned.conflicts[1]?.value, 3);
    assert.deepEqual(planned.updateInTable[0]?.values, { amount: "3" });
    assert.deepEqual(planned.updateInTarget[0]?.values, { amount: "3" });
    assert.deepEqual(
      planned.pendingConflicts.map((item) => item.columnId),
      ["status"]
    );
  });

  test("a resolver that throws or answers asynchronously leaves the conflict to a person", async () => {
    const current = await conflictingWorld();
    const thrown = plan(current, {
      resolveConflict: () => {
        throw new Error("boom");
      },
    });
    assert.deepEqual(
      thrown.conflicts.map((item) => [item.resolution, item.error]),
      [
        ["manual", "resolver_failed"],
        ["manual", "resolver_failed"],
        ["manual", "resolver_failed"],
      ]
    );
    assert.equal(changes(thrown), 1);
    assert.equal(thrown.pendingConflicts.length, 3);
    const later = plan(current, {
      resolveConflict: () =>
        Promise.resolve("table") as unknown as Engine.ConflictDecision,
    });
    assert.equal(later.conflicts[0]?.error, "invalid_decision");
  });

  test("manual conflicts wait in the state until both sides agree", async () => {
    const current = await linkedWorld();
    const columnRules = { status: "manual" } as const;
    edit(current.table, "r1", { status: "Paused", name: "Renamed" });
    edit(current.target, "page-1", { status: "Done" });
    const first = await run(current, { columnRules });
    // The rest of the row still syncs.
    assert.deepEqual(first.plan.updateInTarget[0]?.values, {
      name: "Renamed",
    });
    assert.deepEqual(first.plan.updateInTable, []);
    assert.deepEqual(current.state.pendingConflicts, [
      {
        rowId: "r1",
        remoteId: "page-1",
        columnId: "status",
        field: "Status",
        tableValue: "Paused",
        targetValue: "Done",
        baseValue: "Active",
        detectedAt: NOW,
      },
    ]);
    assert.equal(api.summarizeSyncPlan(first.plan).pendingConflicts, 1);

    // Found again: kept once, with its first detection time.
    const again = await run(current, { columnRules, now: LATER });
    assert.equal(changes(again.plan), 0);
    assert.equal(current.state.pendingConflicts?.length, 1);
    assert.equal(current.state.pendingConflicts?.[0]?.detectedAt, NOW);

    // Back to the base on one side: still waiting for a person.
    edit(current.table, "r1", { status: "Active" });
    const reverted = await run(current, { columnRules, now: LATER });
    assert.equal(changes(reverted.plan), 0);
    assert.deepEqual(current.state.pendingConflicts?.[0]?.tableValue, "Active");
    assert.equal(current.state.pendingConflicts?.[0]?.detectedAt, LATER);

    // Both sides agree: the conflict is gone.
    edit(current.table, "r1", { status: "Done" });
    const agreed = await run(current, { columnRules, now: LATER });
    assert.equal(changes(agreed.plan), 0);
    assert.equal(current.state.pendingConflicts, undefined);
    assert.equal(changes(plan(current, { columnRules })), 0);
  });

  test("a pending conflict survives a partial read and runs where its row is blocked", async () => {
    const current = await linkedWorld();
    const columnRules = { status: "manual" } as const;
    edit(current.table, "r1", { status: "Paused" });
    edit(current.target, "page-1", { status: "Done" });
    await run(current, { columnRules });
    const partial = plan(current, {
      columnRules,
      targetRecords: [],
      targetPartial: true,
    });
    assert.equal(changes(partial), 0);
    assert.equal(partial.pendingConflicts.length, 1);
    // Another record with the same key blocks the row: kept as is.
    const blocked = plan(current, {
      columnRules,
      targetRecords: [
        ...current.target.list(),
        page("page-2", "r1", { name: "Copy" }),
      ],
    });
    assert.equal(blocked.pendingConflicts.length, 1);
    // The link is dropped (deleted on both sides): the conflict goes too.
    const gone = plan(current, {
      columnRules,
      tableRecords: [],
      targetRecords: [],
    });
    assert.deepEqual(gone.pendingConflicts, []);
  });

  test("resolvePendingConflicts writes the chosen values and clears the conflicts", async () => {
    const current = await linkedWorld();
    const columnRules = { status: "manual", name: "manual" } as const;
    edit(current.table, "r1", { status: "Paused", name: "Table" });
    edit(current.target, "page-1", { status: "Done", name: "Target" });
    await run(current, { columnRules });
    assert.equal(current.state.pendingConflicts?.length, 2);

    const resolution = api.resolvePendingConflicts(
      current.state,
      [
        { rowId: "r1", columnId: "status", choice: "target" },
        { rowId: "r1", columnId: "name", choice: { value: " Both " } },
        { rowId: "r9", columnId: "status", choice: "table" },
      ],
      { mapping }
    );
    assert.deepEqual(resolution.unmatched, [
      { rowId: "r9", columnId: "status", choice: "table" },
    ]);
    assert.deepEqual(
      resolution.operations.updateInTable.map((item) => [
        item.rowId,
        item.columns,
        item.values,
      ]),
      [["r1", ["status", "name"], { status: "Done", name: " Both " }]]
    );
    assert.deepEqual(
      resolution.operations.updateInTarget.map((item) => [
        item.remoteId,
        item.key,
        item.values,
      ]),
      [["page-1", "r1", { name: " Both " }]]
    );
    assert.equal(resolution.state.pendingConflicts, undefined);
    assert.equal(resolution.state.links[0]?.baseValues?.status, "Done");

    const result = await api.applyConflictResolutions(resolution, {
      table: current.table,
      target: current.target,
    });
    assert.deepEqual(
      [result.applied.updateInTable, result.applied.updateInTarget],
      [1, 1]
    );
    current.state = result.state;
    assert.equal(current.table.records.get("r1")?.values.status, "Done");
    assert.equal(current.target.records.get("page-1")?.values.name, " Both ");
    // Settled for good: nothing to do, nothing pending.
    const next = plan(current, { columnRules });
    assert.equal(changes(next), 0);
    assert.deepEqual([next.conflicts, next.pendingConflicts], [[], []]);
    // Resolving again matches nothing.
    const repeat = api.resolvePendingConflicts(current.state, [
      { rowId: "r1", columnId: "status", choice: "table" },
    ]);
    assert.equal(repeat.unmatched.length, 1);
    assert.deepEqual(repeat.operations.updateInTarget, []);
  });

  test("a failed resolution write keeps the conflict and the link", async () => {
    const current = await linkedWorld();
    const columnRules = { status: "manual" } as const;
    edit(current.table, "r1", { status: "Paused" });
    edit(current.target, "page-1", { status: "Done" });
    await run(current, { columnRules });
    const before = current.state;
    current.target.failing.set("page-1", "rate_limited");
    const resolution = api.resolvePendingConflicts(before, [
      { rowId: "r1", columnId: "status", choice: "table" },
    ]);
    const result = await api.applyConflictResolutions(resolution, {
      table: current.table,
      target: current.target,
    });
    assert.equal(result.failed, 1);
    assert.deepEqual(result.state.pendingConflicts, before.pendingConflicts);
    assert.deepEqual(result.state.links, before.links);
  });

  /** r1 synced once without Site, then Site holds these values on each side. */
  const siteWorld = async (
    tableSite: unknown,
    targetSite: unknown,
    input: Pick<PlanSyncInput, "storeBaseValues"> = {}
  ) => {
    const current = await linkedWorld(input);
    edit(current.table, "r1", { site: tableSite });
    edit(current.target, "page-1", { site: targetSite });
    return current;
  };

  const site = (current: World) => [
    current.table.records.get("r1")?.values.site,
    current.target.records.get("page-1")?.values.site,
  ];

  const filled = (planned: Engine.SyncPlan) =>
    planned.initialized.map((item) => [
      item.rowId,
      item.remoteId,
      item.columnId,
      item.field,
      item.side,
      item.value,
    ]);

  test("a column mapped after a sync fills the empty side and never clears the other", async () => {
    const rules: Engine.ConflictRule[] = [
      "table-wins",
      "target-wins",
      "latest-wins",
    ];
    for (const conflictRule of rules) {
      const input = { mapping: siteMapping, conflictRule };
      const toTarget = await siteWorld("Paris", null);
      const first = await run(toTarget, input);
      assert.deepEqual(first.plan.updateInTable, [], conflictRule);
      assert.deepEqual(
        first.plan.updateInTarget.map((item) => item.values),
        [{ site: "Paris" }],
        conflictRule
      );
      assert.deepEqual(first.plan.conflicts, []);
      assert.deepEqual(filled(first.plan), [
        ["r1", "page-1", "site", "Site", "target", "Paris"],
      ]);
      assert.equal(api.summarizeSyncPlan(first.plan).initialized, 1);
      assert.deepEqual(site(toTarget), ["Paris", "Paris"]);
      assert.equal(toTarget.state.links[0]?.baseValues?.site, "Paris");
      const again = plan(toTarget, input);
      assert.deepEqual([changes(again), again.initialized], [0, []]);

      const toTable = await siteWorld("", "Lyon");
      const second = await run(toTable, input);
      assert.deepEqual(second.plan.updateInTarget, [], conflictRule);
      assert.deepEqual(
        second.plan.updateInTable.map((item) => item.values),
        [{ site: "Lyon" }],
        conflictRule
      );
      assert.deepEqual(filled(second.plan), [
        ["r1", "page-1", "site", "Site", "table", "Lyon"],
      ]);
      assert.deepEqual(site(toTable), ["Lyon", "Lyon"]);
      assert.equal(changes(plan(toTable, input)), 0);
    }
  });

  test("a newly mapped column with a value on both sides is a conflict", async () => {
    const winners: [Engine.ConflictRule, Engine.SyncSide][] = [
      ["table-wins", "table"],
      ["target-wins", "target"],
    ];
    for (const [conflictRule, winner] of winners) {
      const current = await siteWorld("Paris", "Lyon");
      const { plan: planned } = await run(current, {
        mapping: siteMapping,
        conflictRule,
      });
      assert.deepEqual(
        planned.conflicts.map((conflict) => [
          conflict.columnId,
          conflict.tableValue,
          conflict.targetValue,
          conflict.baseValue,
          conflict.resolution,
        ]),
        [["site", "Paris", "Lyon", undefined, winner]]
      );
      assert.deepEqual(planned.initialized, []);
      const kept = winner === "table" ? "Paris" : "Lyon";
      assert.deepEqual(site(current), [kept, kept]);
      assert.equal(changes(plan(current, { mapping: siteMapping })), 0);
    }
    const owned = await siteWorld("Paris", "Lyon");
    const ownedPlan = plan(owned, {
      mapping: siteMapping,
      ownership: { site: "target" },
    });
    assert.deepEqual(
      ownedPlan.overridden.map((item) => [item.owner, item.bothChanged]),
      [["target", true]]
    );
    const manual = await siteWorld("Paris", "Lyon");
    const manualPlan = plan(manual, {
      mapping: siteMapping,
      columnRules: { site: "manual" },
    });
    assert.deepEqual(changes(manualPlan), 0);
    assert.deepEqual(
      manualPlan.pendingConflicts.map((item) => item.columnId),
      ["site"]
    );
  });

  test("an owned column mapped after a sync is filled from the side with a value", async () => {
    const current = await siteWorld("Paris", null);
    const planned = plan(current, {
      mapping: siteMapping,
      ownership: { site: "target" },
    });
    assert.deepEqual(planned.updateInTable, []);
    assert.deepEqual(filled(planned), [
      ["r1", "page-1", "site", "Site", "target", "Paris"],
    ]);
    assert.deepEqual(planned.overridden, []);
  });

  test("a newly mapped column empty on both sides changes nothing", async () => {
    const current = await siteWorld(null, "");
    const { plan: planned } = await run(current, {
      mapping: siteMapping,
      conflictRule: "target-wins",
    });
    assert.deepEqual(
      [changes(planned), planned.initialized, planned.conflicts],
      [0, [], []]
    );
    assert.equal(current.state.links[0]?.baseValues?.site, null);
    edit(current.table, "r1", { site: "Paris" });
    assert.deepEqual(
      plan(current, { mapping: siteMapping }).updateInTarget.map(
        (item) => item.values
      ),
      [{ site: "Paris" }]
    );
  });

  test("a column the target does not have yet is filled once it exists", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { site: "Paris" });
    const input = {
      mapping: siteMapping,
      conflictRule: "target-wins" as const,
    };
    const before = await run(current, input);
    assert.equal(changes(before.plan), 0);
    assert.equal(
      Object.hasOwn(current.state.links[0]?.baseValues ?? {}, "site"),
      false
    );
    // "Prepare" added the field: every record now holds it, empty.
    edit(current.target, "page-1", { site: null });
    const after = await run(current, input);
    assert.deepEqual(
      after.plan.updateInTarget.map((item) => item.values),
      [{ site: "Paris" }]
    );
    assert.deepEqual(site(current), ["Paris", "Paris"]);
  });

  test("one-way syncs fill a newly mapped column but never clear it", async () => {
    const pulled = await siteWorld("Paris", null);
    const pullInput = { mapping: siteMapping, direction: "pull" as const };
    const pull = await run(pulled, pullInput);
    assert.deepEqual([changes(pull.plan), pull.plan.initialized], [0, []]);
    assert.deepEqual(site(pulled), ["Paris", null]);
    assert.equal(changes(plan(pulled, pullInput)), 0);
    // Once the target holds a value, a pull mirrors it as usual.
    edit(pulled.target, "page-1", { site: "Lyon" });
    assert.deepEqual(
      plan(pulled, pullInput).updateInTable.map((item) => item.values),
      [{ site: "Lyon" }]
    );

    const fromTarget = await siteWorld(null, "Lyon");
    const filledPull = plan(fromTarget, pullInput);
    assert.deepEqual(
      filledPull.updateInTable.map((item) => item.values),
      [{ site: "Lyon" }]
    );
    assert.deepEqual(filled(filledPull), [
      ["r1", "page-1", "site", "Site", "table", "Lyon"],
    ]);

    const pushed = await siteWorld(null, "Lyon");
    const push = await run(pushed, { mapping: siteMapping, direction: "push" });
    assert.equal(changes(push.plan), 0);
    assert.deepEqual(site(pushed), [null, "Lyon"]);
  });

  test("a column removed from the mapping is left alone on both sides", async () => {
    const withoutStatus: Engine.SyncMapping = {
      keyField: "Yayaw ID",
      fields: fields.filter((field) => field.columnId !== "status"),
    };
    for (const storeBaseValues of [true, false]) {
      const current = await linkedWorld({ storeBaseValues });
      edit(current.table, "r1", { status: "Paused" });
      edit(current.target, "page-1", { status: null });
      const input = {
        mapping: withoutStatus,
        storeBaseValues,
        conflictRule: "target-wins" as const,
      };
      const { plan: planned } = await run(current, input);
      assert.equal(changes(planned), 0);
      assert.deepEqual(
        [
          current.table.records.get("r1")?.values.status,
          current.target.records.get("page-1")?.values.status,
        ],
        ["Paused", null]
      );
      const link = current.state.links[0];
      assert.equal(Object.hasOwn(link?.baseValues ?? {}, "status"), false);
      assert.equal(link?.columns?.includes("status") ?? false, false);
      assert.equal(changes(plan(current, input)), 0);
    }
  });

  test("hash-only links fill a newly mapped column too", async () => {
    const current = await siteWorld("Paris", null, { storeBaseValues: false });
    assert.deepEqual(current.state.links[0]?.columns, [
      "amount",
      "done",
      "due",
      "name",
      "status",
      "tags",
    ]);
    edit(current.table, "r1", { name: "Launch v2" });
    const input = {
      mapping: siteMapping,
      storeBaseValues: false,
      conflictRule: "target-wins" as const,
    };
    const { plan: planned } = await run(current, input);
    assert.deepEqual(planned.conflicts, []);
    assert.deepEqual(planned.updateInTable, []);
    assert.deepEqual(planned.updateInTarget[0]?.values, {
      name: "Launch v2",
      site: "Paris",
    });
    assert.equal(planned.initialized.length, 1);
    assert.equal(current.state.links[0]?.columns?.includes("site"), true);
    assert.equal(changes(plan(current, input)), 0);

    // Older links without `columns` cover every mapped column, as before.
    const legacy = await linkedWorld({ storeBaseValues: false });
    legacy.state = {
      ...legacy.state,
      links: legacy.state.links.map(({ columns: _columns, ...link }) => link),
    };
    edit(legacy.target, "page-1", { amount: 7 });
    const legacyPlan = plan(legacy, { storeBaseValues: false });
    assert.deepEqual(legacyPlan.conflicts, []);
    assert.deepEqual(legacyPlan.updateInTable[0]?.values, { amount: 7 });

    // A hashed column no longer mapped: the hashes cannot be compared, so an
    // empty value never wins.
    const removed = await linkedWorld({ storeBaseValues: false });
    edit(removed.target, "page-1", { name: null });
    const removedPlan = plan(removed, {
      mapping: {
        keyField: "Yayaw ID",
        fields: fields.filter((field) => field.columnId !== "status"),
      },
      storeBaseValues: false,
      conflictRule: "target-wins",
    });
    assert.deepEqual(removedPlan.updateInTable, []);
    assert.deepEqual(removedPlan.updateInTarget[0]?.values, {
      name: "Launch",
    });
  });

  test("a partial read never records a newly mapped column as synced", async () => {
    const current = await linkedWorld();
    edit(current.table, "r1", { site: "Paris" });
    const input = {
      mapping: siteMapping,
      targetRecords: [],
      targetPartial: true,
      conflictRule: "target-wins" as const,
    };
    await run(current, input);
    assert.equal(
      Object.hasOwn(current.state.links[0]?.baseValues ?? {}, "site"),
      false
    );
    edit(current.target, "page-1", { site: null });
    const full = plan(current, { mapping: siteMapping });
    assert.deepEqual(
      full.updateInTarget.map((item) => item.values),
      [{ site: "Paris" }]
    );
    assert.deepEqual(full.updateInTable, []);
  });

  test("validates conflict settings against the mapping and direction", () => {
    const codes = (config: Engine.ConflictConfig) =>
      api
        .validateConflictConfig(config, mapping)
        .map((item) => [item.code, item.columnId, item.severity]);
    assert.deepEqual(
      codes({
        ownership: { notes: "table", amount: "both" },
        columnRules: {
          name: "merge",
          tags: "merge",
          status: "sometimes",
          amount: "manual",
          due: "latest-wins",
        },
      }),
      [
        ["unknown_column", "notes", "error"],
        ["invalid_owner", "amount", "error"],
        ["merge_not_list", "name", "warning"],
        ["invalid_rule", "status", "error"],
        ["rule_on_owned_column", "amount", "warning"],
      ]
    );
    assert.deepEqual(
      codes({
        direction: "push",
        ownership: { amount: "target", name: "table" },
        columnRules: { tags: "merge" },
        resolveConflict: "nope",
      }),
      [
        ["owner_not_written", "amount", "error"],
        ["invalid_resolver", undefined, "error"],
        ["rules_unused", undefined, "warning"],
      ]
    );
    assert.deepEqual(
      codes({ direction: "pull", ownership: { amount: "table" } }),
      [["owner_not_written", "amount", "error"]]
    );
    assert.deepEqual(
      codes({
        direction: "two-way",
        ownership: { amount: "target" },
        columnRules: { tags: "merge", status: "manual" },
        resolveConflict: () => undefined,
      }),
      []
    );
  });
}
