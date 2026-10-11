// @vitest-environment node
import { it } from "vitest";
import { connectorsMicrosoftExcelSuite } from "../../../../tests/connectors-microsoft-excel-suite";
import { ConnectorError, toConnectorRows } from "./connector-model";
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
} from "./microsoft-excel";
import { planSync } from "./sync-engine";

connectorsMicrosoftExcelSuite(it, {
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
