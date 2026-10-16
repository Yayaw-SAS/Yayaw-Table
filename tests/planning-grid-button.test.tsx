import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TablePlanningConfig } from "../src/components/ui/yayaw-table/planning/types";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const rows = [
  { id: "a", name: "Design", start: "2026-09-14", end: "2026-09-16" },
];

const renderGrid = async (planning: Partial<TablePlanningConfig>) => {
  const config = defineTableConfig({
    id: "planning-grid",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "start", header: "Start", type: "date" },
        { id: "end", header: "End", type: "date" },
      ],
      mandatory: ["name"],
      order: ["name", "start", "end"],
      visible: ["name", "start", "end"],
    },
    table: {
      displayModes: ["table", "gantt"],
      enablePagination: false,
      planning: {
        enabled: true,
        scopeId: "planning-grid",
        sourceId: "tasks",
        ...planning,
      },
      gantt: { titleColumn: "name", startColumn: "start", endColumn: "end" },
    },
    translations: { namespace: "planning-grid", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const actions = {
    list: async () => ({ data: rows, meta: { pageCount: 1, totalCount: 1 } }),
    update: async () => ({ success: true }),
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
            tableType="planning-grid"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  client.clear();
  return container;
};

it("opens an editable planning's task dialog from the first cell", async () => {
  const container = await renderGrid({});
  expect(container.querySelector('button[aria-label="Planning"]')).not.toBe(
    null
  );
});

it("gives a read-only planning no task dialog button in the grid", async () => {
  const container = await renderGrid({
    allowDateEdit: false,
    allowHierarchyEdit: false,
    allowDependencyEdit: false,
  });
  expect(container.textContent).toContain("Design");
  expect(container.querySelector('button[aria-label="Planning"]')).toBe(null);
});
