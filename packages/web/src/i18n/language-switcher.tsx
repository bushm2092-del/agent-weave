import { Globe2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

import { appI18n, setAppLocale } from "./i18n"
import type { AppLocale } from "./locale"

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"

  const changeLocale = async (nextLocale: AppLocale) => {
    await setAppLocale(nextLocale)
    if (i18n !== appI18n) await i18n.changeLanguage(nextLocale)
  }

  return (
    <Select value={locale} onValueChange={(value) => void changeLocale(value as AppLocale)}>
      <SelectTrigger
        aria-label={t("a11y.languageSwitcher")}
        className="mr-1 h-8 gap-1.5 rounded-[10px] border-border/80 bg-background px-2.5 text-[13px] font-medium shadow-xs hover:bg-muted/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25 data-[state=open]:bg-muted/60 [&>svg:last-child]:size-3.5"
      >
        <Globe2Icon className="size-3.5 text-muted-foreground" />
        <SelectValue>{locale === "zh-CN" ? "中文" : "EN"}</SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="end"
        sideOffset={6}
        className="w-44 rounded-xl p-1 shadow-lg [&_[data-position=popper]]:h-auto"
      >
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
