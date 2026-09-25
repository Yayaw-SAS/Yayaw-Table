import { expect, type Locator, type Page, test } from "@playwright/test";
import { assetRows } from "../examples/assets";
import { productRows } from "../examples/products";

/**
 * The facet panel (`?example=products`, `?example=assets`), "New folder" and
 * the folder filter outside the File tree, the same in both editions. The
 * screen's facet list block is in `screen.spec.ts`.
 */
const PRODUCTS = "/?example=products";
const ASSETS_GALLERY = "/?example=assets&assets-display=gallery";
const SETTINGS = "View settings";
const FILTERS = /^filters?/i;
const CATEGORY_EMPTY_RULE = /^Category Is empty/;
const PRODUCTS_PAGE_SIZE = 10;
const SPRING_FILES = ["banner-1", "banner-10", "banner-2", "hero"];

type Row = Record<string, unknown>;

/** Records by value, a list counting in each of its values; no value under "". */
function countBy<T extends object>(
  rows: readonly T[],
  columnId: keyof T
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value: unknown = row[columnId];
    const values = Array.isArray(value) ? value : [value];
    const keys = new Set(
      (values.length ? values : [null]).map((item) =>
        item === null || item === undefined || item === "" ? "" : String(item)
      )
    );
    for (const key of keys) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

const facet = (scope: Page | Locator, id: string) =>
  scope.locator(`[data-facet="${id}"]`);
const panelFacet = (page: Page, id: string) =>
  facet(page.locator("[data-facet-panel]"), id);
const value = (scope: Locator, key: string) =>
  scope.locator(`button[data-facet-value="${key}"]`);
/** The values a facet lists with their counts. */
const facetCounts = async (scope: Locator) =>
  Object.fromEntries(
    await scope
      .locator("button[data-facet-value]")
      .evaluateAll((buttons) =>
        buttons.map((button) => [
          button.getAttribute("data-facet-value") ?? "",
          Number(button.querySelector("[data-facet-count]")?.textContent),
        ])
      )
  );
const rowIds = (page: Page) =>
  page
    .locator("[data-row-id]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-row-id")).sort()
    );
const idsOf = (rows: readonly { id: string }[]) =>
  rows.map((row) => row.id).sort();
/** The table's filter rules in the URL (React keeps a list, Vue `{ filters }`). */
const filterRules = (page: Page, tableId: string) => {
  const raw = new URL(page.url()).searchParams.get(
    `${tableId}-advancedFilters`
  );
  const parsed = JSON.parse(decodeURIComponent(raw ?? "") || "[]");
  const rules: Row[] = Array.isArray(parsed) ? parsed : (parsed.filters ?? []);
  return rules.map((rule) => [rule.columnId, rule.operator, rule.values]);
};

/** The view settings' filter page. */
async function openFilters(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: SETTINGS }).click();
  await page
    .getByRole("dialog", { name: SETTINGS })
    .getByRole("button", { name: FILTERS })
    .click();
  const menu = page.getByRole("dialog", { name: "Filters" });
  await expect(menu).toBeVisible();
  return menu;
}

test("facet counts match the data, a click filters and the selection is filter state", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(PRODUCTS);
  const products = productRows();
  const category = panelFacet(page, "category");
  const tags = panelFacet(page, "tags");
  // Every record counts, not only the first page.
  await expect
    .poll(() => facetCounts(category))
    .toEqual(countBy(products, "category"));
  await expect.poll(() => facetCounts(tags)).toEqual(countBy(products, "tags"));

  await value(category, "software").click();
  const software = products.filter((row) => row.category === "software");
  await expect(value(category, "software")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect.poll(() => rowIds(page)).toEqual(idsOf(software));
  // The category keeps its counts (its own rule is left out); the tags
  // count the software products.
  await expect
    .poll(() => facetCounts(category))
    .toEqual(countBy(products, "category"));
  await expect.poll(() => facetCounts(tags)).toEqual(countBy(software, "tags"));
  // Filter state: the rule the filter menus write, in the URL.
  await expect
    .poll(() => filterRules(page, "products"))
    .toEqual([["category", "isAnyOf", ["software"]]]);

  // Keyboard: arrows move between values, Space toggles.
  await value(category, "software").focus();
  await page.keyboard.press("ArrowDown");
  await expect(value(category, "hardware")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(value(category, "hardware")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect
    .poll(() => rowIds(page))
    .toEqual(
      idsOf(
        products.filter((row) =>
          ["software", "hardware"].includes(row.category)
        )
      )
    );
  // A list column: any of the values it contains.
  await value(tags, "eco").click();
  await expect
    .poll(() => filterRules(page, "products"))
    .toEqual([
      ["category", "isAnyOf", ["software", "hardware"]],
      ["tags", "contains", ["eco"]],
    ]);
  await expect
    .poll(() => rowIds(page))
    .toEqual(
      idsOf(
        products.filter(
          (row) =>
            ["software", "hardware"].includes(row.category) &&
            row.tags.includes("eco")
        )
      )
    );
  // "Clear" empties one facet.
  await tags.locator("[data-facet-clear]").click();
  await expect(value(tags, "eco")).toHaveAttribute("aria-pressed", "false");
  // "No value": the records without a category, on its own.
  await category.locator("button[data-facet-empty]").click();
  await expect
    .poll(() => rowIds(page))
    .toEqual(idsOf(products.filter((row) => !row.category)));
  await expect(value(category, "software")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect
    .poll(() => filterRules(page, "products"))
    .toEqual([["category", "isEmpty", []]]);
  // A link keeps it: the panel reads the selection back.
  await page.reload();
  await expect(category.locator("button[data-facet-empty]")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  // The filter menus list the same rule.
  const menu = await openFilters(page);
  await expect(
    project === "vue"
      ? menu.getByRole("form", { name: "Filter for Category" })
      : menu.getByRole("button", { name: CATEGORY_EMPTY_RULE })
  ).toBeVisible();
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(menu).toHaveCount(0);
  // "Clear all".
  await page.locator("[data-facet-clear-all]").click();
  await expect.poll(() => rowIds(page)).toHaveLength(PRODUCTS_PAGE_SIZE);
  await expect(
    page.locator('[data-facet-panel] [aria-pressed="true"]')
  ).toHaveCount(0);
  await expect.poll(() => filterRules(page, "products")).toEqual([]);
});

test("the toolbar button hides the panel; phones open it as a sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(PRODUCTS);
  const toggle = page.locator("[data-facets-toggle]");
  await expect(page.locator("[data-facet-panel]")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(page.locator("[data-facet-panel]")).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("[data-facet-panel]")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-facet-panel]")).toHaveCount(0);
  await page.locator("[data-facets-toggle]").click();
  const sheet = page.locator("[data-facet-sheet]");
  await expect(sheet).toBeVisible();
  await value(facet(sheet, "tags"), "eco").click();
  await expect
    .poll(() => rowIds(page))
    .toEqual(idsOf(productRows().filter((row) => row.tags.includes("eco"))));
});

test("New folder from the gallery creates a folder under the chosen parent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(ASSETS_GALLERY);
  await page.locator("[data-new-folder]").click();
  const dialog = page.locator("[data-new-folder-dialog]");
  await expect(dialog).toBeVisible();
  // At the root unless a folder is filtered.
  await expect(dialog.locator("[data-folder-root]")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  // The picker searches the folders and shows where each one is.
  await dialog.locator("[data-folder-search]").fill("2026");
  const year = dialog.locator('[data-folder-option="f-2026"]');
  await expect(year).toContainText("Campaigns");
  await year.click();
  await expect(year).toHaveAttribute("aria-pressed", "true");
  await dialog.locator("[data-new-folder-name]").fill("Summer");
  await dialog.locator("[data-new-folder-create]").click();
  await expect(dialog).toHaveCount(0);
  // The folder facet: 2026 now holds it.
  await page.locator("[data-facets-toggle]").click();
  const folders = panelFacet(page, "parentId");
  const campaign = assetRows().filter((row) => row.parentId === "f-2026");
  await expect(
    value(folders, "f-2026").locator("[data-facet-count]")
  ).toHaveText(String(campaign.length + 1));
  await value(folders, "f-2026").click();
  await expect(page.locator("[data-row-id]")).toHaveCount(campaign.length + 1);
  await expect(
    page.locator("[data-row-id]").filter({ hasText: "Summer" })
  ).toHaveCount(1);
});

/** Opens the filter menus on a new rule for the Folder column: its folder picker. */
async function filterFolder(page: Page, project: string): Promise<Locator> {
  const menu = await openFilters(page);
  if (project === "vue") {
    await menu.getByRole("button", { name: "Add filter" }).click();
    await menu.getByLabel("Filter column").last().selectOption("parentId");
  } else {
    await menu.getByRole("button", { name: "Folder", exact: true }).click();
  }
  const picker = menu.locator("[data-folder-picker]");
  await expect(picker).toBeVisible();
  return picker;
}

/** Applies the rule being edited. */
const applyRule = (page: Page, project: string) =>
  page
    .getByRole("dialog", { name: "Filters" })
    .getByRole("button", {
      name: project === "vue" ? "Apply" : "Done",
      exact: true,
    })
    .click();

test("the folder filter shows only that folder's files, or the root's", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(ASSETS_GALLERY);
  const project = testInfo.project.name;
  const picker = await filterFolder(page, project);
  // The root first; folders with their location.
  await expect(picker.locator("[data-folder-option]").first()).toHaveAttribute(
    "data-folder-root",
    ""
  );
  await expect(picker.locator('[data-folder-option="f-spring"]')).toContainText(
    "Campaigns › 2026"
  );
  await picker.locator("[data-folder-search]").fill("spring");
  await expect(
    picker.locator("[data-folder-option]:not([data-folder-root])")
  ).toHaveCount(1);
  await picker.locator('[data-folder-option="f-spring"]').click();
  await applyRule(page, project);
  await expect.poll(() => rowIds(page)).toEqual(SPRING_FILES);
  await expect
    .poll(() => filterRules(page, "assets"))
    .toEqual([["parentId", "isAnyOf", ["f-spring"]]]);

  // The root: the top level only.
  await page.goto(ASSETS_GALLERY);
  const root = await filterFolder(page, project);
  await root.locator("[data-folder-root]").click();
  await applyRule(page, project);
  await expect
    .poll(() => rowIds(page))
    .toEqual(idsOf(assetRows().filter((row) => row.parentId === null)));
  await expect
    .poll(() => filterRules(page, "assets"))
    .toEqual([["parentId", "isEmpty", []]]);
});
