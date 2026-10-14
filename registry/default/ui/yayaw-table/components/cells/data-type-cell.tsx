"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ColumnDefinition } from "../../config/helpers";
import { useTagCatalog } from "../../providers/tag-catalog-provider";
import type { DateDisplayPreset } from "../../types/date-types";
import { avatarNameOf, resolveAvatarConfig } from "../../utils/initials-avatar";
import {
  dataTypeOptionLabel,
  resolveDataType,
} from "../../utils/table-contracts";
import { rowNumberFormat } from "../../utils/value-format";
import { BooleanCell } from "./boolean-cell";
import { CodeCell } from "./code-cell";
import { DateCell } from "./date-cell";
import { ImageCell } from "./image-cell";
import { RecordAvatar } from "./initials-avatar";
import { JsonCell } from "./json-cell";
import { LocationCell } from "./location-cell";
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
  coloredTags,
}: {
  column: ColumnDefinition;
  row: Record<string, unknown>;
  value: unknown;
  fallbackDateDisplayPreset?: DateDisplayPreset;
  coloredTags?: boolean;
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
  const avatar =
    type === "image" ? resolveAvatarConfig(column.avatar) : undefined;
  if (avatar) {
    return (
      <ImageCell
        alt={column.header}
        avatarName={avatarNameOf(row, avatar.nameColumn)}
        avatarShape={avatar.shape}
        value={value}
      />
    );
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
          dateDisplayPreset={column.dateDisplayPreset}
          dateFormat={column.dateFormat}
          fallbackDateDisplayPreset={fallbackDateDisplayPreset}
          hour12={column.hour12}
          timeZone={column.timeZone}
          value={value as string | number | Date}
        />
      );
    case "image":
      return <ImageCell alt={column.header} value={value} />;
    case "json":
      return (
        <JsonCell
          maxItems={column.maxItems as number | undefined}
          value={value}
        />
      );
    case "location":
      return <LocationCell value={value} />;
    case "number":
      return (
        <NumberCell
          numberFormat={rowNumberFormat(
            column.numberFormat as
              | import("../../utils/number-format").NumberFormatConfig
              | undefined,
            row
          )}
          value={value as string | number}
        />
      );
    case "url":
      return (
        <UrlCell
          displayMode={
            column.urlDisplayMode === "row-link"
              ? "full"
              : column.urlDisplayMode
          }
          value={value}
        />
      );
    case "select":
    case "multiSelect":
    case "tag":
      if (column.displayVariant === "avatars") {
        return <OptionAvatars column={column} value={value} />;
      }
      return (
        <OptionTags
          coloredTags={column.coloredTags ?? coloredTags}
          column={column}
          value={value}
        />
      );
    default:
      return (
        <StringCell showQuotes={column.showQuotes === true} value={value} />
      );
  }
}

const optionOf = (value: unknown, options: unknown) =>
  Array.isArray(options)
    ? (options as { value?: unknown; color?: unknown }[]).find((option) =>
        Object.is(option?.value, value)
      )
    : undefined;

/**
 * Option values as overlapping avatars (`displayVariant: "avatars"`): each
 * option's `image`, or its initials, named by a tooltip and for screen readers.
 */
function OptionAvatars({
  column,
  value,
}: {
  column: ColumnDefinition;
  value: unknown;
}) {
  const values = (Array.isArray(value) ? value : [value]).filter(
    (item) => item !== null && item !== undefined && item !== ""
  );
  return (
    <TooltipProvider>
      <span className="yayaw-avatar-stack" data-avatar-stack="">
        {values.map((item) => {
          const label = dataTypeOptionLabel(item, column.options);
          const image = (optionOf(item, column.options) as { image?: unknown })
            ?.image;
          return (
            <Tooltip key={`${typeof item}:${String(item)}`}>
              <TooltipTrigger
                render={
                  <span
                    aria-label={label}
                    className="yayaw-avatar-stack-item"
                    role="img"
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach each name through its tooltip.
                    tabIndex={0}
                  />
                }
              >
                <RecordAvatar
                  name={label}
                  source={typeof image === "string" ? image : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

/** Option values as tags: their labels and their own colors. */
function OptionTags({
  column,
  coloredTags,
  value,
}: {
  column: ColumnDefinition;
  coloredTags?: boolean;
  value: unknown;
}) {
  const catalog = useTagCatalog();
  // A tags column shows placeholders until its catalog names its ids.
  const loading =
    Boolean(column.tags) && catalog?.status(column.id) === "loading";
  const values = Array.isArray(value) ? value : [value];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {values.map((item) => {
        const key = `${typeof item}:${String(item)}`;
        const option = optionOf(item, column.options);
        if (loading && !option && item !== null && item !== "") {
          return (
            <span className="yayaw-tag-pending" key={key}>
              <span className="sr-only">{catalog?.labels.loading}</span>
            </span>
          );
        }
        return (
          <TagCell
            color={typeof option?.color === "string" ? option.color : undefined}
            coloredTags={coloredTags}
            colorValue={String(item)}
            key={key}
            tagColorMap={column.tagColorMap}
            value={dataTypeOptionLabel(item, column.options)}
          />
        );
      })}
    </span>
  );
}
