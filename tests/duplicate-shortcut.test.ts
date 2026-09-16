import { expect, it } from "bun:test";
import {
  createSelectionDuplicate,
  duplicateLabels,
} from "../src/components/ui/yayaw-table/utils/duplicate-shortcut";
import { duplicateShortcutSuite } from "./duplicate-shortcut-suite";

duplicateShortcutSuite(it, createSelectionDuplicate);
it("uses correct translated singular and plural duplication messages", () => {
  expect(duplicateLabels("fr", 1).success).toBe("1 élément dupliqué");
  expect(duplicateLabels("fr-FR", 2).success).toBe("2 éléments dupliqués");
  expect(duplicateLabels("en", 1).success).toBe("1 record duplicated");
  expect(duplicateLabels("en", 2).success).toBe("2 records duplicated");
});
