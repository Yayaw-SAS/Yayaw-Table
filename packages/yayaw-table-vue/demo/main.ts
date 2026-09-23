import { createApp } from "vue";
import App from "./App.vue";
import FormExample from "./FormExample.vue";
import RecordDetailsExample from "./RecordDetailsExample.vue";
import ViewsExample from "./ViewsExample.vue";
import "../src/styles.css";

const example = new URLSearchParams(window.location.search).get("example");
const examples = {
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
