export type WorkspaceSummary = {
  id: string
  name: string
  description: string
  agents: number
  teams: number
  updatedAt: string
  accent: 'coral' | 'green' | 'blue'
}

export const WORKSPACES: WorkspaceSummary[] = [
  {
    id: 'product-launch',
    name: 'Product launch',
    description: 'Research, positioning, and launch execution',
    agents: 4,
    teams: 1,
    updatedAt: 'Just now',
    accent: 'coral',
  },
  {
    id: 'code-review',
    name: 'Code review team',
    description: 'Implementation, review, and test workflow',
    agents: 3,
    teams: 1,
    updatedAt: '2 hours ago',
    accent: 'green',
  },
  {
    id: 'research-lab',
    name: 'Research lab',
    description: 'Parallel exploration and synthesis',
    agents: 6,
    teams: 2,
    updatedAt: 'Yesterday',
    accent: 'blue',
  },
]

export function getWorkspace(canvasId: string | undefined) {
  return WORKSPACES.find((workspace) => workspace.id === canvasId)
}
