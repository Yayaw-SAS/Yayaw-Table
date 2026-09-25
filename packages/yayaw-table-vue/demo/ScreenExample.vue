<script setup lang="ts">
import { h, provide, ref } from "vue";
import { Toaster } from "vue-sonner";
import { defineTableConfig, type TableActions, type TableView } from "../src";
import YayawDataTable from "../src/components/YayawDataTable.vue";
import type { DashboardOpenViewContext } from "../src/dashboard/dashboard-model";
import type {
  DashboardBlockRegistry,
  DashboardTableSource,
} from "../src/dashboard/dashboard-types";
import YayawDashboard from "../src/dashboard/YayawDashboard.vue";
import {
  createScreenHost,
  createScreenStorage,
  SCREEN_BLOCKS,
  type ScreenSourceSpec,
  screenText,
} from "../../../examples/screen";
import {
  AttentionBlock,
  AttentionSettings,
  ShortcutsBlock,
  screenHostKey,
} from "./screen-blocks";

// "Content admin": a screen whose sources load on demand from the host's
// catalogue, with host blocks and the Pages list page. `?readonly` shows it
// without edit rights, `?hide` hides unavailable widgets, `?lang=fr` shows it
// in French (the table labels are built in).
const search = new URLSearchParams(window.location.search);
const canEdit = !search.has("readonly");
const locale = search.get("lang") === "fr" ? "fr" : "en";
const unavailableWidgets = search.has("hide") ? "hide" : "show";

/** Each catalogue source as a Vue table; the Pages list page is wrapped by the host. */
const buildSource = (spec: ScreenSourceSpec): DashboardTableSource => {
  const name = screenText(spec.name, locale);
  return {
    name,
    config: defineTableConfig({
      id: spec.id,
      columns: {
        definitions: spec.columns as never,
        order: spec.columns.map((column) => String(column.id)),
        visible: spec.visible,
        mandatory: spec.mandatory,
      },
      table: spec.table as never,
      translations: { namespace: spec.id, keys: { title: name } },
    }),
    actions: spec.actions as unknown as TableActions,
    views: spec.views as unknown as TableView[],
    ...(spec.id === "pages"
      ? {
          renderTable: (props: Record<string, unknown>) =>
            h("div", { "data-host-table": "" }, [h(YayawDataTable, props as never)]),
        }
      : {}),
  };
};
const host = createScreenHost(buildSource);
provide(screenHostKey, host);
const storage = createScreenStorage();
const blocks: DashboardBlockRegistry = {
  shortcuts: { ...SCREEN_BLOCKS.shortcuts, component: ShortcutsBlock },
  attention: {
    ...SCREEN_BLOCKS.attention,
    component: AttentionBlock,
    settings: AttentionSettings,
  },
};
const opened = ref("");
const openView = (tableId: string, viewId: string | null, context?: DashboardOpenViewContext) => {
  opened.value = `${tableId} › ${viewId ?? "default"}${context?.view ? " (inline)" : ""}`;
};
</script>

<template>
  <main class="dashboard-example">
    <div class="dashboard-example-inner">
      <YayawDashboard
        :actions="{ dashboards: storage }"
        :sources="host.sources"
        :blocks="blocks"
        :can-edit="canEdit"
        dashboard-id="content-admin"
        :open-view="openView"
        :get-row-id="(row) => String(row.id)"
        :locale="locale"
        :unavailable-widgets="unavailableWidgets"
      />
      <output v-if="opened" class="dashboard-example-opened" data-dashboard-opened="">{{ opened }}</output>
    </div>
    <Toaster position="bottom-right" />
  </main>
</template>

<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.dashboard-example) {
  margin: 0;
  background: var(--yayaw-background);
  color: var(--yayaw-foreground);
  font-family: system-ui, sans-serif;
}
/* The demo host's blocks. */
.screen-block-list {
  display: grid;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.screen-block-link {
  border: 0;
  background: none;
  padding: 0;
  color: inherit;
  font: inherit;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  text-underline-offset: 4px;
  cursor: pointer;
}
.screen-block-link:hover {
  text-decoration: underline;
}
.screen-block-settings {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  border: 0;
  padding: 0;
  font-size: 14px;
}
.screen-block-settings legend {
  margin-bottom: 0.25rem;
  padding: 0;
  font-weight: 500;
}
.screen-block-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
<style scoped>
.dashboard-example { box-sizing: border-box; min-height: 100vh; padding: 1rem 1.5rem; }
.dashboard-example-inner { max-width: 80rem; margin: auto; }
.dashboard-example-opened {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  border: 1px solid var(--yayaw-border);
  border-radius: var(--yayaw-radius);
  background: var(--yayaw-background);
  padding: 0.5rem 0.75rem;
  color: var(--yayaw-muted-foreground);
  font-size: 14px;
  box-shadow: var(--yayaw-shadow-xs);
}
@media (max-width: 639px) { .dashboard-example { padding: 1rem; } }
</style>
