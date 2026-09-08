import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import { InlineEditableCell } from "../src/components/ui/yayaw-table/components/cells/inline-editable-cell";
import { resolveInlineEditColumnConfig } from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  for (const client of clients.splice(0)) {
    client.clear();
  }
  document.body.replaceChildren();
});
for (const [type, value, selector] of [
  ["string", "Alpha", 'input[type="text"]'],
  ["text", "Alpha", 'input[type="text"]'],
  ["code", "const a = 1;", "textarea"],
  ["number", -12.5, 'input[type="number"]'],
  ["boolean", false, '[role="switch"]'],
  ["date", new Date(2026, 8, 8), 'input[type="date"]'],
  ["url", "https://example.com", 'input[type="url"]'],
  ["image", "https://example.com/image.png", 'input[type="url"]'],
  ["json", { active: false }, "textarea"],
  ["select", 1, '[role="combobox"]'],
  ["tag", 1, '[role="combobox"]'],
  ["dynamicType", "https://example.com", 'input[type="url"]'],
] as const) {
  it(`derives the React ${type} control without a form catalogue`, async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const client = new QueryClient();
    clients.push(client);
    const row = { id: "one", kind: "url", value };
    const column = {
      id: "value",
      header: "Value",
      type,
      typeKey: "kind",
      options: [{ value: 1, label: "One" }],
    };
    const cell = {
      getValue: () => value,
      row: { original: row },
      column: { id: "value", columnDef: { header: "Value" } },
    } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
    const inlineConfig = resolveInlineEditColumnConfig(column, {
      enabled: true,
    });
    await act(() =>
      root.render(
        <TableProvider
          queryClient={client}
          tableId="types"
          translations={defaultTranslations}
        >
          <InlineEditableCell
            cell={cell}
            displayValue={
              <DataTypeCell column={column} row={row} value={value} />
            }
            inlineConfig={inlineConfig}
            onCommit={async () => ({ success: true })}
            rowData={row}
          />
        </TableProvider>
      )
    );
    if (["tag", "select"].includes(type)) {
      expect(container.textContent).toContain("One");
    }
    if (type === "dynamicType") {
      expect(container.querySelector("a")).toBeTruthy();
    }
    await act(() =>
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    );
    expect(container.querySelector(selector)).toBeTruthy();
    if (type === "date") {
      expect(container.querySelector<HTMLInputElement>(selector)?.value).toBe(
        "2026-09-08"
      );
    }
    if (type === "json") {
      expect(
        container.querySelector<HTMLTextAreaElement>(selector)?.value
      ).toContain('"active": false');
    }
  });
}

it("recovers a React image cell after its failed source is replaced", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const column = { id: "image", header: "Image", type: "image" as const };
  await act(() =>
    root.render(
      <DataTypeCell
        column={column}
        row={{}}
        value="https://example.com/missing.png"
      />
    )
  );
  await act(() =>
    container.querySelector("img")?.dispatchEvent(new Event("error"))
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("Image");
  await act(() =>
    root.render(
      <DataTypeCell
        column={column}
        row={{}}
        value="https://example.com/new.png"
      />
    )
  );
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "https://example.com/new.png"
  );
});
