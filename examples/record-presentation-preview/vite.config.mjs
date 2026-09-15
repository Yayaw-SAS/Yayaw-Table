import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
export default {
  plugins: [tailwindcss()],
  root: fileURLToPath(new URL("./", import.meta.url)),
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: "@/components", replacement: `${root}src/components` },
      { find: "@/lib", replacement: `${root}src/lib` },
      { find: "@/hooks", replacement: `${root}src/hooks` },
      { find: "@", replacement: root },
    ],
  },
  server: { fs: { allow: [root] }, host: "127.0.0.1", port: 5176 },
};
