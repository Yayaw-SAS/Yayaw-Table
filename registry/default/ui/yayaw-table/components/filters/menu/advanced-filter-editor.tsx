"use client";

import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import type { AdvancedFilterModel } from "../../../types/filter-types";
import {
  changeFilterOperator,
  defaultFilterOperator,
  filterMenuOperators,
  filterOperatorLabel,
  filterOperatorNeedsValue,
  filterRuleSummary,
} from "../../../utils/filter-menu";
import { FILTER_POPOVER } from "./filter-chip";
import { FilterValueEditor } from "./filter-value-editor";

const SELECT =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm";

/**
 * The advanced filter, as in Notion: one row per rule ("Where", then "And" or
 * "Or"), each with its property, operator and value; rules can be added and
 * the whole filter deleted. Changes filter at once.
 */
export function AdvancedFilterEditor({ menu }: { menu: FilterMenu }) {
  const { text } = menu;
  const typeOf = (rule: AdvancedFilterModel) =>
    menu.column(rule.columnId)?.type ?? "text";
  const changeColumn = (rule: AdvancedFilterModel, columnId: string) => {
    const column = menu.column(columnId);
    if (!column) {
      return;
    }
    menu.update({
      ...rule,
      columnId,
      type: column.type,
      operator: column.folder
        ? "isAnyOf"
        : (filterMenuOperators(
            column.type,
            undefined,
            column.filterOperators
          )[0] ?? defaultFilterOperator(column.type)),
      values: undefined,
    } as unknown as AdvancedFilterModel);
  };
  const join = (index: number) => {
    if (index === 0) {
      return (
        <span className="px-1 text-muted-foreground text-sm">
          {text("where")}
        </span>
      );
    }
    if (index === 1) {
      return (
        <select
          aria-label={`${text("and")} / ${text("or")}`}
          className={SELECT}
          data-advanced-join=""
          onChange={(event) => menu.setJoin(event.target.value as "and" | "or")}
          value={menu.joinOperator}
        >
          <option value="and">{text("and")}</option>
          <option value="or">{text("or")}</option>
        </select>
      );
    }
    return (
      <span className="px-1 text-muted-foreground text-sm">
        {menu.joinOperator === "or" ? text("or") : text("and")}
      </span>
    );
  };
  const value = (rule: AdvancedFilterModel) => {
    if (!filterOperatorNeedsValue(rule.operator)) {
      return <span />;
    }
    const type = typeOf(rule);
    const column = menu.column(rule.columnId);
    if (
      (type === "text" || type === "number") &&
      rule.operator !== "between" &&
      !column?.folder
    ) {
      return (
        <Input
          aria-label={text("value")}
          className="h-8"
          defaultValue={
            typeof rule.values === "string" || typeof rule.values === "number"
              ? String(rule.values)
              : ""
          }
          key={`${rule.id}:${String(rule.values ?? "")}`}
          onBlur={(event) => {
            const raw = event.target.value;
            let values: unknown = raw;
            if (type === "number") {
              values = raw.trim() === "" ? undefined : Number(raw);
            }
            if (values !== rule.values) {
              menu.update({ ...rule, type, values } as AdvancedFilterModel);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          placeholder={text("typeValue")}
          step="any"
          type={type === "number" ? "number" : "text"}
        />
      );
    }
    const summary = column
      ? filterRuleSummary(rule, column, menu.locale, menu.translate).value
      : "";
    return (
      <Popover>
        <PopoverTrigger
          render={
            <button
              aria-label={text("value")}
              className={`${SELECT} inline-flex items-center justify-between gap-1 text-start`}
              type="button"
            />
          }
        >
          <span className="truncate">{summary || text("value")}</span>
          <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
        </PopoverTrigger>
        <PopoverContent align="start" className={FILTER_POPOVER}>
          <FilterValueEditor
            autoFocus
            menu={menu}
            onChange={menu.update}
            rule={rule}
          />
        </PopoverContent>
      </Popover>
    );
  };
  return (
    <div className="grid gap-1.5" data-advanced-filter="">
      {menu.rules.map((rule, index) => {
        const type = typeOf(rule);
        const column = menu.column(rule.columnId);
        return (
          <div
            className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_2rem] items-center gap-1.5 max-sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_2rem]"
            data-advanced-rule={rule.columnId}
            key={rule.id}
          >
            {join(index)}
            <select
              aria-label={text("property")}
              className={SELECT}
              onChange={(event) => changeColumn(rule, event.target.value)}
              value={rule.columnId}
            >
              {!column && (
                <option disabled value={rule.columnId}>
                  {rule.columnId}
                </option>
              )}
              {menu.columns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.header}
                </option>
              ))}
            </select>
            {column?.folder ? (
              <span />
            ) : (
              <select
                aria-label={text("operator")}
                className={SELECT}
                onChange={(event) =>
                  menu.update({
                    ...changeFilterOperator(rule, event.target.value, type),
                    type,
                  } as AdvancedFilterModel)
                }
                value={rule.operator}
              >
                {filterMenuOperators(
                  type,
                  rule.operator,
                  column?.filterOperators
                ).map((operator) => (
                  <option key={operator} value={operator}>
                    {filterOperatorLabel(
                      type,
                      operator,
                      menu.locale,
                      menu.translate
                    )}
                  </option>
                ))}
              </select>
            )}
            <div className="min-w-0 max-sm:col-span-3 max-sm:col-start-2 max-sm:row-start-2">
              {value(rule)}
            </div>
            <Button
              aria-label={text("deleteFilter")}
              className="max-sm:col-start-4 max-sm:row-start-1"
              onClick={() => menu.remove(rule.id)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2 border-t pt-1.5">
        <Button
          data-advanced-add=""
          onClick={() => menu.add(undefined, false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" />
          {text("addRule")}
        </Button>
        {menu.rules.length > 0 && (
          <Button
            data-advanced-delete=""
            onClick={() => menu.clear()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
            {text("deleteAdvanced")}
          </Button>
        )}
      </div>
    </div>
  );
}
