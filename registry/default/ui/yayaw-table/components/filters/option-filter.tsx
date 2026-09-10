"use client";

import { ChevronDown, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "../../providers/table-provider";
import {
  type FilterBarColumn,
  filterBarOptions,
  filterValueKey,
  filterValues,
} from "../../utils/filter-bar";

export function OptionFilter({
  column,
  value,
  onChange,
}: {
  column: FilterBarColumn;
  value: unknown;
  onChange: (values: unknown[]) => void;
}) {
  const { t } = useTranslations();
  const [search, setSearch] = useState("");
  const selected = filterValues(value);
  const options = filterBarOptions(column, value, {
    yes: t("common.true"),
    no: t("common.false"),
  });
  const checked = (candidate: unknown) =>
    selected.some((item) => filterValueKey(item) === filterValueKey(candidate));
  const visible = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  return (
    <Popover onOpenChange={() => setSearch("")}>
      <PopoverTrigger
        render={
          <Button
            aria-label={column.header}
            className="h-8 max-w-full gap-2 px-3 font-normal text-xs leading-4"
            type="button"
            variant="outline"
          />
        }
      >
        <Filter aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{column.header}</span>
        {selected.length > 0 && (
          <span className="rounded-sm bg-muted px-1.5 text-xs">
            {selected.length}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-w-[calc(100vw-1rem)] gap-2 p-3"
      >
        <PopoverTitle className="font-medium text-sm">
          {column.header}
        </PopoverTitle>
        <Input
          aria-label={t("common.search")}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("common.search")}
          type="search"
          value={search}
        />
        <fieldset
          aria-label={column.header}
          className="m-0 max-h-60 min-w-0 overflow-auto border-0 p-0"
        >
          {visible.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              key={filterValueKey(option.value)}
            >
              <input
                checked={checked(option.value)}
                disabled={option.disabled}
                onChange={() =>
                  onChange(
                    checked(option.value)
                      ? selected.filter(
                          (item) =>
                            filterValueKey(item) !==
                            filterValueKey(option.value)
                        )
                      : [...selected, option.value]
                  )
                }
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
          {!visible.length && (
            <output className="block p-2 text-muted-foreground text-sm">
              {t("filters.noResults")}
            </output>
          )}
        </fieldset>
        <Button
          disabled={!selected.length}
          onClick={() => onChange([])}
          type="button"
          variant="outline"
        >
          {t("filters.clear")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
