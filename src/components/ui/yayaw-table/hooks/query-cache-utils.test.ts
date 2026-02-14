import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateAndRefetchTableData,
  invalidateTableDataQuery,
} from "./query-cache-utils";

describe("query-cache-utils", () => {
  it("invalidates tableData query with tableId key", async () => {
    const invalidationCalls: Array<{ queryKey: unknown[] }> = [];

    const queryClient = {
      invalidateQueries: (filters: { queryKey: unknown[] }) => {
        invalidationCalls.push(filters);
        return Promise.resolve();
      },
    } as unknown as Pick<QueryClient, "invalidateQueries">;

    await invalidateTableDataQuery({
      queryClient,
      tableId: "products",
    });

    assert.equal(invalidationCalls.length, 1);
    assert.deepEqual(invalidationCalls[0], {
      queryKey: ["tableData", "products"],
    });
  });

  it("invalidates and refetches with the same shared client", async () => {
    const invalidationCalls: Array<{ queryKey: unknown[] }> = [];
    let refetchCalls = 0;

    const queryClient = {
      invalidateQueries: (filters: { queryKey: unknown[] }) => {
        invalidationCalls.push(filters);
        return Promise.resolve();
      },
    } as unknown as Pick<QueryClient, "invalidateQueries">;

    const result = await invalidateAndRefetchTableData({
      queryClient,
      refetch: () => {
        refetchCalls += 1;
        return Promise.resolve({
          data: [{ id: "row-1", name: "Updated" }],
          pageCount: 1,
          rowCount: 1,
        });
      },
      tableId: "products",
    });

    assert.equal(invalidationCalls.length, 1);
    assert.deepEqual(invalidationCalls[0], {
      queryKey: ["tableData", "products"],
    });
    assert.equal(refetchCalls, 1);
    assert.deepEqual(result.data, [{ id: "row-1", name: "Updated" }]);
  });
});
