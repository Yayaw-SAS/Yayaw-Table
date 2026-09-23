<script setup lang="ts">
import { computed, useSlots } from "vue";
import type { ColumnMappingRow } from "../../field-matching";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";

/** A select shown with the mapping (key field, separator, mode…). */
interface MappingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  heading?: string;
  inline?: boolean;
  onChange?: (value: string) => void;
}

/**
 * Column mapping, in either direction: each row pairs a field (a source
 * header, a table column) with a choice of what it goes to, with a sample
 * value, a badge counting values that will not convert, an optional key
 * select and a preview. Other settings of the same screen go before and
 * after, so touch layouts open every choice as one full-screen list.
 */
const props = defineProps<{
  rows: ColumnMappingRow[];
  before?: MappingField[];
  after?: MappingField[];
  /** "Match existing records by": which column identifies records. */
  keyField?: MappingField;
  preview?: {
    label: string;
    columns: { id: string; header: string }[];
    rows: { index: number; cells: { columnId: string; text: string; error?: string }[] }[];
  };
}>();
const emit = defineEmits<{ change: [id: string, value: string] }>();

const withHandler = (field: MappingField) => ({
  ...field,
  onChange: field.onChange ?? ((value: string) => emit("change", field.id, value)),
});
const fields = computed(() => [
  ...(props.before ?? []).map(withHandler),
  ...props.rows.map((row) => ({
    id: row.id,
    label: row.label,
    value: row.value,
    options: row.options,
    heading: row.heading,
    inline: true,
    onChange: (value: string) => emit("change", row.id, value),
  })),
  ...(props.keyField ? [withHandler(props.keyField)] : []),
  ...(props.after ?? []).map(withHandler),
]);
const details = computed(() => props.rows.filter((row) => row.sample || row.badge));
const slots = useSlots();
// Settings slots ("after-<id>") pass through to the panel; the default slot follows the preview.
const forwarded = computed(() => Object.keys(slots).filter((name) => name !== "default"));
</script>

<template>
  <div class="yayaw-column-mapping" data-column-mapping>
    <ViewSettingsPanel :fields="fields">
      <template v-for="row in details" #[`after-${row.id}`]>
        <div class="yayaw-mapping-details" :data-mapping-details="row.id">
          <span class="yayaw-mapping-sample" data-mapping-sample>{{ row.sample }}</span>
          <span v-if="row.badge" class="yayaw-mapping-badge" :data-invalid="row.badge.invalid || undefined" data-mapping-badge>
            {{ row.badge.label }}
          </span>
        </div>
      </template>
      <template v-for="name in forwarded" #[name]>
        <slot :name="name" />
      </template>
      <template #default>
      <div v-if="preview && preview.columns.length" class="yayaw-mapping-preview" data-mapping-preview>
        <h3 class="yayaw-setting-heading">{{ preview.label }}</h3>
        <div class="yayaw-mapping-preview-scroll">
          <table>
            <thead>
              <tr>
                <th v-for="column in preview.columns" :key="column.id" scope="col">{{ column.header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in preview.rows" :key="row.index">
                <td v-for="cell in row.cells" :key="cell.columnId" :class="{ 'yayaw-mapping-invalid': cell.error }"
                  :data-invalid="cell.error ? true : undefined" :title="cell.error ? `${cell.text} — ${cell.error}` : cell.text">
                  {{ cell.text }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <slot />
      </template>
    </ViewSettingsPanel>
  </div>
</template>
