// @vitest-environment node
import { it } from "vitest";
import { connectorsNotionSuite } from "../../../../tests/connectors-notion-suite";
import {
  ConnectorError,
  createConnectorHttp,
  retryDelay,
  toConnectorRows,
} from "./connector-model";
import {
  createNotionSyncTarget,
  defaultNotionMapping,
  fromNotionPropertyValue,
  getNotionDatabaseSchema,
  listNotionDatabases,
  normalizeNotionId,
  pushRowsToNotionDatabase,
  readNotionDatabase,
  toNotionPropertyValue,
  toRichText,
  verifyNotionToken,
} from "./notion";
import { normalizeSyncValue } from "./sync-engine";

connectorsNotionSuite(it, {
  ConnectorError,
  createConnectorHttp,
  createNotionSyncTarget,
  defaultNotionMapping,
  fromNotionPropertyValue,
  getNotionDatabaseSchema,
  listNotionDatabases,
  normalizeNotionId,
  normalizeSyncValue,
  pushRowsToNotionDatabase,
  readNotionDatabase,
  retryDelay,
  toConnectorRows,
  toNotionPropertyValue,
  toRichText,
  verifyNotionToken,
});
