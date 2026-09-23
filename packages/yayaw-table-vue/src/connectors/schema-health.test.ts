// @vitest-environment node
import { it } from "vitest";
import { connectorsSchemaHealthSuite } from "../../../../tests/connectors-schema-health-suite";
import { checkTargetSchema } from "../connector-schema";
import {
  createGoogleTokenCache,
  getSheetTargetSchema,
  parseServiceAccountKey,
  planSheetPrepare,
  prepareSheet,
  sheetTargetSchema,
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
