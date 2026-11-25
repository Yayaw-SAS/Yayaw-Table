import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import type { FormConfig } from "../src/components/ui/yayaw-table/components/forms/types";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type {
  DetailRevertHandler,
  RecordDetailsConfig,
} from "../src/components/ui/yayaw-table/utils/record-details";

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
  id: "form-submit-shortcut",
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
  translations: { namespace: "form-submit-shortcut", keys: {} },
});
async function mountTable(
  props: {
    details: RecordDetailsConfig;
    onRevertActivity?: DetailRevertHandler;
  },
  rows: Record<string, unknown>[],
  update: (...args: unknown[]) => Promise<{ success: boolean }>,
  fields: FormConfig["fields"] = [{ name: "name", label: "Name", type: "text" }]
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const actions = {
    list: async () => ({
      data: [...rows],
      meta: { pageCount: 1, totalCount: rows.length },
    }),
    update,
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            enableToolbar={false}
            getFormConfig={() => ({
              id: "form-submit-shortcut",
              fields,
            })}
            getTableActions={() => actions}
            getTableConfig={() => tableConfig}
            initialData={[...rows]}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="form-submit-shortcut"
            {...props}
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
}

it("saves the edit form with Cmd+Enter or Ctrl+Enter, not with Enter or other modifiers", async () => {
  const row = { id: "one", name: "Example" };
  const update = mock(async (..._args: unknown[]) => ({ success: true }));
  await mountTable({ details: {} }, [row], update);
  const input = document.querySelector<HTMLInputElement>(
    ".yayaw-record-body input"
  );
  if (!input) {
    throw new Error("Missing form input");
  }
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, "Shortcut");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const press = async (init: KeyboardEventInit) => {
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          ...init,
        })
      );
      await settle();
    });
  };
  await press({});
  await press({ metaKey: true, shiftKey: true });
  expect(update).not.toHaveBeenCalled();
  await press({ ctrlKey: true });
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0]?.slice(0, 2)).toEqual([
    "one",
    { name: "Shortcut" },
  ]);
});

it("saves from a select's search, drawn outside the form, with Cmd+Enter or Ctrl+Enter", async () => {
  const row = { id: "one", owner: "ada", name: "Example" };
  const update = mock(async (..._args: unknown[]) => ({ success: true }));
  await mountTable({ details: {} }, [row], update, [
    {
      name: "owner",
      label: "Owner",
      type: "select",
      options: [{ value: "ada", label: "Ada" }],
      searchOptions: async () => [{ value: "grace", label: "Grace" }],
    },
    { name: "name", label: "Name", type: "text" },
  ]);
  const trigger = document.querySelector<HTMLButtonElement>(
    ".yayaw-record-body [data-searchable-field]"
  );
  if (!trigger) {
    throw new Error("Missing the select");
  }
  await act(async () => {
    trigger.click();
    await settle();
  });
  const search = document.querySelector<HTMLInputElement>("[cmdk-input]");
  if (!search) {
    throw new Error("Missing the select's search");
  }
  expect(document.querySelector(".yayaw-record-body")?.contains(search)).toBe(
    false
  );
  await act(async () => {
    search.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        metaKey: true,
      })
    );
    await settle();
  });
  expect(update).toHaveBeenCalledTimes(1);
});
