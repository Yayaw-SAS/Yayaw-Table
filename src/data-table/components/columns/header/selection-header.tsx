import { Checkbox } from "@/components/ui/checkbox"
import type { Column, Table } from "@tanstack/react-table"

interface SelectionHeaderProps<TData> {
    column: Column<TData, unknown>
    table?: Table<TData>
}

export function SelectionHeader<TData>({ column, table }: SelectionHeaderProps<TData>) {
    if (!table) return null

    return (
        <div className="flex items-center justify-center px-1">
            <Checkbox
                aria-label="Select all rows"
                checked={table.getIsAllPageRowsSelected()}
                className="translate-y-[2px] cursor-pointer"
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            />
        </div>
    )
}
