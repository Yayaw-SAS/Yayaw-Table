import { expect, it } from "vitest";
import { duplicateShortcutSuite } from "../../../tests/duplicate-shortcut-suite";
import {
  createSelectionDuplicate,
  duplicateLabels,
} from "./duplicate-shortcut";

duplicateShortcutSuite(it, createSelectionDuplicate);
it("uses correct translated singular and plural duplication messages", () => {
  expect(duplicateLabels("fr", 1).success).toBe("1 élément dupliqué");
  expect(duplicateLabels("fr-FR", 2).success).toBe("2 éléments dupliqués");
  expect(duplicateLabels("en", 1).success).toBe("1 record duplicated");
  expect(duplicateLabels("en", 2).success).toBe("2 records duplicated");
});
