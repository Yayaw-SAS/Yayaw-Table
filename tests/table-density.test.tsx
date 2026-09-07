import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { tableDensityAtom } from "../src/components/ui/yayaw-table/atoms/table-atoms";
import { TableDensityMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-density-menu";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

it("selects S through the density menu without changing other tables or the configured default", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  try {
    await act(() => {
      root.render(
        <NuqsTestingAdapter>
          <Provider store={store}>
            <TableProvider
              queryClient={queryClient}
              tableId="density"
              translations={defaultTranslations}
            >
              <TableDensityMenu
                defaultDensity="extra-large"
                tableId="density"
              />
              <TableDensityMenu defaultDensity="large" tableId="other" />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Table density: XL"]'
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe("");
    await act(() => trigger?.click());
    const items = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]'
    );
    expect(Array.from(items, (item) => item.textContent)).toEqual([
      "S",
      "M",
      "L",
      "XL",
    ]);
    expect(items[3]?.getAttribute("aria-checked")).toBe("true");
    await act(() => items[0]?.click());
    expect(store.get(tableDensityAtom("density"))).toBe("small");
    expect(store.get(tableDensityAtom("other"))).toBeUndefined();
    expect(
      container.querySelector('[aria-label="Table density: S"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Table density: L"]')
    ).not.toBeNull();
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});
