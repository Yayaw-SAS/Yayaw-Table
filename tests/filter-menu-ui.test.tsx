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
    enableAdvancedFilters: true,
    toolbarDateFilter: "due",
    timeZone: "Europe/Paris",
  },
  translations: { namespace: "notion-filters", keys: { title: "Deals" } },
});

const render = async () => {
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
            enableAdvancedFilters
            getRowId={(row) => String(row.id)}
            getTableActions={() => actions}
            getTableConfig={() => config}
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

it("adds a rule from the Filter button as a chip that filters once it has a value", async () => {
  const { lastRules } = await render();
  await click($("[data-filter-button]"));
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
  expect($("[data-filter-count]")?.textContent).toBe("1");
  await click($("[data-filter-more]"));
  await click($("[data-filter-delete]"));
  await settle();
  // Back to the first request's filters, answered from the cache.
  expect($("[data-filter-chips]")).toBeNull();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
});

it("filters by a typed number once typing pauses", async () => {
  const { lists, lastRules } = await render();
  await click($("[data-filter-button]"));
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

it("keeps the toolbar's date period with its days, and the Filter button opens it", async () => {
  setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
  const { lastRules } = await render();
  const period = () => $('[data-table-toolbar] [data-date-filter="due"]');
  expect(period()?.textContent).toBe("All dates");
  await click($("[data-filter-button]"));
  await click($('[data-filter-property="due"]'));
  // The column has one period: no chip repeats it.
  expect($('[data-filter-chip="due"]')).toBeNull();
  expect($("[data-date-period-editor]")).not.toBeNull();
  await click($('[data-relative-date="$thisMonth"]'));
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
  await select($("[data-rolling-unit]"), "Weeks");
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
  await click($("[data-filter-button]"));
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
