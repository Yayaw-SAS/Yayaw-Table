<script setup lang="ts">
// Only the standalone form: no table, no table state, no provider.
import YayawTableForm from "../src/form/YayawTableForm.vue";
import {
  demoPublishedForm,
  requestFormSettings,
  saveDemoResponse,
  submitDemoPublicForm,
} from "../../../examples/form-links";
import { viewsColumns } from "../../../examples/views";

/**
 * `?example=form&form=<viewId>` renders a published form; `?example=form`
 * shows the standalone component with the Request view's settings.
 */
const viewId = new URLSearchParams(window.location.search).get("form");
const published = viewId ? demoPublishedForm(viewId) : undefined;
const submitPublic = (values: Record<string, unknown>) =>
  submitDemoPublicForm(viewId ?? "", values);
const submitStandalone = (values: Record<string, unknown>) => {
  saveDemoResponse(values);
  return { ok: true as const };
};
</script>

<template>
  <main class="form-example">
    <template v-if="viewId">
      <YayawTableForm
        v-if="published"
        :columns="published.snapshot.columns"
        :form="published.snapshot.form"
        :closed="!published.acceptsResponses"
        :on-submit="submitPublic"
      />
      <p v-else class="form-example-note" role="status">This form is not published.</p>
    </template>
    <template v-else>
      <header>
        <h1>Standalone form</h1>
        <p class="form-example-note">
          <code>YayawTableForm</code> outside a table. Responses join the
          <a href="?example=views">views example</a>.
        </p>
      </header>
      <section aria-label="Standalone form" class="form-example-card">
        <YayawTableForm :columns="viewsColumns" :form="requestFormSettings" :on-submit="submitStandalone" />
      </section>
    </template>
  </main>
</template>

<style>
/* Same page as the React preview, so the two editions compare on equal terms. */
body:has(.form-example) {
  margin: 0;
  background: #fff;
  color: oklch(0.145 0 0);
  font-family: system-ui, sans-serif;
}
</style>
<style scoped>
.form-example { box-sizing: border-box; max-width: 48rem; margin: auto; padding: 2rem 1rem; display: grid; gap: 1.5rem; }
.form-example h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0 0 0.25rem; }
.form-example-note { margin: 0; color: oklch(0.556 0 0); font-size: 14px; }
.form-example-note a { color: inherit; }
.form-example-card { border: 1px solid oklch(0.922 0 0); border-radius: 0.625rem; padding: 1.5rem 1rem; }
@media (min-width: 640px) {
  .form-example { padding: 2rem 1.5rem; }
  .form-example-card { padding: 1.5rem 2rem; }
}
</style>
