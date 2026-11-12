import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";
import type { DashboardSources } from "./dashboard/dashboard-sources";
import type {
  DashboardBlockRegistry,
  DashboardTableSource,
} from "./dashboard/dashboard-types";
import YayawDashboard from "./dashboard/YayawDashboard.vue";
import type { TableActions } from "./types";

enableAutoUnmount(afterEach);
afterEach(() => {
  window.history.replaceState(null, "", "/");
});
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
};

/** A block showing its props and the screen's period. */
const SummaryBlock = defineComponent({
  props: {
    props: { type: Object, required: true },
    filters: { type: Object, required: true },
  },
  setup(props) {
    return () =>
      h(
        "p",
        { "data-summary": "" },
        `${String(props.props.title)} ${String(props.props.unit)} ${
          (props.filters.period as { preset?: string } | undefined)?.preset ??
          "none"
        }`
      );
  },
});
const BrokenBlock = defineComponent({
  setup() {
    return () => {
      throw new Error("boom");
    };
  },
});
const EmptyBlock = defineComponent({ setup: () => () => null });

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
const notice = { code: "notConfigured", message: "Connect it." };
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
      aggregate: () => Promise.resolve({ groups: [], meta: { notice } }),
      list: () => Promise.resolve({ data: [], meta: { notice } }),
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
          ? { unavailable: true as const, reason: "forbidden" as const }
          : { unavailable: true as const, reason: "notFound" as const }
      );
    },
  };
  return { sources, loads };
};

it("renders a given document: sources on demand, blocks, notices, no title or edit without storage", async () => {
  const { loads, sources } = catalogue();
  const wrapper = mount(YayawDashboard, {
    props: {
      blocks,
      canEdit: true,
      dashboard: DOCUMENT,
      showTitle: false,
      sources,
      tables,
    },
  });
  await settle();
  const widget = (id: string) => wrapper.get(`[data-dashboard-widget="${id}"]`);
  expect(wrapper.find("h2").exists()).toBe(false);
  // Editing needs somewhere to save.
  expect(wrapper.text()).not.toContain("Edit");
  expect(wrapper.text()).toContain("Refresh all");
  // `tables` win over the catalogue, which loads only what the screen shows.
  expect(loads).toEqual(["audit"]);
  expect(widget("count").get("[data-kpi-value]").text()).toBe("7");
  expect(widget("audit").text()).toContain(
    "You don’t have access to this data."
  );
  expect(
    widget("views")
      .get('[data-widget-state="notice"]')
      .attributes("data-widget-reason")
  ).toBe("notConfigured");
  expect(widget("views").text()).toContain("Connect it.");
  // Props over the block's defaults, the screen's filters, its label as title.
  expect(widget("summary").get("[data-summary]").text()).toBe(
    "Hi GB last7Days"
  );
  expect(widget("summary").get("h3").text()).toBe("Summary");
  expect(widget("legacy").text()).toContain("Unavailable block");
  // A failing block shows its error; the others keep working.
  expect(widget("broken").text()).toContain(
    "This widget could not be shown: boom"
  );
  expect(widget("notes").text()).toContain("Hello");
  expect(
    widget("empty").get("[data-block-content]").element.children.length
  ).toBe(0);
});

it("reads the reader's filter values from the URL, over the document's default", async () => {
  window.history.replaceState(null, "", "/?screen.period=last30Days");
  const wrapper = mount(YayawDashboard, {
    props: { blocks, dashboard: DOCUMENT },
  });
  await settle();
  expect(wrapper.get("[data-summary]").text()).toBe("Hi GB last30Days");
  expect(
    wrapper.get('[data-dashboard-filter="period"] [data-filter-value]').text()
  ).toBe("Last 30 days");
  // Without URL sync, the document's default applies.
  const other = mount(YayawDashboard, {
    props: { blocks, dashboard: DOCUMENT, syncUrl: false },
  });
  await settle();
  expect(other.get("[data-summary]").text()).toBe("Hi GB last7Days");
});

it("YayawDataTable exposes refresh(), which loads its rows again", async () => {
  let lists = 0;
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "pages",
      config: pagesConfig,
      syncUrl: false,
      getTableActions: () =>
        ({
          list: () => {
            lists += 1;
            return Promise.resolve({ data: [{ id: "1", title: "Home" }] });
          },
        }) as unknown as TableActions,
    },
  });
  await settle();
  const before = lists;
  expect(before).toBeGreaterThan(0);
  await (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh();
  expect(lists).toBe(before + 1);
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
const linkedTables: Record<string, DashboardTableSource> = {
  pages: {
    config: pagesConfig,
    actions: {
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
const later = async (ms = 200) => {
  await settle();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};

it("keeps today's screen by default: no linked number, the period in the filter bar", async () => {
  const wrapper = mount(YayawDashboard, {
    props: { dashboard: LINKED, tables: linkedTables },
    attachTo: document.body,
  });
  await later();
  expect(wrapper.find("[data-widget-link]").exists()).toBe(false);
  expect(wrapper.find("[data-dashboard-header-filter]").exists()).toBe(false);
  expect(
    wrapper
      .find('[data-dashboard-filters] [data-dashboard-filter="period"]')
      .exists()
  ).toBe(true);
});

it("shows the period in the header row and links a number to its table when the host opts in", async () => {
  const wrapper = mount(YayawDashboard, {
    props: {
      dashboard: LINKED,
      tables: linkedTables,
      kpiLinks: true,
      periodInHeader: true,
    },
    attachTo: document.body,
  });
  await later();
  expect(
    wrapper
      .find('[data-dashboard-header-filter] [data-dashboard-filter="period"]')
      .exists()
  ).toBe(true);
  const bar = wrapper.get("[data-dashboard-filters]");
  expect(bar.find('[data-dashboard-filter="period"]').exists()).toBe(false);
  expect(bar.find('[data-dashboard-filter="author"]').exists()).toBe(true);
  const link = wrapper.get(
    '[data-dashboard-widget="drafts"] [data-widget-link]'
  );
  expect(link.attributes("aria-pressed")).toBe("false");
  expect(link.attributes("aria-label")).toBe("Show in the table: Drafts");
  await link.trigger("click");
  await later(300);
  expect(link.attributes("aria-pressed")).toBe("true");
  expect(
    wrapper.get('[data-dashboard-widget="drafts"]').attributes()
  ).toHaveProperty("data-link-active");
  // A second click clears the table's filters.
  await link.trigger("click");
  await later(300);
  expect(link.attributes("aria-pressed")).toBe("false");
});

it("edit mode shows the draft banner with the actions the host handles only", async () => {
  const named = (wrapper: ReturnType<typeof mount>, name: string) =>
    wrapper.findAll("button").find((button) => button.text() === name);
  const plain = mount(YayawDashboard, {
    props: {
      actions: storage() as never,
      canEdit: true,
      dashboard: LINKED,
      tables: linkedTables,
    },
    attachTo: document.body,
  });
  await later();
  expect(plain.find("[data-dashboard-edit-banner]").exists()).toBe(false);
  await named(plain, "Edit")?.trigger("click");
  await later();
  const banner = plain.get("[data-dashboard-edit-banner]");
  expect(banner.get("[data-dashboard-draft]").text()).toBe("Draft");
  expect(banner.find("[data-add-widget]").exists()).toBe(true);
  expect(banner.find("[data-add-section]").exists()).toBe(true);
  expect(banner.find("[data-dashboard-history]").exists()).toBe(false);
  expect(banner.find("[data-dashboard-reset]").exists()).toBe(false);
  expect(banner.find("[data-dashboard-publish]").exists()).toBe(false);
  expect(banner.get("[data-dashboard-done]").text()).toBe("Done");
  expect(plain.get("[data-section-layout]").text()).toBe(
    "Section 1 · Full width"
  );
  plain.unmount();

  const calls: string[] = [];
  const second = storage();
  const hosted = mount(YayawDashboard, {
    props: {
      actions: second as never,
      canEdit: true,
      dashboard: LINKED,
      tables: linkedTables,
      onHistory: () => calls.push("history"),
      onResetToDefault: () => calls.push("reset"),
      onPublish: () => {
        calls.push("publish");
      },
    },
    attachTo: document.body,
  });
  await later();
  await named(hosted, "Edit")?.trigger("click");
  await later();
  const actions = hosted.get("[data-dashboard-edit-banner]");
  expect(actions.get("[data-dashboard-done]").text()).toBe("Save draft");
  await actions.get("[data-dashboard-history]").trigger("click");
  await actions.get("[data-dashboard-reset]").trigger("click");
  await actions.get("[data-dashboard-publish]").trigger("click");
  await later();
  expect(calls).toEqual(["history", "reset", "publish"]);
  expect(second.saved).toHaveLength(1);
  // Published: the editing ends.
  expect(hosted.find("[data-dashboard-edit-banner]").exists()).toBe(false);
});
