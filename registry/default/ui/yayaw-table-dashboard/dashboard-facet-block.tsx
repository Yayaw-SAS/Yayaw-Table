"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FacetCounts } from "@/components/ui/yayaw-table/utils/facets-model";
import { cn } from "@/lib/utils";
import type { DashboardBlock, DashboardBlockProps } from "./dashboard-block";
import {
  type FacetBlockOptions,
  facetBlockColumn,
  facetBlockEntries,
  facetBlockLabel,
  facetBlockProps,
  facetBlockSchema,
  loadFacetBlockCounts,
  toggleFacetBlockValue,
} from "./dashboard-facets";

/**
 * A column's values with their numbers of records under the screen's other
 * filters; a click sets the screen filter (`setFilter`), so the widgets it
 * targets (a full-page table…) follow.
 */
function FacetBlock({
  filterRules,
  filters,
  locale,
  options,
  props,
  revision,
  setFilter,
}: DashboardBlockProps & { options: FacetBlockOptions }) {
  const settings = facetBlockProps(props, options);
  const column = useMemo(
    () => facetBlockColumn(options.column, locale),
    [locale, options.column]
  );
  const rules = filterRules(options.tableId, { exclude: [settings.filterId] });
  const rulesKey = JSON.stringify(rules);
  const [counts, setCounts] = useState<FacetCounts>();
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading"
  );
  const [refusal, setRefusal] = useState<string>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `rulesKey` stands for the rules, `revision` reloads.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    loadFacetBlockCounts({
      actions: options.actions,
      column,
      rules: JSON.parse(rulesKey) as Record<string, unknown>[],
      locale,
      signal: controller.signal,
    })
      .then((loaded) => {
        if (!controller.signal.aborted) {
          setCounts(loaded);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [column, locale, options.actions, revision, rulesKey]);
  const selected = filters[settings.filterId];
  const entries = facetBlockEntries(column, { counts, selected, locale });
  const set = (value: unknown) => {
    const result = setFilter(settings.filterId, value);
    setRefusal(result.ok ? undefined : result.message);
  };
  const chips = settings.layout === "chips";
  const chosen = Array.isArray(selected) && selected.length > 0;
  return (
    <div
      className="flex min-w-0 flex-col gap-2 text-sm"
      data-facet-block={settings.filterId}
    >
      <ul
        className={cn(
          "m-0 flex list-none gap-1 p-0",
          chips ? "flex-row flex-wrap" : "flex-col"
        )}
      >
        <li>
          <button
            aria-pressed={!chosen}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              chips && "rounded-full border",
              !chosen && "bg-accent font-medium"
            )}
            data-facet-all=""
            onClick={() => set(undefined)}
            type="button"
          >
            {facetBlockLabel("facetAll", locale)}
          </button>
        </li>
        {entries.map((entry) => (
          <li key={entry.key}>
            <button
              aria-pressed={entry.selected}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                chips && "w-auto rounded-full border",
                entry.selected && "bg-accent font-medium"
              )}
              data-facet-value={String(entry.value)}
              onClick={() =>
                set(toggleFacetBlockValue(selected, String(entry.value)))
              }
              type="button"
            >
              {entry.selected && !chips ? (
                <Check aria-hidden="true" className="size-3.5 shrink-0" />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {settings.showCounts && entry.count !== undefined ? (
                <span
                  className="shrink-0 text-muted-foreground text-xs tabular-nums"
                  data-facet-count=""
                >
                  {entry.count.toLocaleString(locale)}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {status === "loading" && !counts ? (
        <p className="text-muted-foreground text-xs">
          {facetBlockLabel("facetLoading", locale)}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive text-xs" role="alert">
          {facetBlockLabel("facetError", locale)}
        </p>
      ) : null}
      {status === "ready" && !entries.length ? (
        <p className="text-muted-foreground text-xs">
          {facetBlockLabel("facetEmpty", locale)}
        </p>
      ) : null}
      {refusal ? (
        <p className="text-destructive text-xs" role="alert">
          {refusal}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The "Facet list" block: a column's values with their numbers of records;
 * a click sets a screen filter (`filterId`, a select filter on the column),
 * which drives every widget it targets, such as a full-page table. Counts
 * come from `actions.aggregate` (grouped by the column), else from the rows
 * `actions.list` returns, under the screen's other filters.
 */
export function createFacetBlock(options: FacetBlockOptions): DashboardBlock {
  const component = (props: DashboardBlockProps) => (
    <FacetBlock {...props} options={options} />
  );
  return { ...facetBlockSchema(options), component };
}
