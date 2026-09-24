import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
// Playwright runs from the repository root.
const FIXTURE = resolve("e2e/fixtures/import-projects.csv");
const CATEGORY = /Category/;
const DUE = /Due/;
const IGNORE = /Ignore/;
const NAME = /Name/;
const NOT_AN_OPTION = /not one of the options/;

const openImport = async (page: Page) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const panel = page.locator("[data-import-panel]");
  await expect(panel.locator("[data-import-drop]")).toBeVisible();
  return panel;
};

const upload = async (panel: Locator) => {
  await panel.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(panel.locator("[data-import-step='mapping']")).toBeVisible();
};

const choose = async (panel: Locator, field: string, option: string) => {
  await panel.getByRole("combobox", { name: field, exact: true }).click();
  await panel.page().getByRole("option", { name: option, exact: true }).click();
};

const review = async (panel: Locator) => {
  await choose(panel, "Match existing records by", "Name");
  await expect(
    panel.getByRole("combobox", {
      name: "Match existing records by",
      exact: true,
    })
  ).toHaveText(NAME);
  await panel.getByRole("button", { name: "Review", exact: true }).click();
  await expect(panel.locator("[data-import-step='review']")).toBeVisible();
};

const tableRow = (page: Page, name: string) =>
  page.locator("tbody tr").filter({ hasText: name });

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("a CSV file maps to the columns, imports and re-imports as updates", async ({
  page,
}) => {
  let panel = await openImport(page);
  await upload(panel);
  await expect(panel.locator("[data-import-file]")).toHaveText(
    "import-projects.csv · 5 rows"
  );
  // Accented and translated headers map by name, or by their values.
  await expect(
    panel.getByRole("combobox", { name: "Name", exact: true })
  ).toHaveText(NAME);
  await expect(
    panel.getByRole("combobox", { name: "Catégorie", exact: true })
  ).toHaveText(CATEGORY);
  // Two date columns (Due and the feed's Posted at) fit the dates: values alone
  // do not decide, so the field waits for a choice.
  const due = panel.getByRole("combobox", { name: "Échéance", exact: true });
  await expect(due).toHaveText(IGNORE);
  await choose(panel, "Échéance", "Due");
  await expect(due).toHaveText(DUE);
  await expect(
    panel.getByRole("combobox", { name: "Notes", exact: true })
  ).toHaveText(IGNORE);
  await expect(
    panel.locator('[data-mapping-details="map:Status"] [data-mapping-badge]')
  ).toHaveText("1 won’t convert");
  await expect(
    panel.locator('[data-mapping-details="map:Price"] [data-mapping-badge]')
  ).toHaveText("Number");
  const invalid = panel.locator("[data-mapping-preview] td[data-invalid]");
  await expect(invalid).toHaveCount(1);
  await expect(invalid).toHaveAttribute("title", NOT_AN_OPTION);

  await choose(panel, "Progress", "Ignore");
  await review(panel);
  await expect(panel.locator("[data-import-creates]")).toHaveText("2 to add");
  await expect(panel.locator("[data-import-updates]")).toHaveText(
    "1 to update"
  );
  await expect(panel.locator("[data-import-errors]")).toHaveText(
    "2 rows with errors"
  );
  await panel.getByRole("button", { name: "Import", exact: true }).click();
  await expect(panel.locator("[data-import-result]")).toHaveText(
    "2 added, 1 updated"
  );
  await panel.getByRole("button", { name: "Done", exact: true }).click();
  await page.keyboard.press("Escape");

  await expect(tableRow(page, "Golf rollout")).toHaveCount(1);
  await expect(tableRow(page, "Hôtel booking")).toHaveCount(1);
  await expect(tableRow(page, "Alpha launch")).toContainText("Archived");
  await expect(tableRow(page, "India pilot")).toHaveCount(0);

  // The same file again: every valid row now updates, nothing is duplicated.
  panel = await openImport(page);
  await upload(panel);
  await review(panel);
  await expect(panel.locator("[data-import-creates]")).toHaveCount(0);
  await expect(panel.locator("[data-import-updates]")).toHaveText(
    "3 to update"
  );
  await panel.getByRole("button", { name: "Import", exact: true }).click();
  await expect(panel.locator("[data-import-result]")).toHaveText("3 updated");
  await panel.getByRole("button", { name: "Done", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tableRow(page, "Golf rollout")).toHaveCount(1);
  await expect(tableRow(page, "Hôtel booking")).toHaveCount(1);
});

test("rows with errors block the import until they are skipped", async ({
  page,
}) => {
  const panel = await openImport(page);
  await upload(panel);
  await review(panel);
  const importButton = panel.getByRole("button", {
    name: "Import",
    exact: true,
  });
  await expect(importButton).toBeEnabled();
  await panel.getByRole("checkbox", { name: "Skip rows with errors" }).click();
  await expect(importButton).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panel).toHaveCount(0);
});

test("on phones, the mapping chooses in the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(EXAMPLE);
  const panel = await openImport(page);
  await upload(panel);
  // Choices open as a full-screen list inside the drawer.
  await panel.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByRole("radio", { name: "Ignore" }).click();
  await expect(
    panel.getByRole("button", { name: "Progress", exact: true })
  ).toHaveText(IGNORE);
  await panel
    .getByRole("button", { name: "Match existing records by", exact: true })
    .click();
  await page.getByRole("radio", { name: "Name" }).click();
  await panel.getByRole("button", { name: "Review", exact: true }).click();
  await expect(panel.locator("[data-import-updates]")).toHaveText(
    "1 to update"
  );
});
