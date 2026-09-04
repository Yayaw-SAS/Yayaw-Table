"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { fieldIsDisabled, fieldIsHidden } from "./form-runtime";
import type {
  AnyFieldDefinition,
  FormConfigContext,
  FormSelectOption,
} from "./types";

const uniqueOptions = (options: FormSelectOption[]) =>
  options.filter(
    (option, index) =>
      options.findIndex((candidate) =>
        Object.is(candidate.value, option.value)
      ) === index
  );

function configuredOptions(field: AnyFieldDefinition, context: FormConfigContext) {
  return typeof field.options === "function" ? field.options(context) : field.options ?? [];
}

async function resolveRemoteOptions(
  field: AnyFieldDefinition,
  context: FormConfigContext,
  value: unknown,
  configured: FormSelectOption[],
  query: string,
  signal: AbortSignal
) {
  const selected = Array.isArray(value)
    ? value
    : [value].filter((item) => item != null && item !== "");
  const missing = selected.filter(
    (item) => !configured.some((option) => Object.is(option.value, item))
  );
  const resolved =
    missing.length && field.resolveOptions
      ? await field.resolveOptions(missing, context, signal)
      : [];
  const searched =
    field.searchOptions && query.trim().length >= (field.searchMinLength ?? 3)
      ? await field.searchOptions(query.trim(), context, signal)
      : [];
  return { selected, options: [...configured, ...resolved, ...searched] };
}

/** Resolve dynamic fields before handing them to the existing field components. */
export function RuntimeField({
  field,
  context,
  value,
  children,
}: {
  field: AnyFieldDefinition;
  context: FormConfigContext;
  value: unknown;
  children: (field: AnyFieldDefinition) => ReactNode;
}) {
  const id = useId();
  const hasRemoteOptions =
    typeof field.options === "function" ||
    Boolean(field.searchOptions || field.resolveOptions || field.createOption);
  const baseOptions = useRef<{
    key: string;
    promise: Promise<FormSelectOption[]>;
  } | null>(null);
  const hidden = fieldIsHidden(field, context);
  const disabled = fieldIsDisabled(field, context);
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const scope = JSON.stringify([
    context.tableId,
    context.formType,
    context.mode,
    context.row?.id ?? context.row?._id,
    field.name,
    field.optionsScope,
    (field.optionDependencies ?? []).map((name) => context.values?.[name]),
  ]);
  const [state, setState] = useState<{
    scope: string;
    options: FormSelectOption[];
    loading: boolean;
    error?: string;
  }>({ scope, options: [], loading: false });
  const latest = useRef({ field, context, value, scope });
  latest.current = { field, context, value, scope };
  const createRequest = useRef<AbortController | null>(null);
  const selectedKey = JSON.stringify(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scope and editability changes must cancel in-flight creation.
  useEffect(() => {
    createRequest.current?.abort();
    setCreating(false);
    setNewLabel("");
    return () => createRequest.current?.abort();
  }, [scope, hidden, disabled]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Serialized selection changes resolve labels using the latest context without reloading on unrelated edits.
  useEffect(() => {
    const request = new AbortController();
    if (!hasRemoteOptions || hidden || disabled) {
      return () => request.abort();
    }
    const load = async () => {
      const input = latest.current;
      setState((previous) => ({
        scope,
        options: previous.scope === scope ? previous.options : [],
        loading: true,
      }));
      try {
        const key = `${scope}:${retry}`;
        if (baseOptions.current?.key !== key) {
          baseOptions.current = {
            key,
            promise: Promise.resolve(configuredOptions(input.field, input.context)),
          };
        }
        const configured = await baseOptions.current.promise;
        const loaded = await resolveRemoteOptions(
          input.field,
          input.context,
          input.value,
          configured,
          query,
          request.signal
        );
        if (!request.signal.aborted) {
          setState((previous) => ({
            scope,
            loading: false,
            options: uniqueOptions([
              ...loaded.options,
              ...(previous.scope === scope
                ? previous.options.filter((option) =>
                    loaded.selected.some((item) =>
                      Object.is(item, option.value)
                    )
                  )
                : []),
            ]),
          }));
        }
      } catch (error) {
        if (!request.signal.aborted) {
          setState({
            scope,
            options: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    const timer = setTimeout(
      async () => {
        await load();
      },
      query ? (latest.current.field.searchDebounceMs ?? 250) : 0
    );
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [scope, query, selectedKey, hidden, disabled, retry, hasRemoteOptions]);

  const create = async () => {
    const input = latest.current;
    if (!(input.field.createOption && newLabel.trim()) || creating) {
      return;
    }
    const request = new AbortController();
    createRequest.current?.abort();
    createRequest.current = request;
    setCreating(true);
    try {
      const option = await input.field.createOption(
        newLabel.trim(),
        input.context,
        request.signal
      );
      if (request.signal.aborted || input.scope !== latest.current.scope) {
        return;
      }
      setState((previous) => ({
        scope,
        options: uniqueOptions([...previous.options, option]),
        loading: false,
      }));
      input.context.setFieldValue?.(
        input.field.name,
        input.field.type === "multiSelect"
          ? [...(Array.isArray(input.value) ? input.value : []), option.value]
          : option.value
      );
      setNewLabel("");
    } catch (error) {
      if (!request.signal.aborted) {
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    } finally {
      if (!request.signal.aborted) {
        setCreating(false);
      }
    }
  };
  if (hidden) {
    return null;
  }
  const remoteOptions = state.scope === scope ? state.options : [];
  const options = hasRemoteOptions ? remoteOptions : field.options;
  const resolved = {
    ...field,
    hidden: false,
    disabled:
      disabled ||
      creating ||
      (hasRemoteOptions &&
        (state.scope !== scope || state.loading || Boolean(state.error))),
    options,
    ...(field.type === "select-with-add-new" && field.createOption
      ? { type: "select" }
      : {}),
  } as AnyFieldDefinition;
  return (
    <div className="space-y-2">
      {field.searchOptions && (
        <label className="block text-sm" htmlFor={id}>
          {field.label}
          <input
            className="mt-1 w-full rounded-md border bg-background p-2"
            disabled={disabled}
            id={id}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={field.placeholder}
            type="search"
            value={query}
          />
        </label>
      )}
      {children(resolved)}
      {hasRemoteOptions && state.loading && <output>Loading…</output>}
      {hasRemoteOptions && state.error && (
        <div role="alert">
          {state.error}{" "}
          <button onClick={() => setRetry((value) => value + 1)} type="button">
            Retry
          </button>
        </div>
      )}
      {field.createOption && (
        <div className="flex gap-2">
          <input
            aria-label={`New ${field.label}`}
            className="rounded-md border bg-background p-2"
            disabled={disabled || creating}
            onChange={(event) => setNewLabel(event.target.value)}
            value={newLabel}
          />
          <button
            disabled={disabled || creating || !newLabel.trim()}
            onClick={async () => {
              await create();
            }}
            type="button"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
