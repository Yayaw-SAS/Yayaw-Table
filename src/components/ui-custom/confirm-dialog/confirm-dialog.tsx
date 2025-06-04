"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { useTranslations } from "next-intl"
import { useState } from "react"

export interface ConfirmDialogProps {
    /**
     * Text for the cancel button
     * @default "Cancel"
     */
    cancelText?: string
    /**
     * Text for the confirm button
     * @default "Confirm"
     */
    confirmText?: string
    /**
     * Variant for the confirm button
     * @default "default"
     */
    confirmVariant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary"
    /**
     * Description/message of the confirmation dialog
     */
    description: string
    /**
     * Function to call when the cancel button is clicked
     * @default () => onOpenChange(false)
     */
    onCancel?: () => void
    /**
     * Function to call when the confirm button is clicked
     */
    onConfirm: () => Promise<void> | void
    /**
     * Function to call when dialog should close
     */
    onOpenChange: (open: boolean) => void
    /**
     * Is the dialog open
     */
    open: boolean
    /**
     * Title of the confirmation dialog
     */
    title: string
}

/**
 * A reusable confirmation dialog component based on AlertDialog
 */
export function ConfirmDialog({
    cancelText,
    confirmText,
    confirmVariant = "default",
    description,
    onCancel,
    onConfirm,
    onOpenChange,
    open,
    title
}: ConfirmDialogProps) {
    const t = useTranslations("common")
    const [isLoading, setIsLoading] = useState(false)

    // Default texts
    const defaultConfirmText = t("confirm")
    const defaultCancelText = t("cancel")

    // Handle confirm action
    const handleConfirm = async () => {
        try {
            setIsLoading(true)
            await onConfirm()
        } catch (error) {
            console.error("Error in confirmation action:", error)
        } finally {
            setIsLoading(false)
            onOpenChange(false)
        }
    }

    // Handle cancel action
    const handleCancel = () => {
        if (onCancel) {
            onCancel()
        }
        onOpenChange(false)
    }

    return (
        <AlertDialog onOpenChange={onOpenChange} open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading} onClick={handleCancel}>
                        {cancelText || defaultCancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className={
                            confirmVariant === "destructive"
                                ? "bg-destructive text-white hover:bg-destructive/90"
                                : ""
                        }
                        disabled={isLoading}
                        onClick={handleConfirm}
                    >
                        {isLoading ? t("loading") : confirmText || defaultConfirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
