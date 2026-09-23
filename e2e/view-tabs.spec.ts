import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const DISPLAY_PARAM = "views-display";
const SEARCH = /^search/i;
const EXPORT_ENTRY = /^Export/;
const EXPORT_BUTTON = /^export$/i;
const SELECTED_TWO = /^Selected \(2\)/;
const PROJECTS_CSV = /^projects-\d{4}-\d{2}-\d{2}\.csv$/;
const SEARCH_BUTTON = /^search/i;
const CURRENT_VIEW_TRIGGER = /^current view/i;
const SEARCH_TAB = /Search/;
const MANUAL = /Manual/;
const WEEKLY = /Weekly/;
const THURSDAY = /Thursday/;
const NEXT_THURSDAY_RUN = /^Next: Thu.*, 09:30 \(Europe\/Paris\)$/;

const displayParam = (page: Page) =>
  new URL(page.url()).searchParams.get(DISPLAY_PARAM);

const saveView = async (page: Page, name: string, layout?: string) => {
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  if (layout) {
    await page.getByRole("combobox", { name: "Layout" }).click();
    await page.getByRole("option", { name: layout }).click();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("saved views appear as tabs with their layout, and + creates one in another layout", async ({
  page,
}) => {
  // The default view is a tab from the start.
  await expect(page.getByRole("tab")).toHaveText(["Default view"]);
  await page.getByRole("button", { name: "View actions" }).click();
  await page.getByRole("button", { name: "Save this view…" }).click();
  await saveView(page, "Active projects");

  const tabs = page.getByRole("tablist", { name: "Views" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Default view",
    "Active projects",
  ]);
  await expect(
    tabs.getByRole("tab", { name: "Active projects" })
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "New view" }).click();
  await saveView(page, "Deadlines", "Calendar");
  await expect(tabs.getByRole("tab", { name: "Deadlines" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect.poll(() => displayParam(page)).toBe("calendar");
  await expect(page.locator("[data-calendar-title]")).toBeVisible();

  await tabs.getByRole("tab", { name: "Default view" }).click();
  await expect.poll(() => displayParam(page)).toBeNull();
  await tabs.getByRole("tab", { name: "Deadlines" }).click();
  await expect.poll(() => displayParam(page)).toBe("calendar");

  // Settings are separate from the views, on the right.
  await page.getByRole("button", { name: "View settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "View settings" })
  ).toBeVisible();
});

test("an edited view shows as modified on its tab", async ({ page }) => {
  await page.getByRole("button", { name: "View actions" }).click();
  await page.getByRole("button", { name: "Save this view…" }).click();
  await saveView(page, "Search");
  const tab = page.getByRole("tab", { name: SEARCH_TAB });
  await expect(tab.locator("output")).toHaveCount(0);
  await page.getByPlaceholder(SEARCH).fill("Alpha");
  await expect(tab.locator("output")).toBeVisible();
});

test("on phones, views and settings are two separate menus and search opens on demand", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(EXAMPLE);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Data actions" })).toHaveCount(
    0
  );

  // Settings hold presentation only; data actions have their own menu.
  await page.getByRole("button", { name: "View settings" }).click();
  const settings = page.getByRole("dialog", { name: "View settings" });
  await expect(
    settings.getByRole("button", { name: EXPORT_ENTRY })
  ).toHaveCount(0);
  await expect(settings.getByText("Default view")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const data = page.getByRole("dialog", { name: "Data" });
  await expect(data.getByRole("button", { name: EXPORT_ENTRY })).toBeVisible();
  await expect(
    data.getByRole("button", { name: "Share", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: CURRENT_VIEW_TRIGGER }).click();
  await expect(
    page.getByRole("button", { name: "Save this view…" })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: SEARCH_BUTTON }).click();
  await page.getByPlaceholder(SEARCH).fill("Bravo");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("views-q"))
    .toBe("Bravo");
});

test("custom destinations receive the view's query from the Data section", async ({
  page,
}) => {
  await page.goto(`${EXAMPLE}&views-q=bravo`);
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const data = page.getByRole("dialog", { name: "Data" });
  await expect(
    data.getByRole("button", { name: "Share", exact: true })
  ).toBeVisible();
  // Sends to tools live under Connect; custom shares under Share.
  await data.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "n8n", exact: true }).click();
  await expect(
    page.getByText("Sent 1 records to the n8n workflow")
  ).toBeVisible();
});

test("the Export screen writes the view's records as displayed or raw", async ({
  page,
}) => {
  await page.goto(`${EXAMPLE}&views-q=bravo`);
  const exportFile = async () => {
    await page.getByRole("button", { name: "Data", exact: true }).click();
    await page.getByRole("button", { name: EXPORT_ENTRY }).first().click();
    const panel = page.locator("[data-export-panel]");
    await expect(panel).toBeVisible();
    return panel;
  };
  const read = async (panel: Locator) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      panel.getByRole("button", { name: "Export", exact: true }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return {
      name: download.suggestedFilename(),
      text: Buffer.concat(chunks).toString("utf8"),
    };
  };

  const formatted = await read(await exportFile());
  expect(formatted.name).toMatch(PROJECTS_CSV);
  expect(formatted.text).toContain("Bravo audit,Service,Draft,€120.00");
  expect(formatted.text).not.toContain("Alpha launch");

  await page.keyboard.press("Escape");
  const panel = await exportFile();
  await panel.getByRole("combobox", { name: "Values" }).click();
  await page.getByRole("option", { name: "Raw" }).click();
  const raw = await read(panel);
  expect(raw.text).toContain("Bravo audit,Service,Draft,120,0.2,2026-09-05");
});

test("bulk export opens the Export screen for the selected records", async ({
  page,
}) => {
  const rows = page.getByRole("checkbox");
  await rows.nth(1).click();
  await rows.nth(2).click();
  await page.getByRole("button", { name: EXPORT_BUTTON }).last().click();
  const panel = page.locator("[data-export-panel]");
  await expect(panel.getByRole("combobox", { name: "Records" })).toHaveText(
    SELECTED_TWO
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) {
    chunks.push(chunk as Buffer);
  }
  const lines = Buffer.concat(chunks).toString("utf8").trim().split("\n");
  expect(lines).toHaveLength(3);
});

test.describe("Connect schedules", () => {
  // The browser's time zone is the schedule's default one.
  test.use({ timezoneId: "Europe/Paris", locale: "en-GB" });

  const openSchedule = async (page: Page) => {
    await page.getByRole("button", { name: "Data", exact: true }).click();
    const data = page.getByRole("dialog", { name: "Data" });
    await data.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByRole("button", { name: "Schedule n8n" }).click();
    const panel = page.locator("[data-schedule-panel]");
    await expect(
      panel.getByRole("combobox", { name: "Frequency" })
    ).toBeVisible();
    return panel;
  };
  const choose = async (panel: Locator, field: string, option: string) => {
    await panel.getByRole("combobox", { name: field }).click();
    await panel
      .page()
      .getByRole("option", { name: option, exact: true })
      .click();
  };

  test("a weekly schedule previews its next run and is kept per view", async ({
    page,
  }) => {
    await page.goto(EXAMPLE);
    let panel = await openSchedule(page);
    // Manual by default: no time fields and no next run.
    await expect(panel.getByRole("combobox", { name: "Frequency" })).toHaveText(
      MANUAL
    );
    await expect(panel.getByLabel("Time", { exact: true })).toHaveCount(0);
    await expect(panel.locator("[data-schedule-next]")).toHaveCount(0);

    await choose(panel, "Frequency", "Weekly");
    await choose(panel, "Day of the week", "Thursday");
    await panel.getByLabel("Time", { exact: true }).fill("09:30");
    await expect(panel.locator("[data-schedule-summary]")).toContainText(
      "Every Thursday at 09:30 (Europe/Paris)"
    );
    await expect(panel.locator("[data-schedule-next]")).toHaveText(
      NEXT_THURSDAY_RUN
    );
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Schedule saved")).toBeVisible();
    await expect(panel).toHaveCount(0);

    await page.keyboard.press("Escape");
    panel = await openSchedule(page);
    await expect(panel.getByRole("combobox", { name: "Frequency" })).toHaveText(
      WEEKLY
    );
    await expect(
      panel.getByRole("combobox", { name: "Day of the week" })
    ).toHaveText(THURSDAY);
    await expect(panel.getByLabel("Time", { exact: true })).toHaveValue(
      "09:30"
    );

    // Back to Manual hides the time fields again.
    await choose(panel, "Frequency", "Manual");
    await expect(panel.getByLabel("Time", { exact: true })).toHaveCount(0);
    await expect(
      panel.getByRole("combobox", { name: "Day of the week" })
    ).toHaveCount(0);
    await expect(panel.locator("[data-schedule-next]")).toHaveCount(0);
  });
});
