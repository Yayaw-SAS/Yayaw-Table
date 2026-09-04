import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { AdvancedFiltersState } from "../src/components/ui/yayaw-table/types/filter-types";

type UrlState = ReturnType<typeof useTableUrlState>;

const testWindow = new Window({ url: "http://localhost" });
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();

beforeAll(() => {
  for (const [key, value] of Object.entries({
    window: testWindow,
    document: testWindow.document,
    navigator: testWindow.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
});

afterAll(async () => {
  await testWindow.happyDOM.close();
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 220));

function Probe({
  onRender,
  tableId,
}: {
  onRender: (state: UrlState) => void;
  tableId: string;
}) {
  onRender(useTableUrlState({ tableId }));
  return null;
}

async function mountState(initial: Record<string, string> = {}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const store = createStore();
  const states = new Map<string, UrlState>();
  let params = new URLSearchParams(initial);
  await act(() => {
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={(event) => {
            params = event.searchParams;
          }}
          searchParams={initial}
        >
          <Probe
            onRender={(state) => states.set("toolbar", state)}
            tableId="products"
          />
          <Probe
            onRender={(state) => states.set("editor", state)}
            tableId="products"
          />
          <Probe
            onRender={(state) => states.set("other", state)}
            tableId="other"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
  });
  return {
    get params() {
      return params;
    },
    state(name: string): UrlState {
      const state = states.get(name);
      if (!state) {
        throw new Error(`Missing test probe: ${name}`);
      }
      return state;
    },
    cleanup: async () => {
      await act(() => root.unmount());
    },
  };
}

const advancedFilters: AdvancedFiltersState = [
  {
    columnId: "price",
    id: "price-minimum",
    isActive: true,
    operator: "greaterThan",
    type: "number",
    values: 500,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

describe("resetFilters", () => {
  it("clears all filter inputs and pagination while preserving presentation and other tables", async () => {
    const preserved = {
      "products-sort": JSON.stringify([{ id: "name", desc: true }]),
      "products-pageSize": "25",
      "products-grouping": JSON.stringify(["category"]),
      "products-visibility": JSON.stringify({ price: false }),
      "products-display": "gallery",
      "other-q": "unchanged",
      view: "saved-view",
      campaign: "keep",
    };
    const harness = await mountState({
      ...preserved,
      "products-filters": JSON.stringify([{ id: "brand", value: "Apple" }]),
      "products-advancedFilters": JSON.stringify(advancedFilters),
      "products-q": "MacBook",
      "products-page": "4",
    });
    try {
      await act(async () => {
        harness.state("toolbar").resetFilters();
        await settle();
      });
      for (const key of [
        "products-filters",
        "products-advancedFilters",
        "products-q",
        "products-page",
      ]) {
        expect(harness.params.has(key)).toBe(false);
      }
      for (const [key, value] of Object.entries(preserved)) {
        expect(harness.params.get(key)).toBe(value);
      }
      expect(harness.state("editor").filtersParam).toEqual([]);
      expect(harness.state("editor").advancedFiltersParam).toEqual([]);
      expect(harness.state("editor").globalSearchParam).toBe("");
    } finally {
      await harness.cleanup();
    }
  });

  it("discards pending edits from another hook for the same table", async () => {
    const harness = await mountState();
    try {
      const edits = [
        () => harness.state("editor").setGlobalSearchFromUI("stale"),
        () =>
          harness
            .state("editor")
            .setColumnFiltersFromUI([{ id: "brand", value: "Apple" }]),
        () => harness.state("editor").setAdvancedFiltersFromUI(advancedFilters),
      ];
      for (const edit of edits) {
        await act(async () => {
          edit();
          harness.state("toolbar").resetFilters();
          await settle();
        });
        expect(harness.params.has("products-q")).toBe(false);
        expect(harness.params.has("products-filters")).toBe(false);
        expect(harness.params.has("products-advancedFilters")).toBe(false);
      }
    } finally {
      await harness.cleanup();
    }
  });

  it("allows new edits after reset and preserves pending search on another table", async () => {
    const harness = await mountState();
    try {
      await act(async () => {
        harness.state("other").setGlobalSearchFromUI("other search");
        harness.state("toolbar").resetFilters();
        harness.state("editor").setGlobalSearchFromUI("fresh search");
        await settle();
      });
      expect(harness.params.get("products-q")).toBe("fresh search");
      expect(harness.params.get("other-q")).toBe("other search");
    } finally {
      await harness.cleanup();
    }
  });
});
