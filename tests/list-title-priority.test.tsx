import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";

const originalGetAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getAnimations"
);
beforeAll(() => {
  // Happy DOM does not implement the animation API used by Base UI's scroll area.
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
});
afterAll(() => {
  if (originalGetAnimations) {
    Object.defineProperty(
      Element.prototype,
      "getAnimations",
      originalGetAnimations
    );
  } else {
    Reflect.deleteProperty(Element.prototype, "getAnimations");
  }
});
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
const rows = [
  {
    id: "one",
    name: "Luc Gauthier",
    email: "luc.gauthier@an-unusually-long-company-domain.example",
  },
];

async function mountList(propertyAlign: "end" | "start") {
  const config = defineTableConfig({
    id: "people",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "email", header: "Email", type: "text" },
      ],
      visible: ["name", "email"],
      order: ["name", "email"],
      mandatory: ["name"],
    },
    table: {
      displayModes: ["list"],
      defaultDisplayMode: "list",
      list: { titleColumn: "name", propertyAlign },
      showToolbar: false,
    },
    translations: { namespace: "people", keys: {} },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const actions = {
    list: async () => ({
      data: rows,
      meta: { totalCount: rows.length, pageCount: 1 },
    }),
  };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            queryClient={client}
            searchDebounceMs={0}
            tableType="people"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  const properties = container.querySelector("li dl");
  const title = properties?.previousElementSibling;
  return { properties, title };
}

it("list lines keep the title readable: it keeps its width while properties give way first", async () => {
  const { properties, title } = await mountList("end");
  expect(title?.textContent).toBe("Luc Gauthier");
  // Auto basis (not flex-1's 0 basis), so the title is not left with only the leftover.
  expect(title?.classList.contains("flex-auto")).toBe(true);
  expect(title?.classList.contains("flex-1")).toBe(false);
  expect(title?.classList.contains("truncate")).toBe(true);
  // Properties shrink faster than the title and never fill the whole line.
  expect(properties?.classList.contains("shrink-[3]")).toBe(true);
  expect(properties?.classList.contains("max-w-[60%]")).toBe(true);
  expect(properties?.classList.contains("min-w-0")).toBe(true);
});

it("start-aligned list lines still put properties right after the title, capped", async () => {
  const { properties, title } = await mountList("start");
  expect(title?.classList.contains("shrink")).toBe(true);
  expect(properties?.classList.contains("flex-1")).toBe(true);
  expect(properties?.classList.contains("justify-start")).toBe(true);
  expect(properties?.classList.contains("max-w-[60%]")).toBe(true);
});
