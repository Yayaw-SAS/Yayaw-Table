/**
 * Framework-neutral controller of the form builder, shared by the React and
 * Vue editions: a draft of a Form view's settings edited in a near
 * full-screen dialog (outline, live preview and properties), the item
 * selected, the language being edited, reordering by keyboard or by drag,
 * the phone tabs, and saving or discarding the draft. Views subscribe and
 * render its state; the View settings show `formBuilderSummary`.
 */
import type { ConditionField, FormRule, RuleIssue } from "./form-conditions";
import {
  formLanguage,
  formLanguageName,
  resolveFormText,
  uniqueFormLocales,
} from "./form-text";
import {
  addFormConsent,
  addFormHiddenField,
  addFormSection,
  createFormRule,
  FORM_HIDDEN_SOURCE_LABELS,
  type FormColumn,
  type FormConsentQuestion,
  type FormHiddenField,
  type FormHiddenSource,
  type FormHiddenValue,
  type FormItem,
  type FormLabelKey,
  type FormLayout,
  type FormQuestion,
  type FormSectionBreak,
  type FormTranslate,
  type FormViewSettings,
  formAddableLocales,
  formColumns,
  formDefaultLocale,
  formHiddenChoices,
  formHiddenFieldColumns,
  formHiddenValueText,
  formItemMissingTranslation,
  formLabel,
  formLocales,
  formOrderedItems,
  formQuestionList,
  formRuleFields,
  formRuleIssues,
  formRuleSummary,
  formRulesFor,
  formViewLocales,
  isFormConsent,
  isFormHiddenField,
  isFormQuestion,
  isFormSection,
  mergeFormSettings,
  moveFormItemTo,
  moveFormQuestion,
  normalizeFormViewConfig,
  type ResolvedFormQuestion,
  removeFormItem,
  removeFormRule,
  resolveFormSettings,
  toggleFormQuestion,
  updateFormHiddenField,
  updateFormQuestion,
  upsertFormRule,
} from "./form-view";

/** The builder's panels on phones, one at a time. */
export type FormBuilderTab = "outline" | "preview" | "properties";

/** Key of the form's own settings (title, layout, languages, messages). */
export const FORM_BUILDER_FORM = "form";
const ITEM = "item:";
const COLUMN = "column:";

/** Key of a question, section, consent or hidden field in the builder. */
export const formBuilderItemKey = (id: string): string => `${ITEM}${id}`;

/** Key of a column the form does not ask. */
export const formBuilderColumnKey = (columnId: string): string =>
  `${COLUMN}${columnId}`;

interface EntryBase {
  /** `item:<id>` or `column:<id>`: what the outline selects. */
  key: string;
  id: string;
  /** How the outline names it, in the language being edited. */
  name: string;
}

export interface FormBuilderQuestionEntry extends EntryBase {
  kind: "question";
  /** Place among the ordered items (questions, sections and consents). */
  index: number;
  column: FormColumn;
  question: FormQuestion;
  required: boolean;
  /** Rules show, hide or require it. */
  conditional: boolean;
  missing: boolean;
}

export interface FormBuilderSectionEntry extends EntryBase {
  kind: "section";
  index: number;
  section: FormSectionBreak;
  conditional: boolean;
  missing: boolean;
}

export interface FormBuilderConsentEntry extends EntryBase {
  kind: "consent";
  index: number;
  consent: FormConsentQuestion;
  missing: boolean;
}

export interface FormBuilderHiddenEntry extends EntryBase {
  kind: "hidden";
  field: FormHiddenField;
  /** Where the value is saved: a column's name, or "Response details". */
  target: string;
}

export interface FormBuilderColumnEntry extends EntryBase {
  kind: "column";
  column: FormColumn;
  /** The fixed value saved with every response, as shown. */
  fixed?: string;
}

/** An item the form shows, in order. */
export type FormBuilderOrderedEntry =
  | FormBuilderQuestionEntry
  | FormBuilderSectionEntry
  | FormBuilderConsentEntry;

export type FormBuilderEntry =
  | FormBuilderOrderedEntry
  | FormBuilderHiddenEntry
  | FormBuilderColumnEntry;

/**
 * A group of the outline: the form's items in order, its hidden fields, and
 * the columns it does not ask. A form writing several tables can add a group
 * of its tables the same way.
 */
export interface FormBuilderGroup {
  id: "columns" | "hidden" | "items";
  title: string;
  entries: FormBuilderEntry[];
}

/** What the conditions of the selected question need. */
export interface FormBuilderRules {
  list: FormRule[];
  /** Questions its conditions may read (every other question). */
  fields: ConditionField[];
  issues: RuleIssue[];
  questions: ResolvedFormQuestion[];
  summaries: string[];
}

/** The selected entry, with what its properties need. */
export type FormBuilderSelection =
  | { kind: "form" }
  | {
      kind: "question";
      entry: FormBuilderQuestionEntry;
      rules: FormBuilderRules;
      /** Number of ordered items, for "Move up" and "Move down". */
      count: number;
    }
  | { kind: "section"; entry: FormBuilderSectionEntry; count: number }
  | { kind: "consent"; entry: FormBuilderConsentEntry; count: number }
  | {
      kind: "hidden";
      entry: FormBuilderHiddenEntry;
      /** Columns the field may write. */
      columns: FormColumn[];
    }
  | {
      kind: "column";
      entry: FormBuilderColumnEntry;
      /** Options of a fixed value chosen in a list; typed otherwise. */
      choices?: { value: string; label: string }[];
      value?: FormHiddenValue;
    };

/** An item being dragged, and the place it would drop at. */
export interface FormBuilderDrag {
  key: string;
  from: number;
  to: number;
}

export interface FormBuilderState {
  /** The view's own form settings, as edited. */
  draft: FormViewSettings;
  /** The form they make with the table's settings (what the preview shows). */
  form: FormViewSettings;
  /** The draft differs from what is saved in the view. */
  dirty: boolean;
  /** The draft was just saved; cleared by the next change. */
  saved: boolean;
  /** The form's title in the language being edited. */
  title: string;
  selected: string;
  selection: FormBuilderSelection;
  groups: FormBuilderGroup[];
  ordered: FormBuilderOrderedEntry[];
  /** Columns "Add" offers as questions. */
  addable: FormColumn[];
  /** Columns a form cannot ask (computed or custom values). */
  excluded: FormColumn[];
  languages: string[];
  addableLocales: string[];
  defaultLocale: string;
  /** The language texts are written in, and the preview shows. */
  locale: string;
  layout: FormLayout;
  tab: FormBuilderTab;
  /** Phones and narrow windows: one panel at a time, in tabs. */
  compact: boolean;
  /** "Discard your changes?" is asked. */
  confirming: boolean;
  drag?: FormBuilderDrag;
  /** An entry to focus after the outline renders (it moved), with a counter. */
  focus?: { key: string; count: number };
  /** What a live region reads: moves, additions, removals, saving. */
  announcement: string;
}

export interface FormBuilderOptions {
  columns: readonly FormColumn[];
  /** The table's form settings (`table.form`), under the view's. */
  defaults: unknown;
  /** The view's own form settings when the builder opens. */
  settings: unknown;
  /** The table's language: labels, and the default language of forms without one. */
  locale: string;
  translate?: FormTranslate;
  /** Save the draft in the view (`undefined`: back to the table's settings). */
  onSave: (settings: FormViewSettings | undefined) => void;
  onClose: () => void;
}

type LabelParams = Record<string, number | string>;

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])])
    );
  }
  return value;
};

/** Whether two form settings are the same once normalized, key order aside. */
export function sameFormSettings(left: unknown, right: unknown): boolean {
  const text = (value: unknown) =>
    JSON.stringify(sortKeys(normalizeFormViewConfig(value) ?? {}));
  return text(left) === text(right);
}

/** Alt + ↑ / ↓ on an outline entry moves it one place; other keys do not. */
export function formBuilderKeyMove(event: {
  key: string;
  altKey: boolean;
}): -1 | 1 | undefined {
  if (!event.altKey) {
    return;
  }
  if (event.key === "ArrowUp") {
    return -1;
  }
  return event.key === "ArrowDown" ? 1 : undefined;
}

interface TextLanguage {
  locale: string;
  defaultLocale: string;
}

/** A consent's statement as the form reads it, its link text in place. */
function consentName(consent: FormConsentQuestion, texts: TextLanguage) {
  const { defaultLocale, locale } = texts;
  const statement =
    resolveFormText(consent.text, locale, defaultLocale) ??
    formLabel(consent.link ? "consentTextLink" : "consentText", locale);
  const link =
    resolveFormText(consent.link?.label, locale, defaultLocale) ??
    formLabel("consentLinkLabel", locale);
  return statement.replaceAll("{link}", link);
}

/** A fixed value as the outline shows it: an option's label, or the value. */
function fixedText(
  column: FormColumn,
  value: FormHiddenValue | undefined
): string | undefined {
  if (value === undefined) {
    return;
  }
  const choice = formHiddenChoices(column)?.find(
    (option) => option.value === String(value)
  );
  return choice?.label ?? (formHiddenValueText(value) || undefined);
}

interface OutlineInput {
  columns: readonly FormColumn[];
  form: FormViewSettings;
  items: FormItem[];
  texts: TextLanguage;
  label: (key: FormLabelKey, params?: LabelParams) => string;
}

function orderedEntries({
  columns,
  form,
  items,
  label,
  texts,
}: OutlineInput): FormBuilderOrderedEntry[] {
  const { defaultLocale, locale } = texts;
  const byId = new Map(columns.map((column) => [column.id, column]));
  const rules = form.rules ?? [];
  const conditional = (id: string) => formRulesFor(rules, id).length > 0;
  const entries: FormBuilderOrderedEntry[] = [];
  for (const item of formOrderedItems(items)) {
    const index = entries.length;
    const base = { key: formBuilderItemKey(item.id), id: item.id, index };
    if (isFormSection(item)) {
      entries.push({
        ...base,
        kind: "section",
        name:
          resolveFormText(item.title, locale, defaultLocale) ??
          label("untitledSection"),
        section: item,
        conditional: conditional(item.id),
        missing: formItemMissingTranslation(item, locale, defaultLocale),
      });
    } else if (isFormConsent(item)) {
      entries.push({
        ...base,
        kind: "consent",
        name: consentName(item, texts),
        consent: item,
        missing: formItemMissingTranslation(item, locale, defaultLocale),
      });
    } else if (isFormQuestion(item)) {
      const column = byId.get(item.columnId);
      if (column) {
        entries.push({
          ...base,
          kind: "question",
          name:
            resolveFormText(item.label, locale, defaultLocale) ?? column.header,
          column,
          question: item,
          required: item.required === true,
          conditional: conditional(item.id),
          missing: formItemMissingTranslation(
            item,
            locale,
            defaultLocale,
            column
          ),
        });
      }
    }
  }
  return entries;
}

function hiddenEntries({
  columns,
  items,
  label,
}: OutlineInput): FormBuilderHiddenEntry[] {
  return items.filter(isFormHiddenField).map((field) => ({
    key: formBuilderItemKey(field.id),
    id: field.id,
    kind: "hidden",
    name:
      field.source.type === "urlParam"
        ? field.source.name
        : label(FORM_HIDDEN_SOURCE_LABELS[field.source.type]),
    field,
    target:
      columns.find((column) => column.id === field.columnId)?.header ??
      label("responseDetails"),
  }));
}

function columnEntries(
  eligible: readonly FormColumn[],
  { form, items }: OutlineInput
): FormBuilderColumnEntry[] {
  const asked = new Set(
    items.filter(isFormQuestion).map((question) => question.columnId)
  );
  const fixed = form.hiddenValues ?? {};
  return eligible
    .filter((column) => !asked.has(column.id))
    .map((column) => ({
      key: formBuilderColumnKey(column.id),
      id: column.id,
      kind: "column",
      name: column.header,
      column,
      fixed: fixedText(column, fixed[column.id]),
    }));
}

/** The rules acting on a question, and what editing them needs. */
function questionRules(
  columns: readonly FormColumn[],
  form: FormViewSettings,
  questionId: string,
  locale: string,
  translate?: FormTranslate
): FormBuilderRules {
  const list = formRulesFor(form.rules, questionId);
  const ids = new Set(list.map((rule) => rule.id));
  const { questions } = resolveFormSettings(
    columns,
    undefined,
    { ...form, rules: [] },
    locale
  );
  return {
    list,
    fields: formRuleFields(columns, form, locale).filter(
      (field) => field.id !== questionId
    ),
    issues: formRuleIssues(columns, form).filter((issue) =>
      ids.has(issue.ruleId)
    ),
    questions,
    summaries: list.map((rule) =>
      formRuleSummary(rule, questions, locale, translate)
    ),
  };
}

/** The outline's entries by group, and the columns a form cannot ask. */
interface Outline {
  ordered: FormBuilderOrderedEntry[];
  hidden: FormBuilderHiddenEntry[];
  columns: FormBuilderColumnEntry[];
  excluded: FormColumn[];
}

type FormItemPatch = Parameters<typeof updateFormQuestion>[2];

/** The item after (else before) `key` among `keys`, for the selection after a removal. */
function neighbour(keys: readonly string[], key: string): string | undefined {
  const index = keys.indexOf(key);
  return index < 0 ? undefined : (keys[index + 1] ?? keys[index - 1]);
}

/**
 * The form builder's state and edits. It holds a draft of the view's form
 * settings: the table is changed only by `save`, and closing with unsaved
 * changes asks first.
 */
export class FormBuilderController {
  private options: FormBuilderOptions;
  private readonly listeners = new Set<() => void>();
  private savedSettings: FormViewSettings;
  private draft: FormViewSettings;
  private selected: string;
  private localeChoice: string | undefined;
  private tab: FormBuilderTab = "outline";
  private compact = false;
  private confirming = false;
  private justSaved = false;
  private drag: FormBuilderDrag | undefined;
  private focus: { key: string; count: number } | undefined;
  private focusCount = 0;
  private announcement = "";
  private snapshot: FormBuilderState | undefined;

  constructor(options: FormBuilderOptions) {
    this.options = options;
    this.savedSettings = normalizeFormViewConfig(options.settings) ?? {};
    this.draft = this.savedSettings;
    this.selected = this.firstKey();
  }

  // ------------------------------------------------------------ subscription

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): FormBuilderState => {
    if (!this.snapshot) {
      this.snapshot = this.buildState();
    }
    return this.snapshot;
  };

  private emit(): void {
    this.snapshot = undefined;
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * New columns, table settings, language or callbacks; the draft is kept.
   * The state changes only when what it shows does.
   */
  setOptions(options: FormBuilderOptions): void {
    const previous = this.options;
    this.options = options;
    const changed =
      previous.columns !== options.columns ||
      previous.defaults !== options.defaults ||
      previous.locale !== options.locale ||
      previous.translate !== options.translate;
    if (changed) {
      this.emit();
    }
  }

  // ------------------------------------------------------------ labels

  private readonly label = (key: FormLabelKey, params?: LabelParams): string =>
    formLabel(key, this.options.locale, this.options.translate, params);

  // ------------------------------------------------------------ derived

  private form(): FormViewSettings {
    return mergeFormSettings(this.options.defaults, this.draft);
  }

  private items(form = this.form()): FormItem[] {
    return formQuestionList(this.options.columns, form);
  }

  private languages(form = this.form()) {
    const fallback = formLanguage(this.options.locale) || "en";
    const pinned = formDefaultLocale(form);
    const defaultLocale = pinned ?? fallback;
    const languages = formViewLocales(
      this.options.defaults,
      this.draft,
      fallback
    );
    const locale =
      this.localeChoice && languages.includes(this.localeChoice)
        ? this.localeChoice
        : defaultLocale;
    return { defaultLocale, languages, locale, pinned };
  }

  private outline(form = this.form()): Outline {
    const { eligible, excluded } = formColumns(this.options.columns);
    const { defaultLocale, locale } = this.languages(form);
    const input: OutlineInput = {
      columns: this.options.columns,
      form,
      items: this.items(form),
      texts: { defaultLocale, locale },
      label: this.label,
    };
    return {
      ordered: orderedEntries(input),
      hidden: hiddenEntries(input),
      columns: columnEntries(eligible, input),
      excluded,
    };
  }

  private firstKey(): string {
    return this.outline().ordered[0]?.key ?? FORM_BUILDER_FORM;
  }

  private entry(key: string): FormBuilderEntry | undefined {
    const { columns, hidden, ordered } = this.outline();
    return [...ordered, ...hidden, ...columns].find(
      (entry) => entry.key === key
    );
  }

  private buildSelection(
    outline: Outline,
    form: FormViewSettings
  ): FormBuilderSelection {
    const { columns, hidden, ordered } = outline;
    const count = ordered.length;
    const entry = [...ordered, ...hidden, ...columns].find(
      (item) => item.key === this.selected
    );
    switch (entry?.kind) {
      case "question":
        return {
          kind: "question",
          entry,
          count,
          rules: questionRules(
            this.options.columns,
            form,
            entry.id,
            this.options.locale,
            this.options.translate
          ),
        };
      case "section":
        return { kind: "section", entry, count };
      case "consent":
        return { kind: "consent", entry, count };
      case "hidden":
        return {
          kind: "hidden",
          entry,
          columns: formHiddenFieldColumns(
            this.options.columns,
            this.items(form),
            entry.id
          ),
        };
      case "column":
        return {
          kind: "column",
          entry,
          choices: formHiddenChoices(entry.column),
          value: form.hiddenValues?.[entry.id],
        };
      default:
        return { kind: "form" };
    }
  }

  private buildState(): FormBuilderState {
    const form = this.form();
    const outline = this.outline(form);
    const { defaultLocale, languages, locale } = this.languages(form);
    const selection = this.buildSelection(outline, form);
    const selected =
      selection.kind === "form" ? FORM_BUILDER_FORM : selection.entry.key;
    return {
      draft: this.draft,
      form,
      dirty: !sameFormSettings(this.savedSettings, this.draft),
      saved: this.justSaved,
      title:
        resolveFormText(form.title, locale, defaultLocale) ??
        this.label("untitledForm"),
      selected,
      selection,
      groups: [
        {
          id: "items",
          title: this.label("questions"),
          entries: outline.ordered,
        },
        {
          id: "hidden",
          title: this.label("hiddenFields"),
          entries: outline.hidden,
        },
        {
          id: "columns",
          title: this.label("notInForm"),
          entries: outline.columns,
        },
      ],
      ordered: outline.ordered,
      addable: outline.columns.map((entry) => entry.column),
      excluded: outline.excluded,
      languages,
      addableLocales: formAddableLocales(this.options.defaults, languages),
      defaultLocale,
      locale,
      layout: form.layout ?? "page",
      tab: this.tab,
      compact: this.compact,
      confirming: this.confirming,
      drag: this.drag,
      focus: this.focus,
      announcement: this.announcement,
    };
  }

  // ------------------------------------------------------------ edits

  /** Settings that are not texts: layout, review, fixed values, rules… */
  update(patch: FormViewSettings): void {
    this.draft = normalizeFormViewConfig({ ...this.draft, ...patch }) ?? {};
    this.justSaved = false;
    this.emit();
  }

  /**
   * Texts written in the language being edited. Writing in another language
   * pins the default one, so plain texts keep theirs.
   */
  write(patch: FormViewSettings): void {
    const { defaultLocale, locale, pinned } = this.languages();
    this.update(
      locale === defaultLocale || pinned ? patch : { ...patch, defaultLocale }
    );
  }

  private setItems(items: FormItem[]): void {
    this.write({ questions: items });
  }

  private say(announcement: string): void {
    this.announcement = announcement;
  }

  select(key: string): void {
    if (key !== FORM_BUILDER_FORM && !this.entry(key)) {
      return;
    }
    this.selected = key;
    if (this.compact) {
      this.tab = "properties";
    }
    this.emit();
  }

  setTab(tab: FormBuilderTab): void {
    if (tab !== this.tab) {
      this.tab = tab;
      this.emit();
    }
  }

  setCompact(compact: boolean): void {
    if (compact !== this.compact) {
      this.compact = compact;
      this.emit();
    }
  }

  // Languages ---------------------------------------------------------

  setLocale(locale: string): void {
    this.localeChoice = locale;
    this.emit();
  }

  addLanguage(added: string): void {
    const { defaultLocale, languages } = this.languages();
    this.localeChoice = added;
    this.update({
      locales: uniqueFormLocales([...languages, added]),
      defaultLocale,
    });
  }

  setDefaultLocale(defaultLocale: string): void {
    this.update({ defaultLocale });
  }

  setLayout(layout: FormLayout): void {
    this.update({ layout });
  }

  // Items -------------------------------------------------------------

  /** Change a question, section or consent. */
  changeItem(id: string, patch: FormItemPatch): void {
    this.setItems(updateFormQuestion(this.items(), id, patch));
  }

  /** Change a hidden field's source or column; its key follows its new id. */
  changeHidden(
    id: string,
    patch: { source?: FormHiddenSource; columnId?: string }
  ): void {
    const next = updateFormHiddenField(this.items(), id, patch);
    if (this.selected === formBuilderItemKey(id)) {
      this.selected = formBuilderItemKey(next.id);
    }
    this.update({ questions: next.questions });
  }

  /** The selected ordered item, after which new items go. */
  private selectedItemId(): string | undefined {
    const entry = this.entry(this.selected);
    return entry && entry.kind !== "hidden" && entry.kind !== "column"
      ? entry.id
      : undefined;
  }

  private added(id: string): void {
    this.selected = formBuilderItemKey(id);
    const entry = this.entry(this.selected);
    this.say(this.label("builderAdded", { label: entry?.name ?? id }));
    if (this.compact) {
      this.tab = "properties";
    }
    this.emit();
  }

  /** Ask a column, after the selected item (else at the end). */
  ask(columnId: string): void {
    const items = toggleFormQuestion(
      this.items(),
      columnId,
      true,
      this.selectedItemId()
    );
    const question = items.find(
      (item) => isFormQuestion(item) && item.columnId === columnId
    );
    this.setItems(items);
    if (question) {
      this.added(question.id);
    }
  }

  addSection(): void {
    const next = addFormSection(this.items(), this.selectedItemId());
    this.setItems(next.questions);
    this.added(next.id);
  }

  addConsent(): void {
    const next = addFormConsent(this.items(), this.selectedItemId());
    this.setItems(next.questions);
    this.added(next.id);
  }

  addHiddenField(): void {
    const next = addFormHiddenField(this.items());
    this.update({ questions: next.questions });
    this.added(next.id);
  }

  /**
   * Remove a question (its column is then not asked), a section, a consent or
   * a hidden field, and the rules left without a target. A question's column
   * gets selected, so it can be asked again.
   */
  remove(id: string): void {
    const key = formBuilderItemKey(id);
    const entry = this.entry(key);
    if (!entry) {
      return;
    }
    const outline = this.outline();
    const group = entry.kind === "hidden" ? outline.hidden : outline.ordered;
    const next = neighbour(
      group.map((item) => item.key),
      key
    );
    const form = this.form();
    this.update(removeFormItem({ ...form, questions: this.items(form) }, id));
    this.selected =
      entry.kind === "question"
        ? formBuilderColumnKey(entry.column.id)
        : (next ?? FORM_BUILDER_FORM);
    this.say(this.label("builderRemoved", { label: entry.name }));
    this.emit();
  }

  private moved(id: string): void {
    const key = formBuilderItemKey(id);
    const { ordered } = this.outline();
    const entry = ordered.find((item) => item.key === key);
    if (entry) {
      this.say(
        this.label("builderMoved", {
          label: entry.name,
          position: entry.index + 1,
          count: ordered.length,
        })
      );
    }
  }

  /** Move an item one place (Alt + ↑ / ↓, or "Move up"); the entry keeps the focus. */
  move(id: string, offset: -1 | 1): void {
    const items = this.items();
    const next = moveFormQuestion(items, id, offset);
    if (sameFormSettings({ questions: items }, { questions: next })) {
      return;
    }
    this.setItems(next);
    this.moved(id);
    this.focusCount += 1;
    this.focus = { key: formBuilderItemKey(id), count: this.focusCount };
    this.emit();
  }

  /** Move an item to `index` among the ordered items. */
  moveTo(id: string, index: number): void {
    this.setItems(moveFormItemTo(this.items(), id, index));
    this.moved(id);
    this.emit();
  }

  // Dragging ----------------------------------------------------------

  startDrag(key: string): void {
    const entry = this.outline().ordered.find((item) => item.key === key);
    if (entry) {
      this.drag = { key, from: entry.index, to: entry.index };
      this.emit();
    }
  }

  /** The place the dragged item would drop at, among the ordered items. */
  dragTo(index: number): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    const last = Math.max(0, this.outline().ordered.length - 1);
    const to = Math.max(0, Math.min(Math.trunc(index), last));
    if (to !== drag.to) {
      this.drag = { ...drag, to };
      this.emit();
    }
  }

  /** Drop the dragged item where it is (`drop`), or cancel the drag. */
  endDrag(drop: boolean): void {
    const drag = this.drag;
    this.drag = undefined;
    const entry = drag && this.entry(drag.key);
    if (drop && drag && entry && drag.to !== drag.from) {
      this.moveTo(entry.id, drag.to);
      return;
    }
    this.emit();
  }

  // Rules -------------------------------------------------------------

  addRule(questionId: string): void {
    const rules = this.form().rules ?? [];
    this.update({
      rules: upsertFormRule(rules, createFormRule(rules, questionId)),
    });
  }

  changeRule(rule: FormRule): void {
    this.update({ rules: upsertFormRule(this.form().rules, rule) });
  }

  removeRule(ruleId: string): void {
    this.update({ rules: removeFormRule(this.form().rules, ruleId) });
  }

  // Fixed values ------------------------------------------------------

  /** The value saved with every response for a column not asked (`undefined`: none). */
  setFixedValue(columnId: string, value: FormHiddenValue | undefined): void {
    const next = { ...this.form().hiddenValues };
    if (value === undefined) {
      Reflect.deleteProperty(next, columnId);
    } else {
      next[columnId] = value;
    }
    this.update({ hiddenValues: next });
  }

  /** Back to the table's form settings (the view keeps none once saved). */
  reset(): void {
    this.draft = {};
    this.justSaved = false;
    if (!this.entry(this.selected)) {
      this.selected = this.firstKey();
    }
    this.emit();
  }

  // Saving and closing ------------------------------------------------

  /** Save the draft in the view; the builder stays open. */
  save(): void {
    const settings = normalizeFormViewConfig(this.draft);
    this.options.onSave(settings);
    this.savedSettings = settings ?? {};
    this.justSaved = true;
    this.say(this.label("builderSaved"));
    this.emit();
  }

  /** Close, or ask first when the draft has unsaved changes. */
  requestClose(): void {
    if (sameFormSettings(this.savedSettings, this.draft)) {
      this.options.onClose();
      return;
    }
    this.confirming = true;
    this.emit();
  }

  keepEditing(): void {
    this.confirming = false;
    this.emit();
  }

  discard(): void {
    this.confirming = false;
    this.emit();
    this.options.onClose();
  }

  saveAndClose(): void {
    this.confirming = false;
    this.save();
    this.options.onClose();
  }
}

// Summary -------------------------------------------------------------------

/** What the View settings say about a view's form, above "Edit form". */
export interface FormBuilderSummary {
  title?: string;
  questions: number;
  sections: number;
  consents: number;
  hiddenFields: number;
  layout: FormLayout;
  review: boolean;
  languages: string[];
}

export function formBuilderSummary(
  columns: readonly FormColumn[],
  defaults: unknown,
  view: unknown,
  locale: string
): FormBuilderSummary {
  const form = mergeFormSettings(defaults, view);
  const items = formQuestionList(columns, form);
  const fallback = formLanguage(locale) || "en";
  const defaultLocale = formDefaultLocale(form) ?? fallback;
  return {
    title: resolveFormText(form.title, locale, defaultLocale),
    questions: items.filter(isFormQuestion).length,
    sections: items.filter(isFormSection).length,
    consents: items.filter(isFormConsent).length,
    hiddenFields: items.filter(isFormHiddenField).length,
    layout: form.layout ?? "page",
    review: form.layout === "steps" && form.review === true,
    languages: formLocales(form, fallback),
  };
}

/** The summary's lines: counts, layout and languages, in the table's language. */
export function formBuilderSummaryLines(
  summary: FormBuilderSummary,
  locale: string,
  translate?: FormTranslate
): string[] {
  const label = (key: FormLabelKey, params?: LabelParams) =>
    formLabel(key, locale, translate, params);
  const counts: [FormLabelKey, number][] = [
    ["summarySections", summary.sections],
    ["summaryConsents", summary.consents],
    ["summaryHiddenFields", summary.hiddenFields],
  ];
  const items = [
    label("summaryQuestions", { count: summary.questions }),
    ...counts.flatMap(([key, count]) => (count ? [label(key, { count })] : [])),
  ];
  const layout =
    summary.layout === "steps"
      ? [label("layoutSteps"), summary.review ? label("summaryReview") : ""]
          .filter(Boolean)
          .join(", ")
      : label("layoutPage");
  return [
    items.join(" · "),
    layout,
    summary.languages.map((language) => formLanguageName(language)).join(", "),
  ];
}

// Dragging in the outline ---------------------------------------------------

const ROW = "[data-form-builder-row]";
const GRIP = "[data-form-builder-grip]";
const SCROLLER = "[data-form-builder-scroll]";
/** Distance from the outline's edges where dragging scrolls it. */
const EDGE = 32;
const EDGE_STEP = 8;

/** Rows above `y` (the dragged one aside): where the dragged row would drop. */
function dropIndex(list: HTMLElement, key: string, y: number): number {
  let index = 0;
  for (const row of list.querySelectorAll<HTMLElement>(ROW)) {
    if (row.dataset.key !== key) {
      const rect = row.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) {
        index += 1;
      }
    }
  }
  return index;
}

function scrollNear(scroller: HTMLElement | null, y: number): void {
  if (!scroller) {
    return;
  }
  const rect = scroller.getBoundingClientRect();
  if (y < rect.top + EDGE) {
    scroller.scrollTop -= EDGE_STEP;
  } else if (y > rect.bottom - EDGE) {
    scroller.scrollTop += EDGE_STEP;
  }
}

/**
 * Reorder the outline's items by dragging their grip (mouse, pen or touch):
 * moving shows where the item would drop, releasing drops it, Escape
 * cancels. Keyboard users move items with Alt + ↑ / ↓. Returns a cleanup.
 */
export function attachFormOutlineDrag(
  list: HTMLElement,
  controller: Pick<FormBuilderController, "dragTo" | "endDrag" | "startDrag">
): () => void {
  let active: { grip: HTMLElement; key: string; pointerId: number } | undefined;

  const onMove = (event: PointerEvent) => {
    if (active && event.pointerId === active.pointerId) {
      scrollNear(list.closest<HTMLElement>(SCROLLER), event.clientY);
      controller.dragTo(dropIndex(list, active.key, event.clientY));
    }
  };
  const finish = (drop: boolean) => {
    const current = active;
    if (!current) {
      return;
    }
    active = undefined;
    current.grip.removeEventListener("pointermove", onMove);
    current.grip.removeEventListener("pointerup", onUp);
    current.grip.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    if (current.grip.hasPointerCapture?.(current.pointerId)) {
      current.grip.releasePointerCapture(current.pointerId);
    }
    controller.endDrag(drop);
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId === active?.pointerId) {
      finish(true);
    }
  };
  const onCancel = () => finish(false);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };
  const onDown = (event: PointerEvent) => {
    const grip = (event.target as Element | null)?.closest<HTMLElement>(GRIP);
    const key = grip?.closest<HTMLElement>(ROW)?.dataset.key;
    if (!(grip && key && event.button === 0 && list.contains(grip))) {
      return;
    }
    event.preventDefault();
    finish(false);
    active = { grip, key, pointerId: event.pointerId };
    grip.setPointerCapture?.(event.pointerId);
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    controller.startDrag(key);
  };
  list.addEventListener("pointerdown", onDown);
  return () => {
    finish(false);
    list.removeEventListener("pointerdown", onDown);
  };
}
