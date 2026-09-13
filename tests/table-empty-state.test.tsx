import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import {
  defineTableConfig,
  type TableEmptyStateConfig,
} from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultTranslations,
  type TableActions,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import scenarios from "./fixtures/empty-states.json";

const originalGetAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getAnimations"
);
beforeAll(() => {
  // Happy DOM does not implement the animation API used by Base UI's scroll area.
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
const modes = ["table", "kanban", "gallery"] as const;
const rows = [{ id: "one", name: "Alpha", status: "Open" }];
async function mountEmpty({
  mode,
  params = {},
  emptyState,
  savedView,
  list = async () => ({ data: [], meta: { totalCount: 0, pageCount: 1 } }),
}: {
  mode: (typeof modes)[number];
  params?: Record<string, string>;
  emptyState?: TableEmptyStateConfig;
  savedView?: TableView;
  list?: TableActions["list"];
}) {
  const config = defineTableConfig({
    id: "empty",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: {
      displayModes: [...modes],
      defaultDisplayMode: mode,
      emptyState,
      kanban: { groupBy: "status", titleColumn: "name" },
      gallery: { titleColumn: "name" },
      showClearFilters: false,
      showResetFilters: false,
      enableViews: Boolean(savedView),
      syncUrl: !savedView,
      showToolbar: Boolean(savedView),
    },
    translations: { namespace: "empty", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const actions = { list };
  let result = new URLSearchParams(params);
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={(event) => {
            result = event.searchParams;
          }}
          searchParams={params}
        >
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialActiveViewId={savedView?.id}
            initialViews={savedView ? [savedView] : undefined}
            queryClient={client}
            searchDebounceMs={0}
            tableType="empty"
            translations={
              savedView
                ? {
                    ...defaultTranslations,
                    table: {
                      ...defaultTranslations.table,
                      no_results: "Aucun résultat",
                    },
                    filters: {
                      ...defaultTranslations.filters,
                      clear: "Effacer les filtres",
                    },
                  }
                : undefined
            }
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  return {
    container,
    get params() {
      return result;
    },
  };
}
for (const mode of modes) {
  for (const scenario of scenarios) {
    it(`${mode}: distinguishes ${scenario.name} and only offers a relevant reset`, async () => {
      const params = Object.fromEntries(
        Object.entries(scenario.params).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      );
      const { container } = await mountEmpty({ mode, params });
      const empty = container.querySelector('[data-slot="empty"]');
      expect(empty).not.toBeNull();
      expect(
        empty?.querySelector('[data-slot="empty-title"]')?.textContent
      ).toBe(scenario.canClear ? "No results found" : "No data available");
      expect(Boolean(empty?.querySelector("button"))).toBe(scenario.canClear);
      expect(
        Boolean(empty?.querySelector('[data-slot="empty-description"]'))
      ).toBe(scenario.canClear);
    });
  }
  it(`${mode}: clears search, both filter types, and the page, preserving presentation and other URL state`, async () => {
    const requests: Record<string, unknown>[] = [];
    const preserved = {
      "empty-sort": JSON.stringify([{ id: "name", desc: true }]),
      "empty-display": mode,
      "empty-pageSize": "20",
      "empty-grouping": JSON.stringify(["status"]),
      "empty-visibility": JSON.stringify({ status: false }),
      "other-q": "keep",
      view: "saved",
      campaign: "keep",
    };
    const harness = await mountEmpty({
      mode,
      params: {
        ...preserved,
        "empty-q": "missing",
        "empty-page": "3",
        "empty-filters": '[{"id":"status","value":"Missing"}]',
        "empty-advancedFilters":
          scenarios[4].params["empty-advancedFilters"] ?? "[]",
      },
      list: (params) => {
        requests.push(params);
        const data =
          params.search ||
          Object.keys(params.filters ?? {}).length ||
          (Array.isArray(params.advancedFilters) &&
            params.advancedFilters.length)
            ? []
            : rows;
        return Promise.resolve({
          data,
          meta: { totalCount: data.length, pageCount: 1 },
        });
      },
    });
    const button = harness.container.querySelector<HTMLButtonElement>(
      '[data-slot="empty-content"] button'
    );
    expect(button).not.toBeNull();
    await act(async () => {
      button?.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    await act(settle);
    expect(harness.container.querySelector('[data-slot="empty"]')).toBeNull();
    expect(harness.container.textContent).toContain("Alpha");
    for (const key of [
      "empty-q",
      "empty-filters",
      "empty-advancedFilters",
      "empty-page",
    ]) {
      expect(harness.params.has(key)).toBe(false);
    }
    for (const [key, value] of Object.entries(preserved)) {
      expect(harness.params.get(key)).toBe(value);
    }
    expect(requests.at(-1)?.page).toBe(1);
  });
  it(`${mode}: preserves custom copy and honors show=false`, async () => {
    const custom = await mountEmpty({
      mode,
      emptyState: { title: "Nothing here", description: "Custom help" },
      params: { "empty-q": "missing" },
    });
    expect(
      custom.container.querySelector('[data-slot="empty-title"]')?.textContent
    ).toBe("Nothing here");
    expect(
      custom.container.querySelector('[data-slot="empty-description"]')
        ?.textContent
    ).toBe("Custom help");
    expect(
      custom.container.querySelector('[data-slot="empty-content"] button')
    ).not.toBeNull();
    const hidden = await mountEmpty({
      mode,
      emptyState: { show: false },
      params: { "empty-q": "missing" },
    });
    expect(hidden.container.querySelector('[data-slot="empty"]')).toBeNull();
  });
  it(`${mode}: does not show an empty state while loading or after a list failure`, async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    const harness = await mountEmpty({
      mode,
      list: () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    });
    expect(harness.container.querySelector('[data-slot="empty"]')).toBeNull();
    await act(async () => {
      rejectRequest(new Error("List failed"));
      await settle();
    });
    expect(harness.container.querySelector('[data-slot="empty"]')).toBeNull();
  });
}

it("recovers a saved view in memory mode with translated copy without overwriting it", async () => {
  const savedView: TableView = {
    id: "filtered",
    name: "Filtered",
    tableId: "empty",
    createdById: "user",
    config: { globalSearch: "missing", displayMode: "table" },
  };
  const harness = await mountEmpty({
    mode: "table",
    savedView,
    params: { "other-q": "keep" },
    list: (params) =>
      Promise.resolve({
        data: params.search ? [] : rows,
        meta: { totalCount: params.search ? 0 : 1, pageCount: 1 },
      }),
  });
  // Arrival loads the view, applies its query and waits for the filtered list response.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (
      harness.container.querySelector('[data-slot="empty-title"]')
        ?.textContent === "Aucun résultat"
    ) {
      break;
    }
    await act(settle);
  }
  expect(
    harness.container.querySelector('[data-slot="empty-title"]')?.textContent
  ).toBe("Aucun résultat");
  const button = harness.container.querySelector<HTMLButtonElement>(
    '[data-slot="empty-content"] button'
  );
  expect(button?.textContent).toBe("Effacer les filtres");
  await act(async () => {
    button?.click();
    await settle();
  });
  await act(settle);
  expect(harness.container.querySelector('[data-slot="empty"]')).toBeNull();
  expect(harness.container.textContent).toContain("Alpha");
  expect(savedView.config.globalSearch).toBe("missing");
  expect(harness.params.toString()).toBe("other-q=keep");
});
