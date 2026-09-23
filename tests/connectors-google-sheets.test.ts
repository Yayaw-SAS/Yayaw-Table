import { test } from "bun:test";
import {
  ConnectorError,
  toConnectorRows,
} from "../src/components/ui/yayaw-table/connectors/connector-model";
import {
  columnLetter,
  createGoogleTokenCache,
  getSpreadsheet,
  parseServiceAccountKey,
  parseSpreadsheetId,
  planSheetHeader,
  planSheetUpsert,
  pushRowsToSheet,
  readHeaderRow,
  signServiceAccountAssertion,
  verifyGoogleSheetsCredentials,
} from "../src/components/ui/yayaw-table/connectors/google-sheets";
import { connectorsGoogleSheetsSuite } from "./connectors-google-sheets-suite";

connectorsGoogleSheetsSuite(test, {
  ConnectorError,
  columnLetter,
  createGoogleTokenCache,
  getSpreadsheet,
  parseServiceAccountKey,
  parseSpreadsheetId,
  planSheetHeader,
  planSheetUpsert,
  pushRowsToSheet,
  readHeaderRow,
  signServiceAccountAssertion,
  toConnectorRows,
  verifyGoogleSheetsCredentials,
});
