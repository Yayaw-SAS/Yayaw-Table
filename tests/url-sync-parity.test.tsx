import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import { TableStateSyncProvider } from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

it("shares table state in memory without writing URL parameters", async () => {
  let primary!: ReturnType<typeof useTableUrlState>;
  let secondary!: ReturnType<typeof useTableUrlState>;
  let urlUpdates = 0;

  function Probe() {
    primary = useTableUrlState({ tableId: "local" });
    secondary = useTableUrlState({ tableId: "local" });
    return <span>{secondary.globalSearchParam}</span>;
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={() => {
            urlUpdates += 1;
          }}
          searchParams="local-q=from-url"
        >
          <TableStateSyncProvider enabled={false}>
            <Probe />
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );

  expect(primary.globalSearchParam).toBe("");
  await act(async () => {
    primary.setGlobalSearchFromUI("Alpha");
    primary.setPinningFromUI({ left: ["name"], right: [] });
    primary.setSizingFromUI({ name: 240 });
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(secondary.globalSearchParam).toBe("Alpha");
  expect(secondary.pinningParam).toEqual({ left: ["name"], right: [] });
  expect(secondary.sizingParam).toEqual({ name: 240 });
  expect(container.textContent).toBe("Alpha");
  expect(urlUpdates).toBe(0);
});

it("captures and restores saved density, including legacy defaults and isolated tables", async () => {
  const store = createStore();
  const { tableDensityAtom } = await import(
    "../src/components/ui/yayaw-table/atoms/table-atoms"
  );
  let state!: ReturnType<typeof useTableUrlState>;
  function Probe() {
    state = useTableUrlState({
      tableId: "density-view",
      defaultDensity: "large",
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter hasMemory>
          <TableStateSyncProvider enabled={false}>
            <Probe />
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  expect(state.getCurrentViewConfig().density).toBe("large");
  for (const density of [
    "extra-small",
    "small",
    "medium",
    "large",
    "extra-large",
    "extra-extra-large",
  ] as const) {
    await act(() => store.set(tableDensityAtom("density-view"), density));
    const snapshot = state.getCurrentViewConfig();
    expect(snapshot.density).toBe(density);
    await act(() => state.applyViewConfig({ density: "medium" }));
    await act(() => state.applyViewConfig(snapshot));
    expect(store.get(tableDensityAtom("density-view"))).toBe(density);
  }
  await act(() => state.applyViewConfig({ globalSearch: "legacy" }));
  expect(state.getCurrentViewConfig().density).toBe("large");
  expect(store.get(tableDensityAtom("other"))).toBeUndefined();
  await act(() => state.resetUrlState());
  expect(state.getCurrentViewConfig().density).toBe("large");
});

for (const syncUrl of [false, true]) {
  it(`keeps equivalent column-order writes idle with syncUrl=${syncUrl}`, async () => {
    let state!: ReturnType<typeof useTableUrlState>;
    let renders = 0;
    let urlUpdates = 0;
    function Probe() {
      state = useTableUrlState({ tableId: "stable-order" });
      renders++;
      return <span>{state.orderParam.join(",")}</span>;
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(() =>
      root.render(
        <Provider store={createStore()}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={() => {
              urlUpdates++;
            }}
          >
            <TableStateSyncProvider enabled={syncUrl}>
              <Probe />
            </TableStateSyncProvider>
          </NuqsTestingAdapter>
        </Provider>
      )
    );
    await act(async () => {
      state.setOrderFromUI(["select", "name", "actions"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const settledRenders = renders;
    const settledUpdates = urlUpdates;
    await act(async () => {
      state.setOrderFromUI(["select", "name", "actions"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe("select,name,actions");
    expect(renders).toBe(settledRenders);
    expect(urlUpdates).toBe(settledUpdates);
    await act(async () => {
      state.setOrderFromUI(["select", "actions", "name"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe("select,actions,name");
  });
}
