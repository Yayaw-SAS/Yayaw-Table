import type {
  ConditionItem,
  FormRule,
  FormRuleEffect,
} from "../src/components/ui/yayaw-table/utils/form-conditions";
import {
  acceptPublicFormResponse,
  buildPublicFormSnapshot,
  type FormColumn,
  type FormItem,
  type FormLinkActions,
  type FormResponseMetadata,
  type FormSubmitMeta,
  type FormSubmitResult,
  formSettingsFromView,
  type PublicFormSnapshot,
  withFormServerContext,
} from "../src/components/ui/yayaw-table/utils/form-view";

/**
 * A pretend host for the examples: it keeps published forms and public
 * responses in localStorage, so the public form page (another tab, no table)
 * and the views table see the same data. A real host stores the snapshot in
 * its database, serves it on a public route and validates responses on its
 * server with `acceptPublicFormResponse`.
 */
const FORMS_KEY = "yayaw-demo-form-links";
const RESPONSES_KEY = "yayaw-demo-form-responses";
/** The last public response the host accepted, for the public page's result panel. */
const LAST_RESPONSE_KEY = "yayaw-demo-form-last-response";
/** Where the React and Vue tables keep the example's saved views. */
const SAVED_VIEW_KEYS = ["yayaw-table-views:views", "yayaw-table:views:views"];

export interface DemoPublishedForm {
  snapshot: PublicFormSnapshot;
  acceptsResponses: boolean;
  /** Counts the publications of the form, like a page revision. */
  revision?: number;
}

/** A public response as the demo host stored it: the record and its metadata. */
export interface DemoAcceptedResponse {
  values: Record<string, unknown>;
  metadata: FormResponseMetadata;
}

interface DemoView {
  id: string;
  config?: unknown;
}

const read = <T>(key: string, fallback: T): T => {
  try {
    const text = window.localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows may refuse storage; the demo then forgets links.
  }
};

const forms = () => read<Record<string, DemoPublishedForm>>(FORMS_KEY, {});

/** The public page of a view's form, on this demo's own origin. */
export const demoPublicFormUrl = (viewId: string) =>
  `${window.location.origin}${window.location.pathname}?example=form&form=${encodeURIComponent(viewId)}`;

// Rules of the Request forms ------------------------------------------------

const rule = (
  id: string,
  items: ConditionItem[],
  then: FormRuleEffect
): FormRule => ({ id, when: { join: "and", items }, then });

const categoryIs = (value: string): ConditionItem => ({
  fieldId: "category",
  operator: "is",
  value,
});

/** Hardware asks for a serial number and needs a budget; Other asks for more. */
export const requestRules: FormRule[] = [
  rule("hardware-serial", [categoryIs("Hardware")], {
    action: "show",
    questionIds: ["serialNumber"],
  }),
  rule("hardware-budget", [categoryIs("Hardware")], {
    action: "require",
    questionIds: ["price"],
  }),
  rule("other-details", [categoryIs("Other")], {
    action: "show",
    questionIds: ["details"],
  }),
];

/** A text in English and French. */
const t = (en: string, fr: string) => ({ en, fr });

/**
 * The request in English and French ("Wanted by" is left for the French
 * translation), a consent to the privacy policy and hidden fields reading the
 * campaign (`utm_source`, `utm_campaign`), the page and its language.
 */
const requestQuestions: FormItem[] = [
  {
    id: "name",
    columnId: "name",
    label: t("Project name", "Nom du projet"),
    placeholder: t("e.g. Golf rollout", "ex. déploiement Golf"),
    required: true,
  },
  {
    id: "category",
    columnId: "category",
    label: t("Category", "Catégorie"),
    required: true,
    optionLabels: {
      Software: t("Software", "Logiciel"),
      Hardware: t("Hardware", "Matériel"),
      Service: t("Service", "Service"),
      Other: t("Other", "Autre"),
    },
  },
  {
    id: "price",
    columnId: "price",
    label: t("Budget", "Budget"),
    help: t("In euros, excluding tax.", "En euros, hors taxes."),
  },
  {
    id: "serialNumber",
    columnId: "serialNumber",
    label: t("Serial number", "Numéro de série"),
    placeholder: t("e.g. SN-2041", "ex. SN-2041"),
  },
  {
    id: "details",
    columnId: "details",
    label: t("Tell us more", "Dites-nous en plus"),
  },
  { id: "dueDate", columnId: "dueDate", label: "Wanted by" },
  {
    id: "privacy",
    kind: "consent",
    text: t(
      "I agree that my request is processed as described in the {link}.",
      "J’accepte que ma demande soit traitée conformément à la {link}."
    ),
    link: {
      label: t("privacy policy", "politique de confidentialité"),
      href: "https://example.com/privacy",
    },
    version: "2026-09",
  },
  {
    id: "utm_source",
    kind: "hidden",
    source: { type: "urlParam", name: "utm_source" },
  },
  {
    id: "utm_campaign",
    kind: "hidden",
    source: { type: "urlParam", name: "utm_campaign" },
  },
  { id: "page", kind: "hidden", source: { type: "pageUrl" } },
  { id: "language", kind: "hidden", source: { type: "locale" } },
];

/** The "Request" form view shipped with the views example. */
export const requestFormView = {
  id: "request",
  tableId: "views",
  name: "Request",
  createdById: "demo",
  isGlobal: true,
  canEdit: false,
  canDelete: false,
  config: {
    displayMode: "form" as const,
    form: {
      defaultLocale: "en",
      title: t("Project request", "Demande de projet"),
      description: t(
        "Tell us about the project; we reply within two days.",
        "Parlez-nous du projet ; nous répondons sous deux jours."
      ),
      questions: requestQuestions,
      rules: requestRules,
      hiddenValues: { status: "Draft" },
      submitLabel: t("Send request", "Envoyer la demande"),
      successMessage: t(
        "Thank you! Your request is in the Draft column.",
        "Merci ! Votre demande est dans la colonne Draft."
      ),
    },
  },
};

/** The same request, one question at a time with a review before sending. */
export const guidedRequestFormView = {
  ...requestFormView,
  id: "guided-request",
  name: "Guided request",
  config: {
    displayMode: "form" as const,
    form: {
      ...requestFormView.config.form,
      title: t("Guided project request", "Demande de projet guidée"),
      layout: "steps" as const,
      review: true,
    },
  },
};

/** Settings of the Request form, as a host reads them from the saved view. */
export const requestFormSettings = formSettingsFromView(requestFormView);

const BUILT_IN_VIEWS: DemoView[] = [requestFormView, guidedRequestFormView];

/** The saved view as the host stores it: built-in, or saved by either example table. */
export function demoSavedView(viewId: string): DemoView | undefined {
  const saved = SAVED_VIEW_KEYS.flatMap((key) =>
    read<DemoView[]>(key, []).filter((view) => view && typeof view === "object")
  );
  return (
    saved.find((view) => view.id === viewId) ??
    BUILT_IN_VIEWS.find((view) => view.id === viewId)
  );
}

/**
 * The host's publishing endpoint. The snapshot is built here, from the saved
 * view and the host's own columns; a snapshot sent by the browser is ignored.
 */
export function createDemoFormLinks(
  columns: readonly FormColumn[]
): FormLinkActions {
  return {
    status: (viewId) => {
      const form = forms()[viewId];
      return Promise.resolve(
        form
          ? {
              published: true,
              url: demoPublicFormUrl(viewId),
              acceptsResponses: form.acceptsResponses,
            }
          : { published: false }
      );
    },
    publish: (viewId) => {
      const view = demoSavedView(viewId);
      if (!view) {
        return Promise.reject(new Error("Save this view before sharing it."));
      }
      const all = forms();
      all[viewId] = {
        snapshot: buildPublicFormSnapshot({ view, columns }),
        acceptsResponses: all[viewId]?.acceptsResponses ?? true,
        revision: (all[viewId]?.revision ?? 0) + 1,
      };
      write(FORMS_KEY, all);
      return Promise.resolve({ url: demoPublicFormUrl(viewId) });
    },
    unpublish: (viewId) => {
      const all = forms();
      Reflect.deleteProperty(all, viewId);
      write(FORMS_KEY, all);
      return Promise.resolve();
    },
    setAcceptingResponses: (viewId, accepting) => {
      const all = forms();
      const form = all[viewId];
      if (form) {
        form.acceptsResponses = accepting;
        write(FORMS_KEY, all);
      }
      return Promise.resolve();
    },
  };
}

export const demoPublishedForm = (
  viewId: string
): DemoPublishedForm | undefined => forms()[viewId];

/** Records sent through public or standalone forms, not yet in the table. */
export const demoFormResponses = () =>
  read<Record<string, unknown>[]>(RESPONSES_KEY, []);

export function saveDemoResponse(values: Record<string, unknown>) {
  const responses = demoFormResponses();
  responses.push({ ...values, id: `form-${Date.now()}-${responses.length}` });
  write(RESPONSES_KEY, responses);
}

/** The last public response the demo host accepted, with its metadata. */
export const demoLastResponse = () =>
  read<DemoAcceptedResponse | undefined>(LAST_RESPONSE_KEY, undefined);

/**
 * What the host's public submit endpoint does: re-validate the answers,
 * consents and hidden fields the browser sent (`onSubmit`'s meta), add what
 * the server knows, then save the record and keep its metadata apart.
 */
export function submitDemoPublicForm(
  viewId: string,
  values: Record<string, unknown>,
  meta?: Pick<FormSubmitMeta, "consents" | "fields" | "locale">
): FormSubmitResult {
  const form = demoPublishedForm(viewId);
  if (!form?.acceptsResponses) {
    return { ok: false, message: "This form is closed." };
  }
  const checked = acceptPublicFormResponse(form.snapshot, values, {
    consents: meta?.consents,
    fields: meta?.fields,
    locale: meta?.locale,
    acceptedAt: new Date(),
  });
  if (!checked.ok) {
    return { ok: false, errors: checked.errors };
  }
  const accepted = withFormServerContext(checked, {
    pageId: `form/${viewId}`,
    revision: form.revision ?? 1,
  });
  saveDemoResponse(accepted.values);
  write(LAST_RESPONSE_KEY, {
    values: accepted.values,
    metadata: accepted.metadata,
  } satisfies DemoAcceptedResponse);
  return { ok: true };
}
