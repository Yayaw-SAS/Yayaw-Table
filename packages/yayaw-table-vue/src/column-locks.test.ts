import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import {
  lockedColumnOrder,
  lockedColumnPinning,
  lockedColumnVisibility,
} from "./column-locks";
import YayawDataTable from "./components/YayawDataTable.vue";
import {
  type TableStateRefs,
  useTableState,
} from "./composables/use-table-state";
import { defineTableConfig } from "./config";

const config = defineTableConfig({
  id: "locks",
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      {
        id: "amount",
        header: "Amount",
        type: "number",
        defaultCalculation: "sum",
      },
    ],
    mandatory: ["name"],
    visible: ["name", "amount"],
    order: ["amount", "name"],
  },
  table: { enableCalculations: true },
  translations: { keys: {}, namespace: "locks" },
});
const invalid = {
  columnOrder: ["actions", "amount", "select", "name"],
  columnVisibility: {
    select: false,
    actions: false,
    name: false,
    amount: true,
  },
  pinning: { left: ["actions", "amount"], right: ["select"] },
};
enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

describe("utility column locks", () => {
  it("normalizes duplicates and unknown IDs without unlocking utility columns", () => {
    expect(
      lockedColumnOrder(
        ["actions", "name", "name", "unknown"],
        ["name", "amount"]
      )
    ).toEqual(["select", "name", "amount", "actions"]);
    expect(lockedColumnOrder(null, ["name"])).toEqual([
      "select",
      "name",
      "actions",
    ]);
    expect(lockedColumnVisibility(invalid.columnVisibility, ["name"])).toEqual({
      select: true,
      actions: true,
      name: true,
      amount: true,
    });
    expect(
      lockedColumnPinning(
        {
          left: ["actions", "name"],
          right: ["name", "select", "amount", "unknown"],
        },
        ["name", "amount"]
      )
    ).toEqual({ left: ["select", "name"], right: ["amount", "actions"] });
    expect(
      lockedColumnPinning(invalid.pinning, ["name", "amount"], false)
    ).toEqual({ left: ["select"], right: ["actions"] });
  });

  it("enforces the same locks on applied views, direct changes, reset, and snapshots", () => {
    let state!: TableStateRefs;
    mount(
      defineComponent({
        setup() {
          state = useTableState({ config, syncUrl: false });
          return () => h("div");
        },
      })
    );
    state.applyView(invalid);
    expect(state.order.value).toEqual(["select", "amount", "name", "actions"]);
    expect(state.pinning.value).toEqual({
      left: ["select", "amount"],
      right: ["actions"],
    });
    expect(state.visibility.value.name).toBe(true);
    state.pinning.value.right = [];
    state.visibility.value.actions = false;
    expect(state.snapshot.value.pinning?.right).toEqual(["actions"]);
    expect(state.snapshot.value.columnVisibility?.actions).toBe(true);
    state.reset();
    expect(state.order.value.at(-1)).toBe("actions");
    expect(state.pinning.value).toEqual({
      left: ["select"],
      right: ["actions"],
    });
  });

  it("restores URL state safely and keeps pinned headers, body, and footer aligned", async () => {
    const query = new URLSearchParams({
      "locks-order": JSON.stringify(invalid.columnOrder),
      "locks-visibility": JSON.stringify(invalid.columnVisibility),
      "locks-pinning": JSON.stringify(invalid.pinning),
    });
    window.history.replaceState({}, "", `/?${query}`);
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "locks",
        config,
        data: [{ id: "1", name: "Alpha", amount: 42 }],
        getTableActions: () => ({ update: () => ({ success: true }) }),
      },
    });
    await flushPromises();
    const headers = wrapper.findAll("thead th");
    expect(headers).toHaveLength(4);
    expect(headers[0]?.find('input[type="checkbox"]').exists()).toBe(true);
    expect(headers[1]?.text()).toContain("Amount");
    expect(headers[2]?.text()).toContain("Name");
    expect(headers[3]?.text()).toContain("Actions");
    expect(headers[3]?.attributes("style")).toContain("right: 0px");
    expect(headers[0]?.attributes("draggable")).toBe("false");
    expect(headers[3]?.attributes("draggable")).toBe("false");
    expect(wrapper.findAll("tbody td")[1]?.text()).toContain("42");
    expect(
      wrapper
        .findAll("tfoot td")[1]
        ?.find('[aria-label="Calculate amount"]')
        .exists()
    ).toBe(true);
    await headers[3]?.trigger("dragstart");
    await headers[1]?.trigger("drop");
    expect(wrapper.findAll("thead th").at(-1)?.text()).toContain("Actions");
  });
});
