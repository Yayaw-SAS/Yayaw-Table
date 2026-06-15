"use client";

import type {
  Announcements,
  DndContextProps,
  DraggableAttributes,
  DraggableSyntheticListeners,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { createPortal } from "react-dom";
import tunnel from "tunnel-rat";
import { cn } from "@/lib/utils";
import { Card } from "@/src/components/ui/card";
import { ScrollArea, ScrollBar } from "@/src/components/ui/scroll-area";

/*
 * Adapted from Kibo UI Kanban.
 * Copyright (c) 2023 - Present shadcnblocks.
 * Licensed under the MIT License.
 */

const tunnelInstance = tunnel();

export type { DragEndEvent } from "@dnd-kit/core";

export type KanbanItemProps = {
  column: string;
  id: string;
  name: string;
} & Record<string, unknown>;

export type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

interface KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> {
  activeCardId: null | string;
  columns: C[];
  data: T[];
}

const KanbanContext = createContext<KanbanContextProps>({
  activeCardId: null,
  columns: [],
  data: [],
});

export interface KanbanBoardProps {
  children: ReactNode;
  className?: string;
  id: string;
}

export const KanbanBoard = ({ children, className, id }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <section
      className={cn(
        "flex size-full min-h-40 flex-col divide-y overflow-hidden rounded-md border bg-secondary text-xs shadow-sm ring-2 transition-all",
        isOver ? "ring-primary" : "ring-transparent",
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </section>
  );
};

export interface KanbanDragHandleProps {
  attributes: DraggableAttributes;
  disabled: boolean;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> =
  T & {
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
    dragHandle?: (props: KanbanDragHandleProps) => ReactNode;
  };

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  disabled = false,
  dragHandle,
  id,
  name,
}: KanbanCardProps<T>) => {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transition,
    transform,
  } = useSortable({ disabled, id });
  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps;
  const hasDragHandle = Boolean(dragHandle);
  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };
  const dragProps = disabled || hasDragHandle ? {} : { ...listeners, ...attributes };
  const content = children ?? <p className="m-0 font-medium text-sm">{name}</p>;
  const cardClassName = cn(
    "gap-4 rounded-md p-3 shadow-sm",
    disabled || hasDragHandle ? "cursor-default" : "cursor-grab",
    isDragging && "pointer-events-none cursor-grabbing opacity-30",
    className
  );

  return (
    <>
      <div ref={setNodeRef} style={style} {...dragProps}>
        <Card className={cardClassName}>
          {content}
          {dragHandle?.({
            attributes,
            disabled,
            listeners,
            setActivatorNodeRef,
          })}
        </Card>
      </div>
      {activeCardId === id && (
        <tunnelInstance.In>
          <Card
            className={cn(
              "cursor-grab gap-4 rounded-md p-3 shadow-sm ring-2 ring-primary",
              isDragging && "cursor-grabbing",
              className
            )}
          >
            {content}
          </Card>
        </tunnelInstance.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
    children: (item: T) => ReactNode;
    id: string;
  };

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);
  const items = filteredData.map((item) => item.id);

  return (
    <ScrollArea className="min-h-0 flex-1 overflow-hidden">
      <SortableContext items={items}>
        <div
          className={cn("flex min-h-full flex-grow flex-col gap-2 p-2", className)}
          {...props}
        >
          {filteredData.map(children)}
        </div>
      </SortableContext>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <header className={cn("m-0 p-2 font-semibold text-sm", className)} {...props} />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, "children"> & {
  children: (column: C) => ReactNode;
  className?: string;
  columns: C[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  className,
  columns,
  data,
  onDataChange,
  onDragEnd,
  onDragOver,
  onDragStart,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<null | string>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = data.find((item) => item.id === event.active.id);
    if (card) {
      setActiveCardId(String(event.active.id));
    }
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeItem = data.find((item) => item.id === active.id);
    const overItem = data.find((item) => item.id === over.id);

    if (!activeItem) {
      return;
    }

    const overColumn =
      overItem?.column ||
      columns.find((column) => column.id === over.id)?.id ||
      columns[0]?.id;

    if (activeItem.column !== overColumn) {
      let nextData = [...data];
      const activeIndex = nextData.findIndex((item) => item.id === active.id);
      const overIndex = nextData.findIndex((item) => item.id === over.id);

      if (activeIndex < 0) {
        return;
      }

      nextData[activeIndex] = {
        ...nextData[activeIndex],
        column: overColumn,
      };
      nextData = arrayMove(
        nextData,
        activeIndex,
        overIndex >= 0 ? overIndex : nextData.length - 1
      );

      onDataChange?.(nextData);
    }

    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);

    onDragEnd?.(event);

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    let nextData = [...data];
    const oldIndex = nextData.findIndex((item) => item.id === active.id);
    const newIndex = nextData.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    nextData = arrayMove(nextData, oldIndex, newIndex);

    onDataChange?.(nextData);
  };

  const announcements: Announcements = {
    onDragCancel({ active }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};

      return `Cancelled dragging the card "${name}"`;
    },
    onDragEnd({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dropped the card "${name}" into the "${newColumn}" column`;
    },
    onDragOver({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dragged the card "${name}" over the "${newColumn}" column`;
    },
    onDragStart({ active }) {
      const { column, name } = data.find((item) => item.id === active.id) ?? {};

      return `Picked up the card "${name}" from the "${column}" column`;
    },
  };

  return (
    <KanbanContext.Provider value={{ activeCardId, columns, data }}>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <div
          className={cn(
            "grid size-full auto-cols-fr grid-flow-col gap-4",
            className
          )}
        >
          {columns.map((column) => children(column))}
        </div>
        {typeof window !== "undefined"
          ? createPortal(
              <DragOverlay>
                <tunnelInstance.Out />
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>
    </KanbanContext.Provider>
  );
};
