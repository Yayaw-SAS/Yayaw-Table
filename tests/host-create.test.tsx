import "./setup-dom";
import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = async () => {
  for (let frame = 0; frame < 5; frame += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  }
};

const config = (allowCreate: boolean) =>
  defineTableConfig({
    id: "host-create",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      order: ["name"],
      visible: ["name"],
      mandatory: ["name"],
    },
    table: { syncUrl: false, enableViews: false, allowCreate },
    translations: { namespace: "host-create", keys: {} },
  });

const render = async (
  allowCreate: boolean,
  onCreate?: (initial?: Record<string, unknown>) => void
) => {
  const actions = {
    list: () =>
      Promise.resolve({
        data: [{ id: "1", name: "Alpha" }],
        meta: { pageCount: 1, totalCount: 1 },
      }),
  } as unknown as TableActions;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getRowId={(row) => String(row.id)}
            getTableActions={() => actions}
            getTableConfig={() => config(allowCreate)}
            initialViewsLoaded
            onCreate={onCreate}
            queryClient={new QueryClient()}
            tableType="host-create"
          />
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  await settle();
};
const createButton = () =>
  [...document.querySelectorAll("button")].find(
    (button) =>
      (button.getAttribute("aria-label") ?? button.textContent?.trim()) ===
      "Add item"
  );

it("shows the create button without actions.create and calls the host instead of the form", async () => {
  const onCreate = mock();
  await render(true, onCreate);
  const button = createButton();
  expect(button).toBeDefined();
  await act(async () => {
    button?.click();
    await Promise.resolve();
  });
  await settle();
  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("stays hidden with allowCreate: false, and without onCreate or actions.create", async () => {
  await render(false, mock());
  expect(createButton()).toBeUndefined();
  document.body.replaceChildren();
  await render(true);
  expect(createButton()).toBeUndefined();
});
