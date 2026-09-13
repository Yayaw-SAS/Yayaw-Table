import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TableDisplayModeSwitcher } from "../src/components/ui/yayaw-table/components/toolbar/table-display-mode-switcher";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

it("keeps labelled display choices keyboard accessible and preserves pressed state", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  try {
    await act(() =>
      root.render(
        <NuqsTestingAdapter hasMemory>
          <Provider>
            <TableProvider
              queryClient={queryClient}
              tableId="toolbar-modes"
              translations={defaultTranslations}
            >
              <TableDisplayModeSwitcher
                displayModes={["table", "kanban", "gallery", "table"]}
                tableId="toolbar-modes"
              />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      )
    );
    const group = container.querySelector("fieldset");
    expect(group?.querySelector("legend")?.textContent).toBeTruthy();
    const buttons = Array.from(
      group?.querySelectorAll<HTMLButtonElement>("button") ?? []
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    for (const button of buttons) {
      await act(async () => {
        button.focus();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(document.activeElement).toBe(button);
      expect(group?.querySelectorAll("button")).toHaveLength(3);
      expect(
        document.querySelector('[data-slot="tooltip-content"]')
      ).toBeNull();
      expect(group?.querySelector('[data-slot="tooltip-content"]')).toBeNull();
      await act(() => button.click());
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(group?.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    }
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});
