/**
 * The values a reader picks for a dashboard's filters live in the page URL
 * (`?<dashboardId>.<filterId>=…`), never in the document: a link or a reload
 * keeps them. Shared by the React and Vue editions (synced to Vue); the
 * encoding is `dashboard-model.ts`'s.
 */
import {
  type DashboardViewerFilters,
  readDashboardFilterValues,
  writeDashboardFilterValues,
} from "./dashboard-model";
import type { Dashboard } from "./dashboard-schema";

type FilterDocument = Pick<Dashboard, "id" | "filters">;

/** The reader's filter values the page URL holds for this dashboard (none on a server). */
export function readDashboardUrlFilters(
  dashboard: FilterDocument
): Record<string, DashboardViewerFilters[string]> {
  return typeof window === "undefined"
    ? {}
    : readDashboardFilterValues(dashboard, window.location.search);
}

/**
 * Writes the reader's filter values to the page URL (replacing the current
 * history entry), leaving every other key, the table's included, as it is.
 */
export function writeDashboardUrlFilters(
  dashboard: FilterDocument,
  values: DashboardViewerFilters
): void {
  if (typeof window === "undefined") {
    return;
  }
  const search = writeDashboardFilterValues(
    dashboard,
    window.location.search,
    values
  );
  const url = new URL(window.location.href);
  url.search = search;
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
}
