import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  StackMenu,
  StackMenuView,
} from "../src/components/ui/custom/stack-menu";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { TableKanbanGroupingMenu } from "../src/components/ui/yayaw-table/components/toolbar/table-kanban-grouping-menu";
import {
  defineTableConfig,
  type TableBehaviorConfig,
} from "../src/components/ui/yayaw-table/config/helpers";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";

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
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 80)));
/** Lets the table render until `done` holds, for a few frames at most. */
const settleUntil = async (done: () => boolean, frames = 20): Promise<void> => {
  if (done() || frames === 0) {
    return;
  }
  await settle();
  await settleUntil(done, frames - 1);
};

const rows = [
  { id: "one", name: "Ada Lovelace", status: "Open", photo: null },
  {
    id: "two",
    name: "Grace Hopper",
    status: "Closed",
    photo: "https://example.com/grace.png",
  },
  { id: "three", name: "Alan Turing", status: "Won", photo: "" },
];

const view = (id: string, config: TableView["config"]): TableView => ({
  id,
  name: id,
  tableId: "people",
  createdById: "user",
  config,
});

async function mount(
  table: Partial<TableBehaviorConfig>,
  views?: { list: TableView[]; active: string }
) {
  const config = defineTableConfig({
    id: "people",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
        {
          id: "photo",
          header: "Photo",
          type: "image",
          avatar: { nameColumn: "name" },
        },
      ],
      visible: ["name", "status", "photo"],
      order: ["name", "status", "photo"],
      mandatory: ["name"],
    },
    table: {
      displayModes: ["table", "kanban", "gallery", "list"],
      kanban: { groupBy: "status", titleColumn: "name", cardColumnIds: [] },
      gallery: { titleColumn: "name", imageColumn: "" },
      list: { titleColumn: "name", cardColumnIds: [] },
      enableViews: Boolean(views),
      syncUrl: false,
      showToolbar: Boolean(views),
      ...table,
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
  await act(() => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialActiveViewId={views?.active}
            initialViews={views?.list}
            queryClient={client}
            searchDebounceMs={0}
            tableType="people"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
  });
  // Lazy views load on first use: wait for the records, for a few frames at most.
  await settleUntil(() => Boolean(container.querySelector("[data-row-id]")));
  await settle();
  return container;
}

const laneTitles = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-kanban-lane] h3")].map(
    (title) => title.textContent
  );

const views = [
  view("closed-first", {
    displayMode: "kanban",
    kanban: { lanes: { status: { order: ["Closed", "Won"] } } },
  }),
  view("open-only", {
    displayMode: "kanban",
    kanban: { lanes: { status: { hidden: ["Closed", "Won"] } } },
  }),
];

it("applies each saved view's own lane order and hidden lanes", async () => {
  const first = await mount({}, { list: views, active: "closed-first" });
  expect(laneTitles(first)).toEqual(["Closed", "Won", "Open"]);
  await act(() => roots.at(-1)?.unmount());
  document.body.replaceChildren();

  const second = await mount({}, { list: views, active: "open-only" });
  expect(laneTitles(second)).toEqual(["Open"]);
  expect(second.textContent).not.toContain("Grace Hopper");
  expect(second.querySelector("[data-kanban-hidden-lanes]")?.textContent).toBe(
    "Hidden lanes: Closed, Won"
  );
});

it("uses the table's default lanes without a view", async () => {
  const container = await mount({
    defaultDisplayMode: "kanban",
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: [],
      lanes: { status: { order: ["Won"], hidden: ["Open"] } },
    },
  });
  expect(laneTitles(container)).toEqual(["Won", "Closed"]);
});

it("shows Kanban card avatars: the image, else decorative initials", async () => {
  const container = await mount({
    defaultDisplayMode: "kanban",
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: [],
      avatar: { imageColumn: "photo" },
    },
  });
  const avatars = [...container.querySelectorAll("[data-avatar]")];
  expect(avatars.map((item) => item.textContent)).toEqual(["AL", "", "AT"]);
  expect(avatars.at(0)?.getAttribute("aria-hidden")).toBe("true");
  expect(avatars.at(0)?.getAttribute("style")).toContain("--yayaw-avatar-hue");
  const grace = avatars.at(1)?.querySelector("img");
  expect(grace?.getAttribute("src")).toBe("https://example.com/grace.png");
  expect(grace?.getAttribute("alt")).toBe("");
});

it("shows initials on gallery cards and list lines without an image", async () => {
  const gallery = await mount({
    defaultDisplayMode: "gallery",
    gallery: { titleColumn: "name", imageColumn: "photo", avatar: true },
  });
  const cards = [
    ...gallery.querySelectorAll("[data-gallery-avatar] [data-avatar]"),
  ];
  // Grace has an image: only Ada and Alan get initials.
  expect(cards.map((item) => item.textContent)).toEqual(["AL", "AT"]);
  expect(cards.at(0)?.getAttribute("data-size")).toBe("large");
  expect(cards.at(0)?.getAttribute("aria-hidden")).toBe("true");

  const list = await mount({
    defaultDisplayMode: "list",
    list: { titleColumn: "name", cardColumnIds: [], avatar: true },
  });
  expect(
    [...list.querySelectorAll("li [data-avatar]")].map(
      (item) => item.textContent
    )
  ).toEqual(["AL", "GH", "AT"]);
});

it("labels image cells' initials with the record's name", async () => {
  const container = await mount({ defaultDisplayMode: "table" });
  const avatars = [...container.querySelectorAll('[data-avatar][role="img"]')];
  expect(avatars.map((item) => item.getAttribute("aria-label"))).toEqual([
    "Ada Lovelace",
    "Alan Turing",
  ]);
  expect(avatars.at(0)?.textContent).toBe("AL");
});

it("edits the lanes from the Kanban settings into the view state", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const client = new QueryClient();
  clients.push(client);
  let state: ReturnType<typeof useTableUrlState> | undefined;
  function State() {
    state = useTableUrlState({
      tableId: "lanes",
      defaultDisplayMode: "kanban",
    });
    return null;
  }
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <Provider store={createStore()}>
          <TableProvider
            queryClient={client}
            tableId="lanes"
            translations={defaultTranslations}
          >
            <State />
            <StackMenu
              asDropdown
              defaultView="settings"
              trigger={<button type="button">Settings</button>}
            >
              <StackMenuView name="settings" title="Settings">
                <TableKanbanGroupingMenu
                  columns={[{ id: "status", label: "Status", type: "text" }]}
                  defaultConfig={{ titleColumn: "name" }}
                  defaultDisplayMode="kanban"
                  defaultGroupBy="status"
                  embedded
                  laneColumns={[
                    { id: "status", header: "Status", type: "text" },
                  ]}
                  laneRows={rows}
                  tableId="lanes"
                />
              </StackMenuView>
            </StackMenu>
          </TableProvider>
        </Provider>
      </NuqsTestingAdapter>
    )
  );
  const press = async (label: string) => {
    const element = document.querySelector<HTMLElement>(
      `[aria-label="${label}"]`
    );
    if (!element) {
      throw new Error(`Missing control ${label}`);
    }
    await act(() => element.click());
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
  };
  await act(() =>
    [...document.querySelectorAll("button")]
      .find((item) => item.textContent === "Settings")
      ?.click()
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
  const lanes = () =>
    [...document.querySelectorAll("[data-kanban-lane-setting]")].map((item) =>
      item.getAttribute("data-kanban-lane-setting")
    );
  expect(lanes()).toEqual(["Open", "Closed", "Won"]);
  // At an end, a move stays focusable but does nothing.
  await press("Move Open up");
  expect(state?.kanbanParam.lanes).toBeUndefined();
  await press("Move Won up");
  expect(state?.kanbanParam.lanes).toEqual({
    status: { order: ["Open", "Won", "Closed"] },
  });
  expect(lanes()).toEqual(["Open", "Won", "Closed"]);
  await press("Show Closed");
  expect(state?.kanbanParam.lanes?.status?.hidden).toEqual(["Closed"]);
  const reset = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Reset lanes"
  );
  await act(() => reset?.click());
  expect(state?.kanbanParam.lanes).toBeUndefined();
});
