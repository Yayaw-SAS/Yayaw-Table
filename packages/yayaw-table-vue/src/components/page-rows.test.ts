import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { defineComponent, h, markRaw, type PropType } from "vue";
import {
  type AssetRequest,
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../../../../examples/assets";
import { defineTableConfig } from "../config";
import { useTableContext } from "../context";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import FileTreeView from "../filetree/FileTreeView.vue";
import { fileTreeRenderer } from "../filetree/filetree-renderer";
import type { TableActions } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

type Row = Record<string, unknown>;

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

/** What the table hands the File tree, read at any time. */
const seen = {
  current: undefined as
    | (() => Pick<DisplayModeRenderContext, "revision" | "rows">)
    | undefined,
  setColumnOrder: undefined as ((order: string[]) => void) | undefined,
};

/** The built-in File tree, exposing its context and the table's column order. */
const RecordingFileTree = defineComponent({
  props: {
    context: {
      type: Object as PropType<DisplayModeRenderContext>,
      required: true,
    },
  },
  setup(props) {
    const table = useTableContext();
    seen.current = () => ({
      revision: props.context.revision,
      rows: props.context.rows,
    });
    seen.setColumnOrder = (order) => {
      table.state.order.value = order;
    };
    return () => h(FileTreeView, { context: props.context });
  },
});
// Components stay plain objects, as a host keeps them.
const recordingRenderers = markRaw({
  filetree: { ...fileTreeRenderer, view: RecordingFileTree },
});

for (const syncUrl of [false, true]) {
  it(`hands the File tree the same rows, without a list call, when the column order changes, with syncUrl=${syncUrl}`, async () => {
    const requests: AssetRequest[] = [];
    const actions = createAssetActions({
      log: (request) => requests.push(request),
    });
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
    const wrapper = mount(YayawDataTable, {
      attachTo: document.body,
      props: {
        tableType: "page-rows-assets",
        config,
        displayModeRenderers: recordingRenderers,
        getTableActions: () => actions as unknown as TableActions,
        getRowId: (row: Row) => String(row.id),
      },
    });
    const office = '[role="row"][aria-label="Office.jpg"]';
    for (let attempt = 0; attempt < 50 && !wrapper.find(office).exists(); ) {
      attempt += 1;
      await settle(1);
    }
    await settle();
    expect(wrapper.find(office).exists()).toBe(true);
    const loaded = seen.current?.();
    requests.length = 0;

    const order = assetColumns.map((column) => column.id).reverse();
    seen.setColumnOrder?.(order);
    // Hosts often pass new callbacks each time they render.
    await wrapper.setProps({ getRowId: (row: Row) => String(row.id) });
    await settle();
    expect(wrapper.vm.getViewConfig().columnOrder).toEqual(order);
    expect(seen.current?.().rows).toBe(loaded?.rows);
    expect(seen.current?.().revision).toBe(loaded?.revision);
    expect(requests).toEqual([]);
  });
}
