// @vitest-environment node
import { it } from "vitest";
import { connectorsGoogleSheetsSuite } from "../../../../tests/connectors-google-sheets-suite";
import { ConnectorError, toConnectorRows } from "./connector-model";
import {
  columnLetter,
  createGoogleTokenCache,
  createSheetSyncTarget,
  getSpreadsheet,
  parseServiceAccountKey,
  parseSpreadsheetId,
  planSheetHeader,
  planSheetUpsert,
  pushRowsToSheet,
  readHeaderRow,
  readSheetRows,
  sheetValuesToRecords,
  signServiceAccountAssertion,
  toSheetCell,
  verifyGoogleSheetsCredentials,
} from "./google-sheets";
import { normalizeSyncValue } from "./sync-engine";

connectorsGoogleSheetsSuite(it, {
  ConnectorError,
  columnLetter,
  createGoogleTokenCache,
  createSheetSyncTarget,
  getSpreadsheet,
  normalizeSyncValue,
  parseServiceAccountKey,
  parseSpreadsheetId,
  planSheetHeader,
  planSheetUpsert,
  pushRowsToSheet,
  readHeaderRow,
  readSheetRows,
  sheetValuesToRecords,
  signServiceAccountAssertion,
  toConnectorRows,
  toSheetCell,
  verifyGoogleSheetsCredentials,
});
