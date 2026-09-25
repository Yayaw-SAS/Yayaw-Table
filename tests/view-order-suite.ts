import assert from "node:assert/strict";
import type * as Order from "../src/components/ui/yayaw-table/utils/view-order";

type ViewOrderModule = Pick<
  typeof Order,
  | "formatViewMove"
  | "getTableViewOrderStorageKey"
  | "listedViewOrder"
  | "moveViewInOrder"
  | "orderableViewIds"
  | "orderViews"
  | "parseViewOrder"
  | "readStoredViewOrder"
  | "storeViewOrder"
  | "viewMoves"
  | "viewPosition"
>;

const ids = (views: { id: string }[]) => views.map((view) => view.id);
const views = [
  { id: "a" },
  { id: "system", isSystem: true },
  { id: "b" },
  { id: "screen", isDefault: true, isSystem: true },
  { id: "c" },
  { id: "default", isDefault: true },
];
const context = { tableId: "projects:team-a", tableType: "projects" };

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

/** Shared by `bun test` (React sources) and Vitest (the synced Vue copy). */
export function viewOrderSuite(
  test: (name: string, run: () => void) => void,
  order: ViewOrderModule
) {
  test("system views and the default view stay first, in their own order", () => {
    assert.deepEqual(ids(order.orderViews(views)), [
      "system",
      "screen",
      "default",
      "a",
      "b",
      "c",
    ]);
    // An order naming them does not move them.
    assert.deepEqual(
      ids(order.orderViews(views, ["default", "c", "system", "a", "b"])),
      ["system", "screen", "default", "c", "a", "b"]
    );
  });

  test("views the order does not name come last, in their list order", () => {
    assert.deepEqual(ids(order.orderViews(views, ["c"])), [
      "system",
      "screen",
      "default",
      "c",
      "a",
      "b",
    ]);
    // Unknown ids (deleted or inaccessible views) are ignored.
    assert.deepEqual(
      ids(order.orderViews([{ id: "a" }, { id: "b" }], ["gone", "b"])),
      ["b", "a"]
    );
    assert.deepEqual(order.orderableViewIds(views), ["a", "b", "c"]);
  });

  test("a view moves one step and not past the ends", () => {
    const ordered = order.orderViews(views, ["b", "a", "c"]);
    assert.deepEqual(order.moveViewInOrder(ordered, "a", "previous"), [
      "a",
      "b",
      "c",
    ]);
    assert.deepEqual(order.moveViewInOrder(ordered, "a", "next"), [
      "b",
      "c",
      "a",
    ]);
    assert.equal(order.moveViewInOrder(ordered, "b", "previous"), undefined);
    assert.equal(order.moveViewInOrder(ordered, "c", "next"), undefined);
    assert.deepEqual(order.viewMoves(ordered, "b"), {
      previous: false,
      next: true,
    });
    assert.deepEqual(order.viewMoves(ordered, "c"), {
      previous: true,
      next: false,
    });
  });

  test("system and default views, unknown views and a lone view do not move", () => {
    const ordered = order.orderViews(views);
    assert.equal(order.viewMoves(ordered, "system"), undefined);
    assert.equal(order.viewMoves(ordered, "default"), undefined);
    assert.equal(order.viewMoves(ordered, "missing"), undefined);
    assert.equal(order.viewMoves(ordered, null), undefined);
    assert.equal(order.moveViewInOrder(ordered, "screen", "next"), undefined);
    assert.equal(
      order.viewMoves(
        [{ id: "only" }, { id: "fixed", isSystem: true }],
        "only"
      ),
      undefined
    );
  });

  test("the announcement counts the table's default view first", () => {
    const ordered = order.orderViews(views, ["c", "a", "b"]);
    assert.deepEqual(order.viewPosition(ordered, "a"), {
      position: 6,
      count: 7,
    });
    assert.equal(order.viewPosition(ordered, "missing"), undefined);
    assert.equal(
      order.formatViewMove(
        "View “{name}” moved to position {position} of {count}",
        { name: "Sales $&", position: 3, count: 7 }
      ),
      "View “Sales $&” moved to position 3 of 7"
    );
  });

  test("a host's list answers with its order or lists the views in it", () => {
    const listed = { data: [{ id: "b" }, { id: "a" }], order: ["a", "b"] };
    assert.deepEqual(order.listedViewOrder(listed, true), ["a", "b"]);
    assert.deepEqual(order.listedViewOrder(listed, false), ["a", "b"]);
    // Without `order`, the list's own order counts only when the host keeps it.
    const plain = { data: [{ id: "b" }, { id: "a" }] };
    assert.deepEqual(order.listedViewOrder(plain, true), ["b", "a"]);
    assert.equal(order.listedViewOrder(plain, false), undefined);
    assert.deepEqual(order.listedViewOrder([{ id: "c" }], true), ["c"]);
    assert.equal(order.listedViewOrder(undefined, true), undefined);
    assert.deepEqual(order.parseViewOrder(["a", 1, "b", "a", null]), [
      "a",
      "b",
    ]);
    assert.equal(order.parseViewOrder("a,b"), undefined);
  });

  test("without setOrder the order stays in this browser, per table type and id", () => {
    const storage = memoryStorage();
    assert.equal(
      order.getTableViewOrderStorageKey(context),
      'yayaw-table-view-order:["projects","projects:team-a"]'
    );
    assert.equal(order.readStoredViewOrder(storage, context), undefined);
    assert.equal(order.storeViewOrder(storage, context, ["c", "a"]), true);
    assert.deepEqual(order.readStoredViewOrder(storage, context), ["c", "a"]);
    // Another table type or instance keeps its own order.
    assert.equal(
      order.readStoredViewOrder(storage, { ...context, tableType: "tasks" }),
      undefined
    );
    assert.equal(
      order.readStoredViewOrder(storage, { ...context, tableId: "projects" }),
      undefined
    );
    // Unreadable values and unavailable storage are no order.
    storage.setItem(order.getTableViewOrderStorageKey(context), "{broken");
    assert.equal(order.readStoredViewOrder(storage, context), undefined);
    assert.equal(order.readStoredViewOrder(undefined, context), undefined);
    assert.equal(order.storeViewOrder(undefined, context, ["a"]), false);
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    assert.equal(order.storeViewOrder(refusing, context, ["a"]), false);
  });
}
