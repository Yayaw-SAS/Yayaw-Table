import { createApp } from "vue";
import App from "./App.vue";
import RecordDetailsExample from "./RecordDetailsExample.vue";
import "../src/styles.css";

createApp(
  new URLSearchParams(window.location.search).get("example") ===
    "record-details"
    ? RecordDetailsExample
    : App
).mount("#app");
