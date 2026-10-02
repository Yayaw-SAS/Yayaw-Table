/**
 * CSV export utilities shared by toolbar export and bulk export.
 */
import {
  type CsvSeparator,
  csvField,
  isNumericExportValue,
} from "./export-model";

const DEFAULT_SEPARATOR: CsvSeparator = ",";
const UTF8_BOM = "\uFEFF";

interface ExportColumnDefinition {
  header?: string;
  id: string;
  type?: string;
}

export interface CsvExportColumn {
  id: string;
  label: string;
  /** Numeric text of a `number` column is never treated as a formula. */
  type?: string;
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
  separator?: CsvSeparator;
}

interface ExportRowsAsCsvOptions {
  columns: CsvExportColumn[];
  fileName?: string;
  rows: Record<string, unknown>[];
  separator?: CsvSeparator;
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
 * Pass only exportable definitions (`isExportableColumn`) for a file export.
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
      ...(definition?.type ? { type: definition.type } : {}),
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
    .map((column) => csvField(column.label, separator))
    .join(separator);

  // Text that would run as a formula gets an apostrophe; numbers do not.
  const dataLines = rows.map((row) => {
    return columns
      .map((column) => {
        const rawValue = row[column.id];
        return csvField(
          normalizeValueForCsv(rawValue),
          separator,
          isNumericExportValue(rawValue, column.type)
        );
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
