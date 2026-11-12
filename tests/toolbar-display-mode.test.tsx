import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  TableDisplayModeSegments,
  TableDisplayModeSwitcher,
} from "../src/components/ui/yayaw-table/components/toolbar/table-display-mode-switcher";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

it("keeps labelled display choices keyboard accessible and preserves pressed state", async () => {
  // Touch layouts keep the buttons; wider screens get a menu (next test).
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 400,
  });
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
  }
});

it("offers display modes as labelled layout tiles on wider screens", async () => {
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
              tableId="toolbar-menu"
              translations={defaultTranslations}
            >
              <TableDisplayModeSwitcher
                displayModes={["table", "kanban", "gallery", "calendar"]}
                tableId="toolbar-menu"
              />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      )
    );
    const group = container.querySelector("fieldset");
    expect(group?.querySelector("legend")?.textContent).toBe("Display mode");
    const tiles = [...container.querySelectorAll<HTMLElement>("[data-layout]")];
    expect(tiles.map((tile) => tile.dataset.layout)).toEqual([
      "table",
      "kanban",
      "gallery",
      "calendar",
    ]);
    expect(tiles[0]?.getAttribute("aria-pressed")).toBe("true");
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});

it("shows the display modes as a pressed-state segmented control, and nothing for one mode", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  const render = (displayModes: ("kanban" | "list" | "table")[]) =>
    act(() =>
      root.render(
        <NuqsTestingAdapter hasMemory>
          <Provider>
            <TableProvider
              queryClient={queryClient}
              tableId="toolbar-segments"
              translations={defaultTranslations}
            >
              <TableDisplayModeSegments
                displayModes={displayModes}
                tableId="toolbar-segments"
              />
            </TableProvider>
          </Provider>
        </NuqsTestingAdapter>
      )
    );
  try {
    await render(["table"]);
    expect(container.querySelector("[data-display-mode-switch]")).toBeNull();
    await render(["table", "list", "kanban"]);
    const group = container.querySelector("fieldset[data-display-mode-switch]");
    expect(group?.querySelector("legend")?.textContent).toBe("Display mode");
    const segments = [
      ...(group?.querySelectorAll<HTMLButtonElement>("button[data-layout]") ??
        []),
    ];
    expect(segments.map((segment) => segment.dataset.layout)).toEqual([
      "table",
      "list",
      "kanban",
    ]);
    expect(segments.map((segment) => segment.textContent?.trim())).toEqual([
      "Table",
      "List",
      "Kanban",
    ]);
    expect(segments.at(0)?.getAttribute("aria-pressed")).toBe("true");
    const kanban = segments.at(2);
    await act(async () => {
      kanban?.focus();
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(kanban ?? null);
    await act(() => kanban?.click());
    expect(kanban?.getAttribute("aria-pressed")).toBe("true");
    expect(group?.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});
