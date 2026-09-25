import { expect, type Page, test } from "@playwright/test";

const CHART = "/?example=views&views-display=chart";
const SETTINGS_PARAM = "views-chart";
const CARD_SETTINGS = /^card settings/i;
const SHOW_TABLE = "Show as table";
const ACTIVE_THREE = /^Active\s*3$/;
const DRAFT_TWO = /^Draft\s*2$/;
const ARCHIVED_ONE = /^Archived\s*1$/;

const chart = (page: Page) => page.locator("section[data-chart-type]");
/** Bars of both engines: Recharts rectangles and Unovis bar paths. */
const bars = (page: Page) =>
  chart(page).locator(':is(.recharts-rectangle, path[class$="-bar"])');
const settingsParam = (page: Page) =>
  JSON.parse(new URL(page.url()).searchParams.get(SETTINGS_PARAM) ?? "{}");
const displayParam = (page: Page) =>
  new URL(page.url()).searchParams.get("views-display");
const chartUrl = (settings: Record<string, unknown>, example = "views") =>
  `/?example=${example}&views-display=chart&${SETTINGS_PARAM}=${encodeURIComponent(JSON.stringify(settings))}`;
const tableRows = async (page: Page) =>
  (await page.locator("[data-chart-table] tbody tr").allInnerTexts()).map(
    (text) => text.replaceAll("\t", " ").replace(/\s+/g, " ").trim()
  );

const openChartSettings = async (page: Page) => {
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
};
const choose = async (page: Page, setting: string, option: string) => {
  await page.getByRole("combobox", { name: setting, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

// The same numbers with `actions.aggregate` (server groups) and without it (rows loaded and grouped in the browser).
for (const example of ["views", "views-fallback"]) {
  test(`${example}: the Revenue by category view sums prices per category`, async ({
    page,
  }) => {
    await page.goto(`/?example=${example}`);
    await page.getByRole("tab", { name: "Revenue by category" }).click();
    await expect(chart(page)).toHaveAttribute("data-chart-type", "bar");
    await expect(page.locator("[data-chart-title]")).toHaveText(
      "Sum of Price by Category"
    );
    // Data labels are on in this view.
    for (const value of ["€64.00", "€478.00", "€219.00"]) {
      await expect(chart(page).getByText(value, { exact: true })).toBeVisible();
    }
    await expect(bars(page)).toHaveCount(3);
    await page.getByRole("button", { name: SHOW_TABLE }).click();
    expect(await tableRows(page)).toEqual([
      "Software €64.00",
      "Hardware €478.00",
      "Service €219.00",
      "Other €0.00",
    ]);
  });
}

test("the chart mode is chosen and configured in the view menu", async ({
  page,
}) => {
  await page.goto(CHART);
  await expect(page.locator("[data-chart-title]")).toHaveText(
    "Count by Category"
  );
  await openChartSettings(page);
  await choose(page, "Chart type", "Line");
  await expect(chart(page)).toHaveAttribute("data-chart-type", "line");
  await choose(page, "X axis", "Status");
  await expect(page.locator("[data-chart-title]")).toHaveText(
    "Count by Status"
  );
  await choose(page, "Y axis", "Sum");
  await choose(page, "Of", "Price");
  await expect(page.locator("[data-chart-title]")).toHaveText(
    "Sum of Price by Status"
  );
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({
      type: "line",
      xColumn: "status",
      metric: "sum",
      metricColumn: "price",
    });
  await page.reload();
  await expect(chart(page)).toHaveAttribute("data-chart-type", "line");
  await expect(page.locator("[data-chart-title]")).toHaveText(
    "Sum of Price by Status"
  );
});

test("the legend and data labels follow the settings", async ({ page }) => {
  await page.goto(
    chartUrl({
      xColumn: "category",
      seriesColumn: "status",
      metric: "sum",
      metricColumn: "price",
    })
  );
  await expect(page.locator("[data-chart-legend] li")).toHaveText([
    "Active",
    "Draft",
    "Archived",
  ]);
  await expect(chart(page).getByText("€64.00", { exact: true })).toHaveCount(0);
  await openChartSettings(page);
  await choose(page, "Data labels", "On");
  // Stacked segments carry their own value: Software is only Active projects.
  await expect(chart(page).getByText("€64.00", { exact: true })).toBeVisible();
  await expect(chart(page).getByText("€399.00", { exact: true })).toBeVisible();
  await choose(page, "Legend", "Off");
  await expect(page.locator("[data-chart-legend]")).toHaveCount(0);
});

test("a donut shows each group's share and the total", async ({ page }) => {
  await page.goto(
    chartUrl({ type: "donut", xColumn: "status", showDataLabels: true })
  );
  await expect(page.locator("[data-chart-legend] li")).toHaveText([
    ACTIVE_THREE,
    DRAFT_TWO,
    ARCHIVED_ONE,
  ]);
  await expect(chart(page).getByText("Total", { exact: true })).toBeVisible();
});

test("clicking a bar shows its records in the table", async ({ page }) => {
  await page.goto(CHART);
  await expect(bars(page)).toHaveCount(3);
  // Bars follow the option order: Software, Hardware, Service.
  await bars(page).nth(1).click();
  await expect.poll(() => displayParam(page)).toBeNull();
  await expect(page.getByText("Charlie display").first()).toBeVisible();
  await expect(page.getByText("Echo sensors").first()).toBeVisible();
  await expect(page.getByText("Alpha launch")).toHaveCount(0);
  await expect
    .poll(() =>
      decodeURIComponent(
        new URL(page.url()).searchParams.get("views-advancedFilters") ?? ""
      )
    )
    .toContain('"values":["Hardware"]');
});

test("the table fallback lists the chart's numbers and opens a group", async ({
  page,
}) => {
  await page.goto(
    chartUrl({ type: "line", xColumn: "dueDate", bucket: "week" })
  );
  await page.getByRole("button", { name: SHOW_TABLE }).click();
  // Weeks read in the Due column's format (the table's default short date).
  expect(await tableRows(page)).toEqual([
    "Week of 8/31/26 2",
    "Week of 9/7/26 2",
    "Week of 9/14/26 2",
  ]);
  await page
    .getByRole("button", { name: "Show the records of Week of 9/7/26" })
    .click();
  await expect.poll(() => displayParam(page)).toBeNull();
  await expect(page.getByText("Charlie display").first()).toBeVisible();
  await expect(page.getByText("Delta support").first()).toBeVisible();
  await expect(page.getByText("Bravo audit")).toHaveCount(0);
});

test("the Projects over time view counts projects by due month", async ({
  page,
}) => {
  await page.goto("/?example=views");
  // Past three saved views, tabs move under "…" (More views).
  await page.getByRole("button", { name: "More views", exact: true }).click();
  await page.getByRole("menuitem", { name: "Projects over time" }).click();
  await expect(chart(page)).toHaveAttribute("data-chart-type", "line");
  await expect(page.locator("[data-chart-title]")).toHaveText("Count by Due");
  await page.getByRole("button", { name: SHOW_TABLE }).click();
  expect(await tableRows(page)).toEqual(["Sep 2026 6"]);
});
