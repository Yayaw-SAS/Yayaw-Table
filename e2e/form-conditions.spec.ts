import { expect, type Page, test } from "@playwright/test";

const VIEWS = "/?example=views";
const STANDALONE = "/?example=form";
const RECORDS = "/?example=records";
const SETTINGS = "View settings";
const FORM_SETTINGS = /^form settings/i;
const REQUEST_SUCCESS = "Thank you! Your request is in the Draft column.";
const REQUIRED = "Answer this question.";
const SELECT_ROW = /^Select (row|Workspace Pro|Studio Display|Team Support)$/;
const WANTED_BY = /^Wanted by/;
const CREATED = /^Created/;
const BULK_EDIT = /^(Edit|Bulk edit)$/;

/** Selects are the table's own listboxes in both editions. */
const choose = async (page: Page, name: string, option: string) => {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

const progress = (page: Page) => page.locator("[data-form-progress]");

test.beforeEach(async ({ page }) => {
  await page.goto(VIEWS);
  await page.evaluate(() => localStorage.clear());
});

test("page layout: rules show, hide and require questions", async ({
  page,
}) => {
  await page.goto(STANDALONE);
  const form = page.getByRole("region", { name: "Standalone form" });
  const serial = form.getByRole("textbox", { name: "Serial number" });
  const more = form.getByRole("textbox", { name: "Tell us more" });
  await expect(serial).toHaveCount(0);
  await expect(more).toHaveCount(0);

  await form.getByRole("textbox", { name: "Project name" }).fill("Rules");
  await choose(page, "Category", "Hardware");
  await expect(serial).toBeVisible();
  // "Budget" is now required: the label shows it and sending needs it.
  const budget = form.getByRole("textbox", { name: "Budget" });
  await expect(budget).toHaveAttribute("required", "");
  await serial.fill("SN-1");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(budget).toBeFocused();
  await expect(budget).toHaveAccessibleDescription(
    `In euros, excluding tax. ${REQUIRED}`
  );

  await choose(page, "Category", "Other");
  await expect(serial).toHaveCount(0);
  await expect(more).toBeVisible();
  await expect(budget).not.toHaveAttribute("required", "");
  await more.fill("A custom project");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(form.getByText(REQUEST_SUCCESS)).toBeVisible();

  // The hidden serial number was not sent with the response.
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("yayaw-demo-form-responses") ?? "[]")
  );
  expect(saved.at(-1)).toMatchObject({
    name: "Rules",
    category: "Other",
    details: "A custom project",
  });
  expect(saved.at(-1).serialNumber).toBeUndefined();
});

test("steps layout: progress, Back/Next/Skip, conditional steps, review and submit", async ({
  page,
}) => {
  await page.goto(VIEWS);
  await page.getByRole("tab", { name: "Guided request" }).click();
  await expect(progress(page)).toHaveText("Step 1 of 5");
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();

  const name = page.getByRole("textbox", { name: "Project name" });
  await name.fill("Guided");
  // Enter goes to the next step.
  await name.press("Enter");
  await expect(progress(page)).toHaveText("Step 2 of 5");
  await expect(progress(page)).toHaveAttribute("aria-valuetext", "Step 2 of 5");
  await choose(page, "Category", "Hardware");
  // The serial number step appears.
  await expect(progress(page)).toHaveText("Step 2 of 6");
  await page.getByRole("button", { name: "Next" }).click();

  // Budget is required for hardware: no Skip, and Next checks it.
  await expect(progress(page)).toHaveText("Step 3 of 6");
  await expect(page.getByRole("button", { name: "Skip" })).toBeHidden();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(REQUIRED)).toBeVisible();
  await page.getByRole("textbox", { name: "Budget" }).fill("1500");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(progress(page)).toHaveText("Step 4 of 6");
  await expect(
    page.getByRole("textbox", { name: "Serial number" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(progress(page)).toHaveText("Step 3 of 6");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("textbox", { name: "Serial number" }).fill("SN-9");
  await page.getByRole("button", { name: "Next" }).click();

  // Optional question: Skip goes on without an answer.
  await expect(progress(page)).toHaveText("Step 5 of 6");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(progress(page)).toHaveText("Step 6 of 6");
  await expect(page.getByText("Review your answers")).toBeVisible();
  const review = page.locator("[data-form-review]");
  await expect(review).toContainText("Guided");
  await expect(review).toContainText("SN-9");

  // Changing the category skips the serial number step again.
  await page.getByRole("button", { name: "Change Category" }).click();
  await expect(progress(page)).toHaveText("Step 2 of 6");
  await choose(page, "Category", "Service");
  await expect(progress(page)).toHaveText("Step 2 of 5");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(progress(page)).toHaveText("Step 4 of 5");
  await expect(page.getByRole("button", { name: "Wanted by" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(review).not.toContainText("SN-9");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(REQUEST_SUCCESS)).toBeVisible();
});

test("the rule editor adds a rule and shows its summary", async ({ page }) => {
  await page.goto(VIEWS);
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  const wanted = page.getByRole("button", { name: WANTED_BY });
  await expect(wanted).toBeVisible();
  await page.getByRole("button", { name: SETTINGS }).click();
  const menu = page.getByRole("dialog", { name: SETTINGS });
  await menu.getByRole("button", { name: FORM_SETTINGS }).click();
  // The shipped rules are summarised under their questions.
  await expect(
    page.locator('[data-form-setting-question="serialNumber"]')
  ).toContainText("Shown when Category is Hardware");

  await page.getByRole("button", { name: "Edit Due" }).click();
  const due = page.locator('[data-form-setting-question="dueDate"]');
  await due.getByRole("button", { name: "Add a condition" }).click();
  await expect(due.locator("[data-rule-issue]")).toHaveText(
    "Choose a question."
  );
  await choose(page, "Question", "Category");
  await expect(due.locator("[data-rule-issue]")).toHaveText("Enter a value.");
  await choose(page, "Value", "Software");
  await expect(due.locator("[data-rule-issue]")).toHaveCount(0);
  await expect(due.locator("[data-form-rule-summary]")).toHaveText(
    "Shown when Category is Software"
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await expect(wanted).toHaveCount(0);
  await choose(page, "Category", "Software");
  await expect(wanted).toBeVisible();
});

test("the create form applies its condition and picks dates in a calendar", async ({
  page,
}) => {
  await page.goto(RECORDS);
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog", { name: "Create" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Rack server");
  await choose(page, "Category", "Hardware");
  // Same controls in both editions: the table's dropdowns and calendar.
  const created = dialog.getByRole("button", { name: CREATED });
  await created.click();
  const today = new Date();
  await page
    .getByRole("button", {
      name: new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(today),
    })
    .click();
  await expect(created).toContainText(
    new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(today)
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    dialog.getByText("Description is required").first()
  ).toBeVisible();

  await choose(page, "Category", "Service");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Rack server").first()).toBeVisible();
});

test("bulk edit notes conditions on values that differ across rows", async ({
  page,
}) => {
  await page.goto(RECORDS);
  const rows = page.getByRole("checkbox", { name: SELECT_ROW });
  await rows.nth(0).click();
  await rows.nth(1).click();
  await page.getByRole("button", { name: BULK_EDIT }).click();
  await page.getByRole("button", { name: "Add a field" }).click();
  await page.locator('[data-bulk-option="description"]').click();
  await expect(page.locator('[data-bulk-mixed="description"]')).toHaveText(
    "Values of Category differ across the selection: the condition is treated as not met."
  );
  // Setting the category in the draft settles the condition.
  await page.getByRole("button", { name: "Add a field" }).click();
  await page.locator('[data-bulk-option="category"]').click();
  await choose(page, "Category", "Service");
  await expect(page.locator('[data-bulk-mixed="description"]')).toHaveCount(0);
});
