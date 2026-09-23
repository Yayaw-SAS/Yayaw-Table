import { expect, test } from "bun:test";
import { resolveListPropertyColumnIds } from "../src/components/ui/yayaw-table/components/list-view";
import {
  createTableViewConfigSnapshot,
  normalizeTableViewConfig,
} from "../src/components/ui/yayaw-table/utils/table-view-state";

const columnDefinitions = [
  { id: "select", header: "", type: "text" as const },
  { id: "name", header: "Name", type: "text" as const },
  { id: "status", header: "Status", type: "select" as const },
  { id: "price", header: "Price", type: "number" as const },
  { id: "actions", header: "", type: "actions" as const },
];

test("list lines show every non-title property until chosen, minus the grouped column", () => {
  expect(
    resolveListPropertyColumnIds({
      columnDefinitions,
      titleColumnId: "name",
    })
  ).toEqual(["status", "price"]);
  expect(
    resolveListPropertyColumnIds({
      columnDefinitions,
      config: { cardColumnIds: ["price", "status", "missing"] },
      groupBy: "status",
      titleColumnId: "name",
    })
  ).toEqual(["price"]);
});

test("saved views keep normalized list settings", () => {
  expect(
    normalizeTableViewConfig({
      displayMode: "list",
      list: {
        titleColumn: " name ",
        cardColumnIds: ["price", ""],
        showCardLabels: true,
      },
    }).list
  ).toEqual({
    titleColumn: "name",
    cardColumnIds: ["price"],
    showCardLabels: true,
  });
  const snapshot = createTableViewConfigSnapshot({
    advancedFiltersParam: [],
    displayModeParam: "list",
    filtersParam: [],
    galleryParam: {},
    globalSearchParam: "",
    groupingParam: [],
    kanbanGroupByParam: "",
    kanbanParam: {},
    listParam: { cardColumnIds: ["status"] },
    orderParam: [],
    pageSizeParam: "10",
    sortParam: [],
    visibilityParam: {},
  });
  expect(snapshot.list).toEqual({ cardColumnIds: ["status"] });
});
