import { expect, type Page, test } from "@playwright/test";

const VIEWS = "/?example=views";
const SETTINGS = "View settings";
const FORM_SETTINGS = /^form settings/i;
const PUBLIC_LINK = /\?example=form&form=request$/;
const CONSENT = /^I agree that my request is processed/;
const CONSENT_FR = /^J’accepte que ma demande soit traitée/;
const REQUEST_SUCCESS = "Thank you! Your request is in the Draft column.";
const REQUEST_SUCCESS_FR = "Merci ! Votre demande est dans la colonne Draft.";
const FORM_MODE = /^form$/i;
const PRIVACY_POLICY = /^privacy policy/;
const PRIVACY_POLICY_FR = /^politique de confidentialité/;
const WANTED_BY = /^Wanted by/;
const WANTED_BY_FR = /^Souhaité pour le/;
const PAGE_ADDRESS = /^http:\/\/127\.0\.0\.1:\d+\/$/;
/** The built-in statement of a consent with a link. */
const BUILT_IN_CONSENT =
  /^I agree to the processing of my answers as described in the privacy policy/;

/** Selects are the table's own listboxes in both editions. */
const choose = async (page: Page, name: string, option: string) => {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

/** A language of a switcher: its radio is visually hidden, the label is clicked. */
const language = (page: Page, scope: string, locale: string) =>
  page.locator(`${scope} [data-form-language="${locale}"]`);

/** Publishes the Request form and returns its public link. */
const publishRequest = async (page: Page) => {
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  await page.getByRole("button", { name: "Share form" }).click();
  await page.getByRole("switch", { name: "Publish to the web" }).check();
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toHaveValue(PUBLIC_LINK);
  const url = await link.inputValue();
  await page.keyboard.press("Escape");
  return url;
};

test.beforeEach(async ({ page }) => {
  await page.goto(VIEWS);
  await page.evaluate(() => localStorage.clear());
  await page.goto(VIEWS);
  await expect(page.getByText("Alpha launch").first()).toBeVisible();
});

test("the form builder switches language and translates a question", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  await page
    .locator("[data-form-toolbar]")
    .getByRole("button", { name: "Edit form" })
    .click();
  const builder = page.getByRole("dialog", { name: "Edit form" });
  const outline = builder.locator("[data-form-builder-outline]");
  const properties = builder.locator("[data-form-builder-properties]");
  const editing = builder
    .locator("[data-form-builder-bar]")
    .getByRole("group", { name: "Editing" });
  await expect(editing.getByRole("radio", { name: "English" })).toBeChecked();
  // Plain texts are written in the default language.
  await outline.getByRole("button", { name: FORM_SETTINGS }).click();
  await expect(
    properties.getByRole("combobox", { name: "Default language" })
  ).toContainText("English");

  await language(page, "[data-form-builder-bar]", "fr").click();
  await expect(editing.getByRole("radio", { name: "Français" })).toBeChecked();
  await expect(properties.locator("[data-form-translation-hint]")).toHaveText(
    "Texts not translated show in English."
  );
  await expect(properties.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Demande de projet"
  );
  // "Wanted by" has no French label yet.
  const due = outline.locator('[data-key="item:dueDate"]');
  await expect(due.locator("[data-form-missing-translation]")).toHaveText(
    "Missing translation"
  );
  await due.getByRole("button").click();
  const label = properties.getByRole("textbox", { name: "Question" });
  await expect(label).toHaveValue("");
  await expect(label).toHaveAttribute("placeholder", "Wanted by");
  await expect(label).toHaveAttribute("lang", "fr");
  await expect(label).toHaveAccessibleDescription("Missing translation");
  await label.fill("Souhaité pour le");
  await label.press("Enter");
  await expect(due.locator("[data-form-missing-translation]")).toHaveCount(0);
  await expect(due).toContainText("Souhaité pour le");

  // The English text is unchanged.
  await language(page, "[data-form-builder-bar]", "en").click();
  await expect(label).toHaveValue("Wanted by");
  await builder.getByRole("button", { name: "Save", exact: true }).click();
  await builder.getByRole("button", { name: "Close", exact: true }).click();
  await expect(builder).toBeHidden();

  // The Form view previews the form in French.
  const form = page.locator("[data-yayaw-form]");
  await expect(form.getByRole("button", { name: WANTED_BY })).toBeVisible();
  await language(page, "[data-form-toolbar]", "fr").click();
  await expect(
    form.getByRole("heading", { name: "Demande de projet" })
  ).toBeVisible();
  await expect(form.getByRole("button", { name: WANTED_BY_FR })).toBeVisible();
  await expect(
    form.getByRole("textbox", { name: "Nom du projet" })
  ).toBeVisible();
});

test("a public form in French shows the French texts", async ({
  context,
  page,
}) => {
  const url = await publishRequest(page);
  const publicPage = await context.newPage();
  await publicPage.goto(`${url}&lang=fr`);
  await expect(
    publicPage.getByRole("heading", { name: "Demande de projet" })
  ).toBeVisible();
  await expect(
    publicPage.getByText(
      "Parlez-nous du projet ; nous répondons sous deux jours."
    )
  ).toBeVisible();
  await publicPage
    .getByRole("textbox", { name: "Nom du projet" })
    .fill("Demande publique");
  // Option labels and built-in labels read in French too.
  const category = publicPage.getByRole("combobox", {
    name: "Catégorie",
    exact: true,
  });
  await expect(category).toContainText("Choisir…");
  await category.click();
  await expect(publicPage.getByRole("option")).toHaveText([
    "Logiciel",
    "Matériel",
    "Service",
    "Autre",
  ]);
  await publicPage.getByRole("option", { name: "Autre", exact: true }).click();
  await expect(
    publicPage.getByRole("textbox", { name: "Dites-nous en plus" })
  ).toBeVisible();
  const consent = publicPage.getByRole("checkbox", { name: CONSENT_FR });
  await expect(
    publicPage.getByRole("link", { name: PRIVACY_POLICY_FR })
  ).toHaveAttribute("target", "_blank");
  await publicPage.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(consent).toBeFocused();
  await expect(
    publicPage.getByText("Cochez cette case pour continuer.")
  ).toBeVisible();
  await expect(publicPage.getByRole("alert")).toHaveText(
    "1 réponse est à corriger."
  );
  await consent.check();
  await publicPage.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(publicPage.getByText(REQUEST_SUCCESS_FR)).toBeVisible();
  // The consent is recorded in French, with its version.
  const result = publicPage.locator("[data-demo-result]");
  await expect(result).toContainText('"version": "2026-09"');
  await expect(result).toContainText('"locale": "fr"');
  await expect(result).toContainText(
    "J’accepte que ma demande soit traitée conformément à la politique de confidentialité."
  );
});

test("an unchecked consent blocks the response; the campaign reaches the metadata", async ({
  context,
  page,
}) => {
  const url = await publishRequest(page);
  const publicPage = await context.newPage();
  await publicPage.goto(`${url}&utm_source=newsletter&utm_campaign=spring`);
  const form = publicPage.locator("[data-yayaw-form]");
  await form.getByRole("textbox", { name: "Project name" }).fill("Campaign");
  await choose(publicPage, "Category", "Service");
  const consent = form.getByRole("checkbox", { name: CONSENT });
  await expect(consent).toHaveAttribute("aria-required", "true");
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(consent).toHaveAccessibleDescription(
    "Check this box to continue."
  );
  await expect(publicPage.getByText(REQUEST_SUCCESS)).toHaveCount(0);

  await consent.check();
  await form.getByRole("button", { name: "Send request" }).click();
  await expect(publicPage.getByText(REQUEST_SUCCESS)).toBeVisible();
  // The host's result: the campaign is in the metadata, never in a column.
  const result = publicPage.locator("[data-demo-result]");
  await expect(result).toContainText('"utm_source": "newsletter"');
  await expect(result).toContainText('"utm_campaign": "spring"');
  await expect(result).toContainText('"language": "en"');
  await expect(result).toContainText('"pageId": "form/request"');
  const accepted = JSON.parse(
    (await result.locator("pre").textContent()) ?? "{}"
  );
  expect(accepted.values).toEqual({
    name: "Campaign",
    category: "Service",
    status: "Draft",
  });
  // The page's address, without its query or fragment.
  expect(accepted.metadata.context.page).toMatch(PAGE_ADDRESS);
  expect(accepted.metadata.consents).toMatchObject([
    { id: "privacy", version: "2026-09", href: "https://example.com/privacy" },
  ]);
});

test("the form builder adds a consent and a hidden field", async ({ page }) => {
  await page.getByRole("button", { name: SETTINGS }).click();
  const menu = page.getByRole("dialog", { name: SETTINGS });
  await menu.getByRole("combobox", { name: "Display mode" }).click();
  await page.getByRole("option", { name: FORM_MODE }).click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page
    .locator("[data-form-toolbar]")
    .getByRole("button", { name: "Edit form" })
    .click();
  const builder = page.getByRole("dialog", { name: "Edit form" });
  const outline = builder.locator("[data-form-builder-outline]");
  const properties = builder.locator("[data-form-builder-properties]");

  await builder.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add consent" }).click();
  const consent = outline.locator('[data-kind="consent"]');
  await expect(consent).toContainText(
    "I agree to the processing of my answers."
  );
  // Always required: a consent has no conditions.
  await expect(properties.locator("[data-form-rules]")).toHaveCount(0);
  const address = properties.getByRole("textbox", { name: "Link address" });
  await address.fill("https://example.com/privacy");
  await address.press("Enter");

  await outline.getByRole("button", { name: "Author", exact: true }).click();
  await properties
    .getByRole("button", { name: "Remove from the form" })
    .click();
  await builder.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add hidden field" }).click();
  const hidden = outline.locator('[data-kind="hidden"]');
  await expect(hidden).toContainText("utm_source");
  await expect(hidden).toContainText("→ Response details");
  await properties
    .getByRole("combobox", { name: "Save in", exact: true })
    .click();
  await page.getByRole("option", { name: "Author", exact: true }).click();
  await expect(hidden).toContainText("→ Author");
  await builder.getByRole("button", { name: "Save", exact: true }).click();
  await builder.getByRole("button", { name: "Close", exact: true }).click();
  await expect(builder).toBeHidden();

  const form = page.locator("[data-yayaw-form]");
  const checkbox = form.getByRole("checkbox", { name: BUILT_IN_CONSENT });
  await expect(checkbox).toBeVisible();
  await expect(
    form.getByRole("link", { name: PRIVACY_POLICY })
  ).toHaveAttribute("href", "https://example.com/privacy");
  // Hidden fields are never shown.
  await expect(form.locator('[data-form-question="author"]')).toHaveCount(0);
  await form
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Consented");
  await form.getByRole("button", { name: "Submit" }).click();
  await expect(checkbox).toBeFocused();
  await checkbox.check();
  await form.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByText("Thank you, your response has been recorded.")
  ).toBeVisible();
});
