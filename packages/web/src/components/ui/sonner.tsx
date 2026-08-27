"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          success: "!border-success/25 !bg-[color-mix(in_srgb,var(--mio-success)_8%,var(--popover))]",
          warning: "!border-warning/25 !bg-[color-mix(in_srgb,var(--mio-warning)_9%,var(--popover))]",
          error: "!border-destructive/25 !bg-[color-mix(in_srgb,var(--mio-danger)_8%,var(--popover))]",
          info: "!border-info/25 !bg-[color-mix(in_srgb,var(--mio-info)_8%,var(--popover))]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
