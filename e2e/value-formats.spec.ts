import { expect, type Page, test } from "@playwright/test";

/**
 * The format matrix (`examples/value-formats.ts`) in both editions, in
 * English and French: a format set on a field applies wherever the field
 * shows — cells, footers, group headings, cards, calendar events, charts,
 * the feed, the record view, form answers, exports and dashboards.
 */

// Paris times must not depend on the browser's own zone.
test.use({ timezoneId: "America/New_York" });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-12T10:00:00Z"));
});

const LOCALES = {
  en: {
    query: "",
    intl: "en-US",
    amount: "€2,499.00",
    draftAmount: "€1,200.50",
    activeTotal: "€2,849.00",
    total: "€4,049.50",
    progress: "45%",
    weight: "12.5 kg",
    reach: "1.3M",
    typed: "€1,234.50",
    score: "≈ 1 234.5 pts",
    scoreTotal: "≈ 1 329.8 pts",
  },
  fr: {
    query: "&locale=fr",
    intl: "fr-FR",
    amount: "2 499,00 €",
    draftAmount: "1 200,50 €",
    activeTotal: "2 849,00 €",
    total: "4 049,50 €",
    progress: "45 %",
    weight: "12,5 kg",
    reach: "1,3 M",
    typed: "1 234,50 €",
    score: "≈ 1 234,5 pts",
    scoreTotal: "≈ 1 329,8 pts",
  },
} as const;

/** The Due pattern, in Paris time: 22:30 UTC on Sep 5 is Sep 6 there. */
const DUE = "06/09/2026 00:30";
const LAST_DUE = "15/09/2026 14:00";
const SHOW_TABLE = /^(Show as table|Afficher en tableau)$/;
const EXPORT_ENTRY = /^Export/;
const ALPHA = "Alpha";
const WHITESPACE = /\s+/;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** Intl may join a date and a time with a narrow space: compare words. */
const spaced = (text: string) =>
  new RegExp(
    text
      .split(WHITESPACE)
      .map((word) => word.replace(REGEX_SPECIALS, "\\$&"))
      .join("\\s*")
  );

/** The Updated column (dateTime preset, Paris, 24-hour clock) in `locale`. */
const updatedText = (page: Page, locale: string) =>
  page.evaluate(
    (intl) =>
      new Intl.DateTimeFormat(intl, {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
        timeZone: "Europe/Paris",
      }).format(new Date("2026-09-05T14:30:00Z")),
    locale
  );

const url = (query: string, params = "") =>
  `/?example=formats${query}${params}`;
const state = (key: string, value: unknown) =>
  `&formats-${key}=${encodeURIComponent(
    typeof value === "string" ? value : JSON.stringify(value)
  )}`;

for (const [name, formats] of Object.entries(LOCALES)) {
  test(`${name}: cells and footer calculations use each column's format`, async ({
    page,
  }) => {
    await page.goto(url(formats.query));
    const alpha = page.getByRole("row").filter({ hasText: ALPHA });
    for (const text of [
      formats.amount,
      formats.progress,
      formats.weight,
      formats.reach,
      DUE,
      // Prefix, suffix and separator keep their spaces.
      formats.score,
    ]) {
      await expect(alpha).toContainText(text);
    }
    await expect(alpha).toContainText(
      spaced(await updatedText(page, formats.intl))
    );
    // Sums, averages and extremes keep the column's format.
    const footer = page.locator("tfoot");
    await expect(footer).toContainText(formats.total);
    await expect(footer).toContainText(formats.progress);
    await expect(footer).toContainText(LAST_DUE);
    await expect(footer).toContainText(formats.scoreTotal);
  });

  test(`${name}: group headings and list lines read the column's format`, async ({
    page,
  }) => {
    await page.goto(url(formats.query, state("grouping", ["amount"])));
    const headings = page.locator("tbody button[aria-expanded]");
    await expect(headings.filter({ hasText: formats.amount })).toHaveCount(1);
    await expect(headings.filter({ hasText: formats.draftAmount })).toHaveCount(
      1
    );

    await page.goto(
      url(
        formats.query,
        state("display", "list") + state("grouping", ["amount"])
      )
    );
    await expect(
      page.getByRole("heading", { name: `Amount: ${formats.amount}` })
    ).toBeVisible();
    const line = page.getByRole("listitem").filter({ hasText: ALPHA });
    await expect(line).toContainText(formats.weight);
    await expect(line).toContainText(DUE);
  });

  test(`${name}: gallery and Kanban cards show formatted properties`, async ({
    page,
  }) => {
    await page.goto(url(formats.query, state("display", "gallery")));
    const main = page.locator("main");
    await expect(main).toContainText(formats.amount);
    await expect(main).toContainText(formats.progress);
    await expect(main).toContainText(DUE);

    await page.goto(url(formats.query, state("display", "kanban")));
    await expect(main).toContainText(formats.amount);
    await expect(main).toContainText(formats.draftAmount);
    await expect(main).toContainText(DUE);
  });

  test(`${name}: calendar events titled by a number column read its format`, async ({
    page,
  }) => {
    await page.goto(url(formats.query, state("display", "calendar")));
    await expect(
      page.locator(".yayaw-calendar-event", { hasText: formats.amount })
    ).toHaveCount(1);
    await expect(
      page.locator(".yayaw-calendar-event", { hasText: formats.draftAmount })
    ).toHaveCount(1);
  });

  test(`${name}: charts label amounts and due days in the columns' formats`, async ({
    page,
  }) => {
    await page.goto(
      url(
        formats.query,
        state("display", "chart") +
          state("chart", {
            type: "bar",
            xColumn: "status",
            metric: "sum",
            metricColumn: "amount",
            showDataLabels: true,
          })
      )
    );
    const chart = page.locator("section[data-chart-type]");
    await expect(
      chart.getByText(formats.activeTotal, { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: SHOW_TABLE }).click();
    const table = page.locator("[data-chart-table]");
    await expect(table).toContainText(formats.activeTotal);
    await expect(table).toContainText(formats.draftAmount);

    // Day buckets read the Due column's date part, in Paris time.
    await page.goto(
      url(
        formats.query,
        state("display", "chart") +
          state("chart", { type: "bar", xColumn: "due", bucket: "day" })
      )
    );
    await page.getByRole("button", { name: SHOW_TABLE }).click();
    await expect(page.locator("[data-chart-table]")).toContainText(
      "06/09/2026"
    );
    await expect(page.locator("[data-chart-table]")).not.toContainText(
      "05/09/2026"
    );
  });

  test(`${name}: the feed shows dates and properties in the columns' formats`, async ({
    page,
  }) => {
    await page.goto(url(formats.query, state("display", "feed")));
    const card = page.locator("[data-feed-card]", {
      has: page.locator("[data-feed-title]", { hasText: ALPHA }),
    });
    await expect(card.locator('[data-feed-property="amount"]')).toContainText(
      formats.amount
    );
    await expect(card.locator('[data-feed-property="reach"]')).toContainText(
      formats.reach
    );
    await expect(card.locator('[data-feed-property="due"]')).toContainText(DUE);
    await expect(card.locator("time[data-feed-date]")).toHaveText(
      spaced(await updatedText(page, formats.intl))
    );
  });

  test(`${name}: the record view shows every field in its format`, async ({
    page,
  }) => {
    await page.goto(url(formats.query));
    await page.getByRole("cell", { name: ALPHA, exact: true }).click();
    const details = page.getByRole("dialog");
    for (const text of [
      formats.amount,
      formats.progress,
      formats.weight,
      formats.reach,
      DUE,
      formats.score,
    ]) {
      await expect(details).toContainText(text);
    }
    await expect(details).toContainText(
      spaced(await updatedText(page, formats.intl))
    );
  });

  test(`${name}: a form answer shows the column's number format once typed`, async ({
    page,
  }) => {
    await page.goto(url(formats.query, state("display", "form")));
    const form = page.locator("[data-yayaw-form]");
    const amount = form.getByRole("textbox", { name: "Amount" });
    await amount.fill("1234.5");
    await form.getByRole("textbox", { name: "Name" }).focus();
    await expect(amount).toHaveValue(spaced(formats.typed));
  });

  test(`${name}: dashboard numbers and date chips read the columns' formats`, async ({
    page,
  }) => {
    await page.goto(`/?example=formats-dashboard${formats.query}`);
    const figure = (id: string) =>
      page.locator(`[data-dashboard-widget="${id}"] [data-chart-number]`);
    await expect(figure("amount-total")).toHaveText(spaced(formats.total));
    await expect(figure("progress-average")).toHaveText(
      spaced(formats.progress)
    );
    // Counts stay plain numbers.
    await expect(figure("records")).toHaveText("3");
    await expect(
      page.locator('[data-dashboard-filter="due"] [data-filter-value]')
    ).toHaveText(spaced("01/09/2026 – 30/09/2026"));
  });
}

test("the export as displayed writes each column's format", async ({
  page,
}) => {
  await page.goto(url(""));
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: EXPORT_ENTRY }).first().click();
  const panel = page.locator("[data-export-panel]");
  await expect(panel).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain(`Alpha,Active,"€2,499.00",45%,12.5 kg,1.3M,${DUE}`);
  expect(csv).toContain(",≈ 1 234.5 pts");
});
