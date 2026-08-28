import { randomUUID } from "node:crypto"
import type {
  CanvasSnapshot,
  CanvasSummary,
  CreateCanvasRequest,
  SaveCanvasSnapshotRequest,
  UpdateCanvasRequest,
} from "@agent-weave/contracts"
import { teamService } from "../teams/index.js"
import { CanvasError } from "./canvas.errors.js"
import type { CanvasRepository, StoredCanvas } from "./canvas.models.js"
import { canvasRepository } from "./persistence/index.js"

export interface CanvasTeamPort {
  list(canvasId?: string): Array<{ id: string }>
  delete(teamId: string): Promise<void>
}

export class CanvasService {
  constructor(
    private readonly repository: CanvasRepository,
    private readonly teams: CanvasTeamPort,
  ) {}

  create(input: CreateCanvasRequest): CanvasSummary {
    const now = new Date().toISOString()
    const canvas = this.repository.create({
      id: randomUUID(),
      name: input.name,
      description: input.description,
      accent: input.accent,
      createdAt: now,
      updatedAt: now,
    })
    return this.toSummary(canvas)
  }

  list(): CanvasSummary[] {
    return this.repository.list().map((canvas) => this.toSummary(canvas))
  }

  get(canvasId: string): CanvasSummary {
    return this.toSummary(this.requireCanvas(canvasId))
  }

  update(canvasId: string, input: UpdateCanvasRequest): CanvasSummary {
    this.requireCanvas(canvasId)
    const canvas = this.repository.update(canvasId, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.accent === undefined ? {} : { accent: input.accent }),
      updatedAt: new Date().toISOString(),
    })
    return this.toSummary(canvas!)
  }

  async delete(canvasId: string): Promise<void> {
    this.requireCanvas(canvasId)
    for (const team of this.teams.list(canvasId)) await this.teams.delete(team.id)
    this.repository.delete(canvasId)
  }

  getSnapshot(canvasId: string): CanvasSnapshot {
    this.requireCanvas(canvasId)
    const snapshot = this.repository.getSnapshot(canvasId)
    return {
      canvasId,
      document: snapshot?.document ?? null,
      thumbnailDataUrl: snapshot?.thumbnailDataUrl ?? null,
      updatedAt: snapshot?.updatedAt ?? null,
    }
  }

  saveSnapshot(canvasId: string, input: SaveCanvasSnapshotRequest): CanvasSnapshot {
    this.requireCanvas(canvasId)
    const updatedAt = new Date().toISOString()
    const current = this.repository.getSnapshot(canvasId)
    const thumbnailDataUrl = input.thumbnailDataUrl === undefined ? (current?.thumbnailDataUrl ?? null) : input.thumbnailDataUrl
    this.repository.saveSnapshot(canvasId, input.document, thumbnailDataUrl, updatedAt)
    return { canvasId, document: input.document, thumbnailDataUrl, updatedAt }
  }

  private requireCanvas(canvasId: string): StoredCanvas {
    const canvas = this.repository.get(canvasId)
    if (!canvas) throw new CanvasError("CANVAS_NOT_FOUND", "Canvas not found.", 404)
    return canvas
  }

  private toSummary(canvas: StoredCanvas): CanvasSummary {
    return {
      ...canvas,
      agents: countAgentShapes(this.repository.getSnapshot(canvas.id)?.document),
      teams: this.teams.list(canvas.id).length,
      thumbnailDataUrl: this.repository.getSnapshot(canvas.id)?.thumbnailDataUrl ?? null,
    }
  }
}

function countAgentShapes(document: unknown): number {
  if (!document || typeof document !== "object") return 0
  const store = (document as { store?: unknown }).store
  if (!store || typeof store !== "object") return 0
  return Object.values(store).filter((record) => {
    if (!record || typeof record !== "object") return false
    const value = record as { typeName?: unknown; type?: unknown }
    return value.typeName === "shape" && value.type === "agent"
  }).length
}

export const canvasService = new CanvasService(canvasRepository, teamService)
