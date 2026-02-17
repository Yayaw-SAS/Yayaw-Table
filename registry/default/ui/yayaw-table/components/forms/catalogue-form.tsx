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
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  formSubmittedAtom,
  handleFormOpenChange,
} from "./atoms/catalogue-form-atoms";
import { DrawerFormPortalContainerContext } from "./drawer-form-portal-context";
import { FormBuilder } from "./form-builder";
import { useFormCatalogue } from "./hooks/use-form-catalogue";
import type { FieldValues } from "./types";

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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function findFirstFocusable(container: HTMLElement): HTMLElement | null {
  const el = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  return el;
}

/**
 * Prepare submission data based on mode
 */
function prepareSubmissionData<T extends FieldValues>(
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

  // Call the success callback first to trigger cache invalidation
  if (currentOnSuccess) {
    currentOnSuccess(result as Record<string, unknown>);
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
  } = formState;

  // Determine which values to use (props take precedence over atom)
  const formType = props.formType || atomFormType;
  const initialData = props.initialData || atomInitialData;
  const mode = props.mode || atomMode;
  const onSuccess = props.onSuccess || atomOnSuccess;
  const _tableId = props.tableId || atomTableId;

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
    onSuccessRef,
  } = useFormStateResolution(props);

  // Add a ref to track if we're in the middle of a state change
  const isChangingStateRef = useRef(false);

  const [, setFormSubmitted] = useAtom(formSubmittedAtom);

  const drawerContentRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const formCatalogueParams = useMemo(
    () => ({
      formType: formType || "",
      initialData: initialData as Partial<TFieldValues>,
      mode,
    }),
    [formType, initialData, mode]
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
        const valuesToSubmit = prepareSubmissionData(
          values,
          mode,
          initialData as Partial<TFieldValues> | undefined
        );
        const result = await doSubmit(valuesToSubmit as TFieldValues);
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
      initialData,
      onSuccessRef.current,
    ]
  );

  const formCatalogueParamsWithSubmit = useMemo(
    () => ({ ...formCatalogueParams, onFormSubmit }),
    [formCatalogueParams, onFormSubmit]
  );

  const { fields, form, translations } = useFormCatalogue<TFieldValues>(
    formCatalogueParamsWithSubmit
  );

  translationsRef.current = translations;
  formRef.current = form;

  // Handle open state changes with stable dependencies and protection
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Prevent rapid state changes
      if (isChangingStateRef.current) {
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
    [setFormSubmitted, setFormState]
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

  return (
    <Drawer direction="right" onOpenChange={handleOpenChange} open={isOpen}>
      {/* Only render the button if this is a standalone form or if children are provided */}
      {isStandaloneForm ? (
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
      )}

      <DrawerContent
        className="w-full sm:max-w-md"
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <DrawerFormPortalContainerContext.Provider value={drawerContentRef}>
          <div
            className="relative mx-auto w-full max-w-md overflow-visible p-6"
            ref={drawerContentRef}
          >
            <DrawerHeader className="px-0">
              <DrawerTitle>
                {mode === "update"
                  ? translations["updateForm.title"]
                  : translations["createForm.title"]}
              </DrawerTitle>
              {(mode === "update"
                ? translations["updateForm.description"]
                : translations["createForm.description"]) && (
                <DrawerDescription>
                  {mode === "update"
                    ? translations["updateForm.description"]
                    : translations["createForm.description"]}
                </DrawerDescription>
              )}
            </DrawerHeader>

            {/* Use FormBuilder without its own submit button */}
            <div className="py-4">
              <FormBuilder fields={fields} form={form} submitText={null} />
            </div>

            <DrawerFooter className="flex-row justify-end gap-2 px-0">
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  {translations.cancel}
                </Button>
              </DrawerClose>
              <Button
                disabled={loading}
                onClick={() => {
                  form.handleSubmit();
                }}
                type="button"
              >
                {mode === "update" ? translations.update : translations.submit}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerFormPortalContainerContext.Provider>
      </DrawerContent>
    </Drawer>
  );
}
