"use client";
import { useMemo, useRef } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";

interface PlanningRow extends Record<string, unknown> {
  id: string;
  name: string;
  owner: string;
  start: string;
  end: string;
  parentId: string | null;
}

const SEED: PlanningRow[] = [
  {
    id: "discovery",
    name: "Discovery",
    owner: "Ana",
    start: "2026-09-14",
    end: "2026-09-25",
    parentId: null,
  },
  {
    id: "interviews",
    name: "Customer interviews",
    owner: "Ana",
    start: "2026-09-14",
    end: "2026-09-18",
    parentId: "discovery",
  },
  {
    id: "synthesis",
    name: "Synthesis",
    owner: "Bo",
    start: "2026-09-21",
    end: "2026-09-25",
    parentId: "discovery",
  },
  {
    id: "build",
    name: "Build",
    owner: "Kim",
    start: "2026-09-28",
    end: "2026-10-09",
    parentId: null,
  },
];

/**
 * The whole Gantt configuration: the same column mappings Kanban and Gallery need.
 * No planning adapter, no snapshot, no revisions — the table derives them from its rows.
 */
const config = defineTableConfig({
  id: "gantt-rows-demo",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "owner", header: "Owner", type: "tag" },
      { id: "start", header: "Start", type: "date" },
      { id: "end", header: "End", type: "date" },
    ],
    mandatory: ["name"],
    order: ["name", "owner", "start", "end"],
    visible: ["name", "owner", "start", "end"],
  },
  table: {
    displayModes: ["table", "gantt", "kanban", "gallery"],
    defaultDisplayMode: "gantt",
    allowEdit: true,
    kanban: { groupBy: "owner", titleColumn: "name" },
    gallery: { titleColumn: "name" },
    planning: {
      enabled: true,
      scopeId: "gantt-rows-demo",
      sourceId: "tasks",
      scheduling: "preview",
    },
    gantt: {
      titleColumn: "name",
      startColumn: "start",
      endColumn: "end",
      parentColumn: "parentId",
    },
  },
  translations: {
    namespace: "gantt-rows-demo",
    keys: {
      title: "Discovery and build",
      description:
        "A Gantt built from the table's own rows, with no planning backend.",
    },
  },
});

export function GanttRowsExample() {
  /**
   * The action factories stay referentially stable: the planning graph is rebuilt when
   * the data changes, not on every render. A real application gets this for free from a
   * module-level catalogue; here a ref stands in for the store.
   */
  const store = useRef(SEED);
  const integration = useMemo(
    () => ({
      getTableConfig: () => config,
      getTableActions: () => ({
        list: () =>
          Promise.resolve({
            data: store.current,
            meta: { pageCount: 1, totalCount: store.current.length },
          }),
        update: (id: string, patch: Record<string, unknown>) => {
          store.current = store.current.map((row) =>
            row.id === id ? { ...row, ...patch } : row
          );
          return Promise.resolve({ success: true });
        },
      }),
    }),
    []
  );
  return (
    <DataTable
      tableType="gantt-rows-demo"
      {...integration}
      details={{ presentation: "drawer", title: (row) => String(row.name) }}
    />
  );
}
