import { test } from "bun:test";
import {
  createDashboardSourceLoader,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
  isDashboardSourceUnavailable,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-sources";
import { dashboardSourcesSuite } from "./dashboard-sources-suite";

dashboardSourcesSuite(test, {
  createDashboardSourceLoader,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
  isDashboardSourceUnavailable,
});
