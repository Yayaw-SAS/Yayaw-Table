import type {
  BulkActionsMenuPositionMode,
  BulkActionsPosition,
} from "./bulk-actions-menu";

export function getBulkActionsMenuPositionMode(
  position: BulkActionsPosition = "bottom"
): BulkActionsMenuPositionMode {
  return position === "top" ? "top" : "fixed";
}
