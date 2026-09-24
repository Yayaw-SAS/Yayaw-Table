/**
 * File export shared by the React and Vue editions: what the user chose in the
 * Export screen, the values written for each column, and the CSV or printable
 * page built from them. Excel files come from an optional registry item.
 */
import { formatLocation, locationToText } from "./location-model";
import { dataTypeOptionLabel } from "./table-contracts";
import {
  type ColumnDateFormat,
  formatDateValue,
  formatNumberValue,
  type NumberFormatConfig,
} from "./value-format";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportScope = "view" | "selection";

export interface ExportSettings {
  format: ExportFormat;
  /** The records matching the view, or only the selected ones. */
  scope: ExportScope;
  columns: "visible" | "all";
  /** As displayed (currency, dates, option labels) or as stored. */
  values: "formatted" | "raw";
  /** Without extension. */
  fileName: string;
}

/** What a column contributes to an export. */
export interface ExportColumn {
  id: string;
  header: string;
  type?: string;
  options?: unknown;
  numberFormat?: NumberFormatConfig;
  dateDisplayPreset?: ColumnDateFormat["preset"];
  dateFormat?: string;
  timeZone?: string;
}

export type ExportCell = string | number | boolean | null;

export interface ExportMatrix {
  headers: string[];
  rows: ExportCell[][];
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

function formattedCell(value: unknown, column: ExportColumn, locale?: string) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => dataTypeOptionLabel(item, column.options))
      .join(", ");
  }
  switch (column.type) {
    case "number":
      return formatNumberValue(value, column.numberFormat, locale);
    case "date":
      return formatDateValue(value, {
        preset: column.dateDisplayPreset,
        pattern: column.dateFormat,
        locale,
        timeZone: column.timeZone,
      });
    case "select":
    case "multiSelect":
      return dataTypeOptionLabel(value, column.options);
    case "location":
      return formatLocation(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

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

/** Header and values, in column order, as displayed or as stored. */
export function exportMatrix(
  rows: readonly Record<string, unknown>[],
  columns: readonly ExportColumn[],
  { formatted, locale }: { formatted: boolean; locale?: string }
): ExportMatrix {
  return {
    headers: columns.map((column) => column.header),
    rows: rows.map((row) =>
      columns.map((column) =>
        formatted
          ? formattedCell(row[column.id], column, locale)
          : rawCell(row[column.id], column)
      )
    ),
  };
}

function csvCell(value: ExportCell, separator: string): string {
  const text = value === null ? "" : String(value);
  return CSV_QUOTED.test(text) || text.includes(separator)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

/** CSV with a BOM so spreadsheet apps read UTF-8 accents. */
export function csvFromMatrix(matrix: ExportMatrix, separator = ","): string {
  const lines = [matrix.headers, ...matrix.rows].map((line) =>
    line.map((cell) => csvCell(cell, separator)).join(separator)
  );
  return `${UTF8_BOM}${lines.join("\n")}`;
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
  columns: { id: string; header: string }[];
  selectedRowIds: string[];
}

/** A link to download, a file built on the server, or nothing to do. */
export type ExportFileResult = { url: string } | { blob: Blob } | undefined;

export interface ExportRuntime {
  settings: ExportSettings;
  viewId: string | null;
  query: import("./data-destinations").DataDestinationQuery;
  /** Every column the table defines, and the visible ones in order. */
  allColumns: ExportColumn[];
  visibleColumns: ExportColumn[];
  selectedRowIds: string[];
  selectedRows: Record<string, unknown>[];
  loadRows: () => Promise<Record<string, unknown>[]>;
  locale?: string;
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

/**
 * Run an export: the server builds the file when it can, otherwise the
 * browser writes the CSV or opens a printable page for PDF.
 */
export async function runExport(runtime: ExportRuntime): Promise<void> {
  const { settings } = runtime;
  const columns =
    settings.columns === "all" ? runtime.allColumns : runtime.visibleColumns;
  const fileName = exportFileName(settings);
  if (runtime.exportFile) {
    const result = await runtime.exportFile({
      format: settings.format,
      scope: settings.scope,
      formatted: settings.values === "formatted",
      fileName,
      viewId: runtime.viewId,
      query: runtime.query,
      columns: columns.map(({ id, header }) => ({ id, header })),
      selectedRowIds:
        settings.scope === "selection" ? runtime.selectedRowIds : [],
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
  });
  if (settings.format === "pdf") {
    runtime.print(
      printableHtml({
        title: runtime.title,
        subtitle: `${rows.length} ${rows.length === 1 ? "record" : "records"}`,
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
    new Blob([csvFromMatrix(matrix)], { type: "text/csv;charset=utf-8" }),
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
