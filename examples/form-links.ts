import type {
  ConditionItem,
  FormRule,
  FormRuleEffect,
} from "../src/components/ui/yayaw-table/utils/form-conditions";
import {
  acceptPublicFormResponse,
  buildPublicFormSnapshot,
  type FormColumn,
  type FormLinkActions,
  type FormSubmitResult,
  formSettingsFromView,
  type PublicFormSnapshot,
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
/** Where the React and Vue tables keep the example's saved views. */
const SAVED_VIEW_KEYS = ["yayaw-table-views:views", "yayaw-table:views:views"];

export interface DemoPublishedForm {
  snapshot: PublicFormSnapshot;
  acceptsResponses: boolean;
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

const requestQuestions = [
  {
    id: "name",
    columnId: "name",
    label: "Project name",
    placeholder: "e.g. Golf rollout",
    required: true,
  },
  { id: "category", columnId: "category", required: true },
  {
    id: "price",
    columnId: "price",
    label: "Budget",
    help: "In euros, excluding tax.",
  },
  {
    id: "serialNumber",
    columnId: "serialNumber",
    label: "Serial number",
    placeholder: "e.g. SN-2041",
  },
  { id: "details", columnId: "details", label: "Tell us more" },
  { id: "dueDate", columnId: "dueDate", label: "Wanted by" },
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
      title: "Project request",
      description: "Tell us about the project; we reply within two days.",
      questions: requestQuestions,
      rules: requestRules,
      hiddenValues: { status: "Draft" },
      submitLabel: "Send request",
      successMessage: "Thank you! Your request is in the Draft column.",
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
      title: "Guided project request",
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

/** What the host's public submit endpoint does: re-validate, then save. */
export function submitDemoPublicForm(
  viewId: string,
  values: Record<string, unknown>
): FormSubmitResult {
  const form = demoPublishedForm(viewId);
  if (!form?.acceptsResponses) {
    return { ok: false, message: "This form is closed." };
  }
  const checked = acceptPublicFormResponse(form.snapshot, values);
  if (!checked.ok) {
    return { ok: false, errors: checked.errors };
  }
  saveDemoResponse(checked.values);
  return { ok: true };
}
