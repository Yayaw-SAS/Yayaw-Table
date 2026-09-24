import "./setup-dom";
import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import {
  TableInstanceProvider,
  TableStateSyncProvider,
  tableUrlKeys,
} from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type { TableViewConfig } from "../src/components/ui/yayaw-table/types/view-types";

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
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = (ms = 80) =>
  act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return root;
};

it("keeps the shared URL keys without an instance id", () => {
  expect(tableUrlKeys("projects")).toEqual({
    prefix: "projects",
    view: "view",
    historyIndex: "historyIndex",
  });
  expect(tableUrlKeys("projects", "left")).toEqual({
    prefix: "left",
    view: "left-view",
    historyIndex: "left-historyIndex",
  });
});

it("scopes the URL keys and state of two instances of one table", async () => {
  const states: Record<string, ReturnType<typeof useTableUrlState>> = {};
  let url = new URLSearchParams();
  function Probe({ name }: { name: string }) {
    states[name] = useTableUrlState({ tableId: "projects" });
    return null;
  }
  await act(() =>
    mount().render(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={(event) => {
          url = event.searchParams;
        }}
      >
        <TableStateSyncProvider enabled>
          <Provider store={createStore()}>
            <TableInstanceProvider instanceId="left">
              <Probe name="left" />
            </TableInstanceProvider>
          </Provider>
          <Provider store={createStore()}>
            <TableInstanceProvider instanceId="right">
              <Probe name="right" />
            </TableInstanceProvider>
          </Provider>
        </TableStateSyncProvider>
      </NuqsTestingAdapter>
    )
  );
  await act(() =>
    states.left?.applyViewConfig(
      { sorting: [{ id: "name", desc: true }], globalSearch: "alpha" },
      { viewId: "mine" }
    )
  );
  await settle();
  expect(url.get("left-view")).toBe("mine");
  expect(JSON.parse(url.get("left-sort") ?? "[]")).toEqual([
    { id: "name", desc: true },
  ]);
  expect(url.get("left-q")).toBe("alpha");
  // Nothing leaks into the shared keys or the other instance.
  expect(url.has("view")).toBe(false);
  expect([...url.keys()].some((key) => key.startsWith("projects-"))).toBe(
    false
  );
  expect(states.right?.viewParam).toBeNull();
  expect(states.right?.sortParam).toEqual([]);
  expect(states.right?.globalSearchParam).toBe("");
  expect(states.left?.viewParam).toBe("mine");
});

it("renders two embedded instances of one table from their own views without touching the URL", async () => {
  const config = defineTableConfig({
    id: "projects",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: { syncUrl: false, showToolbar: false },
    translations: { namespace: "projects", keys: {} },
  });
  const requests: Record<string, unknown>[] = [];
  const rows = [
    { id: "1", name: "Alpha", status: "Open" },
    { id: "2", name: "Bravo", status: "Done" },
  ];
  const actions = {
    list: (params: Record<string, unknown>) => {
      requests.push(params);
      const rules = (params.advancedFilters ?? []) as { values: string[] }[];
      const data = rows.filter((row) =>
        rules.every((rule) => rule.values.includes(row.status))
      );
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let urlUpdates = 0;
  const view = (
    id: string,
    status: string
  ): { id: string; config: TableViewConfig } => ({
    id,
    config: {
      advancedFilters: [
        {
          id: `only-${status}`,
          columnId: "status",
          type: "text",
          operator: "isAnyOf",
          values: [status],
          isActive: true,
        },
      ] as unknown as TableViewConfig["advancedFilters"],
    },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={() => {
          urlUpdates += 1;
        }}
      >
        {(["open", "done"] as const).map((name) => (
          <section data-instance={name} key={name}>
            <DataTable
              getRowId={(row) => String(row.id)}
              getTableActions={() => actions}
              getTableConfig={() => config}
              initialView={view(
                `${name}-view`,
                name === "open" ? "Open" : "Done"
              )}
              instanceId={`widget-${name}`}
              queryClient={client}
              tableType="projects"
            />
          </section>
        ))}
      </NuqsTestingAdapter>
    )
  );
  await settle(200);
  const text = (name: string) =>
    container.querySelector(`[data-instance="${name}"]`)?.textContent ?? "";
  expect(text("open")).toContain("Alpha");
  expect(text("open")).not.toContain("Bravo");
  expect(text("done")).toContain("Bravo");
  expect(text("done")).not.toContain("Alpha");
  // Each first request already carries its own view's filters.
  expect(
    requests.map((request) =>
      (request.advancedFilters as { values: string[] }[])
        .flatMap((rule) => rule.values)
        .join()
    )
  ).toEqual(["Open", "Done"]);
  expect(urlUpdates).toBe(0);
  client.clear();
});
