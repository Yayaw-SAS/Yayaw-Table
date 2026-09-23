import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
const CURRENT_VIEW = /^current view/i;
const MODE = {
  gallery: /^gallery$/i,
  kanban: /^kanban$/i,
  table: /^table$/i,
} as const;

const openViewMenu = async (page: Page) => {
  await page.getByRole("button", { name: CURRENT_VIEW }).click();
  return page.getByRole("dialog", { name: "Views and settings" });
};

const displayModes = (page: Page) =>
  page
    .getByRole("dialog", { name: "Views and settings" })
    .getByRole("group", { name: "Display mode" });

const chooseMode = async (page: Page, mode: RegExp) => {
  await openViewMenu(page);
  await displayModes(page).getByRole("button", { name: mode }).click();
};

const expectMode = async (page: Page, mode: RegExp) => {
  const menu = page.getByRole("dialog", { name: "Views and settings" });
  if (await menu.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  }
  await openViewMenu(page);
  await expect(
    displayModes(page).getByRole("button", { name: mode })
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
};

const displayParam = (page: Page) =>
  new URL(page.url()).searchParams.get(DISPLAY_PARAM);

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("switching the display mode writes it to the URL and survives a reload", async ({
  page,
}) => {
  await chooseMode(page, MODE.kanban);
  await expect.poll(() => displayParam(page)).toBe("kanban");
  await page.keyboard.press("Escape");

  await page.reload();
  await expectMode(page, MODE.kanban);
});

test("a shared link opens the requested display mode", async ({ page }) => {
  await page.goto(`${EXAMPLE}&${DISPLAY_PARAM}=gallery`);
  await expectMode(page, MODE.gallery);
});

test("a display mode the table does not offer falls back to the default", async ({
  page,
}) => {
  await page.goto(`${EXAMPLE}&${DISPLAY_PARAM}=gantt`);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
  await expectMode(page, MODE.table);
});

test("a saved view restores its display mode", async ({ page }) => {
  await chooseMode(page, MODE.kanban);
  await page.getByRole("button", { name: "Save this view…" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Board");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: CURRENT_VIEW })).toContainText(
    "Board"
  );

  await chooseMode(page, MODE.table);
  await expect.poll(() => displayParam(page)).toBeNull();
  await page.keyboard.press("Escape");

  await openViewMenu(page);
  await page
    .getByRole("dialog", { name: "Views and settings" })
    .getByRole("button", { name: "Board" })
    .click();
  await expectMode(page, MODE.kanban);
});
