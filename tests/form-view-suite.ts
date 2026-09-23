import assert from "node:assert/strict";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";
import type * as Form from "../src/components/ui/yayaw-table/utils/form-view";

const STATUS_OPTIONS = [
  { value: "New", label: "New" },
  { value: "Done", label: "Done" },
];
const COLUMNS = [
  { id: "select", header: "", type: "text" },
  { id: "name", header: "Name", type: "text" },
  { id: "status", header: "Status", type: "select", options: STATUS_OPTIONS },
  { id: "price", header: "Price", type: "number" },
  { id: "due", header: "Due", type: "date" },
  { id: "site", header: "Site", type: "url" },
  { id: "tags", header: "Tags", type: "multiSelect", options: ["a", "b"] },
  { id: "urgent", header: "Urgent", type: "boolean" },
  { id: "meta", header: "Meta", type: "json" },
  { id: "total", header: "Total", type: "number", accessorFn: () => 1 },
  { id: "actions", header: "", type: "actions" },
];

type FormModule = Pick<
  typeof Form,
  | "acceptPublicFormResponse"
  | "formColumns"
  | "formDateAnswer"
  | "formDateDisplay"
  | "formDraftValues"
  | "formLabel"
  | "formNumberDisplay"
  | "formSettingsFromView"
  | "formSubmission"
  | "formSubmitResultFrom"
  | "formTranslateFrom"
  | "initialFormDraft"
  | "isFormModeEnabled"
  | "moveFormQuestion"
  | "normalizeFormViewConfig"
  | "publicFormSnapshot"
  | "resolveFormSettings"
  | "toggleFormQuestion"
  | "updateFormQuestion"
  | "validateFormValues"
  | "formWeekStart"
>;

export function formViewSuite(
  test: (name: string, run: () => void) => void,
  form: FormModule,
  modes: Pick<
    typeof Modes,
    "normalizeModeConfig" | "pickGenericModeSettings" | "resolveDisplayModes"
  >
) {
  test("keeps only valid form settings", () => {
    assert.deepEqual(
      form.normalizeFormViewConfig({
        title: "  Request ",
        description: "",
        questions: [
          { columnId: "name", required: true, label: " Your name " },
          { columnId: "name", label: "Duplicate" },
          { id: "q-price", columnId: "price", help: "In euros" },
          { label: "No column" },
          "status",
        ],
        hiddenValues: { status: "New", empty: "", nested: { a: 1 } },
        allowAnotherResponse: "yes",
        redirectUrl: "javascript:alert(1)",
        unknown: true,
      }),
      {
        title: "Request",
        questions: [
          { id: "name", columnId: "name", label: "Your name", required: true },
          { id: "q-price", columnId: "price", help: "In euros" },
        ],
        hiddenValues: { status: "New" },
      }
    );
    assert.equal(form.normalizeFormViewConfig({ title: " " }), undefined);
    assert.equal(form.normalizeFormViewConfig("form"), undefined);
    assert.deepEqual(
      form.normalizeFormViewConfig({ redirectUrl: "/thanks", questions: [] }),
      { questions: [], redirectUrl: "/thanks" }
    );
    assert.deepEqual(
      modes.normalizeModeConfig("form", { submitLabel: "Send" }),
      { submitLabel: "Send" }
    );
  });

  test("offers editable columns and lists the others", () => {
    const { eligible, excluded } = form.formColumns(COLUMNS);
    assert.deepEqual(
      eligible.map((column) => column.id),
      ["name", "status", "price", "due", "site", "tags", "urgent"]
    );
    assert.deepEqual(
      excluded.map((column) => column.id),
      ["meta", "total"]
    );
  });

  test("asks every editable column by default, in column order", () => {
    const settings = form.resolveFormSettings(COLUMNS, undefined, undefined);
    assert.deepEqual(
      settings.questions.map((question) => [question.id, question.editor]),
      [
        ["name", "text"],
        ["status", "select"],
        ["price", "number"],
        ["due", "date"],
        ["site", "url"],
        ["tags", "multiSelect"],
        ["urgent", "boolean"],
      ]
    );
    assert.equal(settings.allowAnotherResponse, true);
    assert.deepEqual(settings.questions[1]?.options, STATUS_OPTIONS);
  });

  test("the view's questions, order and texts win over table defaults", () => {
    const settings = form.resolveFormSettings(
      COLUMNS,
      { title: "Table form", submitLabel: "Send" },
      {
        title: "Request",
        questions: [
          { id: "price", columnId: "price", required: true },
          { id: "name", columnId: "name", label: "Who?", help: "Full name" },
          { id: "meta", columnId: "meta" },
        ],
        hiddenValues: { status: "New", name: "ignored while asked" },
      }
    );
    assert.equal(settings.title, "Request");
    assert.equal(settings.submitLabel, "Send");
    assert.deepEqual(
      settings.questions.map(({ columnId, label, required, help }) => ({
        columnId,
        label,
        required,
        help,
      })),
      [
        { columnId: "price", label: "Price", required: true, help: undefined },
        { columnId: "name", label: "Who?", required: false, help: "Full name" },
      ]
    );
    assert.deepEqual(settings.hiddenValues, { status: "New" });
  });

  test("questions move, toggle and change without losing their ids", () => {
    const questions = [
      { id: "a", columnId: "name" },
      { id: "b", columnId: "price" },
      { id: "c", columnId: "due" },
    ];
    assert.deepEqual(
      form.moveFormQuestion(questions, "c", -1).map((question) => question.id),
      ["a", "c", "b"]
    );
    assert.deepEqual(
      form.moveFormQuestion(questions, "a", -1).map((question) => question.id),
      ["a", "b", "c"]
    );
    assert.deepEqual(
      form.toggleFormQuestion(questions, "price", false).map((q) => q.id),
      ["a", "c"]
    );
    assert.deepEqual(form.toggleFormQuestion(questions, "site", true).at(-1), {
      id: "site",
      columnId: "site",
    });
    assert.deepEqual(
      form.updateFormQuestion(questions, "b", {
        required: true,
        help: "Euros",
        label: " ",
      })[1],
      { id: "b", columnId: "price", required: true, help: "Euros" }
    );
  });

  test("validates required answers and types", () => {
    const { questions } = form.resolveFormSettings(COLUMNS, undefined, {
      questions: [
        { columnId: "name", required: true },
        { columnId: "status" },
        { columnId: "price" },
        { columnId: "due" },
        { columnId: "site" },
        { columnId: "tags" },
        { columnId: "urgent", required: true },
      ],
    });
    const draft = {
      ...form.initialFormDraft(questions),
      status: "Unknown",
      price: "12,5",
      due: "2026-02-30",
      site: "example.com",
    };
    const values = form.formDraftValues(questions, draft);
    assert.deepEqual(values, {
      status: "Unknown",
      price: 12.5,
      due: "2026-02-30",
      site: "example.com",
      urgent: false,
    });
    assert.deepEqual(form.validateFormValues(questions, values), {
      name: "errorRequired",
      status: "errorOption",
      due: "errorDate",
      site: "errorUrl",
      urgent: "errorRequired",
    });
    const valid = form.formDraftValues(questions, {
      name: " Ada ",
      status: "Done",
      price: "",
      due: "2026-02-28",
      site: "https://example.com",
      tags: ["b"],
      urgent: true,
    });
    assert.deepEqual(valid, {
      name: "Ada",
      status: "Done",
      due: "2026-02-28",
      site: "https://example.com",
      tags: ["b"],
      urgent: true,
    });
    assert.deepEqual(form.validateFormValues(questions, valid), {});
    assert.deepEqual(
      form.validateFormValues(questions, { ...valid, price: "abc" }),
      { price: "errorNumber" }
    );
  });

  test("a response carries the fixed values of columns it does not ask", () => {
    const settings = form.resolveFormSettings(COLUMNS, undefined, {
      questions: [{ columnId: "name" }],
      hiddenValues: { status: "New" },
    });
    assert.deepEqual(form.formSubmission(settings, { name: "Ada" }), {
      status: "New",
      name: "Ada",
    });
  });

  test("labels are English or French and hosts can override them", () => {
    assert.equal(form.formLabel("submit", "en-US"), "Submit");
    assert.equal(form.formLabel("submit", "fr-FR"), "Envoyer");
    assert.equal(
      form.formLabel("errorSummary", "en", undefined, { count: 2 }),
      "2 answers need attention."
    );
    assert.equal(
      form.formLabel("errorSummary", "fr", undefined, { count: 1 }),
      "1 réponse est à corriger."
    );
    const translate = form.formTranslateFrom({ "form.submit": "Send" });
    assert.equal(form.formLabel("submit", "en", translate), "Send");
    assert.equal(
      form.formLabel("submit", "en", form.formTranslateFrom({ submit: "Go" })),
      "Go"
    );
    assert.equal(
      form.formLabel("moveUp", "en", undefined, { label: "Name" }),
      "Move Name up"
    );
  });

  test("saved views give their form settings", () => {
    assert.deepEqual(
      form.formSettingsFromView(
        {
          id: "request",
          config: { displayMode: "form", form: { title: "Request" } },
        },
        { submitLabel: "Send" }
      ),
      { allowAnotherResponse: true, submitLabel: "Send", title: "Request" }
    );
    assert.deepEqual(form.formSettingsFromView(null), {
      allowAnotherResponse: true,
    });
  });

  test("public snapshots keep only what the public form needs", () => {
    const snapshot = form.publicFormSnapshot(
      {
        id: "request",
        config: {
          displayMode: "form",
          columnFilters: [{ id: "status", value: ["Done"] }],
          form: {
            title: "Request",
            questions: [
              { columnId: "name", required: true, label: "Your name" },
              { columnId: "status" },
            ],
            hiddenValues: { urgent: true },
          },
        },
      },
      COLUMNS
    );
    assert.deepEqual(snapshot, {
      version: 1,
      viewId: "request",
      form: {
        title: "Request",
        allowAnotherResponse: true,
        questions: [
          { id: "name", columnId: "name", label: "Your name", required: true },
          { id: "status", columnId: "status" },
        ],
      },
      columns: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "status",
          header: "Status",
          type: "select",
          options: STATUS_OPTIONS,
        },
      ],
      hiddenValues: { urgent: true },
    });
  });

  test("public snapshots keep how the table shows tags and numbers", () => {
    const full = form.publicFormSnapshot(
      {
        questions: [
          { id: "status", columnId: "status" },
          { id: "price", columnId: "price" },
        ],
      },
      [
        {
          id: "status",
          header: "Status",
          type: "select",
          options: STATUS_OPTIONS,
          displayVariant: "tag",
          coloredTags: false,
        },
        {
          id: "price",
          header: "Price",
          type: "number",
          numberFormat: { currency: "EUR" },
          accessorKey: "price",
        },
      ]
    );
    assert.deepEqual(full.columns, [
      {
        id: "status",
        header: "Status",
        type: "select",
        options: STATUS_OPTIONS,
        displayVariant: "tag",
        coloredTags: false,
      },
      {
        id: "price",
        header: "Price",
        type: "number",
        numberFormat: { currency: "EUR" },
      },
    ]);
    const [status, price] = form.resolveFormSettings(
      full.columns,
      undefined,
      full.form
    ).questions;
    assert.equal(status?.tags, true);
    assert.equal(status?.coloredTags, false);
    assert.equal(price?.tags, false);
    assert.equal(price?.coloredTags, true);
    assert.deepEqual(price?.numberFormat, { currency: "EUR" });
  });

  test("answers read in the form's language", () => {
    assert.equal(
      form.formNumberDisplay("1250,5", { currency: "EUR" }, "en-US"),
      "€1,250.50"
    );
    assert.equal(form.formNumberDisplay("12", undefined, "fr"), "12");
    assert.equal(form.formNumberDisplay("abc", undefined, "en"), undefined);
    assert.equal(form.formNumberDisplay(" ", undefined, "en"), undefined);
    assert.equal(form.formDateDisplay("2026-09-30", "en-US"), "Sep 30, 2026");
    assert.equal(form.formDateDisplay("2026-09-30", "fr"), "30 sept. 2026");
    assert.equal(form.formDateDisplay("2026-02-30", "en"), undefined);
    assert.equal(form.formDateAnswer(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(form.formWeekStart("en-US"), 0);
    assert.equal(form.formWeekStart("fr-FR"), 1);
  });

  test("public responses are checked again on the server", () => {
    const snapshot = form.publicFormSnapshot(
      {
        questions: [
          { id: "name", columnId: "name", required: true },
          { id: "status", columnId: "status" },
        ],
        hiddenValues: { urgent: true },
      },
      COLUMNS
    );
    assert.deepEqual(
      form.acceptPublicFormResponse(snapshot, {
        name: "Ada",
        status: "Done",
        price: 1_000_000,
        urgent: false,
      }),
      { ok: true, values: { name: "Ada", status: "Done", urgent: true } }
    );
    assert.deepEqual(form.acceptPublicFormResponse(snapshot, { status: "X" }), {
      ok: false,
      errors: { name: "errorRequired", status: "errorOption" },
    });
  });

  test("the Form mode needs a create action and is on by default", () => {
    assert.equal(form.isFormModeEnabled(undefined, true), true);
    assert.equal(form.isFormModeEnabled({ title: "Request" }, true), true);
    assert.equal(form.isFormModeEnabled(false, true), false);
    assert.equal(form.isFormModeEnabled(true, false), false);
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "form"], { renderers: [] }),
      ["table"]
    );
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "form"], { renderers: ["form"] }),
      ["table", "form"]
    );
    assert.deepEqual(
      modes.pickGenericModeSettings({ form: true, list: { wrap: true } }),
      { list: { wrap: true } }
    );
  });

  test("create results become form results", () => {
    assert.deepEqual(form.formSubmitResultFrom({ success: true }), {
      ok: true,
    });
    assert.deepEqual(
      form.formSubmitResultFrom({
        success: false,
        error: "Duplicate",
        fieldErrors: { name: "Taken" },
      }),
      { ok: false, errors: { name: "Taken" }, message: "Duplicate" }
    );
  });
}
