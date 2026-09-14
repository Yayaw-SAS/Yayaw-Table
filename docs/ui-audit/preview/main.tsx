import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { ResponsiveToolbarExample } from "../../../examples/responsive-toolbar-react";
import { Proposals } from "./proposals";
import { TypeAudit } from "./type-audit";

const client = new QueryClient();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        {new URLSearchParams(window.location.search).has("current") ? (
          <main style={{ padding: 32, maxWidth: 1400, margin: "auto" }}>
            <ResponsiveToolbarExample />
            <div style={{ marginTop: 64 }}>
              <TypeAudit />
            </div>
          </main>
        ) : (
          <Proposals />
        )}
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
