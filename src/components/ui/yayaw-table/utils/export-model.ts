/**
 * File export shared by the React and Vue editions: what the user chose in the
 * Export screen, the values written for each column, and the CSV or printable
 * page built from them. Excel files come from an optional registry item.
 */
import { locationToText } from "./location-model";
import { fieldText, resolveDataType } from "./table-contracts";
import type { ColumnDateFormat, NumberFormatConfig } from "./value-format";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportScope = "view" | "selection";
/** `table.exportCsvSeparator`: French Excel expects ";". */
export type CsvSeparator = "," | ";" | "\t";

export interface ExportSettings {
  format: ExportFormat;
  /** The records matching the view, or only the selected ones. */
  scope: ExportScope;
  /** The visible columns, every exportable one, or those in `columnIds`. */
  columns: "visible" | "all" | "custom";
  /** With `columns: "custom"`: the columns to write, in this order. */
  columnIds?: string[];
  /** As displayed (currency, dates, option labels) or as stored. */
  values: "formatted" | "raw";
  /** Without extension. */
  fileName: string;
}

/** What a column contributes to an export: its values as displayed, or raw. */
export interface ExportColumn {
  id: string;
  header: string;
  type?: string;
  /** The row field naming a `dynamicType` column's type. */
  typeKey?: string;
  options?: unknown;
  numberFormat?: NumberFormatConfig;
  dateDisplayPreset?: ColumnDateFormat["preset"];
  dateFormat?: string;
  timeZone?: string;
  hour12?: boolean;
}

export type ExportCell = string | number | boolean | null;

export interface ExportMatrix {
  headers: string[];
  rows: ExportCell[][];
  /**
   * Per row and column, whether the cell was written from a number (even as
   * displayed): CSV leaves such cells as they are.
   */
  numeric?: boolean[][];
}

/** A column of the Export screen's "Choose columns" list. */
export interface ExportColumnChoice {
  id: string;
  header: string;
  /** Shown in the table: checked at first. */
  visible: boolean;
}

/**
 * Whether a column may leave the table (exports, Connect destinations,
 * connector mappings): not the selection or actions column, nor a column
 * defined with `enableExport: false`.
 */
export function isExportableColumn(column: {
  id: string;
  type?: unknown;
  enableExport?: boolean;
}): boolean {
  return (
    column.enableExport !== false &&
    column.id !== "select" &&
    column.id !== "actions" &&
    column.type !== "actions"
  );
}

const ENGLISH_LABELS = {
  format: "Format",
  pdf: "PDF (print)",
  scope: "Records",
  scopeView: "All in this view",
  scopeSelection: "Selected ({count})",
  columns: "Columns",
  columnsVisible: "Visible",
  columnsAll: "All",
  columnsCustom: "Choose columns",
  columnsChoice: "Columns to export",
  columnsSelectAll: "Select all",
  columnsSelectNone: "Select none",
  columnsEmpty: "Choose at least one column.",
  values: "Values",
  valuesFormatted: "As displayed",
  valuesRaw: "Raw",
  fileName: "File name",
  run: "Export",
  records: "{count} records",
  recordsOne: "{count} record",
  yes: "Yes",
  no: "No",
};

export type ExportLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<ExportLabelKey, string> = {
  format: "Format",
  pdf: "PDF (impression)",
  scope: "Enregistrements",
  scopeView: "Tous ceux de la vue",
  scopeSelection: "Sélectionnés ({count})",
  columns: "Colonnes",
  columnsVisible: "Visibles",
  columnsAll: "Toutes",
  columnsCustom: "Choisir les colonnes",
  columnsChoice: "Colonnes à exporter",
  columnsSelectAll: "Tout cocher",
  columnsSelectNone: "Tout décocher",
  columnsEmpty: "Choisissez au moins une colonne.",
  values: "Valeurs",
  valuesFormatted: "Telles qu’affichées",
  valuesRaw: "Brutes",
  fileName: "Nom du fichier",
  run: "Exporter",
  records: "{count} enregistrements",
  recordsOne: "{count} enregistrement",
  yes: "Oui",
  no: "Non",
};

/** Host override for a label (`exportScreen.<key>`), or the built-in one. */
export type ExportTranslate = (key: ExportLabelKey, fallback: string) => string;

/** A label with its `{name}` parameters filled in. */
export type ExportT = (
  key: ExportLabelKey,
  params?: Record<string, string | number>
) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function exportLabels(
  locale = "en",
  translate?: ExportTranslate
): ExportT {
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

/** "1 record", "12 records", "0 enregistrement": the locale's plural rule. */
export function exportRecordCount(
  count: number,
  t: ExportT,
  locale?: string
): string {
  const one = new Intl.PluralRules(locale).select(count) === "one";
  return t(one ? "recordsOne" : "records", {
    count: new Intl.NumberFormat(locale).format(count),
  });
}

const DIACRITICS = /\p{M}/gu;
const FILE_NAME_UNSAFE = /[^\p{L}\p{N}]+/gu;
const EDGE_DASHES = /^-+|-+$/g;
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const HTML_UNSAFE = /[&<>"']/g;
const CSV_QUOTED = /[",\n\r;]/;
/** Text spreadsheet apps would run as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;
const UTF8_BOM = "\uFEFF";

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(FILE_NAME_UNSAFE, "-")
    .replace(EDGE_DASHES, "")
    .toLowerCase();
}

/** `projects-active-2026-09-23`: table, view when saved, local date. */
export function defaultExportFileName(
  tableName: string,
  viewName?: string,
  date: Date = new Date()
): string {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return [slug(tableName), viewName ? slug(viewName) : "", day]
    .filter(Boolean)
    .join("-");
}

export function exportFileName(settings: ExportSettings): string {
  const name = settings.fileName.trim() || "export";
  const extension = settings.format === "pdf" ? "pdf" : settings.format;
  return name.toLowerCase().endsWith(`.${extension}`)
    ? name
    : `${name}.${extension}`;
}

const hasOptions = (column: ExportColumn): boolean =>
  Array.isArray(column.options) && column.options.length > 0;

const BOOLEAN_LABELS = new Map<unknown, ExportLabelKey>([
  [true, "yes"],
  ["true", "yes"],
  [false, "no"],
  ["false", "no"],
]);

/**
 * As displayed: option labels, numbers and dates in the column's format
 * (time zone and clock included), yes or no, places by name, in the table
 * locale.
 */
function formattedCell(
  value: unknown,
  column: ExportColumn,
  { locale, t }: { locale?: string; t: ExportT },
  row: Record<string, unknown>
) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  // A yes/no column with options keeps their labels.
  const yesNo = BOOLEAN_LABELS.get(value);
  if (
    yesNo &&
    !hasOptions(column) &&
    resolveDataType(column.type, row, column.typeKey) === "boolean"
  ) {
    return t(yesNo);
  }
  return fieldText(value, column, locale, row);
}

/**
 * Whether a stored value is a number: a number, or numeric text in a number
 * column. Its cells are never treated as formulas.
 */
export function isNumericExportValue(value: unknown, type?: string): boolean {
  if (typeof value === "number" || typeof value === "bigint") {
    return true;
  }
  return (
    type === "number" &&
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  );
}

const numericCell = (
  row: Record<string, unknown>,
  column: ExportColumn
): boolean =>
  isNumericExportValue(
    row[column.id],
    resolveDataType(column.type, row, column.typeKey)
  );

/** Places are written "lat,lng", which imports read back. */
function rawCell(value: unknown, column: ExportColumn): ExportCell {
  if (value === null || value === undefined) {
    return null;
  }
  if (column.type === "location") {
    return locationToText(value) || null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
}

/**
 * Header and values, in column order, as displayed or as stored. Yes/no
 * values read with `labels` (the locale's built-in ones by default).
 */
export function exportMatrix(
  rows: readonly Record<string, unknown>[],
  columns: readonly ExportColumn[],
  {
    formatted,
    locale,
    labels = exportLabels(locale),
  }: { formatted: boolean; locale?: string; labels?: ExportT }
): ExportMatrix {
  const format = { locale, t: labels };
  return {
    headers: columns.map((column) => column.header),
    rows: rows.map((row) =>
      columns.map((column) =>
        formatted
          ? formattedCell(row[column.id], column, format, row)
          : rawCell(row[column.id], column)
      )
    ),
    // Option labels are text, even for numbers; raw places are coordinates.
    numeric: rows.map((row) =>
      columns.map((column) =>
        formatted
          ? !hasOptions(column) && numericCell(row, column)
          : column.type === "location" || numericCell(row, column)
      )
    ),
  };
}

/**
 * One CSV field. Spreadsheet apps run text starting with =, +, -, @, a tab
 * or a carriage return as a formula: such text gets a leading apostrophe,
 * unless it was written from a number (`numeric`). Quoted when it holds the
 * separator, a quote, a comma, a semicolon or a line break.
 */
export function csvField(
  text: string,
  separator: string,
  numeric = false
): string {
  const safe = !numeric && FORMULA_START.test(text) ? `'${text}` : text;
  return CSV_QUOTED.test(safe) || safe.includes(separator)
    ? `"${safe.replaceAll('"', '""')}"`
    : safe;
}

/** CSV with a BOM so spreadsheet apps read UTF-8 accents. */
export function csvFromMatrix(
  matrix: ExportMatrix,
  separator: CsvSeparator = ","
): string {
  const header = matrix.headers
    .map((cell) => csvField(cell, separator))
    .join(separator);
  const lines = matrix.rows.map((row, rowIndex) =>
    row
      .map((cell, columnIndex) =>
        csvField(
          cell === null ? "" : String(cell),
          separator,
          typeof cell === "number" ||
            matrix.numeric?.[rowIndex]?.[columnIndex] === true
        )
      )
      .join(separator)
  );
  return `${UTF8_BOM}${[header, ...lines].join("\n")}`;
}

function escapeHtml(value: ExportCell): string {
  return value === null
    ? ""
    : String(value).replace(
        HTML_UNSAFE,
        (character) => HTML_ESCAPES[character] ?? character
      );
}

/**
 * A self-contained page to print or save as PDF from the browser dialog:
 * a title, the record count and a table repeating its header on each page.
 */
export function printableHtml({
  title,
  subtitle,
  matrix,
  lang = "en",
}: {
  title: string;
  subtitle?: string;
  matrix: ExportMatrix;
  lang?: string;
}): string {
  const head = matrix.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body = matrix.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { margin: 12mm; }
body { font: 11px/1.4 system-ui, sans-serif; color: #111; margin: 0; }
h1 { font-size: 16px; margin: 0 0 4px; }
p { color: #555; margin: 0 0 12px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f4f4f5; font-weight: 600; }
tr { break-inside: avoid; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`;
}

/** Sent to `actions.exportFile` when the host builds files on the server. */
export interface ExportFileRequest {
  format: ExportFormat;
  scope: ExportScope;
  formatted: boolean;
  /** Includes the extension. */
  fileName: string;
  viewId: string | null;
  /** The view's query in the `list` shape; the server loads the records. */
  query: import("./data-destinations").DataDestinationQuery;
  /**
   * The columns in order, with what the table shows them with (type, option
   * labels, number and date formats), so `formatted` files can match it.
   */
  columns: ExportRequestColumn[];
  selectedRowIds: string[];
  /** The table locale formats apply in; absent when the table sets none. */
  locale?: string;
}

/** A column as `actions.exportFile` receives it: only the fields it sets. */
export type ExportRequestColumn = Pick<ExportColumn, "id" | "header"> &
  Partial<Omit<ExportColumn, "id" | "header">>;

const exportRequestColumn = (column: ExportColumn): ExportRequestColumn => {
  const { id, header, type, typeKey, options } = column;
  const { numberFormat, dateDisplayPreset, dateFormat, timeZone, hour12 } =
    column;
  const fields = {
    type,
    typeKey,
    options,
    numberFormat,
    dateDisplayPreset,
    dateFormat,
    timeZone,
    hour12,
  };
  return {
    id,
    header,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    ),
  };
};

/** A link to download, a file built on the server, or nothing to do. */
export type ExportFileResult = { url: string } | { blob: Blob } | undefined;

export interface ExportRuntime {
  settings: ExportSettings;
  viewId: string | null;
  query: import("./data-destinations").DataDestinationQuery;
  /**
   * Every exportable column the table defines, and the visible ones in
   * order (see `isExportableColumn`).
   */
  allColumns: ExportColumn[];
  visibleColumns: ExportColumn[];
  selectedRowIds: string[];
  selectedRows: Record<string, unknown>[];
  loadRows: () => Promise<Record<string, unknown>[]>;
  locale?: string;
  /** Labels with the host's overrides (`exportLabels`); built-in by default. */
  labels?: ExportT;
  /** `table.exportCsvSeparator`, "," by default. */
  csvSeparator?: CsvSeparator;
  title: string;
  exportFile?: (request: ExportFileRequest) => Promise<ExportFileResult>;
  /** Replaces the built-in CSV file, as the `onExport` prop always did. */
  onRows?: (rows: Record<string, unknown>[]) => Promise<void> | void;
  download: (file: Blob | string, fileName: string) => void;
  print: (html: string) => void;
}

/** Formats the export screen offers: Excel needs a server or a writer. */
export function availableExportFormats(
  configured: readonly ExportFormat[] | undefined,
  canWriteExcel: boolean
): ExportFormat[] {
  const offered: ExportFormat[] = canWriteExcel
    ? ["csv", "xlsx", "pdf"]
    : ["csv", "pdf"];
  const allowed = configured?.length ? new Set(configured) : undefined;
  return offered.filter((format) => !allowed || allowed.has(format));
}

/** The columns an export writes: visible, all, or the chosen ones in order. */
export function exportedColumns(
  settings: Pick<ExportSettings, "columns" | "columnIds">,
  {
    allColumns,
    visibleColumns,
  }: Pick<ExportRuntime, "allColumns" | "visibleColumns">
): ExportColumn[] {
  if (settings.columns === "all") {
    return allColumns;
  }
  if (settings.columns !== "custom") {
    return visibleColumns;
  }
  const byId = new Map(allColumns.map((column) => [column.id, column]));
  return (settings.columnIds ?? []).flatMap((id) => byId.get(id) ?? []);
}

/**
 * Run an export: the server builds the file when it can, otherwise the
 * browser writes the CSV or opens a printable page for PDF.
 */
export async function runExport(runtime: ExportRuntime): Promise<void> {
  const { settings } = runtime;
  const columns = exportedColumns(settings, runtime);
  const fileName = exportFileName(settings);
  const labels = runtime.labels ?? exportLabels(runtime.locale);
  if (runtime.exportFile) {
    const result = await runtime.exportFile({
      format: settings.format,
      scope: settings.scope,
      formatted: settings.values === "formatted",
      fileName,
      viewId: runtime.viewId,
      query: runtime.query,
      columns: columns.map(exportRequestColumn),
      selectedRowIds:
        settings.scope === "selection" ? runtime.selectedRowIds : [],
      ...(runtime.locale ? { locale: runtime.locale } : {}),
    });
    if (result && "url" in result) {
      runtime.download(result.url, fileName);
    } else if (result && "blob" in result) {
      runtime.download(result.blob, fileName);
    }
    return;
  }
  const rows =
    settings.scope === "selection"
      ? runtime.selectedRows
      : await runtime.loadRows();
  if (settings.format === "csv" && runtime.onRows) {
    await runtime.onRows(rows);
    return;
  }
  const matrix = exportMatrix(rows, columns, {
    formatted: settings.values === "formatted",
    locale: runtime.locale,
    labels,
  });
  if (settings.format === "pdf") {
    runtime.print(
      printableHtml({
        title: runtime.title,
        subtitle: exportRecordCount(rows.length, labels, runtime.locale),
        matrix,
        lang: runtime.locale?.split("-")[0],
      })
    );
    return;
  }
  if (settings.format === "xlsx") {
    throw new Error(
      "Excel export needs `actions.exportFile` or the Excel item."
    );
  }
  runtime.download(
    new Blob([csvFromMatrix(matrix, runtime.csvSeparator)], {
      type: "text/csv;charset=utf-8",
    }),
    fileName
  );
}

/** Save a built file or follow a download link. */
export function downloadExportFile(
  file: Blob | string,
  fileName: string
): void {
  if (typeof document === "undefined") {
    return;
  }
  const url = typeof file === "string" ? file : URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  if (typeof file !== "string") {
    URL.revokeObjectURL(url);
  }
}

/**
 * Print a page from a hidden frame: unlike a new window, it is not blocked
 * once the rows have loaded, and "Save as PDF" is one choice away.
 */
export function printExportPage(html: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = html;
  frame.addEventListener("load", () => {
    const view = frame.contentWindow;
    if (!view) {
      frame.remove();
      return;
    }
    view.addEventListener("afterprint", () => frame.remove());
    view.focus();
    view.print();
  });
  document.body.append(frame);
}
