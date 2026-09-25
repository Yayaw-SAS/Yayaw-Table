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
