import { test } from "bun:test";
import {
  ConnectorError,
  createConnectorHttp,
  retryDelay,
  toConnectorRows,
} from "../src/components/ui/yayaw-table/connectors/connector-model";
import {
  defaultNotionMapping,
  getNotionDatabaseSchema,
  listNotionDatabases,
  normalizeNotionId,
  pushRowsToNotionDatabase,
  toNotionPropertyValue,
  toRichText,
  verifyNotionToken,
} from "../src/components/ui/yayaw-table/connectors/notion";
import { connectorsNotionSuite } from "./connectors-notion-suite";

connectorsNotionSuite(test, {
  ConnectorError,
  createConnectorHttp,
  defaultNotionMapping,
  getNotionDatabaseSchema,
  listNotionDatabases,
  normalizeNotionId,
  pushRowsToNotionDatabase,
  retryDelay,
  toConnectorRows,
  toNotionPropertyValue,
  toRichText,
  verifyNotionToken,
});
