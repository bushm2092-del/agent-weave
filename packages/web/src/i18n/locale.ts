export type AppLocale = "en" | "zh-CN"
export type LocalePreference = "system" | AppLocale

export const DEFAULT_LOCALE: AppLocale = "en"
export const DEFAULT_LOCALE_PREFERENCE: LocalePreference = "system"
export const LOCALE_STORAGE_KEY = "agent-weave:locale"

export function normalizeLocale(value: unknown): AppLocale {
  return typeof value === "string" && /^zh(?:-|$)/i.test(value) ? "zh-CN" : DEFAULT_LOCALE
}

export function detectSystemLocale(languages: readonly string[] | undefined): AppLocale {
  for (const language of languages ?? []) {
    if (/^zh(?:-|$)/i.test(language)) return "zh-CN"
    if (/^en(?:-|$)/i.test(language)) return "en"
  }
  return DEFAULT_LOCALE
}

export function resolveLocalePreference(
  preference: LocalePreference,
  languages: readonly string[] | undefined,
): AppLocale {
  return preference === "system" ? detectSystemLocale(languages) : preference
}

export function loadStoredLocale(storage: Storage | null | undefined): AppLocale | undefined {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY)

    return value === "en" || value === "zh-CN" ? value : undefined
  } catch {
    return undefined
  }
}

export function saveLocale(storage: Storage | null | undefined, locale: AppLocale): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Storage can be unavailable in private or security-restricted contexts.
  }
}

export function saveLocalePreference(storage: Storage | null | undefined, preference: LocalePreference): void {
  try {
    if (preference === "system") storage?.removeItem(LOCALE_STORAGE_KEY)
    else saveLocale(storage, preference)
  } catch {
    // Storage can be unavailable in private or security-restricted contexts.
  }
}
