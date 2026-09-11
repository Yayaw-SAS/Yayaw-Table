import "./setup-dom";
import { expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AdvancedFilterPanel } from "../src/components/ui/yayaw-table/components/filters/advanced-filter-panel";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import type { AdvancedFilterModel } from "../src/components/ui/yayaw-table/types/filter-types";
import fixtures from "./fixtures/numeric-filter-drafts.json";

const columnsConfig = { price: { type: "number" as const, label: "Price" } };
async function mountPanel(filters: AdvancedFilterModel[] = []) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  const actions = {
    addFilter: mock(),
    updateFilter: mock(),
    removeFilter: mock(),
    toggleFilter: mock(),
    clearFilters: mock(),
    setFilters: mock(),
    applyPreset: mock(),
    savePreset: mock(),
  };
  await act(() =>
    root.render(
      <TableProvider
        queryClient={client}
        tableId="drafts"
        translations={defaultTranslations}
      >
        <AdvancedFilterPanel
          actions={actions}
          columnsConfig={columnsConfig}
          filters={filters}
        />
      </TableProvider>
    )
  );
  return {
    container,
    actions,
    cleanup: async () => {
      await act(() => root.unmount());
      client.clear();
      container.remove();
    },
  };
}
async function click(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text
  );
  if (!button) {
    throw new Error(`Missing button: ${text}`);
  }
  await act(() => button.click());
}
async function input(element: HTMLInputElement, text: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
for (const fixture of fixtures) {
  it(`stages ${fixture.text} without committing until Done`, async () => {
    const panel = await mountPanel();
    try {
      await click(panel.container, "Price");
      const field = panel.container.querySelector<HTMLInputElement>(
        'input[type="number"]'
      );
      if (!field) {
        throw new Error("Missing numeric draft");
      }
      // Model each input event, including the intermediate numeric text.
      for (let index = 1; index <= fixture.text.length; index += 1) {
        await input(field, fixture.text.slice(0, index));
      }
      expect(field.value).toBe(fixture.text);
      expect(panel.actions.addFilter).not.toHaveBeenCalled();
      expect(panel.actions.updateFilter).not.toHaveBeenCalled();
      expect(panel.container.querySelector('[role="slider"]')).toBeNull();
      await click(panel.container, "Done");
      expect(panel.actions.addFilter).toHaveBeenCalledTimes(1);
      expect(panel.actions.addFilter.mock.calls[0]?.[0]).toMatchObject({
        columnId: "price",
        values: fixture.value,
        isActive: true,
      });
      // No delayed callback may overwrite the committed value.
      await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
      expect(panel.actions.addFilter).toHaveBeenCalledTimes(1);
    } finally {
      await panel.cleanup();
    }
  });
}
it("keeps an applied rule unchanged while editing, rejects blanks and discards edits on Escape", async () => {
  const panel = await mountPanel([
    {
      createdAt: new Date(),
      updatedAt: new Date(),
      id: "saved",
      columnId: "price",
      type: "number",
      operator: "equals",
      values: 24,
      isActive: true,
    },
  ]);
  try {
    const edit =
      panel.container.querySelector<HTMLButtonElement>(
        'button[data-slot="tooltip-trigger"]'
      ) ?? panel.container.querySelector<HTMLButtonElement>("button");
    await act(() => edit?.click());
    const field = panel.container.querySelector<HTMLInputElement>(
      'input[type="number"]'
    );
    if (!field) {
      throw new Error("Missing numeric draft");
    }
    await input(field, "");
    expect(
      panel.container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled
    ).toBe(true);
    await input(field, "36");
    expect(panel.actions.updateFilter).not.toHaveBeenCalled();
    await act(() =>
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    expect(panel.actions.updateFilter).not.toHaveBeenCalled();
    expect(panel.container.querySelector('input[type="number"]')).toBeNull();
    expect(panel.container.textContent).toContain("24");
  } finally {
    await panel.cleanup();
  }
});
it("commits the latest numeric range as one filter and rejects an incomplete endpoint", async () => {
  const panel = await mountPanel([
    {
      createdAt: new Date(),
      updatedAt: new Date(),
      id: "range",
      columnId: "price",
      type: "number",
      operator: "between",
      values: [0, 100],
      isActive: true,
    },
  ]);
  try {
    await act(() =>
      panel.container
        .querySelector<HTMLButtonElement>('button[data-slot="tooltip-trigger"]')
        ?.click()
    );
    const fields = panel.container.querySelectorAll<HTMLInputElement>(
      'input[type="number"]'
    );
    await input(fields[0], "24");
    await input(fields[1], "");
    expect(
      panel.container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled
    ).toBe(true);
    await input(fields[1], "36");
    expect(panel.actions.updateFilter).not.toHaveBeenCalled();
    await act(() =>
      panel.container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        )
    );
    expect(panel.actions.updateFilter).toHaveBeenCalledTimes(1);
    expect(panel.actions.updateFilter.mock.calls[0]).toEqual([
      "range",
      { operator: "between", values: [24, 36] },
    ]);
  } finally {
    await panel.cleanup();
  }
});
