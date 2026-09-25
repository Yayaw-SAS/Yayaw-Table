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
const rows = [
  {
    id: "a",
    code: "T-a",
    name: "Design",
    start: "2026-09-14",
    end: "2026-09-16",
    parentId: null,
  },
  {
    id: "b",
    code: "T-b",
    name: "Build",
    start: "2026-09-17",
    end: "2026-09-21",
    parentId: null,
  },
];

it("titles bars with the first visible data column by default", async () => {
  const config = defineTableConfig({
    id: "gantt-title",
    columns: {
      definitions: [
        { id: "code", header: "Code", type: "text" },
        { id: "name", header: "Name", type: "text" },
        { id: "start", header: "Start", type: "date" },
        { id: "end", header: "End", type: "date" },
      ],
      mandatory: ["name"],
      order: ["select", "code", "name", "start", "end"],
      visible: ["name", "start", "end"],
    },
    table: {
      defaultDisplayMode: "gantt",
      displayModes: ["table", "gantt"],
      enablePagination: false,
      planning: { enabled: true, scopeId: "gantt-title", sourceId: "tasks" },
      gantt: {
        startColumn: "start",
        endColumn: "end",
        parentColumn: "parentId",
      },
    },
    translations: { namespace: "gantt-title", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialData={rows}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="gantt-title"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  const labels = Array.from(container.querySelectorAll("[aria-label]")).map(
    (element) => element.getAttribute("aria-label") ?? ""
  );
  const bar = labels.find((label) => label.includes("9/14/26"));
  expect(bar).toContain("Design");
  expect(bar).not.toContain("T-a");
  client.clear();
});
