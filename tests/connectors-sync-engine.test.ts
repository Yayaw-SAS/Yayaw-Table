import { test } from "bun:test";
import { ConnectorError } from "../src/components/ui/yayaw-table/connectors/connector-model";
import {
  applyConflictResolutions,
  applySyncPlan,
  hashSyncValues,
  mergeSyncLists,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  resolvePendingConflicts,
  summarizeSyncPlan,
  toSyncMapping,
  validateConflictConfig,
} from "../src/components/ui/yayaw-table/connectors/sync-engine";
import { connectorsSyncEngineSuite } from "./connectors-sync-engine-suite";

connectorsSyncEngineSuite(test, {
  ConnectorError,
  applyConflictResolutions,
  applySyncPlan,
  hashSyncValues,
  mergeSyncLists,
  nextSyncState,
  normalizeSyncValue,
  planSync,
  resolvePendingConflicts,
  summarizeSyncPlan,
  toSyncMapping,
  validateConflictConfig,
});
