import { expect, type Page, test } from "@playwright/test";

const SETTINGS_PARAM = "views-chart";
const CARD_SETTINGS = /^card settings/i;
const SHOW_TABLE = "Show as table";

const chart = (page: Page) => page.locator("section[data-chart-type]");
const legend = (page: Page) => page.locator("[data-chart-legend] li");
const title = (page: Page) => page.locator("[data-chart-title]");
/** Bars of both engines: Recharts rectangles and Unovis bar paths. */
const bars = (page: Page) =>
  chart(page).locator(':is(.recharts-rectangle, path[class$="-bar"])');
const settingsParam = (page: Page) =>
  JSON.parse(new URL(page.url()).searchParams.get(SETTINGS_PARAM) ?? "{}");
const displayParam = (page: Page) =>
  new URL(page.url()).searchParams.get("views-display");
const filtersParam = (page: Page) =>
  decodeURIComponent(
    new URL(page.url()).searchParams.get("views-advancedFilters") ?? ""
  );
/** The view's filter rules in the URL (React keeps a list, Vue `{ filters }`). */
const filterRules = (page: Page) => {
  const parsed = JSON.parse(filtersParam(page) || "[]");
  const rules: Record<string, unknown>[] = Array.isArray(parsed)
    ? parsed
    : (parsed.filters ?? []);
  return rules.map(({ columnId, type, operator, values }) => ({
    columnId,
    type,
    operator,
    values,
  }));
};
const chartUrl = (settings: Record<string, unknown>) =>
  `/?example=views&views-display=chart&${SETTINGS_PARAM}=${encodeURIComponent(JSON.stringify(settings))}`;
const tableRows = async (page: Page) =>
  (await page.locator("[data-chart-table] tbody tr").allInnerTexts()).map(
    (text) => text.replaceAll("\t", " ").replace(/\s+/g, " ").trim()
  );
const tableHeaders = async (page: Page) =>
  (await page.locator("[data-chart-table] thead th").allInnerTexts()).map(
    (text) => text.trim()
  );

/** Saved views past the first three are under "More". */
const openView = async (page: Page, name: string, example = "views") => {
  await page.goto(`/?example=${example}`);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name }).click();
};
const openChartSettings = async (page: Page) => {
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
};
/** The funnel's stage order in the chart settings. */
const stageList = (page: Page) => page.locator("[data-chart-stages] li");
const choose = async (page: Page, setting: string, option: string) => {
  await page.getByRole("combobox", { name: setting, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
/** The records the table shows after a chart group was clicked. */
const expectRecords = async (page: Page, shown: string[], hidden: string[]) => {
  await expect.poll(() => displayParam(page)).toBeNull();
  for (const name of shown) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
  for (const name of hidden) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
};

// The same numbers with `actions.aggregate` (both metrics in one request) and
// without it (rows loaded and grouped in the browser).
for (const example of ["views", "views-fallback"]) {
  test(`${example}: the Revenus et marge view charts revenue as bars and the average margin as a line`, async ({
    page,
  }) => {
    await openView(page, "Revenus et marge", example);
    await expect(chart(page)).toHaveAttribute("data-chart-type", "combo");
    await expect(title(page)).toHaveText(
      "Sum of Price and Average of Margin by Category"
    );
    await expect(legend(page)).toHaveText([
      "Sum of Price",
      "Average of Margin",
    ]);
    // Euros on the left axis, percents on the right one.
    await expect(
      chart(page).getByText("€600.00", { exact: true })
    ).toBeVisible();
    await expect(chart(page).getByText("60%", { exact: true })).toBeVisible();
    await expect(bars(page)).toHaveCount(3);
    await page.getByRole("button", { name: SHOW_TABLE }).click();
    expect(await tableHeaders(page)).toEqual([
      "Category",
      "Sum of Price",
      "Average of Margin",
    ]);
    expect(await tableRows(page)).toEqual([
      "Software €64.00 58.5%",
      "Hardware €478.00 22.5%",
      "Service €219.00 38%",
    ]);
  });
}

test("clicking a combo bar shows its records in the table", async ({
  page,
}) => {
  await openView(page, "Revenus et marge");
  await expect(bars(page)).toHaveCount(3);
  // Near the bar's foot: the line's point sits over its middle.
  const box = await bars(page).nth(1).boundingBox();
  if (!box) {
    throw new Error("The Hardware bar has no box.");
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
  await expectRecords(
    page,
    ["Charlie display", "Echo sensors"],
    ["Alpha launch"]
  );
  await expect
    .poll(() => filtersParam(page))
    .toContain('"values":["Hardware"]');
});

test("a chart becomes bars and a line with a metric of its own", async ({
  page,
}) => {
  await page.goto(chartUrl({ xColumn: "category", hideEmpty: true }));
  await openChartSettings(page);
  await choose(page, "Chart type", "Bars and line");
  await expect(chart(page)).toHaveAttribute("data-chart-type", "combo");
  await choose(page, "Line", "Average");
  await choose(page, "Line of", "Margin");
  await expect(title(page)).toHaveText(
    "Count and Average of Margin by Category"
  );
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({
      type: "combo",
      lineMetric: "avg",
      lineMetricColumn: "margin",
    });
  await choose(page, "Curve", "Straight");
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({ curve: "linear" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: SHOW_TABLE }).click();
  expect(await tableRows(page)).toEqual([
    "Software 2 58.5%",
    "Hardware 2 22.5%",
    "Service 2 38%",
  ]);
});

test("the Pipeline view shows each status as a funnel stage with its rates", async ({
  page,
}) => {
  await openView(page, "Pipeline");
  await expect(chart(page)).toHaveAttribute("data-chart-type", "funnel");
  await expect(title(page)).toHaveText("Count by Status");
  await expect(legend(page)).toHaveText(["Active", "Draft", "Archived"]);
  const funnel = page.locator("[data-chart-funnel]");
  await expect(funnel).toHaveAttribute("data-chart-funnel", "vertical");
  await expect(funnel.locator("[data-funnel-stage] text")).toHaveText([
    "Active",
    "3",
    "100% of first",
    "Draft",
    "2",
    "66.7% of first",
    "66.7% from previous",
    "Archived",
    "1",
    "33.3% of first",
    "50% from previous",
  ]);
  await expect(
    funnel.getByRole("img", { name: "Count by Status" })
  ).toBeVisible();
  // Narrow charts stack the stages from top to bottom.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(funnel).toHaveAttribute("data-chart-funnel", "horizontal");
  await page.getByRole("button", { name: SHOW_TABLE }).click();
  expect(await tableHeaders(page)).toEqual([
    "Stage",
    "Count",
    "% of first",
    "Conversion",
  ]);
  expect(await tableRows(page)).toEqual([
    "Active 3 100% —",
    "Draft 2 66.7% 66.7%",
    "Archived 1 33.3% 50%",
  ]);
});

test("clicking a funnel stage shows its records in the table", async ({
  page,
}) => {
  await openView(page, "Pipeline");
  await page
    .getByRole("button", { name: "Show the records of Draft", exact: true })
    .click();
  const draft = {
    shown: ["Bravo audit", "Echo sensors"],
    hidden: ["Alpha launch", "Delta support"],
  };
  await expectRecords(page, draft.shown, draft.hidden);
  // The select rule the filter menus write, kept by the URL.
  await expect
    .poll(() => filterRules(page))
    .toEqual([
      {
        columnId: "status",
        type: "select",
        operator: "isAnyOf",
        values: ["Draft"],
      },
    ]);
  await page.reload();
  await expectRecords(page, draft.shown, draft.hidden);
});

test("funnel stages are reordered with the arrows or by drag, and the order is saved", async ({
  page,
}) => {
  await openView(page, "Pipeline");
  await openChartSettings(page);
  const stages = stageList(page);
  await expect(stages).toHaveText(["Active", "Draft", "Archived"]);
  await page.getByRole("button", { name: "Move Archived up" }).click();
  await expect(stages).toHaveText(["Active", "Archived", "Draft"]);
  // The moved stage keeps the focus for the next move.
  await expect(
    page.getByRole("button", { name: "Move Archived up" })
  ).toBeFocused();
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({ stageOrder: ["Active", "Archived", "Draft"] });
  await stages.nth(2).dragTo(stages.nth(0));
  await expect(stages).toHaveText(["Draft", "Active", "Archived"]);
  await expect(legend(page)).toHaveText(["Draft", "Active", "Archived"]);
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({ stageOrder: ["Draft", "Active", "Archived"] });
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(legend(page)).toHaveText(["Draft", "Active", "Archived"]);
  await expect(
    page.locator("[data-chart-funnel] [data-funnel-stage] text").nth(3)
  ).toHaveText("Active");
  // Back to the option order: the view keeps no order of its own.
  await openChartSettings(page);
  await page.getByRole("button", { name: "Reset the order" }).click();
  await expect(stageList(page)).toHaveText(["Active", "Draft", "Archived"]);
  await expect.poll(() => settingsParam(page).stageOrder).toBeUndefined();
});

test("the Livraisons cumulées view stacks deliveries per category, week after week", async ({
  page,
}) => {
  await openView(page, "Livraisons cumulées");
  await expect(chart(page)).toHaveAttribute("data-chart-type", "area");
  await expect(title(page)).toHaveText("Count by Due");
  await expect(legend(page)).toHaveText(["Software", "Hardware", "Service"]);
  await page.getByRole("button", { name: SHOW_TABLE }).click();
  expect(await tableHeaders(page)).toEqual([
    "Due",
    "Software",
    "Hardware",
    "Service",
    "Total",
  ]);
  expect(await tableRows(page)).toEqual([
    "Week of 8/31/26 1 0 1 2",
    "Week of 9/7/26 1 1 2 4",
    "Week of 9/14/26 2 2 2 6",
  ]);
  // Stacked to 100%: each category's share of the week, beside its count.
  await openChartSettings(page);
  await choose(page, "Stacking", "Stacked to 100%");
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({ stacking: "percent" });
  await expect
    .poll(() => tableRows(page))
    .toEqual([
      "Week of 8/31/26 1 (50%) 0 (0%) 1 (50%) 2",
      "Week of 9/7/26 1 (25%) 1 (25%) 2 (50%) 4",
      "Week of 9/14/26 2 (33.3%) 2 (33.3%) 2 (33.3%) 6",
    ]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Show as chart" }).click();
  await expect(chart(page).getByText("100%", { exact: true })).toBeVisible();
});

test("clicking an area shows the records of the week under the pointer", async ({
  page,
}) => {
  await openView(page, "Livraisons cumulées");
  // The chart's drawing: Recharts' surface or the Unovis container.
  const surface = chart(page)
    .locator(".recharts-surface, [data-chart-area] svg")
    .first();
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  if (!box) {
    throw new Error("The area chart has no box.");
  }
  // The middle of the plot is the week of September 7.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7);
  const week = {
    shown: ["Charlie display", "Delta support"],
    hidden: ["Alpha launch", "Echo sensors"],
  };
  await expectRecords(page, week.shown, week.hidden);
  // The date filter rule the filter menus write, kept by the URL.
  await expect
    .poll(() => filterRules(page))
    .toEqual([
      {
        columnId: "dueDate",
        type: "date",
        operator: "between",
        values: ["2026-09-07", "2026-09-13"],
      },
    ]);
  await page.reload();
  await expectRecords(page, week.shown, week.hidden);
});

// Yes/no groups filter like the table's own filter on the column: a select
// rule on the stored value, or "is empty" for records without one.
for (const [group, operator, values, shown, hidden] of [
  [
    "Checked",
    "isAnyOf",
    [true],
    ["Alpha launch", "Charlie display", "Delta support"],
    ["Bravo audit", "Foxtrot portal"],
  ],
  [
    "Unchecked",
    "isAnyOf",
    [false],
    ["Bravo audit", "Echo sensors"],
    ["Alpha launch", "Foxtrot portal"],
  ],
  [
    "No value",
    "isEmpty",
    [],
    ["Foxtrot portal"],
    ["Alpha launch", "Bravo audit"],
  ],
] as const) {
  test(`clicking the ${group} group of a yes/no column filters the table, after a reload too`, async ({
    page,
  }) => {
    await page.goto(chartUrl({ xColumn: "invoiced" }));
    await expect(title(page)).toHaveText("Count by Invoiced");
    await page.getByRole("button", { name: SHOW_TABLE }).click();
    expect(await tableRows(page)).toEqual([
      "Checked 3",
      "Unchecked 2",
      "No value 1",
    ]);
    await page
      .getByRole("button", {
        name: `Show the records of ${group}`,
        exact: true,
      })
      .click();
    await expectRecords(page, [...shown], [...hidden]);
    await expect
      .poll(() => filterRules(page))
      .toEqual([
        { columnId: "invoiced", type: "select", operator, values: [...values] },
      ]);
    await page.reload();
    await expectRecords(page, [...shown], [...hidden]);
    await expect
      .poll(() => filterRules(page))
      .toEqual([
        { columnId: "invoiced", type: "select", operator, values: [...values] },
      ]);
  });
}

/** Boxes of the visible x-axis labels of both engines, left to right. */
const xLabelBoxes = async (page: Page) =>
  (
    await chart(page)
      .locator("svg text")
      .evaluateAll((items) =>
        items
          .filter((item) => (item.textContent ?? "").trim() !== "")
          .filter((item) => {
            const style = getComputedStyle(item);
            return (
              style.opacity !== "0" &&
              style.visibility !== "hidden" &&
              style.display !== "none"
            );
          })
          .map((item) => {
            const box = item.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top };
          })
      )
  )
    .filter((box) => box.right > box.left)
    .sort((left, right) => left.left - right.left);

test("on a phone, a line's day labels do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    chartUrl({ type: "line", xColumn: "dueDate", bucket: "day" })
  );
  await expect(chart(page)).toHaveAttribute("data-chart-type", "line");
  await expect
    .poll(async () => (await xLabelBoxes(page)).length)
    .toBeGreaterThan(1);
  // The x axis is the lowest row of labels.
  const boxes = await xLabelBoxes(page);
  const bottom = Math.max(...boxes.map((box) => box.top));
  const row = boxes.filter((box) => bottom - box.top < 6);
  for (const [index, box] of row.entries()) {
    const next = row[index + 1];
    if (next) {
      expect(box.right).toBeLessThanOrEqual(next.left + 1);
    }
  }
});

test("on a phone, the longest horizontal bar keeps its value label inside", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    chartUrl({
      type: "horizontalBar",
      xColumn: "category",
      metric: "sum",
      metricColumn: "price",
      showDataLabels: true,
    })
  );
  const label = chart(page).getByText("€478.00", { exact: true });
  await expect(label).toBeVisible();
  const surface = await chart(page)
    .locator(".recharts-surface, .yayaw-chart-canvas svg")
    .first()
    .boundingBox();
  const text = await label.boundingBox();
  if (!(surface && text)) {
    throw new Error("The chart or its label has no box.");
  }
  expect(text.x + text.width).toBeLessThanOrEqual(surface.x + surface.width);
});
