<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
const baseline = ref("");
const fallbackActions = createLocalTableViewActions();
const actions = computed(() => ({ ...fallbackActions, ...context.actions.value?.views }));
const active = computed(() => views.value.find(view => view.id === context.state.activeViewId.value));
const dirty = computed(() => Boolean(active.value && baseline.value && baseline.value !== JSON.stringify(context.state.snapshot.value)));
const editable = computed(() => active.value && !active.value.isSystem && context.config.table.allowViewSave);
const translate = (key: string, fallback: string) => String(context.translations.value[key] ?? fallback);
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
const checkResult = <T,>(result: TableViewActionResult<T>) => {
  if (result.success === false || result.error) throw new Error(result.error ?? "View action failed");
  return result.data;
};
const selectView = (view: TableView) => {
  context.state.applyView(view.config, view.id);
  baseline.value = JSON.stringify(context.state.snapshot.value);
};
const run = async (action: () => Promise<void>): Promise<void> => {
  if (isSaving.value) return;
  isSaving.value = true;
  try { await action(); }
  catch (cause) {
    if (!disposed) context.status.value = { type: "error", message: cause instanceof Error ? cause.message : String(cause) };
  } finally { isSaving.value = false; }
};
const load = async (): Promise<void> => {
  const loaded = await actions.value.list?.({ tableId: context.config.id, tableType: context.tableType });
  if (disposed) return;
  const remote = Array.isArray(loaded) ? loaded : loaded ? checkResult(loaded) ?? [] : [];
  views.value = [...props.initialViews, ...remote.filter(view => !props.initialViews.some(initial => initial.id === view.id))];
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("view") ?? context.state.activeViewId.value;
  const hasUrlState = [...params.keys()].some(key => key.startsWith(`${context.config.id}-`));
  const selected = views.value.find(view => view.id === requested) ?? (!requested && !hasUrlState ? views.value.find(view => view.isDefault) : undefined);
  if (selected) selectView(selected);
};
const apply = (event: Event): void => {
  const view = views.value.find(item => item.id === (event.target as HTMLSelectElement).value);
  if (view) selectView(view);
  else { context.state.reset(); baseline.value = ""; }
};
const save = () => run(async () => {
  if (!name.value.trim()) return;
  const result = await actions.value.create?.({ tableId: context.config.id, name: name.value.trim(), config: context.state.snapshot.value, isGlobal: isGlobal.value });
  if (!result) throw new Error("View creation is unavailable");
  const view = checkResult(result);
  if (!view) throw new Error("The saved view was not returned");
  if (disposed) return;
  views.value.push(view);
  selectView(view);
  name.value = "";
  showSave.value = false;
});
const update = () => run(async () => {
  const view = active.value;
  if (!view || !editable.value) return;
  const config = JSON.parse(JSON.stringify(context.state.snapshot.value));
  const result = await actions.value.update?.(view.id, { config });
  if (!result) throw new Error("View update is unavailable");
  const saved = checkResult(result) ?? { ...view, config };
  if (disposed) return;
  views.value = views.value.map(item => item.id === saved.id ? saved : item);
  baseline.value = JSON.stringify(config);
});
const remove = () => run(async () => {
  const view = active.value;
  if (!view || !editable.value) return;
  const result = await actions.value.delete?.(view.id, { tableId: context.config.id });
  if (!result) throw new Error("View deletion is unavailable");
  checkResult(result);
  if (disposed) return;
  views.value = views.value.filter(item => item.id !== view.id);
  context.state.reset();
  baseline.value = "";
});
onMounted(() => run(load));
</script>

<template>
  <div class="yayaw-views">
    <select :disabled="isSaving" :value="context.state.activeViewId.value ?? ''" class="yayaw-select" :aria-label="String(context.translations.value.views)" @change="apply">
      <option value="">{{ context.translations.value.views }}</option>
      <option v-for="view in views" :key="view.id" :value="view.id">{{ view.name }}{{ view.isGlobal ? ` · ${translate('team', 'team')}` : '' }}</option>
    </select>
    <button v-if="context.config.table.allowViewSave" type="button" class="yayaw-button yayaw-button-ghost" @click="showSave = !showSave">
      {{ context.translations.value.saveView }}
    </button>
    <span v-if="dirty" role="status">{{ translate('viewModified', 'Modified') }}</span>
    <button v-if="editable" :disabled="isSaving || !dirty" type="button" class="yayaw-icon-button" :title="translate('updateView', 'Update view')" @click="update">↻</button>
    <button v-if="editable" :disabled="isSaving" type="button" class="yayaw-icon-button" :title="translate('deleteView', 'Delete view')" @click="remove">×</button>
    <form v-if="showSave" class="yayaw-save-view" @submit.prevent="save">
      <input v-model="name" class="yayaw-input" :aria-label="translate('viewName', 'View name')" :placeholder="translate('viewName', 'View name')" autofocus />
      <label v-if="context.config.table.allowViewSharing" class="yayaw-checkbox-label">
        <input v-model="isGlobal" type="checkbox" /> {{ translate('shareView', 'Share with team') }}
      </label>
      <button type="submit" class="yayaw-button" :disabled="isSaving || !name.trim()">{{ isSaving ? '…' : translate('save', 'Save') }}</button>
    </form>
  </div>
</template>
