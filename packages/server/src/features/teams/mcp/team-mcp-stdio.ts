import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { encodeTeamMcpRequestId, TEAM_MCP_REQUEST_ID_HEADER } from "./team-mcp-request-id.js"

const apiUrl = process.env.AGENT_WEAVE_TEAM_API
const token = process.env.AGENT_WEAVE_TEAM_TOKEN
const role = process.env.AGENT_WEAVE_TEAM_ROLE

if (!apiUrl || !token) {
  process.stderr.write("AgentWeave Team MCP bridge is missing its authenticated endpoint.\n")
  process.exit(1)
}

const tools = [
  {
    name: "team_members",
    description: "List the authenticated caller's team members, roles, and current work status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "team_send_message",
    description: "Send a durable work message to a teammate by slot ID or exact name.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Recipient slot ID or exact member name." },
        message: { type: "string" },
      },
      required: ["target", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "team_task_list",
    description: "List the shared team task board.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "team_task_create",
    description: "Create a shared team task.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        description: { type: "string" },
        owner: { type: "string", description: "Optional owner slot ID or exact member name." },
        blockedBy: { type: "array", items: { type: "string" } },
      },
      required: ["subject"],
      additionalProperties: false,
    },
  },
  {
    name: "team_task_update",
    description: "Update a task's status, owner, content, or dependencies.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        subject: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked", "cancelled"] },
        owner: { type: ["string", "null"] },
        blockedBy: { type: "array", items: { type: "string" } },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "team_spawn_agent",
    description: "Leader-only: propose a teammate for explicit user approval before any runtime is created.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        agent: { type: "string", enum: ["claude", "codex", "pi", "opencode"] },
        model: { type: "string" },
      },
      required: ["name", "agent"],
      additionalProperties: false,
    },
  },
] as const

const server = new Server(
  { name: "agent-weave-team", version: "1.0.0" },
  { capabilities: { tools: {} }, instructions: "Durable AgentWeave team coordination tools." },
)

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: tools.filter((tool) => role === "leader" || tool.name !== "team_spawn_agent"),
}))
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const tool = tools.find((candidate) => candidate.name === request.params.name)
  if (!tool) return { isError: true, content: [{ type: "text", text: "Unknown team tool." }] }
  try {
    const response = await fetch(`${apiUrl}/${encodeURIComponent(tool.name)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        [TEAM_MCP_REQUEST_ID_HEADER]: encodeTeamMcpRequestId(extra.requestId),
      },
      body: JSON.stringify(request.params.arguments ?? {}),
      signal: AbortSignal.timeout(30_000),
    })
    const payload = (await response.json()) as { ok?: boolean; data?: unknown; error?: { message?: string } }
    if (!response.ok || !payload.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: payload.error?.message ?? `Team tool failed (${response.status}).` }],
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(payload.data, null, 2) }] }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : "Team tool request failed." }],
    }
  }
})

await server.connect(new StdioServerTransport())
