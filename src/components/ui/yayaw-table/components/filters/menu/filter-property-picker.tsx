"use client";

import {
  Calendar,
  CircleDot,
  Hash,
  ListFilterPlus,
  MapPin,
  Tags,
  Type,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/src/components/ui/input";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import {
  filterPropertyCounts,
  type FilterMenuType,
} from "../../../utils/filter-menu";

const ICONS: Record<FilterMenuType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: CircleDot,
  multiSelect: Tags,
  boolean: CircleDot,
  location: MapPin,
};

const CHOICE =
  "flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/** The properties a new filter can use, searchable; "Add advanced filter" below. */
export function FilterPropertyPicker({
  menu,
  advanced = true,
  onPick,
  onAdvanced,
}: {
  menu: FilterMenu;
  advanced?: boolean;
  onPick: (columnId: string) => void;
  onAdvanced: () => void;
}) {
  const [query, setQuery] = useState("");
  const counts = filterPropertyCounts(menu.rules);
  const search = query.trim().toLocaleLowerCase();
  const visible = menu.columns.filter(
    (column) => !search || column.header.toLocaleLowerCase().includes(search)
  );
  return (
    <div className="grid gap-1" data-filter-property-picker="">
      <Input
        aria-label={menu.text("filterBy")}
        autoComplete="off"
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          const first = visible[0];
          if (event.key === "Enter" && first) {
            event.preventDefault();
            onPick(first.id);
          }
        }}
        placeholder={menu.text("filterBy")}
        type="search"
        value={query}
      />
      <fieldset
        aria-label={menu.text("property")}
        className="m-0 grid max-h-72 gap-0.5 overflow-y-auto border-0 p-0"
      >
        {visible.map((column) => {
          const Icon = ICONS[column.type] ?? Type;
          return (
            <button
              className={CHOICE}
              data-filter-property={column.id}
              key={column.id}
              onClick={() => onPick(column.id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{column.header}</span>
              {Boolean(counts[column.id]) && (
                <span
                  className="ml-auto text-muted-foreground text-xs tabular-nums"
                  data-filter-property-count={column.id}
                >
                  {counts[column.id]}
                </span>
              )}
            </button>
          );
        })}
        {!visible.length && (
          <output className="px-2 py-1 text-muted-foreground text-sm">
            {menu.text("noProperties")}
          </output>
        )}
      </fieldset>
      {advanced && (
        <button
          className={`${CHOICE} border-t pt-1 text-muted-foreground`}
          data-filter-add-advanced=""
          onClick={onAdvanced}
          type="button"
        >
          <ListFilterPlus aria-hidden="true" className="size-4 shrink-0" />
          <span>{menu.text("addAdvanced")}</span>
        </button>
      )}
    </div>
  );
}
