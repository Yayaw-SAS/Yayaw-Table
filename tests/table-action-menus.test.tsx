import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { catalogueFormAtom } from "../src/components/ui/yayaw-table/components/forms/atoms/catalogue-form-atoms";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

const rows = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];
const actions: TableActions = {
  list: async () => ({ data: rows, meta: { pageCount: 1, totalCount: 2 } }),
  update: async () => ({ success: true }),
  create: async () => ({ success: true }),
};
const getTableActions = () => actions;
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

function required<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Expected the table control to be rendered");
  }
  return value;
}

for (const syncUrl of [false, true]) {
  it(`keeps row and bulk actions usable across renders with syncUrl=${syncUrl}`, async () => {
    const tableId = `action-menus-${syncUrl}`;
    const config = defineTableConfig({
      id: tableId,
      columns: {
        definitions: [{ id: "name", header: "Name", type: "text" }],
        visible: ["select", "name", "actions"],
        mandatory: ["name"],
        order: ["select", "name", "actions"],
      },
      table: { syncUrl, allowCreate: true, actionsAsIcons: syncUrl },
      translations: { namespace: tableId, keys: { title: "Action menus" } },
    });
    const getTableConfig = () => config;
    const store = createStore();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const editedIds: unknown[][] = [];
    let commits = 0;
    let stage = "mount";
    const recentWrites: string[] = [];
    const originalSet = store.set;
    store.set = ((...args: Parameters<typeof store.set>) => {
      const result = originalSet(...args);
      try {
        recentWrites.push(
          `${args[0]}: ${JSON.stringify(store.get(args[0])).slice(0, 1000)}`
        );
      } catch {
        recentWrites.push(`${args[0]}: cyclic value`);
      }
      if (recentWrites.length > 12) {
        recentWrites.shift();
      }
      return result;
    }) as typeof store.set;
    const render = (description: string) => {
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory>
            <Profiler
              id="table"
              onRender={() => {
                commits += 1;
                // Fail promptly if a controlled-state feedback loop returns.
                if (commits > 200) {
                  throw new Error(
                    `Table did not settle after 200 commits during ${stage}: ${JSON.stringify(recentWrites)}`
                  );
                }
              }}
            >
              <DataTable
                description={description}
                getTableActions={getTableActions}
                getTableConfig={getTableConfig}
                initialData={rows}
                initialPageCount={1}
                initialRowCount={2}
                onBulkEdit={(selected) => {
                  editedIds.push(selected.map((row) => row.original.id));
                  return {
                    success: true,
                    closeMenu: true,
                    clearSelection: true,
                  };
                }}
                queryClient={client}
                tableType={tableId}
              />
            </Profiler>
          </NuqsTestingAdapter>
        </Provider>
      );
    };
    try {
      await act(async () => {
        render("Initial");
        await settle();
      });
      await act(settle);
      const create = required(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find(
          (button) =>
            (button.getAttribute("aria-label") ?? button.textContent) ===
            "Add Item"
        )
      );
      expect(create.className).toContain("bg-primary");
      const toolbar = required(
        create.closest('[role="toolbar"]') ?? create.parentElement
      );
      expect(Array.from(toolbar.querySelectorAll("button")).at(-1)).toBe(
        create
      );
      const trigger = required(
        container.querySelector<HTMLButtonElement>(
          'tbody [aria-label="Actions"]'
        )
      );
      stage = "open row menu";
      await act(() => trigger.click());
      await act(settle);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      await act(async () => {
        stage = "rerender open menu";
        render("Updated description");
        await settle();
      });
      expect(container.querySelector('tbody [aria-label="Actions"]')).toBe(
        trigger
      );
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      const edit = required(
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          (item) => item.textContent?.trim() === "Edit"
        )
      );
      await act(async () => {
        stage = "open edit form";
        edit.click();
        await settle();
      });
      expect(store.get(catalogueFormAtom).isOpen).toBe(true);
      expect(store.get(catalogueFormAtom).initialData?.id).toBe("1");
      stage = "close edit form";
      await act(() =>
        store.set(catalogueFormAtom, (previous) => ({
          ...previous,
          isOpen: false,
        }))
      );
      const checkbox = required(
        container.querySelector<HTMLElement>(
          'tbody [role="checkbox"][aria-label="Select row"]'
        )
      );
      await act(async () => {
        stage = "select row";
        checkbox.click();
        await settle();
      });
      expect(checkbox.getAttribute("aria-checked")).toBe("true");
      const close = required(
        container.querySelector<HTMLButtonElement>(
          '[aria-label="Close bulk actions menu"]'
        )
      );
      await act(async () => {
        stage = "rerender bulk selection";
        render("Selection preserved");
        await settle();
      });
      expect(
        container.querySelector('[aria-label="Close bulk actions menu"]')
      ).toBe(close);
      const bulkEdit = required(
        close.parentElement?.querySelector<HTMLButtonElement>(
          "button:has(svg.lucide-square-pen)"
        )
      );
      await act(async () => {
        stage = "bulk edit";
        bulkEdit.click();
        await settle();
      });
      expect(editedIds).toEqual([["1"]]);
      expect(
        container.querySelector('[aria-label="Close bulk actions menu"]')
      ).toBeNull();
      expect(
        container
          .querySelector('tbody [aria-label="Select row"]')
          ?.getAttribute("aria-checked")
      ).toBe("false");
      const selectAll = required(
        container.querySelector<HTMLElement>(
          '[role="checkbox"][aria-label="Select all rows"]'
        )
      );
      await act(async () => {
        stage = "select all";
        selectAll.click();
        await settle();
      });
      expect(
        [
          ...container.querySelectorAll('tbody [aria-label="Select row"]'),
        ].every((item) => item.getAttribute("aria-checked") === "true")
      ).toBe(true);
      await act(async () => {
        required(
          container.querySelector<HTMLButtonElement>(
            '[aria-label="Close bulk actions menu"]'
          )
        ).click();
        await settle();
      });
      expect(
        [
          ...container.querySelectorAll('tbody [aria-label="Select row"]'),
        ].every((item) => item.getAttribute("aria-checked") === "false")
      ).toBe(true);
    } finally {
      stage = "unmount";
      await act(() => root.unmount());
      client.clear();
      container.remove();
    }
  });
}
