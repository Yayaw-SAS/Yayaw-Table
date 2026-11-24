"use client";

import { OptionIcon } from "../../option-icon";
import { ChevronsUpDown, X } from "lucide-react";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/src/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  persistedOption,
  RemoteOptionSearchContext,
  rememberOptions,
  useRemoteOptionSearch,
} from "../../../hooks/use-remote-option-search";
import { useTranslations } from "../../../providers/table-provider";
import { filterMenuText } from "../../../utils/filter-menu";
import { formLabel } from "../../../utils/form-view";
import { limitOptions, optionControlKey } from "../../../utils/table-contracts";
import type { FormSelectOption } from "../types";

type OptionValue = FormSelectOption["value"];

const folded = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matchingOptions(
  options: FormSelectOption[],
  query: string,
  remote: { minLength: number } | undefined,
  matched: Set<string> | undefined
) {
  if (remote && query.trim().length >= Math.max(1, remote.minLength)) {
    const known = new Map(
      options.map((option) => [optionControlKey(option.value), option])
    );
    return [...(matched ?? [])].flatMap((key) => {
      const option = known.get(key);
      return option ? [option] : [];
    });
  }
  const text = folded(query.trim());
  return text
    ? options.filter((option) => folded(option.label).includes(text))
    : options;
}

function OptionSearchStatus({
  error,
  loading,
  locale,
  retry,
}: {
  error?: string;
  loading: boolean;
  locale: string;
  retry: () => void;
}) {
  if (error) {
    return (
      <div className="px-2 py-2 text-destructive text-sm" role="alert">
        {error}{" "}
        <button onClick={retry} type="button">
          {locale.startsWith("fr") ? "Réessayer" : "Retry"}
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <output className="block px-2 py-2 text-muted-foreground text-sm">
        {formLabel("loading", locale)}
      </output>
    );
  }
  return <CommandEmpty>{formLabel("noMatchingOption", locale)}</CommandEmpty>;
}

/**
 * A `searchable` select or multiSelect field: a button opening a list that
 * filters as you type. Several picks show as removable chips under it.
 */
export function OptionCombobox({
  id,
  label,
  options,
  value,
  multiple,
  disabled,
  invalid,
  placeholder,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  options: readonly FormSelectOption[];
  /** One value, or a list when `multiple`. */
  value: unknown;
  multiple: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onChange: (value: OptionValue | OptionValue[] | null) => void;
  onBlur?: () => void;
}) {
  const { locale = "en", t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const remote = useContext(RemoteOptionSearchContext);
  const [created, setCreated] = useState<FormSelectOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const createRequest = useRef<AbortController | undefined>(undefined);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (disabled) {
      createRequest.current?.abort();
      setCreating(false);
    }
    return () => createRequest.current?.abort();
  }, [disabled]);
  const selected = (multiple && Array.isArray(value) ? value : [value]).filter(
    (item) => item != null && item !== ""
  ) as OptionValue[];
  const latestSelection = useRef(selected);
  useLayoutEffect(() => {
    latestSelection.current = selected;
  });
  const remoteState = useRemoteOptionSearch(
    remote,
    !disabled,
    open ? search : "",
    selected
  );
  const known = rememberOptions(
    [...options, ...created],
    remoteState.remembered
  );
  const isSelected = (option: OptionValue) =>
    selected.some((item) => Object.is(item, option));
  const optionOf = (value: OptionValue) =>
    known.find((item) => Object.is(item.value, value));
  const labelOf = (value: OptionValue) => optionOf(value)?.label ?? String(value);
  const pick = (option: OptionValue) => {
    // The next search starts empty, so several picks can be typed in a row.
    setSearch("");
    if (!multiple) {
      onChange(option);
      setOpen(false);
      return;
    }
    onChange(
      isSelected(option)
        ? selected.filter((item) => !Object.is(item, option))
        : [...selected, option]
    );
  };
  const choose = placeholder ?? formLabel("choose", locale);
  // The label contains the search, ignoring case and accents, as in Vue (not cmdk's fuzzy match).
  // Only the first matches are drawn: a list of thousands stays instant.
  const available = matchingOptions(known, search, remote, remoteState.matched);
  const { shown, hidden } = limitOptions(
    remoteState.searching ? [] : available
  );
  const createText = search.trim();
  const canCreate =
    Boolean(remote?.create) &&
    createText.length > 0 &&
    !remoteState.searching &&
    !remoteState.error &&
    !known.some(
      (option) =>
        option.label.trim().toLocaleLowerCase() ===
        createText.toLocaleLowerCase()
    );
  const chooseCreated = (option: FormSelectOption) => {
    setCreated((previous) => rememberOptions(previous, [option]));
    setSearch("");
    onChange(
      multiple
        ? [
            ...latestSelection.current.filter(
              (value) => !Object.is(value, option.value)
            ),
            option.value,
          ]
        : option.value
    );
    if (!multiple) {
      setOpen(false);
    }
    input.current?.focus();
  };
  const create = async () => {
    if (!(remote?.create && canCreate) || creating) {
      return;
    }
    const request = new AbortController();
    createRequest.current = request;
    setCreating(true);
    setCreateError(undefined);
    try {
      const option = persistedOption(
        await remote.create(createText, request.signal)
      );
      if (!request.signal.aborted) {
        chooseCreated(option);
      }
    } catch (cause) {
      if (!request.signal.aborted) {
        setCreateError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (!request.signal.aborted) {
        setCreating(false);
      }
    }
  };
  const error = createError ?? remoteState.error;
  const loading = remoteState.loading || remoteState.searching || creating;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Popover
          onOpenChange={(next) => {
            if (!next && creating) {
              return;
            }
            setOpen(next);
            if (!next) {
              setSearch("");
              onBlur?.();
            }
          }}
          open={open && !disabled}
        >
          <PopoverTrigger
            render={
              <Button
                aria-expanded={open}
                aria-invalid={invalid || undefined}
                aria-label={label}
                className="w-full justify-between font-normal"
                data-searchable-field=""
                disabled={disabled}
                id={id}
                role="combobox"
                type="button"
                variant="outline"
              >
                <span className="truncate">
                  {!multiple && selected.length > 0 && <OptionIcon className="me-1.5" option={optionOf(selected[0])} />}
                  {multiple || !selected.length ? choose : labelOf(selected[0])}
                </span>
                {multiple && selected.length > 0 && (
                  <Badge className="ml-auto" variant="secondary">
                    {selected.length}
                  </Badge>
                )}
                <ChevronsUpDown aria-hidden="true" className="opacity-50" />
              </Button>
            }
          />
          <PopoverContent
            align="start"
            className="w-(--anchor-width) min-w-[min(18rem,calc(100vw-2rem))] gap-0 p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                aria-label={`${label} ${formLabel("searchOptions", locale)}`}
                onValueChange={(value) => {
                  setSearch(value);
                  setCreateError(undefined);
                }}
                placeholder={formLabel("searchOptions", locale)}
                ref={input}
                value={search}
              />
              <CommandList className="max-h-[min(16rem,40dvh)]">
                <OptionSearchStatus
                  error={error}
                  loading={loading}
                  locale={locale}
                  retry={() => {
                    setCreateError(undefined);
                    remoteState.retry();
                  }}
                />
                {shown.map((option) => (
                  <CommandItem
                    className="min-h-11 md:min-h-8"
                    data-checked={isSelected(option.value)}
                    disabled={option.disabled}
                    key={optionControlKey(option.value)}
                    keywords={[option.label]}
                    onSelect={() => pick(option.value)}
                    value={optionControlKey(option.value)}
                  >
                    <OptionIcon option={option} />
                    {option.label}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    disabled={creating}
                    onSelect={async () => {
                      await create();
                    }}
                    value="__yayaw-create-option__"
                  >
                    {creating
                      ? formLabel("loading", locale)
                      : t("inline.create_option", { label: createText })}
                  </CommandItem>
                )}
                {hidden > 0 && (
                  <output className="block px-2 py-1.5 text-muted-foreground text-xs">
                    {filterMenuText("moreOptions", locale).replace(
                      "{count}",
                      String(hidden)
                    )}
                  </output>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {!multiple && selected.length > 0 && (
          <Button
            aria-label={formLabel("removeOption", locale, undefined, {
              label: labelOf(selected[0]),
            })}
            disabled={disabled}
            onClick={() => onChange(null)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {multiple && selected.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <li key={optionControlKey(option)}>
              <Badge className="gap-1" variant="secondary">
                <OptionIcon option={optionOf(option)} />
                {labelOf(option)}
                <button
                  aria-label={formLabel("removeOption", locale, undefined, {
                    label: labelOf(option),
                  })}
                  className="rounded-sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      selected.filter((item) => !Object.is(item, option))
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
