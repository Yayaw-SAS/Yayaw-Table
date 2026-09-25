import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../examples/assets";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { fileTreeRenderer } from "../src/components/ui/yayaw-table/filetree/filetree-renderer";
import { FileTreeView } from "../src/components/ui/yayaw-table/filetree/filetree-view";
import { useTableUrlData } from "../src/components/ui/yayaw-table/hooks/use-table-url-data";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import { TableStateSyncProvider } from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type { DisplayModeRenderContext } from "../src/components/ui/yayaw-table/types/display-mode-renderer";

interface PageRow {
  id: string;
  name: string;
}
interface PageResult {
  data: PageRow[];
  pageCount: number;
  rowCount: number;
}
interface RendererRender {
  rows: unknown;
  revision: number;
}

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});
const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async (frames = 5) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await act(() => wait(40));
  }
};
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
};

/** What the probes saw, render after render. */
const seen = {
  pages: [] as PageRow[][],
  renders: [] as RendererRender[],
  rerender: undefined as (() => void) | undefined,
  setColumnOrder: undefined as ((order: string[]) => void) | undefined,
};
const changeColumnOrder = async (order: string[]) => {
  await act(async () => {
    seen.setColumnOrder?.(order);
    // Column order writes are batched on the next tick.
    await wait();
  });
};

function PageProbe({ queryFn }: { queryFn: () => Promise<PageResult> }) {
  const [, setRenders] = useState(0);
  const { data } = useTableUrlData<PageRow>({ queryFn, tableId: "page-rows" });
  const { setOrderFromUI } = useTableUrlState({ tableId: "page-rows" });
  seen.pages.push(data);
  seen.rerender = () => setRenders((count) => count + 1);
  seen.setColumnOrder = setOrderFromUI;
  return null;
}

/** The built-in File tree, recording what the table hands it. */
function RecordingFileTree({ context }: { context: DisplayModeRenderContext }) {
  const { setOrderFromUI } = useTableUrlState({ tableId: context.tableId });
  seen.renders.push({ rows: context.rows, revision: context.revision });
  seen.setColumnOrder = setOrderFromUI;
  return <FileTreeView context={context} />;
}
const recordingRenderers = {
  filetree: { ...fileTreeRenderer, View: RecordingFileTree },
};

// The host's order; the second row's id is also a column id.
const PAGE: PageRow[] = [
  { id: "1", name: "Alpha" },
  { id: "name", name: "Bravo" },
];

for (const syncUrl of [false, true]) {
  it(`keeps the page rows in the host's order, one array until the data changes, with syncUrl=${syncUrl}`, async () => {
    let answer: ((result: PageResult) => void) | undefined;
    const queryFn = () =>
      new Promise<PageResult>((resolve) => {
        answer = resolve;
      });
    seen.pages = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { root } = mount();
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Provider store={createStore()}>
            <NuqsTestingAdapter hasMemory>
              <TableStateSyncProvider enabled={syncUrl}>
                <PageProbe queryFn={queryFn} />
              </TableStateSyncProvider>
            </NuqsTestingAdapter>
          </Provider>
        </QueryClientProvider>
      )
    );
    await settle();
    // While the page loads, every render shares one empty page.
    await changeColumnOrder(["name", "id"]);
    await act(() => seen.rerender?.());
    expect(answer).toBeDefined();
    expect(new Set(seen.pages).size).toBe(1);
    expect(seen.pages[0]).toEqual([]);

    await act(async () => {
      answer?.({ data: PAGE, pageCount: 1, rowCount: PAGE.length });
      await wait();
    });
    const page = seen.pages.at(-1);
    // The `order` key is the column order: rows never sort by it.
    expect(page?.map((row) => row.id)).toEqual(["1", "name"]);
    const renders = seen.pages.length;
    await changeColumnOrder(["id", "name"]);
    await act(() => seen.rerender?.());
    expect(seen.pages.length).toBeGreaterThan(renders);
    expect(new Set(seen.pages.slice(renders - 1)).size).toBe(1);
    expect(seen.pages.at(-1)).toBe(page);
    client.clear();
  });

  it(`hands the File tree the same rows, without a list call, when the table renders again, with syncUrl=${syncUrl}`, async () => {
    const requests: AssetRequest[] = [];
    const actions = createAssetActions({
      log: (request) => requests.push(request),
    }) as unknown as TableActions;
    const config = defineTableConfig({
      id: "page-rows-assets",
      columns: {
        definitions: assetColumns,
        order: assetColumns.map((column) => column.id),
        visible: assetVisibleColumns,
        mandatory: ["name"],
      },
      table: {
        syncUrl,
        enableViews: false,
        defaultDisplayMode: "filetree",
        displayModes: ["filetree", "table"],
        filetree: assetTableOptions.filetree,
      },
      translations: {
        namespace: "page-rows-assets",
        keys: { title: "Assets" },
      },
    });
    seen.renders = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Hosts often pass new callbacks each time they render.
    const renderTable = () => (
      <NuqsTestingAdapter hasMemory>
        <DataTable
          displayModeRenderers={recordingRenderers}
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions}
          getTableConfig={() => config}
          queryClient={client}
          tableType="page-rows-assets"
        />
      </NuqsTestingAdapter>
    );
    const { container, root } = mount();
    // The tree loads on its own: let its answers land inside `act`.
    const renderAgain = () =>
      act(async () => {
        root.render(renderTable());
        await wait();
      });
    await renderAgain();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (container.querySelector('[role="row"][aria-label="Office.jpg"]')) {
        break;
      }
      await act(() => wait());
    }
    await settle();
    expect(
      container.querySelector('[role="row"][aria-label="Office.jpg"]')
    ).not.toBeNull();
    const loaded = seen.renders.at(-1);
    const renders = seen.renders.length;
    requests.length = 0;

    await changeColumnOrder(assetColumns.map((column) => column.id).reverse());
    await renderAgain();
    await settle();
    expect(seen.renders.length).toBeGreaterThan(renders);
    for (const render of seen.renders.slice(renders)) {
      expect(render.rows).toBe(loaded?.rows);
      expect(render.revision).toBe(loaded?.revision as number);
    }
    expect(requests).toEqual([]);
    client.clear();
  });
}
