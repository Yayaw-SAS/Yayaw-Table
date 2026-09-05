import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FormBuilder } from "../src/components/ui/yayaw-table/components/forms/form-builder";
import { useFormBuilder } from "../src/components/ui/yayaw-table/components/forms/hooks/use-form-builder";
import type { FormConfig } from "../src/components/ui/yayaw-table/components/forms/types";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
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

it("selects local rows through the declarative React table picker", async () => {
  const pickerConfig = defineTableConfig({
    id: "products",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      mandatory: ["name"],
      order: ["select", "name"],
      visible: ["select", "name"],
    },
    table: {
      enableRowSelection: true,
      showToolbar: false,
    },
    translations: { keys: { title: "Products" }, namespace: "products" },
  });
  const formConfig: FormConfig = {
    id: "order",
    defaultValues: { products: [] },
    fields: [
      {
        label: "Products",
        name: "products",
        tablePicker: {
          config: pickerConfig,
          data: [
            { id: "product-1", name: "Alpha" },
            { id: "product-2", name: "Beta" },
          ],
          tableType: "products",
        },
        type: "tablePicker",
      },
    ],
  };
  let builder!: ReturnType<typeof useFormBuilder>;
  let urlUpdates = 0;

  function Probe() {
    builder = useFormBuilder({ config: formConfig });
    return (
      <FormBuilder
        context={builder.context}
        fields={builder.fields}
        form={builder.form}
      />
    );
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={() => {
            urlUpdates += 1;
          }}
        >
          <TableProvider
            queryClient={client}
            tableId="order"
            translations={defaultTranslations}
          >
            <Probe />
          </TableProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  expect(container.textContent).toContain("Alpha");
  const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
  expect(rows).toHaveLength(2);

  const columnMenu = container.querySelector<HTMLButtonElement>(
    '[aria-label="Toggle columns"]'
  );
  expect(columnMenu).not.toBeNull();
  await act(() => columnMenu?.click());
  const pinLeft = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).find((item) => item.textContent?.trim() === "Pin left");
  expect(pinLeft).not.toBeUndefined();
  await act(async () => {
    pinLeft?.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(document.body.textContent).not.toContain("Pin left");
  expect(
    container.querySelector<HTMLElement>('[data-column-id="name"]')?.style
      .position
  ).toBe("sticky");
  const pinnedColumnMenu = container.querySelector<HTMLButtonElement>(
    '[aria-label="Toggle columns"]'
  );
  await act(() => pinnedColumnMenu?.click());
  expect(document.body.textContent).toContain("Unpin");

  await act(() => rows[0]?.click());
  expect(builder.form.getFieldValue("products")).toEqual(["product-1"]);
  expect(urlUpdates).toBe(0);
});
