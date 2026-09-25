import { expect as baseExpect, type Page, test } from "@playwright/test";

// WebGL through SwiftShader is slow in parallel runs: allow more time.
const expect = baseExpect.configure({ timeout: 15_000 });

// Each test draws WebGL maps: run them one after the other in their worker.
test.describe.configure({ mode: "default" });

// MapLibre needs WebGL: headless Chromium draws it with SwiftShader.
test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});

const MAP = "/?example=views&views-display=map";
const SETTINGS_PARAM = "views-map";
const DIST_FILE = /[^/]+$/;
const TOULOUSE = /Toulouse lab/;
const ECHO = /Echo sensors/;
/** The demo's basemap, replaced by a plain background so tests stay offline. */
const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#eef0f3" },
    },
  ],
};

const CARD_SETTINGS = /^card settings/i;
const settingsParam = (page: Page) =>
  JSON.parse(new URL(page.url()).searchParams.get(SETTINGS_PARAM) ?? "{}");
const mapUrl = (settings: Record<string, unknown>) =>
  `${MAP}&${SETTINGS_PARAM}=${encodeURIComponent(JSON.stringify(settings))}`;
const marker = (page: Page, id: string) =>
  page.locator(`[data-map-marker="${id}"]`);
const clusters = (page: Page) => page.locator("[data-map-cluster]");
const listItem = (page: Page, id: string) =>
  page.locator(`[data-map-list-item="${id}"]`);
const demoScopes = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as { yayawDemoScopes?: Record<string, unknown>[] })
        .yayawDemoScopes ?? []
  );

/** Records drawn on the map: single markers plus the records in clusters. */
const drawnRecords = async (page: Page) => {
  const counts = await clusters(page).evaluateAll((items) =>
    items.map((item) => Number(item.getAttribute("data-map-cluster")))
  );
  return (
    (await page.locator("[data-map-marker]").count()) +
    counts.reduce((sum, count) => sum + count, 0)
  );
};

test.beforeEach(async ({ context }) => {
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({ json: BLANK_STYLE })
  );
  // MapLibre's worker is loaded from unpkg, as mapcn does: serve the local
  // copies. The worker imports `./maplibre-gl-shared.mjs` from its own folder,
  // so every file of `dist/` is served by name, not only the worker.
  await context.route("https://unpkg.com/maplibre-gl@*/dist/*", (route) =>
    route.fulfill({
      path: `node_modules/maplibre-gl/dist/${DIST_FILE.exec(new URL(route.request().url()).pathname)?.[0]}`,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    })
  );
});

test("the map shows each project with a site and counts the others", async ({
  page,
}) => {
  await page.goto(MAP);
  await expect(page.locator("[data-map-view]")).toBeVisible();
  // Five projects have a site; Echo has none.
  await expect.poll(() => drawnRecords(page)).toBe(5);
  await expect(page.locator("[data-map-without-location]")).toHaveText(
    "1 record without a location"
  );
  // Paris and La Défense are close: one cluster of two at this zoom.
  await expect(clusters(page)).toHaveCount(1);
  await expect(clusters(page)).toHaveAttribute("data-map-cluster", "2");
  await clusters(page).click();
  await expect(marker(page, "alpha")).toBeVisible();
  await expect(marker(page, "foxtrot")).toBeVisible();
});

test("a marker opens its popup, and Open shows the record", async ({
  page,
}) => {
  await page.goto(mapUrl({ cluster: false }));
  await expect(page.locator("[data-map-marker]")).toHaveCount(5);
  await marker(page, "bravo").click();
  const popup = page.locator('[data-map-popup="bravo"]');
  await expect(popup.locator("[data-map-popup-title]")).toHaveText(
    "Bravo audit"
  );
  await expect(popup).toContainText("Draft");
  await popup.getByRole("button", { name: "Open" }).click();
  // The record view: the table's details drawer.
  const record = page.getByRole("dialog", { name: "Bravo audit" });
  await expect(record).toBeVisible();
  await expect(record).toContainText(
    "Lyon workshop · Place Bellecour, 69002 Lyon"
  );
});

test("markers are keyboard reachable and Escape closes the popup", async ({
  page,
}) => {
  await page.goto(mapUrl({ cluster: false }));
  await marker(page, "charlie").focus();
  await page.keyboard.press("Enter");
  const open = page.locator('[data-map-open="charlie"]');
  await expect(open).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-map-popup="charlie"]')).toHaveCount(0);
  await expect(marker(page, "charlie")).toBeFocused();
});

test("markers take the color of their status option", async ({ page }) => {
  await page.goto(mapUrl({ cluster: false, colorColumn: "status" }));
  const color = (id: string) =>
    marker(page, id).evaluate((item) => getComputedStyle(item).backgroundColor);
  await expect(marker(page, "alpha")).toBeVisible();
  // Alpha and Charlie are Active, Bravo is a Draft.
  expect(await color("alpha")).toBe(await color("charlie"));
  expect(await color("alpha")).not.toBe(await color("bravo"));
});

test("the map is configured in the view menu and kept in the URL", async ({
  page,
}) => {
  await page.goto(MAP);
  await expect.poll(() => drawnRecords(page)).toBe(5);
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
  const choose = async (setting: string, option: string) => {
    await page.getByRole("combobox", { name: setting, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose("Color by", "Status");
  await choose("Group nearby markers", "Off");
  await choose("Map style", "Liberty (OpenFreeMap)");
  await expect
    .poll(() => settingsParam(page))
    .toMatchObject({ colorColumn: "status", cluster: false, style: "liberty" });
  await expect(page.locator("[data-map-marker]")).toHaveCount(5);
  await expect(clusters(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Popup properties" }).click();
  await page.getByRole("checkbox", { name: "Price", exact: true }).uncheck();
  await expect
    .poll(() => settingsParam(page).popupColumns)
    .toEqual(["status", "dueDate"]);
});

test("the list beside the map follows the view and highlights markers", async ({
  page,
}) => {
  await page.goto(mapUrl({ cluster: false }));
  const list = page.getByRole("complementary", { name: "Records in view" });
  await expect(list.locator("[data-map-list-item]")).toHaveCount(5);
  await expect(list.locator("[data-map-in-view]")).toHaveText("5 in view");
  await listItem(page, "delta").hover();
  await expect(marker(page, "delta")).toHaveAttribute("data-highlighted", "");
  await marker(page, "bravo").hover();
  await expect(listItem(page, "bravo")).toHaveAttribute("data-highlighted", "");
  await list.getByRole("button", { name: "Hide list" }).click();
  await expect(list.locator("[data-map-list-item]")).toHaveCount(0);
  await page.getByRole("button", { name: "Show list" }).first().click();
  await expect(list.locator("[data-map-list-item]")).toHaveCount(5);
});

test("moving the map offers Search this area, which asks the host for that area", async ({
  page,
}) => {
  await page.goto(mapUrl({ cluster: false }));
  await expect(page.locator("[data-map-marker]")).toHaveCount(5);
  await expect(page.locator("[data-map-search-area]")).toHaveCount(0);
  const canvas = page.locator("[data-map-canvas] canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("The map canvas is not visible");
  }
  // Drag the map to the east: the western sites leave the view.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 420, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  const before = (await demoScopes(page)).length;
  await page.locator("[data-map-search-area]").click();
  await expect
    .poll(async () => (await demoScopes(page)).slice(before).at(-1))
    .toMatchObject({ kind: "bbox", field: "site" });
  const scope = (await demoScopes(page)).at(-1) as Record<string, number>;
  expect(scope.west).toBeLessThan(scope.east);
  expect(scope.south).toBeLessThan(scope.north);
  // The demo host filters by area and says so.
  await expect(page.locator("[data-map-view]")).toHaveAttribute(
    "data-map-scope",
    "server"
  );
  await expect(page.locator("[data-map-search-area]")).toHaveCount(0);
  await expect(page.locator("[data-map-marker]")).not.toHaveCount(5);
});

test("the location editor suggests places from the host's geocoder", async ({
  page,
}) => {
  await page.goto("/?example=views");
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
  const row = page.getByRole("row", { name: ECHO });
  // Echo has no site yet: its cell is the last empty one. Enter edits it.
  await row
    .getByRole("cell")
    .filter({ hasText: "—" })
    .last()
    .locator("button, [tabindex='0']")
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("group", { name: "Site" });
  await editor.getByRole("textbox", { name: "Search an address" }).fill("toul");
  await editor.getByRole("button", { name: TOULOUSE }).click();
  await expect(editor.getByRole("textbox", { name: "Latitude" })).toHaveValue(
    "43.6047"
  );
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(row.locator("[data-location-cell]")).toHaveText("Toulouse lab");
  // The Sites map view now has every project (the demo host keeps edits in memory).
  await page.getByRole("button", { name: "More views", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sites" }).click();
  await expect.poll(() => drawnRecords(page)).toBe(6);
  await expect(page.locator("[data-map-without-location]")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the map takes the width and the list is a bottom sheet", async ({
    page,
  }) => {
    await page.goto(mapUrl({ cluster: false }));
    const list = page.locator("[data-map-list]");
    await expect(list).toHaveAttribute("data-open", "false");
    await expect(list).toHaveCSS("position", "absolute");
    await list.getByRole("button", { name: "Show list" }).click();
    await expect(list).toHaveAttribute("data-open", "true");
    await expect(list.locator("[data-map-list-item]")).toHaveCount(5);
  });
});
