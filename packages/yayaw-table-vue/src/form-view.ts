/**
 * Form view model shared by the React and Vue editions: settings, questions,
 * validation, submissions, labels and the public-link contract. It has no UI
 * or state-library dependency, so a host can also run it on its server.
 */
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

export interface FormViewSettings {
  title?: string;
  description?: string;
  /** Questions in order; unset asks every column that has an editor. */
  questions?: FormQuestion[];
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

export interface ResolvedFormSettings {
  title?: string;
  description?: string;
  questions: ResolvedFormQuestion[];
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

/** Questions in order, each column and id at most once. */
export function normalizeFormQuestions(value: unknown): FormQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = new Set<string>();
  const columns = new Set<string>();
  const questions: FormQuestion[] = [];
  for (const item of value) {
    const question = normalizeQuestion(item);
    if (question && !ids.has(question.id) && !columns.has(question.columnId)) {
      ids.add(question.id);
      columns.add(question.columnId);
      questions.push(question);
    }
  }
  return questions;
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

/** Everything a form renders, with questions limited to columns it can edit. */
export function resolveFormSettings(
  columns: readonly FormColumn[],
  defaults: unknown,
  view: unknown
): ResolvedFormSettings {
  const settings = mergeFormSettings(defaults, view);
  const { eligible } = formColumns(columns);
  const byId = new Map(eligible.map((column) => [column.id, column]));
  const questions = (
    settings.questions ??
    eligible.map((column) => ({ id: column.id, columnId: column.id }))
  ).flatMap((question) => {
    const column = byId.get(question.columnId);
    const editor = column && formColumnEditor(column);
    return column && editor ? [resolveQuestion(question, column, editor)] : [];
  });
  const asked = new Set(questions.map((question) => question.columnId));
  const hiddenValues = Object.fromEntries(
    Object.entries(settings.hiddenValues ?? {}).filter(
      ([columnId]) => byId.has(columnId) && !asked.has(columnId)
    )
  );
  return {
    title: settings.title,
    description: settings.description,
    questions,
    hiddenValues,
    submitLabel: settings.submitLabel,
    successMessage: settings.successMessage,
    allowAnotherResponse: settings.allowAnotherResponse !== false,
    redirectUrl: settings.redirectUrl,
  };
}

/** The questions a settings panel edits: the view's, or one per editable column. */
export function formQuestionList(
  columns: readonly FormColumn[],
  settings: FormViewSettings
): FormQuestion[] {
  const { eligible } = formColumns(columns);
  const known = new Set(eligible.map((column) => column.id));
  return (
    settings.questions ??
    eligible.map((column) => ({ id: column.id, columnId: column.id }))
  ).filter((question) => known.has(question.columnId));
}

/** Move a question one place up (-1) or down (+1); other positions are kept. */
export function moveFormQuestion(
  questions: readonly FormQuestion[],
  id: string,
  offset: -1 | 1
): FormQuestion[] {
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
  questions: readonly FormQuestion[],
  columnId: string,
  asked: boolean
): FormQuestion[] {
  const rest = questions.filter((question) => question.columnId !== columnId);
  return asked ? [...rest, { id: columnId, columnId }] : rest;
}

/** Change one question; empty texts and `required: false` are removed. */
export function updateFormQuestion(
  questions: readonly FormQuestion[],
  id: string,
  patch: Partial<Omit<FormQuestion, "columnId" | "id">>
): FormQuestion[] {
  return questions.map((question) =>
    question.id === id
      ? (normalizeQuestion({
          ...question,
          ...patch,
          required: patch.required ?? question.required,
        }) ?? question)
      : question
  );
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
 * for public forms, again on the host's server.
 */
export function validateFormValues(
  questions: readonly ResolvedFormQuestion[],
  values: Record<string, unknown>
): Record<string, FormErrorCode> {
  const errors: Record<string, FormErrorCode> = {};
  for (const question of questions) {
    const value = values[question.columnId];
    if (isBlank(value, question.editor)) {
      if (question.required) {
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

/** The record a response creates: hidden values, then the answers. */
export function formSubmission(
  settings: ResolvedFormSettings,
  values: Record<string, unknown>
): Record<string, unknown> {
  return { ...settings.hiddenValues, ...values };
}

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
  /** Send to the browser with `columns`. */
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

/**
 * A publishable copy of a form: explicit questions, the columns they need and
 * the fixed values. No rows, filters, other columns or table settings.
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
  const overrides = new Map(
    (settings.questions ?? []).map((question) => [question.id, question])
  );
  const form: FormViewSettings = normalizeFormViewConfig({
    ...settings,
    hiddenValues: undefined,
    questions: resolved.questions.map(({ id, columnId }) => ({
      ...overrides.get(id),
      id,
      columnId,
    })),
  }) ?? { questions: [] };
  const viewId =
    "id" in view && typeof view.id === "string" ? view.id : undefined;
  return {
    version: 1,
    ...(viewId ? { viewId } : {}),
    form,
    columns: columns
      .filter((column) => asked.has(column.id))
      .map((column) => snapshotColumn(column)),
    hiddenValues: resolved.hiddenValues,
  };
}

/**
 * Server-side check of a public response: keeps only the snapshot's asked
 * columns, validates them again and adds the fixed values.
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
  const errors = validateFormValues(resolved.questions, values);
  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    values: { ...values, ...snapshot.hiddenValues },
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
 * cannot serve pages: the host stores the snapshot, serves it on a public
 * route that renders `YayawTableForm`, and validates responses on its server
 * with `acceptPublicFormResponse`.
 */
export interface FormLinkActions {
  status: (viewId: string) => Promise<FormLinkStatus | null>;
  publish: (
    viewId: string,
    snapshot: PublicFormSnapshot
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

/** Rows of the settings panel: asked questions in order, then the other editable columns. */
export function formSettingsRows<T extends FormColumn>(
  columns: readonly T[],
  settings: FormViewSettings
): { column: T; question?: FormQuestion; index: number }[] {
  const { eligible } = formColumns(columns);
  const questions = formQuestionList(columns, settings);
  const asked = questions.flatMap((question, index) => {
    const column = eligible.find((item) => item.id === question.columnId);
    return column ? [{ column, question, index }] : [];
  });
  const askedIds = new Set(questions.map((question) => question.columnId));
  return [
    ...asked,
    ...eligible
      .filter((column) => !askedIds.has(column.id))
      .map((column) => ({ column, index: -1 })),
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
