"use client";
import { useEffect, useRef, useState } from "react";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import {
  createServerKanban,
  type ServerKanbanSource,
  type ServerKanbanState,
} from "../utils/server-kanban";

export function ServerKanbanView({
  source,
  columns,
  titleColumn,
  propertyIds,
}: {
  source: ServerKanbanSource;
  columns: TableCatalogueColumnConfig[];
  titleColumn?: string;
  propertyIds: string[];
}) {
  const [state, setState] = useState<ServerKanbanState>({
    lanes: [],
    loading: true,
  });
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const session = useRef<ReturnType<typeof createServerKanban> | null>(null);
  const queryKey = source.queryKey;
  useEffect(() => {
    const next = createServerKanban({ ...sourceRef.current, queryKey }, setState);
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
  const value = (row: Record<string, unknown>, id: string) => row[id];
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
      <div className="flex gap-3 overflow-x-auto p-3">
        {state.lanes.map((lane) => (
          <section
            aria-label={lane.label}
            className="w-72 shrink-0 rounded-md border bg-muted/20 p-3"
            key={lane.value}
          >
            <h3 className="mb-3 flex justify-between font-medium">
              <span>{lane.label}</span>
              <span>{lane.totalCount}</span>
            </h3>
            {lane.rows.map((row) => (
              <article
                className="mb-3 rounded-md border bg-background p-3"
                key={source.getRowId?.(row) ?? String(row.id)}
              >
                <button
                  className="w-full text-left font-medium"
                  disabled={!source.onActivate}
                  onClick={() => source.onActivate?.(row)}
                  type="button"
                >
                  {String(value(row, titleColumn ?? "name") ?? row.id)}
                </button>
                <dl>
                  {propertyIds
                    .filter((id) => id !== titleColumn)
                    .map((id) => {
                      const column = columns.find((item) => item.id === id);
                      const cell = value(row, id);
                      return (
                        <div key={id}>
                          <dt className="text-muted-foreground text-xs">
                            {column?.header ?? id}
                          </dt>
                          <dd className="text-sm">
                            {column?.cellRenderer
                              ? column.cellRenderer(cell, row)
                              : String(cell ?? "")}
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
    </div>
  );
}
