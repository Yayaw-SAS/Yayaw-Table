"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import type { AdvancedFilterModel } from "../../../types/filter-types";
import { filterRuleSummary } from "../../../utils/filter-menu";
import { FilterRuleEditor } from "./filter-rule-editor";

/** A chip's look: the primary tint while it filters, dashed while it waits for a value. */
export const CHIP =
  "inline-flex h-7 max-w-64 shrink-0 items-center gap-1 rounded-full border px-2.5 text-sm transition-colors hover:bg-muted data-[complete=true]:border-transparent data-[complete=true]:bg-primary/10 data-[complete=true]:text-primary data-[complete=true]:hover:bg-primary/15 data-[complete=false]:border-dashed data-[complete=false]:text-muted-foreground";

/** The popover the filter menu's editors open in. */
export const FILTER_POPOVER = "w-[min(22rem,calc(100vw-1rem))] gap-2 p-2";

/** One rule under the toolbar: "Status: Won, Open"; a click opens its editor. */
export function FilterChip({
  menu,
  rule,
}: {
  menu: FilterMenu;
  rule: AdvancedFilterModel;
}) {
  const column = menu.column(rule.columnId);
  const summary = column
    ? filterRuleSummary(rule, column, menu.locale, menu.translate)
    : { property: rule.columnId, value: "", complete: false };
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          menu.setOpenId(rule.id);
        } else if (menu.openId === rule.id) {
          menu.setOpenId(undefined);
        }
      }}
      open={menu.openId === rule.id}
    >
      <PopoverTrigger
        render={
          <button
            className={CHIP}
            data-complete={summary.complete}
            data-filter-chip={rule.columnId}
            title={`${summary.property} ${summary.value}`.trim()}
            type="button"
          />
        }
      >
        <span className="shrink-0">{summary.property}</span>
        {summary.value && (
          <span className={cn("truncate font-medium")}>{summary.value}</span>
        )}
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={summary.property}
        className={FILTER_POPOVER}
      >
        <FilterRuleEditor autoFocus menu={menu} rule={rule} />
      </PopoverContent>
    </Popover>
  );
}
