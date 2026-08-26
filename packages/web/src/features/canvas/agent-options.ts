export const AGENT_RUNNERS = {
  "claude-code": {
    label: "Claude Code",
    shortLabel: "CC",
    provider: "claude",
    accent: "#d97757",
  },
  codex: {
    label: "Codex",
    shortLabel: "CX",
    provider: "codex",
    accent: "#198754",
  },
  pi: {
    label: "Pi",
    shortLabel: "PI",
    provider: "pi",
    accent: "#2563eb",
  },
  opencode: {
    label: "OpenCode",
    shortLabel: "OC",
    provider: "opencode",
    accent: "#7c3aed",
  },
} as const

export type AgentRunner = keyof typeof AGENT_RUNNERS

export const AGENT_RUNNER_IDS = Object.keys(AGENT_RUNNERS) as AgentRunner[]
