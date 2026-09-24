import { expect, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=views";
const SETTINGS_PARAM = "views-feed";
const CARD_SETTINGS = /^card settings/i;
const FEED_MODE = /^feed$/i;
const RELATIVE_DATE = /ago|now/;
const ALPHA = "Alpha launch";
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

const cards = (page: Page) => page.locator("[data-feed-card]");
const card = (page: Page, title: string) =>
  cards(page).filter({
    has: page.locator("[data-feed-title]", { hasText: title }),
  });
const titles = (page: Page) =>
  page.locator("[data-feed-card] [data-feed-title]").allInnerTexts();
const settingsParam = (page: Page) =>
  JSON.parse(new URL(page.url()).searchParams.get(SETTINGS_PARAM) ?? "{}");

/** The example's "Updates" view is under "More" (three tabs show). */
const openUpdates = async (page: Page) => {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Updates" }).click();
  await expect(cards(page).first()).toBeVisible();
};

const openFeedSettings = async (page: Page) => {
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("button", { name: CARD_SETTINGS }).click();
  return menu;
};

test.beforeEach(async ({ page }) => {
  await page.goto(EXAMPLE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(EXAMPLE);
  await expect(page.getByText(ALPHA).first()).toBeVisible();
});

test("the display mode picker switches to the feed", async ({ page }) => {
  await page.getByRole("button", { name: "View settings" }).click();
  const menu = page.getByRole("dialog", { name: "View settings" });
  await menu.getByRole("combobox", { name: "Display mode" }).click();
  await page.getByRole("option", { name: FEED_MODE }).click();
  await expect(cards(page).first()).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("views-display"))
    .toBe("feed");
  // Without a sort of its own the feed shows the newest posts first.
  expect((await titles(page)).slice(0, 3)).toEqual([
    ALPHA,
    "Bravo audit",
    "Charlie display",
  ]);
});

test("the Updates view shows posts with author, date, body and properties", async ({
  page,
}) => {
  await openUpdates(page);
  await expect(cards(page)).toHaveCount(3);
  const alpha = card(page, ALPHA);
  await expect(alpha.locator("[data-feed-author]")).toContainText("Ada Martin");
  const date = alpha.locator("time[data-feed-date]");
  await expect(date).toHaveText(RELATIVE_DATE);
  await expect(date).toHaveAttribute("datetime", ISO_INSTANT);
  // The full date is on hover.
  expect((await date.getAttribute("title"))?.length ?? 0).toBeGreaterThan(8);
  await expect(alpha.locator("[data-feed-body]")).toContainText(
    "Alpha is live"
  );
  await expect(
    alpha.locator('[data-feed-property="status"] .yayaw-tag')
  ).toHaveText("Active");
  await expect(
    alpha.locator('[data-feed-property="category"] .yayaw-tag')
  ).toHaveText("Software");
  await expect(alpha.locator('[data-feed-property="dueDate"]')).toBeVisible();
  // A short body has nothing to expand.
  await expect(
    card(page, "Bravo audit").getByRole("button", { name: "Show more" })
  ).toHaveCount(0);
});

test("long bodies expand and collapse from the keyboard", async ({ page }) => {
  await openUpdates(page);
  const alpha = card(page, ALPHA);
  const body = alpha.locator("[data-feed-body]");
  const toggle = alpha.getByRole("button", { name: "Show more" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const clamped = (await body.boundingBox())?.height ?? 0;
  await toggle.focus();
  await page.keyboard.press("Enter");
  const less = alpha.getByRole("button", { name: "Show less" });
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await expect(body).toHaveAttribute("data-expanded", "true");
  expect((await body.boundingBox())?.height ?? 0).toBeGreaterThan(clamped);
  await page.keyboard.press("Space");
  await expect(
    alpha.getByRole("button", { name: "Show more" })
  ).toHaveAttribute("aria-expanded", "false");
});

test("Load more fetches the next page", async ({ page }) => {
  await openUpdates(page);
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(cards(page)).toHaveCount(6);
  expect(await titles(page)).toEqual([
    ALPHA,
    "Bravo audit",
    "Charlie display",
    "Delta support",
    "Echo sensors",
    "Foxtrot portal",
  ]);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  // The button left with the last page: focus moved to the first new post.
  await expect(
    page.locator("[data-feed-title]", { hasText: "Delta support" })
  ).toBeFocused();
  await expect(page.locator("[data-feed-end]")).toHaveText(
    "You're all caught up"
  );
});

test("clicking a title opens the record view", async ({ page }) => {
  await openUpdates(page);
  await page
    .locator("[data-feed-title]", { hasText: "Charlie display" })
    .click();
  await expect(page.getByText("Activity").first()).toBeVisible();
});

test("settings change the body column and are saved in the URL", async ({
  page,
}) => {
  await openUpdates(page);
  await openFeedSettings(page);
  await page.getByRole("combobox", { name: "Body", exact: true }).click();
  await page.getByRole("option", { name: "None", exact: true }).click();
  await expect.poll(() => settingsParam(page).bodyColumn).toBeNull();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-feed-body]")).toHaveCount(0);
  await openFeedSettings(page);
  await page.getByRole("combobox", { name: "Body", exact: true }).click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await expect.poll(() => settingsParam(page).bodyColumn).toBe("name");
  await page.keyboard.press("Escape");
  await expect(card(page, ALPHA).locator("[data-feed-body]")).toHaveText(ALPHA);
});

test("grouped feeds show a header per group", async ({ page }) => {
  await page.goto(
    `${EXAMPLE}&views-display=feed&views-grouping=${encodeURIComponent(JSON.stringify(["status"]))}`
  );
  await expect(page.locator("[data-feed-section]").first()).toBeVisible();
  await expect(page.locator("[data-feed-section] h2").first()).toContainText(
    "Active"
  );
});

test("on a phone the posts take the full width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Phones list saved views in a menu, not as tabs: open the feed by its link.
  await page.goto(`${EXAMPLE}&views-display=feed`);
  await expect(cards(page).first()).toBeVisible();
  const box = await cards(page).first().boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("on a wide screen the column stays narrow and centered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openUpdates(page);
  const box = await cards(page).first().boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(720);
});

test("infinite scroll loads pages while the end is within a screen, then stops", async ({
  page,
}) => {
  // On by default: two posts per page leave the end in reach, so the next
  // pages load on their own until the last one.
  const settings = encodeURIComponent(JSON.stringify({ pageSize: 2 }));
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto(
    `${EXAMPLE}&views-display=feed&${SETTINGS_PARAM}=${settings}`
  );
  await expect(cards(page)).toHaveCount(6);
  await expect(page.locator("[data-feed-end]")).toHaveText(
    "You're all caught up"
  );
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  await expect(page.locator("[data-feed-status]")).toContainText(
    "You're all caught up."
  );
});

test("both editions draw cards with the same measures", async ({ page }) => {
  // Same width as the other feed tests: narrower, the view tabs fold into
  // the views menu on CI fonts and "More" disappears.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openUpdates(page);
  const styles = await cards(page)
    .first()
    .evaluate((element) => {
      const card = getComputedStyle(element);
      const title = element.querySelector("[data-feed-title]");
      const body = element.querySelector("[data-feed-body]");
      return {
        padding: card.paddingTop,
        gap: card.rowGap,
        borderWidth: card.borderTopWidth,
        titleSize: title ? getComputedStyle(title).fontSize : "",
        titleWeight: title ? getComputedStyle(title).fontWeight : "",
        bodySize: body ? getComputedStyle(body).fontSize : "",
      };
    });
  expect(styles).toEqual({
    padding: "20px",
    gap: "12px",
    borderWidth: "1px",
    titleSize: "16px",
    titleWeight: "600",
    bodySize: "14px",
  });
});
