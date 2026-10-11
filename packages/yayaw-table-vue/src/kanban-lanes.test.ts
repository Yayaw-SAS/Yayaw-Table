import { it } from "vitest";
import { kanbanLanesSuite } from "../../../tests/kanban-lanes-suite";
import {
  arrangeKanbanLanes,
  kanbanLaneCandidates,
  kanbanLaneSettings,
  mergeKanbanLanes,
  moveKanbanLane,
  normalizeKanbanLanes,
  setKanbanLaneHidden,
  withKanbanLaneSettings,
} from "./kanban-lanes";
import { canonicalViewConfig, sanitizeViewConfig } from "./view-config";

kanbanLanesSuite(
  it,
  {
    arrangeKanbanLanes,
    kanbanLaneCandidates,
    kanbanLaneSettings,
    mergeKanbanLanes,
    moveKanbanLane,
    normalizeKanbanLanes,
    setKanbanLaneHidden,
    withKanbanLaneSettings,
  },
  { canonicalViewConfig, sanitizeViewConfig }
);
