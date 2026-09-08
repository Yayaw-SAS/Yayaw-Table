import { expect, it } from "bun:test";
import { validateForm as validateVue } from "../packages/yayaw-table-vue/src/form-runtime";
import { validateForm as validateReact } from "../src/components/ui/yayaw-table/components/forms/form-runtime";
import { generateFormConfig } from "../src/components/ui/yayaw-table/components/forms/generated-form-config";
import {
  parseInlineEditValue,
  resolveInlineEditColumnConfig,
} from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";
import {
  dataTypeFilter,
  generateDataTypeFields,
  jsonFormDraft,
  jsonFormText,
  optionControlKey,
  optionControlValue,
  resolveDataType,
  resolveDataTypeEditor,
  TABLE_DATA_TYPES,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import fixtures from "./fixtures/data-types.json";

const options = [
  { label: "Number one", value: 1 },
  { label: "String one", value: "1" },
  { label: "False", value: false },
];
it("covers every public data type", () => {
  expect(fixtures.map((item) => item.type).sort()).toEqual(
    Object.keys(TABLE_DATA_TYPES).sort()
  );
});
for (const scenario of fixtures) {
  it(`derives ${scenario.type} controls from the column declaration`, () => {
    const column = {
      id: "value",
      header: "Value",
      type: scenario.type,
      options,
    };
    const row = { type: "number", value: 10 };
    const expectedForm =
      scenario.type === "dynamicType" ? "number" : scenario.form;
    const fields = generateDataTypeFields([column], row);
    expect(fields[0]?.type ?? null).toBe(expectedForm);
    expect(generateFormConfig("types", [column], row).fields).toEqual(fields);
    expect(dataTypeFilter(scenario.type)).toBe(scenario.filter);
    if (scenario.inline || scenario.type === "dynamicType") {
      expect(
        resolveDataTypeEditor({
          columnType: resolveDataType(scenario.type, row),
        })
      ).toBe(scenario.inline ?? "number");
    }
  });
}
it("keeps computed and custom values read-only without an explicit editor", () => {
  expect(
    generateDataTypeFields([
      {
        id: "computed",
        header: "Computed",
        type: "number",
        accessorFn: () => 1,
      },
    ])
  ).toEqual([]);
  expect(
    resolveInlineEditColumnConfig(
      { id: "custom", type: "custom" },
      { enabled: true }
    ).enabled
  ).toBe(false);
});
it("retains declared options and accessor names in inline editing", () => {
  expect(
    resolveInlineEditColumnConfig(
      { id: "caption", type: "select", accessorKey: "value", options },
      { enabled: true }
    )
  ).toMatchObject({ formField: "value", options });
});
it("preserves primitive identity, whitespace and unknown stored values", () => {
  const values = [1, "1", false, "false", " spaced ", "", "unknown"];
  expect(values.map(optionControlKey).map(optionControlValue)).toEqual(values);
  expect(
    parseInlineEditValue({ editor: "multiSelect", rawValue: values, options })
      .value
  ).toEqual(values);
});
it("rejects partial numeric input instead of silently truncating it", () => {
  expect(
    parseInlineEditValue({ editor: "number", rawValue: "12oops" }).success
  ).toBe(false);
});
const validators = [validateReact, validateVue] as const;
for (const [index, validate] of validators.entries()) {
  for (const value of [
    { enabled: false },
    [1, "1"],
    "plain string",
    0,
    false,
    null,
  ]) {
    it(`${index ? "Vue" : "React"} JSON form round-trip: ${JSON.stringify(value)}`, async () => {
      const config = {
        id: "types",
        fields: [{ name: "value", label: "Value", type: "json" as const }],
      };
      const values = { value: jsonFormDraft(JSON.stringify(value)) };
      const result = await validate(config, values, {
        values,
        mode: "edit",
        tableId: "types",
        tableType: "types",
      });
      expect(result.errors).toEqual({});
      expect(result.values.value).toEqual(value);
      expect(jsonFormText(value)).toBe(JSON.stringify(value, null, 2));
    });
  }
  it(`${index ? "Vue" : "React"} rejects invalid JSON, dates and array values without a schema`, async () => {
    for (const [type, value] of [
      ["json", jsonFormDraft("{ incomplete")],
      ["date", "2026-02-30"],
      ["multiSelect", "one"],
      ["switch", "false"],
    ] as const) {
      const config = {
        id: "types",
        fields: [{ name: "value", label: "Value", type }],
      };
      const values = { value };
      const result = await validate(config, values, {
        values,
        mode: "edit",
        tableId: "types",
        tableType: "types",
      });
      expect(result.errors.value).toBeTruthy();
    }
  });
}

it("generates no bulk editor for incompatible dynamic row types", () => {
  const columns = [
    { id: "value", header: "Value", type: "dynamicType", typeKey: "kind" },
  ];
  expect(
    generateDataTypeFields(columns, { kind: "number" }, [
      { kind: "number" },
      { kind: "json" },
    ])
  ).toEqual([]);
  expect(
    generateDataTypeFields(columns, {}, [
      { kind: "number" },
      { kind: "number" },
    ])[0]?.type
  ).toBe("number");
});
it("keeps real JSON objects with draft-like property names as data", async () => {
  const value = { __yayawJsonDraft: true, text: "not source text" };
  for (const validate of validators) {
    const config = {
      id: "types",
      fields: [{ name: "value", label: "Value", type: "json" as const }],
    };
    const values = { value };
    expect(
      (
        await validate(config, values, {
          values,
          mode: "edit",
          tableId: "types",
          tableType: "types",
        })
      ).values.value
    ).toEqual(value);
  }
});
it("normalizes cleared optional number and date form fields to null", async () => {
  for (const validate of validators) {
    for (const type of ["number", "date"] as const) {
      const config = {
        id: "types",
        fields: [{ name: "value", label: "Value", type }],
      };
      const values = { value: "" };
      expect(
        (
          await validate(config, values, {
            values,
            mode: "edit",
            tableId: "types",
            tableType: "types",
          })
        ).values.value
      ).toBeNull();
    }
  }
});

it("validates required JSON against the parsed value while retaining false and zero", async () => {
  for (const validate of validators) {
    for (const value of [null, false, 0]) {
      const config = {
        id: "types",
        fields: [
          {
            name: "value",
            label: "Value",
            type: "json" as const,
            required: true,
          },
        ],
      };
      const values = { value: jsonFormDraft(JSON.stringify(value)) };
      const result = await validate(config, values, {
        values,
        mode: "edit",
        tableId: "types",
        tableType: "types",
      });
      expect(Boolean(result.errors.value)).toBe(value === null);
      expect(result.values.value).toBe(value);
    }
  }
});
