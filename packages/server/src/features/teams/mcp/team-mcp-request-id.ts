import { z } from "zod"

export const TEAM_MCP_REQUEST_ID_HEADER = "x-agent-weave-mcp-request-id"

const teamMcpRequestIdSchema = z.union([z.string(), z.number()])

export type TeamMcpRequestId = z.infer<typeof teamMcpRequestIdSchema>

export function encodeTeamMcpRequestId(requestId: TeamMcpRequestId): string {
  return JSON.stringify(requestId)
}

export function decodeTeamMcpRequestId(value: string | undefined): TeamMcpRequestId | undefined {
  if (value === undefined) return undefined
  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    decoded = null
  }
  return teamMcpRequestIdSchema.parse(decoded)
}
