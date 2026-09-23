"use client";

import { Download, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { StackMenuContent } from "@/components/ui/custom/stack-menu";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type {
  ExportFormat,
  ExportSettings,
} from "../../utils/export-model";
import { ViewSettingsPanel } from "./view-settings-panel";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  pdf: "PDF",
};

/** Format, records, columns, values and file name, then Export. */
export function ExportPanel({
  busy,
  defaultFileName,
  formats,
  label,
  onExport,
  selectedCount,
}: {
  busy: boolean;
  defaultFileName: string;
  formats: ExportFormat[];
  label: (key: string, fallback: string) => string;
  onExport: (settings: ExportSettings) => Promise<void>;
  selectedCount: number;
}) {
  const id = useId();
  const [settings, setSettings] = useState<ExportSettings>(() => ({
    format: formats[0] ?? "csv",
    scope: selectedCount > 0 ? "selection" : "view",
    columns: "visible",
    values: "formatted",
    fileName: defaultFileName,
  }));
  const update = (patch: Partial<ExportSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  const scope = selectedCount > 0 ? settings.scope : "view";

  return (
    <StackMenuContent className="p-3" data-export-panel>
      <ViewSettingsPanel
        fields={[
          {
            id: "format",
            label: label("format", "Format"),
            value: settings.format,
            options: formats.map((format) => ({
              value: format,
              label:
                format === "pdf"
                  ? label("pdf", "PDF (print)")
                  : FORMAT_LABELS[format],
            })),
            onChange: (value) => update({ format: value as ExportFormat }),
          },
          {
            id: "scope",
            label: label("scope", "Records"),
            value: scope,
            options: [
              { value: "view", label: label("scopeView", "All in this view") },
              ...(selectedCount > 0
                ? [
                    {
                      value: "selection",
                      label: label("scopeSelection", "Selected ({count})").replace(
                        "{count}",
                        String(selectedCount)
                      ),
                    },
                  ]
                : []),
            ],
            onChange: (value) =>
              update({ scope: value === "selection" ? "selection" : "view" }),
          },
          {
            id: "columns",
            label: label("columns", "Columns"),
            value: settings.columns,
            options: [
              { value: "visible", label: label("columnsVisible", "Visible") },
              { value: "all", label: label("columnsAll", "All") },
            ],
            onChange: (value) =>
              update({ columns: value === "all" ? "all" : "visible" }),
          },
          {
            id: "values",
            label: label("values", "Values"),
            value: settings.values,
            options: [
              {
                value: "formatted",
                label: label("valuesFormatted", "As displayed"),
              },
              { value: "raw", label: label("valuesRaw", "Raw") },
            ],
            onChange: (value) =>
              update({ values: value === "raw" ? "raw" : "formatted" }),
          },
        ]}
      >
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-sm" htmlFor={id}>
            {label("fileName", "File name")}
          </label>
          <Input
            id={id}
            onChange={(event) => update({ fileName: event.target.value })}
            value={settings.fileName}
          />
        </div>
        <Button
          className="w-full"
          disabled={busy}
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
          {label("run", "Export")}
        </Button>
      </ViewSettingsPanel>
    </StackMenuContent>
  );
}
