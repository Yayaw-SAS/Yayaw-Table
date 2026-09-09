import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import rows from "./fixtures/grouped-rows.json";

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
async function mountGroups(grouping = ["category"], selection = true) {
  const config = defineTableConfig({
    id: "grouped",
    columns: {
      mandatory: ["name"],
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "category",
          header: "Category",
          type: "select",
          accessorFn: (row: Record<string, unknown>) => row.kind,
          options: [
            { value: 0, label: "Web" },
            { value: 1, label: "Print" },
          ],
          inlineEdit: true,
        },
        { id: "active", header: "Active", type: "boolean" },
        {
          id: "country",
          header: "Country",
          type: "select",
          options: [{ value: 1, label: "France" }],
        },
        {
          id: "amount",
          header: "Amount",
          type: "number",
          enableGrouping: false,
        },
      ],
      visible: ["select", "name", "category", "active", "country", "amount"],
      order: ["select", "name", "category", "active", "country", "amount"],
    },
    table: {
      enableGrouping: true,
      enablePagination: false,
      enableRowSelection: selection,
      canSelectRow: (row) => row.id !== "2",
      preserveSelectionOnQuery: true,
    },
    translations: { namespace: "grouped", keys: {} },
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
          searchParams={{ "grouped-grouping": JSON.stringify(grouping) }}
        >
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialData={rows}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="grouped"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  return container;
}
const groupButtons = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>("tbody button[aria-expanded]")
  );

it("renders accessor option labels without automatic category sums and preserves expanded cell values", async () => {
  const container = await mountGroups();
  const groups = groupButtons(container);
  expect(groups).toHaveLength(2);
  expect(groups[0]?.textContent).toContain("Category:Web3");
  expect(groups[0]?.closest("tr")?.querySelectorAll("td")).toHaveLength(2);
  await act(() => groups[0]?.click());
  expect(groupButtons(container)[0]?.getAttribute("aria-expanded")).toBe(
    "false"
  );
  await act(() => groups[0]?.click());
  const leaves = Array.from(container.querySelectorAll("tbody tr")).filter(
    (row) => !row.querySelector("button[aria-expanded]")
  );
  expect(leaves).toHaveLength(4);
  for (const leaf of leaves.slice(0, 3)) {
    expect(leaf.textContent).toContain("Web");
    expect(leaf.textContent).toContain("France");
  }
});

it("counts and selects permitted leaf records at two levels", async () => {
  const container = await mountGroups(["category", "active"]);
  const group = groupButtons(container)[0];
  expect(group?.textContent).toContain("Web3");
  expect(container.textContent).toContain("Active:false2");
  const checkbox = group
    ?.closest("tr")
    ?.querySelector<HTMLButtonElement>('[aria-label="Select group"]');
  await act(() => checkbox?.click());
  expect(checkbox?.getAttribute("aria-checked")).toBe("true");
  const leaves = Array.from(container.querySelectorAll("tbody tr")).filter(
    (row) => !row.querySelector("button[aria-expanded]")
  );
  expect(leaves).toHaveLength(4);
  expect(
    leaves[0]?.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")
  ).toBe("true");
  expect(
    leaves[1]?.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")
  ).toBe("false");
});

it("spans visible columns without a phantom checkbox when selection is disabled", async () => {
  const container = await mountGroups(["category"], false);
  const group = groupButtons(container)[0]?.closest("tr");
  expect(group?.querySelector('[role="checkbox"]')).toBeNull();
  expect(group?.querySelectorAll("td")).toHaveLength(1);
  expect(group?.querySelector("td")?.getAttribute("colspan")).toBe(
    String(container.querySelectorAll("thead th").length)
  );
});
