import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  defaultSortConfig,
  listRestockRows,
  type RestockFirstPage,
  restockFirstPage,
} from "../examples/default-sort";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  isSameSorting,
  resolveInitialRowsUse,
} from "../src/components/ui/yayaw-table/utils/initial-rows";
import { initialRowsSuite } from "./initial-rows-suite";

initialRowsSuite(it, { isSameSorting, resolveInitialRowsUse });

// examples/default-sort.ts: the list orders by `orderBy`, then by id.
const BY_START = ["Desk", "Lamp", "Chair"];
const BY_ID = ["Chair", "Desk", "Lamp"];
const RECORD_NAME_PATTERN = /Chair|Desk|Lamp/g;
const SKELETON = 'data-slot="skeleton"';
const EMPTY_STATE = "No data available";

/** Record names in document order, each once. */
const recordOrder = (text: string): string[] => [
  ...new Set(text.match(RECORD_NAME_PATTERN) ?? []),
];

/** A list that records the table's requests and answers once released. */
function heldList() {
  const calls: Record<string, unknown>[] = [];
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    calls,
    list: async (params: Record<string, unknown>) => {
      calls.push(params);
      await released;
      return await listRestockRows(params);
    },
    release: () => release(),
  };
}

/** The demos' table without its Gantt, whose planning lists rows of its own. */
function restockConfig(configuredSort: boolean) {
  const { table, ...config } = defaultSortConfig(configuredSort);
  const { gantt: _gantt, planning: _planning, ...tableOnly } = table;
  return defineTableConfig({
    ...config,
    table: { ...tableOnly, displayModes: ["table"] },
  });
}

function restockTable({
  configuredSort = true,
  firstPage,
  list,
  searchParams,
}: {
  configuredSort?: boolean;
  firstPage: RestockFirstPage;
  list: typeof listRestockRows;
  searchParams?: Record<string, string>;
}) {
  const config = restockConfig(configuredSort);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <Provider store={createStore()}>
      <NuqsTestingAdapter hasMemory searchParams={searchParams}>
        <DataTable
          getRowId={(row) => String(row.id)}
          getTableActions={() => ({ list })}
          getTableConfig={() => config}
          initialData={firstPage.initialData}
          initialDataSort={firstPage.initialDataSort}
          initialPageCount={firstPage.initialPageCount}
          initialRowCount={firstPage.initialRowCount}
          queryClient={client}
          tableType={config.id}
        />
      </NuqsTestingAdapter>
    </Provider>
  );
}

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
/** Lets the table render until `done` holds, for a few frames at most. */
const settleUntil = async (done: () => boolean, frames = 20): Promise<void> => {
  if (done() || frames === 0) {
    return;
  }
  await act(settle);
  await settleUntil(done, frames - 1);
};

async function mount(table: ReturnType<typeof restockTable>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(table);
    await settle();
  });
  return container;
}

it("renders the host's rows on the server under columns.sort, without skeletons", () => {
  for (const sortedLikeTable of [false, true]) {
    const firstPage = restockFirstPage(sortedLikeTable);
    const html = renderToString(
      restockTable({ firstPage, list: listRestockRows })
    );
    expect(recordOrder(html)).toEqual(sortedLikeTable ? BY_START : BY_ID);
    expect(html).not.toContain(SKELETON);
    expect(html).not.toContain(EMPTY_STATE);
  }
});

it("shows rows produced in another order at once, then loads them once in columns.sort", async () => {
  const { calls, list, release } = heldList();
  const container = await mount(
    restockTable({ firstPage: restockFirstPage(false), list })
  );
  expect(recordOrder(container.textContent ?? "")).toEqual(BY_ID);
  expect(container.innerHTML).not.toContain(SKELETON);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderBy).toEqual({ restockFrom: "asc" });

  release();
  await settleUntil(() => calls.length > 1, 5);
  expect(recordOrder(container.textContent ?? "")).toEqual(BY_START);
  expect(calls).toHaveLength(1);
});

it("keeps rows produced in columns.sort without loading them again", async () => {
  const { calls, list, release } = heldList();
  const container = await mount(
    restockTable({ firstPage: restockFirstPage(true), list })
  );
  release();
  await settleUntil(() => calls.length > 0, 5);
  expect(recordOrder(container.textContent ?? "")).toEqual(BY_START);
  expect(container.innerHTML).not.toContain(SKELETON);
  expect(calls).toHaveLength(0);
});

it("loads its own rows when the URL starts it in another sort", async () => {
  const { calls, list, release } = heldList();
  const container = await mount(
    restockTable({
      firstPage: restockFirstPage(true),
      list,
      searchParams: {
        "restock-sort": JSON.stringify([{ id: "name", desc: true }]),
      },
    })
  );
  // The host's rows stand for `columns.sort`, not for the URL's sort.
  expect(recordOrder(container.textContent ?? "")).toEqual([]);
  await settleUntil(() => calls.length > 0);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderBy).toEqual({ name: "desc" });

  release();
  await act(settle);
  expect(recordOrder(container.textContent ?? "")).toEqual([
    "Lamp",
    "Desk",
    "Chair",
  ]);
});

it("keeps the rows of a table without a sort, as before", async () => {
  const { calls, list, release } = heldList();
  const container = await mount(
    restockTable({
      configuredSort: false,
      firstPage: restockFirstPage(false),
      list,
    })
  );
  release();
  await settleUntil(() => calls.length > 0, 5);
  expect(recordOrder(container.textContent ?? "")).toEqual(BY_ID);
  expect(calls).toHaveLength(0);
});
