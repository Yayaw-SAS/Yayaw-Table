/**
 * Connector screens for Connect destinations, shared by the React and Vue
 * editions. The table owns the flow (target, direction, column mapping,
 * scope, sync rules, preview, send and result); the host only lists targets,
 * describes their fields, pushes, previews and syncs through its own server
 * functions, which call the connector server modules and the sync engine.
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
import { coerceImportValue } from "./import-model";
import { formatDateValue, formatNumberValue } from "./value-format";

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
  /**
   * A few values of the field, for pull and two-way mappings: the screen
   * shows the first and counts those the mapped column cannot take.
   */
  sample?: unknown[];
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

/**
 * "push" sends the table to the target, "pull" imports the target into the
 * table, "two-way" keeps both in sync. Same values as the sync engine's
 * `SyncDirection`, mirrored so the browser bundle never imports server code.
 */
export type SyncDirection = "push" | "pull" | "two-way";

/** Which side wins a column changed on both sides (two-way only). */
export type ConflictRule = "table-wins" | "target-wins" | "latest-wins";

/** What happens to a linked record deleted on one side. */
export type DeletePolicy = "ignore" | "flag" | "propagate";

export const SYNC_DIRECTIONS: readonly SyncDirection[] = [
  "push",
  "pull",
  "two-way",
];

export const CONFLICT_RULES: readonly ConflictRule[] = [
  "table-wins",
  "target-wins",
  "latest-wins",
];

/** In screen order: the safe default first, the destructive one last. */
export const DELETE_POLICIES: readonly DeletePolicy[] = [
  "flag",
  "ignore",
  "propagate",
];

export const DEFAULT_CONFLICT_RULE: ConflictRule = "table-wins";
export const DEFAULT_DELETE_POLICY: DeletePolicy = "flag";

/** What is remembered for a view and sent to `push`, `preview` and `sync`. */
export interface ConnectorSettings {
  targetId: string;
  childId?: string;
  mode: ConnectorMode;
  /** Target field matched against each record's id. */
  keyField: string;
  mapping: ConnectorMappingEntry[];
  /** Columns offered for mapping: the visible ones (default) or all. */
  columns?: "visible" | "all";
  /** Default "push". The screen always sets it. */
  direction?: SyncDirection;
  /** Two-way only; default "table-wins". The screen always sets it. */
  conflictRule?: ConflictRule;
  /** Pull and two-way; default "flag". The screen always sets it. */
  deletePolicy?: DeletePolicy;
}

/** Who owns a column: its value always comes from that side. */
export type ConflictOwner = "table" | "target";

/** A per-column conflict rule: a global rule, `merge` (lists) or `manual`. */
export type ColumnConflictRule = ConflictRule | "merge" | "manual";

/**
 * Conflict rules the host applies in code (the sync engine's `ownership`
 * and `columnRules`, plus any `resolveConflict` it keeps on its server),
 * declared so the screen can show them. Functions never reach the browser.
 */
export interface ConnectorConflictRules {
  /** Columns one side owns ("Price: Spreadsheet is the source of truth"). */
  ownership?: Record<string, ConflictOwner>;
  /** Per-column rules ("Tags: merged", "Notes: decided by you"). */
  columnRules?: Record<string, ColumnConflictRule>;
  /** The conflict rule select is read-only: the app decides. */
  lock?: boolean;
  /**
   * Offer "Conflicts to resolve" when the connector has `listConflicts` and
   * `resolveConflicts`; default true.
   */
  allowManual?: boolean;
}

/** A conflict waiting for a person, as `listConflicts` returns it. */
export interface PendingConflict {
  rowId: string;
  remoteId?: string;
  /** A name for the record, e.g. its title; the row id otherwise. */
  rowLabel?: string;
  columnId: string;
  tableValue: unknown;
  targetValue: unknown;
  baseValue?: unknown;
  /** ISO time the conflict was found. */
  detectedAt?: string;
}

/** A person's decision on a pending conflict, sent to `resolveConflicts`. */
export interface PendingConflictResolution {
  rowId: string;
  columnId: string;
  choice: "table" | "target" | { value: unknown };
}

/** How a conflict is settled: a side, a merged or custom value, a person, or not this time. */
export type SyncConflictResolution =
  | "table"
  | "target"
  | "merged"
  | "custom"
  | "manual"
  | "skipped";

/** What settled it: the column's owner, its rule, the app's resolver or the global rule. */
export type SyncConflictSource = "ownership" | "column" | "resolver" | "rule";

/** A column changed on both sides, with the value each side holds and how it is settled. */
export interface SyncPreviewConflict {
  /** A name for the record, e.g. its title; the row id otherwise. */
  rowLabel?: string;
  rowId?: string;
  columnId: string;
  tableValue: unknown;
  targetValue: unknown;
  resolution: SyncConflictResolution;
  /** Default "rule". */
  source?: SyncConflictSource;
  /** The value both sides get, for "merged" and "custom". */
  value?: unknown;
}

/**
 * What a sync would do, returned by the connector's `preview`: the host runs
 * the sync engine's `planSync` on the server and returns its counts (see
 * `toSyncPreview`).
 */
export interface SyncPreview {
  createInTarget: number;
  updateInTarget: number;
  createInTable: number;
  updateInTable: number;
  deleteInTarget: number;
  deleteInTable: number;
  /** Linked records deleted on one side that the delete policy only flags. */
  flagged: number;
  /** The first conflicts (the host chooses how many). */
  conflicts: SyncPreviewConflict[];
  /** Every conflict; default `conflicts.length`. */
  conflictCount?: number;
  /** The first columns written back by their owning side (`ownership`). */
  overridden?: SyncPreviewConflict[];
  /** Every override; default `overridden.length`. */
  overriddenCount?: number;
  /** Conflicts that will wait for a person after this sync. */
  pendingConflicts?: number;
  /** Keys shared by several records, left alone. */
  duplicates: number;
  unchanged: number;
}

/** Writes a sync applied, by side. */
export interface SyncRunCounts {
  createInTarget?: number;
  updateInTarget?: number;
  deleteInTarget?: number;
  createInTable?: number;
  updateInTable?: number;
  deleteInTable?: number;
}

/** What the connector's `sync` returns (see `toSyncRunResult`). */
export interface SyncRunResult {
  applied: SyncRunCounts;
  failed: number;
  /** The first failures; `rows` defaults to 1. */
  failures: (Omit<ConnectorPushFailure, "rows"> & { rows?: number })[];
  flagged: number;
  truncated: boolean;
  /** An authorization error or a cancellation stopped the run. */
  stopped?: string;
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

/** A failure a host function returns instead of throwing. */
export interface ConnectorOutcomeError {
  error: Partial<ConnectorFailure> & { code: string };
}

export type ConnectorPushOutcome = ConnectorPushResult | ConnectorOutcomeError;

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
  /**
   * Directions to offer; default `["push"]`. "pull" and "two-way" need
   * `sync`. Push always calls `push` (modes and the selection scope).
   */
  directions?: SyncDirection[];
  /** Conflict rules to offer; default all. Hide "latest-wins" for targets without edit times. */
  conflictRules?: ConflictRule[];
  /** What a pull or two-way sync would do, without writing anything. */
  preview?: (
    settings: ConnectorSettings,
    context: TPushContext
  ) => MaybePromise<SyncPreview | ConnectorOutcomeError>;
  /** Runs a pull or two-way sync with the settings. */
  sync?: (
    settings: ConnectorSettings,
    context: TPushContext
  ) => MaybePromise<SyncRunResult | ConnectorOutcomeError>;
  /** Conflict rules the host applies in code, shown on the screen. */
  conflicts?: ConnectorConflictRules;
  /** Conflicts waiting for a person (the sync state's `pendingConflicts`). */
  listConflicts?: (
    settings: ConnectorSettings,
    context: TPushContext
  ) => MaybePromise<PendingConflict[] | ConnectorOutcomeError>;
  /** Applies a person's decisions (`resolvePendingConflicts`) and returns what was written. */
  resolveConflicts?: (
    resolutions: PendingConflictResolution[],
    settings: ConnectorSettings,
    context: TPushContext
  ) => MaybePromise<SyncRunResult | ConnectorOutcomeError>;
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
  | "error_unknown"
  | SyncLabelKey;

/** Labels of the sync settings, preview and result. */
export type SyncLabelKey =
  | "direction"
  | "directionPush"
  | "directionPull"
  | "directionTwoWay"
  | "directionPushShort"
  | "directionPullShort"
  | "directionTwoWayShort"
  | "mappingPull"
  | "mappingTwoWay"
  | "dontImport"
  | "dontSync"
  | "sample"
  | "invalidCount"
  | "invalidOne"
  | "conflictRule"
  | "conflictTableWins"
  | "conflictTargetWins"
  | "conflictLatestWins"
  | "conflictTableWinsHint"
  | "conflictTargetWinsHint"
  | "conflictLatestWinsHint"
  | "deletePolicy"
  | "deleteFlag"
  | "deleteIgnore"
  | "deletePropagate"
  | "deleteFlagHint"
  | "deleteIgnoreHint"
  | "deletePropagateHint"
  | "deleteConfirm"
  | "confirmDeletesFirst"
  | "previewFirst"
  | "previewChanges"
  | "previewAgain"
  | "previewing"
  | "syncNow"
  | "importNow"
  | "syncing"
  | "inTarget"
  | "inTable"
  | "thisTable"
  | "toCreate"
  | "toUpdate"
  | "toDelete"
  | "nothingToChange"
  | "unchanged"
  | "flagged"
  | "flaggedOne"
  | "duplicates"
  | "duplicatesOne"
  | "conflicts"
  | "moreConflicts"
  | "wins"
  | "emptyValue"
  | "deleted"
  | "deletedOne"
  | "nothingChanged"
  | "syncStopped"
  | "issueNoFields"
  | "issueInvalidDirection"
  | "issueInvalidConflictRule"
  | "importFrom"
  | "importFromHint"
  | ConflictLabelKey;

/** Labels of the conflict rules, preview outcomes and conflicts to resolve. */
export type ConflictLabelKey =
  | "appRules"
  | "appRulesLocked"
  | "ruleOwnedTable"
  | "ruleOwnedTarget"
  | "ruleMerge"
  | "ruleManual"
  | "ruleTableWins"
  | "ruleTargetWins"
  | "ruleLatestWins"
  | "ownedBy"
  | "resolutionMerged"
  | "resolutionManual"
  | "resolutionCustom"
  | "resolutionSkipped"
  | "resultValue"
  | "overridden"
  | "moreOverridden"
  | "pendingNote"
  | "pendingNoteOne"
  | "conflictsToResolve"
  | "conflictsHint"
  | "keepTable"
  | "keepTarget"
  | "keepAllTable"
  | "keepAllTarget"
  | "noConflicts"
  | "resolvingConflicts"
  | "backToSettings"
  | "valueYes"
  | "valueNo";

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
  direction: "Direction",
  directionPush: "Send to {target}",
  directionPull: "Import from {target}",
  directionTwoWay: "Keep both in sync",
  directionPushShort: "Send",
  directionPullShort: "Import",
  directionTwoWayShort: "Keep in sync",
  mappingPull: "Import each field into",
  mappingTwoWay: "Sync each field with",
  dontImport: "Don’t import",
  dontSync: "Don’t sync",
  sample: "e.g. {value}",
  invalidCount: "{count} won’t convert",
  invalidOne: "{count} won’t convert",
  conflictRule: "When both sides changed",
  conflictTableWins: "This table wins",
  conflictTargetWins: "{target} wins",
  conflictLatestWins: "Latest edit wins",
  conflictTableWinsHint: "Keeps the table’s value and writes it to {target}.",
  conflictTargetWinsHint:
    "Keeps the value from {target} and writes it to this table.",
  conflictLatestWinsHint:
    "Keeps the value edited last. Without edit times (spreadsheets), the table wins.",
  deletePolicy: "Deleted records",
  deleteFlag: "Only flag",
  deleteIgnore: "Ignore",
  deletePropagate: "Delete on the other side",
  deleteFlagHint: "Lists records deleted on one side. Nothing is deleted.",
  deleteIgnoreHint: "Leaves records deleted on one side alone.",
  deletePropagateHint:
    "A record deleted on one side is deleted on the other side too.",
  deleteConfirm: "Delete records on the other side when they are deleted",
  confirmDeletesFirst: "Confirm the deletions first.",
  previewFirst: "Preview the changes before deleting records.",
  previewChanges: "Preview changes",
  previewAgain: "Preview again",
  previewing: "Comparing…",
  syncNow: "Sync now",
  importNow: "Import now",
  syncing: "Syncing…",
  inTarget: "In {target}",
  inTable: "In this table",
  thisTable: "This table",
  toCreate: "Create",
  toUpdate: "Update",
  toDelete: "Delete",
  nothingToChange: "Nothing to change: both sides match.",
  unchanged: "{count} unchanged",
  flagged: "{count} records deleted on one side are flagged.",
  flaggedOne: "{count} record deleted on one side is flagged.",
  duplicates:
    "{count} keys are shared by several records; they are left alone.",
  duplicatesOne:
    "{count} key is shared by several records; they are left alone.",
  conflicts: "Changed on both sides ({count})",
  moreConflicts: "And {count} more",
  wins: "{side} wins",
  emptyValue: "(empty)",
  deleted: "{count} deleted",
  deletedOne: "{count} deleted",
  nothingChanged: "Nothing changed",
  syncStopped: "The sync stopped: {message}",
  issueNoFields: "Choose at least one field to sync.",
  issueInvalidDirection: "This destination doesn’t support this direction.",
  issueInvalidConflictRule:
    "This destination doesn’t support this conflict rule.",
  importFrom: "From {name}",
  importFromHint: "Imports its records and keeps them linked.",
  appRules: "Rules set by your app",
  appRulesLocked:
    "Your app decides conflicts; these rules can’t be changed here.",
  ruleOwnedTable: "{column}: this table is the source of truth",
  ruleOwnedTarget: "{column}: {target} is the source of truth",
  ruleMerge: "{column}: merged",
  ruleManual: "{column}: decided by you",
  ruleTableWins: "{column}: this table wins",
  ruleTargetWins: "{column}: {target} wins",
  ruleLatestWins: "{column}: latest edit wins",
  ownedBy: "Owned by {side}",
  resolutionMerged: "Merged",
  resolutionManual: "Needs your decision",
  resolutionCustom: "Decided by your app",
  resolutionSkipped: "Left as is for now",
  resultValue: "Result",
  overridden: "Kept from the side that owns them ({count})",
  moreOverridden: "And {count} more",
  pendingNote: "{count} conflicts will wait for your decision.",
  pendingNoteOne: "{count} conflict will wait for your decision.",
  conflictsToResolve: "Conflicts to resolve ({count})",
  conflictsHint: "Both sides changed these values. Choose the one to keep.",
  keepTable: "Keep table value",
  keepTarget: "Keep {target} value",
  keepAllTable: "Keep all table values",
  keepAllTarget: "Keep all {target} values",
  noConflicts: "All conflicts are resolved.",
  resolvingConflicts: "Resolving…",
  backToSettings: "Back",
  valueYes: "Yes",
  valueNo: "No",
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
  direction: "Sens",
  directionPush: "Envoyer vers {target}",
  directionPull: "Importer depuis {target}",
  directionTwoWay: "Garder les deux synchronisés",
  directionPushShort: "Envoi",
  directionPullShort: "Import",
  directionTwoWayShort: "Synchronisé",
  mappingPull: "Importer chaque champ dans",
  mappingTwoWay: "Synchroniser chaque champ avec",
  dontImport: "Ne pas importer",
  dontSync: "Ne pas synchroniser",
  sample: "ex. {value}",
  invalidCount: "{count} non convertibles",
  invalidOne: "{count} non convertible",
  conflictRule: "Si les deux côtés ont changé",
  conflictTableWins: "Cette table l’emporte",
  conflictTargetWins: "{target} l’emporte",
  conflictLatestWins: "La dernière modification l’emporte",
  conflictTableWinsHint:
    "Garde la valeur de la table et l’écrit dans {target}.",
  conflictTargetWinsHint:
    "Garde la valeur de {target} et l’écrit dans cette table.",
  conflictLatestWinsHint:
    "Garde la valeur modifiée en dernier. Sans date de modification (tableurs), la table l’emporte.",
  deletePolicy: "Enregistrements supprimés",
  deleteFlag: "Seulement signaler",
  deleteIgnore: "Ignorer",
  deletePropagate: "Supprimer de l’autre côté",
  deleteFlagHint:
    "Liste les enregistrements supprimés d’un côté. Rien n’est supprimé.",
  deleteIgnoreHint: "Ne fait rien des enregistrements supprimés d’un côté.",
  deletePropagateHint:
    "Un enregistrement supprimé d’un côté est aussi supprimé de l’autre.",
  deleteConfirm:
    "Supprimer les enregistrements de l’autre côté quand ils sont supprimés",
  confirmDeletesFirst: "Confirmez d’abord les suppressions.",
  previewFirst:
    "Prévisualisez les changements avant de supprimer des enregistrements.",
  previewChanges: "Prévisualiser les changements",
  previewAgain: "Prévisualiser à nouveau",
  previewing: "Comparaison…",
  syncNow: "Synchroniser",
  importNow: "Importer",
  syncing: "Synchronisation…",
  inTarget: "Dans {target}",
  inTable: "Dans cette table",
  thisTable: "Cette table",
  toCreate: "Créer",
  toUpdate: "Mettre à jour",
  toDelete: "Supprimer",
  nothingToChange: "Rien à changer : les deux côtés correspondent.",
  unchanged: "{count} inchangés",
  flagged: "{count} enregistrements supprimés d’un côté sont signalés.",
  flaggedOne: "{count} enregistrement supprimé d’un côté est signalé.",
  duplicates:
    "{count} clés sont partagées par plusieurs enregistrements ; ils sont laissés de côté.",
  duplicatesOne:
    "{count} clé est partagée par plusieurs enregistrements ; ils sont laissés de côté.",
  conflicts: "Modifiés des deux côtés ({count})",
  moreConflicts: "Et {count} de plus",
  wins: "{side} l’emporte",
  emptyValue: "(vide)",
  deleted: "{count} supprimés",
  deletedOne: "{count} supprimé",
  nothingChanged: "Rien n’a changé",
  syncStopped: "La synchronisation s’est arrêtée : {message}",
  issueNoFields: "Choisissez au moins un champ à synchroniser.",
  issueInvalidDirection: "Cette destination ne prend pas en charge ce sens.",
  issueInvalidConflictRule:
    "Cette destination ne prend pas en charge cette règle de conflit.",
  importFrom: "Depuis {name}",
  importFromHint: "Importe ses enregistrements et les garde liés.",
  appRules: "Règles définies par votre application",
  appRulesLocked:
    "Votre application décide des conflits ; ces règles ne se modifient pas ici.",
  ruleOwnedTable: "{column} : cette table fait foi",
  ruleOwnedTarget: "{column} : {target} fait foi",
  ruleMerge: "{column} : fusionné",
  ruleManual: "{column} : décidé par vous",
  ruleTableWins: "{column} : cette table l’emporte",
  ruleTargetWins: "{column} : {target} l’emporte",
  ruleLatestWins: "{column} : la dernière modification l’emporte",
  ownedBy: "Appartient à {side}",
  resolutionMerged: "Fusionné",
  resolutionManual: "À décider par vous",
  resolutionCustom: "Décidé par votre application",
  resolutionSkipped: "Laissé tel quel pour l’instant",
  resultValue: "Résultat",
  overridden: "Repris du côté propriétaire ({count})",
  moreOverridden: "Et {count} de plus",
  pendingNote: "{count} conflits attendront votre décision.",
  pendingNoteOne: "{count} conflit attendra votre décision.",
  conflictsToResolve: "Conflits à résoudre ({count})",
  conflictsHint:
    "Les deux côtés ont modifié ces valeurs. Choisissez celle à garder.",
  keepTable: "Garder la valeur de la table",
  keepTarget: "Garder la valeur de {target}",
  keepAllTable: "Garder toutes les valeurs de la table",
  keepAllTarget: "Garder toutes les valeurs de {target}",
  noConflicts: "Tous les conflits sont résolus.",
  resolvingConflicts: "Résolution…",
  backToSettings: "Retour",
  valueYes: "Oui",
  valueNo: "Non",
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

/** Whether a direction runs through the connector's `preview` and `sync`. */
export function isSyncDirection(
  direction: SyncDirection | undefined
): direction is "pull" | "two-way" {
  return direction === "pull" || direction === "two-way";
}

/**
 * Directions to offer, in the declared order; default push only. Pull and
 * two-way need `sync`; `table.sync: false` (`syncEnabled`) keeps push only.
 */
export function connectorDirections(
  connector: Pick<DataDestinationConnector, "directions"> & {
    sync?: unknown;
  },
  syncEnabled = true
): SyncDirection[] {
  const canSync = syncEnabled && typeof connector.sync === "function";
  const valid = (connector.directions ?? []).filter(
    (direction, index, list) =>
      SYNC_DIRECTIONS.includes(direction) &&
      list.indexOf(direction) === index &&
      (direction === "push" || canSync)
  );
  return valid.length > 0 ? valid : ["push"];
}

/** Conflict rules to offer, in the declared order; default all three. */
export function connectorConflictRules(
  rules: readonly ConflictRule[] | undefined
): ConflictRule[] {
  const valid = (rules ?? []).filter(
    (rule, index, list) =>
      CONFLICT_RULES.includes(rule) && list.indexOf(rule) === index
  );
  return valid.length > 0 ? valid : [...CONFLICT_RULES];
}

/** Which settings the screen shows for a direction. */
export function connectorSyncFields(
  direction: SyncDirection | undefined,
  options: { hasPreview?: boolean } = {}
): {
  mode: boolean;
  scope: boolean;
  conflictRule: boolean;
  deletePolicy: boolean;
  preview: boolean;
} {
  const sync = isSyncDirection(direction);
  return {
    mode: !sync,
    scope: !sync,
    conflictRule: direction === "two-way",
    deletePolicy: sync,
    preview: sync && options.hasPreview === true,
  };
}

const pickOffered = <T>(
  offered: readonly T[],
  preferred: readonly (T | undefined)[],
  fallback: T
): T =>
  preferred.find(
    (value): value is T => value !== undefined && offered.includes(value)
  ) ?? (offered.includes(fallback) ? fallback : (offered[0] ?? fallback));

/** Direction, conflict rule and delete policy: preset or remembered when offered, else the defaults. */
export function resolveSyncSettings({
  directions,
  conflictRules,
  preset,
  saved,
}: {
  directions?: readonly SyncDirection[];
  conflictRules?: readonly ConflictRule[];
  /** A direction to open with, e.g. "pull" from Data › Import. */
  preset?: SyncDirection;
  saved?: Partial<ConnectorSettings> | null;
}): Required<
  Pick<ConnectorSettings, "direction" | "conflictRule" | "deletePolicy">
> {
  const offered = directions?.length ? directions : (["push"] as const);
  return {
    direction: pickOffered(offered, [preset, saved?.direction], "push"),
    conflictRule: pickOffered(
      connectorConflictRules(conflictRules),
      [saved?.conflictRule],
      DEFAULT_CONFLICT_RULE
    ),
    deletePolicy: pickOffered(
      DELETE_POLICIES,
      [saved?.deletePolicy],
      DEFAULT_DELETE_POLICY
    ),
  };
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
  directions,
  conflictRules,
  preset,
}: {
  columns: readonly ConnectorViewColumn[];
  modes?: readonly ConnectorMode[];
  saved?: Partial<ConnectorSettings> | null;
  schema: ConnectorSchema;
  target: ConnectorTargetRef;
  /** Directions offered (`connectorDirections`); default push only. */
  directions?: readonly SyncDirection[];
  conflictRules?: readonly ConflictRule[];
  preset?: SyncDirection;
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
    ...resolveSyncSettings({ directions, conflictRules, preset, saved }),
  };
}

/**
 * The settings `push`, `sync` and `save` receive: columns left out of the
 * mapping are `null`, and a pull leaves out fields the target does not have.
 */
export function connectorSettingsToSend(
  settings: ConnectorSettings,
  columns: readonly ConnectorViewColumn[],
  schema?: ConnectorSchema | null
): ConnectorSettings {
  const mapped = new Set(
    connectorMappedColumns(columns, settings.columns).map((column) => column.id)
  );
  const names =
    settings.direction === "pull" && schema
      ? new Set(schema.fields.map((field) => field.name))
      : null;
  const usable = (field: string | null) =>
    field !== null && (names === null || names.has(field));
  return {
    ...settings,
    mapping: settings.mapping.map((entry) => ({
      columnId: entry.columnId,
      field:
        mapped.has(entry.columnId) && usable(entry.field) ? entry.field : null,
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
  | "invalid_mode"
  | "invalid_direction"
  | "invalid_conflict_rule";

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

const syncIssues = (
  settings: ConnectorSettings,
  directions: readonly SyncDirection[] | undefined,
  conflictRules: readonly ConflictRule[] | undefined
): ConnectorIssue[] => {
  const direction = settings.direction ?? "push";
  const offered = directions?.length ? directions : ["push"];
  if (!offered.includes(direction)) {
    return [{ code: "invalid_direction" }];
  }
  const rule = settings.conflictRule ?? DEFAULT_CONFLICT_RULE;
  if (
    direction === "two-way" &&
    !connectorConflictRules(conflictRules).includes(rule)
  ) {
    return [{ code: "invalid_conflict_rule" }];
  }
  return [];
};

/** Everything that would stop a push or a sync, in screen order. */
export function validateConnectorSettings(
  settings: ConnectorSettings,
  {
    schema,
    modes,
    target,
    directions,
    conflictRules,
  }: {
    schema: ConnectorSchema;
    modes?: readonly ConnectorMode[];
    target?: ConnectorTarget;
    /** Directions offered; default push only. */
    directions?: readonly SyncDirection[];
    conflictRules?: readonly ConflictRule[];
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
  issues.push(...syncIssues(settings, directions, conflictRules));
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
  invalid_direction: "issueInvalidDirection",
  invalid_conflict_rule: "issueInvalidConflictRule",
};

export function connectorIssueMessage(
  issue: ConnectorIssue,
  t: ConnectorT,
  childLabel = t("child"),
  direction?: SyncDirection
): string {
  const key =
    issue.code === "no_columns" && isSyncDirection(direction)
      ? "issueNoFields"
      : ISSUE_KEYS[issue.code];
  return t(key, {
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

/** Whether a host function returned a failure instead of a result. */
export function isConnectorOutcomeError(
  outcome: unknown
): outcome is ConnectorOutcomeError {
  return isRecord(outcome) && "error" in outcome && isRecord(outcome.error);
}

// Sync preview and result --------------------------------------------------------

/** The part of the sync engine's `SyncPlan` a preview needs (structural, no import). */
export interface SyncPlanLike {
  createInTarget: readonly unknown[];
  updateInTarget: readonly unknown[];
  createInTable: readonly unknown[];
  updateInTable: readonly unknown[];
  deleteInTarget: readonly unknown[];
  deleteInTable: readonly unknown[];
  flagged: readonly unknown[];
  duplicates: readonly unknown[];
  unchanged: number;
  conflicts: readonly {
    rowId?: string;
    columnId: string;
    tableValue: unknown;
    targetValue: unknown;
    winner: "table" | "target";
    resolution?: SyncConflictResolution;
    source?: Exclude<SyncConflictSource, "ownership">;
    value?: unknown;
  }[];
  overridden?: readonly {
    rowId?: string;
    columnId: string;
    tableValue: unknown;
    targetValue: unknown;
    owner: ConflictOwner;
  }[];
  pendingConflicts?: readonly unknown[];
}

const SYNC_COUNT_KEYS = [
  "createInTarget",
  "updateInTarget",
  "deleteInTarget",
  "createInTable",
  "updateInTable",
  "deleteInTable",
] as const;

const DEFAULT_PREVIEW_CONFLICTS = 5;

type RowLabel = (rowId: string) => string | undefined;

const labelled = (rowId: string | undefined, rowLabel?: RowLabel) => {
  const label = rowId ? rowLabel?.(rowId) : undefined;
  return {
    ...(rowId ? { rowId } : {}),
    ...(label ? { rowLabel: label } : {}),
  };
};

/**
 * A sync engine plan as the preview `preview` returns; run it on the server
 * (`planSync`), then send this to the browser. `rowLabel` names a record;
 * `limit` caps the conflicts and the overrides listed.
 */
export function toSyncPreview(
  plan: SyncPlanLike,
  options: { limit?: number; rowLabel?: RowLabel } = {}
): SyncPreview {
  const limit = options.limit ?? DEFAULT_PREVIEW_CONFLICTS;
  const overridden = plan.overridden ?? [];
  const pending = plan.pendingConflicts?.length ?? 0;
  return {
    createInTarget: plan.createInTarget.length,
    updateInTarget: plan.updateInTarget.length,
    createInTable: plan.createInTable.length,
    updateInTable: plan.updateInTable.length,
    deleteInTarget: plan.deleteInTarget.length,
    deleteInTable: plan.deleteInTable.length,
    flagged: plan.flagged.length,
    duplicates: plan.duplicates.length,
    unchanged: plan.unchanged,
    conflictCount: plan.conflicts.length,
    conflicts: plan.conflicts.slice(0, limit).map((conflict) => ({
      ...labelled(conflict.rowId, options.rowLabel),
      columnId: conflict.columnId,
      tableValue: conflict.tableValue,
      targetValue: conflict.targetValue,
      resolution: conflict.resolution ?? conflict.winner,
      ...(conflict.source ? { source: conflict.source } : {}),
      ...(conflict.value === undefined ? {} : { value: conflict.value }),
    })),
    ...(overridden.length > 0
      ? {
          overriddenCount: overridden.length,
          overridden: overridden.slice(0, limit).map((item) => ({
            ...labelled(item.rowId, options.rowLabel),
            columnId: item.columnId,
            tableValue: item.tableValue,
            targetValue: item.targetValue,
            resolution: item.owner,
            source: "ownership" as const,
          })),
        }
      : {}),
    ...(pending > 0 ? { pendingConflicts: pending } : {}),
  };
}

/**
 * The sync state's pending conflicts as `listConflicts` returns them, with
 * a name for each record (structural, no import).
 */
export function toPendingConflicts(
  pending: readonly Omit<PendingConflict, "rowLabel">[] | undefined,
  options: { rowLabel?: RowLabel } = {}
): PendingConflict[] {
  return (pending ?? []).map((item) => {
    const rowLabel = options.rowLabel?.(item.rowId);
    return { ...item, ...(rowLabel ? { rowLabel } : {}) };
  });
}

/** The part of the sync engine's `SyncResult` a run result needs. */
export interface SyncResultLike {
  applied: Partial<Record<string, number>>;
  failed: number;
  failures: readonly { code: string; rowId?: string }[];
  stopped?: string;
}

/** A sync engine result as `sync` returns it; key write-backs are not counted. */
export function toSyncRunResult(
  result: SyncResultLike,
  plan?: Pick<SyncPlanLike, "flagged">,
  options: { truncated?: boolean } = {}
): SyncRunResult {
  const applied: SyncRunCounts = {};
  for (const key of SYNC_COUNT_KEYS) {
    const count = result.applied[key] ?? 0;
    if (count > 0) {
      applied[key] = count;
    }
  }
  return {
    applied,
    failed: result.failed,
    failures: result.failures.map((failure) => ({
      code: failure.code,
      ...(failure.rowId ? { rowId: failure.rowId } : {}),
      rows: 1,
    })),
    flagged: plan?.flagged.length ?? 0,
    truncated: options.truncated === true,
    ...(result.stopped ? { stopped: result.stopped } : {}),
  };
}

/** One count of a preview side, e.g. "Update · 2". */
export interface SyncPreviewCount {
  key: "create" | "update" | "delete";
  label: string;
  count: number;
}

/** A conflict as the preview lists it: both values and how it is settled. */
export interface SyncPreviewConflictLine {
  id: string;
  title: string;
  table: { label: string; value: string };
  target: { label: string; value: string };
  resolution: SyncConflictResolution;
  /** The side whose value is kept, when one is. */
  winner?: "table" | "target";
  /** "<side> wins", "Owned by <side>", "Merged", "Needs your decision"… */
  wins: string;
  /** The value both sides get, for merged and custom values. */
  result?: { label: string; value: string };
}

/** The preview as both editions render it. */
export interface SyncPreviewView {
  /** Nothing to create, update or delete. */
  empty: boolean;
  /** "In <target>" then "In this table", each with create, update and delete. */
  sides: {
    side: "target" | "table";
    title: string;
    counts: SyncPreviewCount[];
  }[];
  /** "Nothing to change…", flagged records, conflicts left to a person, unchanged count. */
  notes: string[];
  /** Warning about keys shared by several records. */
  duplicates: string | null;
  conflictsTitle: string | null;
  conflicts: SyncPreviewConflictLine[];
  moreConflicts: string | null;
  /** Columns written back by their owning side. */
  overriddenTitle: string | null;
  overridden: SyncPreviewConflictLine[];
  moreOverridden: string | null;
}

const NUMBER_COLUMN_TYPES = new Set([
  "number",
  "currency",
  "percent",
  "rating",
]);
const DATE_COLUMN_TYPES = new Set(["date", "datetime"]);

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/**
 * A value as the preview and the conflicts list show it: "(empty)", lists
 * joined with commas, and with a column `type`, numbers and dates in the
 * locale and yes/no for booleans.
 */
export function formatSyncValue(
  value: unknown,
  t: ConnectorT,
  column: { type?: string; locale?: string } = {}
): string {
  if (isEmptyValue(value)) {
    return t("emptyValue");
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (typeof value === "boolean") {
    return t(value ? "valueYes" : "valueNo");
  }
  const type = column.type ?? "";
  if (NUMBER_COLUMN_TYPES.has(type) && Number.isFinite(Number(value))) {
    return formatNumberValue(value, undefined, column.locale);
  }
  if (DATE_COLUMN_TYPES.has(type)) {
    return formatDateValue(value, { locale: column.locale });
  }
  return String(value);
}

const sideCounts = (
  preview: SyncPreview,
  side: "Target" | "Table",
  t: ConnectorT
): SyncPreviewCount[] => [
  { key: "create", label: t("toCreate"), count: preview[`createIn${side}`] },
  { key: "update", label: t("toUpdate"), count: preview[`updateIn${side}`] },
  { key: "delete", label: t("toDelete"), count: preview[`deleteIn${side}`] },
];

const previewNotes = (
  preview: SyncPreview,
  empty: boolean,
  t: ConnectorT
): string[] =>
  [
    empty ? t("nothingToChange") : null,
    preview.flagged > 0
      ? countLabel(t, preview.flagged, "flagged", "flaggedOne")
      : null,
    (preview.pendingConflicts ?? 0) > 0
      ? countLabel(
          t,
          preview.pendingConflicts ?? 0,
          "pendingNote",
          "pendingNoteOne"
        )
      : null,
    preview.unchanged > 0 ? t("unchanged", { count: preview.unchanged }) : null,
  ].filter((note): note is string => note !== null);

const RESOLUTION_KEYS: Partial<
  Record<SyncConflictResolution, ConnectorLabelKey>
> = {
  merged: "resolutionMerged",
  custom: "resolutionCustom",
  manual: "resolutionManual",
  skipped: "resolutionSkipped",
};

interface LineContext {
  t: ConnectorT;
  name: string;
  locale?: string;
  columns: readonly ConnectorColumn[];
}

const sideName = (side: "table" | "target", context: LineContext) =>
  side === "table" ? context.t("thisTable") : context.name;

/** "Owned by Spreadsheet", "This table wins", "Merged", "Needs your decision"… */
function outcomeLabel(
  conflict: SyncPreviewConflict,
  context: LineContext
): string {
  const { resolution } = conflict;
  if (resolution === "table" || resolution === "target") {
    const side = sideName(resolution, context);
    return conflict.source === "ownership"
      ? context.t("ownedBy", { side })
      : context.t("wins", { side });
  }
  return context.t(RESOLUTION_KEYS[resolution] ?? "resolutionManual");
}

function conflictLine(
  conflict: SyncPreviewConflict,
  index: number,
  context: LineContext
): SyncPreviewConflictLine {
  const column = context.columns.find((item) => item.id === conflict.columnId);
  const format = (value: unknown) =>
    formatSyncValue(value, context.t, {
      type: column?.type,
      locale: context.locale,
    });
  const { resolution } = conflict;
  const winner =
    resolution === "table" || resolution === "target" ? resolution : undefined;
  const hasResult =
    (resolution === "merged" || resolution === "custom") &&
    conflict.value !== undefined;
  return {
    id: `${conflict.rowId ?? index}:${conflict.columnId}`,
    title: `${conflict.rowLabel ?? conflict.rowId ?? ""} · ${column?.header ?? conflict.columnId}`,
    table: {
      label: context.t("thisTable"),
      value: format(conflict.tableValue),
    },
    target: { label: context.name, value: format(conflict.targetValue) },
    resolution,
    ...(winner ? { winner } : {}),
    wins: outcomeLabel(conflict, context),
    ...(hasResult
      ? {
          result: {
            label: context.t("resultValue"),
            value: format(conflict.value),
          },
        }
      : {}),
  };
}

/** A titled list of lines with "And N more", for conflicts and overrides. */
function lineGroup(
  lines: readonly SyncPreviewConflict[],
  total: number | undefined,
  keys: { title: ConnectorLabelKey; more: ConnectorLabelKey },
  context: LineContext
) {
  const count = Math.max(total ?? 0, lines.length);
  return {
    title: count > 0 ? context.t(keys.title, { count }) : null,
    lines: lines.map((line, index) => conflictLine(line, index, context)),
    more:
      count > lines.length
        ? context.t(keys.more, { count: count - lines.length })
        : null,
  };
}

/**
 * The preview grid, notes, the first conflicts and the columns their owner
 * writes back. `name` names the target ("Spreadsheet"); `columns` give lines
 * their column header and value format; `locale` formats numbers and dates.
 */
export function describeSyncPreview(
  preview: SyncPreview,
  {
    t,
    name,
    columns = [],
    locale,
  }: {
    t: ConnectorT;
    name: string;
    columns?: readonly ConnectorColumn[];
    locale?: string;
  }
): SyncPreviewView {
  const changes = SYNC_COUNT_KEYS.reduce(
    (total, key) => total + preview[key],
    0
  );
  const empty = changes === 0;
  const context: LineContext = { t, name, columns, locale };
  const conflicts = lineGroup(
    preview.conflicts,
    preview.conflictCount,
    { title: "conflicts", more: "moreConflicts" },
    context
  );
  const overridden = lineGroup(
    preview.overridden ?? [],
    preview.overriddenCount,
    { title: "overridden", more: "moreOverridden" },
    context
  );
  return {
    empty,
    sides: [
      {
        side: "target",
        title: t("inTarget", { target: name }),
        counts: sideCounts(preview, "Target", t),
      },
      {
        side: "table",
        title: t("inTable"),
        counts: sideCounts(preview, "Table", t),
      },
    ],
    notes: previewNotes(preview, empty, t),
    duplicates:
      preview.duplicates > 0
        ? countLabel(t, preview.duplicates, "duplicates", "duplicatesOne")
        : null,
    conflictsTitle: conflicts.title,
    conflicts: conflicts.lines,
    moreConflicts: conflicts.more,
    overriddenTitle: overridden.title,
    overridden: overridden.lines,
    moreOverridden: overridden.more,
  };
}

// Conflict rules and conflicts to resolve -----------------------------------------

/** One declared rule, e.g. "Price: Spreadsheet is the source of truth". */
export interface ConnectorRuleLine {
  columnId: string;
  kind: "owned" | ColumnConflictRule;
  text: string;
}

const COLUMN_RULE_KEYS: Record<ColumnConflictRule, ConnectorLabelKey> = {
  "table-wins": "ruleTableWins",
  "target-wins": "ruleTargetWins",
  "latest-wins": "ruleLatestWins",
  merge: "ruleMerge",
  manual: "ruleManual",
};

const isColumnRule = (rule: unknown): rule is ColumnConflictRule =>
  typeof rule === "string" && Object.hasOwn(COLUMN_RULE_KEYS, rule);

/**
 * The declared conflict rules as sentences, owned columns first, in column
 * order: "Price: Spreadsheet is the source of truth", "Tags: merged",
 * "Notes: decided by you". Outside two-way only ownership applies, so only
 * owned columns are listed; column rules on an owned column are left out.
 */
export function describeConflictRules(
  conflicts: ConnectorConflictRules | undefined,
  {
    t,
    name,
    columns = [],
    direction = "two-way",
  }: {
    t: ConnectorT;
    name: string;
    columns?: readonly ConnectorColumn[];
    direction?: SyncDirection;
  }
): ConnectorRuleLine[] {
  const ownership = conflicts?.ownership ?? {};
  const rules = direction === "two-way" ? (conflicts?.columnRules ?? {}) : {};
  const order = (id: string) => {
    const index = columns.findIndex((column) => column.id === id);
    return index < 0 ? columns.length : index;
  };
  const header = (id: string) =>
    columns.find((column) => column.id === id)?.header ?? id;
  const byColumn = (left: string, right: string) => order(left) - order(right);
  const owned = Object.keys(ownership)
    .filter((id) => ownership[id] === "table" || ownership[id] === "target")
    .sort(byColumn)
    .map((columnId) => ({
      columnId,
      kind: "owned" as const,
      text: t(
        ownership[columnId] === "table" ? "ruleOwnedTable" : "ruleOwnedTarget",
        { column: header(columnId), target: name }
      ),
    }));
  const perColumn = Object.keys(rules)
    .filter((id) => !Object.hasOwn(ownership, id) && isColumnRule(rules[id]))
    .sort(byColumn)
    .map((columnId) => {
      const kind = rules[columnId] as ColumnConflictRule;
      return {
        columnId,
        kind,
        text: t(COLUMN_RULE_KEYS[kind], {
          column: header(columnId),
          target: name,
        }),
      };
    });
  return [...owned, ...perColumn];
}

/** "Rules set by your app", with a lock when the app decides every conflict. */
export interface ConnectorConflictRulesView {
  title: string;
  locked: boolean;
  /** Why the conflict rule cannot be changed, when locked. */
  hint: string | null;
  rules: ConnectorRuleLine[];
}

/** The "Rules set by your app" block of a sync, or `null` without rules. */
export function connectorConflictRulesView(
  settings: Pick<ConnectorSettings, "direction"> | null,
  options: Pick<ConnectorScreenOptions, "connector" | "columns" | "name" | "t">
): ConnectorConflictRulesView | null {
  const conflicts = options.connector.conflicts;
  if (!(settings && isSyncDirection(settings.direction) && conflicts)) {
    return null;
  }
  const rules = describeConflictRules(conflicts, {
    t: options.t,
    name: connectorTargetName(options),
    columns: options.columns,
    direction: settings.direction,
  });
  const locked = conflicts.lock === true && settings.direction === "two-way";
  if (rules.length === 0 && !locked) {
    return null;
  }
  return {
    title: options.t("appRules"),
    locked,
    hint: locked ? options.t("appRulesLocked") : null,
    rules,
  };
}

/** A pending conflict as the list shows it, with its two choices. */
export interface PendingConflictLine {
  id: string;
  rowId: string;
  columnId: string;
  title: string;
  table: { label: string; value: string };
  target: { label: string; value: string };
  keepTable: string;
  keepTarget: string;
}

/** "Conflicts to resolve": the entry, the list and its bulk actions. */
export interface PendingConflictsView {
  /** "Conflicts to resolve (2)", or `null` when there are none. */
  entry: string | null;
  title: string;
  hint: string;
  empty: string;
  lines: PendingConflictLine[];
  keepAllTable: string;
  keepAllTarget: string;
  back: string;
  /** Shown while decisions are applied. */
  resolving: string;
}

/** Whether the screen offers the conflicts to resolve. */
export function canResolveConflicts(connector: {
  conflicts?: ConnectorConflictRules;
  listConflicts?: unknown;
  resolveConflicts?: unknown;
}): boolean {
  return (
    connector.conflicts?.allowManual !== false &&
    typeof connector.listConflicts === "function" &&
    typeof connector.resolveConflicts === "function"
  );
}

/**
 * The conflicts waiting for a person: each with its row, column, both
 * values formatted by column type and "Keep table value" / "Keep <target>
 * value"; bulk actions keep every value of one side.
 */
export function describePendingConflicts(
  conflicts: readonly PendingConflict[] | null,
  {
    t,
    name,
    columns = [],
    locale,
  }: {
    t: ConnectorT;
    name: string;
    columns?: readonly ConnectorColumn[];
    locale?: string;
  }
): PendingConflictsView {
  const list = conflicts ?? [];
  const context: LineContext = { t, name, columns, locale };
  const title = t("conflictsToResolve", { count: list.length });
  return {
    entry: list.length > 0 ? title : null,
    title,
    hint: t("conflictsHint"),
    empty: t("noConflicts"),
    lines: list.map((conflict, index) => {
      const line = conflictLine(
        { ...conflict, resolution: "manual" },
        index,
        context
      );
      return {
        id: line.id,
        rowId: conflict.rowId,
        columnId: conflict.columnId,
        title: line.title,
        table: line.table,
        target: line.target,
        keepTable: t("keepTable"),
        keepTarget: t("keepTarget", { target: name }),
      };
    }),
    keepAllTable: t("keepAllTable"),
    keepAllTarget: t("keepAllTarget", { target: name }),
    back: t("backToSettings"),
    resolving: t("resolvingConflicts"),
  };
}

const sideSummary = (
  applied: SyncRunCounts,
  side: "Target" | "Table",
  t: ConnectorT
): string[] =>
  [
    [applied[`createIn${side}`] ?? 0, "created", "createdOne"] as const,
    [applied[`updateIn${side}`] ?? 0, "updated", "updatedOne"] as const,
    [applied[`deleteIn${side}`] ?? 0, "deleted", "deletedOne"] as const,
  ]
    .filter(([count]) => count > 0)
    .map(([count, many, one]) => countLabel(t, count, many, one));

/**
 * "In Spreadsheet: 1 updated · In this table: 2 created, 2 updated", then the
 * first failures, flagged records, truncation and a stop reason.
 */
export function describeSyncResult(
  result: SyncRunResult,
  { t, name, help }: { t: ConnectorT; name: string; help?: ConnectorHelp }
): { summary: string; lines: string[] } {
  const target = sideSummary(result.applied, "Target", t);
  const table = sideSummary(result.applied, "Table", t);
  const parts = [
    target.length > 0
      ? `${t("inTarget", { target: name })}: ${target.join(", ")}`
      : null,
    table.length > 0 ? `${t("inTable")}: ${table.join(", ")}` : null,
    result.failed > 0
      ? countLabel(t, result.failed, "failed", "failedOne")
      : null,
  ].filter((part): part is string => part !== null);
  const details = describePushDetails(
    {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: result.failed,
      failures: result.failures.map((failure) => ({
        ...failure,
        rows: failure.rows ?? 1,
      })),
      warnings: [],
      warningCount: 0,
      truncated: result.truncated,
    },
    t,
    help
  );
  const stopped = result.stopped
    ? t("syncStopped", {
        message: connectorErrorMessage(result.stopped, undefined, t, help),
      })
    : null;
  return {
    summary: parts.length > 0 ? parts.join(" · ") : t("nothingChanged"),
    lines: [
      ...details.failures,
      ...(result.flagged > 0
        ? [countLabel(t, result.flagged, "flagged", "flaggedOne")]
        : []),
      ...(details.truncated ? [details.truncated] : []),
      ...(stopped ? [stopped] : []),
    ],
  };
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
  /** "form" edits the settings; "result" shows the last push or sync. */
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
  /** Inline message: a failed load, describe, validation, preview, push or sync. */
  error: string | null;
  result: ConnectorPushResult | null;
  /** The last preview of the current settings; any change clears it. */
  preview: SyncPreview | null;
  previewing: boolean;
  /** The person confirmed that records will be deleted ("propagate"). */
  confirmDeletes: boolean;
  syncResult: SyncRunResult | null;
  /** Conflicts waiting for a person (`listConflicts`), or `null` before they are listed. */
  conflicts: PendingConflict[] | null;
  /** The conflicts to resolve are shown instead of the settings. */
  conflictsOpen: boolean;
  /** A `resolveConflicts` call is running. */
  resolvingConflicts: boolean;
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
  /** `table.sync` (default true): false offers push only. */
  syncEnabled?: boolean;
  /** Direction to open with, e.g. "pull" from Data › Import. */
  direction?: SyncDirection;
  /** Called after a sync ran, e.g. to reload the table. */
  onSynced?: (result: SyncRunResult) => void;
}

type SettingsPatch = Partial<
  Pick<
    ConnectorSettings,
    | "mode"
    | "keyField"
    | "columns"
    | "direction"
    | "conflictRule"
    | "deletePolicy"
  >
>;

export interface ConnectorFlow {
  readonly state: ConnectorFlowState;
  start: () => Promise<void>;
  selectTarget: (targetId: string) => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
  resolveInput: (input: string) => Promise<void>;
  /** Push orientation: a column to a field (or `CONNECTOR_SKIP`). */
  setField: (columnId: string, value: string) => void;
  /** Pull and two-way orientation: a target field to a column (or `CONNECTOR_SKIP`). */
  setTargetField: (field: string, columnId: string) => void;
  update: (patch: SettingsPatch) => void;
  setScope: (scope: "view" | "selection") => void;
  setConfirmDeletes: (confirmed: boolean) => void;
  /** Asks the connector what a sync would do. */
  preview: () => Promise<void>;
  /** Push, or sync for pull and two-way. */
  send: () => Promise<void>;
  /** Back to the settings after a result. */
  edit: () => void;
  /** Lists the conflicts waiting for a person again. */
  loadConflicts: () => Promise<void>;
  /** Shows or hides the conflicts to resolve. */
  showConflicts: (open: boolean) => void;
  /** Applies decisions through `resolveConflicts`, then lists the conflicts again. */
  resolveConflicts: (resolutions: PendingConflictResolution[]) => Promise<void>;
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

/** A target field to a column: the column takes the field, whoever had it lets it go. */
const assignTargetField = (
  mapping: readonly ConnectorMappingEntry[],
  field: string,
  columnId: string | null
): ConnectorMappingEntry[] =>
  mapping.map((entry) => {
    if (entry.columnId === columnId) {
      return { columnId: entry.columnId, field };
    }
    return entry.field === field
      ? { columnId: entry.columnId, field: null }
      : entry;
  });

/**
 * Why "Sync now" is not available yet, or `null`: deleting records needs a
 * confirmation and, when the connector can preview, a preview.
 */
export function connectorSyncBlocker(
  state: Pick<ConnectorFlowState, "settings" | "preview" | "confirmDeletes">,
  connector: { preview?: unknown }
): "confirmDeletesFirst" | "previewFirst" | null {
  const settings = state.settings;
  if (
    !(settings && isSyncDirection(settings.direction)) ||
    settings.deletePolicy !== "propagate"
  ) {
    return null;
  }
  if (!state.confirmDeletes) {
    return "confirmDeletesFirst";
  }
  return typeof connector.preview === "function" && !state.preview
    ? "previewFirst"
    : null;
}

const INITIAL_STATE: Omit<ConnectorFlowState, "scope"> = {
  phase: "loading",
  targets: [],
  targetId: "",
  schema: null,
  schemaLoading: false,
  settings: null,
  resolving: false,
  error: null,
  result: null,
  preview: null,
  previewing: false,
  confirmDeletes: false,
  syncResult: null,
  conflicts: null,
  conflictsOpen: false,
  resolvingConflicts: false,
};

/**
 * The connector screen as a framework-neutral state machine: both editions
 * render `state` and call these actions, so they behave the same.
 */
export function createConnectorFlow<TContext, TPushContext>(
  options: ConnectorFlowOptions<TContext, TPushContext>
): ConnectorFlow {
  const { connector, context, columns, t } = options;
  const directions = connectorDirections(connector, options.syncEnabled);
  let state: ConnectorFlowState = {
    ...INITIAL_STATE,
    scope: options.selectedCount > 0 ? "selection" : "view",
  };
  let notify = options.onChange;
  let draft: Partial<ConnectorSettings> | null = null;
  let preset = options.direction;
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
      preview: null,
      syncResult: null,
      conflicts: null,
      conflictsOpen: false,
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
        directions,
        conflictRules: connector.conflictRules,
        preset,
      });
      preset = undefined;
      set({ schema, schemaLoading: false, settings });
      await loadConflicts();
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

  // Any change makes the last preview stale.
  const setSettings = (
    settings: ConnectorSettings,
    extra: Partial<ConnectorFlowState> = {}
  ) => set({ settings, error: null, preview: null, ...extra });

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

  const setTargetField = (field: string, value: string) => {
    if (!state.settings) {
      return;
    }
    const columnId = value === CONNECTOR_SKIP ? null : value;
    setSettings({
      ...state.settings,
      mapping: assignTargetField(state.settings.mapping, field, columnId),
    });
  };

  const update = (requested: SettingsPatch) => {
    if (!state.settings) {
      return;
    }
    // A locked conflict rule is the app's: it is shown, never changed.
    const { conflictRule, ...rest } = requested;
    const patch: SettingsPatch =
      connector.conflicts?.lock || conflictRule === undefined
        ? rest
        : { ...rest, conflictRule };
    const policyChanged =
      patch.deletePolicy !== undefined &&
      patch.deletePolicy !== state.settings.deletePolicy;
    setSettings(
      { ...state.settings, ...patch },
      policyChanged ? { confirmDeletes: false } : {}
    );
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
      directions,
      conflictRules: connector.conflictRules,
    });
    return issue
      ? connectorIssueMessage(
          issue,
          t,
          connector.labels?.child ?? t("child"),
          settings.direction
        )
      : null;
  };

  /** The settings to send, or `null` after showing why they cannot be sent. */
  const checkedSettings = (): ConnectorSettings | null => {
    const { schema } = state;
    if (!(state.settings && schema)) {
      return null;
    }
    const settings = connectorSettingsToSend(state.settings, columns, schema);
    const invalid = validationError(settings, schema);
    if (invalid) {
      set({ error: invalid });
      return null;
    }
    return settings;
  };

  const saveSettings = (settings: ConnectorSettings) =>
    Promise.resolve()
      .then(() => connector.save?.(settings, context))
      .then(
        () => null,
        (error: unknown) => failureText(error)
      );

  const contextFor = (settings: ConnectorSettings) =>
    options.pushContext(
      isSyncDirection(settings.direction) ? "view" : state.scope,
      sentColumns(columns, settings)
    );

  /** The current settings as sent, without validating them. */
  const currentSettings = (): ConnectorSettings | null => {
    const { schema, settings } = state;
    return schema && settings
      ? connectorSettingsToSend(settings, columns, schema)
      : null;
  };

  const viewContext = (settings: ConnectorSettings) =>
    options.pushContext("view", sentColumns(columns, settings));

  const targetKey = () => `${state.targetId}/${state.childId ?? ""}`;

  const loadConflicts = async () => {
    const settings = currentSettings();
    if (
      !(settings && connector.listConflicts && canResolveConflicts(connector))
    ) {
      return;
    }
    const target = targetKey();
    try {
      const outcome = await connector.listConflicts(
        settings,
        viewContext(settings)
      );
      if (isConnectorOutcomeError(outcome)) {
        throw outcome;
      }
      if (target === targetKey()) {
        set({ conflicts: outcome });
      }
    } catch (error) {
      if (target === targetKey()) {
        set({ conflicts: [], error: failureText(error) });
      }
    }
  };

  const resolveConflicts = async (resolutions: PendingConflictResolution[]) => {
    const settings = currentSettings();
    if (
      !(settings && connector.resolveConflicts) ||
      resolutions.length === 0 ||
      state.resolvingConflicts
    ) {
      return;
    }
    set({ resolvingConflicts: true, error: null });
    try {
      const outcome = await connector.resolveConflicts(
        resolutions,
        settings,
        viewContext(settings)
      );
      if (isConnectorOutcomeError(outcome)) {
        throw outcome;
      }
      // Both sides changed: the last preview is stale.
      set({ resolvingConflicts: false, preview: null });
      options.onSynced?.(outcome);
      await loadConflicts();
    } catch (error) {
      set({ resolvingConflicts: false, error: failureText(error) });
    }
  };

  // Settings are remembered on every send, whatever the push returns.
  const push = async (settings: ConnectorSettings) => {
    const saving = saveSettings(settings);
    const outcome = await connector.push(settings, contextFor(settings));
    const saveError = await saving;
    if (isPushFailure(outcome)) {
      throw outcome;
    }
    set({ phase: "result", result: outcome, error: saveError });
  };

  const sync = async (settings: ConnectorSettings) => {
    if (!connector.sync) {
      set({ phase: "form" });
      return;
    }
    const saving = saveSettings(settings);
    const outcome = await connector.sync(settings, contextFor(settings));
    const saveError = await saving;
    if (isConnectorOutcomeError(outcome)) {
      throw outcome;
    }
    set({
      phase: "result",
      syncResult: outcome,
      preview: null,
      confirmDeletes: false,
      error: saveError,
    });
    options.onSynced?.(outcome);
    await loadConflicts();
  };

  const send = async () => {
    if (state.phase === "sending" || state.previewing) {
      return;
    }
    const settings = checkedSettings();
    if (!settings) {
      return;
    }
    const blocker = connectorSyncBlocker(state, connector);
    if (blocker) {
      set({ error: t(blocker) });
      return;
    }
    set({ phase: "sending", error: null });
    try {
      await (isSyncDirection(settings.direction)
        ? sync(settings)
        : push(settings));
      draft = state.settings;
    } catch (error) {
      set({ phase: "form", error: failureText(error) });
    }
  };

  const preview = async () => {
    if (!connector.preview || state.previewing || state.phase === "sending") {
      return;
    }
    const settings = checkedSettings();
    if (!(settings && isSyncDirection(settings.direction))) {
      return;
    }
    const current = state.settings;
    set({ previewing: true, preview: null, error: null });
    try {
      const outcome = await connector.preview(settings, contextFor(settings));
      if (isConnectorOutcomeError(outcome)) {
        throw outcome;
      }
      // A choice made while comparing makes this preview stale.
      set({
        previewing: false,
        preview: state.settings === current ? outcome : null,
      });
    } catch (error) {
      set({ previewing: false, error: failureText(error) });
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
    setTargetField,
    update,
    setScope,
    setConfirmDeletes: (confirmed) =>
      set({ confirmDeletes: confirmed, error: null }),
    preview,
    send,
    edit: () =>
      set({ phase: "form", result: null, syncResult: null, error: null }),
    loadConflicts,
    showConflicts: (open) => set({ conflictsOpen: open, error: null }),
    resolveConflicts,
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
  /**
   * "target", "child", "direction", "columns", "map:<columnId>" (push),
   * "field:<name>" (pull and two-way), "keyField", "mode", "scope",
   * "conflictRule" or "deletePolicy".
   */
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  heading?: string;
  inline?: boolean;
  /** Pull and two-way rows: the field's first value and a conversion badge. */
  sample?: string;
  badge?: { label: string; invalid: boolean };
  /** Shown but not changeable (a conflict rule the app locked). */
  disabled?: boolean;
}

const MAP_PREFIX = "map:";
const FIELD_PREFIX = "field:";

export interface ConnectorScreenOptions {
  connector: Pick<
    DataDestinationConnector,
    "labels" | "modes" | "directions" | "conflictRules" | "conflicts"
  > & { sync?: unknown };
  columns: readonly ConnectorViewColumn[];
  selectedCount: number;
  t: ConnectorT;
  /** `table.sync` (default true). */
  syncEnabled?: boolean;
  /** The destination's name, e.g. "Spreadsheet", used in "Send to …". */
  name?: string;
  /** Locale used to check sample values; default English. */
  locale?: string;
}

/** The destination's name for "Send to …" and "In …". */
export function connectorTargetName(
  options: Pick<ConnectorScreenOptions, "connector" | "name" | "t">
): string {
  return (
    options.name ?? options.connector.labels?.target ?? options.t("target")
  );
}

const targetFields = (
  state: ConnectorFlowState,
  { connector, t }: ConnectorScreenOptions
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

const DIRECTION_KEYS: Record<SyncDirection, ConnectorLabelKey> = {
  push: "directionPush",
  pull: "directionPull",
  "two-way": "directionTwoWay",
};

const SHORT_DIRECTION_KEYS: Record<SyncDirection, ConnectorLabelKey> = {
  push: "directionPushShort",
  pull: "directionPullShort",
  "two-way": "directionTwoWayShort",
};

/** "Send to Spreadsheet", "Import from Spreadsheet", "Keep both in sync". */
export function connectorDirectionLabel(
  direction: SyncDirection,
  t: ConnectorT,
  name: string
): string {
  return t(DIRECTION_KEYS[direction], { target: name });
}

const directionFields = (
  settings: ConnectorSettings,
  options: ConnectorScreenOptions
): ConnectorScreenField[] => {
  const directions = connectorDirections(
    options.connector,
    options.syncEnabled
  );
  if (directions.length < 2) {
    return [];
  }
  const name = connectorTargetName(options);
  return [
    {
      id: "direction",
      label: options.t("direction"),
      value: settings.direction ?? "push",
      options: directions.map((direction) => ({
        value: direction,
        label: connectorDirectionLabel(direction, options.t, name),
      })),
    },
  ];
};

const columnsField = (
  settings: ConnectorSettings,
  { columns, t }: ConnectorScreenOptions
): ConnectorScreenField => ({
  id: "columns",
  label: t("columns"),
  value: settings.columns === "all" ? "all" : "visible",
  options: [
    {
      value: "visible",
      label: t("columnsVisible", {
        count: columns.filter((column) => column.visible).length,
      }),
    },
    { value: "all", label: t("columnsAll", { count: columns.length }) },
  ],
});

const pushMappingRows = (
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  { columns, t }: ConnectorScreenOptions
): ConnectorScreenField[] =>
  connectorMappedColumns(columns, settings.columns).map((column, index) => {
    const field =
      settings.mapping.find((entry) => entry.columnId === column.id)?.field ??
      null;
    return {
      id: `${MAP_PREFIX}${column.id}`,
      heading: index === 0 ? t("mapping") : undefined,
      label: column.header,
      inline: true,
      value: field ?? CONNECTOR_SKIP,
      options: connectorFieldOptions(column, schema, field, t),
    };
  });

/** Fields a pull or two-way sync maps: the target's, plus new ones a two-way sync adds. */
const syncFieldNames = (
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  mapped: ReadonlySet<string>
): string[] => {
  const names = schema.fields.map((field) => field.name);
  if (settings.direction === "two-way" && schema.allowNewFields) {
    for (const entry of settings.mapping) {
      if (
        entry.field &&
        mapped.has(entry.columnId) &&
        !names.includes(entry.field)
      ) {
        names.push(entry.field);
      }
    }
  }
  return names.filter(
    (name) =>
      normalizeConnectorName(name) !== normalizeConnectorName(settings.keyField)
  );
};

/** The first sample value and how many samples the column cannot take. */
const sampleDetails = (
  field: ConnectorField | undefined,
  column: ConnectorColumn | undefined,
  { t, locale }: ConnectorScreenOptions
): Pick<ConnectorScreenField, "sample" | "badge"> => {
  const values = (field?.sample ?? [])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => (Array.isArray(value) ? value.join(", ") : String(value)));
  if (values.length === 0) {
    return {};
  }
  const invalid = column
    ? values.filter(
        (value) =>
          "error" in
          coerceImportValue(
            value,
            {
              id: column.id,
              header: column.header,
              type: column.type,
              allowNewOptions: true,
            },
            { locale: locale ?? "en" }
          )
      ).length
    : 0;
  return {
    sample: t("sample", { value: values[0] ?? "" }),
    ...(invalid > 0
      ? {
          badge: {
            label: countLabel(t, invalid, "invalidCount", "invalidOne"),
            invalid: true,
          },
        }
      : {}),
  };
};

const syncMappingRows = (
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  options: ConnectorScreenOptions
): ConnectorScreenField[] => {
  const { t } = options;
  const mappedColumns = connectorMappedColumns(
    options.columns,
    settings.columns
  );
  const mapped = new Set(mappedColumns.map((column) => column.id));
  const choices = [
    ...mappedColumns.map((column) => ({
      value: column.id,
      label: column.header,
    })),
    {
      value: CONNECTOR_SKIP,
      label: t(settings.direction === "pull" ? "dontImport" : "dontSync"),
    },
  ];
  const known = new Set(schema.fields.map((field) => field.name));
  return syncFieldNames(schema, settings, mapped).map((name, index) => {
    const columnId = settings.mapping.find(
      (entry) => entry.field === name && mapped.has(entry.columnId)
    )?.columnId;
    return {
      id: `${FIELD_PREFIX}${name}`,
      heading:
        index === 0
          ? t(settings.direction === "pull" ? "mappingPull" : "mappingTwoWay")
          : undefined,
      label: known.has(name) ? name : t("newField", { name }),
      inline: true,
      value: columnId ?? CONNECTOR_SKIP,
      options: choices,
      ...sampleDetails(
        schema.fields.find((field) => field.name === name),
        mappedColumns.find((column) => column.id === columnId),
        options
      ),
    };
  });
};

const CONFLICT_KEYS: Record<ConflictRule, ConnectorLabelKey> = {
  "table-wins": "conflictTableWins",
  "target-wins": "conflictTargetWins",
  "latest-wins": "conflictLatestWins",
};

const DELETE_KEYS: Record<DeletePolicy, ConnectorLabelKey> = {
  flag: "deleteFlag",
  ignore: "deleteIgnore",
  propagate: "deletePropagate",
};

const ruleFields = (
  settings: ConnectorSettings,
  options: ConnectorScreenOptions
): ConnectorScreenField[] => {
  const { t } = options;
  const shown = connectorSyncFields(settings.direction);
  const target = connectorTargetName(options);
  const fields: ConnectorScreenField[] = [];
  if (shown.conflictRule) {
    fields.push({
      id: "conflictRule",
      label: t("conflictRule"),
      value: settings.conflictRule ?? DEFAULT_CONFLICT_RULE,
      options: connectorConflictRules(options.connector.conflictRules).map(
        (rule) => ({ value: rule, label: t(CONFLICT_KEYS[rule], { target }) })
      ),
      // The app decides conflicts: the rule is shown, not chosen.
      ...(options.connector.conflicts?.lock ? { disabled: true } : {}),
    });
  }
  if (shown.deletePolicy) {
    fields.push({
      id: "deletePolicy",
      label: t("deletePolicy"),
      value: settings.deletePolicy ?? DEFAULT_DELETE_POLICY,
      options: DELETE_POLICIES.map((policy) => ({
        value: policy,
        label: t(DELETE_KEYS[policy]),
      })),
    });
  }
  return fields;
};

const sendingFields = (
  state: ConnectorFlowState,
  schema: ConnectorSchema,
  settings: ConnectorSettings,
  options: ConnectorScreenOptions
): ConnectorScreenField[] => {
  const { connector, selectedCount, t } = options;
  const keys = connectorKeyFields(schema);
  const shown = connectorSyncFields(settings.direction);
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
  if (shown.mode && modes.length > 1) {
    fields.push({
      id: "mode",
      label: t("mode"),
      value: settings.mode,
      options: modes.map((mode) => ({ value: mode, label: t(mode) })),
    });
  }
  if (shown.scope) {
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
  }
  return [...fields, ...ruleFields(settings, options)];
};

/**
 * The screen's selects in order: target and child, then, once the target is
 * described, direction, columns, one mapping row per column (push) or per
 * target field (pull and two-way), key field, mode and records (push), the
 * conflict rule (two-way) and the delete policy (pull and two-way).
 */
export function connectorScreenFields(
  state: ConnectorFlowState,
  options: ConnectorScreenOptions
): ConnectorScreenField[] {
  const { schema, settings } = state;
  const fields = targetFields(state, options);
  if (schema && settings) {
    fields.push(
      ...directionFields(settings, options),
      columnsField(settings, options),
      ...(isSyncDirection(settings.direction)
        ? syncMappingRows(schema, settings, options)
        : pushMappingRows(schema, settings, options)),
      ...sendingFields(state, schema, settings, options)
    );
  }
  return fields;
}

const HINT_KEYS: Record<ConflictRule | DeletePolicy, ConnectorLabelKey> = {
  "table-wins": "conflictTableWinsHint",
  "target-wins": "conflictTargetWinsHint",
  "latest-wins": "conflictLatestWinsHint",
  flag: "deleteFlagHint",
  ignore: "deleteIgnoreHint",
  propagate: "deletePropagateHint",
};

/** One-line explanations shown under the conflict rule and the delete policy. */
export function connectorRuleHints(
  settings: ConnectorSettings | null,
  options: Pick<ConnectorScreenOptions, "connector" | "name" | "t">
): { conflictRule?: string; deletePolicy?: string } {
  if (!settings) {
    return {};
  }
  const shown = connectorSyncFields(settings.direction);
  const target = connectorTargetName(options);
  return {
    ...(shown.conflictRule
      ? {
          conflictRule: options.t(
            HINT_KEYS[settings.conflictRule ?? DEFAULT_CONFLICT_RULE],
            { target }
          ),
        }
      : {}),
    ...(shown.deletePolicy
      ? {
          deletePolicy: options.t(
            HINT_KEYS[settings.deletePolicy ?? DEFAULT_DELETE_POLICY]
          ),
        }
      : {}),
  };
}

/** "Every day at 09:00 · Keep in sync": the direction a schedule runs, when there is a choice. */
export function connectorScheduleSuffix(
  settings: Pick<ConnectorSettings, "direction"> | null | undefined,
  options: {
    connector: Pick<DataDestinationConnector, "directions"> & {
      sync?: unknown;
    };
    t: ConnectorT;
    syncEnabled?: boolean;
  }
): string | null {
  const directions = connectorDirections(
    options.connector,
    options.syncEnabled
  );
  if (directions.length < 2) {
    return null;
  }
  const direction = directions.includes(settings?.direction ?? "push")
    ? (settings?.direction ?? "push")
    : (directions[0] ?? "push");
  return options.t(SHORT_DIRECTION_KEYS[direction]);
}

/** Whether Data › Import lists the connector as a source ("From Notion"). */
export function isConnectorImportSource(
  connector: Pick<DataDestinationConnector, "directions"> & {
    sync?: unknown;
  },
  syncEnabled = true
): boolean {
  return connectorDirections(connector, syncEnabled).includes("pull");
}

const pickValue = <T extends string>(
  list: readonly T[],
  value: string,
  fallback: T
): T => list.find((item) => item === value) ?? fallback;

const applySettingsField = (
  flow: ConnectorFlow,
  id: string,
  value: string
): boolean => {
  switch (id) {
    case "columns":
      flow.update({ columns: value === "all" ? "all" : "visible" });
      return true;
    case "keyField":
      flow.update({ keyField: value });
      return true;
    case "mode":
      flow.update({ mode: value === "replace" ? "replace" : "upsert" });
      return true;
    case "direction":
      flow.update({ direction: pickValue(SYNC_DIRECTIONS, value, "push") });
      return true;
    case "conflictRule":
      flow.update({
        conflictRule: pickValue(CONFLICT_RULES, value, DEFAULT_CONFLICT_RULE),
      });
      return true;
    case "deletePolicy":
      flow.update({
        deletePolicy: pickValue(DELETE_POLICIES, value, DEFAULT_DELETE_POLICY),
      });
      return true;
    default:
      return false;
  }
};

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
  if (id.startsWith(FIELD_PREFIX)) {
    flow.setTargetField(id.slice(FIELD_PREFIX.length), value);
    return Promise.resolve();
  }
  if (id === "target") {
    return value === CONNECTOR_NO_TARGET
      ? Promise.resolve()
      : flow.selectTarget(value);
  }
  if (id === "child") {
    return flow.selectChild(value);
  }
  if (!applySettingsField(flow, id, value)) {
    flow.setScope(value === "selection" ? "selection" : "view");
  }
  return Promise.resolve();
}

const TARGET_FIELD_IDS = new Set(["target", "child", "direction", "columns"]);

const isMappingRow = (field: ConnectorScreenField) =>
  field.id.startsWith(MAP_PREFIX) || field.id.startsWith(FIELD_PREFIX);

/**
 * The screen fields as the column-mapping component takes them: target
 * settings before the rows, the mapping rows, the key field, then mode,
 * records and the sync rules.
 */
export function connectorMappingSections(
  fields: readonly ConnectorScreenField[]
): {
  before: ConnectorScreenField[];
  rows: ColumnMappingRow[];
  keyField: ConnectorScreenField | undefined;
  after: ConnectorScreenField[];
} {
  return {
    before: fields.filter((field) => TARGET_FIELD_IDS.has(field.id)),
    rows: fields
      .filter(isMappingRow)
      .map(({ id, label, value, options, heading, sample, badge }) => ({
        id,
        label,
        value,
        options,
        ...(heading ? { heading } : {}),
        ...(sample ? { sample } : {}),
        ...(badge ? { badge } : {}),
      })),
    keyField: fields.find((field) => field.id === "keyField"),
    after: fields.filter(
      (field) =>
        !(
          TARGET_FIELD_IDS.has(field.id) ||
          isMappingRow(field) ||
          field.id === "keyField"
        )
    ),
  };
}
