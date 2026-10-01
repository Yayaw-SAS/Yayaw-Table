import { vi } from "vitest";
import {
  listServerRenderingRecords,
  serverRenderingColumns,
  favoriteView as sharedFavorite,
  TIME_ZONE,
} from "../../../tests/fixtures/server-rendering";
import { defineTableConfig } from "../src/config";
import type { TableListParams, TableView } from "../src/types";

/** The shared table (tests/fixtures/server-rendering.ts) in Vue. */
export const ssrConfig = (tags = false) =>
  defineTableConfig({
    id: "ssr",
    columns: {
      definitions: [
        ...serverRenderingColumns,
        ...(tags
          ? [
              {
                id: "tags",
                header: "Tags",
                type: "multiSelect" as const,
                tags: true,
              },
            ]
          : []),
      ],
      mandatory: [],
      order: [],
      visible: [],
    },
    table: {
      defaultPageSize: 10,
      enableCalculations: true,
      enableAdvancedFilters: true,
      facets: { columns: ["owner"] },
      syncUrl: false,
      timeZone: TIME_ZONE,
    },
    translations: { namespace: "ssr", keys: { title: "Records" } },
  });

export const favoriteView = sharedFavorite as TableView;

/** The props of a host that knows the user's views and favorite. */
export const favoriteProps = {
  initialViews: [favoriteView],
  initialActiveViewId: favoriteView.id,
  initialFavoriteViewId: favoriteView.id,
  initialViewsLoaded: true,
  initialView: { id: favoriteView.id, config: favoriteView.config },
};

/** Every action of the table, each recording its calls. */
export function spiedActions() {
  const list = vi.fn(async (params: TableListParams) =>
    listServerRenderingRecords({ ...params })
  );
  const other = {
    // Footers read `results`, facets `groups`: neither falls back to `list`.
    aggregate: vi.fn(async () => ({ results: {}, groups: [] })),
    update: vi.fn(async () => ({ success: true })),
    tags: {
      list: vi.fn(async () => [{ id: "urgent", name: "Urgent", color: "red" }]),
    },
    views: {
      list: vi.fn(async () => ({ success: true, data: [favoriteView] })),
      getFavorite: vi.fn(async () => ({
        success: true,
        data: { viewId: favoriteView.id },
      })),
      setFavorite: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { list, other, actions: { list, ...other } };
}
