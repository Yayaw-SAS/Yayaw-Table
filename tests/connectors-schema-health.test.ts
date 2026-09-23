import { test } from "bun:test";
import {
  createGoogleTokenCache,
  getSheetTargetSchema,
  parseServiceAccountKey,
  planSheetPrepare,
  prepareSheet,
  sheetTargetSchema,
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
  createNotionDatabase,
  getNotionDatabaseSchema,
  getSheetTargetSchema,
  listNotionPages,
  notionTargetSchema,
  parseServiceAccountKey,
  planNotionPrepare,
  planSheetPrepare,
  prepareNotionDatabase,
  prepareSheet,
  pushRowsToNotionDatabase,
  readNotionDatabase,
  sheetTargetSchema,
});
