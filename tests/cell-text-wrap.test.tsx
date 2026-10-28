import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const rows = [{ id: "1", name: "A long name that should wrap in its column" }];

it("wraps long cell text within a capped width instead of widening the column", async () => {
  const config = defineTableConfig({
    id: "wrap",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      mandatory: ["name"],
      visible: ["name"],
      order: ["name"],
    },
    table: { enablePagination: false },
    translations: { namespace: "wrap", keys: {} },
  });
  const client = new QueryClient();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const actions = {
    list: async () => ({ data: rows, meta: { pageCount: 1, totalCount: 1 } }),
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialData={rows}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="wrap"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  client.clear();
  const content = container.querySelector(
    'tbody td[data-column-id="name"] > div'
  );
  expect(content?.className).toContain("whitespace-normal");
  expect(content?.className).toContain("max-w-120");
});
