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
} from "../src/components/ui/yayaw-table/planning/timeline";
import { planningContractSuite } from "./planning-contract-suite";

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
  timeline: planningTimeline,
});
