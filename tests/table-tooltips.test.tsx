import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TableDensityMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-density-menu";
import { DataTableViewManager } from "../src/components/ui/yayaw-table/components/toolbar/table-view-manager";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

it("shows translated density and view-action tooltips on keyboard focus without native duplicates", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  const translations = {
    ...defaultTranslations,
    menu: { ...defaultTranslations.menu, density: "Densité du tableau" },
    views: {
      ...defaultTranslations.views,
      saveCurrent: "Enregistrer cette vue",
    },
  };
  try {
    await act(async () => {
      root.render(
        <NuqsTestingAdapter>
          <Provider>
            <TableProvider
              queryClient={queryClient}
              tableId="tooltip"
              translations={translations}
            >
              <TableDensityMenu tableId="tooltip" />
              <DataTableViewManager tableId="tooltip" tableType="tooltip" />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    for (const label of ["Densité du tableau: M", "Enregistrer cette vue"]) {
      if (label === "Enregistrer cette vue") {
        await act(async () => {
          container
            .querySelector<HTMLButtonElement>('[aria-label="Current View"]')
            ?.click();
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
      }
      const trigger = document.querySelector<HTMLButtonElement>(
        `[aria-label="${label}"]`
      );
      expect(trigger).not.toBeNull();
      expect(trigger?.hasAttribute("title")).toBe(false);
      await act(async () => {
        // Happy DOM has no keyboard focus-visible rendering state.
        if (trigger) {
          const matches = trigger.matches.bind(trigger);
          trigger.matches = (selector) =>
            selector === ":focus-visible" || matches(selector);
          trigger.focus();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(
        document.querySelector('[data-slot="tooltip-content"][data-open]')
          ?.textContent
      ).toBe(label);
      await act(() => trigger?.blur());
    }
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});
