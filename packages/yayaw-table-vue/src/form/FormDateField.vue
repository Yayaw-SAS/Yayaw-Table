<script setup lang="ts">
import { type DateValue, parseDate } from "@internationalized/date";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-vue-next";
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui";
import { computed, ref, useTemplateRef } from "vue";
import { useOverlayTheme } from "../composables/use-overlay-theme";
import { formDateDisplay, formWeekStart, type ResolvedFormQuestion } from "../form-view";

/** A date question: a button showing the date in the form's language, and a calendar. */
const props = defineProps<{
  /** Id of the trigger, so the question's label points at it. */
  id: string;
  /** Id of the question label; the trigger is named by it and its date. */
  labelId: string;
  value: string;
  locale: string;
  placeholder: string;
  clearLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  /** Earliest and latest days that can be picked (`YYYY-MM-DD`). */
  min?: string;
  max?: string;
  /** The column's date format: the day shows as the table shows it. */
  format?: ResolvedFormQuestion["dateFormat"];
}>();
const emit = defineEmits<{ change: [value: string] }>();

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const open = ref(false);
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const shown = computed(() => formDateDisplay(props.value, props.locale, props.format));
const selected = computed<DateValue | undefined>(() =>
  shown.value ? parseDate(props.value) : undefined
);
const weekStart = computed(() => formWeekStart(props.locale) as WeekStart);
const dayOf = (value?: string): DateValue | undefined =>
  value && formDateDisplay(value, props.locale) ? parseDate(value) : undefined;
const minValue = computed(() => dayOf(props.min));
const maxValue = computed(() => dayOf(props.max));
const valueId = computed(() => `${props.id}-value`);
const setOpen = (next: boolean): void => {
  updateOpen(next);
  open.value = next;
};
const pick = (next: string): void => {
  emit("change", next);
  open.value = false;
};
const choose = (date: DateValue | undefined): void =>
  pick(date ? date.toString() : "");
</script>

<template>
  <span ref="anchor" class="yayaw-form-date-anchor">
    <PopoverRoot :open="open" @update:open="setOpen">
      <PopoverTrigger as-child>
        <button
          :id="id"
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-form-date"
          data-form-focus
          :disabled="disabled"
          :aria-labelledby="`${labelId} ${valueId}`"
          :aria-describedby="describedBy"
          :aria-invalid="invalid ? true : undefined"
          :aria-required="required || undefined"
        >
          <CalendarIcon :size="16" aria-hidden="true" class="yayaw-form-date-icon" />
          <span :id="valueId" class="yayaw-form-date-value" :data-empty="!shown || undefined">{{ shown ?? placeholder }}</span>
          <ChevronDown :size="16" aria-hidden="true" class="yayaw-form-date-icon" />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          class="yayaw-form-popover yayaw-form-calendar-popover"
          :style="overlayStyle"
          align="start"
          :side-offset="4"
          :collision-padding="8"
        >
          <CalendarRoot
            v-slot="{ weekDays, grid }"
            :model-value="selected"
            :default-placeholder="selected"
            :locale="locale"
            :week-starts-on="weekStart"
            :min-value="minValue"
            :max-value="maxValue"
            weekday-format="short"
            initial-focus
            class="yayaw-form-calendar"
            @update:model-value="choose($event as DateValue | undefined)"
          >
            <CalendarHeader class="yayaw-form-calendar-header">
              <CalendarPrev class="yayaw-button yayaw-button-ghost yayaw-form-calendar-nav">
                <ChevronLeft :size="16" aria-hidden="true" />
              </CalendarPrev>
              <CalendarHeading class="yayaw-form-calendar-heading" />
              <CalendarNext class="yayaw-button yayaw-button-ghost yayaw-form-calendar-nav">
                <ChevronRight :size="16" aria-hidden="true" />
              </CalendarNext>
            </CalendarHeader>
            <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="yayaw-form-calendar-grid">
              <CalendarGridHead>
                <CalendarGridRow class="yayaw-form-calendar-row">
                  <CalendarHeadCell v-for="day in weekDays" :key="day" class="yayaw-form-calendar-weekday">{{ day }}</CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow v-for="(week, index) in month.rows" :key="`week-${index}`" class="yayaw-form-calendar-row">
                  <CalendarCell v-for="day in week" :key="day.toString()" :date="day" class="yayaw-form-calendar-cell">
                    <CalendarCellTrigger :day="day" :month="month.value" class="yayaw-form-calendar-day" />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </CalendarRoot>
          <div v-if="shown" class="yayaw-form-calendar-footer">
            <button type="button" class="yayaw-button yayaw-button-ghost" @click="pick('')">{{ clearLabel }}</button>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </span>
</template>
