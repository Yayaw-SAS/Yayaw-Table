/** Framework-independent contracts for read-only records and application-owned audit data. */
export type DetailRecord = Record<string, unknown>;
export type DetailPresentation = "drawer" | "modal" | "inline";
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
  | "url"
  | "email"
  | "tel"
  | "password"
  | "image"
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
  numberFormat?: Intl.NumberFormatOptions;
  /** Explicitly omit sensitive or irrelevant fields from both details and activity. */
  hidden?: boolean | ((row: DetailRecord) => boolean);
}

export interface DetailSection {
  id: string;
  title: string;
  description?: string;
  fields: readonly DetailField[];
}

export interface DetailActivity {
  id: string;
  actor: { name: string };
  at: string;
  action: string;
  /** The original event remains in the log; an undo event references its ID. */
  reverts?: string;
  reversible?: boolean;
  changes?: readonly { field: string; before: unknown; after: unknown }[];
}

export interface RecordDetailsConfig {
  presentation?: DetailPresentation;
  width?: string;
  title?: (row: DetailRecord) => string;
  description?: (row: DetailRecord) => string;
  /** Omit to derive fields from the table's column definitions. */
  sections?: readonly DetailSection[];
  updatedAt?: (row: DetailRecord) => string | Date | undefined;
  updatedBy?: (row: DetailRecord) => string | undefined;
  /** The host application owns fetching and storing the audit log. */
  activity?: (row: DetailRecord) => readonly DetailActivity[];
  canRevert?: (entry: DetailActivity, row: DetailRecord) => boolean;
  labels?: Partial<DetailLabels>;
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
  undoError: string;
  undoUnavailable: string;
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
        undoError: "L’annulation a échoué. Veuillez réessayer.",
        undoUnavailable:
          "Cette modification ne peut plus être annulée : les champs ont changé depuis.",
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
        undoError: "Undo failed. Please try again.",
        undoUnavailable:
          "This change can no longer be undone because its fields have changed since.",
      };
  return { ...labels, ...overrides };
}

interface DetailColumn {
  id: string;
  header?: string;
  type?: string;
  accessorKey?: string;
  accessorFn?: (row: DetailRecord) => unknown;
  options?: readonly { value: unknown; label: string }[];
  typeKey?: string;
}

export function detailSections(
  config: RecordDetailsConfig,
  columns: readonly DetailColumn[],
  row: DetailRecord,
  title: string
): DetailSection[] {
  const sections: readonly DetailSection[] = config.sections ?? [
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
        })),
    },
  ];
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) =>
        typeof field.hidden === "function" ? !field.hidden(row) : !field.hidden
      ),
    }))
    .filter((section) => section.fields.length > 0);
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
  kind: "empty" | "text" | "code" | "badges" | "link" | "image" | "items";
  text: string;
  href?: string;
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
        text: detailDate(value, locale, type === "datetime"),
      };
    case "number":
      return {
        kind: "text",
        text:
          typeof value === "number" && Number.isFinite(value)
            ? new Intl.NumberFormat(locale, field.numberFormat).format(value)
            : detailText(value),
      };
    case "url":
    case "email":
    case "tel":
    case "image":
      return detailLink(value, type);
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
  return [...(config.activity?.(row) ?? [])].sort(
    (a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)
  );
}

/** An undo is a new event. Never offer a second undo or overwrite newer field changes. */
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
  const index = activity.findIndex((item) => item.id === entry.id);
  if (index < 0) {
    return false;
  }
  const fields = new Set(entry.changes.map((change) => change.field));
  return !activity
    .slice(0, index)
    .some((item) => item.changes?.some((change) => fields.has(change.field)));
}
