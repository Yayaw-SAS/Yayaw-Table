import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import rows from "../../../tests/fixtures/row-selection-range.json";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";

enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));
async function mountRange(grouped = false, multi = true) {
  window.history.replaceState(
    {},
    "",
    `/?range-grouping=${encodeURIComponent(JSON.stringify(grouped ? ["category"] : []))}`
  );
  const config = defineTableConfig({
    id: "range",
    columns: {
      mandatory: ["name"],
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "category", header: "Category", type: "text" },
      ],
      visible: ["select", "name", "category"],
      order: ["select", "name", "category"],
    },
    table: {
      enableRowSelection: true,
      enableMultiRowSelection: multi,
      enablePagination: false,
      canSelectRow: (row) => row.id !== "2",
      preserveSelectionOnQuery: true,
    },
    translations: { namespace: "range", keys: {} },
  });
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: { config, data: rows, tableType: "range" },
  });
  await flushPromises();
  const click = async (id: string, shiftKey = false) => {
    const checkbox = wrapper.get<HTMLInputElement>(
      `[data-yayaw-table-selection-row-id="${id}"]`
    );
    checkbox.element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, shiftKey })
    );
    await flushPromises();
  };
  const selected = () =>
    wrapper
      .findAll<HTMLInputElement>("[data-yayaw-table-selection-row-id]")
      .filter((checkbox) => checkbox.element.checked)
      .map((checkbox) =>
        checkbox.attributes("data-yayaw-table-selection-row-id")
      );
  return { wrapper, click, selected };
}
it("selects and clears inclusive ranges, skips disabled rows, preserves other selections and refreshes the header", async () => {
  const { wrapper, click, selected } = await mountRange();
  await click("5");
  await click("1");
  await click("3", true);
  expect(selected()).toEqual(["1", "3", "5"]);
  expect(
    wrapper.get<HTMLInputElement>('[aria-label="Select page"]').element
      .indeterminate
  ).toBe(true);
  await click("4", true);
  expect(selected()).toEqual(["1", "3", "4", "5"]);
  expect(
    wrapper.get<HTMLInputElement>('[aria-label="Select page"]').element.checked
  ).toBe(true);
  await click("3", true);
  expect(selected()).toEqual(["4", "5"]);
});
it("keeps normal toggles when Shift has no anchor or multi-selection is disabled", async () => {
  const { click, selected } = await mountRange(false, false);
  await click("1", true);
  expect(selected()).toEqual(["1"]);
  await click("4", true);
  expect(selected()).toEqual(["4"]);
});
it("follows visible grouped order and invalidates the anchor after a group collapses", async () => {
  const { wrapper, click, selected } = await mountRange(true);
  await click("1");
  await click("4", true);
  expect(selected()).toEqual(["1", "3", "4"]);
  expect(
    wrapper.get<HTMLInputElement>('tbody tr.grouped input[type="checkbox"]')
      .element.checked
  ).toBe(true);
  await wrapper.get("tbody button[aria-expanded]").trigger("click");
  await click("5", true);
  expect(selected()).toEqual(["4", "5"]);
});
it("keeps selection anchors isolated between mounted tables", async () => {
  const first = await mountRange();
  const second = await mountRange();
  await first.click("1");
  await second.click("4", true);
  expect(first.selected()).toEqual(["1"]);
  expect(second.selected()).toEqual(["4"]);
});
