import { it } from "vitest";
import { activityShortcutsSuite } from "../../../tests/activity-shortcuts-suite";
import { createActivityUndo } from "./activity-shortcuts";

activityShortcutsSuite(it, createActivityUndo);
