import assert from "node:assert/strict";
import type * as InitialRows from "../src/components/ui/yayaw-table/utils/initial-rows";

const CONFIGURED = [{ id: "restockFrom", desc: false }];
const BY_NAME = [{ id: "name", desc: true }];

/** How both editions start from the host's first rows (`initialData`). */
export function initialRowsSuite(
  test: (name: string, run: () => void) => void,
  initialRows: Pick<
    typeof InitialRows,
    "isSameSorting" | "resolveInitialRowsUse"
  >
) {
  const { isSameSorting, resolveInitialRowsUse } = initialRows;

  test("compares sorts by column, direction and precedence", () => {
    assert.equal(
      isSameSorting(CONFIGURED, [{ desc: false, id: "restockFrom" }]),
      true
    );
    assert.equal(isSameSorting([{ id: "restockFrom" }], CONFIGURED), true);
    assert.equal(
      isSameSorting(CONFIGURED, [{ id: "restockFrom", desc: true }]),
      false
    );
    assert.equal(
      isSameSorting([...CONFIGURED, ...BY_NAME], [...BY_NAME, ...CONFIGURED]),
      false
    );
    assert.equal(isSameSorting([], undefined), true);
    assert.equal(isSameSorting(CONFIGURED, []), false);
  });

  test("shows rows at once under the configured sort, then loads them in it", () => {
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        sorting: CONFIGURED,
      }),
      "placeholder"
    );
    // Rows the host says it produced in another order load again too.
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: [],
        sorting: CONFIGURED,
      }),
      "placeholder"
    );
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: CONFIGURED,
        sorting: [],
      }),
      "placeholder"
    );
  });

  test("keeps rows produced in the sort the table starts from", () => {
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: [{ desc: false, id: "restockFrom" }],
        sorting: CONFIGURED,
      }),
      "current"
    );
    assert.equal(
      resolveInitialRowsUse({
        firstPage: true,
        initialDataSort: [],
        sorting: [],
      }),
      "current"
    );
  });

  test("leaves rows made for another state to the table's own request", () => {
    // A sort from the URL or a view: the rows stand for the default state.
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        sorting: BY_NAME,
      }),
      "unused"
    );
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: CONFIGURED,
        sorting: BY_NAME,
      }),
      "unused"
    );
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: BY_NAME,
        sorting: BY_NAME,
      }),
      "unused"
    );
    // Another page or page size, a filter or a search.
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: false,
        initialDataSort: CONFIGURED,
        sorting: CONFIGURED,
      }),
      "unused"
    );
  });

  test("does not take rows without a named sort as current", () => {
    assert.equal(
      resolveInitialRowsUse({ firstPage: true, sorting: [] }),
      "placeholder"
    );
    assert.equal(
      resolveInitialRowsUse({
        configuredSorting: CONFIGURED,
        firstPage: true,
        initialDataSort: null,
        sorting: CONFIGURED,
      }),
      "placeholder"
    );
  });
}
