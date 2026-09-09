import type {
  DetailActivity,
  DetailRecord,
  DetailSection,
  RecordDetailsConfig,
} from "../src/components/ui/yayaw-table/utils/record-details";
import {
  canRevertDetailActivity,
  detailActivity,
} from "../src/components/ui/yayaw-table/utils/record-details";

/** Fictional audit entries used only by the interactive walkthrough. */
export const recordActivity: DetailActivity[] = [
  {
    id: "event-3",
    actor: { name: "Camille Martin" },
    at: "2026-09-09T08:42:00Z",
    action: "a mis à jour le budget et le statut",
    changes: [
      { field: "budget", before: 12_000, after: 15_000 },
      { field: "status", before: "draft", after: "ready" },
    ],
  },
  {
    id: "event-2",
    actor: { name: "Alex Dubois" },
    at: "2026-09-08T13:16:00Z",
    action: "a ajouté les documents et les contacts",
    changes: [
      { field: "contacts", before: ["camille"], after: ["camille", "alex"] },
      {
        field: "files",
        before: [],
        after: [
          {
            name: "Brief de campagne.pdf",
            url: "https://example.com/brief.pdf",
          },
          {
            name: "Visuels de la collection.zip",
            url: "https://example.com/visuels.zip",
          },
        ],
      },
    ],
  },
  {
    id: "event-1",
    actor: { name: "Camille Martin" },
    at: "2026-09-07T07:30:00Z",
    action: "a créé cette entrée",
  },
];

export const detailExampleRow: DetailRecord = {
  id: "CAM-2026-042",
  name: "Lancement collection Automne",
  reference: "AUTOMNE-26",
  description:
    "Présenter la nouvelle collection aux médias et aux créateurs.\nUne campagne pensée pour des rencontres et des histoires qui durent.",
  status: "ready",
  priority: "high",
  tags: ["presse", "lifestyle", "france"],
  category: "launch",
  segment: "premium",
  budget: 15_000,
  reach: 0,
  active: true,
  approved: true,
  archived: false,
  launchDate: "2026-09-22",
  appointment: "2026-09-22T08:00:00Z",
  email: "camille@example.com",
  phone: "+33 6 12 34 56 78",
  url: "https://example.com/collection-automne",
  image:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=700&auto=format&fit=crop&q=80",
  contacts: ["camille", "alex"],
  files: [
    { name: "Brief de campagne.pdf", url: "https://example.com/brief.pdf" },
    {
      name: "Visuels de la collection.zip",
      url: "https://example.com/visuels.zip",
    },
  ],
  deliveries: [
    { media: "Maison & Style", quantity: 2, sent: true },
    { media: "Studio Magazine", quantity: 1, sent: false },
  ],
  metadata: { source: "PR Vision", languages: ["fr", "en"], exclusive: false },
  code: 'if (campaign.status === "ready") {\n  scheduleLaunch(campaign.launchDate);\n}',
  dynamicKind: "number",
  dynamic: 42,
  valueKind: "boolean",
  typedValue: false,
  derivedKind: "string",
  derivedValue: "3 médias sélectionnés",
  score: 82,
  secret: "demo-secret-not-for-display",
  notes: null,
  updatedAt: "2026-09-09T08:42:00Z",
  updatedBy: "Camille Martin",
  audit: recordActivity,
};

const statusOptions = [
  { value: "draft", label: "Brouillon" },
  { value: "ready", label: "Prêt à lancer" },
];
export const recordSections: DetailSection[] = [
  {
    id: "overview",
    title: "À propos de cette campagne",
    fields: [
      { id: "name", label: "Nom", type: "text" },
      { id: "reference", label: "Référence", type: "string" },
      { id: "description", label: "Description", type: "textarea" },
      { id: "status", label: "Statut", type: "select", options: statusOptions },
      {
        id: "priority",
        label: "Priorité",
        type: "radio",
        options: [{ value: "high", label: "Haute" }],
      },
      {
        id: "tags",
        label: "Étiquettes",
        type: "multiSelect",
        options: [
          { value: "presse", label: "Presse" },
          { value: "lifestyle", label: "Lifestyle" },
          { value: "france", label: "France" },
        ],
      },
      {
        id: "category",
        label: "Catégorie",
        type: "select-with-add-new",
        options: [{ value: "launch", label: "Lancement" }],
      },
      {
        id: "segment",
        label: "Segment",
        type: "tag",
        options: [{ value: "premium", label: "Premium" }],
      },
    ],
  },
  {
    id: "planning",
    title: "Planning & indicateurs",
    fields: [
      {
        id: "budget",
        label: "Budget",
        type: "number",
        numberFormat: {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        },
      },
      { id: "reach", label: "Retombées à ce jour", type: "number" },
      { id: "launchDate", label: "Lancement", type: "date" },
      { id: "appointment", label: "Rendez-vous presse", type: "datetime" },
      { id: "active", label: "Campagne active", type: "boolean" },
      { id: "approved", label: "Brief validé", type: "checkbox" },
      { id: "archived", label: "Archivée", type: "switch" },
      { id: "score", label: "Préparation", type: "custom" },
    ],
  },
  {
    id: "people",
    title: "Contacts & liens",
    fields: [
      {
        id: "contacts",
        label: "Équipe projet",
        type: "tablePicker",
        options: [
          { value: "camille", label: "Camille Martin" },
          { value: "alex", label: "Alex Dubois" },
        ],
      },
      { id: "email", label: "E-mail", type: "email" },
      { id: "phone", label: "Téléphone", type: "tel" },
      { id: "url", label: "Page de la collection", type: "url" },
    ],
  },
  {
    id: "resources",
    title: "Visuels & documents",
    fields: [
      { id: "image", label: "Visuel de campagne", type: "image" },
      { id: "files", label: "Pièces jointes", type: "files" },
      { id: "deliveries", label: "Envois presse", type: "collection" },
    ],
  },
  {
    id: "technical",
    title: "Données complémentaires",
    description:
      "Les données structurées restent consultables dans leur intégralité.",
    fields: [
      { id: "metadata", label: "Métadonnées", type: "json" },
      { id: "code", label: "Automatisation", type: "code" },
      {
        id: "dynamic",
        label: "Valeur dynamique",
        type: "dynamicType",
        typeKey: "dynamicKind",
      },
      {
        id: "typedValue",
        label: "Valeur typée",
        type: "value-type",
        typeKey: "valueKind",
      },
      {
        id: "derivedValue",
        label: "Valeur calculée",
        type: "dynamic-value",
        typeKey: "derivedKind",
      },
      { id: "secret", label: "Clé d’accès", type: "password" },
      { id: "notes", label: "Notes internes", type: "textarea" },
    ],
  },
];

export const recordDetailsConfig: RecordDetailsConfig = {
  title: (row) => String(row.name),
  description: () => "Campagne · Relations presse · Automne 2026",
  updatedAt: (row) => String(row.updatedAt),
  updatedBy: (row) => String(row.updatedBy),
  activity: (row) => row.audit as DetailActivity[],
  sections: recordSections,
};

export const recordExampleColumns = [
  { id: "name", header: "Campagne", type: "text" as const },
  {
    id: "status",
    header: "Statut",
    type: "select" as const,
    options: statusOptions,
  },
  {
    id: "budget",
    header: "Budget",
    type: "number" as const,
    numberFormat: { currency: "EUR", locale: "fr-FR" },
  },
  { id: "launchDate", header: "Lancement", type: "date" as const },
  {
    id: "updatedAt",
    header: "Mise à jour",
    type: "date" as const,
    accessorFn: (row: DetailRecord) => row.updatedAt,
  },
  { id: "actions", header: "Actions", type: "actions" as const },
];

/** Demo-only mutation log. Production applications should record authenticated actors on the server. */
export function updateExampleRecord(
  row: DetailRecord,
  patch: DetailRecord
): DetailRecord {
  const changes = recordSections
    .flatMap((section) => section.fields)
    .filter(
      (field) =>
        Object.hasOwn(patch, field.id) &&
        JSON.stringify(row[field.id]) !== JSON.stringify(patch[field.id])
    )
    .map((field) => ({
      field: field.id,
      before: row[field.id],
      after: patch[field.id],
    }));
  if (!changes.length) {
    return { ...row, ...patch };
  }
  const now = new Date().toISOString();
  const entry: DetailActivity = {
    id: crypto.randomUUID(),
    actor: { name: "Vous · démo" },
    at: now,
    action: "avez modifié cette entrée",
    changes,
  };
  return {
    ...row,
    ...patch,
    updatedAt: now,
    updatedBy: "Vous · démo",
    audit: [entry, ...(row.audit as DetailActivity[])],
  };
}

/** Restore prior values and append an audit event atomically in this in-memory demo. */
export function revertExampleRecord(
  row: DetailRecord,
  requested: DetailActivity
): DetailRecord {
  const activity = detailActivity(recordDetailsConfig, row);
  const entry = activity.find((item) => item.id === requested.id);
  if (
    !(
      entry &&
      canRevertDetailActivity(entry, activity) &&
      entry.changes?.every(
        (change) =>
          JSON.stringify(row[change.field]) === JSON.stringify(change.after)
      )
    )
  ) {
    throw new Error(
      "Cette modification ne peut plus être annulée : les champs ont changé depuis."
    );
  }
  const restored = { ...row };
  const changes = entry.changes.map((change) => {
    restored[change.field] = change.before;
    return {
      field: change.field,
      before: row[change.field],
      after: change.before,
    };
  });
  const now = new Date().toISOString();
  const undo: DetailActivity = {
    id: crypto.randomUUID(),
    at: now,
    actor: { name: "Vous · démo" },
    action: `avez annulé la modification de ${entry.actor.name}`,
    reverts: entry.id,
    changes,
  };
  return {
    ...restored,
    updatedAt: now,
    updatedBy: "Vous · démo",
    audit: [undo, ...activity],
  };
}
