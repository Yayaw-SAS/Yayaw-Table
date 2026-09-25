"use client";

import type { Row, Table as TanStackTable } from "@/components/ui/yayaw-table/tanstack";
import { flexRender } from "@/components/ui/yayaw-table/tanstack";
import { GripVertical } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  type MouseEvent,
  type ReactNode,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  type DragEndEvent,
  KanbanBoard,
  type KanbanColumnProps as KiboKanbanColumnProps,
  KanbanCard as KiboKanbanCard,
  KanbanCards,
  KanbanHeader,
  type KanbanItemProps as KiboKanbanItemProps,
  KanbanProvider,
} from "@/src/components/ui/custom/kanban";
import { Button } from "@/src/components/ui/button";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import { useLocale } from "../providers/table-provider";
import type {
  TableKanbanConfig,
  TableKanbanGroupConfig,
} from "../types/display-types";
import { shouldActivateCardFromKeyboard } from "../utils/card-interaction";
import {
  getCompactCardPropertiesClassName,
  getCompactCardPropertyClassName,
} from "../utils/card-properties";
import {
  emptyGroupLabel,
  fieldText,
  groupValueKey,
} from "../utils/table-contracts";
import { isBlankCardValue } from "../utils/value-format";

import { ServerKanbanView } from "./server-kanban-view";

const SYSTEM_COLUMN_IDS = new Set(["actions", "select"]);

export interface KanbanGroup {
  id: string;
  label: string;
  value: string;
}

interface DataTableKanbanViewProps<TData extends Record<string, unknown>> {
  canDragUpdate: boolean;
  cardColumnIds?: string[];
  className?: string;
  columnDefinitions: TableCatalogueColumnConfig[];
  config?: TableKanbanConfig;
  emptyState: ReactNode;
  groupBy: string;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  onMoveRow?: (row: Row<TData>, nextValue: string) => Promise<void> | void;
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  table: TanStackTable<TData>;
  titleColumnId?: string;
}

interface KanbanCardProps<TData extends Record<string, unknown>> {
  canDragUpdate: boolean;
  columnId: string;
  columnDefinitionsById: Map<string, TableCatalogueColumnConfig>;
  isActive: boolean;
  isClickable: boolean;
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  row: Row<TData>;
  selectionCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  titleCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  actionsCell?: ReturnType<Row<TData>["getVisibleCells"]>[number];
  onRowClick?: (row: Row<TData>, event: MouseEvent<HTMLElement>) => void;
  showCardLabels: boolean;
}

interface KanbanCardPropertiesProps<TData extends Record<string, unknown>> {
  columnDefinitionsById: Map<string, TableCatalogueColumnConfig>;
  propertyCells: ReturnType<Row<TData>["getVisibleCells"]>;
  propertyLabels: Map<string, string>;
  showCardLabels: boolean;
}

interface DataTableKanbanColumn extends KiboKanbanColumnProps {
  label: string;
  value: string;
}

interface DataTableKanbanItem<TData extends Record<string, unknown>>
  extends KiboKanbanItemProps {
  groupValue: string;
  row: Row<TData>;
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

/** Lane titles read the grouped value as the table shows it; `value` stays raw. */
type KanbanLaneLabel = (value: unknown) => string;

export function createConfiguredGroups(
  groups: TableKanbanGroupConfig[] | undefined,
  labelOf?: KanbanLaneLabel,
  emptyLabel = emptyGroupLabel()
): KanbanGroup[] {
  if (!groups?.length) {
    return [];
  }

  return groups.map((group) => {
    const value = groupValueKey(group.value);
    return {
      id: `kanban-group-${value || "empty"}`,
      label:
        group.label ??
        ((value && (labelOf?.(group.value) || value)) || emptyLabel),
      value,
    };
  });
}

export function shouldUseConfiguredKanbanGroups({
  configuredGroupBy,
  groupBy,
}: {
  configuredGroupBy?: string;
  groupBy: string;
}): boolean {
  return Boolean(configuredGroupBy) && configuredGroupBy === groupBy;
}

export function createKanbanGroups<TData extends Record<string, unknown>>({
  configuredGroups,
  emptyLabel = emptyGroupLabel(),
  groupBy,
  labelOf,
  rows,
}: {
  configuredGroups: KanbanGroup[];
  /** Heading of the lane without a value. */
  emptyLabel?: string;
  groupBy: string;
  labelOf?: KanbanLaneLabel;
  rows: Row<TData>[];
}): KanbanGroup[] {
  const groups = [...configuredGroups];
  const knownValues = new Set(groups.map((group) => group.value));

  for (const row of rows) {
    const raw = row.original[groupBy];
    const value = groupValueKey(raw);
    if (knownValues.has(value)) {
      continue;
    }

    knownValues.add(value);
    groups.push({
      id: `kanban-group-${value || "empty"}`,
      label: (value && (labelOf?.(raw) || value)) || emptyLabel,
      value,
    });
  }

  return groups;
}

function createKanbanColumns(groups: KanbanGroup[]): DataTableKanbanColumn[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    name: group.label,
    value: group.value,
  }));
}

function createKanbanItems<TData extends Record<string, unknown>>({
  columns,
  groupBy,
  rows,
  titleColumnId,
}: {
  columns: DataTableKanbanColumn[];
  groupBy: string;
  rows: Row<TData>[];
  titleColumnId?: string;
}): DataTableKanbanItem<TData>[] {
  const columnIdByValue = new Map(
    columns.map((column) => [column.value, column.id])
  );

  return rows.map((row) => {
    const groupValue = groupValueKey(row.original[groupBy]);
    const titleValue =
      titleColumnId && row.original[titleColumnId] !== undefined
        ? row.original[titleColumnId]
        : row.id;

    return {
      column: columnIdByValue.get(groupValue) ?? groupValue,
      groupValue,
      id: row.id,
      name: groupValueKey(titleValue) || row.id,
      row,
    };
  });
}

function getDefaultTitleColumnId<TData extends Record<string, unknown>>(
  table: TanStackTable<TData>
): string | undefined {
  return table
    .getVisibleLeafColumns()
    .find((column) => !SYSTEM_COLUMN_IDS.has(column.id))?.id;
}

export function getCardPropertyCells<TData extends Record<string, unknown>>({
  cardColumnIds,
  groupBy,
  row,
  titleColumnId,
}: {
  cardColumnIds?: string[];
  groupBy: string;
  row: Row<TData>;
  titleColumnId?: string;
}): ReturnType<Row<TData>["getVisibleCells"]> {
  const cells = row.getVisibleCells().filter((cell) => {
    return (
      !SYSTEM_COLUMN_IDS.has(cell.column.id) &&
      cell.column.id !== titleColumnId &&
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

export function shouldShowKanbanCardLabels(
  config: TableKanbanConfig | undefined
): boolean {
  return config?.showCardLabels === true;
}

function getKanbanPropertyValueClassName(
  columnDefinition: TableCatalogueColumnConfig | undefined,
  showCardLabels: boolean
): string {
  if (showCardLabels) {
    return "min-w-0 truncate text-xs";
  }

  if (
    columnDefinition?.displayVariant === "tag" ||
    columnDefinition?.type === "boolean"
  ) {
    return "inline-flex min-w-0 max-w-full items-center";
  }

  if (columnDefinition?.type === "number") {
    return "inline-flex min-w-0 max-w-full items-center rounded-full bg-muted/70 px-2 py-0.5 font-medium text-[11px] tabular-nums";
  }

  if (columnDefinition?.type === "date") {
    return "inline-flex min-w-0 max-w-full items-center rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground";
  }

  if (
    columnDefinition?.type === "select" ||
    columnDefinition?.type === "multiSelect"
  ) {
    return "inline-flex min-w-0 max-w-full items-center rounded-full bg-muted px-2 py-0.5 text-[11px]";
  }

  if (columnDefinition?.type === "url") {
    return "min-w-0 max-w-full truncate text-muted-foreground text-xs";
  }

  return "min-w-0 max-w-full truncate text-muted-foreground text-xs";
}

function KanbanCardProperties<TData extends Record<string, unknown>>({
  columnDefinitionsById,
  propertyCells,
  propertyLabels,
  showCardLabels,
}: KanbanCardPropertiesProps<TData>) {
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
            <dd
              className={getKanbanPropertyValueClassName(
                columnDefinitionsById.get(cell.column.id),
                showCardLabels
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  // Compact cards leave out properties with nothing to show, as in Vue.
  const shown = propertyCells.filter(
    (cell) => !isBlankCardValue(cell.getValue())
  );
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className={getCompactCardPropertiesClassName()}>
      {shown.map((cell) => {
        const label = propertyLabels.get(cell.column.id) ?? cell.column.id;
        return (
          <div className={getCompactCardPropertyClassName()} key={cell.id}>
            <span className="sr-only">{label}: </span>
            <div
              className={getKanbanPropertyValueClassName(
                columnDefinitionsById.get(cell.column.id),
                showCardLabels
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTableKanbanCard<TData extends Record<string, unknown>>({
  actionsCell,
  canDragUpdate,
  columnId,
  columnDefinitionsById,
  isActive,
  isClickable,
  onRowClick,
  propertyCells,
  propertyLabels,
  row,
  selectionCell,
  showCardLabels,
  titleCell,
}: KanbanCardProps<TData>) {
  const cardClassName = cn(
    "group relative rounded-md border bg-background p-2 pr-10 shadow-xs transition",
    isClickable && "hover:border-primary/40 hover:bg-muted/20",
    isActive && "border-primary/50 shadow-[inset_2px_0_0_var(--primary)]"
  );
  const locale = useLocale();
  const titleContent = titleCell
    ? flexRender(titleCell.column.columnDef.cell, titleCell.getContext())
    : row.id;
  // Read aloud as shown: option labels, number and date formats.
  const cardName = titleCell
    ? fieldText(
        row.original[titleCell.column.id],
        columnDefinitionsById.get(titleCell.column.id),
        locale,
        row.original
      ) || row.id
    : row.id;
  const cardInteractionProps = isClickable
    ? {
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          onRowClick?.(row, event);
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (shouldActivateCardFromKeyboard(event)) {
            event.preventDefault();
            event.currentTarget.click();
          }
        },
        role: "button" as const,
        tabIndex: 0,
      }
    : {};
  const cardContent = (
    <div
      className={cn(
        "min-w-0 outline-none",
        isClickable && "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
      )}
      data-active={isActive ? "true" : undefined}
      {...cardInteractionProps}
    >
      <div className="flex items-start gap-2">
        {selectionCell ? (
          <div className="mt-0.5 shrink-0" data-column-id="select">
            {flexRender(selectionCell.column.columnDef.cell, selectionCell.getContext())}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-medium text-sm">{titleContent}</div>
        </div>
        {actionsCell ? (
          <div className="shrink-0" data-column-id="actions">
            {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
          </div>
        ) : null}
      </div>

      <KanbanCardProperties
        columnDefinitionsById={columnDefinitionsById}
        propertyCells={propertyCells}
        propertyLabels={propertyLabels}
        showCardLabels={showCardLabels}
      />
    </div>
  );

  return (
    <KiboKanbanCard
      className={cardClassName}
      column={columnId}
      disabled={!canDragUpdate}
      dragHandle={
        canDragUpdate
          ? ({ attributes, listeners, setActivatorNodeRef }) => (
              <Button
                aria-label="Drag card"
                className="absolute top-2 right-2 h-7 w-7 cursor-grab text-muted-foreground active:cursor-grabbing"
                ref={setActivatorNodeRef}
                size="icon-sm"
                type="button"
                variant="ghost"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </Button>
            )
          : undefined
      }
      id={row.id}
      itemAttributes={{ "data-row-id": row.id }}
      name={cardName}
    >
      {cardContent}
    </KiboKanbanCard>
  );
}

function LocalDataTableKanbanView<TData extends Record<string, unknown>>({
  canDragUpdate,
  cardColumnIds,
  className,
  columnDefinitions,
  config,
  emptyState,
  groupBy,
  isRowActive,
  isRowClickable,
  onMoveRow,
  onRowClick,
  table,
  titleColumnId,
}: DataTableKanbanViewProps<TData>) {
  const hasTableGrouping = table.store.state.grouping.length > 0;
  const rows = (
    hasTableGrouping
      ? table.getPreGroupedRowModel().rows
      : table.getRowModel().rows
  ) as Row<TData>[];
  const shouldUseConfiguredGroups = shouldUseConfiguredKanbanGroups({
    configuredGroupBy: config?.groupBy,
    groupBy,
  });
  const locale = useLocale();
  const groupColumn = columnDefinitions.find(
    (definition) => definition.id === groupBy
  );
  const laneLabel = useCallback(
    (value: unknown) => fieldText(value, groupColumn, locale),
    [groupColumn, locale]
  );
  const configuredGroups = useMemo(
    () =>
      createConfiguredGroups(
        shouldUseConfiguredGroups ? config?.groups : undefined,
        laneLabel,
        emptyGroupLabel(locale)
      ),
    [config?.groups, laneLabel, locale, shouldUseConfiguredGroups]
  );
  const groups = useMemo(
    () =>
      createKanbanGroups({
        configuredGroups,
        emptyLabel: emptyGroupLabel(locale),
        groupBy,
        labelOf: laneLabel,
        rows,
      }),
    [configuredGroups, groupBy, laneLabel, locale, rows]
  );
  const kanbanColumns = useMemo(() => createKanbanColumns(groups), [groups]);
  const resolvedTitleColumnId =
    titleColumnId ?? config?.titleColumn ?? getDefaultTitleColumnId(table);
  const initialKanbanItems = useMemo(
    () =>
      createKanbanItems({
        columns: kanbanColumns,
        groupBy,
        rows,
        titleColumnId: resolvedTitleColumnId,
      }),
    [groupBy, kanbanColumns, resolvedTitleColumnId, rows]
  );
  const [kanbanItems, setKanbanItems] = useState(initialKanbanItems);

  useEffect(() => {
    setKanbanItems(initialKanbanItems);
  }, [initialKanbanItems]);

  const propertyLabels = useMemo(() => {
    return new Map(
      columnDefinitions.map((definition) => [
        definition.id,
        getColumnLabel(columnDefinitions, definition.id),
      ])
    );
  }, [columnDefinitions]);
  const columnDefinitionsById = useMemo(() => {
    return new Map(
      columnDefinitions.map((definition) => [definition.id, definition])
    );
  }, [columnDefinitions]);
  const showCardLabels = shouldShowKanbanCardLabels(config);
  const rowCountByColumnId = useMemo(() => {
    const next = new Map<string, number>();
    for (const column of kanbanColumns) {
      next.set(column.id, 0);
    }
    for (const item of kanbanItems) {
      next.set(item.column, (next.get(item.column) ?? 0) + 1);
    }
    return next;
  }, [kanbanColumns, kanbanItems]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!canDragUpdate) {
        return;
      }

      const rowId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : "";
      const activeItem = kanbanItems.find((item) => item.id === rowId);
      const overItem = kanbanItems.find((item) => item.id === overId);
      const nextColumnId =
        overItem?.column ?? kanbanColumns.find((column) => column.id === overId)?.id;
      const nextColumn = kanbanColumns.find(
        (column) => column.id === nextColumnId
      );

      if (!activeItem || !nextColumn || activeItem.groupValue === nextColumn.value) {
        return;
      }

      onMoveRow?.(activeItem.row, nextColumn.value);
    },
    [canDragUpdate, kanbanColumns, kanbanItems, onMoveRow]
  );

  if (rows.length === 0) {
    return emptyState ? <div className="rounded-md border">{emptyState}</div> : null;
  }

  return (
    <div
      className={cn("overflow-x-auto rounded-md border bg-background", className)}
      data-kanban-board=""
    >
      <KanbanProvider<DataTableKanbanItem<TData>, DataTableKanbanColumn>
        className="min-h-[30rem] w-max auto-cols-[18rem] gap-3 p-3"
        columns={kanbanColumns}
        data={kanbanItems}
        onDataChange={canDragUpdate ? setKanbanItems : undefined}
        onDragEnd={handleDragEnd}
      >
        {(column) => (
          <KanbanBoard
            className="min-h-[28rem] w-[18rem] bg-muted/20"
            data-kanban-lane={column.id}
            id={column.id}
            key={column.id}
          >
            <KanbanHeader className="flex h-11 items-center justify-between px-3 py-0">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-sm">{column.label}</h3>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-muted-foreground text-xs">
                {rowCountByColumnId.get(column.id) ?? 0}
              </span>
            </KanbanHeader>
            <KanbanCards<DataTableKanbanItem<TData>> id={column.id}>
              {(item) => {
                const row = item.row;
                const cells = row.getVisibleCells();
                const titleCell = cells.find(
                  (cell) => cell.column.id === resolvedTitleColumnId
                );
                const selectionCell = cells.find(
                  (cell) => cell.column.id === "select"
                );
                const actionsCell = cells.find(
                  (cell) => cell.column.id === "actions"
                );

                return (
                  <DataTableKanbanCard
                    actionsCell={actionsCell}
                    canDragUpdate={canDragUpdate}
                    columnId={item.column}
                    columnDefinitionsById={columnDefinitionsById}
                    isActive={isRowActive?.(row) ?? false}
                    isClickable={isRowClickable?.(row) ?? false}
                    key={row.id}
                    onRowClick={onRowClick}
                    propertyCells={getCardPropertyCells({
                      cardColumnIds,
                      groupBy,
                      row,
                      titleColumnId: resolvedTitleColumnId,
                    })}
                    propertyLabels={propertyLabels}
                    row={row}
                    selectionCell={selectionCell}
                    showCardLabels={showCardLabels}
                    titleCell={titleCell}
                  />
                );
              }}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  );
}

export function DataTableKanbanView<TData extends Record<string, unknown>>(props: DataTableKanbanViewProps<TData>) {
 if (props.config?.server) { return <ServerKanbanView key={props.config.server.queryKey} source={props.config.server} columns={props.columnDefinitions} titleColumn={props.titleColumnId ?? props.config.titleColumn} propertyIds={props.cardColumnIds ?? props.config.cardColumnIds ?? []} />; }
 return <LocalDataTableKanbanView {...props} />;
}
