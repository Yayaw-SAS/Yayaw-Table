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
  defaultNotionMapping,
  getNotionDatabaseSchema,
  listNotionDatabases,
  normalizeNotionId,
  pushRowsToNotionDatabase,
  toNotionPropertyValue,
  toRichText,
  verifyNotionToken,
} from "./notion";

connectorsNotionSuite(it, {
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
