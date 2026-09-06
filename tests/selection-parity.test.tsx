import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type RowSelectionState,
  useYayawTable,
} from "@/components/ui/yayaw-table/tanstack";
import { useBulkActions } from "../src/components/ui/yayaw-table/hooks/use-bulk-actions";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import {
  defaultTranslations,
  type TableActions,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const records = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
  { id: "3", name: "Gamma" },
];
type RecordRow = (typeof records)[number];
const roots: Root[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  for (const client of clients.splice(0)) {
    client.clear();
  }
  document.body.replaceChildren();
});
async function mountSelection(
  actions: TableActions = {},
  preserveSelectionOnQuery = false
) {
  let current!: {
    bulk: ReturnType<typeof useBulkActions<RecordRow>>;
    select: (ids: RowSelectionState) => void;
    page: (data: RecordRow[]) => void;
    url: ReturnType<typeof useTableUrlState>;
  };
  function Probe() {
    const [data, setData] = useState(records.slice(0, 1));
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const table = useYayawTable({
      data,
      columns: [{ accessorKey: "name" }],
      getRowId: (row) => row.id,
      state: { rowSelection },
      onRowSelectionChange: setRowSelection,
      enableRowSelection: (row) => row.original.id !== "3",
      manualPagination: true,
    });
    current = {
      bulk: useBulkActions({
        preserveSelectionOnQuery,
        table,
        tableId: "selection",
        tableType: "selection",
        rowCount: 3,
      }),
      select: setRowSelection,
      page: setData,
      url: useTableUrlState({ tableId: "selection" }),
    };
    return (
      <span>
        {current.bulk.selectedRows.map((row) => row.original.name).join(",")}
      </span>
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <TableProvider
            getTableActions={() => actions}
            queryClient={client}
            tableId="selection"
            translations={defaultTranslations}
          >
            <Probe />
          </TableProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  return {
    get current() {
      return current;
    },
    container,
  };
}

it("preserves selected rows across query changes when configured", async () => {
  const view = await mountSelection({}, true);
  await act(() => view.current.select({ "1": true }));
  await act(async () => {
    view.current.url.setGlobalSearchFromUI("other");
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(view.container.textContent).toBe("Alpha");
});

it("keeps manually selected rows across server pages, refreshes loaded records and removes only unchecked IDs", async () => {
  const view = await mountSelection();
  await act(() => view.current.select({ "1": true }));
  await act(() => view.current.page(records.slice(1, 2)));
  expect(view.container.textContent).toBe("Alpha");
  await act(() => view.current.select({ "1": true, "2": true }));
  expect(view.container.textContent).toBe("Alpha,Beta");
  await act(() => view.current.page([{ id: "1", name: "Updated" }]));
  expect(view.container.textContent).toBe("Updated,Beta");
  await act(() => view.current.select({ "2": true }));
  expect(view.container.textContent).toBe("Beta");
  await act(async () => {
    view.current.url.setGlobalSearchFromUI("other");
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(view.container.textContent).toBe("");
});

it("selects all permitted records across capped pages and keeps off-page rows after deselection", async () => {
  const view = await mountSelection({
    list: async (params) => ({
      data: records.slice(Number(params.page) - 1, Number(params.page)),
      meta: { pageCount: 3, totalCount: 3 },
    }),
  });
  await act(() => view.current.select({ "1": true }));
  await act(() => view.current.bulk.handleSelectAll());
  expect(view.container.textContent).toBe("Alpha,Beta");
  await act(() => view.current.select({ "2": true }));
  expect(view.container.textContent).toBe("Beta");
});

it("does not overwrite a newer manual selection with a delayed select-all response", async () => {
  let resolve!: (value: {
    data: RecordRow[];
    meta: { totalCount: number; pageCount: number };
  }) => void;
  const pending = new Promise<{
    data: RecordRow[];
    meta: { totalCount: number; pageCount: number };
  }>((done) => {
    resolve = done;
  });
  const view = await mountSelection({ list: async () => await pending });
  await act(() => view.current.select({ "1": true }));
  let selection!: Promise<void>;
  await act(() => {
    selection = view.current.bulk.handleSelectAll();
  });
  await act(() => view.current.select({}));
  await act(async () => {
    resolve({ data: records, meta: { totalCount: 3, pageCount: 1 } });
    await selection;
  });
  expect(view.container.textContent).toBe("");
});
