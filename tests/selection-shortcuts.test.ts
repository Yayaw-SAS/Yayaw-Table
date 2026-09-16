import { it } from "bun:test";
import { registerSelectionShortcuts } from "../src/components/ui/yayaw-table/utils/selection-shortcuts";
import { selectionShortcutsSuite } from "./selection-shortcuts-suite";

selectionShortcutsSuite(it, registerSelectionShortcuts);
