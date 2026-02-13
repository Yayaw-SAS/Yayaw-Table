import type { Column, Table } from "@tanstack/react-table";
import { Checkbox } from "@/src/components/ui/checkbox";

interface SelectionHeaderProps<TData> {
  column: Column<TData, unknown>;
  table?: Table<TData>;
}

export function SelectionHeader<TData>({ table }: SelectionHeaderProps<TData>) {
  if (!table) {
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }

  try {
    const hasRequiredMethods =
      typeof table.getIsAllRowsSelected === "function" &&
      typeof table.toggleAllRowsSelected === "function" &&
      typeof table.getIsSomeRowsSelected === "function";

    if (!hasRequiredMethods) {
      return <div className="flex h-4 w-4 items-center justify-center" />;
    }

    const isAllSelected = table.getIsAllRowsSelected();
    const isSomeSelected = table.getIsSomeRowsSelected();

    return (
      <div className="flex h-full w-full items-center justify-center">
        <Checkbox
          aria-label="Select all rows"
          checked={isAllSelected}
          className="translate-y-[2px] cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          onCheckedChange={(value) => {
            table.toggleAllRowsSelected(!!value);
          }}
          ref={(el: HTMLButtonElement & { indeterminate?: boolean }) => {
            if (el) {
              el.indeterminate = isSomeSelected && !isAllSelected;
            }
          }}
        />
      </div>
    );
  } catch (_error) {
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }
}
