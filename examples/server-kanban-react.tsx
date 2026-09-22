import { useMemo, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { exampleServerKanban } from "./server-kanban";

export function ServerKanbanExample() {
  const [opened, setOpened] = useState("");
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "server-board-demo",
        columns: {
          definitions: [
            { id: "name", header: "Name", type: "text" },
            {
              id: "owner",
              header: "Owner",
              type: "text",
              filterRenderer: ({ value, onChange }) => (
                <select
                  aria-label="Owner filter"
                  onChange={(event) => onChange(event.target.value)}
                  value={String(value ?? "")}
                >
                  <option value="">Everyone</option>
                  <option value="Morgan">Morgan</option>
                </select>
              ),
            },
            {
              id: "stage",
              header: "Stage",
              type: "text",
              enableGrouping: true,
            },
          ],
          order: ["name", "owner", "stage"],
          visible: ["name", "owner"],
          mandatory: [],
        },
        table: {
          syncUrl: false,
          defaultDisplayMode: "kanban",
          displayModes: ["kanban"],
          allowCreate: false,
          allowEdit: false,
          allowDelete: false,
          enableRowSelection: false,
          showClearFilters: true,
          showResetFilters: true,
          kanban: {
            groupBy: "stage",
            titleColumn: "name",
            cardColumnIds: ["owner"],
            server: exampleServerKanban((row) => setOpened(String(row.name))),
          },
        },
        translations: { namespace: "demo", keys: { title: "Server Kanban" } },
      }),
    []
  );
  return (
    <main>
      <h1>Server Kanban · React</h1>
      <p>
        Five records, independent pages, an empty lane and a recoverable error.
      </p>
      <output>{opened}</output>
      <DataTable
        getTableConfig={() => config}
        initialData={[]}
        initialPageCount={1}
        initialRowCount={0}
        tableType={config.id}
      />
    </main>
  );
}
