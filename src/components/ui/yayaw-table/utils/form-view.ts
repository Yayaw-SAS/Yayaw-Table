/**
 * Form view model shared by the React and Vue editions: settings, questions,
 * validation, submissions, labels and the public-link contract. It has no UI
 * or state-library dependency, so a host can also run it on its server.
 */
import {
  type ConditionField,
  type ConditionFieldType,
  type ConditionGroup,
  type ConditionOperator,
  type ConditionValue,
  type ConditionWords,
  describeRule,
  evaluateForm,
  type FormEvaluation,
  type FormRule,
  type FormRuleAction,
  normalizeRules,
  type RuleIssue,
  type RuleIssueCode,
  sanitizeRules,
  validateRules,
} from "./form-conditions";
import { resolveDataType, TABLE_DATA_TYPES } from "./table-contracts";
import {
  formatDateValue,
  formatNumberValue,
  type NumberFormatConfig,
} from "./value-format";

/** The input a question renders, derived from its column type. */
export type FormEditor =
  | "boolean"
  | "date"
  | "multiSelect"
  | "number"
  | "select"
  | "text"
  | "textarea"
  | "url";

/** What the form needs from a table column. */
export interface FormColumn {
  id: string;
  header: string;
  type?: string;
  options?: unknown;
  accessorKey?: unknown;
  accessorFn?: unknown;
  /** `"tag"` shows the options as tags, like the table cells. */
  displayVariant?: string;
  /** Colored tags (default true); the Form view passes the table's setting. */
  coloredTags?: boolean;
  /** How the table shows numbers, e.g. `{ currency: "EUR" }`. */
  numberFormat?: unknown;
}

/**
 * One question of the form. `id` is stable (it defaults to the column id) so
 * later features, such as conditions, can point at a question.
 */
export interface FormQuestion {
  id: string;
  /** Column that receives the answer. */
  columnId: string;
  /** Replaces the column name. */
  label?: string;
  /** Shown under the label. */
  help?: string;
  placeholder?: string;
  required?: boolean;
}

/**
 * A section break: starts a titled group of questions. In the steps layout,
 * each section is one step. Rules may show or hide a section (and its
 * questions) by its id.
 */
export interface FormSectionBreak {
  id: string;
  kind: "section";
  title?: string;
  description?: string;
}

/** A question or a section break, in form order. */
export type FormItem = FormQuestion | FormSectionBreak;

/** `page` shows every question at once; `steps` one question (or section) at a time. */
export type FormLayout = "page" | "steps";

export interface FormViewSettings {
  title?: string;
  description?: string;
  /** Questions (and section breaks) in order; unset asks every column that has an editor. */
  questions?: FormItem[];
  /**
   * Show, hide or require questions from earlier answers. Conditions point
   * at question ids (`fieldId`), effects at question or section ids
   * (`then.questionIds`). See `utils/form-conditions.ts`.
   */
  rules?: FormRule[];
  /** `page` (default) or `steps`. */
  layout?: FormLayout;
  /** In steps, end with a review of the answers before sending. */
  review?: boolean;
  /** Fixed values saved with every response, for columns not asked (e.g. `{ status: "New" }`). */
  hiddenValues?: Record<string, FormHiddenValue>;
  submitLabel?: string;
  successMessage?: string;
  /** Offer "Submit another response" after a success (default true). */
  allowAnotherResponse?: boolean;
  /** Where the host may send people after a success; the host decides whether to follow it. */
  redirectUrl?: string;
}

export type FormHiddenValue = boolean | number | string | (number | string)[];

export interface FormOption {
  value: unknown;
  label: string;
}

export interface ResolvedFormQuestion {
  id: string;
  columnId: string;
  editor: FormEditor;
  /** Column name or the label override. */
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
  options: FormOption[];
  /** Options shown as tags, as the column displays them. */
  tags: boolean;
  /** Tags get their automatic color. */
  coloredTags: boolean;
  /** Number display of the column, used once the answer is typed. */
  numberFormat?: NumberFormatConfig;
}

export interface ResolvedFormSection {
  id: string;
  kind: "section";
  title?: string;
  description?: string;
}

/** Questions and sections in form order. */
export type ResolvedFormItem =
  | { kind: "question"; question: ResolvedFormQuestion }
  | { kind: "section"; section: ResolvedFormSection };

export interface ResolvedFormSettings {
  title?: string;
  description?: string;
  /** The asked questions, without sections. */
  questions: ResolvedFormQuestion[];
  /** Questions and section breaks in order. */
  items: ResolvedFormItem[];
  /** Rules that can act (broken or cyclic ones are dropped). */
  rules: FormRule[];
  layout: FormLayout;
  review: boolean;
  hiddenValues: Record<string, FormHiddenValue>;
  submitLabel?: string;
  successMessage?: string;
  allowAnotherResponse: boolean;
  redirectUrl?: string;
}

/** Raw answers as the inputs hold them, keyed by column id. */
export type FormDraft = Record<string, boolean | string | string[]>;

/** What `onSubmit` resolves: success, or errors keyed by column id and a message. */
export type FormSubmitResult =
  | { ok: true }
  | { ok?: false; errors?: Record<string, string>; message?: string };

export const FORM_VIEW_DEFAULTS = {
  allowAnotherResponse: true,
} as const satisfies FormViewSettings;

const TEXT_KEYS = [
  "title",
  "description",
  "submitLabel",
  "successMessage",
] as const;
const QUESTION_TEXT_KEYS = ["label", "help", "placeholder"] as const;
const SECTION_TEXT_KEYS = ["title", "description"] as const;
const SAFE_URL = /^(https?:\/\/|\/(?!\/))/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EXCLUDED_IDS = new Set(["select", "actions"]);
const EDITORS: Partial<Record<string, FormEditor>> = {
  date: "date",
  multiSelect: "multiSelect",
  number: "number",
  select: "select",
  switch: "boolean",
  text: "text",
  textarea: "textarea",
  url: "url",
};

const text = (value: unknown): string | undefined => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isHiddenScalar = (value: unknown): value is number | string =>
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value));

function normalizeHiddenValue(value: unknown): FormHiddenValue | undefined {
  if (typeof value === "boolean" || isHiddenScalar(value)) {
    return value === "" ? undefined : value;
  }
  if (Array.isArray(value) && value.every(isHiddenScalar)) {
    return value.length ? [...value] : undefined;
  }
}

/** Whether a form item is a section break rather than a question. */
export const isFormSection = (item: unknown): item is FormSectionBreak =>
  isRecord(item) && item.kind === "section";

function normalizeSection(
  value: Record<string, unknown>
): FormSectionBreak | undefined {
  const id = text(value.id);
  if (!id) {
    return;
  }
  const section: FormSectionBreak = { id, kind: "section" };
  for (const key of SECTION_TEXT_KEYS) {
    const content = text(value[key]);
    if (content) {
      section[key] = content;
    }
  }
  return section;
}

function normalizeItem(value: unknown): FormItem | undefined {
  if (!isRecord(value)) {
    return;
  }
  return isFormSection(value)
    ? normalizeSection(value)
    : normalizeQuestion(value);
}

function normalizeQuestion(value: unknown): FormQuestion | undefined {
  if (!isRecord(value)) {
    return;
  }
  const columnId = text(value.columnId) ?? text(value.id);
  if (!columnId) {
    return;
  }
  const question: FormQuestion = { id: text(value.id) ?? columnId, columnId };
  for (const key of QUESTION_TEXT_KEYS) {
    const content = text(value[key]);
    if (content) {
      question[key] = content;
    }
  }
  if (typeof value.required === "boolean") {
    question.required = value.required;
  }
  return question;
}

/** Questions and sections in order, each column and id at most once. */
export function normalizeFormQuestions(value: unknown): FormItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = new Set<string>();
  const columns = new Set<string>();
  const items: FormItem[] = [];
  for (const entry of value) {
    const item = normalizeItem(entry);
    const column = item && !isFormSection(item) ? item.columnId : undefined;
    if (item && !ids.has(item.id) && !(column && columns.has(column))) {
      ids.add(item.id);
      if (column) {
        columns.add(column);
      }
      items.push(item);
    }
  }
  return items;
}

function normalizeHiddenValues(
  value: unknown
): Record<string, FormHiddenValue> | undefined {
  if (!isRecord(value)) {
    return;
  }
  const entries = Object.entries(value).flatMap(([key, item]) => {
    const normalized = normalizeHiddenValue(item);
    return key.trim() && normalized !== undefined ? [[key, normalized]] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Keep only valid form settings; unknown or malformed values are dropped. */
export function normalizeFormViewConfig(
  value: unknown
): FormViewSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const normalized: FormViewSettings = {};
  for (const key of TEXT_KEYS) {
    const content = text(value[key]);
    if (content) {
      normalized[key] = content;
    }
  }
  if (Array.isArray(value.questions)) {
    normalized.questions = normalizeFormQuestions(value.questions);
  }
  const hiddenValues = normalizeHiddenValues(value.hiddenValues);
  if (hiddenValues) {
    normalized.hiddenValues = hiddenValues;
  }
  if (typeof value.allowAnotherResponse === "boolean") {
    normalized.allowAnotherResponse = value.allowAnotherResponse;
  }
  if (Array.isArray(value.rules)) {
    normalized.rules = sanitizeRules(value.rules);
  }
  if (value.layout === "steps" || value.layout === "page") {
    normalized.layout = value.layout;
  }
  if (typeof value.review === "boolean") {
    normalized.review = value.review;
  }
  const redirectUrl = text(value.redirectUrl);
  if (redirectUrl && SAFE_URL.test(redirectUrl)) {
    normalized.redirectUrl = redirectUrl;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

/** The editor a column gets in a form, or none for computed and custom values. */
export function formColumnEditor(column: FormColumn): FormEditor | undefined {
  if (EXCLUDED_IDS.has(column.id) || column.accessorFn) {
    return;
  }
  if (column.type === "dynamicType" || column.type === "custom") {
    return;
  }
  const kind = TABLE_DATA_TYPES[resolveDataType(column.type)].form;
  if (column.type === "code") {
    return "textarea";
  }
  return kind ? EDITORS[kind] : undefined;
}

/** Columns a form can ask, and the others (listed with a note in the settings). */
export function formColumns<T extends FormColumn>(
  columns: readonly T[]
): { eligible: T[]; excluded: T[] } {
  const eligible: T[] = [];
  const excluded: T[] = [];
  for (const column of columns) {
    if (EXCLUDED_IDS.has(column.id) || column.type === "actions") {
      continue;
    }
    (formColumnEditor(column) ? eligible : excluded).push(column);
  }
  return { eligible, excluded };
}

/** `[{ value, label }]` or plain values, as columns declare options. */
export function formOptions(options: unknown): FormOption[] {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.flatMap((option) => {
    if (isRecord(option) && "value" in option) {
      return [
        {
          value: option.value,
          label: String(option.label ?? option.value ?? ""),
        },
      ];
    }
    return isHiddenScalar(option)
      ? [{ value: option, label: String(option) }]
      : [];
  });
}

/** Settings of a form: its defaults, then the table's, then the view's. */
export function mergeFormSettings(
  defaults: unknown,
  view: unknown
): FormViewSettings {
  return {
    ...FORM_VIEW_DEFAULTS,
    ...normalizeFormViewConfig(defaults),
    ...normalizeFormViewConfig(view),
  };
}

const isNumberFormat = (value: unknown): value is NumberFormatConfig =>
  typeof value === "string" || isRecord(value);

function resolveQuestion(
  question: FormQuestion,
  column: FormColumn,
  editor: FormEditor
): ResolvedFormQuestion {
  return {
    id: question.id,
    columnId: column.id,
    editor,
    label: question.label ?? column.header,
    help: question.help,
    placeholder: question.placeholder,
    required: question.required === true,
    options: formOptions(column.options),
    tags: column.displayVariant === "tag",
    coloredTags: column.coloredTags !== false,
    numberFormat: isNumberFormat(column.numberFormat)
      ? column.numberFormat
      : undefined,
  };
}

const defaultItems = (eligible: readonly FormColumn[]): FormItem[] =>
  eligible.map((column) => ({ id: column.id, columnId: column.id }));

function resolveItems(
  items: readonly FormItem[],
  byId: Map<string, FormColumn>
): ResolvedFormItem[] {
  return items.flatMap((item): ResolvedFormItem[] => {
    if (isFormSection(item)) {
      return [{ kind: "section", section: { ...item } }];
    }
    const column = byId.get(item.columnId);
    const editor = column && formColumnEditor(column);
    return column && editor
      ? [{ kind: "question", question: resolveQuestion(item, column, editor) }]
      : [];
  });
}

const EDITOR_CONDITION: Record<FormEditor, ConditionFieldType> = {
  boolean: "checkbox",
  date: "date",
  multiSelect: "multiSelect",
  number: "number",
  select: "select",
  text: "text",
  textarea: "text",
  url: "text",
};

/** Questions as the conditions engine sees them (id, type, label, options). */
export function formConditionFields(
  questions: readonly ResolvedFormQuestion[]
): ConditionField[] {
  return questions.map((question) => ({
    id: question.id,
    type: EDITOR_CONDITION[question.editor],
    label: question.label,
    options: question.options,
    required: question.required,
  }));
}

const itemIds = (items: readonly ResolvedFormItem[]) =>
  items.map((item) =>
    item.kind === "section" ? item.section.id : item.question.id
  );

const sectionIds = (items: readonly ResolvedFormItem[]) =>
  items.flatMap((item) => (item.kind === "section" ? [item.section.id] : []));

/** Everything a form renders, with questions limited to columns it can edit. */
export function resolveFormSettings(
  columns: readonly FormColumn[],
  defaults: unknown,
  view: unknown
): ResolvedFormSettings {
  const settings = mergeFormSettings(defaults, view);
  const { eligible } = formColumns(columns);
  const byId = new Map(eligible.map((column) => [column.id, column]));
  const items = resolveItems(
    settings.questions ?? defaultItems(eligible),
    byId
  );
  const questions = items.flatMap((item) =>
    item.kind === "question" ? [item.question] : []
  );
  const asked = new Set(questions.map((question) => question.columnId));
  const hiddenValues = Object.fromEntries(
    Object.entries(settings.hiddenValues ?? {}).filter(
      ([columnId]) => byId.has(columnId) && !asked.has(columnId)
    )
  );
  const layout = settings.layout ?? "page";
  const { rules } = normalizeRules(
    settings.rules ?? [],
    formConditionFields(questions),
    { targets: sectionIds(items), order: itemIds(items), layout }
  );
  return {
    title: settings.title,
    description: settings.description,
    questions,
    items,
    rules,
    layout,
    review: settings.review === true,
    hiddenValues,
    submitLabel: settings.submitLabel,
    successMessage: settings.successMessage,
    allowAnotherResponse: settings.allowAnotherResponse !== false,
    redirectUrl: settings.redirectUrl,
  };
}

/** The questions and sections a settings panel edits: the view's, or one per editable column. */
export function formQuestionList(
  columns: readonly FormColumn[],
  settings: FormViewSettings
): FormItem[] {
  const { eligible } = formColumns(columns);
  const known = new Set(eligible.map((column) => column.id));
  return (settings.questions ?? defaultItems(eligible)).filter(
    (item) => isFormSection(item) || known.has(item.columnId)
  );
}

/** Move a question or section one place up (-1) or down (+1); other positions are kept. */
export function moveFormQuestion<T extends FormItem>(
  questions: readonly T[],
  id: string,
  offset: -1 | 1
): T[] {
  const index = questions.findIndex((question) => question.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= questions.length) {
    return [...questions];
  }
  const next = [...questions];
  const [moved] = next.splice(index, 1);
  if (moved) {
    next.splice(target, 0, moved);
  }
  return next;
}

/** Ask a column (appended at the end) or stop asking it. */
export function toggleFormQuestion(
  questions: readonly FormItem[],
  columnId: string,
  asked: boolean
): FormItem[] {
  const rest = questions.filter(
    (question) => isFormSection(question) || question.columnId !== columnId
  );
  return asked ? [...rest, { id: columnId, columnId }] : rest;
}

type FormItemPatch = Partial<
  Omit<FormQuestion, "columnId" | "id"> & Omit<FormSectionBreak, "id" | "kind">
>;

/** Change one question or section; empty texts and `required: false` are removed. */
export function updateFormQuestion(
  questions: readonly FormItem[],
  id: string,
  patch: FormItemPatch
): FormItem[] {
  return questions.map((item) => {
    if (item.id !== id) {
      return item;
    }
    if (isFormSection(item)) {
      return normalizeItem({ ...item, ...patch, kind: "section" }) ?? item;
    }
    return (
      normalizeQuestion({
        ...item,
        ...patch,
        required: patch.required ?? item.required,
      }) ?? item
    );
  });
}

/** Add an empty section break after `afterId` (or at the end); returns the items and its id. */
export function addFormSection(
  questions: readonly FormItem[],
  afterId?: string
): { questions: FormItem[]; id: string } {
  const ids = new Set(questions.map((item) => item.id));
  let count = questions.filter(isFormSection).length + 1;
  while (ids.has(`section-${count}`)) {
    count += 1;
  }
  const id = `section-${count}`;
  const after = afterId
    ? questions.findIndex((item) => item.id === afterId) + 1
    : 0;
  const index = after > 0 ? after : questions.length;
  const next: FormItem[] = [...questions];
  next.splice(index, 0, { id, kind: "section" });
  return { questions: next, id };
}

/** Remove a section break (its questions stay) and the rules left without a target. */
export function removeFormSection(
  settings: Pick<FormViewSettings, "questions" | "rules">,
  id: string
): Pick<FormViewSettings, "questions" | "rules"> {
  return {
    questions: (settings.questions ?? []).filter((item) => item.id !== id),
    rules: settings.rules
      ?.map((rule) => {
        const then = {
          ...rule.then,
          questionIds: rule.then.questionIds?.filter((target) => target !== id),
        };
        return { ...rule, then };
      })
      .filter((rule) => rule.then.questionIds?.length),
  };
}

const emptyAnswer = (editor: FormEditor): boolean | string | string[] => {
  if (editor === "boolean") {
    return false;
  }
  return editor === "multiSelect" ? [] : "";
};

/** Blank answers for every question. */
export function initialFormDraft(
  questions: readonly ResolvedFormQuestion[]
): FormDraft {
  return Object.fromEntries(
    questions.map((question) => [
      question.columnId,
      emptyAnswer(question.editor),
    ])
  );
}

const optionFor = (question: ResolvedFormQuestion, raw: string) =>
  question.options.find((option) => String(option.value) === raw);

function coerceAnswer(
  question: ResolvedFormQuestion,
  raw: FormDraft[string] | undefined
): unknown {
  if (question.editor === "boolean") {
    return raw === true;
  }
  if (question.editor === "multiSelect") {
    const values = Array.isArray(raw) ? raw : [];
    return values.map((item) => optionFor(question, item)?.value ?? item);
  }
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return;
  }
  if (question.editor === "number") {
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) ? number : value;
  }
  if (question.editor === "select") {
    return optionFor(question, value)?.value ?? value;
  }
  return value;
}

/** Typed answers keyed by column id; empty answers are left out. */
export function formDraftValues(
  questions: readonly ResolvedFormQuestion[],
  draft: FormDraft
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const question of questions) {
    const value = coerceAnswer(question, draft[question.columnId]);
    const empty = Array.isArray(value) && value.length === 0;
    if (value !== undefined && !empty) {
      values[question.columnId] = value;
    }
  }
  return values;
}

export type FormErrorCode =
  | "errorDate"
  | "errorNumber"
  | "errorOption"
  | "errorRequired"
  | "errorUrl";

const isBlank = (value: unknown, editor: FormEditor): boolean => {
  if (editor === "boolean") {
    return value !== true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === undefined || value === null || value === "";
};

const validDate = (value: unknown): boolean => {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
  );
};

const validUrl = (value: unknown): boolean => {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** A typed number as its column shows it, or undefined while it is not a number. */
export function formNumberDisplay(
  raw: string,
  format: NumberFormatConfig | undefined,
  locale: string
): string | undefined {
  const value = raw.trim();
  const number = Number(value.replace(",", "."));
  if (!(value && Number.isFinite(number))) {
    return;
  }
  return formatNumberValue(number, format, locale);
}

/** A date answer (`YYYY-MM-DD`) in the reader's language, e.g. "Sep 30, 2026". */
export function formDateDisplay(
  raw: string,
  locale: string
): string | undefined {
  return validDate(raw)
    ? formatDateValue(raw, { preset: "localized-medium", locale })
    : undefined;
}

/** The answer of a picked calendar day, as `YYYY-MM-DD`. */
export function formDateAnswer(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * An answer as the review step shows it: option labels, the column's number
 * format, dates in the form's language; `undefined` when unanswered.
 */
export function formAnswerText(
  question: ResolvedFormQuestion,
  raw: FormDraft[string] | undefined,
  locale: string,
  words: { yes: string; no: string }
): string | undefined {
  if (question.editor === "boolean") {
    return raw === true ? words.yes : words.no;
  }
  if (Array.isArray(raw)) {
    return raw.length
      ? raw.map((item) => optionFor(question, item)?.label ?? item).join(", ")
      : undefined;
  }
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return;
  }
  switch (question.editor) {
    case "select":
      return optionFor(question, value)?.label ?? value;
    case "number":
      return formNumberDisplay(value, question.numberFormat, locale) ?? value;
    case "date":
      return formDateDisplay(value, locale) ?? value;
    default:
      return value;
  }
}

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/** First day of the week in a locale's calendar: 0 Sunday, 1 Monday, 6 Saturday. */
export function formWeekStart(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & WeekInfoLocale;
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    if (firstDay) {
      return firstDay % 7;
    }
  } catch {
    // An unknown locale falls back below.
  }
  return locale.toLowerCase().startsWith("en-us") || locale === "en" ? 0 : 1;
}

const knownOption = (question: ResolvedFormQuestion, value: unknown) =>
  question.options.length === 0 ||
  question.options.some((option) => Object.is(option.value, value));

function typeError(
  question: ResolvedFormQuestion,
  value: unknown
): FormErrorCode | undefined {
  switch (question.editor) {
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? undefined
        : "errorNumber";
    case "date":
      return validDate(value) ? undefined : "errorDate";
    case "url":
      return validUrl(value) ? undefined : "errorUrl";
    case "select":
      return knownOption(question, value) ? undefined : "errorOption";
    case "multiSelect":
      return Array.isArray(value) &&
        value.every((item) => knownOption(question, item))
        ? undefined
        : "errorOption";
    case "boolean":
      return typeof value === "boolean" ? undefined : "errorOption";
    default:
      return typeof value === "string" ? undefined : "errorRequired";
  }
}

/**
 * Error codes keyed by column id, for typed answers. Runs in the browser and,
 * for public forms, again on the host's server. With an `evaluation` (see
 * `evaluateFormView`), hidden questions are skipped and "required" follows
 * the rules.
 */
export function validateFormValues(
  questions: readonly ResolvedFormQuestion[],
  values: Record<string, unknown>,
  evaluation?: Pick<FormEvaluation, "hidden" | "required">
): Record<string, FormErrorCode> {
  const errors: Record<string, FormErrorCode> = {};
  for (const question of questions) {
    if (evaluation?.hidden.has(question.id)) {
      continue;
    }
    const value = values[question.columnId];
    const required = evaluation
      ? evaluation.required.has(question.id)
      : question.required;
    if (isBlank(value, question.editor)) {
      if (required) {
        errors[question.columnId] = "errorRequired";
      }
      continue;
    }
    const error = typeError(question, value);
    if (error) {
      errors[question.columnId] = error;
    }
  }
  return errors;
}

/** Section ids with the questions that follow them, until the next section. */
export function formSectionGroups(
  items: readonly ResolvedFormItem[]
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  let current: string[] | undefined;
  for (const item of items) {
    if (item.kind === "section") {
      current = [];
      groups[item.section.id] = current;
    } else {
      current?.push(item.question.id);
    }
  }
  return groups;
}

/**
 * Which questions and sections show, which are required and what `set`
 * rules write, for typed answers keyed by column id.
 */
export function evaluateFormView(
  settings: Pick<ResolvedFormSettings, "items" | "questions" | "rules">,
  values: Record<string, unknown>,
  options: { now?: Date } = {}
): FormEvaluation {
  const answers = Object.fromEntries(
    settings.questions.map((question) => [
      question.id,
      values[question.columnId],
    ])
  );
  return evaluateForm(
    settings.rules,
    answers,
    formConditionFields(settings.questions),
    { now: options.now, groups: formSectionGroups(settings.items) }
  );
}

/** Answers keyed by column id without hidden questions, with `set` values applied. */
export function formVisibleValues(
  settings: Pick<ResolvedFormSettings, "items" | "questions" | "rules">,
  values: Record<string, unknown>,
  evaluation: FormEvaluation = evaluateFormView(settings, values)
): Record<string, unknown> {
  const output = { ...values };
  for (const question of settings.questions) {
    if (evaluation.hidden.has(question.id)) {
      Reflect.deleteProperty(output, question.columnId);
    } else if (Object.hasOwn(evaluation.setValues, question.id)) {
      output[question.columnId] = evaluation.setValues[question.id];
    }
  }
  return output;
}

/** The record a response creates: hidden values, then the visible answers. */
export function formSubmission(
  settings: ResolvedFormSettings,
  values: Record<string, unknown>
): Record<string, unknown> {
  return { ...settings.hiddenValues, ...formVisibleValues(settings, values) };
}

/** One screen of the steps layout: a question, or a section and its questions. */
export interface FormStep {
  id: string;
  section?: ResolvedFormSection;
  questions: ResolvedFormQuestion[];
}

const stepsBySection = (
  items: readonly ResolvedFormItem[],
  visible: (id: string) => boolean
): FormStep[] => {
  const steps: FormStep[] = [];
  let current: FormStep = { id: "start", questions: [] };
  for (const item of items) {
    if (item.kind === "section") {
      steps.push(current);
      current = { id: item.section.id, section: item.section, questions: [] };
    } else if (visible(item.question.id)) {
      current.questions.push(item.question);
    }
  }
  steps.push(current);
  return steps.filter(
    (step) =>
      step.questions.length > 0 && (!step.section || visible(step.section.id))
  );
};

/**
 * Steps of the steps layout, skipping what the rules hide: one per question,
 * or one per section when the form has section breaks.
 */
export function formSteps(
  settings: Pick<ResolvedFormSettings, "items">,
  evaluation?: Pick<FormEvaluation, "hidden">
): FormStep[] {
  const visible = (id: string) => !evaluation?.hidden.has(id);
  if (settings.items.some((item) => item.kind === "section")) {
    return stepsBySection(settings.items, visible);
  }
  return settings.items.flatMap((item) =>
    item.kind === "question" && visible(item.question.id)
      ? [{ id: item.question.id, questions: [item.question] }]
      : []
  );
}

/** Whether a step may be skipped: none of its visible questions is required. */
export const formStepOptional = (
  step: FormStep,
  evaluation: Pick<FormEvaluation, "required">
): boolean =>
  !step.questions.some((question) => evaluation.required.has(question.id));

// Labels ------------------------------------------------------------------

export type FormLabelKey = keyof typeof ENGLISH_LABELS;

const ENGLISH_LABELS = {
  submit: "Submit",
  submitting: "Submitting…",
  success: "Thank you, your response has been recorded.",
  successTitle: "Response sent",
  another: "Submit another response",
  required: "required",
  choose: "Choose…",
  errorRequired: "Answer this question.",
  errorNumber: "Enter a number.",
  errorDate: "Enter a valid date.",
  errorUrl: "Enter a full web address, starting with https://",
  errorOption: "Choose one of the options.",
  errorSummary:
    "{count, plural, one {1 answer needs attention.} other {{count} answers need attention.}}",
  submitError: "Your response could not be sent. Try again.",
  closed: "This form is no longer accepting responses.",
  noQuestions: "This form has no questions yet.",
  settings: "Form",
  settingsTitle: "Form settings",
  title: "Title",
  description: "Description",
  questions: "Questions",
  ask: "Ask {label}",
  moveUp: "Move {label} up",
  moveDown: "Move {label} down",
  editQuestion: "Edit {label}",
  label: "Question",
  help: "Help text",
  placeholder: "Placeholder",
  requiredToggle: "Required",
  hidden: "Fixed values",
  hiddenHint: "Saved with every response for columns the form does not ask.",
  hiddenValue: "Value for {label}",
  none: "None",
  excluded: "Not available in forms: {columns}.",
  afterSubmit: "After submitting",
  submitLabel: "Submit button",
  successMessage: "Success message",
  allowAnother: "Offer another response",
  redirectUrl: "Redirect URL",
  redirectHint: "The application decides whether to follow it.",
  reset: "Reset",
  share: "Share form",
  publish: "Publish to the web",
  publicLink: "Public link",
  copy: "Copy link",
  copied: "Link copied",
  open: "Open",
  acceptResponses: "Accept responses",
  republish: "Update public form",
  republishHint:
    "Changes to questions reach the public link when you update it.",
  saveFirst: "Save this view to share its form.",
  shareError: "Sharing could not be updated. Try again.",
  loading: "Loading…",
  pickDate: "Pick a date",
  clearDate: "Clear",
  close: "Close",
  publishHint: "Anyone with the link can answer this form.",
  layout: "Layout",
  layoutPage: "One page",
  layoutSteps: "Step by step",
  review: "Review answers before sending",
  next: "Next",
  back: "Back",
  skip: "Skip",
  stepProgress: "Step {current} of {total}",
  reviewTitle: "Review your answers",
  reviewChange: "Change {label}",
  noAnswer: "No answer",
  yes: "Yes",
  no: "No",
  addSection: "Add section",
  section: "Section",
  sectionTitle: "Section title",
  sectionDescription: "Section description",
  untitledSection: "Untitled section",
  editSection: "Edit {label}",
  removeSection: "Remove {label}",
  conditions: "Conditions",
  addRule: "Add a condition",
  ruleAction: "Rule",
  actionShow: "Show this question when…",
  actionHide: "Hide this question when…",
  actionRequire: "Require this question when…",
  joinAnd: "All of these",
  joinOr: "Any of these",
  ruleJoin: "Match",
  ruleField: "Question",
  ruleOperator: "Comparison",
  ruleValue: "Value",
  ruleFrom: "From",
  ruleTo: "To",
  ruleDays: "Days",
  chooseQuestion: "Choose a question",
  addCondition: "Add condition",
  addGroup: "Add group",
  removeCondition: "Remove condition",
  removeGroup: "Remove group",
  removeRule: "Remove rule",
  ruleGroup: "Group",
  issueMissingField: "Choose a question.",
  issueUnknownField: "This question is no longer asked.",
  issueOperator: "This comparison does not fit the question.",
  issueMissingValue: "Enter a value.",
  issueUnknownOption: "Choose one of the options.",
  issueEmptyGroup: "Add a condition.",
  issueCycle: "These conditions depend on each other in a loop.",
  issueLaterQuestion:
    "In step-by-step forms, this can only use earlier questions.",
  issueSelfReference: "A question cannot depend on itself.",
  issueTarget: "This rule acts on no question.",
  thenShow: "Shown when {condition}",
  thenHide: "Hidden when {condition}",
  thenRequire: "Required when {condition}",
  thenSet: "Set to {value} when {condition}",
  ruleAnd: "and",
  ruleOr: "or",
  ruleCustom: "a custom condition",
  opIs: "{field} is {value}",
  opIsNot: "{field} is not {value}",
  opContains: "{field} contains {value}",
  opNotContains: "{field} does not contain {value}",
  opStartsWith: "{field} starts with {value}",
  opEq: "{field} = {value}",
  opNeq: "{field} ≠ {value}",
  opLt: "{field} < {value}",
  opLte: "{field} ≤ {value}",
  opGt: "{field} > {value}",
  opGte: "{field} ≥ {value}",
  opBetween: "{field} is between {from} and {to}",
  opOn: "{field} is on {value}",
  opBefore: "{field} is before {value}",
  opAfter: "{field} is after {value}",
  opInLast: "{field} is in the last {value} days",
  opInNext: "{field} is in the next {value} days",
  opIsAnyOf: "{field} is any of {value}",
  opIsNoneOf: "{field} is none of {value}",
  opContainsAny: "{field} contains any of {value}",
  opContainsAll: "{field} contains all of {value}",
  opContainsNone: "{field} contains none of {value}",
  opIsChecked: "{field} is checked",
  opIsUnchecked: "{field} is unchecked",
  opIsEmpty: "{field} is empty",
  opIsNotEmpty: "{field} is not empty",
} as const;

const FRENCH_LABELS: Record<FormLabelKey, string> = {
  submit: "Envoyer",
  submitting: "Envoi…",
  success: "Merci, votre réponse a bien été enregistrée.",
  successTitle: "Réponse envoyée",
  another: "Envoyer une autre réponse",
  required: "obligatoire",
  choose: "Choisir…",
  errorRequired: "Répondez à cette question.",
  errorNumber: "Saisissez un nombre.",
  errorDate: "Saisissez une date valide.",
  errorUrl: "Saisissez une adresse web complète, commençant par https://",
  errorOption: "Choisissez l’une des options.",
  errorSummary:
    "{count, plural, one {1 réponse est à corriger.} other {{count} réponses sont à corriger.}}",
  submitError: "Votre réponse n’a pas pu être envoyée. Réessayez.",
  closed: "Ce formulaire n’accepte plus de réponses.",
  noQuestions: "Ce formulaire n’a pas encore de question.",
  settings: "Formulaire",
  settingsTitle: "Paramètres du formulaire",
  title: "Titre",
  description: "Description",
  questions: "Questions",
  ask: "Poser {label}",
  moveUp: "Monter {label}",
  moveDown: "Descendre {label}",
  editQuestion: "Modifier {label}",
  label: "Question",
  help: "Texte d’aide",
  placeholder: "Texte indicatif",
  requiredToggle: "Obligatoire",
  hidden: "Valeurs fixes",
  hiddenHint:
    "Enregistrées avec chaque réponse pour les colonnes que le formulaire ne demande pas.",
  hiddenValue: "Valeur pour {label}",
  none: "Aucune",
  excluded: "Indisponibles dans les formulaires : {columns}.",
  afterSubmit: "Après l’envoi",
  submitLabel: "Bouton d’envoi",
  successMessage: "Message de confirmation",
  allowAnother: "Proposer une autre réponse",
  redirectUrl: "URL de redirection",
  redirectHint: "L’application décide de la suivre ou non.",
  reset: "Réinitialiser",
  share: "Partager le formulaire",
  publish: "Publier sur le web",
  publicLink: "Lien public",
  copy: "Copier le lien",
  copied: "Lien copié",
  open: "Ouvrir",
  acceptResponses: "Accepter les réponses",
  republish: "Mettre à jour le formulaire public",
  republishHint:
    "Les modifications des questions arrivent sur le lien public quand vous le mettez à jour.",
  saveFirst: "Enregistrez cette vue pour partager son formulaire.",
  shareError: "Le partage n’a pas pu être mis à jour. Réessayez.",
  loading: "Chargement…",
  pickDate: "Choisir une date",
  clearDate: "Effacer",
  close: "Fermer",
  publishHint:
    "Toute personne disposant du lien peut répondre à ce formulaire.",
  layout: "Présentation",
  layoutPage: "Une seule page",
  layoutSteps: "Étape par étape",
  review: "Relire les réponses avant l’envoi",
  next: "Suivant",
  back: "Retour",
  skip: "Passer",
  stepProgress: "Étape {current} sur {total}",
  reviewTitle: "Relisez vos réponses",
  reviewChange: "Modifier {label}",
  noAnswer: "Pas de réponse",
  yes: "Oui",
  no: "Non",
  addSection: "Ajouter une section",
  section: "Section",
  sectionTitle: "Titre de la section",
  sectionDescription: "Description de la section",
  untitledSection: "Section sans titre",
  editSection: "Modifier {label}",
  removeSection: "Supprimer {label}",
  conditions: "Conditions",
  addRule: "Ajouter une condition",
  ruleAction: "Règle",
  actionShow: "Afficher cette question si…",
  actionHide: "Masquer cette question si…",
  actionRequire: "Rendre cette question obligatoire si…",
  joinAnd: "Toutes ces conditions",
  joinOr: "L’une de ces conditions",
  ruleJoin: "Correspondance",
  ruleField: "Question",
  ruleOperator: "Comparaison",
  ruleValue: "Valeur",
  ruleFrom: "De",
  ruleTo: "À",
  ruleDays: "Jours",
  chooseQuestion: "Choisir une question",
  addCondition: "Ajouter une condition",
  addGroup: "Ajouter un groupe",
  removeCondition: "Supprimer la condition",
  removeGroup: "Supprimer le groupe",
  removeRule: "Supprimer la règle",
  ruleGroup: "Groupe",
  issueMissingField: "Choisissez une question.",
  issueUnknownField: "Cette question n’est plus posée.",
  issueOperator: "Cette comparaison ne convient pas à la question.",
  issueMissingValue: "Saisissez une valeur.",
  issueUnknownOption: "Choisissez l’une des options.",
  issueEmptyGroup: "Ajoutez une condition.",
  issueCycle: "Ces conditions dépendent les unes des autres en boucle.",
  issueLaterQuestion:
    "Dans un formulaire par étapes, seules les questions précédentes peuvent être utilisées.",
  issueSelfReference: "Une question ne peut pas dépendre d’elle-même.",
  issueTarget: "Cette règle ne s’applique à aucune question.",
  thenShow: "Affichée si {condition}",
  thenHide: "Masquée si {condition}",
  thenRequire: "Obligatoire si {condition}",
  thenSet: "Vaut {value} si {condition}",
  ruleAnd: "et",
  ruleOr: "ou",
  ruleCustom: "une condition personnalisée",
  opIs: "{field} est {value}",
  opIsNot: "{field} n’est pas {value}",
  opContains: "{field} contient {value}",
  opNotContains: "{field} ne contient pas {value}",
  opStartsWith: "{field} commence par {value}",
  opEq: "{field} = {value}",
  opNeq: "{field} ≠ {value}",
  opLt: "{field} < {value}",
  opLte: "{field} ≤ {value}",
  opGt: "{field} > {value}",
  opGte: "{field} ≥ {value}",
  opBetween: "{field} est entre {from} et {to}",
  opOn: "{field} est le {value}",
  opBefore: "{field} est avant le {value}",
  opAfter: "{field} est après le {value}",
  opInLast: "{field} est dans les {value} derniers jours",
  opInNext: "{field} est dans les {value} prochains jours",
  opIsAnyOf: "{field} est l’un de {value}",
  opIsNoneOf: "{field} n’est aucun de {value}",
  opContainsAny: "{field} contient l’un de {value}",
  opContainsAll: "{field} contient tous {value}",
  opContainsNone: "{field} ne contient aucun de {value}",
  opIsChecked: "{field} est coché",
  opIsUnchecked: "{field} n’est pas coché",
  opIsEmpty: "{field} est vide",
  opIsNotEmpty: "{field} n’est pas vide",
};

/** Host override for a label (`form.<key>`), or the built-in one. */
export type FormTranslate = (key: FormLabelKey, fallback: string) => string;

const PLURAL = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{(.*)\}\}/;

/** Built-in English or French labels, overridable per key by the host. */
export function formLabel(
  key: FormLabelKey,
  locale: string,
  translate?: FormTranslate,
  params: Record<string, number | string> = {}
): string {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const template = translate ? translate(key, labels[key]) : labels[key];
  const plural = template.replace(PLURAL, (_match, name, one, other) =>
    Number(params[name]) === 1 ? one : other
  );
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    plural
  );
}

/** Translations passed as `{ submit }` or `{ "form.submit" }`. */
export function formTranslateFrom(
  translations: Record<string, string | undefined> | undefined
): FormTranslate {
  return (key, fallback) =>
    translations?.[`form.${key}`] ?? translations?.[key] ?? fallback;
}

// Rules in the settings ---------------------------------------------------

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const RULE_WORDS: Record<string, FormLabelKey> = {
  and: "ruleAnd",
  or: "ruleOr",
  custom: "ruleCustom",
};

/** Words of rule summaries in the form's language (`form.op*`, `form.then*`). */
export function formRuleWords(
  locale: string,
  translate?: FormTranslate
): ConditionWords {
  return (key, params) => {
    const [kind, name = ""] = key.split(".");
    const label =
      RULE_WORDS[key] ?? (`${kind}${capitalize(name)}` as FormLabelKey);
    return formLabel(label, locale, translate, params);
  };
}

/** "Shown when Category is Hardware and Budget > 1000", in the form's language. */
export function formRuleSummary(
  rule: FormRule,
  questions: readonly ResolvedFormQuestion[],
  locale: string,
  translate?: FormTranslate
): string {
  return describeRule(
    rule,
    formConditionFields(questions),
    formRuleWords(locale, translate)
  );
}

const PLACEHOLDERS = /\s*\{(value|from|to)\}\s*/g;

/** An operator as a menu shows it: "is …", "> …", "is in the last … days". */
export function formOperatorLabel(
  operator: ConditionOperator,
  locale: string,
  translate?: FormTranslate
): string {
  const phrase = formLabel(
    `op${capitalize(operator)}` as FormLabelKey,
    locale,
    translate
  );
  return phrase.replace("{field}", "").replace(PLACEHOLDERS, " … ").trim();
}

const ISSUE_LABELS: Record<RuleIssueCode, FormLabelKey> = {
  cycle: "issueCycle",
  emptyGroup: "issueEmptyGroup",
  laterQuestion: "issueLaterQuestion",
  missingField: "issueMissingField",
  missingValue: "issueMissingValue",
  noTargets: "issueTarget",
  operator: "issueOperator",
  selfReference: "issueSelfReference",
  unknownField: "issueUnknownField",
  unknownOption: "issueUnknownOption",
  unknownTarget: "issueTarget",
};

/** The label key of a rule problem, e.g. `issueMissingValue`. */
export const formRuleIssueLabel = (code: RuleIssueCode): FormLabelKey =>
  ISSUE_LABELS[code];

/** Problems of the saved rules, for the settings editor's inline messages. */
export function formRuleIssues(
  columns: readonly FormColumn[],
  settings: FormViewSettings
): RuleIssue[] {
  const resolved = resolveFormSettings(columns, undefined, {
    ...settings,
    rules: [],
  });
  return validateRules(
    settings.rules ?? [],
    formConditionFields(resolved.questions),
    {
      targets: sectionIds(resolved.items),
      order: itemIds(resolved.items),
      layout: resolved.layout,
    }
  );
}

/** Rules acting on a question or section, in their saved order. */
export const formRulesFor = (
  rules: readonly FormRule[] | undefined,
  id: string
): FormRule[] =>
  (rules ?? []).filter((rule) => rule.then.questionIds?.includes(id));

/** A new rule for a question: "Show this question when…" with one empty condition. */
export function createFormRule(
  rules: readonly FormRule[] | undefined,
  targetId: string,
  action: FormRuleAction = "show"
): FormRule {
  const ids = new Set((rules ?? []).map((rule) => rule.id));
  let count = 1;
  while (ids.has(`${targetId}-rule-${count}`)) {
    count += 1;
  }
  const when: ConditionGroup = {
    join: "and",
    items: [{ fieldId: "", operator: "is" }],
  };
  const then = { action, questionIds: [targetId] };
  return { id: `${targetId}-rule-${count}`, when, then };
}

/** Rules with one rule replaced (by id) or appended. */
export function upsertFormRule(
  rules: readonly FormRule[] | undefined,
  rule: FormRule
): FormRule[] {
  const list = [...(rules ?? [])];
  const index = list.findIndex((item) => item.id === rule.id);
  if (index < 0) {
    list.push(rule);
  } else {
    list[index] = rule;
  }
  return list;
}

/** Rules without one rule. */
export const removeFormRule = (
  rules: readonly FormRule[] | undefined,
  id: string
): FormRule[] => (rules ?? []).filter((rule) => rule.id !== id);

/** The editable condition fields of a form: its questions, as the engine sees them. */
export function formRuleFields(
  columns: readonly FormColumn[],
  settings: FormViewSettings
): ConditionField[] {
  const resolved = resolveFormSettings(columns, undefined, {
    ...settings,
    rules: [],
  });
  return formConditionFields(resolved.questions);
}

// Saved views and public links --------------------------------------------

interface SavedFormView {
  id?: string;
  config?: unknown;
}

/** The form settings stored in a saved view (`view.config.form`). */
export function formSettingsFromView(
  view: SavedFormView | null | undefined,
  defaults?: unknown
): FormViewSettings {
  const config = isRecord(view?.config) ? view.config : {};
  const merged = mergeFormSettings(defaults, config.form);
  return normalizeFormViewConfig(merged) ?? {};
}

/** What a host stores to serve a form publicly; nothing else of the table. */
export interface PublicFormSnapshot {
  version: 1;
  viewId?: string;
  /** Send to the browser with `columns`: questions, sections, rules and layout. */
  form: FormViewSettings;
  /** Only the asked columns, with their names, types and options. */
  columns: FormColumn[];
  /** Keep on the server: `acceptPublicFormResponse` adds them to each response. */
  hiddenValues: Record<string, FormHiddenValue>;
}

/** What a public form shows of a column: its name, type, options and display. */
function snapshotColumn(column: FormColumn): FormColumn {
  const { id, header, type, options } = column;
  const display = {
    displayVariant: column.displayVariant,
    coloredTags: column.coloredTags,
    numberFormat: column.numberFormat,
  };
  return {
    id,
    header,
    ...(type ? { type } : {}),
    ...(options === undefined ? {} : { options }),
    ...Object.fromEntries(
      Object.entries(display).filter(([, value]) => value !== undefined)
    ),
  };
}

/** The saved questions and sections kept by a snapshot, with their texts. */
function snapshotItems(
  settings: FormViewSettings,
  resolved: ResolvedFormSettings
): FormItem[] {
  const saved = new Map(
    (settings.questions ?? []).map((item) => [item.id, item])
  );
  return resolved.items.map((item): FormItem => {
    if (item.kind === "section") {
      return { ...item.section };
    }
    const { id, columnId } = item.question;
    return { ...(saved.get(id) as FormQuestion | undefined), id, columnId };
  });
}

/**
 * A publishable copy of a form: explicit questions and sections, the rules
 * that can act, the layout, the columns they need and the fixed values. No
 * rows, filters, other columns or table settings.
 */
export function publicFormSnapshot(
  view: SavedFormView | FormViewSettings,
  columns: readonly FormColumn[],
  defaults?: unknown
): PublicFormSnapshot {
  const settings =
    "config" in view || "id" in view
      ? formSettingsFromView(view as SavedFormView, defaults)
      : mergeFormSettings(defaults, view);
  const resolved = resolveFormSettings(columns, undefined, settings);
  const asked = new Set(
    resolved.questions.map((question) => question.columnId)
  );
  const form: FormViewSettings = normalizeFormViewConfig({
    ...settings,
    hiddenValues: undefined,
    questions: snapshotItems(settings, resolved),
    rules: resolved.rules.length ? resolved.rules : undefined,
  }) ?? { questions: [] };
  const viewId =
    "id" in view && typeof view.id === "string" ? view.id : undefined;
  const byId = new Map(columns.map((column) => [column.id, column]));
  const hiddenValues = Object.fromEntries(
    Object.entries(resolved.hiddenValues).filter(([columnId, value]) => {
      const column = byId.get(columnId);
      return column ? validHiddenValue(column, value) : false;
    })
  );
  return {
    version: 1,
    ...(viewId ? { viewId } : {}),
    form,
    columns: columns
      .filter((column) => asked.has(column.id))
      .map((column) => snapshotColumn(column)),
    hiddenValues,
  };
}

const optionValues = (column: FormColumn) =>
  new Set(formOptions(column.options).map((option) => String(option.value)));

/** Whether a fixed value fits its column: a known option, a number, a date… */
export function validHiddenValue(
  column: FormColumn,
  value: FormHiddenValue
): boolean {
  const editor = formColumnEditor(column);
  switch (editor) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "date":
      return validDate(value);
    case "url":
      return validUrl(value);
    case "select":
      return !Array.isArray(value) && optionValues(column).has(String(value));
    case "multiSelect":
      return (
        Array.isArray(value) &&
        value.every((item) => optionValues(column).has(String(item)))
      );
    case "text":
    case "textarea":
      return typeof value === "string";
    default:
      return false;
  }
}

export interface BuildPublicFormSnapshotInput {
  /** The saved view, as the host stored it (`view.config.form`). */
  view: SavedFormView;
  /** The host's own column list; the browser's is never trusted. */
  columns: readonly FormColumn[];
  /** Columns a public response may fill (asked or fixed); unset allows every creatable column. */
  allowedColumnIds?: readonly string[];
  /** Table-level form defaults (`table.form`). */
  defaults?: unknown;
}

/**
 * Server-side snapshot of a saved Form view: hosts call it in their publish
 * endpoint with their own columns, so a browser cannot add columns, fixed
 * values or questions. Only columns that exist, have a form editor and are
 * allowed are kept; fixed values must fit their column (known option, number,
 * date…); rules and layout are included.
 */
export function buildPublicFormSnapshot({
  allowedColumnIds,
  columns,
  defaults,
  view,
}: BuildPublicFormSnapshotInput): PublicFormSnapshot {
  const allowed = allowedColumnIds ? new Set(allowedColumnIds) : undefined;
  const creatable = formColumns(columns).eligible.filter(
    (column) => !allowed || allowed.has(column.id)
  );
  return publicFormSnapshot(view, creatable, defaults);
}

/**
 * Server-side check of a public response: keeps only the snapshot's asked
 * columns, evaluates the rules (hidden answers are ignored, required-if-
 * visible), validates again, applies `set` values and adds the fixed values.
 */
export function acceptPublicFormResponse(
  snapshot: PublicFormSnapshot,
  input: unknown
):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: Record<string, FormErrorCode> } {
  const resolved = resolveFormSettings(
    snapshot.columns,
    undefined,
    snapshot.form
  );
  const answers = isRecord(input) ? input : {};
  const values = Object.fromEntries(
    resolved.questions.flatMap((question) =>
      Object.hasOwn(answers, question.columnId)
        ? [[question.columnId, answers[question.columnId]]]
        : []
    )
  );
  const evaluation = evaluateFormView(resolved, values);
  const errors = validateFormValues(resolved.questions, values, evaluation);
  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    values: {
      ...formVisibleValues(resolved, values, evaluation),
      ...snapshot.hiddenValues,
    },
  };
}

/** Public link state of a form view, as the host reports it. */
export interface FormLinkStatus {
  published: boolean;
  url?: string;
  /** Unset means the link accepts responses. */
  acceptsResponses?: boolean;
}

/**
 * Host contract for sharing a form publicly (`actions.formLinks`). The table
 * cannot serve pages: the host builds the snapshot on its server from the
 * saved view with `buildPublicFormSnapshot`, serves it on a public route that
 * renders `YayawTableForm`, and validates responses with
 * `acceptPublicFormResponse`.
 */
export interface FormLinkActions {
  status: (viewId: string) => Promise<FormLinkStatus | null>;
  /**
   * Publish (or update) the saved view's public form. Build the snapshot on
   * the server: `buildPublicFormSnapshot({ view, columns })`.
   */
  publish: (
    viewId: string,
    /**
     * @deprecated Built in the browser, so it can be tampered with. Still
     * passed for older hosts; hosts must ignore it and build the snapshot
     * server-side from the saved view.
     */
    snapshot?: PublicFormSnapshot
  ) => Promise<{ url: string }>;
  unpublish: (viewId: string) => Promise<void>;
  setAcceptingResponses?: (viewId: string, accepting: boolean) => Promise<void>;
}

/** Whether a table offers the Form mode: `table.form` unless false, and a create action. */
export function isFormModeEnabled(flag: unknown, canCreate: boolean): boolean {
  return canCreate && flag !== false;
}

/** A `create` action result as a form result: field errors stay on their questions. */
export function formSubmitResultFrom(
  result:
    | { success: boolean; error?: string; fieldErrors?: Record<string, string> }
    | undefined
): FormSubmitResult {
  if (result?.success) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: result?.fieldErrors,
    message: result?.error,
  };
}

/** A row of the settings panel: a column (asked or not) or a section break. */
export type FormSettingsRow<T extends FormColumn = FormColumn> =
  | { kind: "question"; column: T; question?: FormQuestion; index: number }
  | { kind: "section"; section: FormSectionBreak; index: number };

/** Rows of the settings panel: asked questions and sections in order, then the other editable columns. */
export function formSettingsRows<T extends FormColumn>(
  columns: readonly T[],
  settings: FormViewSettings
): FormSettingsRow<T>[] {
  const { eligible } = formColumns(columns);
  const items = formQuestionList(columns, settings);
  const asked = items.flatMap((item, index): FormSettingsRow<T>[] => {
    if (isFormSection(item)) {
      return [{ kind: "section", section: item, index }];
    }
    const column = eligible.find((entry) => entry.id === item.columnId);
    return column ? [{ kind: "question", column, question: item, index }] : [];
  });
  const askedIds = new Set(
    items.flatMap((item) => (isFormSection(item) ? [] : [item.columnId]))
  );
  return [
    ...asked,
    ...eligible
      .filter((column) => !askedIds.has(column.id))
      .map(
        (column): FormSettingsRow<T> => ({
          kind: "question",
          column,
          index: -1,
        })
      ),
  ];
}

/** Choices of a fixed-value select, or none when the value is typed. */
export function formHiddenChoices(
  column: FormColumn
): { value: string; label: string }[] | undefined {
  const editor = formColumnEditor(column);
  if (editor === "boolean") {
    return [
      { value: "true", label: "✓" },
      { value: "false", label: "✗" },
    ];
  }
  if (editor !== "select") {
    return;
  }
  return formOptions(column.options).map((option) => ({
    value: String(option.value),
    label: option.label,
  }));
}

/** A fixed value from its input: numbers for number columns, options as declared. */
export function formHiddenValueFrom(
  column: FormColumn,
  raw: string
): FormHiddenValue | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return;
  }
  const editor = formColumnEditor(column);
  if (editor === "boolean") {
    return trimmed === "true";
  }
  if (editor === "number" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  const option = formOptions(column.options).find(
    (item) => String(item.value) === trimmed
  );
  return option && isHiddenScalar(option.value) ? option.value : trimmed;
}

/** A fixed value as its input shows it. */
export const formHiddenValueText = (
  value: FormHiddenValue | undefined
): string => (Array.isArray(value) ? value.join(", ") : String(value ?? ""));

// Resumable progress -------------------------------------------------------

/** What a steps form can resume: the answers typed so far and the current step. */
export interface FormProgress {
  draft: FormDraft;
  step?: string;
}

const isDraftValue = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

/** Progress saved under `key` in the browser's storage, if any and well-formed. */
export function readFormProgress(key: string): FormProgress | undefined {
  try {
    const text = globalThis.localStorage?.getItem(key);
    const value: unknown = text ? JSON.parse(text) : undefined;
    if (!(isRecord(value) && isRecord(value.draft))) {
      return;
    }
    const draft = Object.fromEntries(
      Object.entries(value.draft).filter(([, item]) => isDraftValue(item))
    ) as FormDraft;
    return typeof value.step === "string"
      ? { draft, step: value.step }
      : { draft };
  } catch {
    return;
  }
}

/** Save progress (or remove it with `undefined`); storage errors are ignored. */
export function writeFormProgress(
  key: string,
  progress: FormProgress | undefined
): void {
  try {
    if (progress) {
      globalThis.localStorage?.setItem(key, JSON.stringify(progress));
    } else {
      globalThis.localStorage?.removeItem(key);
    }
  } catch {
    // Private windows may refuse storage; the form then simply does not resume.
  }
}

// Rule values in the settings editor --------------------------------------

/** A rule value as its input shows it. */
export const formRuleValueText = (value: unknown): string =>
  value === undefined || value === null || Array.isArray(value)
    ? ""
    : String(value);

/** The input a rule value is typed in, for its field. */
export const formRuleInputType = (
  field: ConditionField | undefined
): "date" | "number" | "text" => {
  if (field?.type === "date") {
    return "date";
  }
  return field?.type === "number" ? "number" : "text";
};

/** A typed rule value: numbers for number fields and day counts, text otherwise. */
export function formRuleValue(
  field: ConditionField | undefined,
  raw: string,
  days = false
): ConditionValue {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (days || field?.type === "number") {
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

/** A `[from, to]` value with one end changed. */
export function formRuleRange(
  field: ConditionField | undefined,
  current: unknown,
  index: 0 | 1,
  raw: string
): ConditionValue {
  const ends = Array.isArray(current) ? current : [null, null];
  return [0, 1].map((position) =>
    formRuleValue(
      field,
      position === index ? raw : formRuleValueText(ends[position])
    )
  ) as ConditionValue;
}

/** The chosen values of a list operator (`isAnyOf`, `containsAll`…). */
export const formRuleList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/** A list typed as comma-separated text, for fields without options. */
export const formRuleListFrom = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
