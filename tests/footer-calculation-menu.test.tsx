import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { columnCalculationsAtom } from "../src/components/ui/yayaw-table/atoms/footer-atoms";
import { CalculationMenu } from "../src/components/ui/yayaw-table/components/footer/calculation-menu";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const menuItem = (label: string): HTMLElement => {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("[role^='menuitem']")
  ).find((element) => element.textContent === label);
  if (!item) {
    throw new Error(`Missing calculation menu item: ${label}`);
  }
  return item;
};

it("selects a calculation through a Shadcn submenu and clears a configured default", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  const tableId = "footer-menu";
  store.set(columnCalculationsAtom(tableId), {});
  try {
    await act(() =>
      root.render(
        <Provider store={store}>
          <TableProvider
            queryClient={queryClient}
            tableId={tableId}
            translations={defaultTranslations}
          >
            <CalculationMenu
              columnId="amount"
              columnType="number"
              defaultCalculation="sum"
              result={{ label: "60", raw: 60 }}
              tableId={tableId}
              tableType={tableId}
            />
          </TableProvider>
        </Provider>
      )
    );
    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("Sum");
    expect(trigger?.textContent).toContain("60");
    await act(() => trigger?.click());
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]')
    ).not.toBeNull();
    await act(() => menuItem("More options").click());
    expect(menuItem("Sum").getAttribute("aria-checked")).toBe("true");
    await act(() => menuItem("Average").click());
    expect(store.get(columnCalculationsAtom(tableId))).toEqual({
      amount: "average",
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    await act(() => trigger?.click());
    await act(() => menuItem("None").click());
    expect(store.get(columnCalculationsAtom(tableId))).toEqual({
      amount: "none",
    });
    expect(trigger?.textContent).not.toContain("Sum");
    expect(trigger?.textContent).not.toContain("60");
    await act(() => trigger?.click());
    expect(menuItem("None").getAttribute("aria-checked")).toBe("true");
    await act(() =>
      menuItem("None").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(store.get(columnCalculationsAtom(tableId))).toEqual({
      amount: "none",
    });
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
    store.set(columnCalculationsAtom(tableId), {});
  }
});
