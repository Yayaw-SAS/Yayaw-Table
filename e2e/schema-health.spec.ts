import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const LIVE_PROJECTS = /^Live projects/;
const ROADMAP = /^Roadmap/;
const COST = /^Cost/;
const TEAM_HOME = /^Team home/;
const NAME = /^Name/;
const BLOCKED =
  "Fix this first: Progress: Notion property is Select, Number expected.";

/** The demo "Notion" destination: "Live projects" drifted since its mapping was saved. */
const openNotion = async (page: Page) => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const data = page.getByRole("dialog", { name: "Data" });
  await data.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "Notion", exact: true }).click();
  const panel = page.locator("[data-connector-panel]");
  await expect(panel.getByRole("combobox", { name: "Database" })).toHaveText(
    LIVE_PROJECTS
  );
  return panel;
};

const choose = async (panel: Locator, field: string, option: string) => {
  await panel.getByRole("combobox", { name: field, exact: true }).click();
  await panel.page().getByRole("option", { name: option, exact: true }).click();
};

const issues = (panel: Locator, severity: string) =>
  panel.locator(`[data-schema-group="${severity}"] li`);

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("the target check lists the drift; a blocking issue disables Send with its reason", async ({
  page,
}) => {
  const panel = await openNotion(page);
  const check = panel.locator("[data-connector-target-check]");
  await expect(check).toBeVisible();
  await expect(issues(check, "blocking")).toHaveText([
    "Progress: Notion property is Select, Number expected.",
  ]);
  await expect(issues(check, "fixable")).toHaveText([
    "Category: 2 options missing in Notion: Service, Other",
    "“Yayaw ID” property missing: it holds each record’s id.",
  ]);
  await expect(issues(check, "warning")).toHaveText([
    "Renamed in Notion: Price → Cost",
  ]);
  const sendButton = panel.getByRole("button", { name: "Send", exact: true });
  await expect(sendButton).toBeDisabled();
  await expect(panel.locator("[data-connector-blocker]")).toHaveText(BLOCKED);

  // Fields that don't fit are listed, disabled, with the reason.
  await panel.getByRole("combobox", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Margin (Formula, read-only)" })
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("option", { name: "Owner (Person, not supported yet)" })
  ).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: "Don’t send", exact: true }).click();
  await expect(issues(check, "blocking")).toHaveCount(0);
  await expect(panel.locator("[data-connector-blocker]")).toHaveCount(0);
  await expect(sendButton).toBeEnabled();
});

test("Update mapping saves the renamed field; Prepare fixes the fixable issues", async ({
  page,
}) => {
  const panel = await openNotion(page);
  const check = panel.locator("[data-connector-target-check]");
  // The renamed property keeps its column: the mapping shows its new name.
  await expect(
    panel.getByRole("combobox", { name: "Price", exact: true })
  ).toHaveText(COST);
  await check.getByRole("button", { name: "Update mapping" }).click();
  await expect(issues(check, "warning")).toHaveCount(0);

  await check.getByRole("button", { name: "Prepare Notion database" }).click();
  const confirm = panel.locator("[data-connector-prepare-confirm]");
  await expect(confirm.locator("li")).toHaveText([
    "Add 2 options to “Category”: Service, Other",
    "Create “Yayaw ID” (Text) for record ids",
  ]);
  await confirm.getByRole("button", { name: "Make these changes" }).click();
  await expect(panel.locator("[data-connector-prepared]")).toHaveText(
    "2 changes made in Notion."
  );
  await expect(issues(check, "fixable")).toHaveCount(0);
  await expect(issues(check, "blocking")).toHaveCount(1);

  await choose(panel, "Progress", "Don’t send");
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "6 created"
  );
});

test("a new database from the table's columns is created and needs no fix", async ({
  page,
}) => {
  const panel = await openNotion(page);
  await expect(panel.locator("[data-connector-missing-help]")).toContainText(
    "••• › Connections"
  );
  await choose(panel, "Database", "New database from this table’s columns…");
  const form = panel.locator("[data-connector-create]");
  await expect(form.getByRole("combobox", { name: "Create in" })).toHaveText(
    TEAM_HOME
  );
  await form.getByLabel("Name", { exact: true }).fill("Roadmap");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(panel.getByRole("combobox", { name: "Database" })).toHaveText(
    ROADMAP
  );
  await expect(panel.locator("[data-connector-target-check]")).toHaveCount(0);
  await expect(
    panel.getByRole("combobox", { name: "Name (page title)" })
  ).toHaveText(NAME);
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await expect(panel.locator("[data-connector-summary]")).toHaveText(
    "6 created"
  );
});
