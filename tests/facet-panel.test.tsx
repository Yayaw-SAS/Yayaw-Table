import "./setup-dom";
import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createAssetActions } from "../examples/assets";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  aggregateChartRows,
  type ChartAggregateRequest,
} from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import type {
  DashboardBlockProps,
  DashboardBlockRegistry,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-block";
import { YayawDashboard } from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";

type Row = Record<string, unknown>;

const originalGetAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getAnimations"
);
beforeAll(() => {
  // Happy DOM does not implement the animation API used by Base UI.
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
});
afterAll(() => {
  if (originalGetAnimations) {
    Object.defineProperty(
      Element.prototype,
      "getAnimations",
      originalGetAnimations
    );
  } else {
    Reflect.deleteProperty(Element.prototype, "getAnimations");
  }
});

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});
const settle = async (ms = 60, frames = 5) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
  }
};
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
};
const click = async (element: Element | null | undefined) => {
  await act(async () => {
    (element as HTMLElement | null)?.click();
    await Promise.resolve();
  });
};

const ROWS: Row[] = [
  { id: "1", name: "Alpha", category: "software", tags: ["new"] },
  { id: "2", name: "Bravo", category: "hardware", tags: ["new", "sale"] },
  { id: "3", name: "Charlie", category: "software", tags: [] },
  { id: "4", name: "Delta", category: "", tags: ["sale"] },
];

const matches = (row: Row, params: Row) => {
  const query = compatibleListParams(params);
  const rules = query.advancedFilters as Row[];
  return rules.every((rule) =>
    matchesContractFilter(row[String(rule.columnId)], rule)
  );
};

const productsConfig = defineTableConfig({
  id: "facet-products",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: "software", label: "Software" },
          { value: "hardware", label: "Hardware" },
        ],
      },
      {
        id: "tags",
        header: "Tags",
        type: "multiSelect",
        options: [
          { value: "new", label: "New" },
          { value: "sale", label: "On sale" },
        ],
      },
    ],
    order: ["name", "category", "tags"],
    visible: ["name", "category", "tags"],
    mandatory: ["name"],
  },
  table: {
    syncUrl: false,
    enableViews: false,
    facets: { columns: ["category", "tags"] },
  },
  translations: { namespace: "facet-products", keys: { title: "Products" } },
});

it("lists each value with its records and filters on click, the counts leaving the facet's own rule out", async () => {
  const lists: Row[] = [];
  const aggregates: Row[] = [];
  const actions = {
    list: (params: Row) => {
      lists.push(params);
      const data = ROWS.filter((row) => matches(row, params));
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
    aggregate: (params: Row) => {
      aggregates.push(params);
      return Promise.resolve(
        aggregateChartRows(
          ROWS.filter((row) => matches(row, params)),
          params as unknown as ChartAggregateRequest
        )
      );
    },
  } as unknown as TableActions;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { container, root } = mount();
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <DataTable
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions}
          getTableConfig={() => productsConfig}
          queryClient={client}
          tableType="facet-products"
        />
      </NuqsTestingAdapter>
    )
  );
  await settle();
  const panel = container.querySelector("[data-facet-panel]");
  expect(panel).not.toBeNull();
  expect(panel?.getAttribute("data-position")).toBe("left");
  const counts = (facet: string) =>
    [
      ...container.querySelectorAll(
        `[data-facet="${facet}"] button[data-facet-value]`
      ),
    ].map((button) => [
      button.getAttribute("data-facet-value"),
      button.querySelector("[data-facet-count]")?.textContent,
      button.getAttribute("aria-pressed"),
    ]);
  expect(counts("category")).toEqual([
    ["software", "2", "false"],
    ["hardware", "1", "false"],
    ["", "1", "false"],
  ]);
  expect(counts("tags")).toEqual([
    ["new", "2", "false"],
    ["sale", "2", "false"],
    ["", "1", "false"],
  ]);
  // Counts are aggregate groups: grouped by the column, counted.
  expect(aggregates.map((params) => params.groupBy)).toContainEqual([
    { columnId: "category" },
  ]);
  aggregates.length = 0;
  await click(
    container.querySelector(
      '[data-facet="category"] button[data-facet-value="software"]'
    )
  );
  await settle();
  const rule = ((lists.at(-1)?.advancedFilters ?? []) as Row[]).find(
    (item) => item.columnId === "category"
  );
  expect([rule?.type, rule?.operator, rule?.values]).toEqual([
    "select",
    "isAnyOf",
    ["software"],
  ]);
  expect(container.textContent).toContain("Charlie");
  expect(container.textContent).not.toContain("Bravo");
  // The category's own counts leave its rule out; the tags' keep it.
  const byColumn = (columnId: string) =>
    aggregates.find(
      (params) =>
        (params.groupBy as { columnId: string }[])[0]?.columnId === columnId
    );
  expect(byColumn("category")?.advancedFilters).toEqual([]);
  expect(
    (byColumn("tags")?.advancedFilters as Row[]).map((item) => item.columnId)
  ).toEqual(["category"]);
  expect(counts("category")[0]).toEqual(["software", "2", "true"]);
  expect(counts("tags")).toEqual([
    ["new", "1", "false"],
    ["", "1", "false"],
  ]);
  // Lists write `contains`; "Clear all" removes the facets' rules only.
  await click(
    container.querySelector(
      '[data-facet="tags"] button[data-facet-value="new"]'
    )
  );
  await settle();
  const tags = ((lists.at(-1)?.advancedFilters ?? []) as Row[]).find(
    (item) => item.columnId === "tags"
  );
  expect([tags?.type, tags?.operator, tags?.values]).toEqual([
    "multiSelect",
    "contains",
    ["new"],
  ]);
  await click(container.querySelector("[data-facet-clear-all]"));
  await settle();
  // Back to every record (the first answer, cached).
  expect(container.textContent).toContain("Bravo");
  expect(
    container.querySelectorAll('[data-facet-panel] [aria-pressed="true"]')
  ).toHaveLength(0);
  // The toolbar button hides the panel.
  const toggle = container.querySelector("[data-facets-toggle]");
  expect(toggle?.getAttribute("aria-pressed")).toBe("true");
  await click(toggle);
  await settle(30, 2);
  expect(container.querySelector("[data-facet-panel]")).toBeNull();
  expect(toggle?.getAttribute("aria-pressed")).toBe("false");
  client.clear();
});

it("offers New folder outside the File tree and creates the folder under the chosen parent", async () => {
  const actions = createAssetActions();
  const created: Row[] = [];
  const createFolder = actions.tree.createFolder;
  actions.tree.createFolder = (input) => {
    created.push(input);
    return createFolder(input);
  };
  const config = defineTableConfig({
    id: "facet-assets",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "kind",
          header: "Kind",
          type: "select",
          options: [
            { value: "folder", label: "Folder" },
            { value: "file", label: "File" },
          ],
        },
        { id: "parentId", header: "Folder", type: "text" },
      ],
      order: ["name", "kind", "parentId"],
      visible: ["name", "kind"],
      mandatory: ["name"],
    },
    table: {
      syncUrl: false,
      enableViews: false,
      defaultDisplayMode: "gallery",
      displayModes: ["filetree", "gallery", "table"],
      filetree: { parentColumn: "parentId", kindColumn: "kind" },
    },
    translations: { namespace: "facet-assets", keys: { title: "Assets" } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { container, root } = mount();
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <DataTable
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions as unknown as TableActions}
          getTableConfig={() => config}
          queryClient={client}
          tableType="facet-assets"
        />
      </NuqsTestingAdapter>
    )
  );
  await settle();
  const button = container.querySelector("[data-new-folder]");
  expect(button?.textContent).toContain("New folder");
  await click(button);
  await settle();
  const dialog = document.querySelector("[data-new-folder-dialog]");
  expect(dialog).not.toBeNull();
  // The root is chosen first; folders show their location.
  expect(
    dialog?.querySelector("[data-folder-root]")?.getAttribute("aria-pressed")
  ).toBe("true");
  const spring = dialog?.querySelector('[data-folder-option="f-spring"]');
  expect(spring?.textContent).toContain("Campaigns › 2026");
  await click(spring);
  const name = dialog?.querySelector<HTMLInputElement>(
    "[data-new-folder-name]"
  );
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(name, "  Summer  ");
    name?.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
  await click(dialog?.querySelector("[data-new-folder-create]"));
  await settle();
  expect(created).toEqual([{ parentId: "f-spring", name: "Summer" }]);
  expect(document.querySelector("[data-new-folder-dialog]")).toBeNull();
  client.clear();
});

it("lets blocks set a screen filter as the filter bar does, and refuses values it cannot take", async () => {
  const results: unknown[] = [];
  const rules: unknown[] = [];
  function TagBlock({ filterRules, setFilter }: DashboardBlockProps) {
    rules.push(filterRules("pages", { exclude: ["tag"] }));
    return (
      <div>
        <button
          data-set="news"
          onClick={() => results.push(setFilter("tag", ["news"]))}
          type="button"
        >
          News
        </button>
        <button
          data-set="wrong"
          onClick={() => results.push(setFilter("tag", { a: 1 }))}
          type="button"
        >
          Wrong
        </button>
        <button
          data-set="missing"
          onClick={() => results.push(setFilter("nope", ["x"]))}
          type="button"
        >
          Missing
        </button>
      </div>
    );
  }
  const blocks: DashboardBlockRegistry = { tags: { component: TagBlock } };
  const screen = {
    version: 2,
    id: "screen",
    name: "Screen",
    sections: [{ id: "page", type: "flow", widgetIds: ["tags"] }],
    widgets: [{ id: "tags", type: "block", block: "tags", settings: {} }],
    filters: [
      {
        id: "tag",
        type: "select",
        label: "Tag",
        targets: [{ tableId: "pages", columnId: "tags" }],
      },
      {
        id: "author",
        type: "select",
        label: "Author",
        targets: [{ tableId: "pages", columnId: "author" }],
        value: ["Ada"],
      },
    ],
  };
  const { container, root } = mount();
  await act(() =>
    root.render(<YayawDashboard blocks={blocks} dashboard={screen} />)
  );
  await settle(30, 3);
  expect(
    (rules.at(-1) as Row[]).map((rule) => [rule.columnId, rule.values])
  ).toEqual([["author", ["Ada"]]]);
  await click(container.querySelector('[data-set="news"]'));
  await settle(30, 2);
  expect(results.at(-1)).toEqual({ ok: true, value: ["news"] });
  expect(
    new URL(window.location.href).searchParams.getAll("screen.tag")
  ).toEqual(["news"]);
  await click(container.querySelector('[data-set="wrong"]'));
  expect(results.at(-1)).toMatchObject({ ok: false, code: "invalidValue" });
  await click(container.querySelector('[data-set="missing"]'));
  expect(results.at(-1)).toMatchObject({ ok: false, code: "unknownFilter" });
  // Refused values change nothing.
  expect(
    new URL(window.location.href).searchParams.getAll("screen.tag")
  ).toEqual(["news"]);
});
