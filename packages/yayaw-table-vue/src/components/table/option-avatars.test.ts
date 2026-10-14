import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { computed, h } from "vue";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import { createTranslations } from "../../translations";
import type { ColumnDefinition } from "../../types";
import CellRenderer from "./CellRenderer.vue";

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
});

const owners: ColumnDefinition = {
  id: "owners",
  header: "Owners",
  type: "multiSelect",
  displayVariant: "avatars",
  options: [
    { value: 1, label: "Ada Lovelace", image: "https://example.com/ada.jpg" },
    { value: 2, label: "Grace Hopper" },
  ],
};

const mountCell = (column: ColumnDefinition, value: unknown) => {
  const context = {
    config: defineTableConfig({
      id: "option-avatars",
      columns: { definitions: [column], mandatory: [], visible: [], order: [] },
      translations: { namespace: "items", keys: {} },
      table: {},
    }),
    tableType: "items",
    actions: computed(() => ({})),
    translations: computed(() => createTranslations("en")),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
  } as unknown as TableContextValue;
  const wrapper = mount(
    { render: () => h(CellRenderer, { column, row: { id: "1" }, value }) },
    {
      attachTo: document.body,
      global: { provide: { [tableContextKey as symbol]: context } },
    }
  );
  mounted.push(wrapper);
  return wrapper;
};

it("shows people as avatars: the option's image, else initials, each named for screen readers", () => {
  const wrapper = mountCell(owners, [1, 2, null]);
  const items = wrapper.findAll(".yayaw-avatar-stack-item");
  expect(items.map((item) => item.attributes("aria-label"))).toEqual([
    "Ada Lovelace",
    "Grace Hopper",
  ]);
  expect(items[0]?.find("img").attributes("src")).toBe(
    "https://example.com/ada.jpg"
  );
  expect(items[1]?.text()).toBe("GH");
  expect(wrapper.find(".yayaw-tag").exists()).toBe(false);
});

it("keeps tags for the other option columns", () => {
  const wrapper = mountCell({ ...owners, displayVariant: "tag" }, [2]);
  expect(wrapper.find(".yayaw-avatar-stack").exists()).toBe(false);
  expect(wrapper.find(".yayaw-tag").text()).toBe("Grace Hopper");
});
