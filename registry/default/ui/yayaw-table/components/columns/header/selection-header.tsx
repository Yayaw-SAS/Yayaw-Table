import { Checkbox } from "@/components/ui/checkbox";
import type { Column, Table } from "../../../tanstack";

interface SelectionHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  table?: Table<TData>;
}

export function SelectionHeader<TData, TValue>({
  table,
}: SelectionHeaderProps<TData, TValue>) {
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
  } catch {
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }
}
