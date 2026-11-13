import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type {
  DashboardBlockProps,
  DashboardBlockRegistry,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-block";
import type { DashboardSources } from "../src/components/ui/yayaw-table-dashboard/dashboard-sources";
import {
  type DashboardTableSource,
  YayawDashboard,
} from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});
const settle = (ms = 60) =>
  act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
};
const widget = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-dashboard-widget="${id}"]`);

/** A block showing its props and the screen's period. */
function SummaryBlock({ filters, props }: DashboardBlockProps) {
  const period = filters.period as { start?: string; preset?: string };
  return (
    <p data-summary="">
      {String(props.title)} {String(props.unit)} {period?.preset ?? "none"}
    </p>
  );
}
function BrokenBlock(): never {
  throw new Error("boom");
}
const EmptyBlock = () => null;

const blocks: DashboardBlockRegistry = {
  summary: {
    label: { en: "Summary", fr: "Résumé" },
    defaultProps: { unit: "GB" },
    component: SummaryBlock,
  },
  broken: { component: BrokenBlock },
  empty: { component: EmptyBlock },
};

const pagesConfig = defineTableConfig({
  id: "pages",
  columns: {
    definitions: [{ id: "title", header: "Title", type: "text" }],
    order: ["title"],
    visible: ["title"],
    mandatory: ["title"],
  },
  translations: { namespace: "pages", keys: { title: "Pages" } },
});
const tables: Record<string, DashboardTableSource> = {
  pages: {
    config: pagesConfig,
    actions: {
      aggregate: () => Promise.resolve({ groups: [{ keys: [], values: [7] }] }),
    } as unknown as TableActions,
  },
  analytics: {
    config: { ...pagesConfig, id: "analytics" },
    actions: {
      aggregate: () =>
        Promise.resolve({
          groups: [],
          meta: { notice: { code: "notConfigured", message: "Connect it." } },
        }),
      list: () =>
        Promise.resolve({
          data: [],
          meta: { notice: { code: "notConfigured", message: "Connect it." } },
        }),
    } as unknown as TableActions,
  },
};

const DOCUMENT = {
  version: 2,
  id: "screen",
  name: "Screen",
  sections: [
    {
      id: "page",
      type: "flow",
      widgetIds: [
        "count",
        "audit",
        "views",
        "summary",
        "legacy",
        "broken",
        "empty",
        "notes",
      ],
    },
  ],
  widgets: [
    { id: "count", type: "kpi", tableId: "pages", settings: {} },
    { id: "audit", type: "kpi", tableId: "audit", settings: {} },
    { id: "views", type: "kpi", tableId: "analytics", settings: {} },
    {
      id: "summary",
      type: "block",
      block: "summary",
      props: { title: "Hi" },
      settings: {},
    },
    { id: "legacy", type: "block", block: "legacy.box", settings: {} },
    { id: "broken", type: "block", block: "broken", settings: {} },
    { id: "empty", type: "block", block: "empty", settings: {} },
    { id: "notes", type: "note", settings: { text: "Hello" } },
  ],
  filters: [
    {
      id: "period",
      type: "dateRange",
      label: "Period",
      targets: [],
      value: { preset: "last7Days" },
    },
  ],
};

/** A catalogue that loads only what it is asked, and forbids `audit`. */
const catalogue = () => {
  const loads: string[] = [];
  const sources: DashboardSources<DashboardTableSource> = {
    list: () => Promise.resolve([]),
    load: (id) => {
      loads.push(id);
      return Promise.resolve(
        id === "audit"
          ? { unavailable: true, reason: "forbidden" }
          : { unavailable: true, reason: "notFound" }
      );
    },
  };
  return { sources, loads };
};

it("renders a given document: sources on demand, blocks, notices, no title or edit without storage", async () => {
  const { loads, sources } = catalogue();
  const { container, root } = mount();
  await act(() =>
    root.render(
      <YayawDashboard
        blocks={blocks}
        canEdit
        dashboard={DOCUMENT}
        showTitle={false}
        sources={sources}
        tables={tables}
      />
    )
  );
  await settle();
  expect(container.querySelector("h2")).toBeNull();
  // Editing needs somewhere to save.
  expect(container.textContent).not.toContain("Edit");
  expect(container.textContent).toContain("Refresh all");
  // `tables` win over the catalogue, which loads only what the screen shows.
  expect(loads).toEqual(["audit"]);
  expect(
    widget(container, "count")?.querySelector("[data-kpi-value]")?.textContent
  ).toBe("7");
  expect(widget(container, "audit")?.textContent).toContain(
    "You don’t have access to this data."
  );
  expect(
    widget(container, "views")
      ?.querySelector('[data-widget-state="notice"]')
      ?.getAttribute("data-widget-reason")
  ).toBe("notConfigured");
  expect(widget(container, "views")?.textContent).toContain("Connect it.");
  // Props over the block's defaults, the screen's filters, its label as title.
  expect(
    widget(container, "summary")?.querySelector("[data-summary]")?.textContent
  ).toBe("Hi GB last7Days");
  expect(widget(container, "summary")?.querySelector("h3")?.textContent).toBe(
    "Summary"
  );
  expect(widget(container, "legacy")?.textContent).toContain(
    "Unavailable block"
  );
  // A failing block shows its error; the others keep working.
  expect(widget(container, "broken")?.textContent).toContain(
    "This widget could not be shown: boom"
  );
  expect(widget(container, "notes")?.textContent).toContain("Hello");
  expect(
    widget(container, "empty")?.querySelector("[data-block-content]")
      ?.childNodes.length
  ).toBe(0);
});

it("reads the reader's filter values from the URL, over the document's default", async () => {
  window.history.replaceState(null, "", "/?screen.period=last30Days");
  const { container, root } = mount();
  await act(() =>
    root.render(<YayawDashboard blocks={blocks} dashboard={DOCUMENT} />)
  );
  await settle();
  expect(
    widget(container, "summary")?.querySelector("[data-summary]")?.textContent
  ).toBe("Hi GB last30Days");
  expect(
    container.querySelector(
      '[data-dashboard-filter="period"] [data-filter-value]'
    )?.textContent
  ).toBe("Last 30 days");
  // Without URL sync, the document's default applies.
  window.history.replaceState(null, "", "/?screen.period=last30Days");
  const other = mount();
  await act(() =>
    other.root.render(
      <YayawDashboard blocks={blocks} dashboard={DOCUMENT} syncUrl={false} />
    )
  );
  await settle();
  expect(
    widget(other.container, "summary")?.querySelector("[data-summary]")
      ?.textContent
  ).toBe("Hi GB last7Days");
});

const DRAFTS = {
  id: "drafts",
  columnId: "title",
  operator: "contains",
  values: ["Draft"],
};
const LINKED = {
  version: 2,
  id: "linked",
  name: "Linked",
  sections: [{ id: "page", type: "flow", widgetIds: ["drafts", "list"] }],
  widgets: [
    {
      id: "drafts",
      type: "kpi",
      tableId: "pages",
      title: "Drafts",
      view: { advancedFilters: [DRAFTS] },
      settings: {},
    },
    { id: "list", type: "table", tableId: "pages", settings: {} },
  ],
  filters: [
    { id: "author", type: "select", label: "Author", targets: [] },
    { id: "period", type: "dateRange", label: "Period", targets: [] },
  ],
};
const OWN = {
  id: "own",
  columnId: "title",
  operator: "contains",
  values: ["one"],
};
/** A screen whose full-page table has a view of its own, shared by "All". */
const LINKED_OWN_VIEW = {
  ...LINKED,
  id: "linked-own-view",
  sections: [
    { id: "page", type: "flow", widgetIds: ["all", "drafts", "list"] },
  ],
  widgets: [
    {
      id: "all",
      type: "kpi",
      tableId: "pages",
      title: "All",
      view: { advancedFilters: [OWN] },
      settings: {},
    },
    ...LINKED.widgets.map((item) =>
      item.id === "list" ? { ...item, view: { advancedFilters: [OWN] } } : item
    ),
  ],
};

const linkedTables: Record<string, DashboardTableSource> = {
  pages: {
    config: {
      ...pagesConfig,
      table: {
        ...pagesConfig.table,
        actionsAsIcons: true,
        createLabel: "New page",
      },
    },
    actions: {
      create: () => Promise.resolve({ id: "2" }),
      aggregate: () => Promise.resolve({ groups: [{ keys: [], values: [2] }] }),
      list: () =>
        Promise.resolve({ data: [{ id: "1", title: "Draft one" }], total: 1 }),
    } as unknown as TableActions,
  },
};
const storage = () => {
  const saved: unknown[] = [];
  return {
    saved,
    dashboards: {
      list: () => Promise.resolve([]),
      load: () => Promise.resolve(null),
      remove: () => Promise.resolve(),
      save: (dashboard: unknown) => {
        saved.push(dashboard);
        return Promise.resolve(dashboard);
      },
    },
  };
};
/** What a host page gives full-page tables: a query client and URL state. */
function Host({ children }: { children: ReactNode }) {
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </NuqsTestingAdapter>
  );
}
const buttonNamed = (container: HTMLElement, name: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === name
  );

it("keeps today's screen by default: no linked number, the period in the filter bar", async () => {
  const { container, root } = mount();
  await act(() =>
    root.render(
      <Host>
        <YayawDashboard dashboard={LINKED} tables={linkedTables} />
      </Host>
    )
  );
  await settle(200);
  expect(container.querySelector("[data-widget-link]")).toBeNull();
  expect(container.querySelector("[data-dashboard-header-filter]")).toBeNull();
  expect(
    container.querySelector(
      '[data-dashboard-filters] [data-dashboard-filter="period"]'
    )
  ).not.toBeNull();
});

it("shows the period in the header row and links a number to its table when the host opts in", async () => {
  const { container, root } = mount();
  await act(() =>
    root.render(
      <Host>
        <YayawDashboard
          dashboard={LINKED}
          kpiLinks
          periodInHeader
          tables={linkedTables}
        />
      </Host>
    )
  );
  await settle(200);
  expect(
    container.querySelector("[data-dashboard-header-filter]")
  ).not.toBeNull();
  const bar = container.querySelector("[data-dashboard-filters]");
  expect(bar?.querySelector('[data-dashboard-filter="period"]')).toBeNull();
  expect(bar?.querySelector('[data-dashboard-filter="author"]')).not.toBeNull();
  const link = widget(container, "drafts")?.querySelector<HTMLButtonElement>(
    "[data-widget-link]"
  );
  expect(link?.getAttribute("aria-pressed")).toBe("false");
  expect(link?.getAttribute("aria-label")).toBe("Show in the table: Drafts");
  await act(() => link?.click());
  await settle(300);
  expect(link?.getAttribute("aria-pressed")).toBe("true");
  expect(widget(container, "drafts")?.hasAttribute("data-link-active")).toBe(
    true
  );
  // The host's create label stays readable among icon actions.
  expect(buttonNamed(container, "New page")).toBeDefined();
  // A second click clears the filters: this table has no view of its own.
  await act(() => link?.click());
  await settle(300);
  expect(link?.getAttribute("aria-pressed")).toBe("false");
});

it("returns the table to its own view when the pressed number is clicked again", async () => {
  const { container, root } = mount();
  await act(() =>
    root.render(
      <Host>
        <YayawDashboard
          dashboard={LINKED_OWN_VIEW}
          kpiLinks
          tables={linkedTables}
        />
      </Host>
    )
  );
  await settle(300);
  const linkOf = (id: string) =>
    widget(container, id)?.querySelector<HTMLButtonElement>(
      "[data-widget-link]"
    );
  // The table opens with its own filters: the number that shares them is pressed.
  expect(linkOf("all")?.getAttribute("aria-pressed")).toBe("true");
  expect(linkOf("drafts")?.getAttribute("aria-pressed")).toBe("false");
  await act(() => linkOf("drafts")?.click());
  await settle(300);
  expect(linkOf("drafts")?.getAttribute("aria-pressed")).toBe("true");
  expect(linkOf("all")?.getAttribute("aria-pressed")).toBe("false");
  // Off: the table's own filters come back, not an unfiltered table.
  await act(() => linkOf("drafts")?.click());
  await settle(300);
  expect(linkOf("drafts")?.getAttribute("aria-pressed")).toBe("false");
  expect(linkOf("all")?.getAttribute("aria-pressed")).toBe("true");
});

it("edit mode shows the draft banner with the actions the host handles only", async () => {
  const plain = mount();
  const first = storage();
  await act(() =>
    plain.root.render(
      <Host>
        <YayawDashboard
          actions={first}
          canEdit
          dashboard={LINKED}
          tables={linkedTables}
        />
      </Host>
    )
  );
  await settle(200);
  expect(
    plain.container.querySelector("[data-dashboard-edit-banner]")
  ).toBeNull();
  await act(() => buttonNamed(plain.container, "Edit")?.click());
  await settle(200);
  const banner = plain.container.querySelector("[data-dashboard-edit-banner]");
  expect(banner?.querySelector("[data-dashboard-draft]")?.textContent).toBe(
    "Draft"
  );
  expect(banner?.querySelector("[data-add-widget]")).not.toBeNull();
  expect(banner?.querySelector("[data-add-section]")).not.toBeNull();
  expect(banner?.querySelector("[data-dashboard-history]")).toBeNull();
  expect(banner?.querySelector("[data-dashboard-reset]")).toBeNull();
  expect(banner?.querySelector("[data-dashboard-publish]")).toBeNull();
  expect(
    banner?.querySelector("[data-dashboard-done]")?.textContent?.trim()
  ).toBe("Done");
  expect(
    plain.container.querySelector("[data-section-layout]")?.textContent
  ).toBe("Section 1 · Full width");

  const hosted = mount();
  const second = storage();
  const calls: string[] = [];
  await act(() =>
    hosted.root.render(
      <Host>
        <YayawDashboard
          actions={second}
          canEdit
          dashboard={LINKED}
          onHistory={() => calls.push("history")}
          onPublish={() => {
            calls.push("publish");
          }}
          onResetToDefault={() => calls.push("reset")}
          tables={linkedTables}
        />
      </Host>
    )
  );
  await settle(200);
  await act(() => buttonNamed(hosted.container, "Edit")?.click());
  await settle(200);
  const actions = hosted.container.querySelector(
    "[data-dashboard-edit-banner]"
  );
  expect(
    actions?.querySelector("[data-dashboard-done]")?.textContent?.trim()
  ).toBe("Save draft");
  await act(() =>
    actions
      ?.querySelector<HTMLButtonElement>("[data-dashboard-history]")
      ?.click()
  );
  await act(() =>
    actions?.querySelector<HTMLButtonElement>("[data-dashboard-reset]")?.click()
  );
  await act(() =>
    actions
      ?.querySelector<HTMLButtonElement>("[data-dashboard-publish]")
      ?.click()
  );
  await settle(200);
  expect(calls).toEqual(["history", "reset", "publish"]);
  expect(second.saved).toHaveLength(1);
  // Published: the editing ends.
  expect(
    hosted.container.querySelector("[data-dashboard-edit-banner]")
  ).toBeNull();
});
