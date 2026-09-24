"use client";

import {
  Calendar,
  CircleChevronDown,
  EyeOff,
  GripVertical,
  Hash,
  Heading,
  Link,
  ListChecks,
  ListFilter,
  type LucideIcon,
  MapPin,
  Plus,
  Settings2,
  ShieldCheck,
  SquareCheck,
  TextAlignStart,
  Type,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  attachFormOutlineDrag,
  FORM_BUILDER_FORM,
  type FormBuilderController,
  type FormBuilderEntry,
  type FormBuilderGroup,
  type FormBuilderState,
  formBuilderKeyMove,
} from "../utils/form-builder";
import {
  type FormEditor,
  type FormLabelKey,
  formColumnEditor,
} from "../utils/form-view";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

const EDITOR_ICONS: Record<FormEditor, LucideIcon> = {
  boolean: SquareCheck,
  date: Calendar,
  location: MapPin,
  multiSelect: ListChecks,
  number: Hash,
  select: CircleChevronDown,
  text: Type,
  textarea: TextAlignStart,
  url: Link,
};

/** The icon of an outline entry: its question's input, or its kind. */
function EntryIcon({ entry }: { entry: FormBuilderEntry }) {
  let Icon: LucideIcon = Type;
  if (entry.kind === "section") {
    Icon = Heading;
  } else if (entry.kind === "consent") {
    Icon = ShieldCheck;
  } else if (entry.kind === "hidden") {
    Icon = EyeOff;
  } else {
    const editor = formColumnEditor(entry.column);
    Icon = editor ? EDITOR_ICONS[editor] : Type;
  }
  return (
    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  );
}

/** Marks after an entry's name: required, conditions, missing translation, and where hidden values go. */
function EntryMarks({ entry, label }: { entry: FormBuilderEntry; label: Label }) {
  const marks: ReactNode[] = [];
  if (entry.kind === "question" && entry.required) {
    marks.push(
      <span className="text-destructive" key="required">
        <span aria-hidden="true">*</span>
        <span className="sr-only">{label("required")}</span>
      </span>
    );
  }
  if ((entry.kind === "question" || entry.kind === "section") && entry.conditional) {
    marks.push(
      <span key="conditional">
        <ListFilter aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="sr-only">{label("hasConditions")}</span>
      </span>
    );
  }
  if ("missing" in entry && entry.missing) {
    marks.push(
      <span data-form-missing-translation key="missing">
        <span aria-hidden="true" className="block size-1.5 rounded-full bg-amber-500" />
        <span className="sr-only">{label("missingTranslation")}</span>
      </span>
    );
  }
  if (entry.kind === "hidden") {
    marks.push(
      <span className="truncate text-muted-foreground text-xs" key="target">
        → {entry.target}
      </span>
    );
  }
  if (entry.kind === "column" && entry.fixed) {
    marks.push(
      <span className="truncate text-muted-foreground text-xs" key="fixed">
        = {entry.fixed}
      </span>
    );
  }
  return marks.length ? (
    <span className="flex min-w-0 shrink items-center gap-1.5">{marks}</span>
  ) : null;
}

/** Where the dragged entry would drop: a line above or below this row. */
function dropSide(
  state: FormBuilderState,
  entry: FormBuilderEntry
): "after" | "before" | undefined {
  const drag = state.drag;
  if (!drag || drag.to === drag.from || !("index" in entry)) {
    return;
  }
  if (entry.index !== drag.to) {
    return;
  }
  return drag.to < drag.from ? "before" : "after";
}

interface RowProps {
  controller: FormBuilderController;
  entry: FormBuilderEntry;
  hintId: string;
  label: Label;
  state: FormBuilderState;
}

function OutlineRow({ controller, entry, hintId, label, state }: RowProps) {
  const ordered =
    entry.kind === "question" ||
    entry.kind === "section" ||
    entry.kind === "consent";
  const selected = state.selected === entry.key;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offset = ordered ? formBuilderKeyMove(event) : undefined;
    if (offset) {
      event.preventDefault();
      controller.move(entry.id, offset);
    }
  };
  return (
    <li
      className={cn(
        "relative flex min-w-0 items-center rounded-md",
        "data-[drop=after]:after:absolute data-[drop=after]:after:inset-x-1 data-[drop=after]:after:-bottom-px data-[drop=after]:after:h-0.5 data-[drop=after]:after:rounded-full data-[drop=after]:after:bg-primary",
        "data-[drop=before]:before:absolute data-[drop=before]:before:inset-x-1 data-[drop=before]:before:-top-px data-[drop=before]:before:h-0.5 data-[drop=before]:before:rounded-full data-[drop=before]:before:bg-primary",
        entry.kind === "section" && "mt-2 first:mt-0",
        state.drag?.key === entry.key && "opacity-50"
      )}
      data-drop={dropSide(state, entry)}
      data-form-builder-row={ordered ? "" : undefined}
      data-key={entry.key}
      data-kind={entry.kind}
    >
      {ordered ? (
        <span
          aria-hidden="true"
          className="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          data-form-builder-grip
        >
          <GripVertical className="size-4" />
        </span>
      ) : (
        <span aria-hidden="true" className="w-5 shrink-0" />
      )}
      <button
        aria-current={selected || undefined}
        aria-describedby={ordered ? hintId : undefined}
        className={cn(
          "flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          selected && "bg-accent text-accent-foreground hover:bg-accent",
          entry.kind === "section" && "font-medium",
          entry.kind === "column" && "text-muted-foreground"
        )}
        data-form-builder-entry={entry.key}
        onClick={() => controller.select(entry.key)}
        onKeyDown={onKeyDown}
        type="button"
      >
        <EntryIcon entry={entry} />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        <EntryMarks entry={entry} label={label} />
      </button>
    </li>
  );
}

function OutlineGroup({
  controller,
  group,
  hintId,
  label,
  listRef,
  state,
}: Omit<RowProps, "entry"> & {
  group: FormBuilderGroup;
  listRef?: Ref<HTMLOListElement>;
}) {
  const id = useId();
  if (group.id !== "items" && group.entries.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={id} className="grid gap-1" data-form-builder-group={group.id}>
      <h3
        className="flex items-center gap-1.5 px-2 pt-3 font-medium text-muted-foreground text-xs"
        id={id}
      >
        {group.title}
        <span className="font-normal tabular-nums">{group.entries.length}</span>
      </h3>
      {group.id === "columns" ? (
        <p className="px-2 text-muted-foreground text-xs">{label("notInFormHint")}</p>
      ) : null}
      <ol className="grid gap-0.5" ref={listRef}>
        {group.entries.map((entry) => (
          <OutlineRow
            controller={controller}
            entry={entry}
            hintId={hintId}
            key={entry.key}
            label={label}
            state={state}
          />
        ))}
      </ol>
      {group.id === "items" && group.entries.length === 0 ? (
        <p className="px-2 text-muted-foreground text-sm">{label("noQuestions")}</p>
      ) : null}
    </section>
  );
}

/** "Add": a column to ask, a section, a consent or a hidden field, after the selection. */
function AddMenu({
  controller,
  label,
  state,
}: {
  controller: FormBuilderController;
  label: Label;
  state: FormBuilderState;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button data-form-builder-add size="sm" type="button" variant="outline">
            <Plus aria-hidden="true" />
            {label("addItem")}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label("addQuestion")}</DropdownMenuLabel>
          {state.addable.length ? (
            state.addable.map((column) => {
              const editor = formColumnEditor(column);
              const Icon = editor ? EDITOR_ICONS[editor] : Type;
              return (
                <DropdownMenuItem
                  key={column.id}
                  onClick={() => controller.ask(column.id)}
                >
                  <Icon aria-hidden="true" />
                  {column.header}
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem disabled>{label("noColumnsLeft")}</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => controller.addSection()}>
          <Heading aria-hidden="true" />
          {label("addSection")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => controller.addConsent()}>
          <ShieldCheck aria-hidden="true" />
          {label("addConsent")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => controller.addHiddenField()}>
          <EyeOff aria-hidden="true" />
          {label("addHiddenField")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The builder's left column: the form's settings, its items in order (drag
 * their grip, or Alt + ↑ / ↓), its hidden fields and the columns it does not
 * ask, with "Add".
 */
export function FormBuilderOutline({
  controller,
  headingId,
  label,
  state,
}: {
  controller: FormBuilderController;
  headingId: string;
  label: Label;
  state: FormBuilderState;
}) {
  const hintId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    return list ? attachFormOutlineDrag(list, controller) : undefined;
  }, [controller]);
  // An entry moved with the keyboard keeps the focus.
  useEffect(() => {
    const key = state.focus?.key;
    if (!key) {
      return;
    }
    const target = scrollRef.current?.querySelector<HTMLElement>(
      `[data-form-builder-entry="${CSS.escape(key)}"]`
    );
    target?.focus();
  }, [state.focus]);
  const formSelected = state.selected === FORM_BUILDER_FORM;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-0 flex-col"
      data-form-builder-outline
    >
      <div className="flex min-h-12 items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="font-medium text-sm" id={headingId}>
          {label("builderOutline")}
        </h2>
        <AddMenu controller={controller} label={label} state={state} />
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        data-form-builder-scroll
        ref={scrollRef}
      >
        <button
          aria-current={formSelected || undefined}
          className={cn(
            "flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
            formSelected && "bg-accent text-accent-foreground hover:bg-accent"
          )}
          data-form-builder-entry={FORM_BUILDER_FORM}
          onClick={() => controller.select(FORM_BUILDER_FORM)}
          type="button"
        >
          <Settings2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {label("settingsTitle")}
          </span>
        </button>
        {state.groups.map((group) => (
          <OutlineGroup
            controller={controller}
            group={group}
            hintId={hintId}
            key={group.id}
            label={label}
            listRef={group.id === "items" ? listRef : undefined}
            state={state}
          />
        ))}
        {state.excluded.length ? (
          <p className="px-2 pt-3 text-muted-foreground text-xs" data-form-builder-excluded>
            {label("excluded", {
              columns: state.excluded.map((column) => column.header).join(", "),
            })}
          </p>
        ) : null}
      </div>
      <p className="sr-only" id={hintId}>
        {label("reorderHint")}
      </p>
    </section>
  );
}
