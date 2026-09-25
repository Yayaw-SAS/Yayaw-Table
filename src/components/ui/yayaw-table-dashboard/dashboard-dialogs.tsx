"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/src/components/ui/native-select";
import {
  type DashboardFilter,
  type DashboardFilterType,
  type DashboardKpiMetric,
  type DashboardOverflow,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardWidgetDraft,
  dashboardCompareDayOptions,
  dashboardDateColumns,
  dashboardMetricOptions,
  filterableColumns,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-widget";

export function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="font-medium text-sm" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** A checkbox with its label on the right. */
export function CheckField({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        checked={checked}
        className="size-4 accent-primary"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <label className="text-sm" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

const NUMBER_TYPES = new Set(["number", "currency", "percent"]);

/** Records that do not fit: show what fits ("+N more"), or scroll. */
export function OverflowField({
  draft,
  ids,
  label,
  setDraft,
}: {
  draft: DashboardWidgetDraft;
  ids: Record<string, string>;
  label: DashboardLabel;
  setDraft: (draft: DashboardWidgetDraft) => void;
}) {
  return (
    <Field htmlFor={ids.overflow} label={label("overflow")}>
      <NativeSelect
        className="w-full"
        id={ids.overflow}
        onChange={(event) =>
          setDraft({
            ...draft,
            overflow: event.target.value as DashboardOverflow,
          })
        }
        value={draft.overflow}
      >
        <NativeSelectOption value="fit">{label("overflowFit")}</NativeSelectOption>
        <NativeSelectOption value="scroll">
          {label("overflowScroll")}
        </NativeSelectOption>
      </NativeSelect>
    </Field>
  );
}

/** The period and trend options of a number, over one of its date columns. */
function KpiPeriodFields({
  draft,
  ids,
  label,
  locale,
  setDraft,
  tables,
  translate,
}: {
  draft: DashboardWidgetDraft;
  ids: Record<string, string>;
  label: DashboardLabel;
  locale: string;
  setDraft: (draft: DashboardWidgetDraft) => void;
  tables: Record<string, DashboardTableInfo>;
  translate: DashboardTranslate;
}) {
  const dateColumns = dashboardDateColumns(
    tables[draft.tableId]?.columns ?? []
  );
  if (!dateColumns.length) {
    return null;
  }
  return (
    <>
      <Field htmlFor={ids.date} label={label("dateColumn")}>
        <NativeSelect
          className="w-full"
          id={ids.date}
          onChange={(event) =>
            setDraft({ ...draft, dateColumn: event.target.value })
          }
          value={draft.dateColumn}
        >
          <NativeSelectOption value="">{label("noDateColumn")}</NativeSelectOption>
          {dateColumns.map((column) => (
            <NativeSelectOption key={column.id} value={column.id}>
              {column.header ?? column.id}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <CheckField
        checked={draft.compare}
        disabled={!draft.dateColumn}
        id={ids.compare}
        label={label("compare")}
        onChange={(compare) => setDraft({ ...draft, compare })}
      />
      {draft.compare && draft.dateColumn ? (
        <div className="grid grid-cols-2 gap-4">
          <Field htmlFor={ids.days} label={label("compareDays")}>
            <NativeSelect
              className="w-full"
              id={ids.days}
              onChange={(event) =>
                setDraft({ ...draft, compareDays: Number(event.target.value) })
              }
              value={String(draft.compareDays)}
            >
              {dashboardCompareDayOptions(locale, translate).map((option) => (
                <NativeSelectOption
                  key={option.value}
                  value={String(option.value)}
                >
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field htmlFor={ids.better} label={label("compareBetter")}>
            <NativeSelect
              className="w-full"
              id={ids.better}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  compareBetter: event.target.value === "down" ? "down" : "up",
                })
              }
              value={draft.compareBetter}
            >
              <NativeSelectOption value="up">
                {label("compareUp")}
              </NativeSelectOption>
              <NativeSelectOption value="down">
                {label("compareDown")}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <CheckField
        checked={draft.sparkline}
        disabled={!draft.dateColumn}
        id={ids.sparkline}
        label={label("sparkline")}
        onChange={(sparkline) => setDraft({ ...draft, sparkline })}
      />
    </>
  );
}

export function KpiFields({
  draft,
  ids,
  label,
  locale,
  setDraft,
  tables,
  translate,
}: {
  draft: DashboardWidgetDraft;
  ids: Record<string, string>;
  label: DashboardLabel;
  locale: string;
  setDraft: (draft: DashboardWidgetDraft) => void;
  tables: Record<string, DashboardTableInfo>;
  translate: DashboardTranslate;
}) {
  const numberColumns = (tables[draft.tableId]?.columns ?? []).filter(
    (column) => NUMBER_TYPES.has(String(column.type))
  );
  return (
    <>
      <Field htmlFor={ids.metric} label={label("metric")}>
        <NativeSelect
          className="w-full"
          id={ids.metric}
          onChange={(event) =>
            setDraft({
              ...draft,
              metric: event.target.value as DashboardKpiMetric,
              metricColumn:
                draft.metricColumn || (numberColumns.at(0)?.id ?? ""),
            })
          }
          value={draft.metric}
        >
          {dashboardMetricOptions(locale, translate).map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {draft.metric !== "count" && (
        <Field htmlFor={ids.column} label={label("metricColumn")}>
          <NativeSelect
            className="w-full"
            id={ids.column}
            onChange={(event) =>
              setDraft({ ...draft, metricColumn: event.target.value })
            }
            value={draft.metricColumn}
          >
            {numberColumns.map((column) => (
              <NativeSelectOption key={column.id} value={column.id}>
                {column.header ?? column.id}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      )}
      <KpiPeriodFields
        draft={draft}
        ids={ids}
        label={label}
        locale={locale}
        setDraft={setDraft}
        tables={tables}
        translate={translate}
      />
    </>
  );
}

export interface AddFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tables of the dashboard's widgets, which a filter can apply to. */
  tables: Record<string, DashboardTableInfo>;
  label: DashboardLabel;
  onAdd: (filter: Omit<DashboardFilter, "id">) => void;
}

/** A new dashboard filter: its type, name and the column of each table it applies to. */
export function AddFilterDialog({
  label,
  onAdd,
  onOpenChange,
  open,
  tables,
}: AddFilterDialogProps) {
  const prefix = useId();
  const [type, setType] = useState<DashboardFilterType>("dateRange");
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<Record<string, string>>({});
  const choices = Object.entries(tables).map(([tableId, table]) => ({
    tableId,
    table,
    columns: filterableColumns(type, table.columns),
  }));
  const targets = choices
    .map(({ tableId, columns: options }) => ({
      tableId,
      columnId: columns[tableId] ?? options.at(0)?.id ?? "",
    }))
    .filter((target) => target.columnId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd({
      type,
      label: name.trim() || label(type === "dateRange" ? "filterDateRange" : "filterSelect"),
      targets,
    });
    setName("");
    setColumns({});
    onOpenChange(false);
  };
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        data-dashboard-dialog="add-filter"
      >
        <DialogHeader>
          <DialogTitle>{label("addFilterTitle")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <Field htmlFor={`${prefix}-type`} label={label("filterType")}>
            <NativeSelect
              className="w-full"
              id={`${prefix}-type`}
              onChange={(event) => {
                setType(event.target.value as DashboardFilterType);
                setColumns({});
              }}
              value={type}
            >
              <NativeSelectOption value="dateRange">
                {label("filterDateRange")}
              </NativeSelectOption>
              <NativeSelectOption value="select">
                {label("filterSelect")}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field htmlFor={`${prefix}-name`} label={label("filterName")}>
            <Input
              id={`${prefix}-name`}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          {choices.map(({ tableId, table, columns: options }) => (
            <Field
              htmlFor={`${prefix}-${tableId}`}
              key={tableId}
              label={label("filterColumn", { table: table.name })}
            >
              <NativeSelect
                className="w-full"
                id={`${prefix}-${tableId}`}
                onChange={(event) =>
                  setColumns({ ...columns, [tableId]: event.target.value })
                }
                value={columns[tableId] ?? options.at(0)?.id ?? ""}
              >
                <NativeSelectOption value="">
                  {label("notApplied")}
                </NativeSelectOption>
                {options.map((column) => (
                  <NativeSelectOption key={column.id} value={column.id}>
                    {column.header ?? column.id}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ))}
          {targets.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {label("noFilterColumns")}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {label("cancel")}
            </Button>
            <Button disabled={targets.length === 0} type="submit">
              {label("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
