import { test } from "bun:test";
import { isValidFilterValue } from "../src/components/ui/yayaw-table/components/filters/filter-value-input";
import {
  type ColumnDefinition,
  defineTableConfig,
  type TableBehaviorConfig,
} from "../src/components/ui/yayaw-table/config/helpers";
import type {
  FilterOperators,
  FilterValues,
} from "../src/components/ui/yayaw-table/types/filter-types";
import {
  isDateFilterValue,
  isRelativeDateToken,
  localeWeekStart,
  relativeDateFieldLabel,
  relativeDateLabel,
  resolveRelativeDate,
  resolveRelativeDateRule,
} from "../src/components/ui/yayaw-table/utils/date-filter-days";
import { exportMatrix } from "../src/components/ui/yayaw-table/utils/export-model";
import {
  compatibleListParams,
  generateDataTypeFields,
  matchesContractFilter,
  resolveDataTypeEditor,
  resolveFilterTokens,
  tableFilterContext,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import {
  columnDateFormat,
  dateTimeFromInput,
  dateTimeInputValue,
  formatColumnValue,
} from "../src/components/ui/yayaw-table/utils/value-format";
import { relativeDatesSuite } from "./relative-dates-suite";

relativeDatesSuite(
  test,
  {
    columnDateFormat,
    compatibleListParams,
    dateTimeFromInput,
    dateTimeInputValue,
    exportMatrix,
    formatColumnValue,
    generateDataTypeFields,
    isDateFilterValue,
    isRelativeDateToken,
    localeWeekStart,
    matchesContractFilter,
    relativeDateFieldLabel,
    relativeDateLabel,
    resolveDataTypeEditor,
    resolveFilterTokens,
    resolveRelativeDate,
    resolveRelativeDateRule,
    tableFilterContext,
  },
  {
    acceptsDateRule: (operator, values) =>
      isValidFilterValue(
        "date",
        operator as FilterOperators["date"],
        values as FilterValues<"date">
      ),
    configuredPreset: (column, table) =>
      defineTableConfig({
        id: "relative",
        translations: { namespace: "relative", keys: {} },
        table: table as Partial<TableBehaviorConfig> | undefined,
        columns: {
          definitions: [column as unknown as ColumnDefinition],
          mandatory: [],
          order: [],
          visible: [],
        },
      }).columns.definitions[0]?.dateDisplayPreset,
  }
);
