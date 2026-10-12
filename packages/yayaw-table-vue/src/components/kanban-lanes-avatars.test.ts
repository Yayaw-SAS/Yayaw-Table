import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inlineTestPortals, openViewScreen } from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import type { TableBehaviorConfig, TableView } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

inlineTestPortals();

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
  config,
});
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
const mountTable = (
  table: Partial<TableBehaviorConfig> = {},
  options: { views?: TableView[]; active?: string } = {}
) =>
  mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config: defineTableConfig({
        id: "people",
        translations: { namespace: "people", keys: {} },
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
          mandatory: [],
        },
        table: {
          enableViews: Boolean(options.views),
          displayModes: ["table", "kanban", "gallery", "list"],
          kanban: { groupBy: "status", titleColumn: "name", cardColumnIds: [] },
          gallery: { titleColumn: "name", imageColumn: "" },
          list: { titleColumn: "name", cardColumnIds: [] },
          syncUrl: false,
          ...table,
        },
      }),
      data: rows.map((row) => ({ ...row })),
      tableType: "people",
      initialViews: options.views,
      initialActiveViewId: options.active,
      syncUrl: false,
    },
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;
const laneTitles = (wrapper: Wrapper) =>
  wrapper
    .findAll(".yayaw-kanban-lane header strong")
    .map((item) => item.text());

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  })
);
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});

it("applies each saved view's own lane order and hidden lanes", async () => {
  const first = mountTable({}, { views, active: "closed-first" });
  await flushPromises();
  expect(laneTitles(first)).toEqual(["Closed", "Won", "Open"]);
  first.unmount();

  const second = mountTable({}, { views, active: "open-only" });
  await flushPromises();
  expect(laneTitles(second)).toEqual(["Open"]);
  expect(second.text()).not.toContain("Grace Hopper");
  expect(second.get("[data-kanban-hidden-lanes]").text()).toBe(
    "Hidden lanes: Closed, Won"
  );
});

it("uses the table's default lanes without a view", async () => {
  const wrapper = mountTable({
    defaultDisplayMode: "kanban",
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: [],
      lanes: { status: { order: ["Won"], hidden: ["Open"] } },
    },
  });
  await flushPromises();
  expect(laneTitles(wrapper)).toEqual(["Won", "Closed"]);
});

it("edits the lanes from the Kanban settings into the view state", async () => {
  const wrapper = mountTable({ defaultDisplayMode: "kanban" });
  await flushPromises();
  await openViewScreen(wrapper, "Card settings");
  const settingLanes = () =>
    wrapper
      .findAll("[data-kanban-lane-setting]")
      .map((item) => item.attributes("data-kanban-lane-setting"));
  expect(settingLanes()).toEqual(["Open", "Closed", "Won"]);
  // At an end, a move stays focusable but does nothing.
  await wrapper.get('[aria-label="Move Open up"]').trigger("click");
  expect(settingLanes()).toEqual(["Open", "Closed", "Won"]);
  await wrapper.get('[aria-label="Move Won up"]').trigger("click");
  await flushPromises();
  expect(settingLanes()).toEqual(["Open", "Won", "Closed"]);
  expect(laneTitles(wrapper)).toEqual(["Open", "Won", "Closed"]);
  await wrapper.get('[aria-label="Show Closed"]').trigger("click");
  await flushPromises();
  expect(laneTitles(wrapper)).toEqual(["Open", "Won"]);
  const reset = wrapper
    .findAll("[data-kanban-lane-settings] button")
    .find((item) => item.text() === "Reset lanes");
  await reset?.trigger("click");
  await flushPromises();
  expect(laneTitles(wrapper)).toEqual(["Open", "Closed", "Won"]);
});

it("shows Kanban card avatars: the image, else decorative initials", async () => {
  const wrapper = mountTable({
    defaultDisplayMode: "kanban",
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: [],
      avatar: { imageColumn: "photo" },
    },
  });
  await flushPromises();
  const avatars = wrapper.findAll("[data-avatar]");
  expect(avatars.map((item) => item.text())).toEqual(["AL", "", "AT"]);
  expect(avatars.at(0)?.attributes("aria-hidden")).toBe("true");
  expect(avatars.at(0)?.attributes("style")).toContain("--yayaw-avatar-hue");
  const grace = avatars.at(1)?.get("img");
  expect(grace?.attributes("src")).toBe("https://example.com/grace.png");
  expect(grace?.attributes("alt")).toBe("");
});

it("shows initials on gallery cards and list lines without an image", async () => {
  const gallery = mountTable({
    defaultDisplayMode: "gallery",
    gallery: { titleColumn: "name", imageColumn: "photo", avatar: true },
  });
  await flushPromises();
  const cards = gallery.findAll("[data-gallery-avatar] [data-avatar]");
  // Grace has an image: only Ada and Alan get initials.
  expect(cards.map((item) => item.text())).toEqual(["AL", "AT"]);
  expect(cards.at(0)?.attributes("data-size")).toBe("large");
  expect(cards.at(0)?.attributes("aria-hidden")).toBe("true");
  gallery.unmount();

  const list = mountTable({
    defaultDisplayMode: "list",
    list: { titleColumn: "name", cardColumnIds: [], avatar: true },
  });
  await flushPromises();
  expect(list.findAll("li [data-avatar]").map((item) => item.text())).toEqual([
    "AL",
    "GH",
    "AT",
  ]);
});

it("labels image cells' initials with the record's name", async () => {
  const wrapper = mountTable({ defaultDisplayMode: "table" });
  await flushPromises();
  const avatars = wrapper.findAll('[data-avatar][role="img"]');
  expect(avatars.map((item) => item.attributes("aria-label"))).toEqual([
    "Ada Lovelace",
    "Alan Turing",
  ]);
  expect(avatars.at(0)?.text()).toBe("AL");
});
