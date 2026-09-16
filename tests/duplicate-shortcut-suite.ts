import assert from "node:assert/strict";
import type { createSelectionDuplicate } from "../src/components/ui/yayaw-table/utils/duplicate-shortcut";

export function duplicateShortcutSuite(
  test: (name: string, run: () => Promise<void>) => void,
  create: typeof createSelectionDuplicate
) {
  const setup = (fail = false, allowed = true) => {
    const calls: string[] = [];
    const successes: number[] = [];
    const errors: (string | undefined)[] = [];
    let selected: Record<string, unknown>[] = [
      { id: "one" },
      { id: "two" },
      { id: "one" },
    ];
    let refreshed = 0;
    const run = create({
      rows: () => selected,
      getId: (row) => String(row.id),
      canDuplicate: () => allowed,
      action: () => (id) => {
        calls.push(id);
        return {
          success: !(fail && id === "two"),
          data: { id: `${id}-copy` },
          error: "Storage unavailable",
        };
      },
      refresh: () => {
        refreshed += 1;
        return Promise.resolve();
      },
      select: (rows) => {
        selected = rows;
      },
      success: (count) => successes.push(count),
      error: (message) => errors.push(message),
    });
    return {
      run,
      calls,
      successes,
      errors,
      selected: () => selected,
      refreshed: () => refreshed,
    };
  };
  test("duplicates each selected record once, refreshes once and selects returned copies", async () => {
    const f = setup();
    await f.run();
    assert.deepEqual(f.calls, ["one", "two"]);
    assert.deepEqual(f.selected(), [{ id: "one-copy" }, { id: "two-copy" }]);
    assert.deepEqual(f.successes, [2]);
    assert.equal(f.refreshed(), 1);
  });
  test("preserves unfinished records and avoids claiming full success on partial failure", async () => {
    const f = setup(true);
    await f.run();
    assert.deepEqual(f.selected(), [{ id: "one-copy" }, { id: "two" }]);
    assert.deepEqual(f.successes, []);
    assert.equal(f.errors.length, 1);
    assert.equal(f.refreshed(), 1);
  });
  test("checks row permissions and prevents concurrent duplication", async () => {
    const denied = setup(false, false);
    await denied.run();
    assert.deepEqual(denied.calls, []);
    const f = setup();
    await Promise.all([f.run(), f.run()]);
    assert.deepEqual(f.calls, ["one", "two"]);
  });
}
