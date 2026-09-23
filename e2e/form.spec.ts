import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const STANDALONE = "/?example=form";
const SETTINGS = "View settings";
const FORM_SETTINGS = /^form settings/i;
const FORM_MODE = /^form$/i;
const TABLE_MODE = /^table$/i;
const PUBLIC_LINK = /\?example=form&form=request$/;
const SUCCESS = "Thank you, your response has been recorded.";
const REQUEST_SUCCESS = "Thank you! Your request is in the Draft column.";
const CLOSED = "This form is no longer accepting responses.";
const WANTED_BY = /^Wanted by/;

const chooseMode = async (page: Page, mode: RegExp) => {
  await page.getByRole("button", { name: SETTINGS }).click();
  const menu = page.getByRole("dialog", { name: SETTINGS });
  await menu.getByRole("combobox", { name: "Display mode" }).click();
  await page.getByRole("option", { name: mode }).click();
  return menu;
};

const questionIds = (page: Page) =>
  page
    .locator("[data-yayaw-form] [data-form-question]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-form-question"))
    );

/** Selects are the table's own listboxes, not native selects. */
const choose = async (page: Page, question: string, option: string) => {
  await page.getByRole("combobox", { name: question }).click();
  await page.getByRole("option", { name: option }).click();
  await expect(page.getByRole("combobox", { name: question })).toContainText(
    option
  );
};

const openShare = async (page: Page) => {
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project request" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Share form" }).click();
  await page.getByRole("switch", { name: "Publish to the web" }).check();
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toHaveValue(PUBLIC_LINK);
  return link;
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("a form view asks the chosen questions and creates the record", async ({
  page,
}) => {
  const menu = await chooseMode(page, FORM_MODE);
  await menu.getByRole("button", { name: FORM_SETTINGS }).click();
  for (const column of [
    "Category",
    "Status",
    "Progress",
    "Due",
    "Serial number",
    "Details",
  ]) {
    await page.getByRole("switch", { name: `Ask ${column}` }).uncheck();
  }
  await page.getByRole("button", { name: "Move Price up" }).click();
  await page.getByRole("button", { name: "Edit Price" }).click();
  await page.getByRole("switch", { name: "Required" }).check();
  const help = page.getByRole("textbox", { name: "Help text" });
  await help.fill("Budget in euros");
  await help.press("Tab");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await expect.poll(() => questionIds(page)).toEqual(["price", "name"]);
  const form = page.locator("[data-yayaw-form]");
  await expect(form.getByText("Budget in euros")).toBeVisible();
  await form.getByRole("textbox", { name: "Name" }).fill("Zulu request");
  await form.getByRole("button", { name: "Submit" }).click();

  const price = form.getByRole("textbox", { name: "Price" });
  await expect(price).toBeFocused();
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(price).toHaveAccessibleDescription(
    "Budget in euros Answer this question."
  );
  await expect(form.getByRole("alert")).toHaveText("1 answer needs attention.");

  await price.fill("250");
  // Typed plainly, shown with the column's number format once left.
  await form.getByRole("textbox", { name: "Name" }).focus();
  await expect(price).toHaveValue("€250.00");
  await form.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(SUCCESS)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit another response" })
  ).toBeVisible();

  await chooseMode(page, TABLE_MODE);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Zulu request")).toBeVisible();
});

test("a published form takes public responses into the table", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const link = await openShare(page);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();

  const publicPage = await context.newPage();
  await publicPage.goto(await link.inputValue());
  await expect(
    publicPage.getByRole("heading", { name: "Project request" })
  ).toBeVisible();
  // Only the published questions, and nothing of the table.
  await expect(publicPage.locator("[data-form-question]")).toHaveCount(4);
  await expect(publicPage.getByText("Alpha launch")).toHaveCount(0);
  await publicPage
    .getByRole("textbox", { name: "Project name" })
    .fill("Public request");
  await choose(publicPage, "Category", "Service");
  await publicPage.getByRole("button", { name: "Send request" }).click();
  await expect(publicPage.getByText(REQUEST_SUCCESS)).toBeVisible();

  await page.goto(EXAMPLE);
  await expect(page.getByText("Public request")).toBeVisible();
});

test("closing responses and unpublishing reach the public link", async ({
  context,
  page,
}) => {
  const link = await openShare(page);
  const url = await link.inputValue();
  await page.getByRole("switch", { name: "Accept responses" }).uncheck();
  const publicPage = await context.newPage();
  await publicPage.goto(url);
  await expect(publicPage.getByText(CLOSED)).toBeVisible();
  await expect(
    publicPage.getByRole("button", { name: "Send request" })
  ).toHaveCount(0);

  await page.getByRole("switch", { name: "Publish to the web" }).uncheck();
  await expect(link).toBeHidden();
  await publicPage.reload();
  await expect(
    publicPage.getByText("This form is not published.")
  ).toBeVisible();
});

test("sharing needs a saved view", async ({ page }) => {
  await chooseMode(page, FORM_MODE);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Share form" }).click();
  await expect(
    page.getByText("Save this view to share its form.")
  ).toBeVisible();
});

test("the standalone form works without a table", async ({ page }) => {
  await page.goto(STANDALONE);
  await expect(page.getByRole("table")).toHaveCount(0);
  const form = page.getByRole("region", { name: "Standalone form" });
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(
    form.getByRole("textbox", { name: "Project name" })
  ).toBeFocused();
  await form
    .getByRole("textbox", { name: "Project name" })
    .fill("Standalone request");
  await choose(page, "Category", "Service");
  // The date picker shows this month; the date reads in the form's language.
  const today = new Date();
  const wanted = form.getByRole("button", { name: WANTED_BY });
  await wanted.click();
  await page
    .getByRole("button", {
      name: new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(today),
    })
    .click();
  await expect(wanted).toContainText(
    new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(today)
  );
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByText(REQUEST_SUCCESS)).toBeVisible();

  await page.goto(EXAMPLE);
  await expect(page.getByText("Standalone request")).toBeVisible();
});
