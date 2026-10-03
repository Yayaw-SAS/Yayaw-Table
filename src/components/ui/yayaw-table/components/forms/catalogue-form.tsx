/**
 * Catalogue form component
 * This component renders a form based on a form configuration from the catalogue
 */
"use client";

// Debug flag to control logging
const _DEBUG = false;

import { Tabs } from "@base-ui/react/tabs";
import { useStore } from "@tanstack/react-form";
import { useAtom, useSetAtom } from "jotai";
import { History, PencilIcon, PlusIcon } from "lucide-react";
import type React from "react";
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { useTableConfig } from "../../hooks/use-table-config";
import { useLocale } from "../../providers/table-provider";
import {
  type DetailLabels,
  type DetailRecord,
  type DetailType,
  detailActivity,
  detailLabels,
} from "../../utils/record-details";
import {
  RecordActivity,
  RecordActivityContext,
} from "../details/record-activity";
import { RecordSurface, RecordSurfaceHeader } from "../records/record-surface";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  formSubmittedAtom,
  handleFormOpenChange,
} from "./atoms/catalogue-form-atoms";
import { DrawerFormPortalContainerContext } from "./drawer-form-portal-context";
import { FormBuilder } from "./form-builder";
import { useFormCatalogue } from "./hooks/use-form-catalogue";
import type { AnyFieldDefinition, FieldValues, FormConfig } from "./types";

interface CatalogueFormTranslations {
  updated?: string;
  created?: string;
  updateError?: string;
  createError?: string;
  updating?: string;
  creating?: string;
}

interface CatalogueFormProps<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Children to render as the trigger
   * If provided, will be used instead of the default button
   */
  children?: ReactNode;
  /** Render inside the existing record surface during consultation-to-edit. */
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;

  /**
   * Type of form to use (corresponds to a key in the form catalogue)
   */
  formType?: string;

  /**
   * Initial data for the form (used for update operations)
   */
  initialData?: Partial<TFieldValues>;

  /**
   * Mode of the form (create or update)
   */
  mode?: "create" | "update";

  /**
   * Callback when the form is submitted successfully
   */
  onSuccess?: (data: unknown) => void;

  /**
   * Table ID associated with the form
   */
  tableId?: string;

  /**
   * Table type associated with the parent table configuration
   */
  tableType?: string;
}

/**
 * Returns only values that differ from initial data (for update mode)
 */
function getChangedValues<T extends FieldValues>(
  currentValues: T,
  initialData: Partial<T> | undefined
): Partial<T> {
  if (!initialData || typeof currentValues !== "object") {
    return currentValues;
  }
  const result = {} as Partial<T>;
  for (const key of Object.keys(currentValues) as (keyof T)[]) {
    const cur = currentValues[key];
    const init = initialData[key];
    if (JSON.stringify(cur) !== JSON.stringify(init)) {
      result[key] = cur;
    }
  }
  return result;
}

/**
 * Prepare submission data based on mode
 */
function _prepareSubmissionData<T extends FieldValues>(
  values: T,
  mode: "create" | "update",
  initialData: Partial<T> | undefined
): T {
  if (mode === "update" && initialData) {
    return {
      ...(initialData as T),
      ...getChangedValues(values, initialData),
    };
  }
  return values;
}

/**
 * Handle submission success
 */
function handleSubmissionSuccess(
  result: unknown,
  mode: "create" | "update",
  onSuccess: ((resultParam: unknown) => void) | undefined,
  _setFormState: (fn: (prev: CatalogueFormState) => CatalogueFormState) => void,
  setFormSubmitted: (submitted: boolean) => void,
  translations: CatalogueFormTranslations
): string {
  // No need to update success state as CatalogueFormState doesn't have it
  setFormSubmitted(false);

  // Call the success callback if provided
  if (onSuccess) {
    onSuccess(result);
  }

  return mode === "update"
    ? translations.updated || "Updated successfully!"
    : translations.created || "Created successfully!";
}

/**
 * Handle success flow after form submission
 */
function handleSuccessFlow<TFieldValues extends FieldValues>(
  result: unknown,
  currentMode: "create" | "update",
  currentOnSuccess: ((resultParam: unknown) => void) | undefined,
  setFormState: (fn: (prev: CatalogueFormState) => CatalogueFormState) => void,
  setFormSubmitted: (submitted: boolean) => void,
  translations: CatalogueFormTranslations,
  form: { reset: (values?: TFieldValues) => void },
  isChangingStateRef: React.MutableRefObject<boolean>
): string {
  // Get success message using helper
  const successMessage = handleSubmissionSuccess(
    result,
    currentMode,
    currentOnSuccess,
    setFormState,
    setFormSubmitted,
    translations
  );

  // Show a success toast for each successful form submission.
  toast.success(successMessage, {
    duration: 3000,
  });

  // For update operations, update the initialData in the form state with fresh data
  if (currentMode === "update" && result) {
    setFormState((prev) => ({
      ...prev,
      initialData: result as Record<string, unknown>,
    }));
  }

  // Reset the form
  form.reset();

  // Close the form after successful submission with protection
  if (!isChangingStateRef.current) {
    isChangingStateRef.current = true;
    setFormState((prev) => handleFormOpenChange(false, prev));
    // Reset the flag after a brief delay
    setTimeout(() => {
      isChangingStateRef.current = false;
    }, 100);
  }

  return successMessage;
}

/**
 * Handle submission error
 */
function handleSubmissionError(
  error: unknown,
  mode: "create" | "update",
  setError: (errorParam: Error | null) => void,
  translations: CatalogueFormTranslations
): string {
  const errorObj = error instanceof Error ? error : new Error("Unknown error");
  setError(errorObj);

  return mode === "update"
    ? translations.updateError || "Failed to update"
    : translations.createError || "Failed to create";
}

/**
 * Initialize form state and resolve props vs atom values
 */
function useFormStateResolution<TFieldValues extends FieldValues>(
  props: CatalogueFormProps<TFieldValues>
) {
  const [formState, setFormState] = useAtom(catalogueFormAtom);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<Error | null>(null);

  // Extract values from form state
  const {
    formType: atomFormType,
    initialData: atomInitialData,
    isOpen,
    mode: atomMode = "create",
    onSuccess: atomOnSuccess,
    tableId: atomTableId,
    tableType: atomTableType,
  } = formState;

  // Determine which values to use (props take precedence over atom)
  const formType = props.formType || atomFormType;
  const initialData = props.initialData || atomInitialData;
  const mode = props.mode || atomMode;
  const onSuccess = props.onSuccess || atomOnSuccess;
  const tableId = props.tableId || atomTableId;
  const tableType = props.tableType || atomTableType || tableId;

  // Stable references to prevent callback recreation
  const onSuccessRef = useRef(onSuccess);
  const initialDataRef = useRef(initialData);
  const modeRef = useRef(mode);

  // Update refs when values change
  onSuccessRef.current = onSuccess;
  initialDataRef.current = initialData;
  modeRef.current = mode;

  return {
    formState,
    setFormState,
    loading,
    setLoading,
    setError,
    isOpen,
    formType,
    initialData,
    mode,
    tableId,
    tableType,
    onSuccessRef,
    initialDataRef,
    modeRef,
  };
}

export function CatalogueForm<TFieldValues extends FieldValues>(
  props: CatalogueFormProps<TFieldValues>
) {
  const { children } = props;

  // Initialize form state and resolve props vs atom values
  const {
    setFormState,
    loading,
    setLoading,
    setError,
    isOpen,
    formType,
    initialData,
    mode,
    tableId,
    tableType,
    onSuccessRef,
  } = useFormStateResolution(props);
  const { config: tableConfig } = useTableConfig(
    tableType || tableId || formType || "default-table"
  );
  // Add a ref to track if we're in the middle of a state change
  const isChangingStateRef = useRef(false);

  const [, setFormSubmitted] = useAtom(formSubmittedAtom);

  const drawerContentRef = useRef<HTMLDivElement>(null);

  const formCatalogueParams = useMemo(
    () => ({
      enabled: isOpen,
      formType: formType || "",
      initialData: initialData as Partial<TFieldValues>,
      mode,
      tableId,
      tableType,
    }),
    [formType, initialData, mode, tableId, tableType, isOpen]
  );

  const translationsRef = useRef<CatalogueFormTranslations>({});
  const formRef = useRef<{ reset: (values?: TFieldValues) => void } | null>(
    null
  );

  const onFormSubmit = useCallback(
    async (
      values: TFieldValues,
      doSubmit: (values: TFieldValues) => Promise<unknown>
    ) => {
      setFormSubmitted(true);
      setLoading(true);
      setError(null);
      const t = translationsRef.current;
      const loadingToastId = toast.loading(
        mode === "update"
          ? (t.updating ?? "Updating...")
          : (t.creating ?? "Creating...")
      );
      try {
        const result = await doSubmit(values);
        toast.dismiss(loadingToastId);
        handleSuccessFlow(
          result,
          mode,
          onSuccessRef.current as ((resultParam: unknown) => void) | undefined,
          setFormState,
          setFormSubmitted,
          t,
          formRef.current ?? {
            reset: () => {
              /* fallback when form not yet set */
            },
          },
          isChangingStateRef
        );
      } catch (error) {
        toast.dismiss(loadingToastId);
        toast.error(handleSubmissionError(error, mode, setError, t));
      } finally {
        setLoading(false);
      }
    },
    [setFormState, setFormSubmitted, setLoading, setError, mode, onSuccessRef]
  );

  const formCatalogueParamsWithSubmit = useMemo(
    () => ({ ...formCatalogueParams, onFormSubmit }),
    [formCatalogueParams, onFormSubmit]
  );

  const builder = useFormCatalogue<TFieldValues>(formCatalogueParamsWithSubmit);
  const { form, translations, config: formConfig } = builder;
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const working = loading || submitting;
  const activity = useFormActivity(
    mode,
    initialData as DetailRecord | undefined,
    builder.fields,
    working
  );

  const presentation =
    tableConfig.presentation ??
    formConfig.presentation ??
    tableConfig.form?.presentation ??
    tableConfig.form?.layout?.mode;
  const width =
    formConfig.width ??
    tableConfig.form?.width ??
    tableConfig.form?.layout?.width;
  const { onBusyChange } = props;
  useEffect(() => {
    onBusyChange?.(working);
  }, [working, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => {
    if (!(props.embedded && isOpen) || builder.loadingInitial) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const first = drawerContentRef.current?.querySelector<HTMLElement>(
        'input, textarea, [role="combobox"], button[type="submit"]'
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [props.embedded, isOpen, builder.loadingInitial]);

  translationsRef.current = translations;
  formRef.current = form;

  // Handle open state changes with stable dependencies and protection
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Keep the submitted row stable until the action finishes.
      if (working || isChangingStateRef.current) {
        return;
      }

      isChangingStateRef.current = true;

      if (open) {
        setFormSubmitted(false);
      }

      // Use the utility function to update the form state
      setFormState((prev) => handleFormOpenChange(open, prev));

      // Reset the flag after a brief delay
      setTimeout(() => {
        isChangingStateRef.current = false;
      }, 100);
    },
    [setFormSubmitted, setFormState, working]
  );

  // Determine if this is a standalone form (with its own button)
  const isStandaloneForm = !(children || isOpen);

  // Keep the standalone trigger stable while opening the shared form surface.
  const handleButtonClick = useCallback(() => {
    if (!isChangingStateRef.current) {
      setFormState((prev) => handleFormOpenChange(true, prev));
    }
  }, [setFormState]);

  // If no form type is provided, don't render anything
  if (!formType) {
    return children || null;
  }

  const trigger = isStandaloneForm ? (
    <Button
      onClick={handleButtonClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {mode === "update" ? (
        <>
          <PencilIcon className="mr-2 h-4 w-4" />
          <span>{translations.update || "Edit"}</span>
        </>
      ) : (
        <>
          <PlusIcon className="mr-2 h-4 w-4" />
          <span>{translations.create || "Create"}</span>
        </>
      )}
    </Button>
  ) : (
    children
  );

  const configuredTitle = resolveFormTitle(formConfig, mode, initialData);
  const formTitle =
    configuredTitle ??
    (mode === "update"
      ? (translations["updateForm.title"] ?? "Edit")
      : (translations["createForm.title"] ?? "Create"));
  const formDescription =
    formConfig.description ??
    (mode === "update"
      ? translations["updateForm.description"]
      : translations["createForm.description"]);

  const formBody = (
    <CatalogueFormBody
      activity={activity}
      builder={builder}
      drawerContentRef={drawerContentRef}
      formDescription={formDescription}
      formTitle={formTitle}
      loading={working}
      mode={mode}
      onClose={() => handleOpenChange(false)}
    />
  );

  return (
    <>
      {trigger}
      <RecordSurface
        busy={working || Boolean(activity?.pending)}
        embedded={props.embedded}
        onClose={() => handleOpenChange(false)}
        open={isOpen}
        presentation={presentation}
        title={formTitle}
        width={width}
      >
        {formBody}
      </RecordSurface>
    </>
  );
}

interface FormActivity {
  count: number;
  labels: DetailLabels;
  pending: boolean;
  timeline: ReactNode;
}

/** An edited record shows its activity next to its fields when the host keeps one (record details' activity or history). */
function useFormActivity<TFieldValues extends FieldValues>(
  mode: "create" | "update",
  row: DetailRecord | undefined,
  fields: AnyFieldDefinition<TFieldValues>[],
  disabled: boolean
): FormActivity | undefined {
  const table = useContext(RecordActivityContext);
  const locale = useLocale();
  const setFormState = useSetAtom(catalogueFormAtom);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState<{
    rows: DetailRecord[];
    row: DetailRecord;
  }>();
  const rows = table?.rows;
  const getRowId = table?.getRowId;
  // An undo changed the record: the fields reload from it once the table shows its refreshed rows.
  useEffect(() => {
    if (!(reload && rows) || rows === reload.rows) {
      return;
    }
    setReload(undefined);
    const idOf = (item: DetailRecord) => getRowId?.(item) ?? String(item.id);
    const fresh = rows.find((item) => idOf(item) === idOf(reload.row));
    setFormState((prev) =>
      prev.initialData === reload.row
        ? { ...prev, initialData: { ...(fresh ?? reload.row) } }
        : prev
    );
  }, [getRowId, reload, rows, setFormState]);
  const config =
    mode === "update" && (table?.details?.activity || table?.details?.history)
      ? table.details
      : undefined;
  if (!(config && table && row)) {
    return;
  }
  const labels = detailLabels(locale, config.labels);
  const activity = detailActivity(config, row);
  const reverted = async () => {
    setReload({ rows: table.rows, row });
    try {
      await table.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return {
    count: activity.length,
    labels,
    pending,
    timeline: (
      <RecordActivity
        activity={activity}
        config={config}
        disabled={disabled}
        fields={fields.map((field) => ({
          id: String(field.name),
          label: field.label,
          type: field.type as DetailType,
          options:
            "options" in field && Array.isArray(field.options)
              ? field.options
              : undefined,
        }))}
        labels={labels}
        locale={locale}
        onPendingChange={setPending}
        onRevertActivity={table.onRevertActivity}
        onReverted={reverted}
        row={row}
      />
    ),
  };
}

/** The edit form's fields and the record's activity, in the record details' tabs; the fields alone without an activity. */
function FormActivityTabs({
  activity,
  children,
}: {
  activity?: FormActivity;
  children: ReactNode;
}) {
  if (!activity) {
    return children;
  }
  return (
    <Tabs.Root
      className="yayaw-detail yayaw-detail-tabs yayaw-record-content"
      defaultValue="details"
    >
      <Tabs.List
        aria-label={activity.labels.record}
        className="yayaw-detail-tablist"
      >
        <Tabs.Tab value="details">{activity.labels.details}</Tabs.Tab>
        <Tabs.Tab value="activity">
          <History aria-hidden="true" size={15} />
          {activity.labels.activity}
          <span className="yayaw-detail-count">{activity.count}</span>
        </Tabs.Tab>
      </Tabs.List>
      {/* The fields stay mounted on the activity tab: a draft survives switching tabs. */}
      <Tabs.Panel className="yayaw-record-content" keepMounted value="details">
        {children}
      </Tabs.Panel>
      <Tabs.Panel
        className="yayaw-detail-body yayaw-record-body"
        keepMounted
        value="activity"
      >
        {activity.timeline}
      </Tabs.Panel>
    </Tabs.Root>
  );
}

function CatalogueFormBody<TFieldValues extends FieldValues>({
  activity,
  builder,
  mode,
  formTitle,
  formDescription,
  loading,
  drawerContentRef,
  onClose,
}: {
  activity?: FormActivity;
  builder: ReturnType<typeof useFormCatalogue<TFieldValues>>;
  mode: "create" | "update";
  formTitle: string;
  formDescription?: string;
  loading: boolean;
  drawerContentRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const {
    fields,
    form,
    sections,
    translations,
    config,
    context,
    loadingInitial,
    loadError,
    retryInitial,
  } = builder;
  const disabled = loading || loadingInitial || Boolean(loadError);
  return (
    <DrawerFormPortalContainerContext.Provider value={drawerContentRef}>
      <div className="yayaw-record-content" ref={drawerContentRef}>
        <RecordSurfaceHeader
          busy={loading || Boolean(activity?.pending)}
          closeLabel={translations.close ?? "Close"}
          description={formDescription}
          onClose={onClose}
          title={formTitle}
        />
        <FormActivityTabs activity={activity}>
          <div className="yayaw-record-body">
            {loadingInitial && (
              <output>{translations.loading ?? "Loading…"}</output>
            )}
            {loadError && (
              <div role="alert">
                {loadError}{" "}
                <Button onClick={retryInitial} type="button">
                  {translations.retry ?? "Retry"}
                </Button>
              </div>
            )}
            <fieldset disabled={disabled}>
              <FormBuilder
                blocks={builder.blocks}
                context={context}
                disabled={disabled}
                fields={fields}
                form={form}
                isSubmitting={loading}
                sections={sections}
                submitText={null}
              />
            </fieldset>
          </div>
          <footer className="yayaw-record-footer">
            <Button
              disabled={loading}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {config.cancelLabel ?? translations.cancel}
            </Button>
            <Button
              disabled={disabled}
              onClick={async () => {
                await form.handleSubmit();
              }}
              type="button"
            >
              {config.submitLabel ??
                (mode === "update" ? translations.update : translations.submit)}
            </Button>
          </footer>
        </FormActivityTabs>
      </div>
    </DrawerFormPortalContainerContext.Provider>
  );
}

function resolveFormTitle<T extends FieldValues>(
  config: FormConfig<T>,
  mode: "create" | "update",
  row?: FieldValues
) {
  return typeof config.title === "function"
    ? config.title(mode === "update" ? "edit" : "create", row)
    : config.title;
}
