import { expect, type Locator, type Page, test } from "@playwright/test";

const VIEWS = "/?example=views";
const SETTINGS = "View settings";
const FORM_SETTINGS = /^form settings/i;
const FORM_MODE = /^form$/i;
const REQUEST_ORDER = [
  "item:name",
  "item:category",
  "item:price",
  "item:serialNumber",
  "item:details",
  "item:dueDate",
  "item:privacy",
];
const BUDGET = /^Budget/;
const PROGRESS = /^Progress/;
const WANTED_BY = /^Wanted by/;
const PROJECT_NAME = /^Project name/;

/** Selects are the table's own listboxes in both editions. */
const chooseIn = async (
  page: Page,
  scope: Locator,
  name: string,
  option: string
) => {
  await scope.getByRole("combobox", { name, exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

const openRequest = async (page: Page) => {
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project request" })
  ).toBeVisible();
};

const openBuilder = async (page: Page) => {
  await page
    .locator("[data-form-toolbar]")
    .getByRole("button", { name: "Edit form" })
    .click();
  const builder = page.getByRole("dialog", { name: "Edit form" });
  await expect(builder).toBeVisible();
  return builder;
};

const outline = (builder: Locator) =>
  builder.locator("[data-form-builder-outline]");
const entry = (builder: Locator, name: string | RegExp) =>
  outline(builder).getByRole("button", { name });
const order = (builder: Locator) =>
  outline(builder)
    .locator('[data-form-builder-group="items"] [data-form-builder-row]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-key")));
const properties = (builder: Locator) =>
  builder.locator("[data-form-builder-properties]");
const preview = (builder: Locator) =>
  builder.locator("[data-form-builder-preview]");

test.beforeEach(async ({ page }) => {
  await page.goto(VIEWS);
  await page.evaluate(() => localStorage.clear());
  await page.goto(VIEWS);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("the builder edits, reorders and saves the form; reopening keeps it", async ({
  page,
}) => {
  await openRequest(page);
  const builder = await openBuilder(page);
  await expect(builder.locator("[data-form-builder-title]")).toHaveText(
    "Project request"
  );
  await expect.poll(() => order(builder)).toEqual(REQUEST_ORDER);
  // The first question is selected and focused.
  await expect(entry(builder, PROJECT_NAME)).toBeFocused();
  await expect(entry(builder, PROJECT_NAME)).toHaveAttribute(
    "aria-current",
    "true"
  );

  // Edit a question: the preview follows.
  await entry(builder, BUDGET).click();
  await expect(
    properties(builder).getByRole("heading", { name: "Properties: Budget" })
  ).toBeVisible();
  const help = properties(builder).getByRole("textbox", { name: "Help text" });
  await help.fill("Up to 10k");
  await help.press("Tab");
  await expect(preview(builder).getByText("Up to 10k")).toBeVisible();
  await properties(builder).getByRole("switch", { name: "Required" }).click();
  await expect(entry(builder, BUDGET)).toContainText("required");
  await expect(builder.locator("[data-form-builder-status]")).toHaveText(
    "Unsaved changes"
  );

  // Alt + ↑ moves it; the entry keeps the focus and the move is announced.
  await entry(builder, BUDGET).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect
    .poll(() => order(builder))
    .toEqual([
      "item:name",
      "item:price",
      "item:category",
      "item:serialNumber",
      "item:details",
      "item:dueDate",
      "item:privacy",
    ]);
  await expect(entry(builder, BUDGET)).toBeFocused();
  await expect(builder.locator("[data-form-builder-announcement]")).toHaveText(
    "Budget: position 2 of 7."
  );

  // Ask another column, after the selection, with a condition.
  await builder.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Progress" }).click();
  await expect(
    properties(builder).getByRole("heading", { name: "Properties: Progress" })
  ).toBeVisible();
  await expect.poll(() => order(builder)).toContain("item:progress");
  const keys = await order(builder);
  expect(keys.indexOf("item:progress")).toBe(keys.indexOf("item:price") + 1);
  const rules = properties(builder).locator("[data-form-rules]");
  await expect(rules).toContainText("Always shown.");
  await rules.getByRole("button", { name: "Add a condition" }).click();
  await chooseIn(page, rules, "Question", "Category");
  await chooseIn(page, rules, "Value", "Software");
  await expect(rules.locator("[data-form-rule-summary]")).toHaveText(
    "Shown when Category is Software"
  );
  await expect(entry(builder, PROGRESS)).toContainText("has conditions");
  // The preview applies the condition.
  const progress = preview(builder).locator('[data-form-question="progress"]');
  await expect(progress).toHaveCount(0);
  await chooseIn(page, preview(builder), "Category", "Software");
  await expect(progress).toBeVisible();

  // French: the preview reads the French texts; a missing one is flagged.
  await builder
    .locator('[data-form-builder-bar] [data-form-language="fr"]')
    .click();
  await expect(
    preview(builder).getByRole("heading", { name: "Demande de projet" })
  ).toBeVisible();
  await expect(
    builder.locator("[data-form-builder-preview-state]")
  ).toContainText("Français");
  await expect(
    entry(builder, WANTED_BY).locator("[data-form-missing-translation]")
  ).toHaveCount(1);
  await builder
    .locator('[data-form-builder-bar] [data-form-language="en"]')
    .click();

  // Steps: the preview goes one question at a time.
  await builder.locator('[data-form-builder-layout-option="steps"]').click();
  await expect(preview(builder).locator("[data-form-progress]")).toBeVisible();

  // Save keeps the builder open; closing then asks nothing.
  await builder.getByRole("button", { name: "Save", exact: true }).click();
  await expect(builder.locator("[data-form-builder-status]")).toHaveCount(0);
  await expect(
    builder.getByRole("button", { name: "Save", exact: true })
  ).toBeDisabled();
  await builder.getByRole("button", { name: "Close", exact: true }).click();
  await expect(builder).toBeHidden();
  // The view shows the saved form, one question at a time; focus is back on "Edit form".
  const view = page.locator("[data-form-view]");
  await expect(view.locator("[data-form-progress]")).toBeVisible();
  await expect(
    page
      .locator("[data-form-toolbar]")
      .getByRole("button", { name: "Edit form" })
  ).toBeFocused();

  const reopened = await openBuilder(page);
  await expect
    .poll(() => order(reopened))
    .toEqual([
      "item:name",
      "item:price",
      "item:progress",
      "item:category",
      "item:serialNumber",
      "item:details",
      "item:dueDate",
      "item:privacy",
    ]);
  await expect(
    reopened.locator('[data-form-builder-layout-option="steps"] input')
  ).toBeChecked();
  await expect(entry(reopened, BUDGET)).toContainText("required");
  await expect(entry(reopened, PROGRESS)).toContainText("has conditions");
});

test("View settings summarize the form and open the builder; closing with changes asks first", async ({
  page,
}) => {
  await openRequest(page);
  await page.getByRole("button", { name: SETTINGS }).click();
  const menu = page.getByRole("dialog", { name: SETTINGS });
  await menu.getByRole("button", { name: FORM_SETTINGS }).click();
  const summary = page.locator("[data-form-summary]");
  await expect(summary).toContainText("Project request");
  await expect(summary).toContainText(
    "6 questions · 1 consent · 4 hidden fields"
  );
  await expect(summary).toContainText("One page");
  await expect(summary).toContainText("English, Français");

  await page
    .locator("[data-form-settings]")
    .getByRole("button", { name: "Edit form" })
    .click();
  await expect(menu).toBeHidden();
  const builder = page.getByRole("dialog", { name: "Edit form" });
  await expect(builder).toBeVisible();

  await builder
    .locator("[data-form-builder-outline]")
    .getByRole("button", { name: FORM_SETTINGS })
    .click();
  const title = properties(builder).getByRole("textbox", { name: "Title" });
  await title.fill("Project intake");
  await title.press("Enter");
  await expect(builder.locator("[data-form-builder-title]")).toHaveText(
    "Project intake"
  );

  // Escape asks before discarding; "Keep editing" goes back to the builder.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("alertdialog", {
    name: "Discard your changes?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirm).toBeHidden();
  await expect(builder).toBeVisible();
  await expect(title).toHaveValue("Project intake");

  await page.keyboard.press("Escape");
  await confirm.getByRole("button", { name: "Discard" }).click();
  await expect(builder).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Project request" })
  ).toBeVisible();
});

test("a form without questions never asks system or read-only columns", async ({
  page,
}) => {
  await page.getByRole("button", { name: SETTINGS }).click();
  const menu = page.getByRole("dialog", { name: SETTINGS });
  await menu.getByRole("combobox", { name: "Display mode" }).click();
  await page.getByRole("option", { name: FORM_MODE }).click();
  await page.keyboard.press("Escape");
  const view = page.locator("[data-form-view]");
  await expect(view.locator('[data-form-question="name"]')).toBeVisible();
  // "Posted at" is stamped by the host (`readonly`): never asked.
  await expect(view.locator('[data-form-question="postedAt"]')).toHaveCount(0);

  const builder = await openBuilder(page);
  await expect(entry(builder, "Posted at")).toHaveCount(0);
  await expect(builder.locator("[data-form-builder-excluded]")).toHaveText(
    "Not available in forms: Posted at."
  );
  await entry(builder, "Author").click();
  await properties(builder)
    .getByRole("button", { name: "Remove from the form" })
    .click();
  await builder.getByRole("button", { name: "Add", exact: true }).click();
  const menuItems = page.getByRole("menuitem");
  await expect(menuItems.filter({ hasText: "Author" })).toHaveCount(1);
  await expect(menuItems.filter({ hasText: "Posted at" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("dragging an outline entry by its grip reorders the form", async ({
  page,
}) => {
  await openRequest(page);
  const builder = await openBuilder(page);
  const grip = (key: string) =>
    outline(builder).locator(
      `[data-form-builder-row][data-key="${key}"] [data-form-builder-grip]`
    );
  const from = await grip("item:dueDate").boundingBox();
  const to = await outline(builder)
    .locator('[data-form-builder-row][data-key="item:category"]')
    .boundingBox();
  if (!(from && to)) {
    throw new Error("The outline rows have no box.");
  }
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 8 });
  await expect(
    outline(builder).locator('[data-key="item:category"][data-drop="before"]')
  ).toHaveCount(1);
  await page.mouse.up();
  await expect
    .poll(() => order(builder))
    .toEqual([
      "item:name",
      "item:dueDate",
      "item:category",
      "item:price",
      "item:serialNumber",
      "item:details",
      "item:privacy",
    ]);
  await expect(builder.locator("[data-form-builder-status]")).toBeVisible();
});

test.describe("on phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the builder fills the screen with Questions, Preview and Properties tabs", async ({
    page,
  }) => {
    await page.goto(`${VIEWS}&views-display=form`);
    const builder = await openBuilder(page);
    const box = await builder.boundingBox();
    expect(box?.width).toBe(390);
    expect(box?.height).toBe(844);
    const tabs = builder.getByRole("tablist");
    await expect(tabs.getByRole("tab", { name: "Questions" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // Choosing a question opens its properties.
    await entry(builder, "Price").click();
    await expect(tabs.getByRole("tab", { name: "Properties" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const help = properties(builder).getByRole("textbox", {
      name: "Help text",
    });
    await help.fill("Budget in euros");
    await help.press("Tab");
    await tabs.getByRole("tab", { name: "Preview" }).click();
    await expect(preview(builder).getByText("Budget in euros")).toBeVisible();
    // The language switch sits above the preview on phones.
    await expect(
      preview(builder).getByRole("group", { name: "Editing" })
    ).toBeVisible();
  });
});
