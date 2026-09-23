import { expect, test } from "bun:test";
import { cycleColumnSort } from "../src/components/ui/yayaw-table/components/toolbar/sections/table-sort-menu";

test("the sort menu adds, reverses and removes one sort at a time, keeping priorities", () => {
  const byName = cycleColumnSort([], "name");
  expect(byName).toEqual([{ id: "name", desc: false }]);
  const thenPrice = cycleColumnSort(byName, "price");
  expect(thenPrice).toEqual([
    { id: "name", desc: false },
    { id: "price", desc: false },
  ]);
  const nameDescending = cycleColumnSort(thenPrice, "name");
  expect(nameDescending).toEqual([
    { id: "name", desc: true },
    { id: "price", desc: false },
  ]);
  expect(cycleColumnSort(nameDescending, "name")).toEqual([
    { id: "price", desc: false },
  ]);
});
