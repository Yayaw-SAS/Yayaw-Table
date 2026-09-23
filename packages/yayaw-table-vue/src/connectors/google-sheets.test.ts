// @vitest-environment node
import { it } from "vitest";
import { connectorsGoogleSheetsSuite } from "../../../../tests/connectors-google-sheets-suite";
import { ConnectorError, toConnectorRows } from "./connector-model";
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
} from "./google-sheets";

connectorsGoogleSheetsSuite(it, {
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
