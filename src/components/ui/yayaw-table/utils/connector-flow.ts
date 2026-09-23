/**
 * Connector screens for Connect destinations, shared by the React and Vue
 * editions. The table owns the flow (target, column mapping, scope, send and
 * result); the host only lists targets, describes their fields and pushes
 * through its own server function, which calls a connector server module.
 *
 * The types are structural copies of the connector server modules' shapes
 * (`ConnectorColumn`, `ConnectorPushResult`, error codes), so a host can pass
 * their results through without converting them.
 */

import {
  areFieldTypesCompatible,
  type ColumnMappingRow,
  matchFieldsByName,
  normalizeFieldName,
} from "./field-matching";

type MaybePromise<T> = T | Promise<T>;

/** "upsert" updates rows with the same key and adds the others; "replace" rewrites the target. */
export type ConnectorMode = "upsert" | "replace";

export const CONNECTOR_MODES: readonly ConnectorMode[] = ["upsert", "replace"];

/** Default name of the target field that holds each record's id. */
export const DEFAULT_CONNECTOR_KEY_FIELD = "Yayaw ID";

/** Option value that leaves a column out of the push. */
export const CONNECTOR_SKIP = "__yayaw_skip__";

export interface ConnectorTargetChild {
  id: string;
  label: string;
}

/** Where to send: a Notion database, a spreadsheet (with its tabs as children)… */
export interface ConnectorTarget {
  id: string;
  label: string;
  description?: string;
  children?: ConnectorTargetChild[];
}

export interface ConnectorTargetRef {
  targetId: string;
  childId?: string;
}

/** A field of the target: a Notion property, a sheet header. */
export interface ConnectorField {
  name: string;
  type?: string;
  options?: string[];
}

export interface ConnectorSchema {
  fields: ConnectorField[];
  /** Fields that may identify records; default every field. */
  keyFields?: string[];
  /** The target accepts fields it does not have yet (new sheet headers). */
  allowNewFields?: boolean;
}

/** A table column as a connector sees it. `type` is the table column type. */
export interface ConnectorColumn {
  id: string;
  header: string;
  type?: string;
}

/** A column of the view, with whether it is shown. */
export interface ConnectorViewColumn extends ConnectorColumn {
  visible: boolean;
}

export interface ConnectorMappingEntry {
  columnId: string;
  /** Target field name, or `null` to leave the column out. */
  field: string | null;
}

/** What is remembered for a view and sent to `push`. */
export interface ConnectorSettings {
  targetId: string;
  childId?: string;
  mode: ConnectorMode;
  /** Target field matched against each record's id. */
  keyField: string;
  mapping: ConnectorMappingEntry[];
  /** Columns offered for mapping: the visible ones (default) or all. */
  columns?: "visible" | "all";
}

export type ConnectorErrorCode =
  | "aborted"
  | "api_disabled"
  | "forbidden"
  | "invalid_credentials"
  | "invalid_mapping"
  | "invalid_request"
  | "invalid_target"
  | "not_found"
  | "not_shared"
  | "provider_unavailable"
  | "rate_limited"
  | "unauthorized";

/** Values safe to show: never row data or provider bodies. */
export interface ConnectorErrorDetails {
  /** Account to share the target with. */
  serviceAccountEmail?: string;
  status?: number;
}

export interface ConnectorPushFailure {
  code: ConnectorErrorCode | string;
  rowId?: string;
  /** How many rows the failure left unwritten. */
  rows: number;
}

export interface ConnectorPushWarning {
  columnId?: string;
  reason: string;
  rowId?: string;
}

export interface ConnectorPushResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: ConnectorPushFailure[];
  warnings: ConnectorPushWarning[];
  warningCount: number;
  truncated: boolean;
}

/** An error a host function can throw or return: `{ error: { code, details } }`. */
export interface ConnectorFailure {
  code: ConnectorErrorCode | "unknown";
  details?: ConnectorErrorDetails;
  message?: string;
}

export type ConnectorPushOutcome =
  | ConnectorPushResult
  | { error: Partial<ConnectorFailure> & { code: string } };

export interface ConnectorHelp {
  /** Replaces the "share it with …" message, e.g. to name a spreadsheet. */
  notShared?: (details: ConnectorErrorDetails) => string;
}

/** Push context: the destination context plus what the screen chose to send. */
export interface ConnectorPushScope {
  /** "selection" sends the selected records only. */
  scope: "view" | "selection";
}

/**
 * What a Connect destination declares to get the connector screens. Every
 * function runs in the browser and usually calls a host server function.
 */
export interface DataDestinationConnector<
  TContext = unknown,
  TPushContext = TContext,
> {
  targets: (context: TContext) => MaybePromise<ConnectorTarget[]>;
  /** Free input (e.g. a pasted URL) resolved to a target. */
  allowTargetInput?: {
    label: string;
    placeholder?: string;
    resolve: (
      input: string,
      context: TContext
    ) => MaybePromise<ConnectorTarget>;
  };
  /** Fields of the chosen target; may be empty for a new sheet. */
  describe: (
    target: ConnectorTargetRef,
    context: TContext
  ) => MaybePromise<ConnectorSchema>;
  /** Default `["upsert"]`. */
  modes?: ConnectorMode[];
  /** Remembered target and mapping for this view, or `null`. */
  load?: (context: TContext) => MaybePromise<ConnectorSettings | null>;
  save?: (settings: ConnectorSettings, context: TContext) => MaybePromise<void>;
  push: (
    settings: ConnectorSettings,
    context: TPushContext
  ) => MaybePromise<ConnectorPushOutcome>;
  /** Names for the target and its children, e.g. "Spreadsheet" and "Tab". */
  labels?: { target?: string; child?: string };
  help?: ConnectorHelp;
}

// Labels -------------------------------------------------------------------------

export type ConnectorLabelKey =
  | "target"
  | "child"
  | "chooseTarget"
  | "use"
  | "loading"
  | "loadingFields"
  | "noTargets"
  | "columns"
  | "columnsVisible"
  | "columnsAll"
  | "mapping"
  | "newField"
  | "dontSend"
  | "sending"
  | "keyField"
  | "mode"
  | "upsert"
  | "replace"
  | "upsertHint"
  | "replaceHint"
  | "scope"
  | "scopeView"
  | "scopeSelection"
  | "send"
  | "sendAgain"
  | "done"
  | "created"
  | "createdOne"
  | "updated"
  | "updatedOne"
  | "skipped"
  | "skippedOne"
  | "failed"
  | "failedOne"
  | "nothingSent"
  | "warnings"
  | "warningsOne"
  | "truncated"
  | "failureRow"
  | "failureRows"
  | "issueMissingTarget"
  | "issueMissingChild"
  | "issueNoColumns"
  | "issueDuplicateField"
  | "issueUnknownField"
  | "issueMissingKey"
  | "issueUnknownKey"
  | "issueInvalidMode"
  | "error_aborted"
  | "error_api_disabled"
  | "error_forbidden"
  | "error_invalid_credentials"
  | "error_invalid_mapping"
  | "error_invalid_request"
  | "error_invalid_target"
  | "error_not_found"
  | "error_not_shared"
  | "error_not_shared_unknown"
  | "error_provider_unavailable"
  | "error_rate_limited"
  | "error_unauthorized"
  | "error_unknown";

const ENGLISH_LABELS: Record<ConnectorLabelKey, string> = {
  target: "Destination",
  child: "Section",
  chooseTarget: "Choose…",
  use: "Use",
  loading: "Loading…",
  loadingFields: "Reading the destination’s fields…",
  noTargets: "No destination available yet.",
  columns: "Columns",
  columnsVisible: "Visible ({count})",
  columnsAll: "All ({count})",
  mapping: "Send each column to",
  newField: "New field “{name}”",
  dontSend: "Don’t send",
  sending: "Sending…",
  keyField: "Match records by",
  mode: "Mode",
  upsert: "Update and add",
  replace: "Replace everything",
  upsertHint: "Updates the rows with the same key and adds the others.",
  replaceHint: "Clears the destination, then writes these records.",
  scope: "Records",
  scopeView: "All in this view",
  scopeSelection: "Selected ({count})",
  send: "Send",
  sendAgain: "Send again",
  done: "Done",
  created: "{count} created",
  createdOne: "{count} created",
  updated: "{count} updated",
  updatedOne: "{count} updated",
  skipped: "{count} skipped",
  skippedOne: "{count} skipped",
  failed: "{count} failed",
  failedOne: "{count} failed",
  nothingSent: "Nothing to send",
  warnings: "{count} warnings",
  warningsOne: "{count} warning",
  truncated: "Some records were left out: the destination’s limit was reached.",
  failureRow: "Record {id}: {message}",
  failureRows: "{count} records: {message}",
  issueMissingTarget: "Choose a destination.",
  issueMissingChild: "Choose a value for {child}.",
  issueNoColumns: "Choose at least one column to send.",
  issueDuplicateField: "“{field}” receives more than one column.",
  issueUnknownField: "“{field}” doesn’t exist in the destination.",
  issueMissingKey: "Choose the field that identifies records.",
  issueUnknownKey: "“{field}” can’t identify records in this destination.",
  issueInvalidMode: "This destination doesn’t support this mode.",
  error_aborted: "Sending was cancelled.",
  error_api_disabled: "The service’s API isn’t enabled for this connection.",
  error_forbidden: "This connection can’t write to this destination.",
  error_invalid_credentials:
    "The connection’s credentials were refused. Update them, then try again.",
  error_invalid_mapping:
    "The mapping can’t be used. Check the field that identifies records.",
  error_invalid_request: "The service refused the request.",
  error_invalid_target: "This isn’t a valid destination link or id.",
  error_not_found:
    "The destination wasn’t found. It may have been moved or deleted.",
  error_not_shared: "Share this destination with {email}, then send again.",
  error_not_shared_unknown:
    "Share this destination with the connection, then send again.",
  error_provider_unavailable:
    "The service is unavailable right now. Try again later.",
  error_rate_limited: "Too many requests. Wait a moment, then try again.",
  error_unauthorized:
    "The connection has expired. Reconnect it, then try again.",
  error_unknown: "Sending failed.",
};

const FRENCH_LABELS: Record<ConnectorLabelKey, string> = {
  target: "Destination",
  child: "Section",
  chooseTarget: "Choisir…",
  use: "Utiliser",
  loading: "Chargement…",
  loadingFields: "Lecture des champs de la destination…",
  noTargets: "Aucune destination disponible pour le moment.",
  columns: "Colonnes",
  columnsVisible: "Visibles ({count})",
  columnsAll: "Toutes ({count})",
  mapping: "Envoyer chaque colonne vers",
  newField: "Nouveau champ « {name} »",
  dontSend: "Ne pas envoyer",
  sending: "Envoi…",
  keyField: "Identifier les lignes par",
  mode: "Mode",
  upsert: "Mettre à jour et ajouter",
  replace: "Tout remplacer",
  upsertHint: "Met à jour les lignes de même clé et ajoute les autres.",
  replaceHint: "Vide la destination, puis écrit ces enregistrements.",
  scope: "Enregistrements",
  scopeView: "Tous ceux de la vue",
  scopeSelection: "Sélectionnés ({count})",
  send: "Envoyer",
  sendAgain: "Renvoyer",
  done: "Terminé",
  created: "{count} créés",
  createdOne: "{count} créé",
  updated: "{count} mis à jour",
  updatedOne: "{count} mis à jour",
  skipped: "{count} ignorés",
  skippedOne: "{count} ignoré",
  failed: "{count} en échec",
  failedOne: "{count} en échec",
  nothingSent: "Rien à envoyer",
  warnings: "{count} avertissements",
  warningsOne: "{count} avertissement",
  truncated:
    "Des enregistrements ont été laissés de côté : la limite de la destination est atteinte.",
  failureRow: "Enregistrement {id} : {message}",
  failureRows: "{count} enregistrements : {message}",
  issueMissingTarget: "Choisissez une destination.",
  issueMissingChild: "Choisissez une valeur pour {child}.",
  issueNoColumns: "Choisissez au moins une colonne à envoyer.",
  issueDuplicateField: "« {field} » reçoit plusieurs colonnes.",
  issueUnknownField: "« {field} » n’existe pas dans la destination.",
  issueMissingKey: "Choisissez le champ qui identifie les lignes.",
  issueUnknownKey:
    "« {field} » ne peut pas identifier les lignes de cette destination.",
  issueInvalidMode: "Cette destination ne prend pas en charge ce mode.",
  error_aborted: "L’envoi a été annulé.",
  error_api_disabled:
    "L’API du service n’est pas activée pour cette connexion.",
  error_forbidden: "Cette connexion ne peut pas écrire dans cette destination.",
  error_invalid_credentials:
    "Les identifiants de la connexion ont été refusés. Mettez-les à jour, puis réessayez.",
  error_invalid_mapping:
    "La correspondance est inutilisable. Vérifiez le champ qui identifie les lignes.",
  error_invalid_request: "Le service a refusé la requête.",
  error_invalid_target:
    "Ce lien ou cet identifiant n’est pas une destination valide.",
  error_not_found:
    "La destination est introuvable. Elle a peut-être été déplacée ou supprimée.",
  error_not_shared: "Partagez cette destination avec {email}, puis renvoyez.",
  error_not_shared_unknown:
    "Partagez cette destination avec la connexion, puis renvoyez.",
  error_provider_unavailable:
    "Le service est indisponible pour le moment. Réessayez plus tard.",
  error_rate_limited: "Trop de requêtes. Patientez un instant, puis réessayez.",
  error_unauthorized: "La connexion a expiré. Reconnectez-la, puis réessayez.",
  error_unknown: "L’envoi a échoué.",
};

/** Host override for a label (`connector.<key>`), or the built-in one. */
export type ConnectorTranslate = (
  key: ConnectorLabelKey,
  fallback: string
) => string;

/** A label with its `{name}` parameters filled in. */
export type ConnectorT = (
  key: ConnectorLabelKey,
  params?: Record<string, string | number>
) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function connectorLabels(
  locale: string,
  translate?: ConnectorTranslate
): ConnectorT {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  return (key, params = {}) => {
    const template = translate ? translate(key, labels[key]) : labels[key];
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  };
}

// Mapping ------------------------------------------------------------------------

/** "Échéance_date" → "echeance date": accents, case and separators ignored. */
export function normalizeConnectorName(name: string): string {
  return normalizeFieldName(name);
}

/** Whether a column's values fit a field; text fields take anything. */
export function isConnectorTypeCompatible(
  columnType: string | undefined,
  fieldType: string | undefined
): boolean {
  return areFieldTypesCompatible(columnType, fieldType);
}

/**
 * Each column to the field with the same name (accents, case and separators
 * ignored), type-compatible fields first, each field used once. Unmatched
 * columns get a new field of their own name when the target allows it.
 */
export function defaultConnectorMapping(
  columns: readonly ConnectorColumn[],
  fields: readonly ConnectorField[],
  options: { allowNewFields?: boolean; keyField?: string } = {}
): ConnectorMappingEntry[] {
  const matches = matchFieldsByName(
    columns.map((column) => ({
      key: column.id,
      names: [column.header],
      type: column.type,
    })),
    fields.map((field) => ({
      key: field.name,
      names: [field.name],
      type: field.type,
    })),
    {
      reserved: options.keyField ? [options.keyField] : [],
      fallback: (source, used) => {
        const header = source.names[0] ?? "";
        return options.allowNewFields && !used.has(normalizeFieldName(header))
          ? header
          : null;
      },
    }
  );
  return columns.map((column, index) => ({
    columnId: column.id,
    field: matches[index] ?? null,
  }));
}

/** Fields that may identify records, with the default key offered for a new field. */
export function connectorKeyFields(schema: ConnectorSchema): string[] {
  const names = schema.keyFields?.length
    ? [...schema.keyFields]
    : schema.fields.map((field) => field.name);
  if (schema.allowNewFields && !names.includes(DEFAULT_CONNECTOR_KEY_FIELD)) {
    names.unshift(DEFAULT_CONNECTOR_KEY_FIELD);
  }
  return names;
}

/** "Yayaw ID" when offered, otherwise the first key field. */
export function defaultConnectorKeyField(schema: ConnectorSchema): string {
  const keys = connectorKeyFields(schema);
  return keys.includes(DEFAULT_CONNECTOR_KEY_FIELD)
    ? DEFAULT_CONNECTOR_KEY_FIELD
    : (keys[0] ?? "");
}

/** Modes to offer, in the declared order; default upsert only. */
export function connectorModes(
  modes: readonly ConnectorMode[] | undefined
): ConnectorMode[] {
  const valid = (modes ?? []).filter(
    (mode, index, list) =>
      CONNECTOR_MODES.includes(mode) && list.indexOf(mode) === index
  );
  return valid.length > 0 ? valid : ["upsert"];
}

/** Columns the screen maps: the visible ones, or all of them. */
export function connectorMappedColumns(
  columns: readonly ConnectorViewColumn[],
  scope: ConnectorSettings["columns"]
): ConnectorViewColumn[] {
  return scope === "all"
    ? [...columns]
    : columns.filter((column) => column.visible);
}

/**
 * Settings for a target: the remembered ones where they still apply, the
 * defaults elsewhere. Columns hidden from the mapping are sent as `null`.
 */
export function resolveConnectorSettings({
  columns,
  modes,
  saved,
  schema,
  target,
}: {
  columns: readonly ConnectorViewColumn[];
  modes?: readonly ConnectorMode[];
  saved?: Partial<ConnectorSettings> | null;
  schema: ConnectorSchema;
  target: ConnectorTargetRef;
}): ConnectorSettings {
  const offered = connectorModes(modes);
  const keys = connectorKeyFields(schema);
  const keyField =
    saved?.keyField && keys.includes(saved.keyField)
      ? saved.keyField
      : defaultConnectorKeyField(schema);
  const scope = saved?.columns === "all" ? "all" : "visible";
  const names = new Set(schema.fields.map((field) => field.name));
  const defaults = defaultConnectorMapping(columns, schema.fields, {
    allowNewFields: schema.allowNewFields,
    keyField,
  });
  const remembered = new Map(
    (saved?.mapping ?? []).map((entry) => [entry.columnId, entry.field])
  );
  const mapped = new Set(
    connectorMappedColumns(columns, scope).map((column) => column.id)
  );
  const mapping = defaults.map((entry) => {
    if (!mapped.has(entry.columnId)) {
      return {
        columnId: entry.columnId,
        field: remembered.get(entry.columnId) ?? entry.field,
      };
    }
    if (!remembered.has(entry.columnId)) {
      return entry;
    }
    const field = remembered.get(entry.columnId) ?? null;
    const usable =
      field === null || names.has(field) || schema.allowNewFields === true;
    return { columnId: entry.columnId, field: usable ? field : entry.field };
  });
  return {
    targetId: target.targetId,
    ...(target.childId ? { childId: target.childId } : {}),
    mode:
      saved?.mode && offered.includes(saved.mode)
        ? saved.mode
        : (offered[0] ?? "upsert"),
    keyField,
    mapping,
    columns: scope,
  };
}

/** The settings `push` and `save` receive: columns left out of the mapping are `null`. */
export function connectorSettingsToSend(
  settings: ConnectorSettings,
  columns: readonly ConnectorViewColumn[]
): ConnectorSettings {
  const mapped = new Set(
    connectorMappedColumns(columns, settings.columns).map((column) => column.id)
  );
  return {
    ...settings,
    mapping: settings.mapping.map((entry) => ({
      columnId: entry.columnId,
      field: mapped.has(entry.columnId) ? entry.field : null,
    })),
  };
}

/** The mapping in the shape the connector server modules take. */
export function toConnectorMapping(
  settings: Pick<ConnectorSettings, "keyField" | "mapping">
): {
  keyProperty: string;
  properties: Record<string, string>;
} {
  const properties: Record<string, string> = {};
  for (const entry of settings.mapping) {
    if (entry.field) {
      properties[entry.columnId] = entry.field;
    }
  }
  return { keyProperty: settings.keyField, properties };
}

/** Choices for one column: the target's fields, a new field, or leave it out. */
export function connectorFieldOptions(
  column: ConnectorColumn,
  schema: ConnectorSchema,
  current: string | null,
  t: ConnectorT
): { value: string; label: string }[] {
  const names = new Set(schema.fields.map((field) => field.name));
  const options = schema.fields.map((field) => ({
    value: field.name,
    label: field.name,
  }));
  const newNames = [
    current,
    schema.allowNewFields ? column.header : null,
  ].filter(
    (name, index, list): name is string =>
      Boolean(name) &&
      !names.has(name as string) &&
      list.indexOf(name) === index
  );
  for (const name of newNames) {
    options.push({ value: name, label: t("newField", { name }) });
  }
  options.push({ value: CONNECTOR_SKIP, label: t("dontSend") });
  return options;
}

// Validation ---------------------------------------------------------------------

export type ConnectorIssueCode =
  | "missing_target"
  | "missing_child"
  | "no_columns"
  | "duplicate_field"
  | "unknown_field"
  | "missing_key"
  | "unknown_key"
  | "invalid_mode";

export interface ConnectorIssue {
  code: ConnectorIssueCode;
  columnId?: string;
  field?: string;
}

const mappingIssues = (
  settings: ConnectorSettings,
  schema: ConnectorSchema
): ConnectorIssue[] => {
  const issues: ConnectorIssue[] = [];
  const names = new Set(schema.fields.map((field) => field.name));
  const seen = new Set<string>([normalizeConnectorName(settings.keyField)]);
  for (const entry of settings.mapping) {
    if (!entry.field) {
      continue;
    }
    const name = normalizeConnectorName(entry.field);
    if (seen.has(name)) {
      issues.push({
        code: "duplicate_field",
        columnId: entry.columnId,
        field: entry.field,
      });
    } else if (!(names.has(entry.field) || schema.allowNewFields)) {
      issues.push({
        code: "unknown_field",
        columnId: entry.columnId,
        field: entry.field,
      });
    }
    seen.add(name);
  }
  if (!settings.mapping.some((entry) => entry.field)) {
    issues.push({ code: "no_columns" });
  }
  return issues;
};

/** Everything that would stop a push, in screen order. */
export function validateConnectorSettings(
  settings: ConnectorSettings,
  {
    schema,
    modes,
    target,
  }: {
    schema: ConnectorSchema;
    modes?: readonly ConnectorMode[];
    target?: ConnectorTarget;
  }
): ConnectorIssue[] {
  const issues: ConnectorIssue[] = [];
  if (!settings.targetId) {
    issues.push({ code: "missing_target" });
  }
  if (
    target?.children?.length &&
    !target.children.some((child) => child.id === settings.childId)
  ) {
    issues.push({ code: "missing_child" });
  }
  issues.push(...mappingIssues(settings, schema));
  if (!settings.keyField.trim()) {
    issues.push({ code: "missing_key" });
  } else if (!connectorKeyFields(schema).includes(settings.keyField)) {
    issues.push({ code: "unknown_key", field: settings.keyField });
  }
  if (!connectorModes(modes).includes(settings.mode)) {
    issues.push({ code: "invalid_mode" });
  }
  return issues;
}

const ISSUE_KEYS: Record<ConnectorIssueCode, ConnectorLabelKey> = {
  missing_target: "issueMissingTarget",
  missing_child: "issueMissingChild",
  no_columns: "issueNoColumns",
  duplicate_field: "issueDuplicateField",
  unknown_field: "issueUnknownField",
  missing_key: "issueMissingKey",
  unknown_key: "issueUnknownKey",
  invalid_mode: "issueInvalidMode",
};

export function connectorIssueMessage(
  issue: ConnectorIssue,
  t: ConnectorT,
  childLabel = t("child")
): string {
  return t(ISSUE_KEYS[issue.code], {
    field: issue.field ?? "",
    child: childLabel,
  });
}

// Results and errors -------------------------------------------------------------

const ERROR_CODES = new Set<string>([
  "aborted",
  "api_disabled",
  "forbidden",
  "invalid_credentials",
  "invalid_mapping",
  "invalid_request",
  "invalid_target",
  "not_found",
  "not_shared",
  "provider_unavailable",
  "rate_limited",
  "unauthorized",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A thrown or returned error as a typed failure; unknown errors keep their message. */
export function toConnectorFailure(error: unknown): ConnectorFailure {
  const source = isRecord(error) && isRecord(error.error) ? error.error : error;
  const code =
    isRecord(source) && typeof source.code === "string" ? source.code : "";
  const message =
    source instanceof Error ||
    (isRecord(source) && typeof source.message === "string")
      ? String((source as { message: unknown }).message)
      : undefined;
  const details =
    isRecord(source) && isRecord(source.details)
      ? (source.details as ConnectorErrorDetails)
      : undefined;
  if (ERROR_CODES.has(code)) {
    return { code: code as ConnectorErrorCode, details, message };
  }
  return {
    code: "unknown",
    message: message ?? (typeof error === "string" ? error : undefined),
  };
}

/** A message the person can act on, e.g. "Share this destination with robot@…". */
export function connectorErrorMessage(
  code: string,
  details: ConnectorErrorDetails | undefined,
  t: ConnectorT,
  help?: ConnectorHelp
): string {
  if (code === "not_shared") {
    if (help?.notShared) {
      return help.notShared(details ?? {});
    }
    const email = details?.serviceAccountEmail;
    return email
      ? t("error_not_shared", { email })
      : t("error_not_shared_unknown");
  }
  return ERROR_CODES.has(code)
    ? t(`error_${code}` as ConnectorLabelKey)
    : t("error_unknown");
}

/** The message for a failure; unknown errors show their own message when they have one. */
export function connectorFailureMessage(
  failure: ConnectorFailure,
  t: ConnectorT,
  help?: ConnectorHelp
): string {
  if (failure.code === "unknown") {
    return failure.message || t("error_unknown");
  }
  return connectorErrorMessage(failure.code, failure.details, t, help);
}

const countLabel = (
  t: ConnectorT,
  count: number,
  many: ConnectorLabelKey,
  one: ConnectorLabelKey
): string => t(count === 1 ? one : many, { count });

/** "3 created, 5 updated, 1 failed" (non-zero counts only). */
export function describePushResult(
  result: ConnectorPushResult,
  t: ConnectorT
): string {
  const parts = [
    result.created > 0
      ? countLabel(t, result.created, "created", "createdOne")
      : null,
    result.updated > 0
      ? countLabel(t, result.updated, "updated", "updatedOne")
      : null,
    result.skipped > 0
      ? countLabel(t, result.skipped, "skipped", "skippedOne")
      : null,
    result.failed > 0
      ? countLabel(t, result.failed, "failed", "failedOne")
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : t("nothingSent");
}

/** The first failures, one line each, then the warning count and truncation notice. */
export function describePushDetails(
  result: ConnectorPushResult,
  t: ConnectorT,
  help?: ConnectorHelp,
  limit = 3
): { failures: string[]; warnings: string | null; truncated: string | null } {
  return {
    failures: result.failures.slice(0, limit).map((failure) => {
      const message = connectorErrorMessage(
        String(failure.code),
        undefined,
        t,
        help
      );
      return failure.rowId
        ? t("failureRow", { id: failure.rowId, message })
        : t("failureRows", { count: failure.rows, message });
    }),
    warnings:
      result.warningCount > 0
        ? countLabel(t, result.warningCount, "warnings", "warningsOne")
        : null,
    truncated: result.truncated ? t("truncated") : null,
  };
}

/** Whether `push` returned a failure instead of a result. */
export function isPushFailure(
  outcome: ConnectorPushOutcome
): outcome is { error: Partial<ConnectorFailure> & { code: string } } {
  return isRecord(outcome) && "error" in outcome && isRecord(outcome.error);
}

/** A destination the Connect screen opens as connector screens. */
export function hasConnector(
  destination: {
    kind?: string;
    connector?: Partial<DataDestinationConnector<never, never>>;
  },
  enabled: boolean | undefined
): boolean {
  return (
    enabled !== false &&
    destination.kind !== "share" &&
    typeof destination.connector?.targets === "function" &&
    typeof destination.connector?.describe === "function" &&
    typeof destination.connector?.push === "function"
  );
}

// Screen flow --------------------------------------------------------------------

export interface ConnectorFlowState {
  /** "form" edits the settings; "result" shows the last push. */
  phase: "loading" | "form" | "sending" | "result";
  targets: ConnectorTarget[];
  /** Chosen target, or "" before one is chosen. */
  targetId: string;
  childId?: string;
  schema: ConnectorSchema | null;
  schemaLoading: boolean;
  settings: ConnectorSettings | null;
  scope: "view" | "selection";
  resolving: boolean;
  /** Inline message: a failed load, describe, validation or push. */
  error: string | null;
  result: ConnectorPushResult | null;
}

export interface ConnectorFlowOptions<TContext, TPushContext> {
  connector: DataDestinationConnector<TContext, TPushContext>;
  /** The destination context of the view the screen was opened on. */
  context: TContext;
  columns: readonly ConnectorViewColumn[];
  selectedCount: number;
  t: ConnectorT;
  /** The push context for the chosen scope and the columns sent. */
  pushContext: (
    scope: "view" | "selection",
    columns: ConnectorColumn[]
  ) => TPushContext;
  onChange: (state: ConnectorFlowState) => void;
}

export interface ConnectorFlow {
  readonly state: ConnectorFlowState;
  start: () => Promise<void>;
  selectTarget: (targetId: string) => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
  resolveInput: (input: string) => Promise<void>;
  setField: (columnId: string, value: string) => void;
  update: (
    patch: Partial<Pick<ConnectorSettings, "mode" | "keyField" | "columns">>
  ) => void;
  setScope: (scope: "view" | "selection") => void;
  send: () => Promise<void>;
  /** Back to the settings after a result. */
  edit: () => void;
  dispose: () => void;
}

/** The chosen target's child: the preferred one when it has it, else its first. */
const childFor = (
  target: ConnectorTarget | undefined,
  preferred?: string
): string | undefined => {
  const children = target?.children ?? [];
  return children.some((child) => child.id === preferred)
    ? preferred
    : children[0]?.id;
};

const sentColumns = (
  columns: readonly ConnectorColumn[],
  settings: ConnectorSettings
): ConnectorColumn[] =>
  columns
    .filter((column) =>
      settings.mapping.some(
        (entry) => entry.columnId === column.id && entry.field
      )
    )
    .map(({ id, header, type }) =>
      type ? { id, header, type } : { id, header }
    );

/**
 * The connector screen as a framework-neutral state machine: both editions
 * render `state` and call these actions, so they behave the same.
 */
export function createConnectorFlow<TContext, TPushContext>(
  options: ConnectorFlowOptions<TContext, TPushContext>
): ConnectorFlow {
  const { connector, context, columns, t } = options;
  let state: ConnectorFlowState = {
    phase: "loading",
    targets: [],
    targetId: "",
    schema: null,
    schemaLoading: false,
    settings: null,
    scope: options.selectedCount > 0 ? "selection" : "view",
    resolving: false,
    error: null,
    result: null,
  };
  let notify = options.onChange;
  let draft: Partial<ConnectorSettings> | null = null;
  let request = 0;
  let started = false;
  const set = (patch: Partial<ConnectorFlowState>) => {
    state = { ...state, ...patch };
    notify(state);
  };
  const failureText = (error: unknown) =>
    connectorFailureMessage(toConnectorFailure(error), t, connector.help);
  const targetById = (id: string) =>
    state.targets.find((target) => target.id === id);

  const describe = async (targetId: string, childId: string | undefined) => {
    request += 1;
    const ticket = request;
    draft = state.settings ?? draft;
    set({
      targetId,
      childId,
      schema: null,
      schemaLoading: true,
      settings: null,
      error: null,
      result: null,
    });
    try {
      const schema = await connector.describe(
        childId ? { targetId, childId } : { targetId },
        context
      );
      if (ticket !== request) {
        return;
      }
      const settings = resolveConnectorSettings({
        columns,
        modes: connector.modes,
        saved: draft,
        schema,
        target: { targetId, childId },
      });
      set({ schema, schemaLoading: false, settings });
    } catch (error) {
      if (ticket === request) {
        set({ schemaLoading: false, error: failureText(error) });
      }
    }
  };

  const start = async () => {
    if (started) {
      return;
    }
    started = true;
    try {
      const [targets, saved] = await Promise.all([
        connector.targets(context),
        connector.load ? connector.load(context) : null,
      ]);
      draft = saved ?? null;
      const known =
        !saved?.targetId ||
        targets.some((target) => target.id === saved.targetId);
      const list =
        known || !saved
          ? targets
          : [...targets, { id: saved.targetId, label: saved.targetId }];
      set({ phase: "form", targets: list });
      if (saved?.targetId) {
        const target = list.find((item) => item.id === saved.targetId);
        await describe(saved.targetId, childFor(target, saved.childId));
      }
    } catch (error) {
      set({ phase: "form", error: failureText(error) });
    }
  };

  const selectTarget = async (targetId: string) => {
    if (!targetId || targetId === state.targetId) {
      return;
    }
    await describe(targetId, childFor(targetById(targetId), state.childId));
  };

  const selectChild = async (childId: string) => {
    if (childId !== state.childId && state.targetId) {
      await describe(state.targetId, childId);
    }
  };

  const resolveInput = async (input: string) => {
    const text = input.trim();
    if (!(text && connector.allowTargetInput) || state.resolving) {
      return;
    }
    set({ resolving: true, error: null });
    try {
      const target = await connector.allowTargetInput.resolve(text, context);
      set({
        resolving: false,
        targets: [
          ...state.targets.filter((item) => item.id !== target.id),
          target,
        ],
      });
      await describe(target.id, childFor(target));
    } catch (error) {
      set({ resolving: false, error: failureText(error) });
    }
  };

  const setSettings = (settings: ConnectorSettings) =>
    set({ settings, error: null });

  const setField = (columnId: string, value: string) => {
    if (!state.settings) {
      return;
    }
    const field = value === CONNECTOR_SKIP ? null : value;
    setSettings({
      ...state.settings,
      mapping: state.settings.mapping.map((entry) =>
        entry.columnId === columnId ? { columnId, field } : entry
      ),
    });
  };

  const update = (
    patch: Partial<Pick<ConnectorSettings, "mode" | "keyField" | "columns">>
  ) => {
    if (state.settings) {
      setSettings({ ...state.settings, ...patch });
    }
  };

  const setScope = (scope: "view" | "selection") => {
    set({
      scope:
        scope === "selection" && options.selectedCount > 0
          ? "selection"
          : "view",
    });
  };

  const validationError = (
    settings: ConnectorSettings,
    schema: ConnectorSchema
  ): string | null => {
    const target = targetById(settings.targetId);
    const [issue] = validateConnectorSettings(settings, {
      schema,
      modes: connector.modes,
      target,
    });
    return issue
      ? connectorIssueMessage(issue, t, connector.labels?.child ?? t("child"))
      : null;
  };

  // Settings are remembered on every send, whatever the push returns.
  const push = async (settings: ConnectorSettings) => {
    const saving = Promise.resolve()
      .then(() => connector.save?.(settings, context))
      .then(
        () => null,
        (error: unknown) => failureText(error)
      );
    const outcome = await connector.push(
      settings,
      options.pushContext(state.scope, sentColumns(columns, settings))
    );
    const saveError = await saving;
    if (isPushFailure(outcome)) {
      throw outcome;
    }
    return { result: outcome, saveError };
  };

  const send = async () => {
    const { schema } = state;
    if (!(state.settings && schema) || state.phase === "sending") {
      return;
    }
    const settings = connectorSettingsToSend(state.settings, columns);
    const invalid = validationError(settings, schema);
    if (invalid) {
      set({ error: invalid });
      return;
    }
    set({ phase: "sending", error: null });
    try {
      const { result, saveError } = await push(settings);
      draft = state.settings;
      set({ phase: "result", result, error: saveError });
    } catch (error) {
      set({ phase: "form", error: failureText(error) });
    }
  };

  return {
    get state() {
      return state;
    },
    start,
    selectTarget,
    selectChild,
    resolveInput,
    setField,
    update,
    setScope,
    send,
    edit: () => set({ phase: "form", result: null, error: null }),
    dispose: () => {
      notify = () => undefined;
      request += 1;
    },
  };
}

// Screen fields ------------------------------------------------------------------

/** Option value of the target select before a target is chosen. */
export const CONNECTOR_NO_TARGET = "__yayaw_no_target__";

/** One select of the connector screen; both editions render the same list. */
export interface ConnectorScreenField {
  /** "target", "child", "columns", "map:<columnId>", "keyField", "mode" or "scope". */
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  heading?: string;
  inline?: boolean;
}

const MAP_PREFIX = "map:";

interface ScreenFieldOptions {
  connector: Pick<DataDestinationConnector, "labels" | "modes">;
  columns: readonly ConnectorViewColumn[];
  selectedCount: number;
  t: ConnectorT;
}

const targetFields = (
  state: ConnectorFlowState,
  { connector, t }: ScreenFieldOptions
): ConnectorScreenField[] => {
  const target = state.targets.find((item) => item.id === state.targetId);
  const fields: ConnectorScreenField[] = [
    {
      id: "target",
      label: connector.labels?.target ?? t("target"),
      value: state.targetId || CONNECTOR_NO_TARGET,
      options: [
        ...(state.targetId
          ? []
          : [{ value: CONNECTOR_NO_TARGET, label: t("chooseTarget") }]),
        ...state.targets.map((item) => ({ value: item.id, label: item.label })),
      ],
    },
  ];
  if (target?.children?.length) {
    fields.push({
      id: "child",
      label: connector.labels?.child ?? t("child"),
      value: state.childId ?? "",
      options: target.children.map((child) => ({
        value: child.id,
        label: child.label,
      })),
    });
  }
  return fields;
};

const mappingFields = (
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  { columns, t }: ScreenFieldOptions
): ConnectorScreenField[] => {
  const visibleCount = columns.filter((column) => column.visible).length;
  const fields: ConnectorScreenField[] = [
    {
      id: "columns",
      label: t("columns"),
      value: settings.columns === "all" ? "all" : "visible",
      options: [
        {
          value: "visible",
          label: t("columnsVisible", { count: visibleCount }),
        },
        { value: "all", label: t("columnsAll", { count: columns.length }) },
      ],
    },
  ];
  for (const [index, column] of connectorMappedColumns(
    columns,
    settings.columns
  ).entries()) {
    const field =
      settings.mapping.find((entry) => entry.columnId === column.id)?.field ??
      null;
    fields.push({
      id: `${MAP_PREFIX}${column.id}`,
      heading: index === 0 ? t("mapping") : undefined,
      label: column.header,
      inline: true,
      value: field ?? CONNECTOR_SKIP,
      options: connectorFieldOptions(column, schema, field, t),
    });
  }
  return fields;
};

const sendingFields = (
  state: ConnectorFlowState,
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  { connector, selectedCount, t }: ScreenFieldOptions
): ConnectorScreenField[] => {
  const keys = connectorKeyFields(schema);
  const fields: ConnectorScreenField[] = [
    {
      id: "keyField",
      label: t("keyField"),
      value: settings.keyField,
      options: (keys.includes(settings.keyField)
        ? keys
        : [settings.keyField, ...keys]
      ).map((name) => ({ value: name, label: name })),
    },
  ];
  const modes = connectorModes(connector.modes);
  if (modes.length > 1) {
    fields.push({
      id: "mode",
      label: t("mode"),
      value: settings.mode,
      options: modes.map((mode) => ({ value: mode, label: t(mode) })),
    });
  }
  fields.push({
    id: "scope",
    label: t("scope"),
    value: state.scope,
    options: [
      { value: "view", label: t("scopeView") },
      ...(selectedCount > 0
        ? [
            {
              value: "selection",
              label: t("scopeSelection", { count: selectedCount }),
            },
          ]
        : []),
    ],
  });
  return fields;
};

/**
 * The screen's selects in order: target and child, then, once the target is
 * described, columns, one mapping per column, key field, mode and records.
 */
export function connectorScreenFields(
  state: ConnectorFlowState,
  options: ScreenFieldOptions
): ConnectorScreenField[] {
  const { schema, settings } = state;
  const fields = targetFields(state, options);
  if (schema && settings) {
    fields.push(
      ...mappingFields(schema, settings, options),
      ...sendingFields(state, schema, settings, options)
    );
  }
  return fields;
}

/** Applies a choice made in one of `connectorScreenFields`. */
export function applyConnectorField(
  flow: ConnectorFlow,
  id: string,
  value: string
): Promise<void> {
  if (id.startsWith(MAP_PREFIX)) {
    flow.setField(id.slice(MAP_PREFIX.length), value);
    return Promise.resolve();
  }
  switch (id) {
    case "target":
      return value === CONNECTOR_NO_TARGET
        ? Promise.resolve()
        : flow.selectTarget(value);
    case "child":
      return flow.selectChild(value);
    case "columns":
      flow.update({ columns: value === "all" ? "all" : "visible" });
      break;
    case "keyField":
      flow.update({ keyField: value });
      break;
    case "mode":
      flow.update({ mode: value === "replace" ? "replace" : "upsert" });
      break;
    default:
      flow.setScope(value === "selection" ? "selection" : "view");
  }
  return Promise.resolve();
}

const TARGET_FIELD_IDS = new Set(["target", "child", "columns"]);

/**
 * The screen fields as the column-mapping component takes them: target
 * settings before the rows, the mapping rows, the key field, then mode and
 * records.
 */
export function connectorMappingSections(
  fields: readonly ConnectorScreenField[]
): {
  before: ConnectorScreenField[];
  rows: ColumnMappingRow[];
  keyField: ConnectorScreenField | undefined;
  after: ConnectorScreenField[];
} {
  const isRow = (field: ConnectorScreenField) =>
    field.id.startsWith(MAP_PREFIX);
  return {
    before: fields.filter((field) => TARGET_FIELD_IDS.has(field.id)),
    rows: fields
      .filter(isRow)
      .map(({ id, label, value, options, heading }) => ({
        id,
        label,
        value,
        options,
        heading,
      })),
    keyField: fields.find((field) => field.id === "keyField"),
    after: fields.filter(
      (field) =>
        !(
          TARGET_FIELD_IDS.has(field.id) ||
          isRow(field) ||
          field.id === "keyField"
        )
    ),
  };
}
