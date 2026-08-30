import { ThemeProvider } from "next-themes"
import { Outlet } from "react-router"
import { I18nextProvider } from "react-i18next"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { appI18n } from "@/i18n"

export function App() {
  return (
    <I18nextProvider i18n={appI18n}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <Outlet />
          <Toaster closeButton position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
