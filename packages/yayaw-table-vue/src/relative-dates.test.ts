import { it } from "vitest";
import { relativeDatesSuite } from "../../../tests/relative-dates-suite";
import { defineTableConfig } from "./config";
import {
  isDateFilterValue,
  isRelativeDateToken,
  localeWeekStart,
  relativeDateFieldLabel,
  relativeDateLabel,
  resolveRelativeDate,
  resolveRelativeDateRule,
} from "./date-filter-days";
import { exportMatrix } from "./export-model";
import { filterHasValue } from "./filter-config";
import {
  compatibleListParams,
  generateDataTypeFields,
  matchesContractFilter,
  resolveDataTypeEditor,
  resolveFilterTokens,
  tableFilterContext,
} from "./table-contracts";
import type {
  AdvancedFilter,
  ColumnDefinition,
  TableBehaviorConfig,
} from "./types";
import {
  columnDateFormat,
  dateTimeFromInput,
  dateTimeInputValue,
  formatColumnValue,
} from "./value-format";

relativeDatesSuite(
  it,
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
      filterHasValue({
        id: "due",
        columnId: "due",
        type: "date",
        operator,
        values,
      } as AdvancedFilter),
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
