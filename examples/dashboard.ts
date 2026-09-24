import {
  aggregateChartRows,
  type ChartAggregateRequest,
} from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import type {
  Dashboard,
  DashboardStorage,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

/**
 * The "Projects overview" dashboard of the React and Vue examples: a Projects
 * and a Tasks table whose dates follow today (so the numbers, comparisons and
 * trends always look current), their saved views, the dashboard and an
 * in-memory host. Both editions render exactly this.
 */

type Row = Record<string, unknown>;

/** A calendar day `YYYY-MM-DD`, `days` from today (local time). */
export function demoDay(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

/** Projects: [name, category, status, owner, revenue (€), due in days from today]. */
const PROJECTS: [string, string, string, string, number, number][] = [
  ["Atlas CRM rollout", "Software", "Done", "Ada Martin", 42_000, -168],
  ["Beacon sensor pilot", "Hardware", "Done", "Sam Chen", 18_500, -160],
  ["Cobalt data audit", "Service", "Done", "Léa Dubois", 9500, -151],
  ["Delta support renewal", "Service", "Done", "Noah Petit", 12_000, -139],
  ["Ember kiosk refresh", "Hardware", "Done", "Sam Chen", 26_000, -131],
  ["Fjord analytics", "Software", "Done", "Ada Martin", 31_000, -122],
  ["Garnet onboarding", "Consulting", "Done", "Léa Dubois", 14_500, -113],
  ["Harbor POS upgrade", "Hardware", "Done", "Noah Petit", 22_000, -104],
  ["Iris mobile app", "Software", "Done", "Ada Martin", 38_000, -96],
  ["Jade security review", "Consulting", "Done", "Léa Dubois", 16_000, -88],
  ["Kestrel migration", "Software", "Done", "Sam Chen", 27_500, -79],
  ["Lumen display wall", "Hardware", "Done", "Noah Petit", 33_000, -71],
  ["Maple training days", "Consulting", "Done", "Léa Dubois", 8000, -64],
  ["Nimbus cloud setup", "Software", "Done", "Ada Martin", 29_000, -57],
  ["Onyx field service", "Service", "Done", "Noah Petit", 11_500, -50],
  ["Pulse IoT gateway", "Hardware", "Done", "Sam Chen", 24_500, -44],
  ["Quartz billing portal", "Software", "Done", "Ada Martin", 36_000, -38],
  ["Raven helpdesk", "Service", "In progress", "Noah Petit", 13_000, -33],
  ["Sierra ERP connector", "Software", "Done", "Ada Martin", 41_000, -27],
  ["Tundra sensors, lot 2", "Hardware", "Delayed", "Sam Chen", 19_500, -21],
  ["Umber process audit", "Consulting", "Done", "Léa Dubois", 12_500, -16],
  ["Vega partner portal", "Software", "In progress", "Ada Martin", 47_000, -10],
  ["Willow support plan", "Service", "On hold", "Noah Petit", 9000, -6],
  ["Xenon lab benches", "Hardware", "Delayed", "Sam Chen", 28_000, -3],
  ["Yarrow data platform", "Software", "In progress", "Ada Martin", 52_000, 1],
  ["Zephyr kiosk rollout", "Hardware", "In progress", "Sam Chen", 23_000, 3],
  ["Aurora UX review", "Consulting", "Scheduled", "Léa Dubois", 7500, 5],
  ["Basalt API gateway", "Software", "Delayed", "Ada Martin", 34_000, 6],
  ["Fable onboarding kit", "Consulting", "On hold", "Léa Dubois", 10_500, 9],
  ["Cedar field training", "Service", "Scheduled", "Noah Petit", 6500, 12],
  ["Dune sensor network", "Hardware", "Scheduled", "Sam Chen", 45_000, 19],
  ["Echo analytics v2", "Software", "Scheduled", "Ada Martin", 39_000, 26],
];

/** What the latest update of a project says, by status (the "Updates" feed). */
const UPDATES: Record<string, string> = {
  Done: "Delivered and signed off by the client.",
  "In progress": "On track for the due date; the next review is booked.",
  Delayed: "Waiting on parts from the supplier; the plan is being reworked.",
  "On hold": "Paused until the client confirms the budget.",
  Scheduled: "Kick-off booked with the team.",
};

/** The projects, due relative to `today`. */
export function dashboardProjectRows(today: Date = new Date()) {
  return PROJECTS.map(
    ([name, category, status, owner, revenue, due], index) => ({
      id: `p${index + 1}`,
      name,
      category,
      status,
      owner,
      revenue,
      dueDate: demoDay(due, today),
      update: UPDATES[status] ?? "",
    })
  );
}

export const projectColumns = [
  { id: "name", header: "Project", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Software", "Hardware", "Service", "Consulting"]),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options([
      "Scheduled",
      "In progress",
      "Delayed",
      "On hold",
      "Done",
    ]),
  },
  { id: "owner", header: "Owner", type: "text" as const },
  {
    id: "revenue",
    header: "Revenue",
    type: "number" as const,
    numberFormat: { currency: "EUR", locale: "en-US", decimals: 0 },
  },
  { id: "dueDate", header: "Due", type: "date" as const },
  // Read by the "Updates" feed; hidden in the table.
  { id: "update", header: "Update", type: "text" as const },
];

/** Columns the Projects table shows: all but the feed's update text. */
export const projectVisibleColumns = projectColumns
  .map((column) => column.id)
  .filter((id) => id !== "update");

export const projectTableOptions = {
  syncUrl: false,
  enableAdvancedFilters: true,
  coloredTags: true,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list", "gallery", "kanban", "feed", "chart"] as (
    | "table"
    | "list"
    | "gallery"
    | "kanban"
    | "feed"
    | "chart"
  )[],
  defaultPageSize: 10,
  kanban: { groupBy: "status" },
  list: { titleColumn: "name", cardColumnIds: ["status", "revenue"] },
  gallery: {
    titleColumn: "name",
    cardColumnIds: ["category", "status", "revenue"],
  },
};

export const taskColumns = [
  { id: "title", header: "Task", type: "text" as const },
  {
    id: "team",
    header: "Team",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Marketing", "Finance", "Engineering", "Support"]),
  },
  { id: "deadline", header: "Deadline", type: "date" as const },
  { id: "done", header: "Done", type: "boolean" as const },
];

/** Tasks: [title, team, deadline in days from today, done]. */
const TASKS: [string, string, number, boolean][] = [
  ["Send the Q3 invoices", "Finance", -4, true],
  ["Write the launch post", "Marketing", -2, false],
  ["Calibrate the lab benches", "Engineering", 0, false],
  ["Renew the support plan", "Support", 2, false],
  ["Review the API gateway specs", "Engineering", 4, false],
  ["Plan the partner webinar", "Marketing", 6, false],
  ["Order the sensor parts", "Engineering", 9, true],
  ["Close the September books", "Finance", 11, false],
  ["Record the portal demo", "Marketing", 15, false],
  ["Update the field manuals", "Support", 18, false],
];

/** The tasks, their deadlines relative to `today`. */
export function dashboardTaskRows(today: Date = new Date()) {
  return TASKS.map(([title, team, deadline, done], index) => ({
    id: `t${index + 1}`,
    title,
    team,
    deadline: demoDay(deadline, today),
    done,
  }));
}

export const taskTableOptions = {
  syncUrl: false,
  enableAdvancedFilters: true,
  coloredTags: true,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list"] as ("table" | "list")[],
  defaultPageSize: 10,
  list: { titleColumn: "title", cardColumnIds: ["team", "deadline"] },
};

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

const chart = (settings: Record<string, unknown>) => ({
  displayMode: "chart",
  chart: settings,
});

/** Saved views of the Projects table; "Due this week" follows today. */
export function dashboardProjectViews(today: Date = new Date()) {
  return [
    view("projects", "all-projects", "All projects", {
      displayMode: "table",
      sorting: [{ id: "dueDate", desc: true }],
    }),
    view(
      "projects",
      "revenue-by-month",
      "Revenue by month",
      chart({
        type: "line",
        xColumn: "dueDate",
        bucket: "month",
        metric: "sum",
        metricColumn: "revenue",
        colors: "palette",
      })
    ),
    view(
      "projects",
      "revenue-by-category",
      "Revenue by category",
      chart({
        type: "horizontalBar",
        xColumn: "category",
        metric: "sum",
        metricColumn: "revenue",
        colors: "palette",
        sort: "valueDesc",
        showDataLabels: true,
      })
    ),
    view(
      "projects",
      "projects-by-status",
      "Projects by status",
      chart({ type: "donut", xColumn: "status", showDataLabels: true })
    ),
    view("projects", "top-projects", "Top projects", {
      displayMode: "list",
      density: "small",
      sorting: [{ id: "revenue", desc: true }],
      pageSize: 5,
    }),
    view("projects", "needs-attention", "Needs attention", {
      displayMode: "list",
      density: "small",
      advancedFilters: [
        {
          id: "attention",
          columnId: "status",
          type: "select",
          operator: "isAnyOf",
          values: ["Delayed", "On hold"],
          isActive: true,
        },
      ],
      sorting: [{ id: "dueDate", desc: false }],
    }),
    view("projects", "due-this-week", "Due this week", {
      displayMode: "list",
      density: "small",
      advancedFilters: [
        {
          id: "week",
          columnId: "dueDate",
          type: "date",
          operator: "between",
          values: [demoDay(0, today), demoDay(6, today)],
          isActive: true,
        },
      ],
      sorting: [{ id: "dueDate", desc: false }],
    }),
    view("projects", "status-board", "Status board", {
      displayMode: "kanban",
    }),
    view("projects", "project-cards", "Project cards", {
      displayMode: "gallery",
      gallery: { cardSize: "small", aspectRatio: "wide" },
      sorting: [{ id: "dueDate", desc: true }],
    }),
    view("projects", "updates", "Updates", {
      displayMode: "feed",
      feed: {
        titleColumn: "name",
        authorColumn: "owner",
        dateColumn: "dueDate",
        bodyColumn: "update",
        propertyColumnIds: ["status", "category"],
        pageSize: 5,
      },
    }),
  ];
}

export const dashboardTaskViews = [
  view("tasks", "open-tasks", "Open tasks", {
    displayMode: "table",
    density: "small",
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
    columnVisibility: { done: false },
    sorting: [{ id: "deadline", desc: false }],
  }),
];

/**
 * Like a server: keep the rows matching the view's filters and the
 * `requiredFilters` a dashboard joins to them (always AND).
 */
function filterRows<T extends Row>(rows: T[], input: Row): T[] {
  const params = compatibleListParams(input);
  const rules = params.advancedFilters as Row[];
  const required = Array.isArray(input.requiredFilters)
    ? (input.requiredFilters as Row[])
    : [];
  const matches = (row: T) => (rule: Row) =>
    matchesContractFilter(row[String(rule.columnId)], rule);
  const search = String(params.search ?? "").toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (params.advancedFilterJoin === "or" && rules.length
        ? rules.some(matches(row))
        : rules.every(matches(row))) &&
      required.every(matches(row)) &&
      (!search ||
        Object.values(row).some((value) =>
          String(value).toLocaleLowerCase().includes(search)
        ))
  );
}

/** Like a server: the first column sort. */
function sortRows<T extends Row>(rows: T[], sorting: unknown): T[] {
  const sort = (Array.isArray(sorting) ? sorting : []).find(
    (item): item is { id: string; desc?: boolean } =>
      typeof (item as { id?: unknown })?.id === "string"
  );
  if (!sort) {
    return rows;
  }
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = left[sort.id];
    const b = right[sort.id];
    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }
    return String(a).localeCompare(String(b)) * direction;
  });
}

/** An in-memory host: `list` filters, sorts and pages; `aggregate` groups for charts and numbers. */
function createDemoActions<T extends Row>(records: T[]) {
  return {
    list: (params: Row) => {
      const rows = sortRows(filterRows(records, params), params.sorting);
      const pageSize = Number(params.pageSize);
      const size =
        Number.isInteger(pageSize) && pageSize > 0 ? pageSize : rows.length;
      const page = Math.max(1, Number(params.page) || 1);
      return Promise.resolve({
        data: rows
          .slice((page - 1) * size, page * size)
          .map((row) => ({ ...row })),
        meta: {
          pageCount: Math.max(1, Math.ceil(rows.length / Math.max(1, size))),
          totalCount: rows.length,
        },
      });
    },
    aggregate: (query: object) => {
      const params = query as Row;
      if (!Array.isArray(params.groupBy)) {
        return Promise.reject(
          new Error("This demo host only answers chart groups.")
        );
      }
      return Promise.resolve(
        aggregateChartRows(
          filterRows(records, params),
          params as unknown as ChartAggregateRequest
        )
      );
    },
    update: (id: string, patch: Row) => {
      const record = records.find((row) => row.id === String(id));
      if (record) {
        Object.assign(record, patch);
      }
      return Promise.resolve({ success: Boolean(record), data: record });
    },
  };
}

export const createProjectActions = (today: Date = new Date()) =>
  createDemoActions(dashboardProjectRows(today));

export const createTaskActions = (today: Date = new Date()) =>
  createDemoActions(dashboardTaskRows(today));

/** The dashboard as first saved: 4 columns, a row is 120px, 1280×800 without scrolling. */
export const projectsOverviewDashboard: Dashboard = {
  version: 1,
  id: "projects-overview",
  name: "Projects overview",
  widgets: [
    {
      id: "revenue",
      type: "kpi",
      tableId: "projects",
      settings: {
        metric: "sum",
        metricColumn: "revenue",
        label: "Revenue",
        dateColumn: "dueDate",
        compare: { period: "previous", days: 30 },
        sparkline: { bucket: "month", buckets: 6 },
      },
    },
    {
      id: "projects-count",
      type: "kpi",
      tableId: "projects",
      settings: {
        metric: "count",
        label: "Projects",
        dateColumn: "dueDate",
        sparkline: { bucket: "month", buckets: 6 },
      },
    },
    {
      id: "attention",
      type: "kpi",
      tableId: "projects",
      viewId: "needs-attention",
      settings: { metric: "count", label: "Needs attention" },
    },
    {
      id: "due-week",
      type: "kpi",
      tableId: "projects",
      viewId: "due-this-week",
      settings: { metric: "count", label: "Due this week" },
    },
    {
      id: "revenue-trend",
      type: "view",
      tableId: "projects",
      viewId: "revenue-by-month",
      settings: {},
    },
    {
      id: "revenue-category",
      type: "view",
      tableId: "projects",
      viewId: "revenue-by-category",
      settings: {},
    },
    {
      id: "status-mix",
      type: "view",
      tableId: "projects",
      viewId: "projects-by-status",
      settings: {},
    },
    {
      id: "top-projects",
      type: "view",
      tableId: "projects",
      viewId: "top-projects",
      title: "Top projects by revenue",
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
    { widgetId: "revenue", x: 0, y: 0, w: 1, h: 1 },
    { widgetId: "projects-count", x: 1, y: 0, w: 1, h: 1 },
    { widgetId: "attention", x: 2, y: 0, w: 1, h: 1 },
    { widgetId: "due-week", x: 3, y: 0, w: 1, h: 1 },
    { widgetId: "revenue-trend", x: 0, y: 1, w: 2, h: 2 },
    { widgetId: "revenue-category", x: 2, y: 1, w: 1, h: 2 },
    { widgetId: "status-mix", x: 3, y: 1, w: 1, h: 2 },
    { widgetId: "top-projects", x: 0, y: 3, w: 2, h: 2 },
    { widgetId: "open-tasks", x: 2, y: 3, w: 2, h: 2 },
  ],
  filters: [
    {
      id: "due",
      type: "dateRange",
      label: "Due date",
      targets: [
        { tableId: "projects", columnId: "dueDate" },
        { tableId: "tasks", columnId: "deadline" },
      ],
    },
    {
      id: "category",
      type: "select",
      label: "Category",
      targets: [{ tableId: "projects", columnId: "category" }],
    },
  ],
};

const STORAGE_KEY = "yayaw-demo-dashboards-v2";

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
