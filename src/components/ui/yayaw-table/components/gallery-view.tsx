"use client";

import { ExternalLink, ImageIcon, Pencil } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { Row, Table as TanStackTable } from "../tanstack";
import { flexRender } from "../tanstack";
import type { TableGalleryConfig } from "../types/display-types";
import { shouldActivateCardFromKeyboard } from "../utils/card-interaction";
import {
  getCompactCardPropertiesClassName,
  getCompactCardPropertyClassName,
} from "../utils/card-properties";
import {
  getImageFallbackInitial,
  resolveImageSource,
} from "../utils/image-source";
import {
  galleryAspectRatio,
  resolveGalleryMedia,
  type TableGalleryPreviewSize,
  type TableMediaSource,
} from "../utils/media-contract";
import {
  attachMediaThumbnail,
  mediaViewerLabels,
  openMediaViewer,
} from "../utils/media-viewer";
import {
  isSelectionModifiedClick,
  selectRowWithRange,
} from "../utils/row-selection-interaction";
import "../utils/media-viewer.css";
import { fieldText } from "../utils/table-contracts";
import { TableTooltip } from "../utils/table-tooltip";

const SYSTEM_COLUMN_IDS = new Set(["actions", "select"]);
const EMPTY_GROUP_VALUE = "";
const EMPTY_GROUP_LABEL = "No value";

const GALLERY_CARD_SIZE_CLASS = {
  large: "grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]",
  medium: "grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]",
  small: "grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))]",
} as const;

const GALLERY_IMAGE_FIT_CLASS = {
  contain: "object-contain",
  cover: "object-cover",
} as const;

interface DataTableGalleryViewProps<TData extends Record<string, unknown>> {
  locale?: string;
  onOpenRowDetails?: (row: TData) => void;
  canEditRow?: (row: Row<TData>) => boolean;
  className?: string;
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableGalleryConfig;
  editRowLabel?: string;
  emptyState: ReactNode;
  getRowLinkUrl?: (row: Row<TData>) => string | undefined;
  groupBy?: string;
  groupLabel?: string;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  linkRowLabel?: string;
  onEditRow?: (row: Row<TData>, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRowLink?: (
    row: Row<TData>,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  table: TanStackTable<TData>;
}

interface GalleryCardProps<TData extends Record<string, unknown>> {
  mediaSource?: TableMediaSource;
  nativeMedia?: boolean;
  previewLabel: string;
  hoverPreview?: boolean;
  previewSize?: TableGalleryPreviewSize;
  onPreviewMedia: (row: Row<TData>, target: HTMLElement) => void;
  table: TanStackTable<TData>;
  renderMedia?: TableGalleryConfig["renderMedia"];
  renderProperties?: TableGalleryConfig["renderProperties"];
  actionsCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  aspectRatio: NonNullable<TableGalleryConfig["aspectRatio"]>;
  canEditRow: boolean;
  editRowLabel: string;
  imageColumnId?: string;
  imageFit: NonNullable<TableGalleryConfig["imageFit"]>;
  isActive: boolean;
  isClickable: boolean;
  linkRowLabel: string;
  linkUrl?: string;
  onEditRow?: (row: Row<TData>, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRowLink?: (
    row: Row<TData>,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  row: Row<TData>;
  selectionCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  showCardLabels: boolean;
  titleCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  /** The title as the table shows it, for names, alt text and fallbacks. */
  titleText: string;
}

interface GalleryCardPropertiesProps<TData extends Record<string, unknown>> {
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  showCardLabels: boolean;
}

export interface GalleryGroup<TData extends Record<string, unknown>> {
  id: string;
  label: string;
  rows: Row<TData>[];
  value: string;
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
  if (config?.imageColumn !== undefined) {
    return config.imageColumn || undefined;
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

export function resolveGalleryLinkColumnId({
  columnDefinitions,
}: {
  columnDefinitions: TableCatalogueColumnConfig[];
}): string | undefined {
  const rowLinkColumn = columnDefinitions.find(
    (column) => column.type === "url" && column.urlDisplayMode === "row-link"
  );

  return (
    rowLinkColumn?.id ??
    columnDefinitions.find((column) => column.type === "url")?.id
  );
}

export function resolveGalleryLinkUrl(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }

  const url = String(value);

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    return;
  }
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


function getGalleryGroupValue(value: unknown): string {
  if (value === null || value === undefined) {
    return EMPTY_GROUP_VALUE;
  }

  return String(value);
}

export function createGalleryGroups<TData extends Record<string, unknown>>({
  groupBy,
  labelOf,
  rows,
}: {
  groupBy: string;
  /** Group headings read the value as the table shows it. */
  labelOf?: (value: unknown) => string;
  rows: Row<TData>[];
}): GalleryGroup<TData>[] {
  if (!groupBy) {
    return [
      {
        id: "gallery-group-all",
        label: "",
        rows,
        value: "",
      },
    ];
  }

  const groups: GalleryGroup<TData>[] = [];
  const groupByValue = new Map<string, GalleryGroup<TData>>();

  for (const row of rows) {
    const raw = row.original[groupBy];
    const value = getGalleryGroupValue(raw);
    const existingGroup = groupByValue.get(value);
    if (existingGroup) {
      existingGroup.rows.push(row);
      continue;
    }

    const group = {
      id: `gallery-group-${value || "empty"}`,
      label: (value && (labelOf?.(raw) || value)) || EMPTY_GROUP_LABEL,
      rows: [row],
      value,
    };
    groupByValue.set(value, group);
    groups.push(group);
  }

  return groups;
}

function getColumnLabel(
  columnDefinitions: TableCatalogueColumnConfig[],
  columnId: string
): string {
  return (
    columnDefinitions.find((definition) => definition.id === columnId)
      ?.header ?? columnId
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
  groupBy,
  imageColumnId,
  row,
  titleColumnId,
}: {
  cardColumnIds?: string[];
  groupBy?: string;
  imageColumnId?: string;
  row: Row<TData>;
  titleColumnId?: string;
}): ReturnType<Row<TData>["getVisibleCells"]> {
  const cells = row.getVisibleCells().filter((cell) => {
    return (
      !SYSTEM_COLUMN_IDS.has(cell.column.id) &&
      cell.column.id !== titleColumnId &&
      cell.column.id !== imageColumnId &&
      cell.column.id !== groupBy
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
    <div className={getCompactCardPropertiesClassName()}>
      {propertyCells.map((cell) => {
        const label = propertyLabels.get(cell.column.id) ?? cell.column.id;
        return (
          <div className={getCompactCardPropertyClassName()} key={cell.id}>
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
  previewSize,
}: {
  previewSize?: TableGalleryPreviewSize;
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
      className="relative overflow-hidden rounded-t-md bg-muted"
      style={{ aspectRatio: galleryAspectRatio(aspectRatio, previewSize) }}
    >
      {resolvedSource ? (
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

function GalleryCardActions<TData extends Record<string, unknown>>({
  canEditRow,
  editRowLabel,
  linkRowLabel,
  linkUrl,
  onEditRow,
  onOpenRowLink,
  row,
}: {
  canEditRow: boolean;
  editRowLabel: string;
  linkRowLabel: string;
  linkUrl?: string;
  onEditRow?: (row: Row<TData>, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenRowLink?: (
    row: Row<TData>,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  row: Row<TData>;
}) {
  const canOpenLink = Boolean(linkUrl && onOpenRowLink);
  const canEdit = canEditRow && Boolean(onEditRow);

  if (!(canOpenLink || canEdit)) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {canOpenLink ? (
        <TableTooltip label={linkRowLabel}>
          <Button
            aria-label={linkRowLabel}
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRowLink?.(row, event);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ExternalLink aria-hidden className="size-4" />
          </Button>
        </TableTooltip>
      ) : null}
      {canEdit ? (
        <TableTooltip label={editRowLabel}>
          <Button
            aria-label={editRowLabel}
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onEditRow?.(row, event);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
        </TableTooltip>
      ) : null}
    </div>
  );
}

function NativeGalleryMedia({
  source,
  title,
  imageFit,
  hoverPreview,
  previewLabel,
  onOpen,
}: {
  source?: TableMediaSource;
  title: string;
  imageFit: "cover" | "contain";
  hoverPreview?: boolean;
  previewLabel: string;
  onOpen: (target: HTMLElement) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) {
      return;
    }
    const element = host.current;
    return attachMediaThumbnail(element, source, title, {
      fit: imageFit,
      hoverPreview,
      previewLabel,
      onOpen: () => onOpen(element.querySelector("button") ?? element),
    });
  }, [source, title, imageFit, hoverPreview, previewLabel, onOpen]);
  return <div className="h-full w-full" ref={host} />;
}

function GalleryCardVisual<TData extends Record<string, unknown>>({
  title,
  imageSource,
  ...props
}: Pick<
  GalleryCardProps<TData>,
  | "nativeMedia"
  | "renderMedia"
  | "mediaSource"
  | "aspectRatio"
  | "previewSize"
  | "imageFit"
  | "hoverPreview"
  | "previewLabel"
  | "onPreviewMedia"
  | "row"
> & { title: string; imageSource?: string }) {
  const {
    nativeMedia,
    renderMedia,
    mediaSource,
    aspectRatio,
    previewSize,
    imageFit,
    hoverPreview,
    previewLabel,
    onPreviewMedia,
    row,
  } = props;
  if (renderMedia) {
    return (
      <div
        className="relative overflow-hidden rounded-t-md bg-muted"
        style={{ aspectRatio: galleryAspectRatio(aspectRatio, previewSize) }}
      >
        {renderMedia({
          row: row.original,
          title,
          source: imageSource,
          imageFit,
          aspectRatio,
        })}
      </div>
    );
  }
  if (nativeMedia) {
    return (
      <div
        className="relative overflow-hidden rounded-t-md bg-muted"
        style={{ aspectRatio: galleryAspectRatio(aspectRatio, previewSize) }}
      >
        <NativeGalleryMedia
          hoverPreview={hoverPreview}
          imageFit={imageFit}
          onOpen={(target) => onPreviewMedia(row, target)}
          previewLabel={previewLabel}
          source={mediaSource}
          title={title}
        />
      </div>
    );
  }
  return (
    <GalleryCardMedia
      aspectRatio={aspectRatio}
      imageFit={imageFit}
      previewSize={previewSize}
      source={imageSource}
      title={title}
    />
  );
}

function DataTableGalleryCard<TData extends Record<string, unknown>>({
  mediaSource,
  nativeMedia,
  previewLabel,
  hoverPreview,
  previewSize,
  onPreviewMedia,
  table,
  renderMedia,
  renderProperties,
  actionsCell,
  aspectRatio,
  canEditRow,
  editRowLabel,
  imageColumnId,
  imageFit,
  isActive,
  isClickable,
  linkRowLabel,
  linkUrl,
  onEditRow,
  onOpenRowLink,
  onRowClick,
  propertyCells,
  propertyLabels,
  row,
  selectionCell,
  showCardLabels,
  titleCell,
  titleText,
}: GalleryCardProps<TData>) {
  const title = titleText || row.id;
  const titleContent = titleCell
    ? flexRender(titleCell.column.columnDef.cell, titleCell.getContext())
    : title;
  const imageSource = resolveImageSource(
    imageColumnId ? row.original[imageColumnId] : undefined
  );
  const shouldSelectFromCard = (event: MouseEvent<HTMLElement>) =>
    Boolean(selectionCell) &&
    row.getCanSelect() &&
    isSelectionModifiedClick(event) &&
    // Checkboxes already handle range selection and must not toggle twice.
    !(
      event.target instanceof Element &&
      event.target.closest('[data-column-id="select"]')
    );
  const handleSelectionClick = (event: MouseEvent<HTMLElement>) => {
    if (!shouldSelectFromCard(event)) {
      return;
    }
    // Capture before custom media buttons can open a preview or a link.
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    selectRowWithRange({
      element: event.currentTarget,
      isSelected: event.shiftKey || !row.getIsSelected(),
      row,
      shiftKey: event.shiftKey,
      table,
    });
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: clickable cards keep nested selection/actions valid and provide keyboard activation.
    <article
      className={cn(
        "group overflow-hidden rounded-md border bg-background shadow-xs transition",
        isClickable &&
          "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
        (isActive || row.getIsSelected()) &&
          "border-primary/60 ring-1 ring-primary/30"
      )}
      data-active={isActive ? "true" : undefined}
      onClick={
        isClickable
          ? (event) => {
              onRowClick?.(row, event);
            }
          : undefined
      }
      onClickCapture={handleSelectionClick}
      onContextMenuCapture={(event) => {
        // macOS dispatches Control-click as a context-menu event.
        if (event.ctrlKey && event.button === 0) {
          handleSelectionClick(event);
        }
      }}
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
      onMouseDownCapture={(event) => {
        if (shouldSelectFromCard(event)) {
          // Avoid native text selection when extending a range with Shift.
          event.preventDefault();
        }
      }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="relative">
        <GalleryCardVisual
          aspectRatio={aspectRatio}
          hoverPreview={hoverPreview}
          imageFit={imageFit}
          imageSource={imageSource}
          mediaSource={mediaSource}
          nativeMedia={nativeMedia}
          onPreviewMedia={onPreviewMedia}
          previewLabel={previewLabel}
          previewSize={previewSize}
          renderMedia={renderMedia}
          row={row}
          title={title}
        />
        {selectionCell ? (
          <div
            className={cn(
              "absolute top-3 left-3 z-10 transition-opacity [&_[data-slot=checkbox][data-checked]]:border-primary [&_[data-slot=checkbox][data-checked]]:bg-primary [&_[data-slot=checkbox]]:size-5 [&_[data-slot=checkbox]]:border-background/70 [&_[data-slot=checkbox]]:bg-background [&_[data-slot=checkbox]]:shadow-sm",
              row.getIsSelected()
                ? "opacity-100"
                : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            )}
            data-column-id="select"
          >
            {flexRender(
              selectionCell.column.columnDef.cell,
              selectionCell.getContext()
            )}
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 font-medium text-sm">
              {titleContent}
            </div>
          </div>
          {actionsCell ? null : (
            <GalleryCardActions
              canEditRow={canEditRow}
              editRowLabel={editRowLabel}
              linkRowLabel={linkRowLabel}
              linkUrl={linkUrl}
              onEditRow={onEditRow}
              onOpenRowLink={onOpenRowLink}
              row={row}
            />
          )}
          {actionsCell ? (
            <div className="shrink-0" data-column-id="actions">
              {flexRender(
                actionsCell.column.columnDef.cell,
                actionsCell.getContext()
              )}
            </div>
          ) : null}
        </div>

        {renderProperties ? (
          renderProperties({
            row: row.original,
            title,
            source: imageSource,
            imageFit,
            aspectRatio,
          })
        ) : (
          <GalleryCardProperties
            propertyCells={propertyCells}
            propertyLabels={propertyLabels}
            showCardLabels={showCardLabels}
          />
        )}
      </div>
    </article>
  );
}

export function DataTableGalleryView<TData extends Record<string, unknown>>({
  locale = "en",
  onOpenRowDetails,
  canEditRow,
  className,
  columnDefinitions,
  config,
  editRowLabel = "Edit",
  emptyState,
  getRowLinkUrl,
  groupBy = "",
  groupLabel,
  isRowActive,
  isRowClickable,
  linkRowLabel = "View",
  onEditRow,
  onOpenRowLink,
  onRowClick,
  table,
}: DataTableGalleryViewProps<TData>) {
  const hasTableGrouping = table.store.state.grouping.length > 0;
  const rows = (
    hasTableGrouping
      ? table.getPreGroupedRowModel().rows
      : table.getRowModel().rows
  ) as Row<TData>[];
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
  const titleColumn = columnDefinitions.find(
    (definition) => definition.id === titleColumnId
  );
  // Titles read as the table shows them: option labels, number and date formats.
  const titleTextOf = (row: Row<TData>) =>
    titleColumnId
      ? fieldText(row.original[titleColumnId], titleColumn, locale, row.original)
      : "";
  const galleryGroups = useMemo(() => {
    const groupColumn = columnDefinitions.find(
      (definition) => definition.id === groupBy
    );
    return createGalleryGroups({
      groupBy,
      labelOf: (value) => fieldText(value, groupColumn, locale),
      rows,
    });
  }, [columnDefinitions, groupBy, locale, rows]);

  const viewer = useRef<ReturnType<typeof openMediaViewer> | undefined>(
    undefined
  );
  useEffect(() => () => viewer.current?.destroy(), []);
  const previewLabels = mediaViewerLabels(locale);
  const onPreviewMedia = (row: Row<TData>, target: HTMLElement) => {
    viewer.current?.destroy();
    const orderedRows = galleryGroups.flatMap((group) => group.rows);
    viewer.current = openMediaViewer({
      items: orderedRows.map((item) => ({
        id: item.id,
        title: titleTextOf(item) || item.id,
        source: resolveGalleryMedia(
          item.original,
          resolvedConfig.media,
          imageColumnId
        ),
      })),
      index: orderedRows.findIndex((item) => item.id === row.id),
      labels: previewLabels,
      returnFocus: target,
      onInfo: onOpenRowDetails
        ? (id) => {
            const item = orderedRows.find((item) => item.id === id);
            if (item) {
              onOpenRowDetails(item.original);
            }
          }
        : undefined,
    });
  };

  if (rows.length === 0) {
    return emptyState ? (
      <div className="rounded-md border">{emptyState}</div>
    ) : null;
  }

  const renderCard = (row: Row<TData>) => {
    const visibleCells = row.getVisibleCells();
    return (
      <DataTableGalleryCard
        actionsCell={visibleCells.find((cell) => cell.column.id === "actions")}
        aspectRatio={resolvedConfig.aspectRatio}
        canEditRow={canEditRow?.(row) ?? false}
        editRowLabel={editRowLabel}
        hoverPreview={resolvedConfig.media?.hoverPreview}
        imageColumnId={imageColumnId}
        imageFit={resolvedConfig.imageFit}
        isActive={isRowActive?.(row) ?? false}
        isClickable={isRowClickable?.(row) ?? false}
        key={row.id}
        linkRowLabel={linkRowLabel}
        linkUrl={getRowLinkUrl?.(row)}
        mediaSource={resolveGalleryMedia(
          row.original,
          resolvedConfig.media,
          imageColumnId
        )}
        nativeMedia={resolvedConfig.media?.enabled}
        onEditRow={onEditRow}
        onOpenRowLink={onOpenRowLink}
        onPreviewMedia={onPreviewMedia}
        onRowClick={onRowClick}
        previewLabel={previewLabels.preview}
        previewSize={resolvedConfig.previewSize}
        propertyCells={getGalleryPropertyCells({
          cardColumnIds: resolvedConfig.cardColumnIds,
          groupBy,
          imageColumnId,
          row,
          titleColumnId,
        })}
        propertyLabels={propertyLabels}
        renderMedia={resolvedConfig.renderMedia}
        renderProperties={resolvedConfig.renderProperties}
        row={row}
        selectionCell={visibleCells.find((cell) => cell.column.id === "select")}
        showCardLabels={shouldShowGalleryCardLabels(resolvedConfig)}
        table={table}
        titleCell={getCellByColumnId(row, titleColumnId)}
        titleText={titleTextOf(row)}
      />
    );
  };

  return (
    <div className={cn("rounded-md border bg-background p-3", className)}>
      {groupBy ? (
        <div className="space-y-5">
          {galleryGroups.map((group) => (
            <section key={group.id}>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h3 className="min-w-0 truncate font-medium text-sm">
                  {groupLabel ? (
                    <span className="text-muted-foreground">
                      {groupLabel}:{" "}
                    </span>
                  ) : null}
                  {group.label}
                </h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                  {group.rows.length}
                </span>
              </div>
              <div
                className={cn(
                  "grid gap-3",
                  GALLERY_CARD_SIZE_CLASS[resolvedConfig.cardSize]
                )}
              >
                {group.rows.map((row) => renderCard(row))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            GALLERY_CARD_SIZE_CLASS[resolvedConfig.cardSize]
          )}
        >
          {rows.map((row) => renderCard(row))}
        </div>
      )}
    </div>
  );
}
