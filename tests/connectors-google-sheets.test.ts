import { test } from "bun:test";
import {
  ConnectorError,
  toConnectorRows,
} from "../src/components/ui/yayaw-table/connectors/connector-model";
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
} from "../src/components/ui/yayaw-table/connectors/google-sheets";
import { normalizeSyncValue } from "../src/components/ui/yayaw-table/connectors/sync-engine";
import { connectorsGoogleSheetsSuite } from "./connectors-google-sheets-suite";

connectorsGoogleSheetsSuite(test, {
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
