import { it } from "vitest";
import { formatMatrixSuite } from "../../../tests/format-matrix-suite";
import { calendarEvents } from "./calendar-model";
import { connectorLabels, formatSyncValue } from "./connector-flow";
import { dashboardDateRangeText } from "./dashboard/dashboard-model";
import { exportMatrix } from "./export-model";
import {
  feedPropertyValue,
  feedTitleText,
  formatFeedAbsoluteDate,
  groupFeedRows,
} from "./feed-view";
import { formatFileTreeValue, formatRelativeDate } from "./filetree-model";
import { formDateDisplay } from "./form-view";
import { mapMarkers, mapPopupProperties } from "./map-model";
import { planningFormatters } from "./planning/format";
import { detailDisplay, detailLabels, detailSections } from "./record-details";
import { fieldText, groupedValueLabel } from "./table-contracts";
import { formatColumnCalculation } from "./value-format";

formatMatrixSuite(it, {
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
