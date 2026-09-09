import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { RecordDetails } from "../src/components/ui/yayaw-table/components/details/record-details";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { RecordDetailsConfig } from "../src/components/ui/yayaw-table/utils/record-details";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const config: RecordDetailsConfig = {
  presentation: "inline",
  sections: [
    {
      id: "main",
      title: "Overview",
      fields: [{ id: "active", label: "Active", type: "boolean" }],
    },
  ],
  activity: () => [
    {
      id: "event",
      actor: { name: "Camille" },
      at: "2026-09-09",
      action: "updated the entry",
      changes: [{ field: "active", before: true, after: false }],
    },
  ],
};
const row = { id: "example", name: "Example record", active: false };
const button = (label: string, scope: ParentNode = document) => {
  const found = Array.from(scope.querySelectorAll("button")).find(
    (item) => item.textContent === label
  );
  if (!found) {
    throw new Error(`Missing button ${label}`);
  }
  return found;
};

for (const mode of ["builtin", "external", "override"] as const) {
  for (const explicitActions of [false, true]) {
    it(`opens a ${mode} read-only record from an ${explicitActions ? "explicit" : "automatic"} actions column`, async () => {
      const id = `record-actions-${mode}-${explicitActions}`;
      const onOpenDetails =
        mode === "builtin" ? undefined : mock(() => undefined);
      const tableConfig = defineTableConfig({
        id,
        columns: {
          definitions: [
            { id: "name", header: "Name", type: "text" },
            ...(explicitActions
              ? [{ id: "actions", header: "Actions", type: "actions" as const }]
              : []),
          ],
          visible: ["name", "actions"],
          order: ["name", "actions"],
          mandatory: ["name"],
        },
        table: {
          rowClickMode: "activate",
          syncUrl: false,
          allowCreate: false,
          allowEdit: false,
          allowDelete: false,
          allowDuplicate: false,
          enableRowSelection: false,
        },
        translations: { namespace: id, keys: {} },
      });
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const actions = {
        list: mock(async () => ({
          data: [row],
          meta: { pageCount: 1, totalCount: 1 },
        })),
      };
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
      try {
        await act(async () => {
          root.render(
            <Provider store={createStore()}>
              <NuqsTestingAdapter hasMemory>
                <DataTable
                  details={mode === "external" ? undefined : config}
                  enableToolbar={false}
                  getTableActions={() => actions}
                  getTableConfig={() => tableConfig}
                  initialData={[row]}
                  initialPageCount={1}
                  initialRowCount={1}
                  onOpenDetails={onOpenDetails}
                  queryClient={client}
                  tableType={id}
                />
              </NuqsTestingAdapter>
            </Provider>
          );
          await settle();
        });
        const trigger = host.querySelector<HTMLButtonElement>(
          'tbody [aria-label="Actions"]'
        );
        if (!trigger) {
          throw new Error("Missing record actions");
        }
        await act(async () => {
          trigger.click();
          await settle();
        });
        const view = Array.from(
          document.querySelectorAll<HTMLElement>('[role="menuitem"]')
        ).find((item) => item.textContent?.trim() === "View");
        if (!view) {
          throw new Error("Missing View action");
        }
        const listCalls = actions.list.mock.calls.length;
        await act(async () => {
          view.click();
          await settle();
        });
        const detail = host.querySelector(".yayaw-detail");
        expect(actions.list.mock.calls.length).toBe(listCalls);
        if (onOpenDetails) {
          expect(onOpenDetails).toHaveBeenCalledTimes(1);
          expect(onOpenDetails).toHaveBeenCalledWith(row);
          expect(detail).toBeNull();
          await act(async () => {
            host.querySelector<HTMLTableCellElement>("tbody td")?.click();
            await settle();
          });
          expect(onOpenDetails).toHaveBeenCalledTimes(2);
          expect(host.querySelector(".yayaw-detail")).toBeNull();
        } else {
          expect(detail?.textContent).toContain("Example record");
        }
        expect(detail?.querySelector("input") ?? null).toBeNull();
        expect(
          Array.from(detail?.querySelectorAll("button") ?? []).some(
            (item) =>
              item.textContent === "Edit" || item.textContent === "Delete"
          )
        ).toBe(false);
      } finally {
        await act(() => root.unmount());
        client.clear();
        host.remove();
      }
    });
  }
}

it("consults without inputs and confirms a failed then successful deletion", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const close = mock(() => undefined);
  const remove = mock(() => ({ success: false, error: "Try again" }));
  await act(() =>
    root.render(
      <RecordDetails
        config={config}
        onClose={close}
        onDelete={remove}
        row={row}
      />
    )
  );
  expect(host.textContent).toContain("No");
  expect(host.querySelector("input")).toBeNull();
  await act(async () => {
    button("Delete").click();
    await Promise.resolve();
  });
  const modal = document.querySelector('[role="alertdialog"]');
  expect(modal?.textContent).toContain("Example record");
  expect(remove).not.toHaveBeenCalled();
  if (!modal) {
    throw new Error("Missing confirmation");
  }
  await act(async () => {
    button("Delete", modal).click();
    await Promise.resolve();
  });
  expect(modal.textContent).toContain("Try again");
  expect(close).not.toHaveBeenCalled();
  remove.mockImplementation(() => ({ success: true, error: "" }));
  await act(async () => {
    button("Delete", modal).click();
    await Promise.resolve();
  });
  expect(close).toHaveBeenCalledTimes(1);
});

it("keeps audit history on failed undo and prevents undoing the same event twice", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const revert = mock(() => ({ success: false, error: "Conflict" }));
  const reverted = mock(() => undefined);
  await act(() =>
    root.render(
      <RecordDetails
        config={config}
        onClose={() => undefined}
        onRevertActivity={revert}
        onReverted={reverted}
        row={row}
      />
    )
  );
  await act(async () => {
    button("Activity1").click();
    await Promise.resolve();
  });
  await act(async () => {
    button("Undo this change").click();
    await Promise.resolve();
  });
  expect(host.textContent).toContain("Conflict");
  expect(host.textContent).toContain("Camille");
  expect(reverted).not.toHaveBeenCalled();
  revert.mockImplementation(() => ({ success: true, error: "" }));
  await act(async () => {
    button("Undo this change").click();
    await Promise.resolve();
  });
  expect(reverted).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Undone");
  expect(host.querySelector(".yayaw-detail-undo")).toBeNull();
});
