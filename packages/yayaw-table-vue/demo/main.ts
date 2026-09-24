import { createApp } from "vue";
import App from "./App.vue";
import DashboardExample from "./DashboardExample.vue";
import FormExample from "./FormExample.vue";
import RecordDetailsExample from "./RecordDetailsExample.vue";
import ViewsExample from "./ViewsExample.vue";
import "../src/styles.css";

const example = new URLSearchParams(window.location.search).get("example");
// `?theme=dark` previews the dark tokens.
if (new URLSearchParams(window.location.search).get("theme") === "dark") {
  document.documentElement.classList.add("dark");
}
const examples = {
  dashboard: DashboardExample,
  form: FormExample,
  "record-details": RecordDetailsExample,
  views: ViewsExample,
};
// The views example without `aggregate`: charts fall back to the rows the list returns.
if (example === "views-fallback") {
  createApp(ViewsExample, { aggregate: false }).mount("#app");
} else {
  createApp(examples[example as keyof typeof examples] ?? App).mount("#app");
}
