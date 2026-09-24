import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AssetsExample } from "../assets-react";
import { DashboardExample } from "../dashboard-react";
import { DefaultSortExample } from "../default-sort-react";
import { FeedExample } from "../feed-react";
import { FormExample } from "../form-react";
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
  if (example === "assets") {
    return <AssetsExample />;
  }
  if (example === "assets-fallback") {
    return <AssetsExample scopes={false} />;
  }
  if (example === "views-fallback") {
    return <ViewsExample aggregate={false} />;
  }
  if (example === "dashboard") {
    return <DashboardExample />;
  }
  if (example === "default-sort") {
    return <DefaultSortExample />;
  }
  if (example === "feed") {
    return <FeedExample />;
  }
  return <RecordPresentationExample />;
};
// `?theme=dark` previews the dark tokens.
if (new URLSearchParams(window.location.search).get("theme") === "dark") {
  document.documentElement.classList.add("dark");
}
const root = document.getElementById("root");
if (root && example === "form") {
  // The standalone form needs none of the table's providers.
  createRoot(root).render(<FormExample />);
} else if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <div>{renderExample()}</div>
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
