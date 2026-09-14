import { test } from "vitest";
import { planningContractSuite } from "../../../tests/planning-contract-suite";
import {
  createMemoryPlanningAdapter,
  loadPlanningSnapshot,
} from "./planning/adapter";
import {
  calculatePlanning,
  normalizeGanttView,
  planningTree,
} from "./planning/engine";
import { createPlanningSession, withPlanningActions } from "./planning/session";

planningContractSuite({
  test,
  calculate: calculatePlanning,
  memory: createMemoryPlanningAdapter,
  tree: planningTree,
  normalizeView: normalizeGanttView,
  session: createPlanningSession,
});

import { planningWorkflowSuite } from "../../../tests/planning-workflow-suite";
import { planningTasksFromRows } from "./planning/rows";
import { mountPlanningSurface } from "./planning/surface";

planningWorkflowSuite({
  test,
  memory: createMemoryPlanningAdapter,
  calculate: calculatePlanning,
  load: loadPlanningSnapshot,
  session: createPlanningSession,
  wrap: withPlanningActions,
  mount: mountPlanningSurface,
  rows: planningTasksFromRows,
});
