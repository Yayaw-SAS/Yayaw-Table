<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import { createLocalTableViewActions } from "../../core";
import type { TableView, TableViewActionResult } from "../../types";

const props = defineProps<{ initialViews: TableView[] }>();
const context = useTableContext();
const views = ref<TableView[]>([...props.initialViews]);
const name = ref("");
const isGlobal = ref(false);
const isSaving = ref(false);
const showSave = ref(false);
const fallbackActions = createLocalTableViewActions();
const actions = computed(() => context.actions.value?.views ?? fallbackActions);

const unwrapList = (
  result: TableView[] | TableViewActionResult<TableView[]>
): TableView[] => (Array.isArray(result) ? result : (result.data ?? []));
const load = async (): Promise<void> => {
  if (!actions.value.list) {
    return;
  }
  const loaded = await actions.value.list({ tableId: context.config.id });
  const remoteViews = unwrapList(loaded);
  views.value = [
    ...props.initialViews,
    ...remoteViews.filter(
      (view) => !props.initialViews.some((initial) => initial.id === view.id)
    ),
  ];
  const active = views.value.find(
    (view) => view.id === context.state.activeViewId.value
  );
  if (active) {
    context.state.applyView(active.config, active.id);
  }
};
const apply = (event: Event): void => {
  const id = (event.target as HTMLSelectElement).value;
  const view = views.value.find((item) => item.id === id);
  if (view) {
    context.state.applyView(view.config, view.id);
  } else {
    context.state.reset();
  }
};
const save = async (): Promise<void> => {
  if (!(name.value.trim() && actions.value.create)) {
    return;
  }
  isSaving.value = true;
  const result = await actions.value.create({
    tableId: context.config.id,
    name: name.value.trim(),
    config: context.state.snapshot.value,
    isGlobal: isGlobal.value,
  });
  isSaving.value = false;
  if (result.data) {
    views.value.push(result.data);
    context.state.activeViewId.value = result.data.id;
  }
  name.value = "";
  showSave.value = false;
};
const update = async (): Promise<void> => {
  const id = context.state.activeViewId.value;
  if (!(id && actions.value.update)) {
    return;
  }
  await actions.value.update(id, { config: context.state.snapshot.value });
  await load();
};
const remove = async (): Promise<void> => {
  const id = context.state.activeViewId.value;
  if (!(id && actions.value.delete)) {
    return;
  }
  await actions.value.delete(id, { tableId: context.config.id });
  context.state.reset();
  await load();
};
onMounted(async () => {
  await load();
});
</script>

<template>
  <div class="yayaw-views">
    <select :value="context.state.activeViewId.value ?? ''" class="yayaw-select" :aria-label="String(context.translations.value.views)" @change="apply">
      <option value="">{{ context.translations.value.views }}</option>
      <option v-for="view in views" :key="view.id" :value="view.id">{{ view.name }}{{ view.isGlobal ? ' · team' : '' }}</option>
    </select>
    <button v-if="context.config.table.allowViewSave" type="button" class="yayaw-button yayaw-button-ghost" @click="showSave = !showSave">
      {{ context.translations.value.saveView }}
    </button>
    <button v-if="context.state.activeViewId.value && context.config.table.allowViewSave" type="button" class="yayaw-icon-button" title="Update view" @click="update">↻</button>
    <button v-if="context.state.activeViewId.value && context.config.table.allowViewSave" type="button" class="yayaw-icon-button" title="Delete view" @click="remove">×</button>
    <form v-if="showSave" class="yayaw-save-view" @submit.prevent="save">
      <input v-model="name" class="yayaw-input" placeholder="View name" autofocus />
      <label v-if="context.config.table.allowViewSharing" class="yayaw-checkbox-label">
        <input v-model="isGlobal" type="checkbox" /> Share with team
      </label>
      <button type="submit" class="yayaw-button" :disabled="isSaving || !name.trim()">{{ isSaving ? '…' : 'Save' }}</button>
    </form>
  </div>
</template>
