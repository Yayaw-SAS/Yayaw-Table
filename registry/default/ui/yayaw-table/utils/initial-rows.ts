/**
 * The rows a host renders before a table's first request (`initialData`,
 * usually its server-rendered first page). Both editions decide from here
 * whether to show them at once and whether to load that page again.
 *
 * `initialData` stands for the table's default state: page 1 at
 * `table.defaultPageSize`, without filters or search, sorted by `columns.sort`
 * when it is set. `initialDataSort` names the sort the host produced the rows
 * with; when the table starts in that state and that sort, they are current.
 */

/**
 * - `current`: made for the starting state; nothing loads until it changes.
 * - `placeholder`: shown at once, then loaded again once in the starting sort.
 * - `unused`: made for another state; the table loads its own rows.
 */
export type InitialRowsUse = "current" | "placeholder" | "unused";

const sortingKey = (sorting: unknown): string =>
  Array.isArray(sorting)
    ? sorting
        .map((sort) => {
          const { desc, id } = (sort ?? {}) as { desc?: unknown; id?: unknown };
          return `${String(id)}:${desc ? "desc" : "asc"}`;
        })
        .join(",")
    : "";

/** Whether two sorts order rows alike: same columns, directions and precedence. */
export const isSameSorting = (left: unknown, right: unknown): boolean =>
  sortingKey(left) === sortingKey(right);

/** Whether a table starts from the host's rows, and whether they are current. */
export function resolveInitialRowsUse({
  configuredSorting,
  firstPage,
  initialDataSort,
  sorting,
}: {
  /** The table's `columns.sort`. */
  configuredSorting?: unknown;
  /** Whether the table starts on page 1 at its default page size, without filters or search. */
  firstPage: boolean;
  /** The sort the host produced the rows with; unknown unless an array. */
  initialDataSort?: unknown;
  /** The sort the table starts from: the URL's, a view's, else `columns.sort`. */
  sorting: unknown;
}): InitialRowsUse {
  // A table starts from its configured sort, so its first page shows at once
  // even when the host did not say the rows follow that sort.
  const startsFromDefaultSort =
    sortingKey(sorting) === "" || isSameSorting(sorting, configuredSorting);
  if (!(firstPage && startsFromDefaultSort)) {
    return "unused";
  }
  return Array.isArray(initialDataSort) &&
    isSameSorting(sorting, initialDataSort)
    ? "current"
    : "placeholder";
}
