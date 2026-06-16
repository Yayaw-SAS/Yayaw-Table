"use client";

import type { Row, Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { ImageIcon } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { TableGalleryConfig } from "../types/display-types";
import { shouldActivateCardFromKeyboard } from "../utils/card-interaction";
import {
  getImageFallbackInitial,
  resolveImageSource,
} from "../utils/image-source";

const SYSTEM_COLUMN_IDS = new Set(["actions", "select"]);

const GALLERY_ASPECT_RATIO_CLASS = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[16/10]",
} as const;

const GALLERY_CARD_SIZE_CLASS = {
  large: "grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]",
  medium: "grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
  small: "grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]",
} as const;

const GALLERY_IMAGE_FIT_CLASS = {
  contain: "object-contain",
  cover: "object-cover",
} as const;

interface DataTableGalleryViewProps<TData extends Record<string, unknown>> {
  className?: string;
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableGalleryConfig;
  emptyState: ReactNode;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  table: TanStackTable<TData>;
}

interface GalleryCardProps<TData extends Record<string, unknown>> {
  actionsCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  aspectRatio: NonNullable<TableGalleryConfig["aspectRatio"]>;
  imageColumnId?: string;
  imageFit: NonNullable<TableGalleryConfig["imageFit"]>;
  isActive: boolean;
  isClickable: boolean;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  row: Row<TData>;
  selectionCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  showCardLabels: boolean;
  titleCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  titleColumnId?: string;
}

interface GalleryCardPropertiesProps<TData extends Record<string, unknown>> {
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  showCardLabels: boolean;
}

export function resolveGalleryDisplayConfig(
  config: TableGalleryConfig | undefined
): Required<
  Pick<
    TableGalleryConfig,
    "aspectRatio" | "cardSize" | "imageFit" | "showCardLabels"
  >
> &
  Omit<
    TableGalleryConfig,
    "aspectRatio" | "cardSize" | "imageFit" | "showCardLabels"
  > {
  return {
    ...config,
    aspectRatio: config?.aspectRatio ?? "wide",
    cardSize: config?.cardSize ?? "medium",
    imageFit: config?.imageFit ?? "cover",
    showCardLabels: config?.showCardLabels === true,
  };
}

export function shouldShowGalleryCardLabels(
  config: TableGalleryConfig | undefined
): boolean {
  return config?.showCardLabels === true;
}

export function resolveGalleryImageColumnId({
  columnDefinitions,
  config,
}: {
  columnDefinitions: TableCatalogueColumnConfig[];
  config: TableGalleryConfig | undefined;
}): string | undefined {
  if (config?.imageColumn) {
    return config.imageColumn;
  }

  return columnDefinitions.find((column) => column.type === "image")?.id;
}

export function resolveGalleryTitleColumnId({
  columnDefinitions,
  config,
}: {
  columnDefinitions: TableCatalogueColumnConfig[];
  config: TableGalleryConfig | undefined;
}): string | undefined {
  if (config?.titleColumn) {
    return config.titleColumn;
  }

  return columnDefinitions.find((column) => {
    return column.type !== "image" && !SYSTEM_COLUMN_IDS.has(column.id);
  })?.id;
}

export function resolveGalleryPropertyColumnIds({
  columnDefinitions,
  config,
  imageColumnId,
  titleColumnId,
}: {
  columnDefinitions: TableCatalogueColumnConfig[];
  config: TableGalleryConfig | undefined;
  imageColumnId?: string;
  titleColumnId?: string;
}): string[] {
  const availableColumnIds = columnDefinitions
    .filter((column) => {
      return (
        !SYSTEM_COLUMN_IDS.has(column.id) &&
        column.id !== titleColumnId &&
        column.id !== imageColumnId
      );
    })
    .map((column) => column.id);

  if (config?.cardColumnIds === undefined) {
    return availableColumnIds;
  }

  const availableColumnIdSet = new Set(availableColumnIds);
  return config.cardColumnIds.filter((columnId) =>
    availableColumnIdSet.has(columnId)
  );
}

function getStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getColumnLabel(
  columnDefinitions: TableCatalogueColumnConfig[],
  columnId: string
): string {
  return (
    columnDefinitions.find((definition) => definition.id === columnId)?.header ??
    columnId
  );
}

function getCellByColumnId<TData extends Record<string, unknown>>(
  row: Row<TData>,
  columnId: string | undefined
): ReturnType<Row<TData>["getVisibleCells"]>[number] | undefined {
  if (!columnId) {
    return;
  }

  return row.getVisibleCells().find((cell) => cell.column.id === columnId);
}

function getGalleryPropertyCells<TData extends Record<string, unknown>>({
  cardColumnIds,
  imageColumnId,
  row,
  titleColumnId,
}: {
  cardColumnIds?: string[];
  imageColumnId?: string;
  row: Row<TData>;
  titleColumnId?: string;
}): ReturnType<Row<TData>["getVisibleCells"]> {
  const cells = row.getVisibleCells().filter((cell) => {
    return (
      !SYSTEM_COLUMN_IDS.has(cell.column.id) &&
      cell.column.id !== titleColumnId &&
      cell.column.id !== imageColumnId
    );
  });

  if (cardColumnIds === undefined) {
    return cells;
  }

  const cellByColumnId = new Map(cells.map((cell) => [cell.column.id, cell]));
  return cardColumnIds
    .map((columnId) => cellByColumnId.get(columnId))
    .filter(Boolean) as ReturnType<Row<TData>["getVisibleCells"]>;
}

function getGalleryPropertyValueClassName(showCardLabels: boolean): string {
  if (showCardLabels) {
    return "min-w-0 truncate text-xs";
  }

  return "min-w-0 max-w-full truncate text-muted-foreground text-xs";
}

function GalleryCardProperties<TData extends Record<string, unknown>>({
  propertyCells,
  propertyLabels,
  showCardLabels,
}: GalleryCardPropertiesProps<TData>) {
  if (propertyCells.length === 0) {
    return null;
  }

  if (showCardLabels) {
    return (
      <dl className="mt-3 space-y-2">
        {propertyCells.map((cell) => (
          <div
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2"
            key={cell.id}
          >
            <dt className="truncate text-muted-foreground text-xs">
              {propertyLabels.get(cell.column.id) ?? cell.column.id}
            </dt>
            <dd className={getGalleryPropertyValueClassName(showCardLabels)}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {propertyCells.map((cell) => {
        const label = propertyLabels.get(cell.column.id) ?? cell.column.id;
        return (
          <div className="flex min-w-0 items-center" key={cell.id}>
            <span className="sr-only">{label}: </span>
            <div className={getGalleryPropertyValueClassName(showCardLabels)}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GalleryCardMedia({
  aspectRatio,
  imageFit,
  source,
  title,
}: {
  aspectRatio: NonNullable<TableGalleryConfig["aspectRatio"]>;
  imageFit: NonNullable<TableGalleryConfig["imageFit"]>;
  source?: string;
  title: string;
}) {
  const [hasError, setHasError] = useState(false);
  const resolvedSource = hasError ? undefined : source;
  const fallbackInitial = getImageFallbackInitial(title);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-t-md bg-muted",
        GALLERY_ASPECT_RATIO_CLASS[aspectRatio]
      )}
    >
      {resolvedSource ? (
        // biome-ignore lint/performance/noImgElement: registry consumers should not need Next.js image domain configuration.
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps broken media to the non-interactive fallback.
        <img
          alt={title}
          className={cn("h-full w-full", GALLERY_IMAGE_FIT_CLASS[imageFit])}
          height={400}
          loading="lazy"
          onError={() => setHasError(true)}
          src={resolvedSource}
          width={640}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <ImageIcon aria-hidden className="h-6 w-6" />
            <span className="font-medium text-lg">{fallbackInitial}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DataTableGalleryCard<TData extends Record<string, unknown>>({
  actionsCell,
  aspectRatio,
  imageColumnId,
  imageFit,
  isActive,
  isClickable,
  onRowClick,
  propertyCells,
  propertyLabels,
  row,
  selectionCell,
  showCardLabels,
  titleCell,
  titleColumnId,
}: GalleryCardProps<TData>) {
  const titleContent = titleCell
    ? flexRender(titleCell.column.columnDef.cell, titleCell.getContext())
    : getStringValue(titleColumnId ? row.original[titleColumnId] : row.id) ||
      row.id;
  const title =
    getStringValue(titleColumnId ? row.original[titleColumnId] : row.id) ||
    row.id;
  const imageSource = resolveImageSource(
    imageColumnId ? row.original[imageColumnId] : undefined
  );

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: clickable cards keep nested selection/actions valid and provide keyboard activation.
    <article
      className={cn(
        "group overflow-hidden rounded-md border bg-background shadow-xs transition",
        isClickable && "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
        isActive && "border-primary/50 shadow-[inset_2px_0_0_hsl(var(--primary))]"
      )}
      data-active={isActive ? "true" : undefined}
      onClick={
        isClickable
          ? (event) => {
              onRowClick?.(row, event);
            }
          : undefined
      }
      onKeyDown={
        isClickable
          ? (event) => {
              if (shouldActivateCardFromKeyboard(event)) {
                event.preventDefault();
                event.currentTarget.click();
              }
            }
          : undefined
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <GalleryCardMedia
        aspectRatio={aspectRatio}
        imageFit={imageFit}
        source={imageSource}
        title={title}
      />
      <div className="p-3">
        <div className="flex items-start gap-2">
          {selectionCell ? (
            <div className="mt-0.5 shrink-0" data-column-id="select">
              {flexRender(
                selectionCell.column.columnDef.cell,
                selectionCell.getContext()
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 font-medium text-sm">
              {titleContent}
            </div>
          </div>
          {actionsCell ? (
            <div className="shrink-0" data-column-id="actions">
              {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
            </div>
          ) : null}
        </div>

        <GalleryCardProperties
          propertyCells={propertyCells}
          propertyLabels={propertyLabels}
          showCardLabels={showCardLabels}
        />
      </div>
    </article>
  );
}

export function DataTableGalleryView<TData extends Record<string, unknown>>({
  className,
  columnDefinitions,
  config,
  emptyState,
  isRowActive,
  isRowClickable,
  onRowClick,
  table,
}: DataTableGalleryViewProps<TData>) {
  const rows = table.getRowModel().rows as Row<TData>[];
  const resolvedConfig = resolveGalleryDisplayConfig(config);
  const imageColumnId = resolveGalleryImageColumnId({
    columnDefinitions,
    config: resolvedConfig,
  });
  const titleColumnId = resolveGalleryTitleColumnId({
    columnDefinitions,
    config: resolvedConfig,
  });
  const propertyLabels = useMemo(() => {
    return new Map(
      columnDefinitions.map((definition) => [
        definition.id,
        getColumnLabel(columnDefinitions, definition.id),
      ])
    );
  }, [columnDefinitions]);

  if (rows.length === 0) {
    return <div className="rounded-md border">{emptyState}</div>;
  }

  return (
    <div className={cn("rounded-md border bg-background p-3", className)}>
      <div
        className={cn(
          "grid gap-3",
          GALLERY_CARD_SIZE_CLASS[resolvedConfig.cardSize]
        )}
      >
        {rows.map((row) => {
          const visibleCells = row.getVisibleCells();
          return (
            <DataTableGalleryCard
              actionsCell={visibleCells.find((cell) => cell.column.id === "actions")}
              aspectRatio={resolvedConfig.aspectRatio}
              imageColumnId={imageColumnId}
              imageFit={resolvedConfig.imageFit}
              isActive={isRowActive?.(row) ?? false}
              isClickable={isRowClickable?.(row) ?? false}
              key={row.id}
              onRowClick={onRowClick}
              propertyCells={getGalleryPropertyCells({
                cardColumnIds: resolvedConfig.cardColumnIds,
                imageColumnId,
                row,
                titleColumnId,
              })}
              propertyLabels={propertyLabels}
              row={row}
              selectionCell={visibleCells.find((cell) => cell.column.id === "select")}
              showCardLabels={shouldShowGalleryCardLabels(resolvedConfig)}
              titleCell={getCellByColumnId(row, titleColumnId)}
              titleColumnId={titleColumnId}
            />
          );
        })}
      </div>
    </div>
  );
}
