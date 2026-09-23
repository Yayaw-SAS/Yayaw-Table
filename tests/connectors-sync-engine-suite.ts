import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/connectors/connector-model";
import type * as Engine from "../src/components/ui/yayaw-table/connectors/sync-engine";

type SyncEngineApi = Pick<typeof Model, "ConnectorError"> &
  Pick<
    typeof Engine,
    | "applySyncPlan"
    | "hashSyncValues"
    | "nextSyncState"
    | "normalizeSyncValue"
    | "planSync"
    | "summarizeSyncPlan"
    | "toSyncMapping"
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
}
