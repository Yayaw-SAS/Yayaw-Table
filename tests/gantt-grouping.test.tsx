import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const rows = [
  {
    id: "a",
    name: "Design",
    team: "Product",
    start: "2026-09-14",
    end: "2026-09-16",
  },
  {
    id: "b",
    name: "Build",
    team: null,
    start: "2026-09-17",
    end: "2026-09-21",
  },
  {
    id: "c",
    name: "Ship",
    team: "Product",
    start: "2026-09-22",
    end: "2026-09-23",
  },
];

it("groups the timeline by the first grouping level and collapses a group", async () => {
  const config = defineTableConfig({
    id: "gantt-group",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "team", header: "Team", type: "text" },
        { id: "start", header: "Start", type: "date" },
        { id: "end", header: "End", type: "date" },
      ],
      mandatory: ["name"],
      order: ["select", "name", "team", "start", "end"],
      visible: ["name", "team", "start", "end"],
    },
    table: {
      defaultDisplayMode: "gantt",
      displayModes: ["table", "gantt"],
      enableGrouping: true,
      enablePagination: false,
      enableRowSelection: true,
      planning: { enabled: true, scopeId: "gantt-group", sourceId: "tasks" },
      gantt: { titleColumn: "name", startColumn: "start", endColumn: "end" },
    },
    translations: { namespace: "gantt-group", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const actions = {
    list: async () => ({
      data: rows,
      meta: { pageCount: 1, totalCount: rows.length },
    }),
  };
  try {
    await act(async () => {
      root.render(
        <Provider store={createStore()}>
          <NuqsTestingAdapter
            hasMemory
            // A second level is ignored, as in List.
            searchParams={{
              "gantt-group-grouping": JSON.stringify(["team", "name"]),
            }}
          >
            <DataTable
              getTableActions={() => actions}
              getTableConfig={() => config}
              initialData={rows}
              initialPageCount={1}
              initialRowCount={rows.length}
              queryClient={client}
              tableType="gantt-group"
            />
          </NuqsTestingAdapter>
        </Provider>
      );
      await settle();
    });
    await act(settle);
    const headings = () =>
      Array.from(
        container.querySelectorAll('button[aria-label*="Team: "]'),
        (button) =>
          `${button.getAttribute("aria-label")} ${button.getAttribute("aria-expanded")}`
      );
    const bars = () =>
      container.querySelectorAll('button[aria-label^="Move "]');
    expect(headings()).toEqual([
      "Collapse Team: Product true",
      "Collapse Team: No value true",
    ]);
    expect(bars()).toHaveLength(3);
    // Grouped table rows still hand every task its own selection cell.
    expect(container.querySelectorAll('[data-slot="checkbox"]').length).toBe(3);
    const product = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Team: Product"]'
    );
    await act(async () => {
      product?.click();
      await settle();
    });
    expect(headings()[0]).toBe("Expand Team: Product false");
    // The heading keeps its count while its tasks are hidden.
    expect(product?.parentElement?.textContent).toContain("2");
    expect(bars()).toHaveLength(1);
  } finally {
    await act(() => root.unmount());
    container.remove();
    client.clear();
  }
});
