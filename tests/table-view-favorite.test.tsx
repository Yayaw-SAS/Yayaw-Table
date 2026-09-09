import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { tableDensityAtom } from "../src/components/ui/yayaw-table/atoms/table-atoms";
import { DataTableViewManager } from "../src/components/ui/yayaw-table/components/toolbar/table-view-manager";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import { TableStateSyncProvider } from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type {
  TableView,
  TableViewActions,
} from "../src/components/ui/yayaw-table/types/view-types";
import { createLocalTableViewActions } from "../src/components/ui/yayaw-table/utils/table-view-storage";

const favorite: TableView = {
  id: "team",
  name: "Team compact",
  tableId: "favorites",
  createdById: "teammate",
  isGlobal: true,
  isSystem: true,
  config: { density: "extra-small" },
};
const standard: TableView = {
  ...favorite,
  id: "standard",
  name: "Standard",
  isDefault: true,
  config: { density: "large" },
};
const context = { tableId: favorite.tableId, tableType: "products" };
const cleanups: (() => Promise<void>)[] = [];
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 30)));

async function mountManager(
  options: {
    actions?: TableViewActions;
    cachedFavoriteId?: string;
    initialActiveViewId?: string;
    url?: string;
    syncUrl?: boolean;
  } = {}
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const store = createStore();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (options.cachedFavoriteId) {
    queryClient.setQueryData(
      ["tableViewFavorite", context.tableId, context.tableType],
      { viewId: options.cachedFavoriteId }
    );
  }
  const unmount = async () => {
    await act(() => root.unmount());
    queryClient.clear();
    container.remove();
  };
  cleanups.push(unmount);
  const actions: TableViewActions = {
    list: async () => ({ data: [favorite, standard] }),
    ...options.actions,
  };
  await act(() => {
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter hasMemory searchParams={options.url}>
          <TableStateSyncProvider enabled={options.syncUrl ?? false}>
            <TableProvider
              getTableActions={() => ({ views: actions })}
              queryClient={queryClient}
              tableId={favorite.tableId}
              translations={defaultTranslations}
            >
              <DataTableViewManager
                allowViewSave={false}
                initialActiveViewId={options.initialActiveViewId}
                tableId={favorite.tableId}
                tableType={context.tableType}
              />
            </TableProvider>
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    );
  });
  await settle();
  const button = (label: string) => {
    const result = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`
    );
    if (!result) {
      throw new Error(`Missing button: ${label}`);
    }
    return result;
  };
  return { container, store, button, unmount };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

it("favorites a shared system view without write permission or changing its saved configuration, then restores it on remount", async () => {
  const wrapper = await mountManager({ initialActiveViewId: favorite.id });
  await act(() =>
    wrapper.store.set(tableDensityAtom(favorite.tableId), "extra-extra-large")
  );
  await act(async () => {
    wrapper.button("Use this view on arrival").click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(
    wrapper.button("Remove favorite view").getAttribute("aria-pressed")
  ).toBe("true");
  expect(wrapper.store.get(tableDensityAtom(favorite.tableId))).toBe(
    "extra-extra-large"
  );
  expect(favorite.isDefault).toBeUndefined();
  expect(standard.isDefault).toBe(true);
  await wrapper.unmount();
  cleanups.pop();
  const reloaded = await mountManager();
  expect(reloaded.button("Current View").textContent).toContain(favorite.name);
  expect(reloaded.store.get(tableDensityAtom(favorite.tableId))).toBe(
    "extra-small"
  );
  await act(async () => {
    reloaded.button("Remove favorite view").click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(
    reloaded.button("Use this view on arrival").getAttribute("aria-pressed")
  ).toBe("false");
  await reloaded.unmount();
  cleanups.pop();
  const cleared = await mountManager();
  expect(cleared.button("Current View").textContent).toContain(standard.name);
});

it("replaces the single favorite and persists remote preferences with the table context", async () => {
  const writes: unknown[] = [];
  const wrapper = await mountManager({
    initialActiveViewId: standard.id,
    actions: {
      getFavorite: (input) => {
        expect(input).toEqual(context);
        return Promise.resolve({
          success: true,
          data: { viewId: favorite.id },
        });
      },
      setFavorite: (viewId, input) => {
        writes.push({ viewId, ...input });
        return Promise.resolve({ success: true, data: { viewId } });
      },
    },
  });
  await act(async () => {
    wrapper.button("Use this view on arrival").click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(writes).toEqual([{ viewId: standard.id, ...context }]);
  expect(
    wrapper.button("Remove favorite view").getAttribute("aria-pressed")
  ).toBe("true");
});

it("ignores a favorite that is deleted or no longer accessible", async () => {
  await createLocalTableViewActions().setFavorite("removed", context);
  const wrapper = await mountManager();
  expect(wrapper.button("Current View").textContent).toContain(standard.name);
});

it("preserves an explicit URL selection over a favorite", async () => {
  await createLocalTableViewActions().setFavorite(favorite.id, context);
  window.history.replaceState({}, "", `/?view=${standard.id}`);
  const wrapper = await mountManager({
    syncUrl: true,
    url: `view=${standard.id}`,
  });
  expect(wrapper.button("Current View").textContent).toContain(standard.name);
});

it("does not overwrite edits made while a remote favorite is loading", async () => {
  let resolve!: (value: { success: true; data: { viewId: string } }) => void;
  const pending = new Promise<{ success: true; data: { viewId: string } }>(
    (done) => {
      resolve = done;
    }
  );
  const wrapper = await mountManager({
    actions: { getFavorite: () => pending },
  });
  await act(() =>
    wrapper.store.set(tableDensityAtom(favorite.tableId), "extra-extra-large")
  );
  await act(() => resolve({ success: true, data: { viewId: favorite.id } }));
  await settle();
  expect(wrapper.store.get(tableDensityAtom(favorite.tableId))).toBe(
    "extra-extra-large"
  );
  expect(wrapper.button("Current View").textContent).toContain("Default View");
});

it("shows a failed preference write without changing the favorite or the current table state", async () => {
  const wrapper = await mountManager({
    initialActiveViewId: favorite.id,
    actions: {
      setFavorite: async () => ({
        success: false,
        error: "Preference unavailable",
      }),
    },
  });
  await act(async () => {
    wrapper.button("Use this view on arrival").click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(wrapper.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Preference unavailable"
  );
  expect(
    wrapper.button("Use this view on arrival").getAttribute("aria-pressed")
  ).toBe("false");
  expect(wrapper.store.get(tableDensityAtom(favorite.tableId))).toBe(
    "extra-small"
  );
});

it("waits for a refreshed preference before applying a cached favorite on arrival", async () => {
  let resolve!: (value: { success: true; data: { viewId: string } }) => void;
  const pending = new Promise<{ success: true; data: { viewId: string } }>(
    (done) => {
      resolve = done;
    }
  );
  const wrapper = await mountManager({
    cachedFavoriteId: standard.id,
    actions: { getFavorite: () => pending },
  });
  expect(wrapper.button("Current View").textContent).toContain("Default View");
  await act(() => resolve({ success: true, data: { viewId: favorite.id } }));
  await settle();
  expect(wrapper.button("Current View").textContent).toContain(favorite.name);
  expect(wrapper.store.get(tableDensityAtom(favorite.tableId))).toBe(
    "extra-small"
  );
});

it("keeps explicit URL filters and does not activate the favorite", async () => {
  await createLocalTableViewActions().setFavorite(favorite.id, context);
  window.history.replaceState({}, "", "/?favorites-q=Beta");
  const wrapper = await mountManager({
    syncUrl: true,
    url: "favorites-q=Beta",
  });
  expect(wrapper.button("Current View").textContent).toContain("Default View");
  expect(wrapper.store.get(tableDensityAtom(favorite.tableId))).not.toBe(
    "extra-small"
  );
});

it("reports a failed preference read while still loading the default view", async () => {
  const wrapper = await mountManager({
    actions: {
      getFavorite: async () => ({
        success: false,
        error: "Cannot load preference",
      }),
    },
  });
  expect(wrapper.button("Current View").textContent).toContain(standard.name);
  expect(wrapper.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Cannot load preference"
  );
});
