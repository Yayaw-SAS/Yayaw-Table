const CONTROL_HEIGHT_PATTERN = /className="h-8 (?:max-w-full|min-w-0)/;
import "./setup-dom";
import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TableFilterBar } from "../src/components/ui/yayaw-table/components/filters/table-filter-bar";
import { DataTableAdvancedToolbar } from "../src/components/ui/yayaw-table/components/toolbar/data-table-advanced-toolbar";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { useDataTable } from "../src/components/ui/yayaw-table/hooks/use-data-table";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  filterBarColumns,
  filterBarDateValue,
  filterBarOptions,
  filterValues,
  replaceColumnFilter,
  replaceFilterBarDateRule,
} from "../src/components/ui/yayaw-table/utils/filter-bar";

const config = defineTableConfig({
  id: "quick-filters",
  columns: {
    definitions: [
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: 0, label: "Zero" },
          { value: 2, label: "Two" },
          { value: 3, label: "Disabled", disabled: true },
        ],
      },
    ],
    mandatory: [],
    visible: [],
    order: ["category"],
  },
  table: {
    syncUrl: false,
    filterBarColumns: ["category", "missing", "category"],
  },
  translations: { namespace: "test", keys: {} },
});
it("preserves typed false/zero values, unknown saved selections, unrelated filters and catalogue order", () => {
  expect(filterValues(false)).toEqual([false]);
  expect(filterValues(0)).toEqual([0]);
  expect(
    filterBarColumns(config.columns.definitions, config.table.filterBarColumns)
  ).toHaveLength(1);
  expect(
    filterBarColumns(
      [
        {
          id: "private",
          header: "Private",
          options: [],
          enableFiltering: false,
        },
      ],
      ["private"]
    )
  ).toEqual([]);
  expect(
    filterBarOptions(
      { id: "active", header: "Active", type: "boolean" },
      [false, "false"],
      { yes: "Yes", no: "No" }
    )
  ).toEqual([
    { value: true, label: "Yes" },
    { value: false, label: "No" },
    { value: "false", label: "false" },
  ]);
  expect(
    replaceColumnFilter(
      [
        { id: "other", value: false },
        { id: "category", value: 2 },
      ],
      "category",
      []
    )
  ).toEqual([{ id: "other", value: false }]);
});

it("synchronizes multiple controls through native filter state and survives hiding, saved-view values and reset", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    client = new QueryClient(),
    store = createStore();
  let current!: ReturnType<typeof useDataTable>;
  function Probe() {
    current = useDataTable({ tableId: "quick-filters", tableType: "media" });
    return null;
  }
  const render = (visible: boolean) =>
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter hasMemory>
          <TableProvider
            getTableConfig={() => config}
            queryClient={client}
            tableId="quick-filters"
            translations={defaultTranslations}
          >
            <Probe />
            <DataTableAdvancedToolbar
              tableId="quick-filters"
              tableType="media"
            />
            {visible && (
              <TableFilterBar tableId="quick-filters" tableType="media" />
            )}
          </TableProvider>
        </NuqsTestingAdapter>
      </Provider>
    );
  const checkbox = (label: string) => {
    const element = [...document.querySelectorAll("label")]
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector<HTMLInputElement>("input");
    if (!element) {
      throw new Error(`Missing ${label}`);
    }
    return element;
  };
  try {
    await act(() => render(true));
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Category"]')
        ?.click()
    );
    expect(checkbox("Disabled").disabled).toBe(true);
    await act(async () => {
      checkbox("Zero").click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(() => checkbox("Two").click());
    expect(current.state.columnFilters).toEqual([
      { id: "category", value: [0, 2] },
    ]);
    // Active filters alone never mark an unsaved view as a changed saved view.
    expect(container.querySelector('[aria-label="Modified"]')).toBeNull();
    await act(() => render(false));
    expect(current.state.columnFilters).toEqual([
      { id: "category", value: [0, 2] },
    ]);
    await act(async () => {
      current.setColumnFilters([{ id: "category", value: 2 }]);
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    await act(() => render(true));
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Category"]')
        ?.click()
    );
    expect(checkbox("Two").checked).toBe(true);
    expect(checkbox("Zero").checked).toBe(false);
    await act(async () => {
      current.resetFilters();
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    expect(checkbox("Two").checked).toBe(false);
  } finally {
    await act(() => root.unmount());
    client.clear();
    container.remove();
  }
});

it("keeps React filter triggers at the saved-view selector height", () => {
  for (const file of [
    "../src/components/ui/yayaw-table/components/filters/option-filter.tsx",
  ]) {
    expect(readFileSync(new URL(file, import.meta.url), "utf8")).toMatch(
      CONTROL_HEIGHT_PATTERN
    );
  }
});

it("keeps a date column's quick period as one advanced rule, beside the other rules", () => {
  const other = {
    id: "rule-1",
    columnId: "name",
    operator: "contains",
    values: "a",
  };
  const date = { id: "due", header: "Due", type: "date" };
  expect(filterBarColumns([date], ["due"])).toEqual([date]);
  const relative = replaceFilterBarDateRule([other], "due", {
    token: "$last30Days",
  });
  expect(relative).toEqual([
    other,
    {
      id: "filter-bar-due",
      columnId: "due",
      type: "date",
      isActive: true,
      operator: "equals",
      values: "$last30Days",
    },
  ]);
  expect(filterBarDateValue(relative, "due")).toEqual({ token: "$last30Days" });
  const range = replaceFilterBarDateRule(relative, "due", {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  expect(range.at(-1)).toMatchObject({
    operator: "between",
    values: ["2026-09-01", "2026-09-30"],
  });
  expect(filterBarDateValue(range, "due")).toEqual({
    from: "2026-09-01",
    to: "2026-09-30",
  });
  expect(
    filterBarDateValue(
      replaceFilterBarDateRule(range, "due", { to: "2026-09-30" }),
      "due"
    )
  ).toEqual({ to: "2026-09-30" });
  expect(replaceFilterBarDateRule(range, "due", {})).toEqual([other]);
  expect(filterBarDateValue([other], "due")).toEqual({});
});

it("searches a quick filter's options on the server and keeps the selected label", async () => {
  const calls: string[] = [];
  const remote = defineTableConfig({
    ...config,
    id: "remote-quick-filters",
    columns: {
      definitions: [
        {
          id: "action",
          header: "Action",
          type: "multiSelect",
          options: [],
          optionsLoader: (query: string) => {
            calls.push(query);
            return Promise.resolve(
              [
                { value: 7, label: "Launch call" },
                { value: 8, label: "Lunch" },
              ].filter((option) =>
                option.label.toLowerCase().includes(query.toLowerCase())
              )
            );
          },
          optionsSearchMinLength: 2,
          optionsSearchDebounceMs: 0,
        },
      ],
      mandatory: [],
      visible: [],
      order: ["action"],
    },
    table: { syncUrl: false, filterBarColumns: ["action"] },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    client = new QueryClient(),
    store = createStore();
  let current!: ReturnType<typeof useDataTable>;
  function Probe() {
    current = useDataTable({ tableId: "remote", tableType: "media" });
    return null;
  }
  const checkbox = (label: string) =>
    [...document.querySelectorAll("label")]
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector<HTMLInputElement>("input");
  const type = async (text: string) => {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="search"]'
    );
    if (!input) {
      throw new Error("Missing search");
    }
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  };
  try {
    await act(() =>
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory>
            <TableProvider
              getTableConfig={() => remote}
              queryClient={client}
              tableId="remote"
              translations={defaultTranslations}
            >
              <Probe />
              <TableFilterBar tableId="remote" tableType="media" />
            </TableProvider>
          </NuqsTestingAdapter>
        </Provider>
      )
    );
    expect(calls).toEqual([]);
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Action"]')
        ?.click()
    );
    expect(document.body.textContent).toContain("Type at least 2 characters");
    expect(calls).toEqual([]);
    await type("lau");
    expect(calls).toEqual(["lau"]);
    await act(() => checkbox("Launch call")?.click());
    expect(current.state.columnFilters).toEqual([{ id: "action", value: [7] }]);
    await type("lu");
    // The selection keeps its label beside other results.
    expect(checkbox("Launch call")?.checked).toBe(true);
    expect(checkbox("Lunch")?.checked).toBe(false);
  } finally {
    await act(() => root.unmount());
    client.clear();
    container.remove();
  }
});

it("picks one value or All in a single-choice quick filter, stored alone and shown on the trigger", async () => {
  const single = defineTableConfig({
    ...config,
    id: "single-filters",
    columns: {
      ...config.columns,
      definitions: [
        {
          id: "sent",
          header: "Sent",
          type: "boolean",
          filterSelection: "single",
        },
        {
          id: "category",
          header: "Category",
          type: "select",
          filterSelection: "single",
          options: [
            { value: 0, label: "Zero" },
            { value: 2, label: "Two" },
          ],
        },
      ],
      order: ["sent", "category"],
    },
    table: { syncUrl: false, filterBarColumns: ["sent", "category"] },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    client = new QueryClient(),
    store = createStore();
  let current!: ReturnType<typeof useDataTable>;
  function Probe() {
    current = useDataTable({ tableId: "single-filters", tableType: "media" });
    return null;
  }
  const trigger = (label: string) =>
    container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  const radio = (label: string) => {
    const element = [...document.querySelectorAll("label")]
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!element) {
      throw new Error(`Missing ${label}`);
    }
    return element;
  };
  try {
    await act(() =>
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory>
            <TableProvider
              getTableConfig={() => single}
              queryClient={client}
              tableId="single-filters"
              translations={defaultTranslations}
            >
              <Probe />
              <TableFilterBar tableId="single-filters" tableType="media" />
            </TableProvider>
          </NuqsTestingAdapter>
        </Provider>
      )
    );
    await act(() => trigger("Category")?.click());
    // Few choices: no search field, "All" first and checked.
    expect(document.querySelector('input[type="search"]')).toBeNull();
    expect(radio("All").checked).toBe(true);
    await act(() => radio("Zero").click());
    expect(current.state.columnFilters).toEqual([{ id: "category", value: 0 }]);
    expect(trigger("Category")?.textContent).toContain("Category: Zero");
    expect(document.querySelector('input[type="radio"]')).toBeNull();
    await act(() => trigger("Sent")?.click());
    await act(() => radio("False").click());
    expect(current.state.columnFilters).toEqual([
      { id: "category", value: 0 },
      { id: "sent", value: false },
    ]);
    await act(() => trigger("Category")?.click());
    expect(radio("Zero").checked).toBe(true);
    await act(() => radio("All").click());
    expect(current.state.columnFilters).toEqual([{ id: "sent", value: false }]);
    expect(trigger("Category")?.textContent).not.toContain(":");
  } finally {
    await act(() => root.unmount());
    client.clear();
    container.remove();
  }
});

it("stores a single quick-filter value alone and removes the filter for All", () => {
  expect(
    replaceColumnFilter([{ id: "other", value: 1 }], "sent", false)
  ).toEqual([
    { id: "other", value: 1 },
    { id: "sent", value: false },
  ]);
  expect(replaceColumnFilter([{ id: "sent", value: 0 }], "sent", 0)).toEqual([
    { id: "sent", value: 0 },
  ]);
  expect(
    replaceColumnFilter([{ id: "sent", value: true }], "sent", [])
  ).toEqual([]);
});

it("draws the first 100 choices of a long quick filter and says how to reach the others", async () => {
  const long = defineTableConfig({
    ...config,
    id: "long-filter",
    columns: {
      ...config.columns,
      definitions: [
        {
          id: "supplier",
          header: "Supplier",
          type: "select",
          options: Array.from({ length: 250 }, (_, index) => ({
            value: index + 1,
            label: `Supplier ${String(index + 1).padStart(3, "0")}`,
          })),
        },
      ],
      order: ["supplier"],
    },
    table: { syncUrl: false, filterBarColumns: ["supplier"] },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container),
    client = new QueryClient(),
    store = createStore();
  const choices = () =>
    [...document.querySelectorAll('input[type="checkbox"]')].map((input) =>
      input.closest("label")?.textContent?.trim()
    );
  try {
    await act(() =>
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory>
            <TableProvider
              getTableConfig={() => long}
              queryClient={client}
              tableId="long-filter"
              translations={defaultTranslations}
            >
              <TableFilterBar tableId="long-filter" tableType="media" />
            </TableProvider>
          </NuqsTestingAdapter>
        </Provider>
      )
    );
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Supplier"]')
        ?.click()
    );
    expect(choices()).toHaveLength(100);
    expect(document.body.textContent).toContain(
      "150 more: type to narrow the list"
    );
    const search = document.querySelector<HTMLInputElement>(
      'input[type="search"]'
    );
    if (!search) {
      throw new Error("Missing search");
    }
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(search, "240");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(choices()).toEqual(["Supplier 240"]);
  } finally {
    await act(() => root.unmount());
    client.clear();
    container.remove();
  }
});
