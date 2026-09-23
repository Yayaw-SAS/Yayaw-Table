"use client";

import {
  ArrowLeft,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StackMenuContent, useStackMenu } from "../../ui-custom/stack-menu";
import {
  applyConnectorField,
  type ConnectorConflictRulesView,
  type ConnectorFlow,
  type ConnectorFlowState,
  type ConnectorScreenField,
  type ConnectorScreenOptions,
  type ConnectorT,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorConflictRulesView,
  connectorLabels,
  connectorMappingSections,
  connectorRuleHints,
  connectorScreenFields,
  connectorSyncBlocker,
  createConnectorFlow,
  type DataDestinationConnector,
  describePendingConflicts,
  describePushDetails,
  describePushResult,
  describeSyncPreview,
  describeSyncResult,
  isSyncDirection,
  type PendingConflictsView,
  type SyncDirection,
  type SyncPreviewConflictLine,
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

/** "Rules set by your app": the conflict rules the host applies in code. */
function AppRules({ view }: { view: ConnectorConflictRulesView }) {
  return (
    <section
      aria-label={view.title}
      className="grid gap-1 rounded-md border px-3 py-2 text-xs"
      data-connector-app-rules
      data-locked={view.locked || undefined}
    >
      <h3 className="flex items-center gap-1.5 font-medium text-muted-foreground">
        {view.locked ? (
          <Lock aria-hidden="true" className="size-3.5" data-connector-lock />
        ) : null}
        {view.title}
      </h3>
      {view.rules.length > 0 ? (
        <ul className="grid gap-0.5">
          {view.rules.map((rule) => (
            <li data-connector-rule={rule.columnId} key={rule.columnId}>
              {rule.text}
            </li>
          ))}
        </ul>
      ) : null}
      {view.hint ? (
        <p className="text-muted-foreground" data-connector-rules-hint>
          {view.hint}
        </p>
      ) : null}
    </section>
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
  const rules = connectorConflictRulesView(state.settings, screen);
  const rulesBlock = rules ? <AppRules view={rules} /> : null;
  // Under the conflict rule in two-way, else under the delete policy.
  const rulesAfterConflict = Boolean(hints.conflictRule);
  const extra: Record<string, ReactNode> = {
    target: targetInput,
    mode: state.settings ? (
      <p className="text-muted-foreground text-xs" data-connector-mode-hint>
        {t(state.settings.mode === "replace" ? "replaceHint" : "upsertHint")}
      </p>
    ) : null,
    conflictRule: hints.conflictRule ? (
      <>
        <Hint id="conflictRule">{hints.conflictRule}</Hint>
        {rulesBlock}
      </>
    ) : null,
    deletePolicy: hints.deletePolicy ? (
      <>
        <Hint id="deletePolicy">{hints.deletePolicy}</Hint>
        {state.settings?.deletePolicy === "propagate" ? (
          <DeleteConfirmation flow={flow} state={state} t={t} />
        ) : null}
        {rulesAfterConflict ? null : rulesBlock}
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

/** One conflict: both values, the kept one highlighted, and how it is settled. */
function ConflictLine({ line }: { line: SyncPreviewConflictLine }) {
  return (
    <li
      className="grid gap-0.5 rounded-sm bg-muted/60 px-2 py-1.5 text-xs"
      data-resolution={line.resolution}
      data-sync-conflict={line.id}
    >
      <span className="truncate font-medium">{line.title}</span>
      {(["table", "target"] as const).map((side) => (
        <span
          className={cn(
            "flex min-w-0 justify-between gap-2",
            line.winner && line.winner !== side
              ? "text-muted-foreground line-through"
              : "font-medium"
          )}
          data-winner={line.winner === side || undefined}
          key={side}
        >
          <span className="shrink-0">{line[side].label}</span>
          <span className="truncate">{line[side].value}</span>
        </span>
      ))}
      {line.result ? (
        <span
          className="flex min-w-0 justify-between gap-2 font-medium"
          data-sync-result
        >
          <span className="shrink-0">{line.result.label}</span>
          <span className="truncate">{line.result.value}</span>
        </span>
      ) : null}
      <span className="text-muted-foreground" data-sync-outcome>
        {line.wins}
      </span>
    </li>
  );
}

/** A titled list of conflict lines with "And N more". */
function ConflictGroup({
  id,
  lines,
  more,
  title,
}: {
  id: string;
  lines: SyncPreviewConflictLine[];
  more: string | null;
  title: string;
}) {
  return (
    <div className="grid gap-1.5" data-sync-group={id}>
      <h3 className="font-medium text-xs">{title}</h3>
      <ul className="grid gap-1.5">
        {lines.map((line) => (
          <ConflictLine key={line.id} line={line} />
        ))}
      </ul>
      {more ? <p className="text-muted-foreground text-xs">{more}</p> : null}
    </div>
  );
}

/** Counts per side, notes, the duplicates warning, conflicts and owned columns. */
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
        <ConflictGroup
          id="conflicts"
          lines={view.conflicts}
          more={view.moreConflicts}
          title={view.conflictsTitle}
        />
      ) : null}
      {view.overriddenTitle ? (
        <ConflictGroup
          id="overridden"
          lines={view.overridden}
          more={view.moreOverridden}
          title={view.overriddenTitle}
        />
      ) : null}
    </output>
  );
}

/** "Conflicts to resolve (N)": opens the list of conflicts left to a person. */
function ConflictsEntry({
  flow,
  view,
}: {
  flow: ConnectorFlow;
  view: PendingConflictsView;
}) {
  if (!view.entry) {
    return null;
  }
  return (
    <Button
      className="w-full justify-start"
      data-connector-conflicts-entry
      onClick={() => flow.showConflicts(true)}
      type="button"
      variant="outline"
    >
      <TriangleAlert aria-hidden="true" className="size-4 text-amber-600" />
      {view.entry}
    </Button>
  );
}

/**
 * The conflicts waiting for a person: each with its row, column and both
 * values, kept one by one or all at once through `resolveConflicts`.
 */
function PendingConflictsList({
  flow,
  state,
  view,
}: {
  flow: ConnectorFlow;
  state: ConnectorFlowState;
  view: PendingConflictsView;
}) {
  const busy = state.resolvingConflicts;
  const keepAll = (choice: "table" | "target") => {
    flow
      .resolveConflicts(
        view.lines.map((line) => ({
          rowId: line.rowId,
          columnId: line.columnId,
          choice,
        }))
      )
      .catch(() => undefined);
  };
  return (
    <div aria-busy={busy} className="grid gap-3" data-connector-conflicts>
      <div className="grid gap-1">
        <h3 className="font-medium text-sm">{view.title}</h3>
        <p className="text-muted-foreground text-xs">{view.hint}</p>
      </div>
      {view.lines.length === 0 ? (
        <p
          className="text-muted-foreground text-sm"
          data-connector-conflicts-empty
        >
          {view.empty}
        </p>
      ) : (
        <ul className="grid gap-2">
          {view.lines.map((line) => (
            <li
              className="grid gap-1.5 rounded-md border px-3 py-2 text-xs"
              data-pending-conflict={line.id}
              key={line.id}
            >
              <span className="truncate font-medium text-sm">{line.title}</span>
              {(["table", "target"] as const).map((side) => (
                <span className="flex min-w-0 justify-between gap-2" key={side}>
                  <span className="shrink-0 text-muted-foreground">
                    {line[side].label}
                  </span>
                  <span className="truncate font-medium">
                    {line[side].value}
                  </span>
                </span>
              ))}
              <div className="grid gap-2">
                {(["table", "target"] as const).map((side) => (
                  <Button
                    disabled={busy}
                    key={side}
                    onClick={() => {
                      flow
                        .resolveConflicts([
                          {
                            rowId: line.rowId,
                            columnId: line.columnId,
                            choice: side,
                          },
                        ])
                        .catch(() => undefined);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {side === "table" ? line.keepTable : line.keepTarget}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy ? (
        <output className="text-muted-foreground text-xs">
          {view.resolving}
        </output>
      ) : null}
      {state.error ? (
        <p
          className="text-destructive text-sm"
          data-connector-error
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {view.lines.length > 1 ? (
        <div className="grid gap-2">
          <Button
            disabled={busy}
            onClick={() => keepAll("table")}
            type="button"
            variant="outline"
          >
            {view.keepAllTable}
          </Button>
          <Button
            disabled={busy}
            onClick={() => keepAll("target")}
            type="button"
            variant="outline"
          >
            {view.keepAllTarget}
          </Button>
        </div>
      ) : null}
      <Button
        className="w-full"
        onClick={() => flow.showConflicts(false)}
        type="button"
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ArrowLeft aria-hidden="true" className="size-4" />
        )}
        {view.back}
      </Button>
    </div>
  );
}

/** The last push or sync: counts, first failures, warnings and truncation. */
function ConnectorResult({
  connector,
  conflicts,
  flow,
  name,
  state,
  t,
}: {
  connector: TableConnector;
  conflicts: PendingConflictsView;
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
      <ConflictsEntry flow={flow} view={conflicts} />
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
  conflicts,
  flow,
  name,
  columns,
  locale,
  state,
  t,
}: {
  connector: TableConnector;
  conflicts: PendingConflictsView;
  flow: ConnectorFlow;
  name: string;
  columns: ConnectorViewColumn[];
  locale: string;
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
      <ConflictsEntry flow={flow} view={conflicts} />
      {canPreview && state.preview ? (
        <SyncPreviewGrid
          view={describeSyncPreview(state.preview, {
            t,
            name,
            columns,
            locale,
          })}
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
  const conflicts = describePendingConflicts(state.conflicts, {
    t,
    name,
    columns: opened.columns,
    locale,
  });
  if (state.conflictsOpen) {
    return (
      <StackMenuContent className="p-3" data-connector-panel>
        <PendingConflictsList flow={flow} state={state} view={conflicts} />
      </StackMenuContent>
    );
  }
  const hasResult = Boolean(state.result || state.syncResult);
  if (state.phase === "result" || (state.phase === "sending" && hasResult)) {
    return (
      <StackMenuContent className="p-3" data-connector-panel>
        <ConnectorResult
          conflicts={conflicts}
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
          conflicts={conflicts}
          connector={connector}
          flow={flow}
          locale={locale}
          name={name}
          state={state}
          t={t}
        />
      </ColumnMapping>
    </StackMenuContent>
  );
}
