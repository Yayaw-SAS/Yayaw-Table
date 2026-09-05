import { expect, it } from "bun:test";
import { defineTableConfig } from "../../../config/helpers";
import { createTablePickerField } from "../factories";
import { queryTablePickerRows } from "./table-picker-field";

const config = defineTableConfig({
  id: "picker",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "amount", header: "Amount", type: "number" },
    ],
    mandatory: [],
    order: ["name", "amount"],
    visible: ["name", "amount"],
  },
  translations: { keys: {}, namespace: "picker" },
});
const rows = [
  { id: "one", name: "Alpha", amount: 10 },
  { id: "two", name: "Beta", amount: 30 },
  { id: "three", name: "Gamma", amount: 20 },
];

it("builds a typed declarative table picker", () => {
  const field = createTablePickerField({
    tablePicker: {
      config,
      data: rows,
      tableType: "products",
    },
    label: "Products",
    name: "productIds",
  });

  expect(field.type).toBe("tablePicker");
  expect(field.tablePicker.tableType).toBe("products");
});

it("applies search, filters, sorting, and pagination to local picker rows", () => {
  const result = queryTablePickerRows({
    config,
    params: {
      page: 1,
      pageSize: 1,
      search: "a",
      sorting: [{ id: "amount", desc: true }],
      filters: { name: "a" },
      advancedFilters: [
        {
          columnId: "amount",
          operator: "greaterThan",
          type: "number",
          values: 10,
        },
      ],
    },
    rows,
  });

  expect(result).toEqual({
    data: [{ id: "two", name: "Beta", amount: 30 }],
    meta: { pageCount: 2, totalCount: 2 },
  });
});
