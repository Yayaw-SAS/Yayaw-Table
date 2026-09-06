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
