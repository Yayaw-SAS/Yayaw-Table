"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ColumnMappingRow } from "../../utils/field-matching";
import { type ViewSettingField, ViewSettingsPanel } from "./view-settings-panel";

/** A select shown with the mapping (key field, separator, mode…). */
export type ColumnMappingField = Omit<ViewSettingField, "onChange"> & {
  onChange?: (value: string) => void;
};

/** The first rows as they will be written; invalid cells carry their error. */
export interface ColumnMappingPreview {
  label: string;
  columns: { id: string; header: string }[];
  rows: {
    index: number;
    cells: { columnId: string; text: string; error?: string }[];
  }[];
}

/** Sample value and conversion badge under a mapping row. */
function RowDetails({ row }: { row: ColumnMappingRow }) {
  if (!(row.sample || row.badge)) {
    return null;
  }
  return (
    <div
      className="-mt-2 flex min-w-0 items-center justify-between gap-2 text-muted-foreground text-xs"
      data-mapping-details={row.id}
    >
      <span className="min-w-0 truncate" data-mapping-sample>
        {row.sample}
      </span>
      {row.badge ? (
        <span
          className={cn(
            "shrink-0 rounded-sm border px-1.5 py-0.5 leading-none",
            row.badge.invalid
              ? "border-destructive/40 text-destructive"
              : "border-border"
          )}
          data-invalid={row.badge.invalid || undefined}
          data-mapping-badge
        >
          {row.badge.label}
        </span>
      ) : null}
    </div>
  );
}

/** A compact table of the first rows, invalid cells highlighted with their error as a title. */
function MappingPreview({ preview }: { preview: ColumnMappingPreview }) {
  if (preview.columns.length === 0) {
    return null;
  }
  return (
    <div className="grid min-w-0 gap-1.5" data-mapping-preview>
      <h3 className="font-medium text-sm">{preview.label}</h3>
      <div className="max-h-48 overflow-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/60">
            <tr>
              {preview.columns.map((column) => (
                <th
                  className="whitespace-nowrap px-2 py-1 text-left font-medium"
                  key={column.id}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr className="border-t" key={row.index}>
                {row.cells.map((cell) => (
                  <td
                    className={cn(
                      "max-w-40 truncate whitespace-nowrap px-2 py-1",
                      cell.error && "bg-destructive/10 text-destructive"
                    )}
                    data-invalid={cell.error ? true : undefined}
                    key={cell.columnId}
                    title={cell.error ? `${cell.text} — ${cell.error}` : cell.text}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const withHandler = (
  field: ColumnMappingField,
  onChange: (id: string, value: string) => void
): ViewSettingField => ({
  ...field,
  onChange: field.onChange ?? ((value) => onChange(field.id, value)),
});

/**
 * Column mapping, in either direction: each row pairs a field (a source
 * header, a table column) with a choice of what it goes to, with a sample
 * value, a badge counting values that will not convert, an optional key
 * select and a preview. Other settings of the same screen go before and
 * after, so touch layouts open every choice as one full-screen list.
 */
export function ColumnMapping({
  after = [],
  before = [],
  children,
  intro,
  keyField,
  onChange,
  preview,
  rows,
}: {
  after?: ColumnMappingField[];
  before?: ColumnMappingField[];
  children?: ReactNode;
  /** Content above the settings, hidden while a choice list is open. */
  intro?: ReactNode;
  /** "Match existing records by": which column identifies records. */
  keyField?: ColumnMappingField;
  onChange: (id: string, value: string) => void;
  preview?: ColumnMappingPreview;
  rows: ColumnMappingRow[];
}) {
  const fields: ViewSettingField[] = [
    ...before.map((field) => withHandler(field, onChange)),
    ...rows.map((row) => ({
      id: row.id,
      label: row.label,
      value: row.value,
      options: row.options,
      heading: row.heading,
      inline: true,
      after: <RowDetails row={row} />,
      onChange: (value: string) => onChange(row.id, value),
    })),
    ...(keyField ? [withHandler(keyField, onChange)] : []),
    ...after.map((field) => withHandler(field, onChange)),
  ];
  return (
    <div className="grid min-w-0 gap-3" data-column-mapping>
      <ViewSettingsPanel fields={fields} intro={intro}>
        {preview ? <MappingPreview preview={preview} /> : null}
        {children}
      </ViewSettingsPanel>
    </div>
  );
}
