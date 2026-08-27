import { cn } from "@/lib/utils"

export function AgentRunnerIcon({ className, label, src }: { className?: string; label: string; src: string }) {
  return (
    <span className={cn("agent-runner-icon", className)} title={label}>
      <img alt="" aria-hidden="true" draggable={false} src={src} />
    </span>
  )
}
