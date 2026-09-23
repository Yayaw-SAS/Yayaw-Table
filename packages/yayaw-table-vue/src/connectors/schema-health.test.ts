// @vitest-environment node
import { it } from "vitest";
import { connectorsSchemaHealthSuite } from "../../../../tests/connectors-schema-health-suite";
import { checkTargetSchema } from "../connector-schema";
import {
  createGoogleTokenCache,
  createSheetSyncTarget,
  getSheetTargetSchema,
  parseServiceAccountKey,
  planSheetHeader,
  planSheetPrepare,
  prepareSheet,
  pushRowsToSheet,
  sheetTargetSchema,
  sheetValuesToRecords,
} from "./google-sheets";
import {
  createNotionDatabase,
  getNotionDatabaseSchema,
  listNotionPages,
  notionTargetSchema,
  planNotionPrepare,
  prepareNotionDatabase,
  pushRowsToNotionDatabase,
  readNotionDatabase,
} from "./notion";

connectorsSchemaHealthSuite(it, {
  checkTargetSchema,
  createGoogleTokenCache,
  createSheetSyncTarget,
  createNotionDatabase,
  getNotionDatabaseSchema,
  getSheetTargetSchema,
  listNotionPages,
  notionTargetSchema,
  parseServiceAccountKey,
  planNotionPrepare,
  planSheetHeader,
  planSheetPrepare,
  prepareNotionDatabase,
  prepareSheet,
  pushRowsToSheet,
  pushRowsToNotionDatabase,
  readNotionDatabase,
  sheetTargetSchema,
  sheetValuesToRecords,
});
