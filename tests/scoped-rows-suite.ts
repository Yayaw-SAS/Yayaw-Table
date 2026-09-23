import assert from "node:assert/strict";
import type * as Scoped from "../src/components/ui/yayaw-table/utils/scoped-rows";

type ScopedModule = Pick<
  typeof Scoped,
  "loadScopedRows" | "rowInScope" | "localDayKey" | "ScopedRowsOverflowError"
>;

const september = {
  kind: "dateRange" as const,
  field: "start",
  endField: "end",
  from: "2026-09-01",
  to: "2026-09-30",
};

const rows = [
  { id: "inside", start: "2026-09-10", end: "2026-09-12" },
  { id: "spans-into", start: "2026-08-28", end: "2026-09-02" },
  { id: "after", start: "2026-10-01", end: "2026-10-03" },
  { id: "undated", start: null },
  { id: "single-day", start: "2026-09-30" },
];

const pagedList = (
  data: Record<string, unknown>[],
  meta: Record<string, unknown> = {}
) => {
  const calls: Record<string, unknown>[] = [];
  const list = (params: Record<string, unknown>) => {
    calls.push(params);
    const page = Number(params.page);
    const size = Number(params.pageSize);
    return Promise.resolve({
      data: data.slice((page - 1) * size, page * size),
      meta: { pageCount: Math.ceil(data.length / size), ...meta },
    });
  };
  return { calls, list };
};

export function scopedRowsSuite(
  test: (name: string, run: () => Promise<void> | void) => void,
  scoped: ScopedModule
) {
  test("keeps rows whose date span overlaps the window, in local days", () => {
    const ids = rows
      .filter((row) => scoped.rowInScope(row, september))
      .map((row) => row.id);
    assert.deepEqual(ids, ["inside", "spans-into", "single-day"]);
    assert.equal(scoped.localDayKey("2026-09-10"), "2026-09-10");
    assert.equal(
      scoped.localDayKey(new Date(2026, 8, 10, 23, 30)),
      "2026-09-10"
    );
    assert.equal(scoped.localDayKey("not a date"), undefined);
  });

  test("sends the scope and filters on the client when the server ignores it", async () => {
    const { calls, list } = pagedList(rows);
    const result = await scoped.loadScopedRows({
      list,
      pageSize: 2,
      params: { search: "x" },
      scope: september,
    });
    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["inside", "spans-into", "single-day"]
    );
    assert.equal(result.scopeApplied, "client");
    assert.equal(result.truncated, false);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0]?.scope, september);
    assert.equal(calls[0]?.search, "x");
  });

  test("trusts rows from a server that applied the scope", async () => {
    const { list } = pagedList(rows, { scope: "applied" });
    const result = await scoped.loadScopedRows({ list, scope: september });
    assert.equal(result.rows.length, rows.length);
    assert.equal(result.scopeApplied, "server");
  });

  test("truncates or refuses results above the row cap", async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      start: "2026-09-15",
    }));
    const { list } = pagedList(many);
    const truncated = await scoped.loadScopedRows({
      list,
      pageSize: 10,
      maxRows: 12,
      scope: september,
    });
    assert.equal(truncated.rows.length, 12);
    assert.equal(truncated.truncated, true);
    await assert.rejects(
      scoped.loadScopedRows({
        list,
        pageSize: 10,
        maxRows: 12,
        overflow: "throw",
      }),
      scoped.ScopedRowsOverflowError
    );
  });

  test("filters local rows when there is no list action", async () => {
    const result = await scoped.loadScopedRows({ rows, scope: september });
    assert.equal(result.rows.length, 3);
    assert.equal(result.scopeApplied, "client");
  });

  test("stops when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { list } = pagedList(rows);
    await assert.rejects(
      scoped.loadScopedRows({ list, signal: controller.signal })
    );
  });
}
