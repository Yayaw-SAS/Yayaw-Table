import { test } from "bun:test";
import {
  normalizeListViewConfig,
  resolveListSettings,
  visibleListProperties,
} from "../src/components/ui/yayaw-table/utils/list-view";
import { listViewSuite } from "./list-view-suite";

listViewSuite(test, {
  normalizeListViewConfig,
  resolveListSettings,
  visibleListProperties,
});
