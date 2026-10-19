"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type {
  FilterMenu,
  FilterMenuColumnDef,
} from "../../../hooks/use-filter-menu";
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
    range
      ? [parse(current[0] ?? ""), parse(current[1] ?? "")]
      : parse(current[0] ?? "");
  const shown = range ? [list[0], list[1]] : list[0];
  // A value changed elsewhere shows here; "-" or "2." being typed stays.
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the rule's values only
  useEffect(() => {
    setTexts((current) =>
      same(typed(current), shown) ? current : committed()
    );
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

function useRemoteOptions(
  column: FilterMenuColumnDef,
  query: string,
  rememberOptions: FilterMenu["rememberOptions"]
) {
  const [loaded, setLoaded] = useState<
    { value: unknown; label: string; disabled?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const minimum = Math.max(0, column.optionsSearchMinLength ?? 0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    if (!column.optionsLoader || query.length < minimum) {
      setLoaded([]);
      setLoading(false);
      return;
    }
    setLoaded([]);
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const result = await column.optionsLoader?.(query, controller.signal);
          if (!controller.signal.aborted) {
            setLoaded(result ?? []);
            rememberOptions(column.id, result ?? []);
          }
        } catch {
          if (!controller.signal.aborted) {
            setLoaded([]);
            setFailed(true);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      query ? Math.max(0, column.optionsSearchDebounceMs ?? 300) : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    column.id,
    column.optionsLoader,
    column.optionsSearchDebounceMs,
    minimum,
    query,
    rememberOptions,
  ]);
  return { loaded, loading, failed, minimum };
}

function optionStatus(
  menu: FilterMenu,
  state: {
    loading: boolean;
    failed: boolean;
    minimum: number;
    query: string;
    count: number;
  }
): string {
  if (state.loading) {
    return menu.text("loadingOptions");
  }
  if (state.failed) {
    return menu.text("optionsError");
  }
  if (state.query.length < state.minimum) {
    return menu.text("searchMinimum").replace("{count}", String(state.minimum));
  }
  return state.count ? "" : menu.text("noOptions");
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
  const query = search.trim();
  const { loaded, loading, failed, minimum } = useRemoteOptions(
    column,
    query,
    menu.rememberOptions
  );
  const known = new Map(
    column.options?.map((option) => [option.value, option])
  );
  const optionsByValue = new Map(
    [
      ...(column.optionsLoader
        ? (column.staticOptions ?? [])
        : (column.options ?? [])),
      ...loaded,
    ].map((option) => [option.value, option])
  );
  // Keep the labels of selected choices when a later search returns other results.
  for (const value of values) {
    optionsByValue.set(
      value,
      optionsByValue.get(value) ??
        known.get(value) ?? { value, label: String(value) }
    );
  }
  const options = [...optionsByValue.values()];
  const normalized = query.toLocaleLowerCase();
  const visible =
    normalized && !column.optionsLoader
      ? options.filter((option) =>
          option.label.toLocaleLowerCase().includes(normalized)
        )
      : options;
  const multiple = filterOperatorIsMultiple(column.type, rule.operator);
  const checked = (value: unknown) =>
    values.some((item) => Object.is(item, value));
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
  const statusText = optionStatus(menu, {
    loading,
    failed,
    minimum,
    query,
    count: visible.length,
  });
  return (
    <div className="grid gap-1.5">
      {(column.optionsLoader || options.length > MANY_OPTIONS) && (
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
              disabled={option.disabled}
              onChange={() => toggle(option.value)}
              type="checkbox"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
        {statusText && (
          <output className="px-2 py-1 text-muted-foreground text-sm">
            {statusText}
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
