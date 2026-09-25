import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTagStore } from "../../../../../examples/tags";
import { inlineTestPortals } from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import type {
  ColumnDefinition,
  TableActionResult,
  TableActions,
  TableRecord,
} from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

// Popovers render in place; arrows need the real popper they are stubbed out of.
inlineTestPortals();
const stubs = { PopperArrow: true };

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);

const catalog = [
  { id: "t-brand", name: "Brand", color: "blue" },
  { id: "t-social", name: "Social" },
  { id: "t-print", name: "Print", color: "orange" },
];

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
};
const body = () => new DOMWrapper(document.body);

function mountTags(
  options: {
    column?: Partial<ColumnDefinition>;
    table?: Record<string, unknown>;
    actions?: Partial<TableActions>;
  } = {}
) {
  const rows: TableRecord[] = [
    { id: "1", name: "Logo", tags: ["t-brand", "t-print"] },
    { id: "2", name: "Hero", tags: ["t-social"] },
    { id: "3", name: "Office", tags: [] },
  ];
  const store = createTagStore({
    seed: catalog,
    records: () => rows,
    field: "tags",
  });
  const tags = {
    list: vi.fn(store.list),
    create: vi.fn(store.create ?? (() => Promise.resolve())),
    update: vi.fn(store.update),
    merge: vi.fn(store.merge),
    remove: vi.fn(store.remove),
  };
  const update = vi.fn(
    (id: string, patch: TableRecord): Promise<TableActionResult> => {
      Object.assign(rows.find((row) => row.id === id) ?? {}, patch);
      return Promise.resolve({ success: true });
    }
  );
  const actions = { tags, update, ...options.actions } as TableActions;
  const config = defineTableConfig({
    id: "assets",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "tags",
          header: "Tags",
          type: "multiSelect",
          tags: true,
          inlineEdit: true,
          ...options.column,
        },
      ],
      mandatory: ["name"],
      order: ["select", "name", "tags"],
      visible: ["select", "name", "tags"],
    },
    table: { enableRowSelection: true, ...options.table },
    translations: { namespace: "assets", keys: { title: "Assets" } },
  });
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "assets",
      config,
      data: rows,
      syncUrl: false,
      getTableActions: () => actions,
    },
    attachTo: document.body,
    global: { stubs },
  });
  return { wrapper, rows, tags, update, actions };
}

const tagsCell = (wrapper: VueWrapper, index: number) =>
  wrapper.findAll('td[data-column-id="tags"]')[index];

describe("tags columns backed by actions.tags", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("shows catalog names and colors, loading the catalog once", async () => {
    const { wrapper, tags } = mountTags();
    await settle();
    const first = tagsCell(wrapper, 0);
    expect(first?.text()).toContain("Brand");
    expect(first?.text()).toContain("Print");
    const brand = first
      ?.findAll(".yayaw-tag")
      .find((chip) => chip.text() === "Brand");
    expect(brand?.classes()).toContain("yayaw-tag-tinted");
    expect(brand?.attributes("style")).toContain("--yayaw-tag-color: #2563eb");
    expect(tags.list).toHaveBeenCalledTimes(1);
    expect(tags.list).toHaveBeenCalledWith({
      tableId: "assets",
      tableType: "assets",
      columnId: "tags",
    });
  });

  it("creates a tag on the fly in a cell, selects it and saves the record", async () => {
    const { wrapper, tags, update } = mountTags();
    await settle();
    await tagsCell(wrapper, 2)?.get(".yayaw-cell").trigger("dblclick");
    await settle();
    const input = wrapper.get<HTMLInputElement>('input[aria-label="Tags"]');
    await input.setValue("Summer");
    await settle();
    expect(body().text()).toContain("Create “Summer”");
    await input.trigger("keydown", { key: "Enter" });
    await settle();
    expect(tags.create).toHaveBeenCalledWith({
      tableId: "assets",
      tableType: "assets",
      columnId: "tags",
      name: "Summer",
    });
    expect(tagsCell(wrapper, 2)?.text()).toContain("Summer");
    // Enter with nothing typed saves the cell.
    await input.trigger("keydown", { key: "Enter" });
    await settle();
    expect(update).toHaveBeenCalledWith(
      "3",
      { tags: ["tag-new-1"] },
      expect.anything()
    );
    expect(tagsCell(wrapper, 2)?.text()).toBe("Summer");
  });

  it("bulk add sends one { add, remove } patch in patch mode", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const { wrapper, rows } = mountTags({
      column: { tags: { bulk: "patch" } },
      actions: { bulkUpdate },
    });
    await settle();
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    await checkboxes[0]?.setValue(true);
    await checkboxes[1]?.setValue(true);
    await settle();
    await wrapper.get('button[aria-label="Add tags"]').trigger("click");
    await settle();
    const dialog = body().get('[data-bulk-tags="add"]');
    expect(dialog.text()).toContain("Add tags to 2 records");
    const picker = dialog.get<HTMLInputElement>(
      'input[aria-label="Choose tags"]'
    );
    await picker.setValue("social");
    await picker.trigger("keydown", { key: "Enter" });
    await settle();
    const add = dialog
      .findAll("button")
      .find((button) => button.text() === "Add");
    await add?.trigger("click");
    await settle();
    expect(bulkUpdate).toHaveBeenCalledWith(["1", "2"], {
      tags: { add: ["t-social"], remove: [] },
    });
    expect(rows[0]?.tags).toEqual(["t-brand", "t-print", "t-social"]);
    expect(rows[1]?.tags).toEqual(["t-social"]);
    // Saved rows leave the selection.
    expect(wrapper.find('button[aria-label="Add tags"]').exists()).toBe(false);
  });

  it("bulk remove in values mode restores the rows that fail and keeps them selected", async () => {
    let stored: TableRecord[] = [];
    const bulkUpdate = vi.fn(
      (
        ids: string[],
        patch: TableRecord
      ): Promise<TableActionResult<TableRecord[]>> => {
        if (ids.includes("2")) {
          return Promise.resolve({
            success: false,
            error: "Locked",
            failedIds: ["2"],
          });
        }
        for (const row of stored.filter((item) =>
          ids.includes(String(item.id))
        )) {
          Object.assign(row, patch);
        }
        return Promise.resolve({ success: true });
      }
    );
    const { wrapper, rows } = mountTags({ actions: { bulkUpdate } });
    stored = rows;
    await settle();
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    await checkboxes[0]?.setValue(true);
    await checkboxes[1]?.setValue(true);
    await settle();
    await wrapper.get('button[aria-label="Remove tags"]').trigger("click");
    await settle();
    const dialog = body().get('[data-bulk-tags="remove"]');
    // Only the selection's tags, with how many rows use each.
    const picker = dialog.get<HTMLInputElement>(
      'input[aria-label="Choose tags"]'
    );
    await picker.trigger("focus");
    await picker.trigger("click");
    await settle();
    const offered = body()
      .findAll('[role="option"]')
      .map((option) => option.text());
    expect(offered).toEqual(["Brand1", "Social1", "Print1"]);
    await picker.setValue("brand");
    await picker.trigger("keydown", { key: "Enter" });
    await picker.setValue("social");
    await picker.trigger("keydown", { key: "Enter" });
    await settle();
    await dialog
      .findAll("button")
      .find((button) => button.text() === "Remove")
      ?.trigger("click");
    await settle();
    // One call per resulting list: row 1 keeps Print, row 2 ends empty.
    expect(bulkUpdate).toHaveBeenCalledWith(["1"], { tags: ["t-print"] });
    expect(bulkUpdate).toHaveBeenCalledWith(["2"], { tags: [] });
    expect(tagsCell(wrapper, 0)?.text()).toBe("Print");
    expect(tagsCell(wrapper, 1)?.text()).toBe("Social");
    expect(rows[1]?.tags).toEqual(["t-social"]);
    const selected = wrapper
      .findAll<HTMLInputElement>('tbody input[type="checkbox"]')
      .map((checkbox) => checkbox.element.checked);
    expect(selected).toEqual([false, true, false]);
  });

  it("Manage tags counts, renames, merges and deletes with confirmation", async () => {
    const aggregate = vi.fn(async () => ({
      groups: [
        { keys: ["t-brand"], values: [1] },
        { keys: ["t-print"], values: [1] },
        { keys: ["t-social"], values: [1] },
      ],
    }));
    const { wrapper, tags, rows } = mountTags({ actions: { aggregate } });
    await settle();
    await wrapper
      .get('[aria-label="Column options: Tags"]')
      .trigger("keydown", { key: "Enter" });
    await settle();
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((element) => element.textContent?.trim() === "Manage tags")
      ?.click();
    await settle();
    const dialog = body().get("[data-manage-tags]");
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBy: [{ columnId: "tags" }],
        metrics: [{ fn: "count" }],
      })
    );
    expect(dialog.get('[data-tag-row="t-brand"]').text()).toContain("1 record");

    const rename = dialog.get<HTMLInputElement>(
      'input[aria-label="Rename Social"]'
    );
    await rename.setValue("Social media");
    await rename.trigger("keydown", { key: "Enter" });
    await settle();
    expect(tags.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-social", name: "Social media" })
    );
    expect(tagsCell(wrapper, 1)?.text()).toBe("Social media");

    await dialog
      .get('[aria-label="Print actions"]')
      .trigger("keydown", { key: "Enter" });
    await settle();
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((element) => element.textContent?.trim() === "Delete")
      ?.click();
    await settle();
    const confirm = body().get('[data-tags-confirm="delete"]');
    expect(confirm.text()).toContain("It is used by 1 record");
    await confirm
      .findAll("button")
      .find((button) => button.text() === "Delete")
      ?.trigger("click");
    await settle();
    expect(tags.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t-print" })
    );
    expect(rows[0]?.tags).toEqual(["t-brand"]);
    expect(tagsCell(wrapper, 0)?.text()).toBe("Brand");
    expect(body().find('[data-tag-row="t-print"]').exists()).toBe(false);
  });

  it("the record form picks and creates tags for a tags column", async () => {
    const { wrapper, tags, update } = mountTags();
    await settle();
    const actions = wrapper.findAll(
      'tbody button[aria-label="Open actions menu"]'
    );
    await actions[1]?.trigger("keydown", { key: "Enter" });
    await settle();
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((element) => element.textContent?.trim() === "Edit")
      ?.click();
    await settle();
    const field = body().get('.yayaw-form-field[data-field-name="tags"]');
    // The field shows the record's tags as chips from the catalog.
    expect(field.get("[data-tag-picker]").text()).toContain("Social");
    const input = field.get<HTMLInputElement>('input[aria-label="Tags"]');
    await input.setValue("Autumn");
    await input.trigger("keydown", { key: "Enter" });
    await settle();
    expect(tags.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Autumn" })
    );
    await body().get('button[type="submit"]').trigger("click");
    await settle();
    expect(update).toHaveBeenCalledWith(
      "2",
      expect.objectContaining({ tags: ["t-social", "tag-new-1"] }),
      expect.anything()
    );
  });

  it("keeps static options and no tag controls without actions.tags", async () => {
    const config = defineTableConfig({
      id: "plain",
      columns: {
        definitions: [
          {
            id: "tags",
            header: "Tags",
            type: "multiSelect",
            tags: true,
            options: [{ value: "t-brand", label: "Static brand" }],
          },
        ],
        mandatory: [],
        order: ["select", "tags"],
        visible: ["select", "tags"],
      },
      translations: { namespace: "plain", keys: {} },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "plain",
        config,
        data: [{ id: "1", tags: ["t-brand"] }],
        syncUrl: false,
        getTableActions: () => ({
          bulkUpdate: async () => ({ success: true }),
        }),
      },
      attachTo: document.body,
    });
    await settle();
    expect(wrapper.get('td[data-column-id="tags"]').text()).toBe(
      "Static brand"
    );
    await wrapper.get('tbody input[type="checkbox"]').setValue(true);
    await settle();
    expect(wrapper.find('button[aria-label="Add tags"]').exists()).toBe(false);
  });
});
