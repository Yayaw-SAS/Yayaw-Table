import { test } from "bun:test";
import { ConnectorError } from "../src/components/ui/yayaw-table/connectors/connector-model";
import {
  applySyncPlan,
  hashSyncValues,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
} from "../src/components/ui/yayaw-table/connectors/sync-engine";
import { connectorsSyncEngineSuite } from "./connectors-sync-engine-suite";

connectorsSyncEngineSuite(test, {
  ConnectorError,
  applySyncPlan,
  hashSyncValues,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
});
