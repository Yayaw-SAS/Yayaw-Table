/**
 * The Data › Import screen as a framework-neutral state machine, with its
 * labels and screen fields: source, column mapping, review, progress and
 * result. The React and Vue editions render `state` and call these actions.
 */
import type { ColumnMappingRow } from "./field-matching";
import { fieldTypeFamily } from "./field-matching";
import {
  CSV_DELIMITERS,
  type CsvDelimiter,
  coerceImportValue,
  decodeCsvFile,
  defaultImportKey,
  defaultImportMapping,
  detectDateOrder,
  IMPORT_IGNORE,
  type ImportAdapters,
  type ImportBatch,
  type ImportBatchResult,
  type ImportColumn,
  type ImportErrorCode,
  type ImportField,
  type ImportMapping,
  type ImportPlan,
  type ImportRunResult,
  importFields,
  isImportAuthError,
  parseCsv,
  planImport,
  runImport,
  summarizeImport,
} from "./import-model";
import {
  addressesToGeocode,
  type GeocodeAction,
  geocodeAddresses,
  type LocationValue,
} from "./location-model";
import { fieldText } from "./table-contracts";
import type { NumberFormatConfig } from "./value-format";

type MaybePromise<T> = T | Promise<T>;

// Contract ---------------------------------------------------------------------

/** Rows a host source returns: a table of strings, or CSV text. */
export type ImportSourceData =
  | { name?: string; headers: string[]; rows: string[][] }
  | { name?: string; text: string };

/** A source offered next to "CSV file", such as a Notion database or a sheet. */
export interface ImportSource<TContext = unknown> {
  id: string;
  label: string;
  description?: string;
  load: (context: TContext) => MaybePromise<ImportSourceData>;
}

/** What a host declares under `actions.import`; everything is optional. */
export interface TableImportActions<TContext = unknown> {
  /** Offer CSV files and pasted text (default true). */
  csv?: boolean;
  /** Sources the host adds after CSV. */
  sources?: ImportSource<TContext>[];
  /** Server-side bulk write, preferred over `create` and `update` row by row. */
  importRows?: (
    batch: ImportBatch,
    context: TContext
  ) => MaybePromise<ImportBatchResult>;
  /** Record ids by key value; default: the table loads its rows through `list`. */
  lookup?: (request: {
    columnId: string;
    keys: string[];
  }) => MaybePromise<Record<string, string>>;
  /** Keep unknown select choices instead of reporting them. */
  allowNewOptions?: boolean;
  /** Rows per write (default 50). */
  batchSize?: number;
}

// Labels -----------------------------------------------------------------------

export type ImportLabelKey =
  | "title"
  | "source"
  | "sourceCsv"
  | "sourceCsvHint"
  | "chooseFile"
  | "dropHint"
  | "pasteLabel"
  | "usePasted"
  | "reading"
  | "mapping"
  | "ignore"
  | "delimiter"
  | "delimiterAuto"
  | "delimiterComma"
  | "delimiterSemicolon"
  | "delimiterTab"
  | "delimiterPipe"
  | "headers"
  | "keyColumn"
  | "keyNone"
  | "keyHint"
  | "sample"
  | "noSample"
  | "invalidCount"
  | "invalidOne"
  | "preview"
  | "previewCaption"
  | "rowsFound"
  | "rowsFoundOne"
  | "review"
  | "back"
  | "cancel"
  | "creates"
  | "createsOne"
  | "updates"
  | "updatesOne"
  | "errorRows"
  | "errorRowsOne"
  | "skipErrors"
  | "errorsBlock"
  | "nothingToImport"
  | "import"
  | "importing"
  | "stop"
  | "done"
  | "another"
  | "created"
  | "createdOne"
  | "updated"
  | "updatedOne"
  | "failed"
  | "failedOne"
  | "nothingImported"
  | "stopped"
  | "rowError"
  | "failureRow"
  | "fileError"
  | "emptyFile"
  | "sourceError"
  | "authError"
  | "yes"
  | "no"
  | "type_text"
  | "type_number"
  | "type_date"
  | "type_boolean"
  | "type_select"
  | "type_multi"
  | "type_url"
  | "type_email"
  | "type_json"
  | "type_location"
  | "error_required"
  | "error_invalid_number"
  | "error_invalid_date"
  | "error_invalid_boolean"
  | "error_unknown_option"
  | "error_invalid_url"
  | "error_invalid_email"
  | "error_invalid_json"
  | "error_invalid_location"
  | "error_duplicate_key"
  | "error_unknown";

const ENGLISH_LABELS: Record<ImportLabelKey, string> = {
  title: "Import",
  source: "Import from",
  sourceCsv: "CSV file",
  sourceCsvHint: "Comma, semicolon or tab separated",
  chooseFile: "Choose a file",
  dropHint: "Drop a CSV file here",
  pasteLabel: "Or paste CSV text",
  usePasted: "Use text",
  reading: "Reading…",
  mapping: "Columns",
  ignore: "Ignore",
  delimiter: "Separator",
  delimiterAuto: "Detected: {delimiter}",
  delimiterComma: "Comma",
  delimiterSemicolon: "Semicolon",
  delimiterTab: "Tab",
  delimiterPipe: "Vertical bar",
  headers: "First row is headers",
  keyColumn: "Match existing records by",
  keyNone: "Don’t match (create all)",
  keyHint: "Rows with the same value update that record; the others are added.",
  sample: "e.g. {value}",
  noSample: "No values",
  invalidCount: "{count} won’t convert",
  invalidOne: "1 won’t convert",
  preview: "Preview",
  previewCaption: "First rows as the table will show them",
  rowsFound: "{count} rows",
  rowsFoundOne: "1 row",
  review: "Review",
  back: "Back",
  cancel: "Cancel",
  creates: "{count} to add",
  createsOne: "1 to add",
  updates: "{count} to update",
  updatesOne: "1 to update",
  errorRows: "{count} rows with errors",
  errorRowsOne: "1 row with errors",
  skipErrors: "Skip rows with errors",
  errorsBlock:
    "Fix the file, or skip the rows with errors to import the others.",
  nothingToImport: "Nothing to import.",
  import: "Import",
  importing: "Importing… {done}/{total}",
  stop: "Stop",
  done: "Done",
  another: "Import another file",
  created: "{count} added",
  createdOne: "1 added",
  updated: "{count} updated",
  updatedOne: "1 updated",
  failed: "{count} failed",
  failedOne: "1 failed",
  nothingImported: "Nothing imported",
  stopped: "Import stopped before the end.",
  rowError: "Row {row}, {column}: {message}",
  failureRow: "Row {row}: {message}",
  fileError: "This file could not be read.",
  emptyFile: "No rows found in this file.",
  sourceError: "The source could not be read.",
  authError: "You are not allowed to import into this table.",
  yes: "Yes",
  no: "No",
  type_text: "Text",
  type_number: "Number",
  type_date: "Date",
  type_boolean: "Checkbox",
  type_select: "Option",
  type_multi: "Options",
  type_url: "Link",
  type_email: "Email",
  type_json: "JSON",
  type_location: "Place (lat, lng or address)",
  error_required: "a value is required",
  error_invalid_number: "not a number",
  error_invalid_date: "not a date",
  error_invalid_boolean: "not yes or no",
  error_unknown_option: "not one of the options",
  error_invalid_url: "not a link",
  error_invalid_email: "not an email address",
  error_invalid_json: "not valid JSON",
  error_invalid_location: "not a place (lat, lng) or an address found",
  error_duplicate_key: "already in an earlier row",
  error_unknown: "could not be saved",
};

const FRENCH_LABELS: Record<ImportLabelKey, string> = {
  title: "Importer",
  source: "Importer depuis",
  sourceCsv: "Fichier CSV",
  sourceCsvHint: "Séparé par des virgules, points-virgules ou tabulations",
  chooseFile: "Choisir un fichier",
  dropHint: "Déposez un fichier CSV ici",
  pasteLabel: "Ou collez du texte CSV",
  usePasted: "Utiliser le texte",
  reading: "Lecture…",
  mapping: "Colonnes",
  ignore: "Ignorer",
  delimiter: "Séparateur",
  delimiterAuto: "Détecté : {delimiter}",
  delimiterComma: "Virgule",
  delimiterSemicolon: "Point-virgule",
  delimiterTab: "Tabulation",
  delimiterPipe: "Barre verticale",
  headers: "La première ligne contient les en-têtes",
  keyColumn: "Associer aux fiches existantes par",
  keyNone: "Ne pas associer (tout ajouter)",
  keyHint:
    "Les lignes ayant la même valeur mettent la fiche à jour ; les autres sont ajoutées.",
  sample: "ex. {value}",
  noSample: "Aucune valeur",
  invalidCount: "{count} non convertibles",
  invalidOne: "1 non convertible",
  preview: "Aperçu",
  previewCaption: "Premières lignes telles que le tableau les affichera",
  rowsFound: "{count} lignes",
  rowsFoundOne: "1 ligne",
  review: "Vérifier",
  back: "Retour",
  cancel: "Annuler",
  creates: "{count} à ajouter",
  createsOne: "1 à ajouter",
  updates: "{count} à mettre à jour",
  updatesOne: "1 à mettre à jour",
  errorRows: "{count} lignes en erreur",
  errorRowsOne: "1 ligne en erreur",
  skipErrors: "Ignorer les lignes en erreur",
  errorsBlock:
    "Corrigez le fichier, ou ignorez les lignes en erreur pour importer les autres.",
  nothingToImport: "Rien à importer.",
  import: "Importer",
  importing: "Import… {done}/{total}",
  stop: "Arrêter",
  done: "Terminé",
  another: "Importer un autre fichier",
  created: "{count} ajoutées",
  createdOne: "1 ajoutée",
  updated: "{count} mises à jour",
  updatedOne: "1 mise à jour",
  failed: "{count} en échec",
  failedOne: "1 en échec",
  nothingImported: "Rien n’a été importé",
  stopped: "L’import s’est arrêté avant la fin.",
  rowError: "Ligne {row}, {column} : {message}",
  failureRow: "Ligne {row} : {message}",
  fileError: "Ce fichier n’a pas pu être lu.",
  emptyFile: "Aucune ligne dans ce fichier.",
  sourceError: "La source n’a pas pu être lue.",
  authError: "Vous n’êtes pas autorisé à importer dans ce tableau.",
  yes: "Oui",
  no: "Non",
  type_text: "Texte",
  type_number: "Nombre",
  type_date: "Date",
  type_boolean: "Case à cocher",
  type_select: "Option",
  type_multi: "Options",
  type_url: "Lien",
  type_email: "E-mail",
  type_json: "JSON",
  type_location: "Lieu (lat, lng ou adresse)",
  error_required: "une valeur est requise",
  error_invalid_number: "n’est pas un nombre",
  error_invalid_date: "n’est pas une date",
  error_invalid_boolean: "n’est ni oui ni non",
  error_unknown_option: "ne fait pas partie des options",
  error_invalid_url: "n’est pas un lien",
  error_invalid_email: "n’est pas une adresse e-mail",
  error_invalid_json: "n’est pas du JSON valide",
  error_invalid_location: "n’est ni un lieu (lat, lng) ni une adresse trouvée",
  error_duplicate_key: "figure déjà dans une ligne précédente",
  error_unknown: "n’a pas pu être enregistrée",
};

/** Host override for a label (`import.<key>`), or the built-in one. */
export type ImportTranslate = (key: ImportLabelKey, fallback: string) => string;

/** A label with its `{name}` parameters filled in. */
export type ImportT = (
  key: ImportLabelKey,
  params?: Record<string, string | number>
) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function importLabels(
  locale: string,
  translate?: ImportTranslate
): ImportT {
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

const countLabel = (
  t: ImportT,
  count: number,
  many: ImportLabelKey,
  one: ImportLabelKey
): string => t(count === 1 ? one : many, { count });

/** "not a number" for an error code. */
export function importErrorMessage(code: ImportErrorCode, t: ImportT): string {
  return t(`error_${code}` as ImportLabelKey);
}

// Flow -------------------------------------------------------------------------

export type ImportStep = "source" | "mapping" | "review" | "running" | "result";

/** Built-in source id of CSV files and pasted text. */
export const IMPORT_CSV_SOURCE = "csv";
/** Key select value for "don't match". */
export const IMPORT_NO_KEY = "__yayaw_no_key__";
/** Separator select value for "detected". */
export const IMPORT_AUTO_DELIMITER = "auto";

export interface ImportFlowState {
  step: ImportStep;
  sourceId: string | null;
  sourceName: string | null;
  /** CSV text, re-read when the separator or header option changes. */
  text: string | null;
  /** `null`: detected. */
  delimiter: CsvDelimiter | null;
  detectedDelimiter: CsvDelimiter;
  hasHeaders: boolean;
  headers: string[];
  rows: string[][];
  fields: ImportField[];
  mapping: ImportMapping;
  keyColumnId: string | null;
  plan: ImportPlan | null;
  skipErrors: boolean;
  progress: { done: number; total: number } | null;
  result: ImportRunResult | null;
  loading: boolean;
  error: string | null;
}

export interface ImportFlowOptions {
  columns: readonly ImportColumn[];
  locale: string;
  t: ImportT;
  adapters: ImportAdapters;
  /** Record ids by key value for the chosen key column. */
  findExisting: (
    columnId: string,
    keys: string[]
  ) => Promise<(key: string) => string | undefined>;
  loadSource?: (source: string) => Promise<ImportSourceData>;
  batchSize?: number;
  allowNewOptions?: boolean;
  /** The host's `actions.geocode`: addresses in location columns become places. */
  geocode?: GeocodeAction;
  onChange: (state: ImportFlowState) => void;
  /** After rows were written, to refresh the table. */
  onImported?: (result: ImportRunResult) => void;
}

export interface ImportFlow {
  readonly state: ImportFlowState;
  loadText: (text: string, name?: string) => void;
  loadFile: (file: {
    name: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }) => Promise<void>;
  loadSource: (sourceId: string) => Promise<void>;
  setDelimiter: (value: string) => void;
  setHasHeaders: (value: boolean) => void;
  setField: (field: string, columnId: string) => void;
  setKey: (columnId: string) => void;
  review: () => Promise<void>;
  setSkipErrors: (value: boolean) => void;
  run: () => Promise<void>;
  /** Stops a running import between batches. */
  stop: () => void;
  /** Back one step. */
  back: () => void;
  /** Start over with another file. */
  reset: () => void;
  dispose: () => void;
}

const initialState = (): ImportFlowState => ({
  step: "source",
  sourceId: null,
  sourceName: null,
  text: null,
  delimiter: null,
  detectedDelimiter: ",",
  hasHeaders: true,
  headers: [],
  rows: [],
  fields: [],
  mapping: [],
  keyColumnId: null,
  plan: null,
  skipErrors: true,
  progress: null,
  result: null,
  loading: false,
  error: null,
});

/** The rows of a table, with mapping and key defaults when the headers changed. */
function withTable(
  state: ImportFlowState,
  table: { headers: string[]; rows: string[][] },
  options: Pick<ImportFlowOptions, "columns" | "locale">
): Partial<ImportFlowState> {
  const fields = importFields(table);
  const sameHeaders =
    state.headers.length === table.headers.length &&
    state.headers.every((header, index) => header === table.headers[index]);
  const mapping = sameHeaders
    ? state.mapping
    : defaultImportMapping(fields, options.columns, { locale: options.locale });
  return {
    headers: table.headers,
    rows: table.rows,
    fields,
    mapping,
    keyColumnId: sameHeaders
      ? state.keyColumnId
      : defaultImportKey(mapping, options.columns),
    plan: null,
  };
}

/** The key values of the file, converted like the key column. */
function keyValues(
  state: ImportFlowState,
  column: ImportColumn,
  locale: string
): string[] {
  const entry = state.mapping.find((item) => item.columnId === column.id);
  const index = entry ? state.headers.indexOf(entry.field) : -1;
  if (index < 0) {
    return [];
  }
  const values = new Set<string>();
  for (const row of state.rows) {
    const result = coerceImportValue(row[index], column, { locale });
    if ("value" in result && result.value !== null) {
      values.add(String(result.value).trim());
    }
  }
  return [...values];
}

/** Addresses in the location columns, resolved with the host's geocoder. */
async function geocodeImportAddresses(
  state: ImportFlowState,
  columns: readonly ImportColumn[],
  options: Pick<ImportFlowOptions, "geocode" | "locale">
): Promise<Map<string, LocationValue | null> | undefined> {
  if (!options.geocode) {
    return;
  }
  const locationIds = new Set(
    columns
      .filter((column) => column.type === "location")
      .map((column) => column.id)
  );
  const indexes = state.mapping
    .filter((entry) => entry.columnId && locationIds.has(entry.columnId))
    .map((entry) => state.headers.indexOf(entry.field))
    .filter((index) => index >= 0);
  const addresses = addressesToGeocode(
    state.rows.flatMap((row) => indexes.map((index) => row[index]))
  );
  return addresses.length
    ? await geocodeAddresses(addresses, options.geocode, {
        locale: options.locale,
      })
    : undefined;
}

/**
 * The import screen as a framework-neutral state machine: both editions
 * render `state` and call these actions, so they behave the same.
 */
export function createImportFlow(options: ImportFlowOptions): ImportFlow {
  const { columns, t } = options;
  let state = initialState();
  let notify = options.onChange;
  let controller: AbortController | null = null;
  const set = (patch: Partial<ImportFlowState>) => {
    state = { ...state, ...patch };
    notify(state);
  };

  const parse = (text: string, patch: Partial<ImportFlowState> = {}) => {
    const next = { ...state, ...patch };
    const parsed = parseCsv(text, {
      delimiter: next.delimiter ?? undefined,
      headers: next.hasHeaders,
    });
    const detected = next.delimiter ? next.detectedDelimiter : parsed.delimiter;
    return {
      ...patch,
      ...withTable(next, parsed, options),
      detectedDelimiter: detected,
    };
  };

  const loadTable = (
    data: ImportSourceData,
    sourceId: string,
    name: string | null
  ) => {
    const table = "text" in data ? null : data;
    const base: Partial<ImportFlowState> = {
      sourceId,
      sourceName: data.name ?? name,
      text: table ? null : (data as { text: string }).text,
      loading: false,
      error: null,
    };
    const patch = table
      ? { ...base, ...withTable({ ...state, headers: [] }, table, options) }
      : parse((data as { text: string }).text, { ...base, headers: [] });
    if ((patch.rows ?? []).length === 0) {
      set({ ...base, text: null, error: t("emptyFile") });
      return;
    }
    set({ ...patch, step: "mapping" });
  };

  const loadText = (text: string, name?: string) => {
    if (!text.trim()) {
      set({ loading: false, error: t("emptyFile") });
      return;
    }
    loadTable({ text, name }, IMPORT_CSV_SOURCE, name ?? null);
  };

  const loadFile: ImportFlow["loadFile"] = async (file) => {
    set({ loading: true, error: null });
    try {
      const text = decodeCsvFile(await file.arrayBuffer());
      loadText(text, file.name);
    } catch {
      set({ loading: false, error: t("fileError") });
    }
  };

  const loadSource = async (sourceId: string) => {
    if (!options.loadSource) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await options.loadSource(sourceId);
      loadTable(data, sourceId, null);
    } catch (error) {
      set({
        loading: false,
        error: isImportAuthError(error) ? t("authError") : t("sourceError"),
      });
    }
  };

  const reparse = (patch: Partial<ImportFlowState>) => {
    if (state.text === null) {
      set(patch);
      return;
    }
    set(parse(state.text, patch));
  };

  const setDelimiter = (value: string) => {
    const delimiter = CSV_DELIMITERS.find((item) => item === value) ?? null;
    reparse({ delimiter });
  };

  const setField = (field: string, columnId: string) => {
    const target = columnId === IMPORT_IGNORE ? null : columnId;
    const mapping = state.mapping.map((entry) => {
      if (entry.field === field) {
        return { field, columnId: target };
      }
      // A column takes one field: the previous one is ignored.
      return target && entry.columnId === target
        ? { field: entry.field, columnId: null }
        : entry;
    });
    const mapped = new Set(mapping.map((entry) => entry.columnId));
    set({
      mapping,
      keyColumnId:
        state.keyColumnId && mapped.has(state.keyColumnId)
          ? state.keyColumnId
          : null,
      plan: null,
    });
  };

  const review = async () => {
    set({ loading: true, error: null });
    const keyColumn = columns.find((column) => column.id === state.keyColumnId);
    try {
      const existing = keyColumn
        ? await options.findExisting(
            keyColumn.id,
            keyValues(state, keyColumn, options.locale)
          )
        : undefined;
      const geocoded = await geocodeImportAddresses(state, columns, options);
      const plan = planImport({
        rows: state.rows,
        fields: state.headers,
        mapping: state.mapping,
        columns,
        keyColumnId: keyColumn?.id ?? null,
        existing,
        locale: options.locale,
        allowNewOptions: options.allowNewOptions,
        geocoded,
      });
      set({ plan, step: "review", loading: false });
    } catch (error) {
      set({
        loading: false,
        error: isImportAuthError(error) ? t("authError") : t("sourceError"),
      });
    }
  };

  const run = async () => {
    const { plan } = state;
    if (!plan || state.step === "running") {
      return;
    }
    controller = new AbortController();
    set({ step: "running", progress: { done: 0, total: 0 }, error: null });
    try {
      const result = await runImport(plan, options.adapters, {
        batchSize: options.batchSize,
        skipErrors: state.skipErrors,
        signal: controller.signal,
        onProgress: (progress) => set({ progress }),
      });
      set({ step: "result", result });
      if (result.created + result.updated > 0) {
        options.onImported?.(result);
      }
    } catch {
      set({ step: "review", error: t("authError") });
    } finally {
      controller = null;
    }
  };

  const back = () => {
    const previous: Partial<Record<ImportStep, ImportStep>> = {
      mapping: "source",
      review: "mapping",
    };
    const step = previous[state.step];
    if (step) {
      set({ step, error: null, ...(step === "source" ? initialState() : {}) });
    }
  };

  return {
    get state() {
      return state;
    },
    loadText,
    loadFile,
    loadSource,
    setDelimiter,
    setHasHeaders: (hasHeaders) => reparse({ hasHeaders }),
    setField,
    setKey: (columnId) =>
      set({
        keyColumnId: columnId === IMPORT_NO_KEY ? null : columnId,
        plan: null,
      }),
    review,
    setSkipErrors: (skipErrors) => set({ skipErrors }),
    run,
    stop: () => controller?.abort(),
    back,
    reset: () => set(initialState()),
    dispose: () => {
      notify = () => undefined;
      controller?.abort();
    },
  };
}

// Screen fields ----------------------------------------------------------------

const MAP_PREFIX = "map:";

/** One select of the import screen besides the mapping rows. */
export interface ImportScreenField {
  id: "delimiter" | "key";
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

const DELIMITER_LABELS: Record<CsvDelimiter, ImportLabelKey> = {
  ",": "delimiterComma",
  ";": "delimiterSemicolon",
  "\t": "delimiterTab",
  "|": "delimiterPipe",
};

/** The type a column's values are read as, for the badge. */
const typeLabel = (column: ImportColumn, t: ImportT): string => {
  const type = column.type ?? "text";
  if (["url", "image"].includes(type)) {
    return t("type_url");
  }
  if (type === "email" || type === "json" || type === "location") {
    return t(`type_${type}`);
  }
  return t(`type_${fieldTypeFamily(type) ?? "text"}` as ImportLabelKey);
};

/** How many of a field's sample values the column fails to convert. */
function invalidSamples(
  field: ImportField,
  column: ImportColumn,
  locale: string,
  allowNewOptions?: boolean
): number {
  const dateOrder = detectDateOrder(field.sample, locale);
  return field.sample.filter(
    (value) =>
      "error" in
      coerceImportValue(value, column, { locale, dateOrder, allowNewOptions })
  ).length;
}

/** Field → column rows of the mapping screen, with a sample and a conversion badge. */
export function importMappingRows(
  state: ImportFlowState,
  options: {
    columns: readonly ImportColumn[];
    locale: string;
    t: ImportT;
    allowNewOptions?: boolean;
  }
): ColumnMappingRow[] {
  const { columns, locale, t } = options;
  const choices = [
    ...columns.map((column) => ({ value: column.id, label: column.header })),
    { value: IMPORT_IGNORE, label: t("ignore") },
  ];
  return state.fields.map((field, index) => {
    const columnId =
      state.mapping.find((entry) => entry.field === field.name)?.columnId ??
      null;
    const column = columns.find((item) => item.id === columnId);
    const invalid = column
      ? invalidSamples(field, column, locale, options.allowNewOptions)
      : 0;
    const [first] = field.sample;
    return {
      id: `${MAP_PREFIX}${field.name}`,
      heading: index === 0 ? t("mapping") : undefined,
      label: field.name,
      value: column?.id ?? IMPORT_IGNORE,
      options: choices,
      sample: first ? t("sample", { value: first }) : t("noSample"),
      badge: column
        ? {
            label:
              invalid > 0
                ? countLabel(t, invalid, "invalidCount", "invalidOne")
                : typeLabel(column, t),
            invalid: invalid > 0,
          }
        : undefined,
    };
  });
}

/** The separator select (CSV only) and the key select. */
export function importSettingsFields(
  state: ImportFlowState,
  options: { columns: readonly ImportColumn[]; t: ImportT }
): ImportScreenField[] {
  const { columns, t } = options;
  const fields: ImportScreenField[] = [];
  if (state.text !== null) {
    fields.push({
      id: "delimiter",
      label: t("delimiter"),
      value: state.delimiter ?? IMPORT_AUTO_DELIMITER,
      options: [
        {
          value: IMPORT_AUTO_DELIMITER,
          label: t("delimiterAuto", {
            delimiter: t(DELIMITER_LABELS[state.detectedDelimiter]),
          }),
        },
        ...CSV_DELIMITERS.map((delimiter) => ({
          value: delimiter,
          label: t(DELIMITER_LABELS[delimiter]),
        })),
      ],
    });
  }
  const mapped = new Set(state.mapping.map((entry) => entry.columnId));
  fields.push({
    id: "key",
    label: t("keyColumn"),
    value: state.keyColumnId ?? IMPORT_NO_KEY,
    options: [
      { value: IMPORT_NO_KEY, label: t("keyNone") },
      ...columns
        .filter((column) => mapped.has(column.id))
        .map((column) => ({ value: column.id, label: column.header })),
    ],
  });
  return fields;
}

/** Applies a choice made on the mapping screen (a mapping row or a settings field). */
export function applyImportField(
  flow: ImportFlow,
  id: string,
  value: string
): void {
  if (id.startsWith(MAP_PREFIX)) {
    flow.setField(id.slice(MAP_PREFIX.length), value);
  } else if (id === "delimiter") {
    flow.setDelimiter(value);
  } else {
    flow.setKey(value);
  }
}

export interface ImportPreviewCell {
  columnId: string;
  text: string;
  error?: string;
}

export interface ImportPreview {
  columns: { id: string; header: string }[];
  rows: { index: number; cells: ImportPreviewCell[] }[];
}

const PREVIEW_ROWS = 5;

/** A value as the table will show it: option labels, number and date formats, places. */
const displayValue = (
  value: unknown,
  column: ImportColumn,
  t: ImportT,
  locale: string
): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? t("yes") : t("no");
  }
  return fieldText(
    value,
    { ...column, numberFormat: column.numberFormat as NumberFormatConfig },
    locale
  );
};

/** The first rows as the table will show them, invalid cells with their error. */
export function importPreview(
  state: ImportFlowState,
  options: {
    columns: readonly ImportColumn[];
    locale: string;
    t: ImportT;
    allowNewOptions?: boolean;
    limit?: number;
  }
): ImportPreview {
  const { t } = options;
  const mapped = state.mapping.flatMap((entry) => {
    const column = options.columns.find((item) => item.id === entry.columnId);
    const index = state.headers.indexOf(entry.field);
    if (!column || index < 0) {
      return [];
    }
    const values = state.rows.map((row) => row[index] ?? "");
    return [
      { column, index, dateOrder: detectDateOrder(values, options.locale) },
    ];
  });
  const rows = state.rows
    .slice(0, options.limit ?? PREVIEW_ROWS)
    .map((row, rowIndex) => ({
      index: rowIndex,
      cells: mapped.map(({ column, index, dateOrder }) => {
        const result = coerceImportValue(row[index], column, {
          locale: options.locale,
          dateOrder,
          allowNewOptions: options.allowNewOptions,
        });
        return "error" in result
          ? {
              columnId: column.id,
              text: row[index] ?? "",
              error: importErrorMessage(result.error, t),
            }
          : {
              columnId: column.id,
              text: displayValue(result.value, column, t, options.locale),
            };
      }),
    }));
  return {
    columns: mapped.map(({ column }) => ({
      id: column.id,
      header: column.header,
    })),
    rows,
  };
}

/** "3 to add", "1 to update", "2 rows with errors" (non-zero counts only). */
export function importSummaryLines(
  plan: ImportPlan,
  skipErrors: boolean,
  t: ImportT
): { creates: string | null; updates: string | null; errors: string | null } {
  const summary = summarizeImport(plan, { skipErrors });
  return {
    creates:
      summary.creates > 0
        ? countLabel(t, summary.creates, "creates", "createsOne")
        : null,
    updates:
      summary.updates > 0
        ? countLabel(t, summary.updates, "updates", "updatesOne")
        : null,
    errors:
      summary.errorRows > 0
        ? countLabel(t, summary.errorRows, "errorRows", "errorRowsOne")
        : null,
  };
}

/** Whether Import can run: something to write, and errors skipped when there are any. */
export function canRunImport(plan: ImportPlan, skipErrors: boolean): boolean {
  const summary = summarizeImport(plan, { skipErrors });
  const blocked = summary.errorRows > 0 && !skipErrors;
  return !blocked && summary.creates + summary.updates > 0;
}

/** The first cell errors, one line each ("Row 4, Status: not one of the options"). */
export function importErrorLines(
  plan: ImportPlan,
  options: {
    columns: readonly ImportColumn[];
    t: ImportT;
    hasHeaders: boolean;
    limit?: number;
  }
): string[] {
  const offset = options.hasHeaders ? 2 : 1;
  return plan.errors.slice(0, options.limit ?? 3).map((error) =>
    options.t("rowError", {
      row: error.rowIndex + offset,
      column:
        options.columns.find((column) => column.id === error.columnId)
          ?.header ?? error.columnId,
      message: importErrorMessage(error.code, options.t),
    })
  );
}

/** "2 added, 1 updated, 1 failed" (non-zero counts only). */
export function describeImportResult(
  result: ImportRunResult,
  t: ImportT
): string {
  const parts = [
    result.created > 0
      ? countLabel(t, result.created, "created", "createdOne")
      : null,
    result.updated > 0
      ? countLabel(t, result.updated, "updated", "updatedOne")
      : null,
    result.failed > 0
      ? countLabel(t, result.failed, "failed", "failedOne")
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : t("nothingImported");
}

/** The first failed rows, one line each. */
export function importFailureLines(
  result: ImportRunResult,
  options: { t: ImportT; hasHeaders: boolean; limit?: number }
): string[] {
  const offset = options.hasHeaders ? 2 : 1;
  return result.failures.slice(0, options.limit ?? 3).map((failure) =>
    options.t("failureRow", {
      row: failure.rowIndex + offset,
      message: failure.message || options.t("error_unknown"),
    })
  );
}

/** "12 rows" for the chosen file. */
export function importRowCount(state: ImportFlowState, t: ImportT): string {
  return countLabel(t, state.rows.length, "rowsFound", "rowsFoundOne");
}

/** The import columns of a table: its data columns, without selection and actions. */
export function importColumnsFrom(
  definitions: readonly {
    id: string;
    header?: unknown;
    type?: unknown;
    options?: unknown;
    numberFormat?: unknown;
    dateDisplayPreset?: unknown;
    dateFormat?: unknown;
    timeZone?: unknown;
    hour12?: unknown;
    required?: unknown;
    import?: unknown;
  }[]
): ImportColumn[] {
  return definitions
    .filter(
      (column) =>
        column.id !== "select" &&
        column.type !== "actions" &&
        column.type !== "custom" &&
        column.import !== false
    )
    .map((column) => ({
      id: column.id,
      header: typeof column.header === "string" ? column.header : column.id,
      ...(typeof column.type === "string" ? { type: column.type } : {}),
      ...(Array.isArray(column.options)
        ? { options: column.options as ImportColumn["options"] }
        : {}),
      ...(column.numberFormat === undefined
        ? {}
        : { numberFormat: column.numberFormat }),
      ...(typeof column.dateDisplayPreset === "string"
        ? {
            dateDisplayPreset:
              column.dateDisplayPreset as ImportColumn["dateDisplayPreset"],
          }
        : {}),
      ...(typeof column.dateFormat === "string"
        ? { dateFormat: column.dateFormat }
        : {}),
      ...(typeof column.timeZone === "string"
        ? { timeZone: column.timeZone }
        : {}),
      ...(typeof column.hour12 === "boolean" ? { hour12: column.hour12 } : {}),
      ...(column.required === true ? { required: true } : {}),
    }));
}

/** Import is offered when rows can be created or updated, and not turned off. */
export function isImportEnabled(options: {
  flag?: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  hasImportRows?: boolean;
}): boolean {
  return (
    options.flag !== false &&
    (options.canCreate || options.canUpdate || Boolean(options.hasImportRows))
  );
}
