import { expect, type Page, test } from "@playwright/test";
import {
  dashboardProjectRows,
  dashboardTaskRows,
  demoDay,
  projectsOverviewDashboard,
} from "../examples/dashboard";
import {
  dashboardComparison,
  dashboardComparisonText,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

const DASHBOARD = "/?example=dashboard";
/** The demo's widgets in reading order. */
const WIDGETS = [
  "revenue",
  "projects-count",
  "attention",
  "due-week",
  "revenue-trend",
  "revenue-category",
  "status-mix",
  "top-projects",
  "open-tasks",
];
const PROJECTS = dashboardProjectRows();
const SHORT_DAY = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "2-digit",
});
const shortDay = (day: string): string =>
  SHORT_DAY.format(new Date(`${day}T00:00:00Z`));
const OPEN_TASKS = dashboardTaskRows().filter((task) => !task.done);
const TREND = /^Trend: /;
const HAS_DIGITS = /\d/;
const SELECT = /select/i;
const NEXT_PAGE = /next/i;
/** The demo host's saved dashboards, in the tab's session storage. */
const STORAGE_KEY = "yayaw-demo-dashboards-v2";

/**
 * A version 2 dashboard: numbers in a titled grid, then a flow holding an
 * inline list view, a full-page table, a host block and a note.
 */
const SCREEN = {
  version: 2,
  id: projectsOverviewDashboard.id,
  name: { en: "Projects overview", fr: "Vue des projets" },
  sections: [
    {
      id: "numbers",
      type: "grid",
      title: { en: "Numbers", fr: "Chiffres" },
      layout: [
        { widgetId: "projects-count", x: 0, y: 0, w: 1, h: 1 },
        { widgetId: "software", x: 1, y: 0, w: 1, h: 1 },
      ],
    },
    {
      id: "details",
      type: "flow",
      title: { en: "Details", fr: "Détails" },
      widgetIds: ["biggest", "pages", "summary", "notes"],
    },
  ],
  widgets: [
    ...projectsOverviewDashboard.widgets.filter(
      (entry) => entry.id === "projects-count"
    ),
    {
      id: "software",
      type: "kpi",
      tableId: "projects",
      title: { en: "Software", fr: "Logiciel" },
      view: {
        advancedFilters: [
          {
            id: "software",
            columnId: "category",
            type: "select",
            operator: "isAnyOf",
            values: ["Software"],
            isActive: true,
          },
        ],
      },
      settings: { metric: "count" },
    },
    {
      id: "biggest",
      type: "view",
      tableId: "projects",
      title: { en: "Biggest projects", fr: "Plus gros projets" },
      view: {
        displayMode: "list",
        sorting: [{ id: "revenue", desc: true }],
        pageSize: 5,
      },
      settings: {},
    },
    { id: "pages", type: "table", tableId: "tasks", settings: {} },
    { id: "summary", type: "block", block: "home.summary", settings: {} },
    {
      id: "notes",
      type: "note",
      settings: { text: "Figures follow today's date." },
    },
  ],
  filters: [],
};

interface LoggedRequest {
  tableId: string;
  action: "list" | "aggregate";
  params: { requiredFilters?: { columnId: string; values: string[] }[] };
}

const widget = (page: Page, id: string) =>
  page.locator(`[data-dashboard-widget="${id}"]`);
const item = (page: Page, id: string) =>
  page.locator(`[data-dashboard-item="${id}"]`);
const figure = (page: Page, id: string) =>
  widget(page, id).locator("[data-chart-number]");
const requests = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as { yayawDashboardRequests?: LoggedRequest[] })
        .yayawDashboardRequests ?? []
  );
const saveDashboards = (page: Page, dashboards: readonly { id: string }[]) =>
  page.addInitScript(
    ([key, saved]) => {
      sessionStorage.setItem(
        key,
        JSON.stringify(
          Object.fromEntries(saved.map((entry) => [entry.id, entry]))
        )
      );
    },
    [STORAGE_KEY, dashboards] as const
  );
const savedDashboards = (page: Page) =>
  page.evaluate(
    (key) =>
      JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<
        string,
        Record<string, unknown>
      >,
    STORAGE_KEY
  );
const clearRequests = (page: Page) =>
  page.evaluate(() => {
    (
      globalThis as { yayawDashboardRequests?: unknown[] }
    ).yayawDashboardRequests = [];
  });
/** The widget dialog: what the widget shows, then its source (a table), up to its settings. */
const addWidget = async (page: Page, kind: string, source?: string) => {
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  await dialog.getByRole("button", { name: kind, exact: true }).click();
  if (source) {
    await dialog.getByRole("option", { name: source, exact: true }).click();
  }
  await expect(dialog).toHaveAttribute("data-widget-step", "settings");
};
const openMenu = async (page: Page, title: string) => {
  await page
    .getByRole("button", { name: `Widget options for ${title}`, exact: true })
    .click();
};
const filterValue = (page: Page, id: string) =>
  page.locator(`[data-dashboard-filter="${id}"] [data-filter-value]`);
const filterPopup = (page: Page, id: string) =>
  page.locator(`[data-dashboard-filter-popup="${id}"]`);
/** The popover calendar: pick the first and last day of a range. */
const pickDays = async (page: Page, id: string, days: string[]) => {
  await page
    .locator(`[data-dashboard-filter="${id}"] [data-filter-trigger]`)
    .click();
  for (const day of days) {
    await filterPopup(page, id)
      .getByRole("button", { name: day, exact: true })
      .click();
  }
  await page.keyboard.press("Escape");
  await expect(filterPopup(page, id)).toHaveCount(0);
};
/** The option dropdown: tick an option. */
const chooseOption = async (page: Page, id: string, option: string) => {
  await page
    .locator(`[data-dashboard-filter="${id}"] [data-filter-trigger]`)
    .click();
  await filterPopup(page, id)
    .getByRole("checkbox", { name: option, exact: true })
    .check();
  await page.keyboard.press("Escape");
  await expect(filterPopup(page, id)).toHaveCount(0);
};
const toolbar = (page: Page) => page.locator("[data-dashboard] > header");
const gridReady = (page: Page) =>
  expect(page.locator(".yayaw-dashboard-grid[data-grid-ready]")).toHaveCount(1);
/** Elements inside the dashboard that scroll (either way), described. */
const innerScrollbars = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.querySelectorAll("[data-dashboard] *")) {
      const style = getComputedStyle(element);
      const scrollsY =
        ["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const scrollsX =
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1;
      if (scrollsY || scrollsX) {
        const owner = element
          .closest("[data-dashboard-widget]")
          ?.getAttribute("data-dashboard-widget");
        found.push(`${owner ?? "dashboard"}: ${element.tagName}`);
      }
    }
    return found;
  });
/** Records a fit widget shows, and whether each lies inside its card. */
const shownRecords = (page: Page, id: string) =>
  widget(page, id).evaluate((section) => {
    const body = section.querySelector("[data-widget-body]");
    const box = body?.getBoundingClientRect();
    // Outer records only: a feed item and its post both carry the id.
    const records = [...section.querySelectorAll("[data-row-id]")].filter(
      (record) => !record.parentElement?.closest("[data-row-id]")
    );
    const shown = records.filter(
      (record) =>
        !record.closest("[data-dashboard-overflow]") &&
        record.getClientRects().length > 0
    );
    return {
      loaded: records.length,
      shown: shown.length,
      inside: shown.every((record) => {
        const rect = record.getBoundingClientRect();
        return Boolean(box) && rect.bottom <= (box?.bottom ?? 0) + 1;
      }),
    };
  });
const fullDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(
    new Date(year ?? 0, (month ?? 1) - 1, date ?? 1)
  );
};
const revenueOf = (rows: typeof PROJECTS) =>
  rows.reduce((total, row) => total + row.revenue, 0);
const between = (day: string, start: string, end: string) =>
  day >= start && day <= end;

test("the dashboard shows numbers, charts and lists without a scrollbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(DASHBOARD);
  await expect(
    page.getByRole("heading", { name: "Projects overview" })
  ).toBeVisible();
  for (const id of WIDGETS) {
    await expect(widget(page, id)).toBeVisible();
  }
  // Numbers in the column's format; revenue of the last 30 days vs the 30 before.
  await expect(figure(page, "revenue")).toHaveText("€157,000");
  await expect(figure(page, "projects-count")).toHaveText(
    String(PROJECTS.length)
  );
  await expect(figure(page, "attention")).toHaveText("5");
  await expect(figure(page, "due-week")).toHaveText("4");
  const compare = widget(page, "revenue").locator("[data-kpi-compare]");
  await expect(compare).toHaveText("+38% vs previous period");
  await expect(compare).toHaveAttribute("data-tone", "positive");
  await expect(compare).toHaveAttribute("data-trend", "up");
  await expect(
    widget(page, "revenue").getByRole("img", { name: TREND })
  ).toBeVisible();
  await expect(
    widget(page, "projects-count").locator("[data-kpi-trend] polyline")
  ).toHaveAttribute("points", HAS_DIGITS);
  // Charts fill their widget.
  for (const [id, type] of [
    ["revenue-trend", "line"],
    ["revenue-category", "horizontalBar"],
    ["status-mix", "donut"],
  ]) {
    const chart = widget(page, id).locator(
      `[data-chart-fill][data-chart-type="${type}"]`
    );
    await expect(chart.locator("svg").first()).toBeVisible();
    await expect(chart.locator("[data-chart-title]")).toHaveCount(0);
  }
  await expect(
    widget(page, "status-mix").locator(
      '[data-chart-legend][data-placement="right"]'
    )
  ).toContainText("Done");
  // Lists show the records that fit and what is left.
  await expect(widget(page, "top-projects")).toContainText(
    "Yarrow data platform"
  );
  await expect(widget(page, "open-tasks")).toContainText(
    "Write the launch post"
  );
  await expect(
    widget(page, "top-projects").locator("[data-widget-more]")
  ).toBeVisible();
  expect(await innerScrollbars(page)).toEqual([]);
  // Nor does the page.
  const extent = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  expect(extent.height).toBeLessThanOrEqual(extent.viewport);
  expect(new URL(page.url()).search).toBe("?example=dashboard");
});

test("fit widgets show what fits, then +N more opens the full view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(DASHBOARD);
  await expect(widget(page, "top-projects")).toContainText(
    "Yarrow data platform"
  );
  for (const [id, total, opened] of [
    ["top-projects", PROJECTS.length, "projects › top-projects"],
    ["open-tasks", OPEN_TASKS.length, "tasks › open-tasks"],
  ] as const) {
    const more = widget(page, id).locator("[data-widget-more]");
    await expect(more).toBeVisible();
    const records = await shownRecords(page, id);
    expect(records.shown).toBeGreaterThanOrEqual(3);
    expect(records.shown).toBeLessThanOrEqual(records.loaded);
    expect(records.inside).toBe(true);
    await expect(more).toContainText(`+${total - records.shown} more`);
    await more.getByRole("button", { name: "View all" }).click();
    await expect(page.locator("[data-dashboard-opened]")).toHaveText(opened);
  }
  // No pagination and no selection in widgets.
  await expect(
    page.locator("[data-dashboard] [data-yayaw-pagination]")
  ).toHaveCount(0);
  await expect(
    widget(page, "open-tasks").getByRole("checkbox", { name: SELECT })
  ).toHaveCount(0);
});

test("dashboard filters reach every targeted table and set the KPI period", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await expect(figure(page, "projects-count")).toHaveText(
    String(PROJECTS.length)
  );
  await expect(
    page.locator('[data-dashboard-filter="due"] [data-filter-targets]')
  ).toHaveText("Applies to Projects › Due, Tasks › Deadline");
  await clearRequests(page);
  await expect(filterValue(page, "due")).toHaveText("Any date");
  // The calendar opens on this month: from the 1st to the 28th.
  const start = demoDay(1 - new Date().getDate());
  const end = demoDay(28 - new Date().getDate());
  await pickDays(page, "due", [fullDate(start), fullDate(end)]);
  // Days read as the first target column (Projects › Due) shows dates: its
  // table's short numeric preset.
  await expect(filterValue(page, "due")).toHaveText(
    `${shortDay(start)} – ${shortDay(end)}`
  );
  const inRange = PROJECTS.filter((row) => between(row.dueDate, start, end));
  await expect(figure(page, "projects-count")).toHaveText(
    String(inRange.length)
  );
  // The revenue compares the chosen days with as many days before them.
  const previousEnd = demoDay(-new Date().getDate());
  const previousStart = demoDay(-new Date().getDate() - 27);
  const previous = PROJECTS.filter((row) =>
    between(row.dueDate, previousStart, previousEnd)
  );
  await expect(
    widget(page, "revenue").locator("[data-kpi-compare]")
  ).toHaveText(
    dashboardComparisonText(
      dashboardComparison(revenueOf(inRange), revenueOf(previous)),
      "en"
    )
  );
  const openTasks = OPEN_TASKS.filter((task) =>
    between(task.deadline, start, end)
  );
  for (const task of OPEN_TASKS) {
    if (!openTasks.includes(task)) {
      await expect(widget(page, "open-tasks")).not.toContainText(task.title);
    }
  }
  const range = [start, end];
  const sent = await requests(page);
  const filtered = (tableId: string, action: string, columnId: string) =>
    sent.some(
      (request) =>
        request.tableId === tableId &&
        request.action === action &&
        request.params.requiredFilters?.some(
          (rule) =>
            rule.columnId === columnId &&
            JSON.stringify(rule.values) === JSON.stringify(range)
        )
    );
  // Charts and numbers aggregate on the server; lists list.
  expect(filtered("projects", "aggregate", "dueDate")).toBe(true);
  expect(filtered("projects", "list", "dueDate")).toBe(true);
  expect(filtered("tasks", "list", "deadline")).toBe(true);

  // The category filter targets the Projects widgets only.
  await expect(filterValue(page, "category")).toHaveText("All");
  await chooseOption(page, "category", "Software");
  await expect(filterValue(page, "category").locator(".yayaw-tag")).toHaveText([
    "Software",
  ]);
  await expect(figure(page, "projects-count")).toHaveText(
    String(inRange.filter((row) => row.category === "Software").length)
  );
  await page
    .locator('[data-dashboard-filter="due"]')
    .getByRole("button", { name: "Clear" })
    .click();
  await expect(figure(page, "projects-count")).toHaveText(
    String(PROJECTS.filter((row) => row.category === "Software").length)
  );
  // The values readers pick stay in the URL (one key per filter); widgets
  // write nothing there.
  expect(new URL(page.url()).search).toBe(
    "?example=dashboard&projects-overview.category=Software"
  );
  await page.reload();
  await expect(figure(page, "projects-count")).toHaveText(
    String(PROJECTS.filter((row) => row.category === "Software").length)
  );
});

test("widgets move and resize from their menu, and the layout is saved", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await openMenu(page, "Revenue");
  await expect(
    page.getByRole("menuitem", { name: "Move left" })
  ).toBeDisabled();
  await page.getByRole("menuitem", { name: "Move right" }).click();
  await expect(item(page, "revenue")).toHaveAttribute("data-layout", "1,0,1,1");
  await expect(item(page, "projects-count")).toHaveAttribute(
    "data-layout",
    "0,0,1,1"
  );
  await openMenu(page, "Due this week");
  await page.getByRole("menuitem", { name: "Taller" }).click();
  await expect(item(page, "due-week")).toHaveAttribute(
    "data-layout",
    "3,0,1,2"
  );
  // The widget below makes room.
  await expect(item(page, "status-mix")).toHaveAttribute(
    "data-layout",
    "3,2,1,2"
  );
  await openMenu(page, "Revenue by month");
  await page.getByRole("menuitem", { name: "Narrower" }).click();
  await expect(item(page, "revenue-trend")).toHaveAttribute(
    "data-layout",
    "0,1,1,2"
  );
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  await expect(
    toolbar(page).getByRole("button", { name: "Edit" })
  ).toBeVisible();

  await page.reload();
  await expect(item(page, "revenue")).toHaveAttribute("data-layout", "1,0,1,1");
  await expect(item(page, "due-week")).toHaveAttribute(
    "data-layout",
    "3,0,1,2"
  );
  await expect(item(page, "revenue-trend")).toHaveAttribute(
    "data-layout",
    "0,1,1,2"
  );
});

test("charts adapt to small widgets without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await openMenu(page, "Projects by status");
  await page.getByRole("menuitem", { name: "Shorter" }).click();
  await expect(item(page, "status-mix")).toHaveAttribute(
    "data-layout",
    "3,1,1,1"
  );
  await openMenu(page, "Revenue by month");
  await page.getByRole("menuitem", { name: "Narrower" }).click();
  await expect(item(page, "revenue-trend")).toHaveAttribute(
    "data-layout",
    "0,1,1,2"
  );
  // A one-row donut drops its legend; the narrow line keeps its points.
  const donut = widget(page, "status-mix");
  await expect(
    donut.locator('[data-chart-legend-placement="none"]')
  ).toHaveCount(1);
  await expect(donut.locator("svg").first()).toBeVisible();
  await expect(
    widget(page, "revenue-trend").locator("svg").first()
  ).toBeVisible();
  const box = await widget(page, "status-mix").boundingBox();
  const chart = await donut.locator("[data-chart-fill]").boundingBox();
  expect(chart && box && chart.y + chart.height <= box.y + box.height + 1).toBe(
    true
  );
  expect(await innerScrollbars(page)).toEqual([]);
});

test("widgets move and resize by dragging in edit mode", async ({ page }) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  // No handles outside edit mode.
  await expect(page.locator("[data-dashboard-drag-handle]")).toHaveCount(0);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  const handle = widget(page, "projects-count").locator(
    "[data-dashboard-drag-handle]"
  );
  const target = await item(page, "revenue").boundingBox();
  const start = await handle.boundingBox();
  if (!(target && start)) {
    throw new Error("The widgets are not laid out.");
  }
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 24, target.y + 24, { steps: 16 });
  await page.mouse.up();
  await expect(item(page, "projects-count")).toHaveAttribute(
    "data-layout",
    "0,0,1,1"
  );
  await expect(item(page, "revenue")).toHaveAttribute("data-layout", "1,0,1,1");

  // The bottom-right handle resizes: one more row.
  await item(page, "due-week").hover();
  const resize = item(page, "due-week").locator(".ui-resizable-se");
  const corner = await resize.boundingBox();
  if (!corner) {
    throw new Error("The resize handle is missing.");
  }
  await page.mouse.move(
    corner.x + corner.width / 2,
    corner.y + corner.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + 130, {
    steps: 16,
  });
  await page.mouse.up();
  await expect(item(page, "due-week")).toHaveAttribute(
    "data-layout",
    "3,0,1,2"
  );
});

test("widgets are added from the picker at a size that suits them", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });

  // The Tasks table's default view: a 2×2 table in the first free spot.
  await addWidget(page, "View", "Tasks");
  await expect(
    dialog.getByLabel("Records that do not fit", { exact: true })
  ).toHaveValue("fit");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  const tasks = widget(page, "widget-10");
  await expect(tasks.locator("[data-widget-title]")).toHaveText(
    "Tasks › Default view"
  );
  await expect(item(page, "widget-10")).toHaveAttribute(
    "data-layout",
    "0,5,2,2"
  );
  // Booleans: an unchecked checkbox-style mark, never a red "False" badge.
  await expect(
    tasks.locator('.yayaw-boolean[data-value="false"]').first()
  ).toBeVisible();
  await expect(tasks).not.toContainText("False");

  // A board: 2×3, lanes sharing the width, cards that fit and "+N more".
  await addWidget(page, "View", "Projects");
  await dialog
    .getByLabel("Start from", { exact: true })
    .selectOption("status-board");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  const board = widget(page, "widget-11");
  await expect(item(page, "widget-11")).toHaveAttribute(
    "data-layout",
    "2,5,2,3"
  );
  await expect(board.locator("[data-widget-more]")).toContainText("more");
  await expect(board).not.toContainText("—");
  const records = await shownRecords(page, "widget-11");
  expect(records.shown).toBeGreaterThan(0);
  expect(records.inside).toBe(true);

  // A number comparing the last 90 days, with its trend.
  await addWidget(page, "Number", "Projects");
  await dialog.getByLabel("Value", { exact: true }).selectOption("sum");
  await dialog.getByLabel("Of", { exact: true }).selectOption("revenue");
  await dialog.getByLabel("Date", { exact: true }).selectOption("dueDate");
  await dialog.getByLabel("Compare with the previous period").check();
  await dialog.getByLabel("Period", { exact: true }).selectOption("90");
  await dialog.getByLabel("Trend line").check();
  await dialog.getByLabel("Title", { exact: true }).fill("Quarter revenue");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  const kpi = widget(page, "widget-12");
  await expect(kpi.locator("[data-widget-title]")).toHaveText(
    "Quarter revenue"
  );
  const quarter = PROJECTS.filter((row) =>
    between(row.dueDate, demoDay(-89), demoDay(0))
  );
  const before = PROJECTS.filter((row) =>
    between(row.dueDate, demoDay(-179), demoDay(-90))
  );
  await expect(figure(page, "widget-12")).toHaveText(
    `€${revenueOf(quarter).toLocaleString("en-US")}`
  );
  await expect(kpi.locator("[data-kpi-compare]")).toHaveText(
    dashboardComparisonText(
      dashboardComparison(revenueOf(quarter), revenueOf(before)),
      "en"
    )
  );
  await expect(kpi.locator("[data-kpi-trend]")).toBeVisible();

  // A note has nothing to open.
  await addWidget(page, "Note");
  await dialog.getByLabel("Text", { exact: true }).fill("Hello");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(widget(page, "widget-13")).toContainText("Hello");
  await expect(
    widget(page, "widget-13").getByRole("button", { name: "Open full view" })
  ).toHaveCount(0);

  await openMenu(page, "Quarter revenue");
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(widget(page, "widget-12")).toHaveCount(0);
});

test("gallery and feed widgets fit too, without scrollbars", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  for (const view of ["project-cards", "updates"]) {
    await addWidget(page, "View", "Projects");
    await dialog.getByLabel("Start from", { exact: true }).selectOption(view);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
  }
  // Galleries and feeds are 2×3; their first line always shows.
  await expect(item(page, "widget-10")).toHaveAttribute(
    "data-layout",
    "0,5,2,3"
  );
  await expect(item(page, "widget-11")).toHaveAttribute(
    "data-layout",
    "2,5,2,3"
  );
  await expect(widget(page, "widget-11")).toContainText("Echo analytics v2");
  for (const id of ["widget-10", "widget-11"]) {
    const more = widget(page, id).locator("[data-widget-more]");
    await expect(more).toBeVisible();
    const records = await shownRecords(page, id);
    expect(records.shown).toBeGreaterThan(0);
    await expect(more).toContainText(
      `+${PROJECTS.length - records.shown} more`
    );
  }
  // The feed's own "Load more" gives way to "+N more".
  await expect(
    widget(page, "widget-11").locator("[data-feed-footer]")
  ).toBeHidden();
  expect(await innerScrollbars(page)).toEqual([]);
});

test("phones stack the widgets in reading order, without drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DASHBOARD);
  await expect(page.locator('[data-dashboard-layout="stack"]')).toBeVisible();
  const boxes: { x: number; y: number; height: number }[] = [];
  for (const id of WIDGETS) {
    const box = await item(page, id).boundingBox();
    expect(box).not.toBeNull();
    boxes.push(box as NonNullable<typeof box>);
  }
  for (const [index, box] of boxes.entries()) {
    expect(Math.round(box.x)).toBe(Math.round(boxes[0]?.x ?? 0));
    if (index > 0) {
      expect(box.y).toBeGreaterThan(boxes[index - 1]?.y ?? 0);
    }
  }
  // Figures take the height of their content, charts one that suits the
  // phone's width; record widgets keep their rows (120px less the margins).
  expect(boxes[2]?.height ?? 0).toBeLessThan(100);
  const chart = await widget(page, "status-mix")
    .locator("[data-widget-body]")
    .boundingBox();
  expect(
    Math.abs((chart?.height ?? 0) - ((chart?.width ?? 0) * 10) / 16)
  ).toBeLessThanOrEqual(2);
  expect(Math.round(boxes[7]?.height ?? 0)).toBe(228);
  await expect(
    widget(page, "top-projects").locator("[data-widget-more]")
  ).toBeVisible();
  expect(await innerScrollbars(page)).toEqual([]);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("[data-dashboard-drag-handle]")).toHaveCount(0);
  // The keyboard menu still reorders.
  await openMenu(page, "Projects");
  await page.getByRole("menuitem", { name: "Move left" }).click();
  const first = await item(page, "projects-count").boundingBox();
  const second = await item(page, "revenue").boundingBox();
  expect(first?.y ?? 0).toBeLessThan(second?.y ?? 0);
});

test("a French page shows its widgets in French", async ({ page }) => {
  // The last widget shows every project and scrolls instead of fitting, so
  // its pagination shows.
  const dashboard = {
    ...projectsOverviewDashboard,
    widgets: projectsOverviewDashboard.widgets.map((item) =>
      item.id === "open-tasks"
        ? {
            ...item,
            tableId: "projects",
            viewId: "all-projects",
            settings: { overflow: "scroll" },
          }
        : item
    ),
  };
  await page.addInitScript((saved) => {
    sessionStorage.setItem(
      "yayaw-demo-dashboards-v2",
      JSON.stringify({ [saved.id]: saved })
    );
  }, dashboard);
  await page.goto(`${DASHBOARD}&lang=fr`);
  await expect(
    toolbar(page).getByRole("button", { name: "Tout actualiser" })
  ).toBeVisible();
  await expect(
    widget(page, "top-projects").locator("[data-widget-more]")
  ).toContainText("Tout voir");
  await expect(widget(page, "open-tasks")).toContainText("Lignes par page");
  await expect(widget(page, "open-tasks")).not.toContainText("Rows per page");
});

test("Open full view asks the host, and readers cannot edit", async ({
  page,
}) => {
  await page.goto(`${DASHBOARD}&readonly`);
  await expect(widget(page, "revenue-category")).toBeVisible();
  await expect(toolbar(page).getByRole("button", { name: "Edit" })).toHaveCount(
    0
  );
  await widget(page, "revenue-category")
    .getByRole("button", { name: "Open full view" })
    .click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "projects › revenue-by-category"
  );
  await widget(page, "attention")
    .getByRole("button", { name: "Open full view" })
    .click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "projects › needs-attention"
  );
  await widget(page, "open-tasks")
    .getByRole("button", { name: "Open full view" })
    .click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "tasks › open-tasks"
  );
});

test("list pages render alike in both editions", async ({ page }) => {
  // More rows than a page: both editions show the list's pagination.
  await page.goto("/?example=views&views-display=list&views-pageSize=5");
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: NEXT_PAGE }).first()
  ).toBeVisible();
});

test("a version 1 dashboard is saved back as version 2", async ({ page }) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  const saved = (await savedDashboards(page))[projectsOverviewDashboard.id];
  expect(saved?.version).toBe(2);
  expect(saved?.layout).toBeUndefined();
  expect(saved?.sections).toEqual([
    { id: "main", type: "grid", layout: projectsOverviewDashboard.layout },
  ]);
  expect((saved?.widgets as { id: string }[]).map((entry) => entry.id)).toEqual(
    WIDGETS
  );
  // Read again, it shows as before.
  await page.reload();
  await expect(item(page, "revenue")).toHaveAttribute("data-layout", "0,0,1,1");
  await expect(figure(page, "projects-count")).toHaveText(
    String(PROJECTS.length)
  );
});

test("version 2 sections: a titled grid, a flow, inline views, a full-page table and a block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await saveDashboards(page, [SCREEN]);
  await page.goto(DASHBOARD);
  await expect(
    page.getByRole("heading", { name: "Projects overview", level: 2 })
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-section="numbers"]')
  ).toHaveAttribute("data-section-type", "grid");
  await expect(
    page.locator('[data-dashboard-section="details"]')
  ).toHaveAttribute("data-section-type", "flow");
  await expect(
    page.getByRole("heading", { name: "Numbers", level: 3 })
  ).toBeVisible();
  // Widget titles sit one level under their section's.
  await expect(
    widget(page, "software").getByRole("heading", { level: 4 })
  ).toHaveText("Software");
  // A number over inline settings: its own filter, no saved view.
  await expect(figure(page, "software")).toHaveText(
    String(PROJECTS.filter((row) => row.category === "Software").length)
  );
  // A flow widget takes its natural height and keeps the view's pagination.
  const biggest = widget(page, "biggest");
  await expect(biggest.locator("[data-row-id]").first()).toContainText(
    "Yarrow data platform"
  );
  await expect(
    biggest.getByRole("button", { name: NEXT_PAGE }).first()
  ).toBeVisible();
  // A full-page table: the source's list page, without a card.
  await expect(widget(page, "pages")).toHaveAttribute(
    "data-widget-frame",
    "page"
  );
  await expect(
    widget(page, "pages").locator('[data-page-table="tasks"] [data-row-id]')
  ).toHaveCount(dashboardTaskRows().length);
  // The demo host has no blocks: the block is unavailable, and kept.
  await expect(
    widget(page, "summary").locator('[data-widget-state="unknownBlock"]')
  ).toHaveText("Unavailable block");
  await expect(widget(page, "notes")).toContainText(
    "Figures follow today's date."
  );
  expect(await innerScrollbars(page)).toEqual([]);
  // An inline view opens the source's default view.
  await biggest.getByRole("button", { name: "Open full view" }).click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "projects › default"
  );
});

test("version 2 texts follow the page's language", async ({ page }) => {
  await saveDashboards(page, [SCREEN]);
  await page.goto(`${DASHBOARD}&lang=fr`);
  await expect(
    page.getByRole("heading", { name: "Vue des projets", level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chiffres", level: 3 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Détails", level: 3 })
  ).toBeVisible();
  await expect(
    widget(page, "software").locator("[data-widget-title]")
  ).toHaveText("Logiciel");
  await expect(
    widget(page, "biggest").locator("[data-widget-title]")
  ).toHaveText("Plus gros projets");
  await expect(
    widget(page, "summary").locator('[data-widget-state="unknownBlock"]')
  ).toHaveText("Bloc indisponible");
});

test("flow widgets move up and down in edit mode, and sections are saved", async ({
  page,
}) => {
  await saveDashboards(page, [SCREEN]);
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  // No drag handle in a flow; the menu moves up and down, without resizing.
  await expect(
    widget(page, "biggest").locator("[data-dashboard-drag-handle]")
  ).toHaveCount(0);
  await openMenu(page, "Biggest projects");
  await expect(page.getByRole("menuitem", { name: "Move up" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "Wider" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Move down" }).click();
  const order = () =>
    page
      .locator('[data-dashboard-section="details"] [data-dashboard-item]')
      .evaluateAll((items) =>
        items.map((entry) => entry.getAttribute("data-dashboard-item"))
      );
  await expect.poll(order).toEqual(["pages", "biggest", "summary", "notes"]);
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  const saved = (await savedDashboards(page))[SCREEN.id];
  expect(saved?.name).toEqual(SCREEN.name);
  expect(saved?.sections).toEqual([
    SCREEN.sections[0],
    {
      ...SCREEN.sections[1],
      widgetIds: ["pages", "biggest", "summary", "notes"],
    },
  ]);
});
