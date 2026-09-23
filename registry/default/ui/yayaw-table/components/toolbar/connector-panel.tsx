"use client";

import { Loader2, Send } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StackMenuContent, useStackMenu } from "../../ui-custom/stack-menu";
import {
  applyConnectorField,
  type ConnectorFlow,
  type ConnectorFlowState,
  type ConnectorT,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorLabels,
  connectorScreenFields,
  createConnectorFlow,
  type DataDestinationConnector,
  describePushDetails,
  describePushResult,
} from "../../utils/connector-flow";
import {
  type ConnectorPushContext,
  connectorPushContext,
  type DataDestinationContext,
} from "../../utils/data-destinations";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "./view-settings-panel";

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

/** The shared screen fields, with the paste input and the mode hint after their selects. */
function connectorFields({
  connector,
  columns,
  flow,
  selectedCount,
  state,
  t,
  targetInput,
}: {
  connector: TableConnector;
  columns: ConnectorViewColumn[];
  flow: ConnectorFlow;
  selectedCount: number;
  state: ConnectorFlowState;
  t: ConnectorT;
  targetInput: ReactNode;
}): ViewSettingField[] {
  const modeHint = state.settings ? (
    <p className="text-muted-foreground text-xs" data-connector-mode-hint>
      {t(state.settings.mode === "replace" ? "replaceHint" : "upsertHint")}
    </p>
  ) : null;
  const after: Record<string, ReactNode> = {
    target: targetInput,
    mode: modeHint,
  };
  return connectorScreenFields(state, {
    connector,
    columns,
    selectedCount,
    t,
  }).map((field) => ({
    ...field,
    after: after[field.id],
    onChange: (value) => {
      applyConnectorField(flow, field.id, value).catch(() => undefined);
    },
  }));
}

/** The last push: counts, first failures, warnings and truncation. */
function ConnectorResult({
  connector,
  flow,
  state,
  t,
}: {
  connector: TableConnector;
  flow: ConnectorFlow;
  state: ConnectorFlowState;
  t: ConnectorT;
}) {
  const { goBack } = useStackMenu();
  if (!state.result) {
    return null;
  }
  const details = describePushDetails(state.result, t, connector.help);
  const sending = state.phase === "sending";
  return (
    <div className="grid gap-3" data-connector-result>
      <output
        aria-live="polite"
        className="grid gap-1 rounded-md bg-muted px-3 py-2 text-sm"
      >
        <p className="font-medium" data-connector-summary>
          {describePushResult(state.result, t)}
        </p>
        {details.failures.map((line) => (
          <p className="text-destructive" key={line}>
            {line}
          </p>
        ))}
        {details.warnings ? (
          <p className="text-muted-foreground">{details.warnings}</p>
        ) : null}
        {details.truncated ? (
          <p className="text-muted-foreground">{details.truncated}</p>
        ) : null}
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
          aria-busy={sending}
          className="flex-1"
          disabled={sending}
          onClick={() => {
            flow.send().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          {sending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t("sendAgain")}
        </Button>
      </div>
    </div>
  );
}

/** Error, field loading and Send, after the settings. */
function ConnectorActions({
  flow,
  state,
  t,
}: {
  flow: ConnectorFlow;
  state: ConnectorFlowState;
  t: ConnectorT;
}) {
  const sending = state.phase === "sending";
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
      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 px-3 py-2 text-destructive text-sm"
          data-connector-error
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <Button
        aria-busy={sending}
        className="w-full"
        disabled={sending || !state.settings}
        onClick={() => {
          flow.send().catch(() => undefined);
        }}
        type="button"
      >
        {sending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Send aria-hidden="true" className="size-4" />
        )}
        {sending ? t("sending") : t("send")}
      </Button>
    </>
  );
}

/**
 * The connector screen of a Connect destination: target, column mapping,
 * records, then Send and the result. The host only lists targets, describes
 * their fields and pushes; the flow is shared with the Vue edition.
 */
export function ConnectorPanel({
  connector,
  context,
  columns,
  selectedRows,
  locale,
  translate,
}: ConnectorPanelProps) {
  // The view the screen was opened on owns the settings; capture it once.
  const [opened] = useState(() => ({
    connector,
    context: context(),
    columns,
    selectedRows,
    t: connectorLabels(locale, translate),
  }));
  const [state, setState] = useState<ConnectorFlowState>();
  const flowRef = useRef<ConnectorFlow>(null);
  useEffect(() => {
    const flow = createConnectorFlow({
      connector: opened.connector,
      context: opened.context,
      columns: opened.columns,
      selectedCount: opened.selectedRows.length,
      t: opened.t,
      pushContext: (scope, sent) =>
        connectorPushContext(opened.context, scope, sent, opened.selectedRows),
      onChange: setState,
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
  if (state.phase === "result" || (state.phase === "sending" && state.result)) {
    return (
      <StackMenuContent className="p-3" data-connector-panel>
        <ConnectorResult
          connector={connector}
          flow={flow}
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
      <ViewSettingsPanel
        fields={connectorFields({
          connector,
          columns: opened.columns,
          flow,
          selectedCount: opened.selectedRows.length,
          state,
          t,
          targetInput,
        })}
      >
        <ConnectorActions flow={flow} state={state} t={t} />
      </ViewSettingsPanel>
    </StackMenuContent>
  );
}
