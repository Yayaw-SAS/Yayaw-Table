import { expect, type Page, test } from "@playwright/test";

const CALENDAR = "/?example=views&views-display=calendar";
const SETTINGS_PARAM = "views-calendar";
const CARD_SETTINGS = /^card settings/i;
const CALENDAR_MODE = /^calendar/i;

const event = (page: Page, title: string) =>
  page.locator(".yayaw-calendar-event", { hasText: title });
const day = (page: Page, date: string) =>
  page.locator(`[role="gridcell"][data-date="${date}"]`);
const settingsParam = (page: Page) =>
  JSON.parse(new URL(page.url()).searchParams.get(SETTINGS_PARAM) ?? "{}");

const dragTo = async (page: Page, title: string, date: string) => {
  const from = await event(page, title).boundingBox();
  const to = await day(page, date).boundingBox();
  if (!(from && to)) {
    throw new Error(`Cannot drag ${title} to ${date}`);
  }
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T10:00:00"));
});

test("records appear on their date in the month grid", async ({ page }) => {
  await page.goto(CALENDAR);
  await expect(page.locator("[data-calendar-title]")).toHaveText(
    "September 2026"
  );
  await expect(day(page, "2026-09-02")).toContainText("Alpha launch");
  await expect(day(page, "2026-09-18")).toContainText("Foxtrot portal");
  await expect(
    event(page, "Alpha launch").locator(".yayaw-tag")
  ).toHaveAttribute("data-colored", "true");
});

test("the layout is a view setting kept in the URL", async ({ page }) => {
  await page.goto(CALENDAR);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator("[data-calendar-layout]")).toHaveAttribute(
    "data-calendar-layout",
    "list"
  );
  expect(settingsParam(page)).toMatchObject({ layout: "list" });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "List", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Charlie display")).toBeVisible();
});

test("settings from a shared link hide weekends and start weeks on Sunday", async ({
  page,
}) => {
  const settings = { showWeekends: false, weekStartsOn: 0 };
  await page.goto(
    `${CALENDAR}&${SETTINGS_PARAM}=${encodeURIComponent(JSON.stringify(settings))}`
  );
  await expect(day(page, "2026-09-02")).toBeVisible();
  await expect(day(page, "2026-09-05")).toHaveCount(0);
  await expect(page.getByRole("columnheader").first()).toContainText("Mon");
});

test("dragging a record to another day saves its new date", async ({
  page,
}) => {
  await page.goto(CALENDAR);
  await dragTo(page, "Alpha launch", "2026-09-03");
  await expect(day(page, "2026-09-03")).toContainText("Alpha launch");
  // Leaving the month and coming back reloads rows from the list action.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("[data-calendar-title]")).toHaveText(
    "October 2026"
  );
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(day(page, "2026-09-03")).toContainText("Alpha launch");
  await expect(day(page, "2026-09-02")).not.toContainText("Alpha launch");
});

test("clicking a day opens the create form with that date", async ({
  page,
}) => {
  await page.goto(CALENDAR);
  await day(page, "2026-09-22").click({ position: { x: 40, y: 70 } });
  const form = page.getByRole("dialog");
  await expect(form).toBeVisible();
  await expect(form.locator('input[type="date"]')).toHaveValue("2026-09-22");
});

test("calendar settings are offered in the view menu", async ({ page }) => {
  await page.goto(CALENDAR);
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await expect(menu.getByRole("combobox", { name: "Display mode" })).toHaveText(
    CALENDAR_MODE
  );
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
  await expect(
    page.getByRole("combobox", { name: "Date", exact: true })
  ).toContainText("Due");
  await expect(page.getByRole("combobox", { name: "Color" })).toContainText(
    "Status"
  );
  await expect(page.getByRole("combobox", { name: "Weekends" })).toContainText(
    "On"
  );
});

test("clicking an event opens its record view", async ({ page }) => {
  await page.goto(CALENDAR);
  await event(page, "Bravo audit").click();
  await expect(page.getByText("Activity").first()).toBeVisible();
});
