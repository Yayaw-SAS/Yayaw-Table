"use client";

import { Folder, FolderRoot } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { cn } from "@/lib/utils";
import { facetKeyTarget } from "../../utils/facets-model";
import {
  type FolderDirectory,
  type FolderEntry,
  folderLocationText,
  searchFolders,
} from "../../utils/folder-directory";

/** Arrows, Home and End move between the picker's folders. */
function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const buttons = [
    ...(event.currentTarget
      .closest("[data-folder-options]")
      ?.querySelectorAll<HTMLButtonElement>("button[data-folder-option]") ??
      []),
  ];
  const target = facetKeyTarget(event.key, index, buttons.length);
  if (target !== undefined) {
    event.preventDefault();
    buttons[target]?.focus();
  }
}

/**
 * A searchable list of the table's folders with their locations, the root
 * first: the parent of a new folder, or the folders a filter keeps.
 */
export function FolderPicker({
  directory,
  disabled,
  emptyLabel,
  label,
  loading,
  loadingLabel,
  onPick,
  rootLabel,
  searchLabel,
  selected,
}: {
  directory?: FolderDirectory;
  /** Folders that cannot be picked (`null` is the root). */
  disabled?: (entry: FolderEntry | null) => boolean;
  emptyLabel: string;
  label: string;
  loading: boolean;
  loadingLabel: string;
  onPick: (id: string | null) => void;
  rootLabel: string;
  searchLabel: string;
  selected: (id: string | null) => boolean;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const folders = searchFolders(directory, query);
  const options: (FolderEntry | null)[] = searching
    ? folders
    : [null, ...folders];
  return (
    <div className="flex flex-col gap-2" data-folder-picker="">
      <input
        aria-label={searchLabel}
        className="h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-folder-search=""
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchLabel}
        type="search"
        value={query}
      />
      <ul
        aria-label={label}
        className="m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto p-0"
        data-folder-options=""
      >
        {options.map((entry, index) => {
          const id = entry?.id ?? null;
          const pressed = selected(id);
          return (
            <li key={id ?? "__root"}>
              <button
                aria-pressed={pressed}
                className={cn(
                  "flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none transition-colors",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  pressed && "bg-accent font-medium"
                )}
                data-folder-option={id ?? ""}
                data-folder-root={id === null ? "" : undefined}
                disabled={disabled?.(entry) ?? false}
                onClick={() => onPick(id)}
                onKeyDown={(event) => moveFocus(event, index)}
                style={
                  searching || !entry
                    ? undefined
                    : { paddingInlineStart: `${0.5 + entry.depth}rem` }
                }
                type="button"
              >
                {entry ? (
                  <Folder aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <FolderRoot aria-hidden="true" className="size-4 shrink-0" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{entry?.name ?? rootLabel}</span>
                  {entry ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {folderLocationText(entry, rootLabel)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {loading ? (
        <p className="text-muted-foreground text-xs">{loadingLabel}</p>
      ) : null}
      {!loading && searching && folders.length === 0 ? (
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
