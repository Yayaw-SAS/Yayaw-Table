import { it } from "vitest";
import { dashboardSourcesSuite } from "../../../tests/dashboard-sources-suite";
import {
  createDashboardSourceLoader,
  isDashboardSourceUnavailable,
} from "./dashboard/dashboard-sources";

dashboardSourcesSuite(it, {
  createDashboardSourceLoader,
  isDashboardSourceUnavailable,
});
