"use client";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import { useLocale, useTranslations } from "../providers/table-provider";
import { translatedOr } from "../providers/translation-cache";
import { resolveImageSource } from "../utils/image-source";
import {
  type AvatarOption,
  resolveAvatarConfig,
} from "../utils/initials-avatar";
import {
  arrangeKanbanLanes,
  type KanbanLaneSettings,
} from "../utils/kanban-lanes";
import { isKanbanDragControl } from "../utils/kanban-move";
import {
  createServerKanban,
  type ServerKanbanSource,
  type ServerKanbanState,
} from "../utils/server-kanban";
import { fieldText } from "../utils/table-contracts";
import { DataTypeCell } from "./cells/data-type-cell";
import { RecordAvatar } from "./cells/initials-avatar";

export function ServerKanbanView({
  avatar,
  canMoveRow,
  onMoveRow,
  dragFromCard,
  lanes,
  source,
  columns,
  titleColumn,
  propertyIds,
}: {
  /** Avatar before each card title (`kanban.avatar`). */
  avatar?: AvatarOption;
  canMoveRow?: (row: Record<string, unknown>) => boolean;
  onMoveRow?: (row: Record<string, unknown>, target: string) => Promise<void>;
  dragFromCard?: boolean;
  /** Lane order and hidden lanes of the grouping column (`kanban.lanes`). */
  lanes?: KanbanLaneSettings;
  source: ServerKanbanSource;
  columns: TableCatalogueColumnConfig[];
  titleColumn?: string;
  propertyIds: string[];
}) {
  const locale = useLocale();
  const { t } = useTranslations();
  const [state, setState] = useState<ServerKanbanState>({
    lanes: [],
    loading: true,
  });
  const [pressedHandle, setPressedHandle] = useState<string>();
  const [pressedControl, setPressedControl] = useState(false);
  const dragged = useRef<string | undefined>(undefined);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const session = useRef<ReturnType<typeof createServerKanban> | null>(null);
  const queryKey = source.queryKey;
  useEffect(() => {
    const next = createServerKanban(
      { ...sourceRef.current, queryKey },
      setState
    );
    session.current = next;
    next.load();
    return () => next.dispose();
  }, [queryKey]);
  const labels = {
    loading: "Loading…",
    retry: "Retry",
    loadMore: "Load more",
    empty: "No results",
    ...source.labels,
  };
  const columnOf = (id: string) => columns.find((item) => item.id === id);
  // Values as the table reads them: the accessor first, then the id.
  const value = (row: Record<string, unknown>, id: string) => {
    const column = columnOf(id);
    if (typeof column?.accessorFn === "function") {
      return (column.accessorFn as (record: typeof row) => unknown)(row);
    }
    return row[(column?.accessorKey as string | undefined) ?? id];
  };
  const titleId = titleColumn ?? "name";
  const arranged = useMemo(
    () => arrangeKanbanLanes(state.lanes, lanes),
    [lanes, state.lanes]
  );
  const avatarConfig = resolveAvatarConfig(avatar);
  const rowId = (row: Record<string, unknown>) =>
    source.getRowId?.(row) ?? String(row.id);
  const busy = Boolean(
    state.loading || state.moving || state.lanes.some((lane) => lane.loading)
  );
  const canMove = (row: Record<string, unknown>) =>
    Boolean(onMoveRow && canMoveRow?.(row));
  const move = (row: Record<string, unknown>, target: string) => {
    if (canMove(row) && onMoveRow) {
      session.current?.move(rowId(row), target, onMoveRow);
    }
  };
  const drop = (target: string) => {
    const row = state.lanes
      .flatMap((lane) => lane.rows)
      .find((item) => rowId(item) === dragged.current);
    dragged.current = undefined;
    if (row) {
      move(row, target);
    }
  };

  const nameOf = (row: Record<string, unknown>, id: string) =>
    fieldText(value(row, id), columnOf(id), locale, row);
  return (
    <div>
      {state.loading && <output>{labels.loading}</output>}
      {state.error && (
        <div role="alert">
          {state.error}
          <button
            onClick={() => {
              session.current?.load();
            }}
            type="button"
          >
            {labels.retry}
          </button>
        </div>
      )}
      {!(state.loading || state.error || state.lanes.length) && (
        <p>{labels.empty}</p>
      )}
      {state.moveError ? <p role="alert">{state.moveError}</p> : null}
      <div className="flex gap-3 overflow-x-auto p-3" data-kanban-board="">
        {arranged.visible.map((lane, laneIndex) => (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native drop target; adjacent move buttons provide keyboard access.
          <section
            aria-label={lane.label}
            className="w-72 shrink-0 rounded-md border bg-muted/20 p-3"
            data-kanban-lane={lane.value}
            key={lane.value}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              drop(lane.value);
            }}
          >
            <h3 className="mb-3 flex justify-between font-medium">
              <span>{lane.label}</span>
              <span>{lane.totalCount}</span>
            </h3>
            {lane.rows.map((row) => (
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native draggable card; adjacent move buttons provide keyboard access.
              <article
                aria-busy={state.moving === rowId(row) || undefined}
                className="mb-3 rounded-md border bg-background p-3"
                data-row-id={rowId(row)}
                draggable={
                  !(busy || pressedControl) &&
                  canMove(row) &&
                  (dragFromCard === true || pressedHandle === rowId(row))
                }
                key={rowId(row)}
                onDragEnd={() => {
                  dragged.current = undefined;
                  setPressedHandle(undefined);
                }}
                onDragStart={(event) => {
                  if (
                    !canMove(row) ||
                    busy ||
                    pressedControl ||
                    isKanbanDragControl(event.target) ||
                    !(dragFromCard || pressedHandle === rowId(row))
                  ) {
                    event.preventDefault();
                    return;
                  }
                  dragged.current = rowId(row);
                }}
                onPointerDown={(event) => {
                  setPressedControl(isKanbanDragControl(event.target));
                  setPressedHandle(
                    event.target instanceof Element &&
                      event.target.closest("[data-kanban-drag-handle]")
                      ? rowId(row)
                      : undefined
                  );
                }}
              >
                {avatarConfig ? (
                  <RecordAvatar
                    className="float-left mr-2 [--yayaw-avatar-size:1.5rem]"
                    name={nameOf(row, avatarConfig.nameColumn ?? titleId)}
                    shape={avatarConfig.shape}
                    source={
                      avatarConfig.imageColumn
                        ? resolveImageSource(
                            value(row, avatarConfig.imageColumn)
                          )
                        : undefined
                    }
                  />
                ) : null}
                <button
                  className="w-full text-left font-medium"
                  disabled={!source.onActivate}
                  onClick={() => source.onActivate?.(row)}
                  type="button"
                >
                  {fieldText(
                    value(row, titleId),
                    columnOf(titleId),
                    locale,
                    row
                  ) || String(row.id ?? "")}
                </button>
                {canMove(row) ? (
                  <div className="flex gap-1">
                    {[laneIndex - 1, laneIndex + 1].map((index) => {
                      const target = arranged.visible[index];
                      return target ? (
                        <button
                          aria-label={`${translatedOr(t, "views.kanban.move", "Move")} ${nameOf(row, titleId)} ${translatedOr(t, "views.kanban.to", "to")} ${target.label}`}
                          disabled={busy}
                          key={target.value}
                          onClick={() => move(row, target.value)}
                          type="button"
                        >
                          {index < laneIndex ? (
                            <ArrowLeft aria-hidden="true" size={16} />
                          ) : (
                            <ArrowRight aria-hidden="true" size={16} />
                          )}
                        </button>
                      ) : null;
                    })}
                    <span
                      aria-hidden="true"
                      className="cursor-grab"
                      data-kanban-drag-handle=""
                    >
                      <GripVertical size={16} />
                    </span>
                  </div>
                ) : null}
                <dl>
                  {propertyIds
                    .filter((id) => id !== titleColumn)
                    .map((id) => {
                      const column = columnOf(id);
                      const cell = value(row, id);
                      return (
                        <div key={id}>
                          <dt className="text-muted-foreground text-xs">
                            {column?.header ?? id}
                          </dt>
                          <dd className="text-sm">
                            {column ? (
                              <DataTypeCell
                                column={column}
                                row={row}
                                value={cell}
                              />
                            ) : (
                              String(cell ?? "")
                            )}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </article>
            ))}
            {lane.loading && <output>{labels.loading}</output>}
            {lane.error && <p role="alert">{lane.error}</p>}
            {!lane.loading && (lane.error || lane.nextCursor !== null) && (
              <button
                onClick={() => {
                  session.current?.loadLane(lane.value);
                }}
                type="button"
              >
                {lane.error ? labels.retry : labels.loadMore}
              </button>
            )}
            {!(lane.loading || lane.error) && lane.totalCount === 0 && (
              <p>{labels.empty}</p>
            )}
          </section>
        ))}
      </div>
      {arranged.hidden.length > 0 ? (
        <p
          className="px-3 pb-3 text-muted-foreground text-xs"
          data-kanban-hidden-lanes=""
        >
          {translatedOr(t, "views.kanban.hiddenLanes", "Hidden lanes")}:{" "}
          {arranged.hidden.map((lane) => lane.label).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
