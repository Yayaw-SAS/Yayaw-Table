import { test } from "bun:test";
import {
  type ColumnDefinition,
  defineTableConfig,
  type TableBehaviorConfig,
} from "../src/components/ui/yayaw-table/config/helpers";
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
  type FilterMenuRule,
  filterRuleComplete,
} from "../src/components/ui/yayaw-table/utils/filter-menu";
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
      filterRuleComplete({
        id: "due",
        columnId: "due",
        type: "date",
        operator,
        values,
      } as FilterMenuRule),
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
