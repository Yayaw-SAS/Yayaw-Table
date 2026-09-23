import { test } from "bun:test";
import {
  ConnectorError,
  createConnectorHttp,
  retryDelay,
  toConnectorRows,
} from "../src/components/ui/yayaw-table/connectors/connector-model";
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
} from "../src/components/ui/yayaw-table/connectors/notion";
import { normalizeSyncValue } from "../src/components/ui/yayaw-table/connectors/sync-engine";
import { connectorsNotionSuite } from "./connectors-notion-suite";

connectorsNotionSuite(test, {
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
