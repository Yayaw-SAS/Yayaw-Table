import { defineI18n } from "fumadocs-core/i18n";
import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

export const docsI18n = defineI18n({
  languages: ["en", "fr"],
  defaultLanguage: "en",
  hideLocale: "default-locale",
});

export const source = loader({
  baseUrl: "/docs",
  i18n: docsI18n,
  source: docs.toFumadocsSource(),
});
