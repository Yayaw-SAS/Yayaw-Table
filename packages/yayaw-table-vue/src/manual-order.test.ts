import { it } from "vitest";
import { manualOrderSuite } from "../../../tests/manual-order-suite";
import {
  isManualOrder,
  manualOrderSorting,
  moveInOrder,
  withManualOrderView,
} from "./manual-order";

manualOrderSuite(it, {
  isManualOrder,
  manualOrderSorting,
  moveInOrder,
  withManualOrderView,
});
