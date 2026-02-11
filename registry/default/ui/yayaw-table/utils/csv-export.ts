/**
 * CSV export utilities shared by toolbar export and bulk export.
 */

const DEFAULT_SEPARATOR = ",";
const UTF8_BOM = "\uFEFF";

interface ExportColumnDefinition {
  header?: string;
  id: string;
}

export interface CsvExportColumn {
  id: string;
  label: string;
}

interface BuildCsvExportColumnsOptions {
  columnDefinitions: ExportColumnDefinition[];
  columnOrder?: string[];
  defaultVisibleColumns?: string[];
  excludedColumnIds?: string[];
  visibility?: Record<string, boolean>;
}

interface CreateCsvContentOptions {
  columns: CsvExportColumn[];
  rows: Record<string, unknown>[];
  separator?: string;
}

interface ExportRowsAsCsvOptions {
  columns: CsvExportColumn[];
  fileName?: string;
  rows: Record<string, unknown>[];
  separator?: string;
  tableId: string;
}

const DEFAULT_EXCLUDED_COLUMN_IDS = ["select", "actions"] as const;

const normalizeValueForCsv = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const escapeCsvCell = (value: string, separator: string): string => {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");

  const escaped = value.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const padTwoDigits = (value: number): string => {
  return String(value).padStart(2, "0");
};

export const getDefaultCsvFileName = (tableId: string): string => {
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${padTwoDigits(
    now.getMonth() + 1
  )}-${padTwoDigits(now.getDate())}`;
  return `${tableId}-${formattedDate}.csv`;
};

/**
 * Build export columns from config order + visibility, while excluding system columns.
 */
export const buildCsvExportColumns = ({
  columnDefinitions,
  columnOrder = [],
  defaultVisibleColumns = [],
  excludedColumnIds = [...DEFAULT_EXCLUDED_COLUMN_IDS],
  visibility = {},
}: BuildCsvExportColumnsOptions): CsvExportColumn[] => {
  const definitionsById = new Map<string, ExportColumnDefinition>();
  for (const definition of columnDefinitions) {
    definitionsById.set(definition.id, definition);
  }

  const orderedIds: string[] = [];
  for (const id of columnOrder) {
    if (definitionsById.has(id) && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  for (const definition of columnDefinitions) {
    if (!orderedIds.includes(definition.id)) {
      orderedIds.push(definition.id);
    }
  }

  const hasExplicitVisibility = Object.keys(visibility).length > 0;
  const defaultVisibleSet = new Set(defaultVisibleColumns);
  const excludedSet = new Set(excludedColumnIds);

  const columns: CsvExportColumn[] = [];
  for (const id of orderedIds) {
    if (excludedSet.has(id)) {
      continue;
    }

    let isVisible = true;
    if (hasExplicitVisibility) {
      isVisible = visibility[id] !== false;
    } else if (defaultVisibleSet.size > 0) {
      isVisible = defaultVisibleSet.has(id);
    }

    if (!isVisible) {
      continue;
    }

    const definition = definitionsById.get(id);
    columns.push({
      id,
      label: definition?.header ?? id,
    });
  }

  return columns;
};

export const createCsvContent = ({
  columns,
  rows,
  separator = DEFAULT_SEPARATOR,
}: CreateCsvContentOptions): string => {
  const headerLine = columns
    .map((column) => escapeCsvCell(column.label, separator))
    .join(separator);

  const dataLines = rows.map((row) => {
    return columns
      .map((column) => {
        const rawValue = row[column.id];
        const normalizedValue = normalizeValueForCsv(rawValue);
        return escapeCsvCell(normalizedValue, separator);
      })
      .join(separator);
  });

  const csvBody = [headerLine, ...dataLines].join("\n");
  return `${UTF8_BOM}${csvBody}`;
};

export const downloadCsvFile = (content: string, fileName: string): void => {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportRowsAsCsv = ({
  columns,
  fileName,
  rows,
  separator = DEFAULT_SEPARATOR,
  tableId,
}: ExportRowsAsCsvOptions): void => {
  const csvContent = createCsvContent({
    columns,
    rows,
    separator,
  });

  downloadCsvFile(csvContent, fileName ?? getDefaultCsvFileName(tableId));
};
