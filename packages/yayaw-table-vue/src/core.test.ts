import { beforeEach, describe, expect, it } from "vitest";
import {
  createDynamicValueField,
  createSelectWithAddNewField,
  createValueTypeField,
  defineTableConfig,
} from "./config";
import {
  applyAdvancedFilters,
  calculateColumn,
  createLocalTableViewActions,
  createTableViewSnapshot,
  displayCellValue,
  formatDateValue,
  formatNumber,
  matchesAdvancedFilter,
  rowsToCsv,
  safeHttpUrl,
} from "./core";
import type { TableRecord } from "./types";

const rows: TableRecord[] = [
  {
    id: "1",
    name: "Alpha",
    amount: 10,
    active: true,
    tags: ["one", "two"],
    status: "Open",
  },
  {
    id: "2",
    name: "Beta",
    amount: 20,
    active: false,
    tags: ["two"],
    status: "Closed",
  },
  {
    id: "3",
    name: "Gamma",
    amount: null,
    active: true,
    tags: [],
    status: "Open",
  },
];
const rowAt = (index: number): TableRecord => {
  const row = rows[index];
  if (!row) {
    throw new Error(`Missing fixture row ${index}`);
  }
  return row;
};

describe("defineTableConfig", () => {
  it("applies defaults and keeps the public configuration", () => {
    const config = defineTableConfig({
      id: "items",
      columns: {
        definitions: [{ id: "name", header: "Name" }],
        mandatory: [],
        order: ["name"],
        visible: ["name"],
      },
      table: {
        layoutPreset: "admin",
        displayModes: ["kanban", "table"],
        defaultDisplayMode: "gallery",
      },
      translations: { namespace: "items", keys: {} },
    });
    expect(config.table.defaultPageSize).toBe(20);
    expect(config.table.density).toBe("small");
    expect(config.table.defaultDisplayMode).toBe("kanban");
    expect(config.table.inlineEdit?.optimistic).toBe(true);
  });

  it("normalizes empty column arrays", () => {
    const config = defineTableConfig({
      id: "items",
      columns: {
        definitions: [{ id: "name", header: "Name" }],
        mandatory: [],
        order: [],
        visible: [],
      },
      translations: { namespace: "items", keys: {} },
    });
    expect(config.columns.order).toEqual(["name"]);
    expect(config.columns.visible).toEqual(["name"]);
  });

  it("applies the table date preset to date columns without an override", () => {
    const config = defineTableConfig({
      id: "items",
      columns: {
        definitions: [
          { id: "createdAt", header: "Created", type: "date" },
          {
            id: "updatedAt",
            header: "Updated",
            type: "date",
            dateDisplayPreset: "relative",
          },
        ],
        mandatory: [],
        order: ["createdAt", "updatedAt"],
        visible: ["createdAt", "updatedAt"],
      },
      table: { dateDisplayPreset: "iso-date" },
      translations: { namespace: "items", keys: {} },
    });
    expect(config.columns.definitions[0]?.dateDisplayPreset).toBe("iso-date");
    expect(config.columns.definitions[1]?.dateDisplayPreset).toBe("relative");
  });
});

describe("advanced filtering", () => {
  it("supports text, equality, comparison, empty and boolean operators", () => {
    expect(
      matchesAdvancedFilter(rowAt(0), {
        id: "a",
        columnId: "name",
        operator: "contains",
        values: "LP",
      })
    ).toBe(true);
    expect(
      matchesAdvancedFilter(rowAt(0), {
        id: "a",
        columnId: "amount",
        operator: "greaterThan",
        values: 9,
      })
    ).toBe(true);
    expect(
      matchesAdvancedFilter(rowAt(2), {
        id: "a",
        columnId: "amount",
        operator: "isEmpty",
      })
    ).toBe(true);
    expect(
      matchesAdvancedFilter(rowAt(1), {
        id: "a",
        columnId: "active",
        operator: "isFalse",
      })
    ).toBe(true);
    expect(
      matchesAdvancedFilter(rowAt(0), {
        id: "a",
        columnId: "tags",
        operator: "in",
        values: ["two"],
      })
    ).toBe(true);
  });

  it("combines filters with and/or", () => {
    const filters = [
      {
        id: "a",
        columnId: "status",
        operator: "equals" as const,
        values: "Open",
      },
      {
        id: "b",
        columnId: "amount",
        operator: "greaterThan" as const,
        values: 15,
      },
    ];
    expect(
      applyAdvancedFilters(rows, { filters, joinOperator: "and" })
    ).toEqual([]);
    expect(
      applyAdvancedFilters(rows, { filters, joinOperator: "or" })
    ).toHaveLength(3);
  });
});

describe("calculations", () => {
  it("computes numeric aggregates", () => {
    expect(calculateColumn(rows, "amount", "sum")).toBe(30);
    expect(calculateColumn(rows, "amount", "average")).toBe(15);
    expect(calculateColumn(rows, "amount", "median")).toBe(15);
    expect(calculateColumn(rows, "amount", "range")).toBe(10);
  });

  it("computes counts and percentages", () => {
    expect(calculateColumn(rows, "amount", "count_empty")).toBe(1);
    expect(calculateColumn(rows, "status", "count_unique")).toBe(2);
    expect(calculateColumn(rows, "active", "count_true")).toBe(2);
    expect(calculateColumn(rows, "active", "percent_false")).toBeCloseTo(
      100 / 3
    );
  });
});

describe("format and export", () => {
  it("formats number, date and typed values", () => {
    expect(
      formatNumber(1234.5, { currency: "EUR", locale: "fr-FR" })
    ).toContain("1 234,50");
    expect(formatDateValue("2026-08-31T12:00:00.000Z", "iso")).toBe(
      "2026-08-31T12:00:00.000Z"
    );
    expect(formatDateValue("2026-08-31T12:00:00.000Z", "dmy-numeric")).toBe(
      "31/08/2026"
    );
    expect(formatDateValue("2026-08-31T12:00:00.000Z", "iso-date")).toBe(
      "2026-08-31"
    );
    expect(displayCellValue(["a", "b"], { id: "tags", header: "Tags" })).toBe(
      "a, b"
    );
    expect(
      displayCellValue("quoted", {
        id: "name",
        header: "Name",
        type: "string",
        showQuotes: true,
      })
    ).toBe("“quoted”");
  });

  it("exports escaped CSV", () => {
    const csv = rowsToCsv(
      [{ name: "A, B", note: 'a"b' }],
      [
        { id: "name", header: "Name" },
        { id: "note", header: "Note" },
      ]
    );
    expect(csv).toBe('Name,Note\n"A, B","a""b"');
  });

  it("allows only http image and link URLs", () => {
    expect(safeHttpUrl("https://example.com/a.png")).toBe(
      "https://example.com/a.png"
    );
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
  });
});

describe("form factories", () => {
  it("keeps the React catalogue field vocabulary", () => {
    expect(
      createDynamicValueField({
        name: "value",
        label: "Value",
        dependsOn: { field: "type", transform: String },
      }).type
    ).toBe("dynamic-value");
    expect(
      createSelectWithAddNewField({ name: "category", label: "Category" })
        .options
    ).toEqual([]);
    expect(
      createValueTypeField({
        name: "value",
        label: "Value",
        valueTypeField: "type",
      }).type
    ).toBe("value-type");
  });
});

describe("saved views", () => {
  beforeEach(() => localStorage.clear());

  it("drops transient empty state from snapshots", () => {
    expect(
      createTableViewSnapshot({
        search: "",
        filters: [],
        grouping: [],
        pageSize: 20,
      })
    ).toEqual({ pageSize: 20 });
  });

  it("creates, lists, updates and deletes local views", async () => {
    const actions = createLocalTableViewActions();
    const created = await actions.create?.({
      tableId: "products",
      name: "Mine",
      config: { search: "a" },
    });
    expect(created?.data?.name).toBe("Mine");
    expect(await actions.list?.({ tableId: "products" })).toHaveLength(1);
    const updated = await actions.update?.(created?.data?.id ?? "", {
      name: "Updated",
    });
    expect(updated?.data?.name).toBe("Updated");
    await actions.delete?.(created?.data?.id ?? "", { tableId: "products" });
    expect(await actions.list?.({ tableId: "products" })).toEqual([]);
  });
});
