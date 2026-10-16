"use client";

import { useAtom } from "jotai";
import { Rows3 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tableDensityAtom } from "../../atoms/table-atoms";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDensity, TableDisplayMode } from "../../types/display-types";
import {
  isTableDensity,
  TABLE_DENSITY_OPTIONS,
} from "../../utils/table-contracts";
import { TableTooltip } from "../../utils/table-tooltip";
import { getViewModeCapabilities } from "../../utils/view-menu";

export function TableDensityMenu({
  inline = false,
  defaultDensity = "medium",
  defaultDisplayMode,
  tableId,
}: {
  inline?: boolean;
  defaultDensity?: TableDensity;
  defaultDisplayMode?: TableDisplayMode;
  tableId: string;
}) {
  const { t } = useTranslations();
  const { displayModeParam } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const [override, setDensity] = useAtom(tableDensityAtom(tableId));
  const name = useId();
  const density = override ?? defaultDensity;
  const translated = t("menu.density");
  const label = translated === "menu.density" ? "Table density" : translated;
  const size = TABLE_DENSITY_OPTIONS.find(
    (option) => option.value === density
  )?.label;

  if (!getViewModeCapabilities(displayModeParam).density) {
    return null;
  }

  if (inline) {
    // One segmented control: native radios keep it one tab stop, moved with
    // the arrow keys, whatever the host's button styles.
    return (
      <fieldset className="m-0 min-w-0 border-0 p-0" data-density-segments="">
        <legend className="mb-1 p-0 text-muted-foreground text-sm">
          {label}
        </legend>
        <div className="flex w-full rounded-md border bg-muted/60 p-0.5">
          {TABLE_DENSITY_OPTIONS.map((option) => (
            <label
              className="relative inline-flex h-7 min-w-0 flex-1 cursor-pointer select-none items-center justify-center rounded-[calc(var(--radius-md)-2px)] px-1 text-muted-foreground text-sm transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:has-checked:bg-input/60"
              key={option.value}
            >
              <input
                checked={density === option.value}
                className="sr-only"
                name={name}
                onChange={() => setDensity(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TableTooltip label={`${label}: ${size}`}>
            <Button
              aria-label={`${label}: ${size}`}
              className="h-8 w-8"
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <Rows3 aria-hidden="true" className="size-4" />
            </Button>
          </TableTooltip>
        }
      />
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => {
              if (isTableDensity(value)) {
                setDensity(value);
              }
            }}
            value={density}
          >
            {TABLE_DENSITY_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
