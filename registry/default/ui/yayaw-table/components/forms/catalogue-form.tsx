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
import type {
  FieldValues,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
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
import { FormBuilder } from "./form-builder";
import { useFormCatalogue } from "./hooks/use-form-catalogue";

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
 * Prepare submission data based on mode
 */
function prepareSubmissionData<T extends FieldValues>(
  values: T,
  mode: "create" | "update",
  initialData: T | undefined,
  form: UseFormReturn<T>
): T {
  if (mode === "update") {
    return {
      ...(initialData as T),
      ...getChangedValues(form),
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
  formSubmitted: boolean,
  form: UseFormReturn<TFieldValues>,
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

  // Only show success toast if a form was actually submitted
  if (formSubmitted) {
    toast.success(successMessage, {
      duration: 3000,
    });
  }

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

  // Stabilize the parameters for useFormCatalogue to prevent unnecessary re-renders
  const formCatalogueParams = useMemo(
    () => ({
      formType: formType || "",
      initialData: initialData as Partial<TFieldValues>,
      mode,
    }),
    [formType, initialData, mode]
  );

  // Get the form from the catalogue
  const { fields, form, handleSubmit, translations } =
    useFormCatalogue<TFieldValues>(formCatalogueParams);

  // Use Jotai atom to track form submission state
  // This prevents showing success notifications except after actual form submission
  // Using an atom instead of useRef ensures the state persists across component remounts
  const [formSubmitted, setFormSubmitted] = useAtom(formSubmittedAtom);

  // Handle form submission with stable dependencies
  const onSubmit = useCallback(
    async (values: TFieldValues) => {
      // Set the flag to indicate a form has been submitted
      setFormSubmitted(true);
      setLoading(true);
      setError(null);

      const currentMode = mode;
      const currentInitialData = initialData;
      const currentOnSuccess = onSuccessRef.current;

      // Show loading toast
      const loadingToastId = toast.loading(
        currentMode === "update"
          ? translations.updating || "Updating..."
          : translations.creating || "Creating..."
      );

      try {
        // Prepare submission data based on mode
        const valuesToSubmit = prepareSubmissionData(
          values,
          currentMode,
          currentInitialData,
          form as UseFormReturn<Record<string, unknown>>
        );

        // Submit the form
        const result = await handleSubmit(valuesToSubmit as TFieldValues);

        // Dismiss the loading toast
        toast.dismiss(loadingToastId);

        // Handle success flow
        handleSuccessFlow(
          result,
          currentMode,
          currentOnSuccess as ((resultParam: unknown) => void) | undefined,
          setFormState,
          setFormSubmitted,
          translations,
          formSubmitted,
          form as unknown as UseFormReturn<TFieldValues>,
          isChangingStateRef
        );
      } catch (error) {
        // Dismiss the loading toast
        toast.dismiss(loadingToastId);

        // Handle error using helper
        const errorMessage = handleSubmissionError(
          error,
          currentMode,
          setError,
          translations
        );

        // Show error toast
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [
      handleSubmit,
      translations,
      form,
      formSubmitted,
      setFormState,
      setFormSubmitted,
      setLoading,
      setError,
      mode,
      initialData,
      onSuccessRef,
    ]
  );

  // Handle open state changes with stable dependencies and protection
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Prevent rapid state changes
      if (isChangingStateRef.current) {
        return;
      }

      isChangingStateRef.current = true;

      // Only reset the submission flag when the drawer is opened, not when it's closed
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
    [setFormSubmitted, setFormState]
  );

  // Determine if this is a standalone form (with its own button)
  const isStandaloneForm = !(children || isOpen);

  // Stabilize the button onClick handler
  const handleButtonClick = useCallback(() => {
    if (!isChangingStateRef.current) {
      setFormState((prev) => handleFormOpenChange(true, prev));
    }
  }, [setFormState]);

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

      <DrawerContent className="w-full sm:max-w-md">
        <div className="mx-auto w-full max-w-md p-6">
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
            <FormBuilder
              fields={fields}
              form={form as unknown as UseFormReturn<TFieldValues>}
              onSubmit={onSubmit}
              submitText={null} // Completely disable the integrated submit button
            />
          </div>

          <DrawerFooter className="flex-row justify-end gap-2 px-0">
            <DrawerClose>
              <Button type="button" variant="outline">
                {translations.cancel}
              </Button>
            </DrawerClose>
            <Button
              disabled={loading}
              onClick={
                form.handleSubmit(
                  onSubmit as unknown as SubmitHandler<FieldValues>
                ) as (e: React.MouseEvent<HTMLButtonElement>) => void
              }
              type="submit"
            >
              {mode === "update" ? translations.update : translations.submit}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Compares the current form values with initial values and returns only changed values
 * @param form - The form instance from react-hook-form
 * @returns An object containing only the values that have changed
 */
function getChangedValues<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>
): Partial<TFieldValues> {
  const currentValues = form.getValues();
  const _defaultValues = (form.formState.defaultValues as TFieldValues) || {};
  const dirtyFields = form.formState.dirtyFields;

  // If no fields are dirty, return empty object
  if (Object.keys(dirtyFields).length === 0) {
    return {} as Partial<TFieldValues>;
  }

  // Create an object containing only changed values
  const changedValues = Object.keys(dirtyFields).reduce(
    (result, key) => {
      result[key as keyof TFieldValues] =
        currentValues[key as keyof TFieldValues];
      return result;
    },
    {} as Partial<TFieldValues>
  );

  return changedValues;
}
