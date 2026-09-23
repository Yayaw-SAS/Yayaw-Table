import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { RecordPresentationExample } from "../record-presentation-react";
import { ServerKanbanExample } from "../server-kanban-react";
import { ViewsExample } from "../views-react";

const client = new QueryClient();
const example = new URLSearchParams(window.location.search).get("example");
const renderExample = () => {
  if (example === "server-kanban") {
    return <ServerKanbanExample />;
  }
  if (example === "views") {
    return <ViewsExample />;
  }
  return <RecordPresentationExample />;
};
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <div>{renderExample()}</div>
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
