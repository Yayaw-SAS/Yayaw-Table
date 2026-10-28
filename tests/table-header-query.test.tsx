import "./setup-dom";
import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

for (const syncUrl of [false, true]) {
  it(`keeps header sorting on the parent query when tableId differs from tableType (syncUrl=${syncUrl})`, async () => {
    const tableId = `product-catalog-${syncUrl}`;
    const config = defineTableConfig({
      id: "products",
      columns: {
        definitions: [{ id: "name", header: "Name", type: "text" }],
        visible: ["name"],
        order: ["name"],
        mandatory: ["name"],
      },
      table: { syncUrl, enableViews: false },
      translations: { namespace: "products", keys: {} },
    });
    const lookedUpTypes: string[] = [];
    const requests: Record<string, unknown>[] = [];
    const actions: TableActions = {
      list: (params) => {
        requests.push(params);
        return Promise.resolve({
          data: [{ id: "1", name: "Desk lamp" }],
          meta: { pageCount: 1, totalCount: 1 },
        });
      },
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const settle = () =>
      act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    try {
      await act(() =>
        root.render(
          <NuqsTestingAdapter hasMemory>
            <DataTable
              getTableActions={(type) => {
                lookedUpTypes.push(type);
                return type === "products" ? actions : {};
              }}
              getTableConfig={() => config}
              queryClient={client}
              tableId={tableId}
              tableType="products"
            />
          </NuqsTestingAdapter>
        )
      );
      await settle();
      expect(new Set(lookedUpTypes)).toEqual(new Set(["products"]));
      expect(container.textContent).toContain("Desk lamp");
      const trigger = container.querySelector<HTMLButtonElement>("th button");
      expect(trigger).not.toBeNull();
      await act(() => trigger?.click());
      const descending = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent?.toLowerCase() === "sort descending");
      expect(descending).toBeDefined();
      await act(() => descending?.click());
      await settle();
      expect(requests.at(-1)?.sorting).toEqual([{ id: "name", desc: true }]);
      await act(async () => {
        await client.invalidateQueries();
      });
      await settle();
      expect(container.textContent).toContain("Desk lamp");
      expect(new Set(lookedUpTypes)).toEqual(new Set(["products"]));
    } finally {
      await act(() => root.unmount());
      client.clear();
      container.remove();
    }
  });
}
