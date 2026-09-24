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
import { Textarea } from "@/src/components/ui/textarea";
import {
  type DashboardFilter,
  type DashboardFilterType,
  type DashboardKpiMetric,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  type DashboardWidgetType,
  dashboardMetricOptions,
  filterableColumns,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-widget";

function Field({
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

const NUMBER_TYPES = new Set(["number", "currency", "percent"]);

export interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: Record<string, DashboardTableInfo>;
  views: Record<string, DashboardView[] | undefined>;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  onAdd: (widget: Omit<DashboardWidget, "id">) => void;
}

interface WidgetDraft {
  type: DashboardWidgetType;
  tableId: string;
  viewId: string;
  metric: DashboardKpiMetric;
  metricColumn: string;
  title: string;
  text: string;
}

const draftWidget = (draft: WidgetDraft): Omit<DashboardWidget, "id"> => {
  const title = draft.title.trim();
  if (draft.type === "note") {
    return {
      type: "note",
      ...(title ? { title } : {}),
      settings: { text: draft.text },
    };
  }
  const base = {
    type: draft.type,
    tableId: draft.tableId,
    ...(draft.viewId ? { viewId: draft.viewId } : {}),
  };
  if (draft.type === "view") {
    return { ...base, ...(title ? { title } : {}), settings: {} };
  }
  return {
    ...base,
    settings: {
      metric: draft.metric,
      ...(draft.metric !== "count" && draft.metricColumn
        ? { metricColumn: draft.metricColumn }
        : {}),
      ...(title ? { label: title } : {}),
    },
  };
};

function TableFields({
  draft,
  ids,
  label,
  setDraft,
  tables,
  views,
}: {
  draft: WidgetDraft;
  ids: Record<string, string>;
  label: DashboardLabel;
  setDraft: (draft: WidgetDraft) => void;
  tables: Record<string, DashboardTableInfo>;
  views: Record<string, DashboardView[] | undefined>;
}) {
  return (
    <>
      <Field htmlFor={ids.table} label={label("table")}>
        <NativeSelect
          className="w-full"
          id={ids.table}
          onChange={(event) =>
            setDraft({
              ...draft,
              tableId: event.target.value,
              viewId: "",
              metricColumn: "",
            })
          }
          value={draft.tableId}
        >
          {Object.entries(tables).map(([id, table]) => (
            <NativeSelectOption key={id} value={id}>
              {table.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field htmlFor={ids.view} label={label("view")}>
        <NativeSelect
          className="w-full"
          id={ids.view}
          onChange={(event) =>
            setDraft({ ...draft, viewId: event.target.value })
          }
          value={draft.viewId}
        >
          <NativeSelectOption value="">{label("defaultView")}</NativeSelectOption>
          {(views[draft.tableId] ?? []).map((view) => (
            <NativeSelectOption key={view.id} value={view.id}>
              {view.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}

function KpiFields({
  draft,
  ids,
  label,
  locale,
  setDraft,
  tables,
  translate,
}: {
  draft: WidgetDraft;
  ids: Record<string, string>;
  label: DashboardLabel;
  locale: string;
  setDraft: (draft: WidgetDraft) => void;
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
    </>
  );
}

/** Picker: a table's saved view, a number or a note. */
export function AddWidgetDialog({
  label,
  locale,
  onAdd,
  onOpenChange,
  open,
  tables,
  translate,
  views,
}: AddWidgetDialogProps) {
  const prefix = useId();
  const ids = {
    type: `${prefix}-type`,
    table: `${prefix}-table`,
    view: `${prefix}-view`,
    metric: `${prefix}-metric`,
    column: `${prefix}-column`,
    title: `${prefix}-title`,
    text: `${prefix}-text`,
  };
  const initial = (): WidgetDraft => ({
    type: "view",
    tableId: Object.keys(tables).at(0) ?? "",
    viewId: "",
    metric: "count",
    metricColumn: "",
    title: "",
    text: "",
  });
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAdd(draftWidget(draft));
    setDraft(initial());
    onOpenChange(false);
  };
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-dashboard-dialog="add-widget">
        <DialogHeader>
          <DialogTitle>{label("addWidgetTitle")}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <Field htmlFor={ids.type} label={label("widgetType")}>
            <NativeSelect
              className="w-full"
              id={ids.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as DashboardWidgetType,
                })
              }
              value={draft.type}
            >
              <NativeSelectOption value="view">{label("typeView")}</NativeSelectOption>
              <NativeSelectOption value="kpi">{label("typeKpi")}</NativeSelectOption>
              <NativeSelectOption value="note">{label("typeNote")}</NativeSelectOption>
            </NativeSelect>
          </Field>
          {draft.type !== "note" && (
            <TableFields
              draft={draft}
              ids={ids}
              label={label}
              setDraft={setDraft}
              tables={tables}
              views={views}
            />
          )}
          {draft.type === "kpi" && (
            <KpiFields
              draft={draft}
              ids={ids}
              label={label}
              locale={locale}
              setDraft={setDraft}
              tables={tables}
              translate={translate}
            />
          )}
          <Field htmlFor={ids.title} label={label("widgetTitle")}>
            <Input
              id={ids.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              value={draft.title}
            />
          </Field>
          {draft.type === "note" && (
            <Field htmlFor={ids.text} label={label("noteText")}>
              <Textarea
                id={ids.text}
                onChange={(event) =>
                  setDraft({ ...draft, text: event.target.value })
                }
                rows={4}
                value={draft.text}
              />
            </Field>
          )}
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {label("cancel")}
            </Button>
            <Button
              disabled={draft.type !== "note" && !draft.tableId}
              type="submit"
            >
              {label("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <DialogContent data-dashboard-dialog="add-filter">
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
