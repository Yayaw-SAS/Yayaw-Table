/**
 * CatalogueFormContainer component
 * This component renders the CatalogueForm and listens to the catalogueFormAtom
 * It will automatically show/hide the form based on the atom state
 */
"use client"

import { useAtomValue } from "jotai"
import dynamic from "next/dynamic"

import { catalogueFormAtom } from "./atoms/catalogue-form-atoms"

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
    // Get the form state from the atom (read-only to prevent conflicts)
    const formState = useAtomValue(catalogueFormAtom)

    // Extract the necessary values from the form state
    const { formType, initialData, mode, onSuccess, tableId } = formState

    // If no form type is provided, don't render anything
    if (!formType) {
        return null
    }

    // Render the CatalogueForm with the values from the atom
    // Let CatalogueForm handle all state management internally
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
