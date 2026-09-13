import "./setup-dom";
import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { useDataTableAdvancedFilters } from "../src/components/ui/yayaw-table/hooks/use-data-table-advanced-filters";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

for (const syncUrl of [false, true]) {
  it(`scopes advanced filters to the instance with syncUrl=${syncUrl}`, async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const client = new QueryClient();
    const store = createStore();
    const config = defineTableConfig({
      id: "products",
      translations: { namespace: "test", keys: {} },
      columns: {
        definitions: [{ id: "price", header: "Price", type: "number" }],
        order: ["price"],
        visible: ["price"],
        mandatory: [],
      },
      table: { syncUrl },
    });
    let controls!: ReturnType<typeof useDataTableAdvancedFilters>;
    let instance!: ReturnType<typeof useTableUrlState>;
    let other!: ReturnType<typeof useTableUrlState>;
    function Probe() {
      controls = useDataTableAdvancedFilters({
        tableType: "products",
        tableId: "inventory",
      });
      instance = useTableUrlState({ tableId: "inventory", enabled: syncUrl });
      other = useTableUrlState({ tableId: "products", enabled: syncUrl });
      return null;
    }
    try {
      await act(() =>
        root.render(
          <Provider store={store}>
            <NuqsTestingAdapter hasMemory>
              <TableProvider
                getTableConfig={() => config}
                queryClient={client}
                tableId="inventory"
                translations={defaultTranslations}
              >
                <Probe />
              </TableProvider>
            </NuqsTestingAdapter>
          </Provider>
        )
      );
      await act(async () => {
        controls.advancedActions.addFilter({
          columnId: "price",
          type: "number",
          operator: "equals",
          values: 65,
          isActive: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(instance.advancedFiltersParam).toHaveLength(1);
      expect(instance.advancedFiltersParam[0]?.values).toBe(65);
      expect(other.advancedFiltersParam).toHaveLength(0);
      await act(async () => {
        instance.resetAdvancedFilters();
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(controls.advancedFilters).toHaveLength(0);
    } finally {
      await act(() => root.unmount());
      client.clear();
      container.remove();
    }
  });
}
