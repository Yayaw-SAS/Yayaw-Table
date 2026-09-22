import { useMemo, useState } from "react";
import { ServerKanbanView } from "../src/components/ui/yayaw-table/components/server-kanban-view";
import { exampleServerKanban } from "./server-kanban";

export function ServerKanbanExample() {
  const [opened, setOpened] = useState("");
  const source = useMemo(
    () => exampleServerKanban((row) => setOpened(String(row.name))),
    []
  );
  return (
    <main>
      <h1>Server Kanban · React</h1>
      <p>
        Five records, independent pages, an empty lane and a recoverable error.
      </p>
      <output>{opened}</output>
      <ServerKanbanView
        columns={[{ id: "owner", header: "Owner", type: "text" }]}
        propertyIds={["owner"]}
        source={source}
        titleColumn="name"
      />
    </main>
  );
}
