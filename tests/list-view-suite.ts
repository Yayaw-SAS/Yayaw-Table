import assert from "node:assert/strict";
import type * as ListView from "../src/components/ui/yayaw-table/utils/list-view";

export function listViewSuite(
  test: (name: string, run: () => void) => void,
  list: Pick<
    typeof ListView,
    "normalizeListViewConfig" | "resolveListSettings" | "visibleListProperties"
  >
) {
  test("keeps only valid list settings", () => {
    assert.deepEqual(
      list.normalizeListViewConfig({
        titleColumn: " name ",
        cardColumnIds: ["price", "", 3],
        wrap: true,
        showActions: false,
        propertyAlign: "start",
        maxProperties: "2",
        mobileMaxProperties: -1,
        unknown: 1,
      }),
      {
        titleColumn: "name",
        cardColumnIds: ["price"],
        wrap: true,
        showActions: false,
        propertyAlign: "start",
        maxProperties: 2,
      }
    );
    assert.equal(
      list.normalizeListViewConfig({ propertyAlign: "middle" }),
      undefined
    );
  });

  test("applies defaults, then table settings, then the view", () => {
    const settings = list.resolveListSettings(
      { wrap: true, maxProperties: 3 },
      { maxProperties: 1 }
    );
    assert.equal(settings.wrap, true);
    assert.equal(settings.showActions, true);
    assert.equal(settings.propertyAlign, "end");
    assert.equal(settings.maxProperties, 1);
  });

  test("limits properties, with a tighter limit on narrow screens", () => {
    const ids = ["a", "b", "c", "d"];
    assert.deepEqual(list.visibleListProperties(ids, {}, true), ids);
    assert.deepEqual(
      list.visibleListProperties(
        ids,
        { maxProperties: 3, mobileMaxProperties: 1 },
        false
      ),
      ["a", "b", "c"]
    );
    assert.deepEqual(
      list.visibleListProperties(
        ids,
        { maxProperties: 3, mobileMaxProperties: 1 },
        true
      ),
      ["a"]
    );
    assert.deepEqual(
      list.visibleListProperties(ids, { mobileMaxProperties: 0 }, true),
      []
    );
  });
}
