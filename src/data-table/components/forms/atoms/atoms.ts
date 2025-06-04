import { atom } from "jotai"

export interface TranslationConfig {
    keys: {
        cancel: string
        categories: {
            current: string
            empty: string
            newPlaceholder: string
        }
        create: string
        createForm: {
            description: string
            title: string
        }
        error: string
        errorDescription: string
        submit: string
        success: string
        successDescription: string
    }
    namespace: string
}

export const translationConfigAtom = atom<TranslationConfig>({
    keys: {
        cancel: "cancel",
        categories: {
            current: "categories.current",
            empty: "categories.empty",
            newPlaceholder: "categories.new_placeholder"
        },
        create: "create",
        createForm: {
            description: "create_form.description",
            title: "create_form.title"
        },
        error: "error",
        errorDescription: "error_description",
        submit: "submit",
        success: "success",
        successDescription: "success_description"
    },
    namespace: "common"
})
