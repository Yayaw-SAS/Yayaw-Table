import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { tableDensityAtom } from "../src/components/ui/yayaw-table/atoms/table-atoms";
import { TableDensityMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-density-menu";
import { resolveTableCatalogueConfig } from "../src/components/ui/yayaw-table/hooks/use-table-config";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  isTableDensity,
  TABLE_DENSITY_METRICS,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import densityScale from "./fixtures/density-scale.json";

it("selects XS through the density menu without changing other tables or the configured default", async () => {
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
                defaultDensity="extra-extra-large"
                tableId="density"
              />
              <TableDensityMenu defaultDensity="large" tableId="other" />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Table density: 2XL"]'
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe("");
    await act(() => trigger?.click());
    const items = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]'
    );
    expect(Array.from(items, (item) => item.textContent)).toEqual([
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "2XL",
    ]);
    expect(items[5]?.getAttribute("aria-checked")).toBe("true");
    await act(() => items[0]?.click());
    expect(store.get(tableDensityAtom("density"))).toBe("extra-small");
    expect(store.get(tableDensityAtom("other"))).toBeUndefined();
    expect(
      container.querySelector('[aria-label="Table density: XS"]')
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

for (const fixture of densityScale) {
  it(`preserves the ${fixture.label} spacing contract and configuration`, () => {
    const density = fixture.value;
    expect(isTableDensity(density)).toBe(true);
    if (!isTableDensity(density)) {
      throw new Error("Invalid density fixture");
    }
    expect(resolveTableCatalogueConfig({ density }).table.density).toBe(
      density
    );
    const metrics = TABLE_DENSITY_METRICS[density];
    expect(metrics.rowHeight * 4).toBe(fixture.height);
    expect(metrics.controlHeight * 4).toBe(fixture.control);
    expect((metrics.controlHeight + 2 * metrics.paddingY) * 4).toBe(
      fixture.height
    );
  });
}
