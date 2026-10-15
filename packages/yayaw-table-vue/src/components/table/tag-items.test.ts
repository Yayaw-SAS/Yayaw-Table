import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { computed, h } from "vue";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import { createTranslations } from "../../translations";
import type { ColumnDefinition, TableRecord } from "../../types";
import CellRenderer from "./CellRenderer.vue";

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
});

const Icon = { render: () => h("svg", { "data-icon": "" }) };

const mountCell = (
  column: ColumnDefinition,
  row: TableRecord,
  value: unknown
) => {
  const context = {
    config: defineTableConfig({
      id: "tag-items",
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
  const parentClick = vi.fn();
  const wrapper = mount(
    {
      render: () =>
        h("div", { onClick: parentClick }, [
          h(CellRenderer, { column, row, value }),
        ]),
    },
    {
      attachTo: document.body,
      global: { provide: { [tableContextKey as symbol]: context } },
    }
  );
  mounted.push(wrapper);
  return { wrapper, parentClick };
};

const row = {
  id: "7",
  activations: [
    { id: 1, name: "Reel 1", posts: 2 },
    { id: 2, name: "Story", posts: 0 },
  ],
};

it("draws each tag from the row's tagItem and keeps tag clicks off the row", async () => {
  const onTagClick = vi.fn();
  const { wrapper, parentClick } = mountCell(
    {
      id: "activations",
      header: "Activations",
      type: "tag",
      tagItem: (value) => {
        const activation = value as (typeof row.activations)[number];
        return {
          label: activation.name,
          tone: activation.posts > 0 ? "success" : "neutral",
          icon: Icon,
          title: `Activation #${activation.id}`,
        };
      },
      onTagClick,
    },
    row,
    row.activations
  );

  const tags = wrapper.findAll<HTMLElement>(".yayaw-tag");
  expect(tags.map((tag) => tag.text())).toEqual(["Reel 1", "Story"]);
  expect(tags.map((tag) => tag.element.tagName)).toEqual(["BUTTON", "BUTTON"]);
  expect(tags.map((tag) => tag.attributes("type"))).toEqual([
    "button",
    "button",
  ]);
  expect(tags.map((tag) => tag.attributes("title"))).toEqual([
    "Activation #1",
    "Activation #2",
  ]);
  expect(tags.map((tag) => tag.attributes("data-colored"))).toEqual([
    "true",
    "false",
  ]);
  expect(tags[0]?.element.style.getPropertyValue("--yayaw-tag-color")).toBe(
    "var(--yayaw-success, #16a34a)"
  );
  expect(tags.every((tag) => tag.find("[data-icon]").exists())).toBe(true);

  await tags[1]?.trigger("click");
  expect(onTagClick).toHaveBeenCalledWith(row.activations[1], row);
  expect(parentClick).not.toHaveBeenCalled();
});

it("keeps option tags as plain labels without tagItem or onTagClick", () => {
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      options: [{ value: "done", label: "Done", color: "green" }],
    },
    { id: "1" },
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  expect(tag.element.tagName).toBe("SPAN");
  expect(tag.text()).toBe("Done");
  expect(tag.attributes("data-tag-button")).toBeUndefined();
});
