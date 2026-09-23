"use client";

import { ExternalLink, Link2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type FormLabelKey,
  type FormLinkActions,
  type FormLinkStatus,
  type FormTranslate,
  formLabel,
  type PublicFormSnapshot,
} from "../utils/form-view";

interface FormShareProps {
  formLinks: FormLinkActions;
  viewId: string | null;
  /** The form as it would be published now. */
  snapshot: () => PublicFormSnapshot;
  locale: string;
  translate?: FormTranslate;
}

type Label = (key: FormLabelKey) => string;

const SWITCH_CLASS = "size-4 shrink-0 accent-primary";

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

function SwitchRow({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm" htmlFor={id}>
      <input
        aria-checked={checked}
        checked={checked}
        className={SWITCH_CLASS}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        role="switch"
        type="checkbox"
      />
      {label}
    </label>
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
  return (
    <div className="grid gap-1.5">
      <label className="text-sm" htmlFor={id}>
        {label("publicLink")}
      </label>
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-0 flex-1" id={id} readOnly value={url} />
        <Button onClick={onCopy} size="sm" type="button" variant="outline">
          {copied ? label("copied") : label("copy")}
        </Button>
        <a
          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
          href={url}
          rel="noopener"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          {label("open")}
        </a>
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
    <div className="grid gap-3">
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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy}
          onClick={onRepublish}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("republish")}
        </Button>
        <p className="text-muted-foreground text-sm">
          {label("republishHint")}
        </p>
      </div>
    </div>
  );
}

/**
 * "Share form": publish the view's form on a public link served by the host.
 * Republishing is explicit: edits reach the link with "Update public form",
 * so unsaved experiments never go live by accident.
 */
export function FormShare({
  formLinks,
  locale,
  snapshot,
  translate,
  viewId,
}: FormShareProps) {
  const id = useId();
  const label: Label = (key) => formLabel(key, locale, translate);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { failed, loading, setFailed, setStatus, status } = useLinkStatus(
    formLinks,
    viewId
  );
  const url = status?.published ? status.url : undefined;
  const accepting = status?.acceptsResponses !== false;

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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const panel = viewId ? (
    <>
      <SwitchRow
        checked={Boolean(url)}
        disabled={busy || loading}
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
    <section
      aria-label={label("share")}
      className="grid gap-3 rounded-lg border px-4 py-3"
      data-form-share
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          aria-controls={`${id}-panel`}
          aria-expanded={open}
          className="gap-2"
          onClick={() => setOpen((value) => !value)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Link2 aria-hidden="true" className="size-4" />
          {label("share")}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-3" id={`${id}-panel`}>
          {panel}
          {failed ? (
            <p className="text-destructive text-sm" role="alert">
              {label("shareError")}
            </p>
          ) : null}
          {copied ? (
            <output className="sr-only">{label("copied")}</output>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
