import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
const SEARCH = /^search/i;
const SEARCH_BUTTON = /^search/i;
const CURRENT_VIEW_TRIGGER = /^current view/i;
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
  // The default view is a tab from the start.
  await expect(page.getByRole("tab")).toHaveText(["Default view"]);
  await page.getByRole("button", { name: "View actions" }).click();
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

  // Settings are separate from the views, on the right.
  await page.getByRole("button", { name: "View settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "View settings" })
  ).toBeVisible();
});

test("an edited view shows as modified on its tab", async ({ page }) => {
  await page.getByRole("button", { name: "View actions" }).click();
  await page.getByRole("button", { name: "Save this view…" }).click();
  await saveView(page, "Search");
  const tab = page.getByRole("tab", { name: SEARCH_TAB });
  await expect(tab.locator("output")).toHaveCount(0);
  await page.getByPlaceholder(SEARCH).fill("Alpha");
  await expect(tab.locator("output")).toBeVisible();
});

test("on phones, views and settings are two separate menus and search opens on demand", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(EXAMPLE);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Data actions" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "View settings" }).click();
  const settings = page.getByRole("dialog", { name: "View settings" });
  await expect(settings.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Share", exact: true })
  ).toBeVisible();
  await expect(settings.getByText("Default view")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: CURRENT_VIEW_TRIGGER }).click();
  await expect(
    page.getByRole("button", { name: "Save this view…" })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: SEARCH_BUTTON }).click();
  await page.getByPlaceholder(SEARCH).fill("Bravo");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("views-q"))
    .toBe("Bravo");
});

test("custom destinations receive the view's query from the Data section", async ({
  page,
}) => {
  await page.goto(`${EXAMPLE}&views-q=bravo`);
  await page.getByRole("button", { name: "View settings" }).click();
  const settings = page.getByRole("dialog", { name: "View settings" });
  await expect(
    settings.getByRole("button", { name: "Share", exact: true })
  ).toBeVisible();
  await settings.getByRole("button", { name: "Send to n8n" }).click();
  await expect(
    page.getByText("Sent 1 records to the n8n workflow")
  ).toBeVisible();
});
