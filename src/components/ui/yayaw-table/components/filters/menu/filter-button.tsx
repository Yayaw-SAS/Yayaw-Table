"use client";

import { useAtom } from "jotai";
import { ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { filterMenuRequestAtom } from "../../../atoms/table-atoms";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import { FILTER_POPOVER } from "./filter-chip";
import { FilterPropertyPicker } from "./filter-property-picker";

/**
 * Notion's Filter button: the properties first, then the new rule's chip
 * opens under the toolbar. Its badge counts the rules that filter. A column
 * header's "Filter" lands here too.
 */
export function FilterButton({
  menu,
  compact,
}: {
  menu: FilterMenu;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useAtom(filterMenuRequestAtom(menu.tableId));
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per header request
  useEffect(() => {
    if (request) {
      setRequest(undefined);
      menu.add(request);
    }
  }, [request]);
  const count = menu.activeCount;
  const label = menu.text("filter");
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            className="relative"
            data-active={count > 0}
            data-filter-button=""
            size={compact ? "icon" : "default"}
            type="button"
            variant="outline"
          />
        }
      >
        <ListFilter aria-hidden="true" />
        {!compact && <span>{label}</span>}
        {count > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white leading-4"
            data-filter-count=""
          >
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className={FILTER_POPOVER} finalFocus={false}>
        <FilterPropertyPicker
          menu={menu}
          onAdvanced={() => {
            setOpen(false);
            menu.openAdvanced();
          }}
          onPick={(columnId) => {
            setOpen(false);
            menu.add(columnId);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
