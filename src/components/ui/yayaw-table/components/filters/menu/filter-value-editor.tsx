"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/src/components/ui/input";
import type { FilterMenu, FilterMenuColumnDef } from "../../../hooks/use-filter-menu";
import type { AdvancedFilterModel } from "../../../types/filter-types";
import {
  filterOperatorIsMultiple,
  filterOperatorNeedsValue,
} from "../../../utils/filter-menu";
import { FolderFilterInput } from "../folder-filter";
import { LocationFilter } from "../location-filter";
import { DateValueEditor } from "./date-value-editor";

const ruleValues = (values: unknown): unknown[] => {
  if (Array.isArray(values)) {
    return values;
  }
  return values === undefined ? [] : [values];
};

/**
 * Typed values stay on screen while being written and filter once typing
 * pauses, on Enter or on leaving the field, so a server table is not asked
 * for every keystroke ("2", "24", "240"…). Escape brings back the value
 * that filters.
 */
const TYPING_PAUSE_MS = 500;
const MANY_OPTIONS = 6;

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function TypedValues({
  menu,
  rule,
  column,
  autoFocus,
  onChange,
}: {
  menu: FilterMenu;
  rule: AdvancedFilterModel;
  column: FilterMenuColumnDef;
  autoFocus?: boolean;
  onChange: (values: unknown) => void;
}) {
  const list = Array.isArray(rule.values) ? rule.values : [rule.values];
  const committed = () =>
    [0, 1].map((index) => {
      const value = list[index];
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    });
  const [texts, setTexts] = useState<string[]>(committed);
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const range = rule.operator === "between";
  const parse = (raw: string): unknown => {
    if (column.type !== "number") {
      return raw;
    }
    const value = raw.trim() === "" ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const typed = (current: string[]) =>
    range ? [parse(current[0] ?? ""), parse(current[1] ?? "")] : parse(current[0] ?? "");
  const shown = range ? [list[0], list[1]] : list[0];
  // A value changed elsewhere shows here; "-" or "2." being typed stays.
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the rule's values only
  useEffect(() => {
    setTexts((current) => (same(typed(current), shown) ? current : committed()));
  }, [JSON.stringify(rule.values)]);
  const latest = useRef({ texts, commit: () => undefined as unknown });
  const commit = (current = latest.current.texts) => {
    clearTimeout(typing.current);
    typing.current = undefined;
    const next = typed(current);
    if (!same(next, shown)) {
      onChange(next);
    }
  };
  latest.current = { texts, commit: () => commit() };
  useEffect(
    () => () => {
      if (typing.current) {
        latest.current.commit();
      }
    },
    []
  );
  const change = (index: number, value: string) => {
    const next = [...texts];
    next[index] = value;
    setTexts(next);
    clearTimeout(typing.current);
    typing.current = setTimeout(() => commit(next), TYPING_PAUSE_MS);
  };
  return (
    <div className={range ? "grid grid-cols-2 gap-1.5" : "grid"}>
      {(range ? [0, 1] : [0]).map((index) => (
        <Input
          aria-label={index ? menu.text("to") : menu.text("value")}
          autoFocus={autoFocus && index === 0}
          data-filter-input=""
          key={index}
          onBlur={() => commit()}
          onChange={(event) => change(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape" && typing.current) {
              // The value is put back; a second Escape closes the editor.
              event.stopPropagation();
              clearTimeout(typing.current);
              typing.current = undefined;
              setTexts(committed());
            }
          }}
          placeholder={menu.text("typeValue")}
          step={column.type === "number" ? "any" : undefined}
          type={column.type === "number" ? "number" : "text"}
          value={texts[index] ?? ""}
        />
      ))}
    </div>
  );
}

function OptionValues({
  menu,
  rule,
  column,
  autoFocus,
  onChange,
}: {
  menu: FilterMenu;
  rule: AdvancedFilterModel;
  column: FilterMenuColumnDef;
  autoFocus?: boolean;
  onChange: (values: unknown) => void;
}) {
  const [search, setSearch] = useState("");
  const values = ruleValues(rule.values);
  const options = [...(column.options ?? [])];
  // A selected value can be absent from the current server page's facets.
  for (const value of values) {
    if (!options.some((option) => String(option.value) === String(value))) {
      options.push({ value, label: String(value) });
    }
  }
  const query = search.trim().toLocaleLowerCase();
  const visible = query
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(query))
    : options;
  const multiple = filterOperatorIsMultiple(column.type, rule.operator);
  const checked = (value: unknown) => values.some((item) => Object.is(item, value));
  const toggle = (value: unknown) => {
    if (!multiple) {
      onChange(checked(value) ? undefined : value);
      return;
    }
    onChange(
      checked(value)
        ? values.filter((item) => !Object.is(item, value))
        : [...values, value]
    );
  };
  return (
    <div className="grid gap-1.5">
      {options.length > MANY_OPTIONS && (
        <Input
          aria-label={menu.text("searchOptions")}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={menu.text("searchOptions")}
          type="search"
          value={search}
        />
      )}
      <fieldset
        aria-label={column.header}
        className="m-0 grid max-h-64 gap-0.5 overflow-y-auto border-0 p-0"
      >
        {visible.map((option) => (
          <label
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
            key={`${typeof option.value}:${String(option.value)}`}
          >
            <input
              checked={checked(option.value)}
              className="size-4 accent-blue-600"
              onChange={() => toggle(option.value)}
              type="checkbox"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
        {!visible.length && (
          <output className="px-2 py-1 text-muted-foreground text-sm">
            {menu.text("noOptions")}
          </output>
        )}
      </fieldset>
    </div>
  );
}

/** The value part of a rule's editor, by type; every change updates the rule. */
export function FilterValueEditor({
  menu,
  rule,
  autoFocus,
  onChange,
}: {
  menu: FilterMenu;
  rule: AdvancedFilterModel;
  autoFocus?: boolean;
  onChange: (rule: AdvancedFilterModel) => void;
}) {
  const column = menu.column(rule.columnId);
  if (!column) {
    return null;
  }
  const set = (values: unknown, operator: string = rule.operator) =>
    onChange({
      ...rule,
      type: column.type,
      operator,
      values,
    } as AdvancedFilterModel);
  if (column.folder) {
    // A pick names the operator, then the folders: one change.
    let picked = rule.operator;
    return (
      <FolderFilterInput
        folder={column.folder}
        onOperatorChange={(operator) => {
          picked = operator;
        }}
        onValueChange={(values) => set(values, picked)}
        operator={rule.operator}
        value={rule.values}
      />
    );
  }
  if (!filterOperatorNeedsValue(rule.operator)) {
    return null;
  }
  switch (column.type) {
    case "date":
      return (
        <DateValueEditor
          menu={menu}
          onChange={(next) => set(next.values, next.operator)}
          operator={rule.operator}
          values={rule.values}
        />
      );
    case "select":
    case "multiSelect":
    case "boolean":
      return (
        <OptionValues
          autoFocus={autoFocus}
          column={column}
          menu={menu}
          onChange={set}
          rule={rule}
        />
      );
    case "location":
      return (
        <LocationFilter
          compact
          onOperatorChange={(operator) => set(rule.values, operator)}
          onValueChange={(values) => set(values)}
          operator={rule.operator as never}
          showOperator={false}
          value={rule.values as number[] | undefined}
        />
      );
    default:
      return (
        <TypedValues
          autoFocus={autoFocus}
          column={column}
          key={rule.operator}
          menu={menu}
          onChange={set}
          rule={rule}
        />
      );
  }
}
