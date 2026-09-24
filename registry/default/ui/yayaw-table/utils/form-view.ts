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
import {
  FORM_COMMON_LOCALES,
  type FormText,
  formLanguage,
  formLocaleTag,
  formTextLocales,
  formTextMissing,
  normalizeFormText,
  resolveFormText,
  uniqueFormLocales,
} from "./form-text";
import { formatLocation, parseLocation } from "./location-model";
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
  | "location"
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

export type { FormText } from "./form-text";

/**
 * One question of the form. `id` is stable (it defaults to the column id) so
 * later features, such as conditions, can point at a question. Texts are one
 * string or one per locale (`{ en: "Name", fr: "Nom" }`).
 */
export interface FormQuestion {
  id: string;
  /** Column that receives the answer. */
  columnId: string;
  /** Replaces the column name. */
  label?: FormText;
  /** Shown under the label. */
  help?: FormText;
  placeholder?: FormText;
  required?: boolean;
  /** Option labels replacing the column's, by option value (e.g. to translate them). */
  optionLabels?: Record<string, FormText>;
}

/**
 * A section break: starts a titled group of questions. In the steps layout,
 * each section is one step. Rules may show or hide a section (and its
 * questions) by its id.
 */
export interface FormSectionBreak {
  id: string;
  kind: "section";
  title?: FormText;
  description?: FormText;
}

/** The link of a consent statement, such as the privacy policy. */
export interface FormConsentLink {
  /** The link's text; unset reads "privacy policy". */
  label?: FormText;
  /** `https://…` or a path of the site (`/privacy`); without it the text shows unlinked. */
  href?: FormText;
}

/**
 * A consent checkbox (GDPR), bound to no column: always required, never hidden
 * by rules. `{link}` in its text marks where the link goes. Accepted consents
 * reach the host as `metadata.consents` of the response, never as a column.
 */
export interface FormConsentQuestion {
  id: string;
  kind: "consent";
  /** The statement; unset reads "I agree to the processing of my answers." */
  text?: FormText;
  link?: FormConsentLink;
  /** Version of the terms agreed to, recorded with each response (default "1"). */
  version?: string;
}

/** Where a hidden field takes its value from. */
export type FormHiddenSource =
  | { type: "urlParam"; name: string }
  | { type: "pageUrl" }
  | { type: "referrer" }
  | { type: "locale" }
  | { type: "static"; value: string };

export type FormHiddenSourceType = FormHiddenSource["type"];

/**
 * A hidden (context) field: never shown, it takes its value from the page
 * (a URL parameter such as `utm_source`, the page address, the referrer, the
 * language) or a fixed text. Bound to a column, the value is written like an
 * answer; otherwise it is kept in `metadata.context`. Browser values are
 * untrusted: the server accepts only the snapshot's sources, as capped text.
 */
export interface FormHiddenField {
  id: string;
  kind: "hidden";
  source: FormHiddenSource;
  /** Column written with the value (a column the form does not ask). */
  columnId?: string;
}

/** A question, a section break, a consent or a hidden field, in form order. */
export type FormItem =
  | FormQuestion
  | FormSectionBreak
  | FormConsentQuestion
  | FormHiddenField;

/** `page` shows every question at once; `steps` one question (or section) at a time. */
export type FormLayout = "page" | "steps";

export interface FormViewSettings {
  title?: FormText;
  description?: FormText;
  /**
   * Language of plain texts, and the fallback of missing translations (before
   * the first version available). Defaults to the first of `locales`.
   */
  defaultLocale?: string;
  /**
   * Languages the form is written in, shown by the settings' language
   * switcher and the Form view's preview. At table level
   * (`table.form.locales`), the host's languages: every form has them.
   */
  locales?: string[];
  /** Questions, section breaks, consents and hidden fields in order; unset asks every column that has an editor. */
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
  submitLabel?: FormText;
  successMessage?: FormText;
  /** Shown instead of the questions while the form is closed. */
  closedMessage?: FormText;
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

/** A consent as the form shows it, in the form's language. */
export interface ResolvedFormConsent {
  id: string;
  /** The statement; `{link}` marks where the link goes. */
  text: string;
  /** The link, when the consent has one; without `href` its text shows unlinked. */
  link?: { label: string; href?: string };
  version: string;
}

/** A hidden field with how its column takes the value, when it is bound to one. */
export interface ResolvedFormHiddenField extends FormHiddenField {
  /** The bound column's editor, for checking the value like an answer. */
  editor?: FormEditor;
  options?: FormOption[];
}

/** Questions, sections and consents in form order. */
export type ResolvedFormItem =
  | { kind: "question"; question: ResolvedFormQuestion }
  | { kind: "section"; section: ResolvedFormSection }
  | { kind: "consent"; consent: ResolvedFormConsent };

export interface ResolvedFormSettings {
  title?: string;
  description?: string;
  /** The asked questions, without sections. */
  questions: ResolvedFormQuestion[];
  /** Questions, section breaks and consents in order. */
  items: ResolvedFormItem[];
  /** Consent checkboxes, in form order: always required, never hidden. */
  consents: ResolvedFormConsent[];
  /** Hidden fields; a binding only stays on a column the form can write and does not ask. */
  hiddenFields: ResolvedFormHiddenField[];
  /** Rules that can act (broken or cyclic ones are dropped). */
  rules: FormRule[];
  layout: FormLayout;
  review: boolean;
  hiddenValues: Record<string, FormHiddenValue>;
  submitLabel?: string;
  successMessage?: string;
  closedMessage?: string;
  allowAnotherResponse: boolean;
  redirectUrl?: string;
  /** The language the texts were resolved in, when one was asked. */
  locale?: string;
  /** The form's default language, when it has one. */
  defaultLocale?: string;
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

/** Settings texts that may be localized. */
const TEXT_KEYS = [
  "title",
  "description",
  "submitLabel",
  "successMessage",
  "closedMessage",
] as const;
const QUESTION_TEXT_KEYS = ["label", "help", "placeholder"] as const;
const SECTION_TEXT_KEYS = ["title", "description"] as const;
const SAFE_URL = /^(https?:\/\/|\/(?!\/))/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** URL parameter names a hidden field may read: `utm_source`, `ref`, `gclid`… */
const PARAM_NAME = /^[\w.[\]-]{1,100}$/;
const EXCLUDED_IDS = new Set(["select", "actions"]);
const EDITORS: Partial<Record<string, FormEditor>> = {
  date: "date",
  location: "location",
  multiSelect: "multiSelect",
  number: "number",
  select: "select",
  switch: "boolean",
  text: "text",
  textarea: "textarea",
  url: "url",
};
/** Editors a hidden field can write: text that converts to the column's type. */
const HIDDEN_FIELD_EDITORS = new Set<FormEditor>([
  "boolean",
  "date",
  "number",
  "select",
  "text",
  "textarea",
  "url",
]);
const HIDDEN_SOURCE_TYPES = new Set<FormHiddenSourceType>([
  "locale",
  "pageUrl",
  "referrer",
  "static",
  "urlParam",
]);
/** Longest hidden text kept (URL parameters, fixed texts); longer ones are cut. */
export const FORM_HIDDEN_TEXT_MAX = 500;
/** Longest page or referrer address kept; longer ones are dropped, not cut. */
export const FORM_HIDDEN_URL_MAX = 2048;
const DEFAULT_CONSENT_VERSION = "1";

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

/** Whether a form item is a consent checkbox. */
export const isFormConsent = (item: unknown): item is FormConsentQuestion =>
  isRecord(item) && item.kind === "consent";

/** Whether a form item is a hidden (context) field. */
export const isFormHiddenField = (item: unknown): item is FormHiddenField =>
  isRecord(item) && item.kind === "hidden";

/** Whether a form item is a question, bound to a column. */
export const isFormQuestion = (item: unknown): item is FormQuestion =>
  isRecord(item) &&
  typeof item.columnId === "string" &&
  !(isFormSection(item) || isFormConsent(item) || isFormHiddenField(item));

/** Copy the localized texts of `keys` that are valid. */
function textsOf<K extends string>(
  value: Record<string, unknown>,
  keys: readonly K[]
): Partial<Record<K, FormText>> {
  const texts: Partial<Record<K, FormText>> = {};
  for (const key of keys) {
    const content = normalizeFormText(value[key]);
    if (content !== undefined) {
      texts[key] = content;
    }
  }
  return texts;
}

function normalizeSection(
  value: Record<string, unknown>
): FormSectionBreak | undefined {
  const id = text(value.id);
  return id
    ? { id, kind: "section", ...textsOf(value, SECTION_TEXT_KEYS) }
    : undefined;
}

/** Addresses that are `https://…`, `http://…` or a path of the site, per locale. */
function safeHref(value: unknown): FormText | undefined {
  const href = normalizeFormText(value);
  if (typeof href === "string" || href === undefined) {
    return href && SAFE_URL.test(href) ? href : undefined;
  }
  const entries = Object.entries(href).filter(([, item]) =>
    SAFE_URL.test(item)
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** A link, when it has a text or a safe address. */
function normalizeConsentLink(value: unknown): FormConsentLink | undefined {
  if (!isRecord(value)) {
    return;
  }
  const link: FormConsentLink = {};
  const label = normalizeFormText(value.label);
  const href = safeHref(value.href);
  if (label !== undefined) {
    link.label = label;
  }
  if (href !== undefined) {
    link.href = href;
  }
  return Object.keys(link).length ? link : undefined;
}

function normalizeConsent(
  value: Record<string, unknown>
): FormConsentQuestion | undefined {
  const id = text(value.id);
  if (!id) {
    return;
  }
  const consent: FormConsentQuestion = { id, kind: "consent" };
  const statement = normalizeFormText(value.text);
  const link = normalizeConsentLink(value.link);
  const version = text(value.version);
  if (statement !== undefined) {
    consent.text = statement;
  }
  if (link) {
    consent.link = link;
  }
  if (version) {
    consent.version = version.slice(0, FORM_HIDDEN_TEXT_MAX);
  }
  return consent;
}

/** A hidden field's source; `"pageUrl"`, `"referrer"` and `"locale"` may be given as strings. */
export function normalizeFormHiddenSource(
  value: unknown
): FormHiddenSource | undefined {
  const source = typeof value === "string" ? { type: value } : value;
  if (
    !(
      isRecord(source) &&
      HIDDEN_SOURCE_TYPES.has(source.type as FormHiddenSourceType)
    )
  ) {
    return;
  }
  switch (source.type as FormHiddenSourceType) {
    case "urlParam": {
      const name = text(source.name);
      return name && PARAM_NAME.test(name)
        ? { type: "urlParam", name }
        : undefined;
    }
    case "static": {
      const content = text(source.value);
      return content
        ? { type: "static", value: content.slice(0, FORM_HIDDEN_TEXT_MAX) }
        : undefined;
    }
    case "pageUrl":
      return { type: "pageUrl" };
    case "referrer":
      return { type: "referrer" };
    default:
      return { type: "locale" };
  }
}

function normalizeHiddenField(
  value: Record<string, unknown>
): FormHiddenField | undefined {
  const id = text(value.id);
  const source = normalizeFormHiddenSource(value.source);
  if (!(id && source)) {
    return;
  }
  const columnId = text(value.columnId);
  return columnId
    ? { id, kind: "hidden", source, columnId }
    : { id, kind: "hidden", source };
}

function normalizeOptionLabels(
  value: unknown
): Record<string, FormText> | undefined {
  if (!isRecord(value)) {
    return;
  }
  const entries = Object.entries(value).flatMap(([key, label]) => {
    const content = normalizeFormText(label);
    return content === undefined ? [] : [[key, content] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeItem(value: unknown): FormItem | undefined {
  if (!isRecord(value)) {
    return;
  }
  if (isFormSection(value)) {
    return normalizeSection(value);
  }
  if (isFormConsent(value)) {
    return normalizeConsent(value);
  }
  return isFormHiddenField(value)
    ? normalizeHiddenField(value)
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
  const question: FormQuestion = {
    id: text(value.id) ?? columnId,
    columnId,
    ...textsOf(value, QUESTION_TEXT_KEYS),
  };
  if (typeof value.required === "boolean") {
    question.required = value.required;
  }
  const optionLabels = normalizeOptionLabels(value.optionLabels);
  if (optionLabels) {
    question.optionLabels = optionLabels;
  }
  return question;
}

/** A hidden field bound to an asked column (or to a column bound before) keeps its value in the metadata only. */
function unbindTaken(items: FormItem[], asked: Set<string>): FormItem[] {
  const bound = new Set<string>();
  return items.map((item) => {
    if (!(isFormHiddenField(item) && item.columnId)) {
      return item;
    }
    if (asked.has(item.columnId) || bound.has(item.columnId)) {
      return { id: item.id, kind: "hidden", source: item.source };
    }
    bound.add(item.columnId);
    return item;
  });
}

/**
 * Questions, sections, consents and hidden fields in order, each column and
 * id at most once. A consent may not share its id with an asked column (its
 * answer is kept under that key).
 */
export function normalizeFormQuestions(value: unknown): FormItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries = value.flatMap((entry) => {
    const item = normalizeItem(entry);
    return item ? [item] : [];
  });
  const asked = new Set(
    entries.filter(isFormQuestion).map((question) => question.columnId)
  );
  const ids = new Set<string>();
  const columns = new Set<string>();
  const items: FormItem[] = [];
  for (const item of entries) {
    const column = isFormQuestion(item) ? item.columnId : undefined;
    const clash = isFormConsent(item) && asked.has(item.id);
    if (!(ids.has(item.id) || (column && columns.has(column)) || clash)) {
      ids.add(item.id);
      if (column) {
        columns.add(column);
      }
      items.push(item);
    }
  }
  return unbindTaken(items, asked);
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

function normalizeLocales(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }
  const locales = uniqueFormLocales(value);
  return locales.length ? locales : undefined;
}

/** Keep only valid form settings; unknown or malformed values are dropped. */
export function normalizeFormViewConfig(
  value: unknown
): FormViewSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const normalized: FormViewSettings = textsOf(value, TEXT_KEYS);
  const defaultLocale = formLocaleTag(value.defaultLocale);
  const locales = normalizeLocales(value.locales);
  if (defaultLocale) {
    normalized.defaultLocale = defaultLocale;
  }
  if (locales) {
    normalized.locales = locales;
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

/** The language of a form's plain texts: `defaultLocale`, else the first of `locales`. */
export const formDefaultLocale = (
  settings: Pick<FormViewSettings, "defaultLocale" | "locales">
): string | undefined => settings.defaultLocale ?? settings.locales?.[0];

const isNumberFormat = (value: unknown): value is NumberFormatConfig =>
  typeof value === "string" || isRecord(value);

/** Resolves a text in the form's language (see `resolveFormText`). */
type TextResolver = (value: FormText | undefined) => string | undefined;

function resolveQuestion(
  question: FormQuestion,
  column: FormColumn,
  editor: FormEditor,
  t: TextResolver
): ResolvedFormQuestion {
  const options = formOptions(column.options).map((option) => {
    const label = t(question.optionLabels?.[String(option.value)]);
    return label ? { ...option, label } : option;
  });
  return {
    id: question.id,
    columnId: column.id,
    editor,
    label: t(question.label) ?? column.header,
    help: t(question.help),
    placeholder: t(question.placeholder),
    required: question.required === true,
    options,
    tags: column.displayVariant === "tag",
    coloredTags: column.coloredTags !== false,
    numberFormat: isNumberFormat(column.numberFormat)
      ? column.numberFormat
      : undefined,
  };
}

function resolveSection(
  section: FormSectionBreak,
  t: TextResolver
): ResolvedFormSection {
  const resolved: ResolvedFormSection = { id: section.id, kind: "section" };
  const title = t(section.title);
  const description = t(section.description);
  if (title) {
    resolved.title = title;
  }
  if (description) {
    resolved.description = description;
  }
  return resolved;
}

/** A consent in the form's language; the built-in statement and link text fill what is unset. */
function resolveConsent(
  consent: FormConsentQuestion,
  t: TextResolver,
  locale: string
): ResolvedFormConsent {
  const resolved: ResolvedFormConsent = {
    id: consent.id,
    text:
      t(consent.text) ??
      formLabel(consent.link ? "consentTextLink" : "consentText", locale),
    version: consent.version ?? DEFAULT_CONSENT_VERSION,
  };
  if (consent.link) {
    const label =
      t(consent.link.label) ?? formLabel("consentLinkLabel", locale);
    const href = t(consent.link.href);
    resolved.link = href ? { label, href } : { label };
  }
  return resolved;
}

/** A hidden field keeps its column only when the form can write it and does not ask it. */
function resolveHiddenField(
  field: FormHiddenField,
  byId: ReadonlyMap<string, FormColumn>,
  asked: ReadonlySet<string>
): ResolvedFormHiddenField {
  const column = field.columnId ? byId.get(field.columnId) : undefined;
  const editor = column && formColumnEditor(column);
  if (
    !(column && editor && HIDDEN_FIELD_EDITORS.has(editor)) ||
    asked.has(column.id)
  ) {
    return { id: field.id, kind: "hidden", source: field.source };
  }
  return { ...field, editor, options: formOptions(column.options) };
}

const defaultItems = (eligible: readonly FormColumn[]): FormItem[] =>
  eligible.map((column) => ({ id: column.id, columnId: column.id }));

function resolveItems(
  items: readonly FormItem[],
  byId: Map<string, FormColumn>,
  t: TextResolver,
  locale: string
): ResolvedFormItem[] {
  return items.flatMap((item): ResolvedFormItem[] => {
    if (isFormSection(item)) {
      return [{ kind: "section", section: resolveSection(item, t) }];
    }
    if (isFormConsent(item)) {
      return [{ kind: "consent", consent: resolveConsent(item, t, locale) }];
    }
    if (!isFormQuestion(item)) {
      return [];
    }
    const column = byId.get(item.columnId);
    const editor = column && formColumnEditor(column);
    return column && editor
      ? [
          {
            kind: "question",
            question: resolveQuestion(item, column, editor, t),
          },
        ]
      : [];
  });
}

const EDITOR_CONDITION: Record<FormEditor, ConditionFieldType> = {
  boolean: "checkbox",
  date: "date",
  // A place is kept as its JSON text in the draft: "is empty" and "is not empty" apply.
  location: "text",
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

/** The id of a resolved question, section or consent. */
export const formItemId = (item: ResolvedFormItem): string => {
  if (item.kind === "section") {
    return item.section.id;
  }
  return item.kind === "consent" ? item.consent.id : item.question.id;
};

const itemIds = (items: readonly ResolvedFormItem[]) => items.map(formItemId);

const sectionIds = (items: readonly ResolvedFormItem[]) =>
  items.flatMap((item) => (item.kind === "section" ? [item.section.id] : []));

/**
 * Everything a form renders, with questions limited to columns it can edit.
 * Texts are resolved in `locale`: its exact version, else its language, else
 * the form's default locale, else the first version available.
 */
export function resolveFormSettings(
  columns: readonly FormColumn[],
  defaults: unknown,
  view: unknown,
  locale?: string
): ResolvedFormSettings {
  const settings = mergeFormSettings(defaults, view);
  const defaultLocale = formDefaultLocale(settings);
  const readerLocale = formLocaleTag(locale);
  const t: TextResolver = (value) =>
    resolveFormText(value, readerLocale, defaultLocale);
  const { eligible } = formColumns(columns);
  const byId = new Map(eligible.map((column) => [column.id, column]));
  const saved = settings.questions ?? defaultItems(eligible);
  const items = resolveItems(
    saved,
    byId,
    t,
    readerLocale ?? defaultLocale ?? "en"
  );
  const questions = items.flatMap((item) =>
    item.kind === "question" ? [item.question] : []
  );
  const consents = items.flatMap((item) =>
    item.kind === "consent" ? [item.consent] : []
  );
  const asked = new Set(questions.map((question) => question.columnId));
  const hiddenFields = saved
    .filter(isFormHiddenField)
    .map((field) => resolveHiddenField(field, byId, asked));
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
    title: t(settings.title),
    description: t(settings.description),
    questions,
    items,
    consents,
    hiddenFields,
    rules,
    layout,
    review: settings.review === true,
    hiddenValues,
    submitLabel: t(settings.submitLabel),
    successMessage: t(settings.successMessage),
    closedMessage: t(settings.closedMessage),
    allowAnotherResponse: settings.allowAnotherResponse !== false,
    redirectUrl: settings.redirectUrl,
    ...(readerLocale ? { locale: readerLocale } : {}),
    ...(defaultLocale ? { defaultLocale } : {}),
  };
}

/** The items a settings panel edits: the view's, or one question per editable column. */
export function formQuestionList(
  columns: readonly FormColumn[],
  settings: FormViewSettings
): FormItem[] {
  const { eligible } = formColumns(columns);
  const known = new Set(eligible.map((column) => column.id));
  return (settings.questions ?? defaultItems(eligible)).filter(
    (item) => !isFormQuestion(item) || known.has(item.columnId)
  );
}

/**
 * Move a question, section or consent one place up (-1) or down (+1); other
 * positions are kept. Hidden fields are not shown, so moves pass over them.
 */
export function moveFormQuestion<T extends FormItem>(
  questions: readonly T[],
  id: string,
  offset: -1 | 1
): T[] {
  const index = questions.findIndex((question) => question.id === id);
  let target = index + offset;
  while (isFormHiddenField(questions[target])) {
    target += offset;
  }
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

/** Items a settings panel orders (every item but hidden fields). */
export const formOrderedItems = <T extends FormItem>(
  items: readonly T[]
): T[] => items.filter((item) => !isFormHiddenField(item));

/** Ids and asked columns already used by items, for picking a new id. */
const takenIds = (items: readonly FormItem[]) =>
  new Set(
    items.flatMap((item) =>
      isFormQuestion(item) ? [item.id, item.columnId] : [item.id]
    )
  );

/** `base`, else `base-2`, `base-3`… whichever is free. */
function freeId(base: string, taken: ReadonlySet<string>): string {
  let id = base;
  let count = 2;
  while (taken.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

/** Ask a column (appended at the end) or stop asking it; a hidden field writing that column stops writing it. */
export function toggleFormQuestion(
  questions: readonly FormItem[],
  columnId: string,
  asked: boolean
): FormItem[] {
  const rest = questions.filter(
    (question) => !isFormQuestion(question) || question.columnId !== columnId
  );
  if (!asked) {
    return rest;
  }
  const kept = rest.map(
    (item): FormItem =>
      isFormHiddenField(item) && item.columnId === columnId
        ? { id: item.id, kind: "hidden", source: item.source }
        : item
  );
  const id = freeId(columnId, takenIds(kept));
  return [...kept, { id, columnId }];
}

type FormItemPatch = Partial<
  Omit<FormQuestion, "columnId" | "id"> &
    Omit<FormSectionBreak, "id" | "kind"> &
    Omit<FormConsentQuestion, "id" | "kind">
>;

/** Change one question, section or consent; empty texts and `required: false` are removed. */
export function updateFormQuestion(
  questions: readonly FormItem[],
  id: string,
  patch: FormItemPatch
): FormItem[] {
  return questions.map((item) => {
    if (item.id !== id) {
      return item;
    }
    if (isFormQuestion(item)) {
      return (
        normalizeQuestion({
          ...item,
          ...patch,
          required: patch.required ?? item.required,
        }) ?? item
      );
    }
    return normalizeItem({ ...item, ...patch, kind: item.kind }) ?? item;
  });
}

/** Insert an item after `afterId`, or at the end. */
function insertItem(
  questions: readonly FormItem[],
  item: FormItem,
  afterId?: string
): FormItem[] {
  const after = afterId
    ? questions.findIndex((entry) => entry.id === afterId) + 1
    : 0;
  const index = after > 0 ? after : questions.length;
  const next: FormItem[] = [...questions];
  next.splice(index, 0, item);
  return next;
}

/** Add an empty section break after `afterId` (or at the end); returns the items and its id. */
export function addFormSection(
  questions: readonly FormItem[],
  afterId?: string
): { questions: FormItem[]; id: string } {
  const ids = takenIds(questions);
  let count = questions.filter(isFormSection).length + 1;
  while (ids.has(`section-${count}`)) {
    count += 1;
  }
  const id = `section-${count}`;
  return {
    questions: insertItem(questions, { id, kind: "section" }, afterId),
    id,
  };
}

/**
 * Add a consent after `afterId`, or at the end: the steps layout then shows
 * it on the last step (the review, when there is one). It reads the built-in
 * statement in English and French until a text is written.
 */
export function addFormConsent(
  questions: readonly FormItem[],
  afterId?: string
): { questions: FormItem[]; id: string } {
  const ids = takenIds(questions);
  let count = questions.filter(isFormConsent).length + 1;
  while (ids.has(`consent-${count}`)) {
    count += 1;
  }
  const id = `consent-${count}`;
  return {
    questions: insertItem(questions, { id, kind: "consent" }, afterId),
    id,
  };
}

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

/** The key a hidden field's value has in `metadata.context` by default: its parameter, or its source. */
export function formHiddenFieldKey(source: FormHiddenSource): string {
  switch (source.type) {
    case "urlParam":
      return source.name;
    case "static":
      return "value";
    default:
      return source.type;
  }
}

/** Add a hidden field (the next free `utm_*` URL parameter); returns the items and its id. */
export function addFormHiddenField(questions: readonly FormItem[]): {
  questions: FormItem[];
  id: string;
} {
  const read = new Set(
    questions.flatMap((item) =>
      isFormHiddenField(item) && item.source.type === "urlParam"
        ? [item.source.name]
        : []
    )
  );
  const name = UTM_PARAMS.find((param) => !read.has(param)) ?? "ref";
  const source: FormHiddenSource = { type: "urlParam", name };
  const id = freeId(formHiddenFieldKey(source), takenIds(questions));
  return { questions: [...questions, { id, kind: "hidden", source }], id };
}

/**
 * Change a hidden field's source or column (`columnId: undefined` keeps the
 * value in the metadata). Its id, the value's key in `metadata.context`,
 * follows the source unless it was chosen otherwise; returns the new id.
 */
export function updateFormHiddenField(
  questions: readonly FormItem[],
  id: string,
  patch: { source?: FormHiddenSource; columnId?: string }
): { questions: FormItem[]; id: string } {
  const field = questions.find(
    (item): item is FormHiddenField => isFormHiddenField(item) && item.id === id
  );
  if (!field) {
    return { questions: [...questions], id };
  }
  const source =
    (patch.source && normalizeFormHiddenSource(patch.source)) ?? field.source;
  const columnId = "columnId" in patch ? patch.columnId : field.columnId;
  const key = formHiddenFieldKey(field.source);
  const follows = id === key || id.startsWith(`${key}-`);
  const others = takenIds(questions.filter((item) => item !== field));
  const nextId =
    follows && source !== field.source
      ? freeId(formHiddenFieldKey(source), others)
      : id;
  const next: FormHiddenField = columnId
    ? { id: nextId, kind: "hidden", source, columnId }
    : { id: nextId, kind: "hidden", source };
  return {
    questions: questions.map((item) => (item === field ? next : item)),
    id: nextId,
  };
}

/** Remove an item (a section's questions stay) and the rules left without a target. */
export function removeFormItem(
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

/** Remove a section break (its questions stay) and the rules left without a target. */
export const removeFormSection = removeFormItem;

/** Columns a hidden field may write: editable text, number, date, URL, option or yes/no columns not asked nor written by another hidden field. */
export function formHiddenFieldColumns<T extends FormColumn>(
  columns: readonly T[],
  items: readonly FormItem[],
  fieldId?: string
): T[] {
  const asked = new Set(
    items.filter(isFormQuestion).map((question) => question.columnId)
  );
  const bound = new Set(
    items.flatMap((item) =>
      isFormHiddenField(item) && item.id !== fieldId && item.columnId
        ? [item.columnId]
        : []
    )
  );
  return formColumns(columns).eligible.filter((column) => {
    const editor = formColumnEditor(column);
    return (
      editor !== undefined &&
      HIDDEN_FIELD_EDITORS.has(editor) &&
      !asked.has(column.id) &&
      !bound.has(column.id)
    );
  });
}

const emptyAnswer = (editor: FormEditor): boolean | string | string[] => {
  if (editor === "boolean") {
    return false;
  }
  return editor === "multiSelect" ? [] : "";
};

/** Blank answers for every question, and unchecked consents (kept under their ids). */
export function initialFormDraft(
  questions: readonly ResolvedFormQuestion[],
  consents: readonly Pick<ResolvedFormConsent, "id">[] = []
): FormDraft {
  return Object.fromEntries([
    ...questions.map((question) => [
      question.columnId,
      emptyAnswer(question.editor),
    ]),
    ...consents.map((consent) => [consent.id, false]),
  ]);
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
  if (question.editor === "location") {
    return parseLocation(value) ?? value;
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
  | "errorConsent"
  | "errorDate"
  | "errorNumber"
  | "errorOption"
  | "errorRequired"
  | "errorUrl"
  | "errorLocation";

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
    case "location":
      return formatLocation(value) || value;
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
    case "location":
      return parseLocation(value) ? undefined : "errorLocation";
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

/**
 * `errorConsent` for each consent not checked, by consent id: `answers` are
 * the draft in the browser, the response's `consents` on the server (`true`
 * for an accepted consent).
 */
export function validateFormConsents(
  consents: readonly Pick<ResolvedFormConsent, "id">[],
  answers: unknown
): Record<string, FormErrorCode> {
  const given = isRecord(answers) ? answers : {};
  return Object.fromEntries(
    consents.flatMap((consent) =>
      Object.hasOwn(given, consent.id) && given[consent.id] === true
        ? []
        : [[consent.id, "errorConsent" as const]]
    )
  );
}

/** Section ids with the questions that follow them, until the next section. Consents stay out: rules never hide them. */
export function formSectionGroups(
  items: readonly ResolvedFormItem[]
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  let current: string[] | undefined;
  for (const item of items) {
    if (item.kind === "section") {
      current = [];
      groups[item.section.id] = current;
    } else if (item.kind === "question") {
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

// Hidden fields and consents -------------------------------------------------

/** What hidden fields read from the page: its address, referrer and the form's language. */
export interface FormPageContext {
  url?: string;
  referrer?: string;
  locale?: string;
}

/** The page the form is shown on, in a browser; empty on a server. */
export function formPageContext(locale?: string): FormPageContext {
  const page = typeof window === "undefined" ? undefined : window;
  const url = page?.location.href;
  const referrer = page?.document.referrer;
  return {
    ...(url ? { url } : {}),
    ...(referrer ? { referrer } : {}),
    ...(locale ? { locale } : {}),
  };
}

const FIRST_PRINTABLE = 32;
const DELETE = 127;

const withoutControls = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= FIRST_PRINTABLE && code !== DELETE;
    })
    .join("");

/** Text only, without control characters, cut at `max`. */
function hiddenText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const content = withoutControls(value).trim();
  return content ? content.slice(0, max) : undefined;
}

/** A page or referrer address: http(s) only, dropped when too long. */
function hiddenAddress(value: unknown): string | undefined {
  const address =
    typeof value === "string" ? withoutControls(value).trim() : "";
  return address.length <= FORM_HIDDEN_URL_MAX && validUrl(address)
    ? address
    : undefined;
}

/** A hidden value as the server keeps it: from the field's own source, as capped text. */
function acceptHiddenValue(
  field: FormHiddenField,
  raw: unknown
): string | undefined {
  switch (field.source.type) {
    case "static":
      return field.source.value.slice(0, FORM_HIDDEN_TEXT_MAX);
    case "locale":
      return formLocaleTag(hiddenText(raw, FORM_HIDDEN_TEXT_MAX));
    case "pageUrl":
    case "referrer":
      return hiddenAddress(raw);
    default:
      return hiddenText(raw, FORM_HIDDEN_TEXT_MAX);
  }
}

/** The value a bound column takes from a hidden text, checked like an answer. */
function hiddenColumnValue(
  field: ResolvedFormHiddenField,
  value: string
): unknown {
  switch (field.editor) {
    case "number": {
      const number = Number(value.replace(",", "."));
      return Number.isFinite(number) ? number : undefined;
    }
    case "date":
      return validDate(value) ? value : undefined;
    case "url":
      return validUrl(value) ? value : undefined;
    case "select":
      return (field.options ?? []).find(
        (option) => String(option.value) === value
      )?.value;
    case "boolean":
      if (value === "true" || value === "false") {
        return value === "true";
      }
      return;
    case "text":
    case "textarea":
      return value;
    default:
      return;
  }
}

/**
 * Hidden field values, checked as a server does: each field reads only its
 * own source from `input` (untrusted, by field id), as capped text; fixed
 * texts come from the settings, never from `input`. Bound fields give column
 * `values`, checked like answers (a value that does not fit is dropped); the
 * others give `context`, kept in the response's metadata.
 */
export function acceptFormHiddenFields(
  fields: readonly ResolvedFormHiddenField[],
  input: unknown
): { values: Record<string, unknown>; context: Record<string, string> } {
  const given = isRecord(input) ? input : {};
  const values: Record<string, unknown> = {};
  const context: Record<string, string> = {};
  for (const field of fields) {
    const raw = Object.hasOwn(given, field.id) ? given[field.id] : undefined;
    const value = acceptHiddenValue(field, raw);
    const typed =
      value !== undefined && field.columnId && field.editor
        ? hiddenColumnValue(field, value)
        : undefined;
    if (field.columnId && field.editor) {
      if (typed !== undefined) {
        values[field.columnId] = typed;
      }
    } else if (value !== undefined) {
      context[field.id] = value;
    }
  }
  return { values, context };
}

const pageParams = (url: string | undefined): URLSearchParams | undefined => {
  try {
    return url ? new URL(url).searchParams : undefined;
  } catch {
    return;
  }
};

function pageValue(
  source: FormHiddenSource,
  page: FormPageContext,
  params: URLSearchParams | undefined
): string | undefined {
  switch (source.type) {
    case "urlParam":
      return params?.get(source.name) ?? undefined;
    case "pageUrl":
      return page.url;
    case "referrer":
      return page.referrer;
    case "locale":
      return page.locale;
    default:
      // Fixed texts come from the settings, or the server's snapshot.
      return;
  }
}

/**
 * Hidden field values read from the page, by field id, for `onSubmit`'s
 * `meta.fields`. Hosts send them on; the server checks them again with
 * `acceptPublicFormResponse`.
 */
export function collectFormHiddenFields(
  fields: readonly FormHiddenField[],
  page: FormPageContext
): Record<string, string> {
  const params = pageParams(page.url);
  const values: Record<string, string> = {};
  for (const field of fields) {
    const raw = pageValue(field.source, page, params);
    const value =
      field.source.type === "static"
        ? undefined
        : acceptHiddenValue(field, raw);
    if (value !== undefined) {
      values[field.id] = value;
    }
  }
  return values;
}

const LINK_TOKEN = "{link}";

/** A consent statement around its link: `{link}` marks its place, else the link follows in parentheses. */
export function formConsentParts(consent: ResolvedFormConsent): {
  before: string;
  link?: { label: string; href?: string };
  after: string;
} {
  const index = consent.text.indexOf(LINK_TOKEN);
  if (!consent.link) {
    return { before: consent.text.replaceAll(LINK_TOKEN, ""), after: "" };
  }
  if (index < 0) {
    return { before: `${consent.text} (`, link: consent.link, after: ")" };
  }
  return {
    before: consent.text.slice(0, index),
    link: consent.link,
    after: consent.text.slice(index + LINK_TOKEN.length),
  };
}

/** The statement as read, the link's text in place: "I agree to the processing… in the privacy policy." */
export function formConsentStatement(consent: ResolvedFormConsent): string {
  const { before, link, after } = formConsentParts(consent);
  return `${before}${link?.label ?? ""}${after}`.trim();
}

/** A consent accepted with a response, as `metadata.consents` records it. */
export interface FormConsentRecord {
  id: string;
  version: string;
  /** The statement as shown, in the response's language, the link's text in place. */
  text: string;
  /** The link's address, when the statement has one. */
  href?: string;
  /** The language the statement was shown in. */
  locale?: string;
  /** When the host's server received the response (`acceptedAt`). */
  acceptedAt?: string;
}

/** A value of what the host's server knows about a response. */
export type FormServerContextValue = boolean | number | string;

/** What a response carries besides its column values; never written to a column. */
export interface FormResponseMetadata {
  /** The consents accepted, with their version and statement. */
  consents: FormConsentRecord[];
  /** Hidden fields not bound to a column, by field id (page values, checked). */
  context: Record<string, string>;
  /** What the host's server adds (`withFormServerContext`): page, revision, form token… */
  server?: Record<string, FormServerContextValue>;
}

/** The metadata of a response: its consents (all accepted) and the hidden fields kept out of columns. */
export function formResponseMetadata(
  settings: Pick<ResolvedFormSettings, "consents" | "locale">,
  context: Record<string, string>,
  acceptedAt?: string
): FormResponseMetadata {
  return {
    consents: settings.consents.map((consent) => ({
      id: consent.id,
      version: consent.version,
      text: formConsentStatement(consent),
      ...(consent.link?.href ? { href: consent.link.href } : {}),
      ...(settings.locale ? { locale: settings.locale } : {}),
      ...(acceptedAt ? { acceptedAt } : {}),
    })),
    context,
  };
}

/**
 * What `YayawTableForm` gives `onSubmit` besides the record. A public form's
 * host sends `consents`, `fields` and `locale` to its server with the answers,
 * where `acceptPublicFormResponse` checks them again.
 */
export interface FormSubmitMeta {
  /** The host's `context`, unchanged. */
  context?: Record<string, unknown>;
  /** Consents checked, by consent id. */
  consents: Record<string, true>;
  /** Hidden field values read from the page, by field id (untrusted). */
  fields: Record<string, string>;
  /** The language the form was shown in. */
  locale: string;
  /** The response's metadata as the browser sees it; servers rebuild it with `acceptPublicFormResponse`. */
  metadata: FormResponseMetadata;
}

/** The first question or consent with an error, in form order (errors are keyed by column id or consent id). */
export function formFirstError(
  items: readonly ResolvedFormItem[],
  errors: Record<string, unknown>
): { kind: "consent" | "question"; id: string } | undefined {
  for (const item of items) {
    if (item.kind === "question" && errors[item.question.columnId]) {
      return { kind: "question", id: item.question.id };
    }
    if (item.kind === "consent" && errors[item.consent.id]) {
      return { kind: "consent", id: item.consent.id };
    }
  }
}

/** `onSubmit`'s meta for a response whose consents are all checked (it was validated). */
export function formSubmitMeta(
  settings: Pick<ResolvedFormSettings, "consents" | "hiddenFields" | "locale">,
  fields: Record<string, string>,
  locale: string,
  context?: Record<string, unknown>
): FormSubmitMeta {
  const hidden = acceptFormHiddenFields(settings.hiddenFields, fields);
  return {
    context,
    consents: Object.fromEntries(
      settings.consents.map((consent) => [consent.id, true as const])
    ),
    fields,
    locale: settings.locale ?? locale,
    metadata: formResponseMetadata(settings, hidden.context),
  };
}

/**
 * The record a response creates: fixed values, then the hidden fields bound
 * to a column (`fields`: their values read from the page, by field id), then
 * the visible answers.
 */
export function formSubmission(
  settings: ResolvedFormSettings,
  values: Record<string, unknown>,
  fields?: Record<string, unknown>
): Record<string, unknown> {
  const hidden = acceptFormHiddenFields(settings.hiddenFields ?? [], fields);
  return {
    ...settings.hiddenValues,
    ...hidden.values,
    ...formVisibleValues(settings, values),
  };
}

/** One screen of the steps layout: a question, or a section and its questions. */
export interface FormStep {
  id: string;
  section?: ResolvedFormSection;
  questions: ResolvedFormQuestion[];
  /** Consents shown on this step, after its questions. */
  consents?: ResolvedFormConsent[];
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
    } else if (item.kind === "question" && visible(item.question.id)) {
      current.questions.push(item.question);
    }
  }
  steps.push(current);
  return steps.filter(
    (step) =>
      step.questions.length > 0 && (!step.section || visible(step.section.id))
  );
};

type StepSettings = Pick<ResolvedFormSettings, "items"> & { review?: boolean };

/** What placing consents needs to know about the steps. */
interface StepScan {
  items: readonly ResolvedFormItem[];
  /** Step of each visible question. */
  stepOf: Map<string, string>;
  shown: Set<string>;
  sectioned: boolean;
  review: boolean;
  last?: string;
}

/** The step of the first visible question after `index`. */
function stepAfter(scan: StepScan, index: number): string | undefined {
  const question = scan.items
    .slice(index + 1)
    .find(
      (entry) => entry.kind === "question" && scan.stepOf.has(entry.question.id)
    );
  return question?.kind === "question"
    ? scan.stepOf.get(question.question.id)
    : undefined;
}

/** The step a consent at `index` shows on, or `undefined` for the review. */
function consentStep(
  scan: StepScan,
  index: number,
  section: string,
  previous: string | undefined
): string | undefined {
  const next = stepAfter(scan, index);
  if (!next) {
    return scan.review ? undefined : scan.last;
  }
  if (scan.sectioned) {
    return scan.shown.has(section) ? section : next;
  }
  return previous ?? next;
}

/**
 * Where each consent shows in the steps layout: on the step it is placed in
 * (its section, or the question before it); after the last visible question,
 * or when its step is skipped, on the last step, the review when there is one.
 */
function consentPlaces(
  settings: StepSettings,
  steps: readonly FormStep[]
): {
  byStep: Map<string, ResolvedFormConsent[]>;
  review: ResolvedFormConsent[];
} {
  const scan: StepScan = {
    items: settings.items,
    stepOf: new Map(
      steps.flatMap((step) =>
        step.questions.map((question) => [question.id, step.id] as const)
      )
    ),
    shown: new Set(steps.map((step) => step.id)),
    sectioned: settings.items.some((item) => item.kind === "section"),
    review: settings.review === true,
    last: steps.at(-1)?.id,
  };
  const byStep = new Map<string, ResolvedFormConsent[]>();
  const review: ResolvedFormConsent[] = [];
  let section = "start";
  let previous: string | undefined;
  for (const [index, item] of settings.items.entries()) {
    if (item.kind === "section") {
      section = item.section.id;
    } else if (item.kind === "question") {
      previous = scan.stepOf.get(item.question.id) ?? previous;
    } else {
      const place = consentStep(scan, index, section, previous);
      if (place) {
        byStep.set(place, [...(byStep.get(place) ?? []), item.consent]);
      } else {
        review.push(item.consent);
      }
    }
  }
  return { byStep, review };
}

function plainSteps(
  settings: StepSettings,
  visible: (id: string) => boolean
): FormStep[] {
  if (settings.items.some((item) => item.kind === "section")) {
    return stepsBySection(settings.items, visible);
  }
  return settings.items.flatMap((item) =>
    item.kind === "question" && visible(item.question.id)
      ? [{ id: item.question.id, questions: [item.question] }]
      : []
  );
}

/**
 * Steps of the steps layout, skipping what the rules hide: one per question,
 * or one per section when the form has section breaks. Consents show on the
 * step they are placed in; those placed last show on the last step, which is
 * the review (`formReviewConsents`) when the form has one.
 */
export function formSteps(
  settings: StepSettings,
  evaluation?: Pick<FormEvaluation, "hidden">
): FormStep[] {
  const visible = (id: string) => !evaluation?.hidden.has(id);
  const steps = plainSteps(settings, visible);
  const { byStep } = consentPlaces(settings, steps);
  return steps.map((step) => ({
    ...step,
    consents: byStep.get(step.id) ?? [],
  }));
}

/** Consents shown on the review step: those placed after the last visible question. */
export function formReviewConsents(
  settings: StepSettings,
  evaluation?: Pick<FormEvaluation, "hidden">
): ResolvedFormConsent[] {
  if (!settings.review) {
    return [];
  }
  const visible = (id: string) => !evaluation?.hidden.has(id);
  return consentPlaces(settings, plainSteps(settings, visible)).review;
}

/** Whether a step may be skipped: none of its visible questions is required, and it asks no consent. */
export const formStepOptional = (
  step: FormStep,
  evaluation: Pick<FormEvaluation, "required">
): boolean =>
  !(
    step.questions.some((question) => evaluation.required.has(question.id)) ||
    step.consents?.length
  );

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
  errorLocation: "Choose a place or enter its coordinates.",
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
  editConditions: "Edit conditions",
  conditionsTitle: "Conditions for {label}",
  conditionsDescription: "Changes are saved as you make them.",
  noConditions: "Always shown.",
  conditionsProblem: "Some conditions are incomplete.",
  done: "Done",
  joinAll: "All",
  joinAny: "Any",
  ruleDaysUnit: "days",
  cmpIs: "is",
  cmpIsNot: "is not",
  cmpContains: "contains",
  cmpNotContains: "does not contain",
  cmpStartsWith: "starts with",
  cmpEq: "=",
  cmpNeq: "≠",
  cmpLt: "<",
  cmpLte: "≤",
  cmpGt: ">",
  cmpGte: "≥",
  cmpBetween: "between",
  cmpOn: "on",
  cmpBefore: "before",
  cmpAfter: "after",
  cmpInLast: "in the last",
  cmpInNext: "in the next",
  cmpIsAnyOf: "is any of",
  cmpIsNoneOf: "is none of",
  cmpContainsAny: "has any of",
  cmpContainsAll: "has all of",
  cmpContainsNone: "has none of",
  cmpIsChecked: "is checked",
  cmpIsUnchecked: "is unchecked",
  cmpIsEmpty: "is empty",
  cmpIsNotEmpty: "is not empty",
  errorConsent: "Check this box to continue.",
  consentText: "I agree to the processing of my answers.",
  consentTextLink:
    "I agree to the processing of my answers as described in the {link}.",
  consentLinkLabel: "privacy policy",
  newTab: "(opens in a new tab)",
  editingLanguage: "Editing",
  previewLanguage: "Language",
  addLanguage: "Add language",
  translationHint: "Texts not translated show in {language}.",
  missingTranslation: "Missing translation",
  closedMessage: "Closed message",
  optionLabels: "Option labels",
  optionLabel: "Label of {option}",
  addConsent: "Add consent",
  consent: "Consent",
  consentStatement: "Consent text",
  consentLinkHint:
    "Write {link} where the link goes; without it, the link follows the text.",
  linkText: "Link text",
  linkUrl: "Link address",
  consentVersion: "Version",
  consentNote: "Always required; conditions cannot hide it.",
  hiddenFields: "Hidden fields",
  hiddenFieldsHint:
    "Read from the page with each response, never shown. Values not saved in a column go to the response details.",
  hiddenField: "Hidden field",
  addHiddenField: "Add hidden field",
  hiddenSource: "Source",
  sourceUrlParam: "URL parameter",
  sourcePageUrl: "Page address",
  sourceReferrer: "Referring page",
  sourceLocale: "Form language",
  sourceStatic: "Fixed text",
  paramName: "Parameter name",
  staticValue: "Text",
  saveIn: "Save in",
  responseDetails: "Response details",
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
  errorLocation: "Choisissez un lieu ou saisissez ses coordonnées.",
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
  editConditions: "Modifier les conditions",
  conditionsTitle: "Conditions de {label}",
  conditionsDescription:
    "Les modifications sont enregistrées au fur et à mesure.",
  noConditions: "Toujours affichée.",
  conditionsProblem: "Certaines conditions sont incomplètes.",
  done: "Terminé",
  joinAll: "Toutes",
  joinAny: "Au moins une",
  ruleDaysUnit: "jours",
  cmpIs: "est",
  cmpIsNot: "n’est pas",
  cmpContains: "contient",
  cmpNotContains: "ne contient pas",
  cmpStartsWith: "commence par",
  cmpEq: "=",
  cmpNeq: "≠",
  cmpLt: "<",
  cmpLte: "≤",
  cmpGt: ">",
  cmpGte: "≥",
  cmpBetween: "entre",
  cmpOn: "le",
  cmpBefore: "avant le",
  cmpAfter: "après le",
  cmpInLast: "dans les derniers",
  cmpInNext: "dans les prochains",
  cmpIsAnyOf: "est l’un de",
  cmpIsNoneOf: "n’est aucun de",
  cmpContainsAny: "contient l’un de",
  cmpContainsAll: "contient tous",
  cmpContainsNone: "ne contient aucun de",
  cmpIsChecked: "est coché",
  cmpIsUnchecked: "n’est pas coché",
  cmpIsEmpty: "est vide",
  cmpIsNotEmpty: "n’est pas vide",
  errorConsent: "Cochez cette case pour continuer.",
  consentText: "J’accepte le traitement de mes réponses.",
  consentTextLink:
    "J’accepte le traitement de mes réponses conformément à la {link}.",
  consentLinkLabel: "politique de confidentialité",
  newTab: "(s’ouvre dans un nouvel onglet)",
  editingLanguage: "Édition",
  previewLanguage: "Langue",
  addLanguage: "Ajouter une langue",
  translationHint: "Les textes non traduits s’affichent en {language}.",
  missingTranslation: "Traduction manquante",
  closedMessage: "Message de fermeture",
  optionLabels: "Libellés des options",
  optionLabel: "Libellé de {option}",
  addConsent: "Ajouter un consentement",
  consent: "Consentement",
  consentStatement: "Texte du consentement",
  consentLinkHint:
    "Écrivez {link} à l’endroit du lien ; sans lui, le lien suit le texte.",
  linkText: "Texte du lien",
  linkUrl: "Adresse du lien",
  consentVersion: "Version",
  consentNote:
    "Toujours obligatoire ; les conditions ne peuvent pas le masquer.",
  hiddenFields: "Champs cachés",
  hiddenFieldsHint:
    "Lus sur la page à chaque réponse, jamais affichés. Les valeurs non enregistrées dans une colonne vont dans les détails de la réponse.",
  hiddenField: "Champ caché",
  addHiddenField: "Ajouter un champ caché",
  hiddenSource: "Source",
  sourceUrlParam: "Paramètre d’URL",
  sourcePageUrl: "Adresse de la page",
  sourceReferrer: "Page de provenance",
  sourceLocale: "Langue du formulaire",
  sourceStatic: "Texte fixe",
  paramName: "Nom du paramètre",
  staticValue: "Texte",
  saveIn: "Enregistrer dans",
  responseDetails: "Détails de la réponse",
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

/** An operator as a menu shows it, short and complete: "is", "before", "in the last". */
export function formOperatorLabel(
  operator: ConditionOperator,
  locale: string,
  translate?: FormTranslate
): string {
  return formLabel(
    `cmp${capitalize(operator)}` as FormLabelKey,
    locale,
    translate
  );
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

/** The editable condition fields of a form: its questions, as the engine sees them (labels in `locale`). */
export function formRuleFields(
  columns: readonly FormColumn[],
  settings: FormViewSettings,
  locale?: string
): ConditionField[] {
  const resolved = resolveFormSettings(
    columns,
    undefined,
    { ...settings, rules: [] },
    locale
  );
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
  /**
   * Send to the browser with `columns`: questions, sections, consents, rules,
   * layout, texts in every language, and the hidden fields it reads from the
   * page (their columns and fixed texts stay in `hiddenFields`).
   */
  form: FormViewSettings;
  /** Only the asked columns, with their names, types and options. */
  columns: FormColumn[];
  /** Keep on the server: `acceptPublicFormResponse` adds them to each response. */
  hiddenValues: Record<string, FormHiddenValue>;
  /** Keep on the server: hidden fields with their sources, columns and fixed texts (the only values a response may carry). */
  hiddenFields?: FormHiddenField[];
  /** Keep on the server: the columns hidden fields write, to check their values. */
  hiddenColumns?: FormColumn[];
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

/** A hidden field as saved: its id, source and column. */
const plainHiddenField = (field: FormHiddenField): FormHiddenField =>
  field.columnId
    ? {
        id: field.id,
        kind: "hidden",
        source: field.source,
        columnId: field.columnId,
      }
    : { id: field.id, kind: "hidden", source: field.source };

/**
 * The saved questions, sections and consents kept by a snapshot, with their
 * texts in every language, then the hidden fields the browser reads from the
 * page (without their columns; fixed texts stay on the server).
 */
function snapshotItems(
  settings: FormViewSettings,
  resolved: ResolvedFormSettings
): FormItem[] {
  const saved = new Map(
    (settings.questions ?? []).map((item) => [item.id, item])
  );
  const items = resolved.items.map((item): FormItem => {
    if (item.kind === "question") {
      const { id, columnId } = item.question;
      return { ...(saved.get(id) as FormQuestion | undefined), id, columnId };
    }
    const id = formItemId(item);
    const own = saved.get(id);
    if (own) {
      return own;
    }
    return item.kind === "section"
      ? { id, kind: "section" }
      : { id, kind: "consent" };
  });
  const collected = resolved.hiddenFields.flatMap((field): FormItem[] =>
    field.source.type === "static"
      ? []
      : [{ id: field.id, kind: "hidden", source: field.source }]
  );
  return [...items, ...collected];
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
  const written = new Set(
    resolved.hiddenFields.flatMap((field) =>
      field.columnId && field.editor ? [field.columnId] : []
    )
  );
  const hiddenColumns = columns
    .filter((column) => written.has(column.id))
    .map((column) => snapshotColumn(column));
  return {
    version: 1,
    ...(viewId ? { viewId } : {}),
    form,
    columns: columns
      .filter((column) => asked.has(column.id))
      .map((column) => snapshotColumn(column)),
    hiddenValues,
    ...(resolved.hiddenFields.length
      ? { hiddenFields: resolved.hiddenFields.map(plainHiddenField) }
      : {}),
    ...(hiddenColumns.length ? { hiddenColumns } : {}),
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
 * What the browser sends with a public response besides the answers: the
 * consents checked and the hidden fields read from the page (`onSubmit`'s
 * `meta.consents`, `meta.fields`, `meta.locale`). All of it is untrusted.
 */
export interface PublicFormResponseInput {
  /** Consents checked, by consent id (`true`). */
  consents?: unknown;
  /** Hidden field values read from the page, by field id. */
  fields?: unknown;
  /** The language the form was shown in; its statements are recorded in it. */
  locale?: unknown;
  /** Set by the host's server: stamped on each accepted consent. */
  acceptedAt?: Date | string;
}

/** A public response the server accepted: the record to create and its metadata. */
export interface AcceptedPublicFormResponse {
  ok: true;
  values: Record<string, unknown>;
  /** Consents and context of the response; never written to a column. */
  metadata: FormResponseMetadata;
}

export type PublicFormAcceptance =
  | AcceptedPublicFormResponse
  | { ok: false; errors: Record<string, FormErrorCode> };

const acceptedAtText = (value: Date | string | undefined) => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }
  return text(value);
};

/** The snapshot's hidden fields, with the columns they may write. */
function snapshotHiddenFields(
  snapshot: PublicFormSnapshot
): ResolvedFormHiddenField[] {
  const asked = new Set(snapshot.columns.map((column) => column.id));
  const eligible = formColumns(snapshot.hiddenColumns ?? []).eligible;
  const byId = new Map(eligible.map((column) => [column.id, column]));
  return normalizeFormQuestions(snapshot.hiddenFields ?? [])
    .filter(isFormHiddenField)
    .map((field) => resolveHiddenField(field, byId, asked));
}

/**
 * Server-side check of a public response: keeps only the snapshot's asked
 * columns, evaluates the rules (hidden answers are ignored, required-if-
 * visible), validates again, applies `set` values and adds the fixed values.
 * Every consent must be checked (`response.consents`); accepted consents are
 * recorded in `metadata.consents` with their version and statement in the
 * response's language. Hidden fields read only the snapshot's sources, as
 * capped text: bound ones become column values checked like answers, the
 * others `metadata.context`.
 */
export function acceptPublicFormResponse(
  snapshot: PublicFormSnapshot,
  input: unknown,
  response: PublicFormResponseInput = {}
): PublicFormAcceptance {
  const resolved = resolveFormSettings(
    snapshot.columns,
    undefined,
    snapshot.form,
    formLocaleTag(response.locale)
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
  const errors = {
    ...validateFormValues(resolved.questions, values, evaluation),
    ...validateFormConsents(resolved.consents, response.consents),
  };
  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  const hidden = acceptFormHiddenFields(
    snapshotHiddenFields(snapshot),
    response.fields
  );
  return {
    ok: true,
    values: {
      ...formVisibleValues(resolved, values, evaluation),
      ...snapshot.hiddenValues,
      ...hidden.values,
    },
    metadata: formResponseMetadata(
      resolved,
      hidden.context,
      acceptedAtText(response.acceptedAt)
    ),
  };
}

const SERVER_KEY = /^[\w.:-]{1,100}$/;

/**
 * Adds what the host's server knows about an accepted response (page id and
 * revision, form token, signed-in user…) to `metadata.server`. Browser values
 * never reach it; keys are word characters, values text (capped), numbers or
 * yes/no.
 */
export function withFormServerContext(
  accepted: AcceptedPublicFormResponse,
  context: Record<string, unknown>
): AcceptedPublicFormResponse {
  const server: Record<string, FormServerContextValue> = {
    ...accepted.metadata.server,
  };
  for (const [key, value] of Object.entries(context)) {
    if (!SERVER_KEY.test(key)) {
      continue;
    }
    if (typeof value === "string") {
      server[key] = value.slice(0, FORM_HIDDEN_URL_MAX);
    } else if (
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      server[key] = value;
    }
  }
  return { ...accepted, metadata: { ...accepted.metadata, server } };
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

/** A row of the settings panel: a column (asked or not), a section break, a consent or a hidden field. */
export type FormSettingsRow<T extends FormColumn = FormColumn> =
  | { kind: "question"; column: T; question?: FormQuestion; index: number }
  | { kind: "section"; section: FormSectionBreak; index: number }
  | { kind: "consent"; consent: FormConsentQuestion; index: number }
  | { kind: "hidden"; field: FormHiddenField; index: number };

/**
 * Rows of the settings panel: asked questions, sections and consents in
 * order (`index` among them, for moving), then the other editable columns,
 * then the hidden fields (never shown, so not ordered: `index` -1).
 */
export function formSettingsRows<T extends FormColumn>(
  columns: readonly T[],
  settings: FormViewSettings
): FormSettingsRow<T>[] {
  const { eligible } = formColumns(columns);
  const items = formQuestionList(columns, settings);
  const shown = formOrderedItems(items).flatMap(
    (item, index): FormSettingsRow<T>[] => {
      if (isFormSection(item)) {
        return [{ kind: "section", section: item, index }];
      }
      if (isFormConsent(item)) {
        return [{ kind: "consent", consent: item, index }];
      }
      const column = isFormQuestion(item)
        ? eligible.find((entry) => entry.id === item.columnId)
        : undefined;
      return column && isFormQuestion(item)
        ? [{ kind: "question", column, question: item, index }]
        : [];
    }
  );
  const askedIds = new Set(
    items.filter(isFormQuestion).map((question) => question.columnId)
  );
  return [
    ...shown,
    ...eligible
      .filter((column) => !askedIds.has(column.id))
      .map(
        (column): FormSettingsRow<T> => ({
          kind: "question",
          column,
          index: -1,
        })
      ),
    ...items
      .filter(isFormHiddenField)
      .map(
        (field): FormSettingsRow<T> => ({ kind: "hidden", field, index: -1 })
      ),
  ];
}

// Languages -----------------------------------------------------------------

/** Every text of form settings, to find the languages they are written in. */
function settingsTexts(settings: FormViewSettings): (FormText | undefined)[] {
  const texts: (FormText | undefined)[] = TEXT_KEYS.map((key) => settings[key]);
  for (const item of settings.questions ?? []) {
    if (isFormSection(item)) {
      texts.push(item.title, item.description);
    } else if (isFormConsent(item)) {
      texts.push(item.text, item.link?.label, item.link?.href);
    } else if (isFormQuestion(item)) {
      texts.push(
        item.label,
        item.help,
        item.placeholder,
        ...Object.values(item.optionLabels ?? {})
      );
    }
  }
  return texts;
}

/**
 * Languages a form is written in, its default language first: the default,
 * `locales`, and every language its texts use.
 */
export function formLocales(
  settings: FormViewSettings,
  fallback?: string
): string[] {
  return uniqueFormLocales([
    formDefaultLocale(settings) ?? fallback,
    ...(settings.locales ?? []),
    ...settingsTexts(settings).flatMap(formTextLocales),
  ]);
}

/**
 * Languages of a Form view, for the settings' switcher and the view's
 * preview: its default language (`defaultLocale`, else the first of
 * `locales`, else `fallback`), its `locales` (the view's, else the table's
 * `table.form.locales`: the host's languages) and those its texts use.
 */
export function formViewLocales(
  defaults: unknown,
  view: unknown,
  fallback?: string
): string[] {
  return formLocales(mergeFormSettings(defaults, view), fallback);
}

/** Languages "Add language" offers: the host's (`table.form.locales`), then common ones, less those the form has. */
export function formAddableLocales(
  defaults: unknown,
  languages: readonly string[]
): string[] {
  const offered = normalizeFormViewConfig(defaults)?.locales ?? [];
  const present = new Set(languages.map((locale) => locale.toLowerCase()));
  return uniqueFormLocales([...offered, ...FORM_COMMON_LOCALES]).filter(
    (locale) => !present.has(locale.toLowerCase())
  );
}

/** The language a form is shown in among its languages: the reader's locale, its language, else the default. */
export function formMatchLocale(
  languages: readonly string[],
  locale: string
): string | undefined {
  const lower = locale.toLowerCase();
  const language = formLanguage(locale);
  return (
    languages.find((item) => item.toLowerCase() === lower) ??
    languages.find((item) => item.toLowerCase() === language) ??
    languages.find((item) => formLanguage(item) === language)
  );
}

/**
 * Whether an item misses a translation in `locale`: a question's label (the
 * column name when unset), help, placeholder or option labels; a section's
 * title or description; a consent's statement or link text. Hidden fields
 * have no text.
 */
export function formItemMissingTranslation(
  item: FormItem,
  locale: string,
  defaultLocale: string,
  column?: FormColumn
): boolean {
  const missing = (value: FormText | undefined, source?: string) =>
    formTextMissing(value, locale, defaultLocale, source);
  if (isFormSection(item)) {
    return missing(item.title) || missing(item.description);
  }
  if (isFormConsent(item)) {
    return missing(item.text) || missing(item.link?.label);
  }
  if (!isFormQuestion(item)) {
    return false;
  }
  const options = formOptions(column?.options);
  return (
    missing(item.label, column?.header) ||
    missing(item.help) ||
    missing(item.placeholder) ||
    options.some((option) =>
      missing(item.optionLabels?.[String(option.value)], option.label)
    )
  );
}

/** A question's option labels with the label of `option` replaced, or removed when `text` is `undefined`. */
export function setFormOptionLabel(
  question: FormQuestion,
  option: string,
  text: FormText | undefined
): Record<string, FormText> | undefined {
  const labels = { ...question.optionLabels };
  if (text === undefined) {
    Reflect.deleteProperty(labels, option);
  } else {
    labels[option] = text;
  }
  return Object.keys(labels).length ? labels : undefined;
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
