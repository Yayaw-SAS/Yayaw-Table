<script setup lang="ts">
import { computed, ref, useId } from "vue";
import type { ConnectorT, ConnectorTargetParent } from "../../connector-flow";
import TableSelect from "../controls/TableSelect.vue";

/** "Create one from this table’s columns…": where, a name, then Create. */
const props = defineProps<{
  parents: ConnectorTargetParent[] | null;
  creating: boolean;
  name: string;
  t: ConnectorT;
}>();
const emit = defineEmits<{ create: [input: { parentId?: string; title: string }]; cancel: [] }>();
const id = useId();
const title = ref("");
const chosen = ref<string>();
const options = computed(() => (props.parents ?? []).map((item) => ({ value: item.id, label: item.label })));
const parent = computed({
  get: () => chosen.value ?? options.value[0]?.value ?? "",
  set: (value: string) => {
    chosen.value = value;
  },
});
const submit = (): void => {
  emit("create", { title: title.value, ...(parent.value ? { parentId: parent.value } : {}) });
};
</script>

<template>
  <form class="yayaw-connector-create" :aria-label="t('createTargetTitle', { target: name })" data-connector-create
    @submit.prevent="submit">
    <h3>{{ t("createTargetTitle", { target: name }) }}</h3>
    <TableSelect v-if="options.length" v-model="parent" :label="t('createParent')" :options="options" />
    <div class="yayaw-connector-input">
      <label :for="`${id}-name`">{{ t("createName") }}</label>
      <input :id="`${id}-name`" v-model="title" class="yayaw-input" />
    </div>
    <div class="yayaw-schedule-actions">
      <button type="submit" class="yayaw-button" :disabled="creating" :aria-busy="creating">
        <span v-if="creating" class="yayaw-spinner" aria-hidden="true" />{{ creating ? t("creatingTarget") : t("createSubmit") }}
      </button>
      <button type="button" class="yayaw-button yayaw-button-outline" :disabled="creating" @click="emit('cancel')">
        {{ t("cancel") }}
      </button>
    </div>
  </form>
</template>
