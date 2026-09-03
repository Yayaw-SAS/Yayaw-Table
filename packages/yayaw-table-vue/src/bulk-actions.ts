import type { BulkActionResult, TableRecord } from "./types";

export interface ResolvedBulkActionResult {
  success: boolean;
  clearSelection: boolean;
  closeMenu: boolean;
  message?: string;
}

export const resolveBulkActionResult = (
  result: BulkActionResult | undefined,
  failureMessage: string,
  defaults = { clearSelection: false, closeMenu: true }
): ResolvedBulkActionResult => {
  const success = result?.success !== false;
  return {
    success,
    clearSelection:
      result?.clearSelection ??
      result?.closeMenu ??
      (success && defaults.clearSelection),
    closeMenu: result?.closeMenu ?? (success && defaults.closeMenu),
    message:
      result?.message?.trim() ||
      result?.error?.trim() ||
      (success ? undefined : failureMessage),
  };
};

export const parseBulkEditPatch = (input: string): TableRecord => {
  const patch: unknown = JSON.parse(input);
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Enter a valid JSON object.");
  }
  return patch as TableRecord;
};
