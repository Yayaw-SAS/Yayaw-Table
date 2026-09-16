import assert from "node:assert/strict";
import type {
  createActivityUndo,
  TableActivityRecord,
} from "../src/components/ui/yayaw-table/utils/activity-shortcuts";
import type { DetailRevertHandler } from "../src/components/ui/yayaw-table/utils/record-details";

export function activityShortcutsSuite(
  test: (name: string, run: () => Promise<void>) => void,
  create: typeof createActivityUndo
): void {
  const record = (id: string, transactionId?: string): TableActivityRecord => ({
    row: { id, deletedAt: "2026-09-16" },
    activity: [
      {
        id: `delete-${id}`,
        at: "2026-09-16T12:00:00Z",
        actor: { name: "User" },
        action: "trash",
        reversible: true,
        transactionId,
        changes: [{ field: "deletedAt", before: null, after: "2026-09-16" }],
      },
    ],
  });
  const setup = (
    records: TableActivityRecord[],
    handler: DetailRevertHandler,
    canRevert = true
  ) => {
    const errors: (string | undefined)[] = [];
    let unavailable = 0;
    let refreshed = 0;
    const controller = create({
      rows: () => [],
      config: () => ({ history: () => records, canRevert: () => canRevert }),
      handler: () => handler,
      onReverted: () => {
        refreshed += 1;
        return Promise.resolve();
      },
      onError: (error) => {
        errors.push(error);
      },
      onUnavailable: () => {
        unavailable += 1;
      },
    });
    return {
      controller,
      errors,
      get unavailable() {
        return unavailable;
      },
      get refreshed() {
        return refreshed;
      },
    };
  };
  test("undoes a removed record using the existing record activity handler", async () => {
    const calls: string[] = [];
    const f = setup([record("one")], (row, entry) => {
      calls.push(`${row.id}:${entry.id}`);
      return Promise.resolve({ success: true });
    });
    await f.controller.undo();
    await f.controller.undo();
    assert.deepEqual(calls, ["one:delete-one"]);
    assert.equal(f.refreshed, 1);
    assert.equal(f.unavailable, 1);
  });
  test("undoes an entire bulk operation with one shortcut", async () => {
    const calls: unknown[] = [];
    const f = setup([record("one", "batch"), record("two", "batch")], (row) => {
      calls.push(row.id);
      return Promise.resolve({ success: true });
    });
    await f.controller.undo();
    assert.deepEqual(calls, ["one", "two"]);
    assert.equal(f.refreshed, 1);
  });
  test("keeps failed inverses available for retry without replaying successful ones", async () => {
    let fail = true;
    const calls: unknown[] = [];
    const f = setup([record("one", "batch"), record("two", "batch")], (row) => {
      calls.push(row.id);
      return Promise.resolve({
        success: row.id === "one" || !fail,
        error: "Retry restoration",
      });
    });
    await f.controller.undo();
    assert.equal(f.refreshed, 1);
    fail = false;
    await f.controller.undo();
    assert.deepEqual(calls, ["one", "two", "two"]);
    assert.deepEqual(f.errors, ["Retry restoration"]);
  });
  test("blocks conflicting changes and unavailable permissions", async () => {
    let calls = 0;
    const item = record("one");
    const original = item.activity[0];
    assert.ok(original);
    item.activity = [
      {
        ...original,
        id: "newer",
        at: "2026-09-16T13:00:00Z",
        reversible: false,
      },
      ...item.activity,
    ];
    const f = setup([item], () => {
      calls += 1;
      return Promise.resolve({ success: true });
    });
    await f.controller.undo();
    const denied = setup(
      [record("two")],
      () => {
        calls += 1;
        return Promise.resolve({ success: true });
      },
      false
    );
    await denied.controller.undo();
    assert.equal(calls, 0);
    assert.equal(f.unavailable, 1);
    assert.equal(denied.unavailable, 1);
  });
  test("does not run concurrent undo requests", async () => {
    let finish: (result: { success: boolean }) => void = () => undefined;
    let calls = 0;
    const f = setup([record("one")], () => {
      calls += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const first = f.controller.undo();
    await f.controller.undo();
    finish({ success: true });
    await first;
    assert.equal(calls, 1);
    assert.equal(f.refreshed, 1);
  });
}
