"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";

type CopyTextButtonProps = Pick<
  ComponentProps<typeof Button>,
  "className" | "size" | "variant"
> & {
  copiedLabel: string;
  copyLabel: string;
  liveRegionLabel: string;
  text: string;
};

export function CopyTextButton({
  className,
  copiedLabel,
  copyLabel,
  liveRegionLabel,
  size,
  text,
  variant,
}: CopyTextButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <>
      <Button
        className={className}
        onClick={handleCopy}
        size={size}
        type="button"
        variant={variant}
      >
        {isCopied ? copiedLabel : copyLabel}
      </Button>
      <span aria-live="polite" className="sr-only">
        {isCopied ? liveRegionLabel : ""}
      </span>
    </>
  );
}
