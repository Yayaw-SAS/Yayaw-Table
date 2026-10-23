import assert from "node:assert/strict";
import type { viewSettingsBadgeCount } from "../src/components/ui/yayaw-table/utils/table-contracts";

const MINE = { id: "owner", value: ["$viewer"] };
const SORT = [{ desc: true, id: "date" }];
const rule = (id: string, values: unknown, isActive = true) => ({
  columnId: "status",
  id,
  isActive,
  operator: "is",
  values,
});

export function viewSettingsBadgeSuite(
  test: (name: string, run: () => void) => void,
  count: typeof viewSettingsBadgeCount
) {
  test("the default view's own filters and sort show no badge", () => {
    const defaults = { columnFilters: [MINE], sorting: SORT };
    assert.equal(count({ filters: [MINE], sorting: SORT }, defaults), 0);
    // Vue's `filters` alias and a value whose keys come in another order.
    assert.equal(
      count(
        { filters: [{ value: ["$viewer"], id: "owner" }], sorting: SORT },
        { filters: [MINE], sorting: SORT }
      ),
      0
    );
  });

  test("filters and sorts added over the default view count", () => {
    const defaults = { columnFilters: [MINE], sorting: SORT };
    const status = { id: "status", value: ["open"] };
    assert.equal(
      count({ filters: [MINE, status], sorting: SORT }, defaults),
      1
    );
    assert.equal(
      count(
        { filters: [{ id: "owner", value: ["7"] }], sorting: SORT },
        defaults
      ),
      1
    );
    const sorting = [
      { desc: false, id: "date" },
      { desc: false, id: "name" },
    ];
    assert.equal(count({ filters: [MINE], sorting }, defaults), 2);
    assert.equal(count({ filters: [MINE], sorting: [] }, defaults), 0);
    // Without a default view, every active filter and sort counts.
    assert.equal(count({ filters: [MINE], sorting: SORT }, undefined), 2);
  });

  test("advanced rules compare by what they filter, inactive ones never count", () => {
    const defaults = {
      advancedFilters: { filters: [rule("a", ["open"])], joinOperator: "and" },
    };
    const same = { filters: [rule("b", ["open"])], joinOperator: "and" };
    assert.equal(count({ advancedFilters: same }, defaults), 0);
    const copied = { ...rule("f", ["open"]), createdAt: "2026-10-23" };
    assert.equal(count({ advancedFilters: [copied] }, defaults), 0);
    assert.equal(
      count({ advancedFilters: [rule("c", ["open"])] }, defaults),
      0
    );
    const added = {
      filters: [rule("b", ["open"]), rule("d", ["late"])],
      joinOperator: "and",
    };
    assert.equal(count({ advancedFilters: added }, defaults), 1);
    const inactive = {
      filters: [rule("e", undefined, false)],
      joinOperator: "and",
    };
    assert.equal(count({ advancedFilters: inactive }, {}), 0);
  });
}
