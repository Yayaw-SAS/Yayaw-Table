"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/src/components/ui/button";
import { useTranslations } from "../../providers/table-provider";
import {
  formActionFlag,
  formBlockId,
  formBlockSpan,
} from "../../utils/form-layout";
import type { FormAction, FormBlock, FormBlockContext } from "./types";

function createActionContext(
  context: FormBlockContext,
  getLatest: () => FormBlockContext,
  signal: AbortSignal
): FormBlockContext {
  return {
    ...context,
    get values() {
      return getLatest().values;
    },
    setFieldValue: (name, value) => {
      if (!signal.aborted && !getLatest().disabled) {
        getLatest().setFieldValue(name, value);
      }
    },
    submit: async () => {
      if (!signal.aborted && !getLatest().disabled) {
        await getLatest().submit();
      }
    },
  };
}

function FormActionButton({
  action,
  context,
}: {
  action: FormAction;
  context: FormBlockContext;
}) {
  const { t } = useTranslations();
  const request = useRef<AbortController | null>(null);
  const latest = useRef(context);
  latest.current = context;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const hidden = formActionFlag(action.hidden, context);
  const disabled = context.disabled || formActionFlag(action.disabled, context);

  useEffect(() => {
    if (disabled || hidden) {
      request.current?.abort();
      request.current = null;
      setPending(false);
    }
  }, [disabled, hidden]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Record identity invalidates the pending action.
  useEffect(() => {
    // A different record must not receive results from a previous form action.
    request.current?.abort();
    request.current = null;
    setPending(false);
    setError(undefined);
    return () => request.current?.abort();
  }, [context.row, context.formType, context.mode]);

  const run = async () => {
    if (disabled || hidden || request.current) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(undefined);
    const liveContext = createActionContext(
      context,
      () => latest.current,
      controller.signal
    );
    try {
      if (action.validate && !(await liveContext.validate())) {
        return;
      }
      if (!controller.signal.aborted) {
        await action.onClick(liveContext, controller.signal);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  };

  if (hidden) {
    return null;
  }
  return (
    <div className="space-y-1">
      <Button
        aria-busy={pending}
        disabled={disabled || pending}
        onClick={run}
        type="button"
        variant={action.variant ?? "outline"}
      >
        {action.labelKey ? t(action.labelKey) : action.label}
      </Button>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function FormBlockContent({
  block,
  context,
  renderField,
}: {
  block: FormBlock;
  context: FormBlockContext;
  renderField: (name: string) => ReactNode;
}) {
  const { t } = useTranslations();
  switch (block.type) {
    case "field":
      return renderField(block.name);
    case "section":
      return (
        <section className="space-y-4 rounded-md border p-4">
          {(block.title || block.titleKey) && (
            <h3 className="font-medium text-sm">
              {block.titleKey ? t(block.titleKey) : block.title}
            </h3>
          )}
          {(block.description || block.descriptionKey) && (
            <p className="text-muted-foreground text-sm">
              {block.descriptionKey
                ? t(block.descriptionKey)
                : block.description}
            </p>
          )}
          <FormBlocks
            blocks={block.blocks}
            columns={block.columns}
            context={context}
            renderField={renderField}
          />
        </section>
      );
    case "content":
      return (
        <div
          className={
            block.tone === "warning"
              ? "space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              : "space-y-1 rounded-md border bg-muted/50 p-3 text-sm"
          }
          data-tone={block.tone ?? "default"}
        >
          {(block.title || block.titleKey) && (
            <h3 className="font-medium">
              {block.titleKey ? t(block.titleKey) : block.title}
            </h3>
          )}
          <p className="whitespace-pre-wrap">
            {block.textKey ? t(block.textKey) : block.text}
          </p>
        </div>
      );
    case "actions":
      return (
        <div className="flex flex-wrap items-start gap-2">
          {block.actions.map((action) => (
            <FormActionButton
              action={action}
              context={context}
              key={action.id}
            />
          ))}
        </div>
      );
    case "custom":
      return block.render?.(context);
    default:
      return null;
  }
}

export function FormBlocks({
  blocks,
  columns = 1,
  context,
  renderField,
}: {
  blocks: FormBlock[];
  columns?: 1 | 2 | 3;
  context: FormBlockContext;
  renderField: (name: string) => ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 @md/form:grid-cols-[repeat(var(--form-columns),minmax(0,1fr))]"
      data-form-columns={columns}
      style={{ "--form-columns": columns } as CSSProperties}
    >
      {blocks.map((block) => {
        const span = formBlockSpan(block.span, columns);
        return (
          <div
            className={
              span === "full"
                ? "min-w-0 @md/form:col-span-full"
                : "min-w-0 @md/form:col-span-[var(--form-span)]"
            }
            data-form-block={formBlockId(block)}
            data-form-block-type={block.type}
            key={formBlockId(block)}
            style={{ "--form-span": span } as CSSProperties}
          >
            <FormBlockContent
              block={block}
              context={context}
              renderField={renderField}
            />
          </div>
        );
      })}
    </div>
  );
}
