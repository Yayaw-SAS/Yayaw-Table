import { test } from "bun:test";
import { parseAdvancedFiltersParam } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { TableViewConfig } from "../src/components/ui/yayaw-table/types/view-types";
import { calendarScope } from "../src/components/ui/yayaw-table/utils/calendar-model";
import { chartBucketRange } from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  addCalendarDays,
  calendarDay,
  dateFilterDays,
  isCalendarDay,
  normalizeDateFilterRule,
  normalizeDateFilterRules,
  todayCalendarDay,
} from "../src/components/ui/yayaw-table/utils/date-filter-days";
import { matchesContractFilter } from "../src/components/ui/yayaw-table/utils/table-contracts";
import { normalizeTableViewConfig } from "../src/components/ui/yayaw-table/utils/table-view-state";
import { areViewSettingsEqual } from "../src/components/ui/yayaw-table/utils/view-menu";
import { dashboardViewParams } from "../src/components/ui/yayaw-table-dashboard/dashboard-model";
import { dateFilterDaysSuite } from "./date-filter-days-suite";

dateFilterDaysSuite(
  test,
  {
    addCalendarDays,
    areViewSettingsEqual,
    calendarDay,
    calendarScope,
    chartBucketRange,
    dashboardViewParams,
    dateFilterDays,
    isCalendarDay,
    matchesContractFilter,
    normalizeDateFilterRule,
    normalizeDateFilterRules,
    todayCalendarDay,
  },
  {
    readUrlRules: (value) =>
      parseAdvancedFiltersParam(value) as unknown as Record<string, unknown>[],
    applyViewRules: (config) =>
      (normalizeTableViewConfig(config as TableViewConfig).advancedFilters ??
        []) as unknown as Record<string, unknown>[],
  }
);
