import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type {
  TableView,
  TableViewConfig,
} from "../src/components/ui/yayaw-table/types/view-types";
import { formatDateValue } from "../src/components/ui/yayaw-table/utils/value-format";
import { mockAutoPageLayout } from "./fixtures/auto-page-layout";
import {
  CREATED_AT,
  favoriteView,
  listServerRenderingRecords,
  serverRenderingColumns,
  serverRenderingRecords,
  TIME_ZONE,
} from "./fixtures/server-rendering";

const favorite = favoriteView as TableView;

const tableConfig = (table: Record<string, unknown> = {}) =>
  defineTableConfig({
    id: "ssr",
    columns: {
      definitions: serverRenderingColumns,
      visible: serverRenderingColumns.map((column) => column.id),
      order: serverRenderingColumns.map((column) => column.id),
      mandatory: ["name"],
    },
    table: {
      defaultPageSize: 10,
      syncUrl: false,
      timeZone: TIME_ZONE,
      ...table,
    },
    translations: { namespace: "ssr", keys: {} },
  });

/** Every action of the table, each counting its calls. */
function countedActions() {
  const calls = { list: [] as Record<string, unknown>[], views: 0 };
  const actions = {
    list: (params: Record<string, unknown>) => {
      calls.list.push(params);
      return Promise.resolve(listServerRenderingRecords(params));
    },
    views: {
      list: () => {
        calls.views += 1;
        return Promise.resolve({ success: true, data: [favorite] });
      },
      getFavorite: () => {
        calls.views += 1;
        return Promise.resolve({
          success: true,
          data: { viewId: favorite.id },
        });
      },
    },
  };
  return { calls, actions };
}

type TableProps = ComponentProps<typeof DataTable>;

const table = (props: Partial<TableProps>) => (
  <NuqsTestingAdapter hasMemory>
    <DataTable
      getRowId={(row) => String(row.id)}
      queryClient={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
      tableType="ssr"
      {...props}
    />
  </NuqsTestingAdapter>
);

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 60)));

async function mount(element: ReturnType<typeof table>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() => {
    root.render(element);
  });
  for (let frame = 0; frame < 5; frame += 1) {
    await settle();
  }
  return container;
}

it("renders the dates of the server's rows in the table's time zone, as Vue does", () => {
  const config = tableConfig();
  const html = renderToString(
    table({
      getTableActions: () => countedActions().actions,
      getTableConfig: () => config,
      initialData: serverRenderingRecords.slice(0, 10),
      initialDataSort: [],
      initialRowCount: serverRenderingRecords.length,
      initialPageCount: 2,
    })
  );
  expect(html).toContain(
    formatDateValue(CREATED_AT, {
      preset: "dateTime",
      locale: "en",
      timeZone: TIME_ZONE,
    })
  );
});

it("starts from the host's views and favorite without loading them, as Vue does", async () => {
  const config = tableConfig();
  const { calls, actions } = countedActions();
  const container = await mount(
    table({
      getTableActions: () => actions,
      getTableConfig: () => config,
      initialViews: [favorite],
      initialActiveViewId: favorite.id,
      initialFavoriteViewId: favorite.id,
      initialViewsLoaded: true,
      initialView: { id: favorite.id, config: favorite.config },
    })
  );
  expect(calls.views).toBe(0);
  expect(calls.list).toHaveLength(1);
  expect(calls.list[0]).toMatchObject({
    page: 1,
    pageSize: 3,
    filters: { owner: ["ann"] },
  });
  expect(container.textContent).toContain("Record 12");
  expect(container.textContent).not.toContain("Record 11");
});

it("opens the page the initial view names, as Vue does", async () => {
  const config = tableConfig();
  const { calls, actions } = countedActions();
  await mount(
    table({
      getTableActions: () => actions,
      getTableConfig: () => config,
      initialView: {
        id: favorite.id,
        config: favorite.config as TableViewConfig,
        pageIndex: 1,
      },
    })
  );
  expect(calls.list[0]).toMatchObject({ page: 2, pageSize: 3 });
});

it("shows fewer rows of the first page without a request when the measured page is smaller, as Vue does", async () => {
  const layout = mockAutoPageLayout(window);
  const config = tableConfig({
    enableAutoPageSize: true,
    defaultAutoPageSize: true,
  });
  const { calls, actions } = countedActions();
  try {
    const container = await mount(
      table({
        getTableActions: () => ({ list: actions.list }),
        getTableConfig: () => config,
      })
    );
    const rows = () => container.querySelectorAll("tbody tr").length;
    const measure = async () => {
      await act(() => {
        layout.flush();
      });
      for (let frame = 0; frame < 3; frame += 1) {
        await settle();
      }
    };
    expect(calls.list).toHaveLength(1);
    expect(calls.list[0]).toMatchObject({ page: 1, pageSize: 10 });

    // 600px fit 9 rows of 40px: the first 9 rows stay, no request.
    await measure();
    expect(rows()).toBe(9);
    expect(calls.list).toHaveLength(1);

    // A taller window fits more rows than were loaded: they load.
    layout.resize(1200);
    await measure();
    expect(calls.list).toHaveLength(2);
    expect(Number(calls.list[1]?.pageSize)).toBeGreaterThan(10);
  } finally {
    layout.restore();
  }
});
