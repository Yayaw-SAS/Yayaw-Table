import { mount } from "@vue/test-utils";
import { it } from "vitest";
import { defineComponent } from "vue";
import { dateFilterDaysSuite } from "../../../tests/date-filter-days-suite";
import { calendarScope } from "./calendar-model";
import { chartBucketRange } from "./chart-model";
import {
  type TableStateRefs,
  useTableState,
} from "./composables/use-table-state";
import { defineTableConfig } from "./config";
import { dashboardViewParams } from "./dashboard/dashboard-model";
import {
  addCalendarDays,
  calendarDay,
  dateFilterDays,
  isCalendarDay,
  normalizeDateFilterRule,
  normalizeDateFilterRules,
  todayCalendarDay,
} from "./date-filter-days";
import { matchesContractFilter } from "./table-contracts";
import type { TableViewConfig } from "./types";
import { areViewSettingsEqual } from "./view-menu";

const config = defineTableConfig({
  id: "days",
  translations: { namespace: "days", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      { id: "due", header: "Due", type: "date" },
    ],
    visible: ["name", "due"],
    order: ["name", "due"],
    mandatory: ["name"],
  },
});

/** The table's state, as a mounted table holds it. */
const withState = <T>(
  syncUrl: boolean,
  read: (state: TableStateRefs) => T
): T => {
  let state!: TableStateRefs;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useTableState({ config, syncUrl });
        return () => null;
      },
    })
  );
  try {
    return read(state);
  } finally {
    wrapper.unmount();
  }
};

dateFilterDaysSuite(
  it,
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
    readUrlRules: (value) => {
      const url = new URL(window.location.href);
      url.search = new URLSearchParams({
        "days-advancedFilters": value,
      }).toString();
      window.history.replaceState(null, "", url);
      try {
        return withState(true, (state) => [
          ...state.advancedFilters.value.filters,
        ]) as unknown as Record<string, unknown>[];
      } finally {
        window.history.replaceState(null, "", window.location.pathname);
      }
    },
    applyViewRules: (view) =>
      withState(false, (state) => {
        state.applyView(view as TableViewConfig);
        return [...state.advancedFilters.value.filters];
      }) as unknown as Record<string, unknown>[],
  }
);
