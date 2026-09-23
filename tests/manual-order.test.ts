import { expect, test } from "bun:test";
import { cycleColumnSort } from "../src/components/ui/yayaw-table/components/toolbar/sections/table-sort-menu";
import {
  isManualOrder,
  manualOrderSorting,
  moveInOrder,
  withManualOrderView,
} from "../src/components/ui/yayaw-table/utils/manual-order";
import { manualOrderSuite } from "./manual-order-suite";

manualOrderSuite(test, {
  isManualOrder,
  manualOrderSorting,
  moveInOrder,
  withManualOrderView,
});

test("choosing a column sort leaves the view's manual order", () => {
  expect(cycleColumnSort(manualOrderSorting(), "name")).toEqual([
    { id: "name", desc: false },
  ]);
});
