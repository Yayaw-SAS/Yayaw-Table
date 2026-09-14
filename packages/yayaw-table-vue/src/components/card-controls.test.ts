import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inlineTestPortals, openViewScreen } from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import type { TableBehaviorConfig, TableView } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

inlineTestPortals();

const data = [
  { id: "one", name: "Alpha", status: "Open", image: "/alpha.png", amount: 10 },
  { id: "two", name: "Beta", status: "Closed", image: "/beta.png", amount: 20 },
  {
    id: "three",
    name: "Gamma",
    status: "Open",
    image: "/gamma.png",
    amount: 30,
  },
];
const config = defineTableConfig({
  id: "card-controls",
  translations: { namespace: "cards", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text", enableGrouping: false },
      { id: "status", header: "Status", type: "select" },
      { id: "image", header: "Photo", type: "image" },
      { id: "amount", header: "Amount", type: "number" },
    ],
    visible: ["name", "status", "image", "amount"],
    order: ["name", "status", "image", "amount"],
    mandatory: [],
  },
  table: {
    enableViews: true,
    defaultPageSize: 2,
    pageSizeOptions: [2, 10],
    displayModes: ["kanban", "gallery"],
    defaultDisplayMode: "gallery",
    gallery: {
      imageColumn: "image",
      titleColumn: "name",
      cardColumnIds: ["status", "amount"],
    },
    kanban: {
      groupBy: "status",
      titleColumn: "name",
      cardColumnIds: ["amount"],
    },
    syncUrl: false,
  },
});
const mountTable = (
  options: {
    mode?: "kanban" | "gallery";
    table?: Partial<TableBehaviorConfig>;
    locale?: string;
    views?: TableView[];
    active?: string;
  } = {}
) =>
  mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config: defineTableConfig({
        ...config,
        table: {
          ...config.table,
          defaultDisplayMode: options.mode ?? "gallery",
          ...options.table,
        },
      }),
      data: data.map((row) => ({ ...row })),
      tableType: config.id,
      locale: options.locale,
      initialViews: options.views,
      initialActiveViewId: options.active,
      syncUrl: false,
    },
    // Keep Reka selection/focus behavior; jsdom cannot measure popper layout.
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;
const body = () => new DOMWrapper(document.body);
const openSelect = async (wrapper: Wrapper, label: string) => {
  if (
    label !== "Rows per page" &&
    !wrapper.find(".yayaw-card-settings").exists()
  ) {
    await openViewScreen(wrapper, "Card settings");
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper
    .get(`[role="combobox"][aria-label="${label}"]`)
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
};
const choose = async (label: string) => {
  const option = body()
    .findAll('[role="option"]')
    .find((item) => item.text() === label);
  if (!option) {
    throw new Error(`Missing option: ${label}`);
  }
  await option.trigger("keydown", { key: "Enter" });
  await flushPromises();
};
const select = async (wrapper: Wrapper, label: string, value: string) => {
  await openSelect(wrapper, label);
  await choose(value);
};
const openProperties = async (wrapper: Wrapper) => {
  if (!wrapper.find(".yayaw-card-settings").exists()) {
    await openViewScreen(wrapper, "Card settings");
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  const trigger = wrapper.get<HTMLButtonElement>(
    '.yayaw-card-settings [aria-label="Properties"]'
  );
  trigger.element.focus();
  await trigger.trigger("click");
  await flushPromises();
};
const toggleProperty = async (label: string) => {
  const item = body()
    .findAll('[data-view-settings-screen="properties"] [role="checkbox"]')
    .find((element) => element.attributes("aria-label") === label);
  if (!item) {
    throw new Error(`Missing property: ${label}`);
  }
  await item.trigger("click");
  await flushPromises();
};
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
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

it("updates every Gallery setting through the select popups, including clearing the image", async () => {
  const wrapper = mountTable();
  await flushPromises();
  await select(wrapper, "Ratio", "Portrait");
  expect(wrapper.get(".yayaw-gallery-media").attributes("data-ratio")).toBe(
    "portrait"
  );
  await select(wrapper, "Fit", "Contain");
  expect(wrapper.get(".yayaw-gallery-media img").attributes("style")).toContain(
    "object-fit: contain"
  );
  await select(wrapper, "Size", "Large");
  expect(wrapper.get(".yayaw-gallery").attributes("data-size")).toBe("large");
  await select(wrapper, "Title", "Status");
  expect(wrapper.get(".yayaw-card-header strong").text()).toBe("Open");
  await select(wrapper, "Image", "None");
  expect(wrapper.find(".yayaw-gallery-media img").exists()).toBe(false);
  expect(wrapper.get('.yayaw-card-settings [aria-label="Image"]').text()).toBe(
    "None"
  );
  expect(wrapper.get(".yayaw-gallery-media > span").text()).toBe("O");
  await select(wrapper, "Image", "Photo");
  expect(wrapper.get(".yayaw-gallery-media img").attributes("src")).toBe(
    "/alpha.png"
  );
});

it("restricts Kanban lanes to groupable columns and updates card titles", async () => {
  const wrapper = mountTable({ mode: "kanban" });
  await flushPromises();
  await openViewScreen(wrapper, "Group");
  const group = wrapper.find('select[aria-label="Group 1"]');
  if (!group.exists()) {
    await wrapper.get(".yayaw-options-content button").trigger("click");
  }
  const picker = wrapper.get('select[aria-label="Group 1"]');
  expect(picker.findAll("option").map((item) => item.text())).toEqual([
    "Status",
    "Photo",
    "Amount",
  ]);
  await picker.setValue("amount");
  await flushPromises();
  expect(
    wrapper
      .findAll(".yayaw-kanban-lane header strong")
      .map((item) => item.text())
  ).toEqual(["10", "20"]);
  await wrapper.get('[aria-label="Back"]').trigger("click");
  await select(wrapper, "Title", "Status");
  expect(wrapper.get(".yayaw-card-header strong").text()).toBe("Open");
});

it.each([
  "kanban",
  "gallery",
] as const)("keeps the %s properties screen open for multiple changes and restores focus on Back", async (mode) => {
  const wrapper = mountTable({ mode });
  await flushPromises();
  await openProperties(wrapper);
  await toggleProperty("Amount");
  expect(body().find('[data-view-settings-screen="properties"]').exists()).toBe(
    true
  );
  expect(
    wrapper
      .findAll(".yayaw-card-properties dd")
      .some((item) => item.text() === "10")
  ).toBe(false);
  await toggleProperty("Show labels");
  expect(wrapper.get(".yayaw-card-properties").classes()).toContain("labeled");
  await toggleProperty("Amount");
  expect(
    wrapper
      .findAll(".yayaw-card-properties dt")
      .some((item) => item.text() === "Amount")
  ).toBe(true);
  await wrapper.get('[aria-label="Back"]').trigger("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
  expect(body().find('[data-view-settings-screen="properties"]').exists()).toBe(
    false
  );
  expect(document.activeElement).toBe(
    wrapper.get('.yayaw-card-settings [aria-label="Properties"]').element
  );
});

it.each([
  "kanban",
  "gallery",
] as const)("preserves controlled single selection and disabled cards in %s", async (mode) => {
  const wrapper = mountTable({
    mode,
    table: {
      enableMultiRowSelection: false,
      canSelectRow: (row) => row.id !== "two",
    },
  });
  await flushPromises();
  const first = wrapper.get(
    '.yayaw-card-select [role="checkbox"][aria-label="Select Alpha"]'
  );
  expect(first.element.tagName).toBe("BUTTON");
  await first.trigger("click");
  expect(first.attributes("aria-checked")).toBe("true");
  expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([
    { one: true },
  ]);
  expect(
    wrapper
      .get('.yayaw-card-select [aria-label="Select Beta"]')
      .attributes("disabled")
  ).toBeDefined();
  await wrapper
    .get('.yayaw-card-select [aria-label="Select Beta"]')
    .trigger("click");
  expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([
    { one: true },
  ]);
  await wrapper.setProps({ rowSelection: {} });
  expect(first.attributes("aria-checked")).toBe("false");
});

it("changes the card page size as a number and returns to the first page", async () => {
  const wrapper = mountTable();
  await flushPromises();
  await wrapper.findAll(".yayaw-pagination button").at(-1)?.trigger("click");
  await flushPromises();
  expect(wrapper.get("article").text()).toContain("Gamma");
  await select(wrapper, "Rows per page", "10");
  expect(wrapper.findAll("article")).toHaveLength(3);
  expect(wrapper.find(".yayaw-pagination").exists()).toBe(false);
});

it("applies saved Gallery options to the new controls and keeps translated labels", async () => {
  const view: TableView = {
    id: "saved",
    tableId: config.id,
    name: "Saved",
    config: {
      displayMode: "gallery",
      gallery: {
        imageColumn: "",
        titleColumn: "status",
        aspectRatio: "wide",
        imageFit: "contain",
        cardSize: "small",
        showCardLabels: true,
      },
    },
  };
  const wrapper = mountTable({ views: [view], active: view.id, locale: "fr" });
  await flushPromises();
  expect(wrapper.get(".yayaw-gallery").attributes("data-size")).toBe("small");
  expect(wrapper.get(".yayaw-gallery-media").attributes("data-ratio")).toBe(
    "wide"
  );
  await openViewScreen(wrapper, "Réglages des cartes");
  expect(wrapper.get('.yayaw-card-settings [aria-label="Image"]').text()).toBe(
    "Aucun"
  );
  expect(
    wrapper
      .findAll('.yayaw-card-settings [role="combobox"]')
      .map((item) => item.attributes("aria-label"))
  ).toEqual(["Image", "Titre", "Proportions", "Ajustement", "Taille"]);
});

it.each([
  "kanban",
  "gallery",
  "gantt",
] as const)("keeps %s mobile settings and choices inside one drawer", async (mode) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  const wrapper = mountTable({
    table: {
      displayModes: ["kanban", "gallery", "gantt"],
      defaultDisplayMode: mode,
    },
  });
  await flushPromises();
  await wrapper.get(".yayaw-view-trigger").trigger("click");
  await flushPromises();
  const setting = body()
    .findAll("button")
    .find(
      (item) =>
        item.text() === (mode === "gantt" ? "Gantt settings" : "Card settings")
    );
  if (!setting) {
    throw new Error("Missing settings entry");
  }
  await setting.trigger("click");
  await flushPromises();
  const label = mode === "gantt" ? "Zoom" : "Title";
  await body()
    .get(`[data-view-settings] [aria-label="${label}"]`)
    .trigger("click");
  await flushPromises();
  expect(body().findAll('[role="dialog"]')).toHaveLength(1);
  expect(body().get('[role="dialog"]').attributes("data-compact")).toBe("true");
  expect(body().find('[role="listbox"]').exists()).toBe(false);
  const option = body()
    .findAll('[role="radio"]')
    .find(
      (item) =>
        item.element.closest("label")?.textContent?.trim() ===
        (mode === "gantt" ? "Month" : "Amount")
    );
  if (!option) {
    throw new Error("Missing choice");
  }
  await option.trigger("click");
  await flushPromises();
  expect(
    body().get(`[data-view-settings] [aria-label="${label}"]`).text()
  ).toContain(mode === "gantt" ? "Month" : "Amount");
  expect(document.activeElement).toBe(
    body().get(`[data-view-settings] [aria-label="${label}"]`).element
  );
  await body().get('[aria-label="Back"]').trigger("click");
  await flushPromises();
  const reopen = body()
    .findAll("button")
    .find(
      (item) =>
        item.text() === (mode === "gantt" ? "Gantt settings" : "Card settings")
    );
  await reopen?.trigger("click");
  await flushPromises();
  expect(
    body().get(`[data-view-settings] [aria-label="${label}"]`).text()
  ).toContain(mode === "gantt" ? "Month" : "Amount");
});
