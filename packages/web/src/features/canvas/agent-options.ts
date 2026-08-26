export const AGENT_RUNNERS = {
  'claude-code': {
    label: 'Claude Code',
    shortLabel: 'CC',
    models: ['Claude Opus 4.1', 'Claude Sonnet 4'],
    accent: '#d97757',
  },
  codex: {
    label: 'Codex',
    shortLabel: 'CX',
    models: ['GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'],
    accent: '#198754',
  },
  pi: {
    label: 'Pi',
    shortLabel: 'PI',
    models: ['Provider default', 'Custom model'],
    accent: '#2563eb',
  },
  opencode: {
    label: 'OpenCode',
    shortLabel: 'OC',
    models: ['Provider default', 'Custom model'],
    accent: '#7c3aed',
  },
} as const

export type AgentRunner = keyof typeof AGENT_RUNNERS

export const AGENT_RUNNER_IDS = Object.keys(AGENT_RUNNERS) as AgentRunner[]
