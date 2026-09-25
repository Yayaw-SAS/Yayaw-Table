import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  assetColumns,
  assetTableOptions,
  createAssetActions,
} from "../examples/assets";
import type { TagRequest } from "../examples/tags";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

/**
 * Tags columns in the React table, with the Assets example's host: catalog
 * names and colors, create on the fly, bulk add and remove, Manage tags.
 */
const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const settleUntil = async (done: () => boolean, frames = 25): Promise<void> => {
  if (done() || frames === 0) {
    return;
  }
  await act(settle);
  await settleUntil(done, frames - 1);
};
const required = <T,>(value: T | null | undefined, what: string): T => {
  if (value == null) {
    throw new Error(`Missing ${what}`);
  }
  return value;
};

function assetsTable(options: { bulk?: "patch" | "values" } = {}) {
  const tagRequests: TagRequest[] = [];
  const host = createAssetActions({
    logTags: (request) => tagRequests.push(request),
  });
  const bulkCalls: [string[], Record<string, unknown>][] = [];
  const updates: [string, Record<string, unknown>][] = [];
  const actions = {
    ...host,
    bulkUpdate: (ids: string[], patch: Record<string, unknown>) => {
      bulkCalls.push([ids, patch]);
      if (ids.includes("team")) {
        // The other rows are saved; Team.jpg is not.
        host.bulkUpdate(
          ids.filter((id) => id !== "team"),
          patch
        );
        return Promise.resolve({
          success: false,
          error: "Team.jpg is locked",
          failedIds: ["team"],
        });
      }
      return host.bulkUpdate(ids, patch);
    },
    update: (id: string, patch: Record<string, unknown>) => {
      updates.push([id, patch]);
      return host.update(id, patch);
    },
  };
  const config = defineTableConfig({
    id: "assets",
    columns: {
      definitions: assetColumns.map((column) =>
        column.id === "tags" && options.bulk
          ? { ...column, tags: { bulk: options.bulk } }
          : column
      ),
      order: ["select", ...assetColumns.map((column) => column.id)],
      visible: ["select", "name", "tags"],
      mandatory: ["name"],
    },
    table: {
      ...assetTableOptions,
      displayModes: ["table"],
      defaultDisplayMode: "table",
      defaultPageSize: 50,
      pageSizeOptions: [50],
    },
    translations: { namespace: "assets", keys: { title: "Assets" } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const element = (
    <Provider store={createStore()}>
      <NuqsTestingAdapter hasMemory>
        <DataTable
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions as unknown as TableActions}
          getTableConfig={() => config}
          queryClient={client}
          tableType="assets"
        />
      </NuqsTestingAdapter>
    </Provider>
  );
  return { element, tagRequests, bulkCalls, updates, client };
}

async function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
    await settle();
  });
  await settleUntil(
    () => container.textContent?.includes("Office.jpg") ?? false
  );
  return container;
}

const rowOf = (container: HTMLElement, name: string) =>
  required(
    [...container.querySelectorAll("tr")].find((row) =>
      [...row.querySelectorAll("td")].some(
        (cell) => cell.textContent?.trim() === name
      )
    ),
    `row ${name}`
  );
const tagsCell = (container: HTMLElement, name: string) =>
  required(
    rowOf(container, name).querySelector<HTMLElement>(
      '[data-column-id="tags"]'
    ),
    `tags cell of ${name}`
  );
const options = () => [
  ...document.querySelectorAll<HTMLElement>('[role="option"]'),
];
const optionNamed = (text: string) =>
  required(
    options().find((option) => option.textContent?.trim().startsWith(text)),
    `option ${text}`
  );
const buttonNamed = (label: string) =>
  required(
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        button.getAttribute("aria-label") === label ||
        button.textContent?.trim() === label
    ),
    `button ${label}`
  );
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    input.focus();
    required(
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set,
      "value setter"
    ).call(input, value);
    // Typed text (Base UI opens its list on typing, not on autofill).
    const event = new Event("input", { bubbles: true });
    Object.defineProperty(event, "inputType", { value: "insertText" });
    input.dispatchEvent(event);
    await settle();
  });
}
async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key })
    );
    await settle();
  });
}
async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await settle();
  });
}

it("names and colors stored tag ids from the catalog, loaded once", async () => {
  const { element, tagRequests } = assetsTable();
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  const cell = tagsCell(container, "Logo mono.png");
  expect(cell.textContent).toContain("Brand");
  expect(cell.textContent).toContain("Print");
  const brand = required(
    [...cell.querySelectorAll<HTMLElement>(".yayaw-tag")].find(
      (chip) => chip.textContent === "Brand"
    ),
    "Brand chip"
  );
  expect(brand.className).toContain("yayaw-tag-tinted");
  expect(brand.getAttribute("style")).toContain("--yayaw-tag-color: #2563eb");
  expect(
    tagRequests.filter((request) => request.action === "list")
  ).toHaveLength(1);
});

it("creates a tag on the fly in a cell, selects it and saves the record", async () => {
  const { element, tagRequests, updates } = assetsTable();
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  const display = required(
    tagsCell(container, "Office.jpg").querySelector("button"),
    "editable cell"
  );
  await act(async () => {
    display.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await settle();
  });
  const input = required(
    tagsCell(container, "Office.jpg").querySelector<HTMLInputElement>(
      '[role="combobox"]'
    ),
    "tag input"
  );
  expect(document.activeElement).toBe(input);
  await type(input, "Summer");
  await click(optionNamed("Create “Summer”"));
  await settleUntil(
    () =>
      tagsCell(container, "Office.jpg").textContent?.includes("Summer") ?? false
  );
  expect(
    tagRequests.filter((request) => request.action === "create")
  ).toHaveLength(1);
  // Enter with nothing typed saves the cell.
  await press(input, "Enter");
  await settleUntil(() => updates.length > 0);
  expect(updates).toEqual([["office", { tags: ["tag-new-1"] }]]);
  await settleUntil(
    () => !tagsCell(container, "Office.jpg").querySelector('[role="combobox"]')
  );
  expect(tagsCell(container, "Office.jpg").textContent).toBe("Summer");
});

async function selectRows(container: HTMLElement, names: string[]) {
  for (const name of names) {
    await click(
      required(
        rowOf(container, name).querySelector<HTMLElement>('[role="checkbox"]'),
        `checkbox of ${name}`
      )
    );
  }
}

it("bulk add sends one { add, remove } patch in patch mode and shows the tags at once", async () => {
  const { element, bulkCalls } = assetsTable({ bulk: "patch" });
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  await selectRows(container, ["Office.jpg", "Workshop.jpg"]);
  await click(buttonNamed("Add tags"));
  const dialog = required(
    document.querySelector<HTMLElement>('[data-bulk-tags="add"]'),
    "bulk dialog"
  );
  expect(dialog.textContent).toContain("Add tags to 2 records");
  const picker = required(
    dialog.querySelector<HTMLInputElement>('[role="combobox"]'),
    "picker"
  );
  await type(picker, "Print");
  await click(optionNamed("Print"));
  await press(picker, "Escape");
  await click(buttonNamed("Add"));
  await settleUntil(() => bulkCalls.length > 0);
  expect(bulkCalls).toEqual([
    [["office", "workshop"], { tags: { add: ["tag-print"], remove: [] } }],
  ]);
  await settleUntil(
    () => tagsCell(container, "Workshop.jpg").textContent === "Print"
  );
  expect(tagsCell(container, "Office.jpg").textContent).toBe("Print");
});

it("bulk remove in values mode keeps failed rows selected with their tags", async () => {
  const { element, bulkCalls } = assetsTable({ bulk: "values" });
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  await selectRows(container, ["Banner 1.jpg", "Team.jpg"]);
  await click(buttonNamed("Remove tags"));
  const dialog = required(
    document.querySelector<HTMLElement>('[data-bulk-tags="remove"]'),
    "bulk dialog"
  );
  const picker = required(
    dialog.querySelector<HTMLInputElement>('[role="combobox"]'),
    "picker"
  );
  await type(picker, "Social");
  // Only the selection's tags, with how many rows use each.
  expect(optionNamed("Social").textContent).toBe("Social2");
  await click(optionNamed("Social"));
  await press(picker, "Escape");
  await click(buttonNamed("Remove"));
  await settleUntil(() => bulkCalls.length > 0);
  expect(bulkCalls).toEqual([[["banner-1", "team"], { tags: [] }]]);
  // Banner 1.jpg is saved and leaves the selection; the call failed for
  // Team.jpg: its tag comes back and it stays selected.
  await settleUntil(
    () => tagsCell(container, "Team.jpg").textContent === "Social"
  );
  expect(tagsCell(container, "Banner 1.jpg").textContent).toBe("");
  expect(rowOf(container, "Banner 1.jpg").getAttribute("data-state")).not.toBe(
    "selected"
  );
  expect(rowOf(container, "Team.jpg").getAttribute("data-state")).toBe(
    "selected"
  );
});

it("Manage tags counts records, renames, merges and deletes", async () => {
  const { element, tagRequests } = assetsTable();
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  const header = required(
    [...container.querySelectorAll<HTMLElement>("th button")].find(
      (button) => button.textContent?.trim() === "Tags"
    ),
    "Tags header"
  );
  await click(header);
  await click(
    required(
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === "Manage tags"
      ),
      "Manage tags"
    )
  );
  const dialog = () =>
    required(
      document.querySelector<HTMLElement>("[data-manage-tags]"),
      "Manage tags dialog"
    );
  await settleUntil(
    () =>
      dialog()
        .querySelector('[data-tag-row="tag-social"]')
        ?.textContent?.includes("4 records") ?? false
  );
  expect(
    dialog().querySelector('[data-tag-row="tag-draft"]')?.textContent
  ).toContain("3 records");

  const rename = required(
    dialog().querySelector<HTMLInputElement>(
      'input[aria-label="Rename Draft"]'
    ),
    "rename input"
  );
  await act(async () => {
    required(
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set,
      "value setter"
    ).call(rename, "Drafts");
    rename.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
  await press(rename, "Enter");
  await settleUntil(
    () => tagsCell(container, "README.md").textContent === "Drafts"
  );
  expect(tagsCell(container, "Old draft.docx").textContent).toBe("Drafts");

  await click(buttonNamed("Video actions"));
  await click(
    required(
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === "Delete"
      ),
      "Delete"
    )
  );
  const confirm = required(
    document.querySelector<HTMLElement>('[data-tags-confirm="delete"]'),
    "delete confirmation"
  );
  expect(confirm.textContent).toContain(
    "It is used by 1 record, which will lose it."
  );
  await click(
    required(
      [...confirm.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === "Delete"
      ),
      "confirm delete"
    )
  );
  await settleUntil(
    () => tagsCell(container, "Hero video.mp4").textContent === "Social"
  );
  expect(
    tagRequests.map((request) => request.action).filter((a) => a !== "list")
  ).toEqual(["update", "remove"]);
});

it("the record form picks and creates tags for a tags column", async () => {
  const { element, tagRequests, updates } = assetsTable();
  const container = await mount(element);
  await settleUntil(
    () =>
      tagsCell(container, "Logo mono.png").textContent?.includes("Brand") ??
      false
  );
  await click(
    required(
      rowOf(container, "Team.jpg").querySelector<HTMLElement>(
        '[aria-label="Actions"]'
      ),
      "row actions"
    )
  );
  await click(
    required(
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === "Edit"
      ),
      "Edit"
    )
  );
  await settleUntil(() =>
    Boolean(document.querySelector(".yayaw-record-body [data-tag-picker]"))
  );
  const picker = required(
    document.querySelector<HTMLInputElement>(
      '.yayaw-record-body [data-tag-picker] [role="combobox"]'
    ),
    "form tag picker"
  );
  // The field shows the record's tags as chips from the catalog.
  expect(
    document.querySelector(".yayaw-record-body [data-tag-picker]")?.textContent
  ).toContain("Social");
  await type(picker, "Autumn");
  await click(optionNamed("Create “Autumn”"));
  await press(picker, "Escape");
  await click(buttonNamed("Save"));
  await settleUntil(() => updates.length > 0);
  expect(updates.at(-1)?.[1]).toMatchObject({
    tags: ["tag-social", "tag-new-1"],
  });
  expect(
    tagRequests.filter((request) => request.action === "create")
  ).toHaveLength(1);
});
