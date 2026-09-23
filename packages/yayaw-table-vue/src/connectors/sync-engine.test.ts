// @vitest-environment node
import { it } from "vitest";
import { connectorsSyncEngineSuite } from "../../../../tests/connectors-sync-engine-suite";
import { ConnectorError } from "./connector-model";
import {
  applySyncPlan,
  hashSyncValues,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
} from "./sync-engine";

connectorsSyncEngineSuite(it, {
  ConnectorError,
  applySyncPlan,
  hashSyncValues,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
});
