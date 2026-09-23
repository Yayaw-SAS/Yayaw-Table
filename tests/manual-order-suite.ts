import assert from "node:assert/strict";
import type * as Manual from "../src/components/ui/yayaw-table/utils/manual-order";

export function manualOrderSuite(
  test: (name: string, run: () => void) => void,
  manual: Pick<
    typeof Manual,
    | "isManualOrder"
    | "manualOrderSorting"
    | "moveInOrder"
    | "withManualOrderView"
  >
) {
  test("recognises the manual sort and replaces other sorts with it", () => {
    assert.equal(manual.isManualOrder(manual.manualOrderSorting()), true);
    assert.equal(manual.isManualOrder([{ id: "name", desc: false }]), false);
    assert.equal(manual.isManualOrder(undefined), false);
  });

  test("sends the view identity only with the manual sort", () => {
    assert.deepEqual(
      manual.withManualOrderView(
        { page: 1 },
        manual.manualOrderSorting(),
        undefined
      ),
      { page: 1, viewId: null }
    );
    assert.deepEqual(
      manual.withManualOrderView(
        { page: 1 },
        manual.manualOrderSorting(),
        "v1"
      ),
      { page: 1, viewId: "v1" }
    );
    assert.deepEqual(
      manual.withManualOrderView({ page: 1 }, [{ id: "name" }], "v1"),
      { page: 1 }
    );
  });

  test("moves a row and reports its new neighbours", () => {
    assert.deepEqual(manual.moveInOrder(["a", "b", "c", "d"], "d", 1), {
      ids: ["a", "d", "b", "c"],
      previousId: "a",
      nextId: "b",
    });
    assert.deepEqual(manual.moveInOrder(["a", "b", "c"], "a", 5), {
      ids: ["b", "c", "a"],
      previousId: "c",
      nextId: undefined,
    });
    assert.equal(manual.moveInOrder(["a", "b"], "a", 0), undefined);
    assert.equal(manual.moveInOrder(["a", "b"], "x", 0), undefined);
  });
}
