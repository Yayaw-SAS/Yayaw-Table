import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const KEEP_IN_SYNC = /Keep both in sync/;
const IMPORT_FROM = /Import from Spreadsheet/;
const TABLE_WINS = /^This table wins/;
const PRICE = /^Price/;
const SCHEDULE_KEEP_IN_SYNC = / · Keep in sync$/;

const openConnector = async (page: Page) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const data = page.getByRole("dialog", { name: "Data" });
  await data.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "Spreadsheet", exact: true }).click();
  const panel = page.locator("[data-connector-panel]");
  await expect(
    panel.getByRole("combobox", { name: "Spreadsheet" })
  ).toBeVisible();
  return panel;
};

const choose = async (panel: Locator, field: string, option: string) => {
  await panel.getByRole("combobox", { name: field, exact: true }).click();
  await panel.page().getByRole("option", { name: option, exact: true }).click();
};

/** "Live projects" was synced once, then edited on both sides (see the demo connector). */
const openLiveProjects = async (page: Page, direction: string) => {
  const panel = await openConnector(page);
  await choose(panel, "Spreadsheet", "Live projects");
  await choose(panel, "Direction", direction);
  return panel;
};

const count = (panel: Locator, id: string) =>
  panel.locator(`[data-sync-count="${id}"]`);

const button = (panel: Locator, name: string) =>
  panel.getByRole("button", { name, exact: true });

const tableRow = (page: Page, name: string) =>
  page.locator("tbody tr").filter({ hasText: name });

const closeData = async (page: Page, panel: Locator) => {
  await button(panel, "Done").click();
  await page.keyboard.press("Escape");
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("a two-way preview shows the counts and the conflict; a sync applies them and a second preview is empty", async ({
  page,
}) => {
  const panel = await openLiveProjects(page, "Keep both in sync");
  await expect(
    panel.getByRole("combobox", { name: "When both sides changed" })
  ).toHaveText(TABLE_WINS);
  await expect(
    panel.locator('[data-connector-hint="deletePolicy"]')
  ).toHaveText("Lists records deleted on one side. Nothing is deleted.");
  // Push settings do not apply to a sync.
  await expect(
    panel.getByRole("combobox", { name: "Records", exact: true })
  ).toHaveCount(0);

  await button(panel, "Preview changes").click();
  await expect(count(panel, "target-update")).toHaveText("1");
  await expect(count(panel, "target-create")).toHaveText("0");
  await expect(count(panel, "table-create")).toHaveText("2");
  await expect(count(panel, "table-update")).toHaveText("2");
  await expect(count(panel, "table-delete")).toHaveText("0");
  await expect(panel.locator("[data-sync-duplicates]")).toHaveText(
    "1 key is shared by several records; they are left alone."
  );
  const conflict = panel.locator("[data-sync-conflict='charlie:price']");
  await expect(conflict).toContainText("Charlie display · Price");
  await expect(conflict.locator("[data-winner]")).toContainText("399");
  await expect(conflict).toContainText("420");
  await expect(conflict).toContainText("This table wins");

  await button(panel, "Sync now").click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "In Spreadsheet: 1 updated · In this table: 2 created, 2 updated"
  );
  await button(panel, "Preview again").click();
  await expect(panel.locator("[data-sync-preview]")).toContainText(
    "Nothing to change: both sides match."
  );
  await expect(count(panel, "table-create")).toHaveText("0");
  await expect(count(panel, "target-update")).toHaveText("0");

  // The sheet's rows and edits reached the table.
  await page.keyboard.press("Escape");
  await expect(tableRow(page, "Golf kiosk")).toHaveCount(1);
  await expect(tableRow(page, "Foxtrot portal")).toContainText("25");

  // The schedule runs the saved settings: a two-way sync.
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByRole("button", { name: "Schedule Spreadsheet", exact: true })
    .click();
  await expect(page.locator("[data-schedule-summary] p").first()).toHaveText(
    SCHEDULE_KEEP_IN_SYNC
  );
});

test("a pull imports the sheet-only rows into the table", async ({ page }) => {
  const panel = await openLiveProjects(page, "Import from Spreadsheet");
  await expect(
    panel.getByRole("combobox", { name: "When both sides changed" })
  ).toHaveCount(0);
  // The mapping reads target field → table column, with a sample value.
  await expect(
    panel.getByRole("combobox", { name: "Price", exact: true })
  ).toHaveText(PRICE);
  await expect(
    panel.locator("[data-mapping-details='field:Name'] [data-mapping-sample]")
  ).toHaveText("e.g. Alpha launch");

  await button(panel, "Preview changes").click();
  await expect(count(panel, "table-create")).toHaveText("2");
  await expect(count(panel, "table-update")).toHaveText("3");
  await button(panel, "Import now").click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "In this table: 2 created, 3 updated"
  );
  await closeData(page, panel);
  await expect(tableRow(page, "Golf kiosk")).toHaveCount(1);
  await expect(tableRow(page, "Hotel booking")).toHaveCount(1);
  await expect(tableRow(page, "Charlie display")).toContainText("420");
});

test("deleting on the other side needs a confirmation and a preview", async ({
  page,
}) => {
  const panel = await openLiveProjects(page, "Keep both in sync");
  await choose(panel, "Deleted records", "Delete on the other side");
  const sync = button(panel, "Sync now");
  await expect(sync).toBeDisabled();
  await expect(panel.locator("[data-connector-blocker]")).toHaveText(
    "Confirm the deletions first."
  );
  await panel
    .getByRole("checkbox", {
      name: "Delete records on the other side when they are deleted",
    })
    .click();
  await expect(sync).toBeDisabled();
  await expect(panel.locator("[data-connector-blocker]")).toHaveText(
    "Preview the changes before deleting records."
  );
  await button(panel, "Preview changes").click();
  await expect(count(panel, "table-delete")).toHaveText("1");
  await expect(sync).toBeEnabled();
  await sync.click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "In Spreadsheet: 1 updated · In this table: 2 created, 2 updated, 1 deleted"
  );
  await closeData(page, panel);
  await expect(tableRow(page, "Delta support")).toHaveCount(0);
});

test("Data › Import lists the connector as a source that opens it as a pull", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const source = page.locator("[data-import-connector='spreadsheet']");
  await expect(source).toContainText("From Spreadsheet");
  await source.click();
  const panel = page.locator("[data-connector-panel]");
  await choose(panel, "Spreadsheet", "Live projects");
  await expect(panel.getByRole("combobox", { name: "Direction" })).toHaveText(
    IMPORT_FROM
  );
  await expect(button(panel, "Import now")).toBeVisible();
  // The Connect screen still opens as a push.
  await page.keyboard.press("Escape");
  const connect = await openConnector(page);
  await choose(connect, "Spreadsheet", "Live projects");
  await expect(
    connect.getByRole("combobox", { name: "Direction" })
  ).not.toHaveText(KEEP_IN_SYNC);
  await expect(button(connect, "Send")).toBeVisible();
});
