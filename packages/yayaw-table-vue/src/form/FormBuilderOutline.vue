<script setup lang="ts">
/**
 * The builder's left column: the form's settings, its items in order (drag
 * their grip, or Alt + ↑ / ↓), its hidden fields and the columns it does not
 * ask, with "Add".
 */
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
  MapPin,
  Plus,
  Settings2,
  ShieldCheck,
  SquareCheck,
  TextAlignStart,
  Type,
} from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import {
  type Component,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import {
  attachFormOutlineDrag,
  FORM_BUILDER_FORM,
  type FormBuilderController,
  type FormBuilderEntry,
  type FormBuilderState,
  formBuilderKeyMove,
} from "../form-builder";
import {
  type FormColumn,
  type FormEditor,
  type FormLabelKey,
  formColumnEditor,
} from "../form-view";

const props = defineProps<{
  controller: FormBuilderController;
  state: FormBuilderState;
  headingId: string;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();

const EDITOR_ICONS: Record<FormEditor, Component> = {
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
const columnIcon = (column: FormColumn): Component => {
  const editor = formColumnEditor(column);
  return editor ? EDITOR_ICONS[editor] : Type;
};
/** The icon of an outline entry: its question's input, or its kind. */
const iconOf = (entry: FormBuilderEntry): Component => {
  if (entry.kind === "section") return Heading;
  if (entry.kind === "consent") return ShieldCheck;
  if (entry.kind === "hidden") return EyeOff;
  return columnIcon(entry.column);
};
const isOrdered = (entry: FormBuilderEntry): boolean =>
  entry.kind === "question" || entry.kind === "section" || entry.kind === "consent";
const isRequired = (entry: FormBuilderEntry): boolean =>
  entry.kind === "question" && entry.required;
const isConditional = (entry: FormBuilderEntry): boolean =>
  (entry.kind === "question" || entry.kind === "section") && entry.conditional;
const isMissing = (entry: FormBuilderEntry): boolean =>
  "missing" in entry && entry.missing;
/** Where the dragged entry would drop: a line above or below this row. */
const dropSide = (entry: FormBuilderEntry): "after" | "before" | undefined => {
  const drag = props.state.drag;
  if (!drag || drag.to === drag.from || !("index" in entry) || entry.index !== drag.to) {
    return;
  }
  return drag.to < drag.from ? "before" : "after";
};
const onKeydown = (entry: FormBuilderEntry, event: KeyboardEvent): void => {
  const offset = isOrdered(entry) ? formBuilderKeyMove(event) : undefined;
  if (offset) {
    event.preventDefault();
    props.controller.move(entry.id, offset);
  }
};

const hintId = `yayaw-form-builder-hint-${useId()}`;
const groupId = (group: string) => `${hintId}-${group}`;
const scroll = ref<HTMLElement>();
const list = ref<HTMLElement>();
const setList = (id: string, element: unknown): void => {
  if (id === "items" && element instanceof HTMLElement) list.value = element;
};
let detach: (() => void) | undefined;
onMounted(() => {
  if (list.value) detach = attachFormOutlineDrag(list.value, props.controller);
});
onBeforeUnmount(() => detach?.());
// An entry moved with the keyboard keeps the focus.
watch(
  () => props.state.focus,
  async (focus) => {
    if (!focus) return;
    await nextTick();
    scroll.value
      ?.querySelector<HTMLElement>(`[data-form-builder-entry="${CSS.escape(focus.key)}"]`)
      ?.focus();
  }
);
</script>

<template>
  <section class="yayaw-form-builder-outline" :aria-labelledby="headingId" data-form-builder-outline>
    <div class="yayaw-form-builder-pane-header">
      <h2 :id="headingId" class="yayaw-form-builder-pane-title">{{ label("builderOutline") }}</h2>
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-builder-add" data-form-builder-add>
            <Plus :size="14" aria-hidden="true" />{{ label("addItem") }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-column-menu yayaw-form-builder-menu" align="end" :side-offset="4">
            <DropdownMenuGroup>
              <DropdownMenuLabel class="yayaw-form-builder-menu-label">{{ label("addQuestion") }}</DropdownMenuLabel>
              <DropdownMenuItem
                v-for="column in state.addable"
                :key="column.id"
                class="yayaw-column-menu-item"
                @select="controller.ask(column.id)"
              >
                <component :is="columnIcon(column)" :size="16" aria-hidden="true" />{{ column.header }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="state.addable.length === 0" class="yayaw-column-menu-item" disabled>
                {{ label("noColumnsLeft") }}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator class="yayaw-column-menu-divider" />
            <DropdownMenuItem class="yayaw-column-menu-item" @select="controller.addSection()">
              <Heading :size="16" aria-hidden="true" />{{ label("addSection") }}
            </DropdownMenuItem>
            <DropdownMenuItem class="yayaw-column-menu-item" @select="controller.addConsent()">
              <ShieldCheck :size="16" aria-hidden="true" />{{ label("addConsent") }}
            </DropdownMenuItem>
            <DropdownMenuItem class="yayaw-column-menu-item" @select="controller.addHiddenField()">
              <EyeOff :size="16" aria-hidden="true" />{{ label("addHiddenField") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <div ref="scroll" class="yayaw-form-builder-scroll" data-form-builder-scroll>
      <button
        type="button"
        class="yayaw-form-builder-entry yayaw-form-builder-form-entry"
        :aria-current="state.selected === FORM_BUILDER_FORM || undefined"
        :data-form-builder-entry="FORM_BUILDER_FORM"
        @click="controller.select(FORM_BUILDER_FORM)"
      >
        <Settings2 :size="16" aria-hidden="true" class="yayaw-form-builder-entry-icon" />
        <span class="yayaw-form-builder-entry-name">{{ label("settingsTitle") }}</span>
      </button>
      <template v-for="group in state.groups" :key="group.id">
        <section
          v-if="group.id === 'items' || group.entries.length"
          class="yayaw-form-builder-group"
          :aria-labelledby="groupId(group.id)"
          :data-form-builder-group="group.id"
        >
          <h3 :id="groupId(group.id)" class="yayaw-form-builder-group-title">
            {{ group.title }}<span class="yayaw-form-builder-count">{{ group.entries.length }}</span>
          </h3>
          <p v-if="group.id === 'columns'" class="yayaw-form-builder-note">{{ label("notInFormHint") }}</p>
          <ol :ref="(element) => setList(group.id, element)" class="yayaw-form-builder-list">
            <li
              v-for="entry in group.entries"
              :key="entry.key"
              class="yayaw-form-builder-row"
              :data-drop="dropSide(entry)"
              :data-dragging="state.drag?.key === entry.key || undefined"
              :data-form-builder-row="isOrdered(entry) ? '' : undefined"
              :data-key="entry.key"
              :data-kind="entry.kind"
            >
              <span v-if="isOrdered(entry)" class="yayaw-form-builder-grip" aria-hidden="true" data-form-builder-grip>
                <GripVertical :size="16" />
              </span>
              <span v-else class="yayaw-form-builder-grip-space" aria-hidden="true" />
              <button
                type="button"
                class="yayaw-form-builder-entry"
                :aria-current="state.selected === entry.key || undefined"
                :aria-describedby="isOrdered(entry) ? hintId : undefined"
                :data-form-builder-entry="entry.key"
                @click="controller.select(entry.key)"
                @keydown="onKeydown(entry, $event)"
              >
                <component :is="iconOf(entry)" :size="16" aria-hidden="true" class="yayaw-form-builder-entry-icon" />
                <span class="yayaw-form-builder-entry-name">{{ entry.name }}</span>
                <span class="yayaw-form-builder-marks">
                  <span v-if="isRequired(entry)" class="yayaw-form-builder-required">
                    <span aria-hidden="true">*</span><span class="yayaw-sr-only">{{ label("required") }}</span>
                  </span>
                  <span v-if="isConditional(entry)">
                    <ListFilter :size="14" aria-hidden="true" class="yayaw-form-builder-mark-icon" />
                    <span class="yayaw-sr-only">{{ label("hasConditions") }}</span>
                  </span>
                  <span v-if="isMissing(entry)" data-form-missing-translation>
                    <span aria-hidden="true" class="yayaw-form-builder-missing-dot" />
                    <span class="yayaw-sr-only">{{ label("missingTranslation") }}</span>
                  </span>
                  <span v-if="entry.kind === 'hidden'" class="yayaw-form-builder-detail">→ {{ entry.target }}</span>
                  <span v-if="entry.kind === 'column' && entry.fixed" class="yayaw-form-builder-detail">= {{ entry.fixed }}</span>
                </span>
              </button>
            </li>
          </ol>
          <p v-if="group.id === 'items' && group.entries.length === 0" class="yayaw-form-builder-note">
            {{ label("noQuestions") }}
          </p>
        </section>
      </template>
      <p v-if="state.excluded.length" class="yayaw-form-builder-note" data-form-builder-excluded>
        {{ label("excluded", { columns: state.excluded.map((column) => column.header).join(", ") }) }}
      </p>
    </div>
    <p :id="hintId" class="yayaw-sr-only">{{ label("reorderHint") }}</p>
  </section>
</template>
