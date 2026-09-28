import { mkdir, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { projectsOverviewDashboard } from "../../examples/dashboard";

// The dedicated configuration keeps these captures outside the normal E2E gate.
const CAPTURE_ROOT =
  process.env.DASHBOARD_VISUAL_CAPTURE_DIR ??
  "/tmp/yayaw-dashboard-visual-before";
const SIZES = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** The grid/flow fixture from dashboard.spec.ts, including its unavailable host block. */
const SECTION_SCREEN = {
  version: 2,
  id: projectsOverviewDashboard.id,
  name: { en: "Projects overview", fr: "Vue des projets" },
  sections: [
    {
      id: "numbers",
      type: "grid",
      title: { en: "Numbers", fr: "Chiffres" },
      layout: [
        { widgetId: "projects-count", x: 0, y: 0, w: 1, h: 1 },
        { widgetId: "software", x: 1, y: 0, w: 1, h: 1 },
      ],
    },
    {
      id: "details",
      type: "flow",
      title: { en: "Details", fr: "Détails" },
      widgetIds: ["biggest", "pages", "summary", "notes"],
    },
  ],
  widgets: [
    ...projectsOverviewDashboard.widgets.filter(
      (entry) => entry.id === "projects-count"
    ),
    {
      id: "software",
      type: "kpi",
      tableId: "projects",
      title: { en: "Software", fr: "Logiciel" },
      view: {
        advancedFilters: [
          {
            id: "software",
            columnId: "category",
            type: "select",
            operator: "isAnyOf",
            values: ["Software"],
            isActive: true,
          },
        ],
      },
      settings: { metric: "count" },
    },
    {
      id: "biggest",
      type: "view",
      tableId: "projects",
      title: { en: "Biggest projects", fr: "Plus gros projets" },
      view: {
        displayMode: "list",
        sorting: [{ id: "revenue", desc: true }],
        pageSize: 5,
      },
      settings: {},
    },
    { id: "pages", type: "table", tableId: "tasks", settings: {} },
    { id: "summary", type: "block", block: "home.summary", settings: {} },
    {
      id: "notes",
      type: "note",
      settings: { text: "Figures follow today's date." },
    },
  ],
  filters: [],
};

const LONG_TITLE =
  "Projects awaiting delivery and customer approval across every regional team";
const LONG_REVENUE = {
  ...projectsOverviewDashboard.widgets.find((entry) => entry.id === "revenue"),
  id: "revenue",
  title: LONG_TITLE,
};

const LOADING_LABEL = /^Loading(?: the chart)?[.…]+$/;

async function settled(page: Page) {
  await expect(page.getByText(LOADING_LABEL)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** The exact displayed text and clipping bounds of the dense one-row KPI. */
async function inspectRevenue(page: Page, prefix: string) {
  const revenue = page.locator('[data-dashboard-widget="revenue"]');
  await expect(revenue.locator("[data-kpi-value]")).toHaveText("€157,000");
  await expect(revenue.locator("[data-kpi-compare]")).toHaveText(
    "+38% vs previous period"
  );
  // The requested trend remains available to assistive technology in a narrow card.
  await expect(revenue.getByRole("img")).toHaveCount(1);
  const measured = await revenue.evaluate((widget) => {
    const card = widget.getBoundingClientRect();
    const parts = [
      ...widget.querySelectorAll(
        "[data-widget-title], [data-kpi-value], [data-kpi-compare], [data-kpi-compare] > span, [data-kpi-trend]"
      ),
    ].map((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const ink = range.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        kind: element.matches("[data-kpi-compare] > span")
          ? "comparison-text"
          : element
              .getAttributeNames()
              .find((name) =>
                [
                  "data-widget-title",
                  "data-kpi-value",
                  "data-kpi-compare",
                  "data-kpi-trend",
                ].includes(name)
              ),
        text: element.textContent?.trim(),
        box: box.toJSON(),
        ink: ink.toJSON(),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        verticallyInside: box.top >= card.top && box.bottom <= card.bottom,
      };
    });
    return { card: card.toJSON(), parts };
  });
  await writeFile(
    `${CAPTURE_ROOT}/${prefix}-revenue-bounds.json`,
    JSON.stringify(measured, null, 2)
  );
  expect(measured.parts.every((part) => part.verticallyInside)).toBe(true);
  const value = measured.parts.find((part) => part.kind === "data-kpi-value");
  expect(value?.scrollWidth ?? 1).toBeLessThanOrEqual(
    (value?.clientWidth ?? 0) + 1
  );
}

/** Temporary visual audit using the repository's isolated demo browsers. */
async function capture(
  page: Page,
  prefix: string,
  state: string,
  fullPage = false
) {
  const viewport = page.viewportSize();
  if (fullPage && viewport) {
    // Establish the tall viewport before the capture so responsive reloads settle.
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    await page.setViewportSize({ width: viewport.width, height });
  }
  await settled(page);
  await page.screenshot({
    path: `${CAPTURE_ROOT}/${prefix}-${state}.png`,
    fullPage,
    animations: "disabled",
  });
  const layout = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    kpis: [
      ...document.querySelectorAll(
        "[data-kpi-value], [data-chart-number], [data-kpi-compare]"
      ),
    ].map((element) => {
      const widget = element.closest("[data-dashboard-widget]");
      const card = widget?.getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(element);
      const ink = text.getBoundingClientRect();
      return {
        widget: widget?.getAttribute("data-dashboard-widget"),
        text: element.textContent?.trim(),
        box: ink.toJSON(),
        card: card?.toJSON(),
        inside:
          !card ||
          (ink.left >= card.left &&
            ink.right <= card.right &&
            ink.top >= card.top &&
            ink.bottom <= card.bottom),
      };
    }),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (element) => {
        const box = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim(),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      }
    ),
  }));
  await writeFile(
    `${CAPTURE_ROOT}/${prefix}-${state}.json`,
    JSON.stringify(layout, null, 2)
  );
  if (fullPage && viewport) {
    await page.setViewportSize(viewport);
    await settled(page);
  }
}

for (const size of SIZES) {
  for (const theme of ["light", "dark"] as const) {
    test(`dashboard visual baseline ${size.name} ${theme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await mkdir(CAPTURE_ROOT, { recursive: true });
      const prefix = `${testInfo.project.name}-${size.name}-${theme}`;
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`/?example=dashboard&theme=${theme}`);
      await expect(
        page.locator(
          '[data-dashboard-widget="projects-count"] [data-chart-number]'
        )
      ).toHaveText("32");
      await expect(
        page.locator('[data-dashboard-widget="top-projects"]')
      ).toContainText("Yarrow data platform");
      await expect(page.locator("[data-dashboard-widget]")).toHaveCount(9);
      for (const id of ["revenue-trend", "revenue-category", "status-mix"]) {
        await expect(
          page
            .locator(`[data-dashboard-widget="${id}"] [data-chart-fill] svg`)
            .first()
        ).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      // The chart libraries animate SVG geometry after their first visible frame.
      await page.waitForTimeout(1000);
      await capture(page, prefix, "overview", true);

      const toolbar = page.locator("[data-dashboard] > header");
      await toolbar.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(
        toolbar.getByRole("button", { name: "Done", exact: true })
      ).toBeVisible();
      await capture(page, prefix, "editing", true);

      await toolbar
        .getByRole("button", { name: "Add widget", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Add a widget", exact: true })
      ).toBeVisible();
      await capture(page, prefix, "add-widget");
      await page.keyboard.press("Escape");

      await page
        .getByRole("button", {
          name: "Widget options for Revenue",
          exact: true,
        })
        .click();
      await page.getByRole("menuitem", { name: "Edit…", exact: true }).click();
      const settings = page.getByRole("dialog", {
        name: "Edit the widget",
        exact: true,
      });
      await expect(settings).toHaveAttribute("data-widget-step", "settings");
      await capture(page, prefix, "kpi-settings");
      if (size.name === "mobile") {
        const trend = settings.getByRole("checkbox", {
          name: "Trend line",
          exact: true,
        });
        await trend.scrollIntoViewIfNeeded();
        await expect(trend).toBeInViewport();
        await expect(
          settings.getByRole("button", { name: "Apply", exact: true })
        ).toBeInViewport();
        await capture(page, prefix, "kpi-settings-bottom");
      }
      await page.keyboard.press("Escape");

      await page
        .getByRole("button", {
          name: "Widget options for Top projects by revenue",
          exact: true,
        })
        .click();
      await page.getByRole("menuitem", { name: "Edit…", exact: true }).click();
      await expect(settings).toHaveAttribute("data-widget-step", "settings");
      await capture(page, prefix, "view-settings");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {
          name: "Widget options for Top projects by revenue",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", { name: "Edit view…", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Edit view", exact: true })
      ).toBeVisible();
      await capture(page, prefix, "view-editor");
    });
  }
}

for (const size of SIZES) {
  for (const nested of [false, true]) {
    test(`dashboard section baseline ${size.name} ${nested ? "nested" : "sections"}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await mkdir(CAPTURE_ROOT, { recursive: true });
      const prefix = `${testInfo.project.name}-${size.name}-light`;
      const context = nested ? "nested-long-title" : "sections";
      const screen = nested
        ? {
            ...SECTION_SCREEN,
            name: LONG_TITLE,
            sections: SECTION_SCREEN.sections.map((section) =>
              section.id === "numbers"
                ? {
                    ...section,
                    layout: [
                      ...(section.layout ?? []),
                      { widgetId: "revenue", x: 2, y: 0, w: 1, h: 1 },
                    ],
                  }
                : section
            ),
            widgets: [
              ...SECTION_SCREEN.widgets.map((entry) =>
                entry.id === "software" || entry.id === "biggest"
                  ? { ...entry, title: LONG_TITLE }
                  : entry
              ),
              LONG_REVENUE,
            ],
          }
        : SECTION_SCREEN;
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((saved) => {
        sessionStorage.setItem(
          "yayaw-demo-dashboards-v2",
          JSON.stringify({ [saved.id]: saved })
        );
      }, screen);
      await page.goto("/?example=dashboard");
      await expect(
        page.locator(
          '[data-dashboard-widget="projects-count"] [data-chart-number]'
        )
      ).toHaveText("32");
      await expect(
        page.locator('[data-dashboard-widget="biggest"]')
      ).toContainText("Yarrow data platform");
      await expect(
        page.locator('[data-dashboard-widget="pages"] [data-row-id]')
      ).toHaveCount(10);
      if (nested) {
        // A host-owned panel tests embedding without changing library components.
        await page.addStyleTag({
          content:
            ".visual-audit-host-panel { box-sizing: border-box; width: 100%; max-width: 720px; margin: 0 auto; padding: 24px; border: 1px solid var(--yayaw-border, var(--border)); border-radius: 12px; }",
        });
        await page.locator("[data-dashboard]").evaluate((dashboard) => {
          const panel = document.createElement("section");
          panel.className = "visual-audit-host-panel";
          panel.setAttribute("aria-label", "Host workspace panel");
          dashboard.parentElement?.insertBefore(panel, dashboard);
          panel.append(dashboard);
        });
      }
      await capture(page, prefix, `${context}-overview`, true);
      if (nested) {
        await inspectRevenue(page, `${prefix}-${context}-overview`);
      }
      await page
        .locator("[data-dashboard] > header")
        .getByRole("button", { name: "Edit", exact: true })
        .click();
      await capture(page, prefix, `${context}-editing`, true);
      if (nested) {
        await inspectRevenue(page, `${prefix}-${context}-editing`);
      }
    });
  }
}

test("dashboard long revenue title in a one-column desktop grid card", async ({
  page,
}, testInfo) => {
  await mkdir(CAPTURE_ROOT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const dashboard = {
    ...projectsOverviewDashboard,
    widgets: projectsOverviewDashboard.widgets.map((entry) =>
      entry.id === "revenue" ? LONG_REVENUE : entry
    ),
  };
  await page.addInitScript((saved) => {
    sessionStorage.setItem(
      "yayaw-demo-dashboards-v2",
      JSON.stringify({ [saved.id]: saved })
    );
  }, dashboard);
  await page.goto("/?example=dashboard");
  for (const id of ["revenue-trend", "revenue-category", "status-mix"]) {
    await expect(
      page
        .locator(`[data-dashboard-widget="${id}"] [data-chart-fill] svg`)
        .first()
    ).toBeVisible();
  }
  await settled(page);
  // Match the overview captures after the chart library's initial SVG animation.
  await page.waitForTimeout(1000);
  const prefix = `${testInfo.project.name}-desktop-light-long-revenue-one-column`;
  await capture(page, prefix, "overview", true);
  await inspectRevenue(page, `${prefix}-overview`);
  await page
    .locator("[data-dashboard] > header")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await capture(page, prefix, "editing", true);
  await inspectRevenue(page, `${prefix}-editing`);
});
