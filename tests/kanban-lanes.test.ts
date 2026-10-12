import { it } from "bun:test";
import {
  arrangeKanbanLanes,
  kanbanLaneCandidates,
  kanbanLaneSettings,
  mergeKanbanLanes,
  moveKanbanLane,
  normalizeKanbanLanes,
  setKanbanLaneHidden,
  withKanbanLaneSettings,
} from "../src/components/ui/yayaw-table/utils/kanban-lanes";
import {
  canonicalViewConfig,
  sanitizeViewConfig,
} from "../src/components/ui/yayaw-table/utils/view-config";
import { kanbanLanesSuite } from "./kanban-lanes-suite";

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
