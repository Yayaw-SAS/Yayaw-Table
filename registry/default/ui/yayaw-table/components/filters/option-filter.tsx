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
import { useRememberedFilterOptions } from "../../hooks/use-filter-menu";
import { useRemoteFilterOptions } from "../../hooks/use-remote-filter-options";
import { useTranslations } from "../../providers/table-provider";
import {
  type FilterBarColumn,
  type FilterBarOption,
  filterBarOptions,
  filterValueKey,
  filterValues,
} from "../../utils/filter-bar";
import {
  type FilterMenuTextKey,
  filterMenuText,
} from "../../utils/filter-menu";
import { limitOptions } from "../../utils/table-contracts";

/** Up to this many choices, a single-choice filter shows them without a search field. */
const SINGLE_CHOICE_SEARCH_THRESHOLD = 8;
/** How many more matches the search can reach, once the list stops drawing them. */
const moreOptionsText = (hidden: number, text: string) =>
  hidden ? text.replace("{count}", String(hidden)) : "";

export function OptionFilter({
  tableId,
  column,
  value,
  onChange,
}: {
  tableId: string;
  column: FilterBarColumn;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t, locale } = useTranslations();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const query = search.trim();
  const [resolved, remember] = useRememberedFilterOptions(tableId);
  const remote = useRemoteFilterOptions(column, query, remember, open);
  const menuText = (key: FilterMenuTextKey) =>
    filterMenuText(key, locale, (name) =>
      t(name) === name ? undefined : t(name)
    );
  const selected = filterValues(value);
  const options = filterBarOptions(
    {
      ...column,
      options: [
        ...(Array.isArray(column.options) ? column.options : []),
        ...(remote.loaded as FilterBarOption[]),
      ],
    },
    value,
    { yes: t("common.true"), no: t("common.false") },
    resolved[column.id]
  );
  const checked = (candidate: unknown) =>
    selected.some((item) => filterValueKey(item) === filterValueKey(candidate));
  const single = column.filterSelection === "single";
  const current =
    single && selected.length
      ? (options.find((option) => checked(option.value))?.label ??
        String(selected[0]))
      : undefined;
  const searchable =
    !single ||
    Boolean(column.optionsLoader) ||
    options.length > SINGLE_CHOICE_SEARCH_THRESHOLD;
  const pick = (candidate: unknown) => {
    onChange(candidate);
    setOpen(false);
  };
  const remoteValues = new Set(
    remote.loaded.map((option) => filterValueKey(option.value))
  );
  // Server results may match other fields; retain those and selections while searching static labels.
  const matching = options.filter(
    (option) =>
      option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
      (column.optionsLoader &&
        (checked(option.value) ||
          remoteValues.has(filterValueKey(option.value))))
  );
  // Only the first matches are drawn: a list of thousands stays instant, typing reaches the others.
  const { shown: visible, hidden } = limitOptions(matching);
  let status = visible.length
    ? moreOptionsText(hidden, menuText("moreOptions"))
    : t("filters.noResults");
  if (remote.loading) {
    status = menuText("loadingOptions");
  } else if (remote.failed) {
    status = menuText("optionsError");
  } else if (column.optionsLoader && query.length < remote.minimum) {
    status = menuText("searchMinimum").replace(
      "{count}",
      String(remote.minimum)
    );
  }
  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        setSearch("");
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-label={column.header}
            className="h-8 max-w-full gap-2 px-3 font-normal text-xs leading-4 data-[active]:bg-accent"
            data-active={selected.length > 0 || undefined}
            type="button"
            variant="outline"
          />
        }
      >
        <Filter aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">
          {column.header}
          {current !== undefined && (
            <>
              : <span className="font-medium">{current}</span>
            </>
          )}
        </span>
        {!single && selected.length > 0 && (
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
        {searchable && (
          <Input
            aria-label={t("common.search")}
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            type="search"
            value={search}
          />
        )}
        {single ? (
          <fieldset
            aria-label={column.header}
            className="m-0 grid max-h-60 min-w-0 gap-0.5 overflow-auto border-0 p-0"
          >
            {[{ value: undefined, label: menuText("all") }, ...visible].map(
              (option, index) => (
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${index === 0 ? "border-b" : ""}`}
                  key={
                    option.value === undefined
                      ? "all"
                      : filterValueKey(option.value)
                  }
                >
                  <input
                    checked={
                      option.value === undefined
                        ? !selected.length
                        : checked(option.value)
                    }
                    disabled={"disabled" in option && option.disabled}
                    name={`${tableId}-${column.id}-quick-filter`}
                    onChange={() =>
                      pick(option.value === undefined ? [] : option.value)
                    }
                    type="radio"
                  />
                  <span>{option.label}</span>
                </label>
              )
            )}
            {status && (
              <output className="block p-2 text-muted-foreground text-sm">
                {status}
              </output>
            )}
          </fieldset>
        ) : (
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
            {status && (
              <output className="block p-2 text-muted-foreground text-sm">
                {status}
              </output>
            )}
          </fieldset>
        )}
        {!single && (
          <Button
            disabled={!selected.length}
            onClick={() => onChange([])}
            type="button"
            variant="outline"
          >
            {t("filters.clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
