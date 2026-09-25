import { expect, type Page, test } from "@playwright/test";
import { demoDay } from "../examples/dashboard";
import {
  ANALYTICS_NOTICE,
  contentAdminScreen,
  mediaColumns,
  screenMediaRows,
  screenPageRows,
} from "../examples/screen";
import { formatNumberValue } from "../src/components/ui/yayaw-table/utils/value-format";
import { nextWidgetId } from "../src/components/ui/yayaw-table-dashboard/dashboard-schema";

const SCREEN = "/?example=screen";
/** The demo host's saved dashboards, in the tab's session storage. */
const STORAGE_KEY = "yayaw-demo-dashboards-v2";
const SCREEN_VIEW = "screen:content-admin:pages-table";
const NEXT_PAGE = /next/i;
/** React confirms a bulk deletion with "Confirm", Vue with "Delete". */
const CONFIRM_DELETE = /^(Delete|Confirm)$/;
const FAVORITE = /Use this view on arrival/;
const PAGES = screenPageRows();
const MEDIA = screenMediaRows();
/** The id the editor gives the first widget added to the demo screen. */
const NEW_WIDGET = nextWidgetId(contentAdminScreen.widgets);
const count = (status: string, pages = PAGES) =>
  pages.filter((page) => page.status === status).length;
const SIZE_FORMAT = mediaColumns.find(
  (column) => column.id === "size"
)?.numberFormat;
/** The storage number: what the media outside the trash take, in the size column's format. */
const storage = () =>
  formatNumberValue(
    MEDIA.filter((item) => !item.trashed).reduce(
      (sum, item) => sum + item.size,
      0
    ),
    SIZE_FORMAT,
    "en"
  );

interface LoggedRequest {
  tableId: string;
  action: "list" | "aggregate";
  params: {
    page?: number;
    requiredFilters?: {
      columnId: string;
      operator: string;
      values: string[];
    }[];
  };
}

const widget = (page: Page, id: string) =>
  page.locator(`[data-dashboard-widget="${id}"]`);
const item = (page: Page, id: string) =>
  page.locator(`[data-dashboard-item="${id}"]`);
const figure = (page: Page, id: string) =>
  widget(page, id).locator("[data-kpi-value]");
const pageTable = (page: Page) => page.locator('[data-page-table="pages"]');
const requests = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as { yayawDashboardRequests?: LoggedRequest[] })
        .yayawDashboardRequests ?? []
  );
const clearRequests = (page: Page) =>
  page.evaluate(() => {
    (
      globalThis as { yayawDashboardRequests?: unknown[] }
    ).yayawDashboardRequests = [];
  });
const sourceLoads = (page: Page) =>
  page.evaluate(
    () =>
      (globalThis as { yayawScreenSourceLoads?: string[] })
        .yayawScreenSourceLoads ?? []
  );
const saveDashboards = (page: Page, dashboards: readonly unknown[]) =>
  page.addInitScript(
    ([key, saved]) => {
      if (!sessionStorage.getItem("screen-test-seeded")) {
        sessionStorage.setItem("screen-test-seeded", "1");
        sessionStorage.setItem(
          key,
          JSON.stringify(
            Object.fromEntries(
              (saved as { id: string }[]).map((entry) => [entry.id, entry])
            )
          )
        );
      }
    },
    [STORAGE_KEY, dashboards] as const
  );
const savedDashboards = (page: Page) =>
  page.evaluate(
    (key) =>
      JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<
        string,
        Record<string, unknown>
      >,
    STORAGE_KEY
  );
const toolbar = (page: Page) => page.locator("[data-dashboard] > header");
const searchParam = (page: Page, key: string) =>
  new URL(page.url()).searchParams.get(key);
/** The pages as the page table sorts them: the newest first (ties in the host's order). */
const NEWEST_FIRST = [...PAGES].sort((a, b) =>
  b.updatedAt.localeCompare(a.updatedAt)
);
/** A list page link's sort: by title. */
const BY_TITLE = JSON.stringify([{ id: "title", desc: false }]);
const ALPHABETICAL = PAGES.map((entry) => entry.title).sort((a, b) =>
  a.localeCompare(b)
);
const ready = async (page: Page) => {
  await expect(figure(page, "published")).toHaveText(
    String(count("published"))
  );
  await expect(pageTable(page).locator("[data-row-id]").first()).toBeVisible();
};

test("sections render and the numbers follow the demo's data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await expect(
    page.getByRole("heading", { name: "Content admin", level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Overview", level: 3 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pages", level: 3 })
  ).toBeVisible();
  await expect(
    page.locator('[data-dashboard-section="overview"]')
  ).toHaveAttribute("data-section-type", "grid");
  await expect(
    page.locator('[data-dashboard-section="pages"]')
  ).toHaveAttribute("data-section-type", "flow");
  // Numbers over inline views, under the section title (h4).
  await ready(page);
  await expect(figure(page, "drafts")).toHaveText(String(count("draft")));
  await expect(figure(page, "storage")).toHaveText(storage());
  await expect(
    widget(page, "published").getByRole("heading", { level: 4 })
  ).toHaveText("Published pages");
  // A gallery of recent uploads, trimmed to its card with "+N more".
  const uploads = widget(page, "uploads");
  await expect(uploads.locator("[data-row-id]").first()).toBeVisible();
  await expect(uploads.locator("[data-widget-more]")).toContainText("more");
  // The full-page table: no card, the list page's toolbar and rows.
  const table = widget(page, "pages-table");
  await expect(table).toHaveAttribute("data-widget-frame", "page");
  await expect(table).toHaveAttribute("aria-label", "Pages");
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(10);
  // The host wraps it (`renderTable`).
  await expect(page.locator("[data-host-table]")).toHaveCount(1);
});

test("only the sources the screen shows are loaded", async ({ page }) => {
  await page.goto(SCREEN);
  await ready(page);
  await expect(widget(page, "audit")).toContainText("have access");
  // Ten sources in the catalogue; the screen reads three, each loaded once.
  expect(await sourceLoads(page)).toEqual(["pages", "media", "audit"]);
  // Editing loads nothing more: the widget picker lists the loaded ones.
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(
    toolbar(page).getByRole("button", { name: "Done" })
  ).toBeVisible();
  expect(await sourceLoads(page)).toEqual(["pages", "media", "audit"]);
});

test("unavailable widgets show a notice; ?hide leaves them out and closes the gap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  const audit = widget(page, "audit");
  await expect(
    audit.locator('[data-widget-state="unavailable"]')
  ).toHaveAttribute("data-widget-reason", "forbidden");
  await expect(audit).toContainText("You don’t have access to this data.");
  // No "Open full view" on a widget that cannot show.
  await expect(
    audit.getByRole("button", { name: "Open full view" })
  ).toHaveCount(0);
  await expect(item(page, "attention")).toHaveAttribute(
    "data-layout",
    "3,1,1,2"
  );

  await page.goto(`${SCREEN}&hide`);
  await ready(page);
  await expect(widget(page, "audit")).toHaveCount(0);
  // The widget under it rises into its place, for display only.
  await expect(item(page, "attention")).toHaveAttribute(
    "data-layout",
    "3,0,1,2"
  );
  // Editing shows it again, removable; saving keeps it where it was.
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(widget(page, "audit")).toBeVisible();
  await expect(
    widget(page, "audit").getByRole("button", {
      name: "Widget options for Audit events",
    })
  ).toBeVisible();
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  const saved = (await savedDashboards(page))["content-admin"];
  const overview = (
    saved?.sections as { id: string; layout?: { widgetId: string }[] }[]
  ).find((section) => section.id === "overview");
  expect(overview?.layout).toEqual(contentAdminScreen.sections[0]?.layout);
  expect(
    (saved?.widgets as { id: string }[]).map((entry) => entry.id)
  ).toContain("audit");
});

test("the page table keeps its URL state and saved views; the screen's view is its default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  // The screen's first table uses the list page's own keys; its inline
  // view is the default the reader arrives on.
  await expect.poll(() => searchParam(page, "view")).toBe(SCREEN_VIEW);
  const rows = pageTable(page).locator("[data-row-id]");
  await expect(rows.first()).toContainText(NEWEST_FIRST[0]?.title ?? "");
  await pageTable(page)
    .getByRole("button", { name: NEXT_PAGE })
    .first()
    .click();
  await expect.poll(() => searchParam(page, "pages-page")).toBe("1");
  await expect(rows.first()).toContainText(NEWEST_FIRST[10]?.title ?? "");
  // A list page link keeps working: its state wins over the screen's view,
  // and a reload keeps it.
  await page.goto(`${SCREEN}&pages-sort=${encodeURIComponent(BY_TITLE)}`);
  await expect(rows.first()).toContainText(ALPHABETICAL[0] ?? "");
  await page.reload();
  await expect(rows.first()).toContainText(ALPHABETICAL[0] ?? "");
  expect(searchParam(page, "pages-sort")).toBe(BY_TITLE);
  // A saved view of the source, kept in the URL.
  await page.goto(`${SCREEN}&view=drafts`);
  await expect(figure(page, "drafts")).toHaveText(String(count("draft")));
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    count("draft")
  );
  await page.reload();
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    count("draft")
  );
  expect(searchParam(page, "view")).toBe("drafts");
  // The reader's favorite view comes before the screen's.
  await pageTable(page).getByRole("button", { name: "View actions" }).click();
  await page.getByRole("button", { name: FAVORITE }).click();
  await page.goto(SCREEN);
  await expect.poll(() => searchParam(page, "view")).toBe("drafts");
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    count("draft")
  );
});

test("screen filters reach the table and the numbers as requiredFilters, and stay in the URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  await clearRequests(page);
  // The author filter: every pages request carries it.
  await page
    .locator('[data-dashboard-filter="author"] [data-filter-trigger]')
    .click();
  await page
    .locator('[data-dashboard-filter-popup="author"]')
    .getByRole("checkbox", { name: "Ada Martin", exact: true })
    .check();
  await page.keyboard.press("Escape");
  const ada = PAGES.filter((entry) => entry.author === "Ada Martin");
  await expect(figure(page, "published")).toHaveText(
    String(count("published", ada))
  );
  await expect(figure(page, "drafts")).toHaveText(String(count("draft", ada)));
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    ada.length
  );
  const logged = await requests(page);
  const byAuthor = (entry: LoggedRequest) =>
    entry.tableId === "pages" &&
    entry.params.requiredFilters?.some(
      (rule) =>
        rule.columnId === "author" &&
        JSON.stringify(rule.values) === JSON.stringify(["Ada Martin"])
    );
  expect(
    logged.some((entry) => entry.action === "list" && byAuthor(entry))
  ).toBe(true);
  expect(
    logged.some((entry) => entry.action === "aggregate" && byAuthor(entry))
  ).toBe(true);
  // Media widgets are not the author filter's target.
  expect(
    logged.some(
      (entry) =>
        entry.tableId === "media" &&
        entry.params.requiredFilters?.some((rule) => rule.columnId === "author")
    )
  ).toBe(false);
  expect(searchParam(page, "content-admin.author")).toBe("Ada Martin");

  // A relative period: the last 7 days, resolved in the reader's day.
  await clearRequests(page);
  await page
    .locator('[data-dashboard-filter="period"] [data-filter-trigger]')
    .click();
  await page.locator('[data-filter-preset="last7Days"]').click();
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-dashboard-filter="period"] [data-filter-value]')
  ).toHaveText("Last 7 days");
  const week = ada.filter(
    (entry) => entry.updatedAt >= demoDay(-6) && entry.updatedAt <= demoDay(0)
  );
  await expect(figure(page, "published")).toHaveText(
    String(count("published", week))
  );
  await expect
    .poll(async () =>
      (await requests(page)).some(
        (entry) =>
          entry.tableId === "pages" &&
          entry.action === "list" &&
          entry.params.requiredFilters?.some(
            (rule) =>
              rule.columnId === "updatedAt" &&
              rule.operator === "between" &&
              JSON.stringify(rule.values) ===
                JSON.stringify([demoDay(-6), demoDay(0)])
          )
      )
    )
    .toBe(true);
  expect(searchParam(page, "content-admin.period")).toBe("last7Days");
  // A reload keeps the reader's values; the document never had them.
  await page.reload();
  await expect(figure(page, "published")).toHaveText(
    String(count("published", week))
  );
  await expect(
    page.locator('[data-dashboard-filter="period"] [data-filter-value]')
  ).toHaveText("Last 7 days");
  expect((await savedDashboards(page))["content-admin"]).toBeUndefined();
  // Clearing goes back to the default (no key).
  await page
    .locator('[data-dashboard-filter="period"]')
    .getByRole("button", { name: "Clear" })
    .click();
  await expect.poll(() => searchParam(page, "content-admin.period")).toBe(null);
});

test("the Sections facet list sets the section filter: the Pages table and the numbers follow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  const sections = page.locator('[data-facet-block="section"]');
  const choice = (value: string) =>
    sections.locator(`button[data-facet-value="${value}"]`);
  const counts = () =>
    sections
      .locator("button[data-facet-value]")
      .evaluateAll((buttons) =>
        Object.fromEntries(
          buttons.map((button) => [
            button.getAttribute("data-facet-value"),
            Number(button.querySelector("[data-facet-count]")?.textContent),
          ])
        )
      );
  const bySection = (pages: typeof PAGES) => {
    const result: Record<string, number> = {};
    for (const entry of pages) {
      result[entry.section] = (result[entry.section] ?? 0) + 1;
    }
    return result;
  };
  await expect.poll(counts).toEqual(bySection(PAGES));
  await expect(sections.locator("[data-facet-all]")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  // A click sets the screen filter, as the filter bar does.
  await clearRequests(page);
  await choice("marketing").click();
  await expect(choice("marketing")).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => searchParam(page, "content-admin.section"))
    .toBe("marketing");
  await expect(
    page.locator('[data-dashboard-filter="section"] [data-filter-value]')
  ).toHaveText("Marketing");
  const marketing = PAGES.filter((entry) => entry.section === "marketing");
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    marketing.length
  );
  await expect(figure(page, "published")).toHaveText(
    String(count("published", marketing))
  );
  const logged = await requests(page);
  expect(
    logged.some(
      (entry) =>
        entry.tableId === "pages" &&
        entry.action === "list" &&
        entry.params.requiredFilters?.some(
          (rule) =>
            rule.columnId === "section" &&
            rule.operator === "isAnyOf" &&
            JSON.stringify(rule.values) === JSON.stringify(["marketing"])
        )
    )
  ).toBe(true);
  // Its numbers leave its own filter out and follow the others.
  await expect.poll(counts).toEqual(bySection(PAGES));
  await page
    .locator('[data-dashboard-filter="author"] [data-filter-trigger]')
    .click();
  await page
    .locator('[data-dashboard-filter-popup="author"]')
    .getByRole("checkbox", { name: "Ada Martin", exact: true })
    .check();
  await page.keyboard.press("Escape");
  const ada = PAGES.filter((entry) => entry.author === "Ada Martin");
  await expect.poll(counts).toEqual(bySection(ada));
  // "All" clears it.
  await sections.locator("[data-facet-all]").click();
  await expect
    .poll(() => searchParam(page, "content-admin.section"))
    .toBe(null);
  await expect(pageTable(page).locator("[data-row-id]")).toHaveCount(
    Math.min(ada.length, 10)
  );
});

test("host blocks render; an unknown block is unavailable; an empty block collapses in a flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  await expect(
    widget(page, "shortcuts").locator("[data-shortcuts] a")
  ).toHaveText(["New page", "Upload media", "Site settings"]);
  await expect(
    widget(page, "shortcuts").getByRole("heading", { level: 4 })
  ).toHaveText("Shortcuts");
  const attention = widget(page, "attention").locator("[data-attention-item]");
  await expect(attention).toHaveText([
    `${count("review")} pages waiting for review`,
    `${MEDIA.filter((entry) => entry.kind === "image" && !entry.trashed && !entry.alt).length} images without alt text`,
  ]);
  // Blocks open views through the host's `openView`, with an inline view.
  await attention.first().click();
  await expect(page.locator("[data-dashboard-opened]")).toHaveText(
    "pages › default (inline)"
  );

  await saveDashboards(page, [
    {
      version: 2,
      id: "content-admin",
      name: "Blocks",
      sections: [
        {
          id: "cards",
          type: "grid",
          layout: [
            { widgetId: "empty-card", x: 0, y: 0, w: 1, h: 2 },
            { widgetId: "legacy", x: 1, y: 0, w: 1, h: 2 },
          ],
        },
        { id: "page", type: "flow", widgetIds: ["empty-flow", "notes"] },
      ],
      widgets: [
        {
          id: "empty-card",
          type: "block",
          block: "shortcuts",
          props: { links: [] },
          settings: {},
        },
        {
          id: "legacy",
          type: "block",
          block: "legacy.box",
          props: { size: 3 },
          settings: {},
        },
        {
          id: "empty-flow",
          type: "block",
          block: "shortcuts",
          props: { links: [] },
          settings: {},
        },
        { id: "notes", type: "note", settings: { text: "Below the blocks." } },
      ],
      filters: [],
    },
  ]);
  await page.reload();
  await expect(widget(page, "notes")).toContainText("Below the blocks.");
  // In a grid, a block that renders nothing stays an empty card.
  await expect(widget(page, "empty-card")).toBeVisible();
  await expect(
    widget(page, "empty-card").locator("[data-block-content]")
  ).toBeEmpty();
  // In a flow it collapses, until the screen is edited.
  await expect(item(page, "empty-flow")).toBeHidden();
  await expect(widget(page, "legacy")).toContainText("Unavailable block");
  await expect(
    widget(page, "legacy").locator('[data-widget-state="unknownBlock"]')
  ).toHaveCount(1);
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(item(page, "empty-flow")).toBeVisible();
});

test("a change in the page table reloads the numbers; Refresh all asks again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  // The newest pages first: select two published ones and delete them.
  const published = NEWEST_FIRST.filter(
    (entry) => entry.status === "published"
  ).slice(0, 2);
  for (const entry of published) {
    await pageTable(page)
      .locator(`[data-row-id="${entry.id}"]`)
      .getByRole("checkbox")
      .click();
  }
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .or(page.getByRole("dialog"))
    .getByRole("button", { name: CONFIRM_DELETE })
    .click();
  await expect(figure(page, "published")).toHaveText(
    String(count("published") - 2)
  );
  await expect(figure(page, "drafts")).toHaveText(String(count("draft")));

  // "Refresh all": the page table and the numbers ask the host again.
  await clearRequests(page);
  await toolbar(page).getByRole("button", { name: "Refresh all" }).click();
  await expect
    .poll(async () =>
      (await requests(page)).some(
        (entry) => entry.tableId === "pages" && entry.action === "list"
      )
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await requests(page)).some(
        (entry) => entry.tableId === "pages" && entry.action === "aggregate"
      )
    )
    .toBe(true);
  await expect(figure(page, "published")).toHaveText(
    String(count("published") - 2)
  );
});

test("a hostile document loads repaired, and an unknown block survives a save", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 1100 });
  await saveDashboards(page, [
    JSON.parse(
      JSON.stringify({
        version: 2,
        id: "content-admin",
        name: { en: "x".repeat(500), fr: "Hostile" },
        evil: true,
        sections: [
          {
            id: "cards",
            type: "grid",
            layout: [
              { widgetId: "bad id!", x: 9, y: -3, w: 99, h: 99 },
              { widgetId: "pages-table", x: 0, y: 0, w: 2, h: 2 },
              { widgetId: "ghost", x: 0, y: 0, w: 1, h: 1 },
            ],
          },
          { id: "odd", type: "carousel", widgetIds: ["legacy"] },
        ],
        widgets: [
          {
            id: "bad id!",
            type: "kpi",
            tableId: "pages",
            settings: { metric: "sum", onClick: "alert(1)" },
          },
          { id: "pages-table", type: "table", tableId: "pages", settings: {} },
          {
            id: "legacy",
            type: "block",
            block: "legacy.box",
            props: { unit: "GB", nested: { list: [1, 2, 3] } },
            settings: {},
          },
          { id: "frame", type: "iframe", src: "https://example.com" },
          {
            id: "notes",
            type: "note",
            settings: { text: '<img src="x" onerror="window.hacked=1">' },
          },
        ],
        filters: [{ id: "f", type: "sql", label: "Nope", targets: [] }],
      })
    ),
  ]);
  await page.goto(SCREEN);
  // Repaired: the table moved to a flow, the id made valid, the rest dropped.
  await expect(page.locator("[data-host-table]")).toHaveCount(1);
  await expect(widget(page, "pages-table")).toHaveAttribute(
    "data-widget-frame",
    "page"
  );
  await expect(widget(page, "bad-id")).toBeVisible();
  await expect(widget(page, "frame")).toHaveCount(0);
  await expect(widget(page, "notes")).toContainText('<img src="x"');
  await expect(widget(page, "legacy")).toContainText("Unavailable block");
  expect(await page.evaluate(() => "hacked" in globalThis)).toBe(false);
  // Saving keeps the block the host lacks, with its props.
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  const saved = (await savedDashboards(page))["content-admin"];
  expect(
    (saved?.widgets as { id: string }[]).find((entry) => entry.id === "legacy")
  ).toEqual({
    id: "legacy",
    type: "block",
    block: "legacy.box",
    props: { unit: "GB", nested: { list: [1, 2, 3] } },
    settings: {},
  });
  expect(errors).toEqual([]);
});

test("phones stack the screen; French shows its labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${SCREEN}&lang=fr`);
  await expect(
    page.getByRole("heading", { name: "Administration du contenu", level: 2 })
  ).toBeVisible();
  await expect(figure(page, "published")).toHaveText(
    String(count("published"))
  );
  await expect(page.locator('[data-dashboard-layout="stack"]')).toHaveCount(1);
  const order = await page
    .locator('[data-dashboard-section="overview"] [data-dashboard-item]')
    .evaluateAll((items) =>
      items.map((entry) => entry.getAttribute("data-dashboard-item"))
    );
  expect(order).toEqual([
    "published",
    "drafts",
    "storage",
    "audit",
    "uploads",
    "shortcuts",
    "attention",
  ]);
  // One column: every card as wide as the screen's content.
  const widths = await page
    .locator('[data-dashboard-section="overview"] [data-dashboard-widget]')
    .evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().width))
    );
  expect(new Set(widths).size).toBe(1);
  await expect(
    toolbar(page).getByRole("button", { name: "Tout actualiser" })
  ).toBeVisible();
  await expect(widget(page, "audit")).toContainText(
    "Vous n’avez pas accès à ces données."
  );
  await expect(
    widget(page, "attention").locator("[data-attention-item]").first()
  ).toContainText("en attente de relecture");
  await page
    .locator('[data-dashboard-filter="period"] [data-filter-trigger]')
    .click();
  await expect(page.locator('[data-filter-preset="last30Days"]')).toHaveText(
    "30 derniers jours"
  );
});

test("a source's meta.notice shows instead of its data", async ({ page }) => {
  await saveDashboards(page, [
    {
      version: 2,
      id: "content-admin",
      name: "Analytics",
      sections: [
        {
          id: "cards",
          type: "grid",
          layout: [
            { widgetId: "views", x: 0, y: 0, w: 1, h: 1 },
            { widgetId: "top", x: 1, y: 0, w: 2, h: 2 },
          ],
        },
      ],
      widgets: [
        {
          id: "views",
          type: "kpi",
          tableId: "analytics",
          title: "Page views",
          settings: { metric: "count" },
        },
        {
          id: "top",
          type: "view",
          tableId: "analytics",
          title: "Top pages",
          view: { displayMode: "table" },
          settings: {},
        },
      ],
      filters: [],
    },
  ]);
  await page.goto(SCREEN);
  for (const id of ["views", "top"]) {
    const notice = widget(page, id).locator('[data-widget-state="notice"]');
    await expect(notice).toHaveText(ANALYTICS_NOTICE.message);
    await expect(notice).toHaveAttribute(
      "data-widget-reason",
      ANALYTICS_NOTICE.code
    );
  }
  await expect(figure(page, "views")).toHaveCount(0);
  expect(await sourceLoads(page)).toEqual(["analytics"]);
});

// The screen editor (release B) -------------------------------------------------------

const edit = async (page: Page) => {
  await toolbar(page).getByRole("button", { name: "Edit" }).click();
  await expect(
    toolbar(page).getByRole("button", { name: "Done" })
  ).toBeVisible();
};
const done = async (page: Page) => {
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Dashboard saved")).toBeVisible();
  return (await savedDashboards(page))["content-admin"] as {
    sections: {
      id: string;
      type: string;
      title?: unknown;
      layout?: { widgetId: string }[];
    }[];
    widgets: Record<string, unknown>[];
  };
};
const widgetDialog = (page: Page, name = "Add a widget") =>
  page.getByRole("dialog", { name });
const openWidgetMenu = (page: Page, id: string) =>
  widget(page, id)
    .getByRole("button", { name: WIDGET_OPTIONS })
    .first()
    .click();
const WIDGET_OPTIONS = /^Widget options for /;
/** The editor's chunk in each demo's dev server (React `dashboard-editor.tsx`, Vue `DashboardEditorLayer.vue`). */
const EDITOR_CHUNK = /\/dashboard-editor\.tsx|\/DashboardEditorLayer\.vue/;
const AUDIT_OPTION = /^Audit log/;
const INVOICES_OPTION = /^Invoices/;
const PAGES_OPTION = /^Pages/;
const SEARCH_RECORDS = /^search/i;
/** The pages the demo host finds for a search: any field containing it. */
const matching = (text: string) =>
  PAGES.filter((entry) =>
    Object.values(entry).some((value) =>
      String(value).toLocaleLowerCase().includes(text.toLocaleLowerCase())
    )
  );
const sectionIds = (page: Page) =>
  page
    .locator("[data-dashboard-section]")
    .evaluateAll((sections) =>
      sections.map((entry) => entry.getAttribute("data-dashboard-section"))
    );

test("the editor loads with edit mode, never for readers", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto(SCREEN);
  await ready(page);
  expect(requested.filter((url) => EDITOR_CHUNK.test(url))).toEqual([]);
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  await expect(widgetDialog(page)).toBeVisible();
  expect(requested.some((url) => EDITOR_CHUNK.test(url))).toBe(true);
});

test("a number from the catalogue, its view edited in the live table, is saved and shown after a reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  const dialog = widgetDialog(page);
  await dialog.getByRole("button", { name: "Number", exact: true }).click();
  await dialog.getByPlaceholder("Search sources").fill("pag");
  await dialog.getByRole("option", { name: PAGES_OPTION }).click();
  // Picking the source loads nothing new: it was loaded for the screen.
  await expect(dialog).toHaveAttribute("data-widget-step", "settings");
  await dialog
    .getByLabel("Start from", { exact: true })
    .selectOption({ label: "Custom view" });
  await dialog.getByRole("button", { name: "Edit view…" }).click();
  // The view editor: the source's live table, its toolbar and search.
  const editor = page.getByRole("dialog", { name: "Edit view" });
  await expect(editor.locator("[data-row-id]").first()).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Apply", exact: true })
  ).toBeDisabled();
  await editor.getByPlaceholder(SEARCH_RECORDS).fill("Ada");
  await expect(editor.locator("[data-row-id]")).toHaveCount(
    matching("Ada").length
  );
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await dialog.getByLabel("Title", { exact: true }).fill("Ada's pages");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(figure(page, NEW_WIDGET)).toHaveText(
    String(matching("Ada").length)
  );
  await expect(
    widget(page, NEW_WIDGET).locator("[data-widget-title]")
  ).toHaveText("Ada's pages");
  expect(await sourceLoads(page)).toEqual(["pages", "media", "audit"]);

  const saved = await done(page);
  const number = saved.widgets.find((entry) => entry.id === NEW_WIDGET);
  expect(number).toMatchObject({
    type: "kpi",
    tableId: "pages",
    view: { globalSearch: "Ada" },
    settings: { metric: "count", label: "Ada's pages" },
  });
  // The page size the table started with is left out.
  expect((number?.view as { pageSize?: number }).pageSize).toBeUndefined();
  await page.reload();
  await expect(figure(page, NEW_WIDGET)).toHaveText(
    String(matching("Ada").length)
  );
});

test("the view editor asks before closing with changes", async ({ page }) => {
  await page.goto(SCREEN);
  await ready(page);
  await edit(page);
  await openWidgetMenu(page, "drafts");
  await page.getByRole("menuitem", { name: "Edit view…" }).click();
  const editor = page.getByRole("dialog", { name: "Edit view" });
  await expect(editor.locator("[data-row-id]")).toHaveCount(count("draft"));
  await editor.getByPlaceholder(SEARCH_RECORDS).fill("Ada");
  await expect(editor.getByText("Unsaved changes")).toBeVisible();
  await editor.getByRole("button", { name: "Close" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Discard your changes?",
  });
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await confirm.getByRole("button", { name: "Discard" }).click();
  await expect(editor).toHaveCount(0);
  // Nothing changed: the drafts still count every draft.
  await expect(figure(page, "drafts")).toHaveText(String(count("draft")));
  // Applying changes the number at once.
  await openWidgetMenu(page, "drafts");
  await page.getByRole("menuitem", { name: "Edit view…" }).click();
  await editor.getByPlaceholder(SEARCH_RECORDS).fill("Ada");
  await expect(editor.locator("[data-row-id]")).toHaveCount(
    count("draft", matching("Ada"))
  );
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(figure(page, "drafts")).toHaveText(
    String(count("draft", matching("Ada")))
  );
});

test("a saved view becomes a copy of its own", async ({ page }) => {
  await saveDashboards(page, [
    {
      version: 2,
      id: "content-admin",
      name: "Copies",
      sections: [
        {
          id: "cards",
          type: "grid",
          layout: [{ widgetId: "review", x: 0, y: 0, w: 2, h: 3 }],
        },
      ],
      widgets: [
        {
          id: "review",
          type: "view",
          tableId: "pages",
          viewId: "in-review",
          settings: {},
        },
      ],
      filters: [],
    },
  ]);
  await page.goto(SCREEN);
  const title = widget(page, "review").locator("[data-widget-title]");
  await expect(title).toHaveText("In review");
  await edit(page);
  await openWidgetMenu(page, "review");
  await page.getByRole("menuitem", { name: "Use a copy of this view" }).click();
  // It reads the same, and no longer names the saved view.
  await expect(title).toHaveText("In review");
  await expect(
    widget(page, "review").locator("[data-row-id]").first()
  ).toBeVisible();
  await openWidgetMenu(page, "review");
  await expect(
    page.getByRole("menuitem", { name: "Use a copy of this view" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  const saved = await done(page);
  const review = saved.widgets.find((entry) => entry.id === "review");
  expect(review).toEqual({
    id: "review",
    type: "view",
    tableId: "pages",
    title: "In review",
    view: {
      displayMode: "list",
      advancedFilters: [
        {
          id: "review",
          columnId: "status",
          operator: "isAnyOf",
          isActive: true,
          type: "select",
          values: ["review"],
        },
      ],
    },
    settings: {},
  });
});

test("the page table's current view becomes the screen default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(`${SCREEN}&pages-sort=${encodeURIComponent(BY_TITLE)}`);
  const rows = pageTable(page).locator("[data-row-id]");
  await expect(rows.first()).toContainText(ALPHABETICAL[0] ?? "");
  await edit(page);
  await openWidgetMenu(page, "pages-table");
  await page
    .getByRole("menuitem", {
      name: "Make the current view the screen default",
    })
    .click();
  const saved = await done(page);
  const table = saved.widgets.find((entry) => entry.id === "pages-table");
  const view = table?.view as { sorting?: unknown; pageSize?: number };
  expect(view.sorting).toEqual([{ id: "title", desc: false }]);
  expect(view.pageSize).toBeUndefined();
  // Readers now arrive on it.
  await page.goto(SCREEN);
  await expect(rows.first()).toContainText(ALPHABETICAL[0] ?? "");
  await expect.poll(() => searchParam(page, "view")).toBe(SCREEN_VIEW);
});

test("sections are added, renamed, moved and removed; widgets move between them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Add section" }).click();
  await page.getByRole("menuitem", { name: "Full width" }).click();
  const later = page.locator('[data-dashboard-section="section-3"]');
  await expect(later).toHaveAttribute("data-section-type", "flow");
  await expect(later.locator("[data-section-empty]")).toBeVisible();
  await later.getByLabel("Section title").fill("Later");
  // Up, above the Pages section.
  await page.getByRole("button", { name: "Section options for Later" }).click();
  await page.getByRole("menuitem", { name: "Move up" }).click();
  await expect
    .poll(() => sectionIds(page))
    .toEqual(["overview", "section-3", "pages"]);
  // A card moves to the new section: its grid closes the gap.
  await openWidgetMenu(page, "shortcuts");
  await page.getByRole("menuitem", { name: "Move to section" }).click();
  await page.getByRole("menuitem", { name: "Later" }).click();
  await expect(
    later.locator('[data-dashboard-item="shortcuts"]')
  ).toBeVisible();
  await expect(later.locator("[data-section-empty]")).toHaveCount(0);
  // The Pages section's widgets follow: the Sections block, then the
  // full-page table, which only goes to flows (never offered the grid).
  await openWidgetMenu(page, "page-sections");
  await page.getByRole("menuitem", { name: "Move to section" }).click();
  await page.getByRole("menuitem", { name: "Later" }).click();
  await expect(
    later.locator('[data-dashboard-item="page-sections"]')
  ).toBeVisible();
  await openWidgetMenu(page, "pages-table");
  await page.getByRole("menuitem", { name: "Move to section" }).click();
  await expect(page.getByRole("menuitem", { name: "Overview" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Later" }).click();
  // Pages is left empty; it goes without a question.
  await page.getByRole("button", { name: "Section options for Pages" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.locator('[data-dashboard-section="pages"]')).toHaveCount(0);
  // Adding a widget here: the dialog offers what a grid takes (no table page).
  await page
    .getByRole("button", { name: "Section options for Overview" })
    .click();
  await page.getByRole("menuitem", { name: "Add widget here" }).click();
  await expect(
    widgetDialog(page).getByRole("button", { name: "Table page" })
  ).toHaveCount(0);
  await widgetDialog(page).getByRole("button", { name: "Cancel" }).click();
  // A section with widgets asks first.
  await page.getByRole("button", { name: "Section options for Later" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Remove Later?" });
  await expect(confirm).toContainText("Its 3 widgets are removed with it.");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(later).toBeVisible();

  const saved = await done(page);
  expect(saved.sections.map((section) => section.id)).toEqual([
    "overview",
    "section-3",
  ]);
  expect(saved.sections[1]).toEqual({
    id: "section-3",
    type: "flow",
    title: "Later",
    widgetIds: ["shortcuts", "page-sections", "pages-table"],
  });
  expect(
    saved.sections[0]?.layout?.map((entry) => entry.widgetId)
  ).not.toContain("shortcuts");
});

test("a block's props are JSON, checked before they apply", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  const dialog = widgetDialog(page);
  await dialog.getByRole("button", { name: "Shortcuts", exact: true }).click();
  const props = dialog.getByLabel("Properties (JSON)");
  // The block's default props to start from.
  await expect(props).toHaveValue('{\n  "links": []\n}');
  await props.fill('{ "links": [');
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("This is not valid JSON.");
  await props.fill('{ "links": "nope" }');
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "The block refuses these properties:"
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "links is a list of { label, href }."
  );
  await props.fill('{ "links": [{ "label": "Docs", "href": "#docs" }] }');
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const added = widget(page, NEW_WIDGET);
  await expect(added.locator("[data-shortcuts] a")).toHaveText(["Docs"]);
  // Editing the props.
  await openWidgetMenu(page, NEW_WIDGET);
  await page.getByRole("menuitem", { name: "Edit…" }).click();
  const editing = widgetDialog(page, "Edit the widget");
  await editing
    .getByLabel("Properties (JSON)")
    .fill('{ "links": [{ "label": "Guides", "href": "#docs" }] }');
  await editing.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(added.locator("[data-shortcuts] a")).toHaveText(["Guides"]);
  const saved = await done(page);
  expect(saved.widgets.find((entry) => entry.id === NEW_WIDGET)).toEqual({
    id: NEW_WIDGET,
    type: "block",
    block: "shortcuts",
    props: { links: [{ label: "Guides", href: "#docs" }] },
    settings: {},
  });
});

test("a block's own settings form edits its props", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(SCREEN);
  await ready(page);
  const listed = widget(page, "attention").locator("[data-attention-item]");
  await expect(listed).toHaveCount(2);
  await edit(page);
  await openWidgetMenu(page, "attention");
  await page.getByRole("menuitem", { name: "Edit…" }).click();
  const dialog = widgetDialog(page, "Edit the widget");
  // The host's form instead of JSON, showing the block's default props.
  const settings = dialog.locator("[data-attention-settings]");
  await expect(settings).toBeVisible();
  await expect(dialog.getByLabel("Properties (JSON)")).toHaveCount(0);
  const review = settings.getByRole("checkbox", {
    name: "Pages waiting for review",
  });
  const alt = settings.getByRole("checkbox", {
    name: "Images without alt text",
  });
  await expect(review).toBeChecked();
  await expect(alt).toBeChecked();
  await alt.uncheck();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const reviewOnly = [`${count("review")} pages waiting for review`];
  await expect(listed).toHaveText(reviewOnly);
  const saved = await done(page);
  expect(saved.widgets.find((entry) => entry.id === "attention")).toEqual({
    id: "attention",
    type: "block",
    block: "attention",
    props: { items: ["review"] },
    settings: {},
  });
  await page.reload();
  await expect(listed).toHaveText(reviewOnly);
});

test("Done saves nothing while the screen has errors, and says where they are", async ({
  page,
}) => {
  const links = {
    id: "links",
    type: "block",
    block: "shortcuts",
    title: "Links",
    props: { links: "nope" },
    settings: {},
  };
  await saveDashboards(page, [
    {
      version: 2,
      id: "content-admin",
      name: "Errors",
      sections: [{ id: "page", type: "flow", widgetIds: ["links", "notes"] }],
      widgets: [
        links,
        { id: "notes", type: "note", settings: { text: "Below." } },
      ],
      filters: [],
    },
  ]);
  await page.goto(SCREEN);
  await expect(widget(page, "notes")).toContainText("Below.");
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Done" }).click();
  const issues = page.locator("[data-dashboard-issues]");
  await expect(issues).toContainText(
    "The screen was not saved. Fix these problems first:"
  );
  await expect(issues.locator("li")).toHaveText([
    "Links: links is a list of { label, href }.",
  ]);
  // Still editing; the stored document is unchanged.
  await expect(
    toolbar(page).getByRole("button", { name: "Done" })
  ).toBeVisible();
  expect(
    ((await savedDashboards(page))["content-admin"]?.widgets as unknown[])[0]
  ).toEqual(links);
  // Fixed in the widget dialog, the screen saves.
  await openWidgetMenu(page, "links");
  await page.getByRole("menuitem", { name: "Edit…" }).click();
  const editing = widgetDialog(page, "Edit the widget");
  await editing.getByLabel("Properties (JSON)").fill('{ "links": [] }');
  await editing.getByRole("button", { name: "Apply", exact: true }).click();
  const saved = await done(page);
  await expect(issues).toHaveCount(0);
  expect(saved.widgets.find((entry) => entry.id === "links")?.props).toEqual({
    links: [],
  });
});

test("unavailable sources are listed in the catalogue, disabled, with the reason", async ({
  page,
}) => {
  await page.goto(SCREEN);
  await ready(page);
  await edit(page);
  await toolbar(page).getByRole("button", { name: "Add widget" }).click();
  const dialog = widgetDialog(page);
  await dialog.getByRole("button", { name: "View", exact: true }).click();
  const audit = dialog.getByRole("option", { name: AUDIT_OPTION });
  const invoices = dialog.getByRole("option", { name: INVOICES_OPTION });
  await expect(audit).toBeDisabled();
  await expect(audit).toContainText("You don’t have access to this data.");
  await expect(invoices).toBeDisabled();
  await expect(invoices).toContainText("Connect Stripe to see invoices.");
  await expect(
    dialog.getByRole("option", { name: PAGES_OPTION })
  ).toBeEnabled();
  // A search narrows the catalogue; nothing unavailable loads.
  await dialog.getByPlaceholder("Search sources").fill("invoices");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await invoices.click({ force: true });
  await expect(dialog).toHaveAttribute("data-widget-step", "source");
  expect(await sourceLoads(page)).toEqual(["pages", "media", "audit"]);
});
