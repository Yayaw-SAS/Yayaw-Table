"use client";

import { ChevronLeft, Pencil } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/src/components/ui/native-select";
import { Textarea } from "@/src/components/ui/textarea";
import type { DisplayModeRenderers } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/src/components/ui/yayaw-table/types/translations";
import { canonicalViewConfig } from "@/src/components/ui/yayaw-table/utils/view-config";
import type { DashboardBlockRegistry } from "./dashboard-block";
import { Field, KpiFields, OverflowField } from "./dashboard-dialogs";
import {
  type DashboardBlockPropsDraft,
  type DashboardWidgetChoice,
  type DashboardWidgetDialogTarget,
  dashboardBlockPropsText,
  dashboardKindReadsSource,
  dashboardViewEditStart,
  dashboardWidgetChoices,
  parseDashboardBlockProps,
} from "./dashboard-editor-model";
import { tableInfo } from "./dashboard-hooks";
import {
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidgetDraft,
  dashboardUnavailableText,
  dashboardWidgetDraft,
  dashboardWidgetFromDraft,
  emptyWidgetDraft,
  loadDashboardViews,
} from "./dashboard-model";
import {
  checkDashboardBlockProps,
  type DashboardJsonObject,
  type DashboardWidget,
} from "./dashboard-schema";
import type {
  DashboardSourceLoader,
  DashboardSourceState,
} from "./dashboard-sources";
import { DashboardSourcePicker } from "./dashboard-source-picker";
import { DashboardViewEditor } from "./dashboard-view-editor";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-widget";

export interface DashboardWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DashboardWidgetDialogTarget;
  loader: DashboardSourceLoader<DashboardTableSource>;
  blocks?: DashboardBlockRegistry;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  /** For the view editor's table. */
  renderers?: DisplayModeRenderers;
  getRowId?: (row: Record<string, unknown>) => string;
  tableTranslations?: DataTableTranslations;
  /** The widget the dialog describes (without its id), and its source's saved views. */
  onSubmit: (
    widget: Omit<DashboardWidget, "id">,
    views: readonly DashboardView[] | undefined
  ) => void;
}

type Step = "what" | "source" | "settings";

const STEP_LABELS = {
  what: "stepWhat",
  source: "stepSource",
  settings: "stepSettings",
} as const;

/** Value of "Start from" for a custom view (never a saved view's id). */
const CUSTOM_VIEW = "__custom_view__";

/** Re-renders when a source's state changes. */
function useLoaderUpdates(loader: DashboardSourceLoader<DashboardTableSource>) {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  useEffect(() => loader.subscribe(() => rerender()), [loader]);
}

/** The saved views of the source picked (static ones, then `views.list`). */
function usePickedViews(
  source: DashboardTableSource | undefined,
  tableId: string
): DashboardView[] | undefined {
  const [views, setViews] = useState<DashboardView[]>();
  useEffect(() => {
    setViews(undefined);
    if (!(source && tableId)) {
      return;
    }
    let cancelled = false;
    loadDashboardViews(source, tableId)
      .catch(() => loadDashboardViews({ views: source.views }, tableId))
      .then((loaded) => {
        if (!cancelled) {
          setViews(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [source, tableId]);
  return views;
}

/** Step 1: a number, a view, a table page, a note, or one of the host's blocks. */
function KindStep({
  choices,
  label,
  onChoose,
}: {
  choices: DashboardWidgetChoice[];
  label: DashboardLabel;
  onChoose: (choice: DashboardWidgetChoice) => void;
}) {
  const groups = [...new Set(choices.map((choice) => choice.group))];
  const prefix = useId();
  return (
    <fieldset className="grid gap-3" data-widget-kinds="">
      <legend className="mb-2 font-medium text-sm">{label("chooseKind")}</legend>
      {groups.map((group) => (
        <div className="grid gap-1.5" key={group || "-"}>
          {group ? (
            <p className="text-muted-foreground text-xs" data-kind-group="">
              {group}
            </p>
          ) : null}
          <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
            {choices
              .filter((choice) => choice.group === group)
              .map((choice) => {
                const key = choice.block ?? choice.kind;
                const hint = `${prefix}-${key}`;
                return (
                  <li key={key}>
                    <button
                      aria-describedby={choice.description ? hint : undefined}
                      aria-label={choice.label}
                      className="flex h-full w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                      data-widget-block={choice.block}
                      data-widget-kind={choice.kind}
                      onClick={() => onChoose(choice)}
                      type="button"
                    >
                      <span className="font-medium">{choice.label}</span>
                      {choice.description ? (
                        <span className="text-muted-foreground text-xs" id={hint}>
                          {choice.description}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}

/** "Start from": the source's default view, a saved view, or a custom view edited in the view editor. */
function ViewChoice({
  canEditView,
  draft,
  id,
  label,
  onEditView,
  setDraft,
  views,
}: {
  canEditView: boolean;
  draft: DashboardWidgetDraft;
  id: string;
  label: DashboardLabel;
  onEditView: () => void;
  setDraft: (draft: DashboardWidgetDraft) => void;
  views?: readonly DashboardView[];
}) {
  const known = views?.some((view) => view.id === draft.viewId);
  const choose = (value: string) => {
    const { view: _view, ...rest } = draft;
    if (value !== CUSTOM_VIEW) {
      setDraft({ ...rest, viewId: value });
      return;
    }
    // A custom view starts from the view chosen so far.
    const saved = views?.find((view) => view.id === draft.viewId);
    setDraft({
      ...rest,
      viewId: "",
      view: saved ? canonicalViewConfig(saved.config) : {},
    });
  };
  return (
    <>
      <Field htmlFor={id} label={label("startFrom")}>
        <NativeSelect
          className="w-full"
          id={id}
          onChange={(event) => choose(event.target.value)}
          value={draft.view ? CUSTOM_VIEW : draft.viewId}
        >
          <NativeSelectOption value="">{label("defaultView")}</NativeSelectOption>
          {views?.length ? (
            <NativeSelectOptGroup label={label("savedViews")}>
              {views.map((view) => (
                <NativeSelectOption key={view.id} value={view.id}>
                  {view.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
          {draft.viewId && !known ? (
            <NativeSelectOption value={draft.viewId}>
              {draft.viewId}
            </NativeSelectOption>
          ) : null}
          <NativeSelectOption value={CUSTOM_VIEW}>
            {label("customView")}
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      {draft.view ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
          data-custom-view=""
        >
          <p className="m-0 min-w-0 flex-1 text-muted-foreground">
            {label("customViewHint")}
          </p>
          <Button
            disabled={!canEditView}
            onClick={onEditView}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" />
            {label("editView")}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** A block's props: the host's settings component, else JSON checked before it applies. */
function BlockPropsField({
  blocks,
  check,
  draft,
  id,
  label,
  locale,
  onText,
  setDraft,
  text,
  widgetId,
}: {
  blocks?: DashboardBlockRegistry;
  check?: DashboardBlockPropsDraft;
  draft: DashboardWidgetDraft;
  id: string;
  label: DashboardLabel;
  locale: string;
  onText: (text: string) => void;
  setDraft: (draft: DashboardWidgetDraft) => void;
  text: string;
  widgetId: string;
}) {
  const block =
    blocks && draft.block && Object.hasOwn(blocks, draft.block)
      ? blocks[draft.block]
      : undefined;
  const Settings = block?.settings;
  const problems = check?.issues.filter((issue) =>
    check.ok ? issue.severity === "warning" : true
  );
  return (
    <div className="grid gap-2" data-block-props="">
      {Settings ? (
        <Settings
          locale={locale}
          onChange={(props: DashboardJsonObject) =>
            setDraft({ ...draft, props })
          }
          // As the block reads them: its props over the block's defaults.
          props={{ ...block?.defaultProps, ...draft.props }}
          widgetId={widgetId}
        />
      ) : (
        <Field htmlFor={id} label={label("blockProps")}>
          <Textarea
            aria-invalid={check && !check.ok ? true : undefined}
            className="font-mono text-xs"
            id={id}
            onChange={(event) => onText(event.target.value)}
            rows={8}
            spellCheck={false}
            value={text}
          />
        </Field>
      )}
      {check && !check.json ? (
        <p className="m-0 text-destructive text-sm" data-props-error="" role="alert">
          {label("invalidJson")}
        </p>
      ) : null}
      {problems?.length ? (
        <div
          className="grid gap-1 text-sm"
          data-props-error=""
          role={check?.ok ? undefined : "alert"}
        >
          {check?.ok ? null : (
            <p className="m-0 text-destructive">{label("propsRefused")}</p>
          )}
          <ul className="m-0 list-disc ps-5">
            {problems.map((issue) => (
              <li key={`${issue.path ?? ""}:${issue.message}`}>
                {issue.path ? <code>{issue.path}</code> : null}
                {issue.path ? ": " : null}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The dialog's steps: what, source (widgets reading one), settings; edits start at the settings. */
const dialogSteps = (reads: boolean, editing: boolean): Step[] => {
  const steps: Step[] = reads
    ? ["what", "source", "settings"]
    : ["what", "settings"];
  return editing ? steps.filter((step) => step !== "what") : steps;
};

/** A block's props checked before they apply: its settings component's, else the JSON typed. */
const checkBlockDraft = (
  draft: DashboardWidgetDraft,
  text: string,
  blocks?: DashboardBlockRegistry
): DashboardBlockPropsDraft => {
  const key = draft.block ?? "";
  const hasSettings = Boolean(
    blocks && Object.hasOwn(blocks, key) && blocks[key]?.settings
  );
  return hasSettings
    ? {
        json: true,
        ...checkDashboardBlockProps(key, draft.props ?? {}, { blocks }),
      }
    : parseDashboardBlockProps(text, key, { blocks });
};

/** Why a picked source cannot be used: unavailable (its reason) or failing. */
const loadFailureText = (
  loaded: DashboardSourceState<DashboardTableSource>,
  locale: string,
  translate: DashboardTranslate,
  label: DashboardLabel
): string =>
  loaded.status === "unavailable"
    ? dashboardUnavailableText(loaded.reason, loaded.message, locale, translate)
    : label("widgetError", {
        error: loaded.status === "error" ? loaded.message : "",
      });

/** The draft of a new source: its view and columns start over. */
const withSource = (
  draft: DashboardWidgetDraft,
  tableId: string
): DashboardWidgetDraft => {
  if (draft.tableId === tableId) {
    return draft;
  }
  const { view: _view, ...rest } = draft;
  return {
    ...rest,
    tableId,
    viewId: "",
    metricColumn: "",
    dateColumn: "",
    compare: false,
    sparkline: false,
  };
};

interface SettingsStepProps {
  blocks?: DashboardBlockRegistry;
  draft: DashboardWidgetDraft;
  setDraft: (draft: DashboardWidgetDraft) => void;
  ids: Record<string, string>;
  info?: DashboardTableInfo;
  label: DashboardLabel;
  locale: string;
  onEditView: () => void;
  onText: (text: string) => void;
  propsCheck?: DashboardBlockPropsDraft;
  propsText: string;
  source?: DashboardTableSource;
  sourceName: string;
  translate: DashboardTranslate;
  views?: readonly DashboardView[];
  widgetId: string;
}

/** Step 3: the widget's view, value, title, text or props. */
function SettingsStep({
  blocks,
  draft,
  ids,
  info,
  label,
  locale,
  onEditView,
  onText,
  propsCheck,
  propsText,
  setDraft,
  source,
  sourceName,
  translate,
  views,
  widgetId,
}: SettingsStepProps) {
  const reads = dashboardKindReadsSource(draft.type);
  return (
    <div className="grid gap-4">
      {reads ? (
        <p className="m-0 text-muted-foreground text-sm" data-widget-source="">
          {label("stepSource")}:{" "}
          <span className="text-foreground">{sourceName}</span>
        </p>
      ) : null}
      {reads ? (
        <ViewChoice
          canEditView={Boolean(source)}
          draft={draft}
          id={ids.view ?? ""}
          label={label}
          onEditView={onEditView}
          setDraft={setDraft}
          views={views}
        />
      ) : null}
      {draft.type === "view" ? (
        <OverflowField
          draft={draft}
          ids={ids}
          label={label}
          setDraft={setDraft}
        />
      ) : null}
      {draft.type === "kpi" && info ? (
        <KpiFields
          draft={draft}
          ids={ids}
          label={label}
          locale={locale}
          setDraft={setDraft}
          tables={{ [draft.tableId]: info }}
          translate={translate}
        />
      ) : null}
      <Field htmlFor={ids.title ?? ""} label={label("widgetTitle")}>
        <Input
          id={ids.title}
          maxLength={120}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          value={draft.title}
        />
      </Field>
      {draft.type === "note" ? (
        <Field htmlFor={ids.text ?? ""} label={label("noteText")}>
          <Textarea
            id={ids.text}
            maxLength={20_000}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            rows={5}
            value={draft.text}
          />
        </Field>
      ) : null}
      {draft.type === "block" ? (
        <BlockPropsField
          blocks={blocks}
          check={propsCheck}
          draft={draft}
          id={ids.props ?? ""}
          label={label}
          locale={locale}
          onText={onText}
          setDraft={setDraft}
          text={propsText}
          widgetId={widgetId}
        />
      ) : null}
    </div>
  );
}

/** Picking a source: it loads once; unavailable or failing, the reason shows. */
function useSourcePick({
  label,
  loader,
  locale,
  onReady,
  translate,
}: {
  label: DashboardLabel;
  loader: DashboardSourceLoader<DashboardTableSource>;
  locale: string;
  onReady: (id: string) => void;
  translate: DashboardTranslate;
}) {
  const [picking, setPicking] = useState<string>();
  const [pickError, setPickError] = useState<string>();
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const ready = useRef(onReady);
  ready.current = onReady;
  const pickSource = (id: string) => {
    setPicking(id);
    setPickError(undefined);
    loader
      .load(id)
      .then((loaded) => {
        if (!mounted.current) {
          return;
        }
        setPicking(undefined);
        if (loaded.status === "ready") {
          ready.current(id);
        } else {
          setPickError(loadFailureText(loaded, locale, translate, label));
        }
      })
      .catch(() => setPicking(undefined));
  };
  return { picking, pickError, pickSource };
}

/** Back (when there is a step before), Cancel, and Add or Apply on the settings. */
function DialogButtons({
  canSubmit,
  editing,
  label,
  onBack,
  onCancel,
  step,
}: {
  canSubmit: boolean;
  editing: boolean;
  label: DashboardLabel;
  onBack?: () => void;
  onCancel: () => void;
  step: Step;
}) {
  return (
    <DialogFooter>
      {onBack ? (
        <Button
          className="sm:me-auto"
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
          {label("back")}
        </Button>
      ) : null}
      <Button onClick={onCancel} type="button" variant="outline">
        {label("cancel")}
      </Button>
      {step === "settings" ? (
        <Button disabled={!canSubmit} type="submit">
          {label(editing ? "apply" : "add")}
        </Button>
      ) : null}
    </DialogFooter>
  );
}

/** One opening of the dialog: its draft, steps and the view editor on top. */
function WidgetDialogSession({
  blocks,
  getRowId,
  label,
  loader,
  locale,
  onOpenChange,
  onSubmit,
  renderers,
  tableTranslations,
  target,
  translate,
}: Omit<DashboardWidgetDialogProps, "open">) {
  useLoaderUpdates(loader);
  const edited = target.mode === "edit" ? target.widget : undefined;
  const [draft, setDraft] = useState<DashboardWidgetDraft>(() =>
    edited ? dashboardWidgetDraft(edited, locale) : emptyWidgetDraft()
  );
  const [step, setStep] = useState<Step>(edited ? "settings" : "what");
  const [propsText, setPropsText] = useState(() =>
    dashboardBlockPropsText(draft.props)
  );
  const [propsCheck, setPropsCheck] = useState<DashboardBlockPropsDraft>();
  const [viewEditing, setViewEditing] = useState(false);
  const { picking, pickError, pickSource } = useSourcePick({
    label,
    loader,
    locale,
    onReady: (id) => {
      setDraft((current) => withSource(current, id));
      setStep("settings");
    },
    translate,
  });
  const prefix = useId();
  const ids = Object.fromEntries(
    [
      "view",
      "overflow",
      "metric",
      "column",
      "date",
      "compare",
      "days",
      "better",
      "sparkline",
      "title",
      "text",
      "props",
    ].map((name) => [name, `${prefix}-${name}`])
  );

  const reads = dashboardKindReadsSource(draft.type);
  const state = draft.tableId ? loader.state(draft.tableId) : undefined;
  const source = state?.status === "ready" ? state.source : undefined;
  const views = usePickedViews(source, draft.tableId);
  // An edited widget's source loads once, like on the screen.
  useEffect(() => {
    if (reads && draft.tableId) {
      loader.load(draft.tableId).catch(() => undefined);
    }
  }, [draft.tableId, loader, reads]);
  const info = source ? tableInfo(draft.tableId, source) : undefined;
  const steps = dialogSteps(reads, Boolean(edited));
  const index = steps.indexOf(step);

  const chooseKind = (choice: DashboardWidgetChoice) => {
    const block =
      choice.block && blocks && Object.hasOwn(blocks, choice.block)
        ? blocks[choice.block]
        : undefined;
    const props = { ...block?.defaultProps };
    setDraft({
      ...emptyWidgetDraft(),
      type: choice.kind,
      ...(choice.block ? { block: choice.block, props } : {}),
    });
    setPropsText(dashboardBlockPropsText(props));
    setPropsCheck(undefined);
    setStep(dashboardKindReadsSource(choice.kind) ? "source" : "settings");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Enter in the catalogue's search picks a source; only settings submit.
    if (step !== "settings") {
      return;
    }
    let next = draft;
    if (draft.type === "block") {
      const checked = checkBlockDraft(draft, propsText, blocks);
      setPropsCheck(checked);
      if (!(checked.ok && checked.props)) {
        return;
      }
      next = { ...draft, props: checked.props };
    }
    onSubmit(
      dashboardWidgetFromDraft(next, edited ? { widget: edited, locale } : undefined),
      views
    );
    onOpenChange(false);
  };
  const sourceName = info?.name ?? draft.tableId;
  let body: ReactNode;
  if (step === "what") {
    body = (
      <KindStep
        choices={dashboardWidgetChoices({
          section: target.mode === "add" ? target.sectionType : undefined,
          blocks,
          locale,
          translate,
        })}
        label={label}
        onChoose={chooseKind}
      />
    );
  } else if (step === "source") {
    body = (
      <div className="grid gap-2">
        <DashboardSourcePicker
          label={label}
          loader={loader}
          locale={locale}
          onPick={pickSource}
          picking={picking}
          translate={translate}
          value={draft.tableId}
        />
        {pickError ? (
          <p className="m-0 text-destructive text-sm" role="alert">
            {pickError}
          </p>
        ) : null}
      </div>
    );
  } else {
    body = (
      <SettingsStep
        blocks={blocks}
        draft={draft}
        ids={ids}
        info={info}
        label={label}
        locale={locale}
        onEditView={() => setViewEditing(true)}
        onText={(text) => {
          setPropsText(text);
          setPropsCheck(undefined);
        }}
        propsCheck={propsCheck}
        propsText={propsText}
        setDraft={setDraft}
        source={source}
        sourceName={sourceName}
        translate={translate}
        views={views}
        widgetId={edited?.id ?? ""}
      />
    );
  }
  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      data-dashboard-dialog="widget"
      data-widget-step={step}
    >
      <DialogHeader>
        <DialogTitle>
          {label(edited ? "editWidgetTitle" : "addWidgetTitle")}
        </DialogTitle>
        <DialogDescription data-widget-step-label="">
          {label("stepOf", { step: index + 1, count: steps.length })} ·{" "}
          {label(STEP_LABELS[step])}
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        {body}
        <DialogButtons
          canSubmit={!reads || Boolean(draft.tableId)}
          editing={Boolean(edited)}
          label={label}
          onBack={
            index > 0 ? () => setStep(steps[index - 1] ?? step) : undefined
          }
          onCancel={() => onOpenChange(false)}
          step={step}
        />
      </form>
      {source && viewEditing ? (
        <DashboardViewEditor
          getRowId={getRowId}
          label={label}
          locale={locale}
          onApply={(view) => setDraft({ ...draft, viewId: "", view })}
          onClose={() => setViewEditing(false)}
          open
          renderers={renderers}
          source={source}
          sourceId={draft.tableId}
          start={dashboardViewEditStart({ view: draft.view ?? {} })}
          subtitle={sourceName}
          translations={tableTranslations}
        />
      ) : null}
    </DialogContent>
  );
}

/**
 * The widget dialog, adding or editing a widget in three steps: what (a
 * number, a view, a table page, a note or one of the host's blocks, as the
 * section takes them), its source (the host's catalogue, searchable; sources
 * this user cannot use are listed, disabled, with the reason) and its
 * settings (a saved, default or custom view edited in the view editor; the
 * number's value, period and trend; a block's settings or props as JSON,
 * checked before they apply).
 */
export function DashboardWidgetDialog({
  open,
  ...props
}: DashboardWidgetDialogProps) {
  return (
    <Dialog onOpenChange={props.onOpenChange} open={open}>
      {open ? <WidgetDialogSession {...props} /> : null}
    </Dialog>
  );
}
