import { test } from "bun:test";
import {
  ConnectorError,
  toConnectorRows,
} from "../src/components/ui/yayaw-table/connectors/connector-model";
import {
  columnIndex,
  createExcelSyncTarget,
  excelSerialToIso,
  excelShareId,
  excelValuesToRecords,
  formatExcelWorkbookId,
  getExcelTargetSchema,
  getExcelWorkbook,
  listExcelWorkbooks,
  parseExcelWorkbookId,
  parseRangeAddress,
  prepareExcelSheet,
  pushRowsToExcel,
  readExcelRows,
  toExcelCell,
  verifyMicrosoftAccount,
} from "../src/components/ui/yayaw-table/connectors/microsoft-excel";
import { planSync } from "../src/components/ui/yayaw-table/connectors/sync-engine";
import { connectorsMicrosoftExcelSuite } from "./connectors-microsoft-excel-suite";

connectorsMicrosoftExcelSuite(test, {
  ConnectorError,
  columnIndex,
  createExcelSyncTarget,
  excelSerialToIso,
  excelShareId,
  excelValuesToRecords,
  formatExcelWorkbookId,
  getExcelTargetSchema,
  getExcelWorkbook,
  listExcelWorkbooks,
  parseExcelWorkbookId,
  parseRangeAddress,
  planSync,
  prepareExcelSheet,
  pushRowsToExcel,
  readExcelRows,
  toConnectorRows,
  toExcelCell,
  verifyMicrosoftAccount,
});
