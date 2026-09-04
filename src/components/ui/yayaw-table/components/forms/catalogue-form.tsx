/**
 * Catalogue form component
 * This component renders a form based on a form configuration from the catalogue
 */
"use client";

// Debug flag to control logging
const _DEBUG = false;

import { useAtom } from "jotai";
import { PencilIcon, PlusIcon } from "lucide-react";
import type React from "react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/drawer";
import { useTableConfig } from "../../hooks/use-table-config";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  formSubmittedAtom,
  handleFormOpenChange,
} from "./atoms/catalogue-form-atoms";
import { resolveCatalogueFormLayout } from "./catalogue-form-layout";
import { DrawerFormPortalContainerContext } from "./drawer-form-portal-context";
import { FormBuilder } from "./form-builder";
import { useFormCatalogue } from "./hooks/use-form-catalogue";
import type { FieldValues, FormConfig } from "./types";

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

type CatalogueFormContentStyle = CSSProperties & {
  "--catalogue-form-width": string;
};

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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function findFirstFocusable(container: HTMLElement): HTMLElement | null {
  const el = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  return el;
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

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
    [
      setFormState,
      setFormSubmitted,
      setLoading,
      setError,
      mode,
      onSuccessRef,
    ]
  );

  const formCatalogueParamsWithSubmit = useMemo(
    () => ({ ...formCatalogueParams, onFormSubmit }),
    [formCatalogueParams, onFormSubmit]
  );

  const builder = useFormCatalogue<TFieldValues>(formCatalogueParamsWithSubmit);
  const { form, translations, config: formConfig } = builder;

  const formLayout = resolveCatalogueFormLayout({
    ...tableConfig.form?.layout,
    ...(formConfig.presentation ? { mode: formConfig.presentation } : {}),
    ...(formConfig.width ? { width: formConfig.width } : {}),
  });
  const isModalLayout = formLayout.mode === "modal";
  const formContentStyle = useMemo<CatalogueFormContentStyle>(
    () => ({ "--catalogue-form-width": formLayout.width }),
    [formLayout.width]
  );

  translationsRef.current = translations;
  formRef.current = form;

  // Handle open state changes with stable dependencies and protection
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Keep the submitted row stable until the action finishes.
      if (loading || isChangingStateRef.current) {
        return;
      }

      isChangingStateRef.current = true;

      if (open) {
        setFormSubmitted(false);
        previousActiveElementRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }

      // Use the utility function to update the form state
      setFormState((prev) => handleFormOpenChange(open, prev));

      // Reset the flag after a brief delay
      setTimeout(() => {
        isChangingStateRef.current = false;
      }, 100);
    },
    [setFormSubmitted, setFormState, loading]
  );

  // Determine if this is a standalone form (with its own button)
  const isStandaloneForm = !(children || isOpen);

  // Stabilize the button onClick handler; capture focus restore target before opening
  const handleButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isChangingStateRef.current) {
        previousActiveElementRef.current =
          e.currentTarget ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
        setFormState((prev) => handleFormOpenChange(true, prev));
      }
    },
    [setFormState]
  );

  // Use Radix Dialog's focus callbacks (Vaul uses Radix under the hood). No useEffect.
  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    // Double rAF so drawer layout (and Select/portals) is committed before focus
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const first = drawerContentRef.current
          ? findFirstFocusable(drawerContentRef.current)
          : null;
        first?.focus();
      });
    });
  }, []);

  const handleCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    const prev = previousActiveElementRef.current;
    previousActiveElementRef.current = null;
    if (prev?.isConnected) {
      prev.focus();
    }
  }, []);

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
      builder={builder}
      drawerContentRef={drawerContentRef}
      formDescription={formDescription}
      formTitle={formTitle}
      isModalLayout={isModalLayout}
      loading={loading}
      mode={mode}
      onClose={() => handleOpenChange(false)}
    />
  );

  if (isModalLayout) {
    return (
      <Dialog onOpenChange={handleOpenChange} open={isOpen}>
        {trigger}
        <DialogContent
          className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[var(--catalogue-form-width)]"
          style={formContentStyle}
        >
          {formBody}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer direction="right" onOpenChange={handleOpenChange} open={isOpen}>
      {trigger}

      <DrawerContent
        className="w-full sm:max-w-[var(--catalogue-form-width)]"
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
        style={formContentStyle}
      >
        {formBody}
      </DrawerContent>
    </Drawer>
  );
}

function CatalogueFormBody<TFieldValues extends FieldValues>({
  builder,
  mode,
  formTitle,
  formDescription,
  loading,
  drawerContentRef,
  isModalLayout,
  onClose,
}: {
  builder: ReturnType<typeof useFormCatalogue<TFieldValues>>;
  mode: "create" | "update";
  formTitle: string;
  formDescription?: string;
  loading: boolean;
  drawerContentRef: React.RefObject<HTMLDivElement | null>;
  isModalLayout: boolean;
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
  const Header = isModalLayout ? DialogHeader : DrawerHeader;
  const Title = isModalLayout ? DialogTitle : DrawerTitle;
  const Description = isModalLayout ? DialogDescription : DrawerDescription;
  const Footer = isModalLayout ? DialogFooter : DrawerFooter;
  const disabled = loading || loadingInitial || Boolean(loadError);
  return (
    <DrawerFormPortalContainerContext.Provider value={drawerContentRef}>
      <div
        className="relative mx-auto w-full overflow-visible p-6"
        ref={drawerContentRef}
      >
        <Header className="px-0 pr-10">
          <Title>{formTitle}</Title>
          {formDescription && <Description>{formDescription}</Description>}
        </Header>
        <div className="py-4">
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
              context={context}
              fields={fields}
              form={form}
              sections={sections}
              submitText={null}
            />
          </fieldset>
        </div>
        <Footer className="flex-row justify-end gap-2 px-0">
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
        </Footer>
      </div>
    </DrawerFormPortalContainerContext.Provider>
  );
}

function resolveFormTitle<T extends FieldValues>(config: FormConfig<T>, mode: "create" | "update", row?: FieldValues) {
  return typeof config.title === "function" ? config.title(mode === "update" ? "edit" : "create", row) : config.title;
}
