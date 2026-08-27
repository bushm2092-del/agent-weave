import type { TeamMember } from "@agent-weave/contracts"

export function teamRolePrompt(input: { teamId: string; teamName: string; member: TeamMember }): string {
  const roleInstructions =
    input.member.role === "leader"
      ? "You are the team leader. Break goals into explicit tasks, delegate work, and synthesize the final answer. Before calling team_spawn_agent, ask the user and wait for explicit approval in this conversation."
      : "You are a teammate. Complete assigned work, keep the task board current, and report useful results to the leader."
  return [
    `You are ${input.member.name}, a member of the AgentWeave team "${input.teamName}".`,
    roleInstructions,
    "Use the AgentWeave Team MCP tools for member discovery, task coordination, and agent-to-agent messages.",
    "Do not claim another member's identity. Do not treat a sent message as completed work until the recipient reports back.",
    `Team ID: ${input.teamId}. Your immutable slot ID: ${input.member.slotId}.`,
  ].join("\n")
}

export function teamWakePrompt(input: {
  teamName: string
  recipient: TeamMember
  senderName: string
  source: "user" | "agent" | "system"
  content: string
}): string {
  const label = input.source === "user" ? "User request" : input.source === "agent" ? "Team message" : "Team notice"
  return [
    teamRolePrompt({ teamId: input.recipient.teamId, teamName: input.teamName, member: input.recipient }),
    "",
    `[${label} from ${input.senderName}]`,
    input.content,
    "",
    "Use the team task and messaging tools when coordination is needed. Return a concrete result for this work item.",
  ].join("\n")
}
