import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  StackMenu,
  StackMenuView,
} from "../src/components/ui/custom/stack-menu";
import { TableGalleryMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-gallery-menu";
import { TableGanttSettings } from "../src/components/ui/yayaw-table/components/toolbar/table-gantt-settings";
import { TableKanbanGroupingMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-kanban-grouping-menu";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const columns = [
  { id: "name", label: "Name", type: "text" },
  { id: "status", label: "Status", type: "select" },
  { id: "image", label: "Image", type: "image" },
  { id: "amount", label: "Amount", type: "number" },
];
const defaults = { titleColumn: "name", cardColumnIds: ["amount"] };
const wait = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));
const button = (name: string) => {
  const element = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name
  );
  if (!element) {
    throw new Error(`Missing button ${name}`);
  }
  return element;
};
const click = async (name: string) => {
  await act(() => button(name).click());
  await wait();
};

async function fixture(mode: "kanban" | "gallery" | "gantt", mobile: boolean) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const queryClient = new QueryClient();
  let snapshot: ReturnType<typeof useTableUrlState>;
  function State() {
    snapshot = useTableUrlState({
      tableId: "settings",
      defaultDisplayMode: mode,
    });
    return null;
  }
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <Provider store={createStore()}>
          <TableProvider
            queryClient={queryClient}
            tableId="settings"
            translations={defaultTranslations}
          >
            <State />
            <StackMenu
              asDropdown
              compact={mobile}
              defaultView="settings"
              trigger={<button type="button">Settings</button>}
            >
              <StackMenuView name="settings" title="Settings">
                {mode === "gallery" ? (
                  <TableGalleryMenu
                    columns={columns}
                    defaultConfig={defaults}
                    defaultDisplayMode={mode}
                    embedded
                    tableId="settings"
                  />
                ) : null}
                {mode === "kanban" ? (
                  <TableKanbanGroupingMenu
                    columns={columns}
                    defaultConfig={defaults}
                    defaultDisplayMode={mode}
                    defaultGroupBy="status"
                    embedded
                    tableId="settings"
                  />
                ) : null}
                {mode === "gantt" ? (
                  <TableGanttSettings
                    defaultDisplayMode={mode}
                    tableId="settings"
                  />
                ) : null}
              </StackMenuView>
            </StackMenu>
          </TableProvider>
        </Provider>
      </NuqsTestingAdapter>
    )
  );
  return {
    state: () => snapshot,
    cleanup: async () => {
      await act(() => root.unmount());
      host.remove();
      queryClient.clear();
    },
  };
}

for (const mode of ["gallery", "kanban"] as const) {
  it(`${mode} properties support repeated changes and return focus without another overlay`, async () => {
    const test = await fixture(mode, false);
    try {
      await click("Settings");
      await click("Properties");
      const checkbox =
        document.querySelector<HTMLButtonElement>('[role="checkbox"]');
      expect(checkbox).toBeTruthy();
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      const amount = [
        ...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'),
      ].find((item) => item.getAttribute("aria-label") === "Amount");
      if (!amount) {
        throw new Error("Missing Amount checkbox");
      }
      await act(() => amount.click());
      expect(
        (mode === "gallery"
          ? test.state().galleryParam
          : test.state().kanbanParam
        )?.cardColumnIds
      ).toEqual([]);
      await act(() => amount.click());
      expect(
        (mode === "gallery"
          ? test.state().galleryParam
          : test.state().kanbanParam
        )?.cardColumnIds
      ).toEqual(["amount"]);
      await click("Back");
      expect(document.activeElement).toBe(button("Properties"));
    } finally {
      await test.cleanup();
    }
  });
}
for (const mode of ["gallery", "kanban", "gantt"] as const) {
  it(`${mode} mobile choices stay inside one drawer and preserve view state`, async () => {
    const test = await fixture(mode, true);
    try {
      await click("Settings");
      expect(
        document.querySelector('[data-slot="drawer-content"]')
      ).toBeTruthy();
      await click(mode === "gantt" ? "Zoom" : "Title");
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      expect(
        document.querySelector('[data-slot="drawer-title"]')?.textContent
      ).toBe(mode === "gantt" ? "Zoom" : "Title");
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      const radios = [
        ...document.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
      ];
      const target = radios.find(
        (item) =>
          item.getAttribute("aria-label") ===
          (mode === "gantt" ? "Month" : "Amount")
      );
      if (!target) {
        throw new Error("Missing radio choice");
      }
      await act(() => target.click());
      await wait();
      expect(
        document.querySelector('[data-slot="drawer-title"]')?.textContent
      ).toBe("Settings");
      if (mode === "gantt") {
        expect(test.state().ganttParam.zoom).toBe("month");
      }
      if (mode === "gallery") {
        expect(test.state().galleryParam?.titleColumn).toBe("amount");
      }
      if (mode === "kanban") {
        expect(test.state().kanbanParam?.titleColumn).toBe("amount");
      }
      expect(document.activeElement).toBe(
        button(mode === "gantt" ? "Zoom" : "Title")
      );
    } finally {
      await test.cleanup();
    }
  });
}
