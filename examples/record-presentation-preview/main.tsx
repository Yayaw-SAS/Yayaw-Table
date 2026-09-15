import "./style.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { RecordPresentationExample } from "../record-presentation-react";

const client = new QueryClient();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <div>
          <RecordPresentationExample />
        </div>
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
