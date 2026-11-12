/**
 * Success and warning tones, which shadcn themes have no token for. A theme
 * sets `--yayaw-success` and `--yayaw-warning` (as `tag-items.ts` reads them
 * for system tags); the values after the comma only apply without them. Keep
 * every status colour of the table here, so a theme changes them all at once.
 */
export const SUCCESS_TEXT =
  "text-[var(--yayaw-success,#15803d)] dark:text-[var(--yayaw-success,#4ade80)]";
export const SUCCESS_SURFACE =
  "bg-[color-mix(in_oklab,var(--yayaw-success,#22c55e)_12%,transparent)]";
export const WARNING_TEXT =
  "text-[var(--yayaw-warning,#b45309)] dark:text-[var(--yayaw-warning,#fbbf24)]";
export const WARNING_SURFACE =
  "bg-[color-mix(in_oklab,var(--yayaw-warning,#f59e0b)_10%,transparent)]";
export const WARNING_BORDER =
  "border-[color-mix(in_oklab,var(--yayaw-warning,#f59e0b)_40%,transparent)]";
/** A dot that marks unsaved or pending changes. */
export const WARNING_DOT = "bg-[var(--yayaw-warning,#f59e0b)]";
