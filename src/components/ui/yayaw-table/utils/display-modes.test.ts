import { describe, expect, it } from "bun:test";
import {
  DISPLAY_MODE_CONFIG_KEYS,
  isTableDisplayMode,
  resolveDisplayMode,
  resolveDisplayModes,
} from "./display-modes";

describe("display mode registry", () => {
  it("lists the per-mode setting keys used by saved views and URLs", () => {
    expect(DISPLAY_MODE_CONFIG_KEYS).toEqual(["kanban", "gallery", "gantt"]);
  });

  it("recognises only registered modes", () => {
    expect(isTableDisplayMode("kanban")).toBe(true);
    expect(isTableDisplayMode("toString")).toBe(false);
    expect(isTableDisplayMode("calendar")).toBe(false);
  });

  it("deduplicates configured modes and withholds planning modes without a session", () => {
    expect(resolveDisplayModes(["kanban", "kanban", "unknown", "gantt"])).toEqual([
      "kanban",
      "gantt",
    ]);
    expect(resolveDisplayModes(["gantt"], { planning: false })).toEqual([
      "table",
    ]);
    expect(resolveDisplayModes(["gantt"], { planning: true })).toEqual([
      "gantt",
    ]);
    expect(resolveDisplayModes(undefined)).toEqual(["table"]);
  });

  it("falls back from a mode the table does not offer to its default", () => {
    const allowed = resolveDisplayModes(["table", "gallery"]);
    expect(resolveDisplayMode({ allowed, requested: "gallery" })).toBe(
      "gallery"
    );
    expect(
      resolveDisplayMode({ allowed, fallback: "gallery", requested: "gantt" })
    ).toBe("gallery");
    expect(resolveDisplayMode({ allowed, requested: "gantt" })).toBe("table");
  });
});
