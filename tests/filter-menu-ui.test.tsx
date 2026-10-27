import "./setup-dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  it,
  setSystemTime,
} from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { DisplayModeRenderers } from "../src/components/ui/yayaw-table/types/display-mode-renderer";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

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
  setSystemTime();
});
const settle = async (ms = 60, frames = 5) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
  }
};
const click = async (element: Element | null | undefined) => {
  if (!element) {
    throw new Error("Missing element");
  }
  await act(async () => {
    (element as HTMLElement).click();
    await Promise.resolve();
  });
  await settle(20, 3);
};
const type = async (element: Element | null | undefined, value: string) => {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value"
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
};
const select = async (element: Element | null | undefined, value: string) => {
  const input = element as HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value"
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
  await settle(20, 3);
};
const $ = (selector: string) => document.querySelector(selector);

const ROWS: Row[] = [
  { id: "1", name: "Alpha", amount: 5, status: "won", due: "2026-10-02" },
  { id: "2", name: "Bravo", amount: 50, status: "open", due: "2026-09-20" },
  { id: "3", name: "Charlie", amount: 500, status: "lost", due: "2026-10-12" },
];

const config = defineTableConfig({
  id: "notion-filters",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "amount", header: "Amount", type: "number" },
      {
        id: "status",
        header: "Status",
        type: "select",
        options: [
          { value: "won", label: "Won" },
          { value: "open", label: "Open" },
          { value: "lost", label: "Lost" },
        ],
      },
      { id: "due", header: "Due", type: "date" },
      { id: "secret", header: "Secret", enableFiltering: false },
    ],
    order: ["name", "amount", "status", "due"],
    visible: ["name", "amount", "status", "due"],
    mandatory: ["name"],
  },
  table: {
    syncUrl: false,
    enableViews: false,
    toolbarDateFilter: "due",
    timeZone: "Europe/Paris",
  },
  translations: { namespace: "notion-filters", keys: { title: "Deals" } },
});

const render = async (
  tableConfig = config,
  displayModeRenderers?: DisplayModeRenderers
) => {
  const lists: Row[] = [];
  const actions = {
    list: (params: Row) => {
      lists.push(params);
      const query = compatibleListParams(params);
      const rules = query.advancedFilters as Row[];
      const join = query.advancedFilterJoin;
      const data = ROWS.filter((row) => {
        const test = (rule: Row) =>
          matchesContractFilter(row[String(rule.columnId)], rule);
        return join === "or" ? rules.some(test) : rules.every(test);
      });
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
  } as unknown as TableActions;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            displayModeRenderers={displayModeRenderers}
            getRowId={(row) => String(row.id)}
            getTableActions={() => actions}
            getTableConfig={() => tableConfig}
            queryClient={client}
            tableType="notion-filters"
          />
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  await settle();
  const lastRules = () =>
    (compatibleListParams(lists.at(-1) ?? {}).advancedFilters ?? []) as Row[];
  return { container, lists, lastRules };
};

/** The view settings' Filter screen, where the properties are picked. */
const openFilterScreen = async () => {
  await click($('[aria-label="View settings"]'));
  await click(
    [...document.querySelectorAll<HTMLElement>("[role=dialog] button")].find(
      (button) => button.textContent?.trim().startsWith("Filter")
    ) ?? null
  );
};

it("adds the first filter directly and keeps its active value and reset visible", async () => {
  const { lastRules } = await render();
  expect($("[data-filter-chip-add]")).not.toBeNull();
  expect($("[data-filter-chips-clear]")).toBeNull();
  await click($("[data-filter-chip-add]"));
  expect(
    $('[aria-label="View settings"]')?.getAttribute("aria-expanded")
  ).not.toBe("true");
  const properties = [
    ...document.querySelectorAll("[data-filter-property]"),
  ].map((item) => item.textContent);
  expect(properties).toContain("Status");
  expect(properties).not.toContain("Secret");
  await click($('[data-filter-property="status"]'));
  // An empty rule is a chip, not a filter.
  expect($('[data-filter-chip="status"]')?.getAttribute("data-complete")).toBe(
    "false"
  );
  expect(lastRules()).toEqual([]);
  const options = document.querySelectorAll<HTMLInputElement>(
    '[data-filter-rule="status"] input[type="checkbox"]'
  );
  await click(options[0]);
  await click(options[1]);
  await settle();
  expect(lastRules()).toEqual([
    expect.objectContaining({
      columnId: "status",
      operator: "isAnyOf",
      values: ["won", "open"],
    }),
  ]);
  expect($('[data-filter-chip="status"]')?.textContent).toContain(
    "Status:Won, Open"
  );
  expect(document.querySelectorAll("[data-filter-chip]")).toHaveLength(1);
  await click($("[data-filter-chips-clear]"));
  await settle();
  // Back to the first request's filters, answered from the cache.
  expect($("[data-filter-chip-add]")).not.toBeNull();
  expect($("[data-filter-chip]")).toBeNull();
  expect($("[data-filter-chips-clear]")).toBeNull();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
});

it("names chart settings for the chart instead of cards", async () => {
  await render(
    defineTableConfig({
      ...config,
      table: {
        ...config.table,
        displayModes: ["chart"],
        defaultDisplayMode: "chart",
      },
    }),
    {
      chart: {
        View: () => <div>Chart preview</div>,
        Settings: () => <div>Chart controls</div>,
      },
    }
  );
  await click($('[aria-label="View settings"]'));
  const settings = [
    ...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button"),
  ].find((button) => button.textContent === "Chart settings");
  expect(settings).toBeDefined();
  await click(settings);
  expect(document.body.textContent).toContain("Chart controls");
  expect(document.body.textContent).not.toContain("Card settings");
});

it("resets all grouping while preserving the current filters", async () => {
  await render(
    defineTableConfig({
      ...config,
      table: {
        ...config.table,
        defaultView: {
          grouping: ["status", "name"],
          advancedFilters: [
            {
              id: "status-rule",
              columnId: "status",
              type: "select",
              operator: "isAnyOf",
              values: ["open"],
              isActive: true,
              createdAt: new Date("2026-10-27"),
              updatedAt: new Date("2026-10-27"),
            },
          ],
        },
      },
    })
  );
  await click($('[aria-label="View settings"]'));
  await click(
    [
      ...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button"),
    ].find((button) => button.textContent?.startsWith("Group"))
  );
  const reset = [
    ...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button"),
  ].find((button) => button.textContent === "Reset");
  expect(reset?.disabled).toBe(false);
  await click(reset);
  expect(reset?.disabled).toBe(true);
  expect($('[data-filter-chip="status"]')?.textContent).toContain("Open");
});

it("filters by a typed number once typing pauses", async () => {
  const { lists, lastRules } = await render();
  await openFilterScreen();
  await click($('[data-filter-property="amount"]'));
  const requests = lists.length;
  const input = $("[data-filter-input]");
  await type(input, "5");
  await type(input, "50");
  await settle(20, 3);
  expect(lists.length).toBe(requests);
  await settle(200, 4);
  expect(lastRules()).toEqual([
    expect.objectContaining({
      columnId: "amount",
      operator: "equals",
      values: 50,
    }),
  ]);
});

it("keeps the toolbar's date period with its days, and the Filter screen opens it", async () => {
  setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
  const { lastRules } = await render();
  const period = () => $('[data-table-toolbar] [data-date-filter="due"]');
  expect(period()?.textContent).toBe("All dates");
  await openFilterScreen();
  await click($('[data-filter-property="due"]'));
  // The column has one period: no chip repeats it.
  expect($('[data-filter-chip="due"]')).toBeNull();
  expect($("[data-date-period-editor]")).not.toBeNull();
  await select($("[data-relative-direction]"), "this");
  await select($("[data-relative-unit]"), "Months");
  await settle();
  expect(period()?.textContent).toContain("This month");
  expect($("[data-date-period-days]")?.textContent).toBe("Oct 1 – Oct 31");
  expect(lastRules()).toEqual([
    expect.objectContaining({
      columnId: "due",
      operator: "between",
      values: ["2026-10-01", "2026-10-31"],
    }),
  ]);
  await select($("[data-relative-direction]"), "past");
  await type($("[data-rolling-count]"), "30");
  await act(async () => {
    $("[data-rolling-count]")?.dispatchEvent(
      new Event("focusout", { bubbles: true })
    );
    await Promise.resolve();
  });
  await settle();
  await select($("[data-relative-unit]"), "Weeks");
  await settle();
  // Last 30 weeks, through today.
  expect(lastRules()).toEqual([
    expect.objectContaining({ values: ["2026-03-19", "2026-10-14"] }),
  ]);
  await click($("[data-date-period-clear]"));
  await settle();
  expect(period()?.textContent).toBe("All dates");
});

it("joins rules with or in the advanced filter", async () => {
  const { lastRules, lists } = await render();
  await openFilterScreen();
  await click($("[data-filter-add-advanced]"));
  await click($("[data-advanced-add]"));
  await select($("[data-advanced-join]"), "or");
  const values = document.querySelectorAll<HTMLInputElement>(
    "[data-advanced-rule] input"
  );
  for (const [index, name] of ["Alpha", "Charlie"].entries()) {
    const input = values[index];
    await type(input, name);
    await act(async () => {
      // A value applies when the field is left.
      input?.dispatchEvent(new Event("focusout", { bubbles: true }));
      await Promise.resolve();
    });
    await settle();
  }
  expect(lastRules()).toHaveLength(2);
  expect(compatibleListParams(lists.at(-1) ?? {}).advancedFilterJoin).toBe(
    "or"
  );
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  expect($("[data-filter-chip-advanced]")?.textContent).toContain("2 rules");
});

it("searches remote filter choices, keeps their labels and honors the minimum", async () => {
  const searches: string[] = [];
  const remote = {
    ...config,
    columns: {
      ...config.columns,
      definitions: config.columns.definitions.map((column) =>
        column.id === "status"
          ? {
              ...column,
              type: "text" as const,
              filterType: "select" as const,
              options: [],
              optionsSearchMinLength: 2,
              optionsSearchDebounceMs: 0,
              optionsLoader: (query: string) => {
                searches.push(query);
                return Promise.resolve(
                  query === "wo"
                    ? [{ value: "won", label: "Won remotely" }]
                    : [{ value: "other", label: "Other remote" }]
                );
              },
            }
          : column
      ),
    },
  };
  const { lastRules } = await render(remote);
  await openFilterScreen();
  await click($('[data-filter-property="status"]'));
  expect(searches).toEqual([]);
  await type($('input[aria-label="Search for an option…"]'), "wo");
  await settle();
  expect(searches).toEqual(["wo"]);
  await type($('input[aria-label="Search for an option…"]'), "ot");
  await settle();
  expect($('[data-filter-rule="status"]')?.textContent).not.toContain(
    "Won remotely"
  );
  await type($('input[aria-label="Search for an option…"]'), "wo");
  await settle();
  await click($('[data-filter-rule="status"] input[type="checkbox"]'));
  await type($('input[aria-label="Search for an option…"]'), "ot");
  await settle();
  expect(lastRules()).toEqual([
    expect.objectContaining({ columnId: "status", values: ["won"] }),
  ]);
  expect($('[data-filter-chip="status"]')?.textContent).toContain(
    "Won remotely"
  );
});

it("shows no settings badge on the host's default view, and counts what is added", async () => {
  const rule = {
    id: "default-amount",
    columnId: "amount",
    operator: "greaterThan" as const,
    values: [10],
    isActive: true,
    type: "number" as const,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const { lastRules } = await render(
    defineTableConfig({
      ...config,
      table: {
        ...config.table,
        defaultView: {
          advancedFilters: [rule],
        },
      },
    })
  );
  expect(lastRules().map((item) => item.columnId)).toEqual(["amount"]);
  expect($("[data-settings-badge]")).toBeNull();
  await openFilterScreen();
  await click($('[data-filter-property="status"]'));
  await click(
    document.querySelector('[data-filter-rule="status"] input[type="checkbox"]')
  );
  await settle();
  expect(lastRules().map((item) => item.columnId)).toEqual([
    "amount",
    "status",
  ]);
  expect($("[data-settings-badge]")?.textContent).toBe("1");
});
