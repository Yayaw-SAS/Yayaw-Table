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

function required<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Expected the rendered editor control to exist");
  }
  return value;
}
const options = [
  { value: 1, label: "Culture" },
  { value: 2, label: "Tech" },
  { value: false, label: "General" },
  { value: 3, label: "Disabled", disabled: true },
];
let root: Root;
let container: HTMLElement;
let client: QueryClient;
afterEach(async () => {
  await act(() => root?.unmount());
  container?.remove();
  client?.clear();
});
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
};
async function setup(
  onCommit: ComponentProps<typeof InlineEditableCell>["onCommit"],
  debounceMs = 10_000
) {
  client = new QueryClient();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const row = { id: "1", tags: [1] };
  const cell = {
    getValue: () => row.tags,
    row: { original: row },
    column: { id: "tags", columnDef: { header: "Theme" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const config = resolveInlineEditColumnConfig(
    { id: "tags", type: "multiSelect", inlineEdit: { enabled: true, options } },
    { enabled: true, debounceMs }
  );
  await act(() =>
    root.render(
      <TableProvider
        queryClient={client}
        tableId="inline-selection-test"
        translations={defaultTranslations}
      >
        <InlineEditableCell
          cell={cell}
          displayValue="Culture"
          inlineConfig={config}
          onCommit={onCommit}
          rowData={row}
        />
        <button data-outside="" type="button">
          Outside
        </button>
      </TableProvider>
    )
  );
  await act(async () => {
    required(container.querySelector("button")).dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true })
    );
    await settle();
  });
}
const choices = () => [
  ...document.querySelectorAll<HTMLElement>('[role="option"]'),
];
const search = () =>
  required(container.querySelector<HTMLInputElement>('[role="combobox"]'));
async function fill(value: string) {
  await act(async () => {
    required(
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    ).call(search(), value);
    search().dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
}
async function clickOption(label: string) {
  await act(async () => {
    required(choices().find((option) => option.textContent === label)).click();
    await settle();
  });
}
async function dismiss() {
  await act(async () => {
    const outside = required(
      container.querySelector<HTMLButtonElement>("[data-outside]")
    );
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    outside.focus();
    outside.click();
    await settle();
  });
}
it("filters by label, exposes disabled options and flushes typed selections on dismissal", async () => {
  const writes: unknown[] = [];
  await setup((value) => {
    writes.push(value);
    return Promise.resolve({ success: true });
  });
  expect(document.activeElement).toBe(search());
  expect(
    choices()
      .find((option) => option.textContent === "Disabled")
      ?.getAttribute("aria-disabled")
  ).toBe("true");
  await fill("te");
  expect(choices().map((option) => option.textContent)).toEqual(["Tech"]);
  await clickOption("Tech");
  await dismiss();
  expect(writes).toEqual([[1, 2]]);
  expect(container.querySelector('[role="combobox"]')).toBeNull();
});
it("keeps the pending save bar and failed draft visible for retry", async () => {
  let finish!: (result: { success: boolean; errorMessage?: string }) => void;
  const gate = new Promise<{ success: boolean; errorMessage?: string }>(
    (resolve) => {
      finish = resolve;
    }
  );
  await setup(() => gate, 10);
  await clickOption("General");
  expect(container.querySelector('[title="Saving..."]')).not.toBeNull();
  await dismiss();
  expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  await act(async () => {
    finish({ success: false, errorMessage: "Offline" });
    await settle();
  });
  expect(container.textContent).toContain("Offline");
  expect(container.textContent).toContain("General");
  expect(container.querySelector('[role="combobox"]')).not.toBeNull();
});
it("cancels unsaved chips using Escape without sending a write", async () => {
  const writes: unknown[] = [];
  await setup((value) => {
    writes.push(value);
    return Promise.resolve({ success: true });
  });
  await clickOption("Tech");
  await act(() =>
    search().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    )
  );
  expect(writes).toEqual([]);
  expect(container.querySelector('[role="combobox"]')).toBeNull();
});
