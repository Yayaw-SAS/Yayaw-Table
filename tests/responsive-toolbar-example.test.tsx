import "./setup-dom";
import { expect, it } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveToolbarExample } from "../examples/responsive-toolbar-react";

const names = ["Atlas", "Beacon", "Current"];
const displayedNames = (container: HTMLElement) =>
  [...container.querySelectorAll("tbody tr")]
    .map((row) =>
      [...row.querySelectorAll("td")]
        .map((cell) => cell.textContent?.trim())
        .find((text) => names.includes(text ?? ""))
    )
    .filter(Boolean);

async function waitForRows(container: HTMLElement, expected: string[]) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      JSON.stringify(displayedNames(container)) === JSON.stringify(expected)
    ) {
      break;
    }
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }
  return displayedNames(container);
}

async function clickButton(name: string, inDialog = false) {
  let button: HTMLButtonElement | undefined;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const scope = inDialog
      ? document.querySelector('[role="dialog"]')
      : document;
    button = [
      ...(scope?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ].find(
      (element) =>
        element.getAttribute("aria-label") === name ||
        element.textContent?.trim() === name
    );
    if (button) {
      break;
    }
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }
  if (!button) {
    throw new Error(
      `Missing button: ${name}. Available: ${document.body.textContent}`
    );
  }
  await act(() => button.click());
}

async function mountExample(searchParams: Record<string, string> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
          <QueryClientProvider client={client}>
            <ResponsiveToolbarExample />
          </QueryClientProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  return {
    container,
    cleanup: async () => {
      await act(() => root.unmount());
      client.clear();
      container.remove();
    },
  };
}

it("changes the real preview row order when the user cycles the Price sort", async () => {
  const preview = await mountExample();
  try {
    expect(
      await waitForRows(preview.container, ["Atlas", "Beacon", "Current"])
    ).toEqual(["Atlas", "Beacon", "Current"]);
    await clickButton("Current View");
    await clickButton("Sort", true);
    await clickButton("Price", true);
    expect(
      await waitForRows(preview.container, ["Beacon", "Atlas", "Current"])
    ).toEqual(["Beacon", "Atlas", "Current"]);
    await clickButton("Price", true);
    expect(
      await waitForRows(preview.container, ["Current", "Atlas", "Beacon"])
    ).toEqual(["Current", "Atlas", "Beacon"]);
    await clickButton("Reset", true);
    expect(
      await waitForRows(preview.container, ["Atlas", "Beacon", "Current"])
    ).toEqual(["Atlas", "Beacon", "Current"]);
  } finally {
    await preview.cleanup();
  }
});

it("renders only matching rows for a restored advanced filter and sorts those rows", async () => {
  const preview = await mountExample({
    "responsive-toolbar-advancedFilters": JSON.stringify([
      {
        id: "open-rule",
        columnId: "status",
        type: "select",
        operator: "is",
        values: "Open",
        isActive: true,
      },
    ]),
    "responsive-toolbar-sort": JSON.stringify([{ id: "price", desc: true }]),
  });
  try {
    expect(await waitForRows(preview.container, ["Current", "Atlas"])).toEqual([
      "Current",
      "Atlas",
    ]);
    expect(preview.container.querySelector("tbody")?.textContent).not.toContain(
      "Beacon"
    );
    await clickButton("Current View");
    await clickButton("Filter1", true);
    expect(
      document.querySelectorAll('[role="dialog"] button button')
    ).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Open"
    );
  } finally {
    await preview.cleanup();
  }
});

it("restores an ungrouped temporary view even when the application configures Kanban lanes", async () => {
  const preview = await mountExample({
    "responsive-toolbar-grouping": JSON.stringify(["status"]),
  });
  try {
    await waitForRows(preview.container, ["Atlas", "Current", "Beacon"]);
    expect(
      preview.container.querySelectorAll(
        "tbody td[colspan] button[aria-expanded]"
      )
    ).toHaveLength(2);
    await clickButton("Current View");
    await clickButton("XS", true);
    await clickButton("Reset view", true);
    expect(
      await waitForRows(preview.container, ["Atlas", "Beacon", "Current"])
    ).toEqual(["Atlas", "Beacon", "Current"]);
    expect(
      preview.container.querySelectorAll(
        "tbody td[colspan] button[aria-expanded]"
      )
    ).toHaveLength(0);
    expect(
      preview.container
        .querySelector("[data-density]")
        ?.getAttribute("data-density")
    ).toBe("medium");
  } finally {
    await preview.cleanup();
  }
});

it("restores saved filters, grouping and density and clears the dirty indicator", async () => {
  const preview = await mountExample();
  try {
    await waitForRows(preview.container, ["Atlas", "Beacon", "Current"]);
    await clickButton("Current View");
    await clickButton("Open items", true);
    expect(await waitForRows(preview.container, ["Atlas", "Current"])).toEqual([
      "Atlas",
      "Current",
    ]);
    expect(
      preview.container.querySelector('[aria-label="Unsaved changes"]')
    ).toBeNull();
    await clickButton("Current View");
    await clickButton("XS", true);
    await clickButton("Group", true);
    await clickButton("Status", true);
    await waitForRows(preview.container, ["Atlas", "Current"]);
    expect(
      preview.container.querySelectorAll(
        "tbody td[colspan] button[aria-expanded]"
      )
    ).toHaveLength(1);
    expect(
      preview.container.querySelector('[aria-label="Unsaved changes"]')
    ).not.toBeNull();
    await clickButton("Back", true);
    await clickButton("Reset view", true);
    expect(await waitForRows(preview.container, ["Atlas", "Current"])).toEqual([
      "Atlas",
      "Current",
    ]);
    expect(
      preview.container.querySelectorAll(
        "tbody td[colspan] button[aria-expanded]"
      )
    ).toHaveLength(0);
    expect(
      preview.container.querySelector('[aria-label="Unsaved changes"]')
    ).toBeNull();
    expect(
      preview.container
        .querySelector("[data-density]")
        ?.getAttribute("data-density")
    ).toBe("medium");
    expect(
      document
        .querySelector('[aria-label="Save changes"]')
        ?.getAttribute("aria-disabled")
    ).toBe("true");
  } finally {
    await preview.cleanup();
  }
});

it("lets the preview custom onBulkEdit update only the selected records", async () => {
  const preview = await mountExample();
  try {
    await waitForRows(preview.container, ["Atlas", "Beacon", "Current"]);
    await act(() =>
      preview.container
        .querySelector<HTMLInputElement>('input[id$="-bulk"]')
        ?.click()
    );
    const checkboxes = preview.container.querySelectorAll<HTMLElement>(
      'tbody [role="checkbox"][aria-label="Select row"]'
    );
    expect(checkboxes).toHaveLength(3);
    await act(() => checkboxes[0]?.click());
    await act(() => checkboxes[1]?.click());
    await clickButton("Edit");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Edit 2 selected items"
    );
    await clickButton("Apply to selected items", true);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        preview.container.textContent?.includes(
          "Updated 2 selected items to Closed."
        )
      ) {
        break;
      }
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
    const rendered = Array.from(
      preview.container.querySelectorAll("tbody tr")
    ).map((row) => row.textContent);
    expect(rendered[0]).toContain("Closed");
    expect(rendered[1]).toContain("Closed");
    expect(rendered[2]).toContain("Open");
    expect(
      preview.container.querySelectorAll('tbody [aria-checked="true"]')
    ).toHaveLength(0);
    expect(preview.container.textContent).toContain(
      "Updated 2 selected items to Closed."
    );
  } finally {
    await preview.cleanup();
  }
});
