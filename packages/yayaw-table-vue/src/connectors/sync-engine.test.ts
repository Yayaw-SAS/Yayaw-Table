// @vitest-environment node
import { it } from "vitest";
import { connectorsSyncEngineSuite } from "../../../../tests/connectors-sync-engine-suite";
import { ConnectorError } from "./connector-model";
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
} from "./sync-engine";

connectorsSyncEngineSuite(it, {
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
