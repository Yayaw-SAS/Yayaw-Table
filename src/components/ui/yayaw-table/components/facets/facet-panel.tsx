"use client";

import { Check, ListFilter, PanelLeft, PanelRight, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/src/components/ui/drawer";
import { useFacetPanel, useTableFacets } from "../../hooks/use-table-facets";
import {
  FACETS_MAX_ROWS,
  type FacetColumn,
  type FacetEntry,
  facetCountText,
  facetKeyTarget,
  facetSearchable,
  hasFacetSelection,
  visibleFacetEntries,
} from "../../utils/facets-model";
import { TableTooltip } from "../../utils/table-tooltip";

type Panel = ReturnType<typeof useFacetPanel>;

/** Arrows, Home and End move between a facet's values. */
function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const buttons = [
    ...(event.currentTarget
      .closest("[data-facet-values]")
      ?.querySelectorAll<HTMLButtonElement>("button[data-facet-value]") ?? []),
  ];
  const target = facetKeyTarget(event.key, index, buttons.length);
  if (target !== undefined) {
    event.preventDefault();
    buttons[target]?.focus();
  }
}

function FacetValue({
  blocked,
  entry,
  index,
  onToggle,
  panel,
  showCounts,
}: {
  blocked: boolean;
  entry: FacetEntry;
  index: number;
  onToggle: () => void;
  panel: Panel;
  showCounts: boolean;
}) {
  return (
    <li>
      <button
        aria-pressed={entry.selected}
        className={cn(
          "flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none transition-colors",
          "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          entry.selected && "bg-accent font-medium"
        )}
        data-facet-empty={entry.empty ? "" : undefined}
        data-facet-value={entry.empty ? "" : String(entry.value)}
        disabled={blocked}
        onClick={onToggle}
        onKeyDown={(event) => moveFocus(event, index)}
        title={entry.detail ? `${entry.label} · ${entry.detail}` : entry.label}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
            entry.selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input"
          )}
        >
          {entry.selected ? <Check className="size-3" /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate", entry.empty && "italic")}>
            {entry.label}
          </span>
          {entry.detail ? (
            <span className="truncate text-muted-foreground text-xs">
              {entry.detail}
            </span>
          ) : null}
        </span>
        {showCounts && entry.count !== undefined ? (
          <>
            <span
              aria-hidden="true"
              className="shrink-0 text-muted-foreground text-xs tabular-nums"
              data-facet-count=""
            >
              {entry.count.toLocaleString(panel.locale)}
            </span>
            <span className="sr-only">
              , {facetCountText(entry.count, panel.locale, panel.translate)}
            </span>
          </>
        ) : null}
      </button>
    </li>
  );
}

function FacetSection({
  facet,
  panel,
  showCounts,
}: {
  facet: FacetColumn;
  panel: Panel;
  showCounts: boolean;
}) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const entries = panel.entriesOf(facet);
  const selected = hasFacetSelection(panel.selection(facet));
  const blocked = panel.blocked(facet);
  const visible = visibleFacetEntries(entries, {
    limit: facet.limit,
    expanded,
    query,
  });
  const { label } = panel;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-1"
      data-facet={facet.id}
    >
      <div className="flex min-h-7 items-center justify-between gap-2 px-2">
        <h3
          className="truncate font-medium text-muted-foreground text-xs uppercase tracking-wide"
          id={headingId}
        >
          {facet.label}
        </h3>
        {selected ? (
          <button
            aria-label={label("clearFacet", { facet: facet.label })}
            className="rounded px-1 text-muted-foreground text-xs hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            data-facet-clear=""
            onClick={() => panel.clear(facet)}
            type="button"
          >
            {label("clear")}
          </button>
        ) : null}
      </div>
      {facetSearchable(entries, facet.limit) ? (
        <input
          aria-label={label("search", { facet: facet.label })}
          className="mx-2 h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-facet-search=""
          onChange={(event) => setQuery(event.target.value)}
          placeholder={label("search", { facet: facet.label })}
          type="search"
          value={query}
        />
      ) : null}
      <ul
        aria-labelledby={headingId}
        className="m-0 flex list-none flex-col gap-0.5 p-0"
        data-facet-values=""
      >
        {visible.entries.map((entry, index) => (
          <FacetValue
            blocked={blocked}
            entry={entry}
            index={index}
            key={entry.key}
            onToggle={() => panel.toggle(facet, entry.value)}
            panel={panel}
            showCounts={showCounts}
          />
        ))}
      </ul>
      {visible.entries.length || panel.loading ? null : (
        <p className="px-2 text-muted-foreground text-sm">
          {label("noMatches")}
        </p>
      )}
      {visible.hidden > 0 || expanded ? (
        <button
          className="self-start rounded px-2 py-1 text-muted-foreground text-xs hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          data-facet-more=""
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded
            ? label("showLess")
            : label("showMore", { count: visible.hidden })}
        </button>
      ) : null}
    </section>
  );
}

/** The facets: one section per column, the counts' notices, "Clear all". */
export function FacetPanelContent({
  headingId,
  onClose,
  tableId,
  tableType,
}: {
  headingId: string;
  onClose?: () => void;
  tableId: string;
  tableType: string;
}) {
  const panel = useFacetPanel({ tableId, tableType });
  const { facets, label } = panel;
  if (!facets) {
    return null;
  }
  const errorText = panel.error ? label("error") : undefined;
  return (
    <div className="flex flex-col gap-3" data-facet-panel-content="">
      <div className="flex min-h-8 items-center justify-between gap-2 px-2">
        <h2 className="font-semibold text-sm" id={headingId}>
          {label("title")}
        </h2>
        <div className="flex items-center gap-1">
          {panel.selectedCount ? (
            <Button
              className="h-7 px-2 font-normal text-xs"
              data-facet-clear-all=""
              onClick={panel.clearAll}
              size="sm"
              type="button"
              variant="ghost"
            >
              {label("clearAll")}
            </Button>
          ) : null}
          {onClose ? (
            <Button
              aria-label={label("close")}
              className="size-8"
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {facets.columns.some((facet) => panel.blocked(facet)) ? (
        <p className="px-2 text-muted-foreground text-xs" data-facet-notice="or">
          {label("anyJoin")}
        </p>
      ) : null}
      {panel.truncated ? (
        <p
          className="px-2 text-muted-foreground text-xs"
          data-facet-notice="truncated"
        >
          {label("truncated", {
            count: FACETS_MAX_ROWS.toLocaleString(panel.locale),
          })}
        </p>
      ) : null}
      {errorText ? (
        <div
          className="flex items-center gap-2 px-2 text-destructive text-xs"
          role="alert"
        >
          <span>{errorText}</span>
          <Button
            className="h-7 px-2 text-xs"
            onClick={() => {
              panel.retry().catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {label("retry")}
          </Button>
        </div>
      ) : null}
      <output aria-live="polite" className="sr-only">
        {panel.loading ? label("loading") : ""}
      </output>
      {facets.columns.map((facet) => (
        <FacetSection
          facet={facet}
          key={facet.id}
          panel={panel}
          showCounts={facets.showCounts}
        />
      ))}
    </div>
  );
}

/**
 * The records with the facet panel beside them on wide screens (phones open
 * it as a sheet from the toolbar). Tables without facets get their records
 * as they are.
 */
export function TableFacetsLayout({
  children,
  compact,
  tableId,
  tableType,
}: {
  children: ReactNode;
  compact: boolean;
  tableId: string;
  tableType: string;
}) {
  const headingId = useId();
  const { facets, open, shown } = useTableFacets({ tableId, tableType });
  if (!facets) {
    return children;
  }
  const panel =
    shown && open && !compact ? (
      <aside
        aria-labelledby={headingId}
        className="sticky top-4 max-h-[calc(100dvh-2rem)] shrink-0 overflow-y-auto rounded-lg border bg-background p-2"
        data-facet-panel=""
        data-position={facets.position}
        id={`${tableId}-facets`}
        key="facets"
        style={{ width: facets.width }}
      >
        <FacetPanelContent
          headingId={headingId}
          tableId={tableId}
          tableType={tableType}
        />
      </aside>
    ) : null;
  const records = (
    <div className="min-w-0 flex-1" key="records">
      {children}
    </div>
  );
  // The panel comes first in reading order on the left, after the records on the right.
  return (
    <div className="flex min-w-0 items-start gap-4" data-facets-layout="">
      {facets.position === "right" ? [records, panel] : [panel, records]}
    </div>
  );
}

/**
 * The toolbar button showing and hiding the facet panel; on phones it opens
 * the panel as a sheet.
 */
export function FacetsToggle({
  compact,
  tableId,
  tableType,
}: {
  compact: boolean;
  tableId: string;
  tableType: string;
}) {
  const headingId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { facets, label, open, selectedCount, setOpen, shown } =
    useTableFacets({ tableId, tableType });
  if (!(facets && shown)) {
    return null;
  }
  const Icon = facets.position === "right" ? PanelRight : PanelLeft;
  const text = compact || !open ? label("show") : label("hide");
  const badge = selectedCount ? (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
    >
      {selectedCount}
    </span>
  ) : null;
  if (compact) {
    return (
      <>
        <Button
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          aria-label={text}
          className="relative size-11"
          data-facets-toggle=""
          onClick={() => setSheetOpen(true)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ListFilter className="size-4" />
          {badge}
        </Button>
        <Drawer onOpenChange={setSheetOpen} open={sheetOpen}>
          <DrawerContent
            aria-describedby={undefined}
            className="max-h-[90dvh] overflow-clip pb-[env(safe-area-inset-bottom)] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
            data-facet-sheet=""
          >
            <DrawerTitle className="sr-only">{label("title")}</DrawerTitle>
            <div className="overflow-y-auto p-3 [&_button]:min-h-11">
              <FacetPanelContent
                headingId={headingId}
                onClose={() => setSheetOpen(false)}
                tableId={tableId}
                tableType={tableType}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }
  return (
    <TableTooltip label={text}>
      <Button
        aria-controls={open ? `${tableId}-facets` : undefined}
        aria-label={text}
        aria-pressed={open}
        className="relative h-8 w-8"
        data-facets-toggle=""
        onClick={() => setOpen(!open)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Icon className="size-4" />
        {badge}
      </Button>
    </TableTooltip>
  );
}
