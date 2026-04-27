"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  createPackageInstallCommands,
  createShadcnAddCommands,
  PACKAGE_MANAGERS,
  type PackageManagerCommands,
} from "@/src/lib/package-manager";
import { cn } from "@/src/lib/utils";
import { usePackageManager } from "./package-manager-provider";

interface PackageManagerTabsProps {
  className?: string;
  commands: PackageManagerCommands;
}

export function PackageManagerTabs({
  className,
  commands,
}: PackageManagerTabsProps) {
  const t = useTranslations("Common");
  const { packageManager, setPackageManager } = usePackageManager();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const command = commands[packageManager];

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = command;
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
    <div
      className={cn(
        "not-prose overflow-hidden rounded-[1.4rem] border border-border/50 bg-muted/30 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-2 border-border/60 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6.5 shrink-0 items-center justify-center rounded-[4px] bg-foreground/70 text-background">
            <Terminal className="size-3" />
          </div>

          <div
            aria-label={t("packageManager")}
            className="flex min-w-0 flex-wrap items-center gap-1.5"
            role="tablist"
          >
            {PACKAGE_MANAGERS.map((manager) => {
              const isActive = manager === packageManager;

              return (
                <button
                  aria-selected={isActive}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-xl border px-2.5 font-mono text-sm transition-colors",
                    isActive
                      ? "border-border bg-background text-foreground shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  key={manager}
                  onClick={() => {
                    setPackageManager(manager);
                  }}
                  role="tab"
                  type="button"
                >
                  {manager}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          aria-label={isCopied ? t("copied") : t("copy")}
          className="self-start text-muted-foreground hover:text-foreground sm:self-auto"
          onClick={handleCopy}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {isCopied ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
        <span aria-live="polite" className="sr-only">
          {isCopied ? t("copiedInstallCommand") : ""}
        </span>
      </div>

      <div className="overflow-x-auto px-3 py-3.5 sm:px-4" role="tabpanel">
        <pre className="min-w-0">
          <code className="font-mono text-[0.88rem] text-foreground leading-relaxed sm:text-[0.92rem]">
            {commands[packageManager]}
          </code>
        </pre>
      </div>
    </div>
  );
}

export function RegistryInstallTabs({
  className,
  target,
}: {
  className?: string;
  target: string;
}) {
  return (
    <PackageManagerTabs
      className={className}
      commands={createShadcnAddCommands(target)}
    />
  );
}

export function DependencyInstallTabs({
  className,
  packageName,
}: {
  className?: string;
  packageName: string;
}) {
  return (
    <PackageManagerTabs
      className={className}
      commands={createPackageInstallCommands(packageName)}
    />
  );
}
