import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { defineComponent, h, markRaw, type PropType, watch } from "vue";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../../../../examples/assets";
import { defineTableConfig } from "../config";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import FileTreeView from "../filetree/FileTreeView.vue";
import { fileTreeRenderer } from "../filetree/filetree-renderer";
import type { TableActions } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

// How a table loads, as in React `tests/table-loading.test.tsx`: its view
// loads its data once, then again for a new query or a change to the data.

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});
const settle = async (frames = 4) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  await flushPromises();
};

const OFFICE = '[role="row"][aria-label="Office.jpg"]';
const BANNER = '[role="row"][aria-label="Banner 10.jpg"]';
/** The tree's root and the folders it opens at first, sorted. */
const TREE_LOAD = [
  "children:f-brand",
  "children:f-campaigns",
  "children:f-photos",
  "children:root",
];

const sorted = (names: string[]) => [...names].sort();

/** The revisions the File tree saw, in order. */
const revisions: number[] = [];
/** The built-in File tree, recording its context's revision. */
const RecordingFileTree = defineComponent({
  props: {
    context: {
      type: Object as PropType<DisplayModeRenderContext>,
      required: true,
    },
  },
  setup(props) {
    watch(
      () => props.context.revision,
      (revision) => {
        revisions.push(revision);
      },
      { immediate: true }
    );
    return () => h(FileTreeView, { context: props.context });
  },
});
// Components stay plain objects, as a host keeps them.
const recordingRenderers = markRaw({
  filetree: { ...fileTreeRenderer, view: RecordingFileTree },
});

/** "page", or the scope and the folder it lists ("children:root"). */
const requestName = ({ parentId, scope }: AssetRequest): string => {
  if (!scope) {
    return "page";
  }
  return parentId === undefined ? scope : `${scope}:${parentId ?? "root"}`;
};

/** The demos' Assets table, naming each request its host receives. */
async function mountAssets() {
  revisions.length = 0;
  const requests: string[] = [];
  const actions = createAssetActions({
    log: (request) => {
      requests.push(requestName(request));
    },
  });
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
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      tableType: "assets",
      config,
      displayModeRenderers: recordingRenderers,
      getTableActions: () => actions as unknown as TableActions,
    },
  });
  for (let frame = 0; frame < 50 && !wrapper.find(OFFICE).exists(); ) {
    frame += 1;
    await settle(1);
  }
  // A new revision would load the tree again by now.
  await settle();
  return { requests, wrapper };
}

it("lists the File tree's root and each folder it opens once at load", async () => {
  const { requests, wrapper } = await mountAssets();
  expect(wrapper.find(OFFICE).exists()).toBe(true);
  expect(requests[0]).toBe("page");
  expect(sorted(requests)).toEqual([...TREE_LOAD, "page"]);
  // The URL read on mount and the first page change nothing for the view.
  expect(revisions).toEqual([1]);
});

it("loads the tree again after a refresh, and once for a new search", async () => {
  const { requests, wrapper } = await mountAssets();
  requests.length = 0;
  await wrapper.vm.refresh();
  await settle();
  expect(revisions).toEqual([1, 2]);
  expect(sorted(requests)).toEqual([...TREE_LOAD, "page"]);

  requests.length = 0;
  await wrapper.get('input[type="search"]').setValue("banner");
  // The page waits for the search debounce (300 ms).
  await settle(12);
  expect(wrapper.find(BANNER).exists()).toBe(true);
  expect(sorted(requests)).toEqual(["page", "tree-matches"]);
  expect(revisions).toEqual([1, 2, 3]);
});
