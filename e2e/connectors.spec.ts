import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const PROJECTS = /Projects/;
const NAME = /^Name/;
const STATUS = /^Status/;
const TEAM_TRACKER = /^Team tracker/;
const YAYAW_ID = /Yayaw ID/;
const NEW_DUE = /New field “Due”/;
const DONT_SEND = /Don’t send/;
const SELECTED_TWO = /Selected \(2\)/;
const SHARE_WITH =
  /Share the spreadsheet with yayaw-demo@yayaw-demo\.iam\.gserviceaccount\.com/;

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

const send = async (panel: Locator, name = "Send") => {
  await panel.getByRole("button", { name, exact: true }).click();
  return panel.locator("[data-connector-summary]");
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("a connector maps the view's columns to a target, sends and sends again", async ({
  page,
}) => {
  let panel = await openConnector(page);
  await choose(panel, "Spreadsheet", "Team tracker");
  await expect(panel.getByRole("combobox", { name: "Tab" })).toHaveText(
    PROJECTS
  );
  // Same headers map to their field; others become new fields.
  await expect(
    panel.getByRole("combobox", { name: "Name", exact: true })
  ).toHaveText(NAME);
  await expect(
    panel.getByRole("combobox", { name: "Status", exact: true })
  ).toHaveText(STATUS);
  await expect(
    panel.getByRole("combobox", { name: "Due", exact: true })
  ).toHaveText(NEW_DUE);
  await expect(
    panel.getByRole("combobox", { name: "Match records by" })
  ).toHaveText(YAYAW_ID);
  await choose(panel, "Price", "Don’t send");

  await expect(await send(panel)).toHaveText("6 created");
  await expect(await send(panel, "Send again")).toHaveText("6 updated");
  await panel.getByRole("button", { name: "Done", exact: true }).click();
  await expect(panel).toHaveCount(0);

  // The view remembers the target and the mapping.
  await page.keyboard.press("Escape");
  panel = await openConnector(page);
  await expect(panel.getByRole("combobox", { name: "Spreadsheet" })).toHaveText(
    TEAM_TRACKER
  );
  await expect(
    panel.getByRole("combobox", { name: "Price", exact: true })
  ).toHaveText(DONT_SEND);
});

test("a connector sends the selected records only", async ({ page }) => {
  const rows = page.getByRole("checkbox");
  await rows.nth(1).click();
  await rows.nth(2).click();
  const panel = await openConnector(page);
  await expect(
    panel.getByRole("combobox", { name: "Records", exact: true })
  ).toHaveCount(0);
  await choose(panel, "Spreadsheet", "Team tracker");
  await expect(
    panel.getByRole("combobox", { name: "Records", exact: true })
  ).toHaveText(SELECTED_TWO);
  await expect(await send(panel)).toHaveText("2 created");
});

test("a target that is not shared explains who to share it with", async ({
  page,
}) => {
  const panel = await openConnector(page);
  await choose(panel, "Spreadsheet", "Private sheet");
  await expect(panel.locator("[data-connector-error]")).toHaveText(SHARE_WITH);
  await expect(
    panel.getByRole("button", { name: "Send", exact: true })
  ).toBeDisabled();
});

test("on phones, the connector screen chooses in the drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(EXAMPLE);
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "Spreadsheet", exact: true }).click();
  const panel = page.locator("[data-connector-panel]");
  // Long choices open as a list inside the drawer.
  await panel.getByRole("button", { name: "Spreadsheet", exact: true }).click();
  await page.getByRole("radio", { name: "Team tracker" }).click();
  await expect(panel.getByRole("button", { name: "Tab" })).toHaveText(PROJECTS);
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "6 created"
  );
});
