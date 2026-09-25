import { defineComponent, h, markRaw } from "vue";
import DashboardFacetBlock from "./DashboardFacetBlock.vue";
import { type FacetBlockOptions, facetBlockSchema } from "./dashboard-facets";
import type { DashboardBlock } from "./dashboard-types";

/**
 * The "Facet list" block: a column's values with their numbers of records;
 * a click sets a screen filter (`filterId`, a select filter on the column),
 * which drives every widget it targets, such as a full-page table. Counts
 * come from `actions.aggregate` (grouped by the column), else from the rows
 * `actions.list` returns, under the screen's other filters.
 */
export function createFacetBlock(options: FacetBlockOptions): DashboardBlock {
  const component = markRaw(
    defineComponent({
      name: "FacetListBlock",
      inheritAttrs: false,
      setup:
        (_props, { attrs }) =>
        () =>
          h(DashboardFacetBlock as never, { ...attrs, options }),
    })
  );
  return { ...facetBlockSchema(options), component };
}
