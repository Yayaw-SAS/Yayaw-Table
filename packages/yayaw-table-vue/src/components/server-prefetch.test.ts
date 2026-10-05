// @vitest-environment node
import { dehydrate, QueryClient } from "@tanstack/vue-query";
import { expect, it, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { CREATED_AT } from "../../../../tests/fixtures/server-rendering";
import { favoriteProps, spiedActions, ssrConfig } from "../../tests/ssr-table";
import { defineTableConfig } from "../config";
import { formatDateValue } from "../value-format";
import YayawDataTable from "./YayawDataTable.vue";

type TableProps = InstanceType<typeof YayawDataTable>["$props"];

const render = (props: TableProps) =>
  renderToString(createSSRApp({ render: () => h(YayawDataTable, props) }));

it("renders the favorite view's first page on the server with one list request", async () => {
  const { list, other, actions } = spiedActions();
  const queryClient = new QueryClient();
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => actions,
    queryClient,
    serverPrefetch: true,
    ...favoriteProps,
  });

  expect(list).toHaveBeenCalledTimes(1);
  expect(list.mock.calls[0]?.[0]).toMatchObject({
    page: 1,
    pageSize: 3,
    search: "Record",
    filters: { owner: ["ann"] },
    sorting: [{ id: "name", desc: true }],
  });
  // No other request: footers, facets, saved views and the favorite load in the browser.
  for (const action of [
    other.aggregate,
    other.update,
    other.tags.list,
    ...Object.values(other.views),
  ]) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(html).toContain("Record 12");
  expect(html).toContain("Record 10");
  expect(html).toContain("Record 8");
  expect(html).not.toContain("Record 6");
  expect(html).not.toContain("yayaw-loading-overlay");
  // Dates in the table's zone, not the server's.
  expect(html).toContain(
    formatDateValue(CREATED_AT, {
      preset: "dateTime",
      locale: "en",
      timeZone: "Asia/Tokyo",
    })
  );
  // The page is in the query client, ready to dehydrate into the HTML.
  expect(
    dehydrate(queryClient).queries.filter(
      (query) => query.queryKey[0] === "yayaw-table"
    )
  ).toHaveLength(1);
  // Nothing defined or read a browser global.
  expect(typeof window).toBe("undefined");
  expect(typeof localStorage).toBe("undefined");
});

it("renders the state of the request's URL with syncUrl", async () => {
  const { list, actions } = spiedActions();
  const search = new URLSearchParams({
    "ssr-q": "Record 1",
    "ssr-sort": JSON.stringify([{ id: "name", desc: true }]),
    "ssr-pageSize": "3",
  });
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => actions,
    queryClient: new QueryClient(),
    serverPrefetch: true,
    syncUrl: true,
    urlSearch: `?${search}`,
  });
  expect(list).toHaveBeenCalledTimes(1);
  expect(list.mock.calls[0]?.[0]).toMatchObject({
    page: 1,
    pageSize: 3,
    search: "Record 1",
    sorting: [{ id: "name", desc: true }],
  });
  expect(html).toContain('value="Record 1"');
  expect(typeof window).toBe("undefined");
});

it("starts from the host's initial view unless the URL carries the table's state", async () => {
  const initialView = {
    id: null,
    config: { filters: [{ id: "owner", value: ["ann"] }] },
  };
  const first = spiedActions();
  await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => first.actions,
    queryClient: new QueryClient(),
    serverPrefetch: true,
    syncUrl: true,
    urlSearch: "?other=1",
    initialView,
  });
  expect(first.list.mock.calls[0]?.[0]).toMatchObject({
    filters: { owner: ["ann"] },
  });
  const linked = spiedActions();
  await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => linked.actions,
    queryClient: new QueryClient(),
    serverPrefetch: true,
    syncUrl: true,
    urlSearch: `?${new URLSearchParams({ "ssr-q": "Record 1" })}`,
    initialView,
  });
  expect(linked.list.mock.calls[0]?.[0]).toMatchObject({
    search: "Record 1",
    filters: {},
  });
});

it("awaits the tag catalogs with the rows and renders their names", async () => {
  const { list, other, actions } = spiedActions();
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(true),
    getTableActions: () => actions,
    queryClient: new QueryClient(),
    serverPrefetch: true,
  });
  expect(list).toHaveBeenCalledTimes(1);
  expect(other.tags.list).toHaveBeenCalledTimes(1);
  expect(other.aggregate).not.toHaveBeenCalled();
  expect(html).toContain("Urgent");
});

it("renders the loading state without any request when serverPrefetch is off", async () => {
  const { list, other, actions } = spiedActions();
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(true),
    getTableActions: () => actions,
    queryClient: new QueryClient(),
  });
  expect(list).not.toHaveBeenCalled();
  expect(other.tags.list).not.toHaveBeenCalled();
  expect(html).toContain("yayaw-loading-overlay");
});

it("renders the loading state when the server's request fails, for the browser to retry", async () => {
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => ({
      list: () => Promise.reject(new Error("Server unavailable")),
    }),
    queryClient: new QueryClient(),
    serverPrefetch: true,
  });
  expect(html).not.toContain("Server unavailable");
  expect(html).toContain("yayaw-loading-overlay");
});

it("leaves a server board and renderer display modes to the browser", async () => {
  const groups = vi.fn(async () => []);
  const rows = vi.fn(async () => ({ rows: [], nextCursor: null }));
  for (const table of [
    {
      displayModes: ["table", "kanban"] as const,
      defaultDisplayMode: "kanban" as const,
      kanban: {
        groupBy: "owner",
        titleColumn: "name",
        server: { queryKey: "board", groups, rows },
      },
    },
    {
      displayModes: ["table", "feed"] as const,
      defaultDisplayMode: "feed" as const,
    },
  ]) {
    const { list, actions } = spiedActions();
    const source = ssrConfig();
    await render({
      tableType: "ssr",
      config: defineTableConfig({
        ...source,
        table: {
          ...source.table,
          ...table,
          displayModes: [...table.displayModes],
        },
      }),
      getTableActions: () => actions,
      queryClient: new QueryClient(),
      serverPrefetch: true,
    });
    // The table's own page only.
    expect(list).toHaveBeenCalledTimes(1);
  }
  expect(groups).not.toHaveBeenCalled();
  expect(rows).not.toHaveBeenCalled();
});

it("renders the page the initial view names", async () => {
  const { list, actions } = spiedActions();
  const html = await render({
    tableType: "ssr",
    config: ssrConfig(),
    getTableActions: () => actions,
    queryClient: new QueryClient(),
    serverPrefetch: true,
    initialView: { ...favoriteProps.initialView, pageIndex: 1 },
  });
  expect(list).toHaveBeenCalledTimes(1);
  expect(list.mock.calls[0]?.[0]).toMatchObject({ page: 2, pageSize: 3 });
  expect(html).toContain("Record 6");
  expect(html).not.toContain("Record 12");
});
