"use client";

import { useAtom } from "jotai";
import { Rows3 } from "lucide-react";
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
  const density = override ?? defaultDensity;
  const translated = t("menu.density");
  const label = translated === "menu.density" ? "Table density" : translated;
  const size = TABLE_DENSITY_OPTIONS.find(
    (option) => option.value === density
  )?.label;

  if (displayModeParam !== "table") {
    return null;
  }

  if (inline) {
    return (
      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className="mb-1 text-muted-foreground text-sm">{label}</legend>
        {TABLE_DENSITY_OPTIONS.map((option) => (
          <Button
            aria-pressed={density === option.value}
            className="min-w-9 flex-1"
            key={option.value}
            onClick={() => setDensity(option.value)}
            size="sm"
            type="button"
            variant={density === option.value ? "secondary" : "ghost"}
          >
            {option.label}
          </Button>
        ))}
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
