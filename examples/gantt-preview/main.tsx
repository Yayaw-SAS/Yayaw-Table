import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { GanttExample } from "../gantt-react";
import { GanttRowsExample } from "../gantt-rows-react";

const client = new QueryClient();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <main style={{ padding: 32, maxWidth: 1400, margin: "auto" }}>
          {new URLSearchParams(window.location.search).get("example") ===
          "rows" ? (
            <GanttRowsExample />
          ) : (
            <GanttExample />
          )}
        </main>
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
