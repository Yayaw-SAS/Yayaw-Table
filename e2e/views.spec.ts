import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
// With saved views, tabs name the view and the trigger only opens the settings.
const VIEW_MENU = /^(current view|views and settings)/i;
const FILTERS = /^filters?/i;
const SORT = /^sort/i;
const DENSITY = /density/i;
const NAME_HEADER = /^\s*Name\s*$/;
const ALPHA_TITLE = /^Alpha launch$/;
const SEARCH_PLACEHOLDER = /^search/i;
const ROW_ACTIONS = /^(actions|row actions)$/i;
const REORDER = /reorder|réordonner/i;
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
  await page.getByRole("button", { name: VIEW_MENU }).first().click();
  return page.getByRole("dialog", { name: "Views and settings" });
};

const displayModes = (page: Page) =>
  page
    .getByRole("dialog", { name: "Views and settings" })
    .getByRole("combobox", { name: "Display mode" });

const chooseMode = async (page: Page, mode: RegExp) => {
  await openViewMenu(page);
  await displayModes(page).click();
  await page.getByRole("option", { name: mode }).click();
};

const expectMode = async (page: Page, mode: RegExp) => {
  const menu = page.getByRole("dialog", { name: "Views and settings" });
  if (await menu.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  }
  await openViewMenu(page);
  // The trigger may add a chevron glyph after the label.
  await expect(displayModes(page)).toHaveText(
    new RegExp(mode.source.replace("$", ""), "i")
  );
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
  await expect(page.getByRole("tab", { name: "Board" })).toHaveAttribute(
    "aria-selected",
    "true"
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
const handle = (page: Page, name: string) =>
  page.locator("li").filter({ hasText: name }).getByTitle(REORDER);
const centerOf = async (page: Page, name: string, onHandle: boolean) => {
  const target = onHandle
    ? handle(page, name)
    : page.locator("li").filter({ hasText: name });
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`${name} is not visible`);
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const dragHandle = async (page: Page, from: string, to: string) => {
  const start = await centerOf(page, from, true);
  const end = await centerOf(page, to, false);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
};
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

  await dragHandle(page, "Echo sensors", "Bravo audit");
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

test("list lines can be reordered by touch", async ({ page }) => {
  await page.goto(MANUAL_LIST);
  const items = page.getByRole("listitem");
  await expect(items.first()).toContainText("Alpha launch");
  const start = await centerOf(page, "Delta support", true);
  const end = await centerOf(page, "Alpha launch", false);
  const cdp = await page.context().newCDPSession(page);
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    point?: { x: number; y: number }
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y }] : [],
    });
  await touch("touchStart", start);
  for (let step = 1; step <= 5; step += 1) {
    await touch("touchMove", {
      x: start.x + ((end.x - start.x) * step) / 5,
      y: start.y + ((end.y - start.y) * step) / 5,
    });
  }
  await touch("touchEnd");
  await expect(items.first()).toContainText("Delta support");
});

test("the list view follows the table density", async ({ page }) => {
  await page.goto(`${EXAMPLE}&${DISPLAY_PARAM}=list`);
  const first = page.locator("li").first().locator("div").first();
  const height = async () => (await first.boundingBox())?.height ?? 0;
  await expect.poll(height).toBeGreaterThan(0);
  const medium = await height();
  await openViewMenu(page);
  await page
    .getByRole("dialog", { name: "Views and settings" })
    .getByRole("group", { name: DENSITY })
    .getByRole("button", { name: "2XL" })
    .click();
  await expect.poll(height).toBeGreaterThan(medium);
});

test("list options from a shared link: labels, limits, alignment, wrapping and actions", async ({
  page,
}) => {
  const settings = {
    maxProperties: 1,
    showActions: false,
    wrap: true,
    propertyAlign: "start",
  };
  await page.goto(
    `${EXAMPLE}&${DISPLAY_PARAM}=list&views-list=${encodeURIComponent(JSON.stringify(settings))}`
  );
  const first = page.getByRole("listitem").first();
  await expect(first).toContainText("Alpha launch");
  await expect(first.locator("dd")).toHaveCount(1);
  await expect(first.getByRole("button", { name: ROW_ACTIONS })).toHaveCount(0);

  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(
    `${EXAMPLE}&${DISPLAY_PARAM}=list&views-list=${encodeURIComponent('{"mobileMaxProperties":0}')}`
  );
  await expect(page.getByRole("listitem").first().locator("dd")).toHaveCount(0);
});

test("number columns render currency and progress formats alike", async ({
  page,
}) => {
  const alpha = page.getByRole("row").filter({ hasText: "Alpha launch" });
  await expect(alpha).toContainText("€49.00");
  await expect(alpha).toContainText("49%");
});

// Cross-edition visual contract: measurable styles, stable across platforms.
test("both editions share the table and card look", async ({ page }) => {
  const header = page.locator("thead th").filter({ hasText: NAME_HEADER });
  const headerStyle = await header.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: style.fontSize, weight: style.fontWeight };
  });
  expect(headerStyle).toEqual({ size: "14px", weight: "500" });

  const row = page.getByRole("row").filter({ hasText: "Alpha launch" });
  const rowBox = await row.boundingBox();
  expect(Math.round(rowBox?.height ?? 0)).toBeGreaterThanOrEqual(39);
  expect(Math.round(rowBox?.height ?? 0)).toBeLessThanOrEqual(41);

  const checkbox = await row.getByRole("checkbox").boundingBox();
  expect(Math.round(checkbox?.width ?? 0)).toBe(16);
  // The selection column centers its checkbox about 28px from the table edge.
  const table = await page.locator("table").first().boundingBox();
  expect(
    Math.round((checkbox?.x ?? 0) + 8 - (table?.x ?? 0))
  ).toBeGreaterThanOrEqual(26);
  expect(
    Math.round((checkbox?.x ?? 0) + 8 - (table?.x ?? 0))
  ).toBeLessThanOrEqual(30);

  const search = await page.getByPlaceholder(SEARCH_PLACEHOLDER).boundingBox();
  expect(search?.width ?? 0).toBeLessThanOrEqual(260);

  await page.goto(`${EXAMPLE}&${DISPLAY_PARAM}=kanban`);
  // The element holding the title text, whatever wraps it in each edition.
  const cardTitle = page
    .locator("strong, div, span")
    .filter({ hasText: ALPHA_TITLE })
    .last();
  const titleStyle = await cardTitle.evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: style.fontSize, weight: style.fontWeight };
  });
  expect(titleStyle).toEqual({ size: "14px", weight: "500" });
});

test("a row click opens the record view and both editions name the create button alike", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await page.getByRole("cell", { name: "Charlie display" }).click();
  await expect(page.getByText("Activity").first()).toBeVisible();
  await expect(page.getByText("Charlie display").nth(1)).toBeVisible();
});
