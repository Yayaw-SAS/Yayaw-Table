"use client";

import { FileUp, Loader2, RefreshCw, Upload } from "lucide-react";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import {
  StackMenuContent,
  StackMenuItem,
  useStackMenu,
} from "@/components/ui/custom/stack-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Textarea } from "@/src/components/ui/textarea";
import {
  applyImportField,
  canRunImport,
  createImportFlow,
  describeImportResult,
  type ImportFlow,
  type ImportFlowState,
  type ImportSource,
  type ImportT,
  type ImportTranslate,
  importErrorLines,
  importFailureLines,
  importLabels,
  importMappingRows,
  importPreview,
  importRowCount,
  importSettingsFields,
  importSummaryLines,
} from "../../utils/import-flow";
import type {
  ImportAdapters,
  ImportColumn,
  ImportRunResult,
} from "../../utils/import-model";
import { ColumnMapping } from "./column-mapping";

/** A connector that can pull: it opens its own screen, direction preset to pull. */
export interface ConnectorImportSource {
  id: string;
  label: string;
  description?: string;
  /** The stack menu screen to open. */
  screen: string;
  title: string;
}

export interface ImportPanelProps {
  columns: ImportColumn[];
  locale: string;
  translate: ImportTranslate;
  adapters: ImportAdapters;
  /** Offer CSV files and pasted text (default true). */
  csv?: boolean;
  sources?: Pick<ImportSource, "id" | "label" | "description">[];
  /** Connectors listed with the sources ("From Notion"). */
  connectorSources?: ConnectorImportSource[];
  loadSource?: Parameters<typeof createImportFlow>[0]["loadSource"];
  findExisting: Parameters<typeof createImportFlow>[0]["findExisting"];
  batchSize?: number;
  allowNewOptions?: boolean;
  /** `actions.geocode`: addresses imported into location columns become places. */
  geocode?: Parameters<typeof createImportFlow>[0]["geocode"];
  onImported: (result: ImportRunResult) => void;
}

interface StepProps {
  flow: ImportFlow;
  state: ImportFlowState;
  t: ImportT;
}

/** The CSV drop zone, file picker and paste box. */
function CsvSource({ flow, state, t }: StepProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const readFile = (file: File | undefined) => {
    if (file) {
      flow.loadFile(file).catch(() => undefined);
    }
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    readFile(event.dataTransfer.files[0]);
  };
  return (
    <div className="grid gap-3" data-import-csv>
      <button
        className={cn(
          "grid h-auto cursor-pointer justify-items-center gap-2 rounded-md border border-dashed px-3 py-5 text-center text-sm hover:bg-accent/50",
          dragging && "border-primary bg-accent"
        )}
        data-import-drop
        onClick={() => input.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
        type="button"
      >
        <FileUp aria-hidden="true" className="size-5 text-muted-foreground" />
        <span className="font-medium">{t("sourceCsv")}</span>
        <span className="text-muted-foreground text-xs">
          {t("dropHint")} · {t("sourceCsvHint")}
        </span>
        <span className="mt-1 inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium text-sm">
          {t("chooseFile")}
        </span>
      </button>
      <input
        accept=".csv,.tsv,.txt,text/csv,text/plain"
        aria-label={t("chooseFile")}
        className="sr-only"
        onChange={(event) => {
          readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      {state.loading ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t("reading")}
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-sm" htmlFor={`${id}-paste`}>
          {t("pasteLabel")}
        </label>
        <Textarea
          className="min-h-20 font-mono text-xs"
          id={`${id}-paste`}
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
        <Button
          className="justify-self-end"
          disabled={!text.trim()}
          onClick={() => flow.loadText(text)}
          type="button"
          variant="outline"
        >
          {t("usePasted")}
        </Button>
      </div>
    </div>
  );
}

/** Step 1: CSV and the host's sources. */
function SourceStep({
  csv,
  sources,
  connectorSources = [],
  ...props
}: StepProps & {
  csv: boolean;
  sources: ImportPanelProps["sources"];
  connectorSources?: ConnectorImportSource[];
}) {
  const { flow, state, t } = props;
  return (
    <div className="grid gap-3" data-import-step="source">
      {csv ? <CsvSource {...props} /> : null}
      {sources?.length || connectorSources.length > 0 ? (
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">{t("source")}</h3>
          {connectorSources.map((source) => (
            <StackMenuItem
              data-import-connector={source.id}
              description={source.description}
              icon={<RefreshCw className="size-4" />}
              key={`connector:${source.id}`}
              navigateTitle={source.title}
              navigateTo={source.screen}
            >
              {source.label}
            </StackMenuItem>
          ))}
          {(sources ?? []).map((source) => (
            <StackMenuItem
              data-import-source={source.id}
              description={source.description}
              disabled={state.loading}
              icon={<Upload className="size-4" />}
              key={source.id}
              onClick={() => {
                flow.loadSource(source.id).catch(() => undefined);
              }}
            >
              {source.label}
            </StackMenuItem>
          ))}
        </div>
      ) : null}
      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 px-3 py-2 text-destructive text-sm"
          data-import-error
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/** Step 2: the column mapping, separator, header row and key column. */
function MappingStep({
  columns,
  locale,
  allowNewOptions,
  ...props
}: StepProps & {
  columns: ImportColumn[];
  locale: string;
  allowNewOptions?: boolean;
}) {
  const { flow, state, t } = props;
  const id = useId();
  const settings = importSettingsFields(state, { columns, t });
  const delimiter = settings.find((field) => field.id === "delimiter");
  const key = settings.find((field) => field.id === "key");
  return (
    <div className="grid min-w-0 gap-3" data-import-step="mapping">
      <ColumnMapping
        intro={
          <>
            <p className="text-muted-foreground text-sm" data-import-file>
              {[state.sourceName, importRowCount(state, t)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {state.text === null ? null : (
              <div className="flex min-h-8 items-center gap-2 text-sm">
                <Checkbox
                  aria-label={t("headers")}
                  checked={state.hasHeaders}
                  id={`${id}-headers`}
                  onCheckedChange={(checked) =>
                    flow.setHasHeaders(checked === true)
                  }
                />
                <label className="cursor-pointer" htmlFor={`${id}-headers`}>
                  {t("headers")}
                </label>
              </div>
            )}
          </>
        }
        after={[]}
        before={delimiter ? [delimiter] : []}
        keyField={
          key
            ? {
                ...key,
                after: (
                  <p className="text-muted-foreground text-xs">{t("keyHint")}</p>
                ),
              }
            : undefined
        }
        onChange={(fieldId, value) => applyImportField(flow, fieldId, value)}
        preview={{
          label: t("preview"),
          ...importPreview(state, { columns, locale, t, allowNewOptions }),
        }}
        rows={importMappingRows(state, { columns, locale, t, allowNewOptions })}
      >
        {state.error ? (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={flow.back}
            type="button"
            variant="outline"
          >
            {t("back")}
          </Button>
          <Button
            aria-busy={state.loading}
            className="flex-1"
            disabled={state.loading}
            onClick={() => {
              flow.review().catch(() => undefined);
            }}
            type="button"
          >
            {state.loading ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {t("review")}
          </Button>
        </div>
      </ColumnMapping>
    </div>
  );
}

/** Step 3: counts, first errors, skip errors, then Import. */
function ReviewStep({
  columns,
  ...props
}: StepProps & { columns: ImportColumn[] }) {
  const { flow, state, t } = props;
  const { goBack } = useStackMenu();
  const id = useId();
  if (!state.plan) {
    return null;
  }
  const lines = importSummaryLines(state.plan, state.skipErrors, t);
  const errors = importErrorLines(state.plan, {
    columns,
    t,
    hasHeaders: state.hasHeaders,
  });
  const runnable = canRunImport(state.plan, state.skipErrors);
  return (
    <div className="grid gap-3" data-import-step="review">
      <output
        aria-live="polite"
        className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm"
        data-import-summary
      >
        {lines.creates ? (
          <p data-import-creates>{lines.creates}</p>
        ) : null}
        {lines.updates ? (
          <p data-import-updates>{lines.updates}</p>
        ) : null}
        {lines.errors ? (
          <p className="text-destructive" data-import-errors>
            {lines.errors}
          </p>
        ) : null}
        {errors.map((line) => (
          <p className="text-destructive text-xs" key={line}>
            {line}
          </p>
        ))}
        {lines.creates || lines.updates || lines.errors ? null : (
          <p>{t("nothingToImport")}</p>
        )}
      </output>
      {state.plan.errorRows.length > 0 ? (
        <div className="flex min-h-8 items-center gap-2 text-sm">
          <Checkbox
            checked={state.skipErrors}
            id={`${id}-skip`}
            aria-label={t("skipErrors")}
            onCheckedChange={(checked) => flow.setSkipErrors(checked === true)}
          />
          <label className="cursor-pointer" htmlFor={`${id}-skip`}>
            {t("skipErrors")}
          </label>
        </div>
      ) : null}
      {state.plan.errorRows.length > 0 && !state.skipErrors ? (
        <p className="text-muted-foreground text-xs">{t("errorsBlock")}</p>
      ) : null}
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={flow.back} type="button" variant="outline">
          {t("back")}
        </Button>
        <Button className="flex-1" onClick={goBack} type="button" variant="outline">
          {t("cancel")}
        </Button>
        <Button
          className="w-full"
          disabled={!runnable}
          onClick={() => {
            flow.run().catch(() => undefined);
          }}
          type="button"
        >
          <Upload aria-hidden="true" className="size-4" />
          {t("import")}
        </Button>
      </div>
    </div>
  );
}

/** Step 4: progress, then the result. */
function RunStep({ flow, state, t }: StepProps) {
  const { goBack } = useStackMenu();
  if (state.step === "running") {
    const { done, total } = state.progress ?? { done: 0, total: 0 };
    return (
      <div className="grid gap-3" data-import-step="running">
        <p className="text-sm">{t("importing", { done, total })}</p>
        <div
          aria-label={t("importing", { done, total })}
          aria-valuemax={total}
          aria-valuemin={0}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <Button onClick={flow.stop} type="button" variant="outline">
          {t("stop")}
        </Button>
      </div>
    );
  }
  if (!state.result) {
    return null;
  }
  const failures = importFailureLines(state.result, {
    t,
    hasHeaders: state.hasHeaders,
  });
  return (
    <div className="grid gap-3" data-import-step="result">
      <output
        aria-live="polite"
        className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm"
      >
        <p className="font-medium" data-import-result>
          {describeImportResult(state.result, t)}
        </p>
        {failures.map((line) => (
          <p className="text-destructive" key={line}>
            {line}
          </p>
        ))}
        {state.result.aborted ? (
          <p className="text-muted-foreground">{t("stopped")}</p>
        ) : null}
      </output>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={goBack} type="button">
          {t("done")}
        </Button>
        <Button className="flex-1" onClick={flow.reset} type="button" variant="outline">
          {t("another")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Data › Import: a source (CSV file, pasted text or a host source), the
 * column mapping, a review, then progress and the result. The flow is shared
 * with the Vue edition; the host only writes rows.
 */
export function ImportPanel(props: ImportPanelProps) {
  // The table the screen was opened on owns the import; capture it once.
  const [opened] = useState(() => ({
    ...props,
    t: importLabels(props.locale, props.translate),
  }));
  const [state, setState] = useState<ImportFlowState>();
  const flowRef = useRef<ImportFlow>(null);
  useEffect(() => {
    const flow = createImportFlow({
      columns: opened.columns,
      locale: opened.locale,
      t: opened.t,
      adapters: opened.adapters,
      findExisting: opened.findExisting,
      loadSource: opened.loadSource,
      batchSize: opened.batchSize,
      allowNewOptions: opened.allowNewOptions,
      geocode: opened.geocode,
      onChange: setState,
      onImported: opened.onImported,
    });
    flowRef.current = flow;
    setState(flow.state);
    return () => flow.dispose();
  }, [opened]);
  const flow = flowRef.current;
  const { t } = opened;
  if (!(state && flow)) {
    return null;
  }
  const step = { flow, state, t };
  return (
    <StackMenuContent className="p-3" data-import-panel>
      {state.step === "source" ? (
        <SourceStep
          {...step}
          connectorSources={opened.connectorSources}
          csv={opened.csv !== false}
          sources={opened.sources}
        />
      ) : null}
      {state.step === "mapping" ? (
        <MappingStep
          {...step}
          allowNewOptions={opened.allowNewOptions}
          columns={opened.columns}
          locale={opened.locale}
        />
      ) : null}
      {state.step === "review" ? (
        <ReviewStep {...step} columns={opened.columns} />
      ) : null}
      {state.step === "running" || state.step === "result" ? (
        <RunStep {...step} />
      ) : null}
    </StackMenuContent>
  );
}
