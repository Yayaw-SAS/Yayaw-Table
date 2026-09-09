import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import scenarios from "../../../../tests/fixtures/empty-states.json";
import { defineTableConfig } from "../config";
import type {
  TableActions,
  TableEmptyStateConfig,
  TableListParams,
} from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const modes = ["table", "kanban", "gallery"] as const;
const rows = [{ id: "one", name: "Alpha", status: "Open" }];
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  })
);
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
const mountEmpty = async ({
  mode,
  params = {},
  emptyState,
  list,
  data = [],
  locale = "en",
  showToolbar = false,
  syncUrl = true,
}: {
  mode: (typeof modes)[number];
  params?: Record<string, string>;
  emptyState?: TableEmptyStateConfig;
  list?: TableActions["list"];
  data?: typeof rows;
  locale?: string;
  showToolbar?: boolean;
  syncUrl?: boolean;
}) => {
  window.history.replaceState({}, "", `/?${new URLSearchParams(params)}`);
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
      enableViews: false,
      showToolbar,
    },
    translations: { namespace: "empty", keys: {} },
  });
  const actions = list ? { list } : undefined;
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config,
      data,
      getTableActions: () => actions,
      tableType: "empty",
      locale,
      syncUrl,
      searchDebounceMs: 0,
    },
  });
  await flushPromises();
  return wrapper;
};
for (const mode of modes) {
  for (const scenario of scenarios) {
    it(`${mode}: distinguishes ${scenario.name} and only offers a relevant reset`, async () => {
      const params = Object.fromEntries(
        Object.entries(scenario.params).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      );
      const wrapper = await mountEmpty({ mode, params });
      const empty = wrapper.get('[data-slot="empty"]');
      expect(empty.get('[data-slot="empty-title"]').text()).toBe(
        scenario.canClear ? "No results found" : "No data available"
      );
      expect(empty.find("button").exists()).toBe(scenario.canClear);
      expect(empty.find('[data-slot="empty-description"]').exists()).toBe(
        scenario.canClear
      );
    });
  }
  it(`${mode}: clears search, both filter types, and the page, preserving presentation and other URL state`, async () => {
    const preserved = {
      "empty-sort": JSON.stringify([{ id: "name", desc: true }]),
      "empty-display": mode,
      "empty-pageSize": "20",
      "empty-grouping": JSON.stringify(["status"]),
      "other-q": "keep",
      view: "saved",
      campaign: "keep",
    };
    const wrapper = await mountEmpty({
      mode,
      data: rows,
      params: {
        ...preserved,
        "empty-q": "missing",
        "empty-page": "3",
        "empty-filters": '[{"id":"status","value":"Missing"}]',
        "empty-advancedFilters":
          scenarios[4]?.params["empty-advancedFilters"] ?? "[]",
        "empty-visibility": JSON.stringify({ status: false }),
      },
    });
    await wrapper.get('[data-slot="empty-content"] button').trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 150));
    await flushPromises();
    expect(wrapper.find('[data-slot="empty"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Alpha");
    const result = new URLSearchParams(window.location.search);
    for (const key of [
      "empty-q",
      "empty-filters",
      "empty-advancedFilters",
      "empty-page",
    ]) {
      expect(result.has(key)).toBe(false);
    }
    for (const [key, value] of Object.entries(preserved)) {
      expect(
        key === "empty-display" ? (result.get(key) ?? mode) : result.get(key)
      ).toBe(value);
    }
    expect(JSON.parse(result.get("empty-visibility") ?? "{}").status).toBe(
      false
    );
  });
  it(`${mode}: preserves custom copy and honors show=false`, async () => {
    const custom = await mountEmpty({
      mode,
      emptyState: { title: "Nothing here", description: "Custom help" },
      params: { "empty-q": "missing" },
    });
    expect(custom.get('[data-slot="empty-title"]').text()).toBe("Nothing here");
    expect(custom.get('[data-slot="empty-description"]').text()).toBe(
      "Custom help"
    );
    expect(custom.find('[data-slot="empty-content"] button').exists()).toBe(
      true
    );
    const hidden = await mountEmpty({
      mode,
      emptyState: { show: false },
      params: { "empty-q": "missing" },
    });
    expect(hidden.find('[data-slot="empty"]').exists()).toBe(false);
  });
  it(`${mode}: does not show an empty state while loading or after a list failure`, async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    const wrapper = await mountEmpty({
      mode,
      list: () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    });
    expect(wrapper.find('[data-slot="empty"]').exists()).toBe(false);
    rejectRequest(new Error("List failed"));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("List failed");
    expect(wrapper.find('[data-slot="empty"]').exists()).toBe(false);
  });
}
it("resets server-backed filtering in memory mode and uses French labels", async () => {
  const requests: TableListParams[] = [];
  const wrapper = await mountEmpty({
    mode: "table",
    syncUrl: false,
    locale: "fr",
    showToolbar: true,
    list: (params) => {
      requests.push(params);
      const data = params.search ? [] : rows;
      return Promise.resolve({
        data,
        meta: { totalCount: data.length, pageCount: 1 },
      });
    },
  });
  await wrapper.get('input[type="search"]').setValue("missing");
  await flushPromises();
  expect(wrapper.get('[data-slot="empty-title"]').text()).toBe(
    "Aucun résultat"
  );
  const button = wrapper.get('[data-slot="empty-content"] button');
  expect(button.text()).toBe("Effacer les filtres");
  await button.trigger("click");
  await flushPromises();
  expect(requests.at(-1)?.search).toBe("");
  expect(requests.at(-1)?.page).toBe(1);
  expect(wrapper.find('[data-slot="empty"]').exists()).toBe(false);
  expect(wrapper.text()).toContain("Alpha");
});
