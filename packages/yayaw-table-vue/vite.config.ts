import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "yayaw-table-vue",
    },
    rollupOptions: {
      external: ["lucide-vue-next", "vue", "vue-sonner"],
      output: {
        globals: { "lucide-vue-next": "LucideVueNext", vue: "Vue" },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Node 25+ defines its own localStorage global, left undefined without
    // --localstorage-file, which hides the jsdom one from the tests.
    poolOptions: {
      forks: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
});
