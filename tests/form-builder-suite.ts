import assert from "node:assert/strict";
import type * as Builder from "../src/components/ui/yayaw-table/utils/form-builder";
import type * as Form from "../src/components/ui/yayaw-table/utils/form-view";

/** The controller's public side: each edition has its own class. */
type Controller = Omit<Builder.FormBuilderController, never>;
type BuilderModule = Pick<
  typeof Builder,
  | "FORM_BUILDER_FORM"
  | "formBuilderColumnKey"
  | "formBuilderItemKey"
  | "formBuilderKeyMove"
  | "formBuilderSummary"
  | "formBuilderSummaryLines"
  | "sameFormSettings"
> & {
  FormBuilderController: new (
    options: Builder.FormBuilderOptions
  ) => Controller;
};
type FormModule = Pick<
  typeof Form,
  | "formColumns"
  | "formCreateFields"
  | "moveFormItemTo"
  | "normalizeFormViewConfig"
  | "resolveFormSettings"
  | "toggleFormQuestion"
  | "withFormFields"
>;
type TestFn = (name: string, fn: () => void | Promise<void>) => void;

const CATEGORIES = ["Hardware", "Software"].map((value) => ({
  value,
  label: value,
}));
const COLUMNS = [
  { id: "name", header: "Name", type: "text" },
  { id: "category", header: "Category", type: "select", options: CATEGORIES },
  { id: "budget", header: "Budget", type: "number" },
  { id: "status", header: "Status", type: "select", options: CATEGORIES },
  { id: "source", header: "Source", type: "text" },
  { id: "done", header: "Done", type: "switch" },
];

/** A bilingual form with a section, a consent and a hidden field. */
const VIEW = {
  defaultLocale: "en",
  locales: ["en", "fr"],
  title: { en: "Project request", fr: "Demande de projet" },
  questions: [
    {
      id: "name",
      columnId: "name",
      label: { en: "Project name", fr: "Nom du projet" },
      required: true,
    },
    { id: "category", columnId: "category" },
    { id: "section-1", kind: "section", title: "Details" },
    { id: "budget", columnId: "budget" },
    {
      id: "utm_source",
      kind: "hidden",
      source: { type: "urlParam", name: "utm_source" },
    },
    { id: "privacy", kind: "consent", link: { href: "/privacy" } },
  ],
};

interface Calls {
  saved: unknown[];
  closed: number;
}

function builder(
  module: BuilderModule,
  view: unknown = VIEW,
  defaults: unknown = { locales: ["en", "fr"] }
): { controller: Controller; calls: Calls } {
  const calls: Calls = { saved: [], closed: 0 };
  const controller = new module.FormBuilderController({
    columns: COLUMNS,
    defaults,
    settings: view,
    locale: "en",
    onSave: (settings) => calls.saved.push(settings),
    onClose: () => {
      calls.closed += 1;
    },
  });
  return { controller, calls };
}

const ids = (state: Builder.FormBuilderState) =>
  state.ordered.map((entry) => entry.id);

function outlineTests(test: TestFn, module: BuilderModule) {
  test("the builder opens on the first question of the view's form", () => {
    const { controller } = builder(module);
    const state = controller.getState();
    assert.equal(state.selected, module.formBuilderItemKey("name"));
    assert.equal(state.selection.kind, "question");
    assert.equal(state.dirty, false);
    assert.equal(state.title, "Project request");
    assert.deepEqual(ids(state), [
      "name",
      "category",
      "section-1",
      "budget",
      "privacy",
    ]);
    assert.deepEqual(
      state.groups.map((group) => [group.id, group.entries.length]),
      [
        ["items", 5],
        ["hidden", 1],
        ["columns", 3],
      ]
    );
    const [name, , section, , consent] = state.ordered;
    assert.equal(name?.name, "Project name");
    assert.equal(name?.kind === "question" && name.required, true);
    assert.equal(section?.name, "Details");
    assert.equal(
      consent?.name,
      "I agree to the processing of my answers as described in the privacy policy."
    );
    const hidden = state.groups[1]?.entries[0];
    assert.equal(hidden?.name, "utm_source");
    assert.equal(
      hidden?.kind === "hidden" && hidden.target,
      "Response details"
    );
  });

  test("an empty view asks every column; a form without questions selects the form", () => {
    const { controller } = builder(module, {});
    assert.deepEqual(ids(controller.getState()), [
      "name",
      "category",
      "budget",
      "status",
      "source",
      "done",
    ]);
    const empty = builder(module, { questions: [] }).controller;
    assert.equal(empty.getState().selected, module.FORM_BUILDER_FORM);
    assert.equal(empty.getState().selection.kind, "form");
    assert.equal(empty.getState().addable.length, COLUMNS.length);
  });

  test("names and missing translations follow the language being edited", () => {
    const { controller } = builder(module);
    controller.setLocale("fr");
    const state = controller.getState();
    assert.equal(state.locale, "fr");
    assert.equal(state.title, "Demande de projet");
    const [name, category, section] = state.ordered;
    assert.equal(name?.name, "Nom du projet");
    assert.equal(name?.kind === "question" && name.missing, false);
    // Category's label is the column name: it still needs a French label.
    assert.equal(category?.kind === "question" && category.missing, true);
    // A plain title is English: French misses it.
    assert.equal(section?.kind === "section" && section.missing, true);
  });
}

function editTests(test: TestFn, module: BuilderModule) {
  test("texts are written in the language being edited", () => {
    // French comes from a text; no language is pinned yet.
    const { controller } = builder(
      module,
      { title: { en: "Request", fr: "Demande" } },
      {}
    );
    assert.deepEqual(controller.getState().languages, ["en", "fr"]);
    assert.equal(controller.getState().draft.defaultLocale, undefined);
    // Writing French pins the table's language as the default one.
    controller.setLocale("fr");
    controller.changeItem("category", { label: { fr: "Catégorie" } });
    const { draft } = controller.getState();
    assert.equal(draft.defaultLocale, "en");
    assert.deepEqual(
      draft.questions?.find((item) => item.id === "category"),
      { id: "category", columnId: "category", label: { fr: "Catégorie" } }
    );
    assert.equal(controller.getState().dirty, true);

    controller.addLanguage("de");
    assert.equal(controller.getState().locale, "de");
    assert.deepEqual(controller.getState().draft.locales, ["en", "fr", "de"]);
    controller.setDefaultLocale("fr");
    assert.equal(controller.getState().defaultLocale, "fr");
  });

  test("asking a column adds it after the selection; removing it selects its column", () => {
    const { controller } = builder(module);
    controller.select(module.formBuilderItemKey("category"));
    controller.ask("status");
    let state = controller.getState();
    assert.deepEqual(ids(state).slice(0, 3), ["name", "category", "status"]);
    assert.equal(state.selected, module.formBuilderItemKey("status"));
    assert.equal(state.announcement, "Added: Status.");

    controller.remove("status");
    state = controller.getState();
    assert.equal(ids(state).includes("status"), false);
    assert.equal(state.selected, module.formBuilderColumnKey("status"));
    assert.equal(state.selection.kind, "column");
    assert.equal(state.announcement, "Removed: Status.");
  });

  test("sections, consents and hidden fields are added after the selection", () => {
    const { controller } = builder(module);
    controller.select(module.formBuilderItemKey("name"));
    controller.addSection();
    assert.deepEqual(ids(controller.getState()).slice(0, 2), [
      "name",
      "section-2",
    ]);
    assert.equal(controller.getState().selection.kind, "section");
    controller.addConsent();
    assert.deepEqual(ids(controller.getState()).slice(0, 3), [
      "name",
      "section-2",
      "consent-2",
    ]);
    controller.addHiddenField();
    const state = controller.getState();
    assert.equal(state.selection.kind, "hidden");
    assert.equal(state.selected, module.formBuilderItemKey("utm_medium"));

    // A hidden field's id follows its source, and so does the selection.
    controller.changeHidden("utm_medium", {
      source: { type: "urlParam", name: "gclid" },
      columnId: "source",
    });
    const next = controller.getState();
    assert.equal(next.selected, module.formBuilderItemKey("gclid"));
    const selection = next.selection;
    assert.equal(
      selection.kind === "hidden" && selection.entry.target,
      "Source"
    );
    // Removing it selects the hidden field before it.
    controller.remove("gclid");
    assert.equal(
      controller.getState().selected,
      module.formBuilderItemKey("utm_source")
    );
  });

  test("rules are edited on the selected question", () => {
    const { controller } = builder(module);
    controller.select(module.formBuilderItemKey("budget"));
    controller.addRule("budget");
    let selection = controller.getState().selection;
    assert.equal(selection.kind, "question");
    if (selection.kind !== "question") {
      return;
    }
    const [rule] = selection.rules.list;
    assert.equal(rule?.then.questionIds?.[0], "budget");
    assert.equal(selection.rules.issues.length > 0, true);
    assert.equal(
      selection.rules.fields.some((field) => field.id === "budget"),
      false
    );
    assert.ok(rule);
    controller.changeRule({
      ...rule,
      when: {
        join: "and",
        items: [{ fieldId: "category", operator: "is", value: "Hardware" }],
      },
    });
    selection = controller.getState().selection;
    assert.equal(
      selection.kind === "question" && selection.rules.summaries[0],
      "Shown when Category is Hardware"
    );
    const budget = controller.getState().ordered[3];
    assert.equal(budget?.kind === "question" && budget.conditional, true);
    controller.removeRule(rule.id);
    selection = controller.getState().selection;
    assert.equal(
      selection.kind === "question" && selection.rules.list.length,
      0
    );
  });

  test("columns not asked keep a fixed value", () => {
    const { controller } = builder(module);
    controller.select(module.formBuilderColumnKey("status"));
    controller.setFixedValue("status", "Software");
    const state = controller.getState();
    assert.deepEqual(state.draft.hiddenValues, { status: "Software" });
    const selection = state.selection;
    assert.equal(selection.kind === "column" && selection.value, "Software");
    assert.equal(selection.kind === "column" && selection.choices?.length, 2);
    const status = state.groups[2]?.entries.find(
      (entry) => entry.id === "status"
    );
    assert.equal(status?.kind === "column" && status.fixed, "Software");
    controller.setFixedValue("status", undefined);
    assert.equal(controller.getState().draft.hiddenValues, undefined);
  });

  test("reset goes back to the table's form settings", () => {
    const { controller } = builder(module);
    controller.reset();
    const state = controller.getState();
    assert.deepEqual(state.draft, {});
    assert.equal(state.dirty, true);
    assert.equal(ids(state).length, COLUMNS.length);
  });
}

function orderTests(test: TestFn, module: BuilderModule, form: FormModule) {
  test("Alt + arrows move an item and keep its focus", () => {
    assert.equal(
      module.formBuilderKeyMove({ key: "ArrowUp", altKey: true }),
      -1
    );
    assert.equal(
      module.formBuilderKeyMove({ key: "ArrowDown", altKey: true }),
      1
    );
    assert.equal(
      module.formBuilderKeyMove({ key: "ArrowDown", altKey: false }),
      undefined
    );
    assert.equal(
      module.formBuilderKeyMove({ key: "Enter", altKey: true }),
      undefined
    );

    const { controller } = builder(module);
    controller.move("budget", -1);
    const state = controller.getState();
    assert.deepEqual(ids(state), [
      "name",
      "category",
      "budget",
      "section-1",
      "privacy",
    ]);
    assert.equal(state.announcement, "Budget: position 3 of 5.");
    assert.equal(state.focus?.key, module.formBuilderItemKey("budget"));
    // The first item cannot go higher: nothing changes.
    const before = controller.getState();
    controller.move("name", -1);
    assert.equal(controller.getState(), before);
  });

  test("dragging drops an item at its place; hidden fields keep theirs", () => {
    const { controller } = builder(module);
    controller.startDrag(module.formBuilderItemKey("privacy"));
    assert.deepEqual(controller.getState().drag, {
      key: module.formBuilderItemKey("privacy"),
      from: 4,
      to: 4,
    });
    controller.dragTo(-3);
    assert.equal(controller.getState().drag?.to, 0);
    controller.dragTo(1);
    controller.endDrag(true);
    const state = controller.getState();
    assert.equal(state.drag, undefined);
    assert.deepEqual(ids(state), [
      "name",
      "privacy",
      "category",
      "section-1",
      "budget",
    ]);
    assert.deepEqual(
      state.draft.questions?.map((item) => item.id),
      ["name", "privacy", "category", "section-1", "utm_source", "budget"]
    );
    // A cancelled drag changes nothing.
    controller.startDrag(module.formBuilderItemKey("name"));
    controller.dragTo(3);
    controller.endDrag(false);
    assert.equal(ids(controller.getState())[0], "name");
  });

  test("items move to a place among the ordered ones", () => {
    const items = form.normalizeFormViewConfig(VIEW)?.questions ?? [];
    assert.deepEqual(
      form.moveFormItemTo(items, "name", 9).map((item) => item.id),
      ["category", "section-1", "budget", "privacy", "utm_source", "name"]
    );
    assert.deepEqual(
      form.moveFormItemTo(items, "privacy", 0).map((item) => item.id),
      ["privacy", "name", "category", "section-1", "utm_source", "budget"]
    );
    assert.deepEqual(
      form.moveFormItemTo(items, "missing", 0).map((item) => item.id),
      items.map((item) => item.id)
    );
    // Asking a column after an item.
    assert.deepEqual(
      form
        .toggleFormQuestion(items, "status", true, "name")
        .map((item) => item.id)
        .slice(0, 3),
      ["name", "status", "category"]
    );
  });
}

function saveTests(test: TestFn, module: BuilderModule, form: FormModule) {
  test("saving writes the view; closing with changes asks first", () => {
    const { calls, controller } = builder(module);
    controller.requestClose();
    assert.equal(calls.closed, 1);

    controller.setLayout("steps");
    assert.equal(controller.getState().dirty, true);
    controller.requestClose();
    assert.equal(controller.getState().confirming, true);
    assert.equal(calls.closed, 1);
    controller.keepEditing();
    assert.equal(controller.getState().confirming, false);

    controller.save();
    let state = controller.getState();
    assert.equal(state.dirty, false);
    assert.equal(state.saved, true);
    assert.equal(state.announcement, "Saved in this view.");
    assert.deepEqual(calls.saved, [
      form.normalizeFormViewConfig({ ...VIEW, layout: "steps" }),
    ]);
    controller.write({ title: "Other" });
    state = controller.getState();
    assert.equal(state.saved, false);
    controller.requestClose();
    controller.discard();
    assert.equal(calls.closed, 2);
    assert.equal(calls.saved.length, 1);

    controller.requestClose();
    controller.saveAndClose();
    assert.equal(calls.saved.length, 2);
    assert.equal(calls.closed, 3);
  });

  test("on phones, choosing an entry opens its properties", () => {
    const { controller } = builder(module);
    assert.equal(controller.getState().tab, "outline");
    controller.select(module.formBuilderItemKey("budget"));
    assert.equal(controller.getState().tab, "outline");
    controller.setCompact(true);
    controller.select(module.FORM_BUILDER_FORM);
    assert.equal(controller.getState().tab, "properties");
    assert.equal(controller.getState().selection.kind, "form");
    controller.setTab("preview");
    assert.equal(controller.getState().tab, "preview");
    // Unknown entries are ignored.
    controller.select(module.formBuilderItemKey("nope"));
    assert.equal(controller.getState().selected, module.FORM_BUILDER_FORM);
  });

  test("settings compare once normalized, whatever their key order", () => {
    assert.equal(
      module.sameFormSettings(
        { title: "A", layout: "steps" },
        { layout: "steps", title: "A", unknown: 1 }
      ),
      true
    );
    assert.equal(module.sameFormSettings(undefined, {}), true);
    assert.equal(
      module.sameFormSettings({ title: "A" }, { title: "B" }),
      false
    );
    assert.deepEqual(form.normalizeFormViewConfig({ editButton: false }), {
      editButton: false,
    });
    assert.equal(form.normalizeFormViewConfig({ editButton: "no" }), undefined);
  });

  test("the View settings summarize the form", () => {
    const summary = module.formBuilderSummary(
      COLUMNS,
      { locales: ["en", "fr"] },
      { ...VIEW, layout: "steps", review: true },
      "en"
    );
    assert.deepEqual(summary, {
      title: "Project request",
      questions: 3,
      sections: 1,
      consents: 1,
      hiddenFields: 1,
      layout: "steps",
      review: true,
      languages: ["en", "fr"],
    });
    assert.deepEqual(module.formBuilderSummaryLines(summary, "en"), [
      "3 questions · 1 section · 1 consent · 1 hidden field",
      "Step by step, with a review",
      "English, Français",
    ]);
    assert.deepEqual(
      module.formBuilderSummaryLines(
        { ...summary, questions: 1, sections: 0, layout: "page" },
        "fr"
      ),
      [
        "1 question · 1 consentement · 1 champ caché",
        "Une seule page",
        "English, Français",
      ]
    );
  });
}

/** Columns a host declares, from a record id to a computed total. */
const HOST_COLUMNS = [
  { id: "id", header: "ID", type: "text" },
  { id: "createdAt", header: "Created", type: "date" },
  { id: "updated_by", header: "Updated by", type: "text" },
  { id: "name", header: "Name", type: "text" },
  { id: "reference", header: "Reference", type: "text", readonly: true },
  { id: "code", header: "Code", type: "text", readOnly: true },
  { id: "total", header: "Total", type: "number", computed: true },
  { id: "owner", header: "Owner", type: "text", editable: false },
  { id: "tenant", header: "Tenant", type: "text", system: true },
  { id: "secret", header: "Secret", type: "text", hidden: true },
  { id: "notes", header: "Notes", type: "text", form: false },
  { id: "sku", header: "SKU", type: "text", system: true, form: true },
  { id: "score", header: "Score", type: "number", accessorFn: () => 1 },
  { id: "status", header: "Status", type: "select", options: CATEGORIES },
];

function columnTests(test: TestFn, module: BuilderModule, form: FormModule) {
  test("forms never ask system, read-only, computed or hidden columns", () => {
    const { eligible, excluded } = form.formColumns(HOST_COLUMNS);
    assert.deepEqual(
      eligible.map((column) => column.id),
      ["name", "sku", "status"]
    );
    assert.deepEqual(
      excluded.map((column) => column.id),
      [
        "id",
        "createdAt",
        "updated_by",
        "reference",
        "code",
        "total",
        "owner",
        "tenant",
        "secret",
        "notes",
        "score",
      ]
    );
    // A form without questions asks the writable columns only.
    const settings = form.resolveFormSettings(HOST_COLUMNS, undefined, {});
    assert.deepEqual(
      settings.questions.map((question) => question.columnId),
      ["name", "sku", "status"]
    );
    // A question saved on a system column is not asked.
    const saved = form.resolveFormSettings(HOST_COLUMNS, undefined, {
      questions: [
        { id: "id", columnId: "id" },
        { id: "name", columnId: "name" },
      ],
    });
    assert.deepEqual(
      saved.questions.map((question) => question.columnId),
      ["name"]
    );
    // The builder offers only writable columns to ask.
    const controller = new module.FormBuilderController({
      columns: HOST_COLUMNS,
      defaults: undefined,
      settings: { questions: [{ id: "name", columnId: "name" }] },
      locale: "en",
      onSave: () => undefined,
      onClose: () => undefined,
    });
    assert.deepEqual(
      controller.getState().addable.map((column) => column.id),
      ["sku", "status"]
    );
    assert.equal(controller.getState().excluded.length, 11);
  });

  test("the table's create form limits the columns forms ask", () => {
    assert.deepEqual(
      form.formCreateFields([
        { name: "name" },
        { name: "status", hidden: true },
        { name: "code", disabled: true },
        { label: "No name" },
        { name: "category" },
      ]),
      ["name", "category"]
    );
    assert.equal(form.formCreateFields([]), undefined);
    assert.equal(form.formCreateFields(undefined), undefined);
    const limited = form.withFormFields(
      [
        ...COLUMNS,
        { id: "extra", header: "Extra", type: "text", form: true },
        {
          id: "aliased",
          header: "Aliased",
          type: "text",
          accessorKey: "alias",
        },
      ],
      ["name", "budget", "alias"]
    );
    assert.deepEqual(
      form.formColumns(limited).eligible.map((column) => column.id),
      ["name", "budget", "extra", "aliased"]
    );
    assert.equal(
      form.withFormFields(COLUMNS, undefined).length,
      COLUMNS.length
    );
    assert.equal(
      form
        .withFormFields(COLUMNS, [])
        .every((column) => (column as { form?: boolean }).form !== false),
      true
    );
  });
}

export function formBuilderSuite(
  test: TestFn,
  module: BuilderModule,
  form: FormModule
) {
  outlineTests(test, module);
  editTests(test, module);
  orderTests(test, module, form);
  saveTests(test, module, form);
  columnTests(test, module, form);
}
