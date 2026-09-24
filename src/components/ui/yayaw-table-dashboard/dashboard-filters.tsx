"use client";

import { X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/src/components/ui/native-select";
import {
  type DashboardDateRange,
  type DashboardFilter,
  type DashboardTableInfo,
  dashboardFilterOptions,
  dashboardFilterTargetsLabel,
  isDashboardFilterActive,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-widget";

interface FilterControlProps {
  filter: DashboardFilter;
  tables: Record<string, DashboardTableInfo>;
  editing: boolean;
  label: DashboardLabel;
  onChange: (value: DashboardDateRange | string[] | undefined) => void;
  onRemove: () => void;
}

function DateRangeControl({ filter, label, onChange }: FilterControlProps) {
  const range = (filter.value ?? {}) as DashboardDateRange;
  const update = (part: "start" | "end", value: string) =>
    onChange({ ...range, [part]: value || undefined });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={`${filter.label}: ${label("from")}`}
        className="h-8 w-40"
        data-filter-part="start"
        onChange={(event) => update("start", event.target.value)}
        type="date"
        value={range.start ?? ""}
      />
      <span aria-hidden="true" className="text-muted-foreground">
        –
      </span>
      <Input
        aria-label={`${filter.label}: ${label("to")}`}
        className="h-8 w-40"
        data-filter-part="end"
        onChange={(event) => update("end", event.target.value)}
        type="date"
        value={range.end ?? ""}
      />
    </div>
  );
}

function SelectControl({
  filter,
  label,
  onChange,
  tables,
}: FilterControlProps) {
  const values = Array.isArray(filter.value) ? filter.value : [];
  return (
    <NativeSelect
      aria-label={filter.label}
      className="w-44"
      onChange={(event) =>
        onChange(event.target.value ? [event.target.value] : undefined)
      }
      size="sm"
      value={values.at(0) ?? ""}
    >
      <NativeSelectOption value="">{label("any")}</NativeSelectOption>
      {dashboardFilterOptions(filter, tables).map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function DashboardFilterControl(props: FilterControlProps) {
  const { editing, filter, label, onChange, onRemove, tables } = props;
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-1.5"
      data-dashboard-filter={filter.id}
    >
      <legend className="mb-1.5 flex items-center gap-1 font-medium text-sm">
        {filter.label}
        {editing && (
          <Button
            aria-label={label("removeFilter", { name: filter.label })}
            onClick={onRemove}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {filter.type === "dateRange" ? (
          <DateRangeControl {...props} />
        ) : (
          <SelectControl {...props} />
        )}
        {isDashboardFilterActive(filter) && (
          <Button
            onClick={() => onChange(undefined)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {label("clear")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs" data-filter-targets="">
        {label("appliesTo", {
          targets: dashboardFilterTargetsLabel(filter, tables),
        })}
      </p>
    </fieldset>
  );
}

/** The dashboard's filters; each joins the widgets it targets. */
export function DashboardFilterBar({
  editing,
  filters,
  label,
  onAddFilter,
  onChange,
  onRemove,
  tables,
}: {
  editing: boolean;
  filters: DashboardFilter[];
  label: DashboardLabel;
  onAddFilter: () => void;
  onChange: (
    filterId: string,
    value: DashboardDateRange | string[] | undefined
  ) => void;
  onRemove: (filterId: string) => void;
  tables: Record<string, DashboardTableInfo>;
}) {
  if (!(filters.length || editing)) {
    return null;
  }
  return (
    <section
      aria-label={label("filters")}
      className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border bg-muted/40 p-3"
      data-dashboard-filters=""
    >
      {filters.map((filter) => (
        <DashboardFilterControl
          editing={editing}
          filter={filter}
          key={filter.id}
          label={label}
          onChange={(value) => onChange(filter.id, value)}
          onRemove={() => onRemove(filter.id)}
          tables={tables}
        />
      ))}
      {editing && (
        <Button onClick={onAddFilter} size="sm" type="button" variant="outline">
          {label("addFilter")}
        </Button>
      )}
    </section>
  );
}
