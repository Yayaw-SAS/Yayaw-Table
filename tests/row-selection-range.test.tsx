import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import rows from "./fixtures/row-selection-range.json";

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
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
async function mountRange(grouped = false, multi = true) {
  const config = defineTableConfig({
    id: "range",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "category", header: "Category", type: "text" },
      ],
      visible: ["select", "name", "category"],
      order: ["select", "name", "category"],
    },
    table: {
      enableRowSelection: true,
      enableMultiRowSelection: multi,
      enablePagination: false,
      canSelectRow: (row) => row.id !== "2",
      preserveSelectionOnQuery: true,
    },
    translations: { namespace: "range", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const actions = {
    list: async () => ({
      data: rows,
      meta: { pageCount: 1, totalCount: rows.length },
    }),
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          searchParams={{
            "range-grouping": JSON.stringify(grouped ? ["category"] : []),
          }}
        >
          <DataTable
            getRowId={(row) => String(row.id)}
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialData={rows}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="range"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  return container;
}
function rowCheckbox(container: HTMLElement, id: string): HTMLElement {
  const checkbox = container.querySelector<HTMLElement>(
    `[data-yayaw-table-selection-row-id="${id}"]`
  );
  if (!checkbox) {
    throw new Error(`Missing selection checkbox: ${id}`);
  }
  return checkbox;
}
async function clickRow(container: HTMLElement, id: string, shiftKey = false) {
  await act(() =>
    rowCheckbox(container, id).dispatchEvent(
      new MouseEvent("click", { bubbles: true, shiftKey })
    )
  );
}
function selectedIds(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll(
      '[data-yayaw-table-selection-row-id][aria-checked="true"]'
    )
  ).map((element) => element.getAttribute("data-yayaw-table-selection-row-id"));
}
it("selects and clears inclusive ranges, skips disabled rows, preserves other selections and refreshes the header", async () => {
  const container = await mountRange();
  await clickRow(container, "5");
  await clickRow(container, "1");
  await clickRow(container, "3", true);
  expect(selectedIds(container)).toEqual(["1", "3", "5"]);
  expect(
    container
      .querySelector('[aria-label="Select all rows"]')
      ?.getAttribute("aria-checked")
  ).toBe("mixed");
  await clickRow(container, "4", true);
  expect(selectedIds(container)).toEqual(["1", "3", "4", "5"]);
  expect(
    container
      .querySelector('[aria-label="Select all rows"]')
      ?.getAttribute("aria-checked")
  ).toBe("true");
  await clickRow(container, "3", true);
  expect(selectedIds(container)).toEqual(["4", "5"]);
});
it("keeps normal toggles when Shift has no anchor or multi-selection is disabled", async () => {
  const container = await mountRange(false, false);
  await clickRow(container, "1", true);
  expect(selectedIds(container)).toEqual(["1"]);
  await clickRow(container, "4", true);
  expect(selectedIds(container)).toEqual(["4"]);
});
it("follows visible grouped order and invalidates the anchor after a group collapses", async () => {
  const container = await mountRange(true);
  await clickRow(container, "1");
  await clickRow(container, "4", true);
  expect(selectedIds(container)).toEqual(["1", "3", "4"]);
  expect(
    container
      .querySelector('[aria-label="Select group"]')
      ?.getAttribute("aria-checked")
  ).toBe("true");
  const group = container.querySelector<HTMLElement>(
    "tbody button[aria-expanded]"
  );
  if (!group) {
    throw new Error("Missing group toggle");
  }
  await act(() => group.click());
  await clickRow(container, "5", true);
  expect(selectedIds(container)).toEqual(["4", "5"]);
});
it("keeps selection anchors isolated between mounted tables", async () => {
  const first = await mountRange();
  const second = await mountRange();
  await clickRow(first, "1");
  await clickRow(second, "4", true);
  expect(selectedIds(first)).toEqual(["1"]);
  expect(selectedIds(second)).toEqual(["4"]);
});
