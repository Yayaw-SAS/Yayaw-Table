import assert from "node:assert/strict";
import type * as Text from "../src/components/ui/yayaw-table/utils/form-text";
import type * as Form from "../src/components/ui/yayaw-table/utils/form-view";

type FormModule = Pick<
  typeof Form,
  | "acceptFormHiddenFields"
  | "acceptPublicFormResponse"
  | "addFormConsent"
  | "addFormHiddenField"
  | "buildPublicFormSnapshot"
  | "collectFormHiddenFields"
  | "evaluateFormView"
  | "formAddableLocales"
  | "formConsentParts"
  | "formHiddenFieldColumns"
  | "formItemMissingTranslation"
  | "formLabel"
  | "formLocales"
  | "formReviewConsents"
  | "formSettingsRows"
  | "formStepOptional"
  | "formStepPlan"
  | "formSteps"
  | "formSubmission"
  | "formViewLocales"
  | "initialFormDraft"
  | "moveFormQuestion"
  | "normalizeFormViewConfig"
  | "publicFormSnapshot"
  | "resolveFormSettings"
  | "toggleFormQuestion"
  | "updateFormHiddenField"
  | "updateFormQuestion"
  | "validateFormConsents"
  | "withFormServerContext"
>;
type TextModule = Pick<
  typeof Text,
  | "formLanguageName"
  | "formLocaleMatch"
  | "formLocaleTag"
  | "formTextIn"
  | "formTextMissing"
  | "formTextVersion"
  | "normalizeFormText"
  | "resolveFormText"
  | "setFormText"
>;
type TestFn = (name: string, fn: () => void | Promise<void>) => void;

/** A rule hiding `target` while the name is empty. */
const hideWhenNameEmpty = (id: string, target: string) => {
  const then = { action: "hide" as const, questionIds: [target] };
  return {
    id,
    when: {
      join: "and" as const,
      items: [{ fieldId: "name", operator: "isEmpty" as const }],
    },
    then,
  };
};

const CATEGORIES = ["Hardware", "Software"].map((value) => ({
  value,
  label: value,
}));
const COLUMNS = [
  { id: "name", header: "Name", type: "text" },
  { id: "category", header: "Category", type: "select", options: CATEGORIES },
  { id: "budget", header: "Budget", type: "number" },
  { id: "source", header: "Source", type: "text" },
  { id: "channel", header: "Channel", type: "select", options: CATEGORIES },
  { id: "due", header: "Due", type: "date" },
  { id: "website", header: "Website", type: "url" },
];

/** A bilingual form with a consent and hidden fields, as a CMS page would publish it. */
const BILINGUAL = {
  defaultLocale: "en",
  locales: ["en", "fr"],
  title: { en: "Project request", fr: "Demande de projet" },
  submitLabel: { en: "Send", fr: "Envoyer la demande" },
  successMessage: "Thanks!",
  questions: [
    {
      id: "name",
      columnId: "name",
      label: { en: "Project name", fr: "Nom du projet" },
      required: true,
    },
    {
      id: "category",
      columnId: "category",
      optionLabels: { Hardware: { en: "Hardware", fr: "Matériel" } },
    },
    {
      id: "privacy",
      kind: "consent",
      text: {
        en: "I accept the {link}.",
        fr: "J’accepte la {link}.",
      },
      link: {
        label: { en: "privacy policy", fr: "politique de confidentialité" },
        href: { en: "https://example.com/privacy", fr: "/fr/confidentialite" },
      },
      version: "2026-09",
    },
    {
      id: "utm_source",
      kind: "hidden",
      source: { type: "urlParam", name: "utm_source" },
    },
    { id: "page", kind: "hidden", source: "pageUrl" },
    {
      id: "campaign",
      kind: "hidden",
      source: { type: "urlParam", name: "utm_campaign" },
      columnId: "source",
    },
    {
      id: "form",
      kind: "hidden",
      source: { type: "static", value: "cms-contact" },
    },
  ],
};

/** The bilingual form as settings save it. */
const saved = (form: FormModule): Form.FormViewSettings =>
  form.normalizeFormViewConfig(BILINGUAL) ?? {};

function textTests(test: TestFn, text: TextModule) {
  test("texts resolve by exact locale, language, default locale, then first", () => {
    const label = { en: "Name", fr: "Nom", "fr-CA": "Nom (CA)", de: "Name DE" };
    assert.equal(text.resolveFormText(label, "fr-CA"), "Nom (CA)");
    assert.equal(text.resolveFormText(label, "fr-BE"), "Nom");
    assert.equal(text.resolveFormText(label, "FR"), "Nom");
    assert.equal(text.resolveFormText({ "fr-FR": "Nom" }, "fr-CA"), "Nom");
    assert.equal(text.resolveFormText(label, "es", "de"), "Name DE");
    assert.equal(text.resolveFormText({ fr: "Nom", de: "X" }, "es"), "Nom");
    assert.equal(text.resolveFormText({ fr: "Nom" }, "es", "en"), "Nom");
    assert.equal(text.resolveFormText("Name", "fr"), "Name");
    assert.equal(text.resolveFormText(undefined, "fr"), undefined);
    assert.equal(text.formLocaleTag("fr_ca"), "fr-CA");
    assert.equal(text.formLocaleTag("zh-hant-tw"), "zh-Hant-TW");
    assert.equal(text.formLocaleTag("not a locale"), undefined);
    assert.equal(text.formLocaleMatch(["en", "fr"], "fr-CA"), "fr");
    assert.equal(text.formLocaleMatch(["en", "fr-FR"], "fr-BE"), "fr-FR");
    assert.equal(text.formLocaleMatch(["en", "fr"], "de"), undefined);
  });

  test("a text's own version says its language, or leaves the caller's default", () => {
    assert.deepEqual(text.formTextVersion({ en: "Name", fr: "Nom" }, "fr-CA"), {
      text: "Nom",
      locale: "fr",
    });
    assert.deepEqual(text.formTextVersion("Name", "fr", "en"), {
      text: "Name",
      locale: "en",
    });
    // Only another language has a text: the caller's own default applies.
    assert.equal(text.formTextVersion({ fr: "Nom" }, "en", "en"), undefined);
    assert.equal(text.resolveFormText({ fr: "Nom" }, "en", "en"), "Nom");
  });

  test("localized texts keep valid locales and plain strings stay plain", () => {
    assert.equal(text.normalizeFormText("  Name "), "Name");
    assert.equal(text.normalizeFormText(" "), undefined);
    assert.deepEqual(
      text.normalizeFormText({
        en: " Name ",
        fr_CA: "Nom",
        "bad tag": "x",
        de: "",
        es: 3,
      }),
      { en: "Name", "fr-CA": "Nom" }
    );
    assert.equal(text.normalizeFormText({ de: "" }), undefined);
  });

  test("settings write one language at a time and flag missing translations", () => {
    assert.deepEqual(text.setFormText("Name", "fr", "Nom", "en"), {
      en: "Name",
      fr: "Nom",
    });
    assert.equal(text.setFormText("Name", "en", "Title", "en"), "Title");
    assert.equal(
      text.setFormText({ en: "Name", fr: "Nom" }, "fr", " ", "en"),
      "Name"
    );
    assert.equal(text.setFormText("Name", "en", "", "en"), undefined);
    assert.equal(text.formTextIn("Name", "en", "en"), "Name");
    assert.equal(text.formTextIn("Name", "fr", "en"), "");
    assert.equal(text.formTextIn({ en: "Name", fr: "Nom" }, "fr", "en"), "Nom");
    assert.equal(text.formTextMissing("Name", "fr", "en"), true);
    assert.equal(text.formTextMissing({ en: "A", fr: "B" }, "fr", "en"), false);
    assert.equal(text.formTextMissing(undefined, "fr", "en"), false);
    assert.equal(text.formTextMissing(undefined, "fr", "en", "Column"), true);
    assert.equal(text.formTextMissing("Name", "en", "en"), false);
    // The default language misses a text only other languages have.
    assert.equal(text.formTextMissing({ fr: "Nom" }, "en", "en"), true);
    assert.equal(text.formLanguageName("fr"), "Français");
    assert.equal(text.formLanguageName("en"), "English");
    assert.equal(text.formLanguageName("en", "fr"), "anglais");
  });
}

function localeTests(test: TestFn, form: FormModule) {
  test("plain settings stay valid and read the same in every language", () => {
    const plain = {
      title: "Request",
      questions: [
        { id: "name", columnId: "name", label: "Your name", help: "Full" },
        { id: "s", kind: "section", title: "More" },
      ],
      submitLabel: "Send",
    };
    assert.deepEqual(form.normalizeFormViewConfig(plain), plain);
    for (const locale of ["en", "fr", undefined]) {
      const resolved = form.resolveFormSettings(
        COLUMNS,
        undefined,
        plain,
        locale
      );
      assert.equal(resolved.title, "Request");
      assert.equal(resolved.submitLabel, "Send");
      assert.equal(resolved.questions[0]?.label, "Your name");
      assert.equal(resolved.consents.length, 0);
      assert.equal(resolved.hiddenFields.length, 0);
    }
  });

  test("a form reads in the reader's language, falling back to its default", () => {
    const fr = form.resolveFormSettings(COLUMNS, undefined, BILINGUAL, "fr-CA");
    assert.equal(fr.title, "Demande de projet");
    assert.equal(fr.submitLabel, "Envoyer la demande");
    assert.equal(fr.successMessage, "Thanks!");
    assert.equal(fr.locale, "fr-CA");
    assert.equal(fr.defaultLocale, "en");
    assert.equal(fr.questions[0]?.label, "Nom du projet");
    assert.deepEqual(
      fr.questions[1]?.options.map((option) => option.label),
      ["Matériel", "Software"]
    );
    assert.deepEqual(fr.consents[0], {
      id: "privacy",
      text: "J’accepte la {link}.",
      link: {
        label: "politique de confidentialité",
        href: "/fr/confidentialite",
      },
      version: "2026-09",
      locale: "fr",
    });
    const de = form.resolveFormSettings(COLUMNS, undefined, BILINGUAL, "de");
    assert.equal(de.title, "Project request");
    assert.equal(de.questions[1]?.label, "Category");
  });

  test("texts with a default of their own never show another language's translation", () => {
    const frenchOnly = {
      defaultLocale: "en",
      title: { fr: "Demande" },
      submitLabel: { fr: "Envoyer la demande" },
      questions: [
        { id: "name", columnId: "name", label: { fr: "Nom du projet" } },
        {
          id: "category",
          columnId: "category",
          optionLabels: { Hardware: { fr: "Matériel" } },
        },
        { id: "terms", kind: "consent", text: { fr: "J’accepte." } },
      ],
    };
    const en = form.resolveFormSettings(COLUMNS, undefined, frenchOnly, "en");
    // The column's name, its option labels and the built-in texts stay English.
    assert.equal(en.questions[0]?.label, "Name");
    assert.deepEqual(
      en.questions[1]?.options.map((option) => option.label),
      ["Hardware", "Software"]
    );
    assert.equal(en.submitLabel, undefined);
    assert.equal(
      en.consents[0]?.text,
      "I agree to the processing of my answers."
    );
    assert.equal(en.consents[0]?.locale, "en");
    // A text with no default of its own shows the version there is.
    assert.equal(en.title, "Demande");
    const fr = form.resolveFormSettings(COLUMNS, undefined, frenchOnly, "fr");
    assert.equal(fr.questions[0]?.label, "Nom du projet");
    assert.equal(fr.submitLabel, "Envoyer la demande");
  });

  test("built-in consent statements follow the host's label overrides", () => {
    const settings = {
      questions: [
        { id: "terms", kind: "consent" as const, link: { href: "/privacy" } },
      ],
    };
    const overrides: Record<string, string> = {
      consentTextLink: "Ich stimme der {link} zu.",
      consentLinkLabel: "Datenschutzerklärung",
    };
    const german = form.resolveFormSettings(
      COLUMNS,
      undefined,
      settings,
      "de",
      (key, fallback) => overrides[key] ?? fallback
    );
    assert.deepEqual(german.consents[0], {
      id: "terms",
      text: "Ich stimme der {link} zu.",
      link: { label: "Datenschutzerklärung", href: "/privacy" },
      version: "1",
      locale: "de",
    });
    const snapshot = form.publicFormSnapshot(settings, COLUMNS);
    const accepted = form.acceptPublicFormResponse(
      snapshot,
      {},
      {
        consents: { terms: true },
        locale: "de",
        translate: (key, fallback) =>
          key === "consentTextLink" ? "Ich stimme der {link} zu." : fallback,
      }
    );
    assert.ok(accepted.ok);
    assert.equal(
      accepted.metadata.consents[0]?.text,
      "Ich stimme der privacy policy zu."
    );
    // Without overrides a German reader sees the English statement, recorded as English.
    const english = form.acceptPublicFormResponse(
      snapshot,
      {},
      { consents: { terms: true }, locale: "de" }
    );
    assert.ok(english.ok);
    assert.equal(english.metadata.consents[0]?.locale, "en");
  });

  test("the form's languages: its default, the added ones and those its texts use", () => {
    assert.deepEqual(form.formLocales(saved(form)), ["en", "fr"]);
    assert.deepEqual(
      form.formLocales({ title: { de: "Titel", en: "Title" } }, "en"),
      ["en", "de"]
    );
    // The table's `locales` are the host's languages: every form has them.
    const table = { locales: ["fr", "en"] };
    assert.deepEqual(form.formViewLocales(table, {}, "de"), ["fr", "en"]);
    assert.deepEqual(form.formViewLocales(table, { title: { it: "Titolo" } }), [
      "fr",
      "en",
      "it",
    ]);
    assert.deepEqual(
      form.formViewLocales({}, { locales: ["en", "it"] }, "fr"),
      ["en", "it"]
    );
    assert.deepEqual(form.formViewLocales({}, {}, "de"), ["de"]);
    // "Add language" offers the host's languages first, then common ones.
    assert.deepEqual(
      form.formAddableLocales({ locales: ["fr", "eu"] }, ["fr"]).slice(0, 3),
      ["eu", "en", "de"]
    );
    assert.ok(!form.formAddableLocales({}, ["en"]).includes("en"));
  });

  test("items missing a translation are flagged per language", () => {
    const questions = form.normalizeFormViewConfig(BILINGUAL)?.questions ?? [];
    const [name, category, consent] = questions;
    assert.ok(name && category && consent);
    const columns = new Map(COLUMNS.map((column) => [column.id, column]));
    assert.equal(
      form.formItemMissingTranslation(name, "fr", "en", columns.get("name")),
      false
    );
    // "Software" has no French label yet, and the label is the column's name.
    assert.equal(
      form.formItemMissingTranslation(
        category,
        "fr",
        "en",
        columns.get("category")
      ),
      true
    );
    assert.equal(form.formItemMissingTranslation(consent, "fr", "en"), false);
    assert.equal(form.formItemMissingTranslation(consent, "de", "en"), true);
    assert.equal(
      form.formItemMissingTranslation(
        category,
        "en",
        "en",
        columns.get("category")
      ),
      false
    );
  });

  test("built-in labels of the new texts exist in English and French", () => {
    assert.equal(
      form.formLabel("errorConsent", "en"),
      "Check this box to continue."
    );
    assert.equal(
      form.formLabel("errorConsent", "fr"),
      "Cochez cette case pour continuer."
    );
    assert.equal(form.formLabel("addLanguage", "fr"), "Ajouter une langue");
    assert.equal(
      form.formLabel("missingTranslation", "en"),
      "Missing translation"
    );
    assert.equal(
      form.formLabel("translationHint", "fr", undefined, {
        language: "anglais",
      }),
      "Les textes non traduits s’affichent en anglais."
    );
  });
}

function consentTests(test: TestFn, form: FormModule) {
  test("a consent is always required and its unchecked box blocks the response", () => {
    const resolved = form.resolveFormSettings(
      COLUMNS,
      undefined,
      BILINGUAL,
      "en"
    );
    assert.deepEqual(
      form.initialFormDraft(resolved.questions, resolved.consents),
      {
        name: "",
        category: "",
        privacy: false,
      }
    );
    assert.deepEqual(
      form.validateFormConsents(resolved.consents, { privacy: false }),
      {
        privacy: "errorConsent",
      }
    );
    assert.deepEqual(
      form.validateFormConsents(resolved.consents, { privacy: "yes" }),
      {
        privacy: "errorConsent",
      }
    );
    assert.deepEqual(
      form.validateFormConsents(resolved.consents, { privacy: true }),
      {}
    );
    // Never a column: the record only has the answers and hidden columns.
    assert.equal(
      Object.hasOwn(
        form.formSubmission(resolved, { name: "A" }, {}),
        "privacy"
      ),
      false
    );
  });

  test("consent statements place their link, or add it after the text", () => {
    const [consent] = form.resolveFormSettings(
      COLUMNS,
      undefined,
      BILINGUAL,
      "en"
    ).consents;
    assert.ok(consent);
    assert.deepEqual(form.formConsentParts(consent), {
      before: "I accept the ",
      link: { label: "privacy policy", href: "https://example.com/privacy" },
      after: ".",
    });
    const builtIn = form.resolveFormSettings(
      COLUMNS,
      undefined,
      {
        questions: [{ id: "c", kind: "consent", link: { href: "/privacy" } }],
      },
      "fr"
    ).consents[0];
    assert.equal(
      builtIn?.text,
      "J’accepte le traitement de mes réponses conformément à la {link}."
    );
    assert.equal(builtIn?.link?.label, "politique de confidentialité");
    assert.equal(builtIn?.version, "1");
    assert.deepEqual(
      form.formConsentParts({
        id: "c",
        text: "I agree.",
        version: "1",
        link: { label: "Terms", href: "/t" },
      }),
      { before: "I agree. (", link: { label: "Terms", href: "/t" }, after: ")" }
    );
    // Unsafe addresses are dropped when saved.
    const saved = form.normalizeFormViewConfig({
      questions: [
        {
          id: "c",
          kind: "consent",
          link: { label: "x", href: "javascript:alert(1)" },
        },
      ],
    })?.questions?.[0];
    assert.deepEqual(saved, { id: "c", kind: "consent", link: { label: "x" } });
  });

  test("rules cannot hide a consent, not even with its section", () => {
    const resolved = form.resolveFormSettings(COLUMNS, undefined, {
      questions: [
        { id: "name", columnId: "name" },
        { id: "extra", kind: "section", title: "Extra" },
        { id: "budget", columnId: "budget" },
        { id: "terms", kind: "consent" },
      ],
      rules: [
        hideWhenNameEmpty("hide-terms", "terms"),
        hideWhenNameEmpty("hide-extra", "extra"),
      ],
    });
    assert.deepEqual(
      resolved.rules.map((rule) => rule.id),
      ["hide-extra"]
    );
    const evaluation = form.evaluateFormView(resolved, {});
    assert.equal(evaluation.hidden.has("budget"), true);
    assert.equal(evaluation.hidden.has("terms"), false);
    assert.equal(resolved.consents.length, 1);
  });

  test("steps show a consent where it is placed, else on the last step or the review", () => {
    const items = (consentAfter: string) => {
      const questions = [
        { id: "name", columnId: "name" },
        { id: "category", columnId: "category" },
        { id: "budget", columnId: "budget" },
      ];
      const index = questions.findIndex((item) => item.id === consentAfter) + 1;
      return [
        ...questions.slice(0, index),
        { id: "terms", kind: "consent" },
        ...questions.slice(index),
      ];
    };
    const stepsOf = (settings: Record<string, unknown>) => {
      const resolved = form.resolveFormSettings(COLUMNS, undefined, {
        layout: "steps",
        ...settings,
      });
      const evaluation = form.evaluateFormView(resolved, {});
      return {
        steps: form
          .formSteps(resolved, evaluation)
          .map((step) => [
            step.id,
            (step.consents ?? []).map((item) => item.id),
          ]),
        review: form
          .formReviewConsents(resolved, evaluation)
          .map((item) => item.id),
      };
    };
    assert.deepEqual(stepsOf({ questions: items("budget") }), {
      steps: [
        ["name", []],
        ["category", []],
        ["budget", ["terms"]],
      ],
      review: [],
    });
    assert.deepEqual(stepsOf({ questions: items("budget"), review: true }), {
      steps: [
        ["name", []],
        ["category", []],
        ["budget", []],
      ],
      review: ["terms"],
    });
    assert.deepEqual(
      stepsOf({ questions: items("name"), review: true }).steps[0],
      ["name", ["terms"]]
    );
    // Placed before the first question: on its step.
    assert.deepEqual(stepsOf({ questions: items("none") }).steps[0], [
      "name",
      ["terms"],
    ]);
    const sectioned = stepsOf({
      questions: [
        { id: "name", columnId: "name" },
        { id: "more", kind: "section", title: "More" },
        { id: "terms", kind: "consent" },
        { id: "budget", columnId: "budget" },
        { id: "last", kind: "section", title: "Last" },
        { id: "category", columnId: "category" },
      ],
    });
    assert.deepEqual(sectioned.steps, [
      ["start", []],
      ["more", ["terms"]],
      ["last", []],
    ]);
    const resolved = form.resolveFormSettings(COLUMNS, undefined, {
      layout: "steps",
      questions: items("budget"),
    });
    const [, , last] = form.formSteps(
      resolved,
      form.evaluateFormView(resolved, {})
    );
    assert.ok(last);
    // A step with a consent cannot be skipped.
    assert.equal(
      form.formStepOptional(last, form.evaluateFormView(resolved, {})),
      false
    );
  });

  test("a consent keeps a step when the rules hide every question", () => {
    const settings = {
      layout: "steps",
      questions: [
        { id: "s1", kind: "section", title: "About" },
        { id: "name", columnId: "name" },
        { id: "terms", kind: "consent" },
      ],
      rules: [hideWhenNameEmpty("hide-about", "s1")],
    };
    const plan = (review: boolean) => {
      const resolved = form.resolveFormSettings(COLUMNS, undefined, {
        ...settings,
        review,
      });
      const result = form.formStepPlan(
        resolved,
        form.evaluateFormView(resolved, {})
      );
      return {
        steps: result.steps.map((step) => [
          step.id,
          (step.consents ?? []).map((consent) => consent.id),
        ]),
        review: result.reviewConsents.map((consent) => consent.id),
      };
    };
    assert.deepEqual(plan(false), {
      steps: [["consents", ["terms"]]],
      review: [],
    });
    assert.deepEqual(plan(true), { steps: [], review: ["terms"] });
  });

  test("the server requires each consent and records it in the response's language", () => {
    const snapshot = form.publicFormSnapshot(saved(form), COLUMNS);
    assert.deepEqual(
      form.acceptPublicFormResponse(snapshot, { name: "A" }, { locale: "fr" }),
      { ok: false, errors: { privacy: "errorConsent" } }
    );
    const accepted = form.acceptPublicFormResponse(
      snapshot,
      { name: "A", privacy: true },
      {
        consents: { privacy: true },
        locale: "fr",
        acceptedAt: new Date("2026-09-24T10:00:00Z"),
      }
    );
    assert.ok(accepted.ok);
    // A consent sent among the answers is not a column value.
    assert.deepEqual(accepted.values, { name: "A" });
    assert.deepEqual(accepted.metadata.consents, [
      {
        id: "privacy",
        version: "2026-09",
        text: "J’accepte la politique de confidentialité.",
        href: "/fr/confidentialite",
        locale: "fr",
        acceptedAt: "2026-09-24T10:00:00.000Z",
      },
    ]);
    // Metadata is never written to a column.
    assert.equal(Object.hasOwn(accepted.values, "privacy"), false);
    const withServer = form.withFormServerContext(accepted, {
      pageId: "contact",
      revision: 12,
      "bad key": "x",
      nested: { a: 1 },
      token: "t".repeat(3000),
    });
    assert.deepEqual(Object.keys(withServer.metadata.server ?? {}), [
      "pageId",
      "revision",
      "token",
    ]);
    assert.equal(withServer.metadata.server?.token?.toString().length, 2048);
  });

  test("consents are added last and never share an asked column's key", () => {
    const added = form.addFormConsent([{ id: "name", columnId: "name" }]);
    assert.deepEqual(added, {
      id: "consent-1",
      questions: [
        { id: "name", columnId: "name" },
        { id: "consent-1", kind: "consent" },
      ],
    });
    // A consent sharing an asked column's id is kept under another id.
    assert.deepEqual(
      form.normalizeFormViewConfig({
        questions: [
          { id: "name", columnId: "name" },
          { id: "name", kind: "consent" },
          { id: "agree", kind: "consent", version: " 2 " },
        ],
      })?.questions,
      [
        { id: "name", columnId: "name" },
        { id: "name-consent", kind: "consent" },
        { id: "agree", kind: "consent", version: "2" },
      ]
    );
    const asked = form.toggleFormQuestion(
      [{ id: "email", kind: "consent" as const }],
      "email",
      true
    );
    assert.deepEqual(
      form.normalizeFormViewConfig({ questions: asked })?.questions,
      [
        { id: "email-consent", kind: "consent" },
        { id: "email-2", columnId: "email" },
      ]
    );
    const updated = form.updateFormQuestion(added.questions, "consent-1", {
      text: { en: "I agree.", fr: "J’accepte." },
      version: "3",
    });
    assert.deepEqual(updated[1], {
      id: "consent-1",
      kind: "consent",
      text: { en: "I agree.", fr: "J’accepte." },
      version: "3",
    });
    // Moves skip hidden fields, which the form never shows.
    const moved = form.moveFormQuestion(
      [
        { id: "a", columnId: "name" },
        {
          id: "h",
          kind: "hidden" as const,
          source: { type: "pageUrl" as const },
        },
        { id: "b", columnId: "budget" },
      ],
      "a",
      1
    );
    assert.deepEqual(
      moved.map((item) => item.id),
      ["h", "b", "a"]
    );
  });
}

function hiddenTests(test: TestFn, form: FormModule) {
  const page = {
    url: "https://example.com/contact?utm_source=newsletter&utm_campaign=spring#access_token=secret",
    referrer: "https://search.example/?q=forms",
    locale: "fr",
  };

  test("hidden fields read the page in the browser", () => {
    const resolved = form.resolveFormSettings(COLUMNS, undefined, BILINGUAL);
    assert.deepEqual(
      form.collectFormHiddenFields(resolved.hiddenFields, page),
      {
        utm_source: "newsletter",
        // Without the query or fragment, which may hold tokens.
        page: "https://example.com/contact",
        campaign: "spring",
      }
    );
    assert.deepEqual(
      form.collectFormHiddenFields(
        [
          { id: "ref", kind: "hidden", source: { type: "referrer" } },
          { id: "lang", kind: "hidden", source: { type: "locale" } },
          {
            id: "gclid",
            kind: "hidden",
            source: { type: "urlParam", name: "gclid" },
          },
        ],
        page
      ),
      { ref: "https://search.example/", lang: "fr" }
    );
    // Bound fields write their column like an answer; fixed values stay a fallback.
    assert.deepEqual(
      form.formSubmission(
        form.resolveFormSettings(COLUMNS, undefined, {
          ...BILINGUAL,
          hiddenValues: { source: "web", budget: 1 },
        }),
        { name: "A" },
        { campaign: "spring" }
      ),
      { source: "spring", budget: 1, name: "A" }
    );
  });

  test("the server keeps only the snapshot's sources, as capped text", () => {
    const snapshot = form.publicFormSnapshot(saved(form), COLUMNS);
    // The browser gets what it reads from the page; columns and fixed texts stay on the server.
    assert.deepEqual(
      snapshot.form.questions?.filter(
        (item) => "kind" in item && item.kind === "hidden"
      ),
      [
        {
          id: "utm_source",
          kind: "hidden",
          source: { type: "urlParam", name: "utm_source" },
        },
        { id: "page", kind: "hidden", source: { type: "pageUrl" } },
        {
          id: "campaign",
          kind: "hidden",
          source: { type: "urlParam", name: "utm_campaign" },
        },
      ]
    );
    assert.deepEqual(
      snapshot.hiddenFields?.map((field) => [field.id, field.columnId]),
      [
        ["utm_source", undefined],
        ["page", undefined],
        ["campaign", "source"],
        ["form", undefined],
      ]
    );
    assert.deepEqual(snapshot.hiddenColumns, [
      { id: "source", header: "Source", type: "text" },
    ]);
    assert.deepEqual(
      snapshot.columns.map((column) => column.id),
      ["name", "category"]
    );
    const accepted = form.acceptPublicFormResponse(
      snapshot,
      { name: "A", source: "forged", website: "https://x.test" },
      {
        consents: { privacy: true },
        fields: {
          utm_source: `news\u0000letter${"x".repeat(600)}`,
          page: "javascript:alert(1)",
          campaign: ["array"],
          form: "forged static",
          unknown: "ignored",
        },
      }
    );
    assert.ok(accepted.ok);
    assert.deepEqual(accepted.values, { name: "A" });
    assert.equal(accepted.metadata.context.utm_source?.length, 500);
    assert.ok(accepted.metadata.context.utm_source?.startsWith("newsletterx"));
    assert.equal(accepted.metadata.context.page, undefined);
    assert.equal(accepted.metadata.context.form, "cms-contact");
    assert.equal(Object.hasOwn(accepted.metadata.context, "unknown"), false);
    const bound = form.acceptPublicFormResponse(
      snapshot,
      { name: "A" },
      {
        consents: { privacy: true },
        fields: {
          campaign: "spring",
          page: `https://example.com/${"p".repeat(3000)}`,
        },
      }
    );
    assert.ok(bound.ok);
    assert.deepEqual(bound.values, { name: "A", source: "spring" });
    // Too long addresses are dropped rather than cut.
    assert.equal(bound.metadata.context.page, undefined);
    // Bound values are not repeated in the context.
    assert.equal(Object.hasOwn(bound.metadata.context, "campaign"), false);
  });

  test("bound hidden values are checked by their column's type", () => {
    const fields = form.resolveFormSettings(COLUMNS, undefined, {
      questions: [
        { id: "name", columnId: "name" },
        {
          id: "n",
          kind: "hidden",
          source: { type: "urlParam", name: "n" },
          columnId: "budget",
        },
        {
          id: "c",
          kind: "hidden",
          source: { type: "urlParam", name: "c" },
          columnId: "channel",
        },
        {
          id: "d",
          kind: "hidden",
          source: { type: "urlParam", name: "d" },
          columnId: "due",
        },
        {
          id: "w",
          kind: "hidden",
          source: { type: "urlParam", name: "w" },
          columnId: "website",
        },
        {
          id: "asked",
          kind: "hidden",
          source: { type: "urlParam", name: "a" },
          columnId: "name",
        },
      ],
    }).hiddenFields;
    assert.deepEqual(
      form.acceptFormHiddenFields(fields, {
        n: "12,5",
        c: "Hardware",
        d: "2026-09-30",
        w: "https://example.com",
        asked: "not written",
      }),
      {
        values: {
          budget: 12.5,
          channel: "Hardware",
          due: "2026-09-30",
          website: "https://example.com",
        },
        context: { asked: "not written" },
      }
    );
    assert.deepEqual(
      form.acceptFormHiddenFields(fields, {
        n: "abc",
        c: "Other",
        d: "2026-02-30",
        w: "ftp://x",
      }).values,
      {}
    );
    // Asking a column stops hidden fields from writing it.
    const toggled = form.toggleFormQuestion(
      [
        {
          id: "src",
          kind: "hidden",
          source: { type: "pageUrl" },
          columnId: "source",
        },
      ],
      "source",
      true
    );
    assert.deepEqual(toggled, [
      { id: "src", kind: "hidden", source: { type: "pageUrl" } },
      { id: "source", columnId: "source" },
    ]);
    assert.deepEqual(
      form
        .formHiddenFieldColumns(COLUMNS, [{ id: "name", columnId: "name" }])
        .map((column) => column.id),
      ["category", "budget", "source", "channel", "due", "website"]
    );
  });

  test("hidden fields are added, re-sourced and listed after the questions", () => {
    const first = form.addFormHiddenField([{ id: "name", columnId: "name" }]);
    assert.equal(first.id, "utm_source");
    const second = form.addFormHiddenField(first.questions);
    assert.equal(second.id, "utm_medium");
    const renamed = form.updateFormHiddenField(second.questions, "utm_medium", {
      source: { type: "urlParam", name: "gclid" },
    });
    assert.equal(renamed.id, "gclid");
    const bound = form.updateFormHiddenField(renamed.questions, "gclid", {
      columnId: "source",
    });
    assert.deepEqual(bound.questions.at(-1), {
      id: "gclid",
      kind: "hidden",
      source: { type: "urlParam", name: "gclid" },
      columnId: "source",
    });
    const rows = form.formSettingsRows(COLUMNS, {
      questions: [...bound.questions, { id: "privacy", kind: "consent" }],
    });
    assert.deepEqual(
      rows.map((row) => `${row.kind}:${row.index}`),
      [
        "question:0",
        "consent:1",
        "question:-1",
        "question:-1",
        "question:-1",
        "question:-1",
        "question:-1",
        "question:-1",
        "hidden:-1",
        "hidden:-1",
      ]
    );
    assert.deepEqual(
      form.normalizeFormViewConfig({
        questions: [
          { id: "a", kind: "hidden", source: "referrer" },
          {
            id: "b",
            kind: "hidden",
            source: { type: "urlParam", name: "bad name" },
          },
          { id: "c", kind: "hidden", source: { type: "static", value: " " } },
          { id: "d", kind: "hidden", source: { type: "cookie" } },
        ],
      })?.questions,
      [{ id: "a", kind: "hidden", source: { type: "referrer" } }]
    );
  });

  test("hosts build bilingual snapshots server-side from their own columns", () => {
    const snapshot = form.buildPublicFormSnapshot({
      view: { id: "contact", config: { form: BILINGUAL } },
      columns: COLUMNS,
      allowedColumnIds: ["name", "category"],
    });
    // Texts keep every language; the binding to a column not allowed is dropped.
    assert.deepEqual(snapshot.form.title, BILINGUAL.title);
    assert.deepEqual(snapshot.form.locales, ["en", "fr"]);
    assert.equal(snapshot.form.defaultLocale, "en");
    assert.deepEqual(
      snapshot.form.questions?.find((item) => item.id === "category"),
      BILINGUAL.questions[1]
    );
    assert.equal(
      snapshot.hiddenFields?.find((field) => field.id === "campaign")?.columnId,
      undefined
    );
    assert.equal(snapshot.hiddenColumns, undefined);
  });
}

/** Localized texts, consents and hidden fields of forms, in both editions. */
export function formI18nSuite(
  test: TestFn,
  form: FormModule,
  text: TextModule
) {
  textTests(test, text);
  localeTests(test, form);
  consentTests(test, form);
  hiddenTests(test, form);
}
