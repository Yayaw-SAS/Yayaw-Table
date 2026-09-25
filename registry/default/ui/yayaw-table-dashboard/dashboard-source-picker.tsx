"use client";

import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  type DashboardSourceChoice,
  dashboardSourceChoices,
} from "./dashboard-editor-model";
import { errorText } from "./dashboard-hooks";
import type { DashboardTranslate } from "./dashboard-model";
import type {
  DashboardSourceLoader,
  DashboardSourceSummary,
} from "./dashboard-sources";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-widget";

type Listing =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; summaries: readonly DashboardSourceSummary[] };

export interface DashboardSourcePickerProps {
  loader: DashboardSourceLoader<DashboardTableSource>;
  label: DashboardLabel;
  locale: string;
  translate?: DashboardTranslate;
  /** The source picked so far (marked current). */
  value?: string;
  /** A source being loaded after it was picked. */
  picking?: string;
  onPick: (sourceId: string) => void;
}

/** A source's name, then why it is unavailable or what it holds. */
function SourceText({ source }: { source: DashboardSourceChoice }) {
  const detail = source.reason ?? source.description;
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium">{source.name}</span>
      {detail ? (
        <span
          className="truncate text-muted-foreground text-xs"
          data-source-reason={source.reason ? "" : undefined}
        >
          {detail}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The host's catalogue (`sources.list()`, the `tables` first), searchable
 * and grouped; unavailable sources are listed, disabled, with the reason.
 */
export function DashboardSourcePicker({
  label,
  loader,
  locale,
  onPick,
  picking,
  translate,
  value,
}: DashboardSourcePickerProps) {
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    setListing({ status: "loading" });
    loader
      .list()
      .then((summaries) => {
        if (!cancelled) {
          setListing({ status: "ready", summaries });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setListing({ status: "error", message: errorText(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);
  const groups =
    listing.status === "ready"
      ? dashboardSourceChoices(listing.summaries, { query, locale, translate })
      : [];
  return (
    <Command
      className="rounded-lg border"
      data-source-picker=""
      label={label("chooseSource")}
      shouldFilter={false}
    >
      <CommandInput
        aria-label={label("searchSources")}
        // The catalogue step opens on its search.
        autoFocus
        onValueChange={setQuery}
        placeholder={label("searchSources")}
        value={query}
      />
      <CommandList className="max-h-80">
        {listing.status === "loading" ? (
          <output className="block px-2 py-6 text-center text-muted-foreground text-sm">
            {label("loadingSources")}
          </output>
        ) : null}
        {listing.status === "error" ? (
          <p
            className="px-2 py-6 text-center text-destructive text-sm"
            role="alert"
          >
            {label("sourcesError", { error: listing.message })}
          </p>
        ) : null}
        {listing.status === "ready" ? (
          <CommandEmpty>{label("noSources")}</CommandEmpty>
        ) : null}
        {groups.map((group) => (
          <CommandGroup
            data-source-group={group.label}
            heading={group.label || undefined}
            key={group.label || "-"}
          >
            {group.sources.map((source) => (
              <CommandItem
                // cmdk marks every item `data-selected="true"` or `"false"`.
                className="data-[selected=false]:bg-transparent!"
                data-checked={source.id === value ? "true" : undefined}
                data-source-id={source.id}
                disabled={!source.available}
                key={source.id}
                onSelect={() => onPick(source.id)}
                value={source.id}
              >
                <SourceText source={source} />
                {picking === source.id ? (
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {label("sourceLoading", { source: source.name })}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}
