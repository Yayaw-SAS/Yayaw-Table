import { expect, type Page, test } from "@playwright/test";

/**
 * Date rules name calendar days: the list action receives `YYYY-MM-DD`
 * values, never the instants of the viewer's midnights, and older links
 * holding such instants still filter the same days.
 */
const EXAMPLE = "/?example=views";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** React's day buttons; a selected day's name ends with ", selected". */
const FIRST_DAY = /September 5th, 2026/;
const LAST_DAY = /September 12th, 2026/;
const SHOWN = ["Bravo audit", "Charlie display", "Delta support"];
const HIDDEN = ["Alpha launch", "Echo sensors", "Foxtrot portal"];
const EXPECTED_RULE = {
  columnId: "dueDate",
  type: "date",
  operator: "between",
  values: ["2026-09-05", "2026-09-12"],
};

type Rule = Record<string, unknown>;

/** Every date rule of every list request the demo host received, as JSON. */
const listedDateRules = async (page: Page): Promise<Rule[]> =>
  (
    await page.evaluate(
      () =>
        (globalThis as { yayawDemoListRules?: unknown[][] })
          .yayawDemoListRules ?? []
    )
  )
    .flat()
    .filter((rule): rule is Rule => (rule as Rule)?.type === "date");

const lastDateRule = async (page: Page) => {
  const rule = (await listedDateRules(page)).at(-1);
  return (
    rule && {
      columnId: rule.columnId,
      type: rule.type,
      operator: rule.operator,
      values: rule.values,
    }
  );
};

const expectRecords = async (page: Page) => {
  for (const name of SHOWN) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  for (const name of HIDDEN) {
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  }
};

const expectOnlyDays = async (page: Page) => {
  const values = (await listedDateRules(page)).flatMap((rule) =>
    Array.isArray(rule.values) ? rule.values : [rule.values]
  );
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).toMatch(DAY);
  }
};

/**
 * Filter the Due column from its header menu: React picks the days in its
 * calendar, Vue types them in native date inputs.
 */
const filterDueBetween = async (page: Page, project: string) => {
  if (project === "vue") {
    await page.getByRole("button", { name: "Column options: Due" }).click();
    await page.getByRole("menuitem", { name: "Filter column" }).click();
    await page.getByLabel("Filter operator").selectOption("between");
    await page.getByLabel("Filter value", { exact: true }).fill("2026-09-05");
    await page.getByLabel("Filter value to").fill("2026-09-12");
    await page.getByRole("button", { name: "Apply" }).click();
    return;
  }
  await page
    .getByRole("columnheader")
    .getByText("Due", { exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Filter" }).click();
  const editor = page.getByRole("dialog");
  // The operator; the calendar's month and year pickers are comboboxes too.
  await editor.getByRole("combobox").filter({ hasText: "Equals" }).click();
  await page.getByRole("option", { name: "Between" }).click();
  // The calendar opens on today's month, September 2026 (see the clock).
  await editor.getByRole("button", { name: FIRST_DAY }).click();
  await editor.getByRole("button", { name: LAST_DAY }).click();
  await editor.getByRole("button", { name: "Done" }).click();
};

for (const [timezoneId, instants] of [
  // Older links held the instants of the viewer's midnights.
  ["Europe/Paris", ["2026-09-04T22:00:00.000Z", "2026-09-11T22:00:00.000Z"]],
  [
    "America/New_York",
    ["2026-09-05T04:00:00.000Z", "2026-09-12T04:00:00.000Z"],
  ],
] as const) {
  test.describe(`in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("a date range picked in the column filter reaches the list as days", async ({
      page,
    }, testInfo) => {
      await page.clock.setFixedTime(new Date("2026-09-20T12:00:00Z"));
      await page.goto(EXAMPLE);
      await expect(page.getByText("Alpha launch").first()).toBeVisible();
      await filterDueBetween(page, testInfo.project.name);
      await expect.poll(() => lastDateRule(page)).toEqual(EXPECTED_RULE);
      await expectOnlyDays(page);
      await expectRecords(page);
    });

    test("an older link with instants filters the same days", async ({
      page,
    }) => {
      const rules = [
        {
          id: "due",
          columnId: "dueDate",
          type: "date",
          operator: "between",
          values: instants,
          isActive: true,
        },
      ];
      await page.goto(
        `${EXAMPLE}&views-advancedFilters=${encodeURIComponent(JSON.stringify(rules))}`
      );
      await expect.poll(() => lastDateRule(page)).toEqual(EXPECTED_RULE);
      await expectOnlyDays(page);
      await expectRecords(page);
    });
  });
}
