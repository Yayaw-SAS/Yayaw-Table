import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const details: RecordDetailsConfig = {
  activity: () => [
    {
      id: "change",
      actor: { name: "Camille" },
      at: "2026-10-03T10:00:00Z",
      action: "updated",
      changes: [{ field: "name", before: "Before", after: "After" }],
    },
  ],
};
const tableConfig = defineTableConfig({
  id: "form-activity",
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
  translations: { namespace: "form-activity", keys: {} },
});
async function mountTable(
  props: {
    details: RecordDetailsConfig;
    onRevertActivity?: DetailRevertHandler;
  },
  rows: Record<string, unknown>[]
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
    update: async () => ({ success: true }),
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            enableToolbar={false}
            getFormConfig={() => ({
              id: "form-activity",
              fields: [{ name: "name", label: "Name", type: "text" }],
            })}
            getTableActions={() => actions}
            getTableConfig={() => tableConfig}
            initialData={[...rows]}
            initialPageCount={1}
            initialRowCount={rows.length}
            queryClient={client}
            tableType="form-activity"
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
const input = () =>
  document.querySelector<HTMLInputElement>(".yayaw-record-body input");
const button = (label: string) => {
  const found = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent === label
  );
  if (!found) {
    throw new Error(`Missing button ${label}`);
  }
  return found;
};

it("shows the record's activity next to the fields and reloads them after an undo", async () => {
  const rows = [{ id: "record-1", name: "After" }];
  const revert = mock(() => {
    rows[0] = { ...rows[0], name: "Before" };
    return { success: true };
  });
  await mountTable({ details, onRevertActivity: revert }, rows);
  expect(input()?.value).toBe("After");
  await act(async () => {
    button("Activity1").click();
    await settle();
  });
  expect(document.body.textContent).toContain("Camille updated");
  // The fields stay mounted (hidden) while the activity tab shows.
  expect(input()).not.toBeNull();
  await act(async () => {
    document.querySelector<HTMLButtonElement>(".yayaw-detail-undo")?.click();
    await settle();
  });
  expect(revert).toHaveBeenCalledTimes(1);
  expect(input()?.value).toBe("Before");
});

it("keeps the plain form without an activity log", async () => {
  await mountTable({ details: {} }, [{ id: "record-1", name: "After" }]);
  expect(input()?.value).toBe("After");
  expect(document.querySelector(".yayaw-detail-tablist")).toBeNull();
});
