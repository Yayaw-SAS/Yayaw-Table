import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import { ImageCell } from "../src/components/ui/yayaw-table/components/cells/image-cell";
import { InlineEditableCell } from "../src/components/ui/yayaw-table/components/cells/inline-editable-cell";
import { resolveInlineEditColumnConfig } from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

const render = async (
  column: Record<string, unknown>,
  value: unknown,
  displayValue?: ReactNode
) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const row = { id: "1", [String(column.id)]: value };
  const cell = {
    getValue: () => value,
    row: { original: row },
    column: { id: column.id, columnDef: { header: "Field" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const config = resolveInlineEditColumnConfig(
    { header: "Field", ...column, inlineEdit: { enabled: true } } as never,
    { enabled: true }
  );
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="inline-affordance"
        translations={defaultTranslations}
      >
        <InlineEditableCell
          cell={cell}
          displayValue={displayValue ?? String(value)}
          inlineConfig={config}
          onCommit={async () => ({ success: true })}
          rowData={row}
        />
      </TableProvider>
    )
  );
  return container.querySelector<HTMLElement>("[data-inline-editor]");
};

it("marks editable cells with their editor and a hover outline, as in Vue", async () => {
  const text = await render({ id: "name", type: "text" }, "Ada");
  expect(text?.dataset.inlineEditor).toBe("text");
  expect(text?.className).toContain(
    "hover:shadow-[inset_0_0_0_1px_var(--border)]"
  );
  // Typed text shows a pencil, floating over the cell's end.
  expect(
    text?.querySelector<HTMLElement>("[data-inline-icon]")?.dataset.inlineIcon
  ).toBe("pencil");
  expect(text?.className).toContain("cursor-pointer");
});

it("picks the hover icon from the cell's editor, as in Vue", async () => {
  const iconFor = async (column: Record<string, unknown>, value: unknown) =>
    (await render(column, value))?.querySelector<HTMLElement>(
      "[data-inline-icon]"
    )?.dataset.inlineIcon;
  expect(
    await iconFor(
      {
        id: "status",
        type: "select",
        options: [{ value: "draft", label: "Draft" }],
      },
      "draft"
    )
  ).toBe("chevron");
  expect(
    await iconFor(
      {
        id: "tags",
        type: "multiSelect",
        options: [{ value: "a", label: "A" }],
      },
      ["a"]
    )
  ).toBe("list");
  expect(await iconFor({ id: "total", type: "number" }, 3)).toBe("hash");
  expect(await iconFor({ id: "due", type: "date" }, "2026-10-10")).toBe(
    "calendar"
  );
  expect(await iconFor({ id: "site", type: "url" }, "https://yayaw.app")).toBe(
    "link"
  );
  // A switch needs no icon.
  expect(
    await iconFor({ id: "active", type: "boolean" }, true)
  ).toBeUndefined();
});

it("starts editing on a single click anywhere in the cell", async () => {
  const text = await render({ id: "name", type: "text" }, "Ada");
  await act(async () => {
    text?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(document.querySelector("input")).not.toBeNull();
});

it.each([
  "click",
  "Enter",
])("keeps an image's URL editable by %s without nesting preview buttons", async (action) => {
  const source = "https://example.com/image.png";
  const cell = await render(
    { id: "image", type: "image" },
    source,
    <ImageCell alt="Product" value={source} />
  );
  const trigger = cell?.querySelector<HTMLElement>(
    "[data-image-preview-trigger]"
  );
  expect(trigger?.tagName).toBe("SPAN");
  expect(trigger?.getAttribute("tabindex")).toBeNull();
  expect(cell?.querySelector("button")).toBeNull();
  await act(async () => {
    if (action === "click") {
      trigger?.click();
    } else {
      cell?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    }
    await Promise.resolve();
  });
  expect(
    document.querySelector<HTMLInputElement>('input[type="url"]')?.value
  ).toBe(source);
});

it("toggles and saves a boolean cell on its first click, as in Vue", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const row = { id: "1", active: false };
  const cell = {
    getValue: () => false,
    row: { original: row },
    column: { id: "active", columnDef: { header: "Active" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const commits: unknown[] = [];
  const config = resolveInlineEditColumnConfig(
    {
      id: "active",
      header: "Active",
      type: "boolean",
      inlineEdit: { enabled: true, debounceMs: 0 },
    } as never,
    { enabled: true }
  );
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="inline-boolean"
        translations={defaultTranslations}
      >
        <InlineEditableCell
          cell={cell}
          displayValue="false"
          inlineConfig={config}
          onCommit={(value) => {
            commits.push(value);
            return Promise.resolve({ success: true });
          }}
          rowData={row}
        />
      </TableProvider>
    )
  );
  await act(async () => {
    container.querySelector<HTMLElement>("[data-inline-editor]")?.click();
    await Promise.resolve();
  });
  expect(
    container.querySelector('[role="switch"]')?.getAttribute("aria-checked")
  ).toBe("true");
  expect(commits).toEqual([true]);
});

it("draws a switch boolean column as a switch, as in Vue", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const column = {
    id: "active",
    header: "Active",
    type: "boolean",
    displayVariant: "switch",
  } as const;
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="boolean-switch"
        translations={defaultTranslations}
      >
        <DataTypeCell
          column={column as never}
          row={{ id: "1", active: null }}
          value={null}
        />
      </TableProvider>
    )
  );
  expect(
    container.querySelector(".yayaw-cell-switch")?.getAttribute("data-state")
  ).toBe("unchecked");
  expect(container.querySelector(".yayaw-boolean")).toBeNull();
});
