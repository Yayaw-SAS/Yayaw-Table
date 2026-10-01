import { dehydrate, hydrate, QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { createSSRApp, h, nextTick } from "vue";
import { renderToString } from "vue/server-renderer";
import { mockAutoPageLayout } from "../../../../tests/fixtures/auto-page-layout";
import { favoriteProps, spiedActions, ssrConfig } from "../../tests/ssr-table";
import { defineTableConfig } from "../config";
import YayawDataTable from "./YayawDataTable.vue";

type TableProps = InstanceType<typeof YayawDataTable>["$props"];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Renders as a server does: the table sees no `window`. */
async function serverRender(props: TableProps): Promise<string> {
  vi.stubGlobal("window", undefined);
  try {
    return await renderToString(
      createSSRApp({ render: () => h(YayawDataTable, props) })
    );
  } finally {
    vi.unstubAllGlobals();
  }
}

/** Hydrates the server's HTML in the browser; returns Vue's hydration warnings. */
async function hydrateInBrowser(html: string, props: TableProps) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  const messages: string[] = [];
  const record = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  const app = createSSRApp({ render: () => h(YayawDataTable, props) });
  app.mount(root);
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await flushPromises();
  return {
    root,
    app,
    mismatches: messages.filter((message) => message.includes("Hydration")),
  };
}

it("hydrates the server's first page from the dehydrated query client without loading it again", async () => {
  const { list, other, actions } = spiedActions();
  const props = (queryClient: QueryClient) => ({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => actions,
    queryClient,
    serverPrefetch: true,
    ...favoriteProps,
  });
  const server = new QueryClient();
  const html = await serverRender(props(server));
  expect(list).toHaveBeenCalledTimes(1);

  // The host serializes the request's client into the page, as Nuxt's payload does.
  const browser = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
  hydrate(browser, JSON.parse(JSON.stringify(dehydrate(server))));
  const { root, app, mismatches } = await hydrateInBrowser(
    html,
    props(browser)
  );

  expect(mismatches).toEqual([]);
  expect(list).toHaveBeenCalledTimes(1);
  expect(other.views.list).not.toHaveBeenCalled();
  expect(other.views.getFavorite).not.toHaveBeenCalled();
  expect(root.textContent).toContain("Record 12");
  expect(root.querySelector(".yayaw-loading-overlay")).toBeNull();
  // The footers load once the browser has the page.
  expect(other.aggregate).toHaveBeenCalled();
  app.unmount();
});

it("loads the page again when the browser's client holds it stale (staleTime 0)", async () => {
  const { list, actions } = spiedActions();
  const props = (queryClient: QueryClient) => ({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => actions,
    queryClient,
    serverPrefetch: true,
    ...favoriteProps,
  });
  const server = new QueryClient();
  const html = await serverRender(props(server));
  const browser = new QueryClient();
  hydrate(browser, JSON.parse(JSON.stringify(dehydrate(server))));
  const { app } = await hydrateInBrowser(html, props(browser));
  expect(list).toHaveBeenCalledTimes(2);
  app.unmount();
});

it("shows fewer rows of the first page without a request when the measured page is smaller", async () => {
  const layout = mockAutoPageLayout(window);
  // No saved views: the favorite would apply on mount.
  const { list, other } = spiedActions();
  const actions = { list, aggregate: other.aggregate };
  const source = ssrConfig();
  const config = defineTableConfig({
    ...source,
    table: {
      ...source.table,
      enableAutoPageSize: true,
      defaultAutoPageSize: true,
      // The layout mock sizes every element but rows 400px tall, footers included.
      enableCalculations: false,
    },
  });
  const wrapper = mount(YayawDataTable, {
    props: { tableType: "ssr", config, getTableActions: () => actions },
    attachTo: document.body,
  });
  const measure = async () => {
    layout.flush();
    await nextTick();
    await flushPromises();
  };
  try {
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 10 });
    expect(wrapper.findAll("tbody tr")).toHaveLength(10);

    // 600px fit 9 rows of 40px: the first 9 rows stay, no request.
    await measure();
    expect(wrapper.findAll("tbody tr")).toHaveLength(9);
    expect(list).toHaveBeenCalledTimes(1);

    // A taller window fits more rows than were loaded: they load.
    layout.resize(1200);
    await measure();
    expect(list).toHaveBeenCalledTimes(2);
    expect(Number(list.mock.calls[1]?.[0].pageSize)).toBeGreaterThan(10);
  } finally {
    wrapper.unmount();
    layout.restore();
  }
});
