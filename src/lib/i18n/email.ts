import { createI18nSync } from "~/lib/i18n/server";

const i18n = createI18nSync("fi");
export const emailT = i18n.getFixedT("fi", "email");
