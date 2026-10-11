import type { TableActivityRecord } from "./activity-shortcuts";
import { formatLocation, locationDetail } from "./location-model";
import type {
  RecordPresentation,
  RecordPresentationConfig,
} from "./record-presentation";
import {
  type ColumnValueFormat,
  formatColumnDate,
  formatColumnNumber,
} from "./value-format";

/** Framework-independent contracts for read-only records and application-owned audit data. */
export type DetailRecord = Record<string, unknown>;
export type DetailPresentation = RecordPresentation;
export type DetailType =
  | "text"
  | "string"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "code"
  | "json"
  | "location"
  | "url"
  | "email"
  | "tel"
  | "password"
  | "image"
  | "video"
  | "select"
  | "multiSelect"
  | "tag"
  | "dynamicType"
  | "custom"
  | "checkbox"
  | "switch"
  | "radio"
  | "select-with-add-new"
  | "tablePicker"
  | "collection"
  | "files"
  | "value-type"
  | "dynamic-value";

export interface DetailField {
  id: string;
  label: string;
  type?: DetailType;
  accessorKey?: string;
  getValue?: (row: DetailRecord) => unknown;
  typeKey?: string;
  options?: readonly { value: unknown; label: string }[];
  /** Intl options for this field only; otherwise its column's format applies. */
  numberFormat?: Intl.NumberFormatOptions;
  /**
   * The column's formats (number format, date pattern or preset, time zone,
   * clock): values read as in the table. Filled from the table's columns.
   */
  format?: ColumnValueFormat;
  /** Explicitly omit sensitive or irrelevant fields from both details and activity. */
  hidden?: boolean | ((row: DetailRecord) => boolean);
}

export interface DetailSection {
  /** Field sections are the default kind. */
  kind?: "fields";
  id: string;
  title: string;
  description?: string;
  fields: readonly DetailField[];
}

/** A host-handled action of a related list: `action` names it in `onRelatedAction`. */
export interface DetailRelatedAction {
  action: string;
  label?: string;
}

/**
 * Records of another source linked to this one, e.g. the people of a company.
 * Rows come from `rows` (filtered by the link) or from the host's `loadRelated`,
 * called once the section is open and visible.
 */
export interface DetailRelatedSection {
  kind: "related";
  id: string;
  title: string;
  description?: string;
  /** The related source or table id, handed to `loadRelated`. */
  source: string;
  /** The related records' field holding the link (a value or a list of values). */
  foreignKey: string;
  /** This record's field the link points to; default `"id"`. */
  localKey?: string;
  /** The related records' fields shown, as detail fields. */
  columns: readonly DetailField[];
  sort?: { id: string; desc?: boolean };
  /** Most rows shown; the rest are counted. */
  limit?: number;
  /** Text shown without related records. */
  empty?: string;
  /** Static related records, filtered by `foreignKey`; used instead of `loadRelated`. */
  rows?: readonly DetailRecord[];
  /** A per-row "Open" button handled by the host. */
  open?: DetailRelatedAction;
  /** An "Add" button in the section header handled by the host. */
  add?: DetailRelatedAction;
  /** Start closed; the records load when the section is first opened. */
  collapsed?: boolean;
  hidden?: boolean | ((row: DetailRecord) => boolean);
}

/** A section whose content the host renders (`renderSection` in React, `#detail-section-<id>` in Vue). */
export interface DetailCustomSection {
  kind: "custom";
  id: string;
  title: string;
  description?: string;
  /** Serializable settings handed to the host renderer. */
  data?: Record<string, unknown>;
  hidden?: boolean | ((row: DetailRecord) => boolean);
}

export type DetailSectionConfig =
  | DetailSection
  | DetailRelatedSection
  | DetailCustomSection;

export interface DetailRelatedQuery {
  /** This record's link value (`localKey`). */
  value: unknown;
  sort?: DetailRelatedSection["sort"];
  limit?: number;
}

export type DetailRelatedLoader = (
  section: DetailRelatedSection,
  row: DetailRecord,
  query: DetailRelatedQuery
) => readonly DetailRecord[] | Promise<readonly DetailRecord[]>;

export interface DetailRelatedActionEvent {
  /** The configured action name. */
  action: string;
  kind: "open" | "add";
  section: DetailRelatedSection;
  /** The record whose details are shown. */
  row: DetailRecord;
  /** The related record, for "open". */
  related?: DetailRecord;
}

/**
 * Typed confirmation of deletions: the delete button enables once the user
 * typed the expected value.
 */
export interface DeleteConfirmationConfig {
  type: "typed";
  /** A record's deletion asks for its title (default), a column's value or `text`. */
  match?: "title" | "column" | "text";
  /** The column (or dot path) for `match: "column"`. */
  column?: string;
  /** The fixed word for `match: "text"` and `bulkMatch: "text"`; default the localized "DELETE". */
  text?: string;
  /** Bulk deletion asks for the number of selected records (default) or `text`. */
  bulkMatch?: "count" | "text";
  /** Compare letter case; default false. Surrounding spaces are always ignored. */
  caseSensitive?: boolean;
}

export interface DetailActivity {
  id: string;
  actor: { name: string };
  at: string;
  action: string;
  /** The original event remains in the log; an undo event references its ID. */
  reverts?: string;
  /** A redo is a new event too: it re-applies the undo event it references. */
  redoes?: string;
  /** Entries from one user action are undone together by the table shortcut. */
  transactionId?: string;
  reversible?: boolean;
  changes?: readonly { field: string; before: unknown; after: unknown }[];
}

/** `TNode` is what render hooks return, e.g. `RecordDetailsConfig<ReactNode>` in React. */
export interface RecordDetailsConfig<TNode = unknown> {
  /** Standalone presentation; the table-wide presentation takes precedence. */
  presentation?: RecordPresentationConfig;
  width?: string;
  title?: (row: DetailRecord) => string;
  description?: (row: DetailRecord) => string;
  /**
   * Omit to derive fields from the table's column definitions. Related and
   * custom sections alone keep the derived fields first.
   */
  sections?: readonly DetailSectionConfig[];
  updatedAt?: (row: DetailRecord) => string | Date | undefined;
  updatedBy?: (row: DetailRecord) => string | undefined;
  /** The host application owns fetching and storing the audit log. */
  activity?: (row: DetailRecord) => readonly DetailActivity[];
  /** Table-wide activity, including removed records, used by Ctrl/Cmd+Z and record details. */
  history?: () => readonly TableActivityRecord[];
  canRevert?: (entry: DetailActivity, row: DetailRecord) => boolean;
  labels?: Partial<DetailLabels>;
  /** Typed confirmation of the record's deletion; the table's `deleteConfirmation` otherwise. */
  deleteConfirmation?: DeleteConfirmationConfig;
  /** Loads a related section's records; the table does not know the backend. */
  loadRelated?: DetailRelatedLoader;
  /** Handles the related sections' "open" and "add" actions. */
  onRelatedAction?: (event: DetailRelatedActionEvent) => void;
  /** Renders a field; return `undefined` for the standard renderer. */
  renderField?: (
    field: DetailField,
    value: unknown,
    row: DetailRecord
  ) => TNode | undefined;
  /** Renders a custom section's content; `undefined` hides the section. */
  renderSection?: (
    section: DetailCustomSection,
    row: DetailRecord
  ) => TNode | undefined;
}

export interface DetailLabels {
  details: string;
  activity: string;
  record: string;
  updated: string;
  by: string;
  empty: string;
  yes: string;
  no: string;
  noActivity: string;
  edit: string;
  delete: string;
  close: string;
  cancel: string;
  confirmDelete: string;
  deleteDescription: string;
  deleting: string;
  deleteError: string;
  before: string;
  after: string;
  undo: string;
  undoing: string;
  undone: string;
  /** Complete localized sentence; {action} is replaced with the activity label. */
  undoSuccess: string;
  undoError: string;
  undoUnavailable: string;
  /** Complete localized sentence; {action} is replaced with the redone activity label. */
  redoSuccess: string;
  redoError: string;
  redoUnavailable: string;
  /** Complete localized sentence; {value} is replaced with the value to type. */
  typeToConfirm: string;
  confirmationMismatch: string;
  deleteKeyword: string;
  relatedLoading: string;
  relatedError: string;
  relatedEmpty: string;
  /** {count} is replaced with the number of related records not shown. */
  relatedMore: string;
  retry: string;
  open: string;
  add: string;
}

export type DetailRevertHandler = (
  row: DetailRecord,
  entry: DetailActivity
) =>
  | { success: boolean; error?: string }
  | Promise<{ success: boolean; error?: string }>;

export function detailLabels(
  locale = "en",
  overrides?: Partial<DetailLabels>
): DetailLabels {
  const labels: DetailLabels = locale.startsWith("fr")
    ? {
        details: "Informations",
        activity: "Activité",
        record: "Fiche",
        updated: "Mis à jour le",
        by: "par",
        empty: "Non renseigné",
        yes: "Oui",
        no: "Non",
        noActivity: "Aucune modification enregistrée.",
        edit: "Modifier",
        delete: "Supprimer",
        close: "Fermer",
        cancel: "Annuler",
        confirmDelete: "Supprimer cette entrée ?",
        deleteDescription:
          "Cette action est définitive. L’entrée suivante sera supprimée :",
        deleting: "Suppression…",
        deleteError: "La suppression a échoué. Veuillez réessayer.",
        before: "Avant",
        after: "Après",
        undo: "Annuler cette modification",
        undoing: "Annulation…",
        undone: "Annulée",
        undoSuccess: "Action « {action} » annulée.",
        undoError: "L’annulation a échoué. Veuillez réessayer.",
        undoUnavailable:
          "Cette modification ne peut plus être annulée : les champs ont changé depuis.",
        redoSuccess: "Action « {action} » rétablie.",
        redoError: "Le rétablissement a échoué. Veuillez réessayer.",
        redoUnavailable:
          "Rien à rétablir : aucune annulation récente, ou ses champs ont changé depuis.",
        typeToConfirm: "Saisissez « {value} » pour confirmer.",
        confirmationMismatch: "Le texte saisi ne correspond pas.",
        deleteKeyword: "SUPPRIMER",
        relatedLoading: "Chargement…",
        relatedError: "Le chargement a échoué.",
        relatedEmpty: "Aucune entrée liée.",
        relatedMore: "{count} de plus",
        retry: "Réessayer",
        open: "Ouvrir",
        add: "Ajouter",
      }
    : {
        details: "Details",
        activity: "Activity",
        record: "Record",
        updated: "Updated",
        by: "by",
        empty: "Not provided",
        yes: "Yes",
        no: "No",
        noActivity: "No recorded changes yet.",
        edit: "Edit",
        delete: "Delete",
        close: "Close",
        cancel: "Cancel",
        confirmDelete: "Delete this record?",
        deleteDescription:
          "This action is permanent. The following record will be deleted:",
        deleting: "Deleting…",
        deleteError: "Deletion failed. Please try again.",
        before: "Before",
        after: "After",
        undo: "Undo this change",
        undoing: "Undoing…",
        undone: "Undone",
        undoSuccess: "Action “{action}” undone.",
        undoError: "Undo failed. Please try again.",
        undoUnavailable:
          "This change can no longer be undone because its fields have changed since.",
        redoSuccess: "Action “{action}” redone.",
        redoError: "Redo failed. Please try again.",
        redoUnavailable:
          "Nothing to redo: no recent undo, or its fields have changed since.",
        typeToConfirm: "Type “{value}” to confirm.",
        confirmationMismatch: "The text does not match.",
        deleteKeyword: "DELETE",
        relatedLoading: "Loading…",
        relatedError: "Loading failed.",
        relatedEmpty: "No linked records.",
        relatedMore: "{count} more",
        retry: "Retry",
        open: "Open",
        add: "Add",
      };
  return { ...labels, ...overrides };
}

/** Translate the whole sentence instead of guessing the action label's grammatical gender. */
export function detailUndoMessage(
  entry: DetailActivity,
  labels: DetailLabels
): string {
  return labels.undoSuccess.replaceAll("{action}", () => entry.action);
}

export function detailRedoMessage(
  entry: DetailActivity,
  labels: DetailLabels
): string {
  return labels.redoSuccess.replaceAll("{action}", () => entry.action);
}

interface DetailColumn extends ColumnValueFormat {
  id: string;
  header?: string;
  type?: string;
  accessorKey?: string;
  accessorFn?: (row: DetailRecord) => unknown;
  options?: readonly { value: unknown; label: string }[];
  typeKey?: string;
}

const columnFormat = (column: DetailColumn): ColumnValueFormat => ({
  type: column.type,
  numberFormat: column.numberFormat,
  dateDisplayPreset: column.dateDisplayPreset,
  dateFormat: column.dateFormat,
  timeZone: column.timeZone,
  hour12: column.hour12,
});

const isFieldSection = (section: DetailSectionConfig): section is DetailSection =>
  section.kind === undefined || section.kind === "fields";

/** Related and custom sections alone keep the fields derived from the columns. */
const derivesFields = (sections?: readonly DetailSectionConfig[]) =>
  !sections ||
  (sections.length > 0 && !sections.some((section) => isFieldSection(section)));

const shownFor = (
  hidden: boolean | ((row: DetailRecord) => boolean) | undefined,
  row: DetailRecord
) => (typeof hidden === "function" ? !hidden(row) : !hidden);

/** The record's field sections (related and custom sections excluded). */
export function detailSections(
  config: Pick<RecordDetailsConfig, "sections">,
  columns: readonly DetailColumn[],
  row: DetailRecord,
  title: string
): DetailSection[] {
  const declared = config.sections?.filter(isFieldSection);
  const sections: readonly DetailSection[] = (
    derivesFields(config.sections) ? undefined : declared
  ) ?? [
    {
      id: "record",
      title,
      fields: columns
        .filter(
          (column) =>
            column.type !== "actions" &&
            column.id !== "select" &&
            column.id !== "actions"
        )
        .map((column) => ({
          id: column.id,
          label: column.header ?? column.id,
          type: column.type as DetailType | undefined,
          accessorKey: column.accessorKey,
          getValue: column.accessorFn,
          options: column.options,
          typeKey: column.typeKey,
          format: columnFormat(column),
        })),
    },
  ];
  // A hand-written field of a table column shows its values as the table does.
  const columnOf = (field: DetailField) =>
    columns.find((column) => column.id === (field.accessorKey ?? field.id)) ??
    columns.find((column) => column.id === field.id);
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields
        .filter((field) => shownFor(field.hidden, row))
        .map((field) => {
          const column = field.format ? undefined : columnOf(field);
          return column ? { ...field, format: columnFormat(column) } : field;
        }),
    }))
    .filter((section) => section.fields.length > 0);
}

export type DetailLayoutSection =
  | { kind: "fields"; section: DetailSection }
  | { kind: "related"; section: DetailRelatedSection }
  | { kind: "custom"; section: DetailCustomSection };

/** Every section of the record view in order: fields, related lists and host-rendered sections. */
export function detailLayout(
  config: Pick<RecordDetailsConfig, "sections">,
  columns: readonly DetailColumn[],
  row: DetailRecord,
  title: string
): DetailLayoutSection[] {
  const fieldSections = detailSections(config, columns, row, title);
  if (derivesFields(config.sections) || !config.sections) {
    const derived = fieldSections.map((section) => ({
      kind: "fields" as const,
      section,
    }));
    return [...derived, ...otherSections(config.sections ?? [], row)];
  }
  const resolved = new Map(fieldSections.map((section) => [section.id, section]));
  const layout: DetailLayoutSection[] = [];
  for (const section of config.sections) {
    if (isFieldSection(section)) {
      const fields = resolved.get(section.id);
      if (fields) {
        layout.push({ kind: "fields", section: fields });
      }
    } else {
      layout.push(...otherSections([section], row));
    }
  }
  return layout;
}

function otherSections(
  sections: readonly DetailSectionConfig[],
  row: DetailRecord
): DetailLayoutSection[] {
  const layout: DetailLayoutSection[] = [];
  for (const section of sections) {
    if (section.kind === "related" && shownFor(section.hidden, row)) {
      layout.push({ kind: "related", section });
    } else if (section.kind === "custom" && shownFor(section.hidden, row)) {
      layout.push({ kind: "custom", section });
    }
  }
  return layout;
}

/** This record's link value for a related section. */
export function relatedLinkValue(
  section: DetailRelatedSection,
  row: DetailRecord
): unknown {
  return detailValue(row, {
    id: section.localKey ?? "id",
    label: "",
  });
}

const linkKey = (value: unknown) =>
  value && typeof value === "object" && "id" in value
    ? String((value as DetailRecord).id)
    : String(value);

/** Whether a related record links to this one; lists link to each of their values. */
function relatedLinks(link: unknown, value: unknown): boolean {
  if (value == null || value === "") {
    return false;
  }
  const target = linkKey(value);
  return (Array.isArray(link) ? link : [link]).some(
    (item) => item != null && linkKey(item) === target
  );
}

function compareRelated(a: unknown, b: unknown): number {
  if (a == null || a === "") {
    return b == null || b === "" ? 0 : 1;
  }
  if (b == null || b === "") {
    return -1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Sorted and limited related records, with the total before the limit. */
export function relatedView(
  section: DetailRelatedSection,
  rows: readonly DetailRecord[]
): { rows: DetailRecord[]; total: number } {
  const sorted = [...rows];
  const sort = section.sort;
  if (sort) {
    const field = section.columns.find((column) => column.id === sort.id) ?? {
      id: sort.id,
      label: "",
    };
    const direction = sort.desc ? -1 : 1;
    sorted.sort(
      (a, b) =>
        compareRelated(detailValue(a, field), detailValue(b, field)) *
        direction
    );
  }
  const limit =
    section.limit !== undefined && section.limit >= 0
      ? section.limit
      : sorted.length;
  return { rows: sorted.slice(0, limit), total: sorted.length };
}

/** Static rows filtered by the link, or the host loader's records. */
export async function loadRelatedRecords(
  section: DetailRelatedSection,
  row: DetailRecord,
  loader?: DetailRelatedLoader
): Promise<DetailRecord[]> {
  const value = relatedLinkValue(section, row);
  if (section.rows) {
    return section.rows.filter((item) =>
      relatedLinks(
        detailValue(item, { id: section.foreignKey, label: "" }),
        value
      )
    );
  }
  if (!loader) {
    return [];
  }
  return [
    ...(await loader(section, row, {
      value,
      sort: section.sort,
      limit: section.limit,
    })),
  ];
}

/** A stable key of a related record. */
export function relatedRowKey(row: DetailRecord, index: number): string {
  return row.id == null ? `row-${index}` : String(row.id);
}

/** The record's title, as its record view names it. */
export function detailTitle(
  config: Pick<RecordDetailsConfig, "title"> | undefined,
  row: DetailRecord,
  fallback: string
): string {
  return (
    config?.title?.(row) ??
    String(row.name ?? row.title ?? row.id ?? fallback)
  );
}

/**
 * The value to type before a deletion, or `undefined` without a typed
 * confirmation. A record asks for `title` or `column`; `count` asks for a bulk deletion.
 */
export function deleteConfirmationValue(
  confirmation: DeleteConfirmationConfig | undefined,
  target: { row: DetailRecord; title: string } | { count: number },
  labels: Pick<DetailLabels, "deleteKeyword">
): string | undefined {
  if (confirmation?.type !== "typed") {
    return;
  }
  const word = confirmation.text?.trim() || labels.deleteKeyword;
  if ("count" in target) {
    return confirmation.bulkMatch === "text" ? word : String(target.count);
  }
  if (confirmation.match === "text") {
    return word;
  }
  if (confirmation.match === "column" && confirmation.column) {
    const value = detailValue(target.row, {
      id: confirmation.column,
      label: "",
    });
    const text = value == null ? "" : linkKey(value).trim();
    // A record without the value can still be deleted by typing the word.
    return text || word;
  }
  return target.title.trim() || word;
}

export function deleteConfirmationMatches(
  expected: string | undefined,
  typed: string,
  confirmation?: Pick<DeleteConfirmationConfig, "caseSensitive">
): boolean {
  if (expected === undefined) {
    return true;
  }
  const value = typed.trim();
  return confirmation?.caseSensitive
    ? value === expected
    : value.toLocaleLowerCase() === expected.toLocaleLowerCase();
}

/** The confirmation sentence naming the value to type. */
export function deleteConfirmationPrompt(
  expected: string,
  labels: Pick<DetailLabels, "typeToConfirm">
): string {
  return labels.typeToConfirm.replaceAll("{value}", () => expected);
}

export function detailValue(row: DetailRecord, field: DetailField): unknown {
  if (field.getValue) {
    return field.getValue(row);
  }
  const key = field.accessorKey ?? field.id;
  if (Object.hasOwn(row, key)) {
    return row[key];
  }
  return key
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" && Object.hasOwn(value, part)
          ? (value as DetailRecord)[part]
          : undefined,
      row
    );
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function detailDate(
  value: unknown,
  locale: string,
  withTime = false
): string {
  if (value == null || value === "") {
    return "";
  }
  // Calendar dates remain calendar dates in every browser timezone.
  const isCalendar = typeof value === "string" && DATE_ONLY.test(value);
  const dateValue = typeof value === "number" ? value : String(value);
  const date = value instanceof Date ? value : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime && !isCalendar ? { timeStyle: "short" } : {}),
    ...(isCalendar ? { timeZone: "UTC" } : {}),
  }).format(date);
}

/** Never activate arbitrary URL schemes from user data. */
export function detailHref(value: unknown, type = "url"): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }
  if (type === "email") {
    return `mailto:${encodeURIComponent(value)}`;
  }
  if (type === "tel") {
    return `tel:${encodeURIComponent(value)}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    /* Invalid URLs are displayed as plain text. */
  }
}

export function detailText(value: unknown, empty = "—"): string {
  if (value == null || value === "") {
    return empty;
  }
  if (typeof value !== "object") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return empty;
  }
}

export interface DetailDisplay {
  kind:
    | "empty"
    | "text"
    | "code"
    | "badges"
    | "link"
    | "image"
    | "video"
    | "items";
  text: string;
  href?: string;
  poster?: string;
  tracks?: { src: string; srcLang: string; label: string; default?: boolean }[];
  items?: { id: string; text: string; href?: string }[];
}

function detailResolvedType(
  field: DetailField,
  value: unknown,
  row: DetailRecord
): DetailType {
  const type = field.type ?? "text";
  if (!["dynamicType", "dynamic-value", "value-type"].includes(type)) {
    return type;
  }
  const inferred = typeof value === "object" ? "json" : typeof value;
  return String(row[field.typeKey ?? "type"] ?? inferred) as DetailType;
}

function detailOptionText(value: unknown, field: DetailField): string {
  const option = field.options?.find((item) => Object.is(item.value, value));
  if (option) {
    return option.label;
  }
  if (value && typeof value === "object") {
    const item = value as DetailRecord;
    return detailText(item.label ?? item.name ?? item.id ?? item);
  }
  return detailText(value);
}

function detailBoolean(value: unknown, labels: DetailLabels): DetailDisplay {
  let text = detailText(value);
  if (value === true) {
    text = labels.yes;
  }
  if (value === false) {
    text = labels.no;
  }
  return { kind: "badges", text: "", items: [{ id: "boolean", text }] };
}

function detailLink(value: unknown, type: string): DetailDisplay {
  const href = detailHref(value, type);
  let kind: DetailDisplay["kind"] = "text";
  if (href) {
    kind = type === "image" ? "image" : "link";
  }
  return { kind, text: detailText(value), href };
}

/** Media URLs use the same safe HTTP(S) contract as other consultation links. */
function detailVideo(value: unknown): DetailDisplay {
  const media =
    value && typeof value === "object"
      ? (value as DetailRecord)
      : { url: value };
  const href = detailHref(media.url);
  if (!href) {
    return { kind: "text", text: detailText(value) };
  }
  const tracks: NonNullable<DetailDisplay["tracks"]> = [];
  if (Array.isArray(media.tracks)) {
    for (const track of media.tracks) {
      if (!track || typeof track !== "object") {
        continue;
      }
      const src = detailHref(track.src);
      if (
        src &&
        typeof track.srcLang === "string" &&
        typeof track.label === "string"
      ) {
        tracks.push({
          src,
          srcLang: track.srcLang,
          label: track.label,
          default: track.default === true,
        });
      }
    }
  }
  return {
    kind: "video",
    text: "",
    href,
    poster: detailHref(media.poster),
    tracks,
  };
}

function detailItems(value: unknown, type: string): DetailDisplay {
  const items = (Array.isArray(value) ? value : [value]).map(
    (item: unknown, index) => {
      let text = detailText(item);
      let href: string | undefined;
      if (type === "files" && item && typeof item === "object") {
        const file = item as DetailRecord;
        text = detailText(file.name ?? file.label ?? file);
        href = detailHref(file.url);
      }
      return { id: String(index), text, href };
    }
  );
  return { kind: "items", text: "", items };
}

/** The field's own Intl options win; otherwise the column's number format. */
function detailNumberText(
  field: DetailField,
  value: unknown,
  locale: string
): string {
  if (field.numberFormat) {
    return typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat(locale, field.numberFormat).format(value)
      : detailText(value);
  }
  return formatColumnNumber(value, field.format, locale);
}

/** Dates read in the column's pattern or preset, time zone and clock. */
function detailDateText(
  field: DetailField,
  value: unknown,
  locale: string,
  withTime: boolean
): string {
  const format = field.format;
  if (!(format?.dateFormat || format?.dateDisplayPreset)) {
    return detailDate(value, locale, withTime);
  }
  return formatColumnDate(value, format, locale);
}

export function detailDisplay(
  field: DetailField,
  value: unknown,
  row: DetailRecord,
  locale: string,
  labels: DetailLabels
): DetailDisplay {
  if (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return { kind: "empty", text: labels.empty };
  }
  const type = detailResolvedType(field, value, row);
  switch (type) {
    case "password":
      return { kind: "text", text: "••••••••" };
    case "boolean":
    case "checkbox":
    case "switch":
      return detailBoolean(value, labels);
    case "select":
    case "multiSelect":
    case "tag":
    case "radio":
    case "select-with-add-new":
    case "tablePicker":
      return {
        kind: "badges",
        text: "",
        items: (Array.isArray(value) ? value : [value]).map(
          (item: unknown, index) => ({
            id: String(index),
            text: detailOptionText(item, field),
          })
        ),
      };
    case "date":
    case "datetime":
      return {
        kind: "text",
        text: detailDateText(field, value, locale, type === "datetime"),
      };
    case "number":
      return { kind: "text", text: detailNumberText(field, value, locale) };
    case "url":
    case "email":
    case "tel":
    case "image":
      return detailLink(value, type);
    case "video":
      return detailVideo(value);
    case "location":
      return {
        kind: "text",
        text: [formatLocation(value), locationDetail(value)]
          .filter(Boolean)
          .join(" · "),
      };
    case "files":
    case "collection":
      return detailItems(value, type);
    default:
      return {
        kind:
          type === "code" || type === "json" || typeof value === "object"
            ? "code"
            : "text",
        text: detailText(value),
      };
  }
}

/** Keep supplied ordering stable for invalid timestamps; newest valid entries appear first. */
export function detailActivity(
  config: RecordDetailsConfig,
  row: DetailRecord
): DetailActivity[] {
  return [
    ...(config.activity?.(row) ??
      config.history?.().find((record) => record.row.id === row.id)?.activity ??
      []),
  ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
}

/**
 * An undo is a new event. Never offer a second undo or overwrite newer field changes. A newer change that was
 * undone since cancels out with its undo, so repeated undos walk back the same field one change at a time.
 */
export function canRevertDetailActivity(
  entry: DetailActivity,
  activity: readonly DetailActivity[]
): boolean {
  if (entry.reverts || entry.reversible === false || !entry.changes?.length) {
    return false;
  }
  if (activity.some((item) => item.reverts === entry.id)) {
    return false;
  }
  return !changedSince(entry, activity);
}

/**
 * Redo re-applies an undo event, once, while no newer change touched its fields. The table shortcut also
 * stops at the user's newer changes (a new edit clears what could be redone).
 */
export function canRedoDetailActivity(
  entry: DetailActivity,
  activity: readonly DetailActivity[]
): boolean {
  if (!entry.reverts || entry.reversible === false || !entry.changes?.length) {
    return false;
  }
  if (
    activity.some(
      (item) => item.redoes === entry.id || item.reverts === entry.id
    )
  ) {
    return false;
  }
  return !changedSince(entry, activity);
}

/** Whether a newer event still in effect touched the entry's fields (an event and its undo cancel out). */
function changedSince(
  entry: DetailActivity,
  activity: readonly DetailActivity[]
): boolean {
  const index = activity.findIndex((item) => item.id === entry.id);
  if (index < 0) {
    return true;
  }
  const fields = new Set(entry.changes?.map((change) => change.field));
  const newer = activity.slice(0, index);
  const cancelled = new Set<string>();
  for (const item of newer) {
    if (item.reverts && newer.some((other) => other.id === item.reverts)) {
      cancelled.add(item.id);
      cancelled.add(item.reverts);
    }
  }
  return newer.some(
    (item) =>
      !cancelled.has(item.id) &&
      item.changes?.some((change) => fields.has(change.field))
  );
}
