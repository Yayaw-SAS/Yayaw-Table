import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
const CURRENT_VIEW = /^current view/i;
const SEARCH = /^search/i;
const SEARCH_TAB = /Search/;

const displayParam = (page: Page) =>
  new URL(page.url()).searchParams.get(DISPLAY_PARAM);

const saveView = async (page: Page, name: string, layout?: string) => {
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  if (layout) {
    await page.getByRole("combobox", { name: "Layout" }).click();
    await page.getByRole("option", { name: layout }).click();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("saved views appear as tabs with their layout, and + creates one in another layout", async ({
  page,
}) => {
  // Without saved views the view menu keeps its named trigger.
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await page.getByRole("button", { name: CURRENT_VIEW }).click();
  await page.getByRole("button", { name: "Save this view…" }).click();
  await saveView(page, "Active projects");

  const tabs = page.getByRole("tablist", { name: "Views" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Default view",
    "Active projects",
  ]);
  await expect(
    tabs.getByRole("tab", { name: "Active projects" })
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "New view" }).click();
  await saveView(page, "Deadlines", "Calendar");
  await expect(tabs.getByRole("tab", { name: "Deadlines" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect.poll(() => displayParam(page)).toBe("calendar");
  await expect(page.locator("[data-calendar-title]")).toBeVisible();

  await tabs.getByRole("tab", { name: "Default view" }).click();
  await expect.poll(() => displayParam(page)).toBeNull();
  await tabs.getByRole("tab", { name: "Deadlines" }).click();
  await expect.poll(() => displayParam(page)).toBe("calendar");

  // The settings stay one click away.
  await page.getByRole("button", { name: "Views and settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Views and settings" })
  ).toBeVisible();
});

test("an edited view shows as modified on its tab", async ({ page }) => {
  await page.getByRole("button", { name: CURRENT_VIEW }).click();
  await page.getByRole("button", { name: "Save this view…" }).click();
  await saveView(page, "Search");
  const tab = page.getByRole("tab", { name: SEARCH_TAB });
  await expect(tab.locator("output")).toHaveCount(0);
  await page.getByPlaceholder(SEARCH).fill("Alpha");
  await expect(tab.locator("output")).toBeVisible();
});
