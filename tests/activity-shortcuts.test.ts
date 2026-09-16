import { it } from "bun:test";
import { createActivityUndo } from "../src/components/ui/yayaw-table/utils/activity-shortcuts";
import { activityShortcutsSuite } from "./activity-shortcuts-suite";

activityShortcutsSuite(it, createActivityUndo);
