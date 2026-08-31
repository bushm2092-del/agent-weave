import { createInstance, type i18n } from "i18next"

import { detectSystemLocale, loadStoredLocale, saveLocale, type AppLocale } from "./locale"
import en from "./resources/en"
import zhCN from "./resources/zh-CN"

export const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
} as const

export interface CreateAppI18nOptions {
  initialLocale?: AppLocale
  storage?: Storage | null
  systemLanguages?: readonly string[]
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function systemLanguages(): readonly string[] | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.languages
}

function syncDocumentLanguage(locale: string): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale
}

export function createAppI18n(options: CreateAppI18nOptions = {}): i18n {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const locale =
    options.initialLocale ??
    loadStoredLocale(storage) ??
    detectSystemLocale(options.systemLanguages ?? systemLanguages())
  const instance = createInstance()

  instance.on("languageChanged", syncDocumentLanguage)
  void instance.init({
    compatibilityJSON: "v4",
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false },
    lng: locale,
    resources,
    supportedLngs: ["en", "zh-CN"],
  })

  return instance
}

export const appI18n = createAppI18n()

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await appI18n.changeLanguage(locale)
  saveLocale(browserStorage(), locale)
}
