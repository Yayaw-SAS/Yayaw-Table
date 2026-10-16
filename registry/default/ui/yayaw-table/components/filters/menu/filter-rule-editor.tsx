"use client";

import {
  Check,
  ChevronDown,
  ListFilterPlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import type { AdvancedFilterModel } from "../../../types/filter-types";
import {
  changeFilterOperator,
  filterMenuOperators,
  filterOperatorLabel,
} from "../../../utils/filter-menu";
import { FilterValueEditor } from "./filter-value-editor";

/** A chip's editor, as in Notion: the property, its operator, more actions, then the value. */
export function FilterRuleEditor({
  menu,
  rule,
  autoFocus,
}: {
  menu: FilterMenu;
  rule: AdvancedFilterModel;
  autoFocus?: boolean;
}) {
  const column = menu.column(rule.columnId);
  const type = column?.type ?? "text";
  const header = column?.header ?? rule.columnId;
  const label = (operator: string) =>
    filterOperatorLabel(type, operator, menu.locale, menu.translate);
  return (
    <div className="grid gap-2" data-filter-rule={rule.columnId}>
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium text-sm">{header}</span>
        {!column?.folder && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label={`${menu.text("operator")}: ${label(rule.operator)}`}
                  className="inline-flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
                  data-filter-operator=""
                  type="button"
                />
              }
            >
              <span className="truncate">{label(rule.operator)}</span>
              <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              aria-label={menu.text("operator")}
              className="w-auto min-w-44"
            >
              {filterMenuOperators(type, rule.operator).map((operator) => (
                <DropdownMenuItem
                  data-operator={operator}
                  key={operator}
                  onClick={() =>
                    menu.update({
                      ...changeFilterOperator(rule, operator, type),
                      type,
                    } as AdvancedFilterModel)
                  }
                >
                  <Check
                    aria-hidden="true"
                    className={operator === rule.operator ? "" : "invisible"}
                  />
                  {label(operator)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`${header}: ${menu.text("more")}`}
                className="ml-auto"
                data-filter-more=""
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-52">
            <DropdownMenuItem
              data-filter-delete=""
              onClick={() => menu.remove(rule.id)}
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
              {menu.text("deleteFilter")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-filter-to-advanced=""
              onClick={() => menu.openAdvanced()}
            >
              <ListFilterPlus aria-hidden="true" />
              {menu.text("toAdvanced")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <FilterValueEditor
        autoFocus={autoFocus}
        menu={menu}
        onChange={menu.update}
        rule={rule}
      />
    </div>
  );
}
