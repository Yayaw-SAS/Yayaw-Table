"use client";

import { useAtom } from "jotai";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { filterMenuRequestAtom } from "../../../atoms/table-atoms";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import { filterBarDateRuleId } from "../../../utils/filter-bar";
import {
  filterChipsLayout,
  filterRulesCountText,
} from "../../../utils/filter-menu";
import { AdvancedFilterEditor } from "./advanced-filter-editor";
import { CHIP, FILTER_POPOVER, FilterChip } from "./filter-chip";
import { FilterPropertyPicker } from "./filter-property-picker";

/**
 * The rules under the toolbar, as Notion shows them: one chip per rule, or
 * one chip for the advanced filter, then "+ Filter" and "Clear". Date periods
 * pinned to the filter bar or the toolbar show there instead. The add button
 * stays visible without rules so the first filter needs no settings menu.
 */
export function FilterChipsBar({
  menu,
  compact,
}: {
  menu: FilterMenu;
  compact?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [request, setRequest] = useAtom(filterMenuRequestAtom(menu.tableId));
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per header request
  useEffect(() => {
    if (request) {
      setRequest(undefined);
      menu.add(request);
    }
  }, [request]);
  const layout = filterChipsLayout(menu.rules, menu.joinOperator, {
    advanced: menu.advanced,
    pinnedColumns: menu.pinnedDates,
  });
  const hasRules = Boolean(layout.chips.length || layout.advanced.length);
  if (!(menu.columns.length || hasRules)) {
    return null;
  }
  const count = filterRulesCountText(
    layout.advanced.length,
    menu.locale,
    menu.translate
  );
  return (
    <fieldset
      aria-label={menu.text("filter")}
      className={
        compact
          ? "m-0 flex min-w-0 items-center gap-1.5 overflow-x-auto border-0 p-0 pb-0.5"
          : "m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0"
      }
      data-filter-chips=""
    >
      {layout.chips.map((rule) => (
        <FilterChip key={rule.id} menu={menu} rule={rule} />
      ))}
      {layout.advanced.length > 0 && (
        <Popover onOpenChange={menu.setAdvancedOpen} open={menu.advancedOpen}>
          <PopoverTrigger
            render={
              <button
                className={CHIP}
                data-complete="true"
                data-filter-chip-advanced=""
                type="button"
              />
            }
          >
            <span>{count}</span>
            <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={count}
            className={`${FILTER_POPOVER} w-[min(44rem,calc(100vw-1rem))]`}
          >
            <AdvancedFilterEditor menu={menu} />
          </PopoverContent>
        </Popover>
      )}
      <Popover onOpenChange={setAdding} open={adding}>
        <PopoverTrigger
          render={
            <button
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
              data-filter-chip-add=""
              type="button"
            />
          }
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {menu.text("addFilter")}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={FILTER_POPOVER}
          finalFocus={false}
        >
          <FilterPropertyPicker
            advanced={!layout.advanced.length}
            menu={menu}
            onAdvanced={() => {
              setAdding(false);
              menu.openAdvanced();
            }}
            onPick={(columnId) => {
              setAdding(false);
              menu.add(columnId);
            }}
          />
        </PopoverContent>
      </Popover>
      {hasRules && (
        <button
          className="ml-auto inline-flex h-7 shrink-0 items-center rounded-md px-2 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
          data-filter-chips-clear=""
          onClick={() => menu.clear(menu.pinnedDates.map(filterBarDateRuleId))}
          type="button"
        >
          {menu.text("clear")}
        </button>
      )}
    </fieldset>
  );
}
