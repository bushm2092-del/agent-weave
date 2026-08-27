export const AGENT_RUNNERS = {
  "claude-code": {
    label: "Claude Code",
    provider: "claude",
    iconSrc: "/agent-icons/claude-code.svg",
  },
  codex: {
    label: "Codex",
    provider: "codex",
    iconSrc: "/agent-icons/codex.svg",
  },
  pi: {
    label: "Pi",
    provider: "pi",
    iconSrc: "/agent-icons/pi.svg",
  },
  opencode: {
    label: "OpenCode",
    provider: "opencode",
    iconSrc: "/agent-icons/opencode.svg",
  },
} as const

export type AgentRunner = keyof typeof AGENT_RUNNERS

export const AGENT_RUNNER_IDS = Object.keys(AGENT_RUNNERS) as AgentRunner[]
