import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { footerVisibleAtom } from "../src/components/ui/yayaw-table/atoms/footer-atoms";
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
import { TABLE_DENSITY_CLASSES } from "../src/components/ui/yayaw-table/utils/table-density";
import densityScale from "./fixtures/density-scale.json";

/** Tailwind's named text sizes; other sizes use arbitrary pixel values. */
const TAILWIND_TEXT_SIZES: Record<number, string> = {
  12: "text-xs",
  14: "text-sm",
  16: "text-base",
  18: "text-lg",
};

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
      "2XS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "2XL",
    ]);
    expect(items[6]?.getAttribute("aria-checked")).toBe("true");
    await act(() => items[1]?.click());
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
    const metrics: Record<string, number> = TABLE_DENSITY_METRICS[density];
    expect(metrics.rowHeight * 4).toBe(fixture.height);
    expect(metrics.controlHeight * 4).toBe(fixture.control);
    expect((metrics.controlHeight + 2 * metrics.paddingY) * 4).toBe(
      fixture.height
    );
    expect(metrics.paddingX * 4).toBe(fixture.paddingX);
    expect(metrics.paddingY * 4).toBe(fixture.paddingY);
    expect(metrics.fontSize).toBe(fixture.fontSize);
    expect(metrics.lineHeight).toBe(fixture.lineHeight);
    // Each text line fits inside the density's control height.
    expect(metrics.lineHeight).toBeLessThanOrEqual(fixture.control);
  });
}

for (const fixture of densityScale) {
  it(`keeps the ${fixture.label} Tailwind classes on the shared metrics`, () => {
    const density = fixture.value;
    if (!isTableDensity(density)) {
      throw new Error("Invalid density fixture");
    }
    const metrics = TABLE_DENSITY_METRICS[density];
    const classes: Record<string, string> = TABLE_DENSITY_CLASSES[density];
    expect(classes.rows).toBe(`[&_tr]:h-${metrics.rowHeight}`);
    expect(classes.cell).toBe(
      `!px-${metrics.paddingX} !py-${metrics.paddingY}`
    );
    expect(classes.controls).toContain(`!h-${metrics.controlHeight} `);
    expect(classes.text.split(" ")[0]).toBe(
      TAILWIND_TEXT_SIZES[metrics.fontSize] ?? `text-[${metrics.fontSize}px]`
    );
  });
}

it("marks density-only edits dirty and keeps legacy saved views clean at the configured default", async () => {
  const { DataTableViewManager } = await import(
    "../src/components/ui/yayaw-table/components/toolbar/table-view-manager"
  );
  const { TableStateSyncProvider } = await import(
    "../src/components/ui/yayaw-table/providers/table-state-sync-provider"
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  const view = {
    id: "legacy-density",
    createdById: "tester",
    name: "Legacy",
    tableId: "density-dirty",
    config: { pageSize: 10, displayMode: "table" as const },
  };
  try {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory>
            <TableStateSyncProvider enabled={false}>
              <TableProvider
                getTableActions={() => ({
                  views: { list: async () => ({ data: [view] }) },
                })}
                queryClient={queryClient}
                tableId={view.tableId}
                translations={defaultTranslations}
              >
                <DataTableViewManager
                  defaultDensity="large"
                  initialActiveViewId={view.id}
                  initialViews={[view]}
                  tableId={view.tableId}
                  tableType={view.tableId}
                  tabs={false}
                />
              </TableProvider>
            </TableStateSyncProvider>
          </NuqsTestingAdapter>
        </Provider>
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Current View"]')
        ?.click()
    );
    const save = document.querySelector<HTMLButtonElement>(
      '[aria-label="Save changes"]'
    );
    if (!save) {
      throw new Error("Missing save view button");
    }
    expect(save.getAttribute("aria-disabled")).toBe("true");
    await act(() => store.set(tableDensityAtom(view.tableId), "extra-small"));
    expect(save.getAttribute("aria-disabled")).not.toBe("true");
    await act(() => store.set(tableDensityAtom(view.tableId), "large"));
    expect(save.getAttribute("aria-disabled")).toBe("true");
    await act(() => store.set(footerVisibleAtom(view.tableId), false));
    expect(save.getAttribute("aria-disabled")).not.toBe("true");
    const reset = document.querySelector<HTMLButtonElement>(
      '[aria-label="Reset view"]'
    );
    await act(() => reset?.click());
    expect(store.get(footerVisibleAtom(view.tableId))).toBe(true);
    expect(save.getAttribute("aria-disabled")).toBe("true");
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});

it("loads persisted views without initialViews on every mount and restores their density", async () => {
  const { DataTableViewManager } = await import(
    "../src/components/ui/yayaw-table/components/toolbar/table-view-manager"
  );
  const { TableStateSyncProvider } = await import(
    "../src/components/ui/yayaw-table/providers/table-state-sync-provider"
  );
  const view = {
    id: "persisted",
    name: "Persisted compact view",
    tableId: "density-reload",
    createdById: "local",
    isDefault: true,
    config: {
      density: "extra-small" as const,
      displayMode: "table" as const,
      pageSize: 10,
    },
  };
  let calls = 0;
  const getTableActions = () => ({
    views: {
      list: () => {
        calls++;
        return Promise.resolve({ data: [view] });
      },
    },
  });
  for (let mountIndex = 0; mountIndex < 2; mountIndex++) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const store = createStore();
    const queryClient = new QueryClient();
    try {
      await act(async () => {
        root.render(
          <Provider store={store}>
            <NuqsTestingAdapter hasMemory>
              <TableStateSyncProvider enabled={false}>
                <TableProvider
                  getTableActions={getTableActions}
                  queryClient={queryClient}
                  tableId={view.tableId}
                  translations={defaultTranslations}
                >
                  <DataTableViewManager
                    defaultDensity="large"
                    tableId={view.tableId}
                    tableType={view.tableId}
                    tabs={false}
                  />
                </TableProvider>
              </TableStateSyncProvider>
            </NuqsTestingAdapter>
          </Provider>
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
      expect(container.textContent).toContain(view.name);
      expect(store.get(tableDensityAtom(view.tableId))).toBe("extra-small");
    } finally {
      await act(() => root.unmount());
      container.remove();
      queryClient.clear();
    }
  }
  expect(calls).toBe(2);
});
