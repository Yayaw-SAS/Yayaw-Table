import { test } from "bun:test";
import { planningFormatters } from "../src/components/ui/yayaw-table/planning/format";
import { calendarEvents } from "../src/components/ui/yayaw-table/utils/calendar-model";
import {
  connectorLabels,
  formatSyncValue,
} from "../src/components/ui/yayaw-table/utils/connector-flow";
import { exportMatrix } from "../src/components/ui/yayaw-table/utils/export-model";
import {
  feedPropertyValue,
  feedTitleText,
  formatFeedAbsoluteDate,
  groupFeedRows,
} from "../src/components/ui/yayaw-table/utils/feed-view";
import {
  formatFileTreeValue,
  formatRelativeDate,
} from "../src/components/ui/yayaw-table/utils/filetree-model";
import { formDateDisplay } from "../src/components/ui/yayaw-table/utils/form-view";
import {
  mapMarkers,
  mapPopupProperties,
} from "../src/components/ui/yayaw-table/utils/map-model";
import {
  detailDisplay,
  detailLabels,
  detailSections,
} from "../src/components/ui/yayaw-table/utils/record-details";
import {
  fieldText,
  groupedValueLabel,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import { formatColumnCalculation } from "../src/components/ui/yayaw-table/utils/value-format";
import { dashboardDateRangeText } from "../src/components/ui/yayaw-table-dashboard/dashboard-model";
import { formatMatrixSuite } from "./format-matrix-suite";

formatMatrixSuite(test, {
  calendarEvents,
  connectorLabels,
  formatSyncValue,
  dashboardDateRangeText,
  detailDisplay,
  detailLabels,
  detailSections,
  exportMatrix,
  feedPropertyValue,
  feedTitleText,
  formatFeedAbsoluteDate,
  groupFeedRows,
  formatFileTreeValue,
  formatRelativeDate,
  formDateDisplay,
  mapMarkers,
  mapPopupProperties,
  fieldText,
  groupedValueLabel,
  formatColumnCalculation,
  planningFormatters,
});
