"use client";
import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { createMemoryPlanningAdapter } from "../src/components/ui/yayaw-table/planning/adapter";
import {
  createGanttDemoViews,
  demoGanttConfig,
  demoPlanningConfig,
  demoPlanningSnapshot,
  ganttDemoColumns,
  ganttDemoForm,
  listPlanningDemo,
} from "./gantt-data";

const config = defineTableConfig({
  id: "gantt-demo",
  columns: {
    definitions: ganttDemoColumns,
    visible: ["name", "start", "end", "status"],
    order: ["name", "start", "end", "status"],
    mandatory: ["name"],
  },
  table: {
    enableViews: true,
    displayModes: ["table", "gantt", "kanban", "gallery"],
    defaultDisplayMode: "gantt",
    planning: demoPlanningConfig,
    gantt: demoGanttConfig,
    kanban: { groupBy: "status", titleColumn: "name" },
    gallery: { titleColumn: "name" },
    allowCreate: false,
    allowDelete: false,
    allowDuplicate: false,
    allowEdit: true,
    allowInlineEdit: true,
    inlineEdit: { enabled: true },
    rowClickMode: "default",
    defaultPageSize: 20,
  },
  translations: {
    namespace: "gantt-demo",
    keys: {
      title: "Autumn launch",
      description: "Tasks and releases share one planning graph.",
    },
  },
});
export function GanttExample() {
  const integration = useMemo(() => {
    const adapter = createMemoryPlanningAdapter({
      snapshot: demoPlanningSnapshot(),
      config: demoPlanningConfig,
    });
    const actions = {
      planning: adapter.actions,
      views: createGanttDemoViews(),
      list: (params: Record<string, unknown>) =>
        Promise.resolve(listPlanningDemo(adapter.getSnapshot(), params)),
    };
    return { getTableConfig: () => config, getTableActions: () => actions };
  }, []);
  return (
    <DataTable
      getFormConfig={() => ganttDemoForm}
      tableType="gantt-demo"
      {...integration}
      details={{ presentation: "drawer", title: (row) => String(row.name) }}
    />
  );
}
