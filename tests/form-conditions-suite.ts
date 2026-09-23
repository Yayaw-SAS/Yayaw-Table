import assert from "node:assert/strict";
import type * as Conditions from "../src/components/ui/yayaw-table/utils/form-conditions";

type ConditionsModule = Pick<
  typeof Conditions,
  | "applyFormEvaluation"
  | "conditionFieldType"
  | "describeRule"
  | "detectRuleCycles"
  | "evaluateForm"
  | "matchCondition"
  | "normalizeRules"
  | "predicateRule"
  | "rulesReading"
  | "sanitizeRules"
  | "validateRules"
>;
type TestFn = (name: string, fn: () => void | Promise<void>) => void;
type Rule = Conditions.FormRule;
type Field = Conditions.ConditionField;

const NOW = new Date(2026, 8, 23);
const FIELDS: Field[] = [
  { id: "name", type: "text", label: "Name" },
  {
    id: "category",
    type: "select",
    label: "Category",
    options: [
      { value: "Hardware", label: "Hardware" },
      { value: "Software", label: "Software" },
      { value: "Other", label: "Other" },
    ],
  },
  { id: "budget", type: "number", label: "Budget" },
  { id: "due", type: "date", label: "Due" },
  { id: "tags", type: "multiSelect", label: "Tags" },
  { id: "urgent", type: "checkbox", label: "Urgent" },
  { id: "serial", type: "text", label: "Serial number" },
  { id: "more", type: "text", label: "Tell us more" },
];

const rule = (
  id: string,
  items: Conditions.ConditionItem[],
  then: Conditions.FormRuleEffect,
  join: "and" | "or" = "and"
): Rule => ({ id, when: { join, items }, then });

const is = (fieldId: string, value: Conditions.ConditionValue) => ({
  fieldId,
  operator: "is" as const,
  value,
});

const WORDS: Record<string, string> = {
  and: "and",
  or: "or",
  custom: "a custom condition",
  "op.is": "{field} is {value}",
  "op.gt": "{field} > {value}",
  "op.between": "{field} is between {from} and {to}",
  "then.show": "Shown when {condition}",
  "then.require": "Required when {condition}",
};
const words = (key: string, params: Record<string, number | string> = {}) =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    WORDS[key] ?? key
  );

function operatorTests(test: TestFn, m: ConditionsModule) {
  const match = (
    type: Conditions.ConditionFieldType,
    operator: Conditions.ConditionOperator,
    actual: unknown,
    value?: Conditions.ConditionValue
  ) => m.matchCondition(type, { operator, value }, actual, NOW);

  test("text operators compare trimmed, case-insensitive answers", () => {
    assert.equal(match("text", "is", " Hello ", "hello"), true);
    assert.equal(match("text", "isNot", "Hello", "hello"), false);
    assert.equal(match("text", "contains", "Serial 42", "42"), true);
    assert.equal(match("text", "notContains", "Serial 42", "43"), true);
    assert.equal(match("text", "startsWith", "Serial 42", "ser"), true);
    assert.equal(match("text", "startsWith", "Serial", ""), false);
    assert.equal(match("text", "isEmpty", "  "), true);
    assert.equal(match("text", "isNotEmpty", "x"), true);
  });

  test("number operators coerce typed answers", () => {
    assert.equal(match("number", "eq", "1500", 1500), true);
    assert.equal(match("number", "neq", 10, 11), true);
    assert.equal(match("number", "neq", "", 11), true);
    assert.equal(match("number", "lt", "999,5", 1000), true);
    assert.equal(match("number", "lte", 1000, 1000), true);
    assert.equal(match("number", "gt", 1001, 1000), true);
    assert.equal(match("number", "gte", 999, 1000), false);
    assert.equal(match("number", "gt", "abc", 1), false);
    assert.equal(match("number", "between", 5, [1, 10]), true);
    assert.equal(match("number", "between", 11, [1, 10]), false);
    assert.equal(match("number", "between", 11, [1, null]), true);
    assert.equal(match("number", "isEmpty", null), true);
  });

  test("date operators compare days, including relative ranges", () => {
    assert.equal(match("date", "on", "2026-09-23", "2026-09-23"), true);
    assert.equal(
      match("date", "on", "2026-09-23T10:00:00Z", "2026-09-23"),
      true
    );
    assert.equal(match("date", "before", "2026-09-01", "2026-09-23"), true);
    assert.equal(match("date", "after", "2026-09-01", "2026-09-23"), false);
    assert.equal(
      match("date", "between", "2026-09-10", ["2026-09-01", "2026-09-30"]),
      true
    );
    assert.equal(match("date", "inLast", "2026-09-20", 7), true);
    assert.equal(match("date", "inLast", "2026-09-10", 7), false);
    assert.equal(match("date", "inNext", "2026-09-30", 7), true);
    assert.equal(match("date", "inNext", new Date(2026, 8, 25), 7), true);
    assert.equal(match("date", "before", "not a date", "2026-09-23"), false);
    assert.equal(match("date", "isNotEmpty", "2026-09-23"), true);
  });

  test("select operators compare option values as text", () => {
    assert.equal(match("select", "is", "Hardware", "Hardware"), true);
    assert.equal(match("select", "is", "", "Hardware"), false);
    assert.equal(match("select", "isNot", "", "Hardware"), true);
    assert.equal(match("select", "is", 2, "2"), true);
    assert.equal(
      match("select", "isAnyOf", "Other", ["Other", "Software"]),
      true
    );
    assert.equal(match("select", "isNoneOf", "Other", ["Software"]), true);
    assert.equal(match("select", "isNoneOf", undefined, ["Software"]), true);
  });

  test("multi-select operators test any, all and none", () => {
    assert.equal(
      match("multiSelect", "containsAny", ["a", "b"], ["b", "c"]),
      true
    );
    assert.equal(
      match("multiSelect", "containsAll", ["a", "b"], ["a", "b"]),
      true
    );
    assert.equal(match("multiSelect", "containsAll", ["a"], ["a", "b"]), false);
    assert.equal(match("multiSelect", "containsNone", ["a"], ["b"]), true);
    assert.equal(match("multiSelect", "isEmpty", []), true);
  });

  test("checkbox operators read true and 'true'", () => {
    assert.equal(match("checkbox", "isChecked", true), true);
    assert.equal(match("checkbox", "isChecked", "true"), true);
    assert.equal(match("checkbox", "isUnchecked", undefined), true);
  });

  test("column and field types map to condition types", () => {
    assert.equal(m.conditionFieldType("switch"), "checkbox");
    assert.equal(m.conditionFieldType("radio"), "select");
    assert.equal(m.conditionFieldType("multiSelect"), "multiSelect");
    assert.equal(m.conditionFieldType("textarea"), "text");
    assert.equal(m.conditionFieldType(undefined), "text");
  });
}

function evaluationTests(test: TestFn, m: ConditionsModule) {
  const rules: Rule[] = [
    rule("hardware", [is("category", "Hardware")], {
      action: "show",
      questionIds: ["serial"],
    }),
    rule("budget", [is("category", "Hardware")], {
      action: "require",
      questionIds: ["budget"],
    }),
    rule("other", [is("category", "Other")], {
      action: "show",
      questionIds: ["more"],
    }),
  ];

  test("show rules hide their target until a rule matches", () => {
    const empty = m.evaluateForm(rules, {}, FIELDS, { now: NOW });
    assert.equal(empty.visible.has("serial"), false);
    assert.equal(empty.visible.has("name"), true);
    assert.equal(empty.required.has("budget"), false);
    const hardware = m.evaluateForm(rules, { category: "Hardware" }, FIELDS);
    assert.equal(hardware.visible.has("serial"), true);
    assert.equal(hardware.visible.has("more"), false);
    assert.equal(hardware.required.has("budget"), true);
  });

  test("AND, OR and nested groups", () => {
    const nested = rule(
      "nested",
      [
        is("category", "Hardware"),
        {
          join: "or",
          items: [
            { fieldId: "budget", operator: "gt", value: 1000 },
            { fieldId: "urgent", operator: "isChecked" },
          ],
        },
      ],
      { action: "hide", questionIds: ["more"] }
    );
    const evaluate = (values: Record<string, unknown>) =>
      m.evaluateForm([nested], values, FIELDS).hidden.has("more");
    assert.equal(evaluate({ category: "Hardware", budget: 1500 }), true);
    assert.equal(evaluate({ category: "Hardware", urgent: true }), true);
    assert.equal(evaluate({ category: "Hardware", budget: 10 }), false);
    assert.equal(evaluate({ category: "Software", budget: 1500 }), false);
    const any = rule(
      "any",
      [is("category", "Other"), is("category", "Software")],
      { action: "hide", questionIds: ["serial"] },
      "or"
    );
    assert.equal(
      m
        .evaluateForm([any], { category: "Software" }, FIELDS)
        .hidden.has("serial"),
      true
    );
    const empty = rule("empty", [], { action: "hide", questionIds: ["name"] });
    assert.equal(m.evaluateForm([empty], {}, FIELDS).hidden.has("name"), false);
  });

  test("hidden answers do not satisfy other conditions (chains settle)", () => {
    const chain = [
      ...rules,
      rule("serial-more", [{ fieldId: "serial", operator: "isNotEmpty" }], {
        action: "show",
        questionIds: ["name"],
      }),
    ];
    const shown = m.evaluateForm(
      chain,
      { category: "Hardware", serial: "S1" },
      FIELDS
    );
    assert.equal(shown.visible.has("name"), true);
    const hidden = m.evaluateForm(
      chain,
      { category: "Other", serial: "S1" },
      FIELDS
    );
    assert.equal(hidden.visible.has("serial"), false);
    assert.equal(hidden.visible.has("name"), false);
  });

  test("hide wins over show; groups hide their children", () => {
    const both = [
      rule("show", [is("category", "Hardware")], {
        action: "show",
        questionIds: ["serial"],
      }),
      rule("hide", [{ fieldId: "urgent", operator: "isChecked" }], {
        action: "hide",
        questionIds: ["section"],
      }),
    ];
    const result = m.evaluateForm(
      both,
      { category: "Hardware", urgent: true },
      FIELDS,
      { groups: { section: ["serial", "more"] } }
    );
    assert.equal(result.hidden.has("section"), true);
    assert.equal(result.hidden.has("serial"), true);
    assert.equal(result.hidden.has("more"), true);
  });

  test("set rules write values that other rules read", () => {
    const set = [
      rule("set", [{ fieldId: "urgent", operator: "isChecked" }], {
        action: "set",
        fieldIds: ["category"],
        value: "Hardware",
      }),
      ...rules,
    ];
    const result = m.evaluateForm(set, { urgent: true }, FIELDS);
    assert.deepEqual(result.setValues, { category: "Hardware" });
    assert.equal(result.visible.has("serial"), true);
    assert.equal(result.matched.has("set"), true);
  });

  test("mixed values never match (bulk edit)", () => {
    const result = m.evaluateForm(rules, { category: "Hardware" }, FIELDS, {
      mixed: ["category"],
    });
    assert.equal(result.visible.has("serial"), false);
    assert.equal(result.required.has("budget"), false);
    assert.deepEqual(m.rulesReading(rules, "serial", ["category", "name"]), [
      "category",
    ]);
  });

  test("hidden values are removed and set values applied on submit", () => {
    const evaluation = m.evaluateForm(
      rules,
      { category: "Software", serial: "leftover", name: "A" },
      FIELDS
    );
    assert.deepEqual(
      m.applyFormEvaluation(
        { category: "Software", serial: "leftover", name: "A" },
        evaluation
      ),
      { category: "Software", name: "A" }
    );
  });

  test("custom predicates (legacy hidden) take part in evaluation", () => {
    const legacy = m.predicateRule(
      "legacy",
      "more",
      (values, context) =>
        values.urgent !== true && (context as { mode: string }).mode === "edit"
    );
    const hidden = m.evaluateForm([legacy], { urgent: false }, FIELDS, {
      context: { mode: "edit" },
    });
    assert.equal(hidden.hidden.has("more"), true);
    const shown = m.evaluateForm([legacy], { urgent: false }, FIELDS, {
      context: { mode: "create" },
    });
    assert.equal(shown.hidden.has("more"), false);
    assert.equal(m.detectRuleCycles([legacy]).length, 0);
  });

  test("the static required flag counts only while visible", () => {
    const fields = FIELDS.map((field) =>
      field.id === "serial" ? { ...field, required: true } : field
    );
    assert.equal(
      m.evaluateForm(rules, {}, fields).required.has("serial"),
      false
    );
    assert.equal(
      m
        .evaluateForm(rules, { category: "Hardware" }, fields)
        .required.has("serial"),
      true
    );
  });
}

function validationTests(test: TestFn, m: ConditionsModule) {
  test("cycles are detected and the closing rule is dropped", () => {
    const loop = [
      rule("a", [is("category", "Hardware")], {
        action: "show",
        questionIds: ["serial"],
      }),
      rule("b", [{ fieldId: "serial", operator: "isNotEmpty" }], {
        action: "hide",
        questionIds: ["category"],
      }),
      rule("self", [is("more", "x")], {
        action: "hide",
        questionIds: ["more"],
      }),
    ];
    assert.deepEqual(m.detectRuleCycles(loop), ["b", "self"]);
    const normalized = m.normalizeRules(loop, FIELDS);
    assert.deepEqual(
      normalized.rules.map((item) => item.id),
      ["a"]
    );
    assert.deepEqual(
      normalized.dropped.map((item) => [item.id, item.reason]),
      [
        ["self", "selfReference"],
        ["b", "cycle"],
      ]
    );
    // The loop is bounded even when cyclic rules reach the evaluator.
    const result = m.evaluateForm(
      loop,
      { category: "Hardware", serial: "1" },
      FIELDS
    );
    assert.ok(result.visible instanceof Set);
  });

  test("validation reports unknown fields, operator/type mismatches and values", () => {
    const issues = m.validateRules(
      [
        rule("unknown", [is("nope", "x")], {
          action: "show",
          questionIds: ["serial"],
        }),
        rule(
          "operator",
          [{ fieldId: "budget", operator: "contains", value: "1" }],
          { action: "show", questionIds: ["serial"] }
        ),
        rule("value", [{ fieldId: "budget", operator: "gt" }], {
          action: "show",
          questionIds: ["serial"],
        }),
        rule("option", [is("category", "Nope")], {
          action: "show",
          questionIds: ["serial"],
        }),
        rule("missing", [{ fieldId: "", operator: "is" }], {
          action: "show",
          questionIds: ["serial"],
        }),
        rule("empty", [], { action: "show", questionIds: ["serial"] }),
        rule("target", [is("category", "Other")], {
          action: "show",
          questionIds: ["zzz"],
        }),
        rule("none", [is("category", "Other")], { action: "show" }),
      ],
      FIELDS
    );
    assert.deepEqual(
      issues.map((issue) => [issue.ruleId, issue.code]),
      [
        ["unknown", "unknownField"],
        ["operator", "operator"],
        ["value", "missingValue"],
        ["option", "unknownOption"],
        ["missing", "missingField"],
        ["empty", "emptyGroup"],
        ["target", "unknownTarget"],
        ["none", "noTargets"],
      ]
    );
    assert.deepEqual(issues[0]?.path, [0]);
  });

  test("steps: require and set may not read a later question; show/hide may", () => {
    const order = ["name", "serial", "category"];
    const later = [
      rule("req", [is("category", "Hardware")], {
        action: "require",
        questionIds: ["serial"],
      }),
      rule("show", [is("category", "Hardware")], {
        action: "show",
        questionIds: ["serial"],
      }),
    ];
    const steps = m.validateRules(later, FIELDS, { layout: "steps", order });
    assert.deepEqual(
      steps.map((issue) => [issue.ruleId, issue.code, issue.fieldId]),
      [["req", "laterQuestion", "category"]]
    );
    assert.deepEqual(
      m.validateRules(later, FIELDS, { layout: "page", order }),
      []
    );
  });

  test("sanitize keeps unfinished rules; normalize drops broken ones with reasons", () => {
    const raw = (id: string | undefined, when: unknown, then: unknown) =>
      id === undefined ? { when, then } : { id, when, then };
    const input = [
      raw(
        "draft",
        { join: "and", items: [{ fieldId: "", operator: "is" }] },
        { action: "show", questionIds: ["serial"] }
      ),
      raw(
        undefined,
        { join: "or", items: [is("category", "Other")] },
        { action: "show", questionIds: ["more"] }
      ),
      raw("bad-action", { join: "and", items: [] }, { action: "explode" }),
      "nope",
      raw(
        "draft",
        { join: "and", items: [is("category", "Other")] },
        { action: "hide", questionIds: ["serial"], value: () => 1 }
      ),
    ];
    const sanitized = m.sanitizeRules(input);
    assert.deepEqual(
      sanitized.map((item) => item.id),
      ["draft", "rule-2", "draft-5"]
    );
    assert.equal(sanitized[1]?.when.join, "or");
    assert.equal("value" in (sanitized[2]?.then ?? {}), false);
    const normalized = m.normalizeRules(input, FIELDS);
    assert.deepEqual(
      normalized.rules.map((item) => item.id),
      ["rule-2", "draft-5"]
    );
    assert.deepEqual(
      normalized.dropped.map((item) => [item.id, item.reason]),
      [
        ["bad-action", "invalid"],
        ["rule-4", "invalid"],
        ["draft", "missingField"],
      ]
    );
    assert.deepEqual(m.normalizeRules("nope", FIELDS), {
      rules: [],
      dropped: [],
    });
  });

  test("summaries read like a sentence", () => {
    const summary = m.describeRule(
      rule(
        "sum",
        [
          is("category", "Hardware"),
          { fieldId: "budget", operator: "gt", value: 1000 },
        ],
        { action: "show", questionIds: ["serial"] }
      ),
      FIELDS,
      words
    );
    assert.equal(summary, "Shown when Category is Hardware and Budget > 1000");
    const nested = m.describeRule(
      rule(
        "nested",
        [
          is("category", "Hardware"),
          {
            join: "or",
            items: [
              { fieldId: "budget", operator: "between", value: [1, 2] },
              is("category", "Other"),
            ],
          },
        ],
        { action: "require", questionIds: ["budget"] }
      ),
      FIELDS,
      words
    );
    assert.equal(
      nested,
      "Required when Category is Hardware and (Budget is between 1 and 2 or Category is Other)"
    );
  });
}

/** The same engine cases run against the React source and the synced Vue copy. */
export function formConditionsSuite(test: TestFn, m: ConditionsModule) {
  operatorTests(test, m);
  evaluationTests(test, m);
  validationTests(test, m);
}
