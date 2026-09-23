"use client";

import { Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StackMenuContent, useStackMenu } from "../../ui-custom/stack-menu";
import {
  applyConnectorField,
  type ConnectorFlow,
  type ConnectorFlowState,
  type ConnectorScreenField,
  type ConnectorScreenOptions,
  type ConnectorT,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorLabels,
  connectorMappingSections,
  connectorRuleHints,
  connectorScreenFields,
  connectorSyncBlocker,
  createConnectorFlow,
  type DataDestinationConnector,
  describePushDetails,
  describePushResult,
  describeSyncPreview,
  describeSyncResult,
  isSyncDirection,
  type SyncDirection,
  type SyncPreviewView,
} from "../../utils/connector-flow";
import {
  type ConnectorPushContext,
  connectorPushContext,
  type DataDestinationContext,
} from "../../utils/data-destinations";
import { ColumnMapping, type ColumnMappingField } from "./column-mapping";

type TableConnector = DataDestinationConnector<
  DataDestinationContext,
  ConnectorPushContext
>;

interface ConnectorPanelProps {
  connector: TableConnector;
  context: () => DataDestinationContext;
  columns: ConnectorViewColumn[];
  selectedRows: Record<string, unknown>[];
  locale: string;
  translate: ConnectorTranslate;
  /** The destination's name, e.g. "Spreadsheet". */
  name: string;
  /** `table.sync` (default true). */
  syncEnabled?: boolean;
  /** Direction to open with, e.g. "pull" from Data › Import. */
  direction?: SyncDirection;
  /** A sync ran: reload the table. */
  onSynced?: () => void;
}

/** Free input for a target, e.g. a pasted spreadsheet link. */
function TargetInput({
  input,
  busy,
  label,
  onResolve,
}: {
  input: NonNullable<TableConnector["allowTargetInput"]>;
  busy: boolean;
  label: string;
  onResolve: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <form
      className="grid gap-1.5"
      data-connector-target-input
      onSubmit={(event) => {
        event.preventDefault();
        onResolve(value);
      }}
    >
      <label className="text-muted-foreground text-sm" htmlFor={id}>
        {input.label}
      </label>
      <div className="flex gap-2">
        <Input
          className="min-w-0 flex-1"
          id={id}
          onChange={(event) => setValue(event.target.value)}
          placeholder={input.placeholder}
          value={value}
        />
        <Button
          aria-busy={busy}
          disabled={busy || !value.trim()}
          type="submit"
          variant="outline"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {label}
        </Button>
      </div>
    </form>
  );
}

function Hint({ children, id }: { children: ReactNode; id: string }) {
  return (
    <p className="text-muted-foreground text-xs" data-connector-hint={id}>
      {children}
    </p>
  );
}

/** "Delete on the other side" is destructive: the person confirms it first. */
function DeleteConfirmation({
  flow,
  state,
  t,
}: {
  flow: ConnectorFlow;
  state: ConnectorFlowState;
  t: ConnectorT;
}) {
  const id = useId();
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm"
      data-connector-delete-confirm
    >
      <Checkbox
        aria-label={t("deleteConfirm")}
        checked={state.confirmDeletes}
        id={id}
        onCheckedChange={(checked) => flow.setConfirmDeletes(checked === true)}
      />
      <label className="cursor-pointer leading-snug" htmlFor={id}>
        {t("deleteConfirm")}
      </label>
    </div>
  );
}

/**
 * The shared screen fields as a column mapping: target settings before the
 * rows, the key field, then mode, records and the sync rules; the paste
 * input, hints and the delete confirmation follow their selects.
 */
function connectorMapping({
  flow,
  screen,
  state,
  targetInput,
}: {
  flow: ConnectorFlow;
  screen: ConnectorScreenOptions;
  state: ConnectorFlowState;
  targetInput: ReactNode;
}) {
  const { t } = screen;
  const hints = connectorRuleHints(state.settings, screen);
  const extra: Record<string, ReactNode> = {
    target: targetInput,
    mode: state.settings ? (
      <p className="text-muted-foreground text-xs" data-connector-mode-hint>
        {t(state.settings.mode === "replace" ? "replaceHint" : "upsertHint")}
      </p>
    ) : null,
    conflictRule: hints.conflictRule ? (
      <Hint id="conflictRule">{hints.conflictRule}</Hint>
    ) : null,
    deletePolicy: hints.deletePolicy ? (
      <>
        <Hint id="deletePolicy">{hints.deletePolicy}</Hint>
        {state.settings?.deletePolicy === "propagate" ? (
          <DeleteConfirmation flow={flow} state={state} t={t} />
        ) : null}
      </>
    ) : null,
  };
  const withExtra = (field: ConnectorScreenField): ColumnMappingField => ({
    ...field,
    after: extra[field.id],
  });
  const sections = connectorMappingSections(
    connectorScreenFields(state, screen)
  );
  return {
    before: sections.before.map(withExtra),
    rows: sections.rows,
    keyField: sections.keyField ? withExtra(sections.keyField) : undefined,
    after: sections.after.map(withExtra),
    onChange: (id: string, value: string) => {
      applyConnectorField(flow, id, value).catch(() => undefined);
    },
  };
}

/** Counts per side, notes, the duplicates warning and the first conflicts. */
function SyncPreviewGrid({ view }: { view: SyncPreviewView }) {
  return (
    <output
      aria-live="polite"
      className="grid min-w-0 gap-2 rounded-md border px-3 py-2 text-sm"
      data-sync-preview
    >
      <div className="grid grid-cols-2 gap-3">
        {view.sides.map((side) => (
          <div
            className="grid min-w-0 gap-1"
            data-sync-side={side.side}
            key={side.side}
          >
            <h3 className="truncate font-medium text-muted-foreground text-xs">
              {side.title}
            </h3>
            <dl className="grid gap-0.5">
              {side.counts.map((count) => (
                <div className="flex justify-between gap-2" key={count.key}>
                  <dt>{count.label}</dt>
                  <dd
                    className={cn(
                      "tabular-nums",
                      count.count > 0 ? "font-medium" : "text-muted-foreground"
                    )}
                    data-sync-count={`${side.side}-${count.key}`}
                  >
                    {count.count}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {view.notes.map((note) => (
        <p className="text-muted-foreground text-xs" data-sync-note key={note}>
          {note}
        </p>
      ))}
      {view.duplicates ? (
        <p
          className="text-amber-700 text-xs dark:text-amber-400"
          data-sync-duplicates
        >
          {view.duplicates}
        </p>
      ) : null}
      {view.conflictsTitle ? (
        <div className="grid gap-1.5" data-sync-conflicts>
          <h3 className="font-medium text-xs">{view.conflictsTitle}</h3>
          <ul className="grid gap-1.5">
            {view.conflicts.map((conflict) => (
              <li
                className="grid gap-0.5 rounded-sm bg-muted/60 px-2 py-1.5 text-xs"
                data-sync-conflict={conflict.id}
                key={conflict.id}
              >
                <span className="truncate font-medium">{conflict.title}</span>
                {(["table", "target"] as const).map((side) => (
                  <span
                    className={cn(
                      "flex min-w-0 justify-between gap-2",
                      conflict.resolution === side
                        ? "font-medium"
                        : "text-muted-foreground line-through"
                    )}
                    data-winner={conflict.resolution === side || undefined}
                    key={side}
                  >
                    <span className="shrink-0">{conflict[side].label}</span>
                    <span className="truncate">{conflict[side].value}</span>
                  </span>
                ))}
                <span className="text-muted-foreground">{conflict.wins}</span>
              </li>
            ))}
          </ul>
          {view.moreConflicts ? (
            <p className="text-muted-foreground text-xs">
              {view.moreConflicts}
            </p>
          ) : null}
        </div>
      ) : null}
    </output>
  );
}

/** The last push or sync: counts, first failures, warnings and truncation. */
function ConnectorResult({
  connector,
  flow,
  name,
  state,
  t,
}: {
  connector: TableConnector;
  flow: ConnectorFlow;
  name: string;
  state: ConnectorFlowState;
  t: ConnectorT;
}) {
  const { goBack } = useStackMenu();
  const busy = state.phase === "sending" || state.previewing;
  let summary = "";
  let lines: string[] = [];
  if (state.syncResult) {
    ({ summary, lines } = describeSyncResult(state.syncResult, {
      t,
      name,
      help: connector.help,
    }));
  } else if (state.result) {
    const details = describePushDetails(state.result, t, connector.help);
    summary = describePushResult(state.result, t);
    lines = [
      ...details.failures,
      ...(details.warnings ? [details.warnings] : []),
      ...(details.truncated ? [details.truncated] : []),
    ];
  }
  const again = () => {
    if (state.syncResult) {
      flow.edit();
      if (connector.preview) {
        flow.preview().catch(() => undefined);
      }
      return;
    }
    flow.send().catch(() => undefined);
  };
  let againLabel = t("sendAgain");
  if (state.syncResult) {
    againLabel = connector.preview ? t("previewAgain") : t("syncNow");
  }
  return (
    <div className="grid gap-3" data-connector-result>
      <output
        aria-live="polite"
        className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm"
      >
        <p className="font-medium" data-connector-summary>
          {summary}
        </p>
        {lines.map((line) => (
          <p className="text-muted-foreground" key={line}>
            {line}
          </p>
        ))}
      </output>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={goBack} type="button">
          {t("done")}
        </Button>
        <Button
          aria-busy={busy}
          className="flex-1"
          disabled={busy}
          onClick={again}
          type="button"
          variant="outline"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {againLabel}
        </Button>
      </div>
    </div>
  );
}

const sendLabel = (state: ConnectorFlowState, t: ConnectorT): string => {
  const direction = state.settings?.direction;
  const sending = state.phase === "sending";
  if (!isSyncDirection(direction)) {
    return sending ? t("sending") : t("send");
  }
  if (sending) {
    return t("syncing");
  }
  return direction === "pull" ? t("importNow") : t("syncNow");
};

/** Error, field loading, the preview and Send or Sync now, after the settings. */
function ConnectorActions({
  connector,
  flow,
  name,
  columns,
  state,
  t,
}: {
  connector: TableConnector;
  flow: ConnectorFlow;
  name: string;
  columns: ConnectorViewColumn[];
  state: ConnectorFlowState;
  t: ConnectorT;
}) {
  const sending = state.phase === "sending";
  const syncing = isSyncDirection(state.settings?.direction);
  const blocker = connectorSyncBlocker(state, connector);
  const canPreview = syncing && Boolean(connector.preview);
  const SendIcon = syncing ? RefreshCw : Send;
  return (
    <>
      {state.schemaLoading ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t("loadingFields")}
        </p>
      ) : null}
      {state.phase === "form" && state.targets.length === 0 && !state.error ? (
        <p className="text-muted-foreground text-sm">{t("noTargets")}</p>
      ) : null}
      {canPreview && state.preview ? (
        <SyncPreviewGrid
          view={describeSyncPreview(state.preview, { t, name, columns })}
        />
      ) : null}
      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 px-3 py-2 text-destructive text-sm"
          data-connector-error
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {blocker && !state.error ? (
        <p className="text-muted-foreground text-xs" data-connector-blocker>
          {t(blocker)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canPreview ? (
          <Button
            aria-busy={state.previewing}
            className="flex-1"
            disabled={state.previewing || sending || !state.settings}
            onClick={() => {
              flow.preview().catch(() => undefined);
            }}
            type="button"
            variant="outline"
          >
            {state.previewing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
            {state.previewing ? t("previewing") : t("previewChanges")}
          </Button>
        ) : null}
        <Button
          aria-busy={sending}
          className="flex-1"
          disabled={
            sending || state.previewing || !state.settings || Boolean(blocker)
          }
          onClick={() => {
            flow.send().catch(() => undefined);
          }}
          type="button"
        >
          {sending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <SendIcon aria-hidden="true" className="size-4" />
          )}
          {sendLabel(state, t)}
        </Button>
      </div>
    </>
  );
}

/**
 * The connector screen of a Connect destination: target, direction, column
 * mapping, records or sync rules, then Send (or Preview and Sync now) and the
 * result. The host only lists targets, describes their fields, pushes,
 * previews and syncs; the flow is shared with the Vue edition.
 */
export function ConnectorPanel({
  connector,
  context,
  columns,
  selectedRows,
  locale,
  translate,
  name,
  syncEnabled = true,
  direction,
  onSynced,
}: ConnectorPanelProps) {
  // The view the screen was opened on owns the settings; capture it once.
  const [opened] = useState(() => ({
    connector,
    context: context(),
    columns,
    selectedRows,
    direction,
    syncEnabled,
    t: connectorLabels(locale, translate),
  }));
  const syncedRef = useRef(onSynced);
  syncedRef.current = onSynced;
  const [state, setState] = useState<ConnectorFlowState>();
  const flowRef = useRef<ConnectorFlow>(null);
  useEffect(() => {
    const flow = createConnectorFlow({
      connector: opened.connector,
      context: opened.context,
      columns: opened.columns,
      selectedCount: opened.selectedRows.length,
      t: opened.t,
      syncEnabled: opened.syncEnabled,
      direction: opened.direction,
      pushContext: (scope, sent) =>
        connectorPushContext(opened.context, scope, sent, opened.selectedRows),
      onChange: setState,
      onSynced: () => syncedRef.current?.(),
    });
    flowRef.current = flow;
    setState(flow.state);
    flow.start().catch(() => undefined);
    return () => flow.dispose();
  }, [opened]);

  const flow = flowRef.current;
  const { t } = opened;
  if (!(state && flow) || state.phase === "loading") {
    return (
      <StackMenuContent className="p-3" data-connector-panel>
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t("loading")}
        </p>
      </StackMenuContent>
    );
  }
  const hasResult = Boolean(state.result || state.syncResult);
  if (state.phase === "result" || (state.phase === "sending" && hasResult)) {
    return (
      <StackMenuContent className="p-3" data-connector-panel>
        <ConnectorResult
          connector={connector}
          flow={flow}
          name={name}
          state={state}
          t={t}
        />
      </StackMenuContent>
    );
  }
  const targetInput = connector.allowTargetInput ? (
    <TargetInput
      busy={state.resolving}
      input={connector.allowTargetInput}
      label={t("use")}
      onResolve={(value) => {
        flow.resolveInput(value).catch(() => undefined);
      }}
    />
  ) : null;
  return (
    <StackMenuContent className="p-3" data-connector-panel>
      <ColumnMapping
        {...connectorMapping({
          flow,
          screen: {
            connector,
            columns: opened.columns,
            selectedCount: opened.selectedRows.length,
            t,
            name,
            locale,
            syncEnabled: opened.syncEnabled,
          },
          state,
          targetInput,
        })}
      >
        <ConnectorActions
          columns={opened.columns}
          connector={connector}
          flow={flow}
          name={name}
          state={state}
          t={t}
        />
      </ColumnMapping>
    </StackMenuContent>
  );
}
