import assert from "node:assert/strict";

/**
 * Record create/edit and bulk forms with declarative rules, run against the
 * React runtime and the Vue runtime (their types differ, their behavior may
 * not).
 */
type Values = Record<string, unknown>;
interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hidden?: boolean | ((context: { values?: Values; mode: string }) => boolean);
}
interface Config {
  id: string;
  fields: Field[];
  rules?: unknown[];
}
interface Context {
  mode: "create" | "edit";
  values: Values;
  formType?: string;
  tableId?: string;
  tableType?: string;
  bulkEdit?: { ids: string[]; rows: Values[]; fields: string[] };
  formRules?: unknown;
}

export interface FormRulesRuntime {
  validateForm: (
    config: never,
    values: Values,
    context: never
  ) => Promise<{ values: Values; errors: Record<string, string> }>;
  formSubmissionValues: (
    config: never,
    values: Values,
    initial: Values,
    context: never
  ) => Values;
  fieldIsHidden: (field: never, context: never) => boolean;
  fieldIsRequired: (field: never, context: never) => boolean;
  withFormRules: (config: never, context: never) => unknown;
  bulkRuleContext: (config: never, context: never) => unknown;
  bulkFieldEditable: (field: never, context: never) => boolean;
  bulkBlockedFields: (
    fields: never,
    context: never
  ) => { field: { name: string }; mixed: string[] }[];
  bulkMixedFieldsOf: (field: never, context: never) => string[];
}

type TestFn = (name: string, fn: () => void | Promise<void>) => void;

const when = (fieldId: string, value: string) => ({
  join: "and",
  items: [{ fieldId, operator: "is", value }],
});
const effect = (action: string, target: string, value?: string) =>
  value === undefined
    ? { action, fieldIds: [target] }
    : { action, fieldIds: [target], value };
const rule = (id: string, condition: unknown, then: unknown) => ({
  id,
  when: condition,
  then,
});

const FIELDS: Field[] = [
  { name: "name", label: "Name", type: "text", required: true },
  {
    name: "category",
    label: "Category",
    type: "select",
    options: ["Hardware", "Software", "Other"].map((value) => ({
      value,
      label: value,
    })),
  },
  { name: "budget", label: "Budget", type: "number" },
  { name: "serial", label: "Serial number", type: "text" },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    hidden: ({ mode }) => mode === "edit",
  },
  { name: "status", label: "Status", type: "text" },
];

const CONFIG: Config = {
  id: "project",
  fields: FIELDS,
  rules: [
    rule("serial", when("category", "Hardware"), effect("show", "serial")),
    rule("budget", when("category", "Hardware"), effect("require", "budget")),
    rule(
      "status",
      when("category", "Other"),
      effect("set", "status", "Needs review")
    ),
    rule("broken", when("nope", "x"), effect("show", "name")),
  ],
};

const field = (name: string) =>
  FIELDS.find((item) => item.name === name) as never;
const ctx = (values: Values, mode: "create" | "edit" = "create"): Context => ({
  mode,
  values,
  formType: "project",
  tableId: "project",
  tableType: "project",
});

export function formRulesRuntimeSuite(test: TestFn, r: FormRulesRuntime) {
  const ruled = (values: Values, mode: "create" | "edit" = "create") =>
    r.withFormRules(CONFIG as never, ctx(values, mode) as never) as never;

  test("record forms show and require fields by rule", () => {
    assert.equal(r.fieldIsHidden(field("serial"), ruled({})), true);
    assert.equal(
      r.fieldIsHidden(field("serial"), ruled({ category: "Hardware" })),
      false
    );
    assert.equal(
      r.fieldIsRequired(field("budget"), ruled({ category: "Hardware" })),
      true
    );
    assert.equal(r.fieldIsRequired(field("budget"), ruled({})), false);
    assert.equal(r.fieldIsRequired(field("name"), ruled({})), true);
    // Without rules in the context, the field's own flags apply.
    assert.equal(r.fieldIsHidden(field("serial"), ctx({}) as never), false);
  });

  test("the legacy hidden predicate is converted and still sees the context", () => {
    assert.equal(r.fieldIsHidden(field("notes"), ruled({}, "edit")), true);
    assert.equal(r.fieldIsHidden(field("notes"), ruled({}, "create")), false);
  });

  test("validation follows the rules; set values and hidden fields reach the submission", async () => {
    const hardware = await r.validateForm(
      CONFIG as never,
      { name: "A", category: "Hardware", budget: null },
      ctx({}) as never
    );
    assert.deepEqual(Object.keys(hardware.errors), ["budget"]);
    const other = await r.validateForm(
      CONFIG as never,
      { name: "A", category: "Other", serial: "leftover", budget: null },
      ctx({}) as never
    );
    assert.deepEqual(other.errors, {});
    assert.equal(other.values.status, "Needs review");
    const submitted = r.formSubmissionValues(
      CONFIG as never,
      other.values,
      {},
      ctx({}) as never
    );
    assert.equal("serial" in submitted, false);
    assert.equal(submitted.status, "Needs review");
  });

  test("bulk edit: mixed values never match and are explained", () => {
    const rows = [
      { id: "1", category: "Hardware", name: "A" },
      { id: "2", category: "Software", name: "B" },
    ];
    const bulk = (fields: string[], values: Values) =>
      r.bulkRuleContext(
        CONFIG as never,
        {
          ...ctx(values, "edit"),
          bulkEdit: { ids: ["1", "2"], rows, fields },
        } as never
      ) as never;
    const mixed = bulk([], {});
    assert.equal(r.bulkFieldEditable(field("serial"), mixed), false);
    assert.deepEqual(
      r
        .bulkBlockedFields(FIELDS as never, mixed)
        .map((item) => [item.field.name, item.mixed]),
      [["serial", ["Category"]]]
    );
    assert.deepEqual(r.bulkMixedFieldsOf(field("budget"), mixed), ["Category"]);
    // The legacy predicate still runs per row (edit mode hides notes).
    assert.equal(r.bulkFieldEditable(field("notes"), mixed), false);
    const set = bulk(["category"], { category: "Hardware" });
    assert.equal(r.bulkFieldEditable(field("serial"), set), true);
    assert.deepEqual(r.bulkBlockedFields(FIELDS as never, set), []);
    assert.deepEqual(r.bulkMixedFieldsOf(field("budget"), set), []);
    const same = r.bulkRuleContext(
      CONFIG as never,
      {
        ...ctx({}, "edit"),
        bulkEdit: {
          ids: ["1", "3"],
          rows: [rows[0], { id: "3", category: "Hardware", name: "C" }],
          fields: [],
        },
      } as never
    ) as never;
    assert.equal(r.bulkFieldEditable(field("serial"), same), true);
  });
}
