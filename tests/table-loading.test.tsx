import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, useEffect, useState } from "react";
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
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { DisplayModeRenderContext } from "../src/components/ui/yayaw-table/types/display-mode-renderer";
import type { AdvancedFiltersState } from "../src/components/ui/yayaw-table/types/filter-types";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

// How a table loads, as in Vue `table-loading.test.ts`: the first page under
// the loading state, then its views mount once, with the rows.

type Row = Record<string, unknown>;

const SKELETON = '[data-slot="skeleton"]';
const EMPTY_STATE = "No data available";
const TREE = '[role="treegrid"]';
const OFFICE = '[role="row"][aria-label="Office.jpg"]';
/** The page, the tree's root and the folders it opens at first, sorted. */
const FIRST_LOAD = [
  "children:f-brand",
  "children:f-campaigns",
  "children:f-photos",
  "children:root",
  "page",
];

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
});
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
/** Short `act` frames: one long `act` lets React Query move one step only. */
const settle = async (until: () => boolean = () => false, frames = 30) => {
  for (let frame = 0; frame < frames && !until(); frame += 1) {
    await act(() => wait());
  }
};
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
};

/** What the File tree had each time it mounted. */
const mounts: { revision: number; rows: number }[] = [];

/** The built-in File tree, recording its mounts. */
function RecordingFileTree({ context }: { context: DisplayModeRenderContext }) {
  const [mounted] = useState(() => ({
    revision: context.revision,
    rows: context.rows.length,
  }));
  useEffect(() => {
    mounts.push(mounted);
  }, [mounted]);
  return <FileTreeView context={context} />;
}
const recordingRenderers = {
  filetree: { ...fileTreeRenderer, View: RecordingFileTree },
};

/** "page", or the scope and the folder it lists ("children:root"). */
const requestName = ({ parentId, scope }: AssetRequest): string => {
  if (!scope) {
    return "page";
  }
  return parentId === undefined ? scope : `${scope}:${parentId ?? "root"}`;
};

/** The demos' Assets table, naming each request its host receives. */
function assetsTable(requests: string[]) {
  const actions = createAssetActions({
    log: (request) => {
      requests.push(requestName(request));
    },
  }) as unknown as TableActions;
  const config = defineTableConfig({
    id: "assets",
    columns: {
      definitions: assetColumns,
      order: assetColumns.map((column) => column.id),
      visible: assetVisibleColumns,
      mandatory: ["name"],
    },
    table: assetTableOptions,
    translations: { namespace: "assets", keys: { title: "Assets" } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <Provider store={createStore()}>
      <NuqsTestingAdapter hasMemory>
        <DataTable
          displayModeRenderers={recordingRenderers}
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions}
          getTableConfig={() => config}
          queryClient={client}
          tableType="assets"
        />
      </NuqsTestingAdapter>
    </Provider>
  );
}

it("loads its first page under the loading state, then mounts its view once, with the rows", async () => {
  mounts.length = 0;
  const requests: string[] = [];
  const { container, root } = mount();
  act(() => root.render(assetsTable(requests)));
  // No empty table (and view) first, for the rows to replace.
  expect(container.querySelector(SKELETON)).not.toBeNull();
  expect(container.querySelector(TREE)).toBeNull();
  expect(requests).toEqual(["page"]);

  await settle(() => container.querySelector(OFFICE) !== null);
  expect(container.querySelector(OFFICE)).not.toBeNull();
  expect(mounts).toEqual([{ revision: 1, rows: 10 }]);
});

it("lists the File tree's root and each folder it opens once at load", async () => {
  const requests: string[] = [];
  const { container, root } = mount();
  await act(async () => {
    root.render(assetsTable(requests));
    await wait();
  });
  await settle(() => container.querySelector(OFFICE) !== null);
  // A second mount or a new revision would load the tree again by now.
  await settle(undefined, 5);
  expect([...requests].sort()).toEqual(FIRST_LOAD);
});

const PRODUCTS: Row[] = [
  { id: "1", name: "Alpha", status: "Open" },
  { id: "2", name: "Bravo", status: "Closed" },
  { id: "3", name: "Charlie", status: "Open" },
];
const productsConfig = defineTableConfig({
  id: "loading-products",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "text" },
    ],
    order: ["name", "status"],
    visible: ["name", "status"],
    mandatory: ["name"],
  },
  table: { displayModes: ["table"], enableViews: false },
  translations: { namespace: "loading-products", keys: { title: "Products" } },
});
const OPEN_RULE = {
  id: "open",
  columnId: "status",
  type: "text",
  operator: "contains",
  values: ["Open"],
  isActive: true,
};

/** A list of the products that answers once released. */
function heldProducts() {
  const calls: Row[] = [];
  const answers: (() => void)[] = [];
  return {
    calls,
    list: async (params: Row) => {
      calls.push(params);
      await new Promise<void>((resolve) => answers.push(resolve));
      const rules = compatibleListParams(params).advancedFilters as Row[];
      const data = PRODUCTS.filter((row) =>
        rules.every((rule) =>
          matchesContractFilter(row[String(rule.columnId)], rule)
        )
      );
      return { data, meta: { pageCount: 1, totalCount: data.length } };
    },
    release: () => {
      for (const answer of answers.splice(0)) {
        answer();
      }
    },
  };
}

let urlState: ReturnType<typeof useTableUrlState> | undefined;
/** Writes the products table's URL state, as its toolbar does. */
function UrlStateProbe() {
  urlState = useTableUrlState({ tableId: "loading-products" });
  return null;
}

it("shows the loading state while a new query loads, then its rows", async () => {
  const { calls, list, release } = heldProducts();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { container, root } = mount();
  const text = () => container.textContent ?? "";
  await act(() => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getRowId={(row) => String(row.id)}
            getTableActions={() => ({ list })}
            getTableConfig={() => productsConfig}
            queryClient={client}
            tableType="loading-products"
          />
          <UrlStateProbe />
        </NuqsTestingAdapter>
      </Provider>
    );
  });
  await settle(() => calls.length > 0);
  release();
  await settle(() => text().includes("Bravo"));
  expect(container.querySelector(SKELETON)).toBeNull();

  await act(() => {
    urlState?.setAdvancedFiltersFromUI([
      OPEN_RULE,
    ] as unknown as AdvancedFiltersState);
  });
  await settle(() => calls.length > 1);
  expect(compatibleListParams(calls[1] ?? {}).advancedFilters).toEqual([
    expect.objectContaining({ columnId: "status", values: ["Open"] }),
  ]);
  // Neither the previous rows nor an empty table while the query loads.
  expect(container.querySelector(SKELETON)).not.toBeNull();
  expect(text()).not.toContain("Bravo");
  expect(text()).not.toContain(EMPTY_STATE);

  release();
  await settle(() => text().includes("Alpha"));
  expect(container.querySelector(SKELETON)).toBeNull();
  expect(text()).toContain("Charlie");
  expect(text()).not.toContain("Bravo");
  expect(calls).toHaveLength(2);
});
