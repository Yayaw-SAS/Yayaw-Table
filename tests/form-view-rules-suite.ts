import assert from "node:assert/strict";
import type * as Conditions from "../src/components/ui/yayaw-table/utils/form-conditions";
import type * as Form from "../src/components/ui/yayaw-table/utils/form-view";

type FormModule = Pick<
  typeof Form,
  | "acceptPublicFormResponse"
  | "addFormSection"
  | "buildPublicFormSnapshot"
  | "createFormRule"
  | "evaluateFormView"
  | "formDraftValues"
  | "formOperatorLabel"
  | "formRuleIssueLabel"
  | "formRuleIssues"
  | "formRuleSummary"
  | "formRulesFor"
  | "formSettingsRows"
  | "formStepOptional"
  | "formSteps"
  | "formSubmission"
  | "moveFormQuestion"
  | "normalizeFormViewConfig"
  | "publicFormSnapshot"
  | "removeFormRule"
  | "removeFormSection"
  | "resolveFormSettings"
  | "updateFormQuestion"
  | "upsertFormRule"
  | "validateFormValues"
>;
type ConditionsModule = Pick<
  typeof Conditions,
  | "CONDITION_OPERATORS"
  | "conditionAt"
  | "retargetCondition"
  | "updateConditionAt"
  | "withOperator"
>;
/** An ellipsis or a placeholder: a label that needs its sentence. */
const UNFINISHED_LABEL = /[…{}]/u;

type TestFn = (name: string, fn: () => void | Promise<void>) => void;

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

const COLUMNS = [
  { id: "name", header: "Name", type: "text" },
  {
    id: "category",
    header: "Category",
    type: "select",
    options: options(["Hardware", "Software", "Other"]),
  },
  { id: "budget", header: "Budget", type: "number" },
  { id: "serial", header: "Serial number", type: "text" },
  { id: "notes", header: "Notes", type: "textarea" },
  {
    id: "status",
    header: "Status",
    type: "select",
    options: options(["Draft", "Active"]),
  },
  { id: "due", header: "Due", type: "date" },
];

const is = (fieldId: string, value: string) => ({
  fieldId,
  operator: "is" as const,
  value,
});
const rule = (
  id: string,
  items: Conditions.ConditionItem[],
  then: Conditions.FormRuleEffect
): Conditions.FormRule => ({ id, when: { join: "and", items }, then });

const RULES = [
  rule("hardware-serial", [is("category", "Hardware")], {
    action: "show",
    questionIds: ["serial"],
  }),
  rule("hardware-budget", [is("category", "Hardware")], {
    action: "require",
    questionIds: ["budget"],
  }),
  rule("other-notes", [is("category", "Other")], {
    action: "show",
    questionIds: ["notes"],
  }),
];

const SETTINGS = {
  questions: [
    { id: "name", columnId: "name", required: true },
    { id: "category", columnId: "category", required: true },
    { id: "budget", columnId: "budget" },
    { id: "serial", columnId: "serial" },
    { id: "notes", columnId: "notes" },
  ],
  rules: RULES,
  hiddenValues: { status: "Draft" },
};

function settingsTests(test: TestFn, form: FormModule) {
  test("rules, layout, review and sections are saved settings", () => {
    const normalized = form.normalizeFormViewConfig({
      layout: "steps",
      review: true,
      rules: [...RULES, { id: "broken" }],
      questions: [
        { id: "intro", kind: "section", title: " About you ", description: "" },
        { columnId: "name" },
        { id: "intro", kind: "section" },
        { kind: "section" },
      ],
    });
    assert.equal(normalized?.layout, "steps");
    assert.equal(normalized?.review, true);
    assert.deepEqual(
      normalized?.rules?.map((item) => item.id),
      RULES.map((item) => item.id)
    );
    assert.deepEqual(normalized?.questions, [
      { id: "intro", kind: "section", title: "About you" },
      { id: "name", columnId: "name" },
    ]);
    assert.equal(
      form.normalizeFormViewConfig({ layout: "carousel" })?.layout,
      undefined
    );
  });

  test("resolved settings keep sections in order and only rules that can act", () => {
    const resolved = form.resolveFormSettings(COLUMNS, undefined, {
      ...SETTINGS,
      questions: [
        { id: "s1", kind: "section", title: "Project" },
        ...SETTINGS.questions,
      ],
      rules: [
        ...RULES,
        rule("unknown", [is("nope", "x")], {
          action: "show",
          questionIds: ["serial"],
        }),
      ],
    });
    assert.deepEqual(
      resolved.items.map((item) => {
        if (item.kind === "question") {
          return item.question.id;
        }
        return item.kind === "section"
          ? `section:${item.section.id}`
          : `consent:${item.consent.id}`;
      }),
      ["section:s1", "name", "category", "budget", "serial", "notes"]
    );
    assert.deepEqual(
      resolved.rules.map((item) => item.id),
      RULES.map((item) => item.id)
    );
    assert.equal(resolved.layout, "page");
    assert.equal(resolved.review, false);
  });

  test("sections are added, edited, moved and removed with their rules", () => {
    const added = form.addFormSection(SETTINGS.questions, "category");
    assert.equal(added.id, "section-1");
    assert.deepEqual(
      added.questions.map((item) => item.id),
      ["name", "category", "section-1", "budget", "serial", "notes"]
    );
    const titled = form.updateFormQuestion(added.questions, "section-1", {
      title: " Details ",
    });
    assert.deepEqual(titled[2], {
      id: "section-1",
      kind: "section",
      title: "Details",
    });
    const moved = form.moveFormQuestion(titled, "section-1", -1);
    assert.equal(moved[1]?.id, "section-1");
    const hideSection = rule("hide-details", [is("category", "Other")], {
      action: "hide",
      questionIds: ["section-1"],
    });
    const removed = form.removeFormSection(
      { questions: titled, rules: [...RULES, hideSection] },
      "section-1"
    );
    assert.equal(
      removed.questions?.some((item) => item.id === "section-1"),
      false
    );
    assert.deepEqual(
      removed.rules?.map((item) => item.id),
      RULES.map((item) => item.id)
    );
    const rows = form.formSettingsRows(COLUMNS, { questions: titled });
    assert.deepEqual(
      rows.map((row) => `${row.kind}:${row.index}`),
      [
        "question:0",
        "question:1",
        "section:2",
        "question:3",
        "question:4",
        "question:5",
        "question:-1",
        "question:-1",
      ]
    );
  });
}

function evaluationTests(test: TestFn, form: FormModule) {
  const resolved = form.resolveFormSettings(COLUMNS, undefined, SETTINGS);
  const answers = (draft: Record<string, string>) =>
    form.formDraftValues(resolved.questions, draft);

  test("rules show and require questions from earlier answers", () => {
    const empty = form.evaluateFormView(resolved, {});
    assert.equal(empty.visible.has("serial"), false);
    assert.equal(empty.visible.has("notes"), false);
    const values = answers({ name: "A", category: "Hardware" });
    const hardware = form.evaluateFormView(resolved, values);
    assert.equal(hardware.visible.has("serial"), true);
    assert.deepEqual(
      form.validateFormValues(resolved.questions, values, hardware),
      { budget: "errorRequired" }
    );
    // Without the evaluation, only the static required flags count.
    assert.deepEqual(form.validateFormValues(resolved.questions, values), {});
  });

  test("hidden questions are neither validated nor submitted", () => {
    const values = answers({
      name: "A",
      category: "Software",
      serial: "leftover",
      budget: "12",
    });
    const evaluation = form.evaluateFormView(resolved, values);
    assert.deepEqual(
      form.validateFormValues(
        resolved.questions,
        { ...values, notes: 42 },
        evaluation
      ),
      {}
    );
    assert.deepEqual(form.formSubmission(resolved, values), {
      status: "Draft",
      name: "A",
      category: "Software",
      budget: 12,
    });
  });

  test("set rules write their value into the submission", () => {
    const withSet = form.resolveFormSettings(COLUMNS, undefined, {
      ...SETTINGS,
      rules: [
        rule("hardware-notes", [is("category", "Hardware")], {
          action: "set",
          questionIds: ["name"],
          value: "Hardware request",
        }),
      ],
    });
    assert.deepEqual(
      form.formSubmission(withSet, { name: "A", category: "Hardware" }),
      { status: "Draft", name: "Hardware request", category: "Hardware" }
    );
  });

  test("steps skip hidden questions and group sections", () => {
    const empty = form.evaluateFormView(resolved, {});
    assert.deepEqual(
      form.formSteps(resolved, empty).map((step) => step.id),
      ["name", "category", "budget"]
    );
    const hardware = form.evaluateFormView(resolved, { category: "Hardware" });
    const steps = form.formSteps(resolved, hardware);
    assert.deepEqual(
      steps.map((step) => step.id),
      ["name", "category", "budget", "serial"]
    );
    const budget = steps.find((step) => step.id === "budget");
    assert.ok(budget);
    assert.equal(form.formStepOptional(budget, hardware), false);
    assert.equal(form.formStepOptional(budget, empty), true);

    const sectioned = form.resolveFormSettings(COLUMNS, undefined, {
      ...SETTINGS,
      layout: "steps",
      questions: [
        SETTINGS.questions[0],
        { id: "project", kind: "section", title: "Project" },
        ...SETTINGS.questions.slice(1, 3),
        { id: "extra", kind: "section", title: "Extra" },
        ...SETTINGS.questions.slice(3),
      ],
      rules: [
        ...RULES,
        rule("hide-extra", [is("category", "Software")], {
          action: "hide",
          questionIds: ["extra"],
        }),
      ],
    });
    const other = form.evaluateFormView(sectioned, { category: "Other" });
    assert.deepEqual(
      form
        .formSteps(sectioned, other)
        .map((step) => [
          step.id,
          step.questions.map((question) => question.id),
        ]),
      [
        ["start", ["name"]],
        ["project", ["category", "budget"]],
        ["extra", ["notes"]],
      ]
    );
    const software = form.evaluateFormView(sectioned, {
      category: "Software",
    });
    assert.deepEqual(
      form.formSteps(sectioned, software).map((step) => step.id),
      ["start", "project"]
    );
  });
}

function publicTests(test: TestFn, form: FormModule) {
  const view = {
    id: "request",
    config: {
      displayMode: "form",
      form: {
        ...SETTINGS,
        layout: "steps",
        rules: [
          ...RULES,
          rule("broken", [{ fieldId: "", operator: "is" }], {
            action: "show",
            questionIds: ["name"],
          }),
        ],
      },
    },
  };

  test("public snapshots carry the rules that can act and the layout", () => {
    const snapshot = form.publicFormSnapshot(view, COLUMNS);
    assert.equal(snapshot.form.layout, "steps");
    assert.deepEqual(
      snapshot.form.rules?.map((item) => item.id),
      RULES.map((item) => item.id)
    );
    assert.deepEqual(snapshot.hiddenValues, { status: "Draft" });
  });

  test("the server applies the rules: required if visible, hidden answers ignored", () => {
    const snapshot = form.publicFormSnapshot(view, COLUMNS);
    assert.deepEqual(
      form.acceptPublicFormResponse(snapshot, {
        name: "A",
        category: "Hardware",
      }),
      { ok: false, errors: { budget: "errorRequired" } }
    );
    assert.deepEqual(
      form.acceptPublicFormResponse(snapshot, {
        name: "A",
        category: "Software",
        serial: "sneaky",
        notes: "hidden",
        status: "Active",
      }),
      {
        ok: true,
        values: { name: "A", category: "Software", status: "Draft" },
        metadata: { consents: [], context: {} },
      }
    );
    assert.deepEqual(
      form.acceptPublicFormResponse(snapshot, {
        name: "A",
        category: "Hardware",
        budget: 1500,
        serial: "SN-1",
      }),
      {
        ok: true,
        values: {
          name: "A",
          category: "Hardware",
          budget: 1500,
          serial: "SN-1",
          status: "Draft",
        },
        metadata: { consents: [], context: {} },
      }
    );
  });

  test("hosts build the snapshot server-side; tampered settings cannot widen it", () => {
    const tampered = {
      id: "request",
      config: {
        form: {
          questions: [
            { id: "name", columnId: "name" },
            { id: "salary", columnId: "salary" },
          ],
          hiddenValues: {
            status: "Approved",
            due: "not a date",
            owner: "attacker",
            category: "Hardware",
          },
        },
      },
    };
    const snapshot = form.buildPublicFormSnapshot({
      view: tampered,
      columns: COLUMNS,
      allowedColumnIds: ["name", "status", "due", "budget"],
    });
    assert.deepEqual(
      snapshot.columns.map((column) => column.id),
      ["name"]
    );
    // Unknown columns, columns not allowed and values that do not fit are dropped.
    assert.deepEqual(snapshot.hiddenValues, {});
    const fitting = form.buildPublicFormSnapshot({
      view: {
        id: "request",
        config: { form: { ...SETTINGS, hiddenValues: { status: "Draft" } } },
      },
      columns: COLUMNS,
    });
    assert.deepEqual(fitting.hiddenValues, { status: "Draft" });
    assert.deepEqual(
      fitting.form.rules?.map((item) => item.id),
      RULES.map((item) => item.id)
    );
  });
}

function editorTests(test: TestFn, form: FormModule, cond: ConditionsModule) {
  test("rules are created, found, replaced and removed per question", () => {
    const created = form.createFormRule(RULES, "serial");
    assert.equal(created.id, "serial-rule-1");
    assert.deepEqual(created.then, { action: "show", questionIds: ["serial"] });
    const rules = form.upsertFormRule(RULES, created);
    assert.deepEqual(
      form.formRulesFor(rules, "serial").map((item) => item.id),
      ["hardware-serial", "serial-rule-1"]
    );
    const then: Conditions.FormRuleEffect = {
      action: "require",
      questionIds: ["serial"],
    };
    const replaced = form.upsertFormRule(rules, { ...created, then });
    assert.equal(replaced.length, rules.length);
    assert.equal(replaced.at(-1)?.then.action, "require");
    assert.equal(
      form.removeFormRule(replaced, created.id).length,
      RULES.length
    );
  });

  test("conditions are edited in place, retargeted and re-operated", () => {
    const group: Conditions.ConditionGroup = {
      join: "and",
      items: [
        is("category", "Hardware"),
        { join: "or", items: [is("name", "x"), is("name", "y")] },
      ],
    };
    const removed = cond.updateConditionAt(group, [1, 0], () => undefined);
    assert.deepEqual(cond.conditionAt(removed, [1]), {
      join: "or",
      items: [is("name", "y")],
    });
    const budget = { id: "budget", type: "number" as const };
    assert.deepEqual(cond.retargetCondition(is("name", "x"), budget), {
      fieldId: "budget",
      operator: "eq",
    });
    assert.deepEqual(
      cond.withOperator({ fieldId: "budget", operator: "gt", value: 3 }, "lt"),
      { fieldId: "budget", operator: "lt", value: 3 }
    );
    assert.deepEqual(
      cond.withOperator(
        { fieldId: "budget", operator: "gt", value: 3 },
        "between"
      ),
      { fieldId: "budget", operator: "between" }
    );
  });

  test("summaries and operator labels read in English and French", () => {
    const resolved = form.resolveFormSettings(COLUMNS, undefined, SETTINGS);
    const both = rule(
      "both",
      [
        is("category", "Hardware"),
        { fieldId: "budget", operator: "gt", value: 1000 },
      ],
      { action: "show", questionIds: ["serial"] }
    );
    assert.equal(
      form.formRuleSummary(both, resolved.questions, "en"),
      "Shown when Category is Hardware and Budget > 1000"
    );
    assert.equal(
      form.formRuleSummary(both, resolved.questions, "fr"),
      "Affichée si Category est Hardware et Budget > 1000"
    );
    assert.equal(form.formOperatorLabel("inLast", "en"), "in the last");
    assert.equal(form.formOperatorLabel("gt", "en"), ">");
    assert.equal(form.formOperatorLabel("isNot", "en"), "is not");
    assert.equal(form.formOperatorLabel("before", "en"), "before");
    assert.equal(form.formOperatorLabel("isEmpty", "fr"), "est vide");
    assert.equal(
      form.formOperatorLabel("between", "en", (key, fallback) =>
        key === "cmpBetween" ? "from … to" : fallback
      ),
      "from … to"
    );
    assert.equal(
      form.formRuleSummary(both, resolved.questions, "en", (key, fallback) =>
        key === "thenShow" ? "Visible if {condition}" : fallback
      ),
      "Visible if Category is Hardware and Budget > 1000"
    );
  });

  test("every comparison has a short, complete label in both languages", () => {
    for (const operators of Object.values(cond.CONDITION_OPERATORS)) {
      for (const operator of operators) {
        for (const locale of ["en", "fr"]) {
          const text = form.formOperatorLabel(operator, locale);
          assert.ok(
            text.length > 0 && text.length <= 20,
            `${operator} ${text}`
          );
          assert.doesNotMatch(text, UNFINISHED_LABEL, `${operator} ${locale}`);
        }
      }
    }
  });

  test("the editor reports rule problems with their labels", () => {
    const issues = form.formRuleIssues(COLUMNS, {
      ...SETTINGS,
      layout: "steps",
      rules: [
        rule("empty-value", [{ fieldId: "budget", operator: "gt" }], {
          action: "show",
          questionIds: ["serial"],
        }),
        rule("later", [is("category", "Hardware")], {
          action: "require",
          questionIds: ["name"],
        }),
      ],
    });
    assert.deepEqual(
      issues.map((issue) => [issue.ruleId, issue.code]),
      [
        ["empty-value", "missingValue"],
        ["later", "laterQuestion"],
      ]
    );
    assert.equal(form.formRuleIssueLabel("missingValue"), "issueMissingValue");
  });
}

/** Rules, sections, steps and public snapshots of the Form view, in both editions. */
export function formViewRulesSuite(
  test: TestFn,
  form: FormModule,
  cond: ConditionsModule
) {
  settingsTests(test, form);
  evaluationTests(test, form);
  publicTests(test, form);
  editorTests(test, form, cond);
}
