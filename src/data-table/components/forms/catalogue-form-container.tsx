/**
 * CatalogueFormContainer component
 * This component renders the CatalogueForm and listens to the catalogueFormAtom
 * It will automatically show/hide the form based on the atom state
 */
"use client"

import { useAtom } from "jotai"
import dynamic from "next/dynamic"

import { catalogueFormAtom, handleFormOpenChange } from "./atoms/catalogue-form-atoms"

// Dynamically import the CatalogueForm component with no SSR
// This ensures it's only rendered on the client side
const CatalogueForm = dynamic(
    () => import("./catalogue-form").then((mod) => ({ default: mod.CatalogueForm })),
    {
        ssr: false
    }
)

/**
 * CatalogueFormContainer component
 * This component is responsible for rendering the CatalogueForm
 * and listening to the catalogueFormAtom
 */
export function CatalogueFormContainer() {
    // Get the form state from the atom
    const [formState, setFormState] = useAtom(catalogueFormAtom)

    // Extract the necessary values from the form state
    const { formType, initialData, isOpen, mode, onSuccess, tableId } = formState

    // Handle open state changes
    const handleOpenChange = (open: boolean) => {
        setFormState((prev) => handleFormOpenChange(open, prev))
    }

    // If no form type is provided, don't render anything
    if (!formType) {
        return null
    }

    // Render the CatalogueForm with the values from the atom
    return (
        <CatalogueForm
            formType={formType}
            initialData={initialData}
            mode={mode}
            onSuccess={onSuccess as ((data: unknown) => void) | undefined}
            tableId={tableId}
        />
    )
}
