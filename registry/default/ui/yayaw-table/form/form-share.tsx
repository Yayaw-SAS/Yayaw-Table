"use client";

import { Check, Copy, ExternalLink, Globe, Link2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-styles";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useIsMobile } from "../hooks/use-mobile";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "../ui-custom/stack-menu";
import {
  type FormLabelKey,
  type FormLinkActions,
  type FormLinkStatus,
  type FormTranslate,
  formLabel,
  type PublicFormSnapshot,
} from "../utils/form-view";
import { TableTooltip } from "../utils/table-tooltip";

interface FormShareProps {
  formLinks: FormLinkActions;
  viewId: string | null;
  /** The form as it would be published now. */
  snapshot: () => PublicFormSnapshot;
  locale: string;
  translate?: FormTranslate;
}

type Label = (key: FormLabelKey) => string;

const COPIED_MS = 2000;

function useLinkStatus(formLinks: FormLinkActions, viewId: string | null) {
  const [status, setStatus] = useState<FormLinkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!viewId) {
      setStatus(null);
      return;
    }
    let active = true;
    setLoading(true);
    formLinks
      .status(viewId)
      .then((next) => {
        if (active) {
          setStatus(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [formLinks, viewId]);
  return { failed, loading, setFailed, setStatus, status };
}

/** "Copy link" with a short "Link copied" confirmation. */
function useCopy(url: string | undefined) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url ?? "");
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopied(false);
    }
  };
  return { copied, copy };
}

function SwitchRow({
  checked,
  disabled,
  hint,
  icon,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  icon?: ReactNode;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      {icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <label className="font-medium text-sm" htmlFor={id} id={`${id}-label`}>
          {label}
        </label>
        {hint ? (
          <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={(next) => onChange(next)}
      />
    </div>
  );
}

function PublicLink({
  copied,
  id,
  label,
  onCopy,
  url,
}: {
  copied: boolean;
  id: string;
  label: Label;
  onCopy: () => void;
  url: string;
}) {
  const copyLabel = copied ? label("copied") : label("copy");
  return (
    <div className="grid gap-1.5">
      <label className="text-muted-foreground text-xs" htmlFor={id}>
        {label("publicLink")}
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <Input
          className="h-8 min-w-0 flex-1 text-xs md:text-xs"
          id={id}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={url}
        />
        <TableTooltip label={copyLabel}>
          <Button
            aria-label={copyLabel}
            className="shrink-0"
            onClick={onCopy}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
          </Button>
        </TableTooltip>
        <TableTooltip label={label("open")}>
          <a
            aria-label={label("open")}
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "outline" }),
              "in-data-[vaul-drawer-direction]:size-11 shrink-0"
            )}
            href={url}
            rel="noopener"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </TableTooltip>
      </div>
    </div>
  );
}

function PublishedControls({
  accepting,
  busy,
  canClose,
  copied,
  id,
  label,
  onAccepting,
  onCopy,
  onRepublish,
  url,
}: {
  accepting: boolean;
  busy: boolean;
  canClose: boolean;
  copied: boolean;
  id: string;
  label: Label;
  onAccepting: (accepting: boolean) => void;
  onCopy: () => void;
  onRepublish: () => void;
  url: string;
}) {
  return (
    <>
      <PublicLink
        copied={copied}
        id={`${id}-url`}
        label={label}
        onCopy={onCopy}
        url={url}
      />
      {canClose ? (
        <SwitchRow
          checked={accepting}
          disabled={busy}
          id={`${id}-accept`}
          label={label("acceptResponses")}
          onChange={onAccepting}
        />
      ) : null}
      <div className="grid gap-1.5 border-t pt-3">
        <Button
          aria-describedby={`${id}-republish-hint`}
          className="w-full"
          disabled={busy}
          onClick={onRepublish}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("republish")}
        </Button>
        <p
          className="text-muted-foreground text-xs"
          id={`${id}-republish-hint`}
        >
          {label("republishHint")}
        </p>
      </div>
    </>
  );
}

/**
 * "Share form": a button of the form's header bar opening the publishing
 * controls (a drawer on phones, like the Data menu). Republishing is explicit:
 * edits reach the link with "Update public form", so unsaved experiments
 * never go live by accident.
 */
export function FormShare({
  formLinks,
  locale,
  snapshot,
  translate,
  viewId,
}: FormShareProps) {
  const id = useId();
  const compact = useIsMobile();
  const label: Label = (key) => formLabel(key, locale, translate);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { failed, loading, setFailed, setStatus, status } = useLinkStatus(
    formLinks,
    viewId
  );
  const url = status?.published ? status.url : undefined;
  const accepting = status?.acceptsResponses !== false;
  const { copied, copy } = useCopy(url);

  const run = async (task: () => Promise<FormLinkStatus | null>) => {
    setBusy(true);
    try {
      setStatus(await task());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const publish = (target: string) =>
    run(async () => {
      const result = await formLinks.publish(target, {
        ...snapshot(),
        viewId: target,
      });
      return {
        acceptsResponses: accepting,
        ...status,
        published: true,
        url: result.url,
      };
    });
  const unpublish = (target: string) =>
    run(async () => {
      await formLinks.unpublish(target);
      return { published: false };
    });
  const setAccepting = (target: string, next: boolean) =>
    run(async () => {
      await formLinks.setAcceptingResponses?.(target, next);
      return { published: true, ...status, acceptsResponses: next };
    });

  const panel = viewId ? (
    <>
      <SwitchRow
        checked={Boolean(url)}
        disabled={busy || loading}
        hint={label("publishHint")}
        icon={<Globe aria-hidden="true" />}
        id={`${id}-publish`}
        label={label("publish")}
        onChange={(next) => (next ? publish(viewId) : unpublish(viewId))}
      />
      {url ? (
        <PublishedControls
          accepting={accepting}
          busy={busy}
          canClose={Boolean(formLinks.setAcceptingResponses)}
          copied={copied}
          id={id}
          label={label}
          onAccepting={(next) => setAccepting(viewId, next)}
          onCopy={copy}
          onRepublish={() => publish(viewId)}
          url={url}
        />
      ) : null}
    </>
  ) : (
    <p className="text-muted-foreground text-sm">{label("saveFirst")}</p>
  );

  return (
    <StackMenu
      align="end"
      asDropdown
      compact={compact}
      onOpenChange={setOpen}
      open={open}
      trigger={
        <Button
          className={cn("gap-2", compact && "min-h-11")}
          data-form-share
          size="sm"
          type="button"
          variant="outline"
        >
          <Link2 aria-hidden="true" className="size-4" />
          {label("share")}
        </Button>
      }
    >
      <StackMenuView name="main" title={label("share")}>
        <StackMenuContent className="grid gap-4 p-3" data-form-share-panel>
          {panel}
          {failed ? (
            <p className="text-destructive text-sm" role="alert">
              {label("shareError")}
            </p>
          ) : null}
          {copied ? (
            <output className="sr-only">{label("copied")}</output>
          ) : null}
        </StackMenuContent>
      </StackMenuView>
    </StackMenu>
  );
}
