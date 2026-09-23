import { test } from "bun:test";
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
} from "../src/components/ui/yayaw-table/connectors/google-sheets";
import {
  createNotionDatabase,
  getNotionDatabaseSchema,
  listNotionPages,
  notionTargetSchema,
  planNotionPrepare,
  prepareNotionDatabase,
  pushRowsToNotionDatabase,
  readNotionDatabase,
} from "../src/components/ui/yayaw-table/connectors/notion";
import { checkTargetSchema } from "../src/components/ui/yayaw-table/utils/connector-schema";
import { connectorsSchemaHealthSuite } from "./connectors-schema-health-suite";

connectorsSchemaHealthSuite(test, {
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
