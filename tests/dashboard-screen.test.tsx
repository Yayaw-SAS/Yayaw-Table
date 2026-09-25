import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { act } from "react";
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
