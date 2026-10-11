import assert from "node:assert/strict";
import type * as KanbanLanes from "../src/components/ui/yayaw-table/utils/kanban-lanes";
import type * as ViewConfig from "../src/components/ui/yayaw-table/utils/view-config";

/** Lane order and visibility per view, shared by the React and Vue editions. */
export function kanbanLanesSuite(
  test: (name: string, run: () => void) => void,
  lanes: Pick<
    typeof KanbanLanes,
    | "arrangeKanbanLanes"
    | "kanbanLaneCandidates"
    | "kanbanLaneSettings"
    | "mergeKanbanLanes"
    | "moveKanbanLane"
    | "normalizeKanbanLanes"
    | "setKanbanLaneHidden"
    | "withKanbanLaneSettings"
  >,
  views: Pick<typeof ViewConfig, "canonicalViewConfig" | "sanitizeViewConfig">
) {
  test("keeps well-formed lane settings by grouping column", () => {
    assert.deepEqual(
      lanes.normalizeKanbanLanes({
        stage: { order: ["won", "lead", "won", 3], hidden: ["lost"], x: 1 },
        " owner ": { hidden: [] },
        empty: {},
        __proto__: { order: ["a"] },
      }),
      { stage: { order: ["won", "lead"], hidden: ["lost"] } }
    );
    assert.equal(lanes.normalizeKanbanLanes([]), undefined);
    assert.equal(lanes.normalizeKanbanLanes({ stage: "won" }), undefined);
  });

  test("a view's lanes replace the default's column by column", () => {
    const merged = lanes.mergeKanbanLanes(
      { stage: { hidden: ["lost"] }, owner: { order: ["ada"] } },
      { stage: { order: ["won"] } }
    );
    assert.deepEqual(merged, {
      stage: { order: ["won"] },
      owner: { order: ["ada"] },
    });
    assert.deepEqual(lanes.kanbanLaneSettings(merged, "owner"), {
      order: ["ada"],
    });
    assert.deepEqual(lanes.kanbanLaneSettings(merged, "missing"), {});
  });

  test("orders lanes and sets hidden ones apart", () => {
    const board = [
      { value: "lead", label: "Lead" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
      { value: "", label: "No value" },
    ];
    const arranged = lanes.arrangeKanbanLanes(board, {
      order: ["won", "unknown", "lead"],
      hidden: ["lost"],
    });
    assert.deepEqual(
      arranged.visible.map((lane) => lane.value),
      ["won", "lead", ""]
    );
    assert.deepEqual(
      arranged.hidden.map((lane) => lane.label),
      ["Lost"]
    );
    assert.deepEqual(lanes.arrangeKanbanLanes(board, undefined).visible, board);
  });

  test("moves a lane and keeps every lane in the saved order", () => {
    const values = ["lead", "won", "lost"];
    assert.deepEqual(lanes.moveKanbanLane({}, values, "lost", -1), {
      order: ["lead", "lost", "won"],
    });
    assert.deepEqual(
      lanes.moveKanbanLane(
        { order: ["won"], hidden: ["lead"] },
        values,
        "won",
        1
      ),
      { order: ["lead", "won", "lost"], hidden: ["lead"] }
    );
    // An end stays an end.
    assert.deepEqual(lanes.moveKanbanLane({}, values, "lead", -1), {});
  });

  test("shows and hides one lane", () => {
    const hidden = lanes.setKanbanLaneHidden({ order: ["won"] }, "lost", true);
    assert.deepEqual(hidden, { order: ["won"], hidden: ["lost"] });
    assert.deepEqual(lanes.setKanbanLaneHidden(hidden, "lost", false), {
      order: ["won"],
    });
    assert.deepEqual(
      lanes.withKanbanLaneSettings(
        { stage: { hidden: ["lost"] }, owner: { order: ["ada"] } },
        "stage",
        {}
      ),
      { owner: { order: ["ada"] } }
    );
  });

  test("offers the lanes before the board shows them, in the board's order", () => {
    assert.deepEqual(
      lanes.kanbanLaneCandidates({
        label: (value) => value.toUpperCase() || "No value",
        options: [{ value: "lead", label: "Lead" }],
        values: ["won", "", "won", "lead"],
        settings: { order: ["won"], hidden: ["archived"] },
      }),
      [
        { value: "won", label: "WON" },
        { value: "lead", label: "Lead" },
        { value: "", label: "No value" },
        { value: "archived", label: "ARCHIVED" },
      ]
    );
  });

  test("saved views keep their lanes and drop malformed ones", () => {
    const { config, issues } = views.sanitizeViewConfig({
      displayMode: "kanban",
      grouping: ["stage"],
      kanban: {
        lanes: { stage: { order: ["won", "lead"], hidden: ["lost"] } },
        avatar: { nameColumn: "owner", shape: "square" },
      },
    });
    assert.deepEqual(config.kanban, {
      lanes: { stage: { order: ["won", "lead"], hidden: ["lost"] } },
      avatar: { nameColumn: "owner", shape: "square" },
    });
    assert.deepEqual(issues, []);
    assert.equal(
      views.sanitizeViewConfig({ kanban: { lanes: "stage" } }).issues.at(0)
        ?.code,
      "invalidValue"
    );
    assert.deepEqual(
      views.canonicalViewConfig({
        kanban: { lanes: { stage: { order: ["won"] } } },
      }).kanban,
      { lanes: { stage: { order: ["won"] } } }
    );
  });
}
