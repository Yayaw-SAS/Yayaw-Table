/**
 * Catalogue form component
 * This component renders a form based on a form configuration from the catalogue
 */
"use client"

// Debug flag to control logging
const DEBUG = false

import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { useAtom } from "jotai"
import { PencilIcon, PlusIcon } from "lucide-react"
import { type ReactNode, useEffect, useState, useCallback, useMemo } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

import {
    catalogueFormAtom,
    formSubmittedAtom,
    handleFormOpenChange
} from "./atoms/catalogue-form-atoms"
import { FormBuilder } from "./form-builder"
import { useFormCatalogue } from "./hooks/use-form-catalogue"

interface CatalogueFormProps<TFieldValues extends FieldValues = FieldValues> {
    /**
     * Children to render as the trigger
     * If provided, will be used instead of the default button
     */
    children?: ReactNode

    /**
     * Type of form to use (corresponds to a key in the form catalogue)
     */
    formType?: string

    /**
     * Initial data for the form (used for update operations)
     */
    initialData?: Partial<TFieldValues>

    /**
     * Mode of the form (create or update)
     */
    mode?: "create" | "update"

    /**
     * Callback when the form is submitted successfully
     */
    onSuccess?: (data: unknown) => void

    /**
     * Table ID associated with the form
     */
    tableId?: string
}

export function CatalogueForm<TFieldValues extends FieldValues>({
    children,
    formType: propFormType,
    initialData: propInitialData,
    mode: propMode = "create",
    onSuccess: propOnSuccess,
    tableId: propTableId
}: CatalogueFormProps<TFieldValues>) {
    // Get form state from atom
    const [formState, setFormState] = useAtom(catalogueFormAtom)
    // Add loading and error states
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Extract values from form state
    const {
        formType: atomFormType,
        initialData: atomInitialData,
        isOpen,
        mode: atomMode = "create",
        onSuccess: atomOnSuccess,
        tableId: atomTableId
    } = formState

    // Determine which values to use (props take precedence over atom)
    const formType = propFormType || atomFormType
    const initialData = propInitialData || atomInitialData
    const mode = propMode || atomMode
    const onSuccess = propOnSuccess || atomOnSuccess
    const tableId = propTableId || atomTableId

    // Stabilize the parameters for useFormCatalogue to prevent unnecessary re-renders
    const formCatalogueParams = useMemo(() => ({
        formType: formType || "",
        initialData: initialData as Partial<TFieldValues>,
        mode
    }), [formType, initialData, mode])

    // Get the form from the catalogue
    const { fields, form, handleSubmit, translations } = useFormCatalogue<TFieldValues>(formCatalogueParams)

    // Use Jotai atom to track form submission state
    // This prevents showing success notifications except after actual form submission
    // Using an atom instead of useRef ensures the state persists across component remounts
    const [formSubmitted, setFormSubmitted] = useAtom(formSubmittedAtom)

    // If no form type is provided, don't render anything
    if (!formType) {
        return children || null
    }

    // Handle form submission
    const onSubmit = useCallback(async (values: TFieldValues) => {
        // Set the flag to indicate a form has been submitted
        setFormSubmitted(true)
        setLoading(true)
        setError(null)

        // Show loading toast
        const loadingToastId = toast.loading(
            mode === "update"
                ? translations.updating || "Updating..."
                : translations.creating || "Creating..."
        )

        try {
            // For create mode, submit the form values directly
            // For update mode, submit only the values that have changed
            const valuesToSubmit =
                mode === "update"
                    ? { ...(initialData as TFieldValues), ...getChangedValues(form) }
                    : values

            // Submit the form
            const result = await handleSubmit(valuesToSubmit as TFieldValues)

            // Dismiss the loading toast
            toast.dismiss(loadingToastId)

            // Show success toast with appropriate message based on mode
            const successMessage =
                mode === "update"
                    ? translations.update_success || translations.success || "Updated successfully"
                    : translations.success || "Created successfully"

            // Only show success toast if a form was actually submitted
            if (formSubmitted) {
                toast.success(successMessage, {
                    duration: 3000
                })
            }

            // For update operations, update the initialData in the form state with fresh data
            if (mode === "update" && result) {
                setFormState((prev) => ({
                    ...prev,
                    initialData: result as Record<string, unknown>
                }))
            }

            // Call the success callback first to trigger cache invalidation
            if (onSuccess) {
                onSuccess(result as Record<string, unknown>)
            }

            // Reset the form
            form.reset()

            // Close the form after successful submission
            handleOpenChange(false)

        } catch (error) {
            // Dismiss the loading toast
            toast.dismiss(loadingToastId)

            // Determine error message based on mode
            const errorMessage =
                mode === "update"
                    ? translations.update_error || translations.error || "Failed to update"
                    : translations.error || "Failed to create"

            // Show error toast
            toast.error(errorMessage)
            setError(error as Error)
            console.error(`Form ${mode} error:`, error)
        } finally {
            setLoading(false)
        }
    }, [mode, translations, handleSubmit, initialData, form, formSubmitted, onSuccess, setFormState, setFormSubmitted])

    // Handle open state changes
    const handleOpenChange = useCallback((open: boolean) => {
        // Only reset the submission flag when the drawer is opened, not when it's closed
        if (open) {
            setFormSubmitted(false)
        }

        // Use the utility function to update the form state
        setFormState((prev) => {
            const newState = handleFormOpenChange(open, prev)
            return newState
        })
    }, [setFormSubmitted, setFormState])

    // Determine if this is a standalone form (with its own button)
    const isStandaloneForm = !children && !isOpen

    // Stabilize the button onClick handler
    const handleButtonClick = useCallback(() => {
        setFormState((prev) => handleFormOpenChange(true, prev))
    }, [setFormState])

    return (
        <Drawer direction="right" onOpenChange={handleOpenChange} open={isOpen}>
            <>
                {/* Only render the button if this is a standalone form or if children are provided */}
                {isStandaloneForm ? (
                    <Button
                        onClick={handleButtonClick}
                        size="sm"
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
            </>
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
                            form={form}
                            onSubmit={onSubmit}
                            submitText={null} // Completely disable the integrated submit button
                        />
                    </div>

                    <DrawerFooter className="flex-row justify-end gap-2 px-0">
                        <DrawerClose asChild>
                            <Button type="button" variant="outline">
                                {translations.cancel}
                            </Button>
                        </DrawerClose>
                        <Button onClick={form.handleSubmit(onSubmit)} type="submit" disabled={loading}>
                            {mode === "update" ? translations.update : translations.submit}
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

/**
 * Compares the current form values with initial values and returns only changed values
 * @param form - The form instance from react-hook-form
 * @returns An object containing only the values that have changed
 */
function getChangedValues<TFieldValues extends FieldValues>(
    form: UseFormReturn<TFieldValues>
): Partial<TFieldValues> {
    const currentValues = form.getValues()
    const defaultValues = (form.formState.defaultValues as TFieldValues) || {}
    const dirtyFields = form.formState.dirtyFields

    // If no fields are dirty, return empty object
    if (Object.keys(dirtyFields).length === 0) {
        return {} as Partial<TFieldValues>
    }

    // Create an object containing only changed values
    const changedValues = Object.keys(dirtyFields).reduce(
        (result, key) => {
            result[key as keyof TFieldValues] = currentValues[key as keyof TFieldValues]
            return result
        },
        {} as Partial<TFieldValues>
    )

    return changedValues
}
