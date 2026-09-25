import { it } from "vitest";
import { viewOrderSuite } from "../../../tests/view-order-suite";
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
} from "./view-order";

viewOrderSuite(it, {
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
