import { planningTasksFromRows } from "../src/components/ui/yayaw-table/planning/rows";
import type {
  PlanningSnapshot,
  TablePlanningConfig,
} from "../src/components/ui/yayaw-table/planning/types";

export const demoPlanningConfig: TablePlanningConfig = {
  enabled: true,
  scopeId: "launch-planning",
  sourceId: "tasks",
  scheduling: "preview",
};
export const demoGanttConfig = {
  titleColumn: "name",
  startColumn: "start",
  endColumn: "end",
  zoom: "week" as const,
  weekStartsOn: 1,
  height: 440,
};
export function demoPlanningSnapshot(): PlanningSnapshot {
  const records = [
    {
      id: "launch",
      name: "Autumn launch",
      start: "2026-09-14",
      end: "2026-09-24",
      parentId: null,
      status: "In progress",
    },
    {
      id: "scope",
      name: "Scope and specification",
      start: "2026-09-14",
      end: "2026-09-15",
      parentId: "launch",
      status: "Done",
    },
    {
      id: "build",
      name: "Build the experience",
      start: "2026-09-16",
      end: "2026-09-21",
      parentId: "launch",
      status: "In progress",
    },
    {
      id: "review",
      name: "Acceptance review",
      start: "2026-09-22",
      end: "2026-09-24",
      parentId: "launch",
      status: "Planned",
    },
    {
      id: "content",
      name: "Prepare launch content",
      start: "2026-09-14",
      end: "2026-09-17",
      parentId: "launch",
      status: "In progress",
    },
    {
      id: "later",
      name: "Unscheduled follow-up",
      start: null,
      end: null,
      parentId: null,
      status: "Planned",
    },
  ];
  return {
    scopeId: "launch-planning",
    revision: "initial",
    complete: true,
    defaultCalendarId: "office",
    sources: [
      {
        id: "tasks",
        label: "Project tasks",
        fields: {
          title: "name",
          start: "start",
          end: "end",
          parent: "parentId",
        },
      },
      {
        id: "releases",
        label: "Release calendar",
        calendarId: "every-day",
        fields: { title: "name", start: "start", end: "end" },
      },
    ],
    calendars: [
      {
        id: "office",
        workingDays: [1, 2, 3, 4, 5],
        exceptions: { "2026-09-23": false },
      },
      { id: "every-day", workingDays: [0, 1, 2, 3, 4, 5, 6] },
    ],
    tasks: [
      ...planningTasksFromRows({
        source: {
          id: "tasks",
          label: "Tasks",
          fields: { start: "start", end: "end", parent: "parentId" },
        },
        rows: records,
        getId: (row) => row.id,
        gantt: demoGanttConfig,
      }).tasks,
      {
        ref: { source: "releases", id: "launch" },
        label: "Publish launch",
        start: "2026-09-25",
        end: "2026-09-25",
        record: {
          id: "launch",
          name: "Publish launch",
          start: "2026-09-25",
          end: "2026-09-25",
        },
      },
    ],
    dependencies: [
      {
        id: "scope-build",
        from: { source: "tasks", id: "scope" },
        to: { source: "tasks", id: "build" },
        type: "FS",
      },
      {
        id: "build-review",
        from: { source: "tasks", id: "build" },
        to: { source: "tasks", id: "review" },
        type: "FS",
      },
      {
        id: "review-launch",
        from: { source: "tasks", id: "review" },
        to: { source: "releases", id: "launch" },
        type: "FS",
      },
    ],
  };
}
export const ganttDemoColumns = [
  { id: "name", header: "Name", type: "text" as const },
  { id: "start", header: "Start", type: "date" as const },
  { id: "end", header: "End", type: "date" as const },
  { id: "status", header: "Status", type: "text" as const },
];
export function listPlanningDemo(
  snapshot: PlanningSnapshot,
  params: Record<string, unknown>
) {
  const search = String(
    params.search ?? params.globalSearch ?? params.q ?? ""
  ).toLowerCase();
  const matching = snapshot.tasks.filter(
    (task) =>
      task.ref.source === "tasks" && task.label.toLowerCase().includes(search)
  );
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize ?? params.limit) || 20);
  return {
    data: matching
      .slice((page - 1) * pageSize, page * pageSize)
      .map((task) => task.record ?? {}),
    meta: {
      pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
      totalCount: matching.length,
    },
  };
}

/** Each demo instance owns its saved views; the graph adapter can be shared independently. */
export function createGanttDemoViews() {
  const views = new Map<
    string,
    {
      id: string;
      tableId: string;
      name: string;
      createdById: string;
      config: object;
    }
  >(
    ["table", "gantt", "kanban", "gallery"].map((displayMode) => [
      displayMode,
      {
        id: displayMode,
        tableId: "gantt-demo",
        name: displayMode,
        createdById: "demo",
        config: { displayMode },
      },
    ])
  );
  return {
    list: () => Promise.resolve({ data: [...views.values()] }),
    create: (input: { tableId: string; name: string; config: object }) => {
      const view = { ...input, id: crypto.randomUUID(), createdById: "demo" };
      views.set(view.id, view);
      return Promise.resolve({ success: true, data: view });
    },
    update: (id: string, input: { name?: string; config?: object }) => {
      const before = views.get(id);
      if (!before) {
        return Promise.resolve({ success: false, error: "View not found" });
      }
      const view = { ...before, ...input };
      views.set(id, view);
      return Promise.resolve({ success: true, data: view });
    },
    delete: (id: string) => {
      views.delete(id);
      return Promise.resolve({ success: true });
    },
  };
}

export const ganttDemoForm = {
  id: "gantt-demo",
  title: "Edit task",
  presentation: "drawer" as const,
  fields: [
    { name: "name", label: "Name", type: "text" as const, required: true },
    { name: "start", label: "Start", type: "date" as const },
    { name: "end", label: "End", type: "date" as const },
    { name: "status", label: "Status", type: "text" as const },
  ],
};
