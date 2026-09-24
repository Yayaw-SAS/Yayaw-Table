<script setup lang="ts">
// Only the standalone form: no table, no table state, no provider.
import { ref } from "vue";
import YayawTableForm from "../src/form/YayawTableForm.vue";
import type { FormSubmitMeta } from "../src/form-view";
import {
  type DemoAcceptedResponse,
  demoLastResponse,
  demoPublishedForm,
  requestFormSettings,
  saveDemoResponse,
  submitDemoPublicForm,
} from "../../../examples/form-links";
import { viewsColumns } from "../../../examples/views";

/**
 * `?example=form&form=<viewId>` renders a published form (`&lang=fr` in
 * French); `?example=form` shows the standalone component with the Request
 * view's settings.
 */
const params = new URLSearchParams(window.location.search);
const viewId = params.get("form");
const locale = params.get("lang") ?? "en";
document.documentElement.lang = locale;
const published = viewId ? demoPublishedForm(viewId) : undefined;
/** What the host's server accepted: the record and its metadata. */
const result = ref<DemoAcceptedResponse>();
const submitPublic = (values: Record<string, unknown>, meta: FormSubmitMeta) =>
  submitDemoPublicForm(viewId ?? "", values, meta);
const showResult = () => {
  result.value = demoLastResponse();
};
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
        :locale="locale"
        :on-submit="submitPublic"
        :on-success="showResult"
      />
      <p v-else class="form-example-note" role="status">This form is not published.</p>
      <section v-if="result" class="form-example-result" aria-labelledby="demo-result-title" data-demo-result>
        <h2 id="demo-result-title">Response received by the host</h2>
        <p class="form-example-note">The record and its metadata, as the host's server accepted them.</p>
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </section>
    </template>
    <template v-else>
      <header>
        <h1>Standalone form</h1>
        <p class="form-example-note">
          <code>YayawTableForm</code> outside a table. Responses join the
          <a href="?example=views">views example</a>.
        </p>
      </header>
      <section aria-label="Standalone form">
        <YayawTableForm :columns="viewsColumns" :form="requestFormSettings" :locale="locale" :on-submit="submitStandalone" />
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
.form-example-result { display: grid; gap: 0.5rem; border: 1px solid oklch(0.922 0 0); border-radius: 0.5rem; background: oklch(0.97 0 0 / 0.4); padding: 1rem; }
.form-example-result h2 { margin: 0; font-size: 14px; font-weight: 500; }
.form-example-result .form-example-note { font-size: 12px; }
.form-example-result pre { max-height: 24rem; overflow: auto; margin: 0; border-radius: 0.375rem; background: #fff; padding: 0.75rem; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
@media (min-width: 640px) {
  .form-example { padding: 2rem 1.5rem; }
}
</style>
