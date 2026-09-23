import { createApp } from "vue";
import App from "./App.vue";
import RecordDetailsExample from "./RecordDetailsExample.vue";
import ViewsExample from "./ViewsExample.vue";
import "../src/styles.css";

const example = new URLSearchParams(window.location.search).get("example");
const examples = {
  "record-details": RecordDetailsExample,
  views: ViewsExample,
};
createApp(examples[example as keyof typeof examples] ?? App).mount("#app");
