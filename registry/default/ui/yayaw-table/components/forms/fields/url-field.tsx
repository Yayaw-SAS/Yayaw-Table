"use client";

import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, UrlFieldDefinition } from "../types";

interface UrlMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  url: string;
}

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const DEBOUNCE_MS = 600;

function useUrlMeta(url: string | undefined) {
  const [meta, setMeta] = useState<UrlMeta | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!(url && isValidUrl(url))) {
      setMeta(undefined);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    const timeoutId = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(undefined);

      fetch(`/api/url-meta?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch metadata");
          }
          return res.json() as Promise<UrlMeta>;
        })
        .then((data) => {
          if (!controller.signal.aborted) {
            setMeta(data);
            setIsLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          if (!controller.signal.aborted) {
            setError("Could not fetch preview");
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [url]);

  return { meta, isLoading, error };
}

interface UrlFieldProps<TFieldValues extends Record<string, unknown>> {
  field: UrlFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<string>;
}

export function UrlField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: UrlFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  const currentValue = fieldApi.state.value ?? "";
  const showPreview = field.showMetaPreview !== false;
  const {
    meta,
    isLoading,
    error: _metaError,
  } = useUrlMeta(
    showPreview && isValidUrl(currentValue) ? currentValue : undefined
  );

  const handleOpenUrl = useCallback(() => {
    if (currentValue && isValidUrl(currentValue)) {
      window.open(currentValue, "_blank", "noopener");
    }
  }, [currentValue]);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      <div className="relative">
        <Input
          aria-invalid={!fieldApi.state.meta.isValid}
          className="pr-9"
          disabled={field.disabled}
          name={fieldApi.name}
          onBlur={fieldApi.handleBlur}
          onChange={(e) => fieldApi.handleChange(e.target.value)}
          placeholder={
            field.placeholderKey
              ? t(field.placeholderKey)
              : (field.placeholder ?? "https://...")
          }
          type="url"
          value={currentValue}
        />
        {currentValue && isValidUrl(currentValue) && (
          <button
            className={cn(
              "absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5",
              "text-muted-foreground transition-colors hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            onClick={handleOpenUrl}
            tabIndex={0}
            title="Open URL"
            type="button"
          >
            <ExternalLink aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}

      <FieldError errors={errorMessages.map((message) => ({ message }))} />

      {showPreview && currentValue && isValidUrl(currentValue) && (
        <UrlMetaPreview isLoading={isLoading} meta={meta} url={currentValue} />
      )}
    </Field>
  );
}

function MetaImage({ alt, src }: { alt: string; src: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <div className="relative w-28 shrink-0 bg-muted">
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: og:image preview inside link */}
      {/* biome-ignore lint/performance/noImgElement: library component, no Next.js dependency */}
      {/* biome-ignore lint/correctness/useImageSize: dynamic og:image, size unknown */}
      <img
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        onError={() => setHasError(true)}
        src={src}
      />
    </div>
  );
}

function MetaFavicon({ src }: { src: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <Globe aria-hidden className="size-3.5 text-muted-foreground" />;
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: favicon preview inside link
    // biome-ignore lint/performance/noImgElement: library component, no Next.js dependency
    <img
      alt=""
      className="size-3.5"
      height={14}
      loading="lazy"
      onError={() => setHasError(true)}
      src={src}
      width={14}
    />
  );
}

function UrlMetaPreview({
  isLoading,
  meta,
  url,
}: {
  isLoading: boolean;
  meta: UrlMeta | undefined;
  url: string;
}) {
  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border p-3">
        <Loader2
          aria-hidden
          className="size-4 animate-spin text-muted-foreground"
        />
        <span className="text-muted-foreground text-sm">Loading preview…</span>
      </div>
    );
  }

  if (!meta) {
    return null;
  }

  const hasMeaningfulData = meta.title || meta.description || meta.image;
  if (!hasMeaningfulData) {
    return null;
  }

  return (
    <a
      className={cn(
        "mt-2 flex gap-3 overflow-hidden rounded-lg border border-border",
        "bg-muted/30 transition-colors hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
      href={url}
      rel="noopener"
      target="_blank"
    >
      {meta.image && <MetaImage alt={meta.title ?? ""} src={meta.image} />}
      <div className="flex min-w-0 flex-col justify-center gap-0.5 py-2.5 pr-3">
        {meta.siteName && (
          <div className="flex items-center gap-1.5">
            {meta.favicon ? (
              <MetaFavicon src={meta.favicon} />
            ) : (
              <Globe aria-hidden className="size-3.5 text-muted-foreground" />
            )}
            <span className="truncate text-muted-foreground text-xs">
              {meta.siteName}
            </span>
          </div>
        )}
        {meta.title && (
          <p className="truncate font-medium text-foreground text-sm">
            {meta.title}
          </p>
        )}
        {meta.description && (
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {meta.description}
          </p>
        )}
      </div>
    </a>
  );
}
