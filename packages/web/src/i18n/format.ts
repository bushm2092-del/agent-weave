import { appI18n } from "./i18n"
import type { AppLocale } from "./locale"

type DateInput = Date | number

function activeLocale(): AppLocale {
  return appI18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
}

function timestamp(value: DateInput): number {
  return value instanceof Date ? value.getTime() : value
}

export function formatNumber(value: number, locale: AppLocale = activeLocale()): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatTime(value: DateInput, locale: AppLocale = activeLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp(value))
}

export function formatRelativeTime(value: DateInput, locale: AppLocale = activeLocale(), now = Date.now()): string {
  const seconds = (timestamp(value) - now) / 1_000
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ]
  const [unit, size] = units.find(([, threshold]) => Math.abs(seconds) >= threshold) ?? ["second", 1]

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / size), unit)
}
