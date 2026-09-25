import { test } from "bun:test";
import {
  formatViewMove,
  getTableViewOrderStorageKey,
  listedViewOrder,
  moveViewInOrder,
  orderableViewIds,
  orderViews,
  parseViewOrder,
  readStoredViewOrder,
  storeViewOrder,
  viewMoves,
  viewPosition,
} from "../src/components/ui/yayaw-table/utils/view-order";
import { viewOrderSuite } from "./view-order-suite";

viewOrderSuite(test, {
  formatViewMove,
  getTableViewOrderStorageKey,
  listedViewOrder,
  moveViewInOrder,
  orderableViewIds,
  orderViews,
  parseViewOrder,
  readStoredViewOrder,
  storeViewOrder,
  viewMoves,
  viewPosition,
});
