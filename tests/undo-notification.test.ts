import { expect, it } from "bun:test";
import {
  detailLabels,
  detailUndoMessage,
} from "../src/components/ui/yayaw-table/utils/record-details";
import fixtures from "./fixtures/undo-notification.json";

for (const fixture of fixtures) {
  it(`localizes the full undo sentence in ${fixture.locale}: ${fixture.expected}`, () => {
    const entry = {
      id: "event",
      at: "2026-09-16",
      actor: { name: "User" },
      action: fixture.action,
    };
    const labels = detailLabels(
      fixture.locale,
      fixture.override ? { undoSuccess: fixture.override } : undefined
    );
    expect(detailUndoMessage(entry, labels)).toBe(fixture.expected);
  });
}
