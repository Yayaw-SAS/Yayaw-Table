import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import type {
  Dashboard,
  DashboardStorage,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-model";
import { chartViews } from "./views";

/**
 * The "Projects overview" dashboard of the React and Vue examples: saved views
 * of the views example's Projects table and of a small Tasks table, two
 * numbers, a note and dashboard filters, kept by an in-memory host.
 */

const view = (
  tableId: string,
  id: string,
  name: string,
  config: Record<string, unknown>
) => ({
  id,
  tableId,
  name,
  createdById: "demo",
  isGlobal: true,
  canEdit: false,
  canDelete: false,
  config,
});

/** Projects views the dashboard shows beside the chart views. */
export const dashboardProjectViews = [
  ...chartViews,
  view("views", "projects-list", "Projects list", {
    displayMode: "list",
    sorting: [{ id: "dueDate", desc: false }],
  }),
  view("views", "status-board", "Status board", { displayMode: "kanban" }),
  view("views", "due-calendar", "Due dates", { displayMode: "calendar" }),
];

export const tasksRows = [
  ["t1", "Write the launch post", "Marketing", "2026-09-03", false],
  ["t2", "Audit the invoices", "Finance", "2026-09-06", true],
  ["t3", "Calibrate the display", "Engineering", "2026-09-10", false],
  ["t4", "Renew the support plan", "Finance", "2026-09-14", false],
  ["t5", "Order the sensors", "Engineering", "2026-09-17", true],
  ["t6", "Record the portal demo", "Marketing", "2026-09-21", false],
].map(([id, title, team, deadline, done]) => ({
  id: String(id),
  title: String(title),
  team: String(team),
  deadline: String(deadline),
  done: Boolean(done),
}));

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

export const tasksColumns = [
  { id: "title", header: "Title", type: "text" as const },
  {
    id: "team",
    header: "Team",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Marketing", "Finance", "Engineering"]),
  },
  { id: "deadline", header: "Deadline", type: "date" as const },
  { id: "done", header: "Done", type: "boolean" as const },
];

export const tasksTableOptions = {
  syncUrl: false,
  enableAdvancedFilters: true,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list"] as ("table" | "list")[],
  defaultPageSize: 10,
  list: { titleColumn: "title", cardColumnIds: ["team", "deadline"] },
};

export const dashboardTaskViews = [
  view("tasks", "open-tasks", "Open tasks", {
    displayMode: "table",
    advancedFilters: [
      {
        id: "open",
        columnId: "done",
        type: "boolean",
        operator: "isFalse",
        values: [],
        isActive: true,
      },
    ],
    sorting: [{ id: "deadline", desc: false }],
  }),
];

type TaskRow = (typeof tasksRows)[number];

/** Like a server: keep the tasks matching the view's and the dashboard's rules. */
function filterTasks(rows: TaskRow[], input: Record<string, unknown>) {
  const params = compatibleListParams(input);
  const rules = params.advancedFilters as Record<string, unknown>[];
  const required = Array.isArray(input.requiredFilters)
    ? (input.requiredFilters as Record<string, unknown>[])
    : [];
  const matches = (row: TaskRow) => (rule: Record<string, unknown>) =>
    matchesContractFilter(row[String(rule.columnId) as keyof TaskRow], rule);
  return rows.filter(
    (row) =>
      (params.advancedFilterJoin === "or" && rules.length
        ? rules.some(matches(row))
        : rules.every(matches(row))) && required.every(matches(row))
  );
}

export function createTasksActions() {
  const records = tasksRows.map((row) => ({ ...row }));
  return {
    list: (params: Record<string, unknown>) => {
      const rows = filterTasks(records, params);
      const sort = (params.sorting as { id: keyof TaskRow; desc?: boolean }[])
        ?.filter((item) => item.id in (records[0] ?? {}))
        .at(0);
      const sorted = sort
        ? [...rows].sort(
            (left, right) =>
              String(left[sort.id]).localeCompare(String(right[sort.id])) *
              (sort.desc ? -1 : 1)
          )
        : rows;
      return Promise.resolve({
        data: sorted.map((row) => ({ ...row })),
        meta: { pageCount: 1, totalCount: sorted.length },
      });
    },
  };
}

/** The dashboard as first saved: 4 columns, a row is 120px. */
export const projectsOverviewDashboard: Dashboard = {
  version: 1,
  id: "projects-overview",
  name: "Projects overview",
  widgets: [
    {
      id: "projects-count",
      type: "kpi",
      tableId: "views",
      settings: { metric: "count", label: "Projects" },
    },
    {
      id: "revenue-total",
      type: "kpi",
      tableId: "views",
      settings: { metric: "sum", metricColumn: "price", label: "Revenue" },
    },
    {
      id: "welcome",
      type: "note",
      title: "About this dashboard",
      settings: {
        text: "Projects and tasks at a glance.\nPick dates above to narrow every widget; Edit to arrange them.",
      },
    },
    {
      id: "revenue-chart",
      type: "view",
      tableId: "views",
      viewId: "revenue-by-category",
      settings: {},
    },
    {
      id: "projects-list",
      type: "view",
      tableId: "views",
      viewId: "projects-list",
      settings: {},
    },
    {
      id: "status-board",
      type: "view",
      tableId: "views",
      viewId: "status-board",
      settings: {},
    },
    {
      id: "open-tasks",
      type: "view",
      tableId: "tasks",
      viewId: "open-tasks",
      settings: {},
    },
  ],
  layout: [
    { widgetId: "projects-count", x: 0, y: 0, w: 1, h: 1 },
    { widgetId: "revenue-total", x: 1, y: 0, w: 1, h: 1 },
    { widgetId: "welcome", x: 2, y: 0, w: 2, h: 1 },
    { widgetId: "revenue-chart", x: 0, y: 1, w: 2, h: 4 },
    { widgetId: "projects-list", x: 2, y: 1, w: 2, h: 4 },
    { widgetId: "status-board", x: 0, y: 5, w: 2, h: 4 },
    { widgetId: "open-tasks", x: 2, y: 5, w: 2, h: 4 },
  ],
  filters: [
    {
      id: "due",
      type: "dateRange",
      label: "Due date",
      targets: [
        { tableId: "views", columnId: "dueDate" },
        { tableId: "tasks", columnId: "deadline" },
      ],
    },
    {
      id: "category",
      type: "select",
      label: "Category",
      targets: [{ tableId: "views", columnId: "category" }],
    },
  ],
};

const STORAGE_KEY = "yayaw-demo-dashboards";

const readSaved = (): Record<string, unknown> => {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

/**
 * `actions.dashboards` of the examples: in memory, mirrored in the tab's
 * session storage so a reload keeps what was saved.
 */
export function createDemoDashboardStorage(
  initial: Dashboard[] = [projectsOverviewDashboard]
): DashboardStorage {
  const dashboards = new Map<string, unknown>(
    initial.map((dashboard) => [dashboard.id, dashboard])
  );
  for (const [id, saved] of Object.entries(readSaved())) {
    dashboards.set(id, saved);
  }
  const persist = () => {
    try {
      globalThis.sessionStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(dashboards))
      );
    } catch {
      // Private windows may refuse storage; memory still works.
    }
  };
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  return {
    list: () =>
      Promise.resolve(
        [...dashboards.entries()].map(([id, value]) => ({
          id,
          name: String((value as { name?: unknown }).name ?? id),
        }))
      ),
    load: (id) =>
      dashboards.has(id)
        ? Promise.resolve(copy(dashboards.get(id)))
        : Promise.reject(new Error(`No dashboard "${id}".`)),
    save: (dashboard) => {
      dashboards.set(dashboard.id, copy(dashboard));
      persist();
      return Promise.resolve(copy(dashboard));
    },
    remove: (id) => {
      dashboards.delete(id);
      persist();
      return Promise.resolve();
    },
  };
}

export interface DashboardRequest {
  tableId: string;
  action: "list" | "aggregate";
  params: Record<string, unknown>;
}

/**
 * The examples log each request a widget sends (`window.yayawDashboardRequests`),
 * so tests can check the dashboard filters reach the host.
 */
export function logDashboardRequests<
  T extends {
    list?: (params: never) => unknown;
    aggregate?: (params: never) => unknown;
  },
>(tableId: string, actions: T): T {
  const log = (action: DashboardRequest["action"], params: unknown) => {
    const scope = globalThis as { yayawDashboardRequests?: DashboardRequest[] };
    scope.yayawDashboardRequests ??= [];
    scope.yayawDashboardRequests.push({
      tableId,
      action,
      params: JSON.parse(JSON.stringify(params ?? {})),
    });
  };
  const list = actions.list as
    | ((params: Record<string, unknown>) => unknown)
    | undefined;
  const aggregate = actions.aggregate as
    | ((params: Record<string, unknown>) => unknown)
    | undefined;
  return {
    ...actions,
    ...(list
      ? {
          list: (params: Record<string, unknown>) => {
            log("list", params);
            return list(params);
          },
        }
      : {}),
    ...(aggregate
      ? {
          aggregate: (params: Record<string, unknown>) => {
            log("aggregate", params);
            return aggregate(params);
          },
        }
      : {}),
  };
}
