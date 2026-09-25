import { it } from "vitest";
import { dashboardSourcesSuite } from "../../../tests/dashboard-sources-suite";
import {
  createDashboardSourceLoader,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
  isDashboardSourceUnavailable,
} from "./dashboard/dashboard-sources";

dashboardSourcesSuite(it, {
  createDashboardSourceLoader,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
  isDashboardSourceUnavailable,
});
