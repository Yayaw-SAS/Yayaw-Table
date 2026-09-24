import { expect, type Page, test } from "@playwright/test";

const ASSETS = "/?example=assets";
const DRAG_LABEL = ".yayaw-ft-drag-label";
const LOGOS = /^Logos/;
const SEARCH = /^Search/;
const SPRING_PATH = /Assets.*Campaigns.*2026.*Spring launch/;
const CARD_SETTINGS = /^card settings/i;
const INTO_DESCENDANT = "You can't move a folder into one of its subfolders";
const ROOT_ROWS = [
  "Brand",
  "Campaigns",
  "Documents",
  "Photos",
  "Podcast intro.mp3",
  "README.md",
];

const tree = (page: Page) => page.getByRole("treegrid");
const row = (page: Page, name: string) =>
  tree(page).getByRole("row", { name, exact: true });
/** Names of the tree rows on screen, in order. */
const rowNames = (page: Page) =>
  tree(page)
    .locator("[role=row][aria-level][data-folder]")
    .evaluateAll((rows) => rows.map((item) => item.getAttribute("aria-label")));
const requests = (page: Page) =>
  page.evaluate(
    () =>
      (
        globalThis as {
          __assetRequests?: { scope?: string; parentId?: string | null }[];
        }
      ).__assetRequests ?? []
  );

async function open(page: Page, url = ASSETS) {
  await page.goto(url);
  await expect(row(page, "Photos")).toBeVisible();
}

/** Press on a row's name, move over another row, and optionally drop. */
async function dragRow(page: Page, from: string, to: string, drop = true) {
  const source = await row(page, from).locator(".yayaw-ft-label").boundingBox();
  const target = await row(page, to).locator(".yayaw-ft-label").boundingBox();
  if (!(source && target)) {
    throw new Error(`Rows ${from} and ${to} must be on screen`);
  }
  await page.mouse.move(source.x + 8, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 24, source.y + source.height / 2 + 6, {
    steps: 3,
  });
  await page.mouse.move(target.x + 12, target.y + target.height / 2, {
    steps: 8,
  });
  if (drop) {
    await page.mouse.up();
  }
}

async function rowMenu(page: Page, name: string, item: string) {
  await row(page, name).hover();
  await row(page, name).getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.use({ viewport: { width: 1280, height: 1000 } });

test("lazy loads folders with the children scope and expands or collapses them", async ({
  page,
}) => {
  await open(page);
  expect(await rowNames(page)).toEqual([
    "Brand",
    "Fonts",
    "Logos",
    "Brand guidelines.pdf",
    "Campaigns",
    "2026",
    "Documents",
    "Photos",
    "Office.jpg",
    "Team.jpg",
    "Workshop.jpg",
    "Podcast intro.mp3",
    "README.md",
  ]);
  expect(await requests(page)).toContainEqual({
    scope: "children",
    parentId: null,
  });
  expect(await requests(page)).not.toContainEqual({
    scope: "children",
    parentId: "f-logos",
  });
  await expect(row(page, "Brand")).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, "Brand")).toHaveAttribute("aria-setsize", "6");
  await expect(row(page, "Logos")).toHaveAttribute("aria-level", "2");
  await row(page, "Logos").getByRole("button", { name: "Expand" }).click();
  await expect(row(page, "Logo primary.png")).toBeVisible();
  expect(await requests(page)).toContainEqual({
    scope: "children",
    parentId: "f-logos",
  });
  await row(page, "Photos").getByRole("button", { name: "Collapse" }).click();
  await expect(row(page, "Office.jpg")).toHaveCount(0);
  await expect(row(page, "Photos")).toHaveAttribute("aria-expanded", "false");
});

test("expand all opens every folder with the subtree scope; collapse all keeps the root rows", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(row(page, "Banner 10.jpg")).toBeVisible();
  await expect(row(page, "Inter.zip")).toBeVisible();
  expect(await requests(page)).toContainEqual({
    scope: "subtree",
    parentId: null,
  });
  expect(await rowNames(page)).toHaveLength(22);
  await expect(page.getByRole("button", { name: "Expand all" })).toBeDisabled();
  await page.getByRole("button", { name: "Collapse all" }).click();
  expect(await rowNames(page)).toEqual(ROOT_ROWS);
  await expect(
    page.getByRole("button", { name: "Collapse all" })
  ).toBeDisabled();
  // Alt+Shift+↓ is the keyboard shortcut.
  await row(page, "Brand").focus();
  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(row(page, "Banner 2.jpg")).toBeVisible();
});

test("the details pane shows the selected file", async ({ page }) => {
  await open(page);
  await row(page, "Office.jpg").click();
  await expect(row(page, "Office.jpg")).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const details = page.getByRole("complementary", { name: "Details" });
  await expect(
    details.getByRole("heading", { name: "Office.jpg" })
  ).toBeVisible();
  await expect(details).toContainText("Assets › Photos");
  await expect(details).toContainText("1.1 MB");
  await row(page, "README.md").click();
  await expect(
    details.getByRole("heading", { name: "README.md" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide details" }).click();
  await expect(details).toHaveCount(0);
});

test("drags a file into a folder, then undoes the move", async ({ page }) => {
  await open(page);
  await dragRow(page, "README.md", "Documents", false);
  await expect(page.locator(DRAG_LABEL)).toHaveText(
    "Move “README.md” to Assets › Documents"
  );
  await expect(row(page, "Documents")).toHaveAttribute("data-ft-drop", "valid");
  await page.mouse.up();
  await expect(
    page.getByText("Moved “README.md” to Assets › Documents")
  ).toBeVisible();
  await expect(row(page, "README.md")).toHaveAttribute("aria-level", "2");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row(page, "README.md")).toHaveAttribute("aria-level", "1");
  expect(await rowNames(page)).toEqual(expect.arrayContaining(ROOT_ROWS));
});

test("refuses to drop a folder into its own subfolder", async ({ page }) => {
  await open(page);
  await row(page, "2026").getByRole("button", { name: "Expand" }).click();
  await expect(row(page, "Spring launch")).toBeVisible();
  await dragRow(page, "Campaigns", "Spring launch", false);
  await expect(page.locator(DRAG_LABEL)).toHaveText(INTO_DESCENDANT);
  await expect(row(page, "Spring launch")).toHaveAttribute(
    "data-ft-drop",
    "invalid"
  );
  await page.mouse.up();
  await expect(page.locator(DRAG_LABEL)).toHaveCount(0);
  await expect(row(page, "Campaigns")).toHaveAttribute("aria-level", "1");
  await expect(row(page, "Spring launch")).toHaveAttribute("aria-level", "3");
});

test("moves with cut and paste, and with Move to…", async ({ page }) => {
  await open(page);
  await row(page, "Team.jpg").click();
  await page.keyboard.press("Control+x");
  await expect(row(page, "Team.jpg")).toHaveAttribute("data-cut", "true");
  await row(page, "Documents").click();
  await page.keyboard.press("Control+v");
  await expect(
    page.getByText("Moved “Team.jpg” to Assets › Documents")
  ).toBeVisible();
  await expect(row(page, "Team.jpg")).toHaveAttribute("aria-level", "2");

  await rowMenu(page, "Office.jpg", "Move to…");
  const dialog = page.getByRole("dialog", { name: "Move “Office.jpg”" });
  await expect(dialog.getByRole("button", { name: "Photos" })).toBeDisabled();
  await dialog.getByRole("searchbox", { name: "Search folders" }).fill("log");
  await dialog.getByRole("button", { name: LOGOS }).click();
  await dialog.getByRole("button", { name: "Move here" }).click();
  await expect(
    page.getByText("Moved “Office.jpg” to Assets › Brand › Logos")
  ).toBeVisible();
  await expect(row(page, "Office.jpg")).toHaveAttribute("aria-level", "3");
});

test("creates a folder and renames with F2", async ({ page }) => {
  await open(page);
  await row(page, "Photos").click();
  await page.getByRole("button", { name: "New folder" }).click();
  const name = tree(page).getByRole("textbox", { name: "Folder name" });
  await expect(name).toHaveValue("New folder");
  await name.fill("Events");
  await name.press("Enter");
  await expect(row(page, "Events")).toHaveAttribute("aria-level", "2");
  await expect(row(page, "Events")).toBeFocused();

  await row(page, "README.md").click();
  await page.keyboard.press("F2");
  const rename = tree(page).getByRole("textbox", { name: "Rename" });
  await rename.fill("Podcast intro.mp3");
  await rename.press("Enter");
  await expect(tree(page).getByRole("alert")).toHaveText(
    "An item named “Podcast intro.mp3” already exists here."
  );
  await rename.fill("Notes.md");
  await rename.press("Enter");
  await expect(row(page, "Notes.md")).toBeVisible();
  await expect(row(page, "README.md")).toHaveCount(0);
});

test("keyboard: arrows, type-ahead and Enter follow the tree pattern", async ({
  page,
}) => {
  await open(page);
  await row(page, "Brand").click();
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "Fonts")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(row(page, "Inter.zip")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(row(page, "Fonts")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(row(page, "Brand")).toBeFocused();
  await page.keyboard.press("p");
  await expect(row(page, "Photos")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "Photos")).toHaveAttribute("aria-expanded", "false");
  await expect(tree(page).locator("[tabindex='0']")).toHaveCount(1);
});

test("a search shows the matches with their folders", async ({ page }) => {
  await open(page);
  await page.getByPlaceholder(SEARCH).fill("banner");
  await expect(row(page, "Banner 10.jpg")).toBeVisible();
  expect(await rowNames(page)).toEqual([
    "Campaigns",
    "2026",
    "Spring launch",
    "Banner 1.jpg",
    "Banner 2.jpg",
    "Banner 10.jpg",
  ]);
  await expect(row(page, "Banner 1.jpg").locator("mark")).toHaveText("Banner");
  expect(await requests(page)).toContainEqual({
    scope: "tree-matches",
    parentId: undefined,
  });
  await page.getByPlaceholder(SEARCH).fill("");
  await expect(row(page, "Brand")).toBeVisible();
});

test("a link opens a folder with its path", async ({ page }) => {
  await page.goto(`${ASSETS}&assets-folder=f-spring`);
  await expect(row(page, "Banner 10.jpg")).toBeVisible();
  await expect(row(page, "Spring launch")).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Location" })).toHaveText(
    SPRING_PATH
  );
  await row(page, "Photos").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("assets-folder"))
    .toBe("f-photos");
});

test("hosts without scopes get a tree built in the browser, with Unfiled", async ({
  page,
}) => {
  await page.goto("/?example=assets-fallback");
  await expect(row(page, "Unfiled")).toBeVisible();
  await row(page, "Unfiled").getByRole("button", { name: "Expand" }).click();
  await expect(row(page, "Old draft.docx")).toHaveAttribute("aria-level", "2");
  expect(await requests(page)).not.toContainEqual({
    scope: "children",
    parentId: "f-brand",
  });
});

test("phones drill into folders and move with Move to…", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  expect(await rowNames(page)).toEqual(ROOT_ROWS);
  await row(page, "Campaigns").click();
  await expect(row(page, "2026")).toBeVisible();
  await expect(row(page, "Brand")).toHaveCount(0);
  await row(page, "2026").click();
  await expect(row(page, "Spring launch")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(row(page, "2026")).toBeVisible();
  await rowMenu(page, "2026", "Move to…");
  const dialog = page.getByRole("dialog", { name: "Move “2026”" });
  await dialog.getByRole("button", { name: "Assets" }).click();
  await dialog.getByRole("button", { name: "Move here" }).click();
  await expect(row(page, "2026")).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(row(page, "2026")).toBeVisible();
});

test("view settings choose the columns and the details pane", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
  await page.getByRole("combobox", { name: "Columns", exact: true }).click();
  await page.getByRole("option", { name: "Size", exact: true }).click();
  await expect(
    tree(page).getByRole("columnheader", { name: "Modified" })
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Details pane", exact: true })
    .click();
  await page.getByRole("option", { name: "On", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Details" })
  ).toBeVisible();
  await expect
    .poll(() =>
      JSON.parse(
        new URL(page.url()).searchParams.get("assets-filetree") ?? "{}"
      )
    )
    .toMatchObject({ columns: ["size"], showDetails: true });
});
