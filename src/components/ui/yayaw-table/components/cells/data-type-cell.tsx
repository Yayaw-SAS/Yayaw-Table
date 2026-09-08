"use client";

import type { ColumnDefinition } from "../../config/helpers";
import type { DateDisplayPreset } from "../../types/date-types";
import {
  dataTypeOptionLabel,
  resolveDataType,
} from "../../utils/table-contracts";
import { BooleanCell } from "./boolean-cell";
import { CodeCell } from "./code-cell";
import { DateCell } from "./date-cell";
import { ImageCell } from "./image-cell";
import { JsonCell } from "./json-cell";
import { NumberCell } from "./number-cell";
import { StringCell } from "./string-cell";
import { TagCell } from "./tag-cell";
import { UrlCell } from "./url-cell";

/** Table cells and cards receive the same column declaration, including dynamic row types. */
export function DataTypeCell({
  column,
  row,
  value,
  fallbackDateDisplayPreset,
}: {
  column: ColumnDefinition;
  row: Record<string, unknown>;
  value: unknown;
  fallbackDateDisplayPreset?: DateDisplayPreset;
}) {
  const type = resolveDataType(column.type, row, column.typeKey);
  const renderers = column.customRenderers as
    | Record<
        string,
        (value: unknown, row: Record<string, unknown>) => React.ReactNode
      >
    | undefined;
  const custom =
    column.cellRenderer?.(value, row) ?? renderers?.[type]?.(value, row);
  if (custom !== undefined && custom !== null) {
    return custom;
  }
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (type) {
    case "boolean":
      return <BooleanCell value={value === true} />;
    case "code":
      return <CodeCell value={value} />;
    case "date":
      return (
        <DateCell
          value={value as string | number | Date}
          dateDisplayPreset={column.dateDisplayPreset}
          dateFormat={column.dateFormat}
          fallbackDateDisplayPreset={fallbackDateDisplayPreset}
        />
      );
    case "image":
      return <ImageCell value={value} alt={column.header} />;
    case "json":
      return (
        <JsonCell
          value={value}
          maxItems={column.maxItems as number | undefined}
        />
      );
    case "number":
      return (
        <NumberCell
          value={value as string | number}
          numberFormat={
            column.numberFormat as
              | import("../../utils/number-format").NumberFormatConfig
              | undefined
          }
        />
      );
    case "url":
      return (
        <UrlCell
          value={value}
          displayMode={
            column.urlDisplayMode === "row-link"
              ? "full"
              : column.urlDisplayMode
          }
        />
      );
    case "select":
    case "multiSelect":
    case "tag": {
      const values = Array.isArray(value) ? value : [value];
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {values.map((item) => {
            const label = dataTypeOptionLabel(item, column.options);
            const color = column.tagColorMap?.[String(item)];
            return (
              <TagCell
                key={`${typeof item}:${String(item)}`}
                value={label}
                tagColorMap={color ? { [label]: color } : undefined}
              />
            );
          })}
        </span>
      );
    }
    default:
      return (
        <StringCell value={value} showQuotes={column.showQuotes === true} />
      );
  }
}
