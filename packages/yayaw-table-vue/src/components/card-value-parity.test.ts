import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineTableConfig } from "../config";
import type { TableRecord } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const rows: TableRecord[] = [
  { id: "1", name: "Alpha", status: "Open", done: true, note: "", secret: "x" },
  {
    id: "2",
    name: "Beta",
    status: "Open",
    done: false,
    note: "Call",
    secret: "y",
  },
];
const config = (table: Record<string, unknown> = {}) =>
  defineTableConfig({
    id: "cards",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "status",
          header: "Status",
          type: "select",
          options: [{ value: "Open", label: "Open" }],
        },
        { id: "done", header: "Done", type: "boolean" },
        { id: "note", header: "Note", type: "text" },
        { id: "secret", header: "Secret", type: "text" },
      ],
      mandatory: ["name"],
      order: ["name", "status", "done", "note", "secret"],
      // `secret` is hidden, as React leaves hidden columns off cards.
      visible: ["name", "status", "done", "note"],
    },
    table: {
      displayModes: ["table", "kanban", "list"],
      kanban: { groupBy: "status", titleColumn: "name" },
      ...table,
    },
    translations: { namespace: "cards", keys: {} },
  });
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await flushPromises();
};

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);

describe("card values, as in React", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("renders booleans as a checkbox-style mark, never a dash or a badge", async () => {
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "cards",
        config: config(),
        data: rows,
        syncUrl: false,
      },
      attachTo: document.body,
    });
    await settle();
    const marks = wrapper.findAll(".yayaw-boolean");
    expect(marks.map((mark) => mark.attributes("aria-label"))).toEqual([
      "True",
      "False",
    ]);
    expect(marks.map((mark) => mark.attributes("data-value"))).toEqual([
      "true",
      "false",
    ]);
    expect(marks[0]?.find("svg").exists()).toBe(true);
    expect(marks[1]?.find("svg").exists()).toBe(false);
    expect(marks[1]?.text()).toBe("");
  });

  it("leaves hidden columns and blank values off compact board cards", async () => {
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "cards",
        config: config({ defaultDisplayMode: "kanban" }),
        data: rows,
        syncUrl: false,
      },
      attachTo: document.body,
    });
    await settle();
    const cards = wrapper.findAll("article");
    expect(cards).toHaveLength(2);
    const types = (index: number) =>
      cards[index]
        ?.findAll(".yayaw-card-properties dd")
        .map((item) => item.attributes("data-type"));
    // Alpha has no note: only its done mark shows; Beta shows both.
    expect(types(0)).toEqual(["boolean"]);
    expect(types(1)).toEqual(["boolean", "text"]);
    expect(wrapper.text()).not.toContain("—");
    expect(wrapper.text()).not.toContain("x");
  });

  it("shows card pagination when the rows outnumber a page, even if the server reports one page", async () => {
    const actions = {
      list: () =>
        Promise.resolve({ data: rows, meta: { pageCount: 1, totalCount: 6 } }),
    };
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "cards",
        config: config({ defaultDisplayMode: "list", defaultPageSize: 5 }),
        getTableActions: () => actions,
        syncUrl: false,
      },
      attachTo: document.body,
    });
    await settle();
    expect(wrapper.find(".yayaw-pagination").exists()).toBe(true);
    expect(wrapper.find(".yayaw-pagination").text()).toContain("1 / 2");
  });
});
