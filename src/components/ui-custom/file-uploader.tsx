"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatBytes } from "@/lib"
import { FileText, Upload, X } from "lucide-react"
import Image from "next/image"
import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import Dropzone, { type DropzoneProps, type FileRejection } from "react-dropzone"
import { toast } from "sonner"
import { useTranslations } from "use-intl"

interface FileCardProps {
    file: File
    onRemove: () => void
    progress?: number
}

interface FilePreviewProps {
    file: File & { preview: string }
}

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Accepted file types for the uploader.
     * @type { [key: string]: string[]}
     * @default
     * ```ts
     * { "image/*": [] }
     * ```
     * @example accept={["image/png", "image/jpeg"]}
     */
    accept?: DropzoneProps["accept"]

    /**
     * Whether the uploader is disabled.
     * @type boolean
     * @default false
     * @example disabled
     */
    disabled?: boolean

    /**
     * Maximum number of files for the uploader.
     * @type number | undefined
     * @default 1
     * @example maxFileCount={4}
     */
    maxFileCount?: DropzoneProps["maxFiles"]

    /**
     * Maximum file size for the uploader.
     * @type number | undefined
     * @default 1024 * 1024 * 2 // 2MB
     * @example maxSize={1024 * 1024 * 2} // 2MB
     */
    maxSize?: DropzoneProps["maxSize"]

    /**
     * Whether the uploader should accept multiple files.
     * @type boolean
     * @default false
     * @example multiple
     */
    multiple?: boolean

    /**
     * Function to be called when files are uploaded.
     * @type (files: File[]) => Promise<void>
     * @default undefined
     * @example onUpload={(files) => uploadFiles(files)}
     */
    onUpload?: (files: File[]) => Promise<void>

    /**
     * Function to be called when the value changes.
     * @type (files: File[]) => void
     * @default undefined
     * @example onValueChange={(files) => setFiles(files)}
     */
    onValueChange?: (files: File[]) => void

    /**
     * Progress of the uploaded files.
     * @type Record<string, number> | undefined
     * @default undefined
     * @example progresses={{ "file1.png": 50 }}
     */
    progresses?: Record<string, number>

    /**
     * Value of the uploader.
     * @type File[]
     * @default undefined
     * @example value={files}
     */
    value?: File[]
}

export function FileUploader(props: FileUploaderProps) {
    const t = useTranslations("common.uploader")
    const {
        accept = {
            "image/*": []
        },
        className,
        disabled = false,
        maxFileCount = 1,
        maxSize = 1024 * 1024 * 2,
        multiple = false,
        onUpload,
        onValueChange,
        progresses,
        value: valueProp,
        ...dropzoneProps
    } = props

    const [files, setFiles] = useState<File[]>(valueProp || [])

    // Synchroniser avec valueProp quand il change
    useEffect(() => {
        if (valueProp) {
            setFiles(valueProp)
        }
    }, [valueProp])

    // Notifier les changements
    const updateFiles = useCallback(
        (newFiles: File[]) => {
            setFiles(newFiles)
            onValueChange?.(newFiles)
        },
        [onValueChange]
    )

    const onDrop = React.useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
                toast.error("Cannot upload more than 1 file at a time")
                return
            }

            if ((files?.length ?? 0) + acceptedFiles.length > maxFileCount) {
                toast.error(`Cannot upload more than ${maxFileCount} files`)
                return
            }

            const newFiles = acceptedFiles.map((file) =>
                Object.assign(file, {
                    preview: URL.createObjectURL(file)
                })
            )

            const updatedFiles = files ? [...files, ...newFiles] : newFiles

            updateFiles(updatedFiles)

            if (rejectedFiles.length > 0) {
                for (const { file } of rejectedFiles) {
                    toast.error(`File ${file.name} was rejected`)
                }
            }

            if (onUpload && updatedFiles.length > 0 && updatedFiles.length <= maxFileCount) {
                const target = updatedFiles.length > 0 ? `${updatedFiles.length} files` : "file"

                toast.promise(onUpload(updatedFiles), {
                    error: `Failed to upload ${target}`,
                    loading: `Uploading ${target}...`,
                    success: () => {
                        updateFiles([])
                        return `${target} uploaded`
                    }
                })
            }
        },

        [files, maxFileCount, multiple, onUpload, updateFiles]
    )

    function onRemove(index: number) {
        if (!files) return
        const newFiles = files.filter((_, i) => i !== index)
        updateFiles(newFiles)
    }

    // Revoke preview url when component unmounts
    React.useEffect(() => {
        return () => {
            if (!files) return
            for (const file of files) {
                if (isFileWithPreview(file)) {
                    URL.revokeObjectURL(file.preview)
                }
            }
        }
    }, [files])

    const isDisabled = disabled || (files?.length ?? 0) >= maxFileCount

    return (
        <div className="relative flex flex-col gap-6 overflow-hidden">
            <Dropzone
                accept={accept}
                disabled={isDisabled}
                maxFiles={maxFileCount}
                maxSize={maxSize}
                multiple={maxFileCount > 1 || multiple}
                onDrop={onDrop}
            >
                {({ getInputProps, getRootProps, isDragActive }) => (
                    <div
                        {...getRootProps()}
                        className={cn(
                            "group relative grid h-52 w-full cursor-pointer place-items-center rounded-lg border-2 border-muted-foreground/25 border-dashed px-5 py-2.5 text-center transition hover:bg-muted/25",
                            "ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isDragActive && "border-muted-foreground/50",
                            isDisabled && "pointer-events-none opacity-60",
                            className
                        )}
                        {...dropzoneProps}
                    >
                        <input {...getInputProps()} />
                        {isDragActive ? (
                            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                                <div className="rounded-full border border-dashed p-3">
                                    <Upload
                                        aria-hidden="true"
                                        className="size-7 text-muted-foreground"
                                    />
                                </div>
                                <p className="font-medium text-muted-foreground">
                                    {t("drag_active")}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                                <div className="rounded-full border border-dashed p-3">
                                    <Upload
                                        aria-hidden="true"
                                        className="size-7 text-muted-foreground"
                                    />
                                </div>
                                <div className="flex flex-col gap-px">
                                    <p className="font-medium text-muted-foreground">
                                        {t("drag_message")}
                                    </p>
                                    <p className="text-muted-foreground/70 text-sm">
                                        {t(
                                            maxFileCount > 1
                                                ? maxFileCount === Number.POSITIVE_INFINITY
                                                    ? "file_size_multiple_infinite"
                                                    : "file_size_multiple"
                                                : "file_size_single",
                                            {
                                                count: maxFileCount,
                                                size: formatBytes(maxSize)
                                            }
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dropzone>
            {files?.length ? (
                <ScrollArea className="h-fit w-full px-3">
                    <div className="flex max-h-48 flex-col gap-4">
                        {files?.map((file, index) => (
                            <FileCard
                                file={file}
                                key={index}
                                onRemove={() => onRemove(index)}
                                progress={progresses?.[file.name]}
                            />
                        ))}
                    </div>
                </ScrollArea>
            ) : null}
        </div>
    )
}

function FileCard({ file, onRemove, progress }: FileCardProps) {
    return (
        <div className="relative flex items-center gap-2.5">
            <div className="flex flex-1 gap-2.5">
                {isFileWithPreview(file) ? <FilePreview file={file} /> : null}
                <div className="flex w-full flex-col gap-2">
                    <div className="flex flex-col gap-px">
                        <p className="line-clamp-1 font-medium text-foreground/80 text-sm">
                            {file.name}
                        </p>
                        <p className="text-muted-foreground text-xs">{formatBytes(file.size)}</p>
                    </div>
                    {progress ? <Progress value={progress} /> : null}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    className="size-7"
                    onClick={onRemove}
                    size="icon"
                    type="button"
                    variant="outline"
                >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">Remove file</span>
                </Button>
            </div>
        </div>
    )
}

function FilePreview({ file }: FilePreviewProps) {
    if (file.type.startsWith("image/")) {
        return (
            <Image
                alt={file.name}
                className="aspect-square shrink-0 rounded-md object-cover"
                height={48}
                loading="lazy"
                src={file.preview}
                width={48}
            />
        )
    }

    return <FileText aria-hidden="true" className="size-10 text-muted-foreground" />
}

function isFileWithPreview(file: File): file is File & { preview: string } {
    return "preview" in file && typeof file.preview === "string"
}
