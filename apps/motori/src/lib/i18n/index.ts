import type { useTranslation as useTranslationHook } from "react-i18next";

export { Trans, useTranslation } from "react-i18next";
export { formatDate, formatEur, formatNumber } from "./format";
export type { SupportedLocale } from "./resources";

export type TFunc = ReturnType<typeof useTranslationHook>["t"];
