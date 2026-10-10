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

const Icon = { render: () => h("svg") };

const mountCell = (
  column: ColumnDefinition,
  row: TableRecord,
  value: unknown
) => {
  const context = {
    config: defineTableConfig({
      id: "cell-actions",
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

it("draws the value, then its actions at the control size, and keeps clicks off the row", async () => {
  const onClick = vi.fn();
  const { wrapper, parentClick } = mountCell(
    {
      id: "note",
      header: "Note",
      copyable: true,
      cellActions: [
        {
          id: "add",
          label: "Add a note",
          icon: Icon,
          count: (row) => Number(row.notes),
          onClick,
        },
        { id: "open", label: "Open", href: () => "/notes/1" },
      ],
    },
    { id: "1", notes: 2 },
    "Last note"
  );

  const actions = wrapper.findAll("[data-cell-action]");
  // Same contract as the React cell: declaration order, the copy action last.
  expect(
    actions.map((action) => action.attributes("data-cell-action"))
  ).toEqual(["add", "open", "copy"]);
  expect(wrapper.find(".yayaw-cell").classes()).toContain("has-actions");
  expect(actions[0]?.attributes("aria-label")).toBe("Add a note");
  expect(actions[0]?.text()).toBe("2");
  expect(actions[0]?.classes()).toContain("yayaw-cell-action");
  expect(actions[1]?.attributes("href")).toBe("/notes/1");
  expect(actions[1]?.attributes("rel")).toBe("noopener noreferrer");
  expect(actions[2]?.attributes("aria-label")).toBe("Copy");
  expect(actions[2]?.attributes("data-reveal")).toBe("hover");

  await actions[0]?.trigger("click");
  expect(onClick).toHaveBeenCalledWith({ id: "1", notes: 2 }, "Last note");
  expect(parentClick).not.toHaveBeenCalled();
});

it("renders the plain value when no action applies", () => {
  const { wrapper } = mountCell(
    { id: "name", header: "Name", copyable: true },
    { id: "1" },
    ""
  );
  expect(wrapper.find("[data-cell-actions]").exists()).toBe(false);
  expect(wrapper.find(".yayaw-cell").classes()).not.toContain("has-actions");
});

it("ignores a disabled action's click without passing it to the row", async () => {
  const onClick = vi.fn();
  const { wrapper, parentClick } = mountCell(
    {
      id: "name",
      header: "Name",
      cellActions: [
        { id: "locked", label: "Locked", disabled: () => true, onClick },
      ],
    },
    { id: "1" },
    "Name"
  );
  const action = wrapper.find("[data-cell-action]");
  expect(action.attributes("aria-disabled")).toBe("true");
  await action.trigger("click");
  expect(onClick).not.toHaveBeenCalled();
  expect(parentClick).not.toHaveBeenCalled();
});
