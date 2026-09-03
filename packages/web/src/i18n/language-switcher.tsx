import { Globe2Icon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

import { appI18n, setAppLocale } from "./i18n"
import { DEFAULT_LOCALE_PREFERENCE, loadStoredLocale, type LocalePreference } from "./locale"

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
  const [preference, setPreference] = useState<LocalePreference>(loadBrowserLocalePreference)

  const changeLocale = useCallback(
    async (nextPreference: LocalePreference) => {
      await setAppLocale(nextPreference)
      const nextLocale = appI18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
      if (i18n !== appI18n) await i18n.changeLanguage(nextLocale)
      setPreference(nextPreference)
    },
    [i18n],
  )

  useEffect(() => {
    if (preference !== "system") return
    const followSystemLanguage = () => void changeLocale("system")
    window.addEventListener("languagechange", followSystemLanguage)
    return () => window.removeEventListener("languagechange", followSystemLanguage)
  }, [changeLocale, preference])

  const compactLabel = locale === "zh-CN" ? "中文" : "EN"

  return (
    <Select value={preference} onValueChange={(value) => void changeLocale(value as LocalePreference)}>
      <SelectTrigger
        aria-label={t("a11y.languageSwitcher")}
        className="mr-1 h-8 gap-1.5 rounded-[10px] border-border/80 bg-background px-2.5 text-[13px] font-medium shadow-xs hover:bg-muted/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25 data-[state=open]:bg-muted/60 [&>svg:last-child]:size-3.5"
      >
        <Globe2Icon className="size-3.5 text-muted-foreground" />
        <SelectValue>
          {preference === "system" ? t("a11y.systemLanguageCompact", { language: compactLabel }) : compactLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="end"
        sideOffset={6}
        className="w-44 rounded-xl p-1 shadow-lg [&_[data-position=popper]]:h-auto"
      >
        <SelectItem value="system" className="h-10 px-3 pr-9 focus:bg-muted [&>span:first-child]:text-primary">
          {t("a11y.systemLanguage")}
        </SelectItem>
        <SelectItem value="en" className="h-10 px-3 pr-9 focus:bg-muted [&>span:first-child]:text-primary">
          English
        </SelectItem>
        <SelectItem value="zh-CN" className="h-10 px-3 pr-9 focus:bg-muted [&>span:first-child]:text-primary">
          简体中文
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function loadBrowserLocalePreference(): LocalePreference {
  try {
    return loadStoredLocale(window.localStorage) ?? DEFAULT_LOCALE_PREFERENCE
  } catch {
    return DEFAULT_LOCALE_PREFERENCE
  }
}
