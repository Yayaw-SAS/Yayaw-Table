import assert from "node:assert/strict";
import type * as Tabs from "../src/components/ui/yayaw-table/utils/view-tabs";

const views = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

export function viewTabsSuite(
  test: (name: string, run: () => void) => void,
  tabs: Pick<typeof Tabs, "resolveViewTabs" | "splitViewTabs">
) {
  test("tabs are on by default and can be turned off or sized", () => {
    assert.deepEqual(tabs.resolveViewTabs(undefined), { maxVisible: 4 });
    assert.deepEqual(tabs.resolveViewTabs(true), { maxVisible: 4 });
    assert.equal(tabs.resolveViewTabs(false), undefined);
    assert.deepEqual(tabs.resolveViewTabs({ maxVisible: 2 }), {
      maxVisible: 2,
    });
    assert.deepEqual(tabs.resolveViewTabs({ maxVisible: 0 }), {
      maxVisible: 4,
    });
  });

  test("extra views move to the overflow menu in their order", () => {
    const split = tabs.splitViewTabs(views, null, 3);
    assert.deepEqual(ids(split.visible), ["a", "b", "c"]);
    assert.deepEqual(ids(split.overflow), ["d", "e"]);
    assert.deepEqual(ids(tabs.splitViewTabs(views, "a", 5).visible), [
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  test("the active view stays visible in place of the last tab", () => {
    const split = tabs.splitViewTabs(views, "e", 3);
    assert.deepEqual(ids(split.visible), ["a", "b", "e"]);
    assert.deepEqual(ids(split.overflow), ["c", "d"]);
  });
}
