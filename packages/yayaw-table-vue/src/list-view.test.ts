import { it } from "vitest";
import { listViewSuite } from "../../../tests/list-view-suite";
import {
  normalizeListViewConfig,
  resolveListSettings,
  visibleListProperties,
} from "./list-view";

listViewSuite(it, {
  normalizeListViewConfig,
  resolveListSettings,
  visibleListProperties,
});
