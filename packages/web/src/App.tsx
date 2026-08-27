import { ThemeProvider } from 'next-themes'
import { Outlet } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Outlet />
        <Toaster closeButton position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
