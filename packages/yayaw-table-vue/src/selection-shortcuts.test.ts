import { it } from "vitest";
import { selectionShortcutsSuite } from "../../../tests/selection-shortcuts-suite";
import { registerSelectionShortcuts } from "./selection-shortcuts";

selectionShortcutsSuite(it, registerSelectionShortcuts);
