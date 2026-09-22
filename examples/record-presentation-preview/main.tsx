import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { RecordPresentationExample } from "../record-presentation-react";
import { ServerKanbanExample } from "../server-kanban-react";

const client = new QueryClient();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <div>
          {new URLSearchParams(window.location.search).get("example") ===
          "server-kanban" ? (
            <ServerKanbanExample />
          ) : (
            <RecordPresentationExample />
          )}
        </div>
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
