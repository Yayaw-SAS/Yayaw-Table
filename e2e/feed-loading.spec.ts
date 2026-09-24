import { expect, type Locator, type Page, test } from "@playwright/test";

const EXAMPLE = "/?example=feed";
const SETTINGS_PARAM = "news-feed";
const UPDATE_NUMBER = /^Update (\d+)/;
const FEED_VIEW_MODULE = /\/feed\/(feed-view\.tsx|FeedView\.vue)$/;
const PICSUM = /picsum/;
/** A 1×1 PNG: the demo's photos and poster come from picsum.photos. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const cards = (page: Page) => page.locator("[data-feed-card]");
const post = (page: Page, id: string) =>
  page.locator(`[data-feed-card][data-row-id="${id}"]`);
const loadMore = (page: Page) => page.locator("[data-feed-load-more]");
const withSettings = (settings: Record<string, unknown>) =>
  `${EXAMPLE}&${SETTINGS_PARAM}=${encodeURIComponent(JSON.stringify(settings))}`;

/** The pages the feed asked the demo host for (the table asks 25 per page). */
const feedPages = (page: Page, pageSize = 10) =>
  page.evaluate(
    (size) =>
      (
        (
          globalThis as {
            yayawDemoFeedRequests?: { page: number; pageSize: number }[];
          }
        ).yayawDemoFeedRequests ?? []
      )
        .filter((request) => request.pageSize === size)
        .map((request) => request.page),
    pageSize
  );

/**
 * Hidden from sight but not from assistive technology: clipped to nothing
 * (`clip` in the Vue styles, `clip-path` in Tailwind 4's `sr-only`).
 */
const visuallyHidden = (locator: Locator) =>
  locator.evaluate((element) => {
    let node: Element | null = element;
    while (node) {
      const style = getComputedStyle(node);
      if (
        style.clip === "rect(0px, 0px, 0px, 0px)" ||
        style.clipPath === "inset(50%)"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  });

const scrollToEnd = (page: Page) =>
  page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
const scrollToTop = (page: Page) => page.evaluate(() => window.scrollTo(0, 0));

/** Scroll down until the feed says it is complete, and stay at its end. */
const loadAll = async (page: Page) => {
  await expect(async () => {
    await scrollToEnd(page);
    await expect(page.locator("[data-feed-end]")).toBeInViewport({
      timeout: 500,
    });
  }).toPass({ timeout: 30_000 });
};

test.beforeEach(async ({ context, page }) => {
  // Offline media: a pixel for the photos and poster; the video never loads.
  await context.route("https://picsum.photos/**", (route) =>
    route.fulfill({ body: PIXEL, contentType: "image/png" })
  );
  await context.route(
    "https://interactive-examples.mdn.mozilla.net/**",
    (route) => route.fulfill({ status: 404 })
  );
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("scrolling loads the next pages on its own, one request at a time", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await expect(cards(page)).toHaveCount(10);
  await expect.poll(() => feedPages(page)).toEqual([1]);
  // The feed pages itself: the table's pagination is not shown.
  await expect(page.getByText("Rows per page")).toHaveCount(0);
  // The button stays for the keyboard, out of sight while scrolling loads pages.
  await expect(loadMore(page)).toHaveAttribute("data-quiet", "");
  for (const expected of [2, 3, 4]) {
    await scrollToEnd(page);
    await expect.poll(() => feedPages(page)).toContain(expected);
  }
  const pages = await feedPages(page);
  // Each page once, in order: never two requests for the same page.
  expect(pages).toEqual(pages.map((_, index) => index + 1));
  await expect(cards(page)).toHaveCount(pages.length * 10);
  const status = page.locator("[data-feed-status]");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toContainText(`${pages.length * 10} shown`);
});

test("the keyboard reaches Load more, which shows when focused", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await expect(cards(page).first()).toBeVisible();
  const button = loadMore(page);
  await expect(button).toHaveAttribute("data-quiet", "");
  expect(await visuallyHidden(button)).toBe(true);
  await button.focus();
  await expect(button).toBeFocused();
  expect(await visuallyHidden(button)).toBe(false);
  expect((await button.boundingBox())?.width ?? 0).toBeGreaterThan(40);
});

test("without IntersectionObserver, Load more shows and loads the next page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "IntersectionObserver");
  });
  await page.goto(EXAMPLE);
  await expect(cards(page)).toHaveCount(10);
  const button = page.getByRole("button", { name: "Load more" });
  await expect(button).not.toHaveAttribute("data-quiet");
  expect((await button.boundingBox())?.width ?? 0).toBeGreaterThan(40);
  // Nothing loads by scrolling.
  await scrollToEnd(page);
  await page.waitForTimeout(300);
  expect(await feedPages(page)).toEqual([1]);
  await button.click();
  await expect(cards(page)).toHaveCount(20);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(cards(page)).toHaveCount(30);
  expect(await feedPages(page)).toEqual([1, 2, 3]);
});

test("with loading on scroll off in the view, pages load with the button", async ({
  page,
}) => {
  await page.goto(withSettings({ infiniteScroll: false }));
  await expect(cards(page)).toHaveCount(10);
  const button = page.getByRole("button", { name: "Load more" });
  await expect(button).not.toHaveAttribute("data-quiet");
  await scrollToEnd(page);
  await page.waitForTimeout(300);
  expect(await feedPages(page)).toEqual([1]);
  await button.click();
  await expect(cards(page)).toHaveCount(20);
});

test("images load lazily in boxes of a fixed ratio; videos show their poster only", async ({
  page,
}) => {
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("flower.mp4")) {
      videoRequests.push(request.url());
    }
  });
  await page.goto(EXAMPLE);
  await expect(cards(page).first()).toBeVisible();
  const images = page.locator("[data-feed-media] img");
  await expect(images.first()).toBeVisible();
  const attributes = await images.evaluateAll((items) =>
    items.map((item) => ({
      loading: item.getAttribute("loading"),
      decoding: item.getAttribute("decoding"),
      width: item.getAttribute("width"),
      height: item.getAttribute("height"),
    }))
  );
  expect(attributes.length).toBeGreaterThan(1);
  for (const item of attributes) {
    expect(item).toMatchObject({
      loading: "lazy",
      decoding: "async",
      width: "720",
    });
    expect(["360", "450"]).toContain(item.height);
  }
  // A single photo keeps a 16:10 box, whatever the file's own size.
  const box = await post(page, "post-001")
    .locator("[data-feed-media] img")
    .boundingBox();
  expect(
    Math.abs((box?.height ?? 0) - ((box?.width ?? 0) * 10) / 16)
  ).toBeLessThan(2);
  const video = post(page, "post-002").locator("[data-feed-video]");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("poster", PICSUM);
  await expect(video).toHaveAttribute(
    "aria-label",
    "Flowers opening, a time-lapse"
  );
  await page.waitForTimeout(300);
  expect(videoRequests).toEqual([]);
});

test("a long feed renders a bounded number of posts, in order", async ({
  page,
}) => {
  await page.goto(withSettings({ pageSize: 20 }));
  await expect(cards(page).first()).toBeVisible();
  await loadAll(page);
  expect(await feedPages(page, 20)).toEqual([1, 2, 3, 4, 5, 6]);
  await expect(page.locator("[data-feed-view][data-windowed]")).toHaveCount(1);
  // Every post keeps its place: a card, or a placeholder of its height.
  await expect(page.locator("[data-feed-item]")).toHaveCount(120);
  const rendered = await cards(page).count();
  expect(rendered).toBeGreaterThan(2);
  expect(rendered).toBeLessThanOrEqual(40);
  const positions = await cards(page).evaluateAll((items) =>
    items.map((item) => Number(item.getAttribute("aria-posinset")))
  );
  const first = positions.at(0) ?? 0;
  expect(positions).toEqual(positions.map((_, index) => first + index));
  expect(positions.at(-1)).toBe(120);
  await expect(cards(page).first()).toHaveAttribute("aria-setsize", "120");
  const titles = await page
    .locator("[data-feed-card] [data-feed-title]")
    .allInnerTexts();
  expect(titles.map((title) => Number(UPDATE_NUMBER.exec(title)?.[1]))).toEqual(
    positions
  );
  await expect(page.locator("[data-feed-status]")).toContainText(
    "You're all caught up."
  );
  // Back at the top, the first posts render again.
  await scrollToTop(page);
  await expect(post(page, "post-001")).toHaveAttribute("aria-posinset", "1");
  expect(await cards(page).count()).toBeLessThanOrEqual(40);
});

test("an expanded post keeps focus and its state while windowed out", async ({
  page,
}) => {
  await page.goto(withSettings({ pageSize: 20 }));
  const first = post(page, "post-001");
  await first.getByRole("button", { name: "Show more" }).click();
  await expect(first.locator("[data-feed-body]")).toHaveAttribute(
    "data-expanded",
    "true"
  );
  const height = (await first.boundingBox())?.height ?? 0;
  await loadAll(page);
  // The post holding focus stays rendered, far from the screen.
  await expect(first).toHaveCount(1);
  await expect(first.getByRole("button", { name: "Show less" })).toBeFocused();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.mouse.wheel(0, -200);
  const placeholder = page.locator(
    '[data-feed-placeholder][data-row-id="post-001"]'
  );
  await expect(placeholder).toHaveCount(1);
  await expect(first).toHaveCount(0);
  // It keeps the height the post had, expanded.
  expect(
    Math.abs(((await placeholder.boundingBox())?.height ?? 0) - height)
  ).toBeLessThan(2);
  await scrollToTop(page);
  await expect(first.locator("[data-feed-body]")).toHaveAttribute(
    "data-expanded",
    "true"
  );
  await expect(
    first.getByRole("button", { name: "Show less" })
  ).toHaveAttribute("aria-expanded", "true");
});

test("a page that fails shows Retry, which loads it again", async ({
  page,
}) => {
  await page.goto(`${EXAMPLE}&fail-page=2`);
  await expect(cards(page)).toHaveCount(10);
  await scrollToEnd(page);
  const footer = page.locator("[data-feed-footer]");
  await expect(footer.getByRole("alert")).toHaveText(
    "More posts could not be loaded."
  );
  const retry = footer.getByRole("button", { name: "Retry" });
  await expect(retry).not.toHaveAttribute("data-quiet");
  // Loading on scroll waits for the retry.
  await scrollToEnd(page);
  await page.waitForTimeout(300);
  expect(await feedPages(page)).toEqual([1, 2]);
  await expect(cards(page)).toHaveCount(10);
  await retry.click();
  await expect(post(page, "post-020")).toHaveCount(1);
  expect((await feedPages(page)).slice(0, 3)).toEqual([1, 2, 2]);
  await expect(footer.getByRole("alert")).toHaveCount(0);
});

test("with reduced motion, the loading states do not animate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // A slow host, so the skeleton and the spinner stay long enough to check.
  await page.goto(`${EXAMPLE}&delay=1500`);
  const line = page.locator("[data-feed-skeleton] > * > *").first();
  await expect(line).toBeVisible();
  expect(
    await line.evaluate((item) => getComputedStyle(item).animationName)
  ).toBe("none");
  await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
  await scrollToEnd(page);
  const spinner = loadMore(page).locator("svg");
  await expect(spinner).toBeVisible();
  await expect(loadMore(page)).toHaveText("Loading more…");
  expect(
    await spinner.evaluate((item) => getComputedStyle(item).animationName)
  ).toBe("none");
});

test("the feed's code loads with the first feed shown", async ({ page }) => {
  const modules: string[] = [];
  page.on("request", (request) => {
    modules.push(new URL(request.url()).pathname);
  });
  await page.goto("/?example=views");
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
  expect(modules.filter((path) => FEED_VIEW_MODULE.test(path))).toEqual([]);
  await page.goto("/?example=views&views-display=feed");
  await expect(cards(page).first()).toBeVisible();
  expect(
    modules.filter((path) => FEED_VIEW_MODULE.test(path)).length
  ).toBeGreaterThan(0);
});
