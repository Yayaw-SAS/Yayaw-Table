import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Tags columns backed by the host's catalog (`actions.tags`) in the Assets
 * example: create a tag on the fly in a cell, bulk add a tag and filter by
 * it, rename and merge in "Manage tags".
 */
const EXAMPLE = "/?example=assets&assets-display=table&assets-pageSize=50";
const CREATE_SUMMER = /^Create “Summer”/;
const ADD_TAGS = /^Add tags/;
const ADDED_TO_THREE = "Tags added to 3 records";
const MERGED = "Tags merged";

interface TagRequest {
  action: string;
  columnId: string;
}

const tagRequests = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as { __assetTagRequests?: TagRequest[] })
        .__assetTagRequests ?? []
  );

const rowOf = (page: Page, name: string) =>
  page.getByRole("row").filter({
    has: page.getByText(name, { exact: true }),
  });

const tagsCell = (page: Page, name: string): Locator =>
  rowOf(page, name).locator('[data-column-id="tags"]');

const openTableMenu = async (page: Page, project: string) => {
  if (project === "vue") {
    await page.getByRole("button", { name: "Column options: Tags" }).click();
    return;
  }
  await page
    .getByRole("columnheader")
    .getByText("Tags", { exact: true })
    .click();
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await expect(page.getByText("Office.jpg", { exact: true })).toBeVisible();
  // The catalog names the stored ids with their colors.
  await expect(tagsCell(page, "Logo mono.png")).toContainText("Brand");
  await expect(tagsCell(page, "Logo mono.png")).toContainText("Print");
});

test("a tag created on the fly in a cell is selected and saved", async ({
  page,
}) => {
  await tagsCell(page, "Office.jpg").dblclick();
  const input = page.getByRole("combobox", { name: "Tags" });
  await expect(input).toBeFocused();
  await input.fill("Summer");
  await expect(page.getByRole("option", { name: CREATE_SUMMER })).toBeVisible();
  await input.press("Enter");
  await expect(
    tagsCell(page, "Office.jpg").getByText("Summer", { exact: true })
  ).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect(tagsCell(page, "Office.jpg")).toHaveText("Summer");
  expect(
    (await tagRequests(page)).filter((request) => request.action === "create")
  ).toHaveLength(1);

  // The new tag is in the catalog: other cells offer it.
  await tagsCell(page, "Workshop.jpg").dblclick();
  await page.getByRole("combobox", { name: "Tags" }).fill("sum");
  await expect(
    page.getByRole("option", { name: "Summer", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("option", { name: CREATE_SUMMER })).toHaveCount(
    0
  );
  await page.keyboard.press("Escape");
});

test("bulk add puts a tag on three records, then the tag filters them", async ({
  page,
}, testInfo) => {
  for (const name of ["Team.jpg", "Office.jpg", "Workshop.jpg"]) {
    await rowOf(page, name).getByRole("checkbox").click();
  }
  await page.getByRole("button", { name: ADD_TAGS }).click();
  const dialog = page.getByRole("dialog", { name: "Add tags to 3 records" });
  await expect(dialog).toBeVisible();
  const picker = dialog.getByRole("combobox", { name: "Choose tags" });
  await picker.fill("Print");
  await page.getByRole("option", { name: "Print", exact: true }).click();
  // The list stays open to pick more; Escape closes it, not the dialog.
  await picker.press("Escape");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(ADDED_TO_THREE)).toBeVisible();
  for (const name of ["Team.jpg", "Office.jpg", "Workshop.jpg"]) {
    await expect(tagsCell(page, name)).toContainText("Print");
  }
  // Team.jpg keeps its tag: the patch adds, it does not replace.
  await expect(tagsCell(page, "Team.jpg")).toContainText("Social");

  // Filter the Tags column by the catalog tag.
  await openTableMenu(page, testInfo.project.name);
  if (testInfo.project.name === "vue") {
    await page.getByRole("menuitem", { name: "Filter column" }).click();
    await page.getByLabel("Filter operator").selectOption("contains");
    await page.getByRole("checkbox", { name: "Print" }).check();
    await page.getByRole("button", { name: "Apply" }).click();
  } else {
    await page.getByRole("menuitem", { name: "Filter" }).click();
    const editor = page.getByRole("dialog");
    await editor.getByRole("option", { name: "Print" }).click();
    await editor.getByRole("button", { name: "Done" }).click();
  }
  for (const name of [
    "Team.jpg",
    "Office.jpg",
    "Workshop.jpg",
    "Logo mono.png",
    "Brand guidelines.pdf",
  ]) {
    await expect(rowOf(page, name)).toBeVisible();
  }
  for (const name of ["Hero video.mp4", "Logo primary.png", "README.md"]) {
    await expect(rowOf(page, name)).toHaveCount(0);
  }
});

test("Manage tags renames a tag and merges another into a third", async ({
  page,
}, testInfo) => {
  await openTableMenu(page, testInfo.project.name);
  await page.getByRole("menuitem", { name: "Manage tags" }).click();
  const dialog = page.getByRole("dialog", { name: "Manage tags" });
  await expect(dialog).toBeVisible();
  // Usage counts come from one aggregate request.
  await expect(dialog.locator('[data-tag-row="tag-social"]')).toContainText(
    "4 records"
  );

  const name = dialog.getByRole("textbox", { name: "Rename Social" });
  await name.fill("Social media");
  await name.press("Enter");
  await expect(
    dialog.getByRole("textbox", { name: "Rename Social media" })
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Draft actions" }).click();
  await page.getByRole("menuitem", { name: "Merge into…" }).click();
  await dialog.getByRole("combobox", { name: "Merge “Draft” into" }).click();
  await page.getByRole("option", { name: "Brand", exact: true }).click();
  await expect(dialog).toContainText(
    "Records tagged “Draft” will be tagged “Brand”, then “Draft” will be deleted."
  );
  await dialog.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(page.getByText(MERGED)).toBeVisible();
  await expect(dialog.locator('[data-tag-row="tag-draft"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await expect(tagsCell(page, "Team.jpg")).toHaveText("Social media");
  await expect(tagsCell(page, "README.md")).toHaveText("Brand");
  expect((await tagRequests(page)).map((request) => request.action)).toEqual(
    expect.arrayContaining(["update", "merge"])
  );
});
