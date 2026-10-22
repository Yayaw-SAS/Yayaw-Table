import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  InlineEditableCell,
  type InlineOptionSearch,
} from "../src/components/ui/yayaw-table/components/cells/inline-editable-cell";
import { canEditInlineFormField } from "../src/components/ui/yayaw-table/components/forms/inline-form";
import type { FormConfig } from "../src/components/ui/yayaw-table/components/forms/types";
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
const WAIT_LIMIT_MS = 2000;
/** CI runners can take longer than one settle to mount the editor or answer a search. */
async function waitFor(check: () => boolean) {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  while (!check() && Date.now() < deadline) {
    await act(settle);
  }
}
const known = [{ value: 1, label: "Gaming Mag" }];
async function setup(
  type: "select" | "multiSelect",
  optionSearch: InlineOptionSearch,
  onCommit: ComponentProps<typeof InlineEditableCell>["onCommit"]
) {
  client = new QueryClient();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const row = { id: "1", media: type === "select" ? 1 : [1] };
  const cell = {
    getValue: () => row.media,
    row: { original: row },
    column: { id: "media", columnDef: { header: "Media" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const config = resolveInlineEditColumnConfig(
    { id: "media", type, inlineEdit: { enabled: true, options: known } },
    { enabled: true, debounceMs: 10_000 }
  );
  await act(() =>
    root.render(
      <TableProvider
        queryClient={client}
        tableId="inline-option-search-test"
        translations={defaultTranslations}
      >
        <InlineEditableCell
          cell={cell}
          displayValue="Gaming Mag"
          inlineConfig={config}
          onCommit={onCommit}
          optionSearch={optionSearch}
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
      new MouseEvent("click", { bubbles: true })
    );
    await settle();
  });
  await waitFor(() => container.querySelector('[role="combobox"]') !== null);
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
  await waitFor(() => choices().some((option) => option.textContent === label));
  await act(async () => {
    required(choices().find((option) => option.textContent === label)).click();
    await settle();
  });
}
const searchFor =
  (calls: string[], found: { value: number; label: string }[]) =>
  (query: string) => {
    calls.push(query);
    return Promise.resolve(found);
  };

it("searches the server from an inline select and saves the typed choice", async () => {
  const calls: string[] = [];
  const writes: unknown[] = [];
  await setup(
    "select",
    {
      search: searchFor(calls, [{ value: 42, label: "Strategies Newsletter" }]),
      minLength: 2,
      debounceMs: 0,
    },
    (value) => {
      writes.push(value);
      return Promise.resolve({ success: true });
    }
  );
  expect(document.activeElement).toBe(search());
  expect(container.textContent).toContain("Gaming Mag");
  await fill("n");
  expect(calls).toEqual([]);
  await fill("news");
  expect(calls).toEqual(["news"]);
  // The server's match shows even though its label lacks the typed text.
  await clickOption("Strategies Newsletter");
  expect(writes).toEqual([42]);
});

it("adds server results to an inline multi-select and keeps their labels", async () => {
  const writes: unknown[] = [];
  await setup(
    "multiSelect",
    {
      search: searchFor([], [{ value: 42, label: "Strategies Newsletter" }]),
      minLength: 2,
      debounceMs: 0,
    },
    (value) => {
      writes.push(value);
      return Promise.resolve({ success: true });
    }
  );
  await fill("strat");
  await clickOption("Strategies Newsletter");
  expect(container.textContent).toContain("Strategies Newsletter");
  await act(async () => {
    const outside = required(
      container.querySelector<HTMLButtonElement>("[data-outside]")
    );
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    outside.focus();
    outside.click();
    await settle();
  });
  expect(writes).toEqual([[1, 42]]);
});

it("shows a failed server search in the list and keeps the editor open", async () => {
  const writes: unknown[] = [];
  await setup(
    "select",
    {
      search: () => Promise.reject(new Error("Search unavailable")),
      minLength: 2,
      debounceMs: 0,
    },
    (value) => {
      writes.push(value);
      return Promise.resolve({ success: true });
    }
  );
  await fill("news");
  await waitFor(() => document.querySelector('[role="alert"]') !== null);
  expect(required(document.querySelector('[role="alert"]')).textContent).toBe(
    "Search unavailable"
  );
  expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  expect(writes).toEqual([]);
});

it("edits searched select fields inline and keeps other searched fields in the form", () => {
  const searchOptions = () => [];
  const config: FormConfig = {
    id: "hits",
    fields: [
      { name: "media", label: "Media", type: "select", searchOptions },
      { name: "topics", label: "Topics", type: "multiSelect", searchOptions },
      { name: "title", label: "Title", type: "text", searchOptions },
    ],
  };
  const context = {
    formType: "hits",
    mode: "edit" as const,
    tableId: "hits",
    tableType: "hits",
    values: {},
  };
  const [media, topics, title] = config.fields;
  expect(canEditInlineFormField(config, media, context)).toBe(true);
  expect(canEditInlineFormField(config, topics, context)).toBe(true);
  expect(canEditInlineFormField(config, title, context)).toBe(false);
});
