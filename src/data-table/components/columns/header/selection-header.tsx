import type { Column, Table } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';

interface SelectionHeaderProps<TData> {
  column: Column<TData, unknown>;
  table?: Table<TData>;
}

export function SelectionHeader<TData>({ table }: SelectionHeaderProps<TData>) {
  console.log('🔍 SelectionHeader render:', { table: !!table });

  if (!table) {
    console.log('❌ No table provided to SelectionHeader');
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }

  try {
    const hasRequiredMethods =
      typeof table.getIsAllRowsSelected === 'function' &&
      typeof table.toggleAllRowsSelected === 'function' &&
      typeof table.getIsSomeRowsSelected === 'function';

    console.log('🔍 Required methods check:', {
      getIsAllRowsSelected: typeof table.getIsAllRowsSelected,
      toggleAllRowsSelected: typeof table.toggleAllRowsSelected,
      getIsSomeRowsSelected: typeof table.getIsSomeRowsSelected,
      hasRequiredMethods,
    });

    if (!hasRequiredMethods) {
      console.log('❌ Missing required methods');
      return <div className="flex h-4 w-4 items-center justify-center" />;
    }

    const isAllSelected = table.getIsAllRowsSelected();
    const isSomeSelected = table.getIsSomeRowsSelected();

    console.log('🔍 Selection state:', { isAllSelected, isSomeSelected });

    return (
      <div className="flex items-center justify-center px-1">
        <Checkbox
          aria-label="Select all rows"
          checked={isAllSelected}
          className="translate-y-[2px] cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          onCheckedChange={(value) => {
            console.log('🔍 Checkbox clicked:', { value });
            table.toggleAllRowsSelected(!!value);
          }}
          ref={(el: HTMLButtonElement & { indeterminate?: boolean }) => {
            if (el) {
              el.indeterminate = isSomeSelected && !isAllSelected;
              console.log('🔍 Checkbox ref set:', {
                indeterminate: el.indeterminate,
                isSomeSelected,
                isAllSelected,
              });
            }
          }}
        />
      </div>
    );
  } catch (error) {
    console.error('❌ SelectionHeader error:', error);
    return <div className="flex h-4 w-4 items-center justify-center" />;
  }
}
