import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import type { FormConfig } from "../src/components/ui/yayaw-table/components/forms/types";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";

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
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
const tableConfig = defineTableConfig({
  id: "form-type-to-search",
  presentation: "inline",
  columns: {
    definitions: [{ id: "name", header: "Name", type: "text" }],
    visible: ["name"],
    order: ["name"],
    mandatory: [],
  },
  table: {
    allowEdit: true,
    enableRowClickEdit: true,
    enableRowSelection: false,
    rowClickMode: "edit",
    syncUrl: false,
  },
  translations: { namespace: "form-type-to-search", keys: {} },
});
const options = [
  { value: "ada", label: "Ada" },
  { value: "grace", label: "Grace" },
  { value: "linus", label: "Linus" },
];

async function mountForm(
  fields: FormConfig["fields"],
  row: Record<string, unknown>
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const rows = [{ id: "one", ...row }];
  const actions = {
    list: async () => ({
      data: [...rows],
      meta: { pageCount: 1, totalCount: rows.length },
    }),
    update: mock(async (..._args: unknown[]) => ({ success: true })),
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            details={{}}
            enableToolbar={false}
            getFormConfig={() => ({ id: "form-type-to-search", fields })}
            getTableActions={() => actions}
            getTableConfig={() => tableConfig}
            initialData={[...rows]}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="form-type-to-search"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(async () => {
    host.querySelector<HTMLTableCellElement>("tbody td")?.click();
    await settle();
  });
  // The first form of the run loads its fields lazily.
  for (let attempt = 0; attempt < 20 && triggers().length === 0; attempt++) {
    await act(settle);
  }
}

const triggers = () => [
  ...document.querySelectorAll<HTMLButtonElement>(
    ".yayaw-record-body [data-searchable-field]"
  ),
];
const searchOf = () => document.querySelector<HTMLInputElement>("[cmdk-input]");
const shownOptions = () =>
  [...document.querySelectorAll("[cmdk-item]")].map((item) =>
    item.textContent?.trim()
  );
const press = async (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  await act(async () => {
    target.dispatchEvent(event);
    await settle();
  });
  return event;
};

for (const [type, value] of [
  ["select", null],
  ["multiSelect", []],
] as const) {
  it(`a letter typed on a closed searchable ${type} opens its list and starts the search with it`, async () => {
    await mountForm(
      [
        { name: "owner", label: "Owner", type, searchable: true, options },
        { name: "name", label: "Name", type: "text" },
      ],
      { owner: value, name: "Example" }
    );
    const [trigger] = triggers();
    if (!trigger) {
      throw new Error("Missing the select");
    }
    expect(trigger.tabIndex).toBe(0);
    trigger.focus();
    const event = await press(trigger, { key: "g" });
    expect(event.defaultPrevented).toBe(true);
    const search = searchOf();
    expect(search?.value).toBe("g");
    // The search has the focus, the caret after the letter: typing goes on there.
    expect(document.activeElement).toBe(search);
    expect(search?.selectionStart).toBe(1);
    expect(search?.selectionEnd).toBe(1);
    expect(shownOptions()).toEqual(["Grace"]);
  });
}

it("leaves Space, Enter, arrows, shortcuts, IME composition and a disabled field alone", async () => {
  await mountForm(
    [
      {
        name: "owner",
        label: "Owner",
        type: "select",
        searchable: true,
        options,
      },
      {
        name: "locked",
        label: "Locked",
        type: "select",
        searchable: true,
        options,
        disabled: true,
      },
    ],
    { owner: null, locked: null, name: "Example" }
  );
  const [trigger, locked] = triggers();
  if (!(trigger && locked)) {
    throw new Error("Missing the selects");
  }
  for (const init of [
    { key: " " },
    { key: "Enter" },
    { key: "ArrowDown" },
    { key: "Tab" },
    { key: "a", ctrlKey: true },
    { key: "a", metaKey: true },
    { key: "a", altKey: true },
    { key: "a", isComposing: true },
  ]) {
    const event = await press(trigger, init);
    expect(event.defaultPrevented).toBe(false);
    expect(searchOf()?.value ?? "").toBe("");
  }
  expect((await press(locked, { key: "a" })).defaultPrevented).toBe(false);
  expect(searchOf()).toBeNull();
});
