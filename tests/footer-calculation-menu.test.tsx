import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { columnCalculationsAtom } from "../src/components/ui/yayaw-table/atoms/footer-atoms";
import { CalculationMenu } from "../src/components/ui/yayaw-table/components/footer/calculation-menu";
import { calculateRowsColumn } from "../src/components/ui/yayaw-table/hooks/use-global-column-calculations";
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

it("names the rows a footer result covers and keeps the calculator tooltip otherwise", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  const tableId = "footer-scope";
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
              detail="This page: 10 | All rows: 40"
              result={{ label: "10", raw: 10 }}
              scopeLabel="Selection (1)"
              tableId={tableId}
              tableType={tableId}
            />
          </TableProvider>
        </Provider>
      )
    );
    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("Sum · Selection (1)");
    expect(trigger?.textContent).toContain("10");
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
    store.set(columnCalculationsAtom(tableId), {});
  }
});

it("shows a frozen calculation without a menu, and nothing when it has none", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  const tableId = "footer-locked";
  // A choice saved before the column was frozen no longer applies.
  store.set(columnCalculationsAtom(tableId), { amount: "average" });
  const render = (defaultCalculation?: "sum") =>
    act(() =>
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
              defaultCalculation={defaultCalculation}
              isLocked
              result={{ label: "60", raw: 60 }}
              tableId={tableId}
              tableType={tableId}
            />
          </TableProvider>
        </Provider>
      )
    );
  try {
    await render("sum");
    expect(container.querySelector("button")).toBeNull();
    const locked = container.querySelector("[data-calculation-locked]");
    expect(locked?.textContent).toContain("Sum");
    expect(locked?.textContent).toContain("60");
    expect(locked?.textContent).not.toContain("Average");
    await render();
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
    store.set(columnCalculationsAtom(tableId), {});
  }
});

it("shows the viewer's calculation as plain text while calculations are not edited", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient();
  const tableId = "footer-read-only";
  store.set(columnCalculationsAtom(tableId), { amount: "average" });
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
              isReadOnly
              result={{ label: "20", raw: 20 }}
              tableId={tableId}
              tableType={tableId}
            />
          </TableProvider>
        </Provider>
      )
    );
    expect(container.querySelector("button")).toBeNull();
    const text = container.querySelector("[data-calculation-locked]");
    expect(text?.textContent).toContain("Average");
    expect(text?.textContent).toContain("20");
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
    store.set(columnCalculationsAtom(tableId), {});
  }
});

it("calculates held rows per currency, never mixing them", () => {
  const result = calculateRowsColumn(
    [
      { amount: 10, currency: "EUR" },
      { amount: 5, currency: "USD" },
      { amount: 20, currency: "EUR" },
    ],
    "amount",
    "sum",
    {
      id: "amount",
      type: "number",
      numberFormat: { currencyColumn: "currency" },
    },
    "number",
    "en"
  );
  expect(result.label).toContain("30");
  expect(result.label).toContain("5");
  expect(result.label).not.toContain("35");
});
