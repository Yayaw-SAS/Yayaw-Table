"use client";

import { ImageIcon } from "lucide-react";
import { createContext, useContext, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resolveImageSource } from "../../utils/image-source";
import { type AvatarShape, avatarInitials } from "../../utils/initials-avatar";
import { InitialsAvatar } from "./initials-avatar";

/** The inline editor already owns the cell's button and keyboard activation. */
export const ImageCellEditingContext = createContext(false);

interface ImageCellProps {
  alt?: string;
  /**
   * Without an image, initials of this name (with a stable color) replace
   * the image placeholder. Set by the column's `avatar` option.
   */
  avatarName?: string;
  avatarShape?: AvatarShape;
  className?: string;
  fallbackLabel?: string;
  value: unknown;
}

export function ImageCell({
  alt,
  avatarName,
  avatarShape,
  className,
  fallbackLabel,
  value,
}: ImageCellProps) {
  const editable = useContext(ImageCellEditingContext);
  const [failedSource, setFailedSource] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const resolvedSource = resolveImageSource(value);
  const source = failedSource === resolvedSource ? undefined : resolvedSource;
  const label = alt || fallbackLabel || "Image";

  // A name without letters keeps the image placeholder.
  if (!source && avatarName && avatarInitials(avatarName)) {
    return (
      <InitialsAvatar
        className={className}
        name={avatarName}
        shape={avatarShape}
        size="cell"
      />
    );
  }

  if (!source) {
    return (
      <div
        className={cn(
          "flex h-10 w-14 items-center justify-center rounded-md border bg-muted text-muted-foreground",
          className
        )}
      >
        <ImageIcon aria-hidden className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip
        onOpenChange={(open, details) => {
          if (!editable && details.reason === "trigger-press") {
            details.cancel();
            return;
          }
          setPreviewOpen(open);
        }}
        open={previewOpen}
      >
        <TooltipTrigger
          className="inline-flex rounded-md p-0 outline-offset-2 focus-visible:outline-2"
          data-image-preview-trigger=""
          onClick={
            editable
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  setPreviewOpen(true);
                }
          }
          render={editable ? <span /> : <button type="button" />}
        >
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps broken media to the non-interactive fallback. */}
          <img
            alt={label}
            className={cn(
              "h-10 w-14 rounded-md border bg-muted object-cover",
              className
            )}
            height={40}
            loading="lazy"
            onError={() => {
              setFailedSource(resolvedSource);
              setPreviewOpen(false);
            }}
            src={source}
            width={56}
          />
        </TooltipTrigger>
        <TooltipContent className="p-1" data-image-preview="" side="right">
          <img
            alt={label}
            className="max-h-64 max-w-[min(18rem,80vw)] rounded-sm object-contain"
            height={256}
            src={source}
            width={288}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
