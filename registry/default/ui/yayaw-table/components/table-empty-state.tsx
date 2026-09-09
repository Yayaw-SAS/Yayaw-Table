"use client";

import { Inbox, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** Shared by the table, Kanban, and Gallery empty states. */
export function TableEmptyStateContent({
  clearFiltersLabel,
  description,
  onClearFilters,
  title,
}: {
  clearFiltersLabel: string;
  description?: string;
  onClearFilters?: () => void;
  title: string;
}) {
  const Icon = onClearFilters ? SearchX : Inbox;
  return (
    <Empty className="min-h-40 px-4 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {onClearFilters ? (
        <EmptyContent>
          <Button
            onClick={onClearFilters}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" />
            {clearFiltersLabel}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
