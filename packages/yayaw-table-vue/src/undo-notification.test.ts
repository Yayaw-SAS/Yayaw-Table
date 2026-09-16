import { expect, it } from "vitest";
import fixtures from "../../../tests/fixtures/undo-notification.json";
import { detailLabels, detailUndoMessage } from "./record-details";

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
