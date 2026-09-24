import { expect, type Page, test } from "@playwright/test";

const DASHBOARD = "/?example=dashboard";
const WIDGETS = [
  "projects-count",
  "revenue-total",
  "welcome",
  "revenue-chart",
  "projects-list",
  "status-board",
  "open-tasks",
];

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
const clearRequests = (page: Page) =>
  page.evaluate(() => {
    (
      globalThis as { yayawDashboardRequests?: unknown[] }
    ).yayawDashboardRequests = [];
  });
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

test("the dashboard renders every widget from its own view, the URL untouched", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await expect(
    page.getByRole("heading", { name: "Projects overview" })
  ).toBeVisible();
  for (const id of WIDGETS) {
    await expect(widget(page, id)).toBeVisible();
  }
  await expect(figure(page, "projects-count")).toHaveText("6");
  await expect(figure(page, "revenue-total")).toHaveText("€761.00");
  await expect(widget(page, "welcome")).toContainText(
    "Projects and tasks at a glance."
  );
  await expect(
    widget(page, "revenue-chart").locator("[data-chart-title]")
  ).toHaveText("Sum of Price by Category");
  await expect(widget(page, "projects-list")).toContainText("Foxtrot portal");
  await expect(widget(page, "status-board")).toContainText("Charlie display");
  // The Open tasks view filters out done tasks.
  await expect(widget(page, "open-tasks")).toContainText(
    "Write the launch post"
  );
  await expect(widget(page, "open-tasks")).not.toContainText(
    "Audit the invoices"
  );
  expect(new URL(page.url()).search).toBe("?example=dashboard");
});

test("dashboard filters reach every targeted table's requests", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await expect(figure(page, "projects-count")).toHaveText("6");
  await expect(
    page.locator('[data-dashboard-filter="due"] [data-filter-targets]')
  ).toHaveText("Applies to Projects › Due, Tasks › Deadline");
  await clearRequests(page);
  await expect(filterValue(page, "due")).toHaveText("Any date");
  await pickDays(page, "due", [
    "Tuesday, September 1, 2026",
    "Thursday, September 10, 2026",
  ]);
  await expect(filterValue(page, "due")).toHaveText(
    "Sep 1, 2026 – Sep 10, 2026"
  );
  await expect(figure(page, "projects-count")).toHaveText("3");
  await expect(figure(page, "revenue-total")).toHaveText("€568.00");
  await expect(widget(page, "projects-list")).not.toContainText(
    "Delta support"
  );
  await expect(widget(page, "open-tasks")).toContainText(
    "Calibrate the display"
  );
  await expect(widget(page, "open-tasks")).not.toContainText(
    "Renew the support plan"
  );
  const range = ["2026-09-01", "2026-09-10"];
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
  // Charts and numbers aggregate on the server; lists and boards list.
  expect(filtered("views", "aggregate", "dueDate")).toBe(true);
  expect(filtered("views", "list", "dueDate")).toBe(true);
  expect(filtered("tasks", "list", "deadline")).toBe(true);

  // The category filter targets the Projects widgets only.
  await expect(filterValue(page, "category")).toHaveText("All");
  await chooseOption(page, "category", "Software");
  await expect(filterValue(page, "category").locator(".yayaw-tag")).toHaveText([
    "Software",
  ]);
  await expect(figure(page, "projects-count")).toHaveText("1");
  await expect(widget(page, "open-tasks")).toContainText(
    "Calibrate the display"
  );
  await page
    .locator('[data-dashboard-filter="due"]')
    .getByRole("button", { name: "Clear" })
    .click();
  await expect(figure(page, "projects-count")).toHaveText("2");
  expect(new URL(page.url()).search).toBe("?example=dashboard");
});

test("widgets move and resize from their menu, and the layout is saved", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await openMenu(page, "Projects");
  await expect(
    page.getByRole("menuitem", { name: "Move left" })
  ).toBeDisabled();
  await page.getByRole("menuitem", { name: "Move right" }).click();
  await expect(item(page, "projects-count")).toHaveAttribute(
    "data-layout",
    "1,0,1,1"
  );
  await expect(item(page, "revenue-total")).toHaveAttribute(
    "data-layout",
    "0,0,1,1"
  );
  await openMenu(page, "About this dashboard");
  await page.getByRole("menuitem", { name: "Taller" }).click();
  await expect(item(page, "welcome")).toHaveAttribute("data-layout", "2,0,2,2");
  // The widget below makes room.
  await expect(item(page, "projects-list")).toHaveAttribute(
    "data-layout",
    "2,2,2,4"
  );
  await openMenu(page, "Revenue by category");
  await page.getByRole("menuitem", { name: "Narrower" }).click();
  await expect(item(page, "revenue-chart")).toHaveAttribute(
    "data-layout",
    "0,1,1,4"
  );
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  await expect(
    toolbar(page).getByRole("button", { name: "Edit" })
  ).toBeVisible();

  await page.reload();
  await expect(item(page, "projects-count")).toHaveAttribute(
    "data-layout",
    "1,0,1,1"
  );
  await expect(item(page, "welcome")).toHaveAttribute("data-layout", "2,0,2,2");
  await expect(item(page, "revenue-chart")).toHaveAttribute(
    "data-layout",
    "0,1,1,4"
  );
});

test("widgets move and resize by dragging in edit mode", async ({ page }) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  // No handles outside edit mode.
  await expect(page.locator("[data-dashboard-drag-handle]")).toHaveCount(0);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  const handle = widget(page, "revenue-total").locator(
    "[data-dashboard-drag-handle]"
  );
  const target = await item(page, "projects-count").boundingBox();
  const start = await handle.boundingBox();
  if (!(target && start)) {
    throw new Error("The widgets are not laid out.");
  }
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 24, target.y + 24, { steps: 16 });
  await page.mouse.up();
  await expect(item(page, "revenue-total")).toHaveAttribute(
    "data-layout",
    "0,0,1,1"
  );
  await expect(item(page, "projects-count")).toHaveAttribute(
    "data-layout",
    "1,0,1,1"
  );

  // The bottom-right handle resizes: one more row.
  await item(page, "welcome").hover();
  const resize = item(page, "welcome").locator(".ui-resizable-se");
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
  await expect(item(page, "welcome")).toHaveAttribute("data-layout", "2,0,2,2");
});

test("widgets are added from the picker", async ({ page }) => {
  await page.goto(DASHBOARD);
  await gridReady(page);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  await dialog.getByLabel("Table", { exact: true }).selectOption("tasks");
  await dialog.getByRole("button", { name: "Add" }).click();
  const added = widget(page, "widget-8");
  await expect(added.locator("[data-widget-title]")).toHaveText(
    "Tasks › Default view"
  );
  // The default view lists every task, done ones included.
  await expect(added).toContainText("Audit the invoices");
  await expect(item(page, "widget-8")).toHaveAttribute(
    "data-layout",
    "0,9,2,3"
  );

  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  await dialog.getByLabel("Widget", { exact: true }).selectOption("kpi");
  await dialog.getByLabel("Value", { exact: true }).selectOption("max");
  await dialog.getByLabel("Of", { exact: true }).selectOption("price");
  await dialog.getByLabel("Title", { exact: true }).fill("Top price");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(
    widget(page, "widget-9").locator("[data-widget-title]")
  ).toHaveText("Top price");
  await expect(figure(page, "widget-9")).toHaveText("€399.00");

  await openMenu(page, "Top price");
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(widget(page, "widget-9")).toHaveCount(0);
});

test("phones stack the widgets in reading order, without drag", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DASHBOARD);
  await expect(page.locator('[data-dashboard-layout="stack"]')).toBeVisible();
  const boxes: { x: number; y: number }[] = [];
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
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("[data-dashboard-drag-handle]")).toHaveCount(0);
  // The keyboard menu still reorders.
  await openMenu(page, "Revenue");
  await page.getByRole("menuitem", { name: "Move left" }).click();
  const first = await item(page, "revenue-total").boundingBox();
  const second = await item(page, "projects-count").boundingBox();
  expect(first?.y ?? 0).toBeLessThan(second?.y ?? 0);
});

test("Open full view asks the host, and readers cannot edit", async ({
  page,
}) => {
  await page.goto(`${DASHBOARD}&readonly`);
  await expect(widget(page, "revenue-chart")).toBeVisible();
  await expect(toolbar(page).getByRole("button", { name: "Edit" })).toHaveCount(
    0
  );
  await widget(page, "revenue-chart")
    .getByRole("button", { name: "Open full view" })
    .click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "views › revenue-by-category"
  );
  await widget(page, "open-tasks")
    .getByRole("button", { name: "Open full view" })
    .click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "tasks › open-tasks"
  );
  // Notes have nothing to open.
  await expect(
    widget(page, "welcome").getByRole("button", { name: "Open full view" })
  ).toHaveCount(0);
});

const NEXT_PAGE = /next/i;

test("booleans, board cards and list pages render alike in both editions", async ({
  page,
}) => {
  await page.goto(DASHBOARD);
  // Booleans: an unchecked checkbox-style mark, never a red "False" badge.
  const tasks = widget(page, "open-tasks");
  await expect(tasks.locator('.yayaw-boolean[data-value="false"]')).toHaveCount(
    4
  );
  await expect(
    tasks.getByRole("img", { name: "False", exact: true }).first()
  ).toBeVisible();
  await expect(tasks).not.toContainText("False");
  // Board cards leave out hidden columns and blank values.
  const board = widget(page, "status-board");
  await expect(board).toContainText("Charlie display");
  await expect(board).not.toContainText("—");
  // One page of projects: no pagination under the list.
  await expect(widget(page, "projects-list")).toContainText("Foxtrot portal");
  await expect(
    widget(page, "projects-list").getByRole("button", { name: NEXT_PAGE })
  ).toHaveCount(0);

  // More rows than a page: both editions show the list's pagination.
  await page.goto("/?example=views&views-display=list&views-pageSize=5");
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: NEXT_PAGE }).first()
  ).toBeVisible();
});
