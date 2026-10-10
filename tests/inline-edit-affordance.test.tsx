import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
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

const render = async (column: Record<string, unknown>, value: unknown) => {
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
          displayValue={String(value)}
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
  // Typed values get no chevron.
  expect(text?.querySelector("[data-inline-chevron]")).toBeNull();
});

it("adds a chevron to cells whose editor picks a value", async () => {
  const select = await render(
    {
      id: "status",
      type: "select",
      options: [{ value: "draft", label: "Draft" }],
    },
    "draft"
  );
  expect(select?.dataset.inlineEditor).toBe("select");
  expect(select?.querySelector("[data-inline-chevron]")).not.toBeNull();

  const date = await render({ id: "due", type: "date" }, "2026-10-10");
  expect(date?.querySelector("[data-inline-chevron]")).not.toBeNull();
});
