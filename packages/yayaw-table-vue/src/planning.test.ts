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
import { buildPlanningRows } from "./planning/query";
import {
  canDeriveRowsPlanning,
  createRowsPlanningAdapter,
} from "./planning/rows-adapter";
import { createPlanningSession, withPlanningActions } from "./planning/session";
import {
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_ROW_HEIGHT,
  timelineBar,
  timelineCanEdit,
  timelineCanResize,
  timelineDateMutation,
  timelineDayCells,
  timelineFirstDate,
  timelineGeometry,
  timelinePeriodStep,
  timelineRows,
  timelineTodayOffset,
} from "./planning/timeline";

const planningTimeline = {
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_ROW_HEIGHT,
  timelineBar,
  timelineCanEdit,
  timelineCanResize,
  timelineDateMutation,
  timelineDayCells,
  timelineFirstDate,
  timelineGeometry,
  timelinePeriodStep,
  timelineRows,
  timelineTodayOffset,
};
planningContractSuite({
  test,
  calculate: calculatePlanning,
  memory: createMemoryPlanningAdapter,
  tree: planningTree,
  normalizeView: normalizeGanttView,
  session: createPlanningSession,
  rowsAdapter: createRowsPlanningAdapter,
  canDeriveRows: canDeriveRowsPlanning,
  timeline: planningTimeline,
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
  project: buildPlanningRows,
  timeline: planningTimeline,
});
