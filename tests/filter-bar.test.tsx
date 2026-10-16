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
