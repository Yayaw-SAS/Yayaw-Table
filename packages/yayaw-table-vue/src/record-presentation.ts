/** Shared presentation contract for consultation, create, edit, and bulk edit. */
export type RecordPresentation = "drawer" | "modal" | "inline";
export type RecordPresentationConfig =
  | RecordPresentation
  | { desktop: RecordPresentation; mobile?: RecordPresentation };

export const RECORD_MOBILE_QUERY = "(max-width: 767px)";

/** A table-wide choice overrides legacy per-form or per-details settings. */
export function resolveRecordPresentation(
  presentation: RecordPresentationConfig | undefined,
  mobile: boolean,
  legacy?: RecordPresentationConfig
): RecordPresentation {
  const selected = presentation ?? legacy ?? "drawer";
  if (typeof selected === "string") {
    return selected;
  }
  return mobile ? (selected.mobile ?? selected.desktop) : selected.desktop;
}

export function recordSurfaceWidth(
  presentation: RecordPresentation,
  width?: string
): string {
  return width ?? (presentation === "modal" ? "48rem" : "40rem");
}
