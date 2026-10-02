"use client";

import { Download, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StackMenuContent } from "../../ui-custom/stack-menu";
import type {
  ExportColumnChoice,
  ExportFormat,
  ExportSettings,
  ExportT,
} from "../../utils/export-model";
import { ViewSettingsPanel } from "./view-settings-panel";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  pdf: "PDF",
};

/** The "Choose columns" checklist, in display order. */
function ExportColumnList({
  chosen,
  columns,
  hintId,
  label,
  onChange,
}: {
  chosen: string[];
  columns: ExportColumnChoice[];
  /** Announces that the export needs a column. */
  hintId: string;
  label: ExportT;
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const checked = new Set(chosen);
  const toggle = (columnId: string, on: boolean) =>
    onChange(
      columns
        .filter((column) =>
          column.id === columnId ? on : checked.has(column.id)
        )
        .map((column) => column.id)
    );
  return (
    <fieldset className="grid min-w-0 gap-1" data-export-columns>
      <legend className="sr-only">{label("columnsChoice")}</legend>
      <div className="flex flex-wrap gap-2 pb-1">
        <Button
          onClick={() => onChange(columns.map((column) => column.id))}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("columnsSelectAll")}
        </Button>
        <Button
          onClick={() => onChange([])}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("columnsSelectNone")}
        </Button>
      </div>
      {columns.map((column, index) => (
        <div
          className="flex min-h-9 min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent max-md:min-h-11"
          key={column.id}
        >
          <Checkbox
            aria-label={column.header}
            checked={checked.has(column.id)}
            className="min-h-0! min-w-0!"
            id={`${id}-${index}`}
            onCheckedChange={(on) => toggle(column.id, on === true)}
          />
          <label
            className="min-w-0 flex-1 cursor-pointer break-words py-2"
            htmlFor={`${id}-${index}`}
          >
            {column.header}
          </label>
        </div>
      ))}
      <output className="block px-2 text-muted-foreground text-sm" id={hintId}>
        {chosen.length ? null : label("columnsEmpty")}
      </output>
    </fieldset>
  );
}

/** Format, records, columns, values and file name, then Export. */
export function ExportPanel({
  busy,
  columns,
  defaultFileName,
  formats,
  label,
  onExport,
  selectedCount,
}: {
  busy: boolean;
  /** The exportable columns in display order; the visible ones start checked. */
  columns: ExportColumnChoice[];
  defaultFileName: string;
  formats: ExportFormat[];
  label: ExportT;
  onExport: (settings: ExportSettings) => Promise<void>;
  selectedCount: number;
}) {
  const id = useId();
  const [settings, setSettings] = useState<ExportSettings>(() => ({
    format: formats[0] ?? "csv",
    scope: selectedCount > 0 ? "selection" : "view",
    columns: "visible",
    columnIds: columns
      .filter((column) => column.visible)
      .map((column) => column.id),
    values: "formatted",
    fileName: defaultFileName,
  }));
  const update = (patch: Partial<ExportSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  const scope = selectedCount > 0 ? settings.scope : "view";
  const custom = settings.columns === "custom";
  const noColumns = custom && !settings.columnIds?.length;

  return (
    <StackMenuContent className="p-3" data-export-panel>
      <ViewSettingsPanel
        fields={[
          {
            id: "format",
            label: label("format"),
            value: settings.format,
            options: formats.map((format) => ({
              value: format,
              label: format === "pdf" ? label("pdf") : FORMAT_LABELS[format],
            })),
            onChange: (value) => update({ format: value as ExportFormat }),
          },
          {
            id: "scope",
            label: label("scope"),
            value: scope,
            options: [
              { value: "view", label: label("scopeView") },
              ...(selectedCount > 0
                ? [
                    {
                      value: "selection",
                      label: label("scopeSelection", { count: selectedCount }),
                    },
                  ]
                : []),
            ],
            onChange: (value) =>
              update({ scope: value === "selection" ? "selection" : "view" }),
          },
          {
            id: "columns",
            label: label("columns"),
            value: settings.columns,
            options: [
              { value: "visible", label: label("columnsVisible") },
              { value: "all", label: label("columnsAll") },
              { value: "custom", label: label("columnsCustom") },
            ],
            onChange: (value) =>
              update({
                columns:
                  value === "all" || value === "custom" ? value : "visible",
              }),
            after: custom ? (
              <ExportColumnList
                chosen={settings.columnIds ?? []}
                columns={columns}
                hintId={`${id}-hint`}
                label={label}
                onChange={(columnIds) => update({ columnIds })}
              />
            ) : null,
          },
          {
            id: "values",
            label: label("values"),
            value: settings.values,
            options: [
              { value: "formatted", label: label("valuesFormatted") },
              { value: "raw", label: label("valuesRaw") },
            ],
            onChange: (value) =>
              update({ values: value === "raw" ? "raw" : "formatted" }),
          },
        ]}
      >
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm" htmlFor={id}>
            {label("fileName")}
          </label>
          <Input
            id={id}
            onChange={(event) => update({ fileName: event.target.value })}
            value={settings.fileName}
          />
        </div>
        <Button
          aria-describedby={noColumns ? `${id}-hint` : undefined}
          className="w-full"
          disabled={busy || noColumns}
          onClick={() => {
            onExport({ ...settings, scope }).catch(() => {
              /* failures are reported by the handler */
            });
          }}
          type="button"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Download aria-hidden="true" className="size-4" />
          )}
          {label("run")}
        </Button>
      </ViewSettingsPanel>
    </StackMenuContent>
  );
}
