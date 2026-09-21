import { test } from "bun:test";
import {
  createMemoryPlanningAdapter,
  loadPlanningSnapshot,
} from "../src/components/ui/yayaw-table/planning/adapter";
import {
  calculatePlanning,
  normalizeGanttView,
  planningTree,
} from "../src/components/ui/yayaw-table/planning/engine";
import { buildPlanningRows } from "../src/components/ui/yayaw-table/planning/query";
import {
  canDeriveRowsPlanning,
  createRowsPlanningAdapter,
} from "../src/components/ui/yayaw-table/planning/rows-adapter";
import {
  createPlanningSession,
  withPlanningActions,
} from "../src/components/ui/yayaw-table/planning/session";
import { planningContractSuite } from "./planning-contract-suite";

planningContractSuite({
  test,
  calculate: calculatePlanning,
  memory: createMemoryPlanningAdapter,
  tree: planningTree,
  normalizeView: normalizeGanttView,
  session: createPlanningSession,
  rowsAdapter: createRowsPlanningAdapter,
  canDeriveRows: canDeriveRowsPlanning,
});

import { planningTasksFromRows } from "../src/components/ui/yayaw-table/planning/rows";
import { mountPlanningSurface } from "../src/components/ui/yayaw-table/planning/surface";
import { planningWorkflowSuite } from "./planning-workflow-suite";

planningWorkflowSuite({
  test,
  memory: createMemoryPlanningAdapter,
  calculate: calculatePlanning,
  load: loadPlanningSnapshot,
  session: createPlanningSession,
  wrap: withPlanningActions,
  mount: mountPlanningSurface,
  rows: planningTasksFromRows,
  project: buildPlanningRows,
});
