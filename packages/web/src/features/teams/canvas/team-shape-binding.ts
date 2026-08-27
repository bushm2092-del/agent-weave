import type { AgentProvider, Team, TeamEvent, TeamMember } from "@agent-weave/contracts"
import { createShapeId, type Editor, type TLShapeId } from "tldraw"
import type { AgentRunner } from "@/features/canvas/agent-options"
import type { AgentShape } from "@/features/canvas/shapes/agent"
import type { AgentTeamShape } from "@/features/canvas/shapes/agent-team"

const programmaticDeletes = new Set<TLShapeId>()

export function isProgrammaticTeamDelete(shapeId: TLShapeId): boolean {
  return programmaticDeletes.has(shapeId)
}

export function syncCanvasTeams(editor: Editor, teams: Team[]): void {
  editor.run(() => teams.forEach((team, index) => syncTeamToCanvas(editor, team, index)), { history: "ignore" })
}

export function reconcileCanvasTeams(editor: Editor, teams: Team[]): void {
  editor.run(
    () => {
      const activeTeamIds = new Set(teams.map((team) => team.id))
      const staleTeamIds = new Set(
        editor.getCurrentPageShapes().flatMap((shape) => {
          if (shape.type === "agent-team" && shape.props.teamId && !activeTeamIds.has(shape.props.teamId)) {
            return [shape.props.teamId]
          }
          if (shape.type === "agent" && shape.props.teamId && !activeTeamIds.has(shape.props.teamId)) {
            return [shape.props.teamId]
          }
          return []
        }),
      )
      for (const teamId of staleTeamIds) removeTeamProjectionInternal(editor, teamId)
      teams.forEach((team, index) => syncTeamToCanvas(editor, team, index))
    },
    { history: "ignore" },
  )
}

export function syncTeamEventToCanvas(editor: Editor, event: TeamEvent, team?: Team): void {
  editor.run(
    () => {
      if (event.type === "team.deleted") removeTeamProjectionInternal(editor, event.teamId)
      else if (team) syncTeamToCanvas(editor, team, 0)
    },
    { history: "ignore" },
  )
}

export function removeTeamProjection(editor: Editor, teamId: string): void {
  editor.run(() => removeTeamProjectionInternal(editor, teamId), { history: "ignore" })
}

function removeTeamProjectionInternal(editor: Editor, teamId: string): void {
  const ids = editor
    .getCurrentPageShapes()
    .filter(
      (shape) =>
        (shape.type === "agent-team" && shape.props.teamId === teamId) ||
        (shape.type === "agent" && shape.props.teamId === teamId),
    )
    .map((shape) => shape.id)
  if (ids.length > 0) deleteProgrammatically(editor, ids)
}

export function createTeamProjection(editor: Editor, team: Team): AgentTeamShape {
  let projection: AgentTeamShape | undefined
  editor.run(
    () => {
      const center = editor.getViewportPageBounds().center
      const index = editor.getCurrentPageShapes().filter((shape) => shape.type === "agent-team").length
      const id = createShapeId()
      editor.createShape<AgentTeamShape>({
        id,
        type: "agent-team",
        x: center.x - 490 + index * 32,
        y: center.y - 350 + index * 32,
        props: newTeamShapeProps(team),
      })
      editor.sendToBack([id])
      projection = editor.getShape<AgentTeamShape>(id)
      if (projection) syncMembers(editor, projection, team)
      editor.select(id)
    },
    { history: "ignore" },
  )
  if (!projection) throw new Error("Unable to create the team projection.")
  return projection
}

function syncTeamToCanvas(editor: Editor, team: Team, index: number): void {
  let teamShape = findTeamShape(editor, team.id)
  if (!teamShape) {
    const center = editor.getViewportPageBounds().center
    const id = createShapeId()
    editor.createShape<AgentTeamShape>({
      id,
      type: "agent-team",
      x: center.x - 490 + index * 36,
      y: center.y - 350 + index * 36,
      props: newTeamShapeProps(team),
    })
    editor.sendToBack([id])
    teamShape = editor.getShape<AgentTeamShape>(id)
  } else {
    editor.updateShape<AgentTeamShape>({
      id: teamShape.id,
      type: "agent-team",
      props: { teamId: team.id, name: team.name },
    })
    teamShape = editor.getShape<AgentTeamShape>(teamShape.id)
  }
  if (teamShape) syncMembers(editor, teamShape, team)
}

function syncMembers(editor: Editor, teamShape: AgentTeamShape, team: Team): void {
  const memberShapes = editor
    .getCurrentPageShapes()
    .filter((shape): shape is AgentShape => shape.type === "agent" && shape.props.teamId === team.id)
  const bySlotId = new Map(memberShapes.map((shape) => [shape.props.slotId, shape]))

  team.members.forEach((member, index) => {
    const position = memberPosition(index)
    const existing = bySlotId.get(member.slotId)
    if (!existing) {
      editor.createShape<AgentShape>({
        id: createShapeId(),
        type: "agent",
        parentId: teamShape.id,
        x: position.x,
        y: position.y,
        props: memberShapeProps(member, team.workspace),
      })
      return
    }
    if (existing.parentId !== teamShape.id) {
      editor.reparentShapes([existing.id], teamShape.id)
      editor.updateShape<AgentShape>({
        id: existing.id,
        type: "agent",
        x: position.x,
        y: position.y,
        props: memberShapeProps(member, team.workspace),
      })
    } else {
      editor.updateShape<AgentShape>({
        id: existing.id,
        type: "agent",
        props: memberShapeProps(member, team.workspace),
      })
    }
    bySlotId.delete(member.slotId)
  })

  if (bySlotId.size > 0)
    deleteProgrammatically(
      editor,
      [...bySlotId.values()].map((shape) => shape.id),
    )
}

function newTeamShapeProps(team: Team): Partial<AgentTeamShape["props"]> {
  const rows = Math.max(1, Math.ceil(team.members.length / 2))
  return {
    teamId: team.id,
    name: team.name,
    w: 912,
    h: Math.max(700, 88 + rows * 584 + 24),
  }
}

function memberShapeProps(member: TeamMember, workspace: string): Partial<AgentShape["props"]> {
  return {
    runner: providerRunner(member.agent),
    model: member.model ?? "",
    workspace,
    title: member.name,
    conversationId: member.conversationId,
    teamId: member.teamId,
    slotId: member.slotId,
    role: member.role,
  }
}

function memberPosition(index: number): { x: number; y: number } {
  return { x: 24 + (index % 2) * 432, y: 88 + Math.floor(index / 2) * 584 }
}

function findTeamShape(editor: Editor, teamId: string): AgentTeamShape | undefined {
  return editor
    .getCurrentPageShapes()
    .find((shape): shape is AgentTeamShape => shape.type === "agent-team" && shape.props.teamId === teamId)
}

function deleteProgrammatically(editor: Editor, ids: TLShapeId[]): void {
  ids.forEach((id) => programmaticDeletes.add(id))
  editor.deleteShapes(ids)
  queueMicrotask(() => ids.forEach((id) => programmaticDeletes.delete(id)))
}

function providerRunner(provider: AgentProvider): AgentRunner {
  if (provider === "claude") return "claude-code"
  return provider
}
