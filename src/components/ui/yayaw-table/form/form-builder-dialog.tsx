"use client";

import { Settings2, X } from "lucide-react";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import {
  FORM_BUILDER_FORM,
  FormBuilderController,
  type FormBuilderOptions,
  type FormBuilderState,
  type FormBuilderTab,
} from "../utils/form-builder";
import {
  type FormColumn,
  type FormLabelKey,
  type FormLayout,
  type FormLinkActions,
  type FormTranslate,
  type FormViewSettings,
  formLabel,
  type PublicFormSnapshot,
} from "../utils/form-view";
import { FormBuilderOutline } from "./form-builder-outline";
import { FormBuilderPreview } from "./form-builder-preview";
import { FormBuilderProperties } from "./form-builder-properties";
import { FormLanguageSwitch } from "./form-languages";
import { FormShare } from "./form-share";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

/** Phones and narrow windows show one panel at a time, in tabs. */
const COMPACT_QUERY = "(max-width: 1023px)";
const LAYOUTS: FormLayout[] = ["page", "steps"];
const TABS: { value: FormBuilderTab; key: FormLabelKey }[] = [
  { value: "outline", key: "questions" },
  { value: "preview", key: "builderPreview" },
  { value: "properties", key: "builderProperties" },
];

/** Whether a media query matches; known on the first render (the builder only opens in browsers). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Publishing from the builder: the view's public link. */
export interface FormBuilderShare {
  formLinks: FormLinkActions;
  viewId: string | null;
  /** The saved form, as it would be published (unsaved changes are not). */
  snapshot: () => PublicFormSnapshot;
}

export interface FormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: readonly FormColumn[];
  /** The table's form settings (`table.form`). */
  defaults: unknown;
  /** The view's own form settings; the builder edits a copy. */
  settings: unknown;
  /** The table's language. */
  locale: string;
  translate?: FormTranslate;
  /** Save the edited settings in the view. */
  onSave: (settings: FormViewSettings | undefined) => void;
  share?: FormBuilderShare;
  /** Where the focus goes when the builder closes. */
  finalFocus?: RefObject<HTMLElement | null>;
}

/** Page or steps, as a segmented control. */
function LayoutSwitch({
  label,
  onChange,
  value,
}: {
  label: Label;
  onChange: (layout: FormLayout) => void;
  value: FormLayout;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 items-center gap-2" data-form-builder-layout>
      <legend className="float-left mr-1 text-muted-foreground text-sm">
        {label("layout")}
      </legend>
      <div className="inline-flex rounded-md border bg-muted/60 p-0.5">
        {LAYOUTS.map((layout) => (
          <label
            className="relative inline-flex h-7 cursor-pointer items-center whitespace-nowrap rounded-[calc(var(--radius-md)-2px)] px-2.5 text-muted-foreground text-sm transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:has-checked:bg-input/60"
            data-form-builder-layout-option={layout}
            key={layout}
          >
            <input
              checked={value === layout}
              className="sr-only"
              name={name}
              onChange={() => onChange(layout)}
              type="radio"
              value={layout}
            />
            {label(layout === "steps" ? "layoutSteps" : "layoutPage")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface SessionProps extends FormBuilderDialogProps {
  controllerRef: RefObject<FormBuilderController | null>;
}

/** The builder's top bar: title, layout, languages, state, sharing, Save and Close. */
function TopBar({
  compact,
  controller,
  label,
  locale,
  share,
  state,
  translate,
}: {
  compact: boolean;
  controller: FormBuilderController;
  label: Label;
  locale: string;
  share?: FormBuilderShare;
  state: FormBuilderState;
  translate?: FormTranslate;
}) {
  const status = state.dirty ? label("unsavedChanges") : undefined;
  return (
    <header
      className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 sm:px-4"
      data-form-builder-bar
    >
      <div className="min-w-0 flex-1 basis-40">
        <DialogTitle className="truncate font-medium text-base">
          {label("editForm")}
        </DialogTitle>
        <p className="truncate text-muted-foreground text-xs" data-form-builder-title>
          {state.title}
        </p>
      </div>
      {compact ? null : (
        <>
          <LayoutSwitch
            label={label}
            onChange={(layout) => controller.setLayout(layout)}
            value={state.layout}
          />
          <FormLanguageSwitch
            addLabel={label("addLanguage")}
            addable={state.addableLocales}
            label={label("editingLanguage")}
            languages={state.languages}
            onAdd={(locale) => controller.addLanguage(locale)}
            onChange={(locale) => controller.setLocale(locale)}
            value={state.locale}
          />
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {status ? (
          <span
            className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs"
            data-form-builder-status
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
            <span className={compact ? "sr-only" : undefined}>{status}</span>
          </span>
        ) : null}
        {compact ? null : (
          <Button
            className="font-normal"
            onClick={() => controller.select(FORM_BUILDER_FORM)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Settings2 aria-hidden="true" />
            {label("settingsTitle")}
          </Button>
        )}
        {share ? (
          <FormShare
            compact={false}
            formLinks={share.formLinks}
            iconOnly={compact}
            locale={locale}
            note={state.dirty ? label("saveToPublish") : undefined}
            snapshot={share.snapshot}
            translate={translate}
            viewId={share.viewId}
          />
        ) : null}
        <Button
          aria-keyshortcuts="Control+S Meta+S"
          data-form-builder-save
          disabled={!state.dirty}
          onClick={() => controller.save()}
          size="sm"
          type="button"
        >
          {label("save")}
        </Button>
        <Button
          aria-label={label("close")}
          onClick={() => controller.requestClose()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

/** "Discard your changes?": keep editing, discard, or save and close. */
function DiscardConfirm({
  controller,
  label,
  open,
}: {
  controller: FormBuilderController;
  label: Label;
  open: boolean;
}) {
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) {
          controller.keepEditing();
        }
      }}
      open={open}
    >
      <AlertDialogContent data-form-builder-confirm>
        <AlertDialogHeader>
          <AlertDialogTitle>{label("discardTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{label("discardDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            onClick={() => controller.keepEditing()}
            type="button"
            variant="outline"
          >
            {label("keepEditing")}
          </Button>
          <Button
            onClick={() => controller.discard()}
            type="button"
            variant="destructive"
          >
            {label("discard")}
          </Button>
          <Button onClick={() => controller.saveAndClose()} type="button">
            {label("saveAndClose")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FormBuilderSession(props: SessionProps) {
  const {
    columns,
    controllerRef,
    defaults,
    finalFocus,
    locale,
    onOpenChange,
    onSave,
    settings,
    share,
    translate,
  } = props;
  const options: FormBuilderOptions = {
    columns,
    defaults,
    settings,
    locale,
    translate,
    onSave,
    onClose: () => onOpenChange(false),
  };
  const [controller] = useState(() => new FormBuilderController(options));
  // Fresh callbacks, columns and labels; the draft is kept.
  useEffect(() => controller.setOptions(options));
  useEffect(() => {
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
    };
  }, [controller, controllerRef]);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );
  const compact = useMediaQuery(COMPACT_QUERY);
  useEffect(() => controller.setCompact(compact), [compact, controller]);
  const popup = useRef<HTMLDivElement>(null);
  const outlineId = useId();
  const previewId = useId();
  const propertiesId = useId();
  const label: Label = (key, params) =>
    formLabel(key, locale, translate, params);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (state.dirty) {
        controller.save();
      }
    }
  };
  const languageBar = compact ? (
    <FormLanguageSwitch
      addLabel={label("addLanguage")}
      addable={state.addableLocales}
      label={label("editingLanguage")}
      languages={state.languages}
      onAdd={(added) => controller.addLanguage(added)}
      onChange={(chosen) => controller.setLocale(chosen)}
      value={state.locale}
    />
  ) : undefined;
  const outline = (
    <FormBuilderOutline
      controller={controller}
      headingId={outlineId}
      label={label}
      state={state}
    />
  );
  const preview = (
    <FormBuilderPreview
      columns={columns}
      headingId={previewId}
      label={label}
      languageBar={languageBar}
      state={state}
      translate={translate}
    />
  );
  const properties = (
    <FormBuilderProperties
      controller={controller}
      headingId={propertiesId}
      label={label}
      languageBar={languageBar}
      locale={locale}
      state={state}
      translate={translate}
    />
  );
  return (
    <DialogContent
      className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none max-lg:h-dvh max-lg:w-dvw max-lg:rounded-none max-lg:ring-0"
      data-form-builder
      finalFocus={finalFocus}
      initialFocus={() =>
        popup.current?.querySelector<HTMLElement>(
          '[data-form-builder-entry][aria-current="true"], [role="tab"][aria-selected="true"]'
        ) ?? true
      }
      onKeyDown={onKeyDown}
      ref={popup}
      showCloseButton={false}
    >
      <DialogDescription className="sr-only">
        {label("builderDescription")}
      </DialogDescription>
      <TopBar
        compact={compact}
        controller={controller}
        label={label}
        locale={locale}
        share={share}
        state={state}
        translate={translate}
      />
      {compact ? (
        <Tabs
          className="min-h-0 flex-1 flex-col gap-0"
          onValueChange={(value) => controller.setTab(value as FormBuilderTab)}
          value={state.tab}
        >
          <TabsList
            className="h-11 w-full shrink-0 rounded-none border-b px-2"
            variant="line"
          >
            {TABS.map((tab) => (
              <TabsTrigger
                className="after:inset-x-0 after:bottom-[-5px] after:h-0.5"
                data-form-builder-tab={tab.value}
                key={tab.value}
                value={tab.value}
              >
                {label(tab.key)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent className="flex min-h-0 flex-col" value="outline">
            {outline}
          </TabsContent>
          <TabsContent className="flex min-h-0 flex-col" value="preview">
            {preview}
          </TabsContent>
          <TabsContent className="flex min-h-0 flex-col" value="properties">
            {properties}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)_minmax(19rem,23rem)] grid-rows-[minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_25rem]">
          <div className="flex min-h-0 flex-col border-r">{outline}</div>
          {preview}
          <div className="flex min-h-0 flex-col border-l">{properties}</div>
        </div>
      )}
      <output className="sr-only" data-form-builder-announcement>
        {state.announcement}
      </output>
      <DiscardConfirm controller={controller} label={label} open={state.confirming} />
    </DialogContent>
  );
}

/**
 * The form builder: a near full-screen dialog (full screen on phones, with
 * Questions, Preview and Properties tabs) editing a view's form: its outline
 * on the left, a live preview in the middle and the selected item's
 * properties on the right. Changes are kept until "Save"; closing with unsaved
 * changes asks first.
 */
export function FormBuilderDialog(props: FormBuilderDialogProps) {
  const controllerRef = useRef<FormBuilderController | null>(null);
  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) {
          controllerRef.current?.requestClose();
        }
      }}
      open={props.open}
    >
      {props.open ? (
        <FormBuilderSession {...props} controllerRef={controllerRef} />
      ) : null}
    </Dialog>
  );
}
