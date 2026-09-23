import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
const CURRENT_VIEW = /^current view/i;
const FILTERS = /^filters?/i;
const SORT = /^sort/i;
const TWO_RULES = [
  {
    id: "a",
    columnId: "status",
    type: "select",
    operator: "is",
    values: ["Active"],
    isActive: true,
  },
  {
    id: "b",
    columnId: "category",
    type: "select",
    operator: "is",
    values: ["Service"],
    isActive: true,
  },
];
const MODE = {
  gallery: /^gallery$/i,
  kanban: /^kanban$/i,
  list: /^list$/i,
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

test("advanced filters can match any rule instead of all rules", async ({
  page,
}) => {
  const rules = encodeURIComponent(JSON.stringify(TWO_RULES));
  await page.goto(`${EXAMPLE}&views-advancedFilters=${rules}`);
  const combination = async () => {
    await openViewMenu(page);
    await page
      .getByRole("dialog", { name: "Views and settings" })
      .getByRole("button", { name: FILTERS })
      .click();
    return page.getByRole("combobox", { name: "Filter combination" });
  };

  const select = await combination();
  await expect(select).toHaveValue("and");
  await select.selectOption("or");
  await expect(select).toHaveValue("or");
  // The URL is written after the change settles; reloading earlier loses it.
  await expect
    .poll(() => decodeURIComponent(decodeURIComponent(page.url())))
    .toContain('"joinOperator":"or"');

  await page.reload();
  await expect(await combination()).toHaveValue("or");
});

test("the list view shows one line per record, grouped by the table grouping", async ({
  page,
}) => {
  await page.goto(
    `${EXAMPLE}&${DISPLAY_PARAM}=list&views-grouping=${encodeURIComponent('["status"]')}`
  );
  await expectMode(page, MODE.list);
  await expect(
    page.getByRole("heading", { name: "Status: Active" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Status: Draft" })
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(6);
  await expect(page.getByRole("listitem").first()).toContainText(
    "Alpha launch"
  );
});

const MANUAL_LIST = `${EXAMPLE}&${DISPLAY_PARAM}=list&views-sort=${encodeURIComponent('[{"id":"__manual","desc":false}]')}`;
const line = (page: Page, name: string) =>
  page
    .locator("li")
    .filter({ hasText: name })
    .locator('[tabindex="0"]')
    .first();

test("the manual order of a list view is moved by keyboard or drag and kept per view", async ({
  page,
}) => {
  await page.goto(MANUAL_LIST);
  const items = page.getByRole("listitem");
  await expect(items.first()).toContainText("Alpha launch");

  await line(page, "Bravo audit").focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(items.first()).toContainText("Bravo audit");

  await page
    .locator("li")
    .filter({ hasText: "Echo sensors" })
    .dragTo(page.locator("li").filter({ hasText: "Bravo audit" }));
  await expect(items.first()).toContainText("Echo sensors");
  await expect(items.nth(1)).toContainText("Bravo audit");

  // A new view starts from its own, empty manual order.
  await openViewMenu(page);
  await page.getByRole("button", { name: "Save this view…" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Mine");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(items.first()).toContainText("Alpha launch");
});

test("manual order is offered as a sort of the view", async ({ page }) => {
  await openViewMenu(page);
  await page
    .getByRole("dialog", { name: "Views and settings" })
    .getByRole("button", { name: SORT })
    .click();
  await page.getByText("Manual order").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("views-sort"))
    .toContain("__manual");
});
